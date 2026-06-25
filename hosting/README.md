# Publicação estática (GitHub Pages)

O portal é hospedado **somente no GitHub Pages** — não usamos Firebase Hosting.

O workflow `.github/workflows/deploy-github-pages.yml` monta o site com:

- `app/` — portal React (`/app/`)
- `pages/`, `assets/` — módulos legados
- `index.html`, `login.html` — portal **clássico** (padrão); use `?app=1` para ir direto ao React
- Botão **Novo portal** na toolbar leva a `/app/`
- `404.html` — fallback SPA para rotas diretas como `/app/login`

## Domínio customizado

Copie `CNAME.exemplo` para `CNAME` com o domínio desejado, ou defina a variável `PORTAL_CUSTOM_DOMAIN` no GitHub.

## API AWS em produção

Configure o secret `PORTAL_AWS_API_URL` no repositório para injetar a URL no `portal-runtime.json` no deploy.
