#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AWS="${AWS_CLI:-aws}"

echo "==> Portal CIOP — setup Aurora DSQL local"
echo "    Cluster: ort34httzig7iktrneb4ytcy5u"

if ! command -v "$AWS" >/dev/null 2>&1; then
  echo "AWS CLI não encontrado. Instale: brew install awscli"
  exit 1
fi

if ! "$AWS" sts get-caller-identity >/dev/null 2>&1; then
  echo "Credenciais AWS ausentes. Rode:"
  echo "  aws login"
  exit 1
fi

cd "$ROOT/backend"
echo "==> Testando conexão DSQL..."
npm run db:test

echo "==> Aplicando schema..."
npm run db:migrate

echo "==> Importando snapshots locais..."
cd "$ROOT"
PORTAL_AWS_API_URL="${PORTAL_AWS_API_URL:-http://localhost:3000}" \
PORTAL_API_KEY="${PORTAL_API_KEY:-portal-dev-local}" \
node scripts/importar-snapshots-aws.mjs

echo ""
echo "Setup OK. Inicie a API com:"
echo "  cd backend && npm run dev"
echo ""
echo "Portal usa API em assets/data/portal-runtime.json (http://localhost:3000)"
