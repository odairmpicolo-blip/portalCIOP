# Fase 2 — Infraestrutura (revisão 20/08/2026)

Testado agora, sem alterar DNS no Registro.br.

## Domínio

| Nome | Situação |
|---|---|
| `www.portalciop.com.br` | CNAME → `odairmpicolo-blip.github.io` → IPs GitHub Pages. **OK** |
| `portalciop.com.br` (sem www) | **Não resolve.** Sem registros A no Registro.br |
| `odairmpicolo-blip.github.io/portalCIOP/` | 301 para `https://www.portalciop.com.br/` |

Apex é opcional. Se quiser `https://portalciop.com.br`, no Registro.br (zona avançada, nome vazio) os 4 A: `185.199.108.153` … `111.153`. Depois ativar HTTPS no GitHub Pages.

## HTTPS / SSL

- `http://www` → **301** para `https://www`
- Certificado Let's Encrypt, CN `www.portalciop.com.br`, válido até **22/09/2026** (renova sozinho no Pages)
- **Não há** cabeçalho `Strict-Transport-Security` (limitação do GitHub Pages; CDN extra tipo Cloudflare na Fase 5/13 se precisar)

## CDN / cache

Já existe: GitHub Pages + **Fastly** (`via: varnish`, PoP `brazilsouth` / Curitiba). `Cache-Control: max-age=600`. Não precisa de outra CDN agora.

## Hospedagem / capacidade

Site estático no Pages aguenta o uso do CIOP. Gargalo não é a home: são Lambdas, DSQL e Apps Script. Crescimento = AWS, não Pages.

## Backup

| O quê | Como |
|---|---|
| Código | Git `portalCIOP` `main` |
| JSON operacionais | Workflows que commitam `assets/data/**` |
| Firestore | Backup nativo Google (ativar no console se ainda não estiver) |
| Aurora DSQL | Dump lógico testado (S3 `dsql-backup/fase4-2026-08-20/nucleo.json` + restore sonda). AWS Backup do cluster: outra conta IAM |

## Monitoramento

Workflow `.github/workflows/monitorar-portal.yml`: a cada 15 min (e manual) faz GET em `https://www.portalciop.com.br/` e falha se não for 200.

Conferir: Actions → **Monitorar portal**. Só roda neste repo depois de push; em produção depois de publicar no `portalCIOP`.

Checagem local: `bash scripts/verificar-dominio-github-pages.sh`
