import type { Evidence } from "@/db/schema";
import { Dom } from "./Rich";
import { fmtDate } from "@/lib/format";

const Mk = ({ c }: { c: boolean }) =>
  c ? (
    <svg className="mk c" viewBox="0 0 24 24" aria-label="Counts">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  ) : (
    <svg className="mk x" viewBox="0 0 24 24" aria-label="Rejected">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );

export function EvidenceRows({ rows }: { rows: Evidence[] }) {
  return (
    <div className="ev">
      <b>
        <i>
          <Mk c /> Counts
        </i>
        <i>
          <Mk c={false} /> Rejected
        </i>
      </b>
      {rows.map((e, i) => (
        <div className={"evr" + (e.counts ? "" : " x")} key={i}>
          <Mk c={e.counts} />
          <span className="d">{fmtDate(e.date)}</span>
          <span className="t">
            <a href={e.url} target="_blank" rel="noopener noreferrer" title={`Opens ${e.domain || "the source"} in a new window`}>
              {e.title}
            </a>
            <small>
              {e.domain && <Dom d={e.domain} />} · {e.counts ? e.note : e.note.startsWith("Rejected because") ? e.note : `Rejected because ${e.note.charAt(0).toLowerCase()}${e.note.slice(1)}`}
            </small>
          </span>
        </div>
      ))}
    </div>
  );
}
