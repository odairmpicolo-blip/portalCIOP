#!/usr/bin/env bash
# Build mobile Portal CIOP — Android (APK) e/ou iOS (IPA).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-all}" # android | ios | all

usage() {
  echo "Uso: $0 [android|ios|all]"
  echo "  android  — gera APK debug (dist-apk/)"
  echo "  ios      — gera IPA (dist-ipa/, exige Xcode + conta Apple)"
  echo "  all      — ambos (padrão)"
}

case "$TARGET" in
  android)
    "$ROOT/scripts/build-android-apk.sh"
    ;;
  ios)
    "$ROOT/scripts/build-ios-ipa.sh"
    ;;
  all)
    "$ROOT/scripts/build-android-apk.sh"
    if [[ "$(uname -s)" == "Darwin" ]]; then
      "$ROOT/scripts/build-ios-ipa.sh" || {
        echo ""
        echo "AVISO: build iOS falhou (assinatura/Xcode). Android concluído."
        exit 1
      }
    else
      echo "AVISO: iOS ignorado (não é macOS)."
    fi
    ;;
  -h|--help)
    usage
    ;;
  *)
    echo "Alvo inválido: $TARGET"
    usage
    exit 1
    ;;
esac
