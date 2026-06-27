/**
 * Sincroniza incidentes TCGL → JSON local → Aurora DSQL.
 * Usado pelo botão na Mesa do Mac (principal), Lambda e EC2.
 *
 * Variáveis:
 *   SYNC_INCIDENTES_PUBLISH_GIT=1  — commit/push do JSON no portalCIOP (CIOP_PORTAL_PROD) ou PORTAL_ROOT
 *   CIOP_PORTAL_PROD               — pasta portalCIOP (produção) para git push
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
const portalProd = (process.env.CIOP_PORTAL_PROD || "").trim();
const nodeBin = process.env.CIOP_NODE_BIN || process.execPath;
const jsonRel = "assets/data/incidentes-tcgl.json";
const dataDir = process.env.PORTAL_DATA_DIR || path.join(portalRoot, "assets", "data");
const jsonPath = path.join(dataDir, "incidentes-tcgl.json");

function run(command, args, options = {}) {
  const cwd = options.cwd || portalRoot;
  const result = spawnSync(command, args, {
    cwd,
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

function gitOutput(repoRoot, args) {
  return spawnSync("git", args, {
    cwd: repoRoot,
    env: gitEnv(),
    encoding: "utf8",
    stdio: "pipe"
  }).stdout.trim();
}

function parseGithubRepo(remote) {
  const match = String(remote).match(/github\.com[/:]([^/]+\/[^/.]+)/);
  return match ? match[1] : "";
}

function gitPush(repoRoot) {
  const token = (process.env.CIOP_GITHUB_TOKEN || "").trim();
  const branch = gitOutput(repoRoot, ["branch", "--show-current"]) || "main";
  if (token) {
    const remote = gitOutput(repoRoot, ["remote", "get-url", "origin"]);
    const repo = parseGithubRepo(remote);
    if (!repo) throw new Error("Repositório GitHub não identificado em origin.");
    const pushUrl = `https://x-access-token:${token}@github.com/${repo}.git`;
    run("git", ["push", pushUrl, `HEAD:${branch}`], { cwd: repoRoot, silent: true });
    return;
  }
  run("git", ["push"], { cwd: repoRoot, silent: true });
}

function publicarGitIncidentesEm(repoRoot, rotulo) {
  if (!repoRoot || !fs.existsSync(repoRoot)) {
    console.log(`[git] ${rotulo}: pasta ausente (${repoRoot || "?"}) — ignorado.`);
    return false;
  }
  const destJson = path.join(repoRoot, jsonRel);
  fs.mkdirSync(path.dirname(destJson), { recursive: true });
  fs.copyFileSync(jsonPath, destJson);

  run("git", ["add", jsonRel], { cwd: repoRoot, silent: true });
  const changed = spawnSync("git", ["status", "--short", "--", jsonRel], {
    cwd: repoRoot,
    env: gitEnv(),
    encoding: "utf8",
    stdio: "pipe"
  }).stdout.trim();
  if (!changed) {
    console.log(`[git] ${rotulo}: sem alterações em incidentes-tcgl.json.`);
    return false;
  }
  const stamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  run("git", ["commit", "-m", `Atualiza incidentes TCGL - ${stamp}`], { cwd: repoRoot, silent: true });
  gitPush(repoRoot);
  console.log(`[git] ${rotulo}: incidentes-tcgl.json publicado.`);
  return true;
}

function publicarGitIncidentes() {
  const alvos = [];
  if (portalProd && path.resolve(portalProd) !== path.resolve(portalRoot)) {
    alvos.push({ root: portalProd, rotulo: "portalCIOP (produção)" });
  } else if (portalProd) {
    alvos.push({ root: portalProd, rotulo: "portalCIOP" });
  } else {
    alvos.push({ root: portalRoot, rotulo: path.basename(portalRoot) });
  }
  let publicou = false;
  for (const { root, rotulo } of alvos) {
    if (publicarGitIncidentesEm(root, rotulo)) publicou = true;
  }
  return publicou;
}

export async function syncIncidentes() {
  const publishGit = process.env.SYNC_INCIDENTES_PUBLISH_GIT === "1";
  const skipDsql = process.env.SYNC_INCIDENTES_SKIP_DSQL === "1";
  const steps = { s3Pull: false, fetch: false, s3Push: false, dsql: false, git: false };

  process.env.PORTAL_ROOT = portalRoot;

  if (!process.env.CIOP_INCIDENTES_USUARIO || !process.env.CIOP_INCIDENTES_SENHA) {
    throw new Error("Configure CIOP_INCIDENTES_USUARIO e CIOP_INCIDENTES_SENHA.");
  }

  steps.s3Pull = await baixarEstadoIncidentesS3(jsonPath);

  console.log("[sync] Buscando incidentes no TCGL...");
  run(nodeBin, [path.join(scriptDir, "atualizar-incidentes-tcgl.mjs")]);
  steps.fetch = true;

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON não gerado: ${jsonPath}`);
  }

  steps.s3Push = await enviarEstadoIncidentesS3(jsonPath);

  if (publishGit) {
    const destino = portalProd ? `portalCIOP (${portalProd})` : portalRoot;
    console.log(`[sync] Publicando JSON no Git → ${destino}...`);
    steps.git = publicarGitIncidentes();
  }

  if (!skipDsql) {
    console.log("[sync] Importando incidentes no Aurora DSQL...");
    const backendScripts = path.join(portalRoot, "backend", "scripts", "importar-planilha-dsql.mjs");
    run(nodeBin, [backendScripts, "incidentes"], {
      env: { ...process.env, PORTAL_ROOT: portalRoot, PORTAL_DATA_DIR: dataDir }
    });
    steps.dsql = true;
  }

  return { ok: true, steps };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  syncIncidentes()
    .then((result) => {
      console.log("[sync] Concluído:", JSON.stringify(result.steps));
    })
    .catch((err) => {
      console.error("[sync] ERRO:", err.message);
      process.exit(1);
    });
}
