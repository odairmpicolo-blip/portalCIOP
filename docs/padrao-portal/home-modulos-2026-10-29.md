# Home — Todos os módulos (29/10/2026)

A página inicial (`index.html` + `portal-home-2026.js`) reúne o catálogo no mesmo fluxo do resumo.

## Estrutura

1. Topo: saudação, resumo, performance, horário e clima.
2. Quadro de avisos.
3. **Seus favoritos** — até 6 atalhos da conta (`portal-home-settings.js`), mesma origem dos cards do catálogo.
4. **Todos os módulos** — filtros Todos / Operação / Indicadores / Relatórios / TV.

Não há um segundo cadastro de módulos. Os cards continuam nas seções `#secaoOperacao`, `#secaoDashboards`, `#secaoRelatorios` e `#secaoTv`. Permissões (`data-perfis`, `data-usuarios`, `data-modulo`) e `href` não mudam.

## Filtro e busca

- Todos (padrão): grupos com o título da categoria.
- Uma categoria: só os módulos daquela seção.
- Busca do topo: todos os módulos permitidos, qualquer filtro. O card mostra a categoria (`.card-cat`). Ao limpar, o filtro que estava ativo volta.
- Menu lateral e dock: Início vai ao topo e seleciona Todos; Operação / Indicadores / Relatórios / TV selecionam o filtro e rolam até `#homeModulos`. Hashes `#inicio`, `#operacao`, `#indicadores`, `#relatorios`, `#tv` e histórico do navegador.

## Layout

Cards compactos: ícone, título, descrição curta, rótulo de acesso (Acessar / Lançar / Abrir). Grade 1 / 2 / 3 colunas (&lt;700 / ≥700 / ≥1100). Filtros em `flex-wrap`, alvo 44 px, `aria-pressed`. Sem rolagem horizontal na barra. No celular, folga `108px + safe-area` acima do dock.

Homônimos no catálogo: **Saída de carros — documentos** e **Saída de carros — escala e pátio**.

## Capturas

`docs/padrao-portal/assets/rev-20261029-home-modulos-*.png`
