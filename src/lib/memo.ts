// Courtside's eight-part "Why We Invested" outline, filled with every fact and link Scout has.
import { desc, eq } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { areaLabel, fmtDate, stageLabel } from "./format";
import { playOf } from "./score";
import { raisedText } from "./v2";
import { cleanCopy } from "./copy";
import { articleUrl } from "./sources/gnews";

/** The most stories a memo cites: each Google News link is opened once (about 4 s the first time, then remembered). */
export const MEMO_SOURCES = 8;

export async function memoOutline(id: number): Promise<{ name: string; markdown: string } | null> {
  const [c] = await db().select().from(S.companies).where(eq(S.companies.id, id));
  if (!c) return null;
  const sigs = await db().select().from(S.signals).where(eq(S.signals.companyId, id)).orderBy(desc(S.signals.date));
  const filing = (await db().select().from(S.filings).where(eq(S.filings.companyId, id)).limit(1))[0];
  const play = playOf(`${c.name}. ${c.description || ""}`, c.thesisArea);
  const area = areaLabel(c.thesisArea) || "consumer";
  const round = c.amount ? `${raisedText(c.amount, c.currency)} ${stageLabel(c.stage)}` : c.stage !== "unknown" ? stageLabel(c.stage) : "[TBD: round size]";
  // the stories' own addresses, never Google News redirects (11-06-26: a memo's Sources were long news.google.com
  // links); a link Google won't open is listed without one
  const shown = sigs.slice(0, MEMO_SOURCES);
  const own = new Map<string, string | null>();
  for (const s of shown) own.set(s.url, await articleUrl(s.url));
  const src = shown.map((s) => `- ${s.title} (${s.source}${s.date ? `, ${fmtDate(s.date)}` : ""})${own.get(s.url) ? `: ${own.get(s.url)}` : ""}`).join("\n");
  // the round's investors, as the news names them, with that story's own link (11-06-26: the draft asked the founder
  // who backed Hoopr's round though Scout knew The Chennai Angels did)
  const backed = [...(c.rounds || [])].filter((r) => r.investors).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
  let backers = "";
  if (backed) {
    let link: string | null = null;
    for (const s of backed.sources) if (!link && s.url) link = own.get(s.url) ?? (await articleUrl(s.url));
    backers = `Investors the news names: ${backed.investors}${link ? ` (${link})` : ""}. Who led: [TBD: lead investor, if the news doesn't say].`;
  }
  const founders = filing?.related?.length ? filing.related.join(", ") + ` (named in the Form D: ${filing.url})` : "[TBD: founders and their track record]";
  const md = `# Why We Invested: ${c.name}

> What Scout hands the AI that writes the draft (src/lib/memo-draft.ts): every [TBD] is a gap it turns into a question
> for the founder, never a word in the memo; never guess a number.

## 1. Title
Why We Invested: ${c.name}

## 2. The trend Courtside has been tracking
Open in first person plural ("At Courtside, we've been closely tracking…") on the ${area} trend this company rides${play ? ` (${play.label}, the play behind Courtside's investment in ${play.parallel})` : ""}. Back it with 2 to 4 sourced stats: [TBD: market stats with sources].

## 3. The turn
"It is with this backdrop that we are thrilled to announce…" ${c.name}'s ${round}. ${backers || "Who led: [TBD: lead investor]. Who participated: [TBD: participants]."}

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
