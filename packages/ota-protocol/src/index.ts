/** GrapheneOS-compatible channel metadata line (trailing newline). */
export function formatChannelMetadata(params: {
  incrementalBuild: string;
  postTimestamp: string;
  codename: string;
  channelKey: string;
}): string {
  const { incrementalBuild, postTimestamp, codename, channelKey } = params;
  return `${incrementalBuild} ${postTimestamp} ${codename} ${channelKey}\n`;
}

/** Published full OTA zip key at bucket root, e.g. panther-ota_update-2026080100.zip */
export function publishedFullOtaKey(codename: string, targetIncremental: string): string {
  return `${codename}-ota_update-${targetIncremental}.zip`;
}

/** Published incremental zip key at bucket root. */
export function publishedIncrementalKey(
  codename: string,
  sourceIncremental: string,
  targetIncremental: string,
): string {
  return `${codename}-incremental-${sourceIncremental}-${targetIncremental}.zip`;
}

/** Channel metadata pointer file, e.g. panther-stable */
export function publishedMetadataKey(codename: string, channelKey: string): string {
  return `${codename}-${channelKey}`;
}

export function publicArtifactUrl(baseUrl: string, objectKey: string): string {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalized}${objectKey}`;
}

export function resolvePublishedPackageKey(
  codename: string,
  packageType: "FULL" | "INCREMENTAL",
  targetIncremental: string,
  sourceIncremental?: string | null,
): string {
  if (packageType === "FULL") {
    return publishedFullOtaKey(codename, targetIncremental);
  }
  if (!sourceIncremental) {
    throw new Error("source_incremental_required");
  }
  return publishedIncrementalKey(codename, sourceIncremental, targetIncremental);
}

export {
  buildFullOtaDownloadKey,
  buildIncrementalDownloadKey,
  parseChannelMetadata,
  resolveDownloadKeys,
  shouldOfferUpdate,
  type ParsedChannelMetadata,
} from "./updater-client.js";
export {
  BASE_OTA_CHANNELS,
  expandWithSecurityPreviewOverlays,
  isValidOtaChannelKey,
  PROMOTABLE_OTA_CHANNELS,
  RECOMMENDED_CHANNEL_ORDER,
  securityPreviewOverlayKey,
  sortOtaChannelKeys,
  STANDARD_OTA_CHANNELS,
  type BaseOtaChannel,
  type StandardOtaChannel,
} from "./channel-keys.js";
