# Auditoria Portal CIOP — 29/10/2026

Direção visual preservada: logos, favicon, foto suavizada, Liquid Glass, temas claro / escuro / automático. Adiantado vermelho, Atrasado amarelo, No horário verde.

## Causa das falhas

| Área | Causa | Correção |
| --- | --- | --- |
| Liberação lançamento | Cabeçalhos 9 px, hora `max-width:28px`, tabela `fixed`, “Salvo” verde claro sobre vidro | Colunas com min-width, rolagem no wrapper, hora ≥2,4 rem, badge verde escuro + texto claro |
| Telemetria | Títulos/etiquetas ainda presos a navy no escuro | `--tel-heading` + labels/legendas claros no `dk-dark` |
| CAD / CR-0108 | Ícone nativo do calendário fora do padding | `overflow:hidden` + indicator absoluto à direita, dentro do campo |
| Autuações | `td` navy no escuro; moeda sem min-width; 0 antes da consulta | Texto de tabela por tema; `formatMoeda`/`formatInt` pt-BR; “—” até haver dado |
| Evidências | Ações no rodapé; ficha desalinhada no escuro | Ações em coluna lateral; ficha centralizada; papel permanece claro |
| FleetBus | Mostradores e laterais com dourado/navy ilegíveis no escuro | Superfície escura + texto claro nos gauges |
| Monitoramento | Filtro herdava fill branco; marcadores 96 px se sobrepunham | Texto `#0f172a` em fundo branco; cluster Leaflet até zoom 16 |
| Motoristas | Chip “Faixa” 10 px em fundo pastel | Chip com fundo saturado e texto contrastante |
| Pátio | Contadores muted; vaga 6,5 px | Contador `#0f172a`; texto da vaga com stroke no escuro |
| Incidentes dashboard | Header sticky por cima da barra | `z-index` do header 20, topbar 6 com margem |
| KM | Cards/métricas `#071f57` no escuro | Tokens de superfície/eixo por `dk-dark` |
| Performance ao vivo | Série só no `localStorage` da sessão; eixo 00–24 com poucos slots | Une `horas`+`minutos` do dia (`DIAS_KEY`) e tenta Firestore; linhas sem inventar pontos; cumprimento continua fora do kiosk |
| IPV | `portalContarNumero` interpolava a partir de 0/`--%` | Percentual entra no valor final, sem tween |
| Folha / Serviço | Esperava a planilha (até 25 s) com tabela vazia | Mostra cache local e depois atualiza; estados carregando / vazio / indisponível |
| ICV Total | Já ponderado `soma viag / soma prog` | Mantido; sem média simples |
| Home | Pouco espaço entre favoritos e catálogo | Margem do título “Todos os módulos” 56 px |
| CIOP TV previsão | `--wx-muted` e vidro fracos | Muted 92% de opacidade; vidro `.42` |

## Matriz (tema e estado)

Validação local 390×844, 1024×768, 1440×900, claro e escuro. TV 1920×1080. Sem envio de relatório e sem alteração de registro.

| Página | 390 | 1024 | 1440 | Claro | Escuro | Auto | Estado vazio / carga |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `liberacao-lancamento.html` | scroll H | cabeçalhos | hora | Salvo | Salvo | — | — |
| `dados-telemetria.html` | filtros | painel | KPI | navy | heading claro | — | — |
| `incidentes-cad.html` / `cr0108.html` | data | data | data | ícone no campo | ícone no campo | — | — |
| `autuacoes.html` | cards | tabela | gráficos | moeda | td clara | — | “—” pré-consulta |
| `evidencias-autuacoes.html` | ações embaixo | lateral | lateral | ficha branca | ficha branca | — | empty claro |
| `fleetbus-agora.html` | gauges | laterais | mapa | navy | texto claro | — | — |
| `monitoramento.html` | mapa | cluster | individual | filtro escuro/branco | filtro branco | — | — |
| `desempenho-motoristas.html` | tabela | Faixa | Faixa | chip | chip | — | — |
| `gerenciapatio.html` | stats | planta | planta | contraste | vaga | — | — |
| `incidentes-dashboard.html` | topbar | topbar | topbar | — | — | — | — |
| `km-dashboard.html` | cards | métricas | tabela | navy | tokens | — | “—” |
| `performance-tempo-real.html` | kiosk | linhas | linhas | kiosk | kiosk | — | lacunas reais |
| `painel-ciop.html` | — | — | TV 1920 | — | kiosk | — | ICV “—” sem volume |
| `index.html` | dock | favoritos | catálogo | foto | foto | tema | — |
| `Folhadeservico1.html` | form | tabela | tabela | — | — | — | cache / carregando |

Capturas: pasta [`assets/`](assets/README.md), prefixo `audit-20261029-` quando geradas nesta entrega.

## Ambientes

- Implementado em `portal-teste` (working tree desta correção).
- Publicado: preencher SHAs após push teste + `/tmp/portalciop-live`.
- Verificado em `www.portalciop.com.br`: somente após Pages + cache Fastly.
