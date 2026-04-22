#!/usr/bin/env bash
# Deploy the backend to the server over SSH.
# Usage: ./deploy.sh
# Optional: DEPLOY_SSH_HOST=other-host ./deploy.sh

set -euo pipefail

SSH_HOST="${DEPLOY_SSH_HOST:-AxonServer}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/root/construction-dash/server}"
PM2_NAME="${DEPLOY_PM2_NAME:-construction-dash-backend}"

echo "==> Deploying to ${SSH_HOST} (${REMOTE_DIR})"
# Remote: use login shell + nvm so `npm` exists (non-interactive SSH often has no node on PATH)
ssh -o BatchMode=yes "${SSH_HOST}" bash -ls <<EOF
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:\$PATH"
if [ -f "\$HOME/.nvm/nvm.sh" ]; then
  . "\$HOME/.nvm/nvm.sh"
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "error: npm not found on the server. Install Node, or ensure nvm/Node is on PATH for non-interactive SSH (try: ssh ${SSH_HOST} 'which npm')." >&2
  exit 1
fi
cd "${REMOTE_DIR}"
git pull
npm install
npm run build
pm2 restart "${PM2_NAME}"
sleep 5
pm2 describe "${PM2_NAME}" | grep "uptime" || true
sleep 2
pm2 describe "${PM2_NAME}" | grep "uptime" || true
echo "Deployment complete"
EOF
echo "==> Local deploy script finished"
