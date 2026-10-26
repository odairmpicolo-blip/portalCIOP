# Layouts e responsividade

Breakpoints **efetivos** no CSS atual (não inventar uma escala nova). Conferência pedida: **390, 768, 1366, 1920** CSS px.

## Famílias de tela

| Família | Arquivos típicos | Chrome |
| --- | --- | --- |
| Home | `index.html` | sidebar + sheet; dock &lt; 900 px |
| Dashboard | ICV, pontualidade, incidentes, autuações, KM, CR-0108, liberação | header + filtros + KPI + gráfico/tabela |
| Formulário | criar-relatório, evidências, liberação-lançamento, Folhadeservico1 | header + campos; sem sidebar |
| Consulta | decreto, veículo, funcionário, SEI | header + painel |
| Relatório / papel | `liberacao-relatorio`, prévias | `.paper` branco |
| Mapa | ônibus agora, terminais, monitoramento, pátio | mapa tela cheia + controles flutuantes |
| Kiosk TV | `painel-tv.html`, `painel-tv-*`, `painel-ciop*` | 16:9, sem login Firebase |

## Home

- Padding do `body`: `24px 24px 48px calc(var(--home-side) + 48px)`.
- `--home-side`: 240 px; 210 px em `max-width: 1200px`.
- Sheet max 1720 px, radius 28 px.
- Grid de módulos: 3 colunas; 4 col ≥1280; 5 ≥1600; 6 ≥2200; 2 ≤1200; 1 ≤600.
- Atalhos: `minmax(160px, 1fr)`, min-height ~108–128 px (descrição com 2 linhas).
- Hero: saudação + clima; comando (KPI + performance) na linha de baixo ≥720 px.
- ≤900 px: sidebar vira drawer; dock fixo; padding-bottom `calc(108px + env(safe-area-inset-bottom))`.
- ≤600 px: busca em 100% da largura; KPI em uma coluna.

## Dashboard / formulário / consulta

Header compacto (logo | título que quebra com `overflow-wrap: anywhere` | ações). `main.container` `max-width: 100%`, `min-width: 0`.

Filtros: min 160 px por campo, wrap. KPI: `repeat(auto-fit, minmax(160px, 1fr))`, valor `nowrap`.

ICV desktop (≥721): `portal-liquid-icv.css`. Abaixo disso o CSS da própria página (shell mais “nativo”) permanece — não forçar o vidro desktop no celular do ICV.

## Relatório

Prévia A4/papel isolada do tema. Botões de gerar/exportar ficam fora da folha.

## Mapa

Mapa em `flex: 1`. Legenda e filtros em vidro, não em barra opaca que cubra o pátio. Sem `filter: invert` nos tiles.

## Painel de TV

- Pensado em **1920×1080**. Em **1366×768** a meta (`.tv-visao-meta`) **quebra linha**; os números usam `clamp` e não devem partir no meio do percentual.
- `@media (max-width: 1400px)` reduz padding/hero.
- Sem dock da home, sem picker de tema no quadro (o `theme-toggle.js` ainda pode persistir preferência).
- Relógio e rodapé na base; overlay de boot some quando os dados chegam.
- KM sem publicação mostra `--`, não `0`.

## Títulos longos, filtros, cards

Título do header: `clamp(16px, 2vw, 22px)` + wrap. Cards da home: descrição `overflow-wrap: anywhere`. Filtros não encolhem abaixo de 160 px (evita data cortada).

## Tabelas

Scroll no **wrapper**, não na `body` se a tabela for o bloco principal. Thead sticky. Colunas `.num` à direita. Não há freeze de primeira coluna genérico no DS — só se o módulo já tiver.

## Rodapé

`assets/js/portal-footer.js` padroniza `footer.portal-site-footer`: “© 2026 CIOP - Todos os direitos reservados”. O DS faz `margin-top: auto` em `body:has(> footer)` para colar o rodapé embaixo.

Kiosk: rodapé próprio (data, hora, clima).

## Regras por largura de conferência

| Largura | O que olhar |
| --- | --- |
| 390 | Dock da home não cobre atalhos; login com cartão e logo; inputs 16 px; sem scroll horizontal acidental |
| 768 | Drawer/hamburger; filtros em 2+ linhas; tabela com scroll interno |
| 1366 | Home com sidebar; TV: meta pode wrap; dashboards com KPI numa fileira |
| 1920 | Home com mais colunas de cards; TV em composição cheia |

Outros cortes já no CSS: 359, 420, 480, 520, 600, 660, 720, 760, 900, 980, 1101, 1200, 1280, 1400, 1600, 2200. Não “arredondar” o design para uma escala Bootstrap.
