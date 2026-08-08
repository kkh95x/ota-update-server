"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Dialog, { DialogActions } from "@/components/dialog";
import AdminPageHeader from "@/components/admin-page-header";
import FormField from "@/components/form-field";
import { FORM_HELP } from "@/lib/form-field-help";
import RegisteredDeviceSelect from "@/components/registered-device-select";
import StatusBadge from "@/components/status-badge";
import { RELEASE_APPROVALS_REQUIRED } from "@/lib/release-approval";

type ReleaseRow = {
  id: string;
  versionLabel: string;
  incrementalBuild: string;
  channelKey: string;
  channelKeys: string[];
  status: string;
  validationFailureReason?: string | null;
  codename: string;
  packageCount: number;
  approvalCount: number;
  createdAt: string;
};

type DeviceModel = { id: string; codename: string; displayName: string };

const CHANNELS = [
  { key: "testing", label: "Testing", desc: "أول نشر / مختبر" },
  { key: "alpha", label: "Alpha", desc: "داخلي" },
  { key: "beta", label: "Beta", desc: "اختبار واسع" },
  { key: "stable", label: "Stable", desc: "الإنتاج" },
] as const;

const FORM_ID = "create-release-form";

export default function ReleasesView() {
  const [releases, setReleases] = useState<ReleaseRow[]>([]);
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    deviceModelId: "",
    versionLabel: "",
    buildId: "",
    incrementalBuild: "",
    postTimestamp: "",
    channelKeys: ["testing"] as string[],
    changelog: "",
  });

  async function load() {
    const [relRes, modRes] = await Promise.all([
      fetch("/api/admin/releases"),
      fetch("/api/admin/device-models"),
    ]);
    if (!relRes.ok) throw new Error("releases");
    const relData = (await relRes.json()) as { releases: ReleaseRow[] };
    setReleases(relData.releases);
    if (modRes.ok) {
      const modData = (await modRes.json()) as { models: DeviceModel[] };
      setModels(modData.models);
    }
  }

  useEffect(() => {
    load()
      .catch(() => setLoadError("تعذر تحميل الإصدارات"))
      .finally(() => setLoading(false));
  }, []);

  function openDialog() {
    setForm({
      deviceModelId: models[0]?.id ?? "",
      versionLabel: "",
      buildId: "",
      incrementalBuild: "",
      postTimestamp: "",
      channelKeys: ["testing"],
      changelog: "",
    });
    setFormError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setDialogOpen(false);
    setFormError(null);
  }

  function toggleChannelKey(key: string) {
    setForm((prev) => {
      const selected = prev.channelKeys.includes(key)
        ? prev.channelKeys.filter((k) => k !== key)
        : [...prev.channelKeys, key];
      if (selected.length === 0) return prev;
      return { ...prev, channelKeys: selected };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.channelKeys.length === 0) {
      setFormError("اختر قناة واحدة على الأقل");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        setFormError("فشل إنشاء الإصدار");
        return;
      }
      setDialogOpen(false);
      setToast("تم إنشاء مسودة الإصدار");
      await load();
    } catch {
      setFormError("تعذر الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  }

  const selectedModel = models.find((m) => m.id === form.deviceModelId);

  return (
    <div className="admin-page admin-page-wide">
      <AdminPageHeader
        module="releases"
        title="الإصدارات"
        description="إدارة إصدارات OTA لكل جهاز"
        actions={
          models.length > 0 ? (
            <button type="button" className="btn" onClick={openDialog}>
              + إصدار جديد
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

      {loadError && <p className="error">{loadError}</p>}

      <div className="admin-panel">
        <div className="panel-heading">
          <h2>كل الإصدارات</h2>
          <span className="panel-badge">{releases.length}</span>
        </div>

        {models.length === 0 && !loading && (
          <div className="empty-state" style={{ marginBottom: "1rem" }}>
            <p>سجّل جهازاً أولاً قبل إنشاء إصدار.</p>
            <Link className="btn btn-secondary" href="/admin/devices">
              تسجيل جهاز Pixel
            </Link>
          </div>
        )}

        {loading ? (
          <p className="muted">جاري التحميل…</p>
        ) : releases.length === 0 ? (
          <div className="empty-state">
            <p className="muted">لا توجد إصدارات بعد.</p>
            {models.length > 0 && (
              <button type="button" className="btn" onClick={openDialog}>
                إنشاء أول إصدار
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>الجهاز</th>
                  <th>الإصدار</th>
                  <th>القناة</th>
                  <th>الحالة</th>
                  <th>حزم</th>
                  <th>موافقات</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {releases.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code>{r.codename}</code>
                    </td>
                    <td>
                      <strong>{r.versionLabel}</strong>
                      <br />
                      <span className="muted">{r.incrementalBuild}</span>
                    </td>
                    <td>
                      <div className="channel-tags">
                        {(r.channelKeys ?? [r.channelKey]).map((ch) => (
                          <span key={ch} className="channel-tag">
                            {ch}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                      {r.status === "QUARANTINED" && r.validationFailureReason && (
                        <p className="validation-failure-reason">{r.validationFailureReason}</p>
                      )}
                    </td>
                    <td>{r.packageCount}</td>
                    <td>{r.approvalCount}/{RELEASE_APPROVALS_REQUIRED}</td>
                    <td>
                      <Link className="table-link" href={`/admin/releases/${r.id}`}>
                        عرض ←
                      </Link>
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
        title="إصدار جديد"
        description="مسودة — يمكن رفع الحزمة والموافقة لاحقاً"
        size="xl"
        footer={
          <DialogActions
            onCancel={closeDialog}
            submitLabel="إنشاء مسودة"
            loading={saving}
            disabled={!form.deviceModelId || form.channelKeys.length === 0}
            submitForm={FORM_ID}
          />
        }
      >
        <form id={FORM_ID} onSubmit={onSubmit} className="form-stack">
          <FormField label="الجهاز" htmlFor="deviceModelId" tooltip={FORM_HELP.release.deviceModel}>
            <RegisteredDeviceSelect
              value={form.deviceModelId}
              onChange={(deviceModelId) => setForm({ ...form, deviceModelId })}
              models={models}
              required
            />
          </FormField>

          {selectedModel && (
            <div className="device-preview compact">
              <div className="device-preview-icon sm">{selectedModel.codename.slice(0, 2).toUpperCase()}</div>
              <div>
                <strong>{selectedModel.displayName}</strong>
                <p className="muted">
                  <code>{selectedModel.codename}</code>
                </p>
              </div>
            </div>
          )}

          <FormField label="قناة التحديث" tooltip={FORM_HELP.release.channel}>
            <div className="channel-picker" role="group" aria-label="قناة التحديث">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.key}
                  type="button"
                  className={`channel-pill${form.channelKeys.includes(ch.key) ? " active" : ""}`}
                  onClick={() => toggleChannelKey(ch.key)}
                  aria-pressed={form.channelKeys.includes(ch.key)}
                >
                  <span>{ch.label}</span>
                  <small>{ch.desc}</small>
                </button>
              ))}
            </div>
            <p className="muted form-hint">
              اختر قناة واحدة أو أكثر — الأولى (testing → stable) تُستخدم كقناة المنشأ عند النشر.
            </p>
          </FormField>

          <div className="form-grid">
            <FormField label="تسمية الإصدار" htmlFor="versionLabel" tooltip={FORM_HELP.release.versionLabel}>
              <input
                id="versionLabel"
                value={form.versionLabel}
                onChange={(e) => setForm({ ...form, versionLabel: e.target.value })}
                placeholder="مثال: أغسط 2026"
                required
              />
            </FormField>
            <FormField label="Build ID" htmlFor="buildId" tooltip={FORM_HELP.release.buildId}>
              <input
                id="buildId"
                value={form.buildId}
                onChange={(e) => setForm({ ...form, buildId: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Incremental" htmlFor="incrementalBuild" tooltip={FORM_HELP.release.incrementalBuild}>
              <input
                id="incrementalBuild"
                value={form.incrementalBuild}
                onChange={(e) => setForm({ ...form, incrementalBuild: e.target.value })}
                placeholder="2026080100"
                inputMode="numeric"
                required
              />
            </FormField>
            <FormField label="Post timestamp" htmlFor="postTimestamp" tooltip={FORM_HELP.release.postTimestamp}>
              <input
                id="postTimestamp"
                value={form.postTimestamp}
                onChange={(e) => setForm({ ...form, postTimestamp: e.target.value })}
                placeholder="1785291770"
                inputMode="numeric"
                required
              />
            </FormField>
          </div>

          <FormField label="سجل التغييرات" htmlFor="changelog" tooltip={FORM_HELP.release.changelog}>
            <textarea
              id="changelog"
              value={form.changelog}
              onChange={(e) => setForm({ ...form, changelog: e.target.value })}
              rows={3}
            />
          </FormField>

          {formError && <p className="error">{formError}</p>}
        </form>
      </Dialog>
    </div>
  );
}
