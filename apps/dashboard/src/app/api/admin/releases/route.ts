import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ReleaseStatus } from "@custom-os-ota/database";
import { isValidOtaChannelKey, sortOtaChannelKeys } from "@custom-os-ota/ota-protocol";
import { writeAudit } from "@custom-os-ota/audit";
import { extractClientIp } from "@custom-os-ota/observability";
import { requireAdminApi, isAuthFailure } from "@/lib/api-auth";
import { extractValidationFailureReason } from "@/lib/validation-failure";

export async function GET() {
  const auth = await requireAdminApi("release.read");
  if (isAuthFailure(auth)) return auth.error;

  const releases = await prisma.release.findMany({
    include: {
      deviceModel: { select: { codename: true, displayName: true } },
      packages: { select: { id: true, packageType: true, byteSize: true, validationReport: true } },
      approvals: {
        include: { approver: { select: { email: true, displayName: true } } },
      },
      channelPublications: {
        select: { channelKey: true },
        orderBy: { publishedAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    releases: releases.map((r) => ({
      id: r.id,
      versionLabel: r.versionLabel,
      buildId: r.buildId,
      incrementalBuild: r.incrementalBuild,
      postTimestamp: r.postTimestamp,
      channelKey: r.channelKey,
      channelKeys:
        r.channelPublications.length > 0
          ? [...new Set([r.channelKey, ...r.channelPublications.map((p) => p.channelKey)])]
          : r.targetChannelKeys.length > 0
            ? sortOtaChannelKeys(r.targetChannelKeys)
            : [r.channelKey],
      status: r.status,
      validationFailureReason:
        r.status === ReleaseStatus.QUARANTINED ? extractValidationFailureReason(r.packages) : null,
      codename: r.deviceModel.codename,
      deviceDisplayName: r.deviceModel.displayName,
      packageCount: r.packages.length,
      approvalCount: r.approvals.length,
      createdAt: r.createdAt.toISOString(),
      publishedAt: r.publishedAt?.toISOString() ?? null,
    })),
  });
}

const createSchema = z.object({
  deviceModelId: z.string().min(1),
  versionLabel: z.string().min(1).max(120),
  buildId: z.string().min(1).max(128),
  incrementalBuild: z.string().min(1).max(32),
  postTimestamp: z.string().regex(/^\d{9,11}$/, "must be UTC epoch seconds"),
  channelKeys: z
    .array(z.string().min(1).max(64).refine(isValidOtaChannelKey, "invalid channel key"))
    .min(1)
    .max(10),
  changelog: z.string().max(5000).optional(),
  buildFingerprint: z.string().max(256).optional(),
  androidVersion: z.string().max(32).optional(),
  securityPatchLevel: z.string().max(32).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdminApi("release.create");
  if (isAuthFailure(auth)) return auth.error;

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "invalid_request", details: body.error.flatten() }, { status: 400 });
  }

  try {
    const deviceModel = await prisma.deviceModel.findFirst({
      where: { id: body.data.deviceModelId, isActive: true },
    });
    if (!deviceModel) {
      return NextResponse.json({ error: "device_model_not_found" }, { status: 404 });
    }

    const { clientIp, forwardedFor } = extractClientIp(request.headers);
    const channelKeys = sortOtaChannelKeys(body.data.channelKeys);
    const channelKey = channelKeys[0]!;

    const release = await prisma.release.create({
      data: {
        deviceModelId: body.data.deviceModelId,
        versionLabel: body.data.versionLabel,
        buildId: body.data.buildId,
        incrementalBuild: body.data.incrementalBuild,
        postTimestamp: body.data.postTimestamp,
        channelKey,
        targetChannelKeys: channelKeys,
        changelog: body.data.changelog,
        buildFingerprint: body.data.buildFingerprint,
        androidVersion: body.data.androidVersion,
        securityPatchLevel: body.data.securityPatchLevel,
        status: ReleaseStatus.DRAFT,
      },
      include: { deviceModel: { select: { codename: true } } },
    });

    await writeAudit({
      actorId: auth.session.userId,
      action: "release.create",
      targetType: "Release",
      targetId: release.id,
      metadata: {
        codename: release.deviceModel.codename,
        incrementalBuild: release.incrementalBuild,
        channelKey: release.channelKey,
        targetChannelKeys: release.targetChannelKeys,
      },
      clientIp,
      forwardedFor,
      result: "success",
    });

    return NextResponse.json({ release: { id: release.id, status: release.status } }, { status: 201 });
  } catch (err) {
    console.error("release.create failed", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
