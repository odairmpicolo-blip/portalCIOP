# Validação

Ambiente: `portal-teste`, servidor estático local. **Não** publicar para validar UI. **Não** enviar relatório real nem alterar registro operacional. Demonstrações: dados fictícios ou já públicos no kiosk.

Larguras: 390, 768, 1366, 1920. Temas: claro, escuro, automático.

Inventário completo e status por página: [inventario-auditoria.md](inventario-auditoria.md). Auditoria 2026-10-28, **etapa 1 aprovada** no catálogo (claro/escuro, pares computed, estado carregando). Internas autenticadas e TV permanecem fora desta aprovação.

## Matriz (outubro de 2026)

Legenda: **Navegador** = exercitado com servidor local; **Código** = tokens/DS/HTML conferidos; **Login** = redireciona sem sessão; **Kiosk** = layout próprio; **Fora** = preview/app.

| Página | Papel | Temas | 390–1920 | Estados | Notas |
| --- | --- | --- | --- | --- | --- |
| `login.html` | Acesso | Navegador | Navegador 1920/390 | Formulário | Foto nos dois temas |
| `index.html` | Home | Navegador (ops1, claro+escuro, 1440; código 390/768/1366/1920) | Navegador + CSS | Login cobre sessão | `.home-ops` ~50/22/28; hora HH:mm; Adiantado rgb(220,38,38) / Atrasado rgb(202,138,4); welcome `#102c53` / `#f5f8ff` |
| `pages/icv.html` | Dashboard | Código | Código | Login | Gráfico reage a `dk-theme-change` |
| `pages/pontualidade.html` | IPV | Navegador (KPI + seletor + tabela, claro/escuro; fill ≠ color) | Código | Login | Adiantado `--portal-op-early`, Atrasado `--portal-op-late` |
| `pages/pontualidade-ajustada.html` | Dashboard | Navegador local (login) | Código | Erro + retry | Handler local; **publicado** ainda 404 |
| `pages/pontualidade-tempo-real.html` | Ao vivo | Código | Código | Login | Paleta kiosk-like |
| `pages/performance-tempo-real.html` | Dashboard | Código | Código | Login | |
| `pages/performance-comparacao.html` | Dashboard | Código | Código | Login | |
| `pages/incidentes-cad.html` | Dashboard | Código | Código | Login | Import `intervaloDatas` no backend |
| `pages/incidentes-dashboard.html` | Dashboard | Código | Código | Login | |
| `pages/incidentes-analise.html` | Dashboard | Código | Código | Login | |
| `pages/autuacoes.html` | Dashboard | Código | Código | Login | KPI counting |
| `pages/liberacao-*.html` | Lib. | Código | Código | Login | Papel branco no relatório |
| `pages/Folhadeservico.html` | Dashboard | Código | Código | Login | Arquivo pesado |
| `pages/criar-relatorio*.html` | Form | Navegador (seletor claro+escuro; página real redireciona sem sessão) | Código | Login / overlay | Não clicar Enviar; spans do botão = cor do botão; opção ativa azul |
| `pages/consulta-decreto.html` | Assistente | Código | Código | Login | Chat claro no `dk-light` |
| `pages/consulta-veiculo.html` | Consulta | Auth injeta tema | Código | Login | Risco de flash |
| `pages/consulta-funcionario.html` | Consulta | Auth injeta tema | Código | Login | Flash |
| `pages/monitoramento.html` | Mapa | Auth injeta tema | Código | Login | |
| `pages/onibus-agora*.html`, `terminais-agora.html`, `fleetbus-agora.html` | Mapa | Código | Código | Login | |
| `pages/km-*.html`, `cr0108*.html`, `desempenho-motoristas.html`, `consumo-diario-*.html` | Dash | Auth injeta tema | Código | Login | Flash |
| `pages/gerenciapatio.html` | Pátio | Auth injeta tema | Código | Login | Botão sol/lua legado |
| `pages/admin-usuarios.html` | Admin | Código | Código | Login | |
| `pages/painel-tv.html` | Kiosk | Fora desta rodada | — | — | Conferência 1920 foi no Painel CIOP |
| `pages/painel-ciop.html` | Kiosk | Navegador 1920 (capa, ipv, icv, clima, campanha) + clima 1366 | Sem overflow | Kiosk | Total = média; sem DS/contrast |
| `pages/painel-tv-*`, `painel-ciop-icv.html` | Kiosk | Fora | — | — | — |
| `docs/padrao-portal/catalogo.html` | Catálogo | Navegador (abrir local) | Conferir ao publicar doc | Dados fictícios | Sem auth, sem gravação |
| `_preview-*`, `portal-app` | Fora | Fora | Fora | — | |

## Aparência (15 critérios da modernização)

Ver canvas interno de validação e o relatório da rodada: foto; vidro; contraste; cores operacionais; filtros; dock; tabelas; gráficos; FOUC; persistência; modal; reduced motion; fallback blur; desempenho; APIs.

**Passou no navegador:** persistência de tema; Adiantado/Atrasado no TV; login claro/escuro.

**Parcial / código:** demais critérios. **Não exercitado:** modais com teclado, perfis, export, favoritos.

## Capturas comparativas

1. Mesma URL, mesmo recorte de dados.
2. Tema claro, depois escuro (picker), depois auto.
3. 390 / 768 / 1366 / 1920 (DevTools device mode).
4. Anonimizar e-mail real; preferir linha/prefixo fictícios.
5. Guardar PNG fora do Git se contiver dado operacional.

Capturas versionadas (catálogo, dados fictícios): [`assets/catalogo-claro.png`](assets/catalogo-claro.png), [`assets/catalogo-escuro.png`](assets/catalogo-escuro.png), [`assets/catalogo-kpis-claro.png`](assets/catalogo-kpis-claro.png).

Home unificada (prévia sem Firebase, 2026-10-26): [`assets/home-ops-claro-desktop.png`](assets/home-ops-claro-desktop.png), [`assets/home-ops-escuro-desktop.png`](assets/home-ops-escuro-desktop.png).

Seletor de modelo aberto (2026-10-26): [`assets/seletor-modelo-claro.png`](assets/seletor-modelo-claro.png), [`assets/seletor-modelo-escuro.png`](assets/seletor-modelo-escuro.png). Computed: claro, botão/span/SVG `rgb(16,44,83)`, ativa `rgb(18,101,194)` / `#fff`, status `rgb(58,82,112)`. Escuro: botão/span/SVG `rgb(245,248,255)`, ativa `rgb(29,111,191)` / `rgb(245,248,255)`, status `rgb(213,227,244)`.

Pontualidade KPI (2026-10-26): [`assets/pontualidade-kpi-claro.png`](assets/pontualidade-kpi-claro.png), [`assets/pontualidade-kpi-escuro.png`](assets/pontualidade-kpi-escuro.png). Escuro: `#melhorHorario` color **e** `-webkit-text-fill-color` `rgb(245,248,255)`, clip `border-box`; Adiantado `rgb(248,113,113)`; Atrasado `rgb(250,204,21)`; `.highlight-cell` fundo on-time 16% / texto `rgb(74,222,128)`; 1/3 inativo texto `rgb(245,248,255)` sobre `--portal-field`.

Widget hora+clima (2026-10-26): desktop claro conferido no navegador (data por extenso, 25 °C atual vs mín/máx, “Atualizado às”, ícone do sol em poço escuro). Escuro: tokens `--home-ink` `#f5f8ff` e vidro `rgba(8,24,42,.48)` no computed. ≤900 px o widget desce da saudação; ≤520 px os blocos empilham. Busca permanece 42 px.

Contraste (compact2): foto com blur ~12 px; `.home-sheet` ~30% claro / 46% fumê; cards ~40–56%. Saudação, subtítulo e contagens no painel (sem card). Widget hora+clima à direita da saudação em 1920/1366; empilhado em 100% da largura em 768/390 (não fica estreito à esquerda). Performance em faixa única com barra proporcional; Adiantado vermelho, Atrasado âmbar. Acessos rápidos ~429 px do topo no desktop. Dock não cobre conteúdo (`padding-bottom` 108 px ≤900 px).

Não há banco de “antes” da home autenticada. O catálogo serve de **depois** controlado.

## Problemas confirmados vs. suspeitas

| Item | Tipo | Status |
| --- | --- | --- |
| `intervaloDatas` em `/cr0108/cad` | Confirmado | Import no backend ok; front traduz a mensagem se a Lambda antiga ainda falhar |
| Front chama `/cr0108/ipv-ajustado` | Confirmado | Lambda 2026-10-29: **401** `TOKEN_AUSENTE` sem sessão |
| KPI reiniciava no meio da anima | Confirmado | `dataset.counting` |
| Logo overlay 404 | Confirmado | `dkTcglPath` usa URL absoluta; loading logos excluídos da troca |
| Decreto sempre escuro no claro | Confirmado | Override `dk-light .ai-console` |
| Ícone Portal duplicado | Confirmado | Dedupe |
| Flash de tema (páginas só com auth.js) | Mitigado | `theme-toggle.js` no `<head>` das internas; kiosk TV permanece com defer |
| Lentidão Folha + vidro | Suspeita | Não perfilado |
| Contraste em todas as 70 telas | Não varrido | Precisa sessão; etapa 1 só tokens/DS/filtros/tabela |
| Cumprimento na Performance ao vivo | Bloqueado | API do mapa sem programadas/realizadas/corte |
| Filtros comprimidos / thead 9 px | Confirmado | Wrap 160 px; thead 11 px; overflow-x; pares de campo no escuro |

## Aceite de mudança nova

1. Não altera fórmula/KPI.
2. Usa tokens; Adiantado vermelho; Atrasado âmbar.
3. Claro e escuro conferidos na página tocada + uma vizinha que compartilhe o CSS.
4. Sem regressão de permissão/export.
5. Documentação deste padrão atualizada se o chrome compartilhado mudou.
6. Sem publicar sozinho.
