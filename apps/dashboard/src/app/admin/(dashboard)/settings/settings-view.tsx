"use client";

import { useEffect, useState } from "react";
import Dialog, { DialogActions } from "@/components/dialog";
import AdminPageHeader from "@/components/admin-page-header";
import FormField from "@/components/form-field";
import { FORM_HELP } from "@/lib/form-field-help";

const FORM_ID = "pause-settings-form";

export default function SettingsView() {
  const [paused, setPaused] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"pause" | "resume" | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings/pause")
      .then(async (res) => {
        if (!res.ok) throw new Error("forbidden");
        return res.json() as Promise<{ otaOffersPaused: boolean }>;
      })
      .then((d) => setPaused(d.otaOffersPaused))
      .catch(() => setError("لا تملك صلاحية عرض الإعدادات"))
      .finally(() => setLoading(false));
  }, []);

  function openDialog(action: "pause" | "resume") {
    setPendingAction(action);
    setReason("");
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setDialogOpen(false);
    setPendingAction(null);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingAction) return;
    if (reason.trim().length < 3) {
      setError("يرجى إدخال سبب (3 أحرف على الأقل)");
      return;
    }

    const nextPaused = pendingAction === "pause";
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: nextPaused, reason: reason.trim() }),
      });
      if (!res.ok) {
        setError("فشل حفظ الإعداد");
        return;
      }
      setPaused(nextPaused);
      setDialogOpen(false);
      setToast(nextPaused ? "تم إيقاف التحديثات globally" : "تم استئناف التحديثات");
      setReason("");
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <p className="muted">جاري التحميل…</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <AdminPageHeader
        module="settings"
        title="الإعدادات"
        description="التحكم global في عروض التحديث OTA"
      />

      {toast && (
        <div className="toast-success">
          {toast}
          <button type="button" className="toast-dismiss" onClick={() => setToast(null)} aria-label="إغلاق">
            ×
          </button>
        </div>
      )}

      {paused && <div className="banner-paused">⏸ التحديثات متوقفة حالياً للجميع</div>}

      <div className="admin-panel">
        <h2>إيقاف / استئناف التحديثات</h2>
        <p className="muted" style={{ marginBottom: "1.25rem" }}>
          يتطلب صلاحية SECURITY_ADMIN أو SUPER_ADMIN. يُسجَّل السبب في سجل التدقيق.
        </p>

        <div className="settings-status-card">
          <div>
            <strong>الحالة الحالية</strong>
            <p className="muted">{paused ? "متوقف — لا عروض OTA جديدة" : "نشط — التحديثات متاحة"}</p>
          </div>
          {!paused ? (
            <button type="button" className="btn btn-danger" onClick={() => openDialog("pause")}>
              إيقاف للجميع
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => openDialog("resume")}>
              استئناف التحديثات
            </button>
          )}
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title={pendingAction === "pause" ? "إيقاف التحديثات" : "استئناف التحديثات"}
        description="أدخل سبباً — يُحفظ في سجل التدقيق"
        footer={
          <DialogActions
            onCancel={closeDialog}
            submitLabel={pendingAction === "pause" ? "تأكيد الإيقاف" : "تأكيد الاستئناف"}
            loading={saving}
            disabled={reason.trim().length < 3}
            submitForm={FORM_ID}
            danger={pendingAction === "pause"}
          />
        }
      >
        <form id={FORM_ID} onSubmit={onSubmit} className="form-stack">
          <FormField
            label="السبب"
            htmlFor="reason"
            hint="3 أحرف على الأقل"
            tooltip={FORM_HELP.settings.reason}
          >
            <input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: صيانة طارئة على الخادم"
              required
              minLength={3}
            />
          </FormField>
          {error && <p className="error">{error}</p>}
        </form>
      </Dialog>
    </div>
  );
}
