"use client";

import { useEffect, useMemo, useState } from "react";
import DeviceCodenameSelect from "@/components/device-codename-select";
import Dialog, { DialogActions } from "@/components/dialog";
import AdminPageHeader from "@/components/admin-page-header";
import FormField from "@/components/form-field";
import { FORM_HELP } from "@/lib/form-field-help";
import { getPixelDevice, PIXEL_DEVICES } from "@/lib/pixel-devices";

type DeviceModel = {
  id: string;
  codename: string;
  displayName: string;
  isActive: boolean;
};

const FORM_ID = "add-device-form";

export default function DevicesView() {
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [codename, setCodename] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const registeredCodenames = useMemo(() => models.map((m) => m.codename), [models]);
  const selectedDevice = codename ? getPixelDevice(codename) : undefined;
  const allRegistered = registeredCodenames.length >= PIXEL_DEVICES.length;

  async function load() {
    const res = await fetch("/api/admin/device-models");
    if (!res.ok) {
      setError("تعذر تحميل نماذج الأجهزة");
      return;
    }
    const data = (await res.json()) as { models: DeviceModel[] };
    setModels(data.models);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  function openDialog() {
    setCodename("");
    setDisplayName("");
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setDialogOpen(false);
    setError(null);
  }

  function handleCodenameChange(nextCodename: string, productName: string) {
    setCodename(nextCodename);
    setDisplayName(productName);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!codename || !displayName) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/device-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codename, displayName }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (body.error === "codename_exists") setError("هذا الجهاز مسجّل مسبقاً");
        else if (body.error === "codename_not_eligible") setError("Codename غير مدعوم");
        else setError("فشل الإضافة");
        return;
      }
      setDialogOpen(false);
      setToast("تم تسجيل الجهاز بنجاح");
      await load();
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <AdminPageHeader
        module="devices"
        title="نماذج الأجهزة"
        description="أجهزة Pixel المفعّلة للتحديث OTA"
        actions={
          !allRegistered ? (
            <button type="button" className="btn" onClick={openDialog}>
              + إضافة جهاز
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
          <h2>الأجهزة المفعّلة</h2>
          <span className="panel-badge">{models.length} مسجّل</span>
        </div>

        {loading ? (
          <p className="muted">جاري التحميل…</p>
        ) : models.length === 0 ? (
          <div className="empty-state">
            <p>لا توجد أجهزة مسجّلة بعد.</p>
            {!allRegistered && (
              <button type="button" className="btn" onClick={openDialog}>
                إضافة أول جهاز
              </button>
            )}
          </div>
        ) : (
          <div className="device-grid">
            {models.map((m) => {
              const ref = getPixelDevice(m.codename);
              return (
                <article key={m.id} className="device-card">
                  <div className="device-card-icon">{m.codename.slice(0, 2).toUpperCase()}</div>
                  <div className="device-card-body">
                    <strong>{m.displayName}</strong>
                    <code>{m.codename}</code>
                    {ref && ref.productName !== m.displayName && (
                      <span className="muted device-card-ref">{ref.productName}</span>
                    )}
                  </div>
                  <span className={`device-status${m.isActive ? " active" : ""}`}>
                    {m.isActive ? "نشط" : "معطّل"}
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title="إضافة جهاز Pixel"
        description="اختر الجهاز من القائمة — الأجهزة المسجّلة مخفية"
        footer={
          <DialogActions
            onCancel={closeDialog}
            submitLabel="تسجيل الجهاز"
            loading={saving}
            disabled={!codename}
            submitForm={FORM_ID}
          />
        }
      >
        <form id={FORM_ID} onSubmit={onSubmit} className="form-stack">
          <FormField label="الجهاز" htmlFor="codename" tooltip={FORM_HELP.device.codename}>
            <DeviceCodenameSelect
              value={codename}
              onChange={handleCodenameChange}
              excludeCodenames={registeredCodenames}
              disabled={saving}
              required
            />
          </FormField>

          {selectedDevice && (
            <div className="device-preview compact">
              <div className="device-preview-icon sm">{selectedDevice.codename.slice(0, 2).toUpperCase()}</div>
              <div>
                <strong>{selectedDevice.productName}</strong>
                <p className="muted">
                  Codename: <code>{selectedDevice.codename}</code>
                </p>
              </div>
            </div>
          )}

          {error && <p className="error">{error}</p>}
        </form>
      </Dialog>
    </div>
  );
}
