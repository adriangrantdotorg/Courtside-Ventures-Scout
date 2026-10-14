import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as S } from "@/db";
import * as F from "@/lib/sources/fetchers";
import { rateLimit } from "@/lib/visitor";

const DAY = 86400000;

/** Add a creator or show: a YouTube /channel/UC… URL, a podcast name (Apple search), or any RSS URL. 90-day rule applies. */
export async function POST(req: Request) {
  const { input } = await req.json().catch(() => ({}));
  const raw = String(input || "").trim();
  if (!raw) return NextResponse.json({ error: "Paste a YouTube channel URL, a podcast name or an RSS URL." }, { status: 400 });
  if (!(await rateLimit("write", 100, 3600))) return NextResponse.json({ error: "Too many changes from this browser in the last hour." }, { status: 429 });
  let name = "";
  let youtube: string[] = [];
  let feeds: string[] = [];
  let site: string | null = null;
  let last: string | null = null;
  const ch = raw.match(/\/channel\/(UC[\w-]{20,})/);
  if (ch) {
    const f = await F.youtube(ch[1]);
    if (!f.items.length) return NextResponse.json({ error: "YouTube didn't return that channel's feed right now (it rate-limits). Try again in a few minutes." }, { status: 502 });
    name = f.title;
    youtube = [ch[1]];
    site = `https://www.youtube.com/channel/${ch[1]}`;
    last = f.items[0]?.date || null;
  } else if (/^https?:\/\//.test(raw)) {
    const f = await F.feed(raw);
    if (!f.items.length) return NextResponse.json({ error: "That URL isn't a feed Scout can read." }, { status: 400 });
    name = f.title || raw;
    feeds = [raw];
    site = raw;
    last = f.items.map((i) => i.date).filter(Boolean).sort().pop() || null;
  } else {
    const r = (await F.itunesPodcast(raw)).find((x) => x.feedUrl);
    if (!r) return NextResponse.json({ error: `No podcast called "${raw}" on Apple Podcasts.` }, { status: 404 });
    const f = await F.feed(r.feedUrl!);
    name = r.name;
    feeds = [r.feedUrl!];
    site = r.url;
    last = f.items.map((i) => i.date).filter(Boolean).sort().pop() || r.released;
  }
  if (!last || Date.now() - new Date(last).getTime() > 90 * DAY) return NextResponse.json({ error: `${name} has no new episode in the last 90 days, so it can't be a source.` }, { status: 409 });
  const [v] = await db()
    .insert(S.voices)
    .values({ name, kind: feeds.length ? "podcast" : "voice", youtube, feeds, site, lastEpisode: new Date(last), priority: 50 })
    .onConflictDoNothing()
    .returning();
  if (!v) return NextResponse.json({ error: `${name} is already a source.` }, { status: 409 });
  await db().insert(S.changeLog).values({ kind: "voice", summary: `Added ${name} to the creators and shows`, target: `voice:${v.id}`, before: null, after: { id: v.id } });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, voice: v });
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  const [v] = await db().select().from(S.voices).where(eq(S.voices.id, Number(id)));
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (v.exempt) return NextResponse.json({ error: `${v.name} always stays.` }, { status: 409 });
  await db().delete(S.voices).where(eq(S.voices.id, v.id));
  await db().insert(S.changeLog).values({ kind: "voice", summary: `Removed ${v.name} from the creators and shows`, target: `voice:${v.id}`, before: { deleted: v }, after: null });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
