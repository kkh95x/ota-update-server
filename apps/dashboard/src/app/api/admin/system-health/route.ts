import { NextResponse } from "next/server";
import { prisma } from "@custom-os-ota/database";
import { checkDatabaseHealth } from "@custom-os-ota/database";
import { checkStorageHealth } from "@custom-os-ota/object-storage";
import { requireAdminApi, isAuthFailure } from "@/lib/api-auth";
import { checkRedisHealth } from "@/lib/redis";
import { getPublishQueue, getValidationQueue } from "@/lib/queue";

export async function GET() {
  const auth = await requireAdminApi("dashboard.read");
  if (isAuthFailure(auth)) return auth.error;

  const [database, redis, storage] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkStorageHealth(),
  ]);

  let workerQueue = false;
  let publishQueueOk = false;
  try {
    const counts = await getValidationQueue().getJobCounts("waiting", "active", "completed", "failed");
    workerQueue = counts != null;
    await getPublishQueue().getJobCounts("waiting", "active");
    publishQueueOk = true;
  } catch {
    workerQueue = false;
    publishQueueOk = false;
  }

  const healthy = database && redis && storage;

  return NextResponse.json({
    status: healthy ? "healthy" : "degraded",
    checks: {
      database,
      redis,
      storage,
      workerQueue,
      publishQueue: publishQueueOk,
    },
    stats: {
      deviceModels: await prisma.deviceModel.count(),
      releases: await prisma.release.count(),
      uploadSessions: await prisma.uploadSession.count({ where: { status: "COMPLETED" } }),
    },
    timestamp: new Date().toISOString(),
  });
}
