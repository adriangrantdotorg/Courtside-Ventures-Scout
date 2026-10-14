"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Search, Sun, Moon, House, ListChecks, TrendingUp, Users2, Menu, FileText } from "lucide-react";
import { UIProvider, useUI, Overlay, Kbd, ClearX } from "./ui";
import { ACTIONS, loadBindings, comboOf, prettyCombo, type Action } from "@/lib/shortcuts";
import { postJSON } from "@/lib/client";

export const NAV: { href: string; label: string }[] = [
  { href: "/", label: "Today" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/brief", label: "IC Meeting" },
  { href: "/trends", label: "Trends" },
  { href: "/sponsors", label: "Sponsor Radar" },
  { href: "/culture", label: "Culture" },
  { href: "/people", label: "People" },
  { href: "/alerts", label: "Alerts" },
  { href: "/backtest", label: "Backtest" },
];
export const MONEY = [
  { href: "/throw-some-ds", label: "Throw Some D's on it" },
  { href: "/neighborhood", label: "Neighborhood" },
  { href: "/synergistic-funders", label: "Synergistic Funders" },
];
export const MORE = [
  { href: "/settings", label: "Settings" },
  { href: "/about", label: "About" },
];
const ALL_PAGES = [...NAV, ...MONEY, ...MORE];

export function Logo() {
  return (
    <svg viewBox="0 0 46 34" aria-hidden="true" width="54" height="40">
      <circle cx="16" cy="17" r="13" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="65.8 15.9" strokeDashoffset="73.8" />
      <text x="16" y="21.5" textAnchor="middle" fontFamily="Oswald,sans-serif" fontWeight="700" fontSize="11.5" fill="#fff">
        VC
      </text>
      <rect x="31" y="13" width="9" height="8" fill="#fff" />
      <rect x="40" y="0" width="2.5" height="34" fill="#fff" />
    </svg>
  );
}

function isOn(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

function Dropdown({ label, items, path }: { label: string; items: { href: string; label: string }[]; path: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  useEffect(() => setOpen(false), [path]);
  const on = items.some((i) => isOn(path, i.href));
  return (
    <div className={"dd" + (on ? " on" : "")} ref={ref}>
      <button aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)} title={`Shows ${items.map((i) => i.label).join(", ")}`}>
        {label} ▾
      </button>
      <div className="menu" hidden={!open}>
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={isOn(path, i.href) ? "on" : ""}>
            {i.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function ThemeChip() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as "dark" | "light") || "dark");
    const obs = new MutationObserver(() => setTheme((document.documentElement.dataset.theme as "dark" | "light") || "dark"));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return (
    <button className="chip red" aria-pressed={theme === "light"} onClick={toggleTheme} title={theme === "dark" ? "Switch to the Day theme (⇧T)" : "Switch to the Night theme (⇧T)"} data-theme-chip>
      {theme === "dark" ? <Sun className="ico" /> : <Moon className="ico" />}
      <span className="kbd">⇧T</span>
    </button>
  );
}

export function toggleTheme() {
  const html = document.documentElement;
  const next = html.dataset.theme === "light" ? "dark" : "light";
  html.dataset.theme = next;
  try {
    localStorage.setItem("scout.theme", next);
  } catch {
    /* private window */
  }
}

function TopBar() {
  const path = usePathname();
  const ui = useUI();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  return (
    <>
      <header className="top">
        <Link href="/" className="brand" title="Courtside Ventures Scout: go to Today">
          <Logo />
          <span>
            COURTSIDE
            <br />
            VENTURES SCOUT
          </span>
        </Link>
        <nav className="nav" aria-label="Pages">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={isOn(path, n.href) ? "on" : ""}>
              {n.label}
            </Link>
          ))}
          <Dropdown label="Money Moves" items={MONEY} path={path} />
        </nav>
        <div className="tools">
          <button className="chip" onClick={ui.openPalette} title="Search companies, pages, trends, people and brands (⌘K)" data-search-chip>
            <Search className="ico" />
            <span className="lbl-long">Search</span>
            <span className="kbd">⌘K</span>
          </button>
          <ThemeChip />
        </div>
      </header>
      <nav className="tabbar" aria-label="Pages on a phone">
        <Link href="/" className={path === "/" ? "on" : ""} title="Today">
          <House className="ico" />
          Today
        </Link>
        <Link href="/pipeline" className={isOn(path, "/pipeline") ? "on" : ""} title="Pipeline">
          <ListChecks className="ico" />
          Pipeline
        </Link>
        <Link href="/trends" className={isOn(path, "/trends") ? "on" : ""} title="Trends">
          <TrendingUp className="ico" />
          Trends
        </Link>
        <Link href="/culture" className={isOn(path, "/culture") ? "on" : ""} title="Culture">
          <Users2 className="ico" />
          Culture
        </Link>
        <button aria-expanded={more} onClick={() => setMore(!more)} title="Shows every other page">
          <Menu className="ico" />
          More
        </button>
      </nav>
      <div className="tabmenu" hidden={!more}>
        {ALL_PAGES.filter((p) => !["/", "/pipeline", "/trends", "/culture"].includes(p.href)).map((p) => (
          <Link key={p.href} href={p.href}>
            {p.label}
          </Link>
        ))}
      </div>
    </>
  );
}

/* ---------- ⌘K palette ---------- */
type Hit = { kind: string; title: string; sub?: string; href: string; img?: string; ext?: boolean; act?: string; id?: number };

function highlight(text: string, q: string): ReactNode {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function Palette({ close }: { close: () => void }) {
  const router = useRouter();
  const ui = useUI();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [sel, setSel] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      const pages: Hit[] = ALL_PAGES.filter((p) => !q || p.label.toLowerCase().includes(q.toLowerCase())).map((p) => ({ kind: "Pages", title: p.label, href: p.href }));
      const actions: Hit[] = [
        { kind: "Pages", title: "Settings › Scoring", sub: "weights, penalties, Worth a Look threshold", href: "/settings?s=scoring" },
        { kind: "Pages", title: "Switch theme", sub: "Night or Day", href: "#theme", act: "theme" },
      ].filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()));
      let remote: Hit[] = [];
      if (q.trim().length >= 1) {
        try {
          const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
          remote = (await r.json()).hits || [];
        } catch {
          /* aborted or offline */
        }
      }
      const companies = remote.filter((h) => h.kind === "Companies");
      const first = companies[0];
      const acts: Hit[] = first
        ? [
            { kind: `Actions on ${first.title}`, title: `Track ${first.title}`, sub: "a daily check and a timeline", href: "#track", act: "track", id: first.id },
            { kind: `Actions on ${first.title}`, title: "Draft Investment Memo", sub: "copy the eight-part outline", href: `${first.href}#memo` },
          ]
        : [];
      const order = ["Companies", `Actions on ${first?.title}`, "Pages", "Trends", "People", "Brands"];
      const all = [...companies, ...acts, ...pages.slice(0, q ? 6 : 12), ...actions, ...remote.filter((h) => h.kind !== "Companies")];
      all.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
      setHits(all);
      setSel(0);
    }, 120);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  async function go(h: Hit, newWin = false) {
    if (h.act === "theme") {
      toggleTheme();
      close();
      return;
    }
    if (h.act === "track" && h.id) {
      close();
      const r = await postJSON("/api/track", { kind: "company", id: h.id, on: true });
      if (r.ok) ui.toast(`${h.title.replace(/^Track /, "")} Tracked`);
      else ui.error("Track didn't save", r.error || "The server did not answer.");
      return;
    }
    close();
    if (newWin || h.ext) window.open(h.href, "_blank", "noopener,noreferrer");
    else router.push(h.href);
  }

  let lastKind = "";
  return (
    <Overlay className="pal" label="Search Scout" onClose={close} onSubmit={() => hits[sel] && go(hits[sel], true)} testid="palette">
      <div className="in">
        <Search className="ico" style={{ width: 18, height: 18 }} />
        <input
          autoFocus
          value={q}
          placeholder="Search companies, pages, trends, people, brands"
          aria-label="Search Scout"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(hits.length - 1, s + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(0, s - 1));
            } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && hits[sel]) {
              e.preventDefault();
              go(hits[sel]);
            }
          }}
        />
        <ClearX show={!!q} onClear={() => setQ("")} />
        <span className="kbd">Esc</span>
      </div>
      <div className="results">
        {hits.map((h, i) => {
          const head = h.kind !== lastKind ? <div className="grp">{h.kind}</div> : null;
          lastKind = h.kind;
          return (
            <div key={h.kind + h.href + h.title + i}>
              {head}
              <a
                className={"pal-it" + (i === sel ? " on" : "")}
                href={h.href}
                onMouseEnter={() => setSel(i)}
                onClick={(e) => {
                  e.preventDefault();
                  go(h, e.metaKey || e.ctrlKey);
                }}
              >
                {h.img ? <img src={h.img} alt="" /> : <FileText className="ico" />}
                <span>
                  {highlight(h.title, q)}
                  {h.sub && <small>{h.sub}</small>}
                </span>
                <span className="kbd">{i === sel ? "↩" : ""}</span>
              </a>
            </div>
          );
        })}
      </div>
      <div className="ft">
        <span>
          <b>↑↓</b> move
        </span>
        <span>
          <b>↩</b> open
        </span>
        <span>
          <b>⌘↩</b> open in a new window
        </span>
        <span>
          <b>Esc</b> close
        </span>
        <span style={{ marginLeft: "auto" }}>{hits.length} results</span>
      </div>
    </Overlay>
  );
}

/* ---------- ? sheet ---------- */
function Sheet({ close }: { close: () => void }) {
  const [b, setB] = useState<Record<string, string[]>>({});
  useEffect(() => setB(loadBindings()), []);
  return (
    <Overlay className="sheet" label="Keyboard shortcuts" onClose={close} testid="sheet">
      <h2>Keyboard Shortcuts</h2>
      <p style={{ margin: 0, color: "var(--text-2)" }}>
        Shortcuts never fire while you type in a field. Change any of them in <Link href="/settings?s=shortcuts" onClick={close}>Settings › Shortcuts</Link>.
      </p>
      <table>
        <tbody>
          {ACTIONS.map((a) => (
            <tr key={a.id}>
              <td>{a.label}</td>
              <td className="mono">{(b[a.id] || a.keys).map(prettyCombo).join(" / ")}</td>
            </tr>
          ))}
          <tr>
            <td>Close or back</td>
            <td className="mono">Esc</td>
          </tr>
        </tbody>
      </table>
      <div className="acts2">
        <button className="btn" onClick={close} title="Close (Esc)">
          Close<Kbd>Esc</Kbd>
        </button>
      </div>
    </Overlay>
  );
}

/* ---------- keyboard ---------- */
function Keys() {
  const ui = useUI();
  const router = useRouter();
  const path = usePathname();
  const idx = useRef(-1);
  const pendingG = useRef(0);
  useEffect(() => {
    idx.current = -1;
  }, [path]);
  useEffect(() => {
    let bindings = loadBindings();
    const onStore = () => (bindings = loadBindings());
    window.addEventListener("scout:bindings", onStore);
    function items(): HTMLElement[] {
      return Array.from(document.querySelectorAll<HTMLElement>("main [data-item]"));
    }
    function focusItem(i: number) {
      const list = items();
      if (!list.length) return;
      idx.current = Math.max(0, Math.min(list.length - 1, i));
      list.forEach((x) => x.classList.remove("focused"));
      const el = list[idx.current];
      el.classList.add("focused");
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    function inItem(sel: string) {
      const list = items();
      const el = list[idx.current] || list[0];
      if (idx.current < 0 && el) focusItem(0);
      return el?.querySelector<HTMLElement>(sel) || null;
    }
    function run(a: Action, e: KeyboardEvent): boolean {
      switch (a) {
        case "next":
          focusItem(idx.current + 1);
          return true;
        case "prev":
          focusItem(idx.current - 1);
          return true;
        case "voteUp":
          inItem("[data-act=up]")?.click();
          return true;
        case "voteDown":
          inItem("[data-act=down]")?.click();
          return true;
        case "open": {
          if (idx.current < 0) return false;
          const a2 = inItem("[data-act=open]") as HTMLAnchorElement | null;
          if (!a2) return false;
          a2.click();
          return true;
        }
        case "openSource":
          inItem(".evi a, [data-act=source]")?.click();
          return true;
        case "track":
          inItem("[data-act=track]")?.click();
          return true;
        case "memo":
          inItem("[data-act=memo]")?.click();
          return true;
        case "email":
          inItem("[data-act=email]")?.click();
          return true;
        case "crm":
          inItem("[data-act=crm]")?.click();
          return true;
        case "note":
          inItem("[data-act=note]")?.click();
          return true;
        case "alert":
          router.push("/alerts#new");
          return true;
        case "search": {
          const s = document.querySelector<HTMLInputElement>("main [data-search]");
          if (s) s.focus();
          else ui.openPalette();
          return true;
        }
        case "refresh": {
          const b = document.querySelector<HTMLButtonElement>("[data-act=refresh]");
          if (b && !b.disabled) b.click();
          else if (!b) router.push("/");
          return true;
        }
        case "palette":
          ui.openPalette();
          return true;
        case "goToday":
          router.push("/");
          return true;
        case "goPipeline":
          router.push("/pipeline");
          return true;
        case "goTrends":
          router.push("/trends");
          return true;
        case "goCulture":
          router.push("/culture");
          return true;
        case "goAlerts":
          router.push("/alerts");
          return true;
        case "goBrief":
          router.push("/brief");
          return true;
        case "goSettings":
          router.push("/settings");
          return true;
        case "theme":
          toggleTheme();
          return true;
        case "undo":
          ui.undo();
          return true;
        case "sheet":
          ui.openSheet();
          return true;
      }
      void e;
      return false;
    }
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (document.getElementById("app-root")?.hasAttribute("inert")) return;
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      const combo = comboOf(e);
      if (typing) return; // shortcuts never fire while typing (⌘Z there is the field's own undo)
      if (["shift", "meta", "control", "alt"].includes(e.key.toLowerCase())) return;
      if (combo === "escape") {
        document.querySelectorAll(".focused").forEach((x) => x.classList.remove("focused"));
        idx.current = -1;
        return;
      }
      const now = Date.now();
      let key = combo;
      if (pendingG.current && now - pendingG.current < 1200 && !e.metaKey && !e.ctrlKey) {
        key = "g " + combo;
        pendingG.current = 0;
      } else if (combo === "g") {
        pendingG.current = now;
        return;
      }
      for (const a of ACTIONS) {
        if ((bindings[a.id] || []).includes(key)) {
          if (run(a.id, e)) {
            e.preventDefault();
          }
          return;
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scout:bindings", onStore);
    };
  }, [router, ui]);
  return null;
}

/* phone: swipe a card right for ▲, left for ▼ */
function Swipe() {
  useEffect(() => {
    let sx = 0,
      sy = 0,
      el: HTMLElement | null = null;
    const start = (e: TouchEvent) => {
      el = (e.target as HTMLElement).closest("[data-item]");
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    };
    const end = (e: TouchEvent) => {
      if (!el) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 80 && Math.abs(dy) < 40) el.querySelector<HTMLElement>(dx > 0 ? "[data-act=up]" : "[data-act=down]")?.click();
      el = null;
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchend", end);
    };
  }, []);
  return null;
}

export function Shell({ children, ticker }: { children: ReactNode; ticker: ReactNode }) {
  return (
    <UIProvider palette={(c) => <Palette close={c} />} sheet={(c) => <Sheet close={c} />} >
      <div className="app">
        <TopBar />
        {ticker}
        <main id="main">{children}</main>
        <Footer />
      </div>
      <Keys />
      <Swipe />
    </UIProvider>
  );
}

function Footer() {
  const ui = useUI();
  return (
    <footer className="foot">
      <span>
        Built by{" "}
        <a href="https://www.linkedin.com/in/adriangrant3/" target="_blank" rel="noopener noreferrer" title="Opens Adrian Grant on LinkedIn in a new window">
          Adrian Grant
        </a>
      </span>
      <button className="linkish" onClick={() => ui.door("team")} title="What Phase II adds, built together">
        Phase II
      </button>
      <button className="linkish" onClick={ui.openSheet} title="Show every keyboard shortcut (?)">
        Shortcuts
      </button>
      <span className="sp" style={{ display: "flex", gap: 22 }}>
        {MORE.map((m) => (
          <Link key={m.href} href={m.href} title={`Open ${m.label}`}>
            {m.label}
          </Link>
        ))}
      </span>
    </footer>
  );
}
