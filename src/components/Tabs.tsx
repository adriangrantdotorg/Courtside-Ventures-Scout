"use client";

import { useEffect, useState, type ReactNode } from "react";

type Tab = { id: string; label: string; count?: number };

/** Tabs with a count each; the open tab lives in the URL hash so a link can land on it. Children: one panel per tab, in order. */
export function Tabs({ tabs, children }: { tabs: Tab[]; children: ReactNode[] }) {
  const [cur, setCur] = useState(tabs[0].id);
  useEffect(() => {
    const fromHash = () => {
      const h = location.hash.replace("#", "");
      if (tabs.some((t) => t.id === h)) setCur(h);
    };
    fromHash();
    addEventListener("hashchange", fromHash);
    return () => removeEventListener("hashchange", fromHash);
  }, [tabs]);
  const go = (id: string) => {
    setCur(id);
    history.replaceState(null, "", `#${id}`);
  };
  return (
    <>
      <div className="tabs" role="tablist">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={cur === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => go(t.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") go(tabs[(i + 1) % tabs.length].id);
              if (e.key === "ArrowLeft") go(tabs[(i - 1 + tabs.length) % tabs.length].id);
            }}
            title={`Show ${t.label}`}
          >
            {t.label}
            {t.count !== undefined && <b>{t.count}</b>}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={cur !== t.id}>
          {children[i]}
        </div>
      ))}
    </>
  );
}
