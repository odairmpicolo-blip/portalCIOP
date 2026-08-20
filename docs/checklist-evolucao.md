# Checklist mestre — evolução do PortalCIOP

Uma fase por vez. Só marcar depois de testar.  
Trabalho neste repo (**portal-teste**); produção (**portalCIOP**) só com confirmação.

Baseline atual: arquivos iguais ao `portalCIOP` `main` `342d41c` (20/08/2026).

## Fase 1 — Organização

- [x] Backup: código de produção no GitHub (`portalCIOP` `main` `342d41c`); clone local `/tmp/portalciop-live`
- [x] Pastas atuais documentadas (não reorganizar agora — quebra Pages e links)
- [x] Ambientes: teste / produção / Pages — ver `docs/mapa-sistemas.md`
- [x] Onde estão GitHub, hospedagem, banco, auth e APIs — mesmo doc
- [x] Sistemas externos listados — mesmo doc (MTRAN fica para Fase 10)

## Fase 2 — Infraestrutura e domínio

Detalhes: `docs/fase-2-infra.md`

- [x] DNS `www` → GitHub Pages (CNAME OK). Apex `portalciop.com.br` ainda não resolve (opcional)
- [x] HTTPS em `www` (Let's Encrypt; HTTP 301). Sem HSTS (limite do Pages)
- [x] Backup de código no git; JSON via workflows. Restore DSQL e Firestore: Fase 4
- [x] Monitoramento: workflow `monitorar-portal.yml` (a cada 15 min)
- [x] Hospedagem Pages + Fastly suficiente para o estático
- [x] CDN: já é Fastly do GitHub Pages (`max-age=600`)

## Fase 3 — Back-end

Detalhes: `docs/fase-3-backend.md`

- [x] Arquitetura de API central (Express `backend/` + Lambda `portal-ciop-api`; sem Laravel)
- [x] Regras de negócio já no servidor (`backend/src/lib/` + rotas); HTML só consome
- [x] Erros padronizados (`ok`, `erro`, `codigo` + handler global)
- [x] Validar datas ISO no servidor (liberação, telemetria, relatórios)
- [x] Logs JSON por request (CloudWatch / terminal)

Pendências menores da fase: validar upload de relatórios/CR-0108 com o mesmo helper.

## Fase 4 — Banco

Detalhes: `docs/fase-4-banco.md`

- [x] Revisar tabelas DSQL (23 tabelas + 2 views + `audit_log`; CR-* fora do `schema.sql`)
- [x] Duplicados / índices / consultas lentas (`idx_cr_0108_dia_veiculo` válido; sem duplicados de PK)
- [x] Backup e restore testados (dump S3 + restore sonda de `avisos`; AWS Backup do cluster ainda exige outra conta)
- [x] Auditoria de alterações críticas (`audit_log` nas escritas da API)

## Fase 5 — Login e segurança

Detalhes: `docs/fase-5-login.md`

- [x] Revisar fluxo de login (Firebase e-mail/senha; sessão por aba; cadastro Firestore obrigatório)
- [x] Tokens/sessões (ID token ~1 h; API Bearer; revogação se houver SA)
- [x] Perfis (atuais + Encarregado, Planejamento, Consulta)
- [x] Recuperação de senha (`sendPasswordResetEmail` + alterar senha logado)
- [x] 2FA admin (TOTP no login e no painel Senha; ligar MFA no console Firebase)
- [x] Sem segredos no código público (`apiKey` Firebase é pública; SA e `.env` fora do git)
- [x] Regras de API e Firestore (cadastro ativo na API com SA; `firestore.rules` com deny default)

## Fase 6 — Interface

Detalhes: `docs/fase-6-interface.md`

- [x] Padronizar cores, fonte e botões (tokens + unify; TV permanece tema próprio)
- [x] Menu / voltar ao portal (dock na home; `btn-portal` ou injeção `portal-voltar-auto`)
- [x] Layout no celular (viewport + unify ≤720px + login ≤520px — conferir no aparelho)
- [x] Loading (overlay de sessão no `auth.js`)
- [x] Mensagens de erro no login (português). Feedback das APIs nas telas: Fase 7

## Fase 7 — Dashboard

Detalhes: `docs/fase-7-dashboard.md`

- [x] Painel principal (home com KPIs de contexto e cards)
- [x] Indicadores nas telas (IPV, ICV, KM, liberação, incidentes)
- [x] Filtros de período / busca (já nas telas; conferido)
- [x] Gráficos (Chart.js nas telas acima)
- [x] Atualizar / exportar (botão Atualizar, PDF/CSV onde já existia)
- [x] Erro da API na tela (`portal-dashboard-ui.js` + faixa nas telas IPV, liberação, incidentes)

## Fase 8 — Incidentes

Detalhes: `docs/fase-8-incidentes.md`

- [x] Listar / filtrar (TCGL, CAD, análise)
- [x] Status no CAD (filtro e gráfico; origem Clever)
- [x] Relatório interno (ocorrência PDF na AWS)
- [x] Aviso na home (pendências do analista)
- [x] Navegação entre as quatro telas
- [x] Erro da API na tela (CAD e ocorrência)

Cadastro/fechamento no Clever fica fora: o portal só lê o CAD.

## Fase 9 — Relatórios

Detalhes: `docs/fase-9-relatorios.md`

- [x] Catálogo (`relatorios.html`) com os relatórios em uso
- [x] Filtros e exportação CSV / Excel / PDF onde já existiam
- [x] Histórico de ocorrência (lista AWS) + criar PDF
- [x] CSV da comparação de KM
- [x] Data inválida recusada no upload de PDF (API; implantar Lambda)

Sem agendamento de PDF. A data inválida no upload de PDF vale depois de implantar a Lambda.

## Fase 10 — Integrações

Detalhes: `docs/fase-10-integracoes.md`

- [x] Sistemas externos mapeados (mapa + tela Integrações)
- [x] Checagem da API DSQL na tela (Administrador)
- [x] MTRAN: não existe no código — sem ligação inventada

## Fase 11 — Tempo real

Detalhes: `docs/fase-11-tempo-real.md`

- [x] Poll só com a aba visível (ônibus, horários, FleetBus; terminais já tinham)
- [x] Navegação entre as telas ao vivo
- [ ] WebSocket — não existe nas APIs atuais; não inventado
- [x] TV / quiosque sem redesign

## Fase 12 — Automações

Detalhes: `docs/fase-12-automacoes.md`

- [x] Jobs do GitHub Actions catalogados (tela + `docs/github-workflows/`)
- [x] Datas dos JSON na tela (sem secrets)
- [x] Apps Script listados (reimplante manual)
- [ ] E-mail / PDF agendado — não existe; não inventado
- [x] Incidentes: sem Action; CAD por Lambda/sync

## Fase 13 — Performance

Detalhes: `docs/fase-13-performance.md`

- [x] TV sem baixar o dump de 23 MB (resumo no manifest)
- [x] Fonte da TV sem `@import` bloqueante
- [x] Logo home/login com prioridade de fetch
- [ ] JSON operacional fora do git — fica para manutenção (Fase 19)

## Fases 14–19

Auditoria, testes, publicação, PWA, IA, manutenção.

Próximo: **Fase 14** — auditoria.
