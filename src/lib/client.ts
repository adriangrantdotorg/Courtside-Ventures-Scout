// Small fetch helpers for client components. Never throws: callers show an error card on !ok.
export type Res<T = unknown> = { ok: boolean; error?: string; data?: T; status?: number };

export async function postJSON<T = unknown>(url: string, body: unknown): Promise<Res<T>> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, error: j.error || `${r.status} ${r.statusText}` };
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
