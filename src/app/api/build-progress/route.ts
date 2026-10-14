import { NextResponse } from "next/server";
import { buildProgress } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const p = await buildProgress().catch(() => null);
  return NextResponse.json({ progress: p }, { headers: { "cache-control": "no-store" } });
}
