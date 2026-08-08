import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { revokeSession } from "@custom-os-ota/auth";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { getAdminSession } from "@/lib/session";

export async function POST() {
  const session = await getAdminSession();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionToken) {
    await revokeSession(sessionToken, session?.userId);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
