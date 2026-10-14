import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { JOBS, runNamed } from "@/lib/jobs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!JOBS[job]) return NextResponse.json({ error: "unknown job" }, { status: 404 });
  const r = await runNamed(job);
  revalidatePath("/", "layout");
  return NextResponse.json(r);
}
