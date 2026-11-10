// Scout V2 (10-26-26): the rules behind the cards, shared by the server, the browser and the tests.
// Decisions and their history: design/v2/NOTES.md.
import type { Round } from "@/db/schema";
import { fmtMoney, STAGE_LABEL } from "./format";

/** Scout never recommends a company that has raised this much or more in total (Adrian, 10-26-26). */
export const CAP = 15_000_000;

/** Funds Raised ranges for the filters. A range with no companies is never offered. */
export const BUCKETS = ["Unknown", "Under $1M", "$1–5M", "$5–15M"] as const;
export function bucketOf(total: number | null | undefined): number {
  if (!total) return 0;
  if (total < 1e6) return 1;
  if (total < 5e6) return 2;
  return 3;
}

/** The Funds Raised menu (Pipeline and Today's On the Radar): each range, plus Under $5M, which takes the two ranges
 *  under $5M together (Adrian, 11-10-26). Unknown is a startup with no amount on record, never counted under $5M. */
export const UNDER_5M = "lt5";
export const FUNDS_OPTS: [string, string][] = [["0", BUCKETS[0]], ["1", BUCKETS[1]], [UNDER_5M, "Under $5M"], ["2", BUCKETS[2]], ["3", BUCKETS[3]]];
export const fundsLabel = (v: string) => FUNDS_OPTS.find(([k]) => k === v)?.[1] || "All";
export function inFunds(bucket: number, v: string): boolean {
  if (v === "") return true;
  if (v === UNDER_5M) return bucket === 1 || bucket === 2;
  return String(bucket) === v;
}

/** The line a card shows when Scout has no words of its own for the startup: whyFitsLine() writes it, and the
 *  Pipeline's Details menu reads it back, so the two never drift apart. */
export const standInWhat = (area: string) => `A new ${area || "consumer"} company`;
const STAND_IN = /^A new [\w-]+ company\b/;
/** Details = the line the startup's row shows says what it does: not the stand-in "A new Gaming company, inside the
 *  thesis; raised $500K" (Adrian, 11-10-26: a website alone is no details; Arcustin Games had one and showed only that
 *  line), and at least three words of its own before ", inside the thesis" or the raise (a scraped page title
 *  "Homepage", or the name again, "Nineteen Films", says nothing). Pass the exact line the row shows. */
export function hasDetails(line: string): boolean {
  const t = line.trim();
  const what = t.split(/, inside |; /)[0];
  return !STAND_IN.test(t) && what.split(/\s+/).filter(Boolean).length >= 3;
}

/** New means a real signal in the last 7 days: the green chip and the "New This Week" filter read the same rule. */
export const NEW_DAYS = 7;
export function isNew(lastSignal: string | null | undefined, now = Date.now()): boolean {
  if (!lastSignal) return false;
  const t = new Date(lastSignal).getTime();
  return !isNaN(t) && now - t < NEW_DAYS * 86400000;
}

/** Must See only looks at startups in the news this recently. */
export const MUST_SEE_DAYS = 14;

/** Thesis fit colors the ring from amber (40%) to green (60%+). */
export function fitHue(fit: number): number {
  return Math.max(40, Math.min(140, 40 + (fit - 40) * 5));
}

/** No official website yet: Find Website searches the web, and never pretends a guess is the official site. */
export function searchUrl(name: string, area?: string | null): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`"${name}" ${area ? area.toLowerCase() + " " : ""}startup official site`)}`;
}

/** Amounts in US dollars, so rounds in other currencies add up and meet the cap. */
// older rows saved the symbol ("€") instead of the code ("EUR"): both convert
const TO_USD: Record<string, number> = { $: 1, USD: 1, EUR: 1.08, "€": 1.08, GBP: 1.27, "£": 1.27, INR: 0.012, "₹": 0.012, CAD: 0.73, AUD: 0.66 };
export function usd(amount: number | null | undefined, currency = "$"): number | null {
  if (!amount || !isFinite(amount)) return null;
  return amount * (TO_USD[currency] ?? 1);
}

/** A company's saved raise as Scout shows it everywhere: in dollars, so it agrees with Funds Raised on the same card
 *  ("₹4 crore" → "$480K", never "₹40.0M" or "$40.0M"). The one producer for the why-fits line, the memo and the card. */
export function raisedText(amount: number | string | null | undefined, currency = "$"): string {
  const n = usd(amount === null || amount === undefined || amount === "" ? null : Number(amount), currency);
  return n ? fmtMoney(n, "$") : "";
}

function money(n: number): string {
  return fmtMoney(n, "$");
}
/** "$2.0–2.2M", or "$500K–$1.2M" when the two ends sit in different units. */
export function moneyRange(lo: number, hi: number): string {
  if (hi <= 0) return "";
  if (lo >= hi * 0.95) return money(hi);
  if (lo >= 1e6) return `$${(lo / 1e6).toFixed(1)}–${(hi / 1e6).toFixed(1)}M`;
  return `${money(lo)}–${money(hi)}`;
}

export type Funds = {
  total: number | null; // the highest reported total, in dollars: what the cap reads
  text: string; // "$4.1M", "$2.0–2.2M" or "Unknown"
  known: boolean;
  stage: string | null; // the latest round, Title Case
  rounds: Round[];
  sourceCount: number;
  agree: boolean; // every source reports the same amounts
};

/** Funds Raised: the rounds Scout knows about, added up. Sources that disagree show as a range. */
export function fundsOf(rounds: Round[], fallback: { amount: number | null; currency: string; stage: string }): Funds {
  const withAmt = rounds.filter((r) => r.amount);
  let hi = withAmt.reduce((s, r) => s + (r.amount || 0), 0);
  let lo = withAmt.reduce((s, r) => s + (r.low ?? r.amount ?? 0), 0);
  if (!hi && fallback.amount) hi = lo = usd(fallback.amount, fallback.currency) || 0;
  const latest = [...rounds].filter((r) => r.stage !== "unknown").sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
  const stageKey = latest?.stage || (fallback.stage !== "unknown" ? fallback.stage : null);
  const sourceCount = rounds.reduce((s, r) => s + r.sources.length, 0);
  return {
    total: hi || null,
    text: hi ? moneyRange(lo, hi) : "Unknown",
    known: !!hi,
    stage: stageKey ? STAGE_LABEL[stageKey] || stageKey : null,
    rounds,
    sourceCount,
    agree: sourceCount > 1 && lo >= hi * 0.95,
  };
}

/** True when a company has raised too much for Scout to recommend it. */
export function overCap(total: number | null | undefined): boolean {
  return !!total && total >= CAP;
}
