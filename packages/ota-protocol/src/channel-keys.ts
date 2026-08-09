/** Base GrapheneOS / CUSTOM_OS release channels (without security-preview overlay). */
export const BASE_OTA_CHANNELS = ["testing", "alpha", "beta", "stable"] as const;

export type BaseOtaChannel = (typeof BASE_OTA_CHANNELS)[number];

/** Security preview overlay: `{base}-security-preview` for any base channel (Updater toggle). */
export const SECURITY_PREVIEW_OTA_CHANNELS = BASE_OTA_CHANNELS.map(
  (channel) => `${channel}-security-preview`,
) as [
  "testing-security-preview",
  "alpha-security-preview",
  "beta-security-preview",
  "stable-security-preview",
];

/** Standard channels including security-preview variants. */
export const STANDARD_OTA_CHANNELS = [
  ...BASE_OTA_CHANNELS,
  ...SECURITY_PREVIEW_OTA_CHANNELS,
] as const;

export type StandardOtaChannel = (typeof STANDARD_OTA_CHANNELS)[number];

const STANDARD_SET = new Set<string>(STANDARD_OTA_CHANNELS);

const BASE_CHANNEL_PATTERN = /^(testing|alpha|beta|stable)(-security-preview)?$/;

/** Validates channel keys served by nginx metadata locations (incl. grp-*). */
export function isValidOtaChannelKey(channelKey: string): boolean {
  if (STANDARD_SET.has(channelKey)) return true;
  if (BASE_CHANNEL_PATTERN.test(channelKey)) return true;
  return /^grp-[a-z0-9-]+$/.test(channelKey);
}

/** Recommended promotion order for UI hints (not enforced). */
export const RECOMMENDED_CHANNEL_ORDER = [...STANDARD_OTA_CHANNELS] as const;

/** Dedupe and sort channel keys by recommended rollout order; unknown keys trail. */
export function sortOtaChannelKeys(channelKeys: string[]): string[] {
  const unique = [...new Set(channelKeys)];
  const order = new Set<string>(RECOMMENDED_CHANNEL_ORDER);
  const ordered = RECOMMENDED_CHANNEL_ORDER.filter((key) => unique.includes(key));
  const rest = unique.filter((key) => !order.has(key));
  return [...ordered, ...rest];
}
