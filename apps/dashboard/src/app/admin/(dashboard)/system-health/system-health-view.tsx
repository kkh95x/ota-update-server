"use client";

import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin-page-header";

type HealthData = {
  status: string;
  checks: {
    database: boolean;
    redis: boolean;
    storage: boolean;
    workerQueue: boolean;
  };
  stats: {
    deviceModels: number;
    releases: number;
    uploadSessions: number;
  };
};

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="health-row">
      <span>{label}</span>
      <span className={ok ? "health-ok" : "health-fail"}>{ok ? "✓ يعمل" : "✗ متوقف"}</span>
    </div>
  );
}

export default function SystemHealthView() {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/system-health")
      .then(async (res) => {
        if (!res.ok) throw new Error("failed");
        return res.json() as Promise<HealthData>;
      })
      .then(setData)
      .catch(() => setError("تعذر تحميل حالة النظام"));
  }, []);

  if (error) {
    return (
      <div className="admin-page">
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="admin-page">
        <AdminPageHeader module="health" title="صحة النظام" description="حالة الخدمات الأساسية للمنصة" />
        <p className="loading-terminal mono">
          <span className="spinner" aria-hidden /> scanning services…
        </p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <AdminPageHeader module="health" title="صحة النظام" description="حالة الخدمات الأساسية للمنصة" />

      <div className="admin-panel">
        <h2>الخدمات</h2>
        <CheckRow label="PostgreSQL" ok={data.checks.database} />
        <CheckRow label="Redis" ok={data.checks.redis} />
        <CheckRow label="MinIO (التخزين)" ok={data.checks.storage} />
        <CheckRow label="طابور Worker" ok={data.checks.workerQueue} />
      </div>

      <div className="admin-panel" style={{ marginTop: "1rem" }}>
        <h2>إحصائيات</h2>
        <CheckRow label="نماذج الأجهزة" ok={data.stats.deviceModels > 0} />
        <p className="muted admin-stat-detail">{data.stats.deviceModels} مسجّل</p>
        <CheckRow label="الإصدارات" ok={true} />
        <p className="muted admin-stat-detail">{data.stats.releases} إصدار</p>
        <CheckRow label="رفوعات مكتملة" ok={true} />
        <p className="muted admin-stat-detail">{data.stats.uploadSessions} جلسة</p>
      </div>
    </div>
  );
}
