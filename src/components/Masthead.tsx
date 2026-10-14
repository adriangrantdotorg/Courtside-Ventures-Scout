"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useUI } from "./ui";
import { Ago, Clock, Until } from "./Live";
import { clock } from "@/lib/format";

type Counts = { worth: number; total: number; today: number; formds: number; sponsors: number; threshold: number };
type Prog = { stage: string; done: number; total: number; startedAt: number };
const COOLDOWN = 60 * 60 * 1000;

export function Masthead({ counts, updated, lastRefresh }: { counts: Counts; updated: string | null; lastRefresh: string | null }) {
  const ui = useUI();
  const router = useRouter();
  const [prog, setProg] = useState<Prog | null>(null);
  const [upd, setUpd] = useState(updated);
  const [last, setLast] = useState(lastRefresh);
  const [now, setNow] = useState(0);
  const es = useRef<EventSource | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => () => es.current?.close(), []);
  const cooling = !!last && now > 0 && now - new Date(last).getTime() < COOLDOWN;
  const nextAt = last ? new Date(new Date(last).getTime() + COOLDOWN) : null;
  const date = new Date(now || Date.now()).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });

  function refresh() {
    if (prog || cooling) return;
    const started = Date.now();
    setProg({ stage: "starting", done: 0, total: 0, startedAt: started });
    const src = new EventSource("/api/refresh");
    es.current = src;
    src.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.type === "stage") setProg({ stage: d.stage, done: d.done, total: d.total, startedAt: started });
      if (d.type === "refused") {
        src.close();
        setProg(null);
        setLast(d.lastRefresh);
        ui.toast(`Refreshed ${clock((Date.now() - new Date(d.lastRefresh).getTime()) / 1000).split(":")[0]}m Ago`);
      }
      if (d.type === "done") {
        src.close();
        setProg(null);
        setUpd(new Date().toISOString());
        setLast(new Date().toISOString());
        ui.toast(d.items > 0 ? `${d.items} New ${d.items === 1 ? "Find" : "Finds"}` : "Everything Is Current");
        router.refresh();
      }
      if (d.type === "error") {
        src.close();
        setProg(null);
        ui.error("Refresh Now stopped", d.message || "A source did not answer.");
      }
    };
    src.onerror = () => {
      src.close();
      setProg((p) => {
        if (p) ui.error("Refresh Now lost its connection", "The refresh may still finish on the server. The page updates the next time you open it.");
        return null;
      });
    };
  }

  return (
    <div className="mast">
      <span className="big">Scout</span>
      <nav className="segs" aria-label="Counts">
        {counts.worth > 0 && (
          <Link className="seg hero" href={`/pipeline?min=${counts.threshold}`} title={`Opens the Pipeline, score ${counts.threshold} and up`}>
            <b>
              <svg className="trophy" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
                <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
              </svg>
              {counts.worth}
            </b>
            <span>Worth a Look</span>
          </Link>
        )}
        {counts.today > 0 && (
          <Link className="seg" href="/pipeline?seen=today" title="Opens the Pipeline, filtered to today">
            <b>{counts.today}</b>
            <span>New Today</span>
          </Link>
        )}
        {counts.formds > 0 && (
          <Link className="seg" href="/throw-some-ds" title="Opens Throw Some D's on it">
            <b>{counts.formds}</b>
            <span>Form Ds</span>
          </Link>
        )}
        {counts.sponsors > 0 && (
          <Link className="seg" href="/sponsors" title="Opens Sponsor Radar">
            <b>{counts.sponsors}</b>
            <span>Sponsors</span>
          </Link>
        )}
      </nav>
      <div className="right">
        <span suppressHydrationWarning>{date}</span>
        {prog ? (
          <div className="refill" role="status" aria-live="polite" data-testid="refresh-progress">
            <div className="lane-bar">
              <i style={{ width: prog.total ? `${Math.round((prog.done / prog.total) * 100)}%` : "8%" }} />
            </div>
            <span>
              {prog.stage}
              {prog.total ? ` · ${prog.done} of ${prog.total}` : ""} · <Clock since={prog.startedAt} />
            </span>
          </div>
        ) : (
          <>
            {upd && <Ago date={upd} prefix="Updated " ch={14} />}
            {cooling ? (
              <button className="refresh" disabled data-act="refresh" title={`Refresh Now runs once an hour for everyone; next in ${nextAt ? Math.max(1, Math.ceil((nextAt.getTime() - now) / 60000)) : 60}m`}>
                <RefreshCw className="ico" style={{ width: 14, height: 14 }} />
                Refreshed <Ago date={last} ch={8} /> · next <Until date={nextAt} ch={8} />
              </button>
            ) : (
              <button className="refresh" data-act="refresh" onClick={refresh} title="Pulls the fastest sources now; once an hour for everyone (R)">
                <RefreshCw className="ico" style={{ width: 14, height: 14 }} />
                Refresh Now
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
