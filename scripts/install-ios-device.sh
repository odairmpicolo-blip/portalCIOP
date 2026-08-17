#!/usr/bin/env bash
# Instala Portal CIOP no iPhone conectado (USB) — Personal Team, sem App Store.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/portal-app"
IOS="$APP/ios/App"
WORKSPACE="$IOS/App.xcworkspace"
SCHEME="App"
TEAM_ID="${IOS_TEAM_ID:-259BFG62D4}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Somente macOS."
  exit 1
fi

if [[ -d "/Applications/Xcode.app/Contents/Developer" ]]; then
  export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
fi

IOS_ENV="$HOME/.config/ciop-portal/ios.env"
if [[ -f "$IOS_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$IOS_ENV"
  TEAM_ID="${IOS_TEAM_ID:-$TEAM_ID}"
fi

UDID=$(xcrun xctrace list devices 2>/dev/null | rg -i 'iphone|ipad' | rg -v 'Simulator' | head -1 | sed -E 's/.*\(([0-9A-Fa-f-]+)\).*/\1/')
if [[ -z "$UDID" ]]; then
  echo "Nenhum iPhone/iPad conectado."
  echo ""
  echo "Conecte o iPhone ao Mac via USB e:"
  echo "  1. Desbloqueie o aparelho"
  echo "  2. Toque em Confiar neste computador"
  echo "  3. No iPhone: Ajustes → Privacidade e Segurança → Modo Desenvolvedor → Ativar"
  echo "  4. Rode este script de novo"
  exit 1
fi

echo "==> Portal CIOP → dispositivo $UDID"
echo "    Team: $TEAM_ID"

cd "$APP"
export CAPACITOR_PORTAL_URL="${CAPACITOR_PORTAL_URL:-https://www.portalciop.com.br/app/}"
export CAPACITOR_BUNDLE="${CAPACITOR_BUNDLE:-0}"
if [[ "$CAPACITOR_BUNDLE" == "1" ]]; then
  echo "    modo: bundle local (reinstalar a cada mudança de layout)"
  npm run build:native
else
  echo "    modo: URL remota ($CAPACITOR_PORTAL_URL)"
  npm run build:cap
fi
npx cap sync ios

DERIVED="$ROOT/dist-ipa/DerivedData-Device"
rm -rf "$DERIVED"

xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -destination "id=$UDID" \
  -derivedDataPath "$DERIVED" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  build

APP_PATH=$(find "$DERIVED" -name 'App.app' -path '*/Debug-iphoneos/*' | head -1)
if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "App.app não encontrado após build."
  exit 1
fi

echo "==> Instalando no iPhone…"
if xcrun devicectl device install app --device "$UDID" "$APP_PATH" 2>/dev/null; then
  echo "Instalado."
else
  # Fallback Xcode 15
  xcrun devicectl device install app --device "$UDID" "$APP_PATH" || \
  ios-deploy --id "$UDID" --bundle "$APP_PATH" 2>/dev/null || {
    echo ""
    echo "Build OK. Instale pelo Xcode: Product → Run (▶) com o iPhone selecionado."
    echo "App compilado em: $APP_PATH"
    open "$WORKSPACE"
    exit 0
  }
fi

echo ""
echo "Portal CIOP instalado no iPhone."
echo "Abra o app 'Portal CIOP' na tela inicial."
