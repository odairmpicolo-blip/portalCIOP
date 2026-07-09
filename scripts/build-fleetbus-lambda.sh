#!/usr/bin/env bash
# Monta o pacote Lambda do fleetbus-sync e atualiza a função.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AWS_DIR="$ROOT/aws/fleetbus-sync"
BUILD="$AWS_DIR/.build"
FUNC_NAME="${FLEETBUS_LAMBDA_NAME:-portal-ciop-fleetbus-sync}"
REGION="${AWS_REGION:-sa-east-1}"

echo "==> Build pacote Lambda fleetbus-sync"
rm -rf "$BUILD"
mkdir -p "$BUILD"
cp "$AWS_DIR/index.mjs" "$BUILD/"
cp "$AWS_DIR/package.json" "$BUILD/"

echo "==> npm install (Lambda fleetbus-sync)"
(cd "$BUILD" && npm install --omit=dev >/dev/null 2>&1 || npm install)

ZIP="$AWS_DIR/fleetbus-sync.zip"
rm -f "$ZIP"
(cd "$BUILD" && zip -rq "$ZIP" . -x "*.git*")

echo "==> Pacote: $ZIP ($(du -h "$ZIP" | awk '{print $1}'))"

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI não encontrado. Pacote gerado; deploy manual:"
  echo "  aws lambda update-function-code --function-name $FUNC_NAME --zip-file fileb://$ZIP --region $REGION"
  exit 0
fi

if ! aws sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
  echo "Sem credenciais AWS. Pacote gerado em $ZIP"
  exit 0
fi

if aws lambda get-function --function-name "$FUNC_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "==> Atualizando código Lambda $FUNC_NAME"
  aws lambda update-function-code \
    --function-name "$FUNC_NAME" \
    --zip-file "fileb://$ZIP" \
    --region "$REGION" \
    --no-cli-pager
  echo "Deploy OK."
else
  echo "Função $FUNC_NAME não existe. Rode primeiro:"
  echo "  bash scripts/deploy-fleetbus-lambda.sh"
fi
