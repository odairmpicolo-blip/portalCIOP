#!/usr/bin/env bash
# Exporta incidentes do Aurora DSQL → assets/data/incidentes-tcgl.json
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
if [ ! -d node_modules ]; then npm ci --omit=dev 2>/dev/null || npm ci; fi
npm run export:incidentes-dsql
