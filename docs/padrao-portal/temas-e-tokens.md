# Temas e tokens

Fonte de verdade: `assets/css/portal-tokens.css`. Não inventar hex paralelo.

## Três modos

| Preferência | Classe resolvida | Comportamento |
| --- | --- | --- |
| `light` | `html.dk-light` | Sempre claro |
| `dark` | `html.dk-dark` | Sempre escuro (navy fumê) |
| `auto` (padrão) | `dk-light` ou `dk-dark` | Segue `prefers-color-scheme` |

Atributos: `data-dk-pref` (o que o usuário escolheu) e `data-dk-resolved` (`light` ou `dark`).

API: `window.dkSetPref('light'|'dark'|'auto')`, `window.dkIsDark()`. Evento: `dk-theme-change` com `{ detail: { dark, pref } }`.

Picker: `.dk-theme-opt[data-dk-pref]` (Claro / Auto / Escuro), `aria-pressed`. Na home fica na sidebar; nas internas o design system injeta em `.header-actions`.

## Persistência

1. Chave global: `localStorage['dk-theme']`.
2. Depois do login, chave por e-mail: `dk-theme:` + e-mail (`dkPreferenceKey` em `theme-toggle.js`). Lê a chave do usuário; se vazia, cai na global.
3. Valor inválido vira `auto`.
4. `auto` reage a `matchMedia('(prefers-color-scheme: dark)')` e a `visibilitychange`.

A preferência **sobrevive** à navegação entre páginas e ao recarregar (validado no login e no Painel TV).

## Sem flash (FOUC)

O arquivo `theme-toggle.js` começa com `dkEarlyBoot()`: lê `dk-theme` e aplica `dk-light`/`dk-dark` **antes** do CSS da página, **se o script estiver no `<head>`**.

A home e o ICV repetem o mesmo boot inline no primeiro script do HTML (defesa extra).

**Limitação implementada:** páginas sem `theme-toggle.js` no HTML só o recebem em `auth.js` → `garantirThemeToggle()`, depois do parse. Nessas telas ainda pode haver um flash. Lista e mitigação: [validacao.md](validacao.md). **Proposta (não feita):** colocar o script no `<head>` de todas.

## Tabela de tokens (valores reais)

Aliases legado (`--texto`, `--muted`, `--lg-*`, `--surface`…) apontam para os tokens abaixo. Preferir `--portal-*` em código novo.

### Texto e ação

| Token | Finalidade | Claro | Escuro |
| --- | --- | --- | --- |
| `--portal-text` | Texto principal | `#102c53` | `#f5f8ff` |
| `--portal-text-secondary` | Descrição, cargo, muted | `#3a5270` | `#d5e3f4` |
| `--portal-text-aux` | Apoio | `#4a6180` | `#b7c9de` |
| `--portal-text-disabled` | Desabilitado | `#7a8aa0` | `#8aa0b8` |
| `--portal-accent` | Ação / foco de marca | `#1265c2` | `#82c4ff` |
| `--portal-accent-warn` | Aviso (não é Atrasado) | `#d95508` | `#ffab66` |
| `--portal-focus` | Anel de foco | `#1265c2` | `#82c4ff` |
| `--portal-selection` | Seleção de texto | `rgba(18, 101, 194, 0.2)` | `rgba(130, 196, 255, 0.22)` |

### Status operacional (ver [cores-operacionais.md](cores-operacionais.md))

| Token | Significado | Claro | Escuro |
| --- | --- | --- | --- |
| `--portal-op-ontime` | No horário | `#15803d` | `#4ade80` |
| `--portal-op-early` | Adiantado (maior gravidade) | `#dc2626` | `#f87171` |
| `--portal-op-late` | Atrasado | `#ca8a04` | `#facc15` |

### Vidro, campos, bordas

| Token | Finalidade | Claro | Escuro |
| --- | --- | --- | --- |
| `--portal-glass-light` | Nav, rodapé, chip | `rgba(255,255,255,.22)` | `rgba(8,26,46,.28)` |
| `--portal-glass-mid` | Card, filtro, KPI | `rgba(255,255,255,.46)` | `rgba(12,36,62,.52)` |
| `--portal-glass-dense` | Header, menu, sidebar | `rgba(248,252,255,.78)` | `rgba(8,24,44,.82)` |
| `--portal-field` | Input / select | `rgba(255,255,255,.58)` | `rgba(255,255,255,.08)` |
| `--portal-menu` | Menu denso | `rgba(248,252,255,.84)` | `rgba(8,24,44,.90)` |
| `--portal-table` | Tabela / gráfico | `rgba(255,255,255,.72)` | `rgba(8,26,46,.78)` |
| `--portal-modal` | Dialog | `rgba(248,252,255,.82)` | `rgba(8,24,44,.88)` |
| `--portal-tooltip` | Tooltip | `rgba(12,32,54,.94)` | `rgba(6,16,30,.94)` |
| `--portal-border` | Borda de vidro | `rgba(255,255,255,.5)` | `rgba(191,219,246,.18)` |
| `--portal-border-strong` | Borda com tinta | `rgba(18,70,130,.16)` | `rgba(179,212,243,.22)` |
| `--portal-fallback` | Sem backdrop-filter | `#eef3f8` | `#10253c` |
| `--portal-paper` | Papel de documento | `#fff` | `#fff` (prévia permanece branca) |
| `--portal-photo-veil` | Véu sobre a foto | ver arquivo | ver arquivo |

Blur: `--portal-blur-light` `blur(10px) saturate(140%)`; mid 16 px / 150%; dense 22 px / 160%.

Espaço, raio, duração: [identidade-visual.md](identidade-visual.md).

## Gráficos e componentes

Padrão **implementado no ICV:** `icvChartTheme()` lê `html.dk-dark` e pinta eixos/grade; `dk-theme-change` chama `renderChart` de novo. **Dados não mudam.**

```javascript
function icvChartTheme() {
  const dark = document.documentElement.classList.contains("dk-dark");
  return {
    tick: dark ? "#d5e3f4" : "#3a5270",
    grid: dark ? "rgba(179,212,243,.16)" : "rgba(16,44,83,.12)",
    title: dark ? "#f5f8ff" : "#102c53",
    duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200
  };
}
window.addEventListener("dk-theme-change", () => {
  if (lastChartVisual) renderChart(lastChartVisual);
});
```

Nem todo Chart.js do repositório escuta o evento. Página nova com gráfico **deve** escutar. Cores das séries operacionais (adiantado/atrasado) usam os tokens `--portal-op-*`, não o azul de eixo.

## Uso

```css
.kpi-value { color: var(--portal-text); font-variant-numeric: tabular-nums; }
.kpi-sub { color: var(--portal-text-secondary); }
.panel {
  background: var(--portal-glass-mid);
  border: 1px solid var(--portal-border);
  border-radius: var(--portal-radius-lg);
  box-shadow: var(--portal-shadow-mid);
  backdrop-filter: var(--portal-blur-mid);
}
```

## Eliminar cores fixas indevidas

1. Procurar hex de texto (`#06245c`, `#344054`, `#64748b`, `#94a3b8`, `#101828`) em CSS da página.
2. Trocar por `var(--portal-text)` / `--portal-text-secondary`.
3. Conferir `-webkit-text-fill-color` igual a `color` (Safari).
4. Não “corrigir” uma tela com hex solto se o token resolve várias páginas — editar `portal-tokens.css` ou o design system.

Exceção legítima: kiosk TV (`pages/painel-tv.html` e afins) tem paleta própria de alto contraste; documento em [cores-operacionais.md](cores-operacionais.md).
