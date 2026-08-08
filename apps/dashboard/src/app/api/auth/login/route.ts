import { NextResponse } from "next/server";
import { authenticateAdmin } from "@custom-os-ota/auth";
import { extractClientIp } from "@custom-os-ota/observability";
import { ensureEnv } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export async function POST(request: Request) {
  ensureEnv();
  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { clientIp, forwardedFor } = extractClientIp(request.headers);
  const result = await authenticateAdmin(body.email, body.password, {
    clientIp,
    forwardedFor,
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  if (!result) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, result.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return response;
}
