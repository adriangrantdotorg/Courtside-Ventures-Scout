// Every outbound request goes through here: one User-Agent, per-host manners, a timeout,
// and source health. A failing source returns null; it never throws into a job.
import { sql } from "drizzle-orm";
import { db, hasDb } from "@/db";

const SITE = () => process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "local");
export const UA = () => `CourtsideVenturesScout/1.0 (+${SITE()})`;
const SEC_UA = () => `CourtsideVenturesScout/1.0 ${process.env.SEC_CONTACT_EMAIL || "hello@courtsidevc.com"}`;

// minimum gap between requests to the same host, in ms
const GAP: Record<string, number> = {
  "www.sec.gov": 120,
  "efts.sec.gov": 150,
  "news.google.com": 2000,
  "api.gdeltproject.org": 5100,
  "api.github.com": 6100,
  "www.youtube.com": 400,
  "itunes.apple.com": 300,
  "web.archive.org": 1000,
};
const lastHit = new Map<string, number>();
const blockedUntil = new Map<string, number>();

async function politeWait(host: string) {
  const gap = GAP[host] ?? 200;
  const last = lastHit.get(host) || 0;
  const wait = last + gap - Date.now();
  lastHit.set(host, Math.max(Date.now(), last + gap));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

export type FetchOpts = { timeoutMs?: number; accept?: string; source?: string };
export type FetchResult = { ok: boolean; status: number; text: string; error?: string };

// tests swap this out
export const transport: { fetch: typeof fetch } = { fetch: (...a) => fetch(...a) };

export async function fetchRaw(url: string, o: FetchOpts = {}): Promise<FetchResult> {
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    return { ok: false, status: 0, text: "", error: "bad url" };
  }
  if ((blockedUntil.get(host) || 0) > Date.now()) return { ok: false, status: 429, text: "", error: "backing off" };
  await politeWait(host);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), o.timeoutMs ?? 12_000);
  try {
    const r = await transport.fetch(url, {
      signal: ctl.signal,
      headers: { "user-agent": host.endsWith("sec.gov") ? SEC_UA() : UA(), accept: o.accept || "*/*" },
      redirect: "follow",
      cache: "no-store",
    });
    const text = await r.text();
    if (r.status === 429 || (host === "www.youtube.com" && r.status === 404 && url.includes("feeds/videos.xml"))) {
      blockedUntil.set(host, Date.now() + (host === "www.youtube.com" ? 60_000 : 120_000));
    }
    return { ok: r.ok, status: r.status, text, error: r.ok ? undefined : `${r.status}` };
  } catch (e) {
    return { ok: false, status: 0, text: "", error: e instanceof Error ? (e.name === "AbortError" ? "timeout" : e.message) : String(e) };
  } finally {
    clearTimeout(t);
  }
}

/** An image's bytes, for Brand Sky's measurements: 2xx with an image type, at most `maxBytes`; null otherwise. */
export async function fetchImage(url: string, maxBytes = 8_000_000, timeoutMs = 10_000): Promise<Buffer | null> {
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    return null;
  }
  await politeWait(host);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await transport.fetch(url, { signal: ctl.signal, headers: { "user-agent": UA(), accept: "image/*" }, redirect: "follow", cache: "no-store" });
    if (!r.ok || !(r.headers.get("content-type") || "").toLowerCase().startsWith("image/")) return null;
    if (Number(r.headers.get("content-length") || 0) > maxBytes) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length && buf.length <= maxBytes ? buf : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Does this picture or video still load? A HEAD (or, where a host refuses HEAD, a one-byte GET) that must answer
 *  2xx with an image or video type. A page's own tags can name another host whose files are gone: Helios's og:image
 *  pointed at myhelios.com, a 404, and the Must See masthead showed a blank letter tile (10-30-26). */
export async function mediaLoads(url: string, kind: "image" | "video", timeoutMs = 6000): Promise<boolean> {
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    return false;
  }
  const ask = async (method: "HEAD" | "GET") => {
    await politeWait(host);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await transport.fetch(url, {
        method,
        signal: ctl.signal,
        headers: { "user-agent": UA(), accept: `${kind}/*`, ...(method === "GET" ? { range: "bytes=0-0" } : {}) },
        redirect: "follow",
        cache: "no-store",
      });
      if (method === "GET") ctl.abort(); // the body is never needed
      return r;
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  };
  let r = await ask("HEAD");
  if (r && [403, 405, 501].includes(r.status)) r = await ask("GET");
  if (!r || !(r.ok || r.status === 206)) return false;
  const type = (r.headers.get("content-type") || "").toLowerCase();
  return type.startsWith(`${kind}/`) || (kind === "video" && type.startsWith("application/octet-stream"));
}

export async function fetchText(url: string, o: FetchOpts = {}): Promise<string | null> {
  const r = await fetchRaw(url, o);
  if (o.source) await health(o.source, r.ok, r.ok ? 1 : 0, r.error);
  return r.ok ? r.text : null;
}

export async function fetchJSON<T = unknown>(url: string, o: FetchOpts = {}): Promise<T | null> {
  const t = await fetchText(url, { ...o, accept: "application/json" });
  if (t === null) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    if (o.source) await health(o.source, false, 0, "malformed JSON");
    return null;
  }
}

/** Source health: last OK, last error, items. Silent if there is no database (tests, scripts). */
export async function health(source: string, ok: boolean, items = 0, error?: string) {
  if (!hasDb()) return;
  try {
    if (ok)
      await db().execute(sql`insert into source_health (source, last_ok, items, updated_at) values (${source}, now(), ${items}, now())
        on conflict (source) do update set last_ok = now(), items = excluded.items, updated_at = now()`);
    else
      await db().execute(sql`insert into source_health (source, last_error, error_text, updated_at) values (${source}, now(), ${error || "error"}, now())
        on conflict (source) do update set last_error = now(), error_text = excluded.error_text, updated_at = now()`);
  } catch {
    /* health is best-effort */
  }
}

/** Tests start each case with clean manners. */
export function resetBackoff() {
  blockedUntil.clear();
  lastHit.clear();
}
