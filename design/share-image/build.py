"""Share image (og:image) for LinkedIn and other link previews, 10-30-26.

LinkedIn draws a link's picture at 1.91:1 (1200 x 627). Each option is a full page at that size, rendered at 2x
with WebKit (~/.local/bin/webshot, never Chrome) to <id>.png beside this file, and variations.html shows every option
full size and at the sizes LinkedIn shows it (a message on a laptop, the feed on a phone).

    python3 design/share-image/build.py
"""
import base64
import html
import json
import os
import pathlib
import re
import shutil
import subprocess
import urllib.request

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent.parent
W, H = 1200, 627
WEBSHOT = os.path.expanduser("~/.local/bin/webshot")
FONTS = ("https://fonts.googleapis.com/css2?family=Bruno+Ace&family=Oswald:wght@500;600;700"
         "&family=Montserrat:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=block")

TITLE = "Courtside Ventures Scout"
KICKER = "Sports · Lifestyle · Gaming"
LINE = "Deal sourcing for Courtside Ventures, every fact linked to its source."
BY = "A prototype by Adrian Grant"
PICK = "B"  # Adrian, 10-31-26: "Product Shot - start build."


def fonts_css():
    """Google Fonts inlined as base64, so WebKit never shoots before a font arrives (cached, gitignored)."""
    cache = HERE / ".fonts.css"
    if cache.exists():
        return cache.read_text()
    ua = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"}
    css = urllib.request.urlopen(urllib.request.Request(FONTS, headers=ua)).read().decode()

    def inline(m):
        data = urllib.request.urlopen(urllib.request.Request(m.group(1), headers=ua)).read()
        return "url(data:font/woff2;base64," + base64.b64encode(data).decode() + ")"

    css = re.sub(r"url\((https://[^)]+)\)", inline, css)
    cache.write_text(css)
    return css


def logo(size, color="#fff"):
    """Scout's mark, the same drawing as Logo() in src/components/Shell.tsx."""
    w = size * 46 / 34
    return (f'<svg viewBox="0 0 46 34" width="{w:.0f}" height="{size}" aria-hidden="true">'
            f'<circle cx="16" cy="17" r="13" fill="none" stroke="{color}" stroke-width="3" stroke-dasharray="65.8 15.9" '
            f'stroke-dashoffset="73.8"/><text x="16" y="21.5" text-anchor="middle" font-family="Oswald" font-weight="700" '
            f'font-size="11.5" fill="{color}">VC</text><rect x="31" y="13" width="9" height="8" fill="{color}"/>'
            f'<rect x="40" y="0" width="2.5" height="34" fill="{color}"/></svg>')


def page(css, body, zoom=2):
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>{fonts_css()}'
            f'*{{box-sizing:border-box;margin:0}}html{{zoom:{zoom}}}html,body{{width:{W}px;height:{H}px;overflow:hidden}}'
            f'body{{position:relative;-webkit-font-smoothing:antialiased;font-family:Montserrat,sans-serif;color:#fff}}'
            f'{css}</style></head><body>{body}</body></html>')


# ---------- A · Red Banner: the README banner, laid out for 1.91:1 ----------
def a():
    css = """
body{background:linear-gradient(100deg,#d40a47 0%,#b8003c 46%,#6e0b2c 74%,#1f1a20 100%)}
.grid{position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.045) 0 1px,transparent 1px 64px)}
.ring{position:absolute;border-radius:50%;border:2px solid rgba(255,255,255,.16)}
.r1{width:620px;height:620px;right:-190px;top:4px}.r2{width:340px;height:340px;right:-50px;top:144px}
.glow{position:absolute;left:-40px;top:120px;width:460px;height:400px;background:radial-gradient(closest-side,rgba(255,255,255,.22),transparent)}
.mark{position:absolute;left:72px;top:206px}
.t{position:absolute;left:370px;top:170px;font:400 58px/1.12 "Bruno Ace";letter-spacing:.01em;text-transform:uppercase}
.k{position:absolute;left:373px;top:342px;font:600 26px/1 Oswald;letter-spacing:.24em;text-transform:uppercase;color:#ffd5df}
.l{position:absolute;left:373px;top:400px;font:500 28px/1.3 Montserrat;color:#fff3f6}
.t,.k,.l{white-space:nowrap}
"""
    body = (f'<div class="grid"></div><div class="ring r1"></div><div class="ring r2"></div><div class="glow"></div>'
            f'<div class="mark">{logo(200)}</div>'
            f'<div class="t">Courtside<br>Ventures Scout</div><div class="k">{KICKER}</div>'
            f'<div class="l">Every fact linked to its source.</div>')
    return page(css, body)


# ---------- B · Product Shot: the real Today page beside the name ----------
def b():
    css = """
body{background:radial-gradient(70% 90% at 78% 40%,#3a0a1f 0%,#17181c 60%,#101114 100%)}
.left{position:absolute;left:64px;top:0;bottom:0;width:440px;display:flex;flex-direction:column;justify-content:center;gap:22px}
.brand{display:flex;align-items:center;gap:16px;font:400 22px/1.15 "Bruno Ace";text-transform:uppercase}
.big{font:700 106px/.9 Oswald;letter-spacing:.01em;text-transform:uppercase;white-space:nowrap}
.tag{align-self:flex-start;margin-top:-6px;padding:7px 12px;border:1.5px solid rgba(255,77,122,.7);border-radius:4px;font:600 17px/1 "IBM Plex Mono";letter-spacing:.16em;text-transform:uppercase;color:#ffb3c6}
.big b{color:#ff4d7a;font-weight:700}
.l{font:500 27px/1.32 Montserrat;color:#e9e3e6}
.k{font:600 21px/1 Oswald;letter-spacing:.2em;text-transform:uppercase;color:#ffbe4c}
.stage{position:absolute;left:540px;top:58px;perspective:1600px}
.shot{width:820px;height:560px;border-radius:14px;overflow:hidden;transform:rotateY(-16deg) rotateX(4deg);transform-origin:left center;
 box-shadow:0 0 0 1.5px rgba(255,77,122,.7),0 0 46px rgba(204,0,61,.55),0 40px 80px rgba(0,0,0,.6)}
.shot img{width:820px;display:block}
"""
    body = (f'<div class="left"><div class="brand">{logo(46)}<span>Courtside<br>Ventures</span></div>'
            f'<div class="big"><b>AI</b> Scout</div><div class="tag">Prototype</div>'
            f'<div class="l">Optimized for sourcing startups synergistic with Courtside&nbsp;Ventures.</div>'
            f'<div class="k">{KICKER}</div></div>'
            f'<div class="stage"><div class="shot"><img src="today.png" alt=""></div></div>')
    return page(css, body)


# ---------- C · Center Court: a full court seen from above (94 x 50 ft is 1.88:1) ----------
def c():
    ft = W / 94  # px per foot across; the court fills the frame
    y0 = (H - 50 * ft) / 2
    def X(f): return f * ft
    def Y(f): return y0 + f * ft
    line = 'stroke="rgba(255,255,255,.5)" stroke-width="3" fill="none"'
    keys = ""
    for side in (0, 1):
        x = 0 if side == 0 else X(94 - 19)
        cx = X(19) if side == 0 else X(94 - 19)
        bx = X(5.25) if side == 0 else X(94 - 5.25)
        sweep = 1 if side == 0 else 0
        keys += (f'<rect x="{x:.1f}" y="{Y(17):.1f}" width="{X(19):.1f}" height="{X(16):.1f}" fill="rgba(204,0,61,.55)" {line}/>'
                 f'<circle cx="{cx:.1f}" cy="{Y(25):.1f}" r="{X(6):.1f}" {line}/>'
                 f'<path d="M{0 if side == 0 else W} {Y(3):.1f} H{X(14) if side == 0 else X(80):.1f} '
                 f'A{X(23.75):.1f} {X(23.75):.1f} 0 0 {sweep} {X(14) if side == 0 else X(80):.1f} {Y(47):.1f} H{0 if side == 0 else W}" {line}/>'
                 f'<circle cx="{bx:.1f}" cy="{Y(25):.1f}" r="{X(.75):.1f}" {line}/>')
    svg = (f'<svg class="court" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
           f'<rect x="1.5" y="{y0 + 1.5:.1f}" width="{W - 3}" height="{50 * ft - 3:.1f}" {line}/>'
           f'<line x1="{W / 2}" y1="{y0:.1f}" x2="{W / 2}" y2="{Y(50):.1f}" {line}/>'
           f'{keys}<circle cx="{W / 2}" cy="{H / 2}" r="{X(6):.1f}" fill="#cc003d" {line}/></svg>')
    css = """
body{background:radial-gradient(60% 80% at 50% 50%,#2a2b31 0%,#18191d 70%,#111215 100%)}
.court{position:absolute;inset:0}
.mark{position:absolute;left:50%;top:50%;transform:translate(-46%,-50%)}
.t{position:absolute;left:0;right:0;text-align:center;font:400 50px/1 "Bruno Ace";text-transform:uppercase;letter-spacing:.02em;text-shadow:0 2px 18px rgba(0,0,0,.9)}
.t span{background:#1e1f23;padding:6px 22px;border-radius:4px}.t1{top:142px}.t2{bottom:150px}
.k span{background:#1b1c20;padding:6px 18px}
.k{position:absolute;left:0;right:0;bottom:62px;text-align:center;font:600 24px/1 Oswald;letter-spacing:.26em;text-transform:uppercase;color:#ffbe4c}
"""
    body = (f'{svg}<div class="mark">{logo(70)}</div>'
            f'<div class="t t1"><span>Courtside Ventures</span></div><div class="t t2"><span>Scout</span></div><div class="k"><span>{KICKER}</span></div>')
    return page(css, body)


# ---------- D · Courtside Ticket: a seat ticket, notches cut out, no border ----------
def d():
    css = """
body{background:radial-gradient(55% 75% at 50% 45%,#3b1022 0%,#16171b 68%,#0f1013 100%)}
.tix{position:absolute;left:70px;top:92px;width:1060px;height:443px;display:flex;transform:rotate(-2deg);
 filter:drop-shadow(0 30px 50px rgba(0,0,0,.65))}
.main,.stub{position:relative;height:100%;-webkit-mask:radial-gradient(circle 26px at 0 50%,transparent 25px,#000 26px) left/100% 100% no-repeat}
.main{flex:1;background:linear-gradient(115deg,#e0104e 0%,#b8003c 55%,#8a002d 100%);border-radius:18px 0 0 18px;padding:46px 56px;
 -webkit-mask:radial-gradient(circle 26px at 0 50%,transparent 25px,#000 26px)}
.stub{width:250px;background:linear-gradient(160deg,#f6f1f3,#dcd2d6);border-radius:0 18px 18px 0;color:#1a1b1f;
 display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
 -webkit-mask:radial-gradient(circle 26px at 100% 50%,transparent 25px,#000 26px)}
.perf{position:absolute;left:0;top:22px;bottom:22px;border-left:4px dotted rgba(26,27,31,.35)}
.k{font:600 22px/1 Oswald;letter-spacing:.28em;text-transform:uppercase;color:#ffd5df}
.t{margin-top:26px;font:400 64px/1.08 "Bruno Ace";text-transform:uppercase}
.fields{position:absolute;left:56px;right:56px;bottom:44px;display:flex;gap:56px}
.f span{display:block;font:600 16px/1 "IBM Plex Mono";letter-spacing:.14em;text-transform:uppercase;color:#ffc2d1}
.f b{display:block;margin-top:8px;font:600 28px/1 Oswald;letter-spacing:.03em;text-transform:uppercase}
.stub .s{font:700 64px/.9 Oswald;letter-spacing:.04em;text-transform:uppercase;writing-mode:vertical-rl;transform:rotate(180deg)}
.stub{flex-direction:row;gap:22px;padding-right:34px}
.stub .ink{display:flex;flex-direction:column;align-items:center;gap:14px}
"""
    body = (f'<div class="tix"><div class="main"><div class="k">{KICKER}</div>'
            f'<div class="t">Courtside<br>Ventures Scout</div>'
            f'<div class="fields"><div class="f"><span>Deal Sourcing</span><b>Courtside Ventures</b></div>'
            f'<div class="f"><span>Updated</span><b>Daily</b></div><div class="f"><span>Built by</span><b>Adrian Grant</b></div></div></div>'
            f'<div class="stub"><div class="perf"></div><div class="ink">{logo(86, "#cc003d")}</div><div class="s">Scout</div></div></div>')
    return page(css, body)


# ---------- E · Type Poster: one face, big size contrast, one color, no icons, no glow ----------
def e():
    css = """
body{background:#0f1013}
.k{position:absolute;left:64px;top:60px;font:600 30px/1 Oswald;letter-spacing:.22em;text-transform:uppercase;color:#ff4d7a}
.big{position:absolute;left:52px;top:96px;font:700 368px/1 Oswald;letter-spacing:-.005em;text-transform:uppercase;color:#fff}
.rule{position:absolute;left:64px;right:64px;bottom:118px;height:6px;background:#cc003d}
.l{position:absolute;left:64px;bottom:58px;font:500 30px/1 Montserrat;color:#e9e3e6}
.by{position:absolute;right:64px;top:60px;font:600 30px/1 Oswald;letter-spacing:.22em;text-transform:uppercase;color:#9a9aa3}
"""
    body = (f'<div class="k">Courtside Ventures</div><div class="big">Scout</div><div class="rule"></div>'
            f'<div class="l">Deal sourcing, every fact linked to its source.</div><div class="by">{KICKER}</div>')
    return page(css, body)


OPTIONS = [
    {"id": "A", "fn": a, "name": "Red Banner", "tag": "On-Profile",
     "desc": "The README banner, laid out for LinkedIn: Scout's red, the court rings, the mark with a soft light behind it, "
             "the name in the brand face. Instantly Courtside.",
     "tokens": {"visual": {"bg": "red-gradient", "accent": ["#cc003d"], "saturation": "high", "ornament": "edge light",
                           "fonts": {"display": "bruno ace", "body": "montserrat"}, "layout": "banner", "energy": "bold"}}},
    {"id": "B", "fn": b, "name": "Product Shot", "tag": "On-Profile",
     "desc": "The real Today page, tilted, with a red edge light, beside a big AI SCOUT. An investor sees what the site is "
             "before clicking. Uses the README screenshot (10-27-26).",
     "tokens": {"visual": {"bg": "dark", "accent": ["#cc003d", "#ffbe4c"], "ornament": "edge light",
                           "fonts": {"display": "oswald", "body": "montserrat"}, "layout": "split + screenshot", "energy": "balanced"}}},
    {"id": "C", "fn": c, "name": "Center Court", "tag": "Stretch: Object",
     "desc": "A full basketball court from above (its 94 x 50 ft is almost exactly LinkedIn's shape), red paint in the "
             "keys, the mark in the center circle, the name across half court.",
     "tokens": {"visual": {"bg": "dark", "accent": ["#cc003d", "#ffbe4c"], "ornament": "motif",
                           "fonts": {"display": "bruno ace"}, "layout": "centered", "energy": "balanced"}}},
    {"id": "D", "fn": d, "name": "Courtside Ticket", "tag": "Stretch: Object",
     "desc": "A courtside seat ticket: the name on the red body, three facts as ticket fields, the mark and SCOUT on a "
             "torn-off stub. Notches are cut out, with no border, as you asked on the Bonus Upload ticket.",
     "tokens": {"visual": {"bg": "dark", "accent": ["#cc003d"], "saturation": "high", "ornament": "object",
                           "fonts": {"display": "bruno ace", "body": "oswald"}, "layout": "object", "energy": "bold"}}},
    {"id": "E", "fn": e, "name": "Type Poster", "tag": "Stretch: Type Only",
     "desc": "Not tried before: one face, huge size contrast, no icons, no glow. A giant SCOUT, one red rule, one line "
             "of what it does.",
     "tokens": {"visual": {"bg": "near-black", "accent": ["#cc003d"], "ornament": "none",
                           "fonts": {"display": "oswald", "body": "montserrat"}, "layout": "type poster", "energy": "bold"}}},
]


def render(src, out):
    if out.exists():
        out.unlink()
    subprocess.run([WEBSHOT, str(src), str(out), str(W * 2), str(H * 2), "--wait", "1.2"], capture_output=True, timeout=90)
    assert out.exists() and out.stat().st_size > 10000, out


def preview_card(png, width, cls):
    """How a shared link reads in LinkedIn: the picture, then the page title and the domain under it."""
    return (f'<div class="li {cls}" style="width:{width}px"><img src="{png}" alt="" width="{width}">'
            f'<div class="li-t"><b>{TITLE}</b><span>courtside-ventures-scout.vercel.app</span></div></div>')


def gallery():
    manifest = {"project": "Courtside Ventures", "subject": "Scout share image (LinkedIn link preview)",
                "surface": "layout", "claude_rec": "B", "compares": ["visual.layout", "visual.ornament", "visual.font"],
                "options": [{"id": o["id"], "name": o["name"], "desc": o["desc"], "tokens": o["tokens"]} for o in OPTIONS]}
    cards = []
    for o in OPTIONS:
        png = f"{o['id'].lower()}.png"
        stretch = "st" if o["tag"].startswith("Stretch") else "on"
        cards.append(f'''<section class="var" data-variation="{o['id']}" id="opt-{o['id']}">
<h2><span class="id">{o['id']}</span>{html.escape(o['name'])}<span class="tag {stretch}">{o['tag']}</span></h2>
<p>{html.escape(o['desc'])}</p>
<img class="full" src="{png}" alt="{html.escape(o['name'])}">
<div class="sizes"><div><h3>In a LinkedIn Message (Laptop)</h3>{preview_card(png, 552, "msg")}</div>
<div><h3>In the Feed (Phone)</h3>{preview_card(png, 343, "phone")}</div></div>
<a class="dl" href="{png}" download="scout-share-{o['id'].lower()}.png">Download PNG</a></section>''')
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Scout Share Image</title><style>{fonts_css()}
:root{{--bg:#131418;--card:#1c1d22;--line:#2c2d34;--text:#f1eef0;--dim:#b9b4b8;--red:#cc003d;--gold:#ffbe4c}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--text);font:400 18px/1.55 Montserrat,sans-serif;padding:40px 16px 80px}}
main{{max-width:1240px;margin:0 auto;display:grid;gap:40px}}
header h1{{font:700 44px/1 Oswald;text-transform:uppercase;letter-spacing:.02em;margin:0 0 10px}}header p{{color:var(--dim);margin:0;max-width:880px}}
.var{{background:var(--card);border:1px solid var(--line);border-radius:4px;padding:24px}}
.var h2{{display:flex;align-items:center;gap:14px;margin:0 0 6px;font:600 28px/1.2 Oswald;text-transform:uppercase;letter-spacing:.03em}}
.id{{display:inline-grid;place-items:center;width:40px;height:40px;border-radius:4px;background:var(--red);font-size:22px}}
.tag{{font:600 13px/1 "IBM Plex Mono";letter-spacing:.1em;text-transform:uppercase;padding:6px 10px;border-radius:4px;border:1px solid}}
.tag.on{{color:#20d760;border-color:#20d76066}}.tag.st{{color:var(--gold);border-color:#ffbe4c66}}
.var p{{color:var(--dim);margin:0 0 18px;max-width:900px}}
.full{{width:100%;height:auto;display:block;border-radius:4px;aspect-ratio:1200/627}}
.sizes{{display:flex;flex-wrap:wrap;gap:32px;margin-top:22px;align-items:flex-start}}
.sizes h3{{font:600 14px/1 "IBM Plex Mono";letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin:0 0 10px}}
.li{{max-width:100%;border:1px solid #3a3b42;border-radius:8px;overflow:hidden;background:#1b1f23}}.li img{{display:block;width:100%;height:auto}}
.li-t{{padding:12px 14px;display:grid;gap:4px}}.li-t b{{font:600 17px/1.3 -apple-system,Helvetica,sans-serif}}.li-t span{{font:400 14px/1.3 -apple-system,Helvetica,sans-serif;color:#b0b7bf}}
.dl{{display:inline-block;margin-top:20px;padding:10px 16px;border:1px solid var(--line);border-radius:4px;color:var(--text);text-decoration:none;font:600 15px/1 Montserrat}}
.dl:hover{{border-color:var(--dim)}}
</style></head><body><main><header><h1>Scout Share Image</h1>
<p>The picture LinkedIn shows when someone shares courtside-ventures-scout.vercel.app. Today there is none, so LinkedIn shows only the title and a cut-off description. Each option is 1200 x 627 (LinkedIn's size), shown full size and at the two sizes people actually see it.</p></header>
{"".join(cards)}</main>
<script type="application/json" id="variation-manifest">{json.dumps(manifest)}</script></body></html>'''


def main():
    shutil.copy2(ROOT / "docs/today.png", HERE / "today.png")
    for o in OPTIONS:
        src = HERE / f"{o['id'].lower()}.html"
        src.write_text(o["fn"]())
        render(src, HERE / f"{o['id'].lower()}.png")
        print("rendered", o["id"], o["name"])
    (HERE / "variations.html").write_text(gallery())
    print("wrote", HERE / "variations.html")
    # The pick ships as a JPEG (2400 x 1254, about 0.4 MB; the PNG is 1.9 MB) where Next.js serves it as og:image.
    out = ROOT / "src/app/opengraph-image.jpg"
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "90", str(HERE / f"{PICK.lower()}.png"),
                    "--out", str(out)], capture_output=True, check=True)
    print("shipped", PICK, "to", out)


if __name__ == "__main__":
    main()
