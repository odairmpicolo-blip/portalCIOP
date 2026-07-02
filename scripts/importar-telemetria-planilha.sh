#!/usr/bin/env bash
# Importa abas Clever e TCGL da planilha Google → assets/data/telemetria/dados.json
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/importar-telemetria-planilha-google.mjs "$@"
