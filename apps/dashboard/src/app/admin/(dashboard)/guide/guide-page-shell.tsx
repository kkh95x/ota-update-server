"use client";

import { useState } from "react";
import AdminPageHeader from "@/components/admin-page-header";
import BuildFromExistingTab from "./build-from-existing-tab";
import GuideView from "./guide-view";

const TABS = [
  { id: "full", label: "الدليل الكامل", mono: "guide.full" },
  { id: "from-existing", label: "بناء من إصدار موجود", mono: "guide.delta" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function GuidePageShell() {
  const [tab, setTab] = useState<TabId>("full");

  return (
    <div className="admin-page admin-page-wide">
      <AdminPageHeader
        module="guide"
        title="دليل OTA — من البناء إلى الرفع"
        description="تعليمات GrapheneOS/CUSTOM_OS: دليل كامل، أو بناء إصدار جديد فوق إصدار منشور."
      />

      <div className="guide-tabs" role="tablist" aria-label="أقسام الدليل">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`guide-tab-btn${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="mono guide-tab-mono">{t.mono}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" className="guide-tab-panel">
        {tab === "full" ? <GuideView embedded /> : <BuildFromExistingTab />}
      </div>
    </div>
  );
}
