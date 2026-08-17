#!/usr/bin/env bash
# Gera IPA iOS (development/ad-hoc) — instalação manual, sem App Store.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/portal-app"
IOS="$APP/ios/App"
PORTAL_URL="${CAPACITOR_PORTAL_URL:-https://www.portalciop.com.br/app/}"
EXPORT_METHOD="${IOS_EXPORT_METHOD:-development}" # development | ad-hoc

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Build iOS exige macOS com Xcode."
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Xcode não encontrado. Instale pela App Store e abra uma vez para aceitar a licença."
  exit 1
fi

XCODE_DEV="$(xcode-select -p 2>/dev/null || true)"
if [[ "$XCODE_DEV" == *CommandLineTools* ]]; then
  echo "Xcode completo necessário (não só Command Line Tools)."
  echo "Instale Xcode da App Store e configure:"
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

echo "==> Portal CIOP IPA (interno)"
echo "    URL: $PORTAL_URL"
echo "    appId: com.portalciop.internal"
echo "    export: $EXPORT_METHOD"

cd "$APP"

if [[ ! -d node_modules ]]; then
  npm ci
fi

export CAPACITOR_PORTAL_URL="$PORTAL_URL"
npm run build:cap

if [[ ! -d ios ]]; then
  npx cap add ios
fi

npx cap sync ios

WORKSPACE="$IOS/App.xcworkspace"
SCHEME="App"
STAMP=$(date +%Y%m%d-%H%M)
OUT="$ROOT/dist-ipa"
ARCHIVE="$OUT/PortalCIOP-$STAMP.xcarchive"
EXPORT_DIR="$OUT/export-$STAMP"
PLIST="$OUT/ExportOptions-$STAMP.plist"

mkdir -p "$OUT"

# Team ID: defina IOS_TEAM_ID no ambiente ou em Xcode (Signing & Capabilities).
TEAM_ARG=()
if [[ -n "${IOS_TEAM_ID:-}" ]]; then
  TEAM_ARG=(DEVELOPMENT_TEAM="$IOS_TEAM_ID")
fi

echo "==> Archive (generic iOS device)…"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  "${TEAM_ARG[@]}" \
  archive

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>$EXPORT_METHOD</string>
  <key>compileBitcode</key>
  <false/>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>thinning</key>
  <string>&lt;none&gt;</string>
</dict>
</plist>
EOF

echo "==> Export IPA…"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$PLIST"

IPA=$(find "$EXPORT_DIR" -maxdepth 1 -name '*.ipa' | head -1)
if [[ -n "$IPA" && -f "$IPA" ]]; then
  DEST="$OUT/portal-ciop-internal-$STAMP.ipa"
  cp "$IPA" "$DEST"
  echo ""
  echo "IPA gerado:"
  echo "  $DEST"
  echo ""
  echo "Instalar no iPhone:"
  echo "  1. Conecte o iPhone ao Mac (Finder ou Apple Configurator 2)"
  echo "  2. Ou abra no Xcode: cd portal-app && npm run cap:open:ios → Run no seu aparelho"
  echo ""
  echo "Ad-hoc (vários dispositivos): IOS_EXPORT_METHOD=ad-hoc IOS_TEAM_ID=SEU_TEAM ./scripts/build-ios-ipa.sh"
else
  echo ""
  echo "Export falhou (assinatura). Abra no Xcode e configure Signing:"
  echo "  cd portal-app && npm run cap:open:ios"
  echo "  App → Signing & Capabilities → Team (Apple ID)"
  echo "  Product → Run no iPhone conectado"
  exit 1
fi
