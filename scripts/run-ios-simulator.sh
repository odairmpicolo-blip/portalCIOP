#!/usr/bin/env bash
# Instala o app no simulador iOS (sem assinatura Apple) — teste rápido no Mac.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/portal-app"
IOS="$APP/ios/App"
WORKSPACE="$IOS/App.xcworkspace"
SCHEME="App"
SIM_NAME="${IOS_SIMULATOR:-iPhone 16}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Somente macOS."
  exit 1
fi

if [[ -d "/Applications/Xcode.app/Contents/Developer" ]]; then
  export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
fi

cd "$APP"
export CAPACITOR_PORTAL_URL="${CAPACITOR_PORTAL_URL:-https://www.portalciop.com.br/app/}"
npm run build:cap
npx cap sync ios

echo "==> Build para simulador: $SIM_NAME"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -destination "platform=iOS Simulator,name=$SIM_NAME" \
  -derivedDataPath "$ROOT/dist-ipa/DerivedData" \
  build

APP_PATH=$(find "$ROOT/dist-ipa/DerivedData" -name 'App.app' -path '*/Debug-iphonesimulator/*' | head -1)
if [[ -z "$APP_PATH" ]]; then
  echo "App.app não encontrado."
  exit 1
fi

UDID=$(xcrun simctl list devices available | grep "$SIM_NAME (" | head -1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')
if [[ -z "$UDID" ]]; then
  echo "Simulador não encontrado: $SIM_NAME"
  exit 1
fi

xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl install "$UDID" "$APP_PATH"
xcrun simctl launch "$UDID" com.portalciop.internal

echo ""
echo "Portal CIOP aberto no simulador $SIM_NAME."
echo "Para iPhone físico: configure Team no Xcode (Signing) e rode ./scripts/build-ios-ipa.sh"
