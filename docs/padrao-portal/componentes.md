# Componentes

Só o que existe no portal clássico. Adaptação permitida: layout do módulo (grid, colunas da tabela). **Não permitido:** novo logo, nova paleta, segundo seletor de tema, copiar CSS de botão de outro HTML.

Classes globais: `assets/css/portal-design-system.css`. Home: `portal-home-2026.css`. Auth: `assets/js/auth.js`. Clima da TV: [clima-tv.md](clima-tv.md).

## Estrutura da página

```html
<html lang="pt-BR">
  <body>
    <header class="header">…</header>
    <main class="container">…</main>
    <!-- rodapé injetado por portal-footer.js se faltar (exceto na home) -->
  </body>
</html>
```

O JS marca `html#portal-page-glass.portal-glass-system` e `body#portal-page-content`. Home usa `html#portal-home.portal-home-2026`.

## Seletor de modelo

`.modelo-btn` + `.modelo-menu` / `.modelo-item` (criar relatório). Filhos do botão herdam a cor (`inherit` / `currentColor`). Opção ativa: fundo `--portal-option-selected`, texto `--portal-on-option-selected`. Não usar mint `#effcfb` com texto claro. Mensagens `.status` usam `--portal-text-secondary`. Detalhe dos pares: [temas-e-tokens.md](temas-e-tokens.md).

## Cabeçalho e sessão

`.header` em flex, min-height ~72 px, logo `.portal-brand-art` (`portal-ciop-claro.png` / `portal-ciop-escuro.png`, max ~168×52, `object-fit: contain`), `.title-wrap` no centro, `.header-actions` à direita.

Casco interno: `portal-shell.js` (via `theme-toggle.js`) normaliza `.header` em marca | título | `.header-actions` (sessão e extras da página). `data-portal-shell="off"` preserva cabeçalho próprio. Home e kiosk não usam este casco.

Sessão: um único componente em `assets/css/portal-session.css` e `auth.js` (`modernizarSessaoUsuario`). A home entra na mesma regra. Especificação, páginas e pendências: [sessao-usuario.md](sessao-usuario.md). “Senha” chama `toggleSenhaPanel()`; “Sair” chama `logout()`.

Seletor de tema: `.dk-theme-picker` fica imediatamente depois da sessão em `.header-actions`. Na home o seletor entra nos Ajustes. `theme-toggle.js` no `<head>` aplica `dk-light`/`dk-dark` antes da primeira pintura, inclusive Auto (sol em Londrina).

Voltar ao Portal: `.btn-portal` / `.portal-return` / `data-portal-voltar`. Se a página não tiver, `garantirVoltarAoPortal()` cria o link.

## Menu lateral e navegação móvel

**Só a home.** Painel `.home-sheet` translúcido sobre a fotografia suavizada. Sidebar fixa (`--home-side`: 204 px, 184 px ≤1200 px), vidro `--home-nav`. Logo `.home-logo` ≤156×58, proporção 1024/349. Só a área atual `.is-active`. Hover, `:focus-visible` e seleção são estados distintos. Campanha compacta; indicador “sistema online” permanece, com a versão **Portal CIOP · vX.Y.Z** logo abaixo (`meta[name=portal-ciop-version]`, igual a `package.json`; hoje `1.0.0`). No celular a versão fica no drawer, não no dock. A home não tem rodapé de copyright. Abaixo de 900 px: drawer + dock inferior (`.home-dock`, padding inferior `108px + env(safe-area-inset-bottom)`). Saudação compacta “Olá, Nome”; subtítulo logo abaixo; módulos, usuários e avisos em linha discreta à **direita** no desktop (abaixo em telas estreitas), com singular/plural. Nomes curtos iguais no menu, no dock e no título da área: **Início**, **Operação**, **Indicadores**, **Relatórios**, **Painéis de TV**.

Hamburger `.menu-toggle` 44×44, SVG de três linhas. Overlay `#overlay`.

Páginas internas **não** repetem a sidebar: usam o botão Portal.

Kiosk: sem este menu.

## Busca

Home: `.ciop-search` + `.ciop-search-input` (altura 46 px, 16 px de fonte). No **Início** filtra favoritos e os catálogos das quatro áreas; nas áreas do menu filtra **só o catálogo visível**. Placeholder e `aria-description` dizem o recorte. Vazio: `.home-search-empty` com texto e **Limpar busca**. Não é busca global do backend.

Consultas (veículo/funcionário/SEI): campo da própria página + classes `.cv-panel` cobertas pelo DS.

## Cards de módulos e favoritos

Home: `a.card` (catálogo compacto por área) e `.home-quick a` (somente os até 6 favoritos do usuário — `portal-home-settings.js`). Favoritos: ícone + título na mesma linha, descrição editorial curta abaixo, seta à direita. O catálogo: ícone à esquerda, bloco `.card-copy` (título acima, descrição curta abaixo) e seta à direita. Títulos completos (inclusive CR-0108); `overflow-wrap: break-word` sem partir palavra. Áreas: **Operação**, **Indicadores** (inclui monitoramento), **Relatórios**, **Painéis de TV**. Visibilidade: `data-modulo`, `data-perfis`, `data-usuarios`; `auth.js` aplica `.portal-card-visivel`.

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

`.kpi-value` precisa de `color` **e** `-webkit-text-fill-color` no mesmo token: no WebKit o fill pinta o glifo. Adiantado `.is-early` / Atrasado `.is-late`. Célula `.highlight-cell`: fundo misturado com `--portal-op-ontime` e o mesmo token no texto. Seletor `.scenario-button:not(.active)` usa `--portal-on-option` sobre `--portal-field`, não branco com texto claro.

Home: performance em faixa própria (`.home-perf` + `.home-perf-bar`), depois da saudação e do clima. Contagens de módulos/usuários/avisos à direita da saudação no desktop (`.home-header-stats` sem vidro), com “1 aviso” / “2 avisos”. Adiantado vermelho, Atrasado âmbar: [cores-operacionais.md](cores-operacionais.md).

## Widget hora e clima (home)

Um único vidro `.home-meta.home-now` à direita da saudação (`montarMeta` em `portal-home-2026.js`).

| Bloco | Conteúdo |
| --- | --- |
| `.home-now-time` | Hora `HH:mm` (`#ciopKpiHora`, `America/Sao_Paulo`, sem segundos, `tabular-nums`, largura fixa `5.6ch`) e data por extenso (`#ciopKpiData`: “Segunda-feira, 26 de outubro”) |
| `.home-now-wx` | Link para a previsão Climatempo (`aria-label` “Abrir previsão completa…”). Rótulo “Clima agora · Londrina”, ícone + temperatura e condição; na linha seguinte `Mín. 13° · Máx. 23°`; horário da observação em tamanho secundário. No `.home-ops`, o bloco fica **centralizado**. |

Fonte: Open-Meteo já usada (`current.temperature_2m`, `current.weather_code`, `current.is_day`; `daily` só para mín/máx). Não tratar a previsão diária como o valor “agora”.

Estados: dado fresco (“Atualizado às HH:mm” em linha própria, junto com o horário); cache antigo (`.is-stale`, “Última atualização às HH:mm”); falha sem cache (`.is-unavailable`, “Clima indisponível”). Ícone do sol com poço escuro e traço, para contrastar com a foto alaranjada. Sem animação contínua no widget.

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

`input`, `select`, `textarea` (exceto checkbox/radio/range/color e `.ai-chat-input`): fundo `--portal-field` / painel, borda `--portal-line`, radius 11–12 px. Superfície densa o bastante para ler sobre a fotografia (inclusive céu claro). **Não** usar `opacity` no controle inteiro.

| Estado | Superfície | Texto | Extra |
| --- | --- | --- | --- |
| Editável | `--portal-field` | `--portal-on-field` | |
| Somente leitura | `--portal-glass-dense` | `--portal-on-field` | `cursor: default`; não parece desabilitado |
| Desabilitado | `--portal-glass-dense` | `--portal-on-disabled` | borda tracejada; `cursor: not-allowed` |
| Carregando | `--portal-field` | `--portal-state-loading` | `.portal-field-loading` ou `aria-busy="true"`; `cursor: wait` |

Filtros: `.filters`, `.filter-panel`, `.portal-filters-bar`, `.pa-filtros` em flex wrap; `.campo` / `.filter-group` `flex: 1 1 160px; min-width: 160px` — evita data cortada.

Terminais Agora: `.controls-terminais` — coluna do `#terminalFiltro` com `min-width: 18.5rem` para caber “Todos os terminais” na fonte de 15 px (não reduzir o tipo). Abaixo de 1100 px o grid vira duas colunas; abaixo de 720 px, uma. Select usa `--portal-field` / `--portal-on-field`.

Date `type="date"` nativo. Placeholder = `--portal-text-secondary`.

## Linhas operacionais (próximas trocas)

`.exchange-item` (lista “Próximas” em Terminais Agora) e chips `.time-chip` / `.terminal-kpi-time` usam `--portal-field` + `--portal-on-field`. Nome e horário: `--portal-on-elevated` e negrito. Terminal, tipo, registro, início/fim e “Atualizado…”: `--portal-text-secondary`, ~12–13 px, peso 500 (não 800). Status: par próprio (`--portal-op-*` / aviso). Hover e `:focus-visible` usam `--portal-option-hover`. No escuro o card `.exchange-card` e `.terminal-kpi-card` não ficam brancos. Pares: [temas-e-tokens.md](temas-e-tokens.md).

## Abas e segmentados

Home (≤900 px): `.portal-abas` / `.portal-aba` com `aria-selected`. Picker de tema: `.dk-theme-picker`. Incidentes/mapas: `.cad-views`, `.st-subtabs`, `.mn-abas` — item `.ativo` com texto branco.

## Tabelas, paginação e exportações

Envolver em `.table-wrap` / `.table-wrapper` / `.tabela-wrap` / `.table-container` / `.table-scroll` (`overflow-x: auto`). Células `white-space: nowrap`. Não reduzir thead abaixo de 11 px: preferir rolagem horizontal. `thead` de marca (CAD): `--portal-fill-brand` + texto `#fff`. Corpo: `--portal-on-surface` sobre `--portal-table`. `.num` alinhado à direita.

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
- Carregando: `.portal-state-loading` (“Carregando período…”). É **transitório**. Ao terminar, mostrar `.portal-data-period` (recorte real) e `.portal-data-updated`. Se falhar: mensagem + **Tentar novamente**. No catálogo o botão “Mostrar carregando” resolve sozinho em ~700 ms (não fica preso).
- Vazio: `.portal-state-empty` — “—” no KPI, mensagem na tabela. **Não** pintar zero quando a API não veio.
- Indisponível: `.portal-state-unavailable` / `.is-unavailable`.
- Histórico / stale: `.portal-state-historic` / `.is-stale`. Não misturar com ao vivo.
- Período dos dados: `.portal-data-period` / `.kpi-sub`. Atualização: `.portal-data-updated` / `.atualizado` — linhas distintas.
- Erro: português para o usuário; detalhe técnico no `console`.

## Controles de mapas

Leaflet sem invert. `.leaflet-control`, `.map-legenda`, `.oa-float`: vidro dense. Tiles e marcadores nas cores originais.

## Prévia de documentos e anexos

`.paper`, `.report-sheet`: branco, tinta `#102c53`, sem backdrop. Print: DS zera sombra/blur. Evidências: páginas próprias; não recolorir JPEG/PDF.
