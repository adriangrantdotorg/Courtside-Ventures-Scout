// Rule-based extraction (no AI): sponsors from show notes and video descriptions, and
// company/brand mentions with their stance for Culture.
import { stripHtml } from "./sources/parse";

export type SponsorHit = { brand: string; domain: string | null; evidence: string };

const CUE = /(sponsored by|brought to you by|thanks to our sponsors?|thank you to our sponsors?|today'?s sponsors? (?:is|are)|our sponsors? (?:is|are|today)|this (?:video|episode) is sponsored by|support (?:for )?(?:the|this) show (?:comes from|is provided by)|support the show:|promo code|use code|partnered with)/i;
const PRESENTED = /^\s*presented by\s+/i;
const CTA = /^(learn more|subscribe|follow|listen|watch|click|download|visit|shop|get|go|sign up|join|try|check out|see|read|support|donate|leave|rate|review|find|follow us|more)\b/i;
const LEGAL = /\b(legal disclaimer|terms|privacy|copyright|all rights reserved|disclaimer|cookie|advertis(e|ing) (inquiries|choices)|ad choices|policy)\b/i;
const TITLEY = /\b(legend|star|host|guest|ceo|founder|president|coach|player|quarterback|analyst|reporter|author|actor|actress|rapper|singer|comedian|writer|editor|producer)\b/i;
const DOMAIN_RE = /\b([a-z0-9][a-z0-9-]{1,40})\.(com|co|io|app|ai|net|org|tv|gg|fm|us|shop|store|health|bet|xyz)\b/gi;
const SPECIAL: Record<string, string> = { "cash.app": "Cash App", pop: "Pop Store" };
const NOT_BRANDS = new Set(["the", "our", "my", "your", "this", "today", "us", "you", "spotify", "apple", "apple podcasts", "youtube", "patreon", "megaphone", "art19", "acast", "omny", "simplecast", "libsyn", "anchor", "podcast", "show", "episode", "video", "listeners", "everyone", "fans", "sponsors", "our sponsors", "the following"]);

function sentences(text: string): string[] {
  return stripHtml(text)
    .split(/\n+/)
    .flatMap((l) => l.split(/(?<=[!?])\s+|(?<=\.)\s+(?=[A-Z])/))
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && s.length < 400);
}

function titleBrand(s: string): string {
  return s
    .replace(/[^\w&'+ .-]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(" ");
}

export function brandFromDomain(label: string, tld: string): string {
  const full = `${label}.${tld}`.toLowerCase();
  if (SPECIAL[full]) return SPECIAL[full];
  if (SPECIAL[label.toLowerCase()]) return SPECIAL[label.toLowerCase()];
  return label.replace(/^(try|get|join|go|shop|drink|eat|use|play|my)(?=[a-z]{4,})/i, "").replace(/^\w/, (c) => c.toUpperCase());
}

function validBrand(b: string, show: string): boolean {
  const t = b.trim();
  if (!t || t.length < 2 || t.length > 40) return false;
  if (NOT_BRANDS.has(t.toLowerCase())) return false;
  if (CTA.test(t) || LEGAL.test(t) || TITLEY.test(t)) return false;
  if (/\d{1,2}:\d{2}/.test(t) || /https?:|www\.|[@#/]/.test(t)) return false;
  if (show && (show.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(show.toLowerCase()))) return false;
  if (!/[A-Za-z]/.test(t)) return false;
  return true;
}

/** Sponsors named in show notes or a video description. */
export function extractSponsors(text: string, show: string, showDomain?: string): SponsorHit[] {
  const out = new Map<string, SponsorHit>();
  for (const s of sentences(text)) {
    const cue = s.match(CUE);
    const pres = PRESENTED.test(s);
    if (!cue && !pres) continue;
    const after = pres ? s.replace(PRESENTED, "") : s.slice((cue!.index || 0) + cue![0].length);
    const domains = [...s.matchAll(DOMAIN_RE)].filter((m) => !(showDomain && `${m[1]}.${m[2]}`.toLowerCase().includes(showDomain.toLowerCase())));
    // a capitalized brand right after the cue ("sponsored by Kalshi. Trade on…")
    const cm = after.match(/^\s*[:-]?\s*((?:[A-Z][\w&'+.-]*|[A-Z]{2,})(?:\s+(?:[A-Z][\w&'+.-]*|&|of|and)){0,3})/);
    let brand = cm ? titleBrand(cm[1]).replace(/\s+(and|of|&)$/i, "").replace(/[.]+$/, "") : "";
    const lead = after.trim().slice(0, 48);
    if (brand && (CTA.test(lead) || TITLEY.test(lead.split(/\s+/).slice(0, 4).join(" ")))) brand = "";
    let domain: string | null = null;
    if (domains.length) {
      const d = domains.find((m) => brand && m[1].toLowerCase().replace(/-/g, "").includes(brand.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5))) || domains[0];
      domain = `${d[1]}.${d[2]}`.toLowerCase();
      if (!brand || !validBrand(brand, show)) brand = brandFromDomain(d[1], d[2]);
    }
    if (!validBrand(brand, show)) continue;
    const key = brand.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!out.has(key)) out.set(key, { brand, domain, evidence: s.slice(0, 220) });
  }
  return [...out.values()];
}

export type Mention = { entity: string; stance: "recommends" | "likes" | "discusses" | "criticizes" | "sponsors"; quote: string };

function stanceOf(s: string): Mention["stance"] {
  if (CUE.test(s) || PRESENTED.test(s)) return "sponsors";
  if (/\b(recommend|obsessed|must[- ]have|go[- ]to|swear by|favorite|favourite|love (?:using|this|my))\b/i.test(s)) return "recommends";
  if (/\b(hate|terrible|scam|worst|awful|overrated|garbage|ripped off|lawsuit|sued)\b/i.test(s)) return "criticizes";
  if (/\b(like|enjoy|great|amazing|solid|good)\b/i.test(s)) return "likes";
  return "discusses";
}

const PRODUCT_CTX = /\b(app|brand|startup|launched|launches|new company|platform|drink|beverage|shoes|apparel|league|game)\b/i;

/** Known names (companies, portfolio, sponsors) plus capitalized product names near "app/brand/startup/launched". */
// Portfolio and company names that are also everyday words only count as a name in a product context
const WORDY = new Set(["future", "jump", "journey", "tap", "system", "eternal", "beam", "betty", "mantel", "chrono", "mojo", "jawa", "fermat", "gainful", "commons", "every mother", "magic story", "packz", "venly", "matchday", "percepto", "stay tuned", "play pulse", "rebel mail", "noise", "pops", "result", "persona", "mona", "juno", "ramp"]);
const BOILERPLATE = /\b(hosted by|an adswizz company|privacy policy|ad choices|adchoices|learn more about your ad|podcast(?:choices)?\.com\/adchoices|see omnystudio|terms of use|all rights reserved)\b/i;

export function extractMentions(text: string, show: string, known: string[]): Mention[] {
  const out = new Map<string, Mention>();
  const knownRe = known.length
    ? new RegExp(`(?<![\\w-])(${known
        .filter((k) => k.length > 2)
        .sort((a, b) => b.length - a.length)
        .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|")})(?![\\w-])`, "g")
    : null;
  const showL = show.toLowerCase();
  for (const s of sentences(text)) {
    if (BOILERPLATE.test(s)) continue;
    const found: string[] = [];
    if (knownRe)
      for (const m of s.matchAll(knownRe)) {
        if (WORDY.has(m[1].toLowerCase()) && !new RegExp(`${m[1]}\\s+(app|brand|startup|platform|league|company)|\\b(app|brand|startup)\\s+${m[1]}`, "i").test(s)) continue;
        found.push(m[1]);
      }
    if (PRODUCT_CTX.test(s)) {
      const m = s.match(/\b([A-Z][a-z]+[A-Z]?\w*(?:\s[A-Z]\w+)?)\s+(?:app|brand|startup|platform)\b/) || s.match(/\b(?:launched|launches|new app|new brand|startup)\s+([A-Z][\w]+(?:\s[A-Z]\w+)?)/);
      if (m && validBrand(m[1], show)) found.push(m[1]);
    }
    for (const f of found) {
      if (showL.includes(f.toLowerCase())) continue; // a show mentioning its own name is not a mention
      const k = f.toLowerCase();
      if (!out.has(k)) out.set(k, { entity: f, stance: stanceOf(s), quote: s.slice(0, 260) });
    }
  }
  return [...out.values()];
}
