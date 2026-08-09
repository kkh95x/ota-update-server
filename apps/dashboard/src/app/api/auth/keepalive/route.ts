import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { extendSessionIdle, validateSession } from "@custom-os-ota/auth";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const UPLOAD_IDLE_MS = 4 * 60 * 60 * 1000;

/** Refresh admin session idle timer during long MinIO uploads (no dashboard API traffic). */
export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const session = await validateSession(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await extendSessionIdle(token, UPLOAD_IDLE_MS);

  return NextResponse.json({
    ok: true,
    idleExtendedMs: UPLOAD_IDLE_MS,
  });
}
