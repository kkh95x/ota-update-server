/** Arabic help text for dashboard form fields. */
export const FORM_HELP = {
  login: {
    email: "البريد الإلكتروني للمسؤول كما سُجّل عبر أمر create-admin. يُستخدم لإنشاء الجلسة فقط.",
    password: "كلمة المرور المشفّرة (Argon2). لا تُخزَّن في المتصفح — تُرسل مرة واحدة عبر HTTPS.",
  },
  device: {
    codename:
      "Codename الجهاز (مثل panther لـ Pixel 7). يجب أن يطابق Build.DEVICE في GrapheneOS. يحدد ملفات metadata على الخادم: {codename}-stable وغيرها.",
  },
  release: {
    deviceModel:
      "جهاز Pixel المفعّل مسبقاً في «نماذج الأجهزة». كل إصدار OTA مرتبط بجهاز واحد وقناة واحدة.",
    channel:
      "القناة التي يرى عليها المستخدمون التحديث: Stable للإنتاج، Beta للاختبار الواسع، Alpha للداخلي. الجهاز يفحص ملف metadata حسب القناة المختارة في Updater.",
    versionLabel:
      "اسم وصفي للمسؤولين (مثل «أغسط 2026»). للعرض في لوحة الإدارة فقط — لا يُرسل للجهاز.",
    buildId:
      "Build ID من metadata OTA (حقل post-build). يُستخدم للتحقق من توافق الحزمة مع الجهاز.",
    incrementalBuild:
      "رقم incremental من post-build (مثل 2026080100). يظهر في اسم zip وملف metadata — Updater يقارنه مع build الجهاز الحالي.",
    postTimestamp:
      "post-timestamp من metadata OTA (UTC بالثواني، مثل 1785291770). يُستخدم في سطر metadata على الخادم — Updater يقارنه مع ro.build.date.utc.",
    changelog:
      "ملخص التغييرات في هذا الإصدار. اختiاري — يُعرض في صفحة تفاصيل الإصدار.",
  },
  upload: {
    release:
      "مسودة إصدار غير منشور. يجب أن يطابق الجهاز والقناة التي بُني لها ملف zip.",
    packageType:
      "FULL: تحديث كامل (يستبدل النظام). INCREMENTAL: تحديث من build سابق محدد — أصغر حجماً لكن يتطلب incremental المصدر.",
    sourceIncremental:
      "رقم incremental للبناء المثبّت حالياً على الجهاز. Updater يطلب هذا الملف قبل FULL إن وُجد incremental.",
    file:
      "ملف zip OTA موقّع (GrapheneOS). يُرفع مباشرة إلى MinIO في منطقة الحجر، ثم Worker يتحقق من الحجم والوجود.",
  },
  approve: {
    note: "ملاحظة اختiارية تُربط بالموافقة — تظهر في سجل الموافقات وسجل التدقيق.",
  },
  settings: {
    reason:
      "سبب إيقاف أو استئناف عروض OTA للجميع. إلزامي (3 أحرف+) — يُحفظ في سجل التدقيق للمراجعة لاحقاً.",
  },
} as const;
