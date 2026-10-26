# Scout V2 design notes

Full-page mockups for the V2 redesign. Regenerate with `python3 design/v2/build.py` (it fails if a label isn't Title Case).

## Files

- `build.py`: the generator. Company data (with the $15M cap), Tile / Tile row / Deal Sheet renderers, the homepage, the Pipeline, the company page (Topdog), and the three option pages with their taste manifests.
- `today.html`, `pipeline.html`, `company.html`, `brief.html` (IC Meeting), `tracking.html`: full pages. The dashed strip above every page moves between them and switches the theme.
- `source/`: snapshots of the live site (10-26-26), including `live-brief.html` and `live-tracking.html`. The header, ticker, masthead, footer and the company page's Notes and Memo sections are cut from these, so the mockups wear the real chrome.
- `v2.css`, `v2.js`: the new parts, layered on the live CSS (classes start with `x-`).
- `test-clicks.js`: presses every control headlessly (`webprobe design/v2/<page>.html design/v2/test-clicks.js`).
- `pf/`: icons of the portfolio companies the samples overlap with. `../v2-cards/`: round 1 and every company image.
- `round2/`, `round3/`, `round4/`: earlier option pages, kept for reference.

## Picks so far

1. Round 1, 10-26-26 (`../scout-v2-cards.html`): **Tile** on Today and the Pipeline, **Deal Sheet** on the company page.
2. Round 2, 10-26-26 (`round2/`): the homepage is **Radar Grid's Must See → Momentum Race's Fit Race → Live Feed's filter → Radar Grid's On the Radar**.
3. Round 3, 10-26-26 (`round3/`): filter **Dropdown Bar**, card hover **Veil**, overlap **Logo Pair**, shown for **real competitors only**.
4. Round 4, 10-26-26 (`round4/`): website icon **Filled or Ghost Globe**, on Today's cards only. His words: "On the pipeline and company pages, it should use the call-to-action buttons to visit the website or find the website."

## Rules from his feedback (10-26-26)

- **Never recommend a company that has raised $15M or more in total.** It applies to everything Scout puts forward as a potential investment (Today, the Pipeline, company pages, the IC Meeting). Sponsor Radar and other context pages are not limited. In the mockups this drops International Dance League ($22M) and POV Beauty ($15M).
- **Funds Raised says "Unknown"** when no amount is known (not "Not Yet Public").
- **One term: "Overlaps with …"**, shown as the Logo Pair (the startup's logo beside the portfolio company's), and **only for real competitors** (`portfolio_check.kind = "competes"`). A loose keyword match ("adjacent") never appears on any page.
- **Thesis fit is the number people look for first**, then Funds Raised. Fit is a ring with the % in the middle, colored from amber (40%) to green (60%+).
- **Secondary buttons share one style sitewide:** Track, More and View Details have the same fill, border and text, and the votes box the same border (only Visit Website is red).
- **Red is the main call to action** (Visit Website), including on the Pipeline. New is a small green chip. Play buttons have their own color (cyan), not the default.
- **Cards on the radar show only** the picture, fit, Visit Website, category, New, overlap, name and the Funds Raised amount. Stage, sources and notes live on the company page. Hovering a card says "Click to View More Details"; the whole card opens the company page.
- **The Combine** (was Fit Race): "(Top 10 Startups by Thesis Fit · Updated Daily)", sorted from highest to lowest fit, with a Funds Raised column. No animation.
- **Must See** is "The Highest-Fit Startup Recently in the News" (his wording, in Title Case). It shows no website button when no official site is known, and no Funds Raised when the amount is unknown.
- **The filter sits under the On the Radar heading** and filters only those cards.
- **Filters keep Funds Raised and Category apart.** A range with no companies is not offered. The Pipeline has one row of menus: Funds Raised, Category, Fit, Signal, Seen, Rating (Category replaced Status; the area chips are gone).
- **Visit Website** carries no URL; with no official site it says **Find Website**. **Labels are Title Case** (same small-word list as `titleCase()` in `src/lib/format.ts`). **No full-screen buttons**; a Play button names what plays.
- **"+N More" on a signal opens the list in place**; it never links out by itself. A long list scrolls inside its popover.
- **IC Meeting:** the Top 5 are Pipeline-style Tile rows (fit and Funds Raised first). **Repeated news is one entry:** stories about the same funder and amount merge, the extra coverage behind a Sources button (this week IDL's Series A appeared twice in Neighborhood Deals). Links in its lists, and "Connect Slack", are neutral, not red.
- **Tracking:** tracked companies are the same Tile rows, with Track shown as Tracking. The other tabs (Trends, People, Alerts, Configure Alerts) keep today's design.

## Live-site behaviors to build (the mockups can't show all of them)

- **Every video plays on Scout, in the on-site player** (dimmed backdrop, the company's name and what is playing, Pause, Mute, Close, Visit Website; Esc or a click outside closes; double-click goes full screen). Nothing opens YouTube or another site.
  - Video files (a company's own MP4 / WebM) play in a `<video>` element.
  - YouTube plays in a `youtube-nocookie.com/embed/<id>?autoplay=1&controls=0&enablejsapi=1&rel=0&playsinline=1` iframe inside the same player; Pause and Mute send `postMessage` commands. In the local mockups YouTube can't play from a `file://` page, so the player shows the poster and a note.
- Every company link opens that company's own page (`/company/<id>`): The Combine's rows, the cards, Similar in the Pipeline. The mockups have one company page (Topdog), so they all open it.
- Links inside components never take the live site's red dotted hover underline (that style is for links in prose). A single signal is a bordered pill like "+N More"; the build fails if a new link class isn't opted out (`/* links: no live underline */` in `v2.css`).
- The $15M cap is a scoring rule, not a display filter: a company whose known total reaches $15M leaves the recommendations (sum the rounds Scout knows about).
- The visual for a card is picked in this order: product video → App Store screenshots → website preview image → logo with Funds Raised. Website preview images show whole, never cropped.

## Traps met

- Guessing a website by name can land on another organization (internationaldanceleague.com is a festival in Rotterdam; IDL is idl.pro). Accept a site only when it mentions a fact from the company's news.
- Duplicates in Scout today: "International Dance League" and "dance league"; "POV Beauty" and "Creator Mikayla Nogueira's Beauty Brand".
- 4 of the 13 overlaps in the samples are loose keyword matches in the data (`portfolio_check.kind = "adjacent"`, e.g. "Both touch convenient"); the mockups show friendlier reasons.
- The live CSS has a `.pill` class (uppercase): new classes must start with `x-`.
- Off-screen WebKit runs no CSS transitions, and `innerText` applies CSS uppercase: tests turn transitions off and read `textContent`.
- `v2.js` sets the option switches LAST: the filter state must exist before the first filter runs.
