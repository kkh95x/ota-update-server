import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { loadEnv } from "@custom-os-ota/configuration";
import {
  prisma,
  ReleaseStatus,
  ValidationStatus,
} from "@custom-os-ota/database";
import { createLogger } from "@custom-os-ota/observability";
import { validateOtaPackage } from "@custom-os-ota/ota-validation";
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

  const otaPackage = await prisma.otaPackage.findFirst({
    where: { objectKey: job.uploadSession.objectKey },
    include: {
      release: {
        include: { deviceModel: true },
      },
    },
  });

  if (!otaPackage) {
    const report = { error: "ota_package_not_linked" };
    await prisma.$transaction(async (tx) => {
      await tx.validationResult.create({
        data: {
          jobId: job.id,
          passed: false,
          reportJson: report,
          reportSummary: "No OTA package linked to upload session",
        },
      });
      await tx.validationJob.update({
        where: { id: job.id },
        data: { status: ValidationStatus.FAILED, finishedAt: new Date() },
      });
    });
    return { ok: false, summary: "ota package not linked" };
  }

  const validation = await validateOtaPackage({
    bucket: env.S3_BUCKET_QUARANTINE,
    objectKey: job.uploadSession.objectKey,
    expectedSize: job.uploadSession.expectedSize,
    maxBytes: env.OTA_MAX_PACKAGE_BYTES,
    expectedCodename: otaPackage.release.deviceModel.codename,
    expectedTargetIncremental: otaPackage.targetIncremental,
    expectedSourceIncremental: otaPackage.sourceIncremental,
    packageType: otaPackage.packageType,
  });

  const passed = validation.passed;
  const report = validation.report;
  const summary = validation.summary;

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

    await tx.otaPackage.update({
      where: { id: otaPackage.id },
      data: {
        validationReport: report,
        sha256: report.sha256,
        signatureValid: report.checks.signatureValid,
      },
    });

    await tx.release.update({
      where: { id: otaPackage.releaseId },
      data: {
        status: passed ? ReleaseStatus.PENDING_APPROVAL : ReleaseStatus.QUARANTINED,
        validatedAt: passed ? new Date() : undefined,
      },
    });
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
