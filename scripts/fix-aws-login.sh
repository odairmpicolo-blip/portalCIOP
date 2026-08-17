#!/usr/bin/env bash
set -euo pipefail

echo "Portal CIOP — corrigir login AWS"
echo ""
echo "O aws configure guardou chaves invalidas (ex.: e-mail no lugar da Access Key)."
echo "Este script faz backup e remove ~/.aws/credentials para permitir aws login."
echo ""

read -r -p "Continuar? (s/N) " ok
if [[ ! "$ok" =~ ^[sS]$ ]]; then
  echo "Cancelado."
  exit 0
fi

STAMP=$(date +%Y%m%d%H%M%S)
if [ -f "$HOME/.aws/credentials" ]; then
  cp "$HOME/.aws/credentials" "$HOME/.aws/credentials.backup-$STAMP"
  rm "$HOME/.aws/credentials"
  echo "Backup: ~/.aws/credentials.backup-$STAMP"
fi

echo ""
echo "Agora rode:"
echo "  aws login"
echo ""
echo "Depois:"
echo "  cd ~/portal-teste/backend && npm run setup:dsql"
