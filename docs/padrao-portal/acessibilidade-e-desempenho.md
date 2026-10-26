# Acessibilidade e desempenho

Meta: **WCAG 2.2 AA** no texto normal (contraste ≥ 4,5:1; texto grande ≥ 3:1). Tokens de texto foram escolhidos para vidro + foto; hex cinza médio (`#64748b`, `#94a3b8`, `#344054`) **proibido** no escuro.

## Contraste

Ver [temas-e-tokens.md](temas-e-tokens.md). Conferir:

1. Tema claro: títulos, descrição de card, cargo, mín/máx do clima, rodapé.
2. Tema escuro: o mesmo + cenário inativo, labels de KPI, `.btn-link`.
3. Login nos dois temas (label sobre vidro).
4. Papel/PDF permanece tinta escura em fundo branco.

`-webkit-text-fill-color` deve igualar `color`.

## Teclado, foco, labels

- Foco visível: outline 3 px `--portal-focus`, offset 3 px (DS e home).
- Skip link da home: `.home-skip` aparece no `:focus`.
- Labels associadas; `aria-label` no hamburger, no picker de tema, no sino.
- Abas: `aria-selected`. Picker: `aria-pressed`.
- Não remover o anel de foco.

## Modais

`<dialog>` nativo na home (ajustes e avisos). Fechar 44 px. Backdrop. **Pendência de validação:** foco inicial, Tab preso no diálogo e retorno ao gatilho não foram testados nesta modernização — ao alterar, testar com teclado.

## Toque e movimento

Alvos 44×44 (exceções antigas ≤600 px na home ainda apertam alguns controles — não copiar isso em página nova).

`prefers-reduced-motion: reduce`: `--portal-duration: 0.01ms`; home/DS `animation: none`; KPI sem tween; clima da home deve parar (respeitar o media nas animações novas).

## Gráficos

Eixo e valor em texto. Tabela abaixo do gráfico quando o módulo já tiver (ICV). Cor operacional + rótulo. Tooltip do Chart.js não é suficiente sozinho para leitor de tela.

## Blur e sombra

Três níveis no máximo na tela. Sem blur em cada `td`. Fallback opaco se não houver `backdrop-filter`. Mapas e folha pesada: não acrescentar camadas.

## Tabelas grandes, mapas, atualização

- Scroll no wrapper.
- MutationObserver de KPI ignora elemento com `dataset.counting`.
- Atualização ao vivo (TV, pontualidade): atualizar texto; não remontar o DOM inteiro se o módulo já faz patch.
- Leaflet: sem filtro CSS.

## Como verificar

1. DevTools → Rendering → `prefers-color-scheme` e `prefers-reduced-motion`.
2. Lighthouse / contraste no seletor de tema Claro e Escuro (não só no Auto).
3. Tab do login ao botão Entrar; Esc no `<dialog>`.
4. 390 px: dock vs. conteúdo.
5. Performance: scroll da Folha e de um mapa — se o vidro travar, reduzir blur daquela página, não desligar o token global.

Ferramenta de apoio do time: [validacao.md](validacao.md).
