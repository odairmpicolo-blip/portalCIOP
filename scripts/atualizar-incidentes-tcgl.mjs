/**
 * Busca incidentes no TCGL (Gerenciamento de Incidentes).
 *
 * Incremental (padrão): relê a lista desde CIOP_INCIDENTES_DATA_MIN e atualiza
 * detalhes dos últimos CIOP_INCIDENTES_JANELA_ATUALIZACAO_DIAS (180).
 * Completo: CIOP_INCIDENTES_FULL=1 relê lista e detalhes de toda a base.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const outputDir = process.env.PORTAL_DATA_DIR || path.join(portalRoot, 'assets', 'data');
const outputFile = path.join(outputDir, 'incidentes-tcgl.json');
const partialFile = path.join(outputDir, 'incidentes-tcgl.partial.json');
const cookieFile = '/tmp/incidentes-cookie.txt';
const baseUrl = 'https://cioplondrina.com.br/CADIncidentManagement';
const loginUrl = `${baseUrl}/?ReturnUrl=%2fCADIncidentManagement%2fg%2f6ac2842af62b497aa5b0e515ef4b2ce9`;
const browserUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
let usuario = process.env.CIOP_INCIDENTES_USUARIO;
let senha = process.env.CIOP_INCIDENTES_SENHA;
let endpoint = '';
const requestTimeoutMs = Number(process.env.CIOP_INCIDENTES_TIMEOUT_MS || 25000);
const requestRetries = Number(process.env.CIOP_INCIDENTES_RETRIES || 4);
const detailConcurrency = Number(process.env.CIOP_INCIDENTES_DETALHES_CONCURRENCY || 3);
const detailLimit = Number(process.env.CIOP_INCIDENTES_DETALHES_LIMITE || 0);
const loadDetails = process.env.CIOP_INCIDENTES_DETALHES !== '0';
const pageLength = Number(process.env.CIOP_INCIDENTES_LOTE || 2000);
const DATA_MINIMA_ISO = String(process.env.CIOP_INCIDENTES_DATA_MIN || "2026-01-01").trim();
const JANELA_ATUALIZACAO_DIAS = Number(process.env.CIOP_INCIDENTES_JANELA_ATUALIZACAO_DIAS || 180);
const FORCE_FULL = process.env.CIOP_INCIDENTES_FULL === "1";

function exigirCredenciais() {
  usuario = process.env.CIOP_INCIDENTES_USUARIO;
  senha = process.env.CIOP_INCIDENTES_SENHA;
  if (!usuario || !senha) {
    throw new Error('Configure CIOP_INCIDENTES_USUARIO e CIOP_INCIDENTES_SENHA antes de atualizar os incidentes.');
  }
}

function parseIsoDate(iso) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) throw new Error(`CIOP_INCIDENTES_DATA_MIN inválida: ${iso}`);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setHours(0, 0, 0, 0);
  return date;
}

const minDateCutoff = parseIsoDate(DATA_MINIMA_ISO);

const janelaAtualizacaoCutoff = new Date();
janelaAtualizacaoCutoff.setHours(0, 0, 0, 0);
janelaAtualizacaoCutoff.setDate(janelaAtualizacaoCutoff.getDate() - JANELA_ATUALIZACAO_DIAS);

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
  'DepartmentName',
  'DriverNr',
  'DriverName',
];

const SUBSTITUTO_CANDIDATOS = [
  'ReplacementVehicleDescription',
  'ReplacementVehicle',
];
let colunaSubstitutoGrid = '';

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

function applyBrowserHeaders(headers) {
  if (!headers.has('User-Agent')) headers.set('User-Agent', browserUserAgent);
  if (!headers.has('Accept')) headers.set('Accept', 'text/html,application/json,*/*;q=0.8');
  if (!headers.has('Accept-Language')) headers.set('Accept-Language', 'pt-BR,pt;q=0.9');
}

function copyJar(from, to) {
  to.clear();
  for (const [name, value] of from.entries()) to.set(name, value);
}

async function requestOnce(jar, url, options = {}, timeoutMs = 12000) {
  const headers = new Headers(options.headers || {});
  applyBrowserHeaders(headers);
  if (jar.size) headers.set('Cookie', cookieHeader(jar));
  const response = await fetch(url, {
    ...options,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs)
  });
  storeCookies(jar, response);
  return response;
}

async function request(jar, url, options = {}) {
  const headers = new Headers(options.headers || {});
  applyBrowserHeaders(headers);
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

function absoluteUrl(location) {
  if (!location) return '';
  if (location.startsWith('http')) return location;
  if (location.startsWith('/')) return `https://cioplondrina.com.br${location}`;
  return `${baseUrl}/${location}`;
}

function apiHeaders(jar, refererUrl) {
  return {
    Cookie: cookieHeader(jar),
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    Referer: refererUrl,
    Origin: 'https://cioplondrina.com.br',
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'User-Agent': browserUserAgent,
    'Accept-Language': 'pt-BR,pt;q=0.9',
  };
}

async function followRedirects(jar, startUrl, referer = '', maxHops = 10) {
  let url = startUrl;
  let lastResponse = null;
  let lastHtml = '';
  for (let hop = 0; hop < maxHops; hop += 1) {
    lastResponse = await request(jar, url, {
      headers: referer ? { Referer: referer } : {},
    });
    if (lastResponse.status >= 300 && lastResponse.status < 400) {
      const location = lastResponse.headers.get('location');
      if (!location) break;
      if (hop > 0 && /ReturnUrl=|%2fAccount%2fLogOn/i.test(location)) {
        throw new Error('Login rejeitado — verifique CIOP_INCIDENTES_USUARIO e CIOP_INCIDENTES_SENHA em ~/.config/ciop-portal/incidentes.env');
      }
      referer = url;
      url = absoluteUrl(location);
      continue;
    }
    lastHtml = await lastResponse.text();
    return { response: lastResponse, html: lastHtml, url };
  }
  if (lastResponse && !lastHtml) lastHtml = await lastResponse.text();
  return { response: lastResponse, html: lastHtml, url };
}

async function verifySession(jar, activeGuid) {
  const refererUrl = `${baseUrl}/g/${activeGuid}`;
  const response = await fetchWithRetry(`${baseUrl}/g/${activeGuid}/Json/GetDataDictionary`, {
    method: 'POST',
    headers: apiHeaders(jar, refererUrl),
    body: bodyFor(0, 1),
  });
  if (!response.ok) {
    const preview = (await response.text()).slice(0, 120);
    throw new Error(`API TCGL retornou HTTP ${response.status}${preview ? `: ${preview}` : ''}`);
  }
  const json = JSON.parse(await response.text());
  if (!Array.isArray(json)) {
    throw new Error('API TCGL retornou resposta inesperada após login.');
  }
}

async function login() {
  exigirCredenciais();
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
  const logonResponse = await request(jar, action, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: loginUrl,
      Origin: 'https://cioplondrina.com.br',
    },
    body,
  });
  if (logonResponse.status >= 400) {
    throw new Error(`Login falhou: HTTP ${logonResponse.status}`);
  }

  if (logonResponse.status === 200) {
    const logonHtml = await logonResponse.clone().text();
    if (/field-validation-error|validation-summary-errors/i.test(logonHtml)) {
      const msg = logonHtml.match(/field-validation-error[^>]*>([^<]+)/i)?.[1]
        ?.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        ?.trim();
      throw new Error(msg || 'Usuário ou senha incorretos no TCGL.');
    }
  }

  let landing;
  if (logonResponse.status >= 300 && logonResponse.status < 400) {
    landing = await followRedirects(jar, absoluteUrl(logonResponse.headers.get('location')), action);
  } else {
    landing = await followRedirects(jar, `${baseUrl}/g/${guid}`, action);
  }

  const activeGuid = guidFrom(landing.html) || guidFrom(landing.url) || guid;
  endpoint = `${baseUrl}/g/${activeGuid}/Json/GetDataDictionary`;

  try {
    await verifySession(jar, activeGuid);
  } catch (error) {
    throw new Error(`${error.message} Confira usuário/senha em ~/.config/ciop-portal/incidentes.env e teste o login em https://cioplondrina.com.br/CADIncidentManagement/`);
  }

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

function parseBrazilianDate(value) {
  const match = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isBeforeMinDate(row) {
  const date = parseBrazilianDate(row.data);
  if (!date) return true;
  return date < minDateCutoff;
}

function isOnOrAfterMinDate(row) {
  const date = parseBrazilianDate(row.data);
  if (!date) return false;
  return date >= minDateCutoff;
}

function isDentroJanelaAtualizacao(row) {
  if (FORCE_FULL) return true;
  const date = parseBrazilianDate(row.data);
  if (!date) return true;
  return date >= janelaAtualizacaoCutoff;
}

function applyTipoVazio(row) {
  const semNatureza = !String(row.natureOfProblem || "").trim();
  const semInstrucoes = !String(row.instructions || "").trim();
  row.registroVazio = semNatureza && semInstrucoes;
  return row;
}

function ensureTipoOriginal(row) {
  const tipo = String(row.tipo || "").trim();
  const original = String(row.tipoOriginal || "").trim();
  if (original && original.toUpperCase() !== "VAZIO") {
    row.tipoOriginal = original;
    if (!tipo || tipo.toUpperCase() === "VAZIO") row.tipo = original;
  } else if (tipo && tipo.toUpperCase() !== "VAZIO") {
    row.tipoOriginal = tipo;
  } else {
    row.tipoOriginal = original || tipo;
  }
  return row;
}

function vehicleNumber(value) {
  const text = String(value || '').trim();
  const match = text.match(/^([^\s-]+)/);
  return match ? match[1] : text;
}

function descricaoSubstituto(row) {
  if (!row || typeof row !== 'object') return '';
  const nomes = colunaSubstitutoGrid
    ? [colunaSubstitutoGrid, ...SUBSTITUTO_CANDIDATOS]
    : SUBSTITUTO_CANDIDATOS;
  for (const nome of nomes) {
    const v = String(row[nome] || '').trim();
    if (v) return v;
  }
  return '';
}

async function detectarColunaSubstituto(jar) {
  const refererUrl = endpoint.replace(/\/Json\/GetDataDictionary$/, '');
  for (const col of SUBSTITUTO_CANDIDATOS) {
    const body = new URLSearchParams();
    body.set('DataSourceKey', 'Incidents.Sql.IncidentGridView');
    body.append('Columns[]', 'IncidentID');
    body.append('Columns[]', col);
    body.set('SortColumn', 'AddDTS');
    body.set('ResultType', '1');
    body.set('SortDirection', '1');
    body.set('DisplayStart', '0');
    body.set('DisplayLength', '1');
    body.set('ColumnsSearch[DivisionShortName]', 'TCGL');
    body.set('timezoneOffset', '180');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: apiHeaders(jar, refererUrl),
        body,
        signal: AbortSignal.timeout(Math.min(requestTimeoutMs, 15000)),
      });
      if (!response.ok) {
        console.log(`Substituto: ${col} HTTP ${response.status}`);
        continue;
      }
      const json = JSON.parse(await response.text());
      if (!Array.isArray(json)) {
        console.log(`Substituto: ${col} resposta inesperada`);
        continue;
      }
      console.log(`Substituto: usando coluna ${col}`);
      return col;
    } catch (err) {
      console.log(`Substituto: ${col} falhou (${err.message})`);
    }
  }
  console.log('Substituto: Replacement Vehicle não está no grid do CAD.');
  return '';
}

async function loadChunk(jar, start, length, allowRelogin = true) {
  const refererUrl = endpoint.replace(/\/Json\/GetDataDictionary$/, '');
  const response = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: apiHeaders(jar, refererUrl),
    body: bodyFor(start, length),
  });

  if ((response.status === 401 || response.status === 403) && allowRelogin) {
    console.log(`HTTP ${response.status} ao buscar lote ${start}. Refazendo login...`);
    copyJar(await login(), jar);
    return loadChunk(jar, start, length, false);
  }

  if (!response.ok) {
    const preview = (await response.text()).slice(0, 180);
    throw new Error(`HTTP ${response.status} ao buscar lote iniciado em ${start}${preview ? `: ${preview}` : ''}`);
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
  const tipoOriginal = String(row.IncidentTypeName || '').trim();
  const substitutoDesc = descricaoSubstituto(row);
  return {
    incidentId: String(row.IncidentID || row.IncidentNr || ''),
    id: String(row.IncidentNr || ''),
    data: dateTime.data,
    hora: dateTime.hora,
    departamento: String(row.DepartmentName || ''),
    veiculo: vehicleNumber(row.VehicleDescription),
    veiculoSubstituto: vehicleNumber(substitutoDesc),
    linha: String(row.routename || ''),
    criadoPor: String(row.CreatedBy || ''),
    motoristaNr: String(row.DriverNr || ''),
    motorista: String(row.DriverName || ''),
    tipo: tipoOriginal,
    tipoOriginal,
    proprietario: String(row.OwnedBy || ''),
    estado: String(row.StateName || ''),
    natureOfProblem: '',
    instructions: '',
    cmtuAprovado: false,
    cmtuReprovado: false,
    cmtuAprovadoPor: '',
    cmtuReprovadoPor: '',
    cmtuJustificativa: '',
    empresa: String(row.DivisionShortName || ''),
    veiculoDescricao: String(row.VehicleDescription || ''),
    veiculoSubstitutoDescricao: substitutoDesc,
  };
}

function rowKey(row) {
  return String(row?.incidentId || row?.id || '').trim();
}

const summaryFields = [
  'id',
  'data',
  'hora',
  'departamento',
  'veiculo',
  'veiculoSubstituto',
  'linha',
  'criadoPor',
  'motoristaNr',
  'motorista',
  'tipo',
  'tipoOriginal',
  'proprietario',
  'estado',
  'empresa',
  'veiculoDescricao',
  'veiculoSubstitutoDescricao',
];

function applySummaryUpdates(oldRow, newRow) {
  let estadoAtualizado = false;
  let dadosAtualizados = false;
  for (const field of summaryFields) {
    const before = String(oldRow[field] ?? '');
    const after = String(newRow[field] ?? '');
    if (before === after) continue;
    oldRow[field] = newRow[field] ?? '';
    if (field === 'estado') estadoAtualizado = true;
    else dadosAtualizados = true;
  }
  return { estadoAtualizado, dadosAtualizados };
}

function hasSummaryUpdate(row, existing) {
  const key = rowKey(row);
  const old = key ? existing.rowMap.get(key) : null;
  if (!old) return true;
  return summaryFields.some((field) => String(old[field] ?? '') !== String(row[field] ?? ''));
}

function readExistingPayload() {
  const empty = {
    rows: [],
    rowMap: new Map(),
    details: new Map(),
    processedIds: new Set(),
    checkedDetailIds: new Set(),
  };
  if (!fs.existsSync(outputFile)) return empty;
  try {
    const payload = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    const existing = {
      rows: [],
      rowMap: new Map(),
      details: new Map(),
      processedIds: new Set((payload.idsProcessados || []).map(String)),
      checkedDetailIds: new Set((payload.idsDetalhesConsultados || []).map(String)),
    };
    for (const row of payload.incidentes || []) {
      if (!isOnOrAfterMinDate(row)) continue;
      const key = rowKey(row);
      if (!key) continue;
      ensureTipoOriginal(row);
      applyTipoVazio(row);
      existing.rows.push(row);
      existing.rowMap.set(key, row);
      existing.processedIds.add(key);
      if (row.natureOfProblem || row.instructions || row.cmtuJustificativa || row.cmtuReprovadoPor || row.cmtuAprovadoPor) {
        existing.details.set(key, {
          natureOfProblem: String(row.natureOfProblem || ''),
          instructions: String(row.instructions || ''),
          cmtuAprovado: !!row.cmtuAprovado,
          cmtuReprovado: !!row.cmtuReprovado,
          cmtuAprovadoPor: String(row.cmtuAprovadoPor || ''),
          cmtuReprovadoPor: String(row.cmtuReprovadoPor || ''),
          cmtuJustificativa: String(row.cmtuJustificativa || '')
        });
        existing.checkedDetailIds.add(key);
      }
    }
    return existing;
  } catch {
    return empty;
  }
}

const DETAIL_COLS_BASE = ['IncidentID', 'NatureOfProblem', 'Instructions'];
/** Campos do formulário "Justificativa da CMTU" (GetModel Frm1a794d3e… / IncidentForm). */
const CMTU_FLDS = {
  aprovado: 'Fld399db56cedb24ee780e6b87e71874555',
  aprovadoPor: 'Fld6631eda4a45d406aaf78431411577d79',
  justificativa: 'Fldb514e1beb9804c82b69ee4bd8e66ff88',
  reprovado: 'Fldd405c26ca6e04803bd19b704de79aca3',
  reprovadoPor: 'Fld3eed174a78904cd3ae1f8d4d171a4556'
};
const DETAIL_COLS_CMTU = Object.values(CMTU_FLDS);

function valorCampo(row, nomes) {
  if (!row || typeof row !== 'object') return '';
  const lower = {};
  for (const [k, v] of Object.entries(row)) lower[String(k).toLowerCase()] = v;
  for (const nome of nomes) {
    const v = lower[String(nome).toLowerCase()];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

function flagSim(value) {
  const s = String(value ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'sim' || s === 'yes' || s === 'on' || s === 'checked';
}

function parseCmtuDeObjeto(row) {
  if (!row || typeof row !== 'object') {
    return {
      cmtuAprovado: false,
      cmtuReprovado: false,
      cmtuAprovadoPor: '',
      cmtuReprovadoPor: '',
      cmtuJustificativa: ''
    };
  }
  const justificativa = valorCampo(row, [CMTU_FLDS.justificativa, 'cmtuJustificativa', 'Justificativa']);
  const aprovadoPor = valorCampo(row, [CMTU_FLDS.aprovadoPor, 'cmtuAprovadoPor']);
  const reprovadoPor = valorCampo(row, [CMTU_FLDS.reprovadoPor, 'cmtuReprovadoPor']);
  const aprovado = valorCampo(row, [CMTU_FLDS.aprovado, 'cmtuAprovado']);
  const reprovado = valorCampo(row, [CMTU_FLDS.reprovado, 'cmtuReprovado']);
  return {
    cmtuAprovado: flagSim(aprovado),
    cmtuReprovado: flagSim(reprovado),
    cmtuAprovadoPor: aprovadoPor,
    cmtuReprovadoPor: reprovadoPor,
    cmtuJustificativa: justificativa
  };
}

function parseCmtuDoHtml(html) {
  const bruto = String(html || '');
  if (!/justificativa|aprovado por|reprovado por/i.test(bruto)) return null;
  const pick = (label) => {
    const re = new RegExp(
      String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '[\\s\\S]{0,280}?(?:value\\s*=\\s*"([^"]*)"|<textarea[^>]*>([\\s\\S]*?)</textarea>|<td[^>]*>([\\s\\S]*?)</td>)',
      'i'
    );
    const m = bruto.match(re);
    if (!m) return '';
    return String(m[1] || m[2] || m[3] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };
  const checkedPerto = (labelExato) => {
    const re = new RegExp(`(>|\\s)${labelExato}(\\s|<)`, 'i');
    const idx = bruto.search(re);
    if (idx < 0) return false;
    const slice = bruto.slice(Math.max(0, idx - 450), idx + 120);
    return /type=["']checkbox["'][^>]*checked|checked[^>]*type=["']checkbox["']/i.test(slice);
  };
  return {
    cmtuAprovado: checkedPerto('Aprovado'),
    cmtuReprovado: checkedPerto('Reprovado'),
    cmtuAprovadoPor: pick('Aprovado por'),
    cmtuReprovadoPor: pick('Reprovado por'),
    cmtuJustificativa: pick('Justificativa')
  };
}

function htmlTemJustificativaCmtu(html) {
  return /FALTOU MAIS INFORMACOES|Justificativa da CMTU|Reprovado por/i.test(String(html || ''));
}

async function postDictionary(jar, cols, extra = {}) {
  const body = new URLSearchParams();
  body.set('DataSourceKey', extra.dataSource || 'CADIncidentManagement.Sql.Unified');
  cols.forEach((column) => body.append('Columns[]', column));
  body.set('SortColumn', extra.sort || 'IncidentID');
  body.set('ResultType', '1');
  body.set('SortDirection', '1');
  body.set('DisplayStart', '0');
  body.set('DisplayLength', extra.length || '1');
  if (extra.incidentId) body.set('ColumnsSearch[IncidentID]', String(extra.incidentId));
  body.set('timezoneOffset', '180');
  const response = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: apiHeaders(jar, endpoint.replace(/\/Json\/GetDataDictionary$/, '')),
    body
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

async function loadUnifiedRow(jar, incidentId, cols) {
  const res = await postDictionary(jar, cols, { incidentId });
  if (!res.ok) throw new Error(`HTTP ${res.status} no detalhe do incidente ${incidentId}: ${res.text.slice(0, 160)}`);
  const json = JSON.parse(res.text);
  return Array.isArray(json) ? json[0] : null;
}

function guidAtivo() {
  return String(endpoint || '').match(/\/g\/([a-f0-9]{32})\//i)?.[1] || '';
}

let usarColunasCmtu = process.env.CIOP_INCIDENTES_CMTU_COLS !== '0';
let cmtuHtmlHabilitado = process.env.CIOP_INCIDENTES_CMTU_HTML === '1';
let cmtuHtmlPathOk = '';
let cmtuHtmlFalhasSeguidas = 0;

async function tentarHtmlIncidente(jar, incidentId) {
  if (!cmtuHtmlHabilitado) return { html: '', hits: [], parsed: null };
  const guid = guidAtivo();
  const paths = cmtuHtmlPathOk
    ? [cmtuHtmlPathOk]
    : [
        `/g/${guid}/Incidents/View/${incidentId}`,
        `/g/${guid}/Incidents/Edit/${incidentId}`,
        `/g/${guid}/Incidents/Details/${incidentId}`,
        `/g/${guid}/Incidents/Incident/${incidentId}`,
        `/g/${guid}/Incident/View/${incidentId}`
      ];
  const hits = [];
  for (const p of paths) {
    const url = p.startsWith('http') ? p : `${baseUrl}${p}`;
    try {
      const response = await requestOnce(jar, url, {
        headers: { Referer: endpoint.replace(/\/Json\/GetDataDictionary$/, '') }
      }, 12000);
      const html = await response.text();
      const snippetHit = htmlTemJustificativaCmtu(html) || /Justificativa/i.test(html);
      hits.push({
        url,
        status: response.status,
        bytes: html.length,
        hit: snippetHit,
        parsed: snippetHit ? parseCmtuDoHtml(html) : null
      });
      if (snippetHit) {
        cmtuHtmlPathOk = p;
        cmtuHtmlFalhasSeguidas = 0;
        return { html, hits, parsed: parseCmtuDoHtml(html) };
      }
    } catch (err) {
      hits.push({ url, erro: err.message });
    }
  }
  if (!cmtuHtmlPathOk) {
    cmtuHtmlHabilitado = false;
  }
  return { html: '', hits, parsed: null };
}

export async function probeCmtu(incidentId = '61907') {
  const jar = await login();
  const id = String(incidentId);
  const tentativas = [];

  const soId = await postDictionary(jar, ['IncidentID'], { incidentId: id });
  tentativas.push({
    nome: 'unified-so-id',
    status: soId.status,
    preview: soId.text.slice(0, 500),
    keys: (() => {
      try {
        const row = JSON.parse(soId.text)?.[0];
        return row ? Object.keys(row) : [];
      } catch {
        return [];
      }
    })()
  });

  const extra = await postDictionary(jar, [...DETAIL_COLS_BASE, ...DETAIL_COLS_CMTU], { incidentId: id });
  tentativas.push({
    nome: 'unified-cmtu-cols',
    status: extra.status,
    preview: extra.text.slice(0, 800)
  });

  for (const ds of [
    'CADIncidentManagement.Sql.IncidentForm',
    'CADIncidentManagement.Sql.Forms',
    'CADIncidentManagement.Sql.CustomFields',
    'Incidents.Sql.IncidentGridView'
  ]) {
    const res = await postDictionary(jar, ['IncidentID'], { incidentId: id, dataSource: ds });
    tentativas.push({
      nome: ds,
      status: res.status,
      preview: res.text.slice(0, 280)
    });
  }

  const htmlTry = await tentarHtmlIncidente(jar, id);
  return {
    ok: true,
    incidentId: id,
    endpoint,
    tentativas,
    htmlHits: htmlTry.hits,
    htmlParsed: htmlTry.parsed
  };
}

async function loadIncidentDetail(jar, incidentId) {
  let row = null;
  try {
    row = await loadUnifiedRow(
      jar,
      incidentId,
      usarColunasCmtu ? [...DETAIL_COLS_BASE, ...DETAIL_COLS_CMTU] : DETAIL_COLS_BASE
    );
  } catch (err) {
    if (usarColunasCmtu) {
      usarColunasCmtu = false;
      console.log(`Colunas CMTU falharam (${err.message}). Seguindo só com Natureza/Instruções.`);
    }
    row = await loadUnifiedRow(jar, incidentId, DETAIL_COLS_BASE);
  }
  return {
    natureOfProblem: String(row?.NatureOfProblem || ''),
    instructions: String(row?.Instructions || ''),
    ...parseCmtuDeObjeto(row)
  };
}

function aplicarDetalhe(row, detail) {
  if (!detail) return;
  row.natureOfProblem = detail.natureOfProblem || '';
  row.instructions = detail.instructions || '';
  row.cmtuAprovado = !!detail.cmtuAprovado;
  row.cmtuReprovado = !!detail.cmtuReprovado;
  row.cmtuAprovadoPor = String(detail.cmtuAprovadoPor || '');
  row.cmtuReprovadoPor = String(detail.cmtuReprovadoPor || '');
  row.cmtuJustificativa = String(detail.cmtuJustificativa || '');
}

function semCmtu(row) {
  return !String(row?.cmtuJustificativa || '').trim()
    && !String(row?.cmtuReprovadoPor || '').trim()
    && !String(row?.cmtuAprovadoPor || '').trim();
}

async function enrichDetails(jar, rows, candidateRows = rows) {
  if (!loadDetails) return rows;
  const details = existingPayload.details;
  rows.forEach((row) => {
    const cached = details.get(row.incidentId) || details.get(row.id);
    if (cached) aplicarDetalhe(row, cached);
  });

  let pending = candidateRows.filter((row) => {
    const key = rowKey(row);
    if (!key) return false;
    if (isDentroJanelaAtualizacao(row)) return true;
    return !row.natureOfProblem && !row.instructions && !existingPayload.checkedDetailIds.has(key);
  });
  if (detailLimit > 0) pending = pending.slice(0, detailLimit);
  if (!pending.length) {
    console.log('Detalhes: todos os registros já estavam em cache.');
    return rows;
  }

  console.log(`Detalhes: buscando ${pending.length} incidentes (natureza, instruções e justificativa CMTU).`);
  let index = 0;
  let done = 0;
  async function worker() {
    while (index < pending.length) {
      const row = pending[index++];
      try {
        const detail = await loadIncidentDetail(jar, row.incidentId);
        aplicarDetalhe(row, detail);
        existingPayload.details.set(rowKey(row), detail);
        existingPayload.checkedDetailIds.add(rowKey(row));
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

function chunkSemNovidade(chunkRows, existing) {
  if (!chunkRows.length) return false;
  return chunkRows.every((row) => !hasSummaryUpdate(row, existing));
}

function mergeRows(newRows, existing) {
  const merged = [];
  const used = new Set();
  const novosIds = new Set();
  const atualizadosIds = new Set();
  let countNovos = 0;
  let countEstado = 0;
  let countDados = 0;

  for (const row of newRows) {
    const key = rowKey(row);
    const old = key ? existing.rowMap.get(key) : null;
    if (old) {
      const updates = applySummaryUpdates(old, row);
      if (updates.estadoAtualizado) {
        countEstado += 1;
      }
      if (updates.dadosAtualizados) countDados += 1;
      if (key && (updates.estadoAtualizado || updates.dadosAtualizados)) atualizadosIds.add(key);
      ensureTipoOriginal(old);
      merged.push(old);
    } else {
      ensureTipoOriginal(row);
      merged.push(row);
      countNovos += 1;
      if (key) novosIds.add(key);
    }
    if (key) used.add(key);
  }

  for (const row of existing.rows) {
    const key = rowKey(row);
    if (key && used.has(key)) continue;
    ensureTipoOriginal(row);
    merged.push(row);
    if (key) used.add(key);
  }

  console.log(`Merge incremental: ${countNovos} novos, ${countEstado} estados atualizados, ${countDados} dados atualizados, ${merged.length} total.`);
  return { merged, countNovos, countEstado, countDados, novosIds, atualizadosIds };
}

let existingPayload = {
  rows: [],
  rowMap: new Map(),
  details: new Map(),
  processedIds: new Set(),
  checkedDetailIds: new Set()
};

export async function executarAtualizacaoIncidentes() {
  existingPayload = readExistingPayload();
  const jar = await login();
  colunaSubstitutoGrid = await detectarColunaSubstituto(jar);
  if (colunaSubstitutoGrid && !columns.includes(colunaSubstitutoGrid)) {
    columns.push(colunaSubstitutoGrid);
  }
  fs.mkdirSync(outputDir, { recursive: true });

  let start = 0;
  let total = null;
  const rows = [];

  if (FORCE_FULL) {
    console.log(`Atualização COMPLETA: toda a base TCGL desde ${DATA_MINIMA_ISO.split("-").reverse().join("/")}.`);
  } else {
    console.log(`Atualização: lista completa desde ${DATA_MINIMA_ISO.split("-").reverse().join("/")} e detalhes dos últimos ${JANELA_ATUALIZACAO_DIAS} dias + justificativa CMTU desde ${DATA_MINIMA_ISO}.`);
  }

  while (total === null || start < total) {
    const chunk = await loadChunk(jar, start, pageLength);
    if (chunk.length === 0) break;
    total = Number(chunk[0].QueryRowCount || chunk.length);
    const chunkNormalizedAll = chunk.map(normalize);
    if (chunkNormalizedAll.length > 0 && chunkNormalizedAll.every(isBeforeMinDate)) {
      console.log(`Atualização: lote anterior a ${DATA_MINIMA_ISO}. Encerrando paginação.`);
      break;
    }
    const normalized = chunkNormalizedAll.filter((row) => isOnOrAfterMinDate(row));
    rows.push(...normalized);
    const snapshot = {
      atualizadoEm: new Date().toISOString(),
      fonte: 'Gerenciamento de Incidentes',
      empresa: 'TCGL',
      dataMinima: DATA_MINIMA_ISO,
      totalServidor: total,
      totalExtraido: rows.length,
      incidentes: rows,
    };
    fs.writeFileSync(partialFile, JSON.stringify(snapshot));
    console.log(`Baixados ${rows.length}/${total} (desde ${DATA_MINIMA_ISO})`);
    start += pageLength;
  }

  const { merged: mergedRows, countNovos, countEstado, countDados, novosIds, atualizadosIds } = mergeRows(rows, existingPayload);
  const cmtuBackfillLimite = Number(process.env.CIOP_INCIDENTES_CMTU_BACKFILL || 600);
  let cmtuPendentes = 0;
  const novosParaDetalhe = mergedRows.filter((row) => {
    const key = rowKey(row);
    if (!key) return false;
    if (novosIds.has(key) || atualizadosIds.has(key)) return true;
    if (isDentroJanelaAtualizacao(row)) return true;
    if (semCmtu(row) && cmtuPendentes < cmtuBackfillLimite) {
      cmtuPendentes += 1;
      return true;
    }
    return false;
  });
  await enrichDetails(jar, mergedRows, novosParaDetalhe);
  mergedRows.forEach((row) => {
    ensureTipoOriginal(row);
    applyTipoVazio(row);
  });
  const finalRows = mergedRows.filter(isOnOrAfterMinDate);
  const processedIds = Array.from(new Set(finalRows.map(rowKey).filter(Boolean)));
  const checkedDetailIds = Array.from(existingPayload.checkedDetailIds);
  const comCmtu = finalRows.filter((row) => !semCmtu(row)).length;
  console.log(`Incidentes desde ${DATA_MINIMA_ISO}: ${finalRows.length} (${comCmtu} com justificativa/parecer CMTU).`);

  const payload = {
    atualizadoEm: new Date().toISOString(),
    fonte: 'Gerenciamento de Incidentes',
    empresa: 'TCGL',
    dataMinima: DATA_MINIMA_ISO,
    totalServidor: total ?? rows.length,
    totalExtraido: finalRows.length,
    totalComEmpresa: mergedRows.length,
    ultimaMudanca: {
      novos: countNovos,
      estadosAtualizados: countEstado,
      dadosAtualizados: countDados,
      idsNovos: Array.from(novosIds),
      idsAtualizados: Array.from(atualizadosIds),
    },
    idsProcessados: processedIds,
    idsDetalhesConsultados: checkedDetailIds,
    incidentes: finalRows,
  };

  fs.writeFileSync(outputFile, JSON.stringify(payload));
  fs.rmSync(partialFile, { force: true });
  console.log(`Arquivo gerado: ${outputFile}`);
  return payload;
}

const esteArquivo = fileURLToPath(import.meta.url);
const chamadoDireto = Boolean(process.argv[1] && path.resolve(process.argv[1]) === esteArquivo);
if (chamadoDireto) {
  if (process.env.CIOP_INCIDENTES_PROBE_ID) {
    console.log(JSON.stringify(await probeCmtu(process.env.CIOP_INCIDENTES_PROBE_ID), null, 2));
  } else {
    await executarAtualizacaoIncidentes();
  }
}
