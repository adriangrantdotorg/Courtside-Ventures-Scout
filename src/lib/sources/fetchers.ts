// Fetch + parse for every source. Any failure returns [] (or null) and logs source health.
import { fetchText, fetchJSON, health } from "./http";
import * as P from "./parse";

const GN = (q: string, when = "7d", before?: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q + (before ? ` before:${before}` : ` when:${when}`))}&hl=en-US&gl=US&ceid=US:en`;

export async function secDailyIndex(day: Date): Promise<P.IndexRow[]> {
  const y = day.getUTCFullYear();
  const q = Math.floor(day.getUTCMonth() / 3) + 1;
  const ymd = `${y}${String(day.getUTCMonth() + 1).padStart(2, "0")}${String(day.getUTCDate()).padStart(2, "0")}`;
  const t = await fetchText(`https://www.sec.gov/Archives/edgar/daily-index/${y}/QTR${q}/form.${ymd}.idx`, { source: "sec-index", timeoutMs: 20_000 });
  return t ? P.parseDailyIndex(t) : [];
}

export async function secPrimary(url: string): Promise<P.FormD | null> {
  const t = await fetchText(url, { timeoutMs: 10_000 });
  return t ? P.parseFormD(t) : null;
}

export async function secLatest(form: "D" | "C") {
  const t = await fetchText(`https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=${form}&count=100&output=atom`, { source: `sec-latest-${form}` });
  const rows = t ? P.parseSecAtom(t) : [];
  return form === "C" ? rows.filter((r) => r.form === "C" || r.form === "C/A") : rows.filter((r) => r.form === "D" || r.form === "D/A");
}

export async function edgarSearch(term: string, forms = "D", start = "2024-01-01", end?: string) {
  const e = end || new Date().toISOString().slice(0, 10);
  const j = await fetchJSON(`https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${term}"`)}&forms=${forms}&dateRange=custom&startdt=${start}&enddt=${e}`, { source: "sec-search" });
  return j ? P.parseEfts(j) : [];
}

export async function hnShow() {
  const j = await fetchJSON("https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&hitsPerPage=100", { source: "hn" });
  return j ? P.parseHN(j) : [];
}
export async function hnSearch(q: string, before?: number) {
  const f = before ? `&numericFilters=created_at_i<${before}` : "";
  const j = await fetchJSON(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&hitsPerPage=20${f}`, { source: "hn" });
  return j ? P.parseHN(j) : [];
}

export async function ycAll() {
  const j = await fetchJSON("https://yc-oss.github.io/api/companies/all.json", { source: "yc", timeoutMs: 30_000 });
  return j ? P.parseYC(j) : [];
}

export async function productHunt() {
  const t = await fetchText("https://www.producthunt.com/feed", { source: "producthunt" });
  return t ? P.parseFeed(t).items : [];
}

export const APP_GENRES: Record<string, string> = { "6004": "Sports", "6014": "Games", "6013": "Health & Fitness", "6016": "Entertainment", "6012": "Lifestyle", "6011": "Music" };
export async function appChart(genre: string) {
  const j = await fetchJSON(`https://itunes.apple.com/us/rss/topfreeapplications/limit=100/genre=${genre}/json`, { source: "appstore" });
  return j ? P.parseAppChart(j) : [];
}
export async function appLookup(id: string): Promise<{ sellerUrl: string | null; releaseDate: string | null; description: string } | null> {
  const j = (await fetchJSON(`https://itunes.apple.com/lookup?id=${id}`, {})) as { results?: { sellerUrl?: string; releaseDate?: string; description?: string }[] } | null;
  const r = j?.results?.[0];
  return r ? { sellerUrl: r.sellerUrl || null, releaseDate: r.releaseDate || null, description: r.description || "" } : null;
}

export async function googleNews(q: string, when = "7d", before?: string) {
  const t = await fetchText(GN(q, when, before), { source: "google-news" });
  return t ? P.parseGoogleNews(t) : [];
}

export async function googleTrends() {
  const t = await fetchText("https://trends.google.com/trending/rss?geo=US", { source: "google-trends" });
  return t ? P.parseGoogleTrends(t) : [];
}

export async function feed(url: string, source = "rss") {
  const t = await fetchText(url, { source, timeoutMs: 15_000 });
  return t ? P.parseFeed(t) : { title: "", image: null, items: [] };
}

export async function youtube(channelId: string) {
  return feed(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, "youtube");
}

export async function github(q: string, since: string) {
  const j = await fetchJSON(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}+created:>${since}&sort=stars&per_page=20`, { source: "github" });
  return j ? P.parseGitHub(j) : [];
}

export async function gdelt(q: string) {
  const j = await fetchJSON(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&format=json&maxrecords=50&timespan=7d`, { source: "gdelt" });
  return j ? P.parseGdelt(j) : [];
}

export async function wayback(domain: string) {
  const j = await fetchJSON(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}&limit=1&output=json`, { source: "wayback" });
  return j ? P.parseWayback(j) : null;
}
export async function rdap(domain: string) {
  const j = await fetchJSON(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { source: "rdap" });
  return j ? P.parseRdap(j) : null;
}

export async function itunesPodcast(term: string) {
  const j = await fetchJSON(`https://itunes.apple.com/search?media=podcast&term=${encodeURIComponent(term)}&limit=5`, { source: "itunes-search" });
  return j ? P.parseItunesSearch(j) : [];
}
export async function itunesEpisodes(name: string) {
  const j = await fetchJSON(`https://itunes.apple.com/search?media=podcast&entity=podcastEpisode&term=${encodeURIComponent(name)}&limit=15`, { source: "itunes-search" });
  return j ? P.parseItunesSearch(j) : [];
}

export async function courtsidePortfolio() {
  const t = await fetchText("https://www.courtsidevc.com/portfolio", { source: "courtside-portfolio" });
  return t ? P.parsePortfolioSlugs(t) : [];
}
export async function courtsidePortfolioDetail(slug: string) {
  const t = await fetchText(`https://www.courtsidevc.com/portfolio/${slug}`, {});
  return t ? P.parsePortfolioDetail(t) : null;
}

export async function beehiiv(base: string, source = "beehiiv") {
  const t = await fetchText(base, { source });
  return t ? P.parseBeehiiv(t, base) : [];
}

/** A page's meta description, trimmed to about six words (the sponsor "what it is" line). */
export async function metaDescription(url: string): Promise<string | null> {
  const t = await fetchText(url, { timeoutMs: 8000 });
  if (!t) return null;
  const m = t.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]*content=["']([^"']{8,300})["']/i) || t.match(/<meta[^>]+content=["']([^"']{8,300})["'][^>]*(?:name|property)=["'](?:og:)?description["']/i);
  if (!m) return null;
  const words = P.stripHtml(m[1]).replace(/\s+/g, " ").split(" ");
  let s = words.slice(0, 7).join(" ").replace(/[,.;:!—–-]+$/, "");
  if (words.length > 7) s = s.replace(/\s+(and|or|the|a|an|for|with|to|of|in)$/i, "");
  return s;
}

export async function ogImage(url: string): Promise<string | null> {
  const t = await fetchText(url, { timeoutMs: 8000 });
  const m = t?.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

export async function linkAlive(url: string): Promise<boolean> {
  const { fetchRaw } = await import("./http");
  const r = await fetchRaw(url, { timeoutMs: 8000 });
  return r.ok || r.status === 403 || r.status === 401 || r.status === 429;
}

export { health };
