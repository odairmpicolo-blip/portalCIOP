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

- Padding do `body`: `20px 20px 20px calc(var(--home-side) + 36px)` (sem folga extra de rodapé).
- `--home-side`: **204 px** (~15% abaixo de 240); **184 px** em `max-width: 1200px`.
- `.home-sheet`: painel translúcido (vidro esbranquiçado no claro, fumê no escuro) sobre a foto suavizada. Cards em vidro fosco por cima.
- **Início** e **catálogo de área** são vistas distintas (`data-home-view`). Início: saudação, painel unificado (performance/hora/clima), avisos e até 6 favoritos — sem catálogo. Operação, Indicadores, Relatórios e Painéis de TV: um título da área + busca + só aquele catálogo. Sem repetir resumo, clima, avisos ou favoritos. Trocar de área faz `scroll` ao topo, fecha o menu móvel e sincroniza hash (`#inicio`, `#operacao`, `#indicadores`, `#relatorios`, `#tv`) com histórico do navegador.
- Grid de módulos (catálogo): 1 coluna abaixo de 1100 px de viewport (títulos longos, p.ex. CR-0108, não espremem); 2 colunas a partir de 1100 px; no máximo **3** a partir de 1680 px. Ícone à esquerda, texto empilhado, seta; altura automática. Gap **12–18 px**. Sem título duplicado (nada de “Operação” + “OPERAÇÃO”).
- Atalhos (só os 6 favoritos, só no Início): **3 colunas × 2 linhas** no desktop; **2** ≤900 px; **1** ≤560 px. Ícone e título na mesma linha, descrição curta completa abaixo, seta à direita. Gap **16 px**.
- Ícones ICV (prancheta + visto) e Incidentes CAD (lista com pontos) — não reutilizar o gráfico de barras.
- Sequência no Início: busca/conta → saudação + resumo → painel unificado (performance + hora + clima) → aviso → acessos rápidos. Nas áreas: busca/conta → título → catálogo.
- Hero: “Olá, Nome” compacto, subtítulo abaixo, resumo (módulos / usuários / avisos, com singular/plural) à **direita** no desktop e abaixo em telas estreitas. Um único `.home-ops` (~50% performance, ~22% hora, ~28% clima), padding 16–24 px, relógio afastado da divisória. Clima: temperatura e condição numa linha; `Mín. 13° · Máx. 23°` na seguinte. Intervalos: **16–20 px** entre cards, **24–28 px** entre seções.
- Avisos: faixa baixa; rótulo pequeno; detalhe laranja de 2 px à esquerda; botão “Ver aviso”.
- ≤900 px: sidebar vira drawer em vidro (`--home-nav`); dock fixo; padding-bottom `calc(108px + env(safe-area-inset-bottom))`.
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

`assets/js/portal-footer.js` padroniza `footer.portal-site-footer`: “© 2026 CIOP - Todos os direitos reservados”. O DS faz `margin-top: auto` em `body:has(> footer)` para colar o rodapé embaixo. A **home** (`portal-home-2026`) não usa esse rodapé: o script remove a faixa, não reinsere e não reserva espaço. A versão do portal vai no menu lateral, abaixo de “Sistema online”. Internas e CIOP TV mantêm o rodapé próprio.

Kiosk: rodapé próprio (data, hora, clima).

## Regras por largura de conferência

| Largura | O que olhar |
| --- | --- |
| 390 | Dock da home não cobre atalhos; login com cartão e logo; inputs 16 px; sem scroll horizontal acidental |
| 768 | Drawer/hamburger; filtros em 2+ linhas; tabela com scroll interno |
| 1366 | Home com sidebar; TV: meta pode wrap; dashboards com KPI numa fileira |
| 1920 | Home com mais colunas de cards; TV em composição cheia |

Outros cortes já no CSS: 359, 420, 480, 520, 600, 660, 720, 760, 900, 980, 1101, 1200, 1280, 1400, 1600, 2200. Não “arredondar” o design para uma escala Bootstrap.
