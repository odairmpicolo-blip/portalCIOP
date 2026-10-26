# Validação

Ambiente: `portal-teste`, servidor estático local. **Não** publicar para validar UI. **Não** enviar relatório real nem alterar registro operacional. Demonstrações: dados fictícios ou já públicos no kiosk.

Larguras: 390, 768, 1366, 1920. Temas: claro, escuro, automático.

## Matriz (outubro de 2026)

Legenda: **Navegador** = exercitado com servidor local; **Código** = tokens/DS/HTML conferidos; **Login** = redireciona sem sessão; **Kiosk** = layout próprio; **Fora** = preview/app.

| Página | Papel | Temas | 390–1920 | Estados | Notas |
| --- | --- | --- | --- | --- | --- |
| `login.html` | Acesso | Navegador | Navegador 1920/390 | Formulário | Foto nos dois temas |
| `index.html` | Home | Navegador (ops1, claro+escuro, 1440; código 390/768/1366/1920) | Navegador + CSS | Login cobre sessão | `.home-ops` ~50/22/28; hora HH:mm; Adiantado rgb(220,38,38) / Atrasado rgb(202,138,4); welcome `#102c53` / `#f5f8ff` |
| `pages/icv.html` | Dashboard | Código | Código | Login | Gráfico reage a `dk-theme-change` |
| `pages/pontualidade.html` | IPV | Código | Código | Login | |
| `pages/pontualidade-ajustada.html` | Dashboard | Código | Código | Erro amigável | API `/ipv-ajustado` ausente |
| `pages/pontualidade-tempo-real.html` | Ao vivo | Código | Código | Login | Paleta kiosk-like |
| `pages/performance-tempo-real.html` | Dashboard | Código | Código | Login | |
| `pages/performance-comparacao.html` | Dashboard | Código | Código | Login | |
| `pages/incidentes-cad.html` | Dashboard | Código | Código | Login | Import `intervaloDatas` no backend |
| `pages/incidentes-dashboard.html` | Dashboard | Código | Código | Login | |
| `pages/incidentes-analise.html` | Dashboard | Código | Código | Login | |
| `pages/autuacoes.html` | Dashboard | Código | Código | Login | KPI counting |
| `pages/liberacao-*.html` | Lib. | Código | Código | Login | Papel branco no relatório |
| `pages/Folhadeservico.html` | Dashboard | Código | Código | Login | Arquivo pesado |
| `pages/criar-relatorio*.html` | Form | Código | Código | Login | Não clicar Enviar |
| `pages/consulta-decreto.html` | Assistente | Código | Código | Login | Chat claro no `dk-light` |
| `pages/consulta-veiculo.html` | Consulta | Auth injeta tema | Código | Login | Risco de flash |
| `pages/consulta-funcionario.html` | Consulta | Auth injeta tema | Código | Login | Flash |
| `pages/monitoramento.html` | Mapa | Auth injeta tema | Código | Login | |
| `pages/onibus-agora*.html`, `terminais-agora.html`, `fleetbus-agora.html` | Mapa | Código | Código | Login | |
| `pages/km-*.html`, `cr0108*.html`, `desempenho-motoristas.html`, `consumo-diario-*.html` | Dash | Auth injeta tema | Código | Login | Flash |
| `pages/gerenciapatio.html` | Pátio | Auth injeta tema | Código | Login | Botão sol/lua legado |
| `pages/admin-usuarios.html` | Admin | Código | Código | Login | |
| `pages/painel-tv.html` | Kiosk | Navegador | 1920 e 1366 | Vazio KM; sucesso IPV | Adiantado vermelho / Atrasado âmbar |
| `pages/painel-tv-*`, `painel-ciop*` | Kiosk | Fora do DS home | Não abertos nesta rodada | — | Composição TV |
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

Widget hora+clima (2026-10-26): desktop claro conferido no navegador (data por extenso, 25 °C atual vs mín/máx, “Atualizado às”, ícone do sol em poço escuro). Escuro: tokens `--home-ink` `#f5f8ff` e vidro `rgba(8,24,42,.48)` no computed. ≤900 px o widget desce da saudação; ≤520 px os blocos empilham. Busca permanece 42 px.

Contraste (compact2): foto com blur ~12 px; `.home-sheet` ~30% claro / 46% fumê; cards ~40–56%. Saudação, subtítulo e contagens no painel (sem card). Widget hora+clima à direita da saudação em 1920/1366; empilhado em 100% da largura em 768/390 (não fica estreito à esquerda). Performance em faixa única com barra proporcional; Adiantado vermelho, Atrasado âmbar. Acessos rápidos ~429 px do topo no desktop. Dock não cobre conteúdo (`padding-bottom` 108 px ≤900 px).

Não há banco de “antes” da home autenticada. O catálogo serve de **depois** controlado.

## Problemas confirmados vs. suspeitas

| Item | Tipo | Status |
| --- | --- | --- |
| `intervaloDatas` em `/cr0108/cad` | Confirmado | Import no backend ok; front traduz a mensagem se a Lambda antiga ainda falhar |
| Front chama `/cr0108/ipv-ajustado` | Confirmado | Rota não implementada; mensagem humana |
| KPI reiniciava no meio da anima | Confirmado | `dataset.counting` |
| Logo overlay 404 | Confirmado | `dkTcglPath` usa URL absoluta; loading logos excluídos da troca |
| Decreto sempre escuro no claro | Confirmado | Override `dk-light .ai-console` |
| Ícone Portal duplicado | Confirmado | Dedupe |
| Flash de tema (páginas só com auth.js) | Confirmado (mecanismo) | Proposta: script no head |
| Lentidão Folha + vidro | Suspeita | Não perfilado |
| Contraste em todas as 70 telas | Não varrido | Precisa sessão |

## Aceite de mudança nova

1. Não altera fórmula/KPI.
2. Usa tokens; Adiantado vermelho; Atrasado âmbar.
3. Claro e escuro conferidos na página tocada + uma vizinha que compartilhe o CSS.
4. Sem regressão de permissão/export.
5. Documentação deste padrão atualizada se o chrome compartilhado mudou.
6. Sem publicar sozinho.
