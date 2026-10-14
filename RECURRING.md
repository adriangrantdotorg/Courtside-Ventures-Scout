# Recurring issues ledger

One line per defect fixed, so the next session can find the first report.

- 10-14-26 · First pull made junk cards (dev tools as "gaming", a school soccer "seed", tiny Form Ds, Google products) → NOT_CONSUMER / INCUMBENT filters, funding words required for a stage, Form D ≥ $250K, weak keywords count half (`src/lib/thesis.ts`, `src/lib/jobs/collect-signals.ts`); unit tests in `tests/unit/rules.test.ts`.
- 10-14-26 · Culture counted "Future", "Jump" and podcast-host boilerplate as mentions → everyday-word names need a product context; boilerplate sentences skipped (`src/lib/extract.ts`).
- 10-14-26 · Company page 500: a server component called a client-module function → shared labels moved to `src/lib/labels.ts`.
- 10-14-26 · A vote pressed right after load could double-count → the press waits for this browser's own votes (`src/components/cards.tsx`); covered by the two-browser vote test.
- 10-14-26 · Hydration mismatch on dates near midnight (server UTC, browser local) → every date formats in New York time (`src/lib/format.ts`).
- 10-14-26 · The live click test toggled the shared alert switches off → live runs skip switches and data-act controls (`tests/e2e/clicks.spec.ts`); verify:live's residue query catches it.
- 10-14-26 · Nav crowded the search chip at 1024–1560px → tighter nav below 1560/1180px; the nav overlap test runs at 1440 and 1024.
