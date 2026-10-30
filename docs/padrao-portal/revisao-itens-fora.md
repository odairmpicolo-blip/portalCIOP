# Revisão dos itens que ficaram fora da publicação

Conferência de 30/10/2026. Nada desta lista foi publicado neste passo. O que não foi aberto ou medido fica como pendência, não como aprovado.

## Inventário

| Arquivo | Tipo |
| --- | --- |
| `Apresentação - Redução da frota útil.html` | Apresentação 1920×1080, 8 slides |
| `Apresentação - Redução da frota útil.pptx` | Mesmo conteúdo, 8 slides |
| `Frequência - hora a hora.xlsx` | Planilha: Hora a hora, Sábado, Domingo |
| `_preview-home-r2.html` | Prévia grande da home |
| `_preview-contrast-audit3.html` | Sonda de contraste |
| `_preview-pontualidade-kpi.html` | Prévia pontualidade, classe escura |
| `_preview-pontualidade-kpi-claro.html` | A mesma prévia, classe clara |
| `_preview-clima-cenas.html` | Prévia das cenas de clima da TV |
| `_preview-seletor-modelo.html` | Prévia do seletor, classe clara |
| `_preview-terminais-proximas.html` | Prévia de Terminais Agora |
| `docs/padrao-portal/preview-ajuste-tela.html` | Sonda de overflow em iframe |
| `pages/_preview-exemplo-evidencias.html` | Folha A4 do auto 92 |
| `pages/_preview-exemplo-evidencias-94.html` | Folha A4 do auto 94 |
| `pages/_preview-exemplo-relatorio.html` | Folha do relatório de exemplo |
| `assets/img/exemplo-evidencia/` | capa, auto, map1, map2 (~530 px) |
| `assets/img/exemplo-evidencia-94/` | o mesmo conjunto (~600 px) |
| `assets/exemplo-evidencia-auto-92.pdf` | PDF A4 |
| `assets/exemplo-evidencia-auto-94.pdf` | PDF A4 |
| `assets/exemplo-relatorio-visivel.png` | 2360×1658 |
| `assets/cartao-aniversario-preview.pdf` | 381×539 pt |
| `.github/workflows/atualizar-cr0108-json.yml` | Workflow |
| `.github/workflows/atualizar-incidentes-cad.yml` | Workflow |
| `docs/workflows/atualizar-cr0108-json.yml` | Cópia do CR-0108 |
| `docs/github-atualizar-incidentes-cad.yml` | Cópia do CAD |

## Apresentação

O HTML é o formato de exibição: cada slide mede 1920×1080 e a página escala o quadro para a janela. No Chrome, o conteúdo dos 8 slides ficou dentro do quadro (o ponto mais baixo medido foi 1044 px). O slide 5, com as 23 linhas e o total, foi visto inteiro, sem corte de rodapé.

O cinza `#A39B90` sobre o papel `#F3F0E8` dava 2,41:1 em texto de 13–14 px. Passou para `#6E6862` (4,83:1) no HTML e nos slides do PPTX que usavam essa cor em rodapé, números e notas. Os textos e os números da conta não mudaram.

O PPTX já tinha 13,33×7,5 pol (16:9), mas o atributo dizia `screen4x3`. O atributo foi alinhado para `screen16x9`. A identidade (papel, cobre, verde, serif) permanece.

## Planilha

Cabeçalhos das três abas: Linha, Hora, Atual, Proposta. Não há fórmulas. Os intervalos (`0:22`, `última`, `0`) estão gravados como texto; não foram convertidos para número, para não mudar o que a célula mostra.

Contraste do cabeçalho do dia útil: branco sobre `#171A1E` (17,46:1). Sábado e Domingo usavam texto escuro sem essa faixa. Os quatro títulos dessas abas passaram a usar o mesmo estilo do dia útil. Os valores das células não foram reescritos.

Impressão: Sábado e Domingo já tinham A4 retrato, ajustar à largura e repetir a linha 1. A aba Hora a hora não tinha isso. Recebeu o mesmo ajuste. A impressão em papel não foi executada.

## Prévias e amostras

Tema só onde o arquivo já escolhe claro ou escuro. Documento de impressão e digitalização ficam no claro do papel.

| Arquivo | O que foi visto | Situação |
| --- | --- | --- |
| `_preview-seletor-modelo.html` | Aberto no Chrome. Opção ativa branca sobre `#1265c2` (5,73:1). As outras usam `#102c53` sobre o menu quase branco. Sem rolagem horizontal em 1920. | Classe fixa no claro. Sem par escuro neste arquivo. |
| `_preview-pontualidade-kpi.html` | Aberto no Chrome, classe escura. Botão ativo 5,73:1. Adiantado `#f87171`, Atrasado `#facc15`. Sem rolagem horizontal em 1920. | Par claro é o outro arquivo. Não foi reaberto nesta rodada. |
| `pages/_preview-exemplo-evidencias.html` | Aberto no Chrome. Seis imagens carregaram. Nenhuma sobrepõe a outra. A folha tem 796 px e a página não cria rolagem horizontal em 1920. | Papel A4. Sem tema escuro. |
| `assets/exemplo-relatorio-visivel.png` | Imagem 2360×1658, azul `#06245c` sobre branco, faixas azul e laranja, campos alinhados. | Sem tema. O bloco de assinatura está em branco. |
| `assets/img/exemplo-evidencia/capa.png` | Digitalização legível, cerca de 530 px. | Sem tema. Resolução baixa para impressão grande. |
| PDFs dos autos | Caixa de página A4 (595×842 pt). | Não foram abertos página a página. Pendente a leitura visual de cada página. |
| `assets/cartao-aniversario-preview.pdf` | 381×539 pt. | Não aberto. Pendente. |
| `_preview-contrast-audit3.html` | Sonda com cores claras fixas. O script de tema entra, mas o CSS não muda no escuro. | Não é tela de produto. Tema não aplicado. |
| `_preview-home-r2.html`, `_preview-clima-cenas.html`, `_preview-terminais-proximas.html`, `preview-ajuste-tela.html`, prévia do auto 94 e do relatório | Lidos na estrutura. | Não abertos no navegador nesta rodada. Pendente a conferência visual. |

## YAML

Os dois workflows em `.github/workflows/` foram lidos e o Ruby carregou o YAML. O passo, o script e a pasta de saída batem:

- CR-0108: `node scripts/exportar-cr0108-json.mjs` grava `assets/data/cr0108/`. O commit usa `scripts/ci-git-commit-push.sh` nessa pasta. `backend/package-lock.json` existe para o `npm ci`.
- CAD: `CAD_JSON_MODO=mes-fechado` e `scripts/atualizar-incidentes-cad-json.mjs` gravam `assets/data/incidentes-cad.json` e `assets/data/incidentes-cad/`. O cron é dia 1 às 06:00 UTC.

Permissões (`contents: write`), segredos e o script de push não foram alterados. O arquivo do CR-0108 em `docs/workflows/` é igual ao de `.github`. A cópia do CAD em `docs/` tem os mesmos segredos, o mesmo script e as mesmas saídas; a diferença é o nome dos passos e um comentário.

Esses YAML locais não foram enviados. Publicar `.github/workflows/` depende de um token com escopo `workflow`. Nenhum dos dois jobs foi executado no Actions nesta revisão.

## WhatsApp

O atalho **Abrir WhatsApp Web** não fica no login. Na tela inicial, no fim da linha abaixo do nome, há só o ícone. Destino `https://web.whatsapp.com/`, `target="_blank"` e `rel="noopener noreferrer"`. Não leva e-mail, senha nem número. No Chrome local, o alvo mede 44×44 px, sem texto visível, abaixo do nome e no fim dessa linha, em 1920 e em 390 px, sem rolagem horizontal.

Não há número de suporte. Este botão não substitui um contato de atendimento.
