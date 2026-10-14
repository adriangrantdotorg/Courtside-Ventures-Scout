// Labels shared by server and client components.
export const SIG_LABEL: Record<string, string> = { formd: "Form D", formc: "Form C", yc: "Y Combinator", hn: "Show HN", producthunt: "Product Hunt", appstore: "App Store", voice: "Show", sponsor: "Sponsor", site: "Site", github: "GitHub" };
export function sigLabel(s: { type: string; source: string }) {
  return SIG_LABEL[s.type] || s.source;
}
