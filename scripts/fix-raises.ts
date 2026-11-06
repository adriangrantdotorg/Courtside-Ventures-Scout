// One-off repair (11-05-26 and 11-06-26) of two misread funding stories. Prints what it would change; --write saves
// it. Then run the score job, which rewrites each card's why-fits line: `npm run pipeline:all -- score`.
// 1. Currency: a card saved with no amount kept its default "$"; a later "₹4 crore" story filled the amount and left the
//    "$", so Hoopr read "raised $40.0M" for about $480K. A card whose saved amount appears in its own headlines only
//    in another currency takes that currency. (The fix that stops new ones: upsertCompany in src/lib/companies.ts.)
// 2. Stage: "pre-Series A" read as Series A (Hoopr, Vytalyou, Gamepoint, Matiks). A card or round at Series A whose
//    headlines say pre-Series A and never plain Series A becomes pre-Series A. (The fix: stageOf.)
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const write = process.argv.includes("--write");
const { db, schema: S, saveLocalDb } = await import("../src/db");
const { eq } = await import("drizzle-orm");
const { moneyOf, stageOf } = await import("../src/lib/companies");
const cs = await db().select({ id: S.companies.id, name: S.companies.name, amount: S.companies.amount, currency: S.companies.currency, stage: S.companies.stage, rounds: S.companies.rounds }).from(S.companies);
let money = 0, stages = 0;
const preA = (titles: string[]) => titles.some((t) => stageOf(t) === "pre-series-a") && !titles.some((t) => stageOf(t) === "series-a");
for (const c of cs) {
  const titles = (await db().select({ t: S.signals.title }).from(S.signals).where(eq(S.signals.companyId, c.id))).map((r) => r.t);
  const set: { currency?: string; stage?: string; rounds?: typeof c.rounds } = {};
  if (c.amount && c.currency === "$") {
    const ms = titles.map((t) => moneyOf(t)).filter((m): m is { amount: number; currency: string } => !!m && m.amount === Number(c.amount));
    if (ms.length && !ms.some((m) => m.currency === "$")) set.currency = ms[0].currency;
  }
  if (c.stage === "series-a" && preA(titles)) set.stage = "pre-series-a";
  const rounds = (c.rounds || []).map((r) => (r.stage === "series-a" && preA(r.sources.map((s) => s.title)) ? { ...r, stage: "pre-series-a" } : r));
  if (rounds.some((r, i) => r.stage !== c.rounds![i].stage)) set.rounds = rounds;
  if (!Object.keys(set).length) continue;
  if (set.currency) money++;
  if (set.stage || set.rounds) stages++;
  console.log(`${c.name} (#${c.id}):${set.currency ? ` ${c.amount} ${c.currency} → ${set.currency};` : ""}${set.stage ? ` stage ${c.stage} → ${set.stage};` : ""}${set.rounds ? " a round → pre-Series A" : ""}`);
  if (write) await db().update(S.companies).set(set).where(eq(S.companies.id, c.id));
}
if (write) await saveLocalDb();
console.log(`${money} currencies, ${stages} stages ${write ? "repaired" : "to repair (dry run; --write saves)"}`);
process.exit(0);
