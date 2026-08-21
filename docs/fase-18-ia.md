# Fase 18 — IA (20/08/2026)

Não há chatbot genérico. Só Gemini, já usado em duas telas. A chave **não** vai para o git (`GEMINI_API_KEY` no Apps Script; URL do relatório no secret `RELATORIO_IA_SCRIPT_URL` do Pages).

## O que já existia

| Tela | Arquivo | Papel |
|---|---|---|
| Criar relatório | `assets/js/relatorio-ia.js` + `scripts/relatorio-ia.gs` | Gerar / corrigir texto da ocorrência. Fallback `POST /relatorio-ia` no bus2-proxy |
| Consulta do Decreto | `assets/js/consulta-decreto.js` + `scripts/consulta-decreto.gs` | Responde só com `decreto_context.txt` |

## O que esta fatia fez

- Integrações: linhas Gemini + se a URL de relatório IA está no runtime (sem mostrar a URL).
- `decreto_context.txt` versionado (texto oficial da consulta).
- Publicação: o script deixa passar esse arquivo (não é dump operacional).

## O que não foi inventado

- ChatGPT / outro provedor.
- IA na home, na TV ou no CAD.
- Chave Gemini no HTML.

## Como conferir

Consulta do Decreto: uma pergunta sobre artigo. Criar relatório: **Gerar com IA** (precisa do secret no Pages ou do Apps Script implantado).
