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
| Clima TV (ícone, dia/noite, cena) | `portal-clima-cena.js` + `portal-clima-anim.css` | Não copiar SVG WMO nas páginas |
| Composição do Painel CIOP | `pages/painel-ciop.html` | Ver [ciop-tv.md](ciop-tv.md). Não alterar a média nem o Total |
| Performance ao vivo (pontualidade) | `pages/performance-tempo-real.html` | Ver [performance-tempo-real.md](performance-tempo-real.md). Não mudar a média do mapa |

Bump de cache vigente **no working tree**: tokens/DS/contrast `?v=20261028audit3`; `theme-toggle.js` `audit3` nas páginas desta revisão. **Publicado** (teste `ebe86169`, prod `bcef572cf`, conferência 2026-10-28): ainda `audit2`. Fastly em produção usa `max-age=600`; o HTML publicado já pedia `audit2` e o JS correspondente vinha 200 — a pendência de contraste não era cache, era CSS da página com `--blue` na escrita. Ao mudar o arquivo, **subir** o sufixo nos HTML que apontam direto e no inject.

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
| 2026-10 | Foto da home suavizada; painel `.home-sheet` translúcido de novo; cards foscos; textos nítidos | `portal-teste` |
| 2026-10 | Home compacta: saudação no painel, clima à direita, sem faixa extra de contagens | `portal-teste` |
| 2026-10 | Home: Início separado do catálogo de área; um título; cards ícone+texto; Indicadores no menu/dock; busca por área | `portal-teste` (não publicar sem pedido) |
| 2026-10 | Home sem rodapé de copyright; versão no menu abaixo de Sistema online (`package.json` / meta `1.0.0`) | `portal-teste` |
| 2026-10 | Home: refino de saudação, painel 50/22/28, aviso e favoritos 3×2 | `portal-teste` |
| 2026-10 | Início mostra as quatro áreas abaixo dos favoritos | `portal-teste` (não publicar sem pedido) |
| 2026-10 | Performance ao vivo: cumprimento do dia fechado por empresa, separado da pontualidade | `portal-teste` |
| 2026-10 | Performance ao vivo: cumprimento passa a ser o do CAD até o horário da leitura | `portal-teste` |
| 2026-10 | Performance ao vivo: volta à tela de pontualidade anterior ao cumprimento | `portal-teste` |

## Responsável

Odair (engenharia do Portal CIOP). Publicação em produção só com pedido explícito, via clone `/tmp/portalciop-live` — ver `.cursor/rules/publicacao-ambientes.mdc`.

## Agentes e contribuição

Regra curta: `.cursor/rules/padrao-visual.mdc` (aponta para este diretório). Não duplicar estes capítulos em regras de agente.
