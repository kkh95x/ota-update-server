import { formatBytes } from "./format-bytes";

/** Format bytes per second as human-readable throughput. */
export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "—";
  if (bytesPerSecond < 1024) return `${Math.round(bytesPerSecond)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  if (bytesPerSecond < 1024 * 1024 * 1024) return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSecond / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
}

/** Network bitrate in megabits per second (decimal Mbps). */
export function formatMegabitsPerSecond(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "—";
  const mbps = (bytesPerSecond * 8) / 1_000_000;
  return `${mbps.toFixed(1)} Mbps`;
}

/** Remaining time label. */
export function formatEta(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 1) return "<1s";
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

/** Elapsed wall time since upload started. */
export function formatElapsed(seconds: number): string {
  return formatEta(seconds);
}

export type UploadThroughputSnapshot = {
  loaded: number;
  total: number;
  percent: number;
  speedBps: number;
  avgSpeedBps: number;
  etaSeconds: number | null;
  elapsedSeconds: number;
};

/** Track smoothed and average upload speed from byte counters. */
export class UploadSpeedTracker {
  private startedAt = Date.now();
  private lastTickAt = this.startedAt;
  private lastLoaded = 0;
  private emaSpeed = 0;

  tick(loaded: number, total: number): UploadThroughputSnapshot {
    const now = Date.now();
    const elapsedSeconds = (now - this.startedAt) / 1000;
    const deltaBytes = Math.max(0, loaded - this.lastLoaded);
    const deltaSeconds = Math.max(0.001, (now - this.lastTickAt) / 1000);
    const instantSpeed = deltaBytes / deltaSeconds;

    this.emaSpeed = this.emaSpeed === 0 ? instantSpeed : this.emaSpeed * 0.7 + instantSpeed * 0.3;
    this.lastLoaded = loaded;
    this.lastTickAt = now;

    const avgSpeedBps = elapsedSeconds > 0 ? loaded / elapsedSeconds : 0;
    const speedBps = this.emaSpeed;
    const remaining = Math.max(0, total - loaded);
    const etaSeconds = speedBps > 0 ? remaining / speedBps : null;
    const percent = total > 0 ? (loaded / total) * 100 : 0;

    return {
      loaded,
      total,
      percent,
      speedBps,
      avgSpeedBps,
      etaSeconds,
      elapsedSeconds,
    };
  }
}

export function formatProgressSummary(snapshot: UploadThroughputSnapshot): string {
  return [
    `${Math.round(snapshot.percent)}%`,
    `${formatBytes(snapshot.loaded)} / ${formatBytes(snapshot.total)}`,
    formatSpeed(snapshot.speedBps),
    formatMegabitsPerSecond(snapshot.speedBps),
    `ETA ${formatEta(snapshot.etaSeconds)}`,
  ].join(" · ");
}
