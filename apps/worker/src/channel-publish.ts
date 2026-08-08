import { loadEnv } from "@custom-os-ota/configuration";
import { prisma } from "@custom-os-ota/database";
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

  return {
    metadataKey,
    metadataUrl: publicArtifactUrl(env.OTA_PUBLIC_BASE_URL, metadataKey),
    created: true,
  };
}
