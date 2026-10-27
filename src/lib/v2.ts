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
const TO_USD: Record<string, number> = { $: 1, USD: 1, EUR: 1.08, GBP: 1.27, INR: 0.012, CAD: 0.73, AUD: 0.66 };
export function usd(amount: number | null | undefined, currency = "$"): number | null {
  if (!amount || !isFinite(amount)) return null;
  return amount * (TO_USD[currency] ?? 1);
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
