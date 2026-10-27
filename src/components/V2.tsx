"use client";
// Scout V2 (10-26-26): the parts of the new cards, built from the approved mockups (design/v2/).
// Tile on Today, Tile rows in the Pipeline, IC Meeting and Tracking, the Deal Sheet on company pages,
// and Scout's own video player. Red is only for Visit Website.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Vote, useActions, NoteDialog, useGone, useShown } from "./cards";
import { Ago } from "./Live";
import type { CompanyCard } from "@/lib/queries";
import type { Media } from "@/db/schema";
import { fitHue, BUCKETS, moneyRange } from "@/lib/v2";
import { fmtDate, STAGE_LABEL, plural } from "@/lib/format";
import { sigLabel } from "@/lib/labels";

/* ---------- icons ---------- */
const P: Record<string, ReactNode> = {
  play: <path d="M7 4.5v15l12.5-7.5z" />,
  pause: <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />,
  ext: (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),
  pin: <path d="M12 17v5M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />,
  down: <path d="m6 9 6 6 6-6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  news: <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2M18 14h-8M15 18h-5M10 6h8v4h-8z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  sound: <path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
};
export function Ico({ n, fill, cls }: { n: string; fill?: boolean; cls?: string }) {
  return (
    <svg className={"x-ico" + (fill ? " fill" : "") + (cls ? " " + cls : "")} viewBox="0 0 24 24" aria-hidden="true">
      {P[n]}
    </svg>
  );
}

/* ---------- popovers: sources, signals, More, the filter menus ---------- */
/** Opens downward unless the card it sits in (which clips) or the window would cut it off; long lists scroll inside. */
function place(box: HTMLElement) {
  box.classList.remove("up", "left");
  const btn = (box.previousElementSibling as HTMLElement).getBoundingClientRect();
  const r = box.getBoundingClientRect();
  const clip = box.closest(".x-tile");
  const cr = clip ? clip.getBoundingClientRect() : { top: 0, bottom: innerHeight };
  const below = Math.min(innerHeight, cr.bottom) - btn.bottom;
  const above = btn.top - Math.max(0, cr.top);
  if (r.height > below - 8 && above > below) box.classList.add("up");
  if (r.right > innerWidth - 8) box.classList.add("left");
}

export function Pop({ btnClass, label, title, boxClass = "", testid, children }: { btnClass: string; label: ReactNode; title?: string; boxClass?: string; testid?: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const other = (e: Event) => (e as CustomEvent).detail !== wrap.current && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    document.addEventListener("x-pop", other);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
      document.removeEventListener("x-pop", other);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (open && box.current) place(box.current);
  }, [open]);
  return (
    <span className="x-pop" ref={wrap}>
      <button
        type="button"
        className={btnClass}
        aria-expanded={open}
        title={title}
        data-testid={testid}
        onClick={(e) => {
          e.stopPropagation();
          if (!open) document.dispatchEvent(new CustomEvent("x-pop", { detail: wrap.current }));
          setOpen(!open);
        }}
      >
        {label}
      </button>
      <span ref={box} className={"x-popbox " + boxClass} hidden={!open} onClick={(e) => e.stopPropagation()}>
        {open && children(() => setOpen(false))}
      </span>
    </span>
  );
}

/* ---------- small parts ---------- */
export function FitRing({ fit, name, size = "md" }: { fit: number; name: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const C = 2 * Math.PI * 42;
  return (
    <span className={`x-fit ${size}`} style={{ ["--h" as string]: fitHue(fit) }} title={`Thesis fit: how well ${name} matches Courtside's thesis`} data-testid="fit">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="trk" cx="50" cy="50" r="42" />
        <circle className="val" cx="50" cy="50" r="42" strokeDasharray={`${((C * fit) / 100).toFixed(1)} ${C.toFixed(1)}`} />
      </svg>
      <span className="num">
        <b>
          {fit}
          <small>%</small>
        </b>
        <em>Fit</em>
      </span>
    </span>
  );
}

export function Logo({ src, name, cls = "x-logo" }: { src: string | null; name: string; cls?: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <span className={cls + " mono"}>{name.trim().charAt(0).toUpperCase()}</span>;
  return <img className={cls} src={src} alt="" loading="lazy" onError={() => setBad(true)} />;
}

const Area = ({ c }: { c: CompanyCard }) => (c.area ? <span className="x-area">{c.area}</span> : null);
const NewChip = ({ c }: { c: CompanyCard }) =>
  c.isNew ? (
    <span className="x-new" title="A new signal in the last 7 days">
      <i />
      New
    </span>
  ) : null;

/** "Overlaps with …", the startup's logo beside the portfolio company's. Real competitors only. */
export function OverlapTag({ c }: { c: CompanyCard }) {
  if (!c.overlap) return null;
  return (
    <span className="x-ov o2" title={c.overlap.reason}>
      <span className="pair">
        <Logo src={c.logo} name={c.name} cls="x-pairlogo" />
        <Logo src={c.overlap.logo} name={c.overlap.with} cls="x-pairlogo" />
      </span>
      <span>Overlaps with {c.overlap.with}</span>
    </span>
  );
}

export function OverlapCallout({ c }: { c: CompanyCard }) {
  if (!c.overlap) return null;
  return (
    <div className="x-ov o2 callout pairbig">
      <span className="pair big">
        <Logo src={c.logo} name={c.name} cls="x-pairlogo" />
        <Logo src={c.overlap.logo} name={c.overlap.with} cls="x-pairlogo" />
      </span>
      <div>
        <b>Overlaps with {c.overlap.with}</b>
        <span>
          {c.overlap.reason}. {c.overlap.href ? <a href={c.overlap.href} target="_blank" rel="noopener noreferrer" title={`Opens ${c.overlap.with} on Courtside's site in a new window`}>{c.overlap.with}</a> : c.overlap.with} is a Courtside portfolio company: check for conflicts before reaching out.
        </span>
      </div>
    </div>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function SiteButton({ c, style = "cta" }: { c: CompanyCard; style?: string }) {
  if (c.site)
    return (
      <a className={`x-btn site ${style}`} href={c.site} target="_blank" rel="noopener noreferrer" title={`Opens ${hostOf(c.site)} in a new window`} data-testid="visit">
        <Ico n="ext" />
        <span>Visit Website</span>
      </a>
    );
  return (
    <a className="x-btn site find" href={c.searchUrl} target="_blank" rel="noopener noreferrer" title="No official website found yet: searches the web in a new window" data-testid="find">
      <Ico n="search" />
      <span>Find Website</span>
    </a>
  );
}

/** Filled or Ghost Globe (picked 10-26-26), on Today's cards only: red when the official site is known, dashed when Scout would search. */
export function WebIcon({ c }: { c: CompanyCard }) {
  const known = !!c.site;
  const tip = known ? "Visit Website" : "Find Website";
  return (
    <a
      className={"x-web w1 " + (known ? "known" : "search")}
      href={known ? c.site! : c.searchUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={known ? `Visit Website: ${hostOf(c.site!)}` : "Find Website: No Official Site Yet, Searches the Web"}
      data-tip={tip}
    >
      <Ico n="globe" />
    </a>
  );
}

/* ---------- Funds Raised ---------- */
function SourcesPop({ c }: { c: CompanyCard }) {
  const src = c.funds.rounds.flatMap((r) => r.sources.map((s) => ({ ...s, stage: r.stage })));
  if (!src.length) return null;
  const n = src.length;
  return (
    <Pop
      btnClass="x-srcbtn"
      title="Where this number comes from"
      label={
        <>
          <Ico n="info" />
          <span>
            {plural(n, "Source")}
            {c.funds.agree ? " Agree" : ""}
          </span>
          <Ico n="down" />
        </>
      }
    >
      {() => (
        <>
          <b>Where This Number Comes From</b>
          <ul>
            {src.map((s, i) => (
              <li key={i}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" title={`Opens ${s.title.slice(0, 80)} in a new window`}>
                    {s.name}
                  </a>
                ) : (
                  <b>{s.name}</b>
                )}
                <span>
                  {s.amount ? moneyRange(s.amount, s.amount) : "Amount not given"}
                  {s.stage !== "unknown" ? ` · ${STAGE_LABEL[s.stage] || s.stage}` : ""}
                </span>
                <time>{fmtDate(s.date)}</time>
              </li>
            ))}
          </ul>
        </>
      )}
    </Pop>
  );
}

export function Funds({ c, size = "", lean }: { c: CompanyCard; size?: string; lean?: boolean }) {
  const f = c.funds;
  const amt = (
    <span className={"x-amt" + (f.known ? "" : " none")} data-testid="funds">
      {f.text}
    </span>
  );
  if (lean)
    return (
      <div className={`x-funds ${size}`}>
        <span className="x-flabel">Funds Raised</span>
        {amt}
      </div>
    );
  const rounds = f.rounds.filter((r) => r.amount || r.stage !== "unknown").length;
  return (
    <div className={`x-funds ${size}`}>
      <span className="x-flabel">Funds Raised</span>
      {amt}
      <span className="x-fsub">
        {f.stage && <span className="x-stage">{f.stage}</span>}
        {rounds > 1 && <span className="x-note">{rounds} Rounds</span>}
        <SourcesPop c={c} />
      </span>
    </div>
  );
}

/* ---------- signals ---------- */
export function SignalsPop({ c }: { c: CompanyCard }) {
  const s = c.signals;
  if (!s.length) return null;
  const first = s[0];
  const when = first.date ? (
    <time>
      <Ago date={first.date} ch={0} />
    </time>
  ) : null;
  if (s.length === 1)
    return (
      <a className="x-sig" href={first.url} target="_blank" rel="noopener noreferrer" title={`Opens ${first.title.slice(0, 90)} in a new window`}>
        <Ico n="news" />
        <span>{sigLabel(first)}</span>
        {when}
      </a>
    );
  return (
    <span className="x-sigpop">
      <Pop
        btnClass="x-sig x-sigbtn"
        title="Every signal, newest first"
        label={
          <>
            <Ico n="news" />
            <span>
              {sigLabel(first)} + {s.length - 1} More
            </span>
            {when}
            <Ico n="down" />
          </>
        }
        boxClass="x-siglist"
      >
        {() => (
          <>
            <b>{s.length} Signals, Newest First</b>
            <ul>
              {s.map((x) => (
                <li key={x.id}>
                  <a href={x.url} target="_blank" rel="noopener noreferrer" title="Opens the source in a new window">
                    <b>{sigLabel(x)}</b>
                    <span className="x-headline">{x.title}</span>
                  </a>
                  <time>{fmtDate(x.date)}</time>
                </li>
              ))}
            </ul>
          </>
        )}
      </Pop>
    </span>
  );
}

/* ---------- the picture ---------- */
export function MediaView({ c }: { c: CompanyCard }) {
  const [bad, setBad] = useState(false);
  const m: Media = bad ? { kind: "logo", logo: c.logo || undefined } : c.media;
  const fail = () => setBad(true);
  let inner: ReactNode;
  if (m.kind === "yt" || (m.kind === "mp4" && m.poster)) inner = <img className="cover" src={m.poster} alt={c.name} loading="lazy" onError={fail} />;
  else if (m.kind === "mp4") inner = <video className="cover" src={`${m.mp4}#t=0.5`} muted playsInline preload="metadata" aria-label={c.name} onError={fail} />;
  else if (m.kind === "shots")
    inner = (
      <div className="shots">
        {(m.shots || []).map((s) => (
          <img key={s} src={s} alt="" loading="lazy" onError={fail} />
        ))}
      </div>
    );
  else if (m.kind === "site")
    inner = (
      <>
        <img className="back blur" src={m.img} alt="" loading="lazy" />
        <img className="contain" src={m.img} alt={c.name} loading="lazy" onError={fail} />
      </>
    );
  else
    inner = (
      <div className="logostage">
        {c.logo && !bad ? <img className="lg sq" src={c.logo} alt={c.name} onError={() => setBad(true)} /> : <span className="lg monogram">{c.name.trim().charAt(0).toUpperCase()}</span>}
      </div>
    );
  return (
    <div className="x-media" data-kind={m.kind}>
      {inner}
    </div>
  );
}

export function PlayBar({ c }: { c: CompanyCard }) {
  const m = c.media;
  if (m.kind !== "yt" && m.kind !== "mp4") return null;
  return (
    <div className="x-pbar">
      <button
        className="x-play"
        type="button"
        data-act="play"
        onClick={(e) => {
          e.stopPropagation();
          document.dispatchEvent(new CustomEvent("scout:play", { detail: { name: c.name, site: c.site, logo: c.logo, media: m, from: e.currentTarget } }));
        }}
      >
        <Ico n="play" fill />
        <span>{m.play || "Play Video"}</span>
      </button>
    </div>
  );
}

/* ---------- actions: Track, More, votes ---------- */
type Acts = ReturnType<typeof useActions>;
export function TrackBtn({ c, a }: { c: CompanyCard; a: Acts }) {
  return (
    <button type="button" className="x-btn x-track" data-act="track" aria-pressed={a.tracked} onClick={a.track} title={a.tracked ? `Stop tracking ${c.name}` : `Track ${c.name}: a daily check of news, filings and shows`}>
      {a.tracked ? <Ico n="check" /> : <Ico n="pin" />}
      <span>{a.tracked ? "Tracking" : "Track"}</span>
    </button>
  );
}
export function MoreMenu({ c, a, off }: { c: CompanyCard; a: Acts; off?: boolean }) {
  return (
    <>
      <Pop
        btnClass="x-btn x-more"
        title={off ? "Memo, email, note, CRM and CSV" : "Memo, email, note, CRM, CSV and Not a Fit"}
        boxClass="x-menu"
        label={
          <>
            <span>More</span>
            <Ico n="down" />
          </>
        }
      >
        {(close) => (
          <>
            {(
              [
                ["memo", "Draft Investment Memo", a.memo, "Copies Courtside's eight-part outline filled with every fact Scout has, for your AI"],
                ["email", "Connection Email", a.email, "Opens your mail app with a connection email filled in. Nothing is sent."],
                ["note", "Add Note", () => a.setNoting(true), "A note everyone on the team sees"],
                ["crm", "Copy for CRM", a.crm, "Copies a clean text block for your CRM"],
                ["csv", "Download CSV", a.csv, "One row for this company"],
                ...(off || a.gone ? [] : [["notfit", "Not a Fit", a.notFit, `Takes ${c.name} off Today and the Pipeline for the whole team. ⌘Z or Settings › Hidden Startups brings it back.`]]),
              ] as [string, string, () => void, string][]
            ).map(([k, l, fn, t]) => (
              <button
                key={k}
                type="button"
                data-act={k}
                title={t}
                onClick={() => {
                  close();
                  fn();
                }}
              >
                {l}
              </button>
            ))}
          </>
        )}
      </Pop>
      {a.noting && <NoteDialog c={c} close={() => a.setNoting(false)} />}
    </>
  );
}
const Votes = ({ c }: { c: CompanyCard }) => <Vote k={`company:${c.id}`} initial={c.votes} name={c.name} v2 />;

/* ---------- cards ---------- */
function useOpen(c: CompanyCard) {
  const router = useRouter();
  const href = `/company/${c.id}`;
  const skip = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.("a, button, .x-popbox, .x-pop, input, select, textarea, video");
  return {
    href,
    onClick: (e: React.MouseEvent) => {
      if (skip(e.target)) return;
      if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
      else router.push(href);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        router.push(href);
      }
    },
  };
}

/** On the Radar: the picture fills the card; the whole card opens the company page. */
export function Tile({ c }: { c: CompanyCard }) {
  const open = useOpen(c);
  const hidden = useGone(c.id);
  if (hidden) return null;
  return (
    <article className="x-tile link" tabIndex={0} data-item data-company={c.id} title={`Open ${c.name}`} onClick={open.onClick} onKeyDown={open.onKeyDown} aria-label={`${c.name}: ${c.score}% thesis fit, Funds Raised ${c.funds.text}`}>
      <div className="x-tm">
        <MediaView c={c} />
        <div className="x-scrim" />
        <div className="x-hovwrap">
          <div className="x-hov h1" aria-hidden="true">
            <span>
              Click to View More Details
              <Ico n="arrow" />
            </span>
          </div>
        </div>
        <div className="x-tl">
          <FitRing fit={c.score} name={c.name} />
        </div>
        <div className="x-tr">
          <WebIcon c={c} />
        </div>
        <div className="x-over">
          <div className="x-tags">
            <Area c={c} />
            <NewChip c={c} />
            <OverlapTag c={c} />
          </div>
          <h3 className="x-name">
            <Link href={open.href} data-act="open" tabIndex={-1}>
              {c.name}
            </Link>
          </h3>
          <Funds c={c} size="tile" lean />
        </div>
      </div>
      <PlayBar c={c} />
    </article>
  );
}

/** Must See: the highest thesis-fit startup recently in the news. No website button when no official site is
 *  known, and no Funds Raised when the amount is unknown (Adrian, 10-26-26). */
export function Hero({ c }: { c: CompanyCard }) {
  const a = useActions(c);
  if (a.gone) return null;
  return (
    <article className="x-tile hero open always" data-item data-company={c.id}>
      <div className="x-tm">
        <MediaView c={c} />
        <div className="x-scrim" />
        <div className="x-tl">
          <FitRing fit={c.score} name={c.name} size="lg" />
        </div>
        <div className="x-tr">{c.site && <WebIcon c={c} />}</div>
        <div className="x-over">
          <div className="x-tags">
            <Area c={c} />
            <NewChip c={c} />
            <OverlapTag c={c} />
          </div>
          <h3 className="x-name">{c.name}</h3>
          {c.funds.known && <Funds c={c} size="tile" />}
          <div className="x-reveal">
            <div>
              {c.whySegs.length > 0 && <p className="x-why">{c.whySegs.map((s) => (typeof s === "string" ? s : s.t)).join("")}</p>}
              <SignalsPop c={c} />
              <div className="x-acts">
                <Link className="x-btn ghost" href={`/company/${c.id}`} data-act="open" title={`Open ${c.name} in Scout`}>
                  <Ico n="arrow" />
                  <span>View Details</span>
                </Link>
                <TrackBtn c={c} a={a} />
                <MoreMenu c={c} a={a} />
                <Votes c={c} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <PlayBar c={c} />
    </article>
  );
}

/** Pipeline, IC Meeting and Tracking: fit and Funds Raised first, then the picture, the why and the signals. */
export function Row({ c, rank }: { c: CompanyCard; rank?: number }) {
  const a = useActions(c);
  if (a.gone) return null;
  return (
    <article className="x-row" data-item data-company={c.id}>
      <div className="x-key">
        {rank !== undefined && <span className="x-rank">#{rank}</span>}
        <div className="x-tl static">
          <FitRing fit={c.score} name={c.name} size="lg" />
        </div>
        <Funds c={c} size="row" />
      </div>
      <div className="x-banner">
        <div className="x-bclip">
          <MediaView c={c} />
          <div className="x-bscrim" />
        </div>
        <div className="x-bover">
          <div className="x-chead">
            <Logo src={c.logo} name={c.name} />
            <div>
              <h3 className="x-name">
                <Link href={`/company/${c.id}`} data-act="open" title={`Open ${c.name} in Scout`}>
                  {c.name}
                </Link>
              </h3>
              <div className="x-tags">
                <Area c={c} />
                <NewChip c={c} />
                <OverlapTag c={c} />
              </div>
            </div>
          </div>
          {c.whySegs.length > 0 && <p className="x-why">{c.whySegs.map((s) => (typeof s === "string" ? s : s.t)).join("")}</p>}
          <SignalsPop c={c} />
        </div>
      </div>
      <div className="x-side">
        <SiteButton c={c} />
        <TrackBtn c={c} a={a} />
        <MoreMenu c={c} a={a} />
        <Votes c={c} />
      </div>
      <PlayBar c={c} />
    </article>
  );
}

/** The Combine: the top 10 startups by thesis fit, highest first, with Funds Raised. */
export function Combine({ cards: all }: { cards: CompanyCard[] }) {
  const cards = useShown(all);
  return (
    <section className="x-sec" aria-label="The Combine">
      <div className="x-sech">
        <h2 className="x-h2">The Combine</h2>
        <span className="x-count">(Top 10 Startups by Thesis Fit · Updated Daily)</span>
      </div>
      <div className="x-race static">
        <div className="x-rhead">
          <span>#</span>
          <span />
          <span>Company</span>
          <span>Thesis Fit</span>
          <span>Funds Raised</span>
        </div>
        {cards.slice(0, 10).map((c, i) => (
          <Link key={c.id} className="x-rr" href={`/company/${c.id}`} style={{ ["--w" as string]: c.score, ["--h" as string]: fitHue(c.score) }} title={`Open ${c.name} in Scout`}>
            <span className="x-rpos">{i + 1}</span>
            <Logo src={c.logo} name={c.name} cls="x-logo sm" />
            <span className="x-rname">
              {c.name}
              <NewChip c={c} />
            </span>
            <span className="x-rtrack">
              <i />
              <b>{c.score}%</b>
            </span>
            <span className={"x-rfund" + (c.funds.known ? "" : " none")}>{c.funds.text}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------- On the Radar: the Dropdown Bar and the tiles it filters ---------- */
type RF = { bucket: string; area: string; fit50: boolean; newonly: boolean };
const NONE: RF = { bucket: "", area: "", fit50: false, newonly: false };
const PAGE = 18;

function Dd({ label, value, shown, opts, set }: { label: string; value: string; shown: string; opts: [string, string, number][]; set: (v: string) => void }) {
  return (
    <span className="x-dd">
      <Pop
        btnClass={"x-ddbtn" + (value ? " on" : "")}
        boxClass="x-ddmenu"
        title={`Filter by ${label}`}
        label={
          <>
            <span className="x-flabel">{label}</span>
            <b data-shown>{shown}</b>
            <Ico n="down" />
          </>
        }
      >
        {(close) => (
          <>
            {[["", "All", -1] as [string, string, number], ...opts].map(([v, n, k]) => (
              <button
                key={v || "all"}
                type="button"
                aria-pressed={value === v}
                onClick={() => {
                  set(v);
                  close();
                }}
              >
                <span>{n}</span>
                {k >= 0 && <b>{k}</b>}
              </button>
            ))}
          </>
        )}
      </Pop>
    </span>
  );
}

export function Radar({ cards }: { cards: CompanyCard[] }) {
  const [f, setF] = useState<RF>(NONE);
  const [limit, setLimit] = useState(PAGE);
  const ok = (c: CompanyCard, x: RF) => (x.bucket === "" || String(c.bucket) === x.bucket) && (!x.area || c.thesisArea === x.area) && (!x.fit50 || c.score >= 50) && (!x.newonly || c.isNew);
  const shown = useMemo(() => cards.filter((c) => ok(c, f)), [cards, f]);
  // a range with no companies is never offered; the chosen one always stays
  const bucketOpts = BUCKETS.map((n, i) => [String(i), n, cards.filter((c) => ok(c, { ...f, bucket: String(i) })).length] as [string, string, number]).filter(([v, , k]) => k > 0 || v === f.bucket);
  const areas = [...new Set(cards.map((c) => c.thesisArea).filter(Boolean))] as string[];
  const areaOpts = areas.map((a) => [a, cards.find((c) => c.thesisArea === a)!.area, cards.filter((c) => ok(c, { ...f, area: a })).length] as [string, string, number]).filter(([v, , k]) => k > 0 || v === f.area);
  const set = (k: keyof RF, v: string | boolean) => {
    setF((x) => ({ ...x, [k]: v }));
    setLimit(PAGE);
  };
  const active = f.bucket !== "" || !!f.area || f.fit50 || f.newonly;
  return (
    <section className="x-sec" aria-label="On the Radar">
      <div className="x-sech">
        <h2 className="x-h2">On the Radar</h2>
        <span className="x-count">
          {shown.length} {shown.length === 1 ? "Company" : "Companies"} by Fit
        </span>
      </div>
      <div className="x-fwrap" id="fbar">
        <div className="x-filter f2">
          <Dd label="Funds Raised" value={f.bucket} shown={f.bucket === "" ? "All" : BUCKETS[Number(f.bucket)]} opts={bucketOpts} set={(v) => set("bucket", v)} />
          <Dd label="Category" value={f.area} shown={f.area ? cards.find((c) => c.thesisArea === f.area)?.area || f.area : "All"} opts={areaOpts} set={(v) => set("area", v)} />
          <button type="button" className="x-chip" aria-pressed={f.fit50} onClick={() => set("fit50", !f.fit50)} title="Only startups with 50% thesis fit or more">
            50%+ Fit
          </button>
          <button type="button" className="x-chip" aria-pressed={f.newonly} onClick={() => set("newonly", !f.newonly)} title="Only startups with a new signal in the last 7 days">
            <i className="x-dot" />
            New This Week
          </button>
          <span className="x-fcount" data-count>
            {shown.length} of {cards.length} Companies
          </span>
          <button type="button" className="x-fclear" disabled={!active} onClick={() => setF(NONE)} title="Clear every filter">
            Clear Filters
          </button>
        </div>
      </div>
      <div className="x-grid3" id="radar">
        {shown.slice(0, limit).map((c) => (
          <Tile key={c.id} c={c} />
        ))}
      </div>
      {!shown.length && <p className="x-empty">No company matches these filters. Clear Filters shows all {cards.length}.</p>}
      {shown.length > limit && (
        <p style={{ marginTop: 22, textAlign: "center" }}>
          <button type="button" className="x-btn x-more" onClick={() => setLimit(limit + PAGE)} title={`Show ${Math.min(PAGE, shown.length - limit)} more`}>
            <span>Show More</span>
            <b className="mono" style={{ fontSize: 14, color: "var(--text-3)" }}>
              {Math.min(PAGE, shown.length - limit)} of {shown.length - limit}
            </b>
          </button>
        </p>
      )}
    </section>
  );
}

/* ---------- the Deal Sheet: the top of a company page ---------- */
export function DealSheet({ c, bars, hint, investors, off }: { c: CompanyCard; bars: [string, number, number][]; hint: string; investors: string | null; off?: boolean }) {
  const a = useActions(c);
  const segs = [...c.funds.rounds].filter((r) => r.amount).reverse();
  const total = segs.reduce((s, r) => s + (r.amount || 0), 0);
  return (
    <header className="x-deal" data-item data-company={c.id}>
      {a.gone && (
        <p className="x-notrec gone" role="note">
          <b>Hidden from Scout&apos;s recommendations.</b> Today and the Pipeline skip {c.name} for the whole team. ⌘Z puts it back, and so does Settings › Hidden Startups.
        </p>
      )}
      <div className="x-dl">
        <div className="x-dtitle">
          <Logo src={c.logo} name={c.name} cls="x-logo big" />
          <div>
            <h1 className="x-dname">{c.name}</h1>
            <div className="x-tags">
              <Area c={c} />
              <NewChip c={c} />
              {investors && <span className="x-area">Backed by {investors}</span>}
            </div>
          </div>
        </div>
        <OverlapCallout c={c} />
        <div className="x-kpis">
          <section className="x-kpanel fitp" aria-label="Thesis Fit">
            <div className="x-khead">
              <span className="x-flabel">Thesis Fit</span>
              <Link className="x-howlink" href="/settings?s=scoring" title="Open Settings › Scoring">
                How Scout Scores
              </Link>
            </div>
            <div className="x-fitwrap">
              <div className="x-tl static">
                <FitRing fit={c.score} name={c.name} size="xl" />
              </div>
              <div className="x-bars">
                {bars.map(([n, v, mx]) => (
                  <div className="x-bar" key={n}>
                    <span className="lbl">{n}</span>
                    <span className="tr">
                      <i style={{ ["--w" as string]: `${Math.round((v / (mx || 1)) * 100)}%` }} />
                    </span>
                    <span className="n">
                      {v}
                      <small>/{mx}</small>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="x-hint">{hint}</p>
          </section>
          <section className="x-kpanel fundp" aria-label="Funds Raised">
            <Funds c={c} size="xxl" />
            {segs.length > 0 && (
              <div className="x-stack" title={`${c.funds.text} across ${plural(segs.length, "round")}`}>
                {segs.map((r, i) => (
                  <span className="seg" key={i} style={{ flex: (r.amount || 0) / (total || 1) }}>
                    <b>{moneyRange(r.low ?? r.amount!, r.amount!)}</b>
                    <span>{r.stage !== "unknown" ? STAGE_LABEL[r.stage] || r.stage : "Round"}</span>
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
        {c.whySegs.length > 0 && <p className="x-why big">{c.whySegs.map((s) => (typeof s === "string" ? s : s.t)).join("")}</p>}
        <div className="x-acts">
          <SiteButton c={c} style="cta big" />
          <TrackBtn c={c} a={a} />
          <MoreMenu c={c} a={a} off={off} />
          <Votes c={c} />
        </div>
      </div>
      <div className="x-dr">
        <div className="x-dmedia">
          <MediaView c={c} />
          <PlayBar c={c} />
        </div>
        {c.signals.length > 0 && (
          <div className="x-latest">
            <span className="x-flabel">Latest Signal</span>
            <SignalsPop c={c} />
          </div>
        )}
      </div>
    </header>
  );
}

/* ---------- Scout's own video player: every video plays here, never on another site ---------- */
type Playing = { name: string; site: string | null; logo: string | null; media: Media; from?: HTMLElement };
export function Theater() {
  const [p, setP] = useState<Playing | null>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const on = (e: Event) => {
      setP((e as CustomEvent).detail as Playing);
      setPlaying(true);
      setMuted(false);
    };
    document.addEventListener("scout:play", on);
    return () => document.removeEventListener("scout:play", on);
  }, []);
  useEffect(() => {
    if (!p) return;
    closeBtn.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);
  function close() {
    const from = p?.from;
    setP(null);
    from?.focus?.();
  }
  const video = () => stage.current?.querySelector("video");
  const yt = (func: string) => stage.current?.querySelector("iframe")?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
  function togglePlay() {
    const v = video();
    if (v) return void (v.paused ? v.play() : v.pause());
    yt(playing ? "pauseVideo" : "playVideo");
    setPlaying(!playing);
  }
  function toggleSound() {
    const v = video();
    if (v) v.muted = !muted;
    else yt(muted ? "unMute" : "mute");
    setMuted(!muted);
  }
  if (!p) return null;
  const m = p.media;
  return (
    <div className="x-theater" role="dialog" aria-modal="true" aria-label={`${p.name}: video`} onClick={(e) => e.target === e.currentTarget && close()} data-testid="theater">
      <div className="x-thpanel">
        <div className="x-thhead">
          <span className="x-thco">
            {p.logo && <Logo src={p.logo} name={p.name} cls="x-logo sm" />}
            {p.name}
            <span>{(m.play || "Play Video").replace(/^Play /, "")}</span>
          </span>
          <button ref={closeBtn} className="x-thclose" type="button" title="Close (Esc)" onClick={close}>
            <Ico n="x" />
            <span>Close</span>
          </button>
        </div>
        <div className="x-thstage" ref={stage}>
          {m.kind === "mp4" ? (
            <video
              src={m.mp4}
              poster={m.poster}
              autoPlay
              playsInline
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onDoubleClick={(e) => e.currentTarget.requestFullscreen?.()}
            />
          ) : (
            <iframe
              title={p.name}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              src={`https://www.youtube-nocookie.com/embed/${m.yt}?autoplay=1&controls=0&enablejsapi=1&rel=0&modestbranding=1&playsinline=1`}
            />
          )}
        </div>
        <div className="x-thbar">
          <button className="x-thplay" type="button" onClick={togglePlay}>
            <Ico n={playing ? "pause" : "play"} fill />
            <span>{playing ? "Pause" : "Play"}</span>
          </button>
          <button className="x-thsound" type="button" onClick={toggleSound}>
            <Ico n="sound" />
            <span>{muted ? "Unmute" : "Mute"}</span>
          </button>
          <span className="x-thnote">Double-click the video for full screen.</span>
          {p.site && (
            <a className="x-btn site cta x-thsite" href={p.site} target="_blank" rel="noopener noreferrer" title="Opens the company's website in a new window">
              <Ico n="ext" />
              <span>Visit Website</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/** "2 Sources": the extra coverage of one deal, behind one button, instead of the deal twice (IC Meeting). */
export function StorySources({ sources }: { sources: { title: string; url: string }[] }) {
  if (sources.length < 2) return null;
  return (
    <Pop
      btnClass="x-srcbtn"
      title="Every story about this deal"
      label={
        <>
          <Ico n="info" />
          <span>{sources.length} Sources</span>
          <Ico n="down" />
        </>
      }
    >
      {() => (
        <>
          <b>Every Story About This Deal</b>
          <ul>
            {sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" title="Opens the story in a new window">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </Pop>
  );
}
