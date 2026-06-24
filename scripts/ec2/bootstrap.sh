#!/bin/bash
# Bootstrap EC2 para sync incidentes (user-data).
set -euo pipefail
exec > /var/log/portal-incidentes-bootstrap.log 2>&1

dnf install -y git nodejs22 npm

APP=/opt/portal-ciop
REPO_URL="${INCIDENTES_REPO_URL:-https://github.com/odairmpicolo-blip/portal-teste.git}"
BRANCH="${INCIDENTES_REPO_BRANCH:-main}"

mkdir -p "$APP"
cd "$APP"
if [[ ! -d portal-teste/.git ]]; then
  git clone "__REPO_URL__" portal-teste
fi
cd portal-teste
git fetch origin
git checkout "__BRANCH__"
git pull origin "__BRANCH__"

cd backend
npm ci --omit=dev

mkdir -p /etc/portal-ciop
if [[ ! -f /etc/portal-ciop/incidentes.env ]]; then
  cat > /etc/portal-ciop/incidentes.env <<'EOF'
# Credenciais TCGL — edite nesta instância
export CIOP_INCIDENTES_USUARIO=
export CIOP_INCIDENTES_SENHA=
export DSQL_CLUSTER_ID=ort34httzig7iktrneb4ytcy5u
export DSQL_REGION=sa-east-1
export SYNC_INCIDENTES_SKIP_GIT=1
export PORTAL_ROOT=/opt/portal-ciop/portal-teste
EOF
fi

install -m 755 /opt/portal-ciop/portal-teste/scripts/ec2/run-incidentes-sync.sh /usr/local/bin/portal-incidentes-sync.sh

echo "0 9 * * * root /usr/local/bin/portal-incidentes-sync.sh" > /etc/cron.d/portal-incidentes-sync
chmod 644 /etc/cron.d/portal-incidentes-sync

echo "Bootstrap OK $(date -Is)"
