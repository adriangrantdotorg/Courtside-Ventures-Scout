import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { BriefView } from "@/components/BriefView";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ week: string }> }): Promise<Metadata> {
  const { week } = await params;
  return { title: `Brief · ${week}` };
}

export default async function Page({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) notFound();
  const [b] = await db().select().from(S.briefs).where(eq(S.briefs.week, week));
  if (!b) notFound();
  const archive = (await db().select({ w: S.briefs.week }).from(S.briefs).orderBy(desc(S.briefs.week)).limit(30)).map((x) => x.w);
  return <BriefView week={b.week} data={b.data} archive={archive} />;
}
