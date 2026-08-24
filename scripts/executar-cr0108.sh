#!/bin/bash
# CR-0108: lê os CSVs diários que chegam no Mac pelo Google Drive, carrega as passagens
# no Aurora DSQL e republica os agregados do portal.
#
# Os quatro agregadores são incrementais — leem só os dias que ainda não entraram — e a
# carga no DSQL usa --desde para não reprocessar o histórico a cada noite.
set -uo pipefail

MODE="${1:-auto}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTAL_ROOT="${CIOP_PORTAL_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
STATE_DIR="${CIOP_STATE_DIR:-$HOME/.config/ciop-portal}"
ENV_FILE="$STATE_DIR/cr0108.env"
LOG_DIR="$HOME/Library/Logs/ciop-portal"
LOG_FILE="$LOG_DIR/atualizar-cr0108.log"
DADOS_DIR="$PORTAL_ROOT/assets/data/cr0108"

mkdir -p "$STATE_DIR" "$LOG_DIR"

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')" "$*" | tee -a "$LOG_FILE"; }

falhar() { log "ERRO: $*"; exit 1; }

[[ -f "$ENV_FILE" ]] || falhar "configuração ausente. Rode scripts/instalar-agendamento-cr0108-macos.sh"

# Lê o arquivo linha a linha em vez de "source": o caminho do Drive tem espaços
# ("108 - reports") e o shell tentaria executar o hífen como comando.
while IFS= read -r linha || [[ -n "$linha" ]]; do
  linha="${linha#"${linha%%[![:space:]]*}"}"          # tira espaço à esquerda
  [[ -z "$linha" || "$linha" == \#* ]] && continue
  chave="${linha%%=*}"
  valor="${linha#*=}"
  [[ "$chave" == "$linha" ]] && continue              # linha sem "="
  valor="${valor%\"}"; valor="${valor#\"}"           # tira aspas duplas se houver
  valor="${valor%\'}"; valor="${valor#\'}"
  export "$chave=$valor"
done < "$ENV_FILE"

RAIZ="${CIOP_CR0108_RAIZ:-}"
[[ -n "$RAIZ" && -d "$RAIZ" ]] || falhar "CIOP_CR0108_RAIZ não aponta para uma pasta válida: ${RAIZ:-vazio}"

PYTHON_BIN="${CIOP_PYTHON_BIN:-$(command -v python3 || true)}"
[[ -n "$PYTHON_BIN" ]] || falhar "python3 não encontrado"
GIT_BIN="$(command -v git || true)"
[[ -n "$GIT_BIN" ]] || falhar "git não encontrado"
[[ -d "$PORTAL_ROOT/.git" ]] || falhar "$PORTAL_ROOT não é um clone do repositório"

log "Iniciando ($MODE) — portal: $PORTAL_ROOT | CSVs: $RAIZ"

# ---------------------------------------------------------------- Drive sob demanda
# No Google Drive "streaming" os arquivos podem existir só na nuvem: aparecem no ls mas
# falham na leitura. Ler um pedaço força o download; contamos quantos não vieram para o
# erro apontar a causa certa em vez de estourar lá dentro do agregador.
total=0; indisponiveis=0
while IFS= read -r arquivo; do
  total=$((total + 1))
  head -c 1 "$arquivo" >/dev/null 2>&1 || { indisponiveis=$((indisponiveis + 1)); log "  sem acesso: $(basename "$arquivo")"; }
done < <(find "$RAIZ" -name '*.csv' \( -type f -o -type l \))

log "CSVs na pasta: $total"
if (( total == 0 )); then falhar "nenhum CSV encontrado em $RAIZ"; fi
if (( indisponiveis > 0 )); then
  falhar "$indisponiveis arquivo(s) só na nuvem. No Finder, clique com o botão direito na pasta do CR-0108 e marque 'Disponível off-line'."
fi

# ---------------------------------------------------------------- publicação
cd "$PORTAL_ROOT" || falhar "não consegui entrar em $PORTAL_ROOT"

# Se uma rodada anterior morreu depois de gerar os JSONs e antes do commit, sobram
# alterações soltas e o "pull --rebase" recusa a partir daí — a automação ficaria
# travada para sempre. Os agregados são reconstruíveis a partir dos CSVs, então o
# certo é descartar o que sobrou e refazer. Mexe só na pasta de dados do CR-0108.
if [[ -n "$("$GIT_BIN" status --porcelain -- 'assets/data/cr0108')" ]]; then
  log "  sobras de uma rodada anterior: descartando e refazendo"
  "$GIT_BIN" checkout -- 'assets/data/cr0108' 2>>"$LOG_FILE" || true
  "$GIT_BIN" clean -fd -- 'assets/data/cr0108' >>"$LOG_FILE" 2>&1 || true
fi

# --autostash guarda e devolve qualquer outra alteração local (um arquivo aberto
# na mão, por exemplo) para o rebase não recusar e a automação não parar por isso.
"$GIT_BIN" pull --rebase --autostash --quiet >>"$LOG_FILE" 2>&1 || falhar "git pull falhou"

rodar() {
  local nome="$1" script="$2"
  log "  -> $nome"
  "$PYTHON_BIN" "$PORTAL_ROOT/scripts/$script" "$RAIZ" "$DADOS_DIR" >>"$LOG_FILE" 2>&1 \
    || falhar "$nome falhou"
}

rodar 'agregados'              'cr0108-incremental.py'
rodar 'diagnóstico e sugestões' 'cr0108-diagnostico.py'
rodar 'série diária'           'cr0108-serie-diaria.py'
rodar 'operador x linha'       'cr0108-operador-linha.py'

ULTIMO="$("$PYTHON_BIN" -c "import json,sys;print(json.load(open(sys.argv[1]))['ultimoDia'])" "$DADOS_DIR/meta.json")"

# ---------------------------------------------------------------- Aurora DSQL
# As páginas continuam lendo os JSONs estáticos (é o que dá resposta instantânea);
# o banco guarda a passagem crua, para consulta livre e histórico.
if [[ -n "${DSQL_CLUSTER_ID:-}" && -n "${AWS_ACCESS_KEY_ID:-}" && -n "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
  NODE_BIN="${CIOP_NODE_BIN:-$(command -v node || true)}"
  if [[ -z "$NODE_BIN" ]]; then
    log "  -> AVISO: node não encontrado, carga no DSQL pulada"
  else
    DESDE="${CIOP_CR0108_DSQL_DESDE:-}"
    if [[ -n "$DESDE" ]]; then
      log "  -> banco AWS (DSQL) desde $DESDE"
      "$NODE_BIN" "$PORTAL_ROOT/backend/scripts/importar-cr0108-csv.mjs" "$RAIZ" "--desde=$DESDE" >>"$LOG_FILE" 2>&1 \
        || falhar "carga no DSQL falhou"
    else
      log "  -> banco AWS (DSQL): primeira carga, histórico completo (demora)"
      "$NODE_BIN" "$PORTAL_ROOT/backend/scripts/importar-cr0108-csv.mjs" "$RAIZ" >>"$LOG_FILE" 2>&1 \
        || falhar "carga no DSQL falhou"
    fi
    # Marca até onde já foi para a próxima rodada não repetir o histórico.
    if grep -q '^CIOP_CR0108_DSQL_DESDE=' "$ENV_FILE"; then
      /usr/bin/sed -i '' "s|^CIOP_CR0108_DSQL_DESDE=.*|CIOP_CR0108_DSQL_DESDE=$ULTIMO|" "$ENV_FILE"
    else
      printf 'CIOP_CR0108_DSQL_DESDE=%s\n' "$ULTIMO" >> "$ENV_FILE"
    fi
    log "     banco atualizado até $ULTIMO"
    log "  -> JSON do portal a partir do DSQL"
    "$NODE_BIN" "$PORTAL_ROOT/scripts/exportar-cr0108-json.mjs" >>"$LOG_FILE" 2>&1 \
      || falhar "exportar JSON CR-0108 do DSQL falhou"
  fi
else
  log "  -> banco AWS: credenciais ausentes em $ENV_FILE, etapa pulada"
fi

# ---------------------------------------------------------------- commit
if [[ -z "$("$GIT_BIN" status --porcelain -- 'assets/data/cr0108')" ]]; then
  log "Nenhum dia novo — nada a publicar (dados até $ULTIMO)."
  exit 0
fi

"$GIT_BIN" add -- 'assets/data/cr0108' || falhar "git add falhou"
"$GIT_BIN" -c user.name='CIOP Portal' -c user.email='ciop@tcgl.local' \
           commit -m "CR-0108: atualiza ate $ULTIMO (automatico)" --quiet || falhar "git commit falhou"
"$GIT_BIN" push --quiet >>"$LOG_FILE" 2>&1 || falhar "git push falhou — verifique a credencial do GitHub"

log "Publicado: dados até $ULTIMO."
exit 0
