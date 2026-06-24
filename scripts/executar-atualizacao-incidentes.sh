#!/bin/bash
# Atualiza incidentes TCGL e publica no GitHub.
# Ignora se a data de hoje (America/Sao_Paulo) já foi atualizada com sucesso.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTAL_ROOT="${CIOP_PORTAL_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
STATE_DIR="${CIOP_STATE_DIR:-$HOME/.config/ciop-portal}"
STATE_FILE="$STATE_DIR/incidentes-ultima-data"
ENV_FILE="$STATE_DIR/incidentes.env"
LOG_DIR="$HOME/Library/Logs/ciop-portal"
LOG_FILE="$LOG_DIR/atualizar-incidentes.log"
TZ_SP="America/Sao_Paulo"
MODE="${1:-auto}"
NODE_BIN="${CIOP_NODE_BIN:-$(command -v node)}"

mkdir -p "$STATE_DIR" "$LOG_DIR"

log() {
  printf '[%s] %s\n' "$(TZ="$TZ_SP" date '+%Y-%m-%d %H:%M:%S %Z')" "$*" | tee -a "$LOG_FILE"
}

today_sp() {
  TZ="$TZ_SP" date +%Y-%m-%d
}

mark_success() {
  today_sp > "$STATE_FILE"
}

already_ran_today() {
  [[ -f "$STATE_FILE" ]] && [[ "$(cat "$STATE_FILE")" == "$(today_sp)" ]]
}

publish_portal_prod() {
  local prod_root="${CIOP_PORTAL_PROD:-}"
  local json="$PORTAL_ROOT/assets/data/incidentes-tcgl.json"

  [[ -n "$prod_root" && -d "$prod_root" ]] || return 0
  [[ -f "$json" ]] || return 0

  log "Publicando JSON no portal de produção: $prod_root"
  cp "$json" "$prod_root/assets/data/incidentes-tcgl.json"
  (
    cd "$prod_root"
    git add assets/data/incidentes-tcgl.json
    if git diff --cached --quiet; then
      log "portalCIOP: sem alterações no JSON."
      exit 0
    fi
    git commit -m "Atualiza incidentes TCGL - $(TZ="$TZ_SP" date '+%d/%m/%Y %H:%M')"
    git push
  )
}

if already_ran_today; then
  log "Atualização de $(today_sp) já concluída ($MODE)."
  exit 0
fi

if [[ ! -x "$NODE_BIN" && ! -f "$NODE_BIN" ]]; then
  log "ERRO: Node.js não encontrado ($NODE_BIN)."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  log "ERRO: Credenciais ausentes. Crie $ENV_FILE (veja scripts/incidentes.env.example)."
  exit 1
fi

log "Iniciando atualização ($MODE) — portal: $PORTAL_ROOT"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

export PORTAL_ROOT
export CIOP_PORTAL_PROD="${CIOP_PORTAL_PROD:-}"
export CIOP_INCIDENTES_USUARIO="${CIOP_INCIDENTES_USUARIO:-}"
export CIOP_INCIDENTES_SENHA="${CIOP_INCIDENTES_SENHA:-}"

if [[ -z "$CIOP_INCIDENTES_USUARIO" || -z "$CIOP_INCIDENTES_SENHA" ]]; then
  log "ERRO: CIOP_INCIDENTES_USUARIO ou CIOP_INCIDENTES_SENHA vazio em $ENV_FILE"
  exit 1
fi

if "$NODE_BIN" "$PORTAL_ROOT/scripts/sync-incidentes-completo.mjs" >> "$LOG_FILE" 2>&1; then
  publish_portal_prod
  mark_success
  log "Atualização concluída com sucesso (TCGL + DSQL + git)."
else
  log "Primeira tentativa falhou. Nova tentativa em 120 segundos..."
  sleep 120
  if "$NODE_BIN" "$PORTAL_ROOT/scripts/sync-incidentes-completo.mjs" >> "$LOG_FILE" 2>&1; then
    publish_portal_prod
    mark_success
    log "Atualização concluída na segunda tentativa."
  else
    log "ERRO: falha na atualização após 2 tentativas. Próxima execução amanhã às 16:00 ou manual: bash \"$0\" manual"
    exit 1
  fi
fi
