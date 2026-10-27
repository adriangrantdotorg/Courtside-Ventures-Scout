"use client";

import { useState } from "react";
import { Copy, Download, LockOpen, Sparkles } from "lucide-react";
import { useUI } from "./ui";
import { Ago, Clock } from "./Live";
import { AiChip } from "./cards";
import { postJSON, getJSON, download } from "@/lib/client";

type Note = { id: number; body: string; createdAt: string };

export function CompanyNotes({ companyId, name, initial }: { companyId: number; name: string; initial: Note[] }) {
  const ui = useUI();
  const [notes, setNotes] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    if (!text.trim() || busy) return;
    setBusy(true);
    const r = await ui.undoable("Note", postJSON<{ note: Note }>("/api/note", { companyId, body: text }), async (r) => {
      const id = r.data!.note.id;
      setNotes((n) => n.filter((x) => x.id !== id));
      await fetch("/api/note", { method: "DELETE", body: JSON.stringify({ id }) });
    });
    setBusy(false);
    if (!r.ok) return ui.error("The note didn't save", r.error || "The server did not answer.");
    setNotes((n) => [r.data!.note, ...n]);
    setText("");
    ui.toast("Note Added");
  }
  return (
    <section className="sec" id="notes" aria-label="Team Notes">
      <div className="h">
        <h2>Team Notes</h2>
        <span className="note-h">Everyone sees these</span>
      </div>
      <div className="notes">
        <div className="noteadd">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && add()}
            placeholder={`Add a note on ${name}`}
            aria-label={`Add a note on ${name}`}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn" onClick={add} disabled={!text.trim() || busy} title="Save the note for everyone (⌘↩)">
            Add Note
          </button>
        </div>
        {notes.map((n) => (
          <div className="note" key={n.id}>
            {n.body}
            <div className="who">
              Team note · <Ago date={n.createdAt} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MemoPanel({ id, name, ai }: { id: number; name: string; ai: boolean }) {
  const ui = useUI();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [since, setSince] = useState<number | null>(null);
  async function outline(): Promise<string | null> {
    const r = await getJSON<{ markdown: string }>(`/api/memo/${id}`);
    if (!r.ok || !r.data) {
      ui.error("The outline didn't load", r.error || "The server did not answer.");
      return null;
    }
    return r.data.markdown;
  }
  async function copy() {
    const md = await outline();
    if (!md) return;
    try {
      await navigator.clipboard.writeText(md);
      ui.toast("Outline Copied");
    } catch {
      download(`${name} investment memo outline.md`, md, "text/markdown");
      ui.toast("Outline Downloaded");
    }
  }
  async function dl() {
    const md = draft || (await outline());
    if (!md) return;
    download(`${name} investment memo${draft ? "" : " outline"}.md`, md, "text/markdown");
    ui.toast(".md Downloaded");
  }
  async function aiDraft() {
    setBusy(true);
    setSince(Date.now());
    const r = await postJSON<{ markdown: string }>(`/api/memo/${id}`, {});
    setBusy(false);
    setSince(null);
    if (r.status === 429) return ui.error("Today's AI drafts are used", r.error || "Copy the outline instead.");
    if (!r.ok) return ui.error("The draft didn't come back", r.error || "Copy the outline instead.");
    setDraft(r.data!.markdown);
    ui.toast("Draft Ready");
  }
  return (
    <section className="memo" id="memo" aria-label="Draft Investment Memo">
      <h3>
        Draft Investment Memo
        {!ai && <AiChip />}
      </h3>
      {ai ? (
        <p>A first draft in Courtside&apos;s &quot;Why We Invested&quot; voice, built from every fact and link Scout has. Every number keeps its source.</p>
      ) : (
        <p>Scout fills Courtside&apos;s eight-part memo outline with every fact and link it has on {name}. Copy it, paste it into your AI, and you have a first draft in a minute.</p>
      )}
      <div className="row">
        {ai ? (
          <button className="btn" onClick={aiDraft} disabled={busy} title="Writes a first draft here in Courtside's voice">
            <Sparkles className="ico" />
            {busy ? (
              <>
                Drafting · <Clock since={since} />
              </>
            ) : (
              "Draft the Memo"
            )}
          </button>
        ) : (
          <button className="btn" onClick={copy} title="Copies the eight-part outline, filled in, for your AI">
            <Copy className="ico" />
            Copy the Outline for Your AI
          </button>
        )}
        <button className="btn" onClick={dl} title="Downloads the outline as a Markdown file">
          <Download className="ico" />
          Download .md
        </button>
      </div>
      {!ai && (
        <p className="tip">
          <LockOpen className="ico" />
          Unlock AI in Settings and Scout writes the draft right here.
        </p>
      )}
      {draft && (
        <>
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>Draft for internal discussion. Verify every figure.</p>
          <pre>{draft}</pre>
        </>
      )}
    </section>
  );
}
