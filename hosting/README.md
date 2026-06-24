# Domínio customizado (GitHub Pages)

## 1. Definir o subdomínio

Escolha **uma** opção:

**Opção A — arquivo (recomendado)**  
Crie `hosting/CNAME` com **uma linha**, só o host (sem `https://`):

```text
portal.seudominio.com.br
```

**Opção B — variável no GitHub**  
Repositório → **Settings → Secrets and variables → Actions → Variables**  
Nome: `PORTAL_CUSTOM_DOMAIN`  
Valor: `portal.seudominio.com.br`

## 2. DNS no Registro.br (ou outro provedor)

Para subdomínio `portal.seudominio.com.br`:

| Tipo | Nome | Valor |
|------|------|--------|
| **CNAME** | `portal` | `odairmpicolo-blip.github.io` |

Aguarde a propagação (minutos a algumas horas).

## 3. GitHub

1. **Settings → Pages** → Source deve ser **GitHub Actions** (após o primeiro deploy do workflow).
2. Em **Custom domain**, o GitHub pode mostrar o domínio após o deploy com `CNAME`.
3. Ative **Enforce HTTPS** quando o certificado estiver pronto.

URL temporária (sem domínio): `https://odairmpicolo-blip.github.io/portalCIOP/`

## 4. Firebase Authentication

Console Firebase → **Authentication → Settings → Authorized domains**  
Adicione: `portal.seudominio.com.br`

## 5. API AWS (se usar backend)

Em `backend/.env`, inclua o domínio em `CORS_ORIGINS`:

```env
CORS_ORIGINS=https://portal.seudominio.com.br,https://portal-ciop.web.app,http://localhost:5173
```

## 6. Deploy

O workflow `.github/workflows/deploy-github-pages.yml` publica automaticamente no push em `main`.  
Deploy manual: **Actions → Deploy GitHub Pages → Run workflow**.
