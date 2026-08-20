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

- [ ] Revisar tabelas DSQL
- [ ] Duplicados / índices / consultas lentas
- [ ] Backup e restore testados
- [ ] Auditoria de alterações críticas

## Fase 5 — Login e segurança

- [ ] Revisar fluxo de login (Firebase)
- [ ] Tokens/sessões
- [ ] Perfis (admin, encarregado, monitoramento, planejamento, consulta)
- [ ] Recuperação de senha
- [ ] 2FA admin (se possível)
- [ ] Sem segredos no código público
- [ ] Regras de API e Firestore

## Fases 6–19

Interface, dashboard, incidentes, relatórios, integrações, tempo real, automações, performance, auditoria, testes, publicação, PWA, IA, manutenção — ainda não iniciadas.

Próximo: **Fase 4 — banco (DSQL)** — tabelas, índices, backup/restore, auditoria.
