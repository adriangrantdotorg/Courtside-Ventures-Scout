"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Overlay, Kbd } from "./ui";

/** The Spotlight's kind pill: a press explains the rule that picked it. */
export function SpotlightPill({ kind, rule }: { kind: string; rule: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="pill" style={{ cursor: "pointer" }} aria-expanded={open} title="How the Spotlight picked this" onClick={() => setOpen(true)}>
        {kind}
      </button>
      {open && (
        <Overlay className="dlg" label="How the Spotlight picks" onClose={() => setOpen(false)} testid="dialog">
          <div className="hd">
            <div className="tile">
              <Info className="ico" />
            </div>
            <h2>{kind}</h2>
          </div>
          <p>{rule}</p>
          <p style={{ color: "var(--text-2)", fontSize: 15 }}>The Spotlight is picked by rules, never AI: the biggest of a Form D before any press, a brand new on three or more shows, the steepest trend, the biggest score jump, or a fund&apos;s new deal or new fund. It is recomputed after every daily job and every Refresh Now.</p>
          <div className="acts2">
            <button className="btn" onClick={() => setOpen(false)} title="Close (Esc)">
              Close<Kbd>Esc</Kbd>
            </button>
          </div>
        </Overlay>
      )}
    </>
  );
}

