"""Demo signal round (11-12-26): four ways to say "this is a demo" above the fold on the Today page.

Each option is the BARE live homepage with one change (taste-profile: a part of a site page is shown on the real page,
one page per option). The page is the live Today page cut 11-12-26 as the browser draws it (assets/today-live.html,
scripts stripped) with the live stylesheets saved beside it (assets/site-*.css), so only the demo signal differs.

The same file runs in both repos; the folder it sits in picks the site:
  Courtside: design/demo-signal/build.py                   -> A-today.html … D-today.html
  Sidekick:  Sidekick Partners/design/demo-signal/build.py -> A-today.html … D-today.html
Re-cut the live page:  python3 build.py --recut
"""
import html
import json
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
SIDEKICK = "VC Scout" in str(HERE)

SITE = {
    "url": "https://sidekick.adriangrant.org/" if SIDEKICK else "https://courtside-ventures-scout.vercel.app/",
    "firm": "Sidekick Partners" if SIDEKICK else "Courtside Ventures",
    "project": "VC Scout (Sidekick)" if SIDEKICK else "Courtside Ventures Scout",
}
LINE = f"An independent demo by Adrian Grant. Not affiliated with or endorsed by {SITE['firm']}."
SNAP = HERE / "assets" / "today-live.html"


def recut():
    """The live page as the browser draws it (live times filled in), dark like Adrian's Mac, then scripts stripped."""
    pw = pathlib.Path("/Users/adriangrant/Development/VC Scout/Engine") if SIDEKICK else \
        pathlib.Path("/Users/adriangrant/Development/Courtside Ventures - Scout")
    s = subprocess.run(["node", str(HERE / "render.mjs"), SITE["url"]], cwd=pw, capture_output=True, text=True,
                       check=True, timeout=120).stdout
    if "Security Checkpoint" in s or len(s) < 30000:
        raise SystemExit("❌ Vercel's bot checkpoint answered, not the page: kept the saved snapshot (never get past it).")
    s = re.sub(r"<script\b.*?</script>", "", s, flags=re.S)
    s = re.sub(r'<link[^>]+rel="(?:preload|modulepreload)"[^>]+as="script"[^>]*/?>', "", s)
    SNAP.parent.mkdir(parents=True, exist_ok=True)
    SNAP.write_text(localize(s))
    print("cut", SNAP, SNAP.stat().st_size)


def localize(s):
    """Live stylesheets saved beside the pages; every other root-relative address points at the live site."""
    # the live stylesheets, saved beside the pages: a page drawn from file:// lost them mid-session (11-12-26)
    root = SITE["url"].rstrip("/")
    for n, href in enumerate(dict.fromkeys(re.findall(r'href="(/_next/static/[^"]+\.css)"', s))):
        css = subprocess.run(["curl", "-sf", root + href], capture_output=True, text=True, check=True).stdout
        css = re.sub(r"url\((['\"]?)/", lambda m: f"url({m.group(1)}{root}/", css)
        assert "Security Checkpoint" not in css and "{" in css, f"{href}: not a stylesheet"
        (SNAP.parent / f"site-{n}.css").write_text(css)
        s = s.replace(f'href="{href}"', f'href="assets/site-{n}.css"')
    # every other root-relative address points at the live site
    s = re.sub(r'(src|href|srcSet|srcset|poster)="/(?!/)', lambda m: f'{m.group(1)}="{root}/', s)
    s = re.sub(r'(srcSet|srcset)="([^"]*)"', lambda m: m.group(1) + '="' + re.sub(r"(^|, )/(?!/)", lambda k: k.group(1) + root + "/", m.group(2)) + '"', s)
    return s


# ---- the four options -------------------------------------------------------------------------------------------
# Courtside: Oswald caps, red is the call to action only, so the demo signal wears --gold.
# Sidekick: Cormorant small caps on emerald and cream; its brass buttons are calls to action, so chips stay outlined.
DISPLAY = "'Cormorant Garamond',serif" if SIDEKICK else "Oswald,sans-serif"
BODY = "'Source Sans 3',sans-serif" if SIDEKICK else "Montserrat,sans-serif"
CAPS = "font-variant:small-caps;letter-spacing:.06em;text-transform:lowercase" if SIDEKICK else \
       "text-transform:uppercase;letter-spacing:.12em"

CSS_COMMON = f"""
:root{{--dm:{"#e2c27d" if SIDEKICK else "var(--gold)"}}}
html[data-theme="light"]{{--dm:{"#7a5512" if SIDEKICK else "var(--gold)"}}}
.dm-chip{{display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--dm);color:var(--dm);
  font:700 12px/1 {BODY};{CAPS};padding:5px 9px 5px 8px;border-radius:4px;white-space:nowrap}}
.dm-chip i{{width:7px;height:7px;border-radius:50%;background:var(--dm);box-shadow:0 0 8px var(--dm)}}
"""

A_CSS = """
.brand .dm-stack{display:flex;flex-direction:column;align-items:flex-start;gap:5px}
.brand .dm-chip{background:rgba(0,0,0,.3);border-color:#fff;color:#fff;font-size:11px;padding:3px 7px 3px 6px}
.brand .dm-chip i{background:#fff;box-shadow:0 0 8px #fff;width:6px;height:6px}
/* at 1320px and below the site hides the wordmark (.brand span): the chip stays, pinned over the logo's foot */
@media (max-width:1320px){.brand{position:relative}
  .brand .dm-stack{display:flex;position:absolute;left:50%;bottom:3px;transform:translateX(-50%)}
  .brand .dm-chip{display:inline-flex;font-size:9px;padding:2px 5px 2px 4px;gap:4px}}
""" if not SIDEKICK else """
.brand-lock{align-items:center}
.brand-lock .dm-chip{margin-left:14px;align-self:center;font-size:16px;padding:5px 11px 6px 9px}
/* at 1320px and below the site hides the wordmark (.brand span): the chip stays beside the logo, smaller */
@media (max-width:1320px){.brand .dm-chip{display:inline-flex;font-size:13px;margin-left:10px;padding:4px 8px 5px 7px}}
/* on a phone the header has no room to spare: the chip takes none, tucked under the logo */
@media (max-width:700px){.brand{position:relative}
  .brand .dm-chip{position:absolute;left:50%;bottom:2px;transform:translateX(-50%);margin:0;font-size:10px;
    padding:2px 6px 3px 5px;gap:4px;background:var(--bg-2)}
  .brand .dm-chip i{width:5px;height:5px}}
"""

B_CSS = f"""
.dm-strip{{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:10px 32px;
  background:linear-gradient(90deg,color-mix(in srgb,var(--dm) 22%,transparent),color-mix(in srgb,var(--dm) 6%,transparent) 70%);
  border-bottom:1px solid color-mix(in srgb,var(--dm) 45%,transparent);color:var(--text);font:500 15px/1.4 {BODY}}}
.dm-strip p{{margin:0;flex:1 1 380px;min-width:0}}
.dm-strip .dm-chip{{font-size:{"15px" if SIDEKICK else "12px"}}}
.dm-strip a.dm-more{{display:inline-flex;align-items:center;gap:6px;color:var(--dm);font:700 14px/1 {BODY};
  text-decoration:none;white-space:nowrap}}
.dm-strip a.dm-more:hover{{text-decoration:none;filter:brightness(1.15)}}
@media (max-width:700px){{.dm-strip{{padding:10px 16px;gap:10px}}}}
"""

C_CSS = f"""
.dm-rim{{position:fixed;inset:0;pointer-events:none;z-index:60;border:2px solid color-mix(in srgb,var(--dm) 70%,transparent);
  box-shadow:inset 0 0 28px color-mix(in srgb,var(--dm) 35%,transparent);animation:dm-breathe 8s ease-in-out infinite}}
@keyframes dm-breathe{{0%,100%{{box-shadow:inset 0 0 18px color-mix(in srgb,var(--dm) 22%,transparent)}}
  50%{{box-shadow:inset 0 0 40px color-mix(in srgb,var(--dm) 45%,transparent)}}}}
.dm-tab{{position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:61;display:flex;align-items:center;gap:10px;
  padding:9px 18px 10px;border-radius:8px 8px 0 0;background:var(--bg-2);border:2px solid color-mix(in srgb,var(--dm) 70%,transparent);
  border-bottom:0;color:var(--text);font:500 15px/1.2 {BODY};white-space:nowrap;box-shadow:0 -6px 24px rgba(0,0,0,.35)}}
.dm-tab b{{color:var(--dm);font:700 15px/1 {DISPLAY};{CAPS}}}
html[data-motion="off"] .dm-rim{{animation:none}}
@media (max-width:700px){{.dm-tab{{bottom:64px;font-size:13px;padding:7px 12px 8px}}.dm-tab span{{display:none}}}}
"""

D_CSS = f"""
.dm-stamp{{display:inline-flex;flex-direction:column;align-items:center;gap:3px;transform:rotate(-7deg);margin:0 6px 0 -6px;
  padding:6px 12px 7px;border:3px double var(--dm);border-radius:6px;color:var(--dm);line-height:1}}
.dm-stamp b{{font:700 30px/0.9 {DISPLAY};{CAPS}}}
.dm-stamp span{{font:600 11px/1 {BODY};letter-spacing:.08em;text-transform:uppercase}}
"""

OPTIONS = [
    {"id": "A", "name": "Logo Badge", "tag": "On-Profile: Calm, Part of the Brand",
     "desc": "A Demo chip sits inside the logo lockup, so the name itself reads as a demo on every page.",
     "css": A_CSS, "tokens": {"visual": {"energy": "calm", "ornament": "badge", "layout": "inline"},
                              "ux": {"attention_cue": "badge", "detail": "terse"}}},
    {"id": "B", "name": "Demo Strip", "tag": "Clearest: Says Who Built It",
     "desc": "A full-width band under the top bar, with the disclaimer in plain words and a link to About.",
     "css": B_CSS, "tokens": {"visual": {"energy": "calm", "ornament": "band", "layout": "full-width-band"},
                              "ux": {"attention_cue": "banner", "detail": "full-sentence"}}},
    {"id": "C", "name": "Edge Glow Frame", "tag": "On-Profile: Edge Light, Always on Screen",
     "desc": "A gold rim lines the whole window and a Demo tab sits at the bottom edge; both stay put as the page "
             "scrolls. Motion: the rim's glow breathes once every 8 s, ambient, loops.",
     "css": C_CSS, "tokens": {"visual": {"energy": "calm", "ornament": "edge light", "layout": "frame"},
                              "motion": [{"element": "rim", "kind": "breathe", "period_s": 8, "reactivity": "ambient",
                                          "trigger": "always", "pace": "slow", "text_moves": False, "path": "edge"}],
                              "ux": {"attention_cue": "frame", "detail": "terse"}}},
    {"id": "D", "name": "Masthead Stamp", "tag": "Stretch: Tilted Stamp Ornament",
     "desc": "A double-ruled Demo stamp, tilted like a rubber stamp, beside the big Scout title.",
     "css": D_CSS, "tokens": {"visual": {"energy": "bold", "ornament": "stamp", "layout": "inline"},
                              "ux": {"attention_cue": "stamp", "detail": "terse"}}},
]

# ---- round 2 (11-12-26): he picked A, the Logo Badge, "but both the demo and the live have a dot" ----------------
# Three dot-free takes on the same badge, in the same place; the narrow and phone rules of A_CSS still apply.
R2_CSS = {
    "A1": "",
    "A2": (".brand .dm-chip.dm-solid{background:#fff;color:var(--red);border-color:#fff}" if not SIDEKICK else
           ".brand .dm-chip.dm-solid{background:var(--dm);color:#14211d;border-color:var(--dm)}"),
    "A3": (""".brand .dm-stack.dm-row{flex-direction:row;align-items:flex-start;gap:9px}
.brand .dm-chip.dm-sup{background:none;border:0;border-left:1.5px solid #fff;border-radius:0;padding:1px 0 1px 8px;
  font-size:11px;letter-spacing:.2em;margin-top:1px}
@media (max-width:1320px){.brand .dm-chip.dm-sup{border-left:0;padding:1px 4px;background:var(--red)}}""" if not SIDEKICK else
           """.brand-lock .dm-chip.dm-sup{background:none;border:0;border-radius:0;padding:0;align-self:flex-start;
  margin:3px 0 0 10px;font-size:17px;letter-spacing:.1em}
@media (max-width:700px){.brand .dm-chip.dm-sup{background:var(--bg-2);padding:1px 6px 2px;margin:0}}"""),
}
ROUND2 = [
    {"id": "A1", "name": "Outlined Tag", "tag": "Closest: A Without the Dot",
     "desc": "The same outlined Demo tag beside the wordmark, with the dot taken out, so only Live keeps a dot.",
     "chip": '<span class="dm-chip">Demo</span>',
     "tokens": {"visual": {"energy": "calm", "ornament": "outlined tag", "layout": "inline"}, "ux": {"attention_cue": "badge"}}},
    {"id": "A2", "name": "Solid Tag", "tag": "Louder: Filled Like a Label",
     "desc": "A filled Demo tag in the site's light color, so it reads as a label at a glance, not a button.",
     "chip": '<span class="dm-chip dm-solid">Demo</span>',
     "tokens": {"visual": {"energy": "balanced", "ornament": "solid tag", "layout": "inline"}, "ux": {"attention_cue": "badge"}}},
    {"id": "A3", "name": "Raised Tag", "tag": "Stretch: No Box, Part of the Name",
     "desc": "No box at all: Demo sits raised against the wordmark, like a trademark, so it reads as part of the name.",
     "chip": '<span class="dm-chip dm-sup">Demo</span>',
     "tokens": {"visual": {"energy": "calm", "ornament": "superscript", "layout": "inline"}, "ux": {"attention_cue": "label"}}},
]
for _o in ROUND2:
    _o["css"] = A_CSS + R2_CSS[_o["id"]]

ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' \
        'aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
CHIP = '<span class="dm-chip" title="{t}"><i></i>Demo</span>'.format(t=html.escape(LINE))


def apply(s, opt):
    oid = opt["id"]
    if oid.startswith("A"):
        chip = opt.get("chip", CHIP)
        if SIDEKICK:
            a = '<span class="brand-word">AI SCOUT</span></div>'
            assert s.count(a) == 1
            s = s.replace(a, '<span class="brand-word">AI SCOUT</span>' + chip + "</div>")
        else:
            m = re.search(r"<span>COURTSIDE<br/?>VENTURES SCOUT</span></a>", s)
            assert m and len(re.findall(r"<span>COURTSIDE<br/?>VENTURES SCOUT</span>", s)) == 1
            row = " dm-row" if oid == "A3" else ""
            s = s[:m.start()] + f'<span class="dm-stack{row}"><span>COURTSIDE<br>VENTURES SCOUT</span>' + chip + "</span></a>" + s[m.end():]
    elif oid == "B":
        a = '<div class="ticker"'
        assert s.count(a) == 1
        strip = (f'<div class="dm-strip" role="note"><span class="dm-chip"><i></i>Demo Site</span>'
                 f"<p>{html.escape(LINE)} The startups, filings and news are real and public.</p>"
                 f'<a class="dm-more" href="/about">About This Demo {ARROW}</a></div>')
        s = s.replace(a, strip + a)
    elif oid == "C":
        s = s.replace("</body>", '<div class="dm-rim" aria-hidden="true"></div><div class="dm-tab" role="note">'
                                 f'<b>Demo</b><span>Independent Demo by Adrian Grant</span></div></body>')
    elif oid == "D":
        a = '<span class="big">Scout</span>'
        assert s.count(a) == 1
        s = s.replace(a, a + f'<span class="dm-stamp" role="note" title="{html.escape(LINE)}"><b>Demo</b>'
                             "<span>Independent Demo</span></span>")
    return s


def manifest(options, subject, rec, compares):
    return {"project": SITE["project"], "subject": subject, "surface": "page", "claude_rec": rec, "compares": compares,
            "options": [{"id": o["id"], "name": o["name"], "desc": o["desc"], "tokens": o["tokens"]} for o in options]}


ROUNDS = [
    (OPTIONS, "Demo signal above the fold (Today page)", "B", ["visual.ornament", "ux.attention_cue", "visual.layout"]),
    (ROUND2, "Demo badge in the logo, no dot (round 2)", "A1", ["visual.ornament"]),
]


def build():
    for options, subject, rec, compares in ROUNDS:
        build_round(options, manifest(options, subject, rec, compares))


def build_round(options, man):
    base = SNAP.read_text()
    assert "<head>" in base and "</body>" in base
    for i, opt in enumerate(options):
        s = apply(base, opt)
        s = re.sub(r"<title>[^<]*</title>", "", s)
        head = f'<head><title>{opt["id"]} · {opt["name"]} · Demo Signal</title>'
        style = f"<style>{CSS_COMMON}{opt['css']}</style>"
        s = s.replace("<head>", head, 1).replace("</head>", style + "</head>", 1)
        s = re.sub(r"<body([^>]*)>", lambda m: f'<body{m.group(1)} data-variation="{opt["id"]}">', s, count=1)
        if i == 0:
            mj = json.dumps(man)
            assert json.loads(mj)
            s = s.replace("</body>", f'<script type="application/json" id="variation-manifest">{mj}</script></body>')
        assert not re.search(r"<script(?![^>]*application/json)", s), "a live script survived"
        # nothing added above the site's own header (taste-profile: bare pages)
        body = s[s.find("<body"):s.find('<header class="top">')]
        assert "dm-" not in body, f"{opt['id']}: something sits above the header"
        out = HERE / f"{opt['id']}-today.html"
        out.write_text(s)
        print("wrote", out.name)


if __name__ == "__main__":
    if "--recut" in sys.argv or not SNAP.exists():
        recut()
    build()
