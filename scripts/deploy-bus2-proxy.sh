#!/usr/bin/env bash
# Deploy proxy Bus2 (Lambda + API Gateway HTTP) e opcionalmente configura PORTAL_AWS_API_URL no GitHub.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AWS_DIR="$ROOT/aws/bus2-proxy"
STACK="${BUS2_STACK_NAME:-portal-ciop-bus2-proxy}"
REGION="${AWS_REGION:-sa-east-1}"
AWS="${AWS_CLI:-aws}"

if ! command -v "$AWS" >/dev/null 2>&1; then
  echo "AWS CLI não encontrado."
  exit 1
fi

if ! "$AWS" sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
  echo "Credenciais AWS ausentes. Rode: aws login"
  exit 1
fi

FUNC="${LAMBDA_FUNCTION_NAME:-portal-ciop-bus2-proxy}"
ENV_SNAP="$(mktemp /tmp/bus2-env-snap.XXXXXX.json)"
ENV_PUT="$(mktemp /tmp/bus2-env-put.XXXXXX.json)"
trap 'rm -f "$ENV_SNAP" "$ENV_PUT"' EXIT

echo "==> Snapshot das variáveis da Lambda $FUNC (o CloudFormation substitui o mapa inteiro)"
"$AWS" lambda get-function-configuration \
  --function-name "$FUNC" \
  --region "$REGION" \
  --query "Environment.Variables" \
  --output json > "$ENV_SNAP" 2>/dev/null || echo "{}" > "$ENV_SNAP"
python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print('    %d variáveis preservadas' % len(d))" "$ENV_SNAP"

if [[ "${BUS2_PROXY_SKIP_CFN:-}" == "1" ]]; then
  API_URL="${PORTAL_AWS_API_URL:-https://62wvo4yk9b.execute-api.sa-east-1.amazonaws.com}"
  echo "==> Modo rápido: atualizar código Lambda $FUNC (sem CloudFormation)"
else
echo "==> CloudFormation stack: $STACK ($REGION)"
if ! "$AWS" cloudformation deploy \
  --template-file "$AWS_DIR/template.yaml" \
  --stack-name "$STACK" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset; then
  echo ""
  echo "ERRO: deploy CloudFormation falhou. Restaurando variáveis da Lambda a partir do snapshot."
  python3 - "$ENV_SNAP" "$ENV_PUT" <<'PY'
import json, sys
vars_ = json.load(open(sys.argv[1]))
json.dump({"Variables": vars_}, open(sys.argv[2], "w"))
PY
  "$AWS" lambda update-function-configuration \
    --function-name "$FUNC" \
    --region "$REGION" \
    --environment "file://$ENV_PUT" >/dev/null || true
  echo "Anexe a política aws/bus2-proxy/iam-github-actions-policy.json ao usuário portal-ciop-github-actions"
  echo "ou rode localmente com credenciais admin: aws login && bash scripts/deploy-bus2-proxy.sh"
  exit 1
fi

FUNC=$("$AWS" cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FunctionName'].OutputValue" \
  --output text)

API_URL=$("$AWS" cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)
fi

ZIP="/tmp/portal-bus2-proxy-$$.zip"
rm -f "$ZIP"
(cd "$AWS_DIR" && zip -q "$ZIP" index.mjs)

echo "==> Atualizando Lambda $FUNC"
"$AWS" lambda update-function-code \
  --function-name "$FUNC" \
  --region "$REGION" \
  --zip-file "fileb://$ZIP" >/dev/null
rm -f "$ZIP"

echo "==> Aguardando Lambda terminar de aplicar o código antes de mexer nas variáveis"
"$AWS" lambda wait function-updated --function-name "$FUNC" --region "$REGION"

# Garante as rotas /clever/{proxy+} no API Gateway (modo rápido não roda CloudFormation,
# então rotas novas precisam ser criadas diretamente via apigatewayv2).
API_ID=$(echo "$API_URL" | sed -E 's#https?://([^.]+)\..*#\1#')
if [[ -n "$API_ID" ]]; then
  echo "==> Verificando rotas /clever no API Gateway ($API_ID)"
  INTEGRATION_ID=$("$AWS" apigatewayv2 get-integrations \
    --api-id "$API_ID" \
    --region "$REGION" \
    --query "Items[0].IntegrationId" \
    --output text 2>/dev/null || echo "")
  if [[ -n "$INTEGRATION_ID" && "$INTEGRATION_ID" != "None" ]]; then
    for ROUTE_KEY in "GET /clever/{proxy+}" "OPTIONS /clever/{proxy+}"; do
      EXISTE=$("$AWS" apigatewayv2 get-routes \
        --api-id "$API_ID" \
        --region "$REGION" \
        --query "Items[?RouteKey=='${ROUTE_KEY}'].RouteId" \
        --output text 2>/dev/null || echo "")
      if [[ -z "$EXISTE" ]]; then
        echo "   Criando rota: $ROUTE_KEY"
        "$AWS" apigatewayv2 create-route \
          --api-id "$API_ID" \
          --region "$REGION" \
          --route-key "$ROUTE_KEY" \
          --target "integrations/${INTEGRATION_ID}" >/dev/null || echo "   AVISO: falha ao criar rota $ROUTE_KEY (permissao IAM?)"
      else
        echo "   Rota já existe: $ROUTE_KEY"
      fi
    done
  else
    echo "   AVISO: não encontrei a integração do API Gateway — rotas /clever podem não funcionar."
  fi
fi

echo "==> Restaurando variáveis da Lambda (JSON; o mapa do CloudFormation não leva os tokens)"
BUSTIME_API_KEY="${BUSTIME_API_KEY:-}" GEMINI_API_KEY="${GEMINI_API_KEY:-}" CLEVER_API_KEY="${CLEVER_API_KEY:-}" \
python3 - "$ENV_SNAP" "$ENV_PUT" <<'PY'
import json, os, sys
current = json.load(open(sys.argv[1]))
bustime_key = os.environ.get("BUSTIME_API_KEY") or ""
gemini_key = os.environ.get("GEMINI_API_KEY") or ""
clever_key = os.environ.get("CLEVER_API_KEY") or ""
if bustime_key:
    current["BUSTIME_BASE_URL"] = "https://csr.mov1.com.br/bustime/api/v3"
    current["BUSTIME_REFERER"] = "https://csr.mov1.com.br/map"
    current["BUSTIME_API_KEY"] = bustime_key
if gemini_key:
    current["GEMINI_API_KEY"] = gemini_key
if clever_key:
    current["CLEVER_BASE_URL"] = "http://146.235.63.7/bustime/api/v3"
    current["CLEVER_API_KEY"] = clever_key
json.dump({"Variables": current}, open(sys.argv[2], "w"))
print("    %d variáveis no mapa restaurado" % len(current))
if not (bustime_key or gemini_key or clever_key):
    print("    nenhuma chave nova via ambiente; snapshot reaplicado como está")
PY
"$AWS" lambda update-function-configuration \
  --function-name "$FUNC" \
  --region "$REGION" \
  --environment "file://$ENV_PUT" >/dev/null

echo "==> Teste /health"
"$AWS" lambda wait function-updated --function-name "$FUNC" --region "$REGION"
sleep 2
HEALTH=$(curl -s "${API_URL}/health" || true)
echo "$HEALTH"

echo ""
echo "API URL (PORTAL_AWS_API_URL): $API_URL"
echo "Proxy MOV1: ${API_URL}/mov1/getvehicles?rt=203"
echo "Proxy Clever: ${API_URL}/clever/getvehicles"
echo "Proxy Bus2 (legado): ${API_URL}/bus2/vehicles?..."
echo "Relatório IA: POST ${API_URL}/relatorio-ia (requer GEMINI_API_KEY na Lambda)"

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1 && [[ "${SKIP_GH_SECRET:-}" != "1" ]]; then
  # Segue o repositório de onde o script foi chamado; rodar daqui não deve
  # reconfigurar o secret de outro ambiente. PORTAL_GH_REPO sobrescreve.
  GH_REPO="${PORTAL_GH_REPO:-$(git -C "$ROOT" remote get-url origin 2>/dev/null \
    | sed -E 's#(git@|https://)[^:/]+[:/]##; s#\.git$##')}"
  if [[ -z "$GH_REPO" ]]; then
    echo "AVISO: repositório do GitHub não identificado; defina PORTAL_GH_REPO."
  elif gh secret set PORTAL_AWS_API_URL --body "$API_URL" --repo "$GH_REPO" 2>/dev/null; then
    echo "Secret PORTAL_AWS_API_URL atualizado em $GH_REPO."
  else
    echo "AVISO: não foi possível gravar secret em $GH_REPO (use PAT ou defina manualmente)."
  fi
else
  echo "Configure: gh secret set PORTAL_AWS_API_URL --body \"$API_URL\""
fi

