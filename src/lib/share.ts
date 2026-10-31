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

/** The Vercel project this folder is linked to (`.vercel/project.json`, written by `vercel link` / `vercel pull`). */
function linkedProject(): string | undefined {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), ".vercel/project.json"), "utf8")).projectName;
  } catch {
    return undefined;
  }
}

/** The site's public address, or null. SITE_URL is a Sensitive variable on Vercel: a Mac build (`npm run update`,
 * `vercel build`) reads the placeholder "[SENSITIVE]" instead, and `new URL()` on it failed the build; with it skipped,
 * the share image's address came out as localhost (10-31-26). So a Mac build falls back to the linked project's
 * <name>.vercel.app; a build on Vercel reads the real SITE_URL. */
export function siteUrl(env: Record<string, string | undefined> = process.env, project: string | null = linkedProject() ?? null): string | null {
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL;
  for (const v of [env.SITE_URL, vercel && `https://${vercel}`, project && `https://${project}.vercel.app`]) {
    try {
      if (v && /^https?:$/.test(new URL(v).protocol)) return v.replace(/\/$/, "");
    } catch {}
  }
  return null;
}

export function sharePreview() {
  return parseShare(readFileSync(SHARE_FILE, "utf8"));
}
