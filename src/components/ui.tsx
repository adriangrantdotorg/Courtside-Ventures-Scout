"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, TriangleAlert, Lock, Sparkles, ArrowRightFromLine } from "lucide-react";
import { DOORS, ADRIAN_LINKEDIN } from "@/lib/phase2";
import { Ago } from "./Live";

type Toast = { id: number; text: string; fading?: boolean };
type ErrCard = { id: number; title: string; message: string; at: number; count: number; fix?: { label: string; href: string } };
export type ConfirmOpts = {
  title: string;
  facts: [string, string][];
  consequence: string;
  verb: string;
  danger?: boolean;
  icon?: ReactNode;
};
type UndoEntry = { label: string; run: () => Promise<void> | void };

type UI = {
  toast: (text: string) => void;
  error: (title: string, message: string, fix?: { label: string; href: string }) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  door: (key: string) => void;
  aiCard: () => void;
  openPalette: () => void;
  openSheet: () => void;
  startFlag: () => void;
  pushUndo: (e: UndoEntry) => void;
  undo: () => Promise<boolean>;
  overlayOpen: boolean;
};

const Ctx = createContext<UI | null>(null);
export function useUI(): UI {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUI outside provider");
  return v;
}

/** One primitive for every overlay: veil, focus trap, Esc, ⌘↩. The page behind is inert. */
export function Overlay({
  onClose,
  onSubmit,
  className,
  label,
  children,
  testid,
}: {
  onClose: () => void;
  onSubmit?: () => void;
  className: string;
  label: string;
  children: ReactNode;
  testid?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.getElementById("app-root");
    root?.setAttribute("inert", "");
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("[autofocus], input, textarea, button.btn.red, button, a[href]");
    first?.focus();
    return () => {
      root?.removeAttribute("inert");
      prev?.focus?.();
    };
  }, []);
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit) {
      e.preventDefault();
      e.stopPropagation();
      onSubmit();
      return;
    }
    if (e.key === "Tab" && ref.current) {
      const f = Array.from(ref.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, textarea, select, [tabindex='0']"));
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && i === f.length - 1) {
        e.preventDefault();
        f[0].focus();
      }
    }
    e.stopPropagation();
  }
  return (
    <>
      <div className="veil" onClick={onClose} />
      <div ref={ref} className={"ov " + className} role="dialog" aria-modal="true" aria-label={label} onKeyDown={onKey} data-testid={testid}>
        {children}
      </div>
    </>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="k">{children}</span>;
}

export function UIProvider({ children, palette, sheet, flag }: { children: ReactNode; palette: (close: () => void) => ReactNode; sheet: (close: () => void) => ReactNode; flag: (stop: () => void) => ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [errors, setErrors] = useState<ErrCard[]>([]);
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [doorKey, setDoorKey] = useState<string | null>(null);
  const [ai, setAi] = useState(false);
  const [pal, setPal] = useState(false);
  const [sh, setSh] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const undoStack = useRef<UndoEntry[]>([]);
  const seq = useRef(0);

  const toast = useCallback((text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, text }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, fading: true } : x))), 2600);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3100);
  }, []);
  const error = useCallback((title: string, message: string, fix?: { label: string; href: string }) => {
    setErrors((e) => {
      const same = e.find((x) => x.title === title && x.message === message);
      if (same) return e.map((x) => (x === same ? { ...x, count: x.count + 1, at: Date.now() } : x));
      return [...e, { id: ++seq.current, title, message, at: Date.now(), count: 1, fix }];
    });
  }, []);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })), []);
  const pushUndo = useCallback((e: UndoEntry) => {
    undoStack.current.push(e);
    if (undoStack.current.length > 30) undoStack.current.shift();
  }, []);
  const undo = useCallback(async () => {
    const e = undoStack.current.pop();
    if (!e) return false;
    await e.run();
    toast(`${e.label} Undone`);
    return true;
  }, [toast]);

  const overlayOpen = !!dlg || !!doorKey || ai || pal || sh;
  const ui: UI = {
    toast,
    error,
    confirm,
    door: setDoorKey,
    aiCard: () => setAi(true),
    openPalette: () => setPal(true),
    openSheet: () => setSh(true),
    startFlag: () => setFlagging(true),
    pushUndo,
    undo,
    overlayOpen,
  };

  const door = doorKey ? DOORS[doorKey] || DOORS.realtime : null;
  function closeDlg(v: boolean) {
    dlg?.resolve(v);
    setDlg(null);
  }

  return (
    <Ctx.Provider value={ui}>
      <div id="app-root">{children}</div>
      <div className="toasts" aria-live="polite">
        {errors.map((e) => (
          <div className="errc" role="alert" key={e.id} data-testid="error-card">
            <div className="h2">
              <TriangleAlert className="ico2" />
              {e.title}
              <button className="cl" title="Close this message" aria-label="Close this message" onClick={() => setErrors((x) => x.filter((y) => y.id !== e.id))}>
                <svg viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" /></svg>
              </button>
            </div>
            <pre>{e.message}</pre>
            <div className="ft">
              <Ago date={e.at} />
              {e.count > 1 && <span className="n">×{e.count}</span>}
              <button className="btn" title="Copy the whole message" onClick={() => navigator.clipboard?.writeText(`${e.title}\n${e.message}`).then(() => toast("Details Copied"))}>
                Copy Details
              </button>
              {e.fix && (
                <a className="btn" href={e.fix.href} title={e.fix.label}>
                  {e.fix.label}
                </a>
              )}
            </div>
          </div>
        ))}
        {toasts.map((t) => (
          <div className={"toast" + (t.fading ? " fade" : "")} key={t.id} data-testid="toast">
            <Check className="ico2" strokeWidth={2.5} />
            {t.text}
          </div>
        ))}
      </div>
      {dlg && (
        <Overlay className={"dlg" + (dlg.danger ? " danger" : "")} label={dlg.title} onClose={() => closeDlg(false)} onSubmit={() => closeDlg(true)} testid="dialog">
          <div className="hd">
            <div className="tile">{dlg.icon || <ArrowRightFromLine className="ico" />}</div>
            <h2>{dlg.title}</h2>
          </div>
          <dl className="facts2">
            {dlg.facts.map(([k, v]) => (
              <FactRow key={k} k={k} v={v} />
            ))}
          </dl>
          <p>{dlg.consequence}</p>
          <div className="acts2">
            <button className="btn" title="Close without changing anything (Esc)" onClick={() => closeDlg(false)}>
              Cancel<Kbd>Esc</Kbd>
            </button>
            <button className={"btn" + (dlg.danger ? " red" : " red")} title={`${dlg.verb} (⌘↩)`} onClick={() => closeDlg(true)} autoFocus>
              {dlg.verb}
              <Kbd>⌘↩</Kbd>
            </button>
          </div>
        </Overlay>
      )}
      {door && (
        <Overlay className="door" label={`${door.title} is Phase II`} onClose={() => setDoorKey(null)} testid="door">
          <div className="band2">
            <span className="lk">
              <Lock className="ico" style={{ width: 14, height: 14 }} />
              Phase II · if we work together
            </span>
            <h2>{door.title}</h2>
            <span style={{ fontSize: 15 }}>{door.today}</span>
          </div>
          <div className="bd">
            <p>
              Scout is a working prototype Adrian built to start a conversation with Courtside. Everything you see runs today. This feature is one that gets built if Courtside and Adrian decide to work
              together.
            </p>
            <div className="cols">
              <div>
                <b>Phase I · the prototype, running now</b>
                <ul>
                  {door.now.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <b>Phase II · built together</b>
                <ul>
                  {door.later.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="acts2">
              <span className="why2">Phase I: a quick prototype. Phase II: production-ready, built by Adrian and Courtside together.</span>
              <button className="btn" title="Close (Esc)" onClick={() => setDoorKey(null)}>
                Cancel<Kbd>Esc</Kbd>
              </button>
              <a className="btn red" href={ADRIAN_LINKEDIN} target="_blank" rel="noopener noreferrer" title="Opens Adrian Grant on LinkedIn in a new window" data-talk>
                Talk to Adrian
              </a>
            </div>
          </div>
        </Overlay>
      )}
      {ai && (
        <Overlay className="dlg" label="Turn on AI drafting" onClose={() => setAi(false)} testid="dialog">
          <div className="hd">
            <div className="tile">
              <Sparkles className="ico" />
            </div>
            <h2>Turn on AI Drafting</h2>
          </div>
          <p>
            Memo drafts, smart summaries and plain-English alerts run on Vercel&apos;s free AI credit. Vercel asks for a card on file to switch it on; nothing is charged on the free credit. Everything else
            already works without it.
          </p>
          <div className="acts2">
            <button className="btn" title="Close (Esc)" onClick={() => setAi(false)}>
              Maybe Later<Kbd>Esc</Kbd>
            </button>
            <a className="btn red" href="https://vercel.com/ai-gateway" target="_blank" rel="noopener noreferrer" title="Opens Vercel's AI Gateway page in a new window">
              Turn On in Vercel
            </a>
          </div>
        </Overlay>
      )}
      {pal && palette(() => setPal(false))}
      {sh && sheet(() => setSh(false))}
      {flagging && flag(() => setFlagging(false))}
    </Ctx.Provider>
  );
}

function FactRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  );
}

export function ClearX({ show, onClear }: { show: boolean; onClear: () => void }) {
  return (
    <button type="button" className="clear-x" hidden={!show} title="Clear search (Esc)" aria-label="Clear search" onMouseDown={(e) => e.preventDefault()} onClick={onClear}>
      <svg viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" /></svg>
    </button>
  );
}
