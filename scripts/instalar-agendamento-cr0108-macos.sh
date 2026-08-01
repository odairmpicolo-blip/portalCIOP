#!/bin/bash
# Instala o agendamento do CR-0108 no Mac (launchd): todo dia às 06:30 e ao ligar.
# O horário é bem depois das 03:00 em que a automação do CIOP grava o CSV, para dar
# tempo do Google Drive sincronizar o arquivo até aqui.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTAL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNNER="$SCRIPT_DIR/executar-cr0108.sh"
PLIST_LABEL="com.ciop.portal.atualizar-cr0108"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
STATE_DIR="$HOME/.config/ciop-portal"
ENV_FILE="$STATE_DIR/cr0108.env"
UID_NUM="$(id -u)"

RAIZ_PADRAO="$HOME/Library/CloudStorage/GoogleDrive-odairmpicolo@gmail.com/.shortcut-targets-by-id/1BPBiZafnzEo_6WJp_Mm5-swi9LH7W7Kq/001 - PLANEJAMENTO COMPARTILHADA INTERNO/ODAIR/CR-0108/108 - reports"

mkdir -p "$STATE_DIR" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/ciop-portal"
chmod +x "$RUNNER"

PYTHON_BIN="$(command -v python3 || true)"
[[ -n "$PYTHON_BIN" ]] || { echo "ERRO: python3 não encontrado."; exit 1; }
echo "python3: $PYTHON_BIN"

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "AVISO: node não encontrado — a carga no Aurora DSQL será pulada."
  echo "       Instale com 'brew install node' se quiser alimentar o banco."
fi

# ---------------------------------------------------------------- pasta dos CSVs
RAIZ="${1:-}"
if [[ -z "$RAIZ" ]]; then
  if [[ -d "$RAIZ_PADRAO" ]]; then
    RAIZ="$RAIZ_PADRAO"
    echo "Pasta dos CSVs encontrada:"
    echo "  $RAIZ"
  else
    echo "Informe a pasta que contém as subpastas por mês (ex.: '07 - Julho 2026'):"
    read -r RAIZ
  fi
fi
[[ -d "$RAIZ" ]] || { echo "ERRO: pasta não encontrada: $RAIZ"; exit 1; }

QTD="$(find "$RAIZ" -name '*.csv' -type f | wc -l | tr -d ' ')"
[[ "$QTD" -gt 0 ]] || { echo "ERRO: nenhum CSV em $RAIZ"; exit 1; }
echo "CSVs encontrados: $QTD"

# ---------------------------------------------------------------- configuração
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
# Configuração do CR-0108 (portal CIOP) — Mac.
CIOP_CR0108_RAIZ="$RAIZ"

# Banco AWS. Sem estas quatro linhas preenchidas, a carga no Aurora DSQL é pulada
# e apenas os JSONs do portal são atualizados.
# DSQL_CLUSTER_ID=
# DSQL_REGION=sa-east-1
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
EOF
  chmod 600 "$ENV_FILE"
  echo "Configuração criada em $ENV_FILE"
else
  if grep -q '^CIOP_CR0108_RAIZ=' "$ENV_FILE"; then
    /usr/bin/sed -i '' "s|^CIOP_CR0108_RAIZ=.*|CIOP_CR0108_RAIZ=\"$RAIZ\"|" "$ENV_FILE"
  else
    printf 'CIOP_CR0108_RAIZ="%s"\n' "$RAIZ" >> "$ENV_FILE"
  fi
  echo "Configuração atualizada em $ENV_FILE"
fi

# ---------------------------------------------------------------- launchd
cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${RUNNER}</string>
    <string>auto</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CIOP_PORTAL_ROOT</key>
    <string>${PORTAL_ROOT}</string>
    <key>CIOP_PYTHON_BIN</key>
    <string>${PYTHON_BIN}</string>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>6</integer>
    <key>Minute</key>
    <integer>30</integer>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${HOME}/Library/Logs/ciop-portal/cr0108-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/Library/Logs/ciop-portal/cr0108-stderr.log</string>
  <key>ThrottleInterval</key>
  <integer>300</integer>
</dict>
</plist>
EOF

launchctl bootout "gui/${UID_NUM}/${PLIST_LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/${UID_NUM}" "$PLIST_PATH"
launchctl enable "gui/${UID_NUM}/${PLIST_LABEL}"

cat <<EOF

Agendamento instalado.
  Horário: todo dia às 06:30 (e ao ligar o Mac)
  CSVs:    $RAIZ
  Portal:  $PORTAL_ROOT
  Log:     $HOME/Library/Logs/ciop-portal/atualizar-cr0108.log

Duas coisas antes da primeira rodada:

1. No Finder, clique com o botão direito na pasta do CR-0108 no Google Drive e
   marque "Disponível off-line". Sem isso os arquivos ficam só na nuvem e o
   script para com erro — é a falha mais comum aqui.

2. Para alimentar o Aurora DSQL, preencha DSQL_CLUSTER_ID, AWS_ACCESS_KEY_ID e
   AWS_SECRET_ACCESS_KEY em $ENV_FILE

Teste manual (a primeira leva alguns minutos, monta os caches):
  bash "$RUNNER" manual
EOF
