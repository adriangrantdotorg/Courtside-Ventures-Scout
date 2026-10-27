// npm run check:ai: a real call to each model Scout uses, through AI Gateway, with the settings the app uses.
// Writes nothing. Needs a fresh .env.local (`npx vercel@latest env pull .env.local`): the local OIDC token expires.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { generateText } from "ai";
import { MODELS, TIMEOUTS, thesisPrompt, parseThesisAnswer } from "../src/lib/ai";

type Check = { what: string; model: string; run: () => Promise<{ ok: boolean; note: string }> };
const checks: Check[] = [
  {
    what: "Daily AI check (turns the AI features on)",
    model: MODELS.worker,
    run: async () => {
      const r = await generateText({ model: MODELS.worker, prompt: "Reply with OK.", maxOutputTokens: 5, timeout: TIMEOUTS.dailyCheckMs });
      return { ok: /ok/i.test(r.text), note: JSON.stringify(r.text.trim()) };
    },
  },
  {
    what: "AI Thesis Check",
    model: MODELS.checker,
    run: async () => {
      // the same prompt and settings as thesisCheck(), on a known case: a DJ is a person, never a startup card
      const r = await generateText({ model: MODELS.checker, reasoning: "low", maxOutputTokens: 2000, timeout: TIMEOUTS.checkMs, prompt: thesisPrompt({ name: "DJ Reinier Zonneveld", area: "media", description: null, headlines: ["DJ Reinier Zonneveld launches AI music startup GasLab with $1M pre-seed funding"] }) });
      const a = parseThesisAnswer(r.text);
      return { ok: a?.ok === false, note: JSON.stringify(r.text.trim()) };
    },
  },
  {
    what: "Draft the Memo",
    model: MODELS.writer,
    run: async () => {
      // the same thinking setting and room as draftMemo(): a short brief, so the check costs a fraction of a cent
      const r = await generateText({ model: MODELS.writer, reasoning: "low", maxOutputTokens: 8000, timeout: TIMEOUTS.memoMs, prompt: "In three sentences, in a venture firm's voice, say why a real-time multiplayer skill-gaming startup that raised a $2.5M seed is interesting. Keep [TBD] for anything unknown." });
      return { ok: r.text.trim().length >= 150, note: `${r.text.trim().length} characters, ${r.usage.outputTokens ?? "?"} output tokens` };
    },
  },
];

let bad = 0;
for (const c of checks) {
  const t0 = Date.now();
  try {
    const r = await c.run();
    if (!r.ok) bad++;
    console.log(`${r.ok ? "✅" : "❌"} ${c.what} · ${c.model} · ${((Date.now() - t0) / 1000).toFixed(1)}s · ${r.note}`);
  } catch (e) {
    bad++;
    const err = e as { statusCode?: number; message?: string };
    console.log(`❌ ${c.what} · ${c.model} · ${err.statusCode || ""} ${(err.message || String(e)).slice(0, 200)}`);
  }
}
process.exit(bad ? 1 : 0);
