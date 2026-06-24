import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { syncIncidentes } from "./portal/scripts/sync-incidentes-completo.mjs";

const secretsClient = new SecretsManagerClient({});

async function loadSecrets() {
  const secretId = process.env.INCIDENTES_SECRET_ARN || process.env.INCIDENTES_SECRET_NAME;
  if (!secretId) return;
  const res = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretId }));
  const raw = res.SecretString || "";
  if (!raw) return;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (parsed.CIOP_INCIDENTES_USUARIO) process.env.CIOP_INCIDENTES_USUARIO = parsed.CIOP_INCIDENTES_USUARIO;
  if (parsed.CIOP_INCIDENTES_SENHA) process.env.CIOP_INCIDENTES_SENHA = parsed.CIOP_INCIDENTES_SENHA;
  if (parsed.CIOP_GITHUB_TOKEN) process.env.CIOP_GITHUB_TOKEN = parsed.CIOP_GITHUB_TOKEN;
}

export async function handler(event = {}) {
  const mode = event.mode || process.env.SYNC_MODE || "full";
  process.env.PORTAL_ROOT = process.env.PORTAL_ROOT || "/var/task";
  process.env.SYNC_INCIDENTES_SKIP_GIT = process.env.SYNC_INCIDENTES_SKIP_GIT || "1";

  await loadSecrets();

  if (mode === "probe") {
    const { spawnSync } = await import("node:child_process");
    const probe = spawnSync(
      "node",
      ["portal/scripts/test-incidentes-tcgl-reachability.mjs"],
      { cwd: "/var/task", env: process.env, encoding: "utf8" }
    );
    return {
      ok: probe.status === 0,
      stdout: probe.stdout,
      stderr: probe.stderr
    };
  }

  try {
    const result = await syncIncidentes();
    return { ok: true, steps: result.steps };
  } catch (err) {
    console.error(err);
    return { ok: false, stage: "sync", error: err.message };
  }
}
