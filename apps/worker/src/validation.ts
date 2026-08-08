import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { loadEnv } from "@custom-os-ota/configuration";
import {
  prisma,
  ReleaseStatus,
  ValidationStatus,
} from "@custom-os-ota/database";
import { headObject } from "@custom-os-ota/object-storage";
import { createLogger } from "@custom-os-ota/observability";
import type { ValidationJobPayload } from "./validation-types.js";

const log = createLogger("worker");

async function processValidation(payload: ValidationJobPayload): Promise<{ ok: boolean; summary: string }> {
  const env = loadEnv();

  const job = await prisma.validationJob.findUnique({
    where: { id: payload.validationJobId },
    include: {
      uploadSession: true,
      result: true,
    },
  });

  if (!job) {
    return { ok: false, summary: "validation job not found" };
  }

  await prisma.validationJob.update({
    where: { id: job.id },
    data: { status: ValidationStatus.RUNNING, startedAt: new Date() },
  });

  const head = await headObject(env.S3_BUCKET_QUARANTINE, job.uploadSession.objectKey);
  const passed = head != null && (!job.uploadSession.expectedSize || head.size === job.uploadSession.expectedSize);

  const report = {
    objectKey: job.uploadSession.objectKey,
    byteSize: head?.size.toString() ?? null,
    expectedSize: job.uploadSession.expectedSize?.toString() ?? null,
    checks: {
      objectExists: head != null,
      sizeMatches: passed,
    },
  };

  const summary = passed ? "Package present in quarantine; size check passed" : "Validation failed";

  await prisma.$transaction(async (tx) => {
    await tx.validationResult.create({
      data: {
        jobId: job.id,
        passed,
        reportJson: report,
        reportSummary: summary,
      },
    });

    await tx.validationJob.update({
      where: { id: job.id },
      data: {
        status: passed ? ValidationStatus.PASSED : ValidationStatus.FAILED,
        finishedAt: new Date(),
      },
    });

    const otaPackage = await tx.otaPackage.findFirst({
      where: { objectKey: job.uploadSession.objectKey },
    });

    if (otaPackage) {
      await tx.otaPackage.update({
        where: { id: otaPackage.id },
        data: {
          validationReport: report,
          sha256: passed ? "pending-stage4" : null,
          signatureValid: passed ? null : false,
        },
      });

      await tx.release.update({
        where: { id: otaPackage.releaseId },
        data: {
          status: passed ? ReleaseStatus.PENDING_APPROVAL : ReleaseStatus.QUARANTINED,
          validatedAt: passed ? new Date() : undefined,
        },
      });
    }
  });

  return { ok: passed, summary };
}

export function startValidationWorker(connection: Redis, concurrency: number): Worker<ValidationJobPayload> {
  const worker = new Worker<ValidationJobPayload>(
    "ota-validation",
    async (bullJob) => {
      log.info("validation.job.received", {
        event: "validation.job.received",
        metadata: { jobId: bullJob.id, validationJobId: bullJob.data.validationJobId },
      });

      const result = await processValidation(bullJob.data);

      log.info("validation.job.finished", {
        event: "validation.job.finished",
        metadata: { jobId: bullJob.id, ok: result.ok, summary: result.summary },
        result: result.ok ? "success" : "failure",
      });

      return result;
    },
    { connection, concurrency },
  );

  worker.on("failed", (job, err) => {
    log.error("validation.job.failed", {
      event: "validation.job.failed",
      metadata: { jobId: job?.id, error: err.message },
      result: "failure",
    });
  });

  return worker;
}
