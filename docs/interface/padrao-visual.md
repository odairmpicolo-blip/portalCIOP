# Padrão visual — Portal CIOP

Pasta: [`docs/interface/`](README.md). Contraste: [`contraste.md`](contraste.md).

Fonte viva do chrome compartilhado. Páginas operacionais entram nele via `theme-toggle.js` → `portal-design-system.js`. A home (`portal-home-2026`) tem o mesmo logo e o mesmo hamburger, com layout próprio.

CIOP TV / kiosk (`#kiosk`, `.kiosk`, `portal-glass-kiosk`) **não** usam este chrome: mantêm o quadro 16:9.

## Logo

Arquivos oficiais (não redesenhar, não sobrepor outra marca):

- Claro: `assets/img/portal-logo-clean-light.png`
- Escuro: `assets/img/portal-logo-clean-dark.png`

Usar em `img.portal-brand-art` e `img.home-logo`. O texto “TCGL · Operações” já está no PNG — `.portal-brand-meta` fica oculto.

Quem troca claro/escuro: `dkSwapBrandLogos` em `theme-toggle.js` e `portal-brand.js`.

Não aplicar em títulos de módulo (`titulo-*.png`), artes de campanha, cartão de aniversário nem áreas de impressão/PDF.

## Símbolo de menu

Hamburger SVG de três linhas, 20×20, traço 1.8, alvo 44×44 px, raio 12 px.

Classe: `.menu-toggle`. O JS do design system substitui barras antigas (`.menu-bars`) por este SVG.

## Botões

| Papel | Classes | Visual |
| --- | --- | --- |
| Primário / voltar ao portal | `.btn-primary`, `.btn-portal`, `.btn-accent`, `.portal-return`, `.portal-voltar-auto` | Fundo azul `#1265c2`, texto branco |
| Secundário / sessão | `.btn-secondary`, `.btn-ghost`, `.btn-logout`, `.btn-senha-portal` | Superfície + borda |
| Destrutivo | `.btn-danger` | Fundo vermelho, texto branco |

Todos: altura mínima 44 px, raio 12 px, Inter 650. Foco visível: contorno 3 px azul.

## Superfície

Vidro claro/escuro, Inter, fundo Londrina, tokens `--portal-ink`, `--portal-muted`, `--portal-blue`, `--portal-line`. Não inventar KPI nem paleta nova por página.

## Arquivos

- `assets/js/theme-toggle.js` — tema + injeta o design system
- `assets/js/portal-design-system.js` — logo, hamburger
- `assets/css/portal-design-system.css` — estilo compartilhado
- `assets/js/portal-brand.js` — lockup no cabeçalho
- `assets/css/portal-home-2026.css` — só a home

Página nova: incluir `theme-toggle.js`, marca `portal-brand-art`, botões nas classes acima. Não copiar CSS de botão/logo de outro módulo.
