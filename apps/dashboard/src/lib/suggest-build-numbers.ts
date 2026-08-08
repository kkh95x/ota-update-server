/** GrapheneOS-style BUILD_NUMBER (YYYYMMDD + 2-digit daily suffix). */

function formatYyyyMmDd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function parseIncremental(value: string): { datePart: string; suffix: number } | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const datePart = digits.slice(0, 8);
  const suffix = digits.length >= 10 ? Number.parseInt(digits.slice(8, 10), 10) : 0;
  if (!/^\d{8}$/.test(datePart) || Number.isNaN(suffix)) return null;
  return { datePart, suffix: Math.min(Math.max(suffix, 0), 99) };
}

/**
 * Propose next BUILD_NUMBER after an existing published incremental.
 * Same UTC day → increment suffix; new day → YYYYMMDD00.
 */
export function suggestBuildNumber(oldIncremental: string): string | null {
  const parsed = parseIncremental(oldIncremental.trim());
  if (!parsed) return null;

  const today = formatYyyyMmDd(new Date());
  const { datePart, suffix } = parsed;

  if (today > datePart) {
    return `${today}00`;
  }
  if (today === datePart) {
    return `${datePart}${String(Math.min(suffix + 1, 99)).padStart(2, "0")}`;
  }
  return `${datePart}${String(Math.min(suffix + 1, 99)).padStart(2, "0")}`;
}

/** UTC epoch seconds; must exceed old timestamp for Updater to offer the update. */
export function suggestBuildDatetime(oldTimestamp?: string): string {
  const now = Math.floor(Date.now() / 1000);
  const old = oldTimestamp?.trim() ? Number.parseInt(oldTimestamp.trim(), 10) : NaN;
  if (!Number.isNaN(old) && old >= now) {
    return String(old + 3600);
  }
  return String(now);
}

export function isValidIncremental(value: string): boolean {
  return parseIncremental(value) !== null;
}

export function isValidEpochSeconds(value: string): boolean {
  const n = Number.parseInt(value.trim(), 10);
  return !Number.isNaN(n) && n > 1_000_000_000;
}
