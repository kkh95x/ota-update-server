import Link from "next/link";
import AdminPageHeader from "@/components/admin-page-header";
import CopyCodeBlock from "@/components/copy-code-block";

const EXAMPLE = {
  codename: "komodo",
  displayName: "Pixel 9 Pro XL",
  incremental: "2026080100",
  sourceIncremental: "2026072900",
  postTimestamp: "1785291770",
  buildId: "CUSTOM_OS.komodo.17.2026080100",
  channel: "alpha",
  versionLabel: "أغسط 2026",
} as const;

export default function GuideView({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={embedded ? "guide-page" : "admin-page admin-page-wide guide-page"}>
      {!embedded ? (
        <AdminPageHeader
          module="guide"
          title="دليل OTA — من البناء إلى الرفع"
          description="خطوات عملية: بناء النسخة على سيرفر GrapheneOS/CUSTOM_OS، استخراج الحقول، إنشاء الإصدار، ورفع الحزمة."
        />
      ) : null}

      <nav className="guide-toc admin-panel" aria-label="محتويات الدليل">
        <h2 className="guide-section-title">// مسار العمل</h2>
        <ol className="guide-toc-list">
          <li>
            <a href="#step-build">① بناء OTA على سيرفر المصدر</a>
          </li>
          <li>
            <a href="#step-version">② تحديد رقم الإصدار (BUILD_NUMBER)</a>
          </li>
          <li>
            <a href="#step-metadata">③ استخراج metadata من zip</a>
          </li>
          <li>
            <a href="#step-device">④ تسجيل نوع الجهاز</a>
          </li>
          <li>
            <a href="#step-release">⑤ إنشاء إصدار + الحقول</a>
          </li>
          <li>
            <a href="#step-upload">⑥ رفع الحزمة</a>
          </li>
          <li>
            <a href="#step-approve">⑦ موافقة ونشر</a>
          </li>
          <li>
            <a href="#step-example">⑧ مثال كامل (komodo / alpha)</a>
          </li>
        </ol>
      </nav>

      <section id="step-build" className="guide-section admin-panel">
        <h2 className="guide-section-title">
          <span className="guide-step-num mono">01</span> بناء OTA على سيرفر المصدر
        </h2>
        <p>
          يتم البناء داخل <strong>مستودع CUSTOM_OS / GrapheneOS</strong> (فرع <code>17</code>) على سيرفر
          البناء — وليس داخل مستودع <code>ota-update-server</code>. هذا المستودع يوزّع الحزم فقط بعد
          التوقيع.
        </p>
        <ul className="guide-list">
          <li>
            حدّد <strong>codename</strong> الجهاز (مثل <code>komodo</code> لـ Pixel 9 Pro XL) — يجب أن
            يطابق <code>Build.DEVICE</code> على الهاتف.
          </li>
          <li>ابنِ النسخة ووقّع حزمة OTA بمفاتيح إصدار CUSTOM_OS (ليس مفاتيح GrapheneOS الرسمية).</li>
          <li>
            الناتج المتوقع: ملف zip باسم{" "}
            <code>
              {"{codename}"}-ota_update-{"{incremental}"}.zip
            </code>{" "}
            و/أو ملفات incremental.
          </li>
        </ul>

        <CopyCodeBlock
          label="سيرفر البناء — تهيئة الهدف (مثال komodo)"
          code={`# داخل مستودع بناء CUSTOM_OS (GrapheneOS branch 17)
export DEVICE=${EXAMPLE.codename}

# تحقق من codename المدعوم
ls device/google/${EXAMPLE.codename}

# بناء وإنتاج OTA (راجع وثائق grapheneos.org/build لسيرفرك)
# عادةً: script/build + script/sign-ota أو pipeline التوقيع لديك

# بعد البناء — مسار نموذجي للحزمة الكاملة:
# out/dist/${EXAMPLE.codename}-ota_update-${EXAMPLE.incremental}.zip`}
        />

        <CopyCodeBlock
          label="توليد metadata للقنوات (GrapheneOS script)"
          code={`# من مستودع GrapheneOS/script — generate-metadata
# ينتج سطراً واحداً لكل قناة (stable, beta, alpha, testing):
# {incremental} {post-timestamp} {pre-device} {channel}

python3 generate-metadata \\
  --channel ${EXAMPLE.channel} \\
  /path/to/${EXAMPLE.codename}-ota_update-${EXAMPLE.incremental}.zip

# مثال مخرجات:
# ${EXAMPLE.incremental} ${EXAMPLE.postTimestamp} ${EXAMPLE.codename} ${EXAMPLE.channel}`}
        />

        <p className="guide-note muted">
          <span className="mono prompt">{">"}</span> Updater على الهاتف يطلب فقط ملفات ثابتة على{" "}
          <code>release.mod-syria.org</code> — لا يرسل بيانات الجهاز للخادم.
        </p>
      </section>

      <section id="step-version" className="guide-section admin-panel">
        <h2 className="guide-section-title">
          <span className="guide-step-num mono">02</span> تحديد رقم الإصدار أثناء البناء
        </h2>
        <p>
          هناك <strong>نوعان</strong> من «رقم الإصدار» — لا تخلط بينهما:
        </p>

        <div className="guide-table-wrap table-wrap">
          <table className="admin-table guide-table">
            <thead>
              <tr>
                <th>المفهوم</th>
                <th>أين يُحدَّد</th>
                <th>مثال</th>
                <th>هل يمكن تغييره لاحقاً؟</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>BUILD_NUMBER</strong> / Incremental
                </td>
                <td>
                  <strong>سيرفر البناء</strong> (GrapheneOS envsetup)
                </td>
                <td>
                  <code>{EXAMPLE.incremental}</code>
                </td>
                <td>
                  ❌ بعد البناء — مُثبَّت داخل zip و metadata. لوحة OTA تنسخ نفس القيمة فقط.
                </td>
              </tr>
              <tr>
                <td>
                  <strong>BUILD_DATETIME</strong> / Post timestamp
                </td>
                <td>سيرفر البناء</td>
                <td>
                  <code>{EXAMPLE.postTimestamp}</code>
                </td>
                <td>❌ مُثبَّت في zip — يصبح <code>ro.build.date.utc</code></td>
              </tr>
              <tr>
                <td>
                  <strong>تسمية الإصدار</strong> (versionLabel)
                </td>
                <td>لوحة الإدارة فقط</td>
                <td>{EXAMPLE.versionLabel}</td>
                <td>✅ للعرض — لا يؤثر على Updater</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="guide-subtitle mono">// تلقائي (الافتراضي)</h3>
        <p>
          عند تشغيل <code>source script/envsetup.sh</code> (GrapheneOS — وليس envsetup AOSP)، يُعيَّن{" "}
          <code>BUILD_NUMBER</code> تلقائياً:
        </p>
        <ul className="guide-list">
          <li>
            من <code>out/soong/build_number.txt</code> إن وُجد (بناء لاحق على نفس الشجرة)
          </li>
          <li>
            وإلا: <strong>YYYYMMDD00</strong> من تاريخ UTC للبناء (مثل <code>2026080400</code>)
          </li>
        </ul>

        <CopyCodeBlock
          label="عرض القيم بعد envsetup"
          code={`source script/envsetup.sh
echo "BUILD_NUMBER=$BUILD_NUMBER"
echo "BUILD_DATETIME=$BUILD_DATETIME"
# BUILD_NUMBER → post-build-incremental واسم zip
# BUILD_DATETIME → post-timestamp (ثواني UTC)`}
        />

        <h3 className="guide-subtitle mono">// يدوي — قبل البناء (موصى به للإنتاج)</h3>
        <p>
          نعم، <strong>يمكنك تحديد رقم الإصدار</strong> بتصدير المتغيرات <em>قبل</em>{" "}
          <code>lunch</code> / <code>m</code> / <code>generate-release.sh</code>:
        </p>

        <CopyCodeBlock
          label="تعيين BUILD_NUMBER و BUILD_DATETIME يدوياً"
          code={`# داخل مستودع البناء — قبل compile
export BUILD_NUMBER=${EXAMPLE.incremental}
export BUILD_DATETIME=${EXAMPLE.postTimestamp}

source script/envsetup.sh
# تحقق:
echo $BUILD_NUMBER $BUILD_DATETIME

# ثم أكمل البناء كالمعتاد…`}
        />

        <CopyCodeBlock
          label="إنتاج release رسمي (GrapheneOS script)"
          code={`# بعد target-files — BUILD_NUMBER هو الوسيط الثاني
script/generate-release.sh ${EXAMPLE.codename} ${EXAMPLE.incremental}

# المخرجات:
# releases/${EXAMPLE.incremental}/release-${EXAMPLE.codename}-${EXAMPLE.incremental}/
#   ${EXAMPLE.codename}-ota_update-${EXAMPLE.incremental}.zip
#   metadata files (testing, beta, stable, alpha)`}
        />

        <CopyCodeBlock
          label="بناء incremental (delta) من إصدار سابق"
          code={`# OLD_BUILD_NUMBER = incremental المثبّت حالياً على الأجهزة
export OLD_BUILD_NUMBER=${EXAMPLE.sourceIncremental}
export BUILD_NUMBER=${EXAMPLE.incremental}

# pipeline التوقيع عندك — ثم:
script/generate_delta.sh ${EXAMPLE.codename} ${EXAMPLE.sourceIncremental} ${EXAMPLE.incremental}
# ينتج: ${EXAMPLE.codename}-incremental-${EXAMPLE.sourceIncremental}-${EXAMPLE.incremental}.zip`}
        />

        <h3 className="guide-subtitle mono">// قواعد مهمة</h3>
        <ul className="guide-list">
          <li>
            <strong>BUILD_NUMBER الجديد يجب أن يكون أحدث</strong> من المنشور على نفس الجهاز/القناة —
            Updater يرفض إذا <code>post-timestamp</code> ≤ <code>ro.build.date.utc</code>.
          </li>
          <li>
            صيغة GrapheneOS المعتادة: <code>YYYYMMDDxx</code> (تاريخ + رقم تسلسلي لليوم، مثل{" "}
            <code>00</code>, <code>01</code>…).
          </li>
          <li>
            لإعادة إنتاج بناء قديم: استخدم نفس <code>BUILD_NUMBER</code> و{" "}
            <code>BUILD_DATETIME</code> من <code>out/build_number.txt</code> و{" "}
            <code>out/build_date.txt</code> (راجع{" "}
            <a
              className="table-link"
              href="https://grapheneos.org/build"
              target="_blank"
              rel="noopener noreferrer"
            >
              grapheneos.org/build
            </a>
            ).
          </li>
          <li>
            <strong>لا يمكن</strong> تغيير incremental من لوحة OTA — يجب أن يطابق metadata داخل zip.
          </li>
        </ul>

        <p className="guide-note muted">
          <span className="mono prompt">{">"}</span> «تسمية الإصدار» في لوحة الإدارة (مثل «أغسط 2026»)
          حرّة للمسؤولين — Incremental و Post timestamp يُنسخان حرفياً من البناء.
        </p>
      </section>

      <section id="step-metadata" className="guide-section admin-panel">
        <h2 className="guide-section-title">
          <span className="guide-step-num mono">03</span> استخراج الحقول من حزمة OTA
        </h2>
        <p>
          قبل إنشاء الإصدار في لوحة الإدارة، اقرأ{" "}
          <code>META-INF/com/android/metadata</code> من ملف zip — هذه الحقول هي مصدر الحقيقة.
        </p>

        <CopyCodeBlock
          label="Linux / macOS — قراءة metadata"
          code={`unzip -p ${EXAMPLE.codename}-ota_update-${EXAMPLE.incremental}.zip \\
  META-INF/com/android/metadata`}
        />

        <CopyCodeBlock
          label="Windows PowerShell — قراءة metadata"
          code={`$zip = "${EXAMPLE.codename}-ota_update-${EXAMPLE.incremental}.zip"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($zip)
$e = $z.GetEntry("META-INF/com/android/metadata")
$r = New-Object System.IO.StreamReader($e.Open())
$r.ReadToEnd()
$r.Close(); $z.Dispose()`}
        />

        <CopyCodeBlock
          label="مثال محتوى metadata (تقريبي)"
          code={`pre-device=${EXAMPLE.codename}
post-build=${EXAMPLE.buildId}
post-build-incremental=${EXAMPLE.incremental}
post-timestamp=${EXAMPLE.postTimestamp}
post-sdk-level=36
ota-type=AB
# incremental إضافي:
# pre-build-incremental=${EXAMPLE.sourceIncremental}`}
        />

        <div className="guide-table-wrap table-wrap">
          <table className="admin-table guide-table">
            <thead>
              <tr>
                <th>حقل metadata</th>
                <th>حقل لوحة الإدارة</th>
                <th>ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>pre-device</code>
                </td>
                <td>الجهاز (codename)</td>
                <td>يجب تسجيله مسبقاً في «نماذج الأجهزة»</td>
              </tr>
              <tr>
                <td>
                  <code>post-build</code>
                </td>
                <td>Build ID</td>
                <td>السلسلة الكاملة من metadata</td>
              </tr>
              <tr>
                <td>
                  <code>post-build-incremental</code>
                </td>
                <td>Incremental</td>
                <td>يظهر في اسم zip وملف القناة على الخادم</td>
              </tr>
              <tr>
                <td>
                  <code>post-timestamp</code>
                </td>
                <td>Post timestamp</td>
                <td>UTC بالثواني — Updater يقارنه مع <code>ro.build.date.utc</code></td>
              </tr>
              <tr>
                <td>—</td>
                <td>تسمية الإصدار</td>
                <td>للمسؤولين فقط (مثل «أغسط 2026»)</td>
              </tr>
              <tr>
                <td>—</td>
                <td>قناة التحديث</td>
                <td>
                  <code>stable</code> / <code>beta</code> / <code>alpha</code> — تحدد ملف metadata
                </td>
              </tr>
              <tr>
                <td>
                  <code>pre-build-incremental</code>
                </td>
                <td>Incremental المصدر (عند الرفع)</td>
                <td>لحزم INCREMENTAL فقط</td>
              </tr>
            </tbody>
          </table>
        </div>

        <CopyCodeBlock
          label="التحقق من الجهاز المتصل (adb)"
          code={`adb shell getprop ro.product.device
# يجب أن يطابق codename، مثل: ${EXAMPLE.codename}

adb shell getprop ro.build.version.incremental
# البناء الحالي على الهاتف — مهم لحزم incremental

adb shell getprop ro.build.date.utc
# يُقارن مع post-timestamp

adb shell getprop sys.update.channel
# القناة النشطة: stable | beta | alpha`}
        />
      </section>

      <section id="step-device" className="guide-section admin-panel">
        <h2 className="guide-section-title">
          <span className="guide-step-num mono">04</span> تسجيل نوع الجهاز
        </h2>
        <p>
          قبل أي إصدار، سجّل <strong>codename</strong> في{" "}
          <Link className="table-link" href="/admin/devices">
            نماذج الأجهزة
          </Link>
          . المنصة ترفض رفع حزم لجهاز غير مسجّل.
        </p>
        <ul className="guide-list">
          <li>
            <strong>Codename</strong> = <code>pre-device</code> من metadata (مثل{" "}
            <code>{EXAMPLE.codename}</code>)
          </li>
          <li>
            <strong>اسم العرض</strong> = وصف للمسؤول (مثل {EXAMPLE.displayName})
          </li>
        </ul>
        <p className="guide-actions">
          <Link className="btn btn-secondary" href="/admin/devices">
            ← فتح نماذج الأجهزة
          </Link>
        </p>
      </section>

      <section id="step-release" className="guide-section admin-panel">
        <h2 className="guide-section-title">
          <span className="guide-step-num mono">05</span> إنشاء إصدار في لوحة الإدارة
        </h2>
        <p>
          من{" "}
          <Link className="table-link" href="/admin/releases">
            الإصدارات
          </Link>{" "}
          → <strong>+ إصدار جديد</strong>. كل إصدار = بناء OTA واحد (جهاز + قناة + incremental
          هدف).
        </p>

        <div className="guide-field-grid">
          <div className="guide-field-card">
            <span className="mono guide-field-key">الجهاز</span>
            <p>اختر codename مسجّلاً</p>
          </div>
          <div className="guide-field-card">
            <span className="mono guide-field-key">قناة التحديث</span>
            <p>
              alpha للاختبار الداخلي → ملف <code>{EXAMPLE.codename}-alpha</code> بعد النشر
            </p>
          </div>
          <div className="guide-field-card">
            <span className="mono guide-field-key">تسمية الإصدار</span>
            <p>{EXAMPLE.versionLabel} — للعرض فقط</p>
          </div>
          <div className="guide-field-card">
            <span className="mono guide-field-key">Build ID</span>
            <p>
              <code>{EXAMPLE.buildId}</code>
            </p>
          </div>
          <div className="guide-field-card">
            <span className="mono guide-field-key">Incremental</span>
            <p>
              <code>{EXAMPLE.incremental}</code>
            </p>
          </div>
          <div className="guide-field-card">
            <span className="mono guide-field-key">Post timestamp</span>
            <p>
              <code>{EXAMPLE.postTimestamp}</code>
            </p>
          </div>
        </div>

        <p className="guide-actions">
          <Link className="btn btn-secondary" href="/admin/releases">
            ← فتح الإصدارات
          </Link>
        </p>
      </section>

      <section id="step-upload" className="guide-section admin-panel">
        <h2 className="guide-section-title">
          <span className="guide-step-num mono">06</span> رفع الحزمة
        </h2>
        <p>
          من{" "}
          <Link className="table-link" href="/admin/uploads">
            رفع الحزم
          </Link>{" "}
          → اختر الإصدار المسودّة وارفع zip الموقّع.
        </p>

        <h3 className="guide-subtitle mono">// FULL — تحديث كامل</h3>
        <ul className="guide-list">
          <li>
            <strong>نوع الحزمة:</strong> FULL
          </li>
          <li>
            <strong>اسم الملف المتوقع:</strong>{" "}
            <code>
              {EXAMPLE.codename}-ota_update-{EXAMPLE.incremental}.zip
            </code>
          </li>
          <li>Updater يستخدمها عند عدم وجود incremental متوافق (fallback)</li>
        </ul>

        <h3 className="guide-subtitle mono">// INCREMENTAL — تحديث تدريجي</h3>
        <ul className="guide-list">
          <li>
            <strong>نوع الحزمة:</strong> INCREMENTAL
          </li>
          <li>
            <strong>Incremental المصدر:</strong> البناء المثبّت على الجهاز (مثل{" "}
            <code>{EXAMPLE.sourceIncremental}</code>)
          </li>
          <li>
            <strong>اسم الملف:</strong>{" "}
            <code>
              {EXAMPLE.codename}-incremental-{EXAMPLE.sourceIncremental}-{EXAMPLE.incremental}.zip
            </code>
          </li>
          <li>يمكن رفع عدة incrementals لنفس الإصدار (مصادر مختلفة) + FULL واحدة</li>
        </ul>

        <CopyCodeBlock
          label="بعد الرفع — التحقق من MinIO (تطوير محلي)"
          code={`curl -I http://localhost:9000/ota-quarantine/
# Worker يتحقق تلقائياً → PENDING_APPROVAL

# بعد النشر:
curl http://localhost:9000/ota-published/${EXAMPLE.codename}-${EXAMPLE.channel}
# مثال: ${EXAMPLE.incremental} ${EXAMPLE.postTimestamp} ${EXAMPLE.codename} ${EXAMPLE.channel}`}
        />

        <p className="guide-actions">
          <Link className="btn btn-secondary" href="/admin/uploads">
            ← فتح رفع الحزم
          </Link>
        </p>
      </section>

      <section id="step-approve" className="guide-section admin-panel">
        <h2 className="guide-section-title">
          <span className="guide-step-num mono">07</span> موافقة ونشر
        </h2>
        <ol className="guide-ordered-list">
          <li>Worker يتحقق من وجود الملف والحجم في منطقة الحجر (quarantine).</li>
          <li>
            من صفحة الإصدار → <strong>موافقة</strong> (مسؤول واحد حالياً).
          </li>
          <li>
            <strong>نشر</strong> → ينسخ zip إلى <code>ota-published</code> ويكتب ملف metadata{" "}
            <code>
              {EXAMPLE.codename}-{EXAMPLE.channel}
            </code>
            .
          </li>
          <li>الجهاز على نفس القناة يفحص التحديث خلال ~6 ساعات أو يدوياً من Updater.</li>
        </ol>

        <CopyCodeBlock
          label="التحقق بعد النشر (إنتاج)"
          code={`curl https://release.mod-syria.org/${EXAMPLE.codename}-${EXAMPLE.channel}

curl -I https://release.mod-syria.org/${EXAMPLE.codename}-ota_update-${EXAMPLE.incremental}.zip`}
        />
      </section>

      <section id="step-example" className="guide-section admin-panel guide-example">
        <h2 className="guide-section-title">
          <span className="guide-step-num mono">08</span> مثال كامل — {EXAMPLE.displayName} /{" "}
          {EXAMPLE.channel}
        </h2>
        <p>سيناريو: بناء جديد للاختبار الداخلي على قناة alpha.</p>

        <div className="guide-flow mono">
          <div className="guide-flow-step">build @ server</div>
          <span className="guide-flow-arrow">→</span>
          <div className="guide-flow-step">extract metadata</div>
          <span className="guide-flow-arrow">→</span>
          <div className="guide-flow-step">register {EXAMPLE.codename}</div>
          <span className="guide-flow-arrow">→</span>
          <div className="guide-flow-step">create release</div>
          <span className="guide-flow-arrow">→</span>
          <div className="guide-flow-step">upload FULL</div>
          <span className="guide-flow-arrow">→</span>
          <div className="guide-flow-step">approve + publish</div>
        </div>

        <CopyCodeBlock
          label="قيم نموذج «إصدار جديد»"
          code={`الجهاز:          ${EXAMPLE.displayName} (${EXAMPLE.codename})
قناة التحديث:    ${EXAMPLE.channel}
تسمية الإصدار:   ${EXAMPLE.versionLabel}
Build ID:         ${EXAMPLE.buildId}
Incremental:      ${EXAMPLE.incremental}
Post timestamp:   ${EXAMPLE.postTimestamp}
سجل التغييرات:   إصلاحات أمنية + تحسينات ${EXAMPLE.versionLabel}`}
        />

        <CopyCodeBlock
          label="رفع FULL"
          code={`الإصدار:         ${EXAMPLE.versionLabel} (${EXAMPLE.codename} / ${EXAMPLE.channel})
نوع الحزمة:      FULL
الملف:            ${EXAMPLE.codename}-ota_update-${EXAMPLE.incremental}.zip`}
        />

        <CopyCodeBlock
          label="رفع INCREMENTAL (اختياري — من الإصدار السابق)"
          code={`الإصدار:         ${EXAMPLE.versionLabel}
نوع الحزمة:      INCREMENTAL
Incremental المصدر: ${EXAMPLE.sourceIncremental}
الملف:            ${EXAMPLE.codename}-incremental-${EXAMPLE.sourceIncremental}-${EXAMPLE.incremental}.zip`}
        />

        <CopyCodeBlock
          label="metadata بعد النشر على الخادم"
          code={`${EXAMPLE.incremental} ${EXAMPLE.postTimestamp} ${EXAMPLE.codename} ${EXAMPLE.channel}`}
        />

        <p className="guide-note muted">
          <span className="mono prompt">{">"}</span> للترقية alpha → beta → stable: أنشئ إصداراً
          جديداً أو انشر نفس البناء على قناة أخرى (المرحلة 5 — النشر التدريجي).
        </p>
      </section>

      <section className="guide-section admin-panel guide-links">
        <h2 className="guide-section-title">// روابط سريعة</h2>
        <div className="guide-link-grid">
          <Link href="/admin/devices" className="guide-quick-link">
            <span className="mono">devices</span>
            <span>نماذج الأجهزة</span>
          </Link>
          <Link href="/admin/releases" className="guide-quick-link">
            <span className="mono">releases</span>
            <span>الإصدارات</span>
          </Link>
          <Link href="/admin/uploads" className="guide-quick-link">
            <span className="mono">uploads</span>
            <span>رفع الحزم</span>
          </Link>
          <Link href="/admin/system-health" className="guide-quick-link">
            <span className="mono">health</span>
            <span>صحة النظام</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
