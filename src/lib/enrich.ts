// Scout V2 (10-26-26): the pure rules behind the enrich job. Funds Raised from every round Scout can find,
// the startup filter, duplicate cards, the website finder's checks and the card's picture.
import type { Media, Round, ThesisCheck } from "@/db/schema";
import { moneyOf, stageOf, normKey, cleanName } from "./companies";
import { classify } from "./thesis";
import { domainOf } from "./format";
import { usd } from "./v2";

const DAY = 86400000;

/* ---------- Funds Raised: rounds from every report ---------- */
export type Report = { title: string; url: string; name: string; date: string | null; amount?: number | null; currency?: string; stage?: string; investors?: string | null };

/** "… led by Elysian Park Ventures", "… from Seven Seven Six" → the lead investor. */
export function investorsOf(title: string): string | null {
  const m = title.match(/\b(?:led by|from|backed by|with participation from)\s+([A-Z][\w&.'’-]*(?:\s+(?:[A-Z][\w&.'’-]*|&|and|of))*)/);
  if (!m) return null;
  const s = m[1].replace(/\s+(?:and|of|&)$/i, "").trim();
  return s.length > 2 && !/^(The|Its|Their|Investors?)$/.test(s) ? s : null;
}

const daysApart = (a: string | null, b: string | null) => (a && b ? Math.abs(new Date(a).getTime() - new Date(b).getTime()) / DAY : 0);
const close = (a: number | null, b: number | null) => !a || !b || Math.min(a, b) / Math.max(a, b) >= 0.65;

/** Reports about the same raise merge into one round; a round's amount is the highest any source gave, low the lowest. */
export function buildRounds(reports: Report[]): Round[] {
  const rows = reports
    .map((r) => {
      const m = r.amount ? { amount: r.amount, currency: r.currency || "$" } : moneyOf(r.title);
      return { ...r, usd: m ? usd(m.amount, m.currency) : null, stage: r.stage || stageOf(r.title), investors: r.investors ?? investorsOf(r.title) };
    })
    .filter((r) => r.usd || r.stage !== "unknown")
    .sort((a, b) => (a.date || "9").localeCompare(b.date || "9"));
  const rounds: Round[] = [];
  for (const r of rows) {
    const hit = rounds.find((x) => (x.stage === r.stage || x.stage === "unknown" || r.stage === "unknown") && daysApart(x.date, r.date) <= 120 && close(x.amount, r.usd));
    const src = { name: r.name, url: r.url, amount: r.usd, date: r.date, title: r.title };
    if (hit) {
      if (hit.sources.some((s) => s.url === r.url)) continue;
      hit.sources.push(src);
      if (r.usd) {
        hit.amount = Math.max(hit.amount || 0, r.usd);
        hit.low = Math.min(hit.low ?? r.usd, r.usd);
      }
      if (hit.stage === "unknown") hit.stage = r.stage;
      if (!hit.investors && r.investors) hit.investors = r.investors;
      if (r.date && (!hit.date || r.date < hit.date)) hit.date = r.date;
      continue;
    }
    rounds.push({ stage: r.stage, amount: r.usd, low: r.usd, currency: "$", date: r.date, investors: r.investors || null, sources: [src] });
  }
  return rounds.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

/** What the cap reads: every round added up, using the highest amount any source reported. */
export function totalOf(rounds: Round[]): number | null {
  const t = rounds.reduce((s, r) => s + (r.amount || 0), 0);
  return t || null;
}

/* ---------- the startup filter: what Scout never recommends ---------- */
const BLOG_HOSTS = /(^|\.)(blogspot\.com|wordpress\.com|wixsite\.com|weebly\.com|tumblr\.com|substack\.com|medium\.com|sites\.google\.com|carrd\.co|webflow\.io|github\.io|blogger\.com)$/i;
const BIG_OWNERS = "kuaishou|bytedance|tencent|alibaba|baidu|netease|openai|alphabet|google|deepmind|microsoft|meta platforms|amazon|apple|samsung|sony|nvidia|adobe|disney|netflix|spotify|tiktok|snap inc|electronic arts|activision|ubisoft|epic games|nintendo|warner bros|universal music|live nation";
const BIG_PRODUCT = /^(kling|sora|veo|gemini|chatgpt|copilot|alexa|siri|bard|llama|grok|claude|midjourney|firefly|capcut|douyin|instagram|threads|whatsapp|messenger|bing|cortana)\b/i;
const OWNED_BY = new RegExp(`\\b(?:by|from|of|at)\\s+(?:${BIG_OWNERS})\\b|\\b(?:${BIG_OWNERS})['’]s\\b`, "i");
const PLACEHOLDER = new Set(
  "app apps music creator creators maker make live score scores result results soccer football sports sport fitness workout tracker hub radio tv video videos stream streaming game games player players studio beats songs song editor photo photos wallpaper wallpapers news daily pro plus free mobile online world best top new".split(" "),
);
const DESCRIBED = /['’]s\s+(?:[\w-]+\s+){0,3}(brand|startup|company|app|platform|business|venture|label|show|line)$/i;

/** Why a card is not an investable startup, or null when it is. The team's restore (keep) always wins. */
export function notStartupReason(c: { name: string; domain: string | null; description: string | null; keep?: boolean }): string | null {
  if (c.keep) return null;
  const host = c.domain ? domainOf(c.domain) : "";
  if (host && BLOG_HOSTS.test(host)) return "A blog, not a company";
  if (BIG_PRODUCT.test(c.name.trim()) || OWNED_BY.test(`${c.name}. ${(c.description || "").slice(0, 300)}`)) return "A big company's product";
  if (DESCRIBED.test(c.name.trim())) return "A description, not a company name";
  const words = c.name
    .replace(/\s*[:–—-]\s.*$/, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (words.length && words.every((w) => PLACEHOLDER.has(w))) return "A generic app name, not a company";
  return null;
}

/** What a card the team hid by hand says; the daily filter never clears it. */
export const TEAM_HIDDEN = "Hidden by the team";

/** The startup filter's rules, then the AI Thesis Check's NO. The team's restore (keep) always wins. */
export function startupVerdict(c: { name: string; domain: string | null; description: string | null; keep?: boolean; thesisCheck?: ThesisCheck | null }): string | null {
  if (c.keep) return null;
  const rule = notStartupReason(c);
  if (rule) return rule;
  if (c.thesisCheck && !c.thesisCheck.ok) return `Outside the thesis (AI check: ${c.thesisCheck.why || "no reason given"})`;
  return null;
}

/* ---------- duplicates: the same funding story under two names ---------- */
export type DupIn = { id: number; name: string; area: string | null; signals: { title: string; url: string; date: string | null }[] };

/** The card the other one merges into, or null. One name must be the end or start of the other, in the same area,
 *  and both must carry the same raise (same amount, within two weeks). */
export function duplicateOf(a: DupIn, b: DupIn): { keep: DupIn; drop: DupIn } | null {
  if (a.id === b.id || !a.area || a.area !== b.area) return null;
  const ka = normKey(a.name);
  const kb = normKey(b.name);
  const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  const shortName = ka.length <= kb.length ? a.name : b.name;
  // a one-word short name must be long enough to be distinctive: "League" is not a company
  if (short.length < 6 || (shortName.trim().split(/\s+/).length < 2 && short.length < 8) || (!long.endsWith(short) && !long.startsWith(short))) return null;
  const raise = (s: DupIn) => s.signals.map((x) => ({ m: moneyOf(x.title), d: x.date })).filter((x) => x.m);
  const ra = raise(a);
  const rb = raise(b);
  const same = ra.some((x) => rb.some((y) => x.m!.amount === y.m!.amount && daysApart(x.d, y.d) <= 14));
  const sharedUrl = a.signals.some((x) => b.signals.some((y) => y.url === x.url));
  if (!same && !sharedUrl) return null;
  // the specific, full name stays: "International Dance League" over "dance league"
  const keep = ka.length >= kb.length ? a : b;
  return { keep, drop: keep === a ? b : a };
}

/* ---------- the website finder ---------- */
export const SKIP_HOSTS = /(^|\.)(apple\.com|google\.com|youtube\.com|youtu\.be|twitter\.com|x\.com|facebook\.com|instagram\.com|linkedin\.com|tiktok\.com|medium\.com|substack\.com|github\.com|producthunt\.com|ycombinator\.com|sec\.gov|wikipedia\.org|bit\.ly|linktr\.ee|notion\.site|vercel\.app|herokuapp\.com|crunchbase\.com|pitchbook\.com|apps\.apple\.com|play\.google\.com|discord\.gg|discord\.com|reddit\.com|tracxn\.com|dealroom\.co)$/i;

/** Domains worth trying for a name: tryit.com, tryit.io … in the order startups most often use. */
export function guessDomains(name: string): string[] {
  const base = cleanName(name).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const flat = base.replace(/[^a-z0-9]/g, "");
  const dashed = base.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (flat.length < 3) return [];
  const tlds = ["com", "co", "io", "ai", "app", "gg", "tv", "club", "fit", "health", "games", "xyz"];
  const out = tlds.map((t) => `${flat}.${t}`);
  if (dashed !== flat) out.push(`${dashed}.com`);
  out.push(`get${flat}.com`, `try${flat}.com`, `join${flat}.com`, `${flat}app.com`, `${flat}hq.com`);
  return out;
}

/** Proper nouns from a company's news, other than its own name: what an official site should also mention. */
const NOT_FACTS = new Set("raises raised series seed pre-seed funding round led the with and for how why new startup startups million billion exclusive secures closes lands announces ventures capital partners fund funds investors investment platform company brand founder founders after from into this that their health fitness sports games entertainment lifestyle music medical education store app apps".split(" "));
/** Every longer word capitalized ("Raises $2.5 Million Seed To Scale …"): capitals carry no meaning there. */
const isTitleCase = (t: string) => !t.split(/\s+/).some((x) => /^[a-z][a-z'’-]{3,}$/.test(x));

/** Facts an official site should also mention: names from the company's news other than its own (investors, partners,
 *  places) and acronyms (ESPN). A Title-Case headline only gives acronyms, since every word is capitalized there.
 *  Single common words never count: "Park" let a Rotterdam festival pass as IDL's site (10-26-26). */
export function factsOf(name: string, titles: string[]): string[] {
  const own = name.toLowerCase();
  const ownWords = new Set(own.split(/[^a-z0-9]+/));
  const skip = (w: string) => NOT_FACTS.has(w.toLowerCase()) || ownWords.has(w.toLowerCase()) || own.includes(w.toLowerCase()) || w.toLowerCase().includes(own);
  const out = new Set<string>();
  for (const t of titles) {
    for (const m of t.matchAll(/\b([A-Z]{3,6})\b/g)) if (!skip(m[1])) out.add(m[1]);
    if (isTitleCase(t)) continue;
    const words = t.split(/\s+/);
    for (let i = 1; i < words.length; i++) {
      // a run of capitalized words after the first word is a proper name: "Elysian Park Ventures"
      const run: string[] = [];
      while (i < words.length && /^[A-Z][a-zA-Z&.'’-]+$/.test(words[i].replace(/['’]s$|[,:;.]$/g, ""))) run.push(words[i++].replace(/['’]s$|[,:;.]$/g, ""));
      if (!run.length) continue;
      const kept = run.filter((w) => !skip(w));
      if (kept.length >= 2) out.add(kept.join(" "));
      for (const w of kept) if (w.length >= 6) out.add(w);
    }
  }
  return [...out].slice(0, 24);
}

const hasWord = (low: string, f: string) => new RegExp(`(^|[^a-z0-9])${f.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(low);

/** Is this page the company's own site? Its name must appear, and so must a fact from its news.
 *  internationaldanceleague.com is a dance festival in Rotterdam; IDL's own site is idl.pro, which names ESPN (10-26-26).
 *  With no facts to check, a guessed domain is never accepted: Find Website is better than a wrong site. */
export function isOfficialSite(html: string, c: { name: string; facts: string[] }): boolean {
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;|&#\d+;/g, " ").replace(/\s+/g, " ");
  const low = text.toLowerCase();
  const name = cleanName(c.name).toLowerCase();
  if (!name || !hasWord(low, name)) return false;
  if (/domain (is )?for sale|buy this domain|this domain may be for sale|parked free|hugedomains|sedo\.com/i.test(text)) return false;
  return c.facts.some((f) => hasWord(low, f));
}

/** A news-search result counts as one of the company's rounds only when it is plausibly the same company:
 *  the company is the headline's subject (checked by the caller), the story is in the same thesis area, the amount is
 *  seed to Series A size, and an unnamed round is small. Same-name companies gave Imperfect "$781M" (10-26-26). */
export function searchReportOk(area: string | null, title: string, text: string): boolean {
  const m = moneyOf(title);
  const amt = m ? usd(m.amount, m.currency) : null;
  if (amt && amt >= 50e6) return false;
  const st = stageOf(title);
  if (st === "unknown" && (!amt || amt > 10e6)) return false;
  return !!area && classify(`${title}. ${text}`).area === area;
}

/* ---------- the card's picture ---------- */
export type SiteBits = { title: string | null; ogImage: string | null; mp4: string | null; yt: string | null; logo: string | null };

const abs = (u: string, base: string) => {
  try {
    return new URL(u.replace(/&amp;/g, "&"), base).toString();
  } catch {
    return null;
  }
};
const meta = (html: string, prop: string) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i"))?.[1] ||
  html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i"))?.[1] ||
  null;

/** What a homepage offers: its preview image, a product video, a YouTube video and a logo. */
export function siteBits(html: string, base: string): SiteBits {
  const og = meta(html, "og:image") || meta(html, "twitter:image");
  const ogv = meta(html, "og:video") || meta(html, "og:video:url");
  const vid = html.match(/<(?:video|source)[^>]+src=["']([^"']+\.(?:mp4|webm)(?:\?[^"']*)?)["']/i)?.[1] || (ogv && /\.(mp4|webm)(\?|$)/i.test(ogv) ? ogv : null);
  const yt = html.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)?.[1] || null;
  const icon =
    html.match(/<link[^>]+rel=["'](?:apple-touch-icon(?:-precomposed)?)["'][^>]*href=["']([^"']+)["']/i)?.[1] ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon["']/i)?.[1] ||
    html.match(/<link[^>]+rel=["']icon["'][^>]*sizes=["'](?:192|180|512)[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1] ||
    null;
  const title = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() || null;
  return { title, ogImage: og ? abs(og, base) : null, mp4: vid ? abs(vid, base) : null, yt, logo: icon ? abs(icon, base) : null };
}

/** Brand Sky's candidates on a homepage, best first: hero art (the image the page loads first, a video's poster, a
 *  high-priority image), the startup's own logo (an image named for it AND marked as a logo, so a backer's logo like
 *  "formation-logo.png" on heliosinc.ai is skipped), and the theme color. The job loads and measures each one. */
export type BrandBits = { art: string[]; marks: string[]; themeColor: string | null };
export function brandBits(html: string, base: string, name: string): BrandBits {
  const attr = (tag: string, a: string) => tag.match(new RegExp(`\\s${a}=["']([^"']+)["']`, "i"))?.[1] || "";
  const notArt = /logo|icon|favicon|avatar|badge|\.svg(\?|$)|sprite|flag/i;
  const art: string[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const t = m[0];
    if (/rel=["']preload["']/i.test(t) && /as=["']image["']/i.test(t) && /fetchpriority=["']high["']/i.test(t)) art.push(attr(t, "href"));
  }
  for (const m of html.matchAll(/<video\b[^>]*>/gi)) art.push(attr(m[0], "poster"));
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) if (/fetchpriority=["']high["']/i.test(m[0])) art.push(attr(m[0], "src"));
  const words = cleanName(name).toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  const own = (t: string) => words.some((w) => t.includes(w)) || t.replace(/[^a-z0-9]/g, "").includes(cleanName(name).toLowerCase().replace(/[^a-z0-9]/g, ""));
  const marks: { u: string; rank: number }[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const t = m[0];
    const src = attr(t, "src");
    if (!src || src.startsWith("data:")) continue;
    const file = src.split("?")[0].toLowerCase();
    const alt = attr(t, "alt").toLowerCase();
    const cls = attr(t, "class").toLowerCase();
    const isLogo = /logo|lockup|wordmark|brand/.test(`${file} ${cls}`) || /logo/.test(alt);
    const named = own(file.split("/").pop() || "") || own(alt);
    if (!isLogo || !named) continue;
    if (/(^|[^a-z])(partners?|investors?|backed|press|clients?|customers?|payments?|badges?)([^a-z]|$)/.test(`${file} ${cls} ${alt}`)) continue; // "cypress" is not press
    marks.push({ u: src, rank: /lockup/.test(file + cls) ? 0 : /logo/.test(file + cls) ? 1 : 2 });
  }
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean).map((u) => abs(u, base)).filter((u): u is string => !!u))];
  const tc = meta(html, "theme-color");
  return {
    art: uniq(art).filter((u) => !notArt.test(u.split("?")[0])).slice(0, 3),
    marks: uniq(marks.sort((a, b) => a.rank - b.rank).map((m) => m.u)).slice(0, 4),
    themeColor: tc && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(tc.trim()) ? tc.trim() : null,
  };
}

/** The first picture Scout has, in the order the team picked: product video → App Store screenshots → website preview → logo. */
export function pickMedia(o: { site?: SiteBits | null; shots?: string[]; appIcon?: string | null; domain?: string | null }): Media {
  const s = o.site;
  const logo = s?.logo || o.appIcon || (o.domain ? `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(o.domain)}` : undefined);
  if (s?.yt) return { kind: "yt", yt: s.yt, poster: `https://i.ytimg.com/vi/${s.yt}/hqdefault.jpg`, play: "Play Video", logo, from: "website" };
  if (s?.mp4) return { kind: "mp4", mp4: s.mp4, poster: s.ogImage || undefined, play: "Play Product Video", logo, from: "website" };
  if (o.shots && o.shots.length) return { kind: "shots", shots: o.shots.slice(0, 3), logo, from: "App Store" };
  if (s?.ogImage) return { kind: "site", img: s.ogImage, logo, from: "website" };
  return { kind: "logo", logo, from: "logo" };
}

/** An App Store link's numeric id. */
export function appIdOf(url: string): string | null {
  return url.match(/apps\.apple\.com\/[^?]*\/id(\d+)/)?.[1] || null;
}
