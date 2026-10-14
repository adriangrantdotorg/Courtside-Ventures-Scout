import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { BriefView } from "@/components/BriefView";

export const revalidate = 300;
export const metadata: Metadata = { title: "Brief" };

export default async function Page() {
  const briefs = await db().select().from(S.briefs).orderBy(desc(S.briefs.week)).limit(30);
  if (!briefs.length) return <div className="ph"><h1>Brief</h1><span className="count">The first Monday brief is built on Monday morning.</span></div>;
  return <BriefView week={briefs[0].week} data={briefs[0].data} archive={briefs.map((b) => b.week)} />;
}
