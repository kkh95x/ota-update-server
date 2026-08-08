import { NextResponse } from "next/server";
import { authorize } from "@custom-os-ota/authorization";
import { getAdminSession, type AdminSessionUser } from "@/lib/session";

type AuthSuccess = { session: AdminSessionUser };
type AuthFailure = { error: NextResponse };

export async function requireAdminApi(
  permission?: string,
): Promise<AuthSuccess | AuthFailure> {
  const session = await getAdminSession();
  if (!session) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (permission) {
    const allowed = await authorize(session.userId, permission);
    if (!allowed) {
      return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
    }
  }
  return { session };
}

export function isAuthFailure(result: AuthSuccess | AuthFailure): result is AuthFailure {
  return "error" in result;
}
