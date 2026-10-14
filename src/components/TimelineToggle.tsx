"use client";

import { useState, type ReactNode } from "react";

/** A button in the trend's action bar that opens the source timeline on its own full-width line under the bar. */
export function TimelineToggle({ n, children }: { n: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" aria-expanded={open} onClick={() => setOpen(!open)} title={open ? "Hide the timeline" : `Show the timeline: ${n} sources, oldest to newest`}>
        Timeline · {n} {n === 1 ? "Source" : "Sources"}
      </button>
      {open && <div className="tlist">{children}</div>}
    </>
  );
}
