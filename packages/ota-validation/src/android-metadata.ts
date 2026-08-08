export const ANDROID_OTA_METADATA_PATH = "META-INF/com/android/metadata";

export type AndroidOtaMetadata = Record<string, string>;

/** Parse `key=value` lines from Android OTA metadata file. */
export function parseAndroidOtaMetadata(raw: string): AndroidOtaMetadata {
  const result: AndroidOtaMetadata = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

/** Device codename from `pre-device` (e.g. google/panther/panther). */
export function metadataDeviceCodename(metadata: AndroidOtaMetadata): string | null {
  const preDevice = metadata["pre-device"];
  if (!preDevice) return null;
  const segments = preDevice.split("/");
  const last = segments[segments.length - 1];
  return last ?? null;
}

export function metadataTargetIncremental(metadata: AndroidOtaMetadata): string | null {
  const direct = metadata["post-build-incremental"];
  if (direct) return direct;
  const postBuild = metadata["post-build"];
  if (!postBuild) return null;
  const segments = postBuild.split("/");
  const buildSegment = segments[4];
  if (!buildSegment) return null;
  return buildSegment.split(":")[0] ?? null;
}

export function metadataSourceIncremental(metadata: AndroidOtaMetadata): string | null {
  return metadata["pre-build-incremental"] ?? null;
}
