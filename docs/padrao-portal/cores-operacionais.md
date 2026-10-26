# Cores operacionais

Criticidade **não** usa o azul institucional. Cálculos e faixas de minutos **não mudam** por causa do tema.

## Régua de pontualidade (CR-0108)

Implementada em `assets/js/cr0108-serie.js` (comentário no código):

| Classificação | Faixa de diferença (min) | Cor de interface |
| --- | --- | --- |
| No horário | −2 … +6 | verde `--portal-op-ontime` |
| Adiantado | −10 … −3 | **vermelho** `--portal-op-early` |
| Atrasado | +7 … +15 | **amarelo/âmbar** `--portal-op-late` |
| Divergente | resto | não usar early/late; tratar como fora da régua |

**Adiantado é vermelho** porque, na operação, chegar cedo demais é a maior gravidade nesta régua. **Atrasado é âmbar**, não vermelho. Não inverter.

## Tokens (obrigatório em UI nova)

| Estado | Token | Claro | Escuro |
| --- | --- | --- | --- |
| No horário | `--portal-op-ontime` | `#15803d` | `#4ade80` |
| Adiantado | `--portal-op-early` | `#dc2626` | `#f87171` |
| Atrasado | `--portal-op-late` | `#ca8a04` | `#facc15` |

No catálogo (dados fictícios): [assets/catalogo-kpis-claro.png](assets/catalogo-kpis-claro.png).

Home (Performance TCGL):

```css
.home-perf-item.is-ok b { color: var(--portal-op-ontime, #15803d); }
.home-perf-item.is-early b { color: var(--portal-op-early, #dc2626); }
.home-perf-item.is-late b { color: var(--portal-op-late, #ca8a04); }
```

Sempre acompanhar com **texto** (“Adiantado”, “Atrasado”, “No horário”), ícone ou legenda. Daltonismo e TV em escala de cinza não podem depender só da cor.

## Outras métricas (diferenças legítimas)

Estas paletas **não** são a régua Adiantado/Atrasado. Não unificar à força.

| Módulo | O que coloriza | Onde |
| --- | --- | --- |
| ICV | Teal `--teal` `#0f766e` no cumprimento de viagem | `pages/icv.html`, `portal-liquid-icv.css` (`.kpi-card.highlight`) |
| Painel TV | `--green`, `--red` `#ef4444`, chips próprios para leitura à distância | `pages/painel-tv.html` |
| Pontualidade ao vivo (kiosk-like) | `--red` `#fb7185` no card Adiantado; atraso no accent do card | `pages/pontualidade-tempo-real.html` |
| Autuações / oficina | vermelho de incidente/colisão em gráficos locais | `pages/Folhadeservico.html` (não é IPV) |
| Aviso da home | laranja `--portal-accent-warn` / `--home-orange` | quadro de avisos |
| Botão destrutivo | `#b42318` | `.btn-danger` |
| Meta TV ok/nok | `.tv-visao-meta.ok` / `.nok` | kiosk |

No Painel TV ao vivo, Adiantado aparece em vermelho e Atrasado em âmbar — alinhado à regra, ainda que os hex do kiosk sejam da paleta TV.

## Institucional vs. ação vs. seleção vs. criticidade

| Função | Tokens | Não usar para |
| --- | --- | --- |
| Marca / chrome | `--azul`, logo | pintar Adiantado |
| Ação (botão, link) | `--portal-accent` `#1265c2` / `#82c4ff` | status de viagem |
| Foco / seleção | `--portal-focus`, `--portal-selection` | atraso |
| Aviso de produto | `--portal-accent-warn` | Atrasado |
| Criticidade de viagem | `--portal-op-*` | botão primário |

## Texto + cor

```html
<span class="home-perf-item is-early">
  <b>12,2%</b>
  <small>Adiantado</small>
</span>
```

Em tabela: classe + coluna “Situação” por extenso. Em gráfico: legenda com os três nomes.

## Acessível nos dois temas

Os tokens escuro já clareiam o vermelho e o âmbar (`#f87171`, `#facc15`) sobre vidro navy. Não voltar ao `#dc2626` puro em fundo `#10253c` para texto pequeno — o token escuro existe por isso. Verificar contraste do par texto/fundo, não só a “cor de marca” do estado.
