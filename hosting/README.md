# Domínio customizado (GitHub Pages)

Domínio configurado: **portalciop.com.br**

## 1. DNS no Registro.br

Para o domínio raiz `portalciop.com.br`, crie **4 registros A** apontando para o GitHub Pages:

| Tipo | Nome | Valor |
|------|------|--------|
| **A** | `@` (ou vazio) | `185.199.108.153` |
| **A** | `@` | `185.199.109.153` |
| **A** | `@` | `185.199.110.153` |
| **A** | `@` | `185.199.111.153` |

Opcional — se quiser `www.portalciop.com.br` também:

| Tipo | Nome | Valor |
|------|------|--------|
| **CNAME** | `www` | `odairmpicolo-blip.github.io` |

Aguarde a propagação (minutos a algumas horas).

## 2. GitHub

1. **Settings → Pages** → Source: **GitHub Actions**
2. Após o deploy, confira **Custom domain**: `portalciop.com.br`
3. Ative **Enforce HTTPS** quando o certificado estiver pronto

URL temporária (sem DNS): `https://odairmpicolo-blip.github.io/portalCIOP/`

## 3. Firebase Authentication

Console Firebase → **Authentication → Settings → Authorized domains**  
Adicione: `portalciop.com.br`

## 4. API AWS (se usar backend)

Em `backend/.env`, inclua o domínio em `CORS_ORIGINS`:

```env
CORS_ORIGINS=https://portalciop.com.br,https://portal-ciop.web.app,http://localhost:5173
```

## 5. Deploy

O workflow `.github/workflows/deploy-github-pages.yml` publica no push em `main`.  
Deploy manual: **Actions → Deploy GitHub Pages → Run workflow**.

O domínio está em `hosting/CNAME` (commitado no repositório).

