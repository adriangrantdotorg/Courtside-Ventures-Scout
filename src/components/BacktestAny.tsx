"use client";

import { useRef, useState } from "react";
import { Search, Check } from "lucide-react";
import { useUI, ClearX } from "./ui";
import { Clock } from "./Live";
import { postJSON } from "@/lib/client";
import { EvidenceRows } from "./Evidence";
import type { Evidence } from "@/db/schema";

type Stage = "idle" | "announce" | "confirm-announce" | "website" | "confirm-website" | "search" | "done";

/** Backtest any startup: Announcement, then Website, then Result. Each tile lights up as its stage runs. */
export function BacktestAny() {
  const ui = useUI();
  const [name, setName] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [ann, setAnn] = useState<{ date: string; url: string; title: string } | null>(null);
  const [date, setDate] = useState("");
  const [site, setSite] = useState("");
  const [rows, setRows] = useState<Evidence[]>([]);
  const [note, setNote] = useState("");
  const [started, setStarted] = useState<number | null>(null);
  const [result, setResult] = useState<{ verdict: string; leadDays: number | null; flaggedOn: string | null } | null>(null);
  const es = useRef<EventSource | null>(null);

  async function start() {
    if (!name.trim()) return;
    setRows([]);
    setResult(null);
    setStarted(Date.now());
    setStage("announce");
    const r = await postJSON<{ announce: { date: string; url: string; title: string } | null }>("/api/backtest", { step: "announce", name });
    if (!r.ok) {
      setStage("idle");
      return ui.error("The backtest didn't start", r.error || "The server did not answer.");
    }
    setAnn(r.data!.announce);
    setDate(r.data!.announce?.date || "");
    setStage("confirm-announce");
  }
  async function confirmAnnounce() {
    setStage("website");
    const r = await postJSON<{ website: string }>("/api/backtest", { step: "website", name });
    setSite(r.data?.website || "");
    setStage("confirm-website");
  }
  function run() {
    setStage("search");
    setRows([]);
    const q = new URLSearchParams({ name, date, website: site, url: ann?.url || "" });
    const src = new EventSource(`/api/backtest/run?${q}`);
    es.current = src;
    src.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.type === "progress") {
        if (d.note) setNote(d.note);
        if (d.row) setRows((x) => [...x, d.row]);
      }
      if (d.type === "done") {
        setResult({ verdict: d.verdict, leadDays: d.leadDays, flaggedOn: d.flaggedOn });
        setStage("done");
        src.close();
        ui.toast("Backtest Done");
      }
      if (d.type === "error") {
        src.close();
        setStage("confirm-website");
        ui.error("The backtest stopped", d.message);
      }
    };
    src.onerror = () => {
      src.close();
    };
  }
  const tile = (n: Stage[], wait: Stage) => (stage === wait ? "wait" : n.includes(stage) ? "run" : "");
  const doneA = ["website", "confirm-website", "search", "done"].includes(stage);
  const doneW = ["search", "done"].includes(stage);
  return (
    <section className="any" id="any" aria-label="Backtest any startup">
      <h2>Backtest Any Startup</h2>
      <p>Type a startup&apos;s name. Scout finds its announcement (or you give the date), asks you to confirm its website so it doesn&apos;t match the wrong company, then searches for earlier public signals. No AI; under a minute.</p>
      <div className="row">
        <label className="fsearch" style={{ maxWidth: 520 }}>
          <Search className="ico" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && start()}
            placeholder="A startup's name, then Enter"
            aria-label="A startup's name"
            data-testid="backtest-input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <ClearX show={!!name} onClear={() => setName("")} />
        </label>
        <button className="btn red" onClick={start} disabled={!name.trim() || stage === "announce" || stage === "search"} title="Find the announcement, then confirm the website, then search">
          Run Backtest
        </button>
      </div>
      <div className="steps" data-testid="backtest-steps">
        <div className={doneA ? "done" : tile(["announce"], "confirm-announce")}>
          <b>1 · Announcement</b>
          {stage === "announce" && (
            <span className="mono">
              searching funding news · <Clock since={started} />
            </span>
          )}
          {stage === "confirm-announce" && (
            <>
              <span className="w">Waiting for you: confirm the announcement date.</span>
              {ann ? (
                <a href={ann.url} target="_blank" rel="noopener noreferrer" title="Opens the announcement in a new window">
                  {ann.title}
                </a>
              ) : (
                <span>No funding news found. Type the date.</span>
              )}
              <input className="sinput" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Announcement date" />
              <button className="btn" disabled={!date} onClick={confirmAnnounce} title="Use this date">
                <Check className="ico" />
                Confirm Date
              </button>
            </>
          )}
          {doneA && <span className="mono">{date}</span>}
          {stage === "idle" && <span>Its first public funding announcement.</span>}
        </div>
        <div className={doneW ? "done" : tile(["website"], "confirm-website")}>
          <b>2 · Website</b>
          {stage === "website" && <span className="mono">looking it up</span>}
          {stage === "confirm-website" && (
            <>
              <span className="w">Waiting for you: confirm the website, so Scout doesn&apos;t match another company.</span>
              <input className="sinput" value={site} onChange={(e) => setSite(e.target.value)} aria-label="Website" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
              <button className="btn" disabled={!site} onClick={run} title="Search for earlier public signals">
                <Check className="ico" />
                Confirm and Run
              </button>
            </>
          )}
          {doneW && <span className="mono">{site}</span>}
          {["idle", "announce", "confirm-announce"].includes(stage) && <span>The company&apos;s own domain.</span>}
        </div>
        <div className={stage === "search" ? "run" : stage === "done" ? "done" : ""}>
          <b>3 · Result</b>
          {stage === "search" && (
            <span className="mono">
              {note || "searching"} · {rows.length} found · <Clock since={started} />
            </span>
          )}
          {result && (
            <span>
              {result.verdict === "win" ? (
                <>
                  Would have flagged on <b className="mono">{result.flaggedOn}</b>, <b style={{ color: "var(--green)" }}>{result.leadDays} days</b> before the announcement.
                </>
              ) : (
                "No earlier public signal found."
              )}
            </span>
          )}
          {!["search", "done"].includes(stage) && <span>A dated timeline and a plain verdict.</span>}
        </div>
      </div>
      {rows.length > 0 && (
        <div className="card2" style={{ marginTop: 14 }}>
          <EvidenceRows rows={rows} />
        </div>
      )}
    </section>
  );
}
