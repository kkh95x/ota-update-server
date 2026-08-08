"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { APP_NAME } from "@custom-os-ota/shared";
import { ADMIN_NAV } from "@/lib/admin-nav";

type Props = {
  email: string;
  displayName: string | null;
  open?: boolean;
  onNavigate?: () => void;
};

export default function AdminSidebar({ email, displayName, open = false, onNavigate }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    onNavigate?.();
  }, [pathname, onNavigate]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside id="admin-sidebar" className={`admin-sidebar${open ? " is-open" : ""}`}>
      <div className="admin-sidebar-brand">
        <div className="terminal-line">
          <span className="prompt">root@ota</span>
          <span className="prompt-sep">:</span>
          <span className="prompt-path">~/admin</span>
          <span className="prompt-cursor" aria-hidden />
        </div>
        <span className="admin-sidebar-title">لوحة الإدارة</span>
        <span className="admin-sidebar-subtitle mono">{APP_NAME}</span>
        <div className="sys-status">
          <span className="sys-dot" />
          <span className="mono">SYS_ONLINE</span>
        </div>
      </div>

      <nav className="admin-nav" aria-label="التنقل الرئيسي">
        {ADMIN_NAV.map((item, i) => {
          const active =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-link${active ? " active" : ""}`}
              style={{ animationDelay: `${i * 35}ms` }}
            >
              <span className="nav-prefix mono">{active ? "▸" : "›"}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-user">
          <span className="admin-user-label mono">SESSION</span>
          <span className="admin-user-name">{displayName ?? email}</span>
          <span className="admin-user-email mono">{email}</span>
        </div>
        <button type="button" className="btn btn-secondary admin-logout" onClick={logout}>
          <span className="mono">exit</span> — تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
