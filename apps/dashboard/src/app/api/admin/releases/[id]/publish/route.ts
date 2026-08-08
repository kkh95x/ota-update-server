import { NextResponse } from "next/server";
import { loadEnv } from "@custom-os-ota/configuration";
import { prisma, ReleaseStatus } from "@custom-os-ota/database";
import { writeAudit } from "@custom-os-ota/audit";
import { extractClientIp } from "@custom-os-ota/observability";
import { requireAdminApi, isAuthFailure } from "@/lib/api-auth";
import { enqueuePublishJob } from "@/lib/queue";

type Params = { params: Promise<{ id: string }> };

async function isOtaGloballyPaused(): Promise<boolean> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "otaOffersPaused" } });
  return Boolean(setting?.value);
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireAdminApi("release.publish");
  if (isAuthFailure(auth)) return auth.error;

  const { id } = await params;

  const release = await prisma.release.findUnique({
    where: { id },
    include: { packages: true },
  });

  if (!release) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (release.status === ReleaseStatus.PUBLISHED) {
    return NextResponse.json({ ok: true, status: release.status, alreadyPublished: true });
  }

  if (release.status !== ReleaseStatus.APPROVED) {
    return NextResponse.json({ error: "release_not_ready", status: release.status }, { status: 409 });
  }

  if (release.packages.length === 0) {
    return NextResponse.json({ error: "no_packages" }, { status: 409 });
  }

  if (!release.postTimestamp) {
    return NextResponse.json({ error: "post_timestamp_required" }, { status: 409 });
  }

  if (await isOtaGloballyPaused()) {
    return NextResponse.json({ error: "ota_paused_globally" }, { status: 409 });
  }

  const { clientIp, forwardedFor } = extractClientIp(request.headers);

  await enqueuePublishJob({ releaseId: release.id, publishedById: auth.session.userId });

  await writeAudit({
    actorId: auth.session.userId,
    action: "release.publish.requested",
    targetType: "Release",
    targetId: release.id,
    metadata: {
      incrementalBuild: release.incrementalBuild,
      channelKey: release.channelKey,
      packageCount: release.packages.length,
    },
    clientIp,
    forwardedFor,
    result: "success",
  });

  const env = loadEnv();

  return NextResponse.json(
    {
      ok: true,
      queued: true,
      releaseId: release.id,
      publicBaseUrl: env.OTA_PUBLIC_BASE_URL,
    },
    { status: 202 },
  );
}
