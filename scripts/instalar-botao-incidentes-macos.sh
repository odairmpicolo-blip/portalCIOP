#!/bin/bash
# Cria ícone na Mesa para atualizar incidentes TCGL (JSON + DSQL + git).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTAL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNNER="$SCRIPT_DIR/executar-atualizacao-incidentes.sh"
WRAPPER="$SCRIPT_DIR/macos/atualizar-incidentes-botao.sh"
APP_NAME="Atualizar Incidentes TCGL"
DESKTOP_APP="$HOME/Desktop/${APP_NAME}.app"
STATE_DIR="${HOME}/.config/ciop-portal"
ENV_FILE="$STATE_DIR/incidentes.env"
BACKEND_ENV="$PORTAL_ROOT/backend/.env"
NODE_BIN="$(command -v node || true)"

chmod +x "$RUNNER" "$WRAPPER"

mkdir -p "$STATE_DIR" "$HOME/Library/Logs/ciop-portal"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$SCRIPT_DIR/incidentes.env.example" "$ENV_FILE"
  echo "Credenciais criadas em $ENV_FILE — edite usuário/senha TCGL antes do primeiro uso."
fi

if [[ ! -f "$BACKEND_ENV" ]]; then
      cat > "$BACKEND_ENV" <<EOF
DSQL_CLUSTER_ID=${DSQL_CLUSTER_ID:-SEU_CLUSTER_ID_AQUI}
DSQL_REGION=sa-east-1
DSQL_USER=admin
EOF
  echo "backend/.env criado com DSQL_CLUSTER_ID (credenciais AWS via aws login ou ~/.aws)."
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "ERRO: Node.js não encontrado. Instale Node 20+ (brew install node)."
  exit 1
fi

APPLESCRIPT="$(mktemp -t ciop-incidentes-botao).applescript"
cat > "$APPLESCRIPT" <<APPLESCRIPT
on run
  set wrapper to "$WRAPPER"
  try
    do shell script quoted form of wrapper
    display dialog "Incidentes TCGL atualizados!" & return & return & "Dados baixados do TCGL e gravados no JSON local." & return & "Se DSQL ou Git falharem, veja o log (etapas opcionais)." buttons {"OK"} default button "OK"
  on error errMsg number errNum
    display dialog "Falha na atualizacao de incidentes." & return & return & errMsg & return & return & "Log: Library/Logs/ciop-portal/atualizar-incidentes.log" buttons {"OK"} default button "OK" with icon caution
  end try
end run
APPLESCRIPT

rm -rf "$DESKTOP_APP"
osacompile -o "$DESKTOP_APP" "$APPLESCRIPT"
rm -f "$APPLESCRIPT"

echo ""
echo "Botão instalado na Mesa:"
echo "  $DESKTOP_APP"
echo ""
echo "Duplo clique para atualizar incidentes no TCGL e gravar no banco (pode levar alguns minutos)."
echo "Log: $HOME/Library/Logs/ciop-portal/atualizar-incidentes.log"
echo ""
echo "Credenciais TCGL: $ENV_FILE"
echo "DSQL: $BACKEND_ENV + aws login (ou ~/.aws/credentials)"
