# Portal CIOP — App moderno

Frontend React + TypeScript do Portal CIOP/TCGL.

## Stack

- React 19 + Vite + TypeScript
- React Router
- Firebase Auth + Firestore (mesmo projeto `portal-ciop`)
- Bridge para páginas legadas HTML via `/legado/*`

## Desenvolvimento

```bash
cd portal-app
npm install
npm run dev
```

Abre em `http://localhost:5173/app/`

O servidor de desenvolvimento serve automaticamente `/pages/*`, `/assets/*` e `login.html` a partir da raiz do repositório — os iframes legados funcionam sem servidor extra.

Para API AWS local, copie `assets/data/portal-runtime.local.example.json` para `assets/data/portal-runtime.json` e suba o backend (`cd backend && npm run dev`).

## Build

```bash
npm run build
```

Gera a pasta `app/` na raiz do repositório (ao lado de `pages/` e `assets/`) para publicar em `/app/` no mesmo domínio do portal legado.

## Deploy recomendado

1. Desenvolver e testar no **portal-teste**
2. Rodar `npm run build` em `portal-app/`
3. Publicar a pasta `app/` junto com as páginas legadas (`/pages`, `/assets`)
4. Mesma origem = login Firebase compartilhado entre app novo e legado

## Variáveis

Copie `.env.example` para `.env` se precisar apontar legado para outra origem:

```
VITE_LEGACY_ORIGIN=https://seu-dominio.github.io
```

Em desenvolvimento local, deixe vazio — o Vite serve o legado na mesma origem.

## API AWS (dados ao vivo)

- **Produção:** defina `awsApiUrl` em `assets/data/portal-runtime.json` (veja `portal-runtime.production.example.json`)
- **Local:** use `portal-runtime.local.example.json` como base

## Migração

As telas internas ainda carregam o HTML legado em iframe. A migração pode ser feita módulo a módulo (folha, liberação, terminais…) substituindo cada rota `/legado/pages/...` por componentes React nativos.
