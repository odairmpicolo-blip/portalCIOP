#!/usr/bin/env bash
# Passo CI: importar snapshots JSON → Aurora DSQL (credenciais AWS no ambiente).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
if [ ! -d node_modules ]; then npm ci --omit=dev 2>/dev/null || npm ci; fi
npm run import:planilha-dsql -- "$@"
