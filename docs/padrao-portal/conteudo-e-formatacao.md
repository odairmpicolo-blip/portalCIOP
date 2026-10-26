# Conteúdo e formatação

Idioma da interface: **português brasileiro**. `html lang="pt-BR"`. Números e datas: `toLocaleString("pt-BR")`.

## Títulos, descrições, rótulos

- Título da página = nome do módulo (ex.: “Índice de Cumprimento de Viagem - ICV”).
- Subtítulo: o que a tela faz, sem jargão de deploy.
- Label visível em todo campo; placeholder não substitui label.
- Botões: verbo + objeto (“Gerar PDF”, “Entrar”, “Sair”). “Portal” no voltar à home.

## Tom

Frases curtas. “Não foi possível carregar os dados.” para o usuário. Detalhe (`Rota não encontrada`, stack) no console ou em texto secundário.

IPV ajustado já traduz 404 de API:

```javascript
const amigavel = /rota não encontrada/i.test(bruto)
  ? "Este indicador ainda não está disponível neste ambiente."
  : (bruto || "Não foi possível carregar os dados.");
```

## Datas, horas, números, percentuais, moeda, unidades

| Tipo | Padrão observado |
| --- | --- |
| Data | `dd/mm/aaaa` (`brData` em vários JS) |
| Data-hora | `toLocaleString("pt-BR")` |
| Hora ao vivo | `toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })` |
| Inteiro | `toLocaleString("pt-BR")` → `1.234` |
| Percentual | vírgula decimal, 2 casas quando for índice (`91,40%`); home/TV podem usar 1 casa no hero |
| Moeda | não há token de moeda no DS; se aparecer, `pt-BR` + `BRL` |
| Ordenação | `localeCompare(..., "pt-BR", { numeric: true })` |

Meses abreviados no ICV: Jan, Fev, Mar, Abr, Mai, Jun, Jul, Ago, Set, Out, Nov, Dez.

## Zero, ausência, carregamento

| Situação | Exibir |
| --- | --- |
| Valor numérico zero verdadeiro | `0` ou `0,00%` |
| Sem dado / API vazia / não publicado | `—` ou `--` (TV KM) |
| Carregando | “Carregando período…” / overlay; **não** zerar o KPI anterior se a tela já tinha número |
| Erro | mensagem; não fingir 0% |

`fmtPct` em performance-comparação: `null` → `"—"`.

## Período, fonte, atualização

Toolbar deve dizer o recorte (`01/10/2026 a 26/10/2026`), a origem quando houver (Clever, CR-0108, snapshot) e “Atualizado às …”. Exemplo ao vivo: “Atualizado às 15:11:34 · estimativa local (Clever)”.

Não misturar ICV com IPV no mesmo número.

## Nomes de módulos

Manter nomes distintos, como na home:

- ICV ≠ IPV ≠ IPV ajustado ≠ pontualidade ao vivo
- Incidentes CAD ≠ dashboard de incidentes ≠ análise
- Liberação (lançamento) ≠ dashboard ≠ relatório
- Ônibus agora (Bus2) ≠ Clever ≠ FleetBus ≠ terminais

Não renomear no CSS. Título PNG de módulo (`titulo-*`) não entra na troca de logo do tema.
