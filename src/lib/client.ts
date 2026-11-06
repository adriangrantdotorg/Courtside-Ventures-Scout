// Small fetch helpers for client components. Never throws: callers show an error card on !ok.
export type Res<T = unknown> = { ok: boolean; error?: string; data?: T; status?: number };

export async function postJSON<T = unknown>(url: string, body: unknown): Promise<Res<T>> {
  return sendJSON<T>("POST", url, body);
}

/** A POST that only READS (the live vote counts, a backtest's lookup step, Slack's test message): it never announces a
 *  save, or every page load would refresh itself and load the counts again, forever. tests/unit/rules.test.ts keeps the
 *  read routes here. */
export async function readJSON<T = unknown>(url: string, body: unknown): Promise<Res<T>> {
  return sendJSON<T>("POST", url, body, { read: true });
}

/** Every save goes through sendJSON, and a save that worked says so: the Shell then drops the browser's own copies of
 *  the pages, so the next page shows the change. The server's copy was already refreshed by the route's
 *  revalidatePath; the browser's was not (11-06-26). tests/unit/rules.test.ts fails on a save made with a bare fetch. */
export const CHANGED = "scout:changed";
export function changed() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED));
}

/** postJSON for any method: a PATCH or DELETE gets the same Res, so it can go through ui.undoable too. */
export async function sendJSON<T = unknown>(method: "POST" | "PATCH" | "DELETE", url: string, body: unknown, opts: { read?: boolean } = {}): Promise<Res<T>> {
  try {
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, error: j.error || `${r.status} ${r.statusText}` };
    if (!opts.read) changed();
    return { ok: true, data: j as T, status: r.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getJSON<T = unknown>(url: string): Promise<Res<T>> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, error: j.error || `${r.status} ${r.statusText}` };
    return { ok: true, data: j as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Copies text to the clipboard; the last copy is kept on window for the browser tests to read. */
export async function copyText(text: string) {
  (window as { __lastCopied?: string }).__lastCopied = text;
  await navigator.clipboard.writeText(text);
}

export function download(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
