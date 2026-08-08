export type AdminNavItem = {
  label: string;
  href: string;
  description?: string;
  module?: string;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { label: "نظرة عامة", href: "/admin", description: "ملخص المنصة", module: "overview" },
  { label: "دليل OTA", href: "/admin/guide", description: "من البناء إلى الرفع", module: "guide" },
  { label: "الإصدارات", href: "/admin/releases", description: "إدارة إصدارات OTA", module: "releases" },
  { label: "رفع الحزم", href: "/admin/uploads", description: "رفع حزم التحديث", module: "uploads" },
  { label: "مجموعات الأجهزة", href: "/admin/device-groups", description: "تجميع الأجهزة", module: "groups" },
  { label: "نماذج الأجهزة", href: "/admin/devices", description: "تسجيل أجهزة Pixel", module: "devices" },
  { label: "النشر التدريجي", href: "/admin/rollouts", description: "النشر بين القنوات", module: "rollouts" },
  { label: "الأخطاء", href: "/admin/errors", description: "سجل الأخطاء", module: "errors" },
  { label: "التدقيق", href: "/admin/audit", description: "سجل التدقيق", module: "audit" },
  { label: "الأمان", href: "/admin/security", description: "أحداث الأمان", module: "security" },
  { label: "صحة النظام", href: "/admin/system-health", description: "حالة الخدمات", module: "health" },
  { label: "الإعدادات", href: "/admin/settings", description: "إعدادات المنصة", module: "settings" },
];
