import {
  publishedFullOtaKey,
  publishedIncrementalKey,
} from "./index.js";

export type ParsedChannelMetadata = {
  targetIncremental: string;
  postTimestamp: string;
  codename: string;
  channelKey: string;
};

/** Parse `{device}-{channel}` metadata body (one line, GrapheneOS Updater). */
export function parseChannelMetadata(body: string): ParsedChannelMetadata {
  const line = body.trim().split(/\r?\n/)[0]?.trim();
  if (!line) throw new Error("empty_metadata");
  const parts = line.split(/\s+/);
  if (parts.length < 4) throw new Error("invalid_metadata_fields");
  const targetIncremental = parts[0];
  const postTimestamp = parts[1];
  const codename = parts[2];
  const channelKey = parts.slice(3).join(" ");
  if (!targetIncremental || !postTimestamp || !codename || !channelKey) {
    throw new Error("invalid_metadata_fields");
  }
  return { targetIncremental, postTimestamp, codename, channelKey };
}

/** True when server build date is newer than device `ro.build.date.utc`. */
export function shouldOfferUpdate(postTimestamp: string, deviceBuildDateUtc: string): boolean {
  const target = Number(postTimestamp);
  const current = Number(deviceBuildDateUtc);
  if (!Number.isFinite(target) || !Number.isFinite(current)) return false;
  return target > current;
}

export function buildIncrementalDownloadKey(
  codename: string,
  sourceIncremental: string,
  targetIncremental: string,
  streaming = false,
): string {
  const prefix = streaming ? `${codename}-streaming` : codename;
  return `${prefix}-incremental-${sourceIncremental}-${targetIncremental}.zip`;
}

export function buildFullOtaDownloadKey(
  codename: string,
  targetIncremental: string,
  streaming = false,
): string {
  if (streaming) {
    return `${codename}-streaming-ota_update-${targetIncremental}.zip`;
  }
  return publishedFullOtaKey(codename, targetIncremental);
}

/** Resolve download path: incremental first, full OTA fallback key. */
export function resolveDownloadKeys(params: {
  codename: string;
  deviceIncremental: string;
  metadata: ParsedChannelMetadata;
}): { incrementalKey: string; fullKey: string } {
  return {
    incrementalKey: publishedIncrementalKey(
      params.codename,
      params.deviceIncremental,
      params.metadata.targetIncremental,
    ),
    fullKey: publishedFullOtaKey(params.codename, params.metadata.targetIncremental),
  };
}
