// The Demo tag (Adrian, 11-12-26, design/demo-signal A2): every page says Scout is a demo, above the fold, at every width.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("the header's Demo tag", () => {
  it("is drawn once, by BrandName, in the header and on the Building page", () => {
    const shell = readFileSync("src/components/Shell.tsx", "utf8");
    expect(shell).toMatch(/className="demo-tag"[^>]*>\s*Demo\s*</);
    expect(shell.match(/<BrandName \/>/g)).toHaveLength(1);
    expect(readFileSync("src/components/Building.tsx", "utf8")).toMatch(/<BrandName \/>/);
  });
  it("is never hidden with the logo's words on a narrow screen", () => {
    // 11-12-26: a phone rule `.brand span { display:none }` hid the tag with the words below 900px
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).not.toMatch(/\.brand span\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.brand \.brand-words\s*\{\s*display:none/);
  });
});
