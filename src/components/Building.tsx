"use client";

// The live Building page: same markup as the local progress page. Polls every 30 s and patches
// in place; the clock ticks every second from startedAt. Never reloads itself.
import { useEffect, useState } from "react";
import { clock, minutesToGo, isStale, stepRows, noteLine, STEPS, type P } from "@/lib/progress-core.mjs";
import { Logo } from "./Shell";

export function Building({ initial }: { initial: P }) {
  const [p, setP] = useState<P>(initial);
  const [now, setNow] = useState(() => initial.updatedAt);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      try {
        const r = await fetch("/api/build-progress", { cache: "no-store" });
        const j = await r.json();
        if (j.progress) setP(j.progress);
      } catch {
        /* keep the last state; the stale line says how old it is */
      }
    }, 30_000);
    return () => {
      clearInterval(t);
      clearInterval(poll);
    };
  }, []);
  useEffect(() => {
    if (p.done) {
      const t = setTimeout(() => window.location.replace("/"), 1500);
      return () => clearTimeout(t);
    }
  }, [p.done]);
  const rows = stepRows(p);
  const stale = isStale(p, now);
  return (
    <div className="building" data-testid="building">
      <div className="brand-row">
        <span className="brand">
          <Logo />
          <span>
            COURTSIDE
            <br />
            VENTURES SCOUT
          </span>
        </span>
      </div>
      <section className="pg">
        <div className="pg-eyebrow">Courtside Ventures Scout</div>
        <h1 className="pg-title">Scout is being built</h1>
        <div className={"pg-note" + (p.waiting ? " wait" : "")}>
          <i />
          <span>{noteLine(p)}</span>
        </div>
        {stale && (
          <div className="pg-note pg-stale" data-testid="stale">
            <i />
            <span>
              No update for{" "}
              <b className="pg-live" style={{ minWidth: "5ch" }}>
                {clock((now - p.updatedAt) / 1000)}
              </b>
            </span>
          </div>
        )}
        <div className="pg-stats">
          <div className="pg-stat now">
            <b className="pg-live" style={{ minWidth: "7ch", textAlign: "left" }} data-testid="since" suppressHydrationWarning>
              {clock((now - p.startedAt) / 1000)}
            </b>
            <span>Since start</span>
            <small>
              step {p.step} began{" "}
              <em className="pg-live" style={{ minWidth: "5ch", textAlign: "left" }} suppressHydrationWarning>
                {clock((now - p.stepStartedAt) / 1000)}
              </em>{" "}
              ago
            </small>
          </div>
          <div className="pg-stat">
            <b>
              ~
              <em className="pg-live" style={{ minWidth: "3ch", textAlign: "left" }}>
                {minutesToGo(p, now)}
              </em>{" "}
              min
            </b>
            <span>Roughly to go</span>
            <small>{p.waiting ? "paused while it waits for you" : "learns from the steps so far"}</small>
          </div>
        </div>
        <div className="pg-bar">
          {STEPS.map((_, i) => (
            <i key={i} className={p.done || i < p.step - 1 ? "done" : i === p.step - 1 ? "now" : ""} />
          ))}
        </div>
        <div className="pg-list">
          {rows.map((r) => (
            <div key={r.n} className={"pg-row " + r.state}>
              <span className="mk">{r.mark}</span>
              <span className="k">{r.num}</span>
              <span className="n">{r.name}</span>
              <span className="t">{r.time}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
