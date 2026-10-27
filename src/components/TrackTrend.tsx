"use client";

import { useState } from "react";
import { Pin, Check } from "lucide-react";
import { useUI } from "./ui";
import { postJSON } from "@/lib/client";

export function TrackTrend({ id, term, initial }: { id: number; term: string; initial: boolean }) {
  const ui = useUI();
  const [on, setOn] = useState(initial);
  async function press() {
    const next = !on;
    setOn(next);
    const r = await ui.undoable("Track", postJSON<{ full?: boolean }>("/api/track", { kind: "trend", id, on: next }), async () => {
      setOn(!next);
      await postJSON("/api/track", { kind: "trend", id, on: !next });
    });
    if (!r.ok) {
      setOn(!next);
      ui.error(next ? "This trend isn't tracked yet" : "Untrack didn't save", r.error || "The server did not answer.", r.status === 409 ? { label: "See Tracked Trends", href: "/trends" } : undefined);
      return;
    }
    ui.toast(`Trend ${next ? "Tracked" : "Untracked"}`);
  }
  return (
    <button className="btn track" data-act="track" aria-pressed={on} onClick={press} title={on ? `Stop tracking "${term}"` : `Track "${term}": a daily check and a timeline (up to 30 tracked trends)`}>
      {on ? <Check className="ico" /> : <Pin className="ico" />}
      {on ? "Tracking" : "Track"}
    </button>
  );
}
