import { unescapeTwice } from "../copy";
// Pure parsers, one per source shape. Each returns [] (or null) on junk; none throws.
import { XMLParser } from "fast-xml-parser";

const xp = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  parseTagValue: false,
  isArray: (name) => ["item", "entry", "link", "category"].includes(name),
});

/* eslint-disable @typescript-eslint/no-explicit-any */
function txt(v: any): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return txt(v[0]);
  if (typeof v === "object") return txt(v["#text"] ?? v["__cdata"] ?? "");
  return "";
}

export function parseXml(xml: string): any | null {
  if (!xml || !/^\s*(<\?xml|<rss|<feed|<\w)/.test(xml)) return null;
  try {
    const o = xp.parse(xml);
    return o && typeof o === "object" ? o : null;
  } catch {
    return null;
  }
}

export function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\s\S]*/, (x) => unescapeTwice(x))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export type FeedItem = { title: string; link: string; date: string | null; description: string; content: string; guid: string; enclosure: string | null; transcript: string | null; source: string | null };

function iso(s: string): string | null {
  if (!s) return null;
  const t = new Date(s);
  return isNaN(t.getTime()) ? null : t.toISOString();
}

/** RSS 2.0 or Atom, one shape out. */
export function parseFeed(xml: string): { title: string; image: string | null; items: FeedItem[] } {
  const o = parseXml(xml);
  if (!o) return { title: "", image: null, items: [] };
  if (o.rss?.channel) {
    const ch = Array.isArray(o.rss.channel) ? o.rss.channel[0] : o.rss.channel;
    const image = ch["itunes:image"]?.["@href"] || txt(ch.image?.url) || null;
    const items: FeedItem[] = (ch.item || []).map((it: any) => ({
      title: stripHtml(txt(it.title)),
      link: txt(it.link) || it.link?.[0]?.["@href"] || txt(it.guid),
      date: iso(txt(it.pubDate) || txt(it["dc:date"])),
      description: txt(it.description) || txt(it["itunes:summary"]),
      content: txt(it["content:encoded"]),
      guid: txt(it.guid) || txt(it.link),
      enclosure: it.enclosure?.["@url"] || null,
      transcript: (Array.isArray(it["podcast:transcript"]) ? it["podcast:transcript"][0] : it["podcast:transcript"])?.["@url"] || null,
      source: txt(it.source) || null,
    }));
    return { title: stripHtml(txt(ch.title)), image, items };
  }
  if (o.feed) {
    const f = o.feed;
    const items: FeedItem[] = (f.entry || []).map((e: any) => {
      const links: any[] = e.link || [];
      const alt = links.find((l) => l["@rel"] === "alternate" || !l["@rel"]) || links[0];
      const mg = e["media:group"] || {};
      return {
        title: stripHtml(txt(e.title)),
        link: alt?.["@href"] || "",
        date: iso(txt(e.published) || txt(e.updated)),
        description: txt(mg["media:description"]) || txt(e.summary),
        content: txt(e.content),
        guid: txt(e.id) || txt(e["yt:videoId"]),
        enclosure: null,
        transcript: null,
        source: null,
      };
    });
    return { title: stripHtml(txt(f.title)), image: null, items };
  }
  return { title: "", image: null, items: [] };
}

/* ---------- SEC ---------- */
export type IndexRow = { form: string; company: string; cik: string; date: string; path: string; accession: string; primaryXml: string };

/** form.YYYYMMDD.idx: fixed-width; form type padded to col 12. */
export function parseDailyIndex(text: string, forms = ["D", "D/A", "C", "C/A"]): IndexRow[] {
  const out: IndexRow[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^(\S+(?:\/A)?)\s+(.+?)\s{2,}(\d{3,10})\s+(\d{8})\s+(edgar\/data\/\S+\.txt)\s*$/);
    if (!m) continue;
    const [, form, company, cik, date, path] = m;
    if (!forms.includes(form)) continue;
    const accession = path.split("/").pop()!.replace(/\.txt$/, "");
    out.push({
      form,
      company: company.trim(),
      cik,
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      path,
      accession,
      primaryXml: `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replace(/-/g, "")}/primary_doc.xml`,
    });
  }
  return out;
}

export type FormD = {
  issuer: string;
  industry: string | null;
  amountSold: number | null;
  amountOffered: number | null;
  firstSale: string | null;
  related: string[];
  website: string | null;
  deadline: string | null;
  isFund: boolean;
};

function num(s: string): number | null {
  const n = Number(String(s).replace(/[^0-9.]/g, ""));
  return isFinite(n) && n > 0 ? n : null;
}

export function parseFormD(xml: string): FormD | null {
  const o = parseXml(xml);
  const sub = o?.edgarSubmission;
  if (!sub) return null;
  const isC = !!sub.formData?.issuerInformation || !!sub.formData?.offeringInformation;
  if (isC && !sub.primaryIssuer) {
    const fd = sub.formData || {};
    const ii = fd.issuerInformation || {};
    const oi = fd.offeringInformation || {};
    const dl = txt(oi.deadlineDate);
    return {
      issuer: txt(ii.issuerInfo?.nameOfIssuer || ii.nameOfIssuer),
      industry: null,
      amountSold: null,
      amountOffered: num(txt(oi.offeringAmount)) || num(txt(oi.maximumOfferingAmount)),
      firstSale: null,
      related: [],
      website: txt(ii.issuerInfo?.issuerWebsite || ii.issuerWebsite) || null,
      deadline: dl ? dl.replace(/^(\d{2})-(\d{2})-(\d{4})$/, "$3-$1-$2") : null,
      isFund: false,
    };
  }
  const pi = sub.primaryIssuer || {};
  const od = sub.offeringData || {};
  const ig = od.industryGroup || {};
  const amt = od.offeringSalesAmounts || {};
  const rel = sub.relatedPersonsList?.relatedPersonInfo;
  const relList = (Array.isArray(rel) ? rel : rel ? [rel] : []).map((r: any) => [txt(r.relatedPersonName?.firstName), txt(r.relatedPersonName?.lastName)].filter(Boolean).join(" ")).filter(Boolean);
  const industry = txt(ig.industryGroupType) || null;
  const fundType = txt(ig.investmentFundInfo?.investmentFundType);
  const dfs = od.typeOfFiling?.dateOfFirstSale;
  return {
    issuer: txt(pi.entityName),
    industry,
    amountSold: num(txt(amt.totalAmountSold)),
    amountOffered: num(txt(amt.totalOfferingAmount)),
    firstSale: txt(dfs?.value) || null,
    related: relList.slice(0, 8),
    website: null,
    deadline: null,
    isFund: industry === "Pooled Investment Fund" || !!fundType,
  };
}

/** SEC "latest filings" Atom: title like "D - Company Name (0001234567) (Filer)". */
export function parseSecAtom(xml: string): { form: string; company: string; cik: string; link: string; date: string | null }[] {
  const f = parseFeed(xml);
  return f.items
    .map((it) => {
      const m = it.title.match(/^(\S+)\s+-\s+(.+?)\s+\((\d+)\)/);
      if (!m) return null;
      return { form: m[1], company: m[2], cik: m[3], link: it.link, date: it.date };
    })
    .filter(Boolean) as { form: string; company: string; cik: string; link: string; date: string | null }[];
}

export function parseEfts(json: any): { name: string; cik: string; date: string; form: string; adsh: string }[] {
  const hits = json?.hits?.hits;
  if (!Array.isArray(hits)) return [];
  return hits.map((h: any) => ({
    name: String(h._source?.display_names?.[0] || "").replace(/\s+\(CIK.*$/, "").trim(),
    cik: String(h._source?.ciks?.[0] || ""),
    date: String(h._source?.file_date || ""),
    form: String(h._source?.form || h._source?.root_forms?.[0] || ""),
    adsh: String(h._source?.adsh || String(h._id || "").split(":")[0]),
  }));
}

/* ---------- Hacker News ---------- */
export type HNHit = { title: string; url: string | null; points: number; date: string; id: string };
export function parseHN(json: any): HNHit[] {
  if (!Array.isArray(json?.hits)) return [];
  return json.hits
    .filter((h: any) => h && h.title)
    .map((h: any) => ({ title: String(h.title), url: h.url || null, points: Number(h.points || 0), date: String(h.created_at || ""), id: String(h.objectID) }));
}

/* ---------- Y Combinator ---------- */
const YC_IN = ["consumer", "gaming", "content", "media", "entertainment"];
const YC_OUT = ["b2b", "infrastructure", "healthcare it", "enterprise", "operations", "supply chain", "industrials", "smb", "developer tools"];
export type YCCo = { name: string; website: string; oneLiner: string; long: string; industries: string[]; tags: string[]; launchedAt: number; batch: string; slug: string };
export function parseYC(json: any): YCCo[] {
  if (!Array.isArray(json)) return [];
  return json.map((c: any) => ({
    name: String(c.name || ""),
    website: String(c.website || ""),
    oneLiner: String(c.one_liner || ""),
    long: String(c.long_description || ""),
    industries: (c.industries || []).map(String),
    tags: (c.tags || []).map(String),
    launchedAt: Number(c.launched_at || 0),
    batch: String(c.batch || ""),
    slug: String(c.slug || ""),
  }));
}
/** Consumer-only: Consumer, Gaming or Content, and none of the B2B families. */
export function ycConsumer(c: YCCo): boolean {
  const all = [...c.industries, ...c.tags].map((x) => x.toLowerCase());
  const yes = all.some((x) => YC_IN.some((k) => x.includes(k)));
  const no = all.some((x) => YC_OUT.some((k) => x.includes(k)));
  return yes && !no;
}

/* ---------- App Store ---------- */
export type AppEntry = { id: string; name: string; developer: string; summary: string; category: string; releaseDate: string | null; rank: number; link: string };
export function parseAppChart(json: any): AppEntry[] {
  const entries = json?.feed?.entry;
  if (!Array.isArray(entries)) return [];
  return entries.map((e: any, i: number) => ({
    id: String(e.id?.attributes?.["im:id"] || ""),
    name: String(e["im:name"]?.label || ""),
    developer: String(e["im:artist"]?.label || ""),
    summary: String(e.summary?.label || ""),
    category: String(e.category?.attributes?.label || ""),
    releaseDate: e["im:releaseDate"]?.label || null,
    rank: i + 1,
    link: String(e.id?.label || ""),
  }));
}

/* ---------- Google News ---------- */
export type NewsItem = { title: string; outlet: string; url: string; outletUrl: string | null; date: string | null; text: string };
export function parseGoogleNews(xml: string): NewsItem[] {
  const o = parseXml(xml);
  const items = o?.rss?.channel?.item;
  if (!Array.isArray(items)) return [];
  return items.map((it: any) => {
    const outlet = txt(it.source);
    let title = stripHtml(txt(it.title));
    if (outlet && title.endsWith(" - " + outlet)) title = title.slice(0, -(outlet.length + 3));
    else title = title.replace(/\s+-\s+[^-]{2,60}$/, "");
    let desc = stripHtml(txt(it.description));
    desc = desc.replace(title, "").replace(outlet, "").replace(/\s+/g, " ").trim();
    return {
      title,
      outlet,
      url: txt(it.link),
      outletUrl: it.source?.["@url"] || null,
      date: iso(txt(it.pubDate)),
      text: desc.length >= 25 ? desc : "",
    };
  });
}

/* ---------- Google Trends daily ---------- */
export function parseGoogleTrends(xml: string): { term: string; traffic: string; date: string | null; news: { title: string; url: string; source: string }[] }[] {
  const o = parseXml(xml);
  const items = o?.rss?.channel?.item;
  if (!Array.isArray(items)) return [];
  return items.map((it: any) => {
    const ni = it["ht:news_item"];
    const list = Array.isArray(ni) ? ni : ni ? [ni] : [];
    return {
      term: txt(it.title),
      traffic: txt(it["ht:approx_traffic"]),
      date: iso(txt(it.pubDate)),
      news: list.map((n: any) => ({ title: stripHtml(txt(n["ht:news_item_title"])), url: txt(n["ht:news_item_url"]), source: txt(n["ht:news_item_source"]) })),
    };
  });
}

/* ---------- Courtside ---------- */
export function parsePortfolioSlugs(html: string): string[] {
  return [...new Set([...html.matchAll(/href="\/portfolio\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
}

export function htmlLines(html: string): string[] {
  const t = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, "\n");
  return t
    .split("\n")
    .map((x) => stripHtml(x).trim())
    .filter(Boolean);
}

/** A portfolio detail page: name, sector, "Overview", description; exit note line sits above the name. */
export function parsePortfolioDetail(html: string): { name: string; sector: string; description: string; exitNote: string | null } | null {
  const lines = htmlLines(html);
  const ov = lines.indexOf("Overview");
  if (ov < 2) return null;
  let name = lines[ov - 2];
  const sector = lines[ov - 1];
  let exitNote: string | null = null;
  if (/^(Acquired by|Exited|IPO)/.test(name)) {
    exitNote = name;
    name = lines[ov - 3];
  }
  const description = lines[ov + 1] || "";
  return { name, sector, description, exitNote };
}

/* ---------- beehiiv archive ---------- */
export function parseBeehiiv(html: string, base: string): { title: string; url: string; date: string | null; summary: string }[] {
  const out: { title: string; url: string; date: string | null; summary: string }[] = [];
  const re = /\{"id":"[0-9a-f-]{36}","web_title":"((?:[^"\\]|\\.)*)","web_subtitle":"((?:[^"\\]|\\.)*)"[^{}]*?"override_scheduled_at":"([^"]*)","slug":"([^"]+)"/g;
  for (const m of html.matchAll(re)) {
    const un = (s: string) => {
      try {
        return JSON.parse(`"${s}"`);
      } catch {
        return s;
      }
    };
    out.push({ title: un(m[1]), summary: un(m[2]), date: iso(m[3]), url: `${base.replace(/\/$/, "")}/p/${m[4]}` });
  }
  const seen = new Set<string>();
  return out.filter((p) => !seen.has(p.url) && seen.add(p.url));
}

/* ---------- GitHub, GDELT, Wayback, RDAP, iTunes search ---------- */
export function parseGitHub(json: any): { name: string; owner: string; url: string; stars: number; created: string; description: string }[] {
  if (!Array.isArray(json?.items)) return [];
  return json.items.map((r: any) => ({ name: String(r.name), owner: String(r.owner?.login || ""), url: String(r.html_url), stars: Number(r.stargazers_count || 0), created: String(r.created_at), description: String(r.description || "") }));
}
export function parseGdelt(json: any): { title: string; url: string; date: string | null; domain: string }[] {
  if (!Array.isArray(json?.articles)) return [];
  return json.articles.map((a: any) => ({
    title: String(a.title || ""),
    url: String(a.url || ""),
    date: a.seendate ? iso(a.seendate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z")) : null,
    domain: String(a.domain || ""),
  }));
}
export function parseWayback(json: any): { date: string; url: string } | null {
  if (!Array.isArray(json) || json.length < 2) return null;
  const row = json[1];
  const ts = String(row[1] || "");
  if (ts.length < 8) return null;
  return { date: `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`, url: `https://web.archive.org/web/${ts}/${row[2]}` };
}
export function parseRdap(json: any): string | null {
  const ev = json?.events;
  if (!Array.isArray(ev)) return null;
  const reg = ev.find((e: any) => e.eventAction === "registration");
  return reg?.eventDate ? String(reg.eventDate).slice(0, 10) : null;
}
export function parseItunesSearch(json: any): { name: string; feedUrl: string | null; url: string; artwork: string | null; released: string | null }[] {
  if (!Array.isArray(json?.results)) return [];
  return json.results.map((r: any) => ({
    name: String(r.collectionName || r.trackName || ""),
    feedUrl: r.feedUrl || null,
    url: String(r.trackViewUrl || r.collectionViewUrl || ""),
    artwork: r.artworkUrl600 || r.artworkUrl100 || null,
    released: r.releaseDate || null,
  }));
}
