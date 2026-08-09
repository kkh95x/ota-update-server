"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Dialog, { DialogActions } from "@/components/dialog";
import AdminPageHeader from "@/components/admin-page-header";
import FormField from "@/components/form-field";
import { FORM_HELP } from "@/lib/form-field-help";
import StatusBadge from "@/components/status-badge";
import UploadProgress, { type UploadProgressDetails } from "@/components/upload-progress";
import UploadErrorPanel from "@/components/upload-error-panel";
import { formatBytes, isSuspiciouslySmallPackage } from "@/lib/format-bytes";
import {
  readUploadApiError,
  uploadErrorFromTransport,
  type UploadErrorDetails,
} from "@/lib/upload-api-error";
import { uploadMultipartParallel } from "@/lib/upload-multipart";
import { startUploadSessionKeepalive } from "@/lib/session-keepalive";
import { putFileWithProgress } from "@/lib/upload-to-presigned-url";

type ReleaseOption = {
  id: string;
  versionLabel: string;
  codename: string;
  incrementalBuild: string;
  status: string;
  validationFailureReason?: string | null;
  channelKey?: string;
};

type ProgressState = UploadProgressDetails;

type MultipartSession = {
  id: string;
  uploadMode: "multipart";
  partSize: number;
  partCount: number;
  parallelParts: number;
  parts: Array<{ partNumber: number; uploadUrl: string }>;
};

type SingleSession = {
  id: string;
  uploadMode: "single";
  uploadUrl: string;
};

type UploadSessionResponse = MultipartSession | SingleSession;

const FORM_ID = "upload-package-form";

export default function UploadsView() {
  const [releases, setReleases] = useState<ReleaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [releaseId, setReleaseId] = useState("");
  const [packageType, setPackageType] = useState<"FULL" | "INCREMENTAL">("FULL");
  const [sourceIncremental, setSourceIncremental] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [uploadError, setUploadError] = useState<UploadErrorDetails | null>(null);
  const [pageError, setPageError] = useState<UploadErrorDetails | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function loadReleases() {
    const res = await fetch("/api/admin/releases");
    if (!res.ok) throw new Error("fail");
    const data = (await res.json()) as { releases: ReleaseOption[] };
    const open = data.releases.filter((r) => !["PUBLISHED", "REVOKED"].includes(r.status));
    setReleases(open);
    return open;
  }

  useEffect(() => {
    loadReleases()
      .catch(() =>
        setPageError({
          summary: "تعذر تحميل الإصدارات",
          code: "releases_load_failed",
          httpStatus: 0,
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  const selectedRelease = useMemo(
    () => releases.find((r) => r.id === releaseId),
    [releases, releaseId],
  );

  function openDialog() {
    setReleaseId(releases[0]?.id ?? "");
    setPackageType("FULL");
    setSourceIncremental("");
    setFile(null);
    setProgress(null);
    setUploadError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (uploading) return;
    setDialogOpen(false);
    setUploadError(null);
    setProgress(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !releaseId) return;

    setUploadError(null);
    setUploading(true);
    setProgress({ label: "جاري إنشاء جلسة الرفع…", percent: 0, active: true, indeterminate: true });

    let authKeepalive: ReturnType<typeof startUploadSessionKeepalive> | undefined;

    try {
      const sessionRes = await fetch("/api/admin/uploads/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          expectedSize: file.size,
          releaseId,
          packageType,
          sourceIncremental: packageType === "INCREMENTAL" ? sourceIncremental : undefined,
        }),
      });

      if (!sessionRes.ok) {
        setUploadError(await readUploadApiError(sessionRes, "session"));
        setProgress(null);
        return;
      }

      const { session } = (await sessionRes.json()) as { session: UploadSessionResponse };

      authKeepalive = startUploadSessionKeepalive();

      let completedParts: Array<{ partNumber: number; etag: string }> | undefined;

      if (session.uploadMode === "multipart") {
        setProgress({
          label: `جاري رفع الملف إلى MinIO (${session.partCount} جزء · ${session.parallelParts}× متوازي)…`,
          percent: 0,
          loaded: 0,
          total: file.size,
          active: true,
          uploadMode: "multipart",
          partSize: session.partSize,
          parallelParts: session.parallelParts,
          totalParts: session.partCount,
          completedParts: 0,
          activeParts: 0,
        });

        completedParts = await uploadMultipartParallel(
          file,
          session.parts,
          session.partSize,
          session.parallelParts,
          (p) => {
            setProgress({
              label: `جاري رفع الملف إلى MinIO (${p.completedParts}/${p.totalParts} جزء · ${p.activeParts} نشط)…`,
              percent: p.percent,
              loaded: p.loaded,
              total: p.total,
              active: true,
              speedBps: p.speedBps,
              avgSpeedBps: p.avgSpeedBps,
              etaSeconds: p.etaSeconds,
              elapsedSeconds: p.elapsedSeconds,
              uploadMode: "multipart",
              partSize: session.partSize,
              parallelParts: session.parallelParts,
              totalParts: p.totalParts,
              completedParts: p.completedParts,
              activeParts: p.activeParts,
            });
          },
        );
      } else {
        setProgress({
          label: "جاري رفع الملف إلى MinIO…",
          percent: 0,
          loaded: 0,
          total: file.size,
          active: true,
          uploadMode: "single",
        });

        await putFileWithProgress(session.uploadUrl, file, "application/zip", (snapshot) => {
          setProgress({
            label: "جاري رفع الملف إلى MinIO…",
            percent: snapshot.percent,
            loaded: snapshot.loaded,
            total: snapshot.total,
            active: true,
            speedBps: snapshot.speedBps,
            avgSpeedBps: snapshot.avgSpeedBps,
            etaSeconds: snapshot.etaSeconds,
            elapsedSeconds: snapshot.elapsedSeconds,
            uploadMode: "single",
          });
        });
      }

      await authKeepalive.ping();

      setProgress({
        label: "جاري إتمام الرفع وبدء التحقق…",
        percent: 100,
        loaded: file.size,
        total: file.size,
        active: true,
        indeterminate: true,
      });

      const completeRes = await fetch(`/api/admin/uploads/sessions/${session.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseId,
          packageType,
          sourceIncremental: packageType === "INCREMENTAL" ? sourceIncremental : undefined,
          filename: file.name,
          parts: completedParts,
        }),
      });

      if (!completeRes.ok) {
        setUploadError(await readUploadApiError(completeRes, "complete"));
        setProgress(null);
        return;
      }

      const completeBody = (await completeRes.json()) as { validationQueued?: boolean };
      setDialogOpen(false);
      setToast(
        completeBody.validationQueued === false
          ? "تم الرفع — التحقق في قائمة الانتظار (أعد تشغيل worker إن لزم)"
          : "تم الرفع بنجاح — جاري التحقق في Worker",
      );
      setFile(null);
      await loadReleases();
    } catch (err) {
      setUploadError(err instanceof Error ? uploadErrorFromTransport(err) : {
        summary: "تعذر الاتصال بالخادم",
        code: "unknown_error",
        httpStatus: 0,
      });
      setProgress(null);
    } finally {
      authKeepalive?.stop();
      setUploading(false);
    }
  }

  return (
    <div className="admin-page admin-page-wide">
      <AdminPageHeader
        module="uploads"
        title="رفع الحزم"
        description="حزم OTA المرفوعة إلى منطقة الحجر"
        actions={
          releases.length > 0 ? (
            <button type="button" className="btn" onClick={openDialog}>
              + رفع حزمة
            </button>
          ) : undefined
        }
      />

      {toast && (
        <div className="toast-success">
          {toast}
          <button type="button" className="toast-dismiss" onClick={() => setToast(null)} aria-label="إغلاق">
            ×
          </button>
        </div>
      )}

      {pageError && <UploadErrorPanel error={pageError} />}

      <div className="admin-panel">
        <div className="panel-heading">
          <h2>إصدارات مفتوحة للرفع</h2>
          <span className="panel-badge">{releases.length}</span>
        </div>

        {loading ? (
          <p className="muted">جاري التحميل…</p>
        ) : releases.length === 0 ? (
          <div className="empty-state">
            <p>لا توجد إصدارات مفتوحة للرفع.</p>
            <Link className="btn btn-secondary" href="/admin/releases">
              إنشاء إصدار
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>الجهاز</th>
                  <th>الإصدار</th>
                  <th>Incremental</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code>{r.codename}</code>
                    </td>
                    <td>{r.versionLabel}</td>
                    <td>{r.incrementalBuild}</td>
                    <td>
                      <StatusBadge status={r.status} />
                      {r.status === "QUARANTINED" && r.validationFailureReason && (
                        <p className="validation-failure-reason">{r.validationFailureReason}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title="رفع حزمة OTA"
        description="يُرفع الملف مباشرة إلى MinIO (multipart متوازي للملفات الكبيرة)"
        size="lg"
        footer={
          <DialogActions
            onCancel={closeDialog}
            submitLabel="رفع إلى الحجر"
            loading={uploading}
            disabled={!file || !releaseId}
            submitForm={FORM_ID}
          />
        }
      >
        <form id={FORM_ID} onSubmit={onSubmit} className="form-stack">
          <FormField label="الإصدار" htmlFor="releaseId" tooltip={FORM_HELP.upload.release}>
            <select
              id="releaseId"
              className="select-field"
              value={releaseId}
              onChange={(e) => setReleaseId(e.target.value)}
              required
            >
              {releases.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.versionLabel} — {r.codename} · {r.incrementalBuild}
                </option>
              ))}
            </select>
          </FormField>

          {selectedRelease && (
            <div className="device-preview compact">
              <div className="device-preview-icon sm">{selectedRelease.codename.slice(0, 2).toUpperCase()}</div>
              <div>
                <strong>{selectedRelease.versionLabel}</strong>
                <p className="muted">
                  <code>{selectedRelease.codename}</code> · {selectedRelease.incrementalBuild}
                </p>
              </div>
            </div>
          )}

          <FormField label="نوع الحزمة" tooltip={FORM_HELP.upload.packageType}>
            <div className="channel-picker" role="group" aria-label="نوع الحزمة">
              <button
                type="button"
                className={`channel-pill${packageType === "FULL" ? " active" : ""}`}
                onClick={() => setPackageType("FULL")}
              >
                <span>FULL</span>
                <small>تحديث كامل</small>
              </button>
              <button
                type="button"
                className={`channel-pill${packageType === "INCREMENTAL" ? " active" : ""}`}
                onClick={() => setPackageType("INCREMENTAL")}
              >
                <span>INCREMENTAL</span>
                <small>من build سابق</small>
              </button>
            </div>
          </FormField>

          {packageType === "INCREMENTAL" && (
            <FormField label="Incremental المصدر" htmlFor="sourceIncremental" tooltip={FORM_HELP.upload.sourceIncremental}>
              <input
                id="sourceIncremental"
                value={sourceIncremental}
                onChange={(e) => setSourceIncremental(e.target.value)}
                placeholder="2026072900"
                inputMode="numeric"
                required
              />
            </FormField>
          )}

          <FormField label="ملف OTA" htmlFor="file" tooltip={FORM_HELP.upload.file}>
            <label className="file-drop">
              <input
                id="file"
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
              <span className="file-drop-label">
                {file ? (
                  <>
                    <strong>{file.name}</strong>
                    <small>{formatBytes(file.size)}</small>
                  </>
                ) : (
                  <>
                    <strong>اختر ملف zip</strong>
                    <small>أو اسحبه هنا</small>
                  </>
                )}
              </span>
            </label>
            {file && isSuspiciouslySmallPackage(file.size) && (
              <p className="upload-file-warn mono">
                <span className="prompt">{">"}</span> حزمة صغيرة ({formatBytes(file.size)}) — للاختبار فقط
              </p>
            )}
          </FormField>

          {uploadError && <UploadErrorPanel error={uploadError} />}
          {progress && (
            <UploadProgress
              label={progress.label}
              percent={progress.percent}
              loaded={progress.loaded}
              total={progress.total}
              active={progress.active}
              indeterminate={progress.indeterminate}
              speedBps={progress.speedBps}
              avgSpeedBps={progress.avgSpeedBps}
              etaSeconds={progress.etaSeconds}
              elapsedSeconds={progress.elapsedSeconds}
              uploadMode={progress.uploadMode}
              parallelParts={progress.parallelParts}
              partSize={progress.partSize}
              totalParts={progress.totalParts}
              completedParts={progress.completedParts}
              activeParts={progress.activeParts}
            />
          )}
        </form>
      </Dialog>
    </div>
  );
}
