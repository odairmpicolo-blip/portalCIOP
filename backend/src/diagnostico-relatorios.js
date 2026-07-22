import { query, closePool, isDsqlMode } from "./db.js";

async function main() {
  console.log("Modo:", isDsqlMode() ? "DSQL" : "PostgreSQL");

  const existe = await query(
    `SELECT to_regclass('public.relatorios_ocorrencia') AS tabela`
  );
  console.log("Tabela relatorios_ocorrencia existe?", existe.rows[0].tabela ? "SIM" : "NAO");

  if (!existe.rows[0].tabela) {
    await closePool();
    return;
  }

  const total = await query(`SELECT COUNT(*)::int AS total FROM relatorios_ocorrencia`);
  console.log("Total de linhas na tabela:", total.rows[0].total);

  const recentes = await query(
    `SELECT id, user_email, data_documento, protocolo, nome_arquivo, origem, criado_em
     FROM relatorios_ocorrencia
     ORDER BY criado_em DESC
     LIMIT 10`
  );
  console.log("Ultimas linhas:");
  for (const row of recentes.rows) {
    console.log(
      "-",
      row.criado_em,
      "| email:", row.user_email,
      "| data:", row.data_documento,
      "| protocolo:", row.protocolo,
      "| arquivo:", row.nome_arquivo,
      "| origem:", row.origem
    );
  }

  await closePool();
}

main().catch((err) => {
  console.error("Falha no diagnostico:", err.message);
  process.exit(1);
});
