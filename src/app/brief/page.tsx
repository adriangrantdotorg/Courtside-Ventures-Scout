import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db, schema as S } from "@/db";
import { BriefView } from "@/components/BriefView";
import { briefTop } from "@/lib/queries";

export const revalidate = 300;
export const metadata: Metadata = { title: "IC Meeting" };

export default async function Page() {
  const briefs = await db().select().from(S.briefs).orderBy(desc(S.briefs.week)).limit(30);
  if (!briefs.length) return <div className="ph"><h1>IC Meeting</h1><span className="count">The first brief is built at 12 AM ET on Monday.</span></div>;
  const top = await briefTop(briefs[0].data as { startups?: { id: number }[] }, true);
  return <BriefView week={briefs[0].week} data={briefs[0].data} archive={briefs.map((b) => b.week)} top={top} />;
}
