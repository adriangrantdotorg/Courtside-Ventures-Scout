#!/bin/bash
# Rebuild and restart the local production server on port 4601 (kill by PID only).
cd "$(dirname "$0")/.." || exit 1
npx next build > .logs/build-local.log 2>&1 || { tail -30 .logs/build-local.log; exit 1; }
for pid in $(lsof -ti tcp:4601 2>/dev/null); do kill "$pid"; done
sleep 1
nohup npx next start -p 4601 > .logs/server.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:4601/api/build-progress && break; sleep 1; done
echo "local server ready"
