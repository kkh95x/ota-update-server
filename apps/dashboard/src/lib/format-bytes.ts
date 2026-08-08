/** Human-readable size for OTA packages (B / KB / MB / GB). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** OTA full images are hundreds of MB+; flag obvious test/empty uploads. */
export function isSuspiciouslySmallPackage(bytes: number): boolean {
  return bytes > 0 && bytes < 1024 * 1024;
}
