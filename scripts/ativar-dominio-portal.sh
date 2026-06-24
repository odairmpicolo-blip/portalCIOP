#!/usr/bin/env bash
# Ativa www.portalciop.com.br no GitHub Pages (só rode DEPOIS do CNAME no Registro.br).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${GITHUB_REPO:-odairmpicolo-blip/portalCIOP}"
DOMAIN="www.portalciop.com.br"
CNAME_ALVO="odairmpicolo-blip.github.io"

cname=$(dig +short CNAME "$DOMAIN" @8.8.8.8 2>/dev/null | head -1 | sed 's/\.$//')
if [[ "$cname" != "$CNAME_ALVO" ]]; then
  echo "DNS ainda não está correto." >&2
  echo "No Registro.br → Configurar zona DNS → Nova entrada:" >&2
  echo "  Tipo: CNAME | Nome: www | Dados: ${CNAME_ALVO}" >&2
  echo "Valor atual: ${cname:-vazio}" >&2
  exit 1
fi

echo "DNS OK. Configurando GitHub Pages..."
gh api -X PUT "repos/${REPO}/pages" -f build_type=workflow -f cname="${DOMAIN}"

if [ ! -f "${ROOT}/hosting/CNAME" ]; then
  cp "${ROOT}/hosting/CNAME.exemplo" "${ROOT}/hosting/CNAME"
fi

cd "${ROOT}"
git add hosting/CNAME 2>/dev/null || true
if ! git diff --staged --quiet 2>/dev/null; then
  git commit -m "Ativa CNAME ${DOMAIN} no deploy GitHub Pages."
  git push origin main
else
  gh workflow run "Deploy GitHub Pages" --repo "${REPO}"
fi

echo "Aguardando certificado SSL..."
for i in $(seq 1 20); do
  if gh api -X PUT "repos/${REPO}/pages" --input - <<EOF 2>/dev/null
{"build_type":"workflow","cname":"${DOMAIN}","https_enforced":true}
EOF
  then
    echo "HTTPS ativado: https://${DOMAIN}/"
    gh api "repos/${REPO}/pages" --jq '{cname,html_url,https_enforced}'
    exit 0
  fi
  echo "Certificado ainda não pronto (${i}/20)..."
  sleep 30
done

echo "Domínio configurado; HTTPS pode levar mais alguns minutos no GitHub." >&2
exit 0
