#!/usr/bin/env bash
# Implanta backend de IA para Criar Relatório (proxy AWS ou instruções Apps Script).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Relatório IA — implantação ==="
echo ""

if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  echo "==> GEMINI_API_KEY detectada — implantando proxy AWS (/relatorio-ia)..."
  bash "$ROOT/scripts/deploy-bus2-proxy.sh"
  API_URL="${PORTAL_AWS_API_URL:-}"
  if [[ -z "$API_URL" ]] && command -v aws >/dev/null 2>&1; then
    API_URL=$(aws cloudformation describe-stacks \
      --stack-name "${BUS2_STACK_NAME:-portal-ciop-bus2-proxy}" \
      --region "${AWS_REGION:-sa-east-1}" \
      --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
      --output text 2>/dev/null || true)
  fi
  if [[ -n "$API_URL" && "$API_URL" != "None" ]]; then
    echo "==> Teste POST ${API_URL}/relatorio-ia"
    HTTP=$(curl -s -o /tmp/relatorio-ia-test.json -w "%{http_code}" \
      -X POST "${API_URL}/relatorio-ia" \
      -H "Content-Type: application/json" \
      -d '{"prompt":"Responda apenas: OK"}' || echo "000")
    echo "HTTP $HTTP — $(head -c 200 /tmp/relatorio-ia-test.json 2>/dev/null || true)"
  fi
  echo ""
  echo "Próximo passo: rode Deploy GitHub Pages ou defina PORTAL_AWS_API_URL no GitHub."
  exit 0
fi

echo "Proxy AWS: export GEMINI_API_KEY=sua_chave_ai_studio && bash scripts/implantar-relatorio-ia.sh"
echo ""
echo "Apps Script (alternativa, sem AWS):"
echo "  1. https://script.google.com — novo projeto, cole scripts/relatorio-ia.gs"
echo "  2. Propriedades do script → GEMINI_API_KEY (chave em https://aistudio.google.com/apikey)"
echo "  3. Implantar → App da Web → Executar como: Eu · Acesso: Qualquer pessoa"
echo "  4. Copie a URL /exec para assets/data/portal-runtime.json (relatorioIaScriptUrl)"
echo "     ou grave no GitHub: gh secret set RELATORIO_IA_SCRIPT_URL --body 'URL/exec'"
echo "  5. Rode Deploy GitHub Pages (Actions) nos repositórios portal-teste e portalCIOP"
echo ""
