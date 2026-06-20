import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = process.env.PORTAL_ROOT || path.resolve(scriptDir, '..');
const nodePath = process.execPath;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: portalRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: 'pipe',
    ...options,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`Comando falhou: ${command} ${args.join(' ')}`);
  }
  return result;
}

function output(command, args) {
  return spawnSync(command, args, {
    cwd: portalRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: 'pipe',
  }).stdout.trim();
}

run(nodePath, [path.join(portalRoot, 'scripts', 'atualizar-incidentes-tcgl.mjs')]);

run('git', ['add', 'assets/data/incidentes-tcgl.json']);
const changed = output('git', ['status', '--short', '--', 'assets/data/incidentes-tcgl.json']);

if (!changed) {
  console.log('GitHub: sem alterações nos dados de incidentes.');
  process.exit(0);
}

const stamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
run('git', ['commit', '-m', `Atualiza incidentes TCGL - ${stamp}`]);
run('git', ['push']);
console.log('GitHub: dados de incidentes enviados.');
