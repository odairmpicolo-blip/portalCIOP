#!/usr/bin/env bash
# Aguarda DNS de www.portalciop.com.br e ativa HTTPS no GitHub Pages.
set -euo pipefail

REPO="${GITHUB_REPO:-odairmpicolo-blip/portalCIOP}"
DOMAIN="www.portalciop.com.br"
CNAME_ALVO="odairmpicolo-blip.github.io"
MAX_TENTATIVAS="${MAX_TENTATIVAS:-60}"
INTERVALO="${INTERVALO:-30}"

dns_ok() {
  local cname
  cname=$(dig +short CNAME "$DOMAIN" @8.8.8.8 2>/dev/null | tr -d '\n' | sed 's/\.$//')
  [[ "$cname" == "${CNAME_ALVO}." || "$cname" == "$CNAME_ALVO" ]]
}

ativar_https() {
  gh api -X PUT "repos/${REPO}/pages" --input - <<EOF
{
  "build_type": "workflow",
  "cname": "${DOMAIN}",
  "https_enforced": true
}
EOF
}

echo "Aguardando CNAME ${DOMAIN} -> ${CNAME_ALVO} ..."
for i in $(seq 1 "$MAX_TENTATIVAS"); do
  if dns_ok; then
    echo "DNS OK (tentativa ${i})."
    if ativar_https 2>/dev/null; then
      echo "HTTPS ativado em https://${DOMAIN}/"
      gh api "repos/${REPO}/pages" --jq '{cname,html_url,https_enforced}'
      exit 0
    fi
    echo "DNS ok, certificado ainda não pronto — tentando de novo..."
  else
    echo "[${i}/${MAX_TENTATIVAS}] DNS ainda não propagou..."
  fi
  sleep "$INTERVALO"
done

echo "Timeout. Confira no Registro.br: CNAME www -> ${CNAME_ALVO}" >&2
exit 1
