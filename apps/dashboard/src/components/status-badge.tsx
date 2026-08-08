const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  QUARANTINED: "حجر",
  VALIDATING: "جاري التحقق",
  VALIDATED: "تم التحقق",
  PENDING_APPROVAL: "بانتظار الموافقة",
  APPROVED: "موافق عليه",
  PUBLISHED: "منشور",
  PAUSED: "متوقف",
  REVOKED: "ملغى",
};

export default function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const tone =
    status === "REVOKED" || status === "FAILED"
      ? "danger"
      : status === "APPROVED" || status === "PUBLISHED"
        ? "success"
        : status === "VALIDATING" || status === "PENDING_APPROVAL"
          ? "warn"
          : "neutral";
  return (
    <span className={`status-badge status-${tone} mono`}>
      <span className="status-dot" aria-hidden />
      {label}
    </span>
  );
}
