import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin-shell";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { getAdminSession } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) {
    const cookieStore = await cookies();
    if (cookieStore.get(SESSION_COOKIE)) {
      redirect("/api/auth/clear-session");
    }
    redirect("/admin/login");
  }

  return <AdminShell user={session}>{children}</AdminShell>;
}
