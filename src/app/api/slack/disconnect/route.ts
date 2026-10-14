import { NextResponse } from "next/server";
import { disconnectSlack } from "@/lib/slack";

export async function POST() {
  await disconnectSlack();
  return NextResponse.json({ ok: true });
}
