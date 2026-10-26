# Identidade visual

Fonte: `assets/img/`, `assets/css/portal-tokens.css`, `assets/js/theme-toggle.js`, `assets/js/portal-brand.js`.

## Logos CIOP / TCGL

Arquivos oficiais — **não redesenhar**, não sobrepor outra marca, não aplicar filtro CSS:

| Tema | Arquivo |
| --- | --- |
| Claro | `assets/img/portal-logo-clean-light.png` |
| Escuro | `assets/img/portal-logo-clean-dark.png` |

Uso: `img.portal-brand-art` (páginas) e `img.home-logo` (home). O texto “TCGL · Operações” já está no PNG. A classe `.portal-brand-meta` fica **oculta** no design system.

Favicon da aba: recorte quadrado do ônibus da marca oficial sobre `#06245c` (`assets/img/portal-favicon.png` e `portal-favicon-192.png`). `index.html` / `login.html` apontam no `<head>`; as internas recebem o mesmo via `theme-toggle.js` e `auth.js`. Não redesenhar o traço.

Quem troca o arquivo no claro/escuro: `dkSwapBrandLogos` em `theme-toggle.js` e o `brand()` de `portal-design-system.js`.

`alt` padrão: `Portal CIOP TCGL Operações`.

**Não aplicar** a troca em: `titulo-portal-ciop*`, artes de campanha, cartão de aniversário, `.pdf-sheet-top`, `.print-only`, `[data-print-brand]`.

Fallback do overlay de carregamento (se o PNG limpo 404): `logomarca-portalciop-tcgl-claro.png` / `…-escuro.png` (`auth.js`, `loading.js`).

## Fotografia de fundo

Arquivo: `assets/img/portal-londrina-fundo.png` (cidade, rio, ônibus). Login usa também `assets/img/portal-bg-onibus.jpg`.

| Superfície | Como a foto entra |
| --- | --- |
| Home | `.bg-wall` fixo, `center bottom / cover`; véu em `body::before` com `--portal-photo-veil` |
| Páginas `portal-glass-system` | `body` com véu + `url('../img/portal-londrina-fundo.png')` no CSS do design system (caminho relativo ao CSS) |
| ICV (`html.icv-page`) | `.body-bg-wall` + `portal-liquid-icv.css`; o DS deixa o `body` transparente para não cobrir duas vezes |
| Login | foto de ônibus, `background-position: center 30%` |
| iOS / páginas sem parede | `auth.js` injeta `.body-bg-wall` se ainda não houver |

Recorte: **center bottom** nas internas e na home — prioriza o chão/ônibus, não o céu. Em telas estreitas a foto continua `cover` (pode cortar laterais). Não escurecer até a foto sumir.

Véu claro: `linear-gradient(180deg, rgba(233, 241, 249, 0.08), …)`. Véu escuro: `rgba(4, 15, 30, 0.28)` no topo. Valores exatos em [temas-e-tokens.md](temas-e-tokens.md).

Mapas Leaflet e documentos (`.paper`, `.report-sheet`) **não** recebem invert/filtro da foto.

## Paleta institucional

Tokens de produto (não confundir com criticidade operacional):

| Papel | Token / alias | Claro | Uso |
| --- | --- | --- | --- |
| Azul institucional (legado) | `--azul` | `#06245c` | `theme-color`, some botões antigos inline |
| Ação primária | `--portal-accent` | `#1265c2` | botão Portal, links de ação |
| Hover azul legado | `--azul-hover` | `#0b3a8a` | páginas com CSS próprio ainda |
| Laranja institucional | `--laranja` | `#ff6b00` | ênfase de módulo / avisos |
| Aviso (token) | `--portal-accent-warn` | `#d95508` | home (laranja mais sóbrio) |
| Teal (ICV / relatórios) | `--teal` | `#0f766e` | destaque de cumprimento de viagem |

No escuro, `--portal-accent` vira `#82c4ff` e `--portal-accent-warn` `#ffab66`. `--azul` / `--laranja` / `--teal` **não** são redefinidos em `html.dk-dark` — não usar esses três em texto sobre vidro escuro.

## Tipografia

Família: **Inter** 400–800, import em `portal-tokens.css`, fallback `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Token: `--portal-font` (alias `--font`).

Hierarquia observada:

| Papel | Peso | Tamanho típico |
| --- | --- | --- |
| Saudação da home | 750 | `clamp(26px, 2.4vw, 38px)` |
| Título de página (header) | 650 | `clamp(16px, 2vw, 22px)` |
| Título de card | 650 | ~14 px |
| Corpo / descrição | 400–500 | 12–14 px |
| Label de KPI / muted | 500 | 10–12 px |
| Número (KPI) | 750, `tabular-nums` | 19–28 px |

Classes com números tabulares: `.portal-nums`, `.ciop-kpi-value`, `.kpi-value`, `.home-perf-item b`.

Não usar degradê em texto operacional (exceção: título do console de IA no Decreto, fundo próprio).

## Ícones

Não há pacote tipo Lucide no portal clássico. O padrão vigente é **SVG inline**, 20×20, `fill: none`, `stroke: currentColor`, `stroke-width: 1.8` (`--portal-icon-size`, `--portal-icon-stroke`).

Hamburger compartilhado (`portal-design-system.js`):

```html
<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
```

Ícone “voltar ao Portal” (`auth.js`): casa com telhado. Decorativos: `aria-hidden="true"`. Botão só com ícone precisa de `aria-label`.

Não usar emoji como ícone de chrome.

## Escala

| Token | Valor |
| --- | --- |
| `--portal-space-1` … `--portal-space-5` | 4 / 8 / 12 / 16 / 24 px |
| `--portal-radius-sm` | 8 px |
| `--portal-radius` | 12 px (botões, campos) |
| `--portal-radius-lg` | 18 px (cards) |
| `--portal-radius-xl` | 26 px (modais, sidebar) |
| `--portal-duration` | 180 ms (`0.01ms` se reduced motion) |
| `--portal-shadow-sm/mid/lg` | ver tokens |
| `--portal-reflect` | `inset 0 1px 0` (brilho superior) |

Alvo de toque: **44×44 px** (menu, Portal, dock, fechar modal).

## Fazer / não fazer

**Fazer:** logo limpo no header; foto visível nas margens; Inter; tokens; SVG de traço.

**Não fazer:** segundo logo “TCGL” ao lado do lockup; overlay branco opaco na home; texto `#06245c` no tema escuro; copiar CSS de botão de outro HTML; recolorir mapa ou PDF com o tema.
