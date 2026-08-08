import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

function safeRedirectPath(next: string | null): string {
  if (!next || !next.startsWith("/admin")) {
    return "/admin/login";
  }
  return next;
}

/** Clears stale session cookie and redirects (Route Handler — cookies mutable here). */
export async function GET(request: NextRequest) {
  const target = safeRedirectPath(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(target, request.url));
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
