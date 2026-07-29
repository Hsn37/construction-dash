#!/usr/bin/env bash
# Deploy the frontend and backend to the server over SSH.
# Usage: ./deploy.sh
# Optional: DEPLOY_SSH_HOST=other-host ./deploy.sh
#
# Manual equivalent of .github/workflows/deploy.yml — both run scripts/deploy-remote.sh.

set -euo pipefail

SSH_HOST="${DEPLOY_SSH_HOST:-AxonServer}"
APP_DIR="${DEPLOY_APP_DIR:-/root/construction-dash}"

echo "==> Deploying to ${SSH_HOST} (${APP_DIR})"
# Remote: use a login shell so nvm/node is on PATH for non-interactive SSH.
ssh -o BatchMode=yes "${SSH_HOST}" bash -ls <<EOF
set -euo pipefail
cd "${APP_DIR}"
git pull
bash scripts/deploy-remote.sh
EOF
echo "==> Local deploy script finished"
