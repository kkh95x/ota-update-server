import AdminPageHeader from "@/components/admin-page-header";

export default function PlaceholderAdminPage({
  title,
  description,
  module,
}: {
  title: string;
  description: string;
  module?: string;
}) {
  return (
    <div className="admin-page">
      <AdminPageHeader title={title} description={description} module={module} />

      <div className="admin-placeholder terminal-block">
        <p className="mono placeholder-line placeholder-d1">
          <span className="prompt">{">"}</span> MODULE_PENDING
        </p>
        <p className="mono placeholder-line placeholder-d2 muted">
          <span className="prompt">{">"}</span> status: AWAITING_IMPLEMENTATION
        </p>
        <p className="mono placeholder-line placeholder-d3 muted">
          <span className="prompt">{">"}</span> هذه الصفحة ستُكتمل في المراحل القادمة.
        </p>
        <div className="placeholder-progress" aria-hidden>
          <div className="placeholder-progress-bar" />
        </div>
        <p className="mono placeholder-hint muted">// press sidebar nav to access live modules</p>
      </div>
    </div>
  );
}
