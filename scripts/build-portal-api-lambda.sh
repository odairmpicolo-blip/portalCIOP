#!/usr/bin/env bash
# Monta o pacote Lambda da API portal (Express + DSQL).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AWS_DIR="$ROOT/aws/portal-api"
BUILD="$AWS_DIR/.build"
FUNC_NAME="${PORTAL_API_LAMBDA_NAME:-portal-ciop-api}"
REGION="${AWS_REGION:-sa-east-1}"

echo "==> Build pacote Lambda portal-api"
rm -rf "$BUILD"
mkdir -p "$BUILD/backend"

cp "$AWS_DIR/index.mjs" "$BUILD/"
cp "$AWS_DIR/package.json" "$BUILD/"
cp "$AWS_DIR/package-lock.json" "$BUILD/" 2>/dev/null || true
rsync -a --exclude node_modules --exclude .env "$ROOT/backend/" "$BUILD/backend/"

SA_SRC=""
for p in "$ROOT/.secrets/serviceAccount.json" "$HOME/.config/portal-ciop/serviceAccount.json"; do
  if [[ -f "$p" ]]; then SA_SRC="$p"; break; fi
done
if [[ -n "$SA_SRC" ]]; then
  mkdir -p "$BUILD/.secrets"
  cp "$SA_SRC" "$BUILD/.secrets/serviceAccount.json"
  echo "==> Service account Firebase incluído no pacote Lambda"
fi

echo "==> npm install (handler + backend)"
cd "$BUILD"
npm ci --omit=dev 2>/dev/null || npm ci
cd "$BUILD/backend"
npm ci --omit=dev 2>/dev/null || npm ci

ZIP="$AWS_DIR/portal-api.zip"
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
  echo "  bash scripts/deploy-portal-api.sh"
fi
