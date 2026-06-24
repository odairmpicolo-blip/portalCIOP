#!/usr/bin/env bash
# Restaura acesso via github.io (remove redirecionamento para domínio sem DNS).
set -euo pipefail

REPO="${GITHUB_REPO:-odairmpicolo-blip/portalCIOP}"

echo "Removendo domínio customizado do GitHub Pages..."
gh api -X PUT "repos/${REPO}/pages" --input - <<'EOF'
{"build_type":"workflow","cname":null}
EOF

gh workflow run "Deploy GitHub Pages" --repo "${REPO}"
echo "Deploy disparado. Em ~1 min: https://odairmpicolo-blip.github.io/portalCIOP/"
