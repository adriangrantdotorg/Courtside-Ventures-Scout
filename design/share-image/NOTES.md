# Share image notes

The picture LinkedIn, Slack, iMessage and X show when someone shares Scout's link (og:image).

## Files

- `build.py`: the five options (A to E) as 1200 x 627 pages, rendered 2x with WebKit (`~/.local/bin/webshot`), the
  variations page, and the pick copied to `src/app/opengraph-image.jpg`. Regenerate: `python3 design/share-image/build.py`.
- `today.png`: copied from `docs/today.png` (the README screenshot) on every build; option B shows it.
- `src/app/opengraph-image.jpg` + `opengraph-image.alt.txt`: what Next.js serves. The tags are in `src/app/layout.tsx`
  (`metadataBase`, `openGraph`, `twitter`).

## Picks

1. 10-30-26, round 1 (`variations.html`): **B, Product Shot**, over Red Banner, Center Court, Courtside Ticket and
   Type Poster. His words: "Product Shot - start build."

## Copy of record

- On the picture (10-31-26, his "Picture should match the new language"): AI SCOUT (AI in red), a Prototype tag,
  "Optimized for sourcing startups synergistic with Courtside Ventures.", kicker Sports · Lifestyle · Gaming.
- The title and description live in `content/share-preview.md` (Adrian edits them there). Limits: title 60, description
  125 characters (LinkedIn's message card cut the old 168-character one at 129). A unit test fails past either.

## Look

- Background `#17181c` with a dark red glow behind the screenshot; the screenshot tilted (`rotateY(-16deg)`), red edge
  light `#ff4d7a` / `#cc003d`. SCOUT in Oswald 700, the brand line in Bruno Ace, body Montserrat, kicker Oswald in `#ffbe4c`.

## Traps

- LinkedIn keeps a link's preview for days. After changing the image, re-scrape the URL in Post Inspector
  (https://www.linkedin.com/post-inspector/). That fixes NEW shares only: a post or message already sent keeps its old card.
- When the Today page changes a lot, refresh `docs/today.png` first, then rebuild, so the share image shows today's site.
- `npm run verify:live` checks the image loads, the description fits and X gets the large card.
