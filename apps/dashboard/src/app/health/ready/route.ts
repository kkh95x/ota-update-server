import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@custom-os-ota/database";
import { ensureEnv } from "@/lib/env";
import { checkRedisHealth } from "@/lib/redis";

export async function GET() {
  ensureEnv();
  const [db, redis] = await Promise.all([checkDatabaseHealth(), checkRedisHealth()]);
  const ready = db && redis;
  return NextResponse.json(
    {
      status: ready ? "ready" : "degraded",
      checks: { database: db, redis },
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
