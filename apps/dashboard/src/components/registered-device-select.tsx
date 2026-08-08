type DeviceModel = {
  id: string;
  codename: string;
  displayName: string;
};

type Props = {
  id?: string;
  value: string;
  onChange: (deviceModelId: string) => void;
  models: DeviceModel[];
  placeholder?: string;
  required?: boolean;
};

export default function RegisteredDeviceSelect({
  id = "deviceModelId",
  value,
  onChange,
  models,
  placeholder = "— اختر جهازاً مسجّلاً —",
  required,
}: Props) {
  return (
    <select
      id={id}
      className="select-field"
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.displayName} ({m.codename})
        </option>
      ))}
    </select>
  );
}
