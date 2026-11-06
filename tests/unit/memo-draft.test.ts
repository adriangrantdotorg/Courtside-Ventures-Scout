// Gaps Become Questions (11-06-26): the memo states only what Scout knows, every gap is a numbered question to the
// founder, grouped by section, and nothing unsourced or unfinished reaches the page. Checked on a made-up sample in
// Courtside's eight-part "Why We Invested" shape (tests/fixtures/memo-sample.md).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { MAX_QUESTIONS, QUESTIONS_HEADING, draftProblems, memoPrompt, scrubDraft, tidyDraft } from "@/lib/memo-draft";

const sample = readFileSync("tests/fixtures/memo-sample.md", "utf8");
// the links Scout handed the AI for the sample
const outline = `## 1. Title\nWhy We Invested: Courtline\n\n## 5. The founders\n[TBD: founders and their track record]\n\nWebsite: https://courtline.example\n- Seed: https://courtline.example/news/seed`;
const questions = (md: string) => md.slice(md.indexOf(`## ${QUESTIONS_HEADING}`)).split("\n## Sources")[0];

describe("Gaps Become Questions", () => {
  it("the request asks for questions, not gaps, in Courtside's voice, and quotes what the last draft broke", () => {
    const p = memoPrompt({ outline, fix: ["a gap was written into a section"] });
    expect(p).toContain(`## ${QUESTIONS_HEADING}`);
    expect(p).toContain(`at most ${MAX_QUESTIONS} questions`);
    expect(p).toContain("Use only the links in the outline");
    expect(p).toContain("Your last draft broke these rules");
    expect(p).toContain(`Courtside Ventures' "Why We Invested" voice`);
    expect(p).not.toMatch(/Keep every \[TBD\]/);
  });

  it("the outline Scout hands the AI no longer tells it to keep the gaps", () => {
    expect(readFileSync("src/lib/memo.ts", "utf8")).not.toMatch(/Keep every \[TBD\]/);
    expect(readFileSync("src/lib/ai.ts", "utf8")).not.toMatch(/Keep every \[TBD\]/);
  });

  it("catches the gap that slipped into the sample's section 6, and nothing else", () => {
    const p = draftProblems(sample, outline);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/gap was written into a section/);
    expect(p[0]).toMatch(/to confirm/);
  });

  it("catches a gap written as \"not specified\" (Hoopr's real draft, 11-06-26)", () => {
    const p = draftProblems(sample.replace("Courtline books open courts", "Who led the round is not specified in the coverage above. Courtline books open courts"), outline);
    expect(p.some((x) => x.includes("not specified"))).toBe(true);
  });

  it("catches a link the outline never gave", () => {
    const p = draftProblems(sample.replace("([site](https://courtline.example))", "([site](https://made-up.example.com/stats))"), outline);
    expect(p.some((x) => x.includes("made-up.example.com"))).toBe(true);
  });

  it("catches a draft with no questions, and one with too many", () => {
    expect(draftProblems("## 1. Title\nWhy We Invested: Courtline", outline)).toContain(`no "## ${QUESTIONS_HEADING}" section`);
    const many = `## 1. Title\nWhy We Invested: Courtline\n\n## ${QUESTIONS_HEADING}\n### The founders\n${Array.from({ length: 18 }, (_, i) => `${i + 1}. Q${i + 1}?`).join("\n")}`;
    expect(draftProblems(many, outline)).toContain(`18 questions: ask at most ${MAX_QUESTIONS}`);
    expect(questions(tidyDraft(many)).match(/^\d+\. /gm)).toHaveLength(MAX_QUESTIONS);
  });

  it("drops the Title and Sign-off groups (no gap the founder fills) and numbers the rest straight through", () => {
    const q = questions(tidyDraft(sample));
    expect(q).not.toMatch(/### Title|### Sign-off/);
    expect(q).not.toMatch(/the name you'll keep|connect you with/);
    expect(q).toMatch(/^### The trend Courtside has been tracking\n1\. How many players/m);
    const nums = [...q.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
    expect(nums).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(tidyDraft(sample)).toMatch(/## Sources\nhttps:\/\/courtline\.example\/news\/seed/);
  });

  it("the last resort takes out only the sentences with a gap, keeping the rest of the section", () => {
    const s = scrubDraft(sample, outline);
    expect(draftProblems(s, outline)).toEqual([]);
    expect(s).toContain("Pickup play is growing, and court time is still booked by phone call.");
    expect(s).not.toMatch(/to confirm/);
    expect(s).toContain("## 6. Why now, and why it's venture scale");
  });
});
