# Como alterar o visual

1. Ler [padrao-visual.md](padrao-visual.md) e [contraste.md](contraste.md).
2. Mudar o **arquivo compartilhado**, não copiar CSS para a página.
3. Bump de cache (`?v=`) em `theme-toggle.js` (ele injeta o design system) ou no CSS da home.
4. Validar claro e escuro. Publicar só quando Odair pedir, teste primeiro, produção no clone `/tmp/portalciop-live`.

## Onde editar

| Precisa mudar | Arquivo |
| --- | --- |
| Logo claro/escuro | `assets/img/portal-logo-clean-*.png` + `theme-toggle.js` + `portal-brand.js` |
| Hamburger | `portal-design-system.js` (SVG) + CSS do design system / home |
| Botão Portal / Sair / primário | `portal-design-system.css` |
| Texto ilegível em várias páginas | tokens no design system |
| Só a home (saudação, clima, dock) | `portal-home-2026.css` / `.js` |
| Só um módulo (tabela, gráfico) | CSS da página, **sem** redefinir logo/menu |

## Página nova

1. `theme-toggle.js`
2. Cabeçalho com `img.portal-brand-art`
3. Botões nas classes do padrão (`btn-portal`, `btn-primary`, …)
4. Sem paleta nova e sem KPI inventado
