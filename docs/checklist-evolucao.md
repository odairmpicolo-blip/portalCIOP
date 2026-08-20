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

- [ ] Arquitetura de API central (já existe `backend/` + Lambda; evoluir, não trocar por Laravel sem decisão)
- [ ] Separar regras de negócio do HTML
- [ ] Padronizar erros da API
- [ ] Validar entradas no servidor
- [ ] Logs centralizados

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

Próximo: **Fase 3 — back-end** (API `backend/` + Lambda), ou **Fase 5 — login** se a operação pedir segurança antes.
