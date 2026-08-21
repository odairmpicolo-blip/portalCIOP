# Mapa do Portal CIOP — ambientes e integrações

Fonte de verdade da produção: GitHub `odairmpicolo-blip/portalCIOP` commit `342d41c` (main).  
Publicação em produção: `docs/fase-16-publicacao.md` (`scripts/publicar-producao.sh`).

## Ambientes

| Ambiente | Onde | Papel |
|---|---|---|
| Desenvolvimento | `~/portal-teste` → GitHub `portal-teste` | Validar mudanças |
| Produção | GitHub `portalCIOP` `main` | Código ao vivo |
| Site | GitHub Pages → **www.portalciop.com.br** (`hosting/CNAME`) | Portal estático |
| Auth | Firebase projeto `portal-ciop` | Login + Firestore (`usuarios/{email}`) |
| Dados operacionais | AWS sa-east-1, Aurora DSQL + Lambdas | API e syncs |

Não há Firebase Hosting. Apps Script (`.gs`) precisa reimplante manual no Google.

## Onde está cada peça

| Peça | Caminho / serviço |
|---|---|
| Portal clássico | `index.html`, `login.html`, `pages/`, `assets/` |
| Portal React / app | `portal-app/` → build em `app/` no workflow Pages |
| API Node | `backend/` (Express); Lambda `aws/portal-api` — ver `docs/fase-3-backend.md` |
| Syncs AWS | `aws/incidentes-sync`, `aws/liberacao-sync`, `aws/bus2-proxy` |
| Scripts / jobs | `scripts/`, `.github/workflows/` (cópias em `docs/github-workflows/`; tela Automações) |
| Regras Firestore | `firestore.rules` → `firebase deploy --only firestore:rules --project portal-ciop` |
| Domínio | `hosting/CNAME` = `www.portalciop.com.br` |

## Sistemas externos

| Sistema | Uso no portal | Como entra |
|---|---|---|
| Clever CAD | Incidentes TCGL | Scraping Lambda/Mac (`cioplondrina.com.br/CADIncidentManagement`) |
| Clever / Hitachi telemetria | KM, CAN, e-mail diário CSV | Planilha Google + Apps Script + Gmail |
| TCGL (planilha) | Telemetria hodômetro | Mesma planilha, aba TCGL |
| Fleetbus | Telemetria / mapa | Planilha + APIs Fleetbus nas páginas ao vivo |
| Bus2 / Mobilibus | Ônibus agora, horários | Lambda `bus2-proxy` |
| Noxxon | Comparação de KM | Páginas `km-dashboard`, `comparacao-km` (dados na página/planilha) |
| GPS Reports | Comparação de KM | Idem |
| MTRAN | Não usado no portal | Sem API no código (Fase 10) |
| Google Sheets / Apps Script | Folha, pontualidade, ICV, liberação, autuações, telemetria, **IA** | URLs em secrets GitHub / `.env` |
| Gemini | Relatório de ocorrência e consulta do decreto | Apps Script; chave só no Google |
| Firebase Auth + Firestore | Login e perfis | Projeto `portal-ciop` |

## Segredos (não versionar)

GitHub Secrets no `portalCIOP`: URLs de Apps Script, `DSQL_CLUSTER_ID`, chaves AWS, `PORTAL_AWS_API_URL`.  
Local: `backend/.env`, `~/.config/ciop-portal/incidentes.env`, Secrets Manager `portal-ciop/incidentes-sync`.
