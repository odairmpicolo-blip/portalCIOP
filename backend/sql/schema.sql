-- Portal CIOP — schema PostgreSQL (AWS RDS / Aurora)
-- Rode: npm run db:migrate (em backend/)

CREATE TABLE IF NOT EXISTS liberacao_linhas (
  data_iso DATE NOT NULL,
  row_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  atualizado_por TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (data_iso, row_id)
);

-- Índice em schema-indexes.sql (CREATE INDEX ASYNC — exigido pelo DSQL)

CREATE TABLE IF NOT EXISTS terminais_snapshot (
  id TEXT PRIMARY KEY DEFAULT 'atual',
  payload JSONB NOT NULL,
  fonte TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Snapshots somente leitura (import via GitHub Actions)
CREATE TABLE IF NOT EXISTS incidentes_snapshot (
  id TEXT PRIMARY KEY DEFAULT 'atual',
  payload JSONB NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autuacoes_snapshot (
  id TEXT PRIMARY KEY DEFAULT 'atual',
  payload JSONB NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS folha_snapshot (
  id TEXT PRIMARY KEY DEFAULT 'atual',
  payload JSONB NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pontualidade_snapshot (
  cenario TEXT NOT NULL,
  payload JSONB NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cenario)
);

CREATE TABLE IF NOT EXISTS telemetria_linhas (
  data_iso DATE NOT NULL,
  veiculo TEXT NOT NULL,
  payload JSONB NOT NULL,
  origem_arquivo TEXT,
  atualizado_por TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (data_iso, veiculo)
);

-- PDFs de relatório de ocorrência (metadados - arquivo em S3: relatorios/{user}/{data}/)
CREATE TABLE IF NOT EXISTS relatorios_ocorrencia (
  id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  data_documento DATE NOT NULL,
  protocolo TEXT,
  funcionario_registro TEXT,
  funcionario_nome TEXT,
  funcionario_texto TEXT,
  nome_arquivo TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  storage_uri TEXT,
  origem TEXT,
  criado_por_nome TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);
