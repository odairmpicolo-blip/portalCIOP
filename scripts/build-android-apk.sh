#!/usr/bin/env bash
# Gera APK Android (debug) do Portal CIOP — sideload, sem Play Store.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/portal-app"
PORTAL_URL="${CAPACITOR_PORTAL_URL:-https://www.portalciop.com.br/app/}"

# Android SDK (Android Studio no Mac)
if [[ -z "${ANDROID_HOME:-}" && -d "$HOME/Library/Android/sdk" ]]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
fi
if [[ -n "${ANDROID_HOME:-}" ]]; then
  export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools/bin"
fi

# JDK (Android Studio embute JBR; Homebrew openjdk@17 também serve)
if [[ -z "${JAVA_HOME:-}" ]]; then
  if [[ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]]; then
    export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  elif command -v /usr/libexec/java_home >/dev/null 2>&1; then
    JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home 2>/dev/null || true)"
    [[ -n "$JAVA_HOME" ]] && export JAVA_HOME
  fi
fi

if [[ -z "${JAVA_HOME:-}" ]] || ! "$JAVA_HOME/bin/java" -version >/dev/null 2>&1; then
  echo "Java (JDK 17+) necessário para compilar o APK."
  echo "Instale Android Studio (recomendado) ou: brew install openjdk@17"
  exit 1
fi

if [[ ! -d "${ANDROID_HOME:-}/platform-tools" ]]; then
  echo "AVISO: ANDROID_HOME não encontrado. Instale Android Studio e o Android SDK."
  echo "  export ANDROID_HOME=\"\$HOME/Library/Android/sdk\""
fi

echo "==> Portal CIOP APK (interno)"
echo "    URL: $PORTAL_URL"
echo "    appId: com.portalciop.internal"

cd "$APP"

if [[ ! -d node_modules ]]; then
  npm ci
fi

export CAPACITOR_PORTAL_URL="$PORTAL_URL"

# Fallback offline em www/; app principal vem da URL remota (server.url).
npm run build:cap

if [[ ! -d android ]]; then
  npx cap add android
fi

npx cap sync android

cd android
chmod +x gradlew
./gradlew assembleDebug --no-daemon

APK="$APP/android/app/build/outputs/apk/debug/app-debug.apk"
if [[ -f "$APK" ]]; then
  OUT="$ROOT/dist-apk"
  mkdir -p "$OUT"
  STAMP=$(date +%Y%m%d-%H%M)
  DEST="$OUT/portal-ciop-internal-$STAMP.apk"
  cp "$APK" "$DEST"
  echo ""
  echo "APK gerado:"
  echo "  $DEST"
  echo ""
  echo "Instalar no celular (USB + depuração):"
  echo "  adb install -r \"$DEST\""
  echo ""
  echo "Ou copie o arquivo para o Android e instale (fontes desconhecidas)."
else
  echo "ERRO: APK não encontrado em $APK"
  exit 1
fi
