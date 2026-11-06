#!/bin/bash
# npm run check: typecheck, lint and unit tests, then the build and the browser tests on a LOCAL COPY of the data,
# never the live database. Neon's free plan allows 5 GB of network transfer a month; one browser run on the live
# database read 243 MB, and on 11-06-26 the month was at 85% by the 6th. The copy (about 25 MB to make) is made at most
# once a day per schema, in ~/.courtside-ventures-scout/, and every worktree on this Mac shares it.
# SCOUT_PGLITE=<file> in front uses that copy instead (a copy with a backfill's results, say).
set -u
cd "$(dirname "$0")/.." || exit 1
npm run -s typecheck && npm run -s lint && npx vitest run || exit 1
if [ -z "${SCOUT_PGLITE:-}" ]; then
  DIR="$HOME/.courtside-ventures-scout"
  # one copy per set of migrations: a branch with a new migration gets a copy in its own schema
  KEY=$(cat drizzle/*.sql 2>/dev/null | /usr/bin/shasum | cut -c1-10)
  COPY="$DIR/check-db-$KEY.tar.gz"
  mkdir -p "$DIR"
  if [ ! -s "$COPY" ] || [ -n "$(/usr/bin/find "$COPY" -mmin +1440 2>/dev/null)" ]; then
    printf '▶ Making today'"'"'s local copy of the data (about 25 MB from the database, once a day)\n'
    TMP="$COPY.$$.tmp"
    npx tsx scripts/local-db.ts "$TMP" > /dev/null || { /bin/rm -f "$TMP"; printf '❌ the local copy failed: npx tsx scripts/local-db.ts\n'; exit 1; }
    /bin/mv -f "$TMP" "$COPY"
    /usr/bin/find "$DIR" -name 'check-db-*.tar.gz' -mtime +2 -delete 2>/dev/null
  fi
  export SCOUT_PGLITE="$COPY"
fi
printf '▶ Build and browser tests on the local copy (%s)\n' "$SCOUT_PGLITE"
npx next build && npx playwright test
