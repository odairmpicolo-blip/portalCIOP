#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DSQL_CLUSTER_ID="${DSQL_CLUSTER_ID:-ort34httzig7iktrneb4ytcy5u}"
export DSQL_REGION="${DSQL_REGION:-sa-east-1}"
cd "$ROOT"
node "$ROOT/scripts/atualizar-telemetria-json.mjs"
