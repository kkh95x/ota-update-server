export const OTA_METADATA_ZIP_PATH = "META-INF/com/android/metadata";
export const OTA_ZIP_NAME_PATTERN = "{codename}-ota_update-{incremental}.zip";

export type FieldSourceHelp = {
  source: string;
  zipFile?: string;
  metadataKey?: string;
  extract?: string;
  note?: string;
};

/** Multi-line Arabic tooltip: where the dashboard field value should come from. */
export function formatFieldSourceHelp(help: FieldSourceHelp): string {
  const lines = [`من أين؟ ${help.source}`];
  if (help.zipFile) lines.push(`ملف ZIP: ${help.zipFile}`);
  if (help.metadataKey) lines.push(`حقل metadata: ${help.metadataKey}`);
  if (help.extract) lines.push(`استخراج: ${help.extract}`);
  if (help.note) lines.push(help.note);
  return lines.join("\n");
}

const OTA_EXTRACT = `unzip -p ${OTA_ZIP_NAME_PATTERN} ${OTA_METADATA_ZIP_PATH}`;

/** Arabic help text for dashboard form fields. */
export const FORM_HELP = {
  login: {
    email: "البريد الإلكتروني للمسؤول كما سُجّل عبر أمر create-admin. يُستخدم لإنشاء الجلسة فقط.",
    password: "كلمة المرور المشفّرة (Argon2). لا تُخزَّن في المتصفح — تُرسل مرة واحدة عبر HTTPS.",
  },
  device: {
    codename: formatFieldSourceHelp({
      source: "حزمة OTA (ota_update) — ليس factory",
      zipFile: OTA_ZIP_NAME_PATTERN,
      metadataKey: "pre-device → آخر segment (مثل komodo)",
      extract: OTA_EXTRACT,
      note: "يجب أن يطابق Build.DEVICE على الجهاز.",
    }),
  },
  release: {
    deviceModel: formatFieldSourceHelp({
      source: "نفس codename داخل metadata OTA",
      zipFile: OTA_ZIP_NAME_PATTERN,
      metadataKey: "pre-device (مثل google/komodo/komodo → komodo)",
      extract: OTA_EXTRACT,
      note: "سجّل الجهاز أولاً في «نماذج الأجهزة» ثم اختره هنا.",
    }),
    channel: formatFieldSourceHelp({
      source: "اختيارك في اللوحة — لا يُقرأ من ZIP",
      note:
        "عند النشر يُكتَب السطر الرابع في ملف {codename}-{channel} على الخادم (testing، alpha، beta، stable). نفس ZIP لكل القنوات.",
    }),
    versionLabel: formatFieldSourceHelp({
      source: "يدوي — للمسؤولين فقط",
      note: "لا يُقرأ من metadata ولا من ZIP. للعرض في لوحة الإدارة فقط.",
    }),
    buildId: formatFieldSourceHelp({
      source: "حزمة OTA (ota_update)",
      zipFile: OTA_ZIP_NAME_PATTERN,
      metadataKey: "post-build",
      extract: `${OTA_EXTRACT} | grep post-build`,
      note: "انسخ قيمة post-build كاملة من metadata.",
    }),
    incrementalBuild: formatFieldSourceHelp({
      source: "حزمة OTA (ota_update)",
      zipFile: OTA_ZIP_NAME_PATTERN,
      metadataKey: "post-build-incremental",
      extract: `${OTA_EXTRACT} | grep post-build-incremental`,
      note: "يظهر أيضاً في اسم ZIP وملف القناة. Worker يتحقق من تطابقه مع metadata.",
    }),
    postTimestamp: formatFieldSourceHelp({
      source: "حزمة OTA (ota_update)",
      zipFile: OTA_ZIP_NAME_PATTERN,
      metadataKey: "post-timestamp",
      extract: `${OTA_EXTRACT} | grep post-timestamp`,
      note: "UTC بالثواني — Updater يقارنه مع ro.build.date.utc.",
    }),
    changelog: formatFieldSourceHelp({
      source: "يدوي — اختياري",
      note: "لا يُقرأ من ZIP. يُعرض في صفحة تفاصيل الإصدار فقط.",
    }),
  },
  upload: {
    release:
      "مسودة إصدار غير منشور. يجب أن يطابق الجهاز والقناة التي بُني لها ملف zip.",
    packageType:
      "FULL: تحديث كامل (يستبدل النظام). INCREMENTAL: تحديث من build سابق محدد — أصغر حجماً لكن يتطلب incremental المصدر.",
    sourceIncremental: formatFieldSourceHelp({
      source: "حزمة incremental OTA فقط",
      zipFile: OTA_ZIP_NAME_PATTERN,
      metadataKey: "pre-build-incremental",
      extract: `${OTA_EXTRACT} | grep pre-build-incremental`,
      note: "incremental للبناء المثبّت حالياً على الجهاز قبل التحديث.",
    }),
    file: formatFieldSourceHelp({
      source: "مخرجات البناء — ليس factory",
      zipFile: OTA_ZIP_NAME_PATTERN,
      metadataKey: OTA_METADATA_ZIP_PATH,
      note: "ملف zip OTA موقّع. factory (boot.img، super_*.img) لا يُقبل.",
    }),
  },
  approve: {
    note: "ملاحظة اختيارية تُربط بالموافقة — تظهر في سجل الموافقات وسجل التدقيق.",
  },
  settings: {
    reason:
      "سبب إيقاف أو استئناف عروض OTA للجميع. إلزامي (3 أحرف+) — يُحفظ في سجل التدقيق للمراجعة لاحقاً.",
  },
} as const;
