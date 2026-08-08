import { formatBytes } from "@/lib/format-bytes";

type Props = {
  label: string;
  percent: number;
  loaded?: number;
  total?: number;
  active?: boolean;
  indeterminate?: boolean;
};

export default function UploadProgress({
  label,
  percent,
  loaded,
  total,
  active,
  indeterminate,
}: Props) {
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
        <p className="upload-progress-meta mono">
          {clamped}%
          {loaded != null && total != null && total > 0 && (
            <>
              {" · "}
              {formatBytes(loaded)} / {formatBytes(total)}
            </>
          )}
        </p>
      )}
    </div>
  );
}
