#!/bin/bash
# Instala agendamento local (launchd): todo dia às 16:00 e ao ligar o Mac, se ainda não atualizou hoje.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTAL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNNER="$SCRIPT_DIR/executar-atualizacao-incidentes.sh"
PLIST_LABEL="com.ciop.portal.atualizar-incidentes"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
STATE_DIR="$HOME/.config/ciop-portal"
ENV_FILE="$STATE_DIR/incidentes.env"
NODE_BIN="$(command -v node)"
UID_NUM="$(id -u)"

chmod +x "$RUNNER"

mkdir -p "$STATE_DIR" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/ciop-portal"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$SCRIPT_DIR/incidentes.env.example" "$ENV_FILE"
  echo "Arquivo de credenciais criado em:"
  echo "  $ENV_FILE"
  echo "Edite CIOP_INCIDENTES_USUARIO e CIOP_INCIDENTES_SENHA antes da primeira execução."
fi

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
    <key>CIOP_NODE_BIN</key>
    <string>${NODE_BIN}</string>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>16</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${HOME}/Library/Logs/ciop-portal/launchd-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/Library/Logs/ciop-portal/launchd-stderr.log</string>
  <key>ThrottleInterval</key>
  <integer>300</integer>
</dict>
</plist>
EOF

launchctl bootout "gui/${UID_NUM}/${PLIST_LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/${UID_NUM}" "$PLIST_PATH"
launchctl enable "gui/${UID_NUM}/${PLIST_LABEL}"

echo "Agendamento instalado."
echo "  Horário: todo dia às 16:00 (horário local do Mac)"
echo "  Ao ligar: executa se ainda não atualizou hoje"
echo "  Plist:   $PLIST_PATH"
echo "  Log:     $HOME/Library/Logs/ciop-portal/atualizar-incidentes.log"
echo ""
echo "Teste manual:"
echo "  bash \"$RUNNER\" manual"
