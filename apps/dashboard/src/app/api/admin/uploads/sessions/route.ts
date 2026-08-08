import { NextResponse } from "next/server";
import { z } from "zod";
import { loadEnv } from "@custom-os-ota/configuration";
import { prisma, OtaPackageType, ReleaseStatus, UploadStatus } from "@custom-os-ota/database";
import { writeAudit } from "@custom-os-ota/audit";
import { extractClientIp } from "@custom-os-ota/observability";
import { presignPutObject, quarantineObjectKey } from "@custom-os-ota/object-storage";
import { requireAdminApi, isAuthFailure } from "@/lib/api-auth";

const createSchema = z.object({
  filename: z.string().min(1).max(255),
  expectedSize: z.number().int().positive(),
  releaseId: z.string().min(1),
  packageType: z.enum(["FULL", "INCREMENTAL"]),
  sourceIncremental: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdminApi("upload.create");
  if (isAuthFailure(auth)) return auth.error;

  const body = createSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "invalid_request", details: body.error.flatten() }, { status: 400 });
  }

  const env = loadEnv();
  if (body.data.expectedSize > env.OTA_MAX_PACKAGE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const release = await prisma.release.findUnique({
    where: { id: body.data.releaseId },
    include: { deviceModel: true },
  });
  if (!release || release.status === ReleaseStatus.PUBLISHED || release.status === ReleaseStatus.REVOKED) {
    return NextResponse.json({ error: "release_not_found" }, { status: 404 });
  }

  if (body.data.packageType === "INCREMENTAL" && !body.data.sourceIncremental) {
    return NextResponse.json({ error: "source_incremental_required" }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const session = await prisma.uploadSession.create({
    data: {
      uploadedById: auth.session.userId,
      objectKey: "pending",
      expectedSize: BigInt(body.data.expectedSize),
      status: UploadStatus.CREATED,
      expiresAt,
    },
  });

  const objectKey = quarantineObjectKey(session.id, body.data.filename);
  await prisma.uploadSession.update({
    where: { id: session.id },
    data: { objectKey },
  });

  const uploadUrl = await presignPutObject({
    bucket: env.S3_BUCKET_QUARANTINE,
    objectKey,
    contentType: "application/zip",
    expiresInSeconds: 7200,
  });

  const { clientIp, forwardedFor } = extractClientIp(request.headers);
  await writeAudit({
    actorId: auth.session.userId,
    action: "upload.session.create",
    targetType: "UploadSession",
    targetId: session.id,
    metadata: {
      releaseId: release.id,
      filename: body.data.filename,
      expectedSize: body.data.expectedSize,
    },
    clientIp,
    forwardedFor,
    result: "success",
  });

  return NextResponse.json(
    {
      session: {
        id: session.id,
        uploadUrl,
        objectKey,
        expiresAt: expiresAt.toISOString(),
        releaseId: release.id,
        packageType: body.data.packageType as OtaPackageType,
        sourceIncremental: body.data.sourceIncremental ?? null,
        filename: body.data.filename,
        expectedSize: body.data.expectedSize,
      },
    },
    { status: 201 },
  );
}
