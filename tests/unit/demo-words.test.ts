import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Every Scout says "demo", never "prototype" (Adrian, 11-12-26: "on all scout sites it should say demo, no longer use the
// term prototype"). The site's code, its share words and the README are read; the browser test site.spec.ts checks pages.
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));

describe("demo, never prototype", () => {
  it("no page, share word or README line says prototype", () => {
    const read = [...files("src").filter((f) => /\.(tsx?|txt|md)$/.test(f)), "content/share-preview.md", "README.md", "scripts/verify-live.ts"];
    const bad = read.filter((f) => /\bprototypes?\b/i.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});
