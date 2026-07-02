/**
 * Sincroniza incidentes TCGL → JSON local → Aurora DSQL.
 * Usado por Lambda, EC2, Mac e GitHub Actions.
 *
 * Variáveis:
 *   SYNC_INCIDENTES_PUBLISH_GIT=1  — commit/push do JSON (opcional, backup)
 *   SYNC_INCIDENTES_SKIP_DSQL=1    — não importa no DSQL
 *   INCIDENTES_STATE_S3_BUCKET     — cache incremental em S3
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { baixarEstadoIncidentesS3, enviarEstadoIncidentesS3 } from "./lib/incidentes-state-s3.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = process.env.PORTAL_ROOT || path.resolve(scriptDir, "..");
const nodeBin = process.env.CIOP_NODE_BIN || process.execPath;
const jsonRel = "assets/data/incidentes-tcgl.json";
const dataDir = process.env.PORTAL_DATA_DIR || path.join(portalRoot, "assets", "data");
const jsonPath = path.join(dataDir, "incidentes-tcgl.json");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: portalRoot,
    env: process.env,
    encoding: "utf8",
    stdio: options.silent ? "pipe" : "inherit",
    ...options
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(
      `Falha: ${command} ${args.join(" ")}${detail ? ` — ${detail.slice(0, 500)}` : ""}`
    );
  }
  return result;
}

function gitEnv() {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "Never"
  };
}

function gitOutput(args) {
  return spawnSync("git", args, {
    cwd: portalRoot,
    env: gitEnv(),
    encoding: "utf8",
    stdio: "pipe"
  }).stdout.trim();
}

function parseGithubRepo(remote) {
  const match = String(remote).match(/github\.com[/:]([^/]+\/[^/.]+)/);
  return match ? match[1] : "";
}

function gitPush() {
  const token = (process.env.CIOP_GITHUB_TOKEN || "").trim();
  const branch = gitOutput(["branch", "--show-current"]) || "main";
  if (token) {
    const remote = gitOutput(["remote", "get-url", "origin"]);
    const repo = parseGithubRepo(remote);
    if (!repo) throw new Error("Repositório GitHub não identificado em origin.");
    const pushUrl = `https://x-access-token:${token}@github.com/${repo}.git`;
    run("git", ["push", pushUrl, `HEAD:${branch}`], { silent: true });
    return;
  }
  run("git", ["push"], { silent: true });
}

function publicarGitIncidentes() {
  run("git", ["add", jsonRel], { silent: true });
  const changed = spawnSync("git", ["status", "--short", "--", jsonRel], {
    cwd: portalRoot,
    env: gitEnv(),
    encoding: "utf8",
    stdio: "pipe"
  }).stdout.trim();
  if (!changed) {
    console.log("[git] Sem alterações em incidentes-tcgl.json.");
    return false;
  }
  const stamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  run("git", ["commit", "-m", `Atualiza incidentes TCGL - ${stamp}`], { silent: true });
  gitPush();
  console.log("[git] incidentes-tcgl.json publicado.");
  return true;
}

function runOpcional(etapa, fn) {
  try {
    return fn();
  } catch (err) {
    const msg = err?.message || String(err);
    console.warn(`[sync] Aviso (${etapa}):`, msg);
    return { ok: false, error: msg };
  }
}

export async function syncIncidentes() {
  const publishGit = process.env.SYNC_INCIDENTES_PUBLISH_GIT === "1";
  const skipDsql = process.env.SYNC_INCIDENTES_SKIP_DSQL === "1";
  const steps = { s3Pull: false, fetch: false, s3Push: false, dsql: false, git: false };
  const warnings = [];

  process.env.PORTAL_ROOT = portalRoot;

  if (!process.env.CIOP_INCIDENTES_USUARIO || !process.env.CIOP_INCIDENTES_SENHA) {
    throw new Error("Configure CIOP_INCIDENTES_USUARIO e CIOP_INCIDENTES_SENHA.");
  }

  steps.s3Pull = await baixarEstadoIncidentesS3(jsonPath);

  console.log("[sync] Buscando incidentes no TCGL...");
  const fetchRes = runOpcional("TCGL", () => {
    run(nodeBin, [path.join(scriptDir, "atualizar-incidentes-tcgl.mjs")]);
    steps.fetch = true;
    return { ok: true };
  });
  if (fetchRes?.error) {
    warnings.push(`TCGL: ${fetchRes.error}`);
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Falha ao buscar TCGL e JSON existente nao encontrado: ${jsonPath}`);
    }
    console.warn("[sync] TCGL indisponivel; usando JSON existente para manter DSQL/portal atualizados.");
  }

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON não gerado: ${jsonPath}`);
  }

  if (steps.fetch) {
    steps.s3Push = await enviarEstadoIncidentesS3(jsonPath);
  }

  if (publishGit) {
    const gitRes = runOpcional("git", () => {
      steps.git = publicarGitIncidentes();
      return { ok: true };
    });
    if (gitRes?.error) warnings.push(`Git: ${gitRes.error}`);
  }

  if (!skipDsql) {
    const dsqlRes = runOpcional("DSQL", () => {
      console.log("[sync] Importando incidentes no Aurora DSQL...");
      const backendScripts = path.join(portalRoot, "backend", "scripts", "importar-planilha-dsql.mjs");
      run(nodeBin, [backendScripts, "incidentes"], {
        env: { ...process.env, PORTAL_ROOT: portalRoot, PORTAL_DATA_DIR: dataDir }
      });
      steps.dsql = true;
      return { ok: true };
    });
    if (dsqlRes?.error) warnings.push(`DSQL: ${dsqlRes.error}`);
  }

  return { ok: true, steps, warnings };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  syncIncidentes()
    .then((result) => {
      console.log("[sync] Concluído:", JSON.stringify(result.steps));
      if (result.warnings?.length) {
        console.warn("[sync] Etapas opcionais com aviso:", result.warnings.join(" | "));
      }
    })
    .catch((err) => {
      console.error("[sync] ERRO:", err.message);
      process.exit(1);
    });
}
