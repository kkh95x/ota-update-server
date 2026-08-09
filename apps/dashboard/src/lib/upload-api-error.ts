export type UploadErrorDetails = {
  /** Arabic summary for admins */
  summary: string;
  code: string;
  httpStatus: number;
  message?: string;
  hint?: string;
  extra?: Record<string, unknown>;
};

type ApiErrorBody = {
  error?: string;
  message?: string;
  hint?: string;
  expected?: number | string;
  actual?: number | string;
  found?: number;
  partsOnServer?: number;
  status?: string;
  details?: unknown;
};

function completeErrorSummary(code: string, body: ApiErrorBody, httpStatus: number): string {
  switch (code) {
    case "multipart_parts_missing_on_server":
      return `فشل إتمام الرفع — MinIO استلم ${body.found ?? 0} جزءاً من ${body.expected ?? "?"} فقط.`;
    case "multipart_complete_failed":
      return `فشل دمج الأجزاء في MinIO (${body.partsOnServer ?? "?"} جزء مسجّل على الخادم).`;
    case "multipart_parts_required":
      return "فشل إتمام الرفع — لم تُرسل قائمة الأجزاء من المتصفح.";
    case "part_count_mismatch":
      return `فشل إتمام الرفع — عدد الأجزاء غير متطابق (متوقع ${body.expected}، وصل ${body.actual}).`;
    case "size_mismatch":
      return `فشل إتمام الرفع — حجم الملف على MinIO (${body.actual}) ≠ المتوقع (${body.expected}).`;
    case "object_not_found":
      return "فشل إتمام الرفع — الملف غير موجود في MinIO بعد الرفع.";
    case "session_expired":
      return "انتهت جلسة الرفع — أنشئ جلسة جديدة.";
    case "multipart_list_failed":
      return "فشل إتمام الرفع — تعذر قراءة الأجزاء من MinIO.";
    case "invalid_status":
      return `فشل إتمام الرفع — حالة الجلسة: ${body.status ?? "غير صالحة"}.`;
    case "release_not_found":
      return "فشل إتمام الرفع — الإصدار غير موجود.";
    case "not_found":
      return "فشل إتمام الرفع — جلسة الرفع غير موجودة.";
    default:
      if (httpStatus >= 500) {
        return "فشل إتمام الرفع — خطأ في الخادم (قاعدة البيانات / Redis / MinIO).";
      }
      return `فشل إتمام الرفع (${code}).`;
  }
}

function sessionErrorSummary(code: string, httpStatus: number): string {
  switch (code) {
    case "file_too_large":
      return "حجم الملف أكبر من الحد المسموح (OTA_MAX_PACKAGE_BYTES).";
    case "release_not_found":
      return "الإصدار غير موجود أو منشور/ملغى.";
    case "source_incremental_required":
      return "حزمة INCREMENTAL تتطلب incremental المصدر.";
    case "invalid_request":
      return "طلب غير صالح — تحقق من الحقول.";
    default:
      if (httpStatus >= 500) {
        return "فشل إنشاء جلسة الرفع — خطأ في الخادم.";
      }
      return `فشل إنشاء جلسة الرفع (${code}).`;
  }
}

export function uploadErrorFromComplete(httpStatus: number, body: ApiErrorBody): UploadErrorDetails {
  const code = body.error ?? "unknown";
  return {
    summary: completeErrorSummary(code, body, httpStatus),
    code,
    httpStatus,
    message: body.message,
    hint:
      body.hint ??
      (code === "multipart_parts_missing_on_server"
        ? "nginx: location ^~ /s3/ ثم docker compose up -d --force-recreate nginx"
        : undefined),
    extra: {
      expected: body.expected,
      actual: body.actual,
      found: body.found,
      partsOnServer: body.partsOnServer,
      status: body.status,
    },
  };
}

export function uploadErrorFromSession(httpStatus: number, body: ApiErrorBody): UploadErrorDetails {
  const code = body.error ?? "unknown";
  return {
    summary: sessionErrorSummary(code, httpStatus),
    code,
    httpStatus,
    message: typeof body.message === "string" ? body.message : undefined,
    extra: body.details ? { details: body.details } : undefined,
  };
}

export async function readUploadApiError(
  res: Response,
  phase: "session" | "complete",
): Promise<UploadErrorDetails> {
  const httpStatus = res.status;
  let body: ApiErrorBody = {};

  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    body = { error: "response_not_json" };
  }

  return phase === "complete"
    ? uploadErrorFromComplete(httpStatus, body)
    : uploadErrorFromSession(httpStatus, body);
}

export function uploadErrorFromTransport(err: Error): UploadErrorDetails {
  if (err.message === "upload_missing_etag") {
    return {
      summary: "فشل رفع جزء — MinIO لم يُرجع ETag.",
      code: "upload_missing_etag",
      httpStatus: 0,
      hint: "nginx /s3/: Access-Control-Expose-Headers: ETag",
    };
  }
  if (err.message === "upload_failed_413") {
    return {
      summary: "حجم الملف أكبر من حد nginx.",
      code: "upload_failed_413",
      httpStatus: 413,
      hint: "ota-locations.conf: client_max_body_size 0 على /s3/",
    };
  }
  if (err.message === "upload_failed_400") {
    return {
      summary: "فشل رفع جزء (400) — توقيع الرابط أو مسار nginx.",
      code: "upload_failed_400",
      httpStatus: 400,
      hint: "location ^~ /s3/ + أعد بناء dashboard",
    };
  }
  if (err.message.startsWith("upload_failed_")) {
    const status = Number.parseInt(err.message.replace("upload_failed_", ""), 10);
    return {
      summary: `فشل رفع جزء (HTTP ${Number.isFinite(status) ? status : "?"})`,
      code: err.message,
      httpStatus: Number.isFinite(status) ? status : 0,
      hint: "تحقق من S3_PUBLIC_ENDPOINT و nginx /s3/",
    };
  }
  if (err.message === "upload_network_error") {
    return {
      summary: "فشل شبكة أثناء رفع جزء.",
      code: "upload_network_error",
      httpStatus: 0,
      hint: "تحقق من الاتصال و CORS",
    };
  }
  if (err.message === "upload_aborted") {
    return {
      summary: "تم إلغاء الرفع.",
      code: "upload_aborted",
      httpStatus: 0,
    };
  }

  return {
    summary: "تعذر الاتصال بالخادم.",
    code: err.message || "unknown_error",
    httpStatus: 0,
    message: err.message,
  };
}

/** @deprecated use uploadErrorFromComplete */
export function describeCompleteUploadError(status: number, body: ApiErrorBody): string {
  return uploadErrorFromComplete(status, body).summary;
}

export type { ApiErrorBody as CompleteUploadErrorBody };
