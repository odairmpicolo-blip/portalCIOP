#!/usr/bin/env bash
# Baixa assets/data/incidentes-tcgl.json do portal-teste (fonte TCGL no GitHub Actions).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${CIOP_INCIDENTES_JSON_REPO:-odairmpicolo-blip/portal-teste}"
BRANCH="${CIOP_INCIDENTES_JSON_BRANCH:-main}"
OUT="$ROOT/assets/data/incidentes-tcgl.json"
URL="https://raw.githubusercontent.com/${REPO}/${BRANCH}/assets/data/incidentes-tcgl.json"
mkdir -p "$(dirname "$OUT")"
curl -fsSL "$URL" -o "$OUT"
node -e "
const fs = require('fs');
const p = process.argv[1];
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const n = j.totalExtraido ?? j.incidentes?.length ?? 0;
if (!n) throw new Error('JSON sem incidentes');
console.log('[sync-json] ' + n + ' incidentes de ${REPO}@${BRANCH}');
" "$OUT"
