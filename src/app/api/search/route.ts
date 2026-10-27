import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { areaLabel, favicon } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

/** ⌘K: companies, trends, people, brands. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 60) || "";
  if (!q) return NextResponse.json({ hits: [] });
  const like = `%${q.replace(/[%_]/g, "")}%`;
  type R = { rows: Record<string, unknown>[] };
  const [cos, trends, people, brands, voices] = (await Promise.all([
    db().execute(sql`select id, name, domain, thesis_area, score, status from companies where hidden = false and merged_into is null and (name ilike ${like} or domain ilike ${like}) order by (lower(name) like lower(${q + "%"})) desc, score desc limit 6`),
    db().execute(sql`select id, slug, headline, term from trends where headline ilike ${like} or term ilike ${like} order by score desc limit 4`),
    db().execute(sql`select slug, name, role from people where name ilike ${like} limit 4`),
    db().execute(sql`select key, brand, site from sponsors where brand ilike ${like} limit 4`),
    db().execute(sql`select name, kind from voices where name ilike ${like} limit 4`),
  ])) as unknown as R[];
  const hits = [
    ...cos.rows.map((c) => ({ kind: "Companies", id: c.id, title: String(c.name), sub: `${areaLabel(String(c.thesis_area || "")) || "Outside the thesis"} · ${c.score}% · ${STATUS_LABEL[String(c.status)] || ""}`, href: `/company/${c.id}`, img: c.domain ? favicon(String(c.domain)) : undefined })),
    ...trends.rows.map((t) => ({ kind: "Trends", id: t.id, title: `Trend: ${t.headline}`, href: `/trends#${t.slug}` })),
    ...people.rows.map((p) => ({ kind: "People", title: String(p.name), sub: String(p.role || ""), href: `/tracking#people` })),
    ...voices.rows.map((v) => ({ kind: "People", title: String(v.name), sub: "Creator or show", href: `/culture#${String(v.name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}` })),
    ...brands.rows.map((b) => ({ kind: "Brands", title: String(b.brand), sub: "Sponsor Radar", href: `/sponsors#${b.key}`, img: b.site ? favicon(String(b.site)) : undefined })),
  ];
  return NextResponse.json({ hits });
}
