import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as S } from "@/db";
import { rateLimit } from "@/lib/visitor";
import { companyKey } from "@/lib/companies";
import { domainOf, slugify } from "@/lib/format";

export async function POST(req: Request) {
  const { kind, id, on, name, site } = await req.json().catch(() => ({}));
  if (!(await rateLimit("write", 200, 3600))) return NextResponse.json({ error: "Too many changes from this browser in the last hour." }, { status: 429 });
  // Added by name from the Tracking page (10-14-26): a company or trend Scout has not seen yet is created, tracked, and checked daily
  if (kind === "company" && !id && typeof name === "string" && name.trim()) {
    const nm = name.trim().slice(0, 120);
    const domain = site ? domainOf(String(site)) : /\.[a-z]{2,}$/i.test(nm) && !/\s/.test(nm) ? nm.toLowerCase() : null;
    const key = companyKey(domain ? nm.replace(/\.[a-z]{2,}$/i, "") : nm, domain);
    const [c] = await db()
      .insert(S.companies)
      .values({ key, name: domain && !/\s/.test(nm) && /\./.test(nm) ? nm.replace(/\.[a-z]{2,}$/i, "") : nm, domain, description: "Added by the team on the Tracking page.", whyFits: "Added by the team; Scout checks news, filings and shows for it every morning.", whyFitsManual: true, tracked: true, trackedAt: new Date() })
      .onConflictDoUpdate({ target: S.companies.key, set: { tracked: true, trackedAt: new Date(), hidden: false } })
      .returning({ id: S.companies.id, name: S.companies.name });
    await db().insert(S.changeLog).values({ kind: "track", summary: `Tracked ${c.name}`, target: `company:${c.id}`, before: { tracked: false }, after: { tracked: true } });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, tracked: true, id: c.id, name: c.name });
  }
  if (kind === "trend" && !id && typeof name === "string" && name.trim()) {
    const term = name.trim().slice(0, 120);
    const r = (await db().execute(sql`select count(*)::int as n from trends where tracked = true`)) as unknown as { rows: { n: number }[] };
    if (Number(r.rows[0].n) >= 30) return NextResponse.json({ error: "30 trends are already tracked. Untrack one first to free a slot.", full: true }, { status: 409 });
    const [t] = await db()
      .insert(S.trends)
      .values({ slug: slugify(term), term, headline: term.charAt(0).toUpperCase() + term.slice(1), tracked: true })
      .onConflictDoUpdate({ target: S.trends.slug, set: { tracked: true } })
      .returning({ id: S.trends.id, headline: S.trends.headline });
    await db().insert(S.changeLog).values({ kind: "track", summary: `Tracked the trend "${term}"`, target: `trend:${t.id}`, before: { tracked: false }, after: { tracked: true } });
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, tracked: true, id: t.id, name: t.headline });
  }
  const n = Number(id);
  if (kind === "company") {
    const [c] = await db().select({ name: S.companies.name, tracked: S.companies.tracked }).from(S.companies).where(eq(S.companies.id, n));
    if (!c) return NextResponse.json({ error: "No such company" }, { status: 404 });
    await db().update(S.companies).set({ tracked: !!on, trackedAt: on ? new Date() : null }).where(eq(S.companies.id, n));
    await db().insert(S.changeLog).values({ kind: "track", summary: `${on ? "Tracked" : "Untracked"} ${c.name}`, target: `company:${n}`, before: { tracked: c.tracked }, after: { tracked: !!on } });
  } else if (kind === "trend") {
    const [t] = await db().select().from(S.trends).where(eq(S.trends.id, n));
    if (!t) return NextResponse.json({ error: "No such trend" }, { status: 404 });
    if (on && !t.tracked) {
      const r = (await db().execute(sql`select count(*)::int as n from trends where tracked = true`)) as unknown as { rows: { n: number }[] };
      if (Number(r.rows[0].n) >= 30) return NextResponse.json({ error: "30 trends are already tracked. Untrack one first to free a slot.", full: true }, { status: 409 });
    }
    await db().update(S.trends).set({ tracked: !!on }).where(eq(S.trends.id, n));
    await db().insert(S.changeLog).values({ kind: "track", summary: `${on ? "Tracked" : "Untracked"} the trend "${t.term}"`, target: `trend:${n}`, before: { tracked: t.tracked }, after: { tracked: !!on } });
  } else if (kind === "person") {
    await db().update(S.people).set({ tracked: !!on }).where(eq(S.people.id, n));
  } else return NextResponse.json({ error: "bad kind" }, { status: 400 });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, tracked: !!on });
}
