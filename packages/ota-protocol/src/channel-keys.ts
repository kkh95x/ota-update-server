/** Standard GrapheneOS / CUSTOM_OS release channels. */
export const STANDARD_OTA_CHANNELS = [
  "testing",
  "alpha",
  "beta",
  "stable",
  "stable-security-preview",
] as const;

export type StandardOtaChannel = (typeof STANDARD_OTA_CHANNELS)[number];

const STANDARD_SET = new Set<string>(STANDARD_OTA_CHANNELS);

/** Validates channel keys served by nginx metadata locations (incl. grp-*). */
export function isValidOtaChannelKey(channelKey: string): boolean {
  if (STANDARD_SET.has(channelKey)) return true;
  return /^grp-[a-z0-9-]+$/.test(channelKey);
}

/** Recommended promotion order for UI hints (not enforced). */
export const RECOMMENDED_CHANNEL_ORDER = [
  "testing",
  "alpha",
  "beta",
  "stable",
  "stable-security-preview",
] as const;

/** Dedupe and sort channel keys by recommended rollout order; unknown keys trail. */
export function sortOtaChannelKeys(channelKeys: string[]): string[] {
  const unique = [...new Set(channelKeys)];
  const order = new Set<string>(RECOMMENDED_CHANNEL_ORDER);
  const ordered = RECOMMENDED_CHANNEL_ORDER.filter((key) => unique.includes(key));
  const rest = unique.filter((key) => !order.has(key));
  return [...ordered, ...rest];
}
