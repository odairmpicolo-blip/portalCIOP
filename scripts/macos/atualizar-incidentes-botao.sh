#!/bin/bash
# Wrapper para o botão na Mesa (AppleScript chama este arquivo).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTAL_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export CIOP_PORTAL_ROOT="$PORTAL_ROOT"
export CIOP_NODE_BIN="${CIOP_NODE_BIN:-$(command -v node)}"

exec /bin/bash "$PORTAL_ROOT/scripts/executar-atualizacao-incidentes.sh" manual
