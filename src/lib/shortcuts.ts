// Every keyboard shortcut: action -> several combos, rebindable, saved per browser.
export type Action =
  | "next"
  | "prev"
  | "voteUp"
  | "voteDown"
  | "open"
  | "openSource"
  | "track"
  | "memo"
  | "email"
  | "crm"
  | "alert"
  | "note"
  | "search"
  | "refresh"
  | "palette"
  | "goToday"
  | "goPipeline"
  | "goTrends"
  | "goCulture"
  | "goTracking"
  | "goBrief"
  | "goSettings"
  | "theme"
  | "undo"
  | "sheet";

export const ACTIONS: { id: Action; label: string; keys: string[]; group: string }[] = [
  { id: "next", label: "Next item", keys: ["j"], group: "Move" },
  { id: "prev", label: "Previous item", keys: ["k"], group: "Move" },
  { id: "voteUp", label: "Vote up on the focused item", keys: ["u", "+"], group: "Act" },
  { id: "voteDown", label: "Vote down on the focused item", keys: ["d", "-"], group: "Act" },
  { id: "open", label: "Open the company", keys: ["enter"], group: "Act" },
  { id: "openSource", label: "Open the first source", keys: ["o"], group: "Act" },
  { id: "track", label: "Track", keys: ["t"], group: "Act" },
  { id: "memo", label: "Draft Investment Memo", keys: ["m"], group: "Act" },
  { id: "email", label: "Connection Email", keys: ["e"], group: "Act" },
  { id: "crm", label: "Copy for CRM", keys: ["c"], group: "Act" },
  { id: "alert", label: "New alert", keys: ["a"], group: "Act" },
  { id: "note", label: "Add note", keys: ["n"], group: "Act" },
  { id: "search", label: "Search", keys: ["/"], group: "Find" },
  { id: "refresh", label: "Refresh now", keys: ["r"], group: "Find" },
  { id: "palette", label: "Command palette", keys: ["cmd+k", "ctrl+k"], group: "Find" },
  { id: "goToday", label: "Go to Today", keys: ["g h"], group: "Go" },
  { id: "goPipeline", label: "Go to Pipeline", keys: ["g p"], group: "Go" },
  { id: "goTrends", label: "Go to Trends", keys: ["g t"], group: "Go" },
  { id: "goCulture", label: "Go to Culture", keys: ["g c"], group: "Go" },
  { id: "goTracking", label: "Go to Tracking", keys: ["g a"], group: "Go" },
  { id: "goBrief", label: "Go to IC Meeting", keys: ["g b"], group: "Go" },
  { id: "goSettings", label: "Go to Settings", keys: ["g s"], group: "Go" },
  { id: "theme", label: "Switch theme (Night / Day)", keys: ["shift+t"], group: "View" },
  { id: "undo", label: "Undo the last vote, track or note", keys: ["cmd+z", "ctrl+z"], group: "Act" },
  { id: "sheet", label: "Shortcut sheet", keys: ["?"], group: "View" },
];

const STORE = "scout.shortcuts";

export function loadBindings(): Record<Action, string[]> {
  const base = Object.fromEntries(ACTIONS.map((a) => [a.id, a.keys])) as Record<Action, string[]>;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "{}");
    for (const k of Object.keys(saved)) if (k in base && Array.isArray(saved[k])) base[k as Action] = saved[k];
  } catch {
    /* storage blocked: defaults */
  }
  return base;
}

export function saveBindings(b: Record<string, string[]>) {
  try {
    const defaults = Object.fromEntries(ACTIONS.map((a) => [a.id, a.keys]));
    const diff = Object.fromEntries(Object.entries(b).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(defaults[k])));
    localStorage.setItem(STORE, JSON.stringify(diff));
  } catch {
    /* ignore */
  }
}

/** Normalize a keyboard event into a combo string like "cmd+k", "shift+t", "j", "?". */
export function comboOf(e: KeyboardEvent): string {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  const parts: string[] = [];
  if (e.metaKey) parts.push("cmd");
  if (e.ctrlKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  // shift only matters for letters; "?" "!" "+" already carry it
  if (e.shiftKey && /^[a-z]$/.test(k)) parts.push("shift");
  parts.push(k === " " ? "space" : k);
  return parts.join("+");
}

export function prettyCombo(c: string): string {
  return c
    .split(" ")
    .map((part) =>
      part
        .split("+")
        .map((p) => ({ cmd: "⌘", ctrl: "Ctrl", alt: "⌥", shift: "⇧", enter: "↩", escape: "Esc", space: "Space" })[p] || p.toUpperCase())
        .join(p2(part)),
    )
    .join(" then ");
}
function p2(part: string) {
  return part.startsWith("ctrl") ? "+" : "";
}
