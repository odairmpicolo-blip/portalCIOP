#!/usr/bin/env bash
# Configura o que é possível automaticamente para portalciop.com.br
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${PORTAL_DOMAIN:-portalciop.com.br}"
REPO="${GITHUB_REPO:-odairmpicolo-blip/portalCIOP}"

echo "==> 1/3 GitHub Pages (domínio ${DOMAIN})"
gh api -X PUT "repos/${REPO}/pages" \
  -f build_type=workflow \
  -f cname="${DOMAIN}" 2>/dev/null || true
gh api "repos/${REPO}/pages" --jq '{cname, html_url, https_enforced, build_type}'

echo ""
echo "==> 2/3 Firebase Auth (domínio autorizado)"
cd "${ROOT}"
if node scripts/adicionar-dominio-firebase-auth.cjs; then
  :
else
  echo "Falha no script Firebase. Rode: firebase login && node scripts/adicionar-dominio-firebase-auth.cjs"
fi

echo ""
echo "==> 3/3 DNS (Registro.br) — ação manual obrigatória"
echo "Crie 4 registros A para @ (domínio raiz):"
echo "  185.199.108.153"
echo "  185.199.109.153"
echo "  185.199.110.153"
echo "  185.199.111.153"
echo ""
if command -v dig >/dev/null 2>&1; then
  echo "DNS atual de ${DOMAIN}:"
  dig +short A "${DOMAIN}" | sort -u || echo "(vazio — ainda não configurado)"
fi
echo ""
echo "Após DNS propagar, ative HTTPS:"
echo "  gh api -X PUT repos/${REPO}/pages -f build_type=workflow -f cname=${DOMAIN} -f https_enforced=true"
