#!/usr/bin/env bash
# Configura IAM + secrets GitHub para importação DSQL nos workflows.
# Uso: bash scripts/configure-github-dsql-secrets.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
USER_NAME="portal-ciop-github-actions"
CLUSTER_ID="ort34httzig7iktrneb4ytcy5u"
REGION="sa-east-1"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
POLICY_DOC=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "dsql:DbConnectAdmin",
      "Resource": "arn:aws:dsql:${REGION}:${ACCOUNT_ID}:cluster/${CLUSTER_ID}"
    }
  ]
}
EOF
)

echo "Conta AWS: $ACCOUNT_ID"
if ! aws iam get-user --user-name "$USER_NAME" >/dev/null 2>&1; then
  echo "Criando usuário IAM $USER_NAME..."
  aws iam create-user --user-name "$USER_NAME"
fi

echo "Aplicando política DSQL..."
aws iam put-user-policy \
  --user-name "$USER_NAME" \
  --policy-name portal-ciop-dsql-access \
  --policy-document "$POLICY_DOC"

echo "Criando access key..."
KEY_JSON=$(aws iam create-access-key --user-name "$USER_NAME" --output json)
ACCESS_KEY=$(python3 -c "import json,sys; print(json.load(sys.stdin)['AccessKey']['AccessKeyId'])" <<<"$KEY_JSON")
SECRET_KEY=$(python3 -c "import json,sys; print(json.load(sys.stdin)['AccessKey']['SecretAccessKey'])" <<<"$KEY_JSON")

for REPO in odairmpicolo-blip/portal-teste odairmpicolo-blip/portalCIOP; do
  echo "Secrets em $REPO..."
  gh secret set DSQL_CLUSTER_ID -b"$CLUSTER_ID" -R "$REPO"
  gh secret set AWS_ACCESS_KEY_ID -b"$ACCESS_KEY" -R "$REPO"
  gh secret set AWS_SECRET_ACCESS_KEY -b"$SECRET_KEY" -R "$REPO"
done

echo "Concluído. Access Key ID: $ACCESS_KEY (guarde o secret — exibido só na criação)."
echo "Teste: gh workflow run atualizar-terminais.yml -R odairmpicolo-blip/portal-teste"
