import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ReleaseStatus } from "@custom-os-ota/database";
import { writeAudit } from "@custom-os-ota/audit";
import { extractClientIp } from "@custom-os-ota/observability";
import { requireAdminApi, isAuthFailure } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAdminApi("release.read");
  if (isAuthFailure(auth)) return auth.error;

  const releases = await prisma.release.findMany({
    include: {
      deviceModel: { select: { codename: true, displayName: true } },
      packages: { select: { id: true, packageType: true, byteSize: true } },
      approvals: {
        include: { approver: { select: { email: true, displayName: true } } },
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
      status: r.status,
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
  buildId: z.string().min(1).max(64),
  incrementalBuild: z.string().min(1).max(32),
  postTimestamp: z.string().regex(/^\d{9,11}$/, "must be UTC epoch seconds"),
  channelKey: z.enum(["stable", "beta", "alpha"]),
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

  const deviceModel = await prisma.deviceModel.findFirst({
    where: { id: body.data.deviceModelId, isActive: true },
  });
  if (!deviceModel) {
    return NextResponse.json({ error: "device_model_not_found" }, { status: 404 });
  }

  const { clientIp, forwardedFor } = extractClientIp(request.headers);

  const release = await prisma.release.create({
    data: {
      deviceModelId: body.data.deviceModelId,
      versionLabel: body.data.versionLabel,
      buildId: body.data.buildId,
      incrementalBuild: body.data.incrementalBuild,
      postTimestamp: body.data.postTimestamp,
      channelKey: body.data.channelKey,
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
    },
    clientIp,
    forwardedFor,
    result: "success",
  });

  return NextResponse.json({ release: { id: release.id, status: release.status } }, { status: 201 });
}
