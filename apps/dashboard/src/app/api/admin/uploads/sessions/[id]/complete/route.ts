import { NextResponse } from "next/server";
import { z } from "zod";
import { loadEnv } from "@custom-os-ota/configuration";
import {
  prisma,
  ReleaseStatus,
  UploadStatus,
  ValidationStatus,
} from "@custom-os-ota/database";
import { writeAudit } from "@custom-os-ota/audit";
import { extractClientIp } from "@custom-os-ota/observability";
import { abortMultipartUpload, completeMultipartUpload, headObject } from "@custom-os-ota/object-storage";
import { requireAdminApi, isAuthFailure } from "@/lib/api-auth";
import { enqueueValidationJob } from "@/lib/queue";

type Params = { params: Promise<{ id: string }> };

const partSchema = z.object({
  partNumber: z.number().int().positive(),
  etag: z.string().min(1),
});

const completeSchema = z.object({
  releaseId: z.string().min(1),
  packageType: z.enum(["FULL", "INCREMENTAL"]),
  sourceIncremental: z.string().optional(),
  filename: z.string().min(1),
  parts: z.array(partSchema).optional(),
});

export async function POST(request: Request, { params }: Params) {
  const auth = await requireAdminApi("upload.create");
  if (isAuthFailure(auth)) return auth.error;

  const { id } = await params;
  const body = completeSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const session = await prisma.uploadSession.findUnique({ where: { id } });
  if (!session || session.uploadedById !== auth.session.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (session.status !== UploadStatus.CREATED && session.status !== UploadStatus.UPLOADING) {
    return NextResponse.json({ error: "invalid_status", status: session.status }, { status: 409 });
  }

  if (session.expiresAt < new Date()) {
    await prisma.uploadSession.update({
      where: { id: session.id },
      data: { status: UploadStatus.EXPIRED },
    });
    return NextResponse.json({ error: "session_expired" }, { status: 410 });
  }

  const env = loadEnv();

  if (session.multipartUploadId) {
    if (!body.data.parts?.length) {
      return NextResponse.json({ error: "multipart_parts_required" }, { status: 400 });
    }
    if (session.partCount && body.data.parts.length !== session.partCount) {
      return NextResponse.json(
        {
          error: "part_count_mismatch",
          expected: session.partCount,
          actual: body.data.parts.length,
        },
        { status: 400 },
      );
    }

    try {
      await completeMultipartUpload({
        bucket: env.S3_BUCKET_QUARANTINE,
        objectKey: session.objectKey,
        uploadId: session.multipartUploadId,
        parts: body.data.parts,
      });
    } catch {
      return NextResponse.json({ error: "multipart_complete_failed" }, { status: 400 });
    }
  }

  const head = await headObject(env.S3_BUCKET_QUARANTINE, session.objectKey);
  if (!head) {
    if (session.multipartUploadId) {
      await abortMultipartUpload({
        bucket: env.S3_BUCKET_QUARANTINE,
        objectKey: session.objectKey,
        uploadId: session.multipartUploadId,
      }).catch(() => undefined);
    }
    return NextResponse.json({ error: "object_not_found" }, { status: 400 });
  }

  if (session.expectedSize && head.size !== session.expectedSize) {
    return NextResponse.json(
      { error: "size_mismatch", expected: session.expectedSize.toString(), actual: head.size.toString() },
      { status: 400 },
    );
  }

  const release = await prisma.release.findUnique({ where: { id: body.data.releaseId } });
  if (!release) {
    return NextResponse.json({ error: "release_not_found" }, { status: 404 });
  }

  const { clientIp, forwardedFor } = extractClientIp(request.headers);

  const result = await prisma.$transaction(async (tx) => {
    await tx.uploadSession.update({
      where: { id: session.id },
      data: { status: UploadStatus.COMPLETED, completedAt: new Date() },
    });

    const otaPackage = await tx.otaPackage.create({
      data: {
        releaseId: release.id,
        packageType: body.data.packageType,
        sourceIncremental: body.data.sourceIncremental,
        targetIncremental: release.incrementalBuild,
        objectKey: session.objectKey,
        originalFilename: body.data.filename,
        byteSize: head.size,
        uploadedById: auth.session.userId,
      },
    });

    const validationJob = await tx.validationJob.create({
      data: {
        uploadSessionId: session.id,
        status: ValidationStatus.PENDING,
      },
    });

    await tx.release.update({
      where: { id: release.id },
      data: {
        status: ReleaseStatus.VALIDATING,
      },
    });

    return { otaPackage, validationJob };
  });

  await enqueueValidationJob({
    validationJobId: result.validationJob.id,
    uploadSessionId: session.id,
  });

  await writeAudit({
    actorId: auth.session.userId,
    action: "upload.session.complete",
    targetType: "UploadSession",
    targetId: session.id,
    metadata: {
      releaseId: release.id,
      packageId: result.otaPackage.id,
      validationJobId: result.validationJob.id,
      multipart: Boolean(session.multipartUploadId),
      partCount: session.partCount,
    },
    clientIp,
    forwardedFor,
    result: "success",
  });

  return NextResponse.json({
    ok: true,
    packageId: result.otaPackage.id,
    validationJobId: result.validationJob.id,
  });
}
