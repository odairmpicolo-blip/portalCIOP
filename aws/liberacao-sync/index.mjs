import { importarPlanilhaParaDsql } from "./backend/src/routes/liberacao.js";
import { closePool } from "./backend/src/db.js";

export const handler = async () => {
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    const total = await importarPlanilhaParaDsql(hoje, hoje, "lambda-sync");
    const body = { ok: true, total, data: hoje };
    console.log(JSON.stringify(body));
    return body;
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    await closePool().catch(() => {});
  }
};
