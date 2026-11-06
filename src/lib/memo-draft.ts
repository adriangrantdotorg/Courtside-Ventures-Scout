// Gaps Become Questions (11-06-26): the memo draft states only what Scout knows, with no [TBD] in its sections. A
// section with nothing known is one line pointing to the questions; every open point is a numbered question to the
// founder at the end, grouped by section; then the sources. Pure, so it is tested without AI
// (tests/unit/memo-draft.test.ts, on the made-up sample tests/fixtures/memo-sample.md).

/** The most questions a draft may ask the founder. */
export const MAX_QUESTIONS = 15;
export const QUESTIONS_HEADING = "Questions for Founders";
/** Question groups that are never a gap the founder fills: the memo's title and sign-off are Courtside's own. */
const NOT_A_GAP = /^(title|sign-off)$/i;
/** Words that mean a gap slipped into a section instead of becoming a question. */
// (11-06-26: Hoopr's real draft wrote "Who led the round is not specified in the coverage above")
const GAP_WORDS = /\[?\bTBD\b\]?|\bTBC\b|\bunknown\b|to be (confirmed|determined)|\bto confirm\b|\bnot specified\b/i;

export function memoPrompt(o: { outline: string; fix?: string[] }): string {
  return [
    `Write a first draft of this investment memo in Courtside Ventures' "Why We Invested" voice: confident, specific, optimistic, never hype-y. 600 to 900 words.`,
    "Follow the outline's numbered sections in order, as Markdown ## headings.",
    "State only what the outline gives, each fact with its link inline. Use only the links in the outline; never invent a number, name, date or link.",
    "Every [TBD] in the outline is a gap: never write it, or a word like unknown, TBD or to be confirmed, into a section. Turn each gap into a question for the founder instead.",
    `A section with nothing known is one line, for example: "Market size: see ${QUESTIONS_HEADING} below."`,
    `After the last section, write "## ${QUESTIONS_HEADING}": at most ${MAX_QUESTIONS} questions, numbered 1, 2, 3 straight through, grouped under "### <section name>" headings in the memo's order. Ask only what the public record doesn't answer. No questions under Title or Sign-off.`,
    'Then "## Sources": every link you cited, one per line.',
    "Write only the memo: no notes about these instructions, and no line saying it is a draft.",
    o.fix?.length ? `Your last draft broke these rules; fix them:\n${o.fix.map((f) => `- ${f}`).join("\n")}` : "",
    o.outline,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const norm = (u: string) => u.replace(/[).,;:\]]+$/, "").replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "").toLowerCase();
const links = (s: string) => [...s.matchAll(/https?:\/\/[^\s)<>\]"']+/g)].map((m) => m[0]);

/** Splits a draft into the memo's sections, its questions section and what follows (Sources). */
function parts(md: string): { body: string; questions: string; rest: string } {
  const q = md.search(new RegExp(`^##\\s+${QUESTIONS_HEADING}\\s*$`, "im"));
  if (q < 0) return { body: md, questions: "", rest: "" };
  const after = md.slice(q);
  const next = after.slice(3).search(/^##\s+\S/m);
  return next < 0 ? { body: md.slice(0, q), questions: after, rest: "" } : { body: md.slice(0, q), questions: after.slice(0, next + 3), rest: after.slice(next + 3) };
}

type Group = { name: string; qs: string[] };
function groups(questions: string): Group[] {
  const out: Group[] = [];
  for (const raw of questions.split("\n").slice(1)) {
    const line = raw.trim();
    if (!line) continue;
    const num = line.match(/^\d+[.)]\s+(.*)$/);
    if (num) {
      if (!out.length) out.push({ name: "", qs: [] });
      out.at(-1)!.qs.push(num[1].trim());
    } else out.push({ name: line.replace(/^#+\s*|^[-*]\s*|[*_:]+/g, "").replace(/^\d+[.)]\s*/, "").trim(), qs: [] }); // "### 1. Title" is the Title group
  }
  return out.filter((g) => g.qs.length);
}

/** What breaks the shape, in words the redraw request can quote. Empty means the draft is good. */
export function draftProblems(md: string, outline: string): string[] {
  const p: string[] = [];
  const { body, questions } = parts(md);
  const gap = body.split("\n").find((l) => GAP_WORDS.test(l));
  if (gap) p.push(`a gap was written into a section instead of becoming a question: "${gap.trim().slice(0, 120)}"`);
  const known = new Set(links(outline).map(norm));
  const foreign = links(md).filter((u) => !known.has(norm(u)));
  if (foreign.length) p.push(`links that are not in the outline: ${[...new Set(foreign)].slice(0, 3).join(", ")}`);
  if (!questions) p.push(`no "## ${QUESTIONS_HEADING}" section`);
  const n = groups(questions).filter((g) => !NOT_A_GAP.test(g.name)).reduce((s, g) => s + g.qs.length, 0);
  if (n > MAX_QUESTIONS) p.push(`${n} questions: ask at most ${MAX_QUESTIONS}`);
  return p;
}

/** The questions section rebuilt: groups that are no real gap dropped, at most MAX_QUESTIONS, numbered straight through. */
export function tidyDraft(md: string): string {
  const { body, questions, rest } = parts(md);
  if (!questions) return md.trim();
  let n = 0;
  const kept = groups(questions)
    .filter((g) => !NOT_A_GAP.test(g.name))
    .map((g) => ({ ...g, qs: g.qs.filter(() => ++n <= MAX_QUESTIONS) }))
    .filter((g) => g.qs.length);
  let i = 0;
  const q = kept.map((g) => `${g.name ? `### ${g.name}\n` : ""}${g.qs.map((x) => `${++i}. ${x}`).join("\n")}`).join("\n\n");
  return `${body.trimEnd()}\n\n## ${QUESTIONS_HEADING}\n\n${q}\n\n${rest.trim()}`.trim();
}

/** The last resort when a redraw isn't possible (no time or no AI left today): every sentence in the sections that
 *  holds a gap word or a link the outline never gave is taken out, so nothing unsourced or unfinished is shown. */
export function scrubDraft(md: string, outline: string): string {
  const { body, questions, rest } = parts(md);
  const known = new Set(links(outline).map(norm));
  const bad = (s: string) => GAP_WORDS.test(s) || links(s).some((u) => !known.has(norm(u)));
  const clean = body
    .split("\n")
    .map((line) => (/^#/.test(line) || !bad(line) ? line : line.split(/(?<=[.!?])\s+(?=[A-Z])/).filter((s) => !bad(s)).join(" ")))
    .filter((line, k, all) => line.trim() || (all[k - 1] ?? "").trim())
    .join("\n");
  const src = rest
    .split("\n")
    .filter((l) => !links(l).some((u) => !known.has(norm(u))))
    .join("\n");
  return tidyDraft(`${clean}${questions}${src}`);
}
