"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CopyCodeBlock from "@/components/copy-code-block";
import StatusBadge from "@/components/status-badge";
import {
  isValidEpochSeconds,
  isValidIncremental,
  suggestBuildDatetime,
  suggestBuildNumber,
} from "@/lib/suggest-build-numbers";

type ReleaseOption = {
  id: string;
  versionLabel: string;
  incrementalBuild: string;
  postTimestamp: string | null;
  channelKey: string;
  status: string;
  codename: string;
  deviceDisplayName: string;
  publishedAt: string | null;
};

const MANUAL_VALUE = "__manual__";

function sortReleases(list: ReleaseOption[]): ReleaseOption[] {
  return [...list].sort((a, b) => {
    if (a.status === "PUBLISHED" && b.status !== "PUBLISHED") return -1;
    if (b.status === "PUBLISHED" && a.status !== "PUBLISHED") return 1;
    return b.incrementalBuild.localeCompare(a.incrementalBuild);
  });
}

function releaseLabel(r: ReleaseOption): string {
  return `${r.versionLabel} — ${r.codename} / ${r.channelKey} — ${r.incrementalBuild}`;
}

export default function BuildFromExistingTab() {
  const [releases, setReleases] = useState<ReleaseOption[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");
  const [selectedId, setSelectedId] = useState<string>("");

  const [codename, setCodename] = useState("");
  const [oldIncremental, setOldIncremental] = useState("");
  const [oldTimestamp, setOldTimestamp] = useState("");
  const [selectedMeta, setSelectedMeta] = useState<ReleaseOption | null>(null);

  useEffect(() => {
    fetch("/api/admin/releases")
      .then((res) => {
        if (!res.ok) throw new Error("fail");
        return res.json() as Promise<{ releases: ReleaseOption[] }>;
      })
      .then((data) => {
        const sorted = sortReleases(data.releases);
        setReleases(sorted);
        const published = sorted.find((r) => r.status === "PUBLISHED");
        const first = published ?? sorted[0];
        if (first) {
          applyRelease(first);
          setSelectedId(first.id);
        } else {
          setSelectedId(MANUAL_VALUE);
        }
        setLoadState("ok");
      })
      .catch(() => setLoadState("error"));
  }, []);

  function applyRelease(r: ReleaseOption) {
    setSelectedMeta(r);
    setCodename(r.codename);
    setOldIncremental(r.incrementalBuild);
    setOldTimestamp(r.postTimestamp ?? "");
  }

  function onReleasePick(id: string) {
    setSelectedId(id);
    if (id === MANUAL_VALUE) {
      setSelectedMeta(null);
      return;
    }
    const r = releases.find((x) => x.id === id);
    if (r) applyRelease(r);
  }

  const newIncremental = useMemo(
    () => (oldIncremental ? suggestBuildNumber(oldIncremental) : null),
    [oldIncremental],
  );
  const newTimestamp = useMemo(
    () => suggestBuildDatetime(oldTimestamp),
    [oldTimestamp],
  );

  const oldOk = isValidIncremental(oldIncremental);
  const newOk = newIncremental !== null;
  const tsOk = !oldTimestamp.trim() || isValidEpochSeconds(oldTimestamp);
  const manualMode = selectedId === MANUAL_VALUE;
  const tsReadOnly = !manualMode && selectedMeta != null && selectedMeta.postTimestamp != null;
  const fieldsReadOnly = !manualMode && selectedMeta != null;

  const buildIdNew = newOk
    ? `CUSTOM_OS.${codename}.17.${newIncremental}`
    : "CUSTOM_OS.{codename}.17.{BUILD_NUMBER}";

  return (
    <div className="guide-page">
      <p className="guide-intro">
        هذا المسار لـ<strong> إصدار OTA جديد</strong> يبني على نسخة منشورة (أو مسجّلة) سابقاً.
        اختر الإصدار من القائمة → اقتراح تلقائي للأرقام الجديدة → انسخ الأوامر إلى سيرفر البناء.
      </p>

      <section className="guide-section admin-panel">
        <h2 className="guide-section-title">
          <span className="guide-step-num mono">A</span> الإصدار المرجعي (القديم)
        </h2>
        <p className="muted">
          اختر إصداراً من لوحة OTA (المنشورة أولاً)، أو «إدخال يدوي» إذا لم يُسجّل بعد.
        </p>

        <div className="form-field guide-release-picker">
          <label htmlFor="bf-release-select">الإصدار الأساس</label>
          {loadState === "loading" ? (
            <p className="muted mono">loading releases…</p>
          ) : loadState === "error" ? (
            <p className="error">تعذر تحميل الإصدارات — استخدم الإدخال اليدوي.</p>
          ) : (
            <select
              id="bf-release-select"
              className="select-field"
              value={selectedId}
              onChange={(e) => onReleasePick(e.target.value)}
            >
              {releases.length === 0 ? (
                <option value={MANUAL_VALUE}>— لا توجد إصدارات — إدخال يدوي</option>
              ) : (
                <>
                  {releases.map((r) => (
                    <option key={r.id} value={r.id}>
                      {releaseLabel(r)} [{r.status}]
                    </option>
                  ))}
                  <option value={MANUAL_VALUE}>— إدخال يدوي —</option>
                </>
              )}
            </select>
          )}
        </div>

        {selectedMeta && !manualMode ? (
          <div className="guide-selected-release">
            <div className="guide-selected-release-head">
              <strong>{selectedMeta.versionLabel}</strong>
              <StatusBadge status={selectedMeta.status} />
            </div>
            <p className="muted">
              {selectedMeta.deviceDisplayName} · <code>{selectedMeta.codename}</code> · قناة{" "}
              <code>{selectedMeta.channelKey}</code>
              {selectedMeta.publishedAt ? (
                <>
                  {" "}
                  · نُشر{" "}
                  {new Date(selectedMeta.publishedAt).toLocaleString("ar-SY", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </>
              ) : null}
            </p>
            <Link className="table-link" href={`/admin/releases/${selectedMeta.id}`}>
              عرض تفاصيل الإصدار ←
            </Link>
          </div>
        ) : null}

        <div className="guide-builder-form">
          <div className="form-field">
            <label htmlFor="bf-codename">Codename (DEVICE)</label>
            <input
              id="bf-codename"
              className="input-terminal"
              value={codename}
              onChange={(e) => setCodename(e.target.value.trim().toLowerCase())}
              placeholder="komodo"
              spellCheck={false}
              readOnly={fieldsReadOnly}
            />
          </div>
          <div className="form-field">
            <label htmlFor="bf-old-inc">BUILD_NUMBER القديم (Incremental)</label>
            <input
              id="bf-old-inc"
              className="input-terminal"
              value={oldIncremental}
              onChange={(e) => setOldIncremental(e.target.value.replace(/\s/g, ""))}
              placeholder="2026072900"
              inputMode="numeric"
              spellCheck={false}
              readOnly={fieldsReadOnly}
            />
            {!oldOk && oldIncremental.length > 0 ? (
              <p className="error guide-field-hint">صيغة متوقعة: YYYYMMDDxx (10 أرقام)</p>
            ) : null}
          </div>
          <div className="form-field">
            <label htmlFor="bf-old-ts">Post timestamp القديم (UTC ثوانٍ)</label>
            <input
              id="bf-old-ts"
              className="input-terminal"
              value={oldTimestamp}
              onChange={(e) => setOldTimestamp(e.target.value.replace(/\s/g, ""))}
              placeholder="1785291770"
              inputMode="numeric"
              spellCheck={false}
              readOnly={tsReadOnly}
            />
            {!tsOk ? <p className="error guide-field-hint">timestamp غير صالح</p> : null}
            {selectedMeta && !selectedMeta.postTimestamp && !manualMode ? (
              <p className="guide-field-hint muted">هذا الإصدار بلا postTimestamp — أدخله يدوياً.</p>
            ) : null}
          </div>
        </div>

        {manualMode ? (
          <p className="guide-note muted">
            <span className="mono prompt">{">"}</span> وضع الإدخال اليدوي — للبناء على إصدار غير
            مسجّل في لوحة OTA.
          </p>
        ) : null}

        <CopyCodeBlock
          label="قراءة الإصدار الحالي من جهاز متصل"
          code={`adb shell getprop ro.product.device
# ${codename || "← codename"}

adb shell getprop ro.build.version.incremental
# ${oldOk ? oldIncremental : "← BUILD_NUMBER القديم"}

adb shell getprop ro.build.date.utc
# ${oldTimestamp || "← post-timestamp القديم"}`}
        />
      </section>

      {newOk && codename ? (
        <section className="guide-section admin-panel guide-suggest-panel">
          <h2 className="guide-section-title">
            <span className="guide-step-num mono">B</span> الأرقام المقترحة للبناء الجديد
          </h2>

          <div className="guide-suggest-grid">
            <div className="guide-suggest-card">
              <span className="mono guide-suggest-label">OLD_BUILD_NUMBER</span>
              <code className="guide-suggest-value">{oldIncremental}</code>
              <span className="muted guide-suggest-hint">مصدر incremental OTA</span>
            </div>
            <div className="guide-suggest-arrow mono" aria-hidden>
              →
            </div>
            <div className="guide-suggest-card highlight">
              <span className="mono guide-suggest-label">BUILD_NUMBER (جديد)</span>
              <code className="guide-suggest-value">{newIncremental}</code>
              <span className="muted guide-suggest-hint">
                {oldIncremental.slice(0, 8) === newIncremental.slice(0, 8)
                  ? "نفس اليوم — زيادة suffix (+1)"
                  : "يوم UTC جديد — YYYYMMDD00"}
              </span>
            </div>
            <div className="guide-suggest-card highlight">
              <span className="mono guide-suggest-label">BUILD_DATETIME (جديد)</span>
              <code className="guide-suggest-value">{newTimestamp}</code>
              <span className="muted guide-suggest-hint">UTC الآن — يجب أن يكون أكبر من القديم</span>
            </div>
          </div>

          <p className="guide-note muted">
            <span className="mono prompt">{">"}</span> يمكنك تعديل الأرقام يدوياً في الأوامر أدناه
            قبل النسخ — لكن يجب أن يبقى BUILD_NUMBER الجديد أحدث من المنشور.
          </p>
        </section>
      ) : null}

      <section className="guide-section admin-panel">
        <h2 className="guide-section-title">
          <span className="guide-step-num mono">C</span> آلية البناء (GrapheneOS / CUSTOM_OS)
        </h2>
        <ol className="guide-ordered-list">
          <li>
            <strong>بناء تزايدي على شجرة قديمة</strong> (أسرع للتطوير): تبدأ من{" "}
            <code>target_files</code> أو شجرة <code>out/</code> للإصدار القديم، تطبّق التغييرات،
            ثم release جديد.
          </li>
          <li>
            <strong>بناء نظيف للإنتاج</strong>: احذف <code>out/</code> (أو استخدم شجرة جديدة)،
            صدّر <code>OLD_BUILD_NUMBER</code> و <code>BUILD_NUMBER</code>، ثم pipeline كامل +
            <code>generate-release.sh</code>.
          </li>
          <li>
            بعد التوقيع: zip كامل + (اختياري) incremental من القديم → الجديد عبر{" "}
            <code>generate_delta.sh</code>.
          </li>
          <li>
            في لوحة OTA: إصدار جديد بالحقول من metadata → رفع FULL (+ INCREMENTAL) → موافقة →
            نشر.
          </li>
        </ol>
      </section>

      {newOk && codename ? (
        <>
          <section className="guide-section admin-panel">
            <h2 className="guide-section-title">
              <span className="guide-step-num mono">D</span> أوامر سيرفر البناء — انسخ ونفّذ
            </h2>

            <CopyCodeBlock
              label="1 — تهيئة المتغيرات (قبل envsetup / compile)"
              code={`cd /path/to/CUSTOM_OS-source
export DEVICE=${codename}
export OFFICIAL_BUILD=true

# الإصدار المرجعي (المثبّت على الأجهزة أو المنشور)
export OLD_BUILD_NUMBER=${oldIncremental}

# الإصدار الجديد المقترح
export BUILD_NUMBER=${newIncremental}
export BUILD_DATETIME=${newTimestamp}

source script/envsetup.sh
echo "OLD=$OLD_BUILD_NUMBER NEW=$BUILD_NUMBER TS=$BUILD_DATETIME"`}
            />

            <CopyCodeBlock
              label="2 — بناء release (بعد target-files-package)"
              code={`# GrapheneOS — ينتج OTA + factory + metadata
script/generate-release.sh ${codename} ${newIncremental}

# المخرجات:
# releases/${newIncremental}/release-${codename}-${newIncremental}/
#   ${codename}-ota_update-${newIncremental}.zip
#   ${codename}-factory-${newIncremental}.zip`}
            />

            <CopyCodeBlock
              label="3 — incremental من الإصدار القديم (اختياري — أصغر للتحميل)"
              code={`# يتطلب target_files موقّعة للإصدارين
script/generate_delta.sh ${codename} ${oldIncremental} ${newIncremental}

# ينتج:
# ${codename}-incremental-${oldIncremental}-${newIncremental}.zip`}
            />

            <CopyCodeBlock
              label="4 — التحقق من metadata قبل الرفع"
              code={`unzip -p ${codename}-ota_update-${newIncremental}.zip META-INF/com/android/metadata | grep -E '^(pre-device|post-build|post-build-incremental|post-timestamp)='

# متوقع:
# pre-device=${codename}
# post-build-incremental=${newIncremental}
# post-timestamp=${newTimestamp}`}
            />
          </section>

          <section className="guide-section admin-panel">
            <h2 className="guide-section-title">
              <span className="guide-step-num mono">E</span> لوحة OTA — بعد البناء
            </h2>

            <CopyCodeBlock
              label="حقول «إصدار جديد» في /admin/releases"
              code={`الجهاز:           ${codename}
Incremental:       ${newIncremental}
Post timestamp:    ${newTimestamp}
Build ID:           ${buildIdNew}
قناة التحديث:     ${selectedMeta?.channelKey ?? "alpha"} | beta | stable`}
            />

            <CopyCodeBlock
              label="رفع FULL في /admin/uploads"
              code={`نوع الحزمة:       FULL
الملف:              ${codename}-ota_update-${newIncremental}.zip`}
            />

            <CopyCodeBlock
              label="رفع INCREMENTAL (من الإصدار القديم)"
              code={`نوع الحزمة:       INCREMENTAL
Incremental المصدر: ${oldIncremental}
الملف:              ${codename}-incremental-${oldIncremental}-${newIncremental}.zip`}
            />

            <CopyCodeBlock
              label="metadata بعد النشر (مثال alpha)"
              code={`${newIncremental} ${newTimestamp} ${codename} ${selectedMeta?.channelKey ?? "alpha"}`}
            />

            <div className="guide-link-grid guide-actions">
              <Link href="/admin/releases" className="guide-quick-link">
                <span className="mono">releases</span>
                <span>إنشاء إصدار</span>
              </Link>
              <Link href="/admin/uploads" className="guide-quick-link">
                <span className="mono">uploads</span>
                <span>رفع الحزم</span>
              </Link>
            </div>
          </section>
        </>
      ) : (
        <section className="guide-section admin-panel">
          <p className="error">
            {releases.length === 0 && loadState === "ok"
              ? "لا توجد إصدارات — سجّل جهازاً وأنشئ إصداراً، أو استخدم الإدخال اليدوي."
              : "اختر إصداراً أو أدخل BUILD_NUMBER بصيغة YYYYMMDDxx لعرض الاقتراح والأوامر."}
          </p>
        </section>
      )}
    </div>
  );
}
