import fs from 'node:fs';
import path from 'node:path';

const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const outputDir = path.join(portalRoot, 'assets', 'data');
const outputFile = path.join(outputDir, 'incidentes-tcgl.json');
const partialFile = path.join(outputDir, 'incidentes-tcgl.partial.json');
const cookieFile = '/tmp/incidentes-cookie.txt';
const baseUrl = 'https://cioplondrina.com.br/CADIncidentManagement';
const loginUrl = `${baseUrl}/?ReturnUrl=%2fCADIncidentManagement%2fg%2f6ac2842af62b497aa5b0e515ef4b2ce9`;
const usuario = process.env.CIOP_INCIDENTES_USUARIO;
const senha = process.env.CIOP_INCIDENTES_SENHA;
let endpoint = '';
const requestTimeoutMs = Number(process.env.CIOP_INCIDENTES_TIMEOUT_MS || 60000);
const requestRetries = Number(process.env.CIOP_INCIDENTES_RETRIES || 4);
const detailConcurrency = Number(process.env.CIOP_INCIDENTES_DETALHES_CONCURRENCY || 8);
const detailLimit = Number(process.env.CIOP_INCIDENTES_DETALHES_LIMITE || 0);
const loadDetails = process.env.CIOP_INCIDENTES_DETALHES !== '0';

if (!usuario || !senha) {
  throw new Error('Configure CIOP_INCIDENTES_USUARIO e CIOP_INCIDENTES_SENHA antes de atualizar os incidentes.');
}

const columns = [
  'IncidentID',
  'IncidentNr',
  'StateName',
  'IncidentTypeName',
  'AddDTS',
  'CreatedBy',
  'OwnedBy',
  'routename',
  'VehicleDescription',
  'DivisionShortName',
];

function cookieHeader(jar) {
  return Array.from(jar.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
}

function storeCookies(jar, response) {
  const cookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  cookies.forEach((cookie) => {
    const [pair] = cookie.split(';');
    const index = pair.indexOf('=');
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  });
}

function field(html, name) {
  const pattern = new RegExp(`name=["']${name}["'][^>]*value=["']([^"']*)["']`, 'i');
  return html.match(pattern)?.[1] || '';
}

function guidFrom(html) {
  return html.match(/\/CADIncidentManagement\/g\/([a-f0-9]{32})\//i)?.[1]
    || html.match(/\/CADIncidentManagement\/g\/([a-f0-9]{32})/i)?.[1]
    || '';
}

async function request(jar, url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (jar.size) headers.set('Cookie', cookieHeader(jar));
  const response = await fetchWithRetry(url, { ...options, headers, redirect: 'manual' });
  storeCookies(jar, response);
  return response;
}

async function fetchWithRetry(url, options = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= requestRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (response.status >= 500 && attempt < requestRetries) {
        await delay(attempt * 4000);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= requestRetries) break;
      console.log(`Tentativa ${attempt} falhou ao acessar ${url}. Nova tentativa em ${attempt * 4}s.`);
      await delay(attempt * 4000);
    }
  }
  throw lastError;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login() {
  const jar = new Map();
  const first = await request(jar, loginUrl);
  const loginHtml = await first.text();
  const guid = guidFrom(loginHtml);
  if (!guid) throw new Error('Não foi possível identificar a sessão de login.');

  const body = new URLSearchParams();
  body.set('UserName', usuario);
  body.set('Password', senha);
  body.set('TdId', field(loginHtml, 'TdId') || '1');
  body.set('OnLoadActionsGuid', field(loginHtml, 'OnLoadActionsGuid'));

  const action = `${baseUrl}/g/${guid}/Account/LogOn`;
  await request(jar, action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const main = await request(jar, `${baseUrl}/g/${guid}`);
  const mainHtml = await main.text();
  const activeGuid = guidFrom(mainHtml) || guid;
  endpoint = `${baseUrl}/g/${activeGuid}/Json/GetDataDictionary`;

  fs.writeFileSync(cookieFile, cookieHeader(jar));
  return jar;
}

function bodyFor(start, length) {
  const body = new URLSearchParams();
  body.set('DataSourceKey', 'Incidents.Sql.IncidentGridView');
  columns.forEach((column) => body.append('Columns[]', column));
  body.set('SortColumn', 'AddDTS');
  body.set('ResultType', '1');
  body.set('SortDirection', '1');
  body.set('DisplayStart', String(start));
  body.set('DisplayLength', String(length));
  body.set('ColumnsSearch[DivisionShortName]', 'TCGL');
  body.set('timezoneOffset', '180');
  return body;
}

function splitDateTime(value) {
  const [date = '', time = ''] = String(value || '').split(' ');
  return {
    data: date,
    hora: time.slice(0, 5),
  };
}

function vehicleNumber(value) {
  const text = String(value || '').trim();
  const match = text.match(/^([^\s-]+)/);
  return match ? match[1] : text;
}

async function loadChunk(jar, start, length) {
  const response = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: {
      Cookie: cookieHeader(jar),
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: bodyFor(start, length),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao buscar lote iniciado em ${start}`);
  }

  const text = await response.text();
  const json = JSON.parse(text);
  if (!Array.isArray(json)) {
    throw new Error(`Resposta inesperada no lote ${start}: ${text.slice(0, 180)}`);
  }
  return json;
}

function normalize(row) {
  const dateTime = splitDateTime(row.AddDTS);
  return {
    incidentId: String(row.IncidentID || row.IncidentNr || ''),
    id: String(row.IncidentNr || ''),
    data: dateTime.data,
    hora: dateTime.hora,
    veiculo: vehicleNumber(row.VehicleDescription),
    linha: String(row.routename || ''),
    criadoPor: String(row.CreatedBy || ''),
    tipo: String(row.IncidentTypeName || ''),
    proprietario: String(row.OwnedBy || ''),
    estado: String(row.StateName || ''),
    natureOfProblem: '',
    instructions: '',
    empresa: String(row.DivisionShortName || ''),
    veiculoDescricao: String(row.VehicleDescription || ''),
  };
}

function readExistingDetails() {
  if (!fs.existsSync(outputFile)) return new Map();
  try {
    const payload = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    const details = new Map();
    for (const row of payload.incidentes || []) {
      const key = String(row.incidentId || row.id || '');
      if (!key) continue;
      if (row.natureOfProblem || row.instructions) {
        details.set(key, {
          natureOfProblem: String(row.natureOfProblem || ''),
          instructions: String(row.instructions || ''),
        });
      }
    }
    return details;
  } catch {
    return new Map();
  }
}

async function loadIncidentDetail(jar, incidentId) {
  const body = new URLSearchParams();
  body.set('DataSourceKey', 'CADIncidentManagement.Sql.Unified');
  ['IncidentID', 'NatureOfProblem', 'Instructions'].forEach((column) => body.append('Columns[]', column));
  body.set('SortColumn', 'IncidentID');
  body.set('ResultType', '1');
  body.set('SortDirection', '1');
  body.set('DisplayStart', '0');
  body.set('DisplayLength', '1');
  body.set('ColumnsSearch[IncidentID]', String(incidentId));
  body.set('timezoneOffset', '180');

  const response = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: {
      Cookie: cookieHeader(jar),
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} no detalhe do incidente ${incidentId}`);
  const json = JSON.parse(await response.text());
  const row = Array.isArray(json) ? json[0] : null;
  return {
    natureOfProblem: String(row?.NatureOfProblem || ''),
    instructions: String(row?.Instructions || ''),
  };
}

async function enrichDetails(jar, rows) {
  if (!loadDetails) return rows;
  const details = readExistingDetails();
  rows.forEach((row) => {
    const cached = details.get(row.incidentId) || details.get(row.id);
    if (cached) {
      row.natureOfProblem = cached.natureOfProblem;
      row.instructions = cached.instructions;
    }
  });

  let pending = rows.filter((row) => !row.natureOfProblem && !row.instructions && row.incidentId);
  if (detailLimit > 0) pending = pending.slice(0, detailLimit);
  if (!pending.length) {
    console.log('Detalhes: todos os registros já estavam em cache.');
    return rows;
  }

  console.log(`Detalhes: buscando ${pending.length} incidentes sem cache.`);
  let index = 0;
  let done = 0;
  async function worker() {
    while (index < pending.length) {
      const row = pending[index++];
      try {
        const detail = await loadIncidentDetail(jar, row.incidentId);
        row.natureOfProblem = detail.natureOfProblem;
        row.instructions = detail.instructions;
      } catch (error) {
        console.log(`Detalhes: falha no incidente ${row.incidentId}: ${error.message}`);
      }
      done += 1;
      if (done % 500 === 0 || done === pending.length) {
        console.log(`Detalhes: ${done}/${pending.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, detailConcurrency) }, worker));
  return rows;
}

const jar = await login();
fs.mkdirSync(outputDir, { recursive: true });

const length = 2000;
let start = 0;
let total = null;
const rows = [];

while (total === null || start < total) {
  const chunk = await loadChunk(jar, start, length);
  if (chunk.length === 0) break;
  total = Number(chunk[0].QueryRowCount || chunk.length);
  rows.push(...chunk.map(normalize));
  const snapshot = {
    atualizadoEm: new Date().toISOString(),
    fonte: 'Gerenciamento de Incidentes',
    empresa: 'TCGL',
    totalServidor: total,
    totalExtraido: rows.length,
    incidentes: rows,
  };
  fs.writeFileSync(partialFile, JSON.stringify(snapshot));
  console.log(`Baixados ${rows.length}/${total}`);
  start += length;
}

await enrichDetails(jar, rows);
const filteredRows = rows.filter((row) => row.natureOfProblem.trim() || row.instructions.trim());
console.log(`Filtro de detalhes: ${filteredRows.length}/${rows.length} incidentes mantidos.`);

const payload = {
  atualizadoEm: new Date().toISOString(),
  fonte: 'Gerenciamento de Incidentes',
  empresa: 'TCGL',
  totalServidor: total ?? rows.length,
  totalExtraido: filteredRows.length,
  totalComEmpresa: rows.length,
  incidentes: filteredRows,
};

fs.writeFileSync(outputFile, JSON.stringify(payload));
fs.rmSync(partialFile, { force: true });
console.log(`Arquivo gerado: ${outputFile}`);
