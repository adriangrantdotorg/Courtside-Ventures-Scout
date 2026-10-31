import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseShare, sharePreview, SHARE_LIMITS } from "@/lib/share";

describe("share preview (content/share-preview.md)", () => {
  it("fits LinkedIn's one-line card: title 60, description 125 characters or less", () => {
    const { title, description } = sharePreview();
    expect(title.length).toBeGreaterThan(0);
    expect(description.length).toBeGreaterThan(0);
    expect(title.length, `Title is ${title.length} characters: "${title}"`).toBeLessThanOrEqual(SHARE_LIMITS.title);
    expect(description.length, `Description is ${description.length} characters: "${description}"`).toBeLessThanOrEqual(SHARE_LIMITS.description);
  });

  it("reads each section's text, joining wrapped lines, and stops at the next heading", () => {
    const md = "# Share\n\nNotes that are not read.\n\n## Title\n\nScout\n\n## Description\n\nOne line\nwrapped here.\n\n## Later\n\nignored\n";
    expect(parseShare(md)).toEqual({ title: "Scout", description: "One line wrapped here." });
    expect(parseShare("## Description\n\nLast section, no trailing newline")).toEqual({ title: "", description: "Last section, no trailing newline" });
  });

  it("the layout takes its share words from the file, never a copy in code", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toContain("sharePreview()");
    expect(layout).not.toMatch(/openGraph:[^\n]*description:\s*"/);
  });
});
