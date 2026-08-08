const HINTS: Record<string, string> = {
  DRAFT: "مسودة — ارفع حزمة OTA من قسم «رفع الحزم».",
  QUARANTINED: "التحقق فشل — راجع الحزمة وأعد الرفع.",
  VALIDATING: "جاري التحقق من الحزمة في Worker… سيتم التحديث تلقائياً.",
  VALIDATED: "تم التحقق — بانتظار الموافقات.",
  PENDING_APPROVAL: "جاهز للموافقة — يتطلب موافقة المسؤول.",
  APPROVED: "موافق عليه — اضغط «نشر» لنشر الحزمة وملف metadata على الخادم.",
  PUBLISHED: "منشور — متاح للأجهزة.",
  PAUSED: "متوقف مؤقتاً.",
  REVOKED: "ملغى.",
};

export function releaseStatusHint(status: string): string {
  return HINTS[status] ?? status;
}
