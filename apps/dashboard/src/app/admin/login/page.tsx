import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdminSession } from "@/lib/session";
import AdminLoginForm from "./login-form";

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) {
    redirect("/admin");
  }

  return (
    <Suspense fallback={<div className="login-screen" />}>
      <AdminLoginForm />
    </Suspense>
  );
}
