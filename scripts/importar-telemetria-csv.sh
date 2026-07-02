#!/usr/bin/env bash
# Importa CSV(s) de telemetria direto no DSQL (sem limite do navegador/API).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DSQL_CLUSTER_ID="${DSQL_CLUSTER_ID:-ort34httzig7iktrneb4ytcy5u}"
export DSQL_REGION="${DSQL_REGION:-sa-east-1}"
node "$ROOT/backend/scripts/importar-telemetria-csv.mjs" "${1:?Informe pasta ou arquivo .csv}"
