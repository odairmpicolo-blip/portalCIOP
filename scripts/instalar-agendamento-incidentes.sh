#!/bin/bash
# Atualização automática de incidentes DESATIVADA (erros recorrentes no Mac).
# Use o botão na Mesa ou: bash scripts/executar-atualizacao-incidentes.sh manual
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/desinstalar-agendamento-incidentes.sh" 2>/dev/null || true

echo "Atualização automática de incidentes está DESATIVADA."
echo ""
echo "Para atualizar manualmente:"
echo "  · Botão na Mesa: Atualizar Incidentes TCGL.app"
echo "  · Terminal: bash \"$SCRIPT_DIR/executar-atualizacao-incidentes.sh\" manual"
echo ""
echo "Log: $HOME/Library/Logs/ciop-portal/atualizar-incidentes.log"
