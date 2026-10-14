"use client";

// Anything added on the Tracking page appears in its list the moment the server says yes, and the tab's count
// moves with it. No reload, no "on the next visit" (Adrian, 10-14-26).
import { createContext, useContext, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Tabs } from "./Tabs";
import { AddPerson, NewAlert } from "./forms";

export type AddedItem = { id: number; title: string; sub?: string };
type Kind = "companies" | "trends" | "people" | "rules";
type Ctx = { items: Record<Kind, AddedItem[]>; add: (kind: Kind, item: AddedItem) => void };
const AddedCtx = createContext<Ctx | null>(null);

export function AddedProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Record<Kind, AddedItem[]>>({ companies: [], trends: [], people: [], rules: [] });
  const add = (kind: Kind, item: AddedItem) => setItems((x) => ({ ...x, [kind]: [item, ...x[kind].filter((i) => i.id !== item.id)] }));
  return <AddedCtx.Provider value={{ items, add }}>{children}</AddedCtx.Provider>;
}

export function useAdded(): Ctx {
  const v = useContext(AddedCtx);
  if (!v) throw new Error("useAdded outside AddedProvider");
  return v;
}

/** The Tracking tabs, with each count raised by what was added in this visit. */
export function TrackingTabs({ tabs, children }: { tabs: { id: string; label: string; count: number }[]; children: ReactNode[] }) {
  const { items } = useAdded();
  return <Tabs tabs={tabs.map((t) => ({ ...t, count: t.count + (items[t.id as Kind]?.length || 0) }))}>{children}</Tabs>;
}

/** The rows added in this visit, newest first, above the server's list. */
export function AddedList({ kind }: { kind: Kind }) {
  const { items } = useAdded();
  const list = items[kind];
  if (!list.length) return null;
  return (
    <div className="list" data-added={kind}>
      {list.map((i) => (
        <article className="rowcard" key={i.id} data-item data-added-item>
          <div style={{ minWidth: 0 }}>
            <h3 style={kind === "rules" || kind === "trends" ? { textTransform: "none", letterSpacing: 0, fontFamily: "Montserrat, sans-serif", fontSize: 17 } : undefined}>{i.title}</h3>
            <div className="meta">
              {i.sub && <span>{i.sub}</span>}
              <span style={{ color: "var(--green)" }}>added just now</span>
              <span>{kind === "rules" ? "On · checked every morning" : "Scout checks it every morning"}</span>
            </div>
          </div>
          {kind !== "rules" && (
            <button className="btn track" aria-pressed="true" disabled title="Tracking">
              <Check className="ico" />
              Tracking
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

export function AddPersonAdded() {
  const { add } = useAdded();
  return <AddPerson onAdded={(p) => add("people", { id: p.id, title: p.name, sub: p.role || undefined })} />;
}

export function NewAlertAdded({ ai }: { ai: boolean }) {
  const { add } = useAdded();
  return <NewAlert ai={ai} onAdded={(a) => add("rules", { id: a.id, title: a.title })} />;
}
