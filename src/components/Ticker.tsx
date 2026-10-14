import Link from "next/link";
import { tickerItems } from "@/lib/queries";
import { favicon } from "@/lib/format";

// The LIVE strip. Every item links INTO the app; nothing here leaves the site.
export async function Ticker() {
  let items: Awaited<ReturnType<typeof tickerItems>> = [];
  try {
    items = await tickerItems();
  } catch {
    items = [];
  }
  if (items.length < 3) return null;
  const row = (dup: boolean) =>
    items.map((t, i) => (
      <Link key={(dup ? "b" : "a") + i} href={t.href} title={`Opens ${t.where}`} tabIndex={dup ? -1 : 0} aria-hidden={dup || undefined}>
        {t.domain ? <img src={favicon(t.domain)} alt="" width={14} height={14} /> : null}
        {t.label} <b className={t.tone}>{t.delta}</b>
      </Link>
    ));
  return (
    <div className="ticker" aria-label="Today's changes">
      <div className="lbl">
        <i />
        Live
      </div>
      <div className="track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
