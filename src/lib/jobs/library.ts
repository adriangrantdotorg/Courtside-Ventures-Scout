// The Library backfill (Adrian, 10-26-26): the startups the team saved get a card when their funding story is found
// and the AI Thesis Check says they fit. Runs on ship day: npm run pipeline:all -- library --rounds=5
import { eq } from "drizzle-orm";
import { db, schema as S } from "@/db";
import * as F from "../sources/fetchers";
import { classify } from "../thesis";
import { knownCompany, upsertCompany } from "../companies";
import { aiAvailable, thesisCheck, CHECK_GAP_MS, TIMEOUTS } from "../ai";
import { LIBRARY, libraryStory, LIBRARY_DAYS } from "../library";
import { FUNDING_Q } from "./collect-signals";
import { launchAllowed } from "./enrich";
import type { Ctx } from "./runner";

export async function libraryJob(ctx: Ctx) {
  if (!(await aiAvailable())) {
    ctx.change("AI is off: the Library backfill waits for the AI screen");
    return;
  }
  const launch = await launchAllowed(); // ship day: these checks share the launch allowance
  const done = await ctx.cursor<{ k: number } | null>(null);
  let k = done?.k || 0;
  await ctx.stage("startups the team saved", k, LIBRARY.length);
  for (; k < LIBRARY.length; k++) {
    // room for one search and one check, so a round never stops halfway through a company
    if (ctx.timeLeft() < CHECK_GAP_MS + TIMEOUTS.checkMs + 10_000) {
      ctx.more();
      break;
    }
    const p = LIBRARY[k];
    if (await knownCompany(p.name, p.domain)) {
      ctx.tick();
      continue;
    }
    const story = libraryStory(p.name, await F.googleNews(FUNDING_Q(p.name), `${LIBRARY_DAYS}d`));
    if (!story) {
      ctx.tick();
      continue;
    }
    const area = classify(`${story.title}. ${story.text || ""}`).area;
    const check = await thesisCheck({ name: p.name, area, description: story.text || null, headlines: [story.title] }, ctx.timeLeft() - 5_000, launch);
    if (!check) break; // AI off, today's checks used, or no answer: the cursor keeps the place for the next run
    if (!check.ok || !(check.area || area)) {
      ctx.change(`Library: ${p.name} kept out (${check.why || "no area"})`);
      ctx.tick();
      continue;
    }
    const long = story.text && story.text.length > 40;
    const r = await upsertCompany({
      name: p.name,
      domain: p.domain || null,
      thesisArea: check.area || area,
      stage: story.stage,
      amount: story.amount,
      currency: story.currency,
      description: long ? story.text! : null,
      descriptionUrl: long ? story.url : null,
      signal: { type: "news", source: story.outlet || "Google News", title: story.title, url: story.url, date: story.date ? new Date(story.date) : null },
    });
    if (r) {
      await db().update(S.companies).set({ thesisCheck: check }).where(eq(S.companies.id, r.id));
      ctx.item();
      if (r.created) ctx.change(`Library: new company ${p.name}`);
    }
    ctx.tick();
  }
  await ctx.saveCursor({ k: k >= LIBRARY.length ? 0 : k });
}
