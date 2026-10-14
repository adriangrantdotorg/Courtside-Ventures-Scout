// AI is a bonus, never a requirement. Detected by a cheap daily check; off means the muted state.
import { getSetting, setSetting } from "./settings";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const MODELS = { writer: "anthropic/claude-sonnet-4.5", worker: "google/gemini-2.5-flash-lite" };

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
    const r = await generateText({ model: MODELS.worker, prompt: "Reply with OK.", maxOutputTokens: 5 });
    ok = /ok/i.test(r.text);
  } catch {
    ok = false;
  }
  await setSetting("aiCheck", { ok, at: new Date().toISOString() });
  return ok;
}

async function underCap(): Promise<boolean> {
  const cap = await getSetting<number>("aiDailyCap", 150);
  const r = (await db().execute(sql`insert into ai_usage (day, calls) values (current_date, 1) on conflict (day) do update set calls = ai_usage.calls + 1 returning calls`)) as unknown as { rows: { calls: number }[] };
  return Number(r.rows[0]?.calls || 0) <= cap;
}

export async function draftMemo(id: number, outline: string): Promise<string | null> {
  const key = `memo:${id}:${new Date().toISOString().slice(0, 10)}`;
  const cached = await getSetting<string | null>(key, null);
  if (cached) return cached;
  if (!(await underCap())) return null;
  try {
    const { generateText } = await import("ai");
    const r = await generateText({
      model: MODELS.writer,
      prompt: `Write a first draft of this investment memo in Courtside Ventures' "Why We Invested" voice, following the outline exactly. Cite sources inline with their links. Keep every [TBD] placeholder; never invent a number, name or date.\n\n${outline}`,
      maxOutputTokens: 1600,
    });
    const text = `> Draft for internal discussion. Verify every figure.\n\n${r.text}`;
    await setSetting(key, text);
    return text;
  } catch {
    return null;
  }
}
