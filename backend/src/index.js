import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { query, isDsqlMode } from "./db.js";
import liberacaoRouter from "./routes/liberacao.js";
import terminaisRouter from "./routes/terminais.js";
import snapshotsRouter from "./routes/snapshots.js";
import telemetriaRouter from "./routes/telemetria.js";

const app = express();
app.use(express.json({ limit: "15mb" }));

app.use(cors({
  origin(origin, callback) {
    if (!origin || !config.corsOrigins.length || config.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("CORS bloqueado"));
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
