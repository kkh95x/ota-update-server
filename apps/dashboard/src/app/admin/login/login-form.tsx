"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { APP_NAME } from "@custom-os-ota/shared";
import FormField from "@/components/form-field";
import { FORM_HELP } from "@/lib/form-field-help";

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("ACCESS_DENIED — بيانات الدخول غير صحيحة");
        return;
      }
      const next = searchParams.get("next") || "/admin";
      router.push(next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch {
      setError("CONN_ERR — تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="os-grid" aria-hidden />
      <div className="crt-scanlines" aria-hidden />

      <div className="login-card page-enter">
        <div className="login-boot mono">
          <p className="boot-line boot-d1">{">"} CUSTOM_OS OTA KERNEL v17.0</p>
          <p className="boot-line boot-d2">{">"} initializing secure shell… OK</p>
          <p className="boot-line boot-d3">{">"} {APP_NAME}</p>
        </div>

        <header className="login-header">
          <h1>
            <span className="mono prompt">auth</span> — تسجيل الدخول
          </h1>
          <p className="muted mono">// admin session required</p>
        </header>

        <form onSubmit={onSubmit} className="login-form">
          <FormField label="البريد الإلكتروني" htmlFor="email" tooltip={FORM_HELP.login.email}>
            <input
              id="email"
              className="input-terminal"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="admin@example.com"
              required
            />
          </FormField>
          <FormField label="كلمة المرور" htmlFor="password" tooltip={FORM_HELP.login.password}>
            <input
              id="password"
              className="input-terminal"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </FormField>
          {error && <p className="error error-terminal">{error}</p>}
          <button className="btn btn-glow login-submit" type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" aria-hidden /> AUTHENTICATING…
              </>
            ) : (
              <>
                <span className="mono">{">"}</span> EXEC LOGIN
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
