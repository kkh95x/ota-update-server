"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Dialog, { DialogActions } from "@/components/dialog";
import AdminPageHeader from "@/components/admin-page-header";
import FormField from "@/components/form-field";
import { FORM_HELP } from "@/lib/form-field-help";
import StatusBadge from "@/components/status-badge";
import { formatBytes, isSuspiciouslySmallPackage } from "@/lib/format-bytes";
import { releaseStatusHint } from "@/lib/release-status-hints";
import { RELEASE_APPROVALS_REQUIRED } from "@/lib/release-approval";
import { PROMOTABLE_OTA_CHANNELS } from "@custom-os-ota/ota-protocol";

type ChannelPublication = {
  id: string;
  channelKey: string;
  metadataObjectKey: string;
  metadataUrl: string;
  publishedAt: string;
  publishedBy: { id: string; email: string; displayName: string | null } | null;
};

type ReleaseDetail = {
  id: string;
  versionLabel: string;
  buildId: string;
  incrementalBuild: string;
  postTimestamp: string | null;
  channelKey: string;
  status: string;
  validationFailureReason?: string | null;
  changelog: string | null;
  codename: string;
  publicMetadataUrl?: string;
  publishedAt?: string | null;
  channelPublications?: ChannelPublication[];
  packages: {
    id: string;
    packageType: string;
    originalFilename: string;
    byteSize: string;
    validationErrors?: string | null;
  }[];
  approvals: { approverEmail: string; approverName: string | null; note: string | null; createdAt: string }[];
};

const PROMOTABLE_CHANNELS = PROMOTABLE_OTA_CHANNELS;

const FORM_ID = "approve-release-form";

export default function ReleaseDetailView() {
  const params = useParams<{ id: string }>();
  const [release, setRelease] = useState<ReleaseDetail | null>(null);
  const [note, setNote] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [promoteTargets, setPromoteTargets] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/releases/${params.id}`);
    if (!res.ok) throw new Error("not found");
    const data = (await res.json()) as { release: ReleaseDetail };
    setRelease(data.release);
  }

  useEffect(() => {
    load().catch(() => setLoadError("الإصدار غير موجود"));
  }, [params.id]);

  useEffect(() => {
    if (!release || release.status !== "VALIDATING") return;
    const timer = setInterval(() => {
      load().catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [release?.status, params.id]);

  useEffect(() => {
    if (!publishing || !release || release.status === "PUBLISHED") return;
    const timer = setInterval(() => {
      load().catch(() => undefined);
    }, 2000);
    return () => clearInterval(timer);
  }, [publishing, release?.status, params.id]);

  useEffect(() => {
    if (!promoting || !release) return;
    const timer = setInterval(() => {
      load().catch(() => undefined);
    }, 2000);
    return () => clearInterval(timer);
  }, [promoting, release?.channelPublications?.length, params.id]);

  useEffect(() => {
    if (publishing && release?.status === "PUBLISHED") {
      setPublishing(false);
      setToast("تم النشر — الإصدار متاح على الخادم");
    }
  }, [publishing, release?.status]);

  function openDialog() {
    setNote("");
    setFormError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (approving) return;
    setDialogOpen(false);
    setFormError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApproving(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/admin/releases/${params.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || undefined }),
      });
      const body = (await res.json()) as { error?: string; status?: string; approvalCount?: number };
      if (!res.ok) {
        if (body.error === "already_approved") setFormError("لقد وافقت مسبقاً على هذا الإصدار");
        else if (body.error === "release_not_ready") setFormError("الإصدار غير جاهز للموافقة بعد");
        else setFormError("فشلت الموافقة");
        return;
      }
      setDialogOpen(false);
      setToast(`تمت الموافقة (${body.approvalCount}/${RELEASE_APPROVALS_REQUIRED})`);
      setNote("");
      await load();
    } catch {
      setFormError("تعذر الاتصال بالخادم");
    } finally {
      setApproving(false);
    }
  }

  async function onPromote() {
    if (promoteTargets.length === 0) {
      setPromoteError("اختر قناة واحدة على الأقل");
      return;
    }
    setPromoting(true);
    setPromoteError(null);
    try {
      const res = await fetch(`/api/admin/releases/${params.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelKeys: promoteTargets }),
      });
      const body = (await res.json()) as { error?: string; channels?: string[] };
      if (!res.ok) {
        if (body.error === "channel_already_published") {
          setPromoteError(`قناة منشورة مسبقاً: ${body.channels?.join(", ") ?? ""}`);
        } else if (body.error === "ota_paused_globally") {
          setPromoteError("التحديثات متوقفة globally");
        } else if (body.error === "release_not_published") {
          setPromoteError("يجب نشر الإصدار على القناة الأولى أولاً");
        } else {
          setPromoteError("فشل طلب الترقية");
        }
        setPromoting(false);
        return;
      }
      setToast(`جاري الترقية إلى: ${promoteTargets.join(", ")}…`);
      setPromoteTargets([]);
      await load();
      setTimeout(() => setPromoting(false), 3000);
    } catch {
      setPromoteError("تعذر الاتصال بالخادم");
      setPromoting(false);
    }
  }

  function togglePromoteTarget(channel: string) {
    setPromoteTargets((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    );
  }

  async function onPublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/admin/releases/${params.id}/publish`, { method: "POST" });
      const body = (await res.json()) as { error?: string; alreadyPublished?: boolean };
      if (!res.ok) {
        if (body.error === "post_timestamp_required") {
          setPublishError("post-timestamp مفقود — أنشئ إصداراً جديداً يتضمن هذا الحقل");
        } else if (body.error === "ota_paused_globally") {
          setPublishError("التحديثات متوقفة globally — راجع الإعدادات");
        } else if (body.error === "release_not_ready") {
          setPublishError("الإصدار غير جاهز للنشر");
        } else {
          setPublishError("فشل طلب النشر");
        }
        setPublishing(false);
        return;
      }
      if (body.alreadyPublished) {
        setPublishing(false);
        setToast("الإصدار منشور مسبقاً");
        await load();
        return;
      }
      setToast("جاري النشر في Worker…");
      await load();
    } catch {
      setPublishError("تعذر الاتصال بالخادم");
      setPublishing(false);
    }
  }

  if (loadError && !release) {
    return (
      <div className="admin-page">
        <p className="error">{loadError}</p>
        <Link href="/admin/releases">← العودة</Link>
      </div>
    );
  }

  if (!release) {
    return (
      <div className="admin-page">
        <p className="muted">جاري التحميل…</p>
      </div>
    );
  }

  const canApprove =
    release.packages.length > 0 &&
    ["VALIDATED", "PENDING_APPROVAL", "APPROVED"].includes(release.status) &&
    release.status !== "APPROVED";

  const canPublish =
    release.status === "APPROVED" && release.packages.length > 0 && Boolean(release.postTimestamp);

  const hasTinyPackage = release.packages.some((p) => isSuspiciouslySmallPackage(Number(p.byteSize)));

  const publishedChannelKeys = new Set(
    (release.channelPublications ?? []).map((p) => p.channelKey),
  );
  publishedChannelKeys.add(release.channelKey);

  const availablePromoteChannels = PROMOTABLE_CHANNELS.filter((ch) => !publishedChannelKeys.has(ch));

  const canPromote = release.status === "PUBLISHED" && availablePromoteChannels.length > 0;

  return (
    <div className="admin-page admin-page-wide">
      <AdminPageHeader
        module="releases"
        title={
          <>
            {release.versionLabel} — <code>{release.codename}</code>
          </>
        }
        description={
          <>
            <Link href="/admin/releases" className="muted">
              ← الإصدارات
            </Link>
            {" · "}
            {release.channelKey} · {release.incrementalBuild} ·{" "}
            <StatusBadge status={release.status} />
          </>
        }
        actions={
          canApprove ? (
            <button type="button" className="btn" onClick={openDialog}>
              موافقة
            </button>
          ) : canPublish || publishing ? (
            <button type="button" className="btn btn-glow" onClick={onPublish} disabled={publishing}>
              {publishing ? (
                <>
                  <span className="spinner" aria-hidden /> جاري النشر…
                </>
              ) : (
                "نشر"
              )}
            </button>
          ) : undefined
        }
      />

      {publishError && <p className="error">{publishError}</p>}

      {release.status === "PUBLISHED" && (
        <div className="admin-panel publish-info">
          <h2>القنوات المنشورة</h2>
          <ul className="admin-list">
            {(release.channelPublications ?? []).length === 0 ? (
              <li>
                <code>{release.channelKey}</code>
                {release.publicMetadataUrl && (
                  <>
                    {" — "}
                    <a href={release.publicMetadataUrl} target="_blank" rel="noreferrer">
                      metadata
                    </a>
                  </>
                )}
                {release.publishedAt && (
                  <span className="muted"> ({new Date(release.publishedAt).toLocaleString("ar")})</span>
                )}
              </li>
            ) : (
              (release.channelPublications ?? []).map((pub) => (
                <li key={pub.id}>
                  <code>{pub.channelKey}</code>
                  {" — "}
                  <a href={pub.metadataUrl} target="_blank" rel="noreferrer" className="mono">
                    {pub.metadataObjectKey}
                  </a>
                  <span className="muted"> · {new Date(pub.publishedAt).toLocaleString("ar")}</span>
                  {pub.publishedBy && (
                    <span className="muted"> · {pub.publishedBy.displayName ?? pub.publishedBy.email}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {canPromote && (
        <div className="admin-panel" style={{ marginTop: "1rem" }}>
          <h2>ترقية إلى قنوات أخرى</h2>
          <p className="muted">
            نفس ملف ZIP — يُحدَّث metadata فقط. المسار الموصى به: testing → alpha → beta → stable
          </p>
          <div className="channel-pill-row" style={{ marginTop: "0.75rem" }}>
            {availablePromoteChannels.map((ch) => (
              <button
                key={ch}
                type="button"
                className={`channel-pill${promoteTargets.includes(ch) ? " active" : ""}`}
                onClick={() => togglePromoteTarget(ch)}
                disabled={promoting}
              >
                {ch}
              </button>
            ))}
          </div>
          {promoteError && <p className="error">{promoteError}</p>}
          <button
            type="button"
            className="btn"
            style={{ marginTop: "0.75rem" }}
            onClick={onPromote}
            disabled={promoting || promoteTargets.length === 0}
          >
            {promoting ? (
              <>
                <span className="spinner" aria-hidden /> جاري الترقية…
              </>
            ) : (
              `ترقية (${promoteTargets.length || 0})`
            )}
          </button>
        </div>
      )}

      {!release.postTimestamp && release.status === "APPROVED" && (
        <div className="banner-warn mono">
          <span className="prompt">{">"}</span> post-timestamp مفقود — لا يمكن النشر حتى يُضاف (إصدار جديد)
        </div>
      )}

      <p className="release-status-hint mono">
        <span className="prompt">{">"}</span> {releaseStatusHint(release.status)}
      </p>

      {release.status === "QUARANTINED" && release.validationFailureReason && (
        <div className="banner-danger mono">
          <span className="prompt">{">"}</span> VALIDATION_FAILED — {release.validationFailureReason}
        </div>
      )}

      {hasTinyPackage && (
        <div className="banner-warn mono">
          <span className="prompt">{">"}</span> PKG_SMALL — حزمة صغيرة جداً (&lt; 1 MB). مناسبة للاختبار فقط؛
          OTA حقيقي يكون مئات MB.
        </div>
      )}

      {toast && (
        <div className="toast-success">
          {toast}
          <button type="button" className="toast-dismiss" onClick={() => setToast(null)} aria-label="إغلاق">
            ×
          </button>
        </div>
      )}

      {release.changelog && (
        <div className="admin-panel">
          <h2>سجل التغييرات</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{release.changelog}</p>
        </div>
      )}

      <div className="admin-panel" style={{ marginTop: "1rem" }}>
        <h2>الحزم ({release.packages.length})</h2>
        {release.packages.length === 0 ? (
          <p className="muted">
            لا توجد حزم — <Link href="/admin/uploads">ارفع حزمة OTA</Link>.
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>النوع</th>
                <th>الملف</th>
                <th>الحجم</th>
                <th>التحقق</th>
              </tr>
            </thead>
            <tbody>
              {release.packages.map((p) => {
                const bytes = Number(p.byteSize);
                const tiny = isSuspiciouslySmallPackage(bytes);
                return (
                  <tr key={p.id} className={tiny ? "row-warn" : undefined}>
                    <td>{p.packageType}</td>
                    <td>
                      <code>{p.originalFilename}</code>
                    </td>
                    <td>
                      {formatBytes(bytes)}
                      {tiny && <span className="pkg-size-warn mono"> (test)</span>}
                    </td>
                    <td>
                      {p.validationErrors ? (
                        <span className="validation-failure-reason">{p.validationErrors}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-panel" style={{ marginTop: "1rem" }}>
        <h2>الموافقات ({release.approvals.length}/{RELEASE_APPROVALS_REQUIRED})</h2>
        {release.approvals.length === 0 ? (
          <p className="muted">لا توجد موافقة بعد — يتطلب موافقة المسؤول.</p>
        ) : (
          <ul className="admin-list">
            {release.approvals.map((a, i) => (
              <li key={i}>
                {a.approverName ?? a.approverEmail} — {new Date(a.createdAt).toLocaleString("ar")}
                {a.note && <span className="muted"> ({a.note})</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title="موافقة على الإصدار"
        description={`${release.versionLabel} · ${release.codename} — موافقة ${release.approvals.length + 1} من ${RELEASE_APPROVALS_REQUIRED}`}
        footer={
          <DialogActions
            onCancel={closeDialog}
            submitLabel="تأكيد الموافقة"
            loading={approving}
            submitForm={FORM_ID}
          />
        }
      >
        <form id={FORM_ID} onSubmit={onSubmit} className="form-stack">
          <FormField label="ملاحظة (اختياري)" htmlFor="note" tooltip={FORM_HELP.approve.note}>
            <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="سبب الموافقة…" />
          </FormField>
          {formError && <p className="error">{formError}</p>}
        </form>
      </Dialog>
    </div>
  );
}
