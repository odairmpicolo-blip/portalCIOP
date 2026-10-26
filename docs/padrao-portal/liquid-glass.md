# Liquid Glass

Implementação no portal clássico, inspirada em superfícies translúcidas (tipo vidro), **sem** framework novo.

## Como está no código

1. Tokens de preenchimento, blur, reflexo e sombra em `portal-tokens.css`.
2. Home: a fotografia (`.bg-wall`) é **suavizada** (`blur` ~12 px + véu), sem `filter` em texto ou ícone. O painel `.home-sheet` volta a ser vidro translúcido (`--home-sheet` ~40% claro / 50% fumê + blur 22 px). Cards, widget, performance e avisos usam `--home-card` mais denso (vidro fosco). Transparência só no `background`, nunca `opacity` no bloco.
3. Páginas internas: `theme-toggle.js` injeta `portal-design-system.js`, que marca `html.portal-glass-system` + `html#portal-page-glass` + `body#portal-page-content` e carrega `portal-design-system.css`.
4. Home (`html.portal-home-2026`) **não** entra no design system das internas.
5. Kiosk (`#kiosk`, `.kiosk`) recebe só `portal-glass-kiosk` — blur leve em painel, **sem** redesenhar o quadro 16:9.
6. ICV: `portal-liquid-icv.css` no desktop (≥721 px); shell nativo estreito permanece no CSS da página.

## Níveis de vidro

| Nível | Token | Blur | Onde usar |
| --- | --- | --- | --- |
| Light | `--portal-glass-light` | `--portal-blur-light` (10 px) | Dock, rodapé, picker, chips |
| Mid | `--portal-glass-mid` | `--portal-blur-mid` (16 px) | Cards, filtros, KPI, busca |
| Dense | `--portal-glass-dense` | `--portal-blur-dense` (22 px) | Header, sidebar, thead, menu |
| Tabela | `--portal-table` | dense | Tabelas e cards de gráfico (leitura de dados) |
| Modal | `--portal-modal` | dense | `<dialog>` de ajustes / avisos |
| Campo | `--portal-field` | — | input, select, textarea |

Não empilhar mid + dense + modal + mapa com blur ao mesmo tempo na mesma área.

## Anatomia de uma superfície

```css
.card {
  background: var(--portal-glass-mid);
  border: 1px solid var(--portal-border);
  border-radius: var(--portal-radius-lg);
  box-shadow: var(--portal-shadow-mid); /* inclui --portal-reflect no token mid */
  backdrop-filter: var(--portal-blur-mid);
  -webkit-backdrop-filter: var(--portal-blur-mid);
  color: var(--portal-text);
}
```

- **Transparência:** o rgba do token, não `opacity` no container (isso apagaria o texto).
- **Desfoque:** no fundo da home (foto) e no vidro (`backdrop-filter`). Texto e ícones ficam nítidos. Mapas Leaflet: `filter: none`.
- **Reflexo:** `--portal-reflect` (`inset 0 1px 0` branco 70% no claro, 10% no escuro).
- **Borda:** `--portal-border` clara no claro, linha fria no escuro.
- **Sombra:** `--portal-shadow-sm|mid|lg` — profundidade discreta.

## Leitura sobre a fotografia

Na home a foto fica **reconhecível e suave**: cores e silhuetas da cidade e dos ônibus, sem nitidez que dispute com o conteúdo. O véu `--portal-photo-veil` e o blur do `.bg-wall` fazem esse papel. Texto **nunca** vai direto na foto crua: vai sobre `.home-sheet` ou `--home-card`.

Se um rótulo falhar contraste, subir a opacidade do vidro daquele bloco — não remover o tratamento do painel nem tornar a foto nítida de novo.

## Claro e escuro

Claro: vidro branco translúcido, tinta `#102c53`. Escuro: vidro navy (`rgba(12, 36, 62, .52)` etc.), tinta `#f5f8ff`. A foto é a mesma; muda o véu e o vidro.

Login: o frost fica em `.login-glass::before`; o cartão do formulário é transparente para não dobrar o blur.

## Limites

- Máximo razoável: header dense + conteúdo mid + um modal.
- Não aplicar `backdrop-filter` em cada célula de tabela.
- Campanha da home (`--hero-mes-cor`) e artes de aniversário **não** são vidro temático.
- `.paper` / `.report-sheet`: fundo **branco opaco**, tinta `#102c53`, sem blur (impressão/PDF).

## Sem `backdrop-filter`

Já implementado em tokens, home e design system:

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  html {
    --portal-glass-light: var(--portal-fallback);
    --portal-glass-mid: var(--portal-fallback);
    --portal-glass-dense: var(--portal-fallback);
    --portal-modal: var(--portal-fallback);
    --portal-table: var(--portal-fallback);
    --portal-field: var(--portal-fallback);
  }
}
```

Home: `--home-sheet`, `--home-card` e `--home-nav` viram `--home-solid` (`--portal-fallback`). Sem `backdrop-filter`, o blur da foto também some.

## Desempenho e movimento

- `--portal-duration: 180ms`; com `prefers-reduced-motion: reduce` vira `0.01ms`.
- Home, DS e contagem de KPI desligam animation/transition no reduce.
- Evitar animar `width`/`filter` em loop. KPI: duração fixa (~0,85 s) e `dataset.counting` para o observer não reiniciar (`portal-futuristic.js`).
- Folha de serviço (`Folhadeservico.html`) é arquivo grande — **não** adicionar blur extra em cada card; risco de lentidão (pendência de medição).

## Fotos, mapas, documentos

| Superfície | Tema recolorindo? |
| --- | --- |
| `portal-londrina-fundo.png`, ônibus do login | Não |
| Logos PNG | Troca arquivo light/dark, sem filtro |
| Leaflet / tiles | `filter: none` |
| Controles de mapa | vidro dense + tinta do tema |
| PDF / papel de relatório | branco fixo |
