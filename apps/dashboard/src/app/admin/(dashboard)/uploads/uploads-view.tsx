"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Dialog, { DialogActions } from "@/components/dialog";
import AdminPageHeader from "@/components/admin-page-header";
import FormField from "@/components/form-field";
import { FORM_HELP } from "@/lib/form-field-help";
import StatusBadge from "@/components/status-badge";
import UploadProgress from "@/components/upload-progress";
import { formatBytes, isSuspiciouslySmallPackage } from "@/lib/format-bytes";
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

type ProgressState = {
  label: string;
  percent: number;
  loaded?: number;
  total?: number;
  active: boolean;
};

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
  const [error, setError] = useState<string | null>(null);
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
      .catch(() => setError("تعذر تحميل الإصدارات"))
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
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (uploading) return;
    setDialogOpen(false);
    setError(null);
    setProgress(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !releaseId) return;

    setError(null);
    setUploading(true);
    setProgress({ label: "جاري إنشاء جلسة الرفع…", percent: 0, active: true });

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
        setError("فشل إنشاء جلسة الرفع");
        setProgress(null);
        return;
      }

      const { session } = (await sessionRes.json()) as {
        session: { id: string; uploadUrl: string };
      };

      setProgress({
        label: "جاري رفع الملف إلى MinIO…",
        percent: 0,
        loaded: 0,
        total: file.size,
        active: true,
      });

      await putFileWithProgress(session.uploadUrl, file, "application/zip", (loaded, total) => {
        const percent = total > 0 ? (loaded / total) * 100 : 0;
        setProgress({
          label: "جاري رفع الملف إلى MinIO…",
          percent,
          loaded,
          total,
          active: true,
        });
      });

      setProgress({
        label: "جاري إتمام الرفع وبدء التحقق…",
        percent: 100,
        loaded: file.size,
        total: file.size,
        active: true,
      });

      const completeRes = await fetch(`/api/admin/uploads/sessions/${session.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseId,
          packageType,
          sourceIncremental: packageType === "INCREMENTAL" ? sourceIncremental : undefined,
          filename: file.name,
        }),
      });

      if (!completeRes.ok) {
        setError("فشل إتمام الرفع");
        setProgress(null);
        return;
      }

      setDialogOpen(false);
      setToast("تم الرفع بنجاح — جاري التحقق في Worker");
      setFile(null);
      await loadReleases();
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("upload_")) {
        setError("فشل رفع الملف — تحقق من CORS على MinIO");
      } else {
        setError("تعذر الاتصال بالخادم");
      }
      setProgress(null);
    } finally {
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
        description="يُرفع الملف مباشرة إلى MinIO (حجر صحي)"
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

          {error && <p className="error">{error}</p>}
          {progress && (
            <UploadProgress
              label={progress.label}
              percent={progress.percent}
              loaded={progress.loaded}
              total={progress.total}
              active={progress.active}
              indeterminate={progress.total == null && progress.percent === 0}
            />
          )}
        </form>
      </Dialog>
    </div>
  );
}
