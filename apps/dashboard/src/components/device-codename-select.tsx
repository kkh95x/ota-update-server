import { PIXEL_DEVICES } from "@/lib/pixel-devices";

type Props = {
  id?: string;
  value: string;
  onChange: (codename: string, productName: string) => void;
  excludeCodenames?: string[];
  disabled?: boolean;
  required?: boolean;
};

export default function DeviceCodenameSelect({
  id = "codename",
  value,
  onChange,
  excludeCodenames = [],
  disabled,
  required,
}: Props) {
  const excluded = new Set(excludeCodenames);
  const options = PIXEL_DEVICES.filter((d) => !excluded.has(d.codename));

  return (
    <select
      id={id}
      className="select-field"
      value={value}
      disabled={disabled}
      required={required}
      onChange={(e) => {
        const device = PIXEL_DEVICES.find((d) => d.codename === e.target.value);
        onChange(e.target.value, device?.productName ?? "");
      }}
    >
      <option value="">— اختر جهاز Google Pixel —</option>
      {options.map((d) => (
        <option key={d.codename} value={d.codename}>
          {d.productName} ({d.codename})
        </option>
      ))}
    </select>
  );
}
