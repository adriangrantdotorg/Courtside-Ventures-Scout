"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Check, Plus, Trash2, Lock, Sparkles, Undo2, Send } from "lucide-react";
import { useUI, ClearX, Kbd } from "../ui";
import { Ago, Until, Clock } from "../Live";
import { postJSON, getJSON } from "@/lib/client";
import { ACTIONS, loadBindings, saveBindings, comboOf, prettyCombo } from "@/lib/shortcuts";
import { PHASE2_ITEMS, ADRIAN_LINKEDIN } from "@/lib/phase2";
import { nextRun } from "@/lib/format";
import { toggleTheme } from "../Shell";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Data = any;

type Sec = { id: string; label: string; key: string; group: "Yours" | "Shared" | "Record"; words: string };
const SECTIONS: Sec[] = [
  { id: "appearance", label: "Appearance", key: "a", group: "Yours", words: "theme night day density compact roomy text size" },
  { id: "shortcuts", label: "Shortcuts", key: "k", group: "Yours", words: "keyboard keys rebind" },
  { id: "home", label: "Home Sections", key: "h", group: "Yours", words: "today sections order show hide" },
  { id: "thesis", label: "Thesis", key: "t", group: "Shared", words: "thesis keyword search queries stage check" },
  { id: "scoring", label: "Scoring", key: "c", group: "Shared", words: "weights threshold worth a look penalties score" },
  { id: "sources", label: "Sources", key: "u", group: "Shared", words: "sources health extra github gdelt rss" },
  { id: "jobs", label: "Jobs", key: "j", group: "Shared", words: "jobs schedule cron runs" },
  { id: "voices", label: "Creators and Shows", key: "r", group: "Shared", words: "creators shows podcasts youtube add remove quiet" },
  { id: "funds", label: "Funds", key: "f", group: "Shared", words: "funds co-investors synergistic focus specialist broad" },
  { id: "trackers", label: "Trackers", key: "i", group: "Shared", words: "tracked companies trends people" },
  { id: "alerts", label: "Alerts", key: "l", group: "Shared", words: "alerts rules" },
  { id: "slack", label: "Slack", key: "s", group: "Shared", words: "slack connect channel" },
  { id: "ai", label: "AI", key: "g", group: "Shared", words: "ai drafting memo gateway cap" },
  { id: "feedback", label: "Feedback Inbox", key: "b", group: "Shared", words: "feedback flag problem inbox" },
  { id: "phase2", label: "Phase II", key: "p", group: "Shared", words: "phase ii together" },
  { id: "log", label: "Change Log", key: "o", group: "Record", words: "change log undo history" },
];
const ATTRS = { autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false } as const;

function Num({ value, min, max, onChange, label, unit }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string; unit?: string }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(String(value)), [value]);
  const commit = (s: string) => {
    const n = Math.max(min, Math.min(max, Math.round(Number(s) || 0)));
    onChange(n);
    setTxt(String(n));
  };
  return (
    <div className="num">
      <input
        type="text"
        inputMode="numeric"
        value={txt}
        aria-label={`${label} value`}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          if (e.key === "ArrowUp") (e.preventDefault(), commit(String(value + 1)));
          if (e.key === "ArrowDown") (e.preventDefault(), commit(String(value - 1)));
        }}
        {...ATTRS}
      />
      {unit && <small>{unit}</small>}
    </div>
  );
}

function SliderRow({ label, sub, value, min, max, onChange, unit }: { label: string; sub?: string; value: number; min: number; max: number; onChange: (n: number) => void; unit?: string }) {
  return (
    <div className="wrow" data-setting={label}>
      <div className="lbl">
        {label}
        {sub && <small>{sub}</small>}
      </div>
      <div className="sl">
        <span>{min}</span>
        <input type="range" min={min} max={max} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
        <span>{max}</span>
      </div>
      <Num value={value} min={min} max={max} onChange={onChange} label={label} unit={unit} />
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className="tog" role="switch" aria-checked={on} aria-label={label} title={on ? `Turn off: ${label}` : `Turn on: ${label}`} onClick={() => onChange(!on)} onKeyDown={(e) => e.key === " " && (e.preventDefault(), onChange(!on))} />;
}

function Seg({ value, opts, onChange, label }: { value: string; opts: [string, string][]; onChange: (v: string) => void; label: string }) {
  return (
    <div className="seg2" role="group" aria-label={label}>
      {opts.map(([v, l]) => (
        <button key={v} aria-pressed={value === v} onClick={() => onChange(v)} disabled={value === v} title={`${label}: ${l}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="scard" data-card={title}>
      <h3>
        {title}
        {note && <span className="note-h">{note}</span>}
      </h3>
      {children}
    </div>
  );
}

const WLABEL: [string, string, string][] = [
  ["thesis", "Thesis fit", "Matches a thesis area and a play Courtside has backed"],
  ["stage", "Stage and check", "Pre-Seed to Series A, a $500K to $4M check"],
  ["signal", "Signal strength", "Independent signals, recency, momentum"],
  ["culture", "Culture", "Creators and shows, sponsors, the taste map"],
  ["team", "Team", "Founder track record in public sources"],
  ["geo", "Geography", "US first; India, LatAm, Middle East, Africa for gaming"],
];
const HOME_KEYS: [string, string][] = [
  ["spotlight", "Spotlight, Top Picks, Velocity and Sponsor Radar"],
  ["proof", "We'd Have Found It First"],
  ["culture", "Culture"],
  ["money", "Throw Some D's on It, Neighborhood, Synergistic Funders, From Courtside"],
];

export function SettingsView({ data }: { data: Data }) {
  const ui = useUI();
  const router = useRouter();
  const params = useSearchParams();
  const [sec, setSec] = useState(params.get("s") || "appearance");
  const [q, setQ] = useState("");
  const search = useRef<HTMLInputElement>(null);

  // the search field is focused on open, and typing anywhere with no field focused goes to it
  useEffect(() => {
    search.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (document.getElementById("app-root")?.hasAttribute("inert")) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.ctrlKey && !e.metaKey && !e.altKey) {
        const s = SECTIONS.find((x) => x.key === e.key.toLowerCase());
        if (s) {
          e.preventDefault();
          e.stopPropagation();
          setSec(s.id);
          return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        search.current?.focus();
        return;
      }
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && /\S/.test(e.key)) {
        e.stopPropagation(); // the letter goes into the search field, not to a page shortcut
        search.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
  useEffect(() => {
    if (params.get("s")) setSec(params.get("s")!);
    if (params.get("explain")) ui.toast("Slack Setup Needed");
    if (params.get("connected")) ui.toast("Slack Connected");
  }, [params, ui]);

  const hits = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return null;
    const secs = SECTIONS.filter((s) => `${s.label} ${s.words}`.toLowerCase().includes(n));
    const keys = ACTIONS.filter((a) => `${a.label} ${a.keys.join(" ")}`.toLowerCase().includes(n));
    return { secs, keys };
  }, [q]);

  const badge = (id: string) => {
    if (id === "feedback") return data.feedback.filter((f: any) => f.status === "open").length || 0;
    if (id === "sources") return data.health.filter((h: any) => h.last_error && (!h.last_ok || h.last_error > h.last_ok)).length || 0;
    return 0;
  };
  const cur = SECTIONS.find((s) => s.id === sec) || SECTIONS[0];

  return (
    <div>
      <header className="pgh">
        <div>
          <span className="label">Settings</span>
          <h1>Settings</h1>
          <p className="lede2">Shared settings change Scout for everyone and land in the change log with Undo. Your settings stay in this browser.</p>
        </div>
        <label className="fsearch" style={{ minWidth: 340 }}>
          <Search className="ico" />
          <input
            ref={search}
            data-search
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (q) setQ("");
                else (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Search every setting and shortcut"
            aria-label="Search every setting and shortcut"
            {...ATTRS}
          />
          <ClearX
            show={!!q}
            onClear={() => {
              setQ("");
              search.current?.focus();
            }}
          />
          <span className="kbd">⌘F</span>
        </label>
      </header>
      <div className="rule" />
      <div className="set">
        <nav className="snav" aria-label="Settings sections">
          {(["Yours", "Shared", "Record"] as const).map((g) => (
            <div key={g} style={{ display: "contents" }}>
              <div className="grp">{g}</div>
              {SECTIONS.filter((s) => s.group === g).map((s) => (
                <a
                  key={s.id}
                  href={`/settings?s=${s.id}`}
                  className={s.id === sec && !hits ? "on" : ""}
                  onClick={(e) => {
                    e.preventDefault();
                    setSec(s.id);
                    setQ("");
                    window.history.replaceState(null, "", `/settings?s=${s.id}`);
                  }}
                  title={badge(s.id) ? `${badge(s.id)} need you` : `Open ${s.label} (⌃${s.key.toUpperCase()})`}
                >
                  {s.label}
                  {badge(s.id) ? <span className="badge2">{badge(s.id)}</span> : <span className="k">⌃{s.key.toUpperCase()}</span>}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="pane">
          {hits ? (
            <>
              <h2>Search Results</h2>
              {!hits.secs.length && !hits.keys.length && <p className="sub">Nothing matches &quot;{q}&quot;.</p>}
              {hits.secs.map((s) => (
                <Card key={s.id} title={s.label} note={s.group === "Yours" ? "Yours · this browser" : "Shared"}>
                  <button className="btn" onClick={() => (setSec(s.id), setQ(""))} title={`Open ${s.label}`}>
                    Open {s.label}
                  </button>
                </Card>
              ))}
              {hits.keys.length > 0 && (
                <Card title="Shortcuts">
                  <ShortcutRows filter={q} />
                </Card>
              )}
            </>
          ) : (
            <>
              <h2>
                {cur.label}
                <span className="scope">{cur.group === "Yours" ? "Yours · this browser" : cur.group === "Record" ? "Shared · the record" : "Shared · everyone sees changes"}</span>
              </h2>
              <Pane id={sec} data={data} refresh={() => router.refresh()} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Pane({ id, data, refresh }: { id: string; data: Data; refresh: () => void }) {
  switch (id) {
    case "appearance":
      return <Appearance />;
    case "shortcuts":
      return (
        <>
          <p className="sub">Every shortcut can be changed, and each action can have several keys. Shortcuts never fire while you type in a field.</p>
          <Card title="Shortcuts">
            <ShortcutRows filter="" />
          </Card>
        </>
      );
    case "home":
      return <HomeSections />;
    case "thesis":
      return <ThesisPane data={data} refresh={refresh} />;
    case "scoring":
      return <Scoring data={data} refresh={refresh} />;
    case "sources":
      return <Sources data={data} refresh={refresh} />;
    case "jobs":
      return <Jobs data={data} />;
    case "voices":
      return <Voices data={data} refresh={refresh} />;
    case "funds":
      return <Funds data={data} refresh={refresh} />;
    case "trackers":
      return <Trackers data={data} refresh={refresh} />;
    case "alerts":
      return (
        <>
          <p className="sub">Each alert is a rule checked once a day, around 8 AM ET, against everything new.</p>
          <Card title="Alert Rules" note={<Link href="/alerts">Open Alerts</Link>}>
            {data.alerts.map((a: any) => (
              <div className="trow" key={a.id}>
                <span className="lbl">{a.title}</span>
                <span className="mono" style={{ fontSize: 13 }}>{a.active ? "On" : "Off"}</span>
              </div>
            ))}
          </Card>
        </>
      );
    case "slack":
      return <SlackPane data={data} refresh={refresh} />;
    case "ai":
      return <AiPane data={data} refresh={refresh} />;
    case "feedback":
      return <FeedbackPane data={data} refresh={refresh} />;
    case "phase2":
      return <Phase2Pane />;
    case "log":
      return <LogPane data={data} refresh={refresh} />;
  }
  return null;
}

/* ---------- Yours ---------- */
function Appearance() {
  const [theme, setTheme] = useState("dark");
  const [density, setDensity] = useState("roomy");
  const [text, setText] = useState("normal");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || "dark");
    setDensity(document.documentElement.dataset.density || "roomy");
    setText(document.documentElement.dataset.text || "normal");
  }, []);
  const save = (k: string, v: string) => {
    try {
      localStorage.setItem(`scout.${k}`, v);
    } catch {
      /* private window */
    }
    document.documentElement.dataset[k] = v;
  };
  return (
    <>
      <p className="sub">These stay in this browser.</p>
      <Card title="Look">
        <div className="trow">
          <span className="lbl">
            Theme<small>Night is the default. Shift+T flips it anywhere.</small>
          </span>
          <Seg
            label="Theme"
            value={theme}
            opts={[
              ["dark", "Night"],
              ["light", "Day"],
            ]}
            onChange={(v) => {
              if (v !== theme) toggleTheme();
              setTheme(v);
            }}
          />
        </div>
        <div className="trow">
          <span className="lbl">Density</span>
          <Seg label="Density" value={density} opts={[["roomy", "Roomy"], ["compact", "Compact"]]} onChange={(v) => (setDensity(v), save("density", v))} />
        </div>
        <div className="trow">
          <span className="lbl">Text size</span>
          <Seg label="Text size" value={text} opts={[["normal", "Normal"], ["large", "Large"]]} onChange={(v) => (setText(v), save("text", v))} />
        </div>
      </Card>
    </>
  );
}

function HomeSections() {
  const [prefs, setPrefs] = useState<{ order: string[]; hidden: string[] }>({ order: HOME_KEYS.map((k) => k[0]), hidden: [] });
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("scout.home") || "null");
      if (p) setPrefs({ order: [...p.order, ...HOME_KEYS.map((k) => k[0]).filter((k) => !p.order.includes(k))], hidden: p.hidden || [] });
    } catch {
      /* default */
    }
  }, []);
  const save = (p: typeof prefs) => {
    setPrefs(p);
    try {
      localStorage.setItem("scout.home", JSON.stringify(p));
    } catch {
      /* ignore */
    }
  };
  const label = (k: string) => HOME_KEYS.find((x) => x[0] === k)?.[1] || k;
  return (
    <>
      <p className="sub">Which parts of Today show, and in what order. These stay in this browser.</p>
      <Card title="Today">
        {prefs.order.map((k, i) => (
          <div className="trow" key={k}>
            <span className="lbl">{label(k)}</span>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button className="btn" disabled={i === 0} onClick={() => save({ ...prefs, order: prefs.order.map((x, j) => (j === i - 1 ? k : j === i ? prefs.order[i - 1] : x)) })} title="Move this section up">
                Move Up
              </button>
              <button className="btn" disabled={i === prefs.order.length - 1} onClick={() => save({ ...prefs, order: prefs.order.map((x, j) => (j === i + 1 ? k : j === i ? prefs.order[i + 1] : x)) })} title="Move this section down">
                Move Down
              </button>
              <Toggle label={`Show ${label(k)}`} on={!prefs.hidden.includes(k)} onChange={(v) => save({ ...prefs, hidden: v ? prefs.hidden.filter((x) => x !== k) : [...prefs.hidden, k] })} />
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}

function ShortcutRows({ filter }: { filter: string }) {
  const ui = useUI();
  const [b, setB] = useState<Record<string, string[]>>({});
  const [rec, setRec] = useState<{ id: string; i: number } | null>(null);
  const [f, setF] = useState("");
  useEffect(() => setB(loadBindings()), []);
  const store = useCallback(
    (next: Record<string, string[]>) => {
      setB(next);
      saveBindings(next);
      window.dispatchEvent(new Event("scout:bindings"));
      ui.toast("Shortcut Saved");
    },
    [ui],
  );
  useEffect(() => {
    if (!rec) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return setRec(null);
      if (["Shift", "Meta", "Control", "Alt"].includes(e.key)) return;
      const c = comboOf(e);
      const list = [...(b[rec.id] || [])];
      if (rec.i >= list.length) list.push(c);
      else list[rec.i] = c;
      setRec(null);
      store({ ...b, [rec.id]: [...new Set(list)] });
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [rec, b, store]);
  const needle = (filter || f).toLowerCase();
  const rows = ACTIONS.filter((a) => !needle || `${a.label} ${(b[a.id] || a.keys).join(" ")} ${(b[a.id] || a.keys).map(prettyCombo).join(" ")}`.toLowerCase().includes(needle));
  const conflicts = (c: string, id: string) => ACTIONS.filter((a) => a.id !== id && (b[a.id] || a.keys).includes(c)).map((a) => a.label);
  return (
    <>
      {!filter && (
        <div className="filters" style={{ padding: 0 }}>
          <label className="fsearch">
            <Search className="ico" />
            <input value={f} onChange={(e) => setF(e.target.value)} aria-label="Filter shortcuts" {...ATTRS} />
            <ClearX show={!!f} onClear={() => setF("")} />
          </label>
          <span className="mono" style={{ fontSize: 13, color: "var(--text-3)" }}>
            {rows.length} of {ACTIONS.length}
          </span>
        </div>
      )}
      {rows.map((a) => {
        const keys = b[a.id] || a.keys;
        const changed = JSON.stringify(keys) !== JSON.stringify(a.keys);
        return (
          <div className="trow" key={a.id}>
            <span className="lbl">
              {a.label}
              {keys.some((k) => conflicts(k, a.id).length) && <small style={{ color: "var(--red-ink)" }}>Also used by {keys.flatMap((k) => conflicts(k, a.id)).join(", ")}</small>}
            </span>
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {keys.map((k, i) => (
                <span key={k + i} style={{ display: "inline-flex", gap: 2 }}>
                  <button className={"btn" + (rec?.id === a.id && rec.i === i ? " on" : "")} onClick={() => setRec({ id: a.id, i })} title="Press to record a new key for this slot">
                    {rec?.id === a.id && rec.i === i ? "Press Keys" : prettyCombo(k)}
                  </button>
                  {keys.length > 1 && (
                    <button className="btn" onClick={() => store({ ...b, [a.id]: keys.filter((_, j) => j !== i) })} title={`Remove ${prettyCombo(k)}`}>
                      Remove
                    </button>
                  )}
                </span>
              ))}
              <button className="btn" onClick={() => setRec({ id: a.id, i: keys.length })} title="Add another key for this action">
                <Plus className="ico" />
              </button>
              {changed && (
                <button className="btn" onClick={() => store({ ...b, [a.id]: a.keys })} title="Back to the default keys">
                  Reset
                </button>
              )}
            </span>
          </div>
        );
      })}
    </>
  );
}

/* ---------- Shared ---------- */
function SaveBar({ count, onSave, onDiscard, savedAt, busy, disabled }: { count: number; onSave: () => void; onDiscard: () => void; savedAt: number | null; busy: boolean; disabled?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && count && !disabled) {
        e.preventDefault();
        onSave();
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [count, disabled, onSave]);
  return (
    <div className="savebar" data-testid="savebar">
      <span className="who">
        {count ? (
          <>
            <b>
              {count} {count === 1 ? "change" : "changes"}
            </b>{" "}
            · saved for everyone, logged with Undo
          </>
        ) : savedAt ? (
          <>
            Saved <Ago date={savedAt} ch={8} /> · the next morning run re-scores at 6 AM ET, <Until date={nextRun(10)} ch={9} />
          </>
        ) : (
          "No unsaved changes"
        )}
      </span>
      <button className="btn" onClick={onDiscard} disabled={!count || busy} title="Throw away the unsaved changes">
        Discard
      </button>
      <button className="btn red" onClick={onSave} disabled={!count || busy || disabled} title="Save for everyone (⌘↩)">
        Save Changes<Kbd>⌘↩</Kbd>
      </button>
    </div>
  );
}

function useShared(initial: Record<string, unknown>, refresh: () => void) {
  const ui = useUI();
  const [draft, setDraft] = useState(initial);
  const [base, setBase] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const changed = Object.keys(draft).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(base[k]));
  const count = changed.reduce((n, k) => n + (typeof draft[k] === "object" && draft[k] && !Array.isArray(draft[k]) ? Object.keys(draft[k] as object).filter((x) => (draft[k] as any)[x] !== (base[k] as any)?.[x]).length : 1), 0);
  async function save() {
    setBusy(true);
    const r = await postJSON("/api/settings", { changes: Object.fromEntries(changed.map((k) => [k, draft[k]])) });
    setBusy(false);
    if (!r.ok) return ui.error("Settings didn't save", r.error || "The server did not answer.");
    setBase(draft);
    setSavedAt(Date.now());
    ui.toast(`${count} ${count === 1 ? "Change" : "Changes"} Saved`);
    refresh();
  }
  return { draft, setDraft, count, save, discard: () => setDraft(base), busy, savedAt };
}

function Scoring({ data, refresh }: { data: Data; refresh: () => void }) {
  const s = useShared({ scoreWeights: data.weights, worthThreshold: data.threshold }, refresh);
  const w = s.draft.scoreWeights as Record<string, number>;
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  return (
    <>
      <p className="sub">The thesis-fit score is computed every morning from these six parts, minus penalties. Votes nudge it by at most 15 points.</p>
      <Card title="Weights" note="Must add up to 100">
        {WLABEL.map(([k, l, sub]) => (
          <SliderRow key={k} label={l} sub={sub} value={w[k]} min={0} max={60} onChange={(n) => s.setDraft({ ...s.draft, scoreWeights: { ...w, [k]: n } })} />
        ))}
        <div className="total" data-testid="weights-total">
          <span>Total</span>
          <b className={sum === 100 ? "" : "bad"}>{sum}</b>
          {sum === 100 ? <Check className="ico" style={{ color: "var(--green)" }} /> : <span>Save stays off until the six add up to 100.</span>}
        </div>
      </Card>
      <Card title="Worth a Look">
        <SliderRow label="Threshold" sub="Companies at or above this score count as Worth a Look" value={s.draft.worthThreshold as number} min={20} max={90} onChange={(n) => s.setDraft({ ...s.draft, worthThreshold: n })} unit="%" />
      </Card>
      <Card title="Penalties" note="Fixed">
        <div className="rules">
          <div>
            <span className="pen">−10</span>
            <span>Competes with a portfolio company</span>
            <span />
          </div>
          <div>
            <span className="pen">−15</span>
            <span>Past Series A (Courtside&apos;s follow-on territory)</span>
            <span />
          </div>
          <div>
            <span className="pen">−20</span>
            <span>Not venture scale: agencies, services, single-location businesses</span>
            <span />
          </div>
          <div>
            <span className="pen plus">±15</span>
            <span>Learned from the team&apos;s votes</span>
            <span />
          </div>
        </div>
      </Card>
      <SaveBar count={s.count} onSave={s.save} onDiscard={s.discard} savedAt={s.savedAt} busy={s.busy} disabled={sum !== 100} />
    </>
  );
}

function ThesisPane({ data, refresh }: { data: Data; refresh: () => void }) {
  const s = useShared({ thesisQueries: data.queries, stage: data.stage }, refresh);
  const qs = s.draft.thesisQueries as string[];
  const st = s.draft.stage as { minCheck: number; maxCheck: number };
  return (
    <>
      <p className="sub">The five thesis areas are Sports, Gaming, Lifestyle, Health and Media. The thesis keyword search below runs against funding news every morning.</p>
      <Card title="Thesis Keyword Search">
        {qs.map((q, i) => (
          <div className="trow" key={i}>
            <input className="sinput" value={q} aria-label={`Query ${i + 1}`} onChange={(e) => s.setDraft({ ...s.draft, thesisQueries: qs.map((x, j) => (j === i ? e.target.value : x)) })} {...ATTRS} />
            <button className="btn" onClick={() => s.setDraft({ ...s.draft, thesisQueries: qs.filter((_, j) => j !== i) })} title="Remove this query">
              <Trash2 className="ico" />
              Remove
            </button>
          </div>
        ))}
        <button className="btn" onClick={() => s.setDraft({ ...s.draft, thesisQueries: [...qs, ""] })} title="Add a query">
          <Plus className="ico" />
          Add Query
        </button>
      </Card>
      <Card title="Stage and Check">
        <SliderRow label="Smallest first check" value={Math.round(st.minCheck / 100000) / 10} min={0} max={5} unit="$M" onChange={(n) => s.setDraft({ ...s.draft, stage: { ...st, minCheck: n * 1e6 } })} />
        <SliderRow label="Largest first check" value={Math.round(st.maxCheck / 100000) / 10} min={1} max={10} unit="$M" onChange={(n) => s.setDraft({ ...s.draft, stage: { ...st, maxCheck: n * 1e6 } })} />
      </Card>
      <SaveBar count={s.count} onSave={s.save} onDiscard={s.discard} savedAt={s.savedAt} busy={s.busy} />
    </>
  );
}

const SOURCE_NAMES = ["sec-index", "sec-latest-D", "sec-latest-C", "sec-search", "hn", "yc", "producthunt", "appstore", "google-news", "google-trends", "youtube", "podcasts", "courtside-medium", "fourth-quarter", "github", "gdelt"];
function Sources({ data, refresh }: { data: Data; refresh: () => void }) {
  const s = useShared({ extraSources: data.extra, sourcesOff: data.off }, refresh);
  const off = s.draft.sourcesOff as string[];
  const rows = [...new Set([...SOURCE_NAMES, ...data.health.map((h: any) => h.source)])];
  return (
    <>
      <p className="sub">Every source with its health: when it last answered, when it last failed, and when it is read next. A source that fails returns nothing and the site keeps its last good data.</p>
      <Card title="Extra Sources">
        <div className="trow">
          <span className="lbl">
            GitHub and GDELT<small>Slow, tightly rate-limited, and they add little for consumer deals. Off by default.</small>
          </span>
          <Toggle label="Extra sources" on={!!s.draft.extraSources} onChange={(v) => s.setDraft({ ...s.draft, extraSources: v })} />
        </div>
      </Card>
      <Card title="Health">
        {rows.map((src) => {
          const h = data.health.find((x: any) => x.source === src);
          const failing = h?.last_error && (!h.last_ok || h.last_error > h.last_ok);
          return (
            <div className="jobrow" key={src}>
              <b>{src}</b>
              <span>
                {h?.last_ok ? (
                  <>
                    OK <Ago date={h.last_ok} ch={8} />
                  </>
                ) : (
                  "Not read yet"
                )}
                {failing && (
                  <span className="err">
                    {" "}
                    · failed <Ago date={h.last_error} ch={8} /> ({h.error_text})
                  </span>
                )}
              </span>
              <span style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                <span>
                  next read <Until date={nextRun(9)} ch={9} />
                </span>
                {/^(youtube|podcasts|google-news|hn|yc|producthunt|appstore)$/.test(src) && (
                  <Toggle label={`Read ${src}`} on={!off.includes(src)} onChange={(v) => s.setDraft({ ...s.draft, sourcesOff: v ? off.filter((x) => x !== src) : [...off, src] })} />
                )}
              </span>
            </div>
          );
        })}
      </Card>
      <SaveBar count={s.count} onSave={s.save} onDiscard={s.discard} savedAt={s.savedAt} busy={s.busy} />
    </>
  );
}

const JOB_LIST: [string, string, number, number?][] = [
  ["funds-neighborhood", "Co-investor watch", 6],
  ["funds-synergistic", "Synergistic funder watch", 7],
  ["collect-media", "Creators and shows", 8],
  ["collect-signals", "Startup signals", 9],
  ["score", "Scoring", 10],
  ["alerts", "Alerts", 11],
  ["culture", "Culture", 12],
  ["trends", "Trends", 13],
  ["sponsors", "Sponsor Radar", 14],
  ["monday-brief", "Monday brief", 15, 1],
  ["weekly", "Weekly upkeep", 6, 0],
  ["refresh", "Refresh Now", -1],
];
function Jobs({ data }: { data: Data }) {
  const [runs, setRuns] = useState<any[]>(data.runs);
  const running = runs.some((r) => !r.finished_at && Date.now() - new Date(r.started_at).getTime() < 10 * 60 * 1000);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      const r = await getJSON<{ runs: any[] }>("/api/jobs");
      if (r.ok && r.data) setRuns(r.data.runs);
    }, 15_000);
    return () => clearInterval(t);
  }, [running]);
  return (
    <>
      <p className="sub">Every job runs once a day on Vercel&apos;s free plan (timing within the hour), time-boxed and resumable. This page updates every 15 seconds while a job runs.</p>
      <Card title="Jobs">
        {JOB_LIST.map(([id, label, h, wd]) => {
          const r = runs.find((x: any) => x.job === id);
          const live = r && !r.finished_at && Date.now() - new Date(r.started_at).getTime() < 10 * 60 * 1000;
          return (
            <div className="jobrow" key={id} data-job={id}>
              <b>{label}</b>
              <span>
                {live ? (
                  <span className="run">
                    running · <Clock since={r.started_at} /> · {r.stage}
                    {r.total ? ` · ${r.done} of ${r.total}` : ""}
                  </span>
                ) : r ? (
                  <>
                    last run <Ago date={r.finished_at || r.started_at} ch={8} /> · {r.items} items
                    {r.errors ? <span className="err"> · {r.errors} errors</span> : ""}
                  </>
                ) : (
                  "Not run yet"
                )}
              </span>
              <span>{h >= 0 ? <>next <Until date={nextRun(h, new Date(), wd)} ch={9} /></> : "on demand, once an hour"}</span>
            </div>
          );
        })}
      </Card>
    </>
  );
}

function Voices({ data, refresh }: { data: Data; refresh: () => void }) {
  const ui = useUI();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<any[]>(data.voices);
  useEffect(() => setList(data.voices), [data.voices]);
  async function add() {
    setBusy(true);
    const r = await postJSON<{ voice: any }>("/api/voices", { input });
    setBusy(false);
    if (!r.ok) return ui.error("That source wasn't added", r.error || "The server did not answer.");
    ui.toast(`${r.data!.voice.name} Added`);
    setInput("");
    refresh();
  }
  async function remove(v: any) {
    const ok = await ui.confirm({
      title: `Remove ${v.name}?`,
      facts: [
        ["Source", v.name],
        ["Stops", "reading its new episodes and videos"],
        ["Keeps", "everything already found from it"],
      ],
      consequence: "Everyone sees this change. It lands in the change log with Undo.",
      verb: "Remove",
      danger: true,
      icon: <Trash2 className="ico" />,
    });
    if (!ok) return;
    setList((l) => l.filter((x) => x.id !== v.id));
    const r = await fetch("/api/voices", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: v.id }) });
    if (!r.ok) {
      setList(data.voices);
      return ui.error(`${v.name} wasn't removed`, (await r.json().catch(() => ({}))).error || `${r.status}`);
    }
    ui.toast(`${v.name} Removed`);
  }
  return (
    <>
      <p className="sub">Paste a YouTube channel URL that contains /channel/UC…, a podcast name (looked up on Apple Podcasts) or any RSS URL. A show with no episode in the last 90 days can&apos;t be a source.</p>
      <Card title="Add a Creator or Show">
        <div className="trow">
          <input className="sinput" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && input && add()} placeholder="YouTube channel URL, podcast name or RSS URL" aria-label="New creator or show" {...ATTRS} />
          <button className="btn red" onClick={add} disabled={!input.trim() || busy} title="Check the source and add it for everyone">
            <Plus className="ico" />
            Add
          </button>
        </div>
      </Card>
      <Card title="Sources" note={`${list.filter((v) => v.status === "active").length} active`}>
        {list.map((v) => (
          <div className="trow" key={v.id}>
            <span className="lbl">
              {v.name}
              <small>
                {v.kind === "named" ? "Tracked by name" : v.status === "quiet" ? "Quiet: no episode in 90 days" : v.kind === "podcast" ? "Podcast" : "Creator"}
                {v.exempt ? " · always stays" : ""}
              </small>
            </span>
            {!v.exempt && (
              <button className="btn" onClick={() => remove(v)} title={`Remove ${v.name} from the sources`}>
                <Trash2 className="ico" />
                Remove
              </button>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}

function Funds({ data, refresh }: { data: Data; refresh: () => void }) {
  const ui = useUI();
  const [f, setF] = useState({ name: "", kind: "synergistic", focus: "broad" });
  const [list, setList] = useState<any[]>(data.funds);
  async function add() {
    const r = await postJSON("/api/funds", f);
    if (!r.ok) return ui.error("That fund wasn't added", r.error || "The server did not answer.");
    ui.toast(`${f.name} Added`);
    setF({ ...f, name: "" });
    refresh();
  }
  async function focus(x: any, v: string) {
    setList((l) => l.map((y) => (y.id === x.id ? { ...y, focus: v } : y)));
    const r = await fetch("/api/funds", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: x.id, focus: v }) });
    if (!r.ok) return ui.error("The focus tag didn't change", `${r.status}`);
    ui.toast(`${x.name} Is ${v === "specialist" ? "Specialist" : "Broad"}`);
  }
  async function remove(x: any) {
    const ok = await ui.confirm({ title: `Remove ${x.name}?`, facts: [["Fund", x.name], ["List", x.kind === "neighborhood" ? "Neighborhood" : "Synergistic Funders"]], consequence: "Its items stay in the change log; Undo puts the fund back.", verb: "Remove", danger: true, icon: <Trash2 className="ico" /> });
    if (!ok) return;
    setList((l) => l.filter((y) => y.id !== x.id));
    await fetch("/api/funds", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: x.id }) });
    ui.toast(`${x.name} Removed`);
  }
  return (
    <>
      <p className="sub">Specialist funds (sports, gaming, media, creators, consumer lifestyle) show every deal; broad funds only deals inside the thesis. When unsure, tag a fund broad.</p>
      <Card title="Add a Fund">
        <div className="trow" style={{ gridTemplateColumns: "minmax(0,1fr) auto auto auto" }}>
          <input className="sinput" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Fund name" aria-label="Fund name" {...ATTRS} />
          <Seg label="List" value={f.kind} opts={[["neighborhood", "Co-Investor"], ["synergistic", "Synergistic"]]} onChange={(v) => setF({ ...f, kind: v })} />
          <Seg label="Focus" value={f.focus} opts={[["specialist", "Specialist"], ["broad", "Broad"]]} onChange={(v) => setF({ ...f, focus: v })} />
          <button className="btn red" disabled={!f.name.trim()} onClick={add} title="Add this fund for everyone">
            <Plus className="ico" />
            Add
          </button>
        </div>
      </Card>
      {(["neighborhood", "synergistic"] as const).map((k) => (
        <Card key={k} title={k === "neighborhood" ? "Co-Investors" : "Synergistic Funders"} note={`${list.filter((x) => x.kind === k).length} funds`}>
          {list
            .filter((x) => x.kind === k)
            .map((x) => (
              <div className="trow" key={x.id}>
                <span className="lbl">{x.name}</span>
                <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <Seg label={`${x.name} focus`} value={x.focus} opts={[["specialist", "Specialist"], ["broad", "Broad"]]} onChange={(v) => focus(x, v)} />
                  <button className="btn" onClick={() => remove(x)} title={`Remove ${x.name}`}>
                    <Trash2 className="ico" />
                    Remove
                  </button>
                </span>
              </div>
            ))}
        </Card>
      ))}
    </>
  );
}

function Trackers({ data, refresh }: { data: Data; refresh: () => void }) {
  const ui = useUI();
  async function untrack(kind: string, id: number, name: string) {
    const r = await postJSON("/api/track", { kind, id, on: false });
    if (!r.ok) return ui.error("Untrack didn't save", r.error || "The server did not answer.");
    ui.toast(`${name.slice(0, 40)} Untracked`);
    refresh();
  }
  const Row = ({ kind, id, name, href }: { kind: string; id: number; name: string; href: string }) => (
    <div className="trow">
      <span className="lbl">
        <Link href={href}>{name}</Link>
      </span>
      <button className="btn" onClick={() => untrack(kind, id, name)} title={`Stop tracking ${name}`}>
        Untrack
      </button>
    </div>
  );
  return (
    <>
      <p className="sub">Tracked companies, trends (up to 30) and people get a daily check and a timeline.</p>
      <Card title="Companies" note={`${data.trackedCompanies.length} tracked`}>
        {data.trackedCompanies.length ? data.trackedCompanies.map((c: any) => <Row key={c.id} kind="company" id={c.id} name={c.name} href={`/company/${c.id}`} />) : <p className="sub">Press Track on any company to follow it here.</p>}
      </Card>
      <Card title="Trends" note={`${data.trackedTrends.length} of 30 tracked`}>
        {data.trackedTrends.length ? data.trackedTrends.map((t: any) => <Row key={t.id} kind="trend" id={t.id} name={t.headline} href="/trends" />) : <p className="sub">Press Track on any trend to follow it here.</p>}
      </Card>
      <Card title="People" note={<Link href="/people">Open People</Link>}>
        {data.people.map((p: any) => (
          <div className="trow" key={p.id}>
            <span className="lbl">{p.name}</span>
          </div>
        ))}
      </Card>
    </>
  );
}

function SlackPane({ data, refresh }: { data: Data; refresh: () => void }) {
  const ui = useUI();
  async function test() {
    const r = await postJSON("/api/slack/test", {});
    if (!r.ok) return ui.error("Slack didn't take the test message", r.error || "The server did not answer.", { label: "Reconnect Slack", href: "/api/slack/start" });
    ui.toast("Test Message Sent");
  }
  async function disconnect() {
    const ok = await ui.confirm({ title: "Disconnect Slack?", facts: [["Channel", data.slack?.channel || ""], ["Stops", "alert hits, the Monday brief and shared pages in Slack"]], consequence: "You can connect again any time.", verb: "Disconnect", danger: true });
    if (!ok) return;
    await postJSON("/api/slack/disconnect", {});
    ui.toast("Slack Disconnected");
    refresh();
  }
  return (
    <>
      <p className="sub">Optional. Alert hits, the Monday brief and UI problem reports can post to one Slack channel, plain and short, with links back to Scout.</p>
      <Card title="Slack">
        {data.slack ? (
          <>
            <p>
              Connected to <b>{data.slack.channel}</b>
              {data.slack.team ? ` in ${data.slack.team}` : ""} · <Ago date={data.slack.connectedAt} ch={8} />
            </p>
            <div className="acts2" style={{ justifyContent: "flex-start" }}>
              <button className="btn" onClick={test} title="Post a test message to the channel">
                <Send className="ico" />
                Send a Test Message
              </button>
              <button className="btn" onClick={disconnect} title="Remove the Slack connection">
                Disconnect
              </button>
            </div>
          </>
        ) : data.slackReady ? (
          <a className="btn red" href="/api/slack/start" title="Pick a channel in Slack and click Allow" style={{ width: "fit-content" }}>
            Add to Slack
          </a>
        ) : (
          <p>Slack takes about 4 clicks to set up, once. Ask your agent: set up Slack for Courtside Ventures Scout.</p>
        )}
      </Card>
    </>
  );
}

function AiPane({ data, refresh }: { data: Data; refresh: () => void }) {
  const ui = useUI();
  const s = useShared({ aiDailyCap: data.cap }, refresh);
  return (
    <>
      <p className="sub">AI is a bonus, never a requirement: every section of Today works without it.</p>
      <Card title={`AI Drafting · ${data.ai ? "On" : "Off"} · Optional`}>
        <p>Memo drafts, smart summaries and plain-English alerts run on Vercel&apos;s free AI credit. Vercel asks for a card on file to switch it on; nothing is charged on the free credit. Everything else already works without it.</p>
        {!data.ai && (
          <button className="btn red" onClick={ui.aiCard} title="See what turning on AI drafting involves" style={{ width: "fit-content" }}>
            <Sparkles className="ico" />
            Turn On AI Drafting
          </button>
        )}
        <SliderRow label="Daily cap" sub="AI calls a day, at most" value={s.draft.aiDailyCap as number} min={10} max={500} onChange={(n) => s.setDraft({ aiDailyCap: n })} />
      </Card>
      <SaveBar count={s.count} onSave={s.save} onDiscard={s.discard} savedAt={s.savedAt} busy={s.busy} />
    </>
  );
}

function FeedbackPane({ data, refresh }: { data: Data; refresh: () => void }) {
  const ui = useUI();
  async function patch(id: number, body: object, msg: string) {
    const r = await fetch("/api/feedback", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    if (!r.ok) return ui.error("That didn't save", `${r.status}`);
    ui.toast(msg);
    refresh();
  }
  return (
    <>
      <p className="sub">Reports from &quot;Flag a UI problem&quot; (the footer link, ⌘K or the ! key), each with the page, the element, the viewport, theme and browser.</p>
      <Card title="Reports" note={`${data.feedback.length} reports`}>
        {data.feedback.length ? (
          data.feedback.map((f: any) => (
            <div className="trow" key={f.id}>
              <span className="lbl">
                {f.chips.join(", ") || "Report"} on {f.page}
                <small>
                  {f.note ? `"${f.note}" · ` : ""}
                  {f.element} · <Ago date={f.createdAt} ch={8} /> · {f.meToo} me too · {f.status}
                </small>
              </span>
              <span style={{ display: "flex", gap: 6 }}>
                <button className="btn" onClick={() => patch(f.id, { action: "metoo" }, "Me Too Added")} title="Add a me too">
                  Me Too
                </button>
                {f.status === "open" && (
                  <button className="btn" onClick={() => patch(f.id, { status: "fixed" }, "Marked Fixed")} title="Mark this report fixed">
                    Mark Fixed
                  </button>
                )}
              </span>
            </div>
          ))
        ) : (
          <p className="sub">No reports yet.</p>
        )}
      </Card>
    </>
  );
}

function Phase2Pane() {
  const ui = useUI();
  return (
    <>
      <p className="sub">Phase I is this prototype: built by Adrian alone, on free public sources, to start a conversation with Courtside. Phase II is the production-ready version Adrian and Courtside build together, should they decide to.</p>
      <Card title="Phase II · Built Together">
        {PHASE2_ITEMS.map(([door, text], i) => (
          <div className="trow" key={i}>
            <span className="lbl">{text}</span>
            <button className="lock-chip" onClick={() => ui.door(door)} title="Phase II: built together, if Courtside and Adrian work together">
              <Lock className="ico" style={{ width: 13, height: 13 }} />
              Phase II
            </button>
          </div>
        ))}
        <a className="btn red" href={ADRIAN_LINKEDIN} target="_blank" rel="noopener noreferrer" title="Opens Adrian Grant on LinkedIn in a new window" style={{ width: "fit-content" }} data-talk>
          Talk to Adrian
        </a>
      </Card>
    </>
  );
}

function LogPane({ data, refresh }: { data: Data; refresh: () => void }) {
  const ui = useUI();
  async function undo(id: number) {
    const r = await postJSON<{ summary: string }>("/api/undo", { id });
    if (!r.ok) return ui.error("Undo didn't work", r.error || "The server did not answer.");
    ui.toast("Change Undone");
    refresh();
  }
  return (
    <>
      <p className="sub">Every shared change, newest first. Scout has no sign-in, so the log names the change and the time, never a person.</p>
      <Card title="Change Log">
        <div className="log">
          {data.log.map((l: any) => (
            <div key={l.id}>
              <span className="ago2">
                <Ago date={l.createdAt} ch={8} />
              </span>
              <span>{l.summary}</span>
              {l.undone ? (
                <span className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>
                  Undone
                </span>
              ) : (
                <button className="undo" onClick={() => undo(l.id)} title="Put this back the way it was">
                  <Undo2 className="ico" style={{ width: 12, height: 12 }} /> Undo
                </button>
              )}
            </div>
          ))}
          {!data.log.length && <p className="sub">No shared changes yet.</p>}
        </div>
      </Card>
    </>
  );
}
