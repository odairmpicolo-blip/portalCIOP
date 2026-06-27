#!/bin/bash
# Agendamento local desativado — produção usa Lambda AWS (4x/dia).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Agendamento local de incidentes não é usado em produção."
echo ""
echo "Atualização automática: Lambda AWS (23h, 05h, 11h, 17h Brasília)."
echo "Deploy/redeploy: bash \"$SCRIPT_DIR/deploy-incidentes-lambda.sh\""
echo ""
echo "Manual de emergência: botão na Mesa ou bash \"$SCRIPT_DIR/executar-atualizacao-incidentes.sh\" manual"
echo ""
exit 1
