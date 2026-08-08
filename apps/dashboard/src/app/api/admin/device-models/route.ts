import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@custom-os-ota/database";
import { writeAudit } from "@custom-os-ota/audit";
import { extractClientIp } from "@custom-os-ota/observability";
import { requireAdminApi, isAuthFailure } from "@/lib/api-auth";
import { isEligibleCodename, getPixelDevice } from "@/lib/pixel-devices";

export async function GET() {
  const auth = await requireAdminApi("device.read");
  if (isAuthFailure(auth)) return auth.error;

  const models = await prisma.deviceModel.findMany({
    orderBy: { codename: "asc" },
  });

  return NextResponse.json({
    models: models.map((m) => ({
      id: m.id,
      codename: m.codename,
      displayName: m.displayName,
      isActive: m.isActive,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

const createSchema = z.object({
  codename: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9]+$/, "codename must be lowercase alphanumeric"),
  displayName: z.string().min(2).max(120),
});

export async function POST(request: Request) {
  const auth = await requireAdminApi("device.write");
  if (isAuthFailure(auth)) return auth.error;

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "invalid_request", details: body.error.flatten() }, { status: 400 });
  }

  if (!isEligibleCodename(body.data.codename)) {
    return NextResponse.json({ error: "codename_not_eligible" }, { status: 400 });
  }

  const existing = await prisma.deviceModel.findUnique({ where: { codename: body.data.codename } });
  if (existing) {
    return NextResponse.json({ error: "codename_exists" }, { status: 409 });
  }

  const { clientIp, forwardedFor } = extractClientIp(request.headers);

  const model = await prisma.deviceModel.create({
    data: {
      codename: body.data.codename,
      displayName: getPixelDevice(body.data.codename)?.productName ?? body.data.displayName,
    },
  });

  await writeAudit({
    actorId: auth.session.userId,
    action: "device_model.create",
    targetType: "DeviceModel",
    targetId: model.id,
    metadata: { codename: model.codename },
    clientIp,
    forwardedFor,
    result: "success",
  });

  return NextResponse.json(
    {
      model: {
        id: model.id,
        codename: model.codename,
        displayName: model.displayName,
        isActive: model.isActive,
      },
    },
    { status: 201 },
  );
}
