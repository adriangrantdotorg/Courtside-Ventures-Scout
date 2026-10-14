import type { Seg } from "@/lib/linkify";

/** Renders linkified text: internal links in the same window, outside links in a new one. */
export function Rich({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((s, i) =>
        typeof s === "string" ? (
          s
        ) : s.ext ? (
          <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" title={`Opens ${s.t} in a new window`}>
            {s.t}
          </a>
        ) : (
          <a key={i} href={s.href} title={`Open ${s.t} in Scout`}>
            {s.t}
          </a>
        ),
      )}
    </>
  );
}

/** An outside link: always a new window, with the tooltip saying so. */
export function Ext({ href, children, title, className }: { href: string; children: React.ReactNode; title?: string; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={title || "Opens the source in a new window"} className={className}>
      {children}
    </a>
  );
}

/** A domain printed so no browser linkifies it. */
export function Dom({ d }: { d: string }) {
  const parts = d.split(".");
  return (
    <span>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && (
            <>
              <i />.
            </>
          )}
          {p}
        </span>
      ))}
    </span>
  );
}
