"use client";

import { useState } from "react";

type Props = {
  code: string;
  label?: string;
};

export default function CopyCodeBlock({ code, label }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="copy-code-block">
      {label ? <div className="copy-code-label mono">{label}</div> : null}
      <div className="copy-code-inner">
        <pre className="copy-code-pre">
          <code>{code}</code>
        </pre>
        <button type="button" className="copy-code-btn mono" onClick={copy} aria-label="نسخ الأمر">
          {copied ? "✓ نُسخ" : "نسخ"}
        </button>
      </div>
    </div>
  );
}
