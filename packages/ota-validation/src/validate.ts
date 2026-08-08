import { headObject, streamObjectSha256 } from "@custom-os-ota/object-storage";
import {
  ANDROID_OTA_METADATA_PATH,
  metadataDeviceCodename,
  metadataSourceIncremental,
  metadataTargetIncremental,
  parseAndroidOtaMetadata,
  type AndroidOtaMetadata,
} from "./android-metadata.js";
import { readZipEntryByName, validateZipPrefix } from "./zip-read.js";

export type ValidateOtaPackageInput = {
  bucket: string;
  objectKey: string;
  expectedSize: bigint | null;
  maxBytes: number;
  expectedCodename: string;
  expectedTargetIncremental: string;
  expectedSourceIncremental?: string | null;
  packageType: "FULL" | "INCREMENTAL";
};

export type ValidationChecks = {
  objectExists: boolean;
  sizeWithinLimit: boolean;
  sizeMatches: boolean;
  zipPrefixValid: boolean;
  sha256Computed: boolean;
  metadataPresent: boolean;
  codenameMatches: boolean;
  targetIncrementalMatches: boolean;
  sourceIncrementalMatches: boolean | null;
  signatureValid: boolean | null;
};

export type OtaValidationReport = {
  objectKey: string;
  byteSize: string | null;
  expectedSize: string | null;
  sha256: string | null;
  extractedMetadata: AndroidOtaMetadata | null;
  checks: ValidationChecks;
  errors: string[];
};

export type OtaValidationResult = {
  passed: boolean;
  summary: string;
  report: OtaValidationReport;
};

export async function validateOtaPackage(input: ValidateOtaPackageInput): Promise<OtaValidationResult> {
  const errors: string[] = [];
  const checks: ValidationChecks = {
    objectExists: false,
    sizeWithinLimit: false,
    sizeMatches: false,
    zipPrefixValid: false,
    sha256Computed: false,
    metadataPresent: false,
    codenameMatches: false,
    targetIncrementalMatches: false,
    sourceIncrementalMatches: null,
    signatureValid: null,
  };

  const head = await headObject(input.bucket, input.objectKey);
  if (!head) {
    errors.push("object_not_found");
    return buildResult(input, checks, errors, null, null);
  }

  checks.objectExists = true;
  const byteSize = head.size;
  checks.sizeWithinLimit = byteSize <= BigInt(input.maxBytes);
  if (!checks.sizeWithinLimit) {
    errors.push("file_exceeds_max_bytes");
  }

  checks.sizeMatches =
    input.expectedSize == null || byteSize === input.expectedSize;
  if (!checks.sizeMatches) {
    errors.push("size_mismatch");
  }

  try {
    checks.zipPrefixValid = await validateZipPrefix(input.bucket, input.objectKey);
  } catch {
    checks.zipPrefixValid = false;
  }
  if (!checks.zipPrefixValid) {
    errors.push("invalid_zip_prefix");
  }

  let sha256: string | null = null;
  try {
    sha256 = await streamObjectSha256(input.bucket, input.objectKey);
    checks.sha256Computed = true;
  } catch {
    errors.push("sha256_failed");
  }

  let extractedMetadata: AndroidOtaMetadata | null = null;
  try {
    const metadataBuf = await readZipEntryByName(
      input.bucket,
      input.objectKey,
      byteSize,
      ANDROID_OTA_METADATA_PATH,
    );
    if (!metadataBuf) {
      errors.push("android_metadata_missing");
    } else {
      extractedMetadata = parseAndroidOtaMetadata(metadataBuf.toString("utf8"));
      checks.metadataPresent = Object.keys(extractedMetadata).length > 0;
      if (!checks.metadataPresent) {
        errors.push("android_metadata_empty");
      } else {
        const codename = metadataDeviceCodename(extractedMetadata);
        checks.codenameMatches = codename === input.expectedCodename;
        if (!checks.codenameMatches) {
          errors.push(`codename_mismatch:expected=${input.expectedCodename},got=${codename ?? "null"}`);
        }

        const targetInc = metadataTargetIncremental(extractedMetadata);
        checks.targetIncrementalMatches = targetInc === input.expectedTargetIncremental;
        if (!checks.targetIncrementalMatches) {
          errors.push(
            `target_incremental_mismatch:expected=${input.expectedTargetIncremental},got=${targetInc ?? "null"}`,
          );
        }

        if (input.packageType === "INCREMENTAL") {
          const sourceInc = metadataSourceIncremental(extractedMetadata);
          checks.sourceIncrementalMatches = sourceInc === input.expectedSourceIncremental;
          if (!checks.sourceIncrementalMatches) {
            errors.push(
              `source_incremental_mismatch:expected=${input.expectedSourceIncremental ?? "null"},got=${sourceInc ?? "null"}`,
            );
          }
        }
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "metadata_extract_failed");
  }

  const criticalChecks = [
    checks.objectExists,
    checks.sizeWithinLimit,
    checks.sizeMatches,
    checks.zipPrefixValid,
    checks.sha256Computed,
    checks.metadataPresent,
    checks.codenameMatches,
    checks.targetIncrementalMatches,
    input.packageType === "INCREMENTAL" ? checks.sourceIncrementalMatches === true : true,
  ];
  const passed = criticalChecks.every(Boolean) && errors.length === 0;

  return buildResult(input, checks, errors, byteSize, sha256, extractedMetadata, passed);
}

function buildResult(
  input: ValidateOtaPackageInput,
  checks: ValidationChecks,
  errors: string[],
  byteSize: bigint | null,
  sha256: string | null,
  extractedMetadata: AndroidOtaMetadata | null = null,
  passed = false,
): OtaValidationResult {
  const summary = passed
    ? "OTA package validated (SHA-256, ZIP metadata, device/build identity)"
    : errors.length > 0
      ? `Validation failed: ${errors[0]}`
      : "Validation failed";

  return {
    passed,
    summary,
    report: {
      objectKey: input.objectKey,
      byteSize: byteSize?.toString() ?? null,
      expectedSize: input.expectedSize?.toString() ?? null,
      sha256,
      extractedMetadata,
      checks,
      errors,
    },
  };
}
