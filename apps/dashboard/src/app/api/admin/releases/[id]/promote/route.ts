import { NextResponse } from "next/server";
import { z } from "zod";
import { loadEnv } from "@custom-os-ota/configuration";
import { prisma, ReleaseStatus } from "@custom-os-ota/database";
import { writeAudit } from "@custom-os-ota/audit";
import { extractClientIp } from "@custom-os-ota/observability";
import { isValidOtaChannelKey } from "@custom-os-ota/ota-protocol";
import { requireAdminApi, isAuthFailure } from "@/lib/api-auth";
import { enqueuePromoteJob } from "@/lib/queue";

type Params = { params: Promise<{ id: string }> };

const promoteSchema = z.object({
  channelKeys: z.array(z.string().min(1)).min(1).max(10),
});

async function isOtaGloballyPaused(): Promise<boolean> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "otaOffersPaused" } });
  return Boolean(setting?.value);
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireAdminApi("release.promote");
  if (isAuthFailure(auth)) return auth.error;

  const { id } = await params;
  const body = promoteSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "invalid_request", details: body.error.flatten() }, { status: 400 });
  }

  const uniqueKeys = [...new Set(body.data.channelKeys)];
  for (const channelKey of uniqueKeys) {
    if (!isValidOtaChannelKey(channelKey)) {
      return NextResponse.json({ error: "invalid_channel", channelKey }, { status: 400 });
    }
  }

  const release = await prisma.release.findUnique({
    where: { id },
    include: { channelPublications: { select: { channelKey: true } } },
  });

  if (!release) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (release.status !== ReleaseStatus.PUBLISHED) {
    return NextResponse.json({ error: "release_not_published", status: release.status }, { status: 409 });
  }

  if (await isOtaGloballyPaused()) {
    return NextResponse.json({ error: "ota_paused_globally" }, { status: 409 });
  }

  const alreadyPublished = new Set(release.channelPublications.map((p) => p.channelKey));
  const invalidTargets = uniqueKeys.filter((k) => k === release.channelKey || alreadyPublished.has(k));
  if (invalidTargets.length > 0) {
    return NextResponse.json(
      { error: "channel_already_published", channels: invalidTargets },
      { status: 409 },
    );
  }

  const { clientIp, forwardedFor } = extractClientIp(request.headers);

  await enqueuePromoteJob({
    releaseId: release.id,
    channelKeys: uniqueKeys,
    publishedById: auth.session.userId,
  });

  await writeAudit({
    actorId: auth.session.userId,
    action: "release.promote.requested",
    targetType: "Release",
    targetId: release.id,
    metadata: {
      incrementalBuild: release.incrementalBuild,
      originChannel: release.channelKey,
      channelKeys: uniqueKeys,
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
      channelKeys: uniqueKeys,
      publicBaseUrl: env.OTA_PUBLIC_BASE_URL,
    },
    { status: 202 },
  );
}
