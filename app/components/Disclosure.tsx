"use client";

import { useEffect, useId, useState } from "react";
import { Chevron } from "../components/Chevron";

/**
 * Collapsible panel with:
 *  - auto-height animation (no max-height guesses)
 *  - persisted open/closed state (localStorage)
 *  - a11y (aria-expanded / aria-controls)
 */
export default function Disclosure({
  title,
  storageKey,
  defaultOpen = true,
  children,
}: {
  title: string;
  storageKey: string;      // e.g. "panel:add", "panel:recent"
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const id = useId();

  // SSR-safe initial state
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultOpen;
    const v = localStorage.getItem(storageKey);
    return v === null ? defaultOpen : v === "true";
  });

  // Persist to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, String(open));
    }
  }, [open, storageKey]);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)]"
      >
        <Chevron open={open} />
        <span className="font-medium">{title}</span>
      </button>

      {/* Auto-height accordion:
          - Parent is a 1-row grid; we animate the row size 0fr ↔ 1fr
          - Child has overflow-hidden to mask during transition */}
      <div
        id={id}
        className="mt-3 grid transition-[grid-template-rows,opacity] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
