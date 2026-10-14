// "We'd have found it first": earlier public signals before an announcement. No AI.
// A signal counts only when the company is the headline's subject, inside the thesis,
// and not a same-name entertainment title or another domain with the same stem.
import { eq } from "drizzle-orm";
import { db, schema as S } from "@/db";
import * as F from "./sources/fetchers";
import { classify } from "./thesis";
import { domainOf, slugify } from "./format";
import type { Evidence } from "@/db/schema";

const DAY = 86400000;

export type Emit = (e: { stage?: "announce" | "website" | "search" | "done"; note?: string; count?: number; row?: Evidence }) => void;

/** Google News article links are redirects; the article's own URL is inside the token for many items. */
export function decodeGoogleNews(url: string): string | null {
  const m = url.match(/news\.google\.com\/(?:rss\/)?articles\/([A-Za-z0-9_-]+)/);
  if (!m) return url.includes("news.google.com") ? null : url;
  try {
    const raw = Buffer.from(m[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("latin1");
    const u = raw.match(/https?:\/\/[\x21-\x7e]+/);
    if (!u) return null;
    return u[0].replace(/[\x00-\x1f\x80-\xff].*$/, "").replace(/[ÒÀ]+$/, "");
  } catch {
    return null;
  }
}

const ENTERTAINMENT = /\b(movie|film|album|song|novel|book|tv series|season \d|episode|trailer|soundtrack|video game sequel|sculpture|doom eternal|eternal sunshine|eternals?\b(?= (movie|film|marvel)))/i;

/** The company must be the headline's subject: its name inside the first clause, on word boundaries. */
export function isSubject(name: string, title: string): boolean {
  const first = title.split(/\s[–—|:-]\s|[:;]\s/)[0];
  const re = new RegExp(`(^|[^\\w])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^\\w]|$)`, "i");
  const m = re.exec(first);
  if (!m) return false;
  // "Doom Eternal" is not Eternal: a capitalized word right before the name makes it another title
  const prev = first.slice(0, m.index + m[1].length).trim().split(/\s+/).pop() || "";
  if (/^[A-Z][a-z]+$/.test(prev) && !/^(The|A|An|How|Why|Startup|Exclusive|New|Meet|Inside)$/.test(prev)) return false;
  return true;
}

export type BacktestIn = { name: string; announceDate: string | null; announceUrl: string | null; website: string | null };

export async function findAnnouncement(name: string): Promise<{ date: string; url: string; title: string } | null> {
  const items = await F.googleNews(`"${name}" (raises OR seed OR "Series A" OR funding OR invests)`, "3650d");
  const hits = items.filter((n) => n.date && isSubject(name, n.title) && /raises|raised|funding|seed|series|invest/i.test(n.title)).sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const h = hits[0];
  if (!h) return null;
  return { date: h.date!.slice(0, 10), url: decodeGoogleNews(h.url) || h.url, title: h.title };
}

export async function runBacktest(i: BacktestIn, emit: Emit = () => {}, opts: { courtside?: boolean } = {}): Promise<{ slug: string; verdict: string; leadDays: number | null; flaggedOn: string | null; evidence: Evidence[] } | null> {
  let announce = i.announceDate;
  let announceUrl = i.announceUrl;
  if (!announce) {
    emit({ stage: "announce", note: "searching funding news" });
    const a = await findAnnouncement(i.name);
    if (!a) return null;
    announce = a.date;
    announceUrl = a.url;
  }
  const domain = i.website ? domainOf(i.website) : null;
  const before = new Date(announce + "T00:00:00Z");
  const ev: Evidence[] = [];
  const push = (e: Evidence) => {
    ev.push(e);
    emit({ row: e, count: ev.length });
  };
  emit({ stage: "search", note: "searching 6 sources", count: 0 });

  // 1. news before the announcement
  const news = await F.googleNews(`"${i.name}"`, "", announce);
  emit({ note: "news", count: ev.length });
  for (const n of news.slice(0, 30)) {
    if (!n.date || new Date(n.date) >= before) continue;
    const own = decodeGoogleNews(n.url);
    if (!own) continue; // never store the redirect
    const subject = isSubject(i.name, n.title);
    const area = classify(`${n.title} ${n.text}`).area;
    const otherDomain = n.title.match(new RegExp(`${i.name.replace(/\s+/g, "")}\\.(io|co|app|net|org|ai)\\b`, "i"));
    let note = /raises|raised|funding|seed|series/i.test(n.title) ? "Funding news" : "Launch news";
    let counts = subject && !!area && !ENTERTAINMENT.test(n.title);
    if (otherDomain && domain && !domain.endsWith(otherDomain[1])) ((counts = false), (note = `Rejected because it names ${otherDomain[0]}, a different domain`));
    else if (!subject) note = "Rejected because the company is not the headline's subject";
    else if (!area) note = "Rejected because the story is outside the thesis";
    else if (ENTERTAINMENT.test(n.title)) note = "Rejected because it is an entertainment title with the same name";
    push({ url: own, date: n.date.slice(0, 10), kind: "News", note, title: `${n.title}${n.outlet ? ` (${n.outlet})` : ""}`, counts, domain: domainOf(own) });
  }
  // 2. Hacker News
  const hn = await F.hnSearch(i.name, Math.floor(before.getTime() / 1000));
  emit({ note: "Hacker News", count: ev.length });
  for (const h of hn.slice(0, 5)) {
    if (!isSubject(i.name, h.title.replace(/^Show HN:\s*/i, ""))) continue;
    push({ url: `https://news.ycombinator.com/item?id=${h.id}`, date: h.date.slice(0, 10), kind: "Hacker News", note: "First mention on Hacker News", title: h.title, counts: true, domain: "news.ycombinator.com" });
  }
  // 3. Form D (EDGAR full-text search)
  const fd = await F.edgarSearch(i.name, "D", "2015-01-01", announce);
  emit({ note: "SEC EDGAR", count: ev.length });
  for (const f of fd.slice(0, 3)) {
    const same = f.name.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(i.name.toLowerCase().replace(/[^a-z0-9]/g, ""));
    push({ url: `https://www.sec.gov/Archives/edgar/data/${Number(f.cik)}/${f.adsh.replace(/-/g, "")}/`, date: f.date, kind: "Form D", note: same ? "Form D filed by the company's legal entity" : "Rejected because the filer may be a different entity (match the founders before counting it)", title: `${f.name} filed a Form D`, counts: same, domain: "sec.gov" });
  }
  // 4. domain registration and first capture: context, never a signal on their own
  if (domain) {
    const reg = await F.rdap(domain);
    if (reg) push({ url: `https://rdap.org/domain/${domain}`, date: reg, kind: "Domain", note: "Rejected because a domain can be older than the company", title: `${domain} registered`, counts: false, domain: "rdap.org" });
    const wb = await F.wayback(domain);
    if (wb) push({ url: wb.url, date: wb.date, kind: "Wayback Machine", note: "Rejected because the capture may be a different owner", title: `First capture of ${domain}`, counts: false, domain: "web.archive.org" });
  }
  emit({ note: "App Store", count: ev.length });
  const counted = ev.filter((e) => e.counts && e.date < announce!).sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = counted[0];
  const leadDays = first ? Math.round((before.getTime() - new Date(first.date + "T00:00:00Z").getTime()) / DAY) : null;
  const verdict = first && leadDays && leadDays > 0 ? "win" : "none";
  let slug = slugify(i.name);
  const [existing] = await db().select({ courtside: S.backtests.courtside }).from(S.backtests).where(eq(S.backtests.slug, slug)).limit(1);
  if (existing?.courtside && !opts.courtside) slug = `${slug}-check`;
  await db()
    .insert(S.backtests)
    .values({ slug, company: i.name, domain, announceDate: announce, announceUrl, announceTitle: null, verdict, courtside: !!opts.courtside, leadDays: verdict === "win" ? leadDays : null, flaggedOn: verdict === "win" ? first!.date : null, signal: verdict === "win" ? first!.kind : null, evidence: ev.sort((a, b) => (a.date < b.date ? -1 : 1)) })
    .onConflictDoUpdate({ target: S.backtests.slug, set: { evidence: ev, verdict, leadDays: verdict === "win" ? leadDays : null, flaggedOn: verdict === "win" ? first!.date : null, announceDate: announce, announceUrl } });
  emit({ stage: "done", count: ev.length });
  return { slug, verdict, leadDays: verdict === "win" ? leadDays : null, flaggedOn: verdict === "win" ? first!.date : null, evidence: ev };
}
