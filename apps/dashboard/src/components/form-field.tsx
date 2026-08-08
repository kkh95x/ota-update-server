import FieldTooltip from "@/components/field-tooltip";

export default function FormField({
  label,
  htmlFor,
  hint,
  tooltip,
  children,
  error,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  tooltip?: string;
  children: React.ReactNode;
  error?: string | null;
}) {
  return (
    <div className="form-field">
      <div className="form-field-label-row">
        <label htmlFor={htmlFor}>{label}</label>
        {tooltip && <FieldTooltip text={tooltip} />}
      </div>
      {hint && <p className="form-hint">{hint}</p>}
      {children}
      {error && <p className="error form-error">{error}</p>}
    </div>
  );
}
