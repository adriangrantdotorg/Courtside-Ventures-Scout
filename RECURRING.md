# Recurring issues ledger

One line per defect fixed, so the next session can find the first report.

- 10-14-26 · First pull made junk cards (dev tools as "gaming", a school soccer "seed", tiny Form Ds, Google products) → NOT_CONSUMER / INCUMBENT filters, funding words required for a stage, Form D ≥ $250K, weak keywords count half (`src/lib/thesis.ts`, `src/lib/jobs/collect-signals.ts`); unit tests in `tests/unit/rules.test.ts`.
- 10-14-26 · Culture counted "Future", "Jump" and podcast-host boilerplate as mentions → everyday-word names need a product context; boilerplate sentences skipped (`src/lib/extract.ts`).
- 10-14-26 · Company page 500: a server component called a client-module function → shared labels moved to `src/lib/labels.ts`.
- 10-14-26 · A vote pressed right after load could double-count → the press waits for this browser's own votes (`src/components/cards.tsx`); covered by the two-browser vote test.
- 10-14-26 · Hydration mismatch on dates near midnight (server UTC, browser local) → every date formats in New York time (`src/lib/format.ts`).
- 10-14-26 · The live click test toggled the shared alert switches off → live runs skip switches and data-act controls (`tests/e2e/clicks.spec.ts`); verify:live's residue query catches it.
- 10-14-26 · Nav crowded the search chip at 1024–1560px → tighter nav below 1560/1180px; the nav overlap test runs at 1440 and 1024.
- 10-14-26 · The whole site sat still on a Mac with Reduce Motion on (ticker, live light, sweeps, glows) → the OS switch is ignored; motion is Settings › Appearance › Motion, on by default (`src/app/globals.css`, `SettingsView.tsx`); e2e test under reduced-motion emulation.
- 10-14-26 · Feeds double-encode entities ("You&#8217;ll" on Culture) → `unescapeTwice` in `src/lib/copy.ts`, run by every parser and by `cleanCopy`; unit test.
- 10-14-26 · Why-it-fits lines started with ":" or "," when the description was only the name → empty "what" falls back to "A new <area> company" (`src/lib/score.ts`); unit test.
- 10-14-26 · "Shared ground: focused." named an adjective → adjectives are stop words, 4-letter minimum, "Nearby in the portfolio" fallback (`src/lib/score.ts`).
- 10-14-26 · A period floated after a live clock ("in 5d 9h .") → a live slot ends its line, never followed by punctuation; source-scan unit test.
- 10-14-26 · Weights could not be saved after one slider moved (total left 100) → moving one weight rebalances the other five (`rebalance` in `SettingsView.tsx`); unit and e2e tests.
- 10-14-26 · Pipeline dropdowns wrapped to two lines and offered empty options → search row + one dropdown row; options with zero matches are not offered (`Pipeline.tsx`); e2e test.
- 10-14-26 · verify:live called the team's own clicks "residue" (a status change and a tracked trend from Adrian's review) → residue is now the rows the browser suite ADDS, measured before and after (`scripts/verify-live.ts`).
- 10-14-26 · Unit tests failed in a fresh shell because SITE_URL was not exported (the User-Agent check) → vitest loads `.env.local` itself (`vitest.config.ts`).
- 10-14-26 · Culture quotes started mid-word ("cott Galloway: …") → the cut came in with the launch seed (v4-era mentions); `scripts/fix-quotes.ts` re-extracted 7 from their feed items and removed 20 with no feed item; today's extractor keeps the first letter (unit test). Re-export the seed before v6 so the fixed rows travel.
- 10-14-26 · Deep links landed under the sticky top bar (a few pixels "below" the item) → `[id] { scroll-margin-top }` for every target, a red edge on the landed item; e2e measures the landing.
- 10-14-26 · The ticker froze when the pointer crossed it (a hover pause) → no pause; e2e checks the play state under the pointer.
- 10-14-26 · "Kai Bond" news showed a marine safety officer → people news is searched with the firm's name; the 5 rows removed.
- 10-14-26 · 40 sponsors had no site, so no logo (Claude, DraftKings…) → keyless site lookup with exact-name matching plus a known-brands map; 29 filled; the sponsors job fills new ones.
- 10-14-26 · The home filings table spilled into the next column → compact tables fold Source and Notes under the cells and wrap mono text.
- 10-14-26 · A plain nav click on Pipeline came back with the last search preselected → filters come only from the URL; no saved filters (`Pipeline.tsx`); e2e clicks the nav link and expects an empty search.
- 10-14-26 · On an account that never accepted Neon's terms, the agent-run Vercel CLI prints the terms page and quits instead of asking yes, so the launch would have stopped → launch.sh opens the terms page itself and retries for 5 min; the sign-in step names the create-an-account path; one openurl helper.
