# Manutenção do padrão

## Onde alterar

| Mudança | Arquivo | Depois |
| --- | --- | --- |
| Cor, vidro, espaço, raio, duração | `assets/css/portal-tokens.css` | Claro **e** escuro; bump `?v=` nos links / inject |
| Chrome de todas as internas | `portal-design-system.css` + `.js` | Não copiar a regra numa página |
| Home (saudação, dock, clima) | `portal-home-2026.css` / `portal-home-2026.js` | Não vaza para ICV |
| Tema, logo light/dark, evento | `theme-toggle.js` | Manter `dkEarlyBoot` no topo |
| Overlay, Portal, permissões | `auth.js` | |
| ICV vidro desktop | `portal-liquid-icv.css` + `icv-dashboard.js` | |
| Rodapé texto | `portal-footer.js` | |
| Esta documentação | `docs/padrao-portal/` | Índice + catálogo se o componente mudou |

Bump de cache vigente: tokens `?v=20261026liquid1`; home CSS `?v=20261026now3`, JS `now1`. Ao mudar o arquivo, **subir** o sufixo nos HTML que apontam direto e no `script.src` do inject (`theme-toggle.js`, `portal-design-system.js`, `auth.js`).

## Impacto

1. `rg` o token ou a classe.
2. Testar home + uma interna (ICV ou Autuações) + login + um kiosk se a mudança for de token global.
3. TV: se o seletor não for `.portal-glass-system`, o kiosk não deve mudar. Confirme que não usou `html` sem classe.
4. Papel/PDF: `.paper` deve continuar branco.

## Quando atualizar a documentação

**Sempre** que alterar token, componente compartilhado, chrome, cor operacional ou breakpoint, atualizar o `.md` correspondente em `docs/padrao-portal/` e, se o exemplo visual mudou, o [catalogo.html](catalogo.html) e as capturas em [assets/](assets/).

- Novo token, nova classe de botão, novo breakpoint da home, mudança Adiantado/Atrasado, novo módulo na home, aceite de validação.
- Não reescrever `docs/fase-*.md` (histórico). Só apontar para este padrão.

## Histórico relevante do padrão

| Quando | O quê | Onde |
| --- | --- | --- |
| 2026-08 | Fase 6: Inter, tokens iniciais, TV sem login | `docs/fase-6-interface.md` |
| 2026-10 | Chrome único: logo limpo, hamburger 44 px, botões, contraste | commit `50cd12c7`; `docs/interface/` |
| 2026-10 | Liquid Glass: tokens semânticos, três temas, foto visível, op-early/late, DS nas internas, ICV, fallback blur | publicado em teste `8403790d` / prod `b601e8147` |
| 2026-10 | Home rodada 2: sheet transparente, vidro só em nav/cards/avisos, blur 8 px, sidebar 204 px, catálogo em linhas, ICV/CAD ícones próprios, barra de performance | `portal-teste` (não publicar sem pedido) |
| 2026-10 | Widget hora+clima: um vidro, data por extenso, observação Open-Meteo atual vs mín/máx, estados indisponível/antigo | `portal-teste` |

## Responsável

Odair (engenharia do Portal CIOP). Publicação em produção só com pedido explícito, via clone `/tmp/portalciop-live` — ver `.cursor/rules/publicacao-ambientes.mdc`.

## Agentes e contribuição

Regra curta: `.cursor/rules/padrao-visual.mdc` (aponta para este diretório). Não duplicar estes capítulos em regras de agente.
