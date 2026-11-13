# Demo signal: how Scout says "this is a demo" (11-12-26)

Courtside's pick: **A2, Solid Tag** (round 2). Sidekick's pick in the same rounds was A1, Outlined Tag
(`~/Development/VC Scout/Sidekick Partners/design/demo-signal/NOTES.md`).

## Picks, in order
1. Round 1 (`A-today.html` … `D-today.html`): Logo Badge, Demo Strip, Edge Glow Frame, Masthead Stamp. Adrian picked A,
   the Logo Badge: *"these are the closest. However, I don't like it because both the demo and the live have a dot."*
2. Round 2 (`A1-today.html` … `A3-today.html`): Outlined Tag, Solid Tag, Raised Tag, all dot-free. He picked A2 for
   Courtside (and A1 for Sidekick), sending the two page links.

## What shipped (in the app)
- `BrandName` in `src/components/Shell.tsx` draws the logo's words and the tag; the header and the Building page both
  use it. The tag: white fill, red Montserrat capitals, "Demo", tooltip "A working demo built by Adrian Grant".
- `src/app/globals.css`: `.brand-stack` / `.demo-tag`. Below 1320px the words hide (`.brand .brand-words`) and the tag
  sits on the logo's foot; never hide `.brand span` (that hid the tag too). Guard: `tests/unit/demo-tag.test.ts`.
- No dot: the ticker's Live label is the only thing in the header with one.

## Files and regenerate
- `build.py` writes both rounds from `assets/today-live.html` (the live Today page as drawn, scripts stripped) and
  `assets/site-0.css` (the live stylesheet, saved beside it). `python3 build.py` rebuilds the pages;
  `python3 build.py --recut` re-captures the live page with `render.mjs` (Playwright, dark like Adrian's Mac).

## Traps met
- Vercel's bot checkpoint answers a headless browser after a few captures in a row: the recut refuses to save it
  (never get past it); the 11-12-26 snapshot was rebuilt from a good capture.
- A page drawn from `file://` lost the live stylesheet mid-session: the CSS is saved beside the pages.
- Live times (`Updated 11h ago`) draw only in the browser, so the capture renders the page first.
