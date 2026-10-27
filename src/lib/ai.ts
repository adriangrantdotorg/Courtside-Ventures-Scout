// AI is a bonus, never a requirement. Detected by a cheap daily check; off means the muted state.
import { getSetting, setSetting } from "./settings";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { ThesisCheck } from "@/db/schema";

// Every model is on AI Gateway's free tier, so the $5 monthly credit pays for them. No Claude model is on the free
// tier: memo drafts moved from Claude Sonnet 4.5 to GPT-5 (Adrian, 10-26-26). A guard test keeps them on the list.
// The thesis check runs on GPT-5 mini: 24 of 24 right on the 12 known cases, where Flash-Lite missed 4 or 5 (10-26-26).
export const MODELS = { writer: "openai/gpt-5", checker: "openai/gpt-5-mini", worker: "google/gemini-2.5-flash-lite" };

/** Daily caps, so the free $5 a month can never run out mid-month (Adrian, 10-26-26): at most 4 memo drafts a day
 *  (measured $0.031 each: at most $3.84 a month) and 60 thesis checks (measured $0.0004 each, counted at $0.0005: at
 *  most $0.93 a month). Together under $5 even on a month that hits both caps every day. */
export const CAPS = { memoDailyCap: 4, thesisCheckDailyCap: 60, launchChecks: 300 };
/** The launch run (Adrian, 10-26-26: every card checked the day the live site ships, not spread over days) may go
 *  `launchChecks` past the daily cap on one day a month: still under $5 when every other cap is hit too. */
/** The free tier allows 5 calls a minute per model; the checks keep a gap so a long run never hits the limit. */
export const CHECK_GAP_MS = 12_500;
/** Every AI call has a time limit, a safety net: a call that never answers would hold its job until Vercel stops the
 *  function at 300 s. (The 15- and 32-minute "stalls" of 10-26-26 were the Mac asleep, not the AI.) A check answers
 *  in about 2 s; a memo draft stays under the 300 s limit. */
export const TIMEOUTS = { checkMs: 30_000, memoMs: 200_000, dailyCheckMs: 20_000 };
/** The shortest room worth starting a check in. */
export const CHECK_MIN_MS = 5_000;
let lastCheck = 0;
export const MEMO_CAP_MESSAGE = "AI drafting is done for today; copy the outline instead.";

export async function aiAvailable(): Promise<boolean> {
  const s = await getSetting<{ ok: boolean; at: string } | null>("aiCheck", null);
  return !!s?.ok;
}

/** One cheap call a day decides whether the AI features turn on. 402, 403, 429: quietly off. */
export async function checkAi(): Promise<boolean> {
  let ok = false;
  try {
    if (!process.env.VERCEL_OIDC_TOKEN && !process.env.AI_GATEWAY_API_KEY) throw new Error("no gateway auth");
    const { generateText } = await import("ai");
    const r = await generateText({ model: MODELS.worker, prompt: "Reply with OK.", maxOutputTokens: 5, timeout: TIMEOUTS.dailyCheckMs });
    ok = /ok/i.test(r.text);
  } catch {
    ok = false;
  }
  await setSetting("aiCheck", { ok, at: new Date().toISOString() });
  return ok;
}

/** Counts one call of this kind today; false once today's cap (plus `extra`) is reached. Memo drafts and checks count apart. */
async function underCap(kind: "memo" | "check", extra = 0): Promise<boolean> {
  if (kind === "memo") {
    const cap = await getSetting<number>("memoDailyCap", CAPS.memoDailyCap);
    const r = (await db().execute(sql`insert into ai_usage (day, calls) values (current_date, 1) on conflict (day) do update set calls = ai_usage.calls + 1 returning calls`)) as unknown as { rows: { calls: number }[] };
    return Number(r.rows[0]?.calls || 0) <= cap;
  }
  const cap = await getSetting<number>("thesisCheckDailyCap", CAPS.thesisCheckDailyCap);
  const r = (await db().execute(sql`insert into ai_usage (day, calls, checks) values (current_date, 0, 1) on conflict (day) do update set checks = ai_usage.checks + 1 returning checks`)) as unknown as { rows: { checks: number }[] };
  return Number(r.rows[0]?.checks || 0) <= cap + extra;
}

/** A memo draft, "cap" when today's 4 are used, or null when the draft didn't come back. */
export async function draftMemo(id: number, outline: string): Promise<string | "cap" | null> {
  const key = `memo2:${id}:${new Date().toISOString().slice(0, 10)}`; // memo2: drafts cached before GPT-5 could be empty
  const cached = await getSetting<string | null>(key, null);
  if (cached) return cached; // the same company again today is free: it never counts against the cap
  if (!(await underCap("memo"))) return "cap";
  try {
    const { generateText } = await import("ai");
    // GPT-5 thinks before it writes, and the thinking counts against the output limit: at Claude's 1,600 it left
    // no room for the memo (an empty draft, 10-26-26). Low thinking and room for the whole memo.
    const r = await generateText({
      model: MODELS.writer,
      reasoning: "low",
      timeout: TIMEOUTS.memoMs,
      prompt: `Write a first draft of this investment memo in Courtside Ventures' "Why We Invested" voice, following the outline exactly. Cite sources inline with their links. Keep every [TBD] placeholder; never invent a number, name or date.\n\n${outline}`,
      maxOutputTokens: 8000,
    });
    if (r.text.trim().length < 200) return null; // an empty or cut-off draft is a failure, never a result
    const text = `> Draft for internal discussion. Verify every figure.\n\n${r.text}`;
    await setSetting(key, text);
    return text;
  } catch {
    return null;
  }
}

/** The question the AI Thesis Check asks. It judges the NAME Scout found, not the story around it: "DJ Reinier
 *  Zonneveld launches GasLab" is a person, so the card is wrong even though GasLab may fit (live test, 10-26-26).
 *  On fit it leans to YES: a real startup hidden by mistake costs more than a stray card, and the team can hide one
 *  in a click (Settings › Hidden Startups). */
export function thesisPrompt(c: { name: string; area: string | null; description: string | null; headlines: string[] }): string {
  return [
    "You screen names for Courtside Ventures, a pre-seed and seed fund that backs consumer startups in sports, gaming, lifestyle, health (including wellness and fitness) and media (including music, creators and entertainment).",
    `Name Scout found: ${c.name}`,
    c.area ? `Area Scout guessed: ${c.area}` : "",
    c.description ? `What Scout knows: ${c.description.replace(/\s+/g, " ").slice(0, 400)}` : "",
    c.headlines.length ? `Headlines:\n${c.headlines.slice(0, 3).map((h) => `- ${h}`).join("\n")}` : "",
    `Decide what this name refers to in the headlines. Answer NO when:
- it refers to a person (a founder, DJ, athlete or creator), even when the headline is about a company they started; a company named after someone is still a company
- it refers to a product release (a version number like 4.0 marks one)
- it refers to a big company's product, or to a big, public or long-established company (a chain of gyms or stores, or a brand or publisher around for over ten years), a stadium or a school; an app from a small maker is that maker's startup
- the business sells to businesses, including clubs, teams and gyms, or is finance, industrial, or astrology and spiritual readings
- it is a phrase, not a company
Otherwise answer YES when it is a consumer startup in one of those areas. If unsure, answer YES.`,
    "Reply on one line: YES or NO | area (sports, gaming, lifestyle, health, media or none) | reason in under ten words.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** "NO | none | a person, not a company" → { ok: false, area: null, why: "a person, not a company" } */
export function parseThesisAnswer(text: string): { ok: boolean; area: string | null; why: string } | null {
  const line = text.trim().split("\n")[0];
  const m = line.match(/^\W*(YES|NO)\b\s*[|,:-]?\s*([a-z]+)?\s*[|,:-]?\s*(.*)$/i);
  if (!m) return null;
  const area = (m[2] || "").toLowerCase();
  return { ok: m[1].toUpperCase() === "YES", area: ["sports", "gaming", "lifestyle", "health", "media"].includes(area) ? area : null, why: m[3].replace(/^[|\s-]+/, "").trim().slice(0, 120) };
}

/** The AI Thesis Check for one company, or null when AI is off, today's checks are used, or no answer came back in
 *  time. `roomMs` is all it may take, the gap included, so a check never runs past its job's time box. */
export async function thesisCheck(c: { name: string; area: string | null; description: string | null; headlines: string[] }, roomMs = 2 * (CHECK_GAP_MS + TIMEOUTS.checkMs), launch = false): Promise<ThesisCheck | null> {
  const end = Date.now() + roomMs;
  try {
    if (!(await underCap("check", launch ? CAPS.launchChecks : 0))) return null;
    const { generateText } = await import("ai");
    for (let i = 0; i < 2; i++) {
      // calls in a row hit the free tier's 5 a minute (3 of 12 failed in the live test, 10-26-26): keep the gap
      const wait = Math.max(0, lastCheck + CHECK_GAP_MS - Date.now());
      const limit = Math.min(TIMEOUTS.checkMs, end - Date.now() - wait);
      if (limit < CHECK_MIN_MS) return null;
      await new Promise((r) => setTimeout(r, wait));
      lastCheck = Date.now();
      try {
        // GPT-5 mini thinks before it answers, and the thinking counts against the output limit
        const r = await generateText({ model: MODELS.checker, reasoning: "low", prompt: thesisPrompt(c), maxOutputTokens: 2000, timeout: limit });
        const a = parseThesisAnswer(r.text);
        if (a) return { ...a, model: MODELS.checker, at: new Date().toISOString() };
      } catch (e) {
        if (i) throw e;
      }
    }
    return null;
  } catch {
    return null;
  }
}
