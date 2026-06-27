#!/bin/bash
# Atualiza incidentes TCGL → Aurora DSQL (fonte dos portais).
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

if [[ "$MODE" != "manual" ]] && already_ran_today; then
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

PORTAL_ROOT="${CIOP_PORTAL_ROOT:-$PORTAL_ROOT}"
export PORTAL_ROOT
export CIOP_PORTAL_PROD="${CIOP_PORTAL_PROD:-}"
export CIOP_INCIDENTES_USUARIO="${CIOP_INCIDENTES_USUARIO:-}"
export CIOP_INCIDENTES_SENHA="${CIOP_INCIDENTES_SENHA:-}"
export SYNC_INCIDENTES_PUBLISH_GIT="${SYNC_INCIDENTES_PUBLISH_GIT:-}"
export CIOP_GITHUB_TOKEN="${CIOP_GITHUB_TOKEN:-}"

log "Repositório scripts/JSON: $PORTAL_ROOT${CIOP_PORTAL_PROD:+ | git produção: $CIOP_PORTAL_PROD}${SYNC_INCIDENTES_PUBLISH_GIT:+ | publish git ON}"

if [[ -z "$CIOP_INCIDENTES_USUARIO" || -z "$CIOP_INCIDENTES_SENHA" ]]; then
  log "ERRO: CIOP_INCIDENTES_USUARIO ou CIOP_INCIDENTES_SENHA vazio em $ENV_FILE"
  exit 1
fi

check_aws_session() {
  if [[ "${SYNC_INCIDENTES_SKIP_DSQL:-}" == "1" ]]; then
    return 0
  fi
  export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
  if aws sts get-caller-identity >/dev/null 2>&1; then
    return 0
  fi
  log "ERRO: sessão AWS expirada. Abra o Terminal, execute 'aws login' e clique no botão novamente."
  exit 1
}

aws_auth_error_in_log() {
  tail -40 "$LOG_FILE" | grep -qiE 'session has expired|reauthenticate|CredentialsProviderError|Failed to generate DSQL token'
}

run_sync() {
  "$NODE_BIN" "$PORTAL_ROOT/scripts/sync-incidentes-completo.mjs" >> "$LOG_FILE" 2>&1
}

check_aws_session

if run_sync; then
  mark_success
  if tail -5 "$LOG_FILE" | grep -q '"dsql":true'; then
    log "Atualização concluída com sucesso (TCGL → DSQL)."
  elif tail -8 "$LOG_FILE" | grep -q '"git":true'; then
    log "Atualização concluída (TCGL → DSQL). JSON publicado no Git (backup)."
  else
    log "Atualização concluída com sucesso (TCGL → DSQL)."
  fi
else
  if aws_auth_error_in_log; then
    log "ERRO: sessão AWS expirada. Rode 'aws login' no Terminal antes de tentar de novo."
    exit 1
  fi
  log "Primeira tentativa falhou. Nova tentativa em 120 segundos..."
  sleep 120
  if run_sync; then
    mark_success
    log "Atualização concluída na segunda tentativa (TCGL → DSQL)."
  else
    if aws_auth_error_in_log; then
      log "ERRO: sessão AWS expirada. Rode 'aws login' no Terminal antes de tentar de novo."
    else
      log "ERRO: falha na atualização após 2 tentativas. Tente novamente pelo botão na Mesa ou: bash \"$0\" manual"
    fi
    exit 1
  fi
fi
