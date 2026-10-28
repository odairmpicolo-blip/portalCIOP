# Inventário da auditoria visual (outubro 2026)

Etapa 1: contraste por par superfície + escrita. Etapa 2: casco compartilhado (`portal-shell.js` + picker + campos). **Etapa 2 não concluída.** Cumprimento da Performance **não** calculado. Página que só abre **não** entra como aprovada.

## Conferência publicada (2026-10-28, noite)

Legenda de status: **implementado localmente** = working tree `portal-teste`; **publicado** = GitHub Pages (teste e/ou www) com o arquivo da correção; **verificado** = navegador ou HTTP confirmou o arquivo novo **e** o par superfície/escrita. Cache Fastly (`max-age=600`) foi medido; **não** explica o contraste quebrado — o HTML publicado já pedia `theme-toggle.js?v=20261028audit2` e o JS vinha 200.

| Página | Problema | Correção | Publicação | Evidência claro | Evidência escuro |
| --- | --- | --- | --- | --- | --- |
| Criar Relatório | `#enviarTopoBtn` / `#anexosBtn` `color:var(--blue)!important` no vidro escuro | `portal-page-contrast.css` + `color:var(--portal-on-field)`; bump `audit3` | Implementado localmente. Publicado: HTML pede `audit2` e `#enviarTopoBtn` ainda `var(--blue)!important`. Verificado nas páginas reais: **não** (redirect login). Probe local: ENVIAR claro `rgb(6,36,92)` / escuro `rgb(245,248,255)` sobre `rgba(255,255,255,.08)` | Probe claro: título `rgb(16,44,83)` | Probe escuro: título `rgb(245,248,255)` |
| Consumo Diário | KPI/título `color:var(--blue)` com `--text` fixo claro | Remap `--text/--surface` + títulos `--portal-text`; inject contrast | Implementado localmente. Publicado: HTML `audit2`. Verificado na página autenticada: não | Probe `.value` claro `rgb(16,44,83)` | Probe `.value` escuro `rgb(245,248,255)`; `td` `rgba(8,26,46,.78)` |
| Comparação de Performance | Idem KPI/título/botão ghost | Idem + `.kpi .value` / `.btn-ghost` | Implementado localmente. Publicado: HTML `audit2`. Verificado na página autenticada: não | Probe KPI `rgb(16,44,83)`; ghost `rgb(16,44,83)` | Probe KPI `rgb(245,248,255)`; ghost `rgb(245,248,255)` / `rgba(12,36,62,.52)` |
| IPV + Incidentes | KPI `#fff`; link `var(--blue)`; API 404 | Contrast + CSS da página; `GET /ipv-ajustado`; retry no status | Front/rota **implementados localmente**. Estático publicado: `theme-toggle audit2`, JS `20260820d`. API **não publicada**. Verificado live: 404 Express | Probe KPI claro `rgb(16,44,83)` | Probe KPI escuro `rgb(245,248,255)`; API `{"ok":false,"erro":"Rota não encontrada"}` |
| Telemetria | `theme-toggle` tarde; `--tel-navy` na escrita; header branco `!important` | Toggle no 1º script; remap `--tel-text`; header dark | Implementado localmente. Publicado: `theme-toggle` na linha 217 `audit2` (teste e prod). Verificado na página autenticada: não | Probe `.val` `rgb(16,44,83)` | Probe `.val` `rgb(245,248,255)` |
| Cumprimento diário | Fonte programadas/realizadas | — | Pendente. Não implementar | — | — |
| Total (ICV/TV) | Média vs soma/soma | — | Pendente confirmação | — | — |
| CIOP TV | Ciclo clima/campanha 1920 | — | Pendente validação completa | — | — |

HTTP da conferência (antes deste working tree): teste `criar-relatorio.html` e `theme-toggle.js?v=20261028audit2` **200**; produção Fastly HIT `max-age=600`. `GET https://62wvo4yk9b.execute-api.sa-east-1.amazonaws.com/cr0108/ipv-ajustado` → 404 `{"ok":false,"erro":"Rota não encontrada"}`.

## Superfícies compartilhadas

| Peça | Arquivo | Variantes a preservar |
| --- | --- | --- |
| Tokens claro/escuro | `assets/css/portal-tokens.css` | pares `--portal-*` / `--portal-on-*`; estados `--portal-state-*` |
| Chrome internas | `portal-design-system.css` + `.js` | home **não** usa este chrome |
| Home | `portal-home-2026.css` / `.js` | Início / área / outros |
| Tema | `theme-toggle.js` no `<head>` | Claro / Auto / Escuro; boot antes do paint |
| Casco header | `portal-shell.js` | marca \| título \| sessão; `data-portal-shell="off"` |
| Sessão, Portal, overlay | `auth.js` | permissões por card |
| Botões CAD / tabela | `portal-ui.css` | thead marca `#fff` sobre `--portal-fill-brand` |
| Filtros | `portal-filtros.css` | wrap `minmax(160px)`, rolagem da tabela em vez de fonte 9 px |
| TV / kiosk | `pages/painel-tv*.html`, `painel-ciop*.html`, `performance-tempo-real.html` | 16:9, paleta própria |

## Páginas (`pages/*.html` + raiz)

| Página | Papel | Tema | Estados | Etapa 1 | Aprovada |
| --- | --- | --- | --- | --- | --- |
| `login.html` | Acesso | claro/escuro | formulário | Código (pares tokens) | Não — reabrir nos dois temas |
| `index.html` | Home | claro/escuro/auto | vazio busca, aviso, clima | Tokens bump | Não — estados da home na etapa 3 |
| `docs/padrao-portal/catalogo.html` | Catálogo | claro/escuro | carregando (navegador); vazio/indisponível/histórico no markup; papel nos dois temas | Navegador + computed | **Sim — etapa 1** (2026-10-28) |
| `pages/icv.html` | Dashboard | DS | período + KPIs programadas/realizadas | Código | Não |
| `pages/pontualidade.html` | IPV | DS | KPI operacional | Código filtros/tabela | Não |
| `pages/pontualidade-ajustada.html` | Dashboard | DS | erro amigável API | — | Não |
| `pages/pontualidade-tempo-real.html` | Ao vivo | misto | — | — | Não |
| `pages/performance-tempo-real.html` | Kiosk pontualidade | paleta própria | ao vivo / stamp | Layout 3 colunas já existe | Não — cumprimento **bloqueado** |
| `pages/performance-comparacao.html` | Dashboard | DS | — | — | Não |
| `pages/incidentes-cad.html` | Dashboard | DS | filtros | CSS filtros | Não |
| `pages/incidentes-dashboard.html` | Dashboard | DS | — | — | Não |
| `pages/incidentes-analise.html` | Dashboard | DS | — | — | Não |
| `pages/autuacoes.html` | Dashboard | DS | — | — | Não |
| `pages/liberacao-*.html` | Lib. | DS + papel | — | — | Não |
| `pages/Folhadeservico.html`, `Folhadeservico1.html`, `folha-servico-relatorio.html` | Folha | DS | — | — | Não |
| `pages/criar-relatorio.html`, `criar-relatoriov2.html` | Form | DS | seletor modelo | — | Não |
| `pages/consulta-decreto.html` | Assistente | DS | console | — | Não |
| `pages/consulta-veiculo.html`, `consulta-funcionario.html`, `sei-horario.html` | Consulta | `theme-toggle` no head | — | FOUC mitigado no HTML | Não (sem sessão) |
| `pages/monitoramento.html`, `onibus-agora*.html`, `terminais-agora.html`, `fleetbus-agora.html` | Mapa | DS | — | — | Não |
| `pages/km-*.html`, `cr0108*.html`, `desempenho-motoristas.html`, `consumo-diario-*.html`, `comparacao-km.html`, `dados-telemetria.html` | Dash | misto | — | — | Não |
| `pages/gerenciapatio.html` | Pátio | legado | — | — | Não |
| `pages/admin-usuarios.html` | Admin | DS | — | — | Não |
| `pages/auditoria.html`, `auditoria-historico.html` | Auditoria | DS | — | — | Não |
| `pages/automacoes.html`, `integracoes.html` | Ops | DS | — | — | Não |
| `pages/relatorios.html`, `relatorio-ocorrencia.html` | Rel. | DS | — | — | Não |
| `pages/evidencias-*.html` | Evidências | — | — | Fora desta etapa | Não |
| `pages/tabelas-horarias.html`, `horarios-linha.html`, `onibus-horarios.html`, `escala-saida-carros.html` | Grade | filtros | — | CSS filtros | Não |
| `pages/percepcao-transporte.html`, `cartao-aniversario.html` | Especiais | — | — | — | Não |
| `pages/painel-tv.html`, `painel-tv-*`, `painel-ciop.html`, `painel-ciop-icv.html` | TV 16:9 | kiosk | ciclo clima/campanha | Etapa 3 | Não |
| `pages/_preview-*` | Fora | — | — | Não versionar | — |

## Pendências explícitas

1. **Cumprimento** — regra proposta documentada; fonte (programadas, realizadas, cancelamentos, extras, não vencidas, corte) não confirmada. Ver [performance-tempo-real.md](performance-tempo-real.md). **Permanece pendente.**
2. **Regra do Total** — ICV proposto soma/soma; TV hoje usa média aritmética. Sem confirmação, não alterar.
3. **TV** — ciclo clima/campanha em 1920 não foi varrido de ponta a ponta nesta rodada.
4. **Páginas autenticadas** — menus, modais, filtros, tabelas e gráficos não aprovados: exigem sessão.
5. **`/cr0108/ipv-ajustado`** — handler local; Lambda publicada ainda 404.
6. Modais da home: trap de foco não exercitado.

## Evidências desta etapa

Catálogo (dados fictícios), servidor local `:8768`. Página **não** aprovada como módulo operacional — só o chrome de referência.

| Tema | Topo (foto + vidro) | Computed (não vale só “abriu”) |
| --- | --- | --- |
| Claro | [catalogo-audit-claro-topo.png](assets/catalogo-audit-claro-topo.png) | Título `rgb(16,44,83)`; No horário `rgb(21,128,61)`; Adiantado `rgb(220,38,38)`; Atrasado `rgb(202,138,4)`; período `rgb(58,82,112)`; atualização `rgb(74,97,128)` |
| Escuro | [catalogo-audit-escuro-topo.png](assets/catalogo-audit-escuro-topo.png) | Título `rgb(245,248,255)`; No horário `rgb(74,222,128)`; Adiantado `rgb(248,113,113)`; Atrasado `rgb(250,204,21)`; campo `rgba(12,36,62,.52)` + texto `#f5f8ff`; desabilitado `rgb(138,160,184)` sobre `rgba(8,26,46,.28)`; papel `#fff` / `#102c53` |
| Escuro | Estados | Botão “Mostrar carregando” exibiu “Carregando período…” (snapshot). Vazio / indisponível / histórico no catálogo, não varridos visualmente nesta captura |

A automação do viewport não rolou até os KPIs na foto; os pares acima vieram de `getComputedStyle` no DOM.
