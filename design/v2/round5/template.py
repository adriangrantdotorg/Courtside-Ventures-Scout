"""Brand Sky as a template (Adrian picked Brand Sky 10-30-26 and asked how it always works).

Writes template.html beside this file: the same Must See masthead for three real Scout cards, one per tier of the
fallback ladder. Helios has site art; Axo Longevity has a logo and colors but no art; Chaos has no website at all.
"""
import pathlib
import re

HERE = pathlib.Path(__file__).parent
LIVE = (HERE / "assets/.hero-live.html").read_text()
BASE = LIVE[LIVE.index("<article"):]
BASE = re.sub(r'<div class="x-media"[^>]*>.*?</div>', "{MEDIA}", BASE, count=1, flags=re.S)
BASE = BASE.replace('src="https://heliosinc.ai/apple-icon.png?apple-icon.10h65wtk.19qa.png?dpl=dpl_HarKFHNbs6PAQKR2MMNHP5MUb7Jx"', 'src="assets/helios-icon.png"')
BASE = BASE.replace('src="https://www.google.com/s2/favicons?sz=64&amp;domain=rythmhealth.com"', 'src="assets/rythm.png"')
BASE = BASE.replace('data-live="ago"></span>', 'data-live="ago">3d ago</span>').replace('href="/company/515"', 'href="#"')

WHY_HELIOS = "At-home molecular body test: 1,000+ biomarkers from a drop of blood: consumer health paid out of pocket, like System; in Y Combinator&#x27;s newest batch."


def fit_hue(fit: int) -> int:  # src/lib/v2.ts fitHue
    return max(40, min(140, 40 + (fit - 40) * 5))


def card(c: dict) -> str:
    a = BASE.replace("{MEDIA}", c["media"])
    if c["name"] == "Helios Intelligence":
        return a
    a = a.replace("Helios Intelligence", c["name"]).replace('data-company="515"', f'data-company="{c["id"]}"')
    a = a.replace('<span class="x-area">Health</span>', f'<span class="x-area">{c["area"]}</span>')
    a = re.sub(r'<span class="x-new".*?</span>', "", a, count=1, flags=re.S)
    a = re.sub(r'<span class="x-ov o2".*?</span></span>', "", a, count=1, flags=re.S)
    a = a.replace(WHY_HELIOS, c["why"])
    a = a.replace("<span>Y Combinator</span>", f'<span>{c["src"]}</span>').replace(">3d ago<", f'>{c["ago"]}<')
    a = a.replace('--h:125', f'--h:{fit_hue(c["fit"])}').replace("<b>57<small>", f'<b>{c["fit"]}<small>')
    dash = round(2 * 3.14159 * 42 * c["fit"] / 100, 1)
    a = a.replace('stroke-dasharray="150.4 263.9"', f'stroke-dasharray="{dash} 263.9"')
    a = a.replace(f'<h3 class="x-name">{c["name"]}</h3>', f'<h3 class="x-name">{c["name"]}</h3><div class="x-funds tile"><span class="x-flabel">Funds Raised</span><span class="x-amt" data-testid="funds">{c["funds"]}</span></div>')
    if not c.get("site"):
        a = re.sub(r'<div class="x-tr">.*?</a></div>', '<div class="x-tr"></div>', a, count=1, flags=re.S)
    else:
        a = a.replace("https://heliosinc.ai", f'https://{c["site"]}').replace("heliosinc.ai", c["site"])
    a = re.sub(r'<div class="x-pbar">.*?</div>', "", a, count=1, flags=re.S)  # no video for these two
    return a


HELIOS = """<div class="x-media" data-kind="mp4"><div class="sky art">
  <img class="drift" src="assets/helios-clouds.jpg" alt="">
  <div class="sun" style="--sun:rgba(255,244,214,.55)"></div>
  <img class="lockup" src="assets/helios-lockup-cypress.svg" alt="Helios Intelligence" style="width:28%">
</div></div>"""

AXO = """<div class="x-media" data-kind="logo"><div class="sky made" style="--top:#0b2626;--mid:#14494a;--low:#081b1b;--sun:rgba(212,244,92,.42);--cloud:rgba(232,247,200,.2)">
  <div class="clouds drift"></div>
  <div class="sun"></div>
  <img class="lockup" src="assets/axo-logo-white.png" alt="Axo Longevity" style="width:34%">
</div></div>"""

CHAOS = """<div class="x-media" data-kind="logo"><div class="sky made" style="--top:#170f33;--mid:#2a1b56;--low:#0c081c;--sun:rgba(255,179,71,.40);--cloud:rgba(240,230,255,.18)">
  <div class="clouds drift"></div>
  <div class="sun"></div>
  <div class="lockup word"><span class="tile">C</span><span class="nm">Chaos</span></div>
</div></div>"""

CARDS = [
    {"tier": "1", "title": "Site Art", "name": "Helios Intelligence", "media": HELIOS,
     "uses": [("Backdrop", "the painted sky heliosinc.ai loads first on its homepage"),
              ("Mark", "the green Helios lockup from its site header"),
              ("Colors", "cypress and cream, read from the lockup")]},
    {"tier": "2", "title": "Logo, No Art", "name": "Axo Longevity", "id": 32, "area": "Health", "fit": 51, "funds": "$5.0M",
     "site": "axolongevity.com", "src": "AFP.com", "ago": "Sep 15",
     "why": "A preventive health membership: vertically integrated consumer health like System and Eternal; $5M seed.",
     "media": AXO,
     "uses": [("Backdrop", "a sky Scout paints from Axo&#x27;s colors (its site has no hero art)"),
              ("Mark", "the white Axo Longevity logo from its site header"),
              ("Colors", "deep teal and lime, read from its app icon")]},
    {"tier": "3", "title": "No Website", "name": "Chaos", "id": 309, "area": "Media", "fit": 55, "funds": "$1.3–1.4M",
     "site": None, "src": "Digital Music News", "ago": "8d ago",
     "why": "A music collaboration platform, with Amuse among its backers; raised £1.0M pre-seed.",
     "media": CHAOS,
     "uses": [("Backdrop", "a sky painted in the Media palette"),
              ("Mark", "a wordmark Scout sets from the name: a letter tile plus &quot;Chaos&quot;"),
              ("Colors", "the Media palette: midnight violet with an amber sun")]},
]

CSS = """
body{background:#0b0b0e;margin:0}
.pg{max-width:1500px;margin:0 auto;padding:40px 32px 120px;font:18px/1.55 Montserrat,sans-serif;color:#e8e8ee}
.pg h1{font:600 40px/1.1 Oswald,sans-serif;letter-spacing:.02em;margin:0 0 12px;color:#fff}
.lede{max-width:1050px;margin:0 0 14px;color:#c9c9d3}
.lede b,.tier p b{color:#fff}
table.ladder{border-collapse:collapse;margin:22px 0 8px;font-size:18px}
.ladder th,.ladder td{border:1px solid #2c2c35;padding:10px 16px;text-align:left;vertical-align:top}
.ladder th{font:600 15px/1.2 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#9a9aa8;background:#131318}
.ladder td:first-child{font-weight:600;color:#fff}
.tier{margin:56px 0 0}
.tier-h{display:flex;align-items:center;gap:14px;margin:0 0 6px}
.tier-h .id{display:inline-grid;place-items:center;height:44px;padding:0 14px;border-radius:10px;background:#1b1b22;border:1px solid #33333d;font:700 20px/1 Oswald,sans-serif;color:#fff}
.tier-h h2{font:600 30px/1.1 Oswald,sans-serif;margin:0;color:#fff}
.tier p{margin:3px 0;color:#c9c9d3}
.tier .x-sec{margin-top:18px}

/* Brand Sky: one template, every tier */
.sky{position:absolute;inset:0;overflow:hidden}
.sky:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,8,10,.62) 0,rgba(8,8,10,.35) 38%,transparent 62%)}
.sky .sun{position:absolute;inset:0;background:radial-gradient(45% 70% at 8% 0,var(--sun),transparent 70%)}
.sky .lockup{position:absolute;left:70%;top:30%;transform:translate(-50%,-50%)}
.sky.art{background:#cfd9ea}
.sky.art img.drift{position:absolute;top:0;left:0;height:100%;width:116%;object-fit:cover;object-position:center 62%}
.sky.made{background:linear-gradient(180deg,var(--top) 0%,var(--mid) 58%,var(--low) 100%)}
.sky.made .clouds{position:absolute;top:0;bottom:0;left:0;width:116%;filter:blur(22px);
  background:
   radial-gradient(18% 14% at 12% 72%,var(--cloud),transparent 70%),
   radial-gradient(22% 16% at 34% 80%,var(--cloud),transparent 70%),
   radial-gradient(26% 14% at 58% 70%,var(--cloud),transparent 70%),
   radial-gradient(20% 18% at 80% 82%,var(--cloud),transparent 70%),
   radial-gradient(30% 10% at 46% 58%,var(--cloud),transparent 70%),
   radial-gradient(60% 22% at 50% 100%,var(--cloud),transparent 75%)}
.sky .drift{animation:sky-drift 70s ease-in-out infinite}
@keyframes sky-drift{0%,100%{transform:translateX(0)}50%{transform:translateX(-12%)}}
.sky .word{display:flex;align-items:center;gap:22px}
.sky .word .tile{display:grid;place-items:center;width:104px;height:104px;border-radius:24px;background:linear-gradient(145deg,#ffb347,#ff7a59);color:#170f33;font:700 60px/1 Oswald,sans-serif;box-shadow:0 10px 40px rgba(255,179,71,.25)}
.sky .word .nm{font:700 92px/1 Oswald,sans-serif;letter-spacing:.01em;color:#fff}
@media (prefers-reduced-motion:reduce){.sky .drift{animation:none}}
.frozen *{animation-play-state:paused!important}
"""

FREEZE = """<script>
(function(){var at=parseFloat(new URLSearchParams(location.search).get('at'));if(isNaN(at))return;
document.documentElement.classList.add('frozen');
document.querySelectorAll('.sky .drift').forEach(function(el){el.style.animationDelay=(-at)+'s';});})();
</script>"""

LADDER = [
    ("Backdrop", "Hero art on the homepage, with no words in it", "A sky painted in the startup&#x27;s colors", "A sky painted in its thesis area&#x27;s colors"),
    ("Mark", "The logo in the site header (SVG or large image)", "The app or touch icon, next to the name", "A letter tile and the name, set by Scout"),
    ("Colors", "The site&#x27;s theme color", "The logo&#x27;s two main colors", "The thesis area&#x27;s palette"),
]


def tier(c):
    uses = "".join(f"<p><b>{k}:</b> {v}</p>" for k, v in c["uses"])
    return (f'<div class="tier" id="tier-{c["tier"]}"><div class="tier-h"><span class="id">Tier {c["tier"]}</span>'
            f'<h2>{c["title"]}: {c["name"]}</h2></div>{uses}'
            '<section class="x-sec" aria-label="Must See"><div class="x-sech"><h2 class="x-h2">Must See</h2>'
            '<span class="x-count">The Highest Thesis-Fit Startup Recently in the News</span></div>'
            + card(c) + "</section></div>")


rows = "".join(f"<tr><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>" for r in LADDER)
page = f"""<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Brand Sky Template</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bruno+Ace&family=Oswald:wght@500;600;700&family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,500&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="scout-live.css"><style>{CSS}</style></head><body><div class="pg">
<h1>Brand Sky, for Every Startup</h1>
<p class="lede">One layout every time: a <b>backdrop</b>, the startup&#x27;s <b>mark</b> in the open sky on the right, and a
dark fade on the left so Scout&#x27;s words always read. For each part, Scout takes the first one that exists, so the
masthead never falls back to a gray letter. The three cards below are real Scout startups, one per tier.</p>
<table class="ladder"><tr><th>Part</th><th>First Choice</th><th>Then</th><th>Always Works</th></tr>{rows}</table>
{''.join(tier(c) for c in CARDS)}
</div>{FREEZE}</body></html>"""

assert "Helios" not in card(CARDS[1]) and "Helios" not in card(CARDS[2]), "a Helios leftover on another card"
(HERE / "template.html").write_text(page)
print("wrote", HERE / "template.html")
