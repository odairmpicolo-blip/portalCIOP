#!/usr/bin/env bash
# Verifica DNS de portalciop.com.br para GitHub Pages e tenta ativar HTTPS no GitHub.
set -euo pipefail

DOMAIN="${PORTAL_DOMAIN:-portalciop.com.br}"
REPO="${GITHUB_REPO:-odairmpicolo-blip/portalCIOP}"

echo "=== DNS A para ${DOMAIN} (GitHub Pages) ==="
if command -v dig >/dev/null 2>&1; then
  dig +short A "$DOMAIN" | sort -u || true
else
  echo "dig não instalado — confira manualmente no Registro.br"
fi

echo ""
echo "Esperado (um ou mais):"
echo "  185.199.108.153"
echo "  185.199.109.153"
echo "  185.199.110.153"
echo "  185.199.111.153"

echo ""
echo "=== GitHub Pages ==="
if command -v gh >/dev/null 2>&1; then
  gh api "repos/${REPO}/pages" --jq '{cname, html_url, https_enforced, build_type}'
  echo ""
  echo "Para forçar HTTPS após DNS OK:"
  echo "  gh api -X PUT repos/${REPO}/pages -f build_type=workflow -f cname=${DOMAIN} -f https_enforced=true"
else
  echo "gh CLI não encontrado"
fi
