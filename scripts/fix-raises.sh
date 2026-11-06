#!/bin/bash
# One-off, the ship's last step after the 11-06-26 deploy: repair the misread raises on the live data (6 currencies, 5
# stages: scripts/fix-raises.ts), rewrite those cards' lines with the score job, then refresh the live pages.
# It cds to its own root, so the Run block can call it from anywhere.
set -u
cd "$(dirname "$0")/.." || exit 1
npx tsx scripts/fix-raises.ts --write || exit 1
npx tsx scripts/pipeline-all.ts score || exit 1
[ -n "${SKIP_REVALIDATE:-}" ] && exit 0
URL=$(grep '^SITE_URL=' .env.local | cut -d= -f2 | tr -d '"')
SECRET=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2- | tr -d '"')
curl -fsS -X POST -H "Authorization: Bearer $SECRET" "$URL/api/revalidate" > /dev/null && printf '✅ Raises repaired and the live pages refreshed: %s\n' "$URL"
