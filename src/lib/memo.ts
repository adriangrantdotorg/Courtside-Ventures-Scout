// Courtside's eight-part "Why We Invested" outline, filled with every fact and link Scout has.
import { desc, eq } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { areaLabel, fmtDate, fmtMoney, stageLabel } from "./format";
import { playOf } from "./score";
import { cleanCopy } from "./copy";

export async function memoOutline(id: number): Promise<{ name: string; markdown: string } | null> {
  const [c] = await db().select().from(S.companies).where(eq(S.companies.id, id));
  if (!c) return null;
  const sigs = await db().select().from(S.signals).where(eq(S.signals.companyId, id)).orderBy(desc(S.signals.date));
  const filing = (await db().select().from(S.filings).where(eq(S.filings.companyId, id)).limit(1))[0];
  const play = playOf(`${c.name}. ${c.description || ""}`, c.thesisArea);
  const area = areaLabel(c.thesisArea) || "consumer";
  const round = c.amount ? `${fmtMoney(c.amount, c.currency)} ${stageLabel(c.stage)}` : c.stage !== "unknown" ? stageLabel(c.stage) : "[TBD: round size]";
  const src = sigs.map((s) => `- ${s.title} (${s.source}${s.date ? `, ${fmtDate(s.date)}` : ""}): ${s.url}`).join("\n");
  const founders = filing?.related?.length ? filing.related.join(", ") + ` (named in the Form D: ${filing.url})` : "[TBD: founders and their track record]";
  const md = `# Why We Invested: ${c.name}

> Draft for internal discussion. Verify every figure.
> Write this in Courtside's "Why We Invested" voice: confident, specific, optimistic, never hype-y. 600 to 900 words. Keep every [TBD] as a placeholder; never guess a number.

## 1. Title
Why We Invested: ${c.name}

## 2. The trend Courtside has been tracking
Open in first person plural ("At Courtside, we've been closely tracking…") on the ${area} trend this company rides${play ? ` (${play.label}, the play behind Courtside's investment in ${play.parallel})` : ""}. Back it with 2 to 4 sourced stats: [TBD: market stats with sources].

## 3. The turn
"It is with this backdrop that we are thrilled to announce…" ${c.name}'s ${round}. Who led: [TBD: lead investor]. Who participated: [TBD: participants].

## 4. What the company does
${cleanCopy(c.description) || "[TBD: one paragraph in plain words]"}${c.descriptionUrl ? `\nSource: ${c.descriptionUrl}` : ""}${c.domain ? `\nWebsite: https://${c.domain}` : ""}

## 5. The founders
${founders}

## 6. Why now, and why it's venture scale
${cleanCopy(c.whyFits) || ""}
Market size: [TBD: market numbers with sources]. Courtside's earlier bets in the space: ${play ? play.parallel : "[TBD: portfolio parallels]"}${c.portfolioCheck ? `; portfolio check: ${c.portfolioCheck.kind === "competes" ? "competes with" : "adjacent to"} ${c.portfolioCheck.with} (${cleanCopy(c.portfolioCheck.reason)})` : ""}.

## 7. Where it goes next
[TBD: the "Phase 3" framing], then one conviction line.

## 8. Sign-off
🔗 Learn more at ${c.domain ? `https://${c.domain}` : "[TBD: site]"}
✉️ Interested in talking with the team? We're happy to connect you.

---
## Everything Scout has on ${c.name}
- Thesis area: ${area} · Stage: ${stageLabel(c.stage)} · Thesis fit: ${c.score}%
- First seen by Scout: ${fmtDate(c.firstSeen)}
${src || "- [TBD: sources]"}
`;
  return { name: c.name, markdown: md };
}
