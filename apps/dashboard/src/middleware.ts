import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Login page: never redirect here — stale cookies are cleared in dashboard layout.
  // Valid sessions are redirected server-side in admin/login/page.tsx.
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
    if (!hasSessionCookie) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
