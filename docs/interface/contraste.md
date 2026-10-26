# Contraste — claro e escuro

Texto normal precisa de contraste **≥ 4,5:1** com o fundo. Texto grande (≥18 px negrito ou ≥24 px) vale 3:1. Ícone que carrega significado: ≥ 3:1.

## Tokens

| Papel | Claro | Escuro |
| --- | --- | --- |
| Texto principal `--portal-ink` / `--home-ink` | `#102c53` | `#f5f8ff` |
| Texto secundário `--portal-muted` / `--home-muted` | `#3a5270` | `#d5e3f4` |
| Superfície | vidro ~94% opaco | vidro ~94% opaco — não deixar o fundo da cidade vazar no texto |

Não usar cinza médio (`#64748b`, `#94a3b8`, `#98989d`, `#344054`) em tema escuro: some no vidro e na foto de Londrina.

## O que não fazer

- Texto escuro fixo (`#06245c`, `#344054`) sem variante `.dk-dark`
- Placeholder mais claro que o muted do token
- `-webkit-text-fill-color` diferente de `color` (Safari mostra uma cor e o resto outra)
- Degradê no texto da operação (só o console de IA, que já é fundo escuro próprio)

## Conferência

1. Tema claro: títulos, descrições de card, cargo da sessão, mín/máx, rodapé.
2. Tema escuro: os mesmos pontos + botão de cenário inativo, labels de KPI, links `.btn-link`.
3. Home e uma página interna (ex.: ICV ou Autuações).
4. `prefers-reduced-motion` não altera cor, só movimento.

Ajuste de token: `assets/css/portal-design-system.css` (páginas) e `assets/css/portal-home-2026.css` (home). Não “corrigir” uma tela com hex solto.
