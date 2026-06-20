import fs from 'node:fs';
import path from 'node:path';

const portalRoot = '/Users/odairpicolo/Desktop/Portal teste';
const outputDir = path.join(portalRoot, 'assets', 'data');
const outputFile = path.join(outputDir, 'incidentes-tcgl.json');
const partialFile = path.join(outputDir, 'incidentes-tcgl.partial.json');
const cookieFile = '/tmp/incidentes-cookie.txt';
const baseUrl = 'https://cioplondrina.com.br/CADIncidentManagement';
const loginUrl = `${baseUrl}/?ReturnUrl=%2fCADIncidentManagement%2fg%2f6ac2842af62b497aa5b0e515ef4b2ce9`;
const usuario = process.env.CIOP_INCIDENTES_USUARIO || 'odairmarino';
const senha = process.env.CIOP_INCIDENTES_SENHA || 'CIOP2907';
let endpoint = '';

const columns = [
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
  const response = await fetch(url, { ...options, headers, redirect: 'manual' });
  storeCookies(jar, response);
  return response;
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
  const response = await fetch(endpoint, {
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
    id: String(row.IncidentNr || ''),
    data: dateTime.data,
    hora: dateTime.hora,
    veiculo: vehicleNumber(row.VehicleDescription),
    linha: String(row.routename || ''),
    criadoPor: String(row.CreatedBy || ''),
    tipo: String(row.IncidentTypeName || ''),
    proprietario: String(row.OwnedBy || ''),
    estado: String(row.StateName || ''),
    empresa: String(row.DivisionShortName || ''),
    veiculoDescricao: String(row.VehicleDescription || ''),
  };
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

const payload = {
  atualizadoEm: new Date().toISOString(),
  fonte: 'Gerenciamento de Incidentes',
  empresa: 'TCGL',
  totalServidor: total ?? rows.length,
  totalExtraido: rows.length,
  incidentes: rows,
};

fs.writeFileSync(outputFile, JSON.stringify(payload));
fs.rmSync(partialFile, { force: true });
console.log(`Arquivo gerado: ${outputFile}`);
