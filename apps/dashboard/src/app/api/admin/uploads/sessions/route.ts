import { NextResponse } from "next/server";
import { z } from "zod";
import { loadEnv } from "@custom-os-ota/configuration";
import { prisma, OtaPackageType, ReleaseStatus, UploadStatus } from "@custom-os-ota/database";
import { writeAudit } from "@custom-os-ota/audit";
import { extractClientIp } from "@custom-os-ota/observability";
import {
  abortMultipartUpload,
  createMultipartUpload,
  planMultipartUpload,
  presignAllUploadParts,
  presignPutObject,
  quarantineObjectKey,
} from "@custom-os-ota/object-storage";
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

  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const presignTtlSeconds = 14_400;
  const useMultipart = body.data.expectedSize >= env.OTA_UPLOAD_MULTIPART_MIN_BYTES;

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
  let multipartUploadId: string | undefined;

  try {
    if (useMultipart) {
      const { partSize, partCount } = planMultipartUpload(
        body.data.expectedSize,
        env.OTA_UPLOAD_PART_SIZE_BYTES,
      );
      multipartUploadId = await createMultipartUpload({
        bucket: env.S3_BUCKET_QUARANTINE,
        objectKey,
        contentType: "application/zip",
      });

      await prisma.uploadSession.update({
        where: { id: session.id },
        data: {
          objectKey,
          multipartUploadId,
          partSize,
          partCount,
        },
      });

      const parts = await presignAllUploadParts({
        bucket: env.S3_BUCKET_QUARANTINE,
        objectKey,
        uploadId: multipartUploadId,
        partCount,
        expiresInSeconds: presignTtlSeconds,
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
          multipart: true,
          partCount,
          partSize,
        },
        clientIp,
        forwardedFor,
        result: "success",
      });

      return NextResponse.json(
        {
          session: {
            id: session.id,
            objectKey,
            expiresAt: expiresAt.toISOString(),
            releaseId: release.id,
            packageType: body.data.packageType as OtaPackageType,
            sourceIncremental: body.data.sourceIncremental ?? null,
            filename: body.data.filename,
            expectedSize: body.data.expectedSize,
            uploadMode: "multipart" as const,
            partSize,
            partCount,
            parallelParts: env.OTA_UPLOAD_PARALLEL_PARTS,
            parts,
          },
        },
        { status: 201 },
      );
    }

    await prisma.uploadSession.update({
      where: { id: session.id },
      data: { objectKey },
    });

    const uploadUrl = await presignPutObject({
      bucket: env.S3_BUCKET_QUARANTINE,
      objectKey,
      contentType: "application/zip",
      expiresInSeconds: presignTtlSeconds,
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
        multipart: false,
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
          uploadMode: "single" as const,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (multipartUploadId) {
      await abortMultipartUpload({
        bucket: env.S3_BUCKET_QUARANTINE,
        objectKey,
        uploadId: multipartUploadId,
      }).catch(() => undefined);
    }
    await prisma.uploadSession.update({
      where: { id: session.id },
      data: { status: UploadStatus.FAILED },
    });
    throw err;
  }
}
