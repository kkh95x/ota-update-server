import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import { loadEnv } from "@custom-os-ota/configuration";
import { prisma, ReleaseStatus } from "@custom-os-ota/database";
import { isValidOtaChannelKey, expandWithSecurityPreviewOverlays, publicArtifactUrl, publishedMetadataKey } from "@custom-os-ota/ota-protocol";
import { createLogger } from "@custom-os-ota/observability";
import {
  ensurePublishedPackages,
  findExistingPublishedChannelKeys,
  publishChannelMetadata,
  resolvePublishChannelKeys,
  type ReleaseWithPackages,
} from "./channel-publish.js";
import type { PublishJobPayload } from "./publish-types.js";

const log = createLogger("worker");

async function isOtaGloballyPaused(): Promise<boolean> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "otaOffersPaused" } });
  return Boolean(setting?.value);
}

export async function processPublish(payload: PublishJobPayload): Promise<{ ok: boolean; summary: string }> {
  const release = (await prisma.release.findUnique({
    where: { id: payload.releaseId },
    include: {
      deviceModel: true,
      packages: true,
    },
  })) as ReleaseWithPackages | null;

  if (!release) {
    return { ok: false, summary: "release not found" };
  }

  if (release.status === ReleaseStatus.PUBLISHED) {
    return { ok: true, summary: "already published" };
  }

  if (release.status !== ReleaseStatus.APPROVED) {
    return { ok: false, summary: `release status is ${release.status}` };
  }

  if (await isOtaGloballyPaused()) {
    return { ok: false, summary: "ota offers paused globally" };
  }

  if (!release.postTimestamp) {
    return { ok: false, summary: "postTimestamp missing on release" };
  }

  if (release.packages.length === 0) {
    return { ok: false, summary: "no packages attached" };
  }

  const codename = release.deviceModel.codename;
  const copiedKeys = await ensurePublishedPackages(release);

  const channelsToPublish = resolvePublishChannelKeys(release);

  const publishedChannels: string[] = [];
  let metadataKey = "";
  let metadataUrl = "";

  for (const channelKey of channelsToPublish) {
    const result = await publishChannelMetadata({
      release,
      channelKey,
      publishedById: payload.publishedById,
    });
    publishedChannels.push(channelKey);
    metadataKey = result.metadataKey;
    metadataUrl = result.metadataUrl;
  }

  await prisma.release.update({
    where: { id: release.id },
    data: {
      status: ReleaseStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  log.info("publish.completed", {
    event: "publish.completed",
    metadata: {
      releaseId: release.id,
      codename,
      channelKey: release.channelKey,
      publishedChannels,
      metadataKey,
      metadataUrl,
      copiedKeys,
    },
    result: "success",
  });

  return { ok: true, summary: `published to ${publishedChannels.join(", ")}` };
}

export function startPublishWorker(connection: Redis, concurrency: number): Worker<PublishJobPayload> {
  const worker = new Worker<PublishJobPayload>(
    "ota-publish",
    async (bullJob) => {
      log.info("publish.job.received", {
        event: "publish.job.received",
        metadata: { jobId: bullJob.id, releaseId: bullJob.data.releaseId },
      });

      const result = await processPublish(bullJob.data);

      log.info("publish.job.finished", {
        event: "publish.job.finished",
        metadata: { jobId: bullJob.id, ok: result.ok, summary: result.summary },
        result: result.ok ? "success" : "failure",
      });

      if (!result.ok) {
        throw new Error(result.summary);
      }

      return result;
    },
    { connection, concurrency },
  );

  worker.on("failed", (job, err) => {
    log.error("publish.job.failed", {
      event: "publish.job.failed",
      metadata: { jobId: job?.id, releaseId: job?.data.releaseId, error: err.message },
      result: "failure",
    });
  });

  return worker;
}

export type PromoteJobPayload = {
  releaseId: string;
  channelKeys: string[];
  publishedById: string;
};

export async function processPromote(payload: PromoteJobPayload): Promise<{ ok: boolean; summary: string }> {
  const release = (await prisma.release.findUnique({
    where: { id: payload.releaseId },
    include: { deviceModel: true, packages: true },
  })) as ReleaseWithPackages | null;

  if (!release) {
    return { ok: false, summary: "release not found" };
  }

  if (release.status !== ReleaseStatus.PUBLISHED) {
    return { ok: false, summary: "release must be published before promotion" };
  }

  if (await isOtaGloballyPaused()) {
    return { ok: false, summary: "ota offers paused globally" };
  }

  if (!release.postTimestamp) {
    return { ok: false, summary: "postTimestamp missing on release" };
  }

  if (release.packages.length === 0) {
    return { ok: false, summary: "no packages attached" };
  }

  const uniqueKeys = expandWithSecurityPreviewOverlays([...new Set(payload.channelKeys)]);
  for (const channelKey of uniqueKeys) {
    if (!isValidOtaChannelKey(channelKey)) {
      return { ok: false, summary: `invalid channel: ${channelKey}` };
    }
    if (channelKey === release.channelKey) {
      return { ok: false, summary: `channel already origin: ${channelKey}` };
    }
  }

  const existingKeys = await findExistingPublishedChannelKeys(release.id, uniqueKeys);
  if (existingKeys.length > 0) {
    return { ok: false, summary: `already published on: ${existingKeys.join(", ")}` };
  }

  await ensurePublishedPackages(release);

  const promoted: string[] = [];
  for (const channelKey of uniqueKeys) {
    await publishChannelMetadata({
      release,
      channelKey,
      publishedById: payload.publishedById,
    });
    promoted.push(channelKey);
  }

  const env = loadEnv();
  const codename = release.deviceModel.codename;

  log.info("promote.completed", {
    event: "promote.completed",
    metadata: {
      releaseId: release.id,
      codename,
      promotedChannels: promoted,
      metadataUrls: promoted.map((ch) =>
        publicArtifactUrl(env.OTA_PUBLIC_BASE_URL, publishedMetadataKey(codename, ch)),
      ),
    },
    result: "success",
  });

  return { ok: true, summary: `promoted to ${promoted.join(", ")}` };
}

export function startPromoteWorker(connection: Redis, concurrency: number): Worker<PromoteJobPayload> {
  const worker = new Worker<PromoteJobPayload>(
    "ota-promote",
    async (bullJob) => {
      log.info("promote.job.received", {
        event: "promote.job.received",
        metadata: { jobId: bullJob.id, releaseId: bullJob.data.releaseId, channelKeys: bullJob.data.channelKeys },
      });

      const result = await processPromote(bullJob.data);

      log.info("promote.job.finished", {
        event: "promote.job.finished",
        metadata: { jobId: bullJob.id, ok: result.ok, summary: result.summary },
        result: result.ok ? "success" : "failure",
      });

      if (!result.ok) {
        throw new Error(result.summary);
      }

      return result;
    },
    { connection, concurrency },
  );

  worker.on("failed", (job, err) => {
    log.error("promote.job.failed", {
      event: "promote.job.failed",
      metadata: { jobId: job?.id, releaseId: job?.data.releaseId, error: err.message },
      result: "failure",
    });
  });

  return worker;
}
