import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = path.join(repoRoot, "backend");
const script = path.join(backendDir, "scripts", "limpar-firestore-aws.mjs");
const args = process.argv.slice(2);

const result = spawnSync(process.execPath, [script, ...args], {
  cwd: backendDir,
  env: { ...process.env, PORTAL_ROOT: process.env.PORTAL_ROOT || repoRoot },
  stdio: "inherit"
});

process.exit(result.status ?? 1);
