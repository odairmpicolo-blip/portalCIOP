import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { query, isDsqlMode } from "./db.js";
import liberacaoRouter from "./routes/liberacao.js";
import terminaisRouter from "./routes/terminais.js";
import snapshotsRouter from "./routes/snapshots.js";
import telemetriaRouter from "./routes/telemetria.js";
import relatoriosRouter from "./routes/relatorios.js";

const app = express();
app.use(express.json({ limit: "20mb" }));

// Em producao (Lambda) ou com NODE_ENV=production, se CORS_ORIGINS nao estiver
// configurada, bloqueamos por padrao (fail-closed) em vez de liberar geral.
// Em desenvolvimento local, mantemos aberto para nao travar o dia a dia.
const isProduction = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) || process.env.NODE_ENV === "production";

if (!config.corsOrigins.length) {
    if (isProduction) {
          console.warn(
                  "AVISO DE SEGURANCA: CORS_ORIGINS nao esta configurada em producao. " +
                  "Todas as requisicoes com Origin serao BLOQUEADAS por padrao ate essa variavel ser definida."
                );
    } else {
          console.warn(
                  "AVISO: CORS_ORIGINS nao esta configurada. Em desenvolvimento, todas as origens estao sendo permitidas."
                );
    }
}

app.use(cors({
    origin(origin, callback) {
          if (!origin) {
                  callback(null, true);
                  return;
          }
          if (config.corsOrigins.length) {
                  if (config.corsOrigins.includes(origin)) {
                            callback(null, true);
                  } else {
                            callback(new Error("CORS bloqueado"));
                  }
                  return;
          }
          if (isProduction) {
                  callback(new Error("CORS bloqueado: CORS_ORIGINS nao configurada em producao"));
          } else {
                  callback(null, true);
          }
    }
}));

app.get("/health", async (_req, res) => {
    try {
          if (!config.databaseUrl && !config.dsqlClusterId) {
                  res.status(503).json({ ok: false, erro: "DATABASE_URL ou DSQL_CLUSTER_ID não configurado" });
                  return;
          }
          const result = await query("SELECT 1 AS ok");
          res.json({ ok: true, db: result.rows[0].ok === 1, modo: isDsqlMode() ? "dsql" : "postgres" });
    } catch (err) {
          res.status(503).json({ ok: false, erro: err.message });
    }
});

app.get("/db-health", async (_req, res) => {
    try {
          if (!config.databaseUrl && !config.dsqlClusterId) {
                  res.status(503).json({ ok: false, erro: "DSQL não configurado" });
                  return;
          }
          const result = await query("SELECT 1 AS ok");
          res.json({ ok: true, db: result.rows[0].ok === 1, modo: isDsqlMode() ? "dsql" : "postgres", service: "portal-ciop-api" });
    } catch (err) {
          res.status(503).json({ ok: false, erro: err.message });
    }
});

app.use("/liberacao", liberacaoRouter);
app.use("/terminais", terminaisRouter);
app.use("/snapshots", snapshotsRouter);
app.use("/telemetria", telemetriaRouter);
app.use("/relatorios", relatoriosRouter);

app.use((_req, res) => {
    res.status(404).json({ ok: false, erro: "Rota não encontrada" });
});

export { app };

if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    app.listen(config.port, () => {
          console.log(`Portal CIOP API em http://localhost:${config.port}`);
          if (!config.databaseUrl && !config.dsqlClusterId) {
                  console.warn("AVISO: configure DATABASE_URL ou DSQL_CLUSTER_ID em backend/.env");
          }
    });
}
