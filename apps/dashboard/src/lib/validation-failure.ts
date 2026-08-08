type ValidationReportJson = {
  errors?: string[];
};

const ERROR_PREFIX_LABELS: Record<string, string> = {
  object_not_found: "الملف غير موجود في الحجر",
  file_exceeds_max_bytes: "حجم الملف يتجاوز الحد المسموح",
  size_mismatch: "حجم الملف لا يطابق ما تم رفعه",
  invalid_zip_prefix: "الملف ليس ZIP OTA صالحاً",
  sha256_failed: "فشل حساب SHA-256",
  android_metadata_missing: "ملف metadata Android مفقود داخل ZIP",
  android_metadata_empty: "ملف metadata Android فارغ",
  metadata_extract_failed: "تعذر قراءة metadata من ZIP",
  ota_package_not_linked: "الحزمة غير مرتبطة بجلسة الرفع",
};

function formatValidationError(error: string): string {
  const prefix = error.split(":")[0] ?? error;

  if (prefix === "codename_mismatch") {
    const expected = error.match(/expected=([^,]+)/)?.[1];
    const got = error.match(/got=(.+)$/)?.[1];
    if (expected && got) {
      return `codename غير متطابق (متوقع ${expected}، داخل ZIP ${got})`;
    }
    return "codename الجهاز داخل ZIP لا يطابق الإصدار";
  }

  if (prefix === "target_incremental_mismatch") {
    const expected = error.match(/expected=([^,]+)/)?.[1];
    const got = error.match(/got=(.+)$/)?.[1];
    if (expected && got) {
      return `incremental الهدف غير متطابق (متوقع ${expected}، داخل ZIP ${got})`;
    }
    return "incremental الهدف داخل ZIP لا يطابق الإصدار";
  }

  if (prefix === "source_incremental_mismatch") {
    const expected = error.match(/expected=([^,]+)/)?.[1];
    const got = error.match(/got=(.+)$/)?.[1];
    if (expected && got) {
      return `incremental المصدر غير متطابق (متوقع ${expected}، داخل ZIP ${got})`;
    }
    return "incremental المصدر داخل ZIP لا يطابق ما أدخلته";
  }

  return ERROR_PREFIX_LABELS[prefix] ?? error;
}

export function formatValidationErrors(errors: string[]): string {
  return errors.map(formatValidationError).join(" · ");
}

export function extractValidationFailureReason(
  packages: { validationReport?: unknown }[],
): string | null {
  for (const pkg of packages) {
    const report = pkg.validationReport as ValidationReportJson | null | undefined;
    if (report?.errors?.length) {
      return formatValidationErrors(report.errors);
    }
  }
  return null;
}
