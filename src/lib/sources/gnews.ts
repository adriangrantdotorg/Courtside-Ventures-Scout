// Google News links → the article's own address. Since 2024 Google's links (`news.google.com/rss/articles/CBMi…`)
// hold only an id, not the address: on 11-06-26, 0 of the 521 saved in Scout decoded on their own, so a memo's
// Sources were long redirect links. Google's own redirect page carries a signature that its `batchexecute` call trades
// for the address. That call is not an official API: when it stops working, Settings › Sources turns
// "google-news-links" red and the memo lists that story without a link, never the redirect.
// Every link is opened once: the answer is remembered in the cache table ("gnews:<id>").
import { inArray } from "drizzle-orm";
import { db, hasDb, schema as S } from "@/db";
import { decodeGoogleNews } from "../backtest";
import { fetchRaw, health } from "./http";

/** The id in a Google News article link, or null for any other address. */
export function googleId(url: string): string | null {
  return url.match(/news\.google\.com\/(?:rss\/)?articles\/([A-Za-z0-9_-]+)/)?.[1] || null;
}

/** The signature and time stamp on Google's redirect page (`data-n-a-sg`, `data-n-a-ts`). */
export function signatureOf(page: string): { sg: string; ts: string } | null {
  const sg = page.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = page.match(/data-n-a-ts="([^"]+)"/)?.[1];
  return sg && ts ? { sg, ts } : null;
}

/** The form body Google's redirect page itself posts to trade the signature for the address. */
export function batchBody(id: string, s: { sg: string; ts: string }): string {
  const inner = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${s.ts},"${s.sg}"]`;
  return "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", inner]]]));
}

/** The article's address in batchexecute's answer, or null. */
export function addressOf(answer: string): string | null {
  const m = answer.match(/garturlres\\",\\"(https?:\/\/[^\\"]+)/);
  return m ? m[1] : null;
}

const cache = new Map<string, string | null>();
const tally = { tried: 0, opened: 0 };
const KEY = "gnews:";
/** A link Google wouldn't open is tried again after this many days. */
export const RETRY_DAYS = 7;

async function remembered(id: string): Promise<{ url: string | null } | undefined> {
  if (!hasDb()) return undefined;
  try {
    const [r] = await db().select().from(S.cache).where(inArray(S.cache.key, [KEY + id])).limit(1);
    if (!r) return undefined;
    const m = r.value as { url: string | null };
    if (!m.url && Date.now() - r.createdAt.getTime() > RETRY_DAYS * 86400000) return undefined;
    return m;
  } catch {
    return undefined; // no memory: the link is opened again
  }
}

async function remember(id: string, url: string | null) {
  if (!hasDb()) return;
  try {
    await db()
      .insert(S.cache)
      .values({ key: KEY + id, value: { url } })
      .onConflictDoUpdate({ target: S.cache.key, set: { value: { url }, createdAt: new Date() } });
  } catch {
    /* opened again next time */
  }
}

/** Settings › Sources: "google-news-links" is red once fewer than half of the links tried could be opened. */
async function report() {
  const { tried, opened } = tally;
  if (opened * 2 >= tried) await health("google-news-links", true, opened);
  else if (tried >= 4) await health("google-news-links", false, opened, `only ${opened} of ${tried} links opened`);
}

/** The article's own address for any link: a Google News link is opened once and remembered, any other is returned as
 *  is. null when Google's page no longer gives it; the caller then never shows the redirect. */
export async function articleUrl(url: string): Promise<string | null> {
  const id = googleId(url);
  if (!id) return url.includes("news.google.com") ? null : url;
  if (cache.has(id)) return cache.get(id)!;
  const memo = await remembered(id);
  if (memo) {
    cache.set(id, memo.url);
    return memo.url;
  }
  let out = decodeGoogleNews(url);
  if (!out) {
    tally.tried++;
    const page = await fetchRaw(`https://news.google.com/rss/articles/${id}`, { timeoutMs: 10_000, accept: "text/html" });
    const s = page.ok ? signatureOf(page.text) : null;
    if (s) {
      const r = await fetchRaw("https://news.google.com/_/DotsSplashUi/data/batchexecute", { method: "POST", body: batchBody(id, s), contentType: "application/x-www-form-urlencoded;charset=UTF-8", timeoutMs: 10_000 });
      out = r.ok ? addressOf(r.text) : null;
    }
    if (out) tally.opened++;
    await report();
  }
  cache.set(id, out);
  await remember(id, out);
  return out;
}

/** Tests start clean. */
export function resetLinks() {
  cache.clear();
  tally.tried = 0;
  tally.opened = 0;
}
