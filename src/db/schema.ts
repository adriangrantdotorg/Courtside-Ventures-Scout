import {
  pgTable,
  serial,
  text,
  integer,
  jsonb,
  timestamp,
  boolean,
  doublePrecision,
  primaryKey,
  uniqueIndex,
  index,
  date,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** The card's picture, in the order Scout looks: product video, App Store screenshots, website preview image, logo. */
export type Media = {
  kind: "yt" | "mp4" | "shots" | "site" | "logo";
  yt?: string;
  mp4?: string;
  poster?: string;
  shots?: string[];
  img?: string;
  logo?: string;
  play?: string;
  from?: string;
};
/** The AI Thesis Check: is this a consumer startup inside Courtside's thesis? (10-26-26) */
export type ThesisCheck = { ok: boolean; area: string | null; why: string; model: string; at: string };
/** One funding round and every source that reported it. */
export type Round = {
  stage: string;
  amount: number | null;
  low: number | null;
  currency: string;
  date: string | null;
  investors: string | null;
  sources: { name: string; url: string; amount: number | null; date: string | null; title: string }[];
};

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
});

export const portfolio = pgTable("portfolio", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sector: text("sector"),
  description: text("description"),
  descriptionUrl: text("description_url"),
  site: text("site"),
  exitNote: text("exit_note"),
  updatedAt: ts("updated_at").defaultNow(),
});

export const companies = pgTable(
  "companies",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    domain: text("domain"),
    aliases: jsonb("aliases").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    description: text("description"),
    descriptionUrl: text("description_url"),
    thesisArea: text("thesis_area"),
    pattern: text("pattern"),
    stage: text("stage").default("unknown").notNull(),
    amount: doublePrecision("amount"),
    currency: text("currency").default("$").notNull(),
    whyFits: text("why_fits"),
    whyFitsManual: boolean("why_fits_manual").default(false).notNull(),
    score: integer("score").default(0).notNull(),
    prevScore: integer("prev_score").default(0).notNull(),
    breakdown: jsonb("breakdown").$type<Record<string, number>>().default(sql`'{}'::jsonb`).notNull(),
    portfolioCheck: jsonb("portfolio_check").$type<{ kind: string; with: string; reason: string } | null>(),
    status: text("status").default("new").notNull(),
    tracked: boolean("tracked").default(false).notNull(),
    trackedAt: ts("tracked_at"),
    possibleMatch: boolean("possible_match").default(false).notNull(),
    hidden: boolean("hidden").default(false).notNull(),
    siteSnapshot: jsonb("site_snapshot"),
    firstSeen: ts("first_seen").defaultNow().notNull(),
    lastSignal: ts("last_signal"),
    updatedAt: ts("updated_at").defaultNow(),
    // V2 (10-26-26): what the cards show, filled by the enrich job
    media: jsonb("media").$type<Media | null>(),
    rounds: jsonb("rounds").$type<Round[]>().default(sql`'[]'::jsonb`).notNull(),
    totalRaised: doublePrecision("total_raised"),
    notStartup: text("not_startup"), // why Scout drops it from recommendations: a blog, a big company's product, a placeholder name
    keep: boolean("keep").default(false).notNull(), // the team restored it: the startup filter never drops it again
    mergedInto: integer("merged_into"), // a duplicate of another card (the same funding story)
    thesisCheck: jsonb("thesis_check").$type<ThesisCheck | null>(), // the AI Thesis Check's answer, asked once per company
    enrichedAt: ts("enriched_at"),
  },
  (t) => [index("companies_score_idx").on(t.score), index("companies_domain_idx").on(t.domain)],
);

export const signals = pgTable(
  "signals",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    type: text("type").notNull(),
    source: text("source").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    date: ts("date"),
    voice: text("voice"),
    createdAt: ts("created_at").defaultNow(),
  },
  (t) => [uniqueIndex("signals_company_url").on(t.companyId, t.url)],
);

export const voices = pgTable("voices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  kind: text("kind").notNull(), // voice | podcast | named
  grp: text("grp"),
  youtube: jsonb("youtube").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  feeds: jsonb("feeds").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  site: text("site"),
  image: text("image"),
  note: text("note"),
  status: text("status").default("active").notNull(),
  exempt: boolean("exempt").default(false).notNull(),
  priority: integer("priority").default(99).notNull(),
  lastEpisode: ts("last_episode"),
  seenIds: jsonb("seen_ids").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
});

export const sponsors = pgTable("sponsors", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  brand: text("brand").notNull(),
  site: text("site"),
  fitTag: text("fit_tag").default("established").notNull(),
  thesisArea: text("thesis_area"),
  whatItIs: text("what_it_is"),
  firstSeen: ts("first_seen"),
  lastSeen: ts("last_seen"),
});

export const sponsorSightings = pgTable(
  "sponsor_sightings",
  {
    id: serial("id").primaryKey(),
    sponsorId: integer("sponsor_id").notNull(),
    show: text("show").notNull(),
    date: ts("date"),
    url: text("url").notNull(),
    evidence: text("evidence"),
  },
  (t) => [uniqueIndex("sightings_sponsor_url").on(t.sponsorId, t.url)],
);

export type TrendSource = { url: string; date: string; title: string; source: string; voice?: string };

export const trends = pgTable("trends", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  term: text("term").notNull(),
  headline: text("headline").notNull(),
  why: text("why"),
  thesisArea: text("thesis_area"),
  momentum: text("momentum"),
  score: doublePrecision("score").default(0).notNull(),
  sources: jsonb("sources").$type<TrendSource[]>().default(sql`'[]'::jsonb`).notNull(),
  sourceKinds: jsonb("source_kinds").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  voiceCount: integer("voice_count").default(0).notNull(),
  weekly: jsonb("weekly").$type<number[]>().default(sql`'[0,0,0,0]'::jsonb`).notNull(),
  delta: integer("delta").default(0).notNull(),
  tracked: boolean("tracked").default(false).notNull(),
  firstSeen: ts("first_seen").defaultNow(),
  lastSeen: ts("last_seen").defaultNow(),
});

export const funds = pgTable("funds", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // neighborhood | synergistic
  focus: text("focus").default("broad").notNull(),
  thesisArea: text("thesis_area"),
  site: text("site"),
  note: text("note"),
  query: text("query"),
  feeds: jsonb("feeds").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  youtube: jsonb("youtube").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  edgarName: text("edgar_name"),
  lastSharedDate: date("last_shared_date"),
  shared: jsonb("shared").$type<{ company: string; round?: string; date?: string; url?: string }[]>().default(sql`'[]'::jsonb`).notNull(),
  active: boolean("active").default(true).notNull(),
});

export const fundItems = pgTable(
  "fund_items",
  {
    id: serial("id").primaryKey(),
    fundId: integer("fund_id").notNull(),
    kind: text("kind").notNull(), // deal | newfund | said
    title: text("title").notNull(),
    url: text("url").notNull(),
    date: ts("date"),
    company: text("company"),
    round: text("round"),
    amount: doublePrecision("amount"),
    currency: text("currency").default("$").notNull(),
    role: text("role"),
    thesisArea: text("thesis_area"),
    companyId: integer("company_id"),
    possible: boolean("possible").default(false).notNull(),
    source: text("source"),
  },
  (t) => [uniqueIndex("fund_items_fund_url").on(t.fundId, t.url)],
);

export const mentions = pgTable(
  "mentions",
  {
    id: serial("id").primaryKey(),
    entity: text("entity").notNull(),
    kind: text("kind").notNull(), // startup | established | portfolio | unknown
    stance: text("stance").notNull(),
    quote: text("quote"),
    url: text("url").notNull(),
    date: ts("date"),
    voice: text("voice").notNull(),
  },
  (t) => [uniqueIndex("mentions_entity_url").on(t.entity, t.url)],
);

export const courtsidePosts = pgTable("courtside_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  date: ts("date"),
  kind: text("kind").notNull(), // medium | fourthq
  summary: text("summary"),
});

export type Evidence = { url: string; date: string; kind: string; note: string; title: string; counts: boolean; domain?: string };

export const backtests = pgTable("backtests", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  company: text("company").notNull(),
  domain: text("domain"),
  announceDate: date("announce_date"),
  announceUrl: text("announce_url"),
  announceTitle: text("announce_title"),
  verdict: text("verdict").notNull(), // win | none
  leadDays: integer("lead_days"),
  flaggedOn: date("flagged_on"),
  signal: text("signal"),
  evidence: jsonb("evidence").$type<Evidence[]>().default(sql`'[]'::jsonb`).notNull(),
  courtside: boolean("courtside").default(true).notNull(),
  verified: boolean("verified").default(false).notNull(),
  createdAt: ts("created_at").defaultNow(),
});

export const filings = pgTable("filings", {
  id: serial("id").primaryKey(),
  accession: text("accession").notNull().unique(),
  form: text("form").notNull(),
  issuer: text("issuer").notNull(),
  cik: text("cik"),
  industry: text("industry"),
  amountSold: doublePrecision("amount_sold"),
  amountOffered: doublePrecision("amount_offered"),
  currency: text("currency").default("$").notNull(),
  firstSale: text("first_sale"),
  filedAt: ts("filed_at"),
  related: jsonb("related").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  thesisArea: text("thesis_area"),
  confidence: doublePrecision("confidence").default(0).notNull(),
  url: text("url").notNull(),
  website: text("website"),
  beforePress: boolean("before_press").default(false).notNull(),
  companyId: integer("company_id"),
});

export const votes = pgTable(
  "votes",
  {
    itemType: text("item_type").notNull(),
    itemId: text("item_id").notNull(),
    visitor: text("visitor").notNull(),
    value: integer("value").notNull(),
    createdAt: ts("created_at").defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.itemType, t.itemId, t.visitor] })],
);

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  body: text("body").notNull(),
  visitor: text("visitor"),
  createdAt: ts("created_at").defaultNow(),
});

export const changeLog = pgTable("change_log", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  summary: text("summary").notNull(),
  target: text("target"),
  before: jsonb("before"),
  after: jsonb("after"),
  visitor: text("visitor"),
  createdAt: ts("created_at").defaultNow(),
  undoneAt: ts("undone_at"),
});

export const jobRuns = pgTable("job_runs", {
  id: serial("id").primaryKey(),
  job: text("job").notNull(),
  startedAt: ts("started_at").defaultNow().notNull(),
  finishedAt: ts("finished_at"),
  status: text("status").default("running").notNull(),
  stage: text("stage"),
  done: integer("done").default(0).notNull(),
  total: integer("total").default(0).notNull(),
  items: integer("items").default(0).notNull(),
  errors: integer("errors").default(0).notNull(),
  aiCalls: integer("ai_calls").default(0).notNull(),
  cursor: jsonb("cursor"),
  log: text("log"),
  changes: jsonb("changes"),
});

export const sourceHealth = pgTable("source_health", {
  source: text("source").primaryKey(),
  label: text("label"),
  lastOk: ts("last_ok"),
  lastError: ts("last_error"),
  errorText: text("error_text"),
  items: integer("items").default(0).notNull(),
  updatedAt: ts("updated_at").defaultNow(),
});

export const people = pgTable("people", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  role: text("role"),
  youtube: text("youtube"),
  blog: text("blog"),
  github: text("github"),
  site: text("site"),
  tracked: boolean("tracked").default(true).notNull(),
  createdAt: ts("created_at").defaultNow(),
});

export const personItems = pgTable(
  "person_items",
  {
    id: serial("id").primaryKey(),
    personId: integer("person_id").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    date: ts("date"),
    source: text("source"),
  },
  (t) => [uniqueIndex("person_items_url").on(t.personId, t.url)],
);

export type AlertRule = { subject: string; event: string; keywords: string[]; sources: string[]; minAmount?: number };

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  rule: jsonb("rule").$type<AlertRule>().notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: ts("created_at").defaultNow(),
});

export const alertHits = pgTable(
  "alert_hits",
  {
    id: serial("id").primaryKey(),
    alertId: integer("alert_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    date: ts("date"),
    source: text("source"),
    createdAt: ts("created_at").defaultNow(),
  },
  (t) => [uniqueIndex("alert_hits_url").on(t.alertId, t.url)],
);

export const briefs = pgTable("briefs", {
  id: serial("id").primaryKey(),
  week: date("week").notNull().unique(),
  data: jsonb("data").notNull(),
  createdAt: ts("created_at").defaultNow(),
});

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  page: text("page").notNull(),
  element: text("element"),
  viewport: text("viewport"),
  theme: text("theme"),
  browser: text("browser"),
  chips: jsonb("chips").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  note: text("note"),
  meToo: integer("me_too").default(0).notNull(),
  status: text("status").default("open").notNull(),
  createdAt: ts("created_at").defaultNow(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").default(0).notNull(),
  windowStart: ts("window_start").defaultNow().notNull(),
});

export const aiUsage = pgTable("ai_usage", {
  day: date("day").primaryKey(),
  calls: integer("calls").default(0).notNull(), // memo drafts
  checks: integer("checks").default(0).notNull(), // AI Thesis Checks, capped separately
});

export const cache = pgTable("cache", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
});

/** Recent items from every feed (news, industry RSS, creators and shows), read by the trend, culture, sponsor and alert jobs. */
export const feedItems = pgTable(
  "feed_items",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(), // news | industry | video | episode | hn | producthunt | yc | appstore | gtrends | post
    source: text("source").notNull(),
    voice: text("voice"),
    title: text("title").notNull(),
    url: text("url").notNull().unique(),
    date: ts("date"),
    text: text("text"),
    processed: jsonb("processed").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    createdAt: ts("created_at").defaultNow(),
  },
  (t) => [index("feed_items_date_idx").on(t.date), index("feed_items_kind_idx").on(t.kind)],
);
