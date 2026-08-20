# Fase 4 — Banco (Aurora DSQL)

Inventário e ações em **20/08/2026**, cluster `ort34httzig7iktrneb4ytcy5u` (`sa-east-1`). Leituras/DDL via Lambda temporária `portal-ciop-sql-once` (role `portal-ciop-api-role`); a função foi apagada no fim. O IAM `portal-ciop-deploy` não tem `dsql:DbConnectAdmin`.

Cluster: ACTIVE, proteção contra exclusão ligada.

## 1. Tabelas (revisão) — feito

Há **23 tabelas**, **2 views** e agora **`audit_log`**. O arquivo `backend/sql/schema.sql` cobre o núcleo do portal; as tabelas CR-* existem só no DSQL (carga Clever).

### Núcleo (em `schema.sql`)

| Tabela | PK | Linhas (20/08) | Uso |
|---|---|---|---|
| `liberacao_linhas` | `(data_iso, row_id)` | 20.367 | Lançamento / dashboard |
| `telemetria_linhas` | `(data_iso, veiculo)` | 2.941 | KM / consumo |
| `relatorios_ocorrencia` | `id` | 3 | Metadados de PDF no S3 |
| `avisos` | `id` | 2 | Avisos |
| `autuacoes_snapshot` | `id` | 1 | JSON (Actions) |
| `folha_snapshot` | `id` | 1 | Idem |
| `incidentes_snapshot` | `id` | 1 | Legado; CAD = `cr_0002` |
| `pontualidade_snapshot` | `cenario` | 2 | Idem |
| `terminais_snapshot` | `id` | 1 | Terminais agora |
| `audit_log` | `id` | 1+ (sonda + escritas) | Trilha de writes |

### Clever / CR

| Tabela | PK | Volume | Conteúdo |
|---|---|---|---|
| `cr_0108` | `(data_ref, id)` | ~2.512.535 (227 dias) | Passagens |
| `cr_0002` | `(data_ref, id)` | 8.274 (194 dias) | Incidentes CAD |
| `cr_0258` / `cr_0258_resumo` | `(data_ref, id)` | 228 | OTP diário |
| `cr_custom` / `cr_custom_ontime` | `(data_ref, id)` | 228 | ICV / IPV Custom |
| `cr0108_dia_linha` | `(data_ref, linha, direcao)` | 34.574 | Agregado |
| `cr0108_dia_hora` | `(data_ref, hora)` | 5.130 | Agregado hora |

Views `cr0108_norm` / `cr0108_flag`: ~2,5 M linhas (não indexar).

## 2. Duplicados / índices / lentidão — feito

**Duplicados:** nenhum em PK de `liberacao_linhas`; nenhum par `(data_ref, registro)` repetido em `cr_0002`.

**Índice novo (ASYNC, ~100 s, `indisvalid = true`):**

```sql
CREATE INDEX ASYNC idx_cr_0108_dia_veiculo
  ON cr_0108 (data_ref, (btrim(veiculo)));
```

Definição no cluster: `btree_index (data_ref, btrim(veiculo))`. Job `ieblw6wbwfhsrmgth3ixg642gy` completed.

Também: `idx_liberacao_data`, `idx_relatorios_user_data`, PKs covering.

O JOIN do IPV+Incidentes ainda usa `regexp_replace` na linha; se o mês inteiro continuar lento, persistir `linha_n` na carga.

`sys.wait_for_job` no DSQL é **procedure** (`CALL`), não `SELECT`.

## 3. Backup e restore — feito (lógico)

AWS Backup do cluster **não** é acessível com `portal-ciop-deploy` (`backup:List*` negado). Restore AWS Backup criaria um **cluster novo** — não testado.

O que foi testado nesta fase:

1. Dump JSON de `avisos`, `cr_0108_cargas` (227 dias) e `relatorios_ocorrencia` em  
   `s3://portal-ciop-relatorios-584342046935-sa-east-1/dsql-backup/fase4-2026-08-20/nucleo.json` (12,4 KiB).
2. Restore de `avisos` numa tabela sonda `fase4_restore_probe`: 2 = 2, depois `DROP TABLE`.

Para DR de cluster inteiro: conta com AWS Backup + opt-in Aurora DSQL; restore sempre em cluster novo.

## 4. Auditoria — feito

Tabela `audit_log` (`id`, `quando`, `uid`, `tabela`, `chave`, `acao`, `antes`, `depois`). Sonda `fase4-sonda` inserida.

A API `portal-ciop-api` grava em:

| Rota | Ação |
|---|---|
| `PUT /liberacao/:data/:row` | insert/update com payload antes/depois |
| import/sync liberação | um evento `import` (não uma linha por ônibus) |
| `POST /telemetria/import` | `import` com totais |
| upload/confirmar relatório | `insert` do metadado |
| snapshots / terminais (API key) | `update` (tamanho do JSON, sem o blob) |

Código: `backend/src/lib/audit.js`. Lambda atualizada em 20/08/2026 21:38 UTC; `/db-health` 200. Havia `}` extra em `cr0108.js` (API 500); removido no mesmo deploy.

Não é login/2FA (Fase 5).
