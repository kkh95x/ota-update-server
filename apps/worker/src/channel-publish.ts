import { loadEnv } from "@custom-os-ota/configuration";
import { prisma, ReleaseStatus } from "@custom-os-ota/database";
import {
  copyObject,
  getTextObject,
  headObject,
  putTextObject,
} from "@custom-os-ota/object-storage";
import {
  formatChannelMetadata,
  publishedMetadataKey,
  publicArtifactUrl,
  resolvePublishedPackageKey,
  securityPreviewOverlayKey,
  sortOtaChannelKeys,
} from "@custom-os-ota/ota-protocol";
import type { Release, DeviceModel, OtaPackage } from "@custom-os-ota/database";

export type ReleaseWithPackages = Release & {
  deviceModel: DeviceModel;
  packages: OtaPackage[];
  targetChannelKeys: string[];
};

export function resolvePublishChannelKeys(release: Pick<ReleaseWithPackages, "channelKey" | "targetChannelKeys">): string[] {
  return release.targetChannelKeys.length > 0
    ? sortOtaChannelKeys(release.targetChannelKeys)
    : [release.channelKey];
}

export async function findExistingPublishedChannelKeys(
  releaseId: string,
  channelKeys: string[],
): Promise<string[]> {
  const rows = await prisma.releaseChannelPublication.findMany({
    where: { releaseId, channelKey: { in: channelKeys } },
    select: { channelKey: true },
  });
  return rows.map((row) => row.channelKey);
}

export async function ensurePublishedPackages(release: ReleaseWithPackages): Promise<string[]> {
  const env = loadEnv();
  const codename = release.deviceModel.codename;
  const copiedKeys: string[] = [];

  for (const pkg of release.packages) {
    const destKey = resolvePublishedPackageKey(
      codename,
      pkg.packageType,
      pkg.targetIncremental,
      pkg.sourceIncremental,
    );

    const existing = await headObject(env.S3_BUCKET_PUBLISHED, destKey);
    if (!existing) {
      await copyObject({
        sourceBucket: env.S3_BUCKET_QUARANTINE,
        sourceKey: pkg.objectKey,
        destBucket: env.S3_BUCKET_PUBLISHED,
        destKey,
      });
    }

    copiedKeys.push(destKey);
  }

  return copiedKeys;
}

export async function publishChannelMetadata(params: {
  release: ReleaseWithPackages;
  channelKey: string;
  publishedById?: string | null;
}): Promise<{ metadataKey: string; metadataUrl: string; created: boolean }> {
  const env = loadEnv();
  const { release, channelKey, publishedById } = params;
  const codename = release.deviceModel.codename;

  if (!release.postTimestamp) {
    throw new Error("postTimestamp missing on release");
  }

  const metadataKey = publishedMetadataKey(codename, channelKey);

  const existingPublication = await prisma.releaseChannelPublication.findUnique({
    where: { releaseId_channelKey: { releaseId: release.id, channelKey } },
  });
  if (existingPublication) {
    await publishSecurityPreviewOverlayIfNeeded({ release, baseChannelKey: channelKey, publishedById });
    return {
      metadataKey,
      metadataUrl: publicArtifactUrl(env.OTA_PUBLIC_BASE_URL, metadataKey),
      created: false,
    };
  }

  const existingMetadata = await getTextObject(env.S3_BUCKET_PUBLISHED, metadataKey);
  if (existingMetadata) {
    await prisma.channelSnapshot.create({
      data: {
        deviceModelId: release.deviceModelId,
        channelKey,
        metadataBody: existingMetadata,
        objectKey: metadataKey,
      },
    });
  }

  const metadataBody = formatChannelMetadata({
    incrementalBuild: release.incrementalBuild,
    postTimestamp: release.postTimestamp,
    codename,
    channelKey,
  });

  await putTextObject({
    bucket: env.S3_BUCKET_PUBLISHED,
    objectKey: metadataKey,
    body: metadataBody,
  });

  await prisma.releaseChannelPublication.create({
    data: {
      releaseId: release.id,
      channelKey,
      metadataObjectKey: metadataKey,
      publishedById: publishedById ?? null,
    },
  });

  const result = {
    metadataKey,
    metadataUrl: publicArtifactUrl(env.OTA_PUBLIC_BASE_URL, metadataKey),
    created: true,
  };

  await publishSecurityPreviewOverlayIfNeeded({ release, baseChannelKey: channelKey, publishedById });

  return result;
}

async function publishSecurityPreviewOverlayIfNeeded(params: {
  release: ReleaseWithPackages;
  baseChannelKey: string;
  publishedById?: string | null;
}): Promise<void> {
  const overlayKey = securityPreviewOverlayKey(params.baseChannelKey);
  if (!overlayKey) return;

  await publishChannelMetadata({
    release: params.release,
    channelKey: overlayKey,
    publishedById: params.publishedById,
  });
}

/** Create missing `{base}-security-preview` metadata for all base channels on a release. */
export async function ensureSecurityPreviewOverlaysForRelease(
  release: ReleaseWithPackages,
  publishedById?: string | null,
): Promise<string[]> {
  const publications = await prisma.releaseChannelPublication.findMany({
    where: { releaseId: release.id },
    select: { channelKey: true },
  });

  const created: string[] = [];
  for (const { channelKey } of publications) {
    const overlayKey = securityPreviewOverlayKey(channelKey);
    if (!overlayKey) continue;

    const result = await publishChannelMetadata({
      release,
      channelKey: overlayKey,
      publishedById,
    });
    if (result.created) created.push(overlayKey);
  }

  return created;
}

export async function backfillAllSecurityPreviewOverlays(): Promise<number> {
  const releases = (await prisma.release.findMany({
    where: { status: ReleaseStatus.PUBLISHED },
    include: { deviceModel: true, packages: true },
  })) as ReleaseWithPackages[];

  let totalCreated = 0;
  for (const release of releases) {
    if (release.packages.length === 0 || !release.postTimestamp) continue;
    const created = await ensureSecurityPreviewOverlaysForRelease(release);
    totalCreated += created.length;
  }

  return totalCreated;
}
