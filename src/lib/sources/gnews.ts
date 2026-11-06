// Google News links → the article's own address. Since 2024 Google's links (`news.google.com/rss/articles/CBMi…`)
// hold only an id, not the address: on 11-06-26, 0 of the 521 saved in Scout decoded on their own, so a memo's
// Sources were long redirect links. Google's own redirect page carries a signature that its `batchexecute` call trades
// for the address. That call is not an official API: when it stops working, Settings › Sources turns
// "google-news-links" red and the memo lists that story without a link, never the redirect.
// Every link is opened once: the answer is remembered in the cache table ("gnews:<id>"), and the News Links sweep
// (src/lib/jobs/links.ts) puts the article's address in every place the link is stored.
import { and, inArray, sql } from "drizzle-orm";
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

/** What Scout remembers about one link: the article's address (null: Google wouldn't give it), and whether every stored
 *  copy of the link now holds that address ("swept"), so a story seen again is saved under the same address. */
export type Memo = { url: string | null; swept?: boolean };

/** The memory for these link ids; a refusal older than RETRY_DAYS counts as never tried. */
export async function remembered(ids: string[]): Promise<Map<string, Memo>> {
  const out = new Map<string, Memo>();
  const keys = [...new Set(ids.filter(Boolean))].map((i) => KEY + i);
  if (!keys.length || !hasDb()) return out;
  try {
    for (let k = 0; k < keys.length; k += 500) {
      const rows = await db().select().from(S.cache).where(inArray(S.cache.key, keys.slice(k, k + 500)));
      for (const r of rows) {
        const m = r.value as Memo;
        if (!m.url && Date.now() - r.createdAt.getTime() > RETRY_DAYS * 86400000) continue;
        out.set(r.key.slice(KEY.length), m);
      }
    }
  } catch {
    /* no memory: links are opened again */
  }
  return out;
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

/** The sweep has put these links' addresses everywhere they were stored. */
export async function markSwept(ids: string[]) {
  const keys = [...new Set(ids)].map((i) => KEY + i);
  for (let k = 0; k < keys.length; k += 500)
    await db()
      .update(S.cache)
      .set({ value: sql`${S.cache.value} || '{"swept":true}'::jsonb` })
      .where(and(inArray(S.cache.key, keys.slice(k, k + 500)), sql`${S.cache.value}->>'url' is not null`));
}

/** A search's stories with the article's own address for every link already swept: a story Scout saved before is
 *  saved again under the address it already holds, so it is never a second row (F.googleNews calls this). */
export async function ownAddresses<T extends { url: string }>(items: T[]): Promise<T[]> {
  const ids = items.map((i) => googleId(i.url)).filter((x): x is string => !!x);
  if (!ids.length) return items;
  const m = await remembered(ids);
  return items.map((i) => {
    const r = m.get(googleId(i.url) || "");
    return r?.url && r.swept ? { ...i, url: r.url } : i;
  });
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
  const memo = (await remembered([id])).get(id);
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
