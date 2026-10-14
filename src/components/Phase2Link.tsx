"use client";

import { useUI } from "./ui";

/** Every "Phase II" on screen is this link: it opens the Phase II door (Adrian, 10-14-26). */
export function Phase2Link({ children = "Phase II" }: { children?: React.ReactNode }) {
  const ui = useUI();
  return (
    <button className="p2" onClick={() => ui.door("team")} title="What Phase II adds, built together">
      {children}
    </button>
  );
}
