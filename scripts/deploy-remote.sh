#!/usr/bin/env bash
# Builds and publishes both the backend and the frontend. Runs ON the server.
#
# Callers (.github/workflows/deploy.yml and server/deploy.sh) are responsible for
# running `git pull` first, so this script is already at the revision being deployed.
set -euo pipefail

PM2_NAME="${PM2_NAME:-construction-dash-backend}"
WEB_ROOT="${WEB_ROOT:-/var/www/construction-dash}"
WEB_USER="${WEB_USER:-www-data}"
BACKEND_PORT="${BACKEND_PORT:-3005}"
HEALTH_PATH="${HEALTH_PATH:-/api/auth/role}"
SETTLE_SECONDS="${SETTLE_SECONDS:-5}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Non-interactive SSH sessions often have no node on PATH.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo ">>> [deploy] npm install (root workspaces)"
npm install

echo ">>> [deploy] Backend: build"
npm run build --workspace=server

echo ">>> [deploy] Backend: pm2 restart $PM2_NAME"
pm2 restart "$PM2_NAME" --update-env

echo ">>> [deploy] Frontend: build"
npm run build --workspace=client

echo ">>> [deploy] Frontend: publish to $WEB_ROOT"
mkdir -p "$WEB_ROOT"
rsync -a --delete client/dist/ "$WEB_ROOT/"
chown -R "$WEB_USER:$WEB_USER" "$WEB_ROOT"

echo ">>> [deploy] Waiting ${SETTLE_SECONDS}s for backend to settle"
sleep "$SETTLE_SECONDS"

echo ">>> [deploy] Health check"
STATUS=$(pm2 jlist | node -e 'const a=JSON.parse(require("fs").readFileSync(0,"utf8")).find(x=>x.name===process.argv[1]);console.log(a?a.pm2_env.status:"missing")' "$PM2_NAME")
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${BACKEND_PORT}${HEALTH_PATH}" || echo "000")
echo "pm2 status: $STATUS | backend HTTP $CODE"
if [ "$STATUS" != "online" ] || [ "$CODE" = "000" ]; then
  echo "ERROR: backend unhealthy (pm2=$STATUS, http=$CODE)"
  pm2 logs "$PM2_NAME" --lines 40 --nostream || true
  exit 1
fi

echo ">>> [deploy] pm2 status"
pm2 ls

echo ">>> [deploy] Done."
