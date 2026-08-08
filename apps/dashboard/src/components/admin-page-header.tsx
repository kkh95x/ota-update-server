type Props = {
  title: React.ReactNode;
  description?: React.ReactNode;
  module?: string;
  actions?: React.ReactNode;
};

export default function AdminPageHeader({ title, description, module, actions }: Props) {
  return (
    <header className={`admin-page-header${actions ? " admin-page-header-row" : ""}`}>
      <div>
        {module && (
          <p className="admin-module-tag mono">
            <span className="prompt">{">"}</span> mod::{module}
          </p>
        )}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions}
    </header>
  );
}
