import { prisma } from "@custom-os-ota/database";

import { ADMIN_NAV } from "@/lib/admin-nav";

import AdminPageHeader from "@/components/admin-page-header";

import Link from "next/link";



export const dynamic = "force-dynamic";



async function getPauseState(): Promise<boolean> {

  try {

    const setting = await prisma.systemSetting.findUnique({ where: { key: "otaOffersPaused" } });

    return Boolean(setting?.value);

  } catch {

    return false;

  }

}



async function getQuickStats() {

  try {

    const [models, releases, uploads] = await Promise.all([

      prisma.deviceModel.count(),

      prisma.release.count(),

      prisma.uploadSession.count({ where: { status: "COMPLETED" } }),

    ]);

    return { models, releases, uploads };

  } catch {

    return null;

  }

}



export default async function AdminOverviewPage() {

  const [paused, stats] = await Promise.all([getPauseState(), getQuickStats()]);



  return (

    <div className="admin-page admin-page-wide">

      <AdminPageHeader

        module="overview"

        title="نظرة عامة"

        description="مرحباً — اختر وحدة من الشبكة أو الشريط الجانبي."

      />



      {paused && (

        <div className="banner-paused mono">

          <span className="prompt">{">"}</span> OTA_PAUSED — التحديثات متوقفة globally — راجع الإعدادات

        </div>

      )}



      {stats && (

        <div className="admin-stats-row">

          <div className="admin-stat-card">

            <span className="mono admin-stat-label">devices</span>

            <strong className="mono admin-stat-value">{stats.models}</strong>

          </div>

          <div className="admin-stat-card">

            <span className="mono admin-stat-label">releases</span>

            <strong className="mono admin-stat-value">{stats.releases}</strong>

          </div>

          <div className="admin-stat-card">

            <span className="mono admin-stat-label">uploads</span>

            <strong className="mono admin-stat-value">{stats.uploads}</strong>

          </div>

        </div>

      )}



      <section className="admin-overview-grid">

        {ADMIN_NAV.filter((item) => item.href !== "/admin").map((item, i) => (

          <Link

            key={item.href}

            href={item.href}

            className="admin-overview-card"

            style={{ animationDelay: `${i * 45}ms` }}

          >

            {item.module && (

              <span className="mono admin-overview-module">mod::{item.module}</span>

            )}

            <strong>{item.label}</strong>

            {item.description && <p className="muted">{item.description}</p>}

            <span className="admin-overview-arrow mono" aria-hidden>

              {">"} exec

            </span>

          </Link>

        ))}

      </section>

    </div>

  );

}

