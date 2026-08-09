import type { UploadErrorDetails } from "@/lib/upload-api-error";

type Props = {
  error: UploadErrorDetails | null;
};

export default function UploadErrorPanel({ error }: Props) {
  if (!error) return null;

  const extraEntries = error.extra
    ? Object.entries(error.extra).filter(([, value]) => value != null && value !== "")
    : [];

  return (
    <div className="upload-error-panel error-terminal" role="alert" aria-live="assertive">
      <p className="upload-error-summary">{error.summary}</p>
      <dl className="upload-error-details mono">
        <div>
          <dt>error</dt>
          <dd>{error.code}</dd>
        </div>
        {error.httpStatus > 0 && (
          <div>
            <dt>HTTP</dt>
            <dd>{error.httpStatus}</dd>
          </div>
        )}
        {error.message && (
          <div>
            <dt>message</dt>
            <dd>{error.message}</dd>
          </div>
        )}
        {error.hint && (
          <div>
            <dt>hint</dt>
            <dd>{error.hint}</dd>
          </div>
        )}
        {extraEntries.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
