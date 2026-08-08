import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import { loadEnv } from "@custom-os-ota/configuration";
import { prisma, ReleaseStatus } from "@custom-os-ota/database";
import {
  copyObject,
  getTextObject,
  putTextObject,
} from "@custom-os-ota/object-storage";
import {
  formatChannelMetadata,
  publishedMetadataKey,
  publicArtifactUrl,
  resolvePublishedPackageKey,
} from "@custom-os-ota/ota-protocol";
import { createLogger } from "@custom-os-ota/observability";
import type { PublishJobPayload } from "./publish-types.js";

const log = createLogger("worker");

async function isOtaGloballyPaused(): Promise<boolean> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "otaOffersPaused" } });
  return Boolean(setting?.value);
}

export async function processPublish(payload: PublishJobPayload): Promise<{ ok: boolean; summary: string }> {
  const env = loadEnv();

  const release = await prisma.release.findUnique({
    where: { id: payload.releaseId },
    include: {
      deviceModel: true,
      packages: true,
    },
  });

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
  const copiedKeys: string[] = [];

  for (const pkg of release.packages) {
    const destKey = resolvePublishedPackageKey(
      codename,
      pkg.packageType,
      pkg.targetIncremental,
      pkg.sourceIncremental,
    );

    await copyObject({
      sourceBucket: env.S3_BUCKET_QUARANTINE,
      sourceKey: pkg.objectKey,
      destBucket: env.S3_BUCKET_PUBLISHED,
      destKey,
    });

    copiedKeys.push(destKey);
  }

  const metadataKey = publishedMetadataKey(codename, release.channelKey);
  const existingMetadata = await getTextObject(env.S3_BUCKET_PUBLISHED, metadataKey);

  if (existingMetadata) {
    await prisma.channelSnapshot.create({
      data: {
        deviceModelId: release.deviceModelId,
        channelKey: release.channelKey,
        metadataBody: existingMetadata,
        objectKey: metadataKey,
      },
    });
  }

  const metadataBody = formatChannelMetadata({
    incrementalBuild: release.incrementalBuild,
    postTimestamp: release.postTimestamp,
    codename,
    channelKey: release.channelKey,
  });

  await putTextObject({
    bucket: env.S3_BUCKET_PUBLISHED,
    objectKey: metadataKey,
    body: metadataBody,
  });

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
      metadataKey,
      metadataUrl: publicArtifactUrl(env.OTA_PUBLIC_BASE_URL, metadataKey),
      copiedKeys,
    },
    result: "success",
  });

  return { ok: true, summary: "published" };
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
