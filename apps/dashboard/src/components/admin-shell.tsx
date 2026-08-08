"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSidebar from "@/components/admin-sidebar";
import type { AdminSessionUser } from "@/lib/session";

export default function AdminShell({
  user,
  children,
}: {
  user: AdminSessionUser;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    if (!sidebarOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeSidebar();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [sidebarOpen, closeSidebar]);

  return (
    <div className="admin-layout">
      <div className="os-grid" aria-hidden />
      <div className="crt-scanlines" aria-hidden />

      <button
        type="button"
        className={`admin-sidebar-backdrop${sidebarOpen ? " is-visible" : ""}`}
        aria-label="إغلاق القائمة"
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={closeSidebar}
      />

      <AdminSidebar
        email={user.email}
        displayName={user.displayName}
        open={sidebarOpen}
        onNavigate={closeSidebar}
      />

      <div className="admin-main">
        <div className="admin-topbar mono">
          <button
            type="button"
            className="admin-menu-toggle"
            aria-expanded={sidebarOpen}
            aria-controls="admin-sidebar"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <span className="admin-menu-toggle-icon" aria-hidden>
              {sidebarOpen ? "×" : "☰"}
            </span>
            <span>menu</span>
          </button>
          <div className="admin-topbar-info" aria-hidden>
            <span className="prompt">kernel</span>
            <span className="prompt-sep">@</span>
            <span>ota-release</span>
            <span className="admin-topbar-sep">|</span>
            <span className="admin-topbar-clock">branch 17</span>
          </div>
        </div>
        <div className="admin-main-inner page-enter">{children}</div>
      </div>
    </div>
  );
}
