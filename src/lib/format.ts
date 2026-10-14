// One producer for every shown date, money, stage and thesis label.

export const AREAS = ["sports", "gaming", "lifestyle", "health", "media"] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABEL: Record<string, string> = {
  sports: "Sports",
  gaming: "Gaming",
  lifestyle: "Lifestyle",
  health: "Health",
  media: "Media",
};

export const STAGE_LABEL: Record<string, string> = {
  "pre-seed": "Pre-Seed",
  seed: "Seed",
  "series-a": "Series A",
  "series-b": "Series B",
  later: "Series B+",
  unknown: "Unknown",
};

export const STATUS_LABEL: Record<string, string> = {
  new: "New",
  watching: "Watching",
  reached: "Reached Out",
  passed: "Passed",
};
export const STATUSES = ["new", "watching", "reached", "passed"] as const;

export function areaLabel(a?: string | null): string {
  return a ? AREA_LABEL[a] || a : "";
}

export function stageLabel(s?: string | null): string {
  if (!s) return "Unknown";
  return STAGE_LABEL[s] || s;
}

export function pastStage(s?: string | null): boolean {
  return s === "series-b" || s === "later";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** MM-DD-YY */
export function fmtDate(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined || d === "") return "";
  const x = d instanceof Date ? d : new Date(typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d + "T12:00:00Z" : d);
  if (isNaN(x.getTime())) return "";
  return `${pad(x.getMonth() + 1)}-${pad(x.getDate())}-${String(x.getFullYear()).slice(2)}`;
}

/** MM-DD-YY h:mm AM */
export function fmtExact(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined || d === "") return "";
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return "";
  let h = x.getHours();
  const am = h < 12 ? "AM" : "PM";
  h = h % 12 || 12;
  return `${fmtDate(x)} ${h}:${pad(x.getMinutes())} ${am}`;
}

/** Relative time at every age: just now · 5m · 3h · 2d · 3w · 4mo · 1y ago */
export function ago(d: Date | string | number | null | undefined, now = Date.now()): string {
  if (d === null || d === undefined || d === "") return "";
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  if (isNaN(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 14) return `${days}d ago`;
  const w = Math.round(days / 7);
  if (days < 60) return `${w}w ago`;
  const mo = Math.round(days / 30.44);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(days / 365.25)}y ago`;
}

/** Countdown: "in 6h 12m", "in 3d 14h" */
export function until(d: Date | string | number | null | undefined, now = Date.now()): string {
  if (d === null || d === undefined) return "";
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  const s = Math.round((t - now) / 1000);
  if (s <= 30) return "any minute";
  const m = Math.floor(s / 60);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h ${m % 60}m`;
  const days = Math.floor(h / 24);
  return `in ${days}d ${h % 24}h`;
}

export function clock(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, "0")}`;
}

export function fmtMoney(amount: number | string | null | undefined, currency = "$"): string {
  if (amount === null || amount === undefined || amount === "") return "";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!isFinite(n) || n <= 0) return "";
  const sym = currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;
  if (n >= 1e9) return `${sym}${(n / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1e6) return `${sym}${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${sym}${Math.round(n / 1e3)}K`;
  return `${sym}${Math.round(n)}`;
}

export function domainOf(url?: string | null): string {
  if (!url) return "";
  try {
    return new URL(url.startsWith("http") ? url : "https://" + url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function favicon(domainOrUrl?: string | null): string {
  const d = domainOrUrl?.includes("/") ? domainOf(domainOrUrl) : domainOrUrl || "";
  return d ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(d)}` : "";
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const SMALL = new Set(["and", "for", "of", "the", "a", "an", "to", "in", "on", "at", "with", "or", "by"]);
export function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Print a domain so no browser linkifies it: an empty inline element before each dot. */
export function unlinkableParts(domain: string): string[] {
  return domain.split(".");
}

/** Next scheduled UTC run of a daily cron at hour H (weekday optional, 0=Sun). */
export function nextRun(hourUtc: number, now = new Date(), weekday?: number): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0));
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 1);
  if (weekday !== undefined) while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
