#!/bin/bash
# Cron EC2: sync incidentes TCGL → DSQL (sem git).
set -euo pipefail
LOG=/var/log/portal-incidentes-sync.log
ENV_FILE=/etc/portal-ciop/incidentes.env

exec >>"$LOG" 2>&1
echo "=== $(date -Is) sync incidentes ==="

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export SYNC_INCIDENTES_SKIP_GIT=1
cd "${PORTAL_ROOT:-/opt/portal-ciop/portal-teste}"
git pull origin "${BRANCH:-main}" --quiet || true

node scripts/sync-incidentes-completo.mjs
echo "=== OK $(date -Is) ==="
