// One company per real company: domain is the main key, names normalized, aliases kept.
import { and, eq, sql } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { domainOf } from "./format";

const GENERIC_WORDS = new Set(
  "app apps the new best top inc llc co corp company startup startups firm unicorn team group labs studio studios media games game sports health fitness brand brands play live club data ai capital ventures partners fund holdings technologies technology tech platform network solutions services home care pro plus one go now hub world global us usa america daily news official store shop market marketplace review reviews podcast show tv network update edition season episode week weekend today".split(
    " ",
  ),
);
const JOB_TITLES = /\b(head of|chief|ceo|cfo|coo|cto|founder|co-founder|president|director|manager|partner|vp|vice president|analyst|associate)\b/i;
const BAD_WORDS = /\b(startup|company|firm|unicorn)\b/i;

export function cleanName(raw: string): string {
  let n = (raw || "").replace(/\s+/g, " ").trim();
  n = n.replace(/^(?:[A-Z][\w&.'-]*\s){0,3}?[A-Z]?[\w&.'-]*-(?:backed|funded|owned|based)\s+/i, "");
  n = n.replace(/^(?:[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)['’]s\s+/, ""); // "India's TailBlaze" → "TailBlaze"
  n = n.replace(/^(?:[\w-]+\s){0,3}?(?:startup|company|brand|maker|platform|app|developer|studio)\s+(?=[A-Z])/i, ""); // "Pet food startup TailBlaze"
  n = n.replace(/\s*[,(].*$/, "").replace(/\s+(Inc\.?|LLC|L\.L\.C\.|Ltd\.?|Corp\.?|Co\.|PBC|Holdings)$/i, "").trim();
  n = n.replace(/^["'“‘]+|["'”’.,:;!?]+$/g, "");
  return n;
}

/** The generic-WORD filter, never a length rule: Ro, Jump and 1club are real companies. */
export function isGenericName(n: string): boolean {
  const name = cleanName(n);
  if (!name) return true;
  if (BAD_WORDS.test(name) || JOB_TITLES.test(name)) return true;
  const words = name.toLowerCase().split(/\s+/);
  if (words.length === 1 && GENERIC_WORDS.has(words[0])) return true;
  if (words.every((w) => GENERIC_WORDS.has(w))) return true;
  if (/^\d+$/.test(name)) return true;
  return false;
}

export function normKey(name: string): string {
  return cleanName(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function companyKey(name: string, domain?: string | null): string {
  const d = domain ? domainOf(domain) : "";
  return d ? `d:${d}` : `n:${normKey(name)}`;
}

export type NewSignal = { type: string; source: string; title: string; url: string; date: Date | null; voice?: string | null };
export type Upsert = {
  name: string;
  domain?: string | null;
  description?: string | null;
  descriptionUrl?: string | null;
  thesisArea?: string | null;
  stage?: string | null;
  amount?: number | null;
  currency?: string;
  signal: NewSignal;
};

const SKIP_DOMAINS = /(^|\.)(apple\.com|google\.com|youtube\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|linkedin\.com|tiktok\.com|medium\.com|substack\.com|github\.com|producthunt\.com|ycombinator\.com|sec\.gov|wikipedia\.org|bit\.ly|linktr\.ee|notion\.site|vercel\.app|herokuapp\.com)$/;

/** Insert or merge. Merges only on the same domain or the same normalized name; otherwise a new card. */
export async function upsertCompany(u: Upsert): Promise<{ id: number; created: boolean } | null> {
  const name = cleanName(u.name);
  if (isGenericName(name)) return null;
  let domain = u.domain ? domainOf(u.domain) : null;
  if (domain && SKIP_DOMAINS.test(domain)) domain = null;
  const x = db();
  let found: { id: number } | undefined;
  if (domain) [found] = await x.select({ id: S.companies.id }).from(S.companies).where(eq(S.companies.domain, domain)).limit(1);
  if (!found) {
    const nk = normKey(name);
    const r = (await x.execute(sql`select id from companies where regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = ${nk} or aliases ? ${name} limit 1`)) as unknown as { rows: { id: number }[] };
    found = r.rows[0];
    // "TailBlaze" and "TailBlaze Longevity" in the same thesis area are one company
    if (!found && nk.length >= 6 && u.thesisArea) {
      const r2 = (await x.execute(sql`select id, name from companies where thesis_area = ${u.thesisArea} and length(regexp_replace(lower(name), '[^a-z0-9]', '', 'g')) >= 6
        and (regexp_replace(lower(name), '[^a-z0-9]', '', 'g') like ${nk + "%"} or ${nk} like regexp_replace(lower(name), '[^a-z0-9]', '', 'g') || '%') limit 1`)) as unknown as { rows: { id: number; name: string }[] };
      if (r2.rows[0]) {
        found = r2.rows[0];
        await x.execute(sql`update companies set aliases = aliases || ${JSON.stringify([name])}::jsonb where id = ${found.id} and not aliases ? ${name}`);
      }
    }
  }
  const sigDate = u.signal.date || new Date();
  if (found) {
    await x
      .update(S.companies)
      .set({
        lastSignal: sql`greatest(${S.companies.lastSignal}, ${sigDate})`,
        domain: domain ? sql`coalesce(${S.companies.domain}, ${domain})` : undefined,
        description: u.description ? sql`coalesce(${S.companies.description}, ${u.description})` : undefined,
        descriptionUrl: u.descriptionUrl ? sql`coalesce(${S.companies.descriptionUrl}, ${u.descriptionUrl})` : undefined,
        thesisArea: u.thesisArea ? sql`coalesce(${S.companies.thesisArea}, ${u.thesisArea})` : undefined,
        stage: u.stage && u.stage !== "unknown" ? sql`case when ${S.companies.stage} = 'unknown' then ${u.stage} else ${S.companies.stage} end` : undefined,
        amount: u.amount ? sql`coalesce(${S.companies.amount}, ${u.amount})` : undefined,
        updatedAt: new Date(),
      })
      .where(eq(S.companies.id, found.id));
    await addSignal(found.id, u.signal);
    return { id: found.id, created: false };
  }
  const [row] = await x
    .insert(S.companies)
    .values({
      key: companyKey(name, domain),
      name,
      domain,
      description: u.description || null,
      descriptionUrl: u.descriptionUrl || null,
      thesisArea: u.thesisArea || null,
      stage: u.stage || "unknown",
      amount: u.amount || null,
      currency: u.currency || "$",
      firstSeen: new Date(),
      lastSignal: sigDate,
    })
    .onConflictDoNothing()
    .returning({ id: S.companies.id });
  if (!row) return null;
  await addSignal(row.id, u.signal);
  return { id: row.id, created: true };
}

export async function addSignal(companyId: number, s: NewSignal) {
  if (!s.url) return;
  await db()
    .insert(S.signals)
    .values({ companyId, type: s.type, source: s.source, title: s.title.slice(0, 400), url: s.url, date: s.date, voice: s.voice || null })
    .onConflictDoNothing();
}

export async function companyByName(name: string) {
  const nk = normKey(name);
  const r = (await db().execute(sql`select id, name from companies where regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = ${nk} limit 1`)) as unknown as { rows: { id: number; name: string }[] };
  return r.rows[0] || null;
}

export async function setStatus(id: number, status: string) {
  await db().update(S.companies).set({ status, updatedAt: new Date() }).where(and(eq(S.companies.id, id)));
}

/** Stage from a headline or text. */
export function stageOf(text: string): string {
  const t = text.toLowerCase();
  if (!/\b(round|funding|raises?|raised|capital|led by|investment|financing|investors?|backed|\$|€|£)\b|[$€£]/.test(t)) return "unknown"; // "secures No. 2 seed" is sports
  if (/pre-?seed/.test(t)) return "pre-seed";
  if (/series\s*a\b/.test(t)) return "series-a";
  if (/series\s*[b-z]\b|growth round|late[- ]stage/.test(t)) return /series\s*b\b/.test(t) ? "series-b" : "later";
  if (/\bseed\b/.test(t)) return "seed";
  return "unknown";
}

/** "$5.5M", "€2 million", "£10m", "₹20 crore" → amount + currency. */
export function moneyOf(text: string): { amount: number; currency: string } | null {
  const clean = text.replace(/\bat (?:a )?[$€£₹]\s?\d+(?:\.\d+)?\s?(?:billion|million|bn|mn|m|b|k)?\s+(?:post-money |pre-money )?valuation/gi, "");
  const m = clean.match(/([$€£₹])\s?(\d+(?:\.\d+)?)\s?(billion|million|bn|mn|m|b|k|crore)?\b/i);
  if (!m) return null;
  const sym = m[1];
  let n = Number(m[2]);
  const unit = (m[3] || "").toLowerCase();
  if (unit.startsWith("b")) n *= 1e9;
  else if (unit === "million" || unit === "mn" || unit === "m") n *= 1e6;
  else if (unit === "k") n *= 1e3;
  else if (unit === "crore") n *= 1e7;
  if (n < 10000) return null;
  return { amount: n, currency: sym === "$" ? "$" : sym === "€" ? "EUR" : sym === "£" ? "GBP" : "INR" };
}

/** "Acme raises $5M seed …" → "Acme". The company must be the headline's subject. */
export function subjectOf(headline: string): string | null {
  const m = headline.match(/^(.{2,60}?)\s+(?:raises|raised|secures|secured|lands|closes|closed|nabs|bags|announces|gets|picks up|scores|snags|launches|debuts|unveils)\b/i);
  if (!m) return null;
  let s = m[1].trim();
  s = s.replace(/^(?:exclusive|scoop|funding|report|breaking)[:|-]\s*/i, "");
  s = s.replace(/^[\w\s&.'-]{0,40}?(?:startup|company|platform|app|maker|brand)\s+/i, "");
  s = cleanName(s);
  if (!s || s.split(" ").length > 5 || isGenericName(s)) return null;
  return s;
}
