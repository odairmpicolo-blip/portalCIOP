# Portal CIOP

Portal interno com dados operacionais (terminais, liberação, folha de serviço, telemetria de veículos, ônibus Bus2, ICV, pontualidade e autuações), publicado em [www.portalciop.com.br](https://www.portalciop.com.br) via GitHub Pages.

## Visão geral

O repositório reúne **dois portais convivendo lado a lado**:

- **Portal clássico** — `index.html`, `login.html` e `pages/*.html`: páginas estáticas com CSS/JS embutidos, autenticação via Firebase Auth, publicadas diretamente no GitHub Pages.
- **Portal novo** (`portal-app/`) — React 19 + TypeScript + Vite + Capacitor (apps nativos Android/iOS). Carrega as telas antigas via iframe (`/legado/*`) e migra módulo a módulo. O build gerado pelo Vite fica em `app/` (não versionado — veja `.gitignore`) e é recriado a cada deploy pelo workflow `deploy-github-pages.yml`.

Complementam o sistema:

- **`backend/`** — API Node/Express (ESM) com rotas `/liberacao`, `/terminais`, `/snapshots`, `/telemetria`, conectando a um Postgres/Aurora DSQL. Roda standalone ou como função Lambda.
- **`aws/`** — subprojetos Lambda/SAM: `bus2-proxy` (proxy do BusTime/Bus2), `portal-api` (wrapper Lambda do `backend/`), `incidentes-sync` e `liberacao-sync` (sincronizações auxiliares).
- **`hosting/`** — apesar do nome, não é Firebase Hosting: contém o fallback SPA (`404.html`) e a configuração de domínio custom (`CNAME`) usada pelo GitHub Pages.
- **`scripts/`** — dezenas de scripts `.mjs`/`.sh` que alimentam os workflows agendados, puxando dados de planilhas Google via Apps Script e de planilhas locais (xlsx).
- **`.github/workflows/`** — workflows agendados descritos abaixo.

## Papel de cada peça de infraestrutura

| Peça | Função |
|---|---|
| **GitHub Pages** | Hospeda o portal estático (`index.html`, `pages/`, `app/`) no domínio customizado `www.portalciop.com.br`, publicado pelo workflow `deploy-github-pages.yml`. |
| **Firebase** | Usado somente para **Auth + Firestore** (login e controle de perfis de usuário em `usuarios/{email}`). Não há Firebase Hosting configurado (`firebase.json` não tem seção `hosting`). Alterações em `firestore.rules` só valem em produção depois de `firebase deploy --only firestore:rules`. |
| **AWS (Aurora DSQL + Lambda)** | Armazena snapshots de dados operacionais (folha de serviço, pontualidade, autuações, liberação) para consulta via `backend/`. O `backend/` também pode rodar como Lambda (`aws/portal-api`). |
| **GitHub Actions** | Além do deploy, roda os workflows agendados que baixam dados de planilhas/Apps Script e publicam JSONs estáticos consumidos pelo portal. |

## Como rodar localmente

### Portal clássico

Basta abrir `index.html` num servidor estático (por exemplo `npx serve .`) — não há build.

### Portal novo (`portal-app/`)

```bash
cd portal-app
npm install
npm run dev      # ambiente de desenvolvimento (Vite)
npm run lint      # eslint
npm run build     # gera o build em ../app
```

### Backend (`backend/`)

```bash
cd backend
npm install
cp .env.example .env   # preencha as variáveis (ver seção abaixo)
npm start               # ou: npm run dev (com --watch)
npm test                 # roda os testes (node --test)
```

### Scripts da raiz

```bash
npm install
node scripts/atualizar-terminais-planilha.mjs
node scripts/importar-telemetria-planilha-google.mjs
```

## Variáveis de ambiente / segredos necessários

Os scripts em `scripts/` e o `backend/` foram refatorados para ler URLs de Apps Script e o Cluster ID do Aurora DSQL a partir de variáveis de ambiente, sem valores padrão hardcoded. Para os workflows agendados funcionarem em produção, configure os seguintes **GitHub Secrets** no repositório (Settings → Secrets and variables → Actions):

| Secret | Usado por |
|---|---|
| `FOLHA_SERVICO_API_URL` | `atualizar-folha-servico.yml` (folha de serviço) |
| `PONTUALIDADE_PADRAO_URL`, `PONTUALIDADE_ALT_URL` | `atualizar-folha-servico.yml` (pontualidade) |
| `AUTUACOES_API_URL` | `atualizar-folha-servico.yml` (autuações) |
| `LIBERACAO_API_URL` | `atualizar-folha-servico.yml` e `atualizar-liberacao-hoje.yml` (liberação) |
| `ESCALA_SAIDA_API_URL` | `atualizar-folha-servico.yml` (escala de saída) |
| `DSQL_CLUSTER_ID`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | `atualizar-folha-servico.yml` (import DSQL) e `backend/` em produção (Lambda) |

Localmente, defina as mesmas variáveis em `backend/.env` (veja `backend/.env.example`) ou no shell antes de rodar os scripts. Se uma variável não estiver configurada, o script/rota correspondente registra um aviso no console e é ignorado (graceful degradation) em vez de quebrar a execução.

## Workflows agendados (`.github/workflows/`)

| Workflow | Frequência | O que faz |
|---|---|---|
| `atualizar-terminais.yml` | a cada 5 minutos | Snapshot de terminais a partir da planilha ao vivo. |
| `atualizar-liberacao-hoje.yml` | a cada 5 minutos | JSON de liberação do dia corrente. |
| `atualizar-telemetria.yml` | a cada 2 horas | Telemetria de veículos (Clever + TCGL + FleetBus). |
| `atualizar-folha-servico.yml` | a cada 30 minutos | Folha de serviço, pontualidade, autuações, liberação, ICV e import no Aurora DSQL. |
| `atualizar-bus2.yml` | diário (06h UTC) | Rotas e horários estáticos do Bus2. |
| `deploy-bus2-proxy.yml` | ao alterar `aws/bus2-proxy/**` | Deploy da Lambda de proxy do BusTime/Bus2. |
| `deploy-github-pages.yml` | a cada push relevante (`main`) | Build do `portal-app`, lint (não bloqueante), montagem do site estático e publicação no GitHub Pages. |

Todos os workflows agendados também podem ser disparados manualmente via `workflow_dispatch`.

## Testes

O `backend/` usa o test runner nativo do Node (`node --test`). Testes atuais cobrem as funções puras de agregação de telemetria em `backend/src/lib/telemetria-merge.js`:

```bash
cd backend
npm test
```

## Observações de segurança

- O CORS do backend bloqueia por padrão em produção quando `CORS_ORIGINS` não está configurada (fail-closed).
- O controle de acesso administrativo é feito 100% via coleção `usuarios` no Firestore (sem e-mails hardcoded no código).
- Alterações em `firestore.rules` precisam ser publicadas manualmente com `firebase deploy --only firestore:rules` — commitar o arquivo não é suficiente.
