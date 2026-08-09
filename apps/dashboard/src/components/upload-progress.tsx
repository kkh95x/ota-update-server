import { formatBytes } from "@/lib/format-bytes";
import { formatElapsed, formatEta, formatMegabitsPerSecond, formatSpeed } from "@/lib/format-speed";

export type UploadProgressDetails = {
  label: string;
  percent: number;
  loaded?: number;
  total?: number;
  active?: boolean;
  indeterminate?: boolean;
  speedBps?: number;
  avgSpeedBps?: number;
  etaSeconds?: number | null;
  elapsedSeconds?: number;
  completedParts?: number;
  totalParts?: number;
  activeParts?: number;
  uploadMode?: "multipart" | "single";
  parallelParts?: number;
  partSize?: number;
};

export default function UploadProgress({
  label,
  percent,
  loaded,
  total,
  active,
  indeterminate,
  speedBps,
  avgSpeedBps,
  etaSeconds,
  elapsedSeconds,
  completedParts,
  totalParts,
  activeParts,
  uploadMode,
  parallelParts,
  partSize,
}: UploadProgressDetails) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));

  return (
    <div className={`upload-progress${active ? " upload-progress-active" : ""}`} role="status" aria-live="polite">
      <p className="upload-progress-label mono">
        <span className="prompt">{">"}</span> {label}
      </p>
      <div
        className={`upload-progress-track${indeterminate ? " upload-progress-indeterminate" : ""}`}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`upload-progress-fill${indeterminate ? " upload-progress-fill-indeterminate" : ""}`}
          style={indeterminate ? undefined : { width: `${clamped}%` }}
        />
      </div>
      {!indeterminate && (
        <>
          <p className="upload-progress-meta mono">
            {clamped}%
            {loaded != null && total != null && total > 0 && (
              <>
                {" · "}
                {formatBytes(loaded)} / {formatBytes(total)}
              </>
            )}
          </p>
          {(speedBps != null || avgSpeedBps != null) && (
            <dl className="upload-progress-stats mono">
              <div>
                <dt>السرعة</dt>
                <dd>{speedBps != null ? formatSpeed(speedBps) : "—"}</dd>
              </div>
              <div>
                <dt>Bitrate</dt>
                <dd>{speedBps != null ? formatMegabitsPerSecond(speedBps) : "—"}</dd>
              </div>
              <div>
                <dt>متوسط</dt>
                <dd>{avgSpeedBps != null ? formatSpeed(avgSpeedBps) : "—"}</dd>
              </div>
              <div>
                <dt>متبقٍ</dt>
                <dd>{formatEta(etaSeconds ?? null)}</dd>
              </div>
              <div>
                <dt>المنقضي</dt>
                <dd>{elapsedSeconds != null ? formatElapsed(elapsedSeconds) : "—"}</dd>
              </div>
              {uploadMode === "multipart" && totalParts != null && totalParts > 0 && (
                <div>
                  <dt>الأجزاء</dt>
                  <dd>
                    {completedParts ?? 0}/{totalParts}
                    {activeParts != null && activeParts > 0 ? ` · ${activeParts} نشط` : ""}
                  </dd>
                </div>
              )}
              {uploadMode === "multipart" && parallelParts != null && (
                <div>
                  <dt>توازي</dt>
                  <dd>{parallelParts}×</dd>
                </div>
              )}
              {uploadMode === "multipart" && partSize != null && (
                <div>
                  <dt>حجم الجزء</dt>
                  <dd>{formatBytes(partSize)}</dd>
                </div>
              )}
            </dl>
          )}
        </>
      )}
    </div>
  );
}
