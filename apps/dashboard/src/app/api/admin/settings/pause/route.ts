import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@custom-os-ota/database";
import { writeAudit } from "@custom-os-ota/audit";
import { extractClientIp } from "@custom-os-ota/observability";
import { requireAdminApi, isAuthFailure } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAdminApi("dashboard.read");
  if (isAuthFailure(auth)) return auth.error;

  const setting = await prisma.systemSetting.findUnique({ where: { key: "otaOffersPaused" } });
  return NextResponse.json({
    otaOffersPaused: Boolean(setting?.value),
    updatedAt: setting?.updatedAt?.toISOString() ?? null,
  });
}

const pauseSchema = z.object({
  paused: z.boolean(),
  reason: z.string().min(3).max(500),
});

export async function POST(request: Request) {
  const auth = await requireAdminApi("ota.pause.global");
  if (isAuthFailure(auth)) return auth.error;

  const body = pauseSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { clientIp, forwardedFor } = extractClientIp(request.headers);

  await prisma.systemSetting.upsert({
    where: { key: "otaOffersPaused" },
    create: {
      key: "otaOffersPaused",
      value: body.data.paused,
      updatedBy: auth.session.userId,
    },
    update: {
      value: body.data.paused,
      updatedBy: auth.session.userId,
    },
  });

  await writeAudit({
    actorId: auth.session.userId,
    action: body.data.paused ? "ota.pause.global" : "ota.resume.global",
    targetType: "SystemSetting",
    targetId: "otaOffersPaused",
    metadata: { reason: body.data.reason },
    clientIp,
    forwardedFor,
    result: "success",
    reason: body.data.reason,
  });

  return NextResponse.json({ ok: true, otaOffersPaused: body.data.paused });
}
