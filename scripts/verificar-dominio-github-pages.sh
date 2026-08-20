#!/usr/bin/env bash
# Verifica DNS de portalciop.com.br para GitHub Pages e tenta ativar HTTPS no GitHub.
set -euo pipefail

DOMAIN="${PORTAL_DOMAIN:-portalciop.com.br}"
REPO="${GITHUB_REPO:-odairmpicolo-blip/portalCIOP}"

WWW="${PORTAL_WWW:-www.${DOMAIN}}"

echo "=== DNS CNAME ${WWW} ==="
if command -v dig >/dev/null 2>&1; then
  dig +short CNAME "$WWW" || true
  dig +short A "$WWW" | sort -u || true
else
  echo "dig não instalado"
fi

echo ""
echo "=== HTTPS ${WWW} ==="
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 20 "https://${WWW}/" || echo "000")
echo "HTTP $code (esperado 200)"

echo ""
echo "=== DNS A para ${DOMAIN} (apex, opcional) ==="
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
