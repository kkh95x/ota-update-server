"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PANEL_WIDTH = 340;
const PANEL_GAP = 6;

export default function FieldTooltip({ text }: { text: string }) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const panelWidth = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 8));
    const top = rect.bottom + PANEL_GAP;

    setPosition({ top, left });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    function onScrollOrResize() {
      updatePosition();
    }

    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  function show() {
    updatePosition();
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  return (
    <>
      <span className="field-tooltip">
        <button
          ref={triggerRef}
          type="button"
          className="field-tooltip-trigger mono"
          aria-describedby={open ? id : undefined}
          aria-label="شرح الحقل"
          aria-expanded={open}
          onMouseEnter={show}
          onMouseLeave={hide}
          onFocus={show}
          onBlur={hide}
        >
          ?
        </button>
      </span>
      {mounted &&
        open &&
        createPortal(
          <span
            id={id}
            className="field-tooltip-panel field-tooltip-portal"
            role="tooltip"
            style={{
              top: position.top,
              left: position.left,
              width: Math.min(PANEL_WIDTH, window.innerWidth - 16),
            }}
          >
            {text}
          </span>,
          document.body,
        )}
    </>
  );
}
