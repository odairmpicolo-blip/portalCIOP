# Componentes

Só o que existe no portal clássico. Adaptação permitida: layout do módulo (grid, colunas da tabela). **Não permitido:** novo logo, nova paleta, segundo seletor de tema, copiar CSS de botão de outro HTML.

Classes globais: `assets/css/portal-design-system.css`. Home: `portal-home-2026.css`. Auth: `assets/js/auth.js`.

## Estrutura da página

```html
<html lang="pt-BR">
  <body>
    <header class="header">…</header>
    <main class="container">…</main>
    <!-- rodapé injetado por portal-footer.js se faltar -->
  </body>
</html>
```

O JS marca `html#portal-page-glass.portal-glass-system` e `body#portal-page-content`. Home usa `html#portal-home.portal-home-2026`.

## Cabeçalho e sessão

`.header` em flex, min-height ~72 px, logo `.portal-brand-art` (max 180×54), `.title-wrap` no centro, `.header-actions` à direita.

Sessão (injetada após login): `.ciop-session`, `.ciop-session-user`, `.ciop-session-cargo`, `.btn-senha-portal`, `.btn-logout`. Na home o “alterar senha” do header some; a troca de senha vive no diálogo de ajustes.

Voltar ao Portal: `.btn-portal` / `.portal-return` / `data-portal-voltar`. Se a página não tiver, `garantirVoltarAoPortal()` cria o link.

## Menu lateral e navegação móvel

**Só a home.** Sidebar fixa (`--home-side`: 204 px, 184 px ≤1200 px), vidro `--home-nav` (não opaco). Logo ≤148×78, proporção preservada. Só a área atual `.is-active`. Hover, `:focus-visible` e seleção são estados distintos. Campanha compacta; indicador “sistema online” permanece. Abaixo de 900 px: drawer + dock inferior (`.home-dock`, padding inferior `108px + env(safe-area-inset-bottom)`).

Hamburger `.menu-toggle` 44×44, SVG de três linhas. Overlay `#overlay`.

Páginas internas **não** repetem a sidebar: usam o botão Portal.

Kiosk: sem este menu.

## Busca

Home: `.ciop-search` + `.ciop-search-input` (altura 46 px, 16 px de fonte). Filtra cards (`ciop-search-hit` / `ciop-search-hidden`). Não é busca global do backend.

Consultas (veículo/funcionário/SEI): campo da própria página + classes `.cv-panel` cobertas pelo DS.

## Cards de módulos e favoritos

Home: `a.card` (catálogo em linha compacta) e `.home-quick a` (atalhos / favoritos pessoais, até 6, gravados no diálogo de ajustes — `portal-home-settings.js`). Descrições dos favoritos são encurtadas no `refresh()`; títulos permanecem completos. Visibilidade: `data-modulo`, `data-perfis`, `data-usuarios`; `auth.js` aplica `.portal-card-visivel`.

Não inventar card na home sem permissão.

## Indicadores (KPI)

Padrão de markup (ICV, IPV, dashboards):

```html
<article class="kpi-card">
  <div class="kpi-title">IPV</div>
  <div class="kpi-value">91,40%</div>
  <div class="kpi-sub">período 01/10 a 26/10</div>
</article>
```

Home: `.ciop-kpi` / `.home-header-stats` / `.home-perf-item`. Números `white-space: nowrap` + `tabular-nums` no DS. Adiantado/atrasado: [cores-operacionais.md](cores-operacionais.md).

## Widget hora e clima (home)

Um único vidro `.home-meta.home-now` à direita da saudação (`montarMeta` em `portal-home-2026.js`).

| Bloco | Conteúdo |
| --- | --- |
| `.home-now-time` | Hora `HH:mm` (`#ciopKpiHora`, `America/Sao_Paulo`, sem segundos, `tabular-nums`, largura fixa `5.6ch`) e data por extenso (`#ciopKpiData`: “Segunda-feira, 26 de outubro”) |
| `.home-now-wx` | Link para a previsão Climatempo (`aria-label` “Abrir previsão completa…”). Rótulo “Clima agora · Londrina”, ícone + temperatura atual, descrição, mín/máx do dia, horário da observação |

Fonte: Open-Meteo já usada (`current.temperature_2m`, `current.weather_code`, `current.is_day`; `daily` só para mín/máx). Não tratar a previsão diária como o valor “agora”.

Estados: dado fresco (“Atualizado às HH:mm”); cache antigo (`.is-stale`, “Última atualização às HH:mm”); falha sem cache (`.is-unavailable`, “Clima indisponível”). Ícone do sol com poço escuro e traço, para contrastar com a foto alaranjada. Sem animação contínua no widget.

Responsivo: ≤900 px o widget vai para baixo da saudação; ≤520 px os dois blocos empilham. A busca e a sessão no topo não entram nesse grid.

## Avisos e notificações

Home: `.notice-board` compacto (título + mensagem no centro; rótulo “Avisos” reduzido) + carrossel `.notice-item`; acento laranja de 2 px, não moldura. Botão `.notice-open` (“Ver aviso”) abre `#homeNoticesDialog`. Sino `.home-bell`. Toast `#homeSettingsToast`. Não usar o laranja de aviso no lugar de Atrasado.

## Botões e links

| Papel | Classes | Visual |
| --- | --- | --- |
| Primário / Portal | `.btn-primary`, `.btn-portal`, `.btn-accent`, `.portal-return` | `#1265c2` texto branco (DS com `!important`) |
| Secundário | `.btn-secondary`, `.btn-ghost`, `.btn-logout`, `.btn-senha-portal` | vidro + borda |
| Destrutivo | `.btn-danger` | `#b42318` texto branco |
| Texto | `.btn-link` | `--portal-link` (`#1265c2` / `#9ccfff`) |

Todos no DS: min-height 44 px, radius 12 px, Inter 650. Foco: outline 3 px `--portal-focus`.

## Campos, selects, datas e filtros

`input`, `select`, `textarea` (exceto checkbox/radio/range/color e `.ai-chat-input`): fundo `--portal-field` / painel, borda `--portal-line`, radius 11–12 px. `readonly` / `disabled`: opacity 0,7.

Filtros: `.filters`, `.filter-panel`, `.portal-filters-bar`, `.pa-filtros` em flex wrap; `.campo` / `.filter-group` `flex: 1 1 160px; min-width: 160px` — evita data cortada.

Date `type="date"` nativo. Placeholder = `--portal-text-secondary`.

## Abas e segmentados

Home (≤900 px): `.portal-abas` / `.portal-aba` com `aria-selected`. Picker de tema: `.dk-theme-picker`. Incidentes/mapas: `.cad-views`, `.st-subtabs`, `.mn-abas` — item `.ativo` com texto branco.

## Tabelas, paginação e exportações

Envolver em `.table-wrap` / `.table-wrapper` / `.tabela-wrap` / `.table-container` / `.table-scroll` (`overflow: auto`). `thead th` sticky, fundo dense. `.num` alinhado à direita.

Paginação: cada módulo (não há componente único). Export PDF/CSV: botões da página (ICV `btnExportarPdf`, pontualidade `pontualidade-relatorio-export.js`). **Não** alterar regra de negócio ao estilizar.

Linha vazia: `colspan` + “Sem dados neste recorte.” (ver ICV / IPV ajustado).

## Gráficos e legendas

Chart.js 4.x via jsDelivr (ICV). Eixos seguem o tema; séries operacionais seguem `--portal-op-*`. Legenda em texto, não só cor. Kiosk TV: números grandes, legendas clamp.

## Modais, tooltips e menus

Home: `<dialog id="homeSettingsDialog">` e `#homeNoticesDialog`, `::backdrop` escuro + blur 5 px, botão fechar 44 px. **Pendência:** trap de foco e Esc não foram exercitados na validação automatizada; o markup nativo `<dialog>` já fecha com Esc no Chromium.

Tooltip: token `--portal-tooltip` (fundo escuro, texto claro) — usar para texto curto.

Menu lateral: só home.

## Carregamento, vazio, sucesso e erro

- Overlay `#portalLoadingOverlay` (`auth.js` / `loading.js`) até validar sessão; `html.portal-auth-pending` bloqueia pointer.
- Status de dashboard: texto no toolbar (“Carregando período…”, “Serviço temporariamente indisponível.”).
- Vazio: “—” ou traço em KPI; mensagem na tabela. **Não** pintar zero quando a API não veio (KM da TV mostra `--`).
- Erro: português para o usuário; detalhe técnico no `console` ou em texto secundário.

## Controles de mapas

Leaflet sem invert. `.leaflet-control`, `.map-legenda`, `.oa-float`: vidro dense. Tiles e marcadores nas cores originais.

## Prévia de documentos e anexos

`.paper`, `.report-sheet`: branco, tinta `#102c53`, sem backdrop. Print: DS zera sombra/blur. Evidências: páginas próprias; não recolorir JPEG/PDF.
