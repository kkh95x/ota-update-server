"use client";

import { useEffect } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
};

export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: DialogProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="dialog-root" role="presentation" onClick={onClose}>
      <div
        className={`dialog-panel dialog-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-chrome mono" aria-hidden>
          <span className="dialog-chrome-dot dialog-chrome-close" />
          <span className="dialog-chrome-dot dialog-chrome-min" />
          <span className="dialog-chrome-dot dialog-chrome-max" />
          <span className="dialog-chrome-title">exec — dialog</span>
        </div>
        <header className="dialog-header">
          <div>
            <h2 id="dialog-title">
              <span className="prompt mono">{">"}</span> {title}
            </h2>
            {description && <p className="muted dialog-desc mono">// {description}</p>}
          </div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="إغلاق">
            ×
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </div>
    </div>
  );
}

export function DialogActions({
  onCancel,
  submitLabel,
  cancelLabel = "إلغاء",
  loading,
  disabled,
  submitForm,
  danger,
}: {
  onCancel: () => void;
  submitLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  submitForm?: string;
  danger?: boolean;
}) {
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
        {cancelLabel}
      </button>
      <button
        type="submit"
        form={submitForm}
        className={`btn${danger ? " btn-danger" : ""}`}
        disabled={loading || disabled}
      >
        {loading ? "جاري…" : submitLabel}
      </button>
    </>
  );
}
