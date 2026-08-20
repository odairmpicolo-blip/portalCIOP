-- Índices Aurora DSQL — um CREATE INDEX ASYNC por execução
CREATE INDEX ASYNC idx_liberacao_data ON liberacao_linhas (data_iso);
CREATE INDEX ASYNC idx_relatorios_user_data ON relatorios_ocorrencia (user_email, data_documento);
-- JOIN IPV+Incidentes: um CREATE INDEX ASYNC por vez no DSQL
CREATE INDEX ASYNC idx_cr_0108_dia_veiculo ON cr_0108 (data_ref, (btrim(veiculo)));
