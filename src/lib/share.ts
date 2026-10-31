// The share preview's words (og:title, og:description), read from content/share-preview.md so Adrian can edit them.
import { readFileSync } from "node:fs";
import path from "node:path";

export const SHARE_FILE = path.join(process.cwd(), "content/share-preview.md");
// LinkedIn publishes no limit; its message card cut a 168-character description at 129 (10-30-26).
export const SHARE_LIMITS = { title: 60, description: 125 };

/** The text under each `## Heading`, its lines joined with spaces. */
export function parseShare(md: string): { title: string; description: string } {
  const section = (name: string) => {
    const m = md.match(new RegExp(`^##\\s+${name}\\s*\\n([\\s\\S]*?)(?=^#|$(?![\\s\\S]))`, "mi"));
    return (m?.[1] || "").split("\n").map((l) => l.trim()).filter(Boolean).join(" ");
  };
  return { title: section("Title"), description: section("Description") };
}

export function sharePreview() {
  return parseShare(readFileSync(SHARE_FILE, "utf8"));
}
