// The linkifier: every known company or person in body text becomes a link.
// Whole names only, longest alias first, first mention per paragraph, never inside an existing link.
export type Entity = { name: string; aliases: string[]; href: string; ext: boolean };
export type Seg = string | { t: string; href: string; ext: boolean };

export type Index = { entries: { alias: string; e: Entity }[]; re: RegExp | null };

const GENERIC = new Set(["jump", "future", "journey", "tap", "system", "eternal", "commons", "beam", "betty", "mantel", "magic", "chrono", "every", "packz", "venly", "lucy", "noise", "mojo", "kat", "rivers", "aspen", "kinsey", "gingy", "the athletic", "x", "pop", "kick"]);

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildIndex(list: Entity[]): Index {
  const entries: { alias: string; e: Entity }[] = [];
  const seen = new Set<string>();
  for (const e of list) {
    for (const a of [e.name, ...e.aliases]) {
      const alias = a.trim();
      if (alias.length < 3) continue;
      const k = alias.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      entries.push({ alias, e });
    }
  }
  entries.sort((a, b) => b.alias.length - a.alias.length);
  if (!entries.length) return { entries, re: null };
  const re = new RegExp(`(?<![\\w@/.-])(${entries.map((x) => esc(x.alias)).join("|")})(?![\\w-]|\\.[a-z])`, "g");
  return { entries, re };
}

/** Split text into plain strings and links. Generic one-word names link only with their exact capitalization. */
export function linkify(text: string | null | undefined, idx: Index, opts: { skip?: string[] } = {}): Seg[] {
  if (!text) return [];
  if (!idx.re) return [text];
  const out: Seg[] = [];
  const used = new Set<string>(opts.skip?.map((s) => s.toLowerCase()) || []);
  let last = 0;
  idx.re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = idx.re.exec(text))) {
    const hit = m[1];
    const entry = idx.entries.find((x) => x.alias === hit) || idx.entries.find((x) => x.alias.toLowerCase() === hit.toLowerCase());
    if (!entry) continue;
    if (GENERIC.has(hit.toLowerCase()) && hit[0] !== hit[0].toUpperCase()) continue;
    const key = entry.e.href;
    if (used.has(key) || used.has(entry.e.name.toLowerCase())) continue;
    used.add(key);
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ t: hit, href: entry.e.href, ext: entry.e.ext });
    last = m.index + hit.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function plain(segs: Seg[]): string {
  return segs.map((s) => (typeof s === "string" ? s : s.t)).join("");
}
