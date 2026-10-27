// One entry per news story: headlines about the same funder and the same amount (or company) are one deal,
// and the extra coverage sits behind a Sources button (V2, 10-26-26). Shared by the Monday brief and the IC Meeting page.

export type Story = { title: string; url: string; fund: string; company?: string | null; sources?: { title: string; url: string }[] };

function amountKey(title: string): string | null {
  const m = title.match(/[$€£]\s?(\d+(?:\.\d+)?)\s?(m|million|b|billion|k)?\b/i);
  if (!m) return null;
  const unit = (m[2] || "").toLowerCase();
  return `${Number(m[1])}${unit.startsWith("b") ? "B" : unit === "k" ? "K" : "M"}`;
}

export function groupStories<T extends Story>(rows: T[]): (T & { sources: { title: string; url: string }[] })[] {
  const out: (T & { sources: { title: string; url: string }[] })[] = [];
  const keyOf = (r: T) => `${r.fund.toLowerCase()}|${amountKey(r.title) || (r.company || r.title).toLowerCase()}`;
  const by = new Map<string, T & { sources: { title: string; url: string }[] }>();
  for (const r of rows) {
    const k = keyOf(r);
    const hit = by.get(k);
    if (hit) {
      if (!hit.sources.some((s) => s.url === r.url)) hit.sources.push({ title: r.title, url: r.url });
      continue;
    }
    const first = { ...r, sources: [...(r.sources || [{ title: r.title, url: r.url }])] };
    by.set(k, first);
    out.push(first);
  }
  return out;
}
