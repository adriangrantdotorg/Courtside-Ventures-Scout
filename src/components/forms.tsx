"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { useUI } from "./ui";
import { postJSON } from "@/lib/client";

const ATTRS = { autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false } as const;

export function AddPerson() {
  const ui = useUI();
  const router = useRouter();
  const [f, setF] = useState({ name: "", youtube: "", blog: "", github: "" });
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    setBusy(true);
    const r = await postJSON("/api/people", f);
    setBusy(false);
    if (!r.ok) return ui.error("That person wasn't added", r.error || "The server did not answer.");
    ui.toast(`${f.name} Tracked`);
    setF({ name: "", youtube: "", blog: "", github: "" });
    router.refresh();
  }
  return (
    <form className="scard" onSubmit={save} aria-label="Track a person">
      <h3>Track a Person</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
        <input className="sinput" placeholder="Name" aria-label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} {...ATTRS} />
        <input className="sinput" placeholder="YouTube channel URL (optional)" aria-label="YouTube channel URL" value={f.youtube} onChange={(e) => setF({ ...f, youtube: e.target.value })} {...ATTRS} />
        <input className="sinput" placeholder="Medium or Substack URL (optional)" aria-label="Medium or Substack URL" value={f.blog} onChange={(e) => setF({ ...f, blog: e.target.value })} {...ATTRS} />
        <input className="sinput" placeholder="GitHub user (optional)" aria-label="GitHub user" value={f.github} onChange={(e) => setF({ ...f, github: e.target.value })} {...ATTRS} />
      </div>
      <div className="acts2" style={{ justifyContent: "flex-start" }}>
        <button className="btn red" disabled={!f.name.trim() || busy} title="Start a daily check of this person's public posts and appearances">
          <Plus className="ico" />
          Track Person
        </button>
      </div>
    </form>
  );
}

export function NewAlert({ ai }: { ai: boolean }) {
  const ui = useUI();
  const router = useRouter();
  const [f, setF] = useState({ subject: "", event: "mention", keywords: "" });
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await postJSON("/api/alerts", f);
    setBusy(false);
    if (!r.ok) return ui.error("The alert wasn't saved", r.error || "The server did not answer.");
    ui.toast("Alert Saved");
    setF({ subject: "", event: "mention", keywords: "" });
    router.refresh();
  }
  return (
    <form className="scard" id="new" onSubmit={save} aria-label="New alert">
      <h3>
        New Alert
        {!ai && (
          <button type="button" className="ai-chip" style={{ marginLeft: "auto" }} onClick={ui.aiCard} title="Plain-English alerts are an AI feature; see what it adds">
            <Sparkles className="ico" />
            AI · Unlock
          </button>
        )}
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
        <input className="sinput" placeholder="Who or what (a person, company or word)" aria-label="Who or what" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} {...ATTRS} />
        <label className="fsel" style={{ minHeight: 44 }}>
          Event
          <select value={f.event} onChange={(e) => setF({ ...f, event: e.target.value })} aria-label="Event">
            <option value="mention">Is mentioned</option>
            <option value="funding">Raises money</option>
            <option value="formd">Files a Form D</option>
            <option value="launch">Launches something new</option>
          </select>
        </label>
        <input className="sinput" placeholder="Keywords, comma separated (optional)" aria-label="Keywords" value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} {...ATTRS} />
      </div>
      <div className="acts2" style={{ justifyContent: "flex-start" }}>
        <button className="btn red" disabled={busy || (!f.subject.trim() && !f.keywords.trim())} title="Save the rule; Scout checks it once a day against everything new">
          <Plus className="ico" />
          Save Alert
        </button>
      </div>
    </form>
  );
}

export function AlertToggle({ id, active }: { id: number; active: boolean }) {
  const ui = useUI();
  const [on, setOn] = useState(active);
  async function flip() {
    setOn(!on);
    const r = await fetch("/api/alerts", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, active: !on }) }).then((x) => ({ ok: x.ok, error: x.ok ? undefined : `${x.status}` })).catch((e) => ({ ok: false, error: String(e) }));
    if (!r.ok) {
      setOn(on);
      ui.error("The alert didn't change", r.error || "The server did not answer.");
    } else ui.toast(`Alert ${!on ? "On" : "Off"}`);
  }
  return <button className="tog" role="switch" aria-checked={on} aria-label="Alert on or off" title={on ? "Turn this alert off" : "Turn this alert on"} onClick={flip} />;
}
