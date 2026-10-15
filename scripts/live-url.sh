#!/bin/bash
# Prints the PUBLIC production address of the deploy recorded in <deploy.log>, never the per-deploy one.
# The per-deploy address (project-xxxxxxxxx.vercel.app) sits behind Vercel Authentication: on the third dry run
# (10-14-26) it answered 302 to the login wall, so all 11 live checks failed and the launch saved that address as
# SITE_URL. Order: the JSON "productionUrl" the CLI prints, then its "Aliased" line, then https://<project>.vercel.app.
#   bash scripts/live-url.sh [.logs/deploy.log] [.vercel/project.json]
LOGF="${1:-.logs/deploy.log}"
PJ="${2:-.vercel/project.json}"
U=$(grep -oE '"productionUrl": *"https://[^"]+"' "$LOGF" 2>/dev/null | head -1 | grep -oE 'https://[^"]+')
[ -n "$U" ] || U=$(grep -E 'Aliased' "$LOGF" 2>/dev/null | grep -oE 'https://[a-z0-9.-]+\.vercel\.app' | head -1)
if [ -z "$U" ]; then
  NAME=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).projectName)}catch{console.log("courtside-ventures-scout")}' "$PJ" 2>/dev/null)
  U="https://${NAME:-courtside-ventures-scout}.vercel.app"
fi
printf '%s\n' "$U"
