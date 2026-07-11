/**
 * Busca incidentes no TCGL (Gerenciamento de Incidentes).
 * Incremental: incidentes já conhecidos só atualizam estado; detalhes só para novos.
 */
import fs from 'node:fs';
import path from 'node:path';

const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const outputDir = process.env.PORTAL_DATA_DIR || path.join(portalRoot, 'assets', 'data');
const outputFile = path.join(outputDir, 'incidentes-tcgl.json');
const partialFile = path.join(outputDir, 'incidentes-tcgl.partial.json');
const cookieFile = '/tmp/incidentes-cookie.txt';
const baseUrl = 'https://cioplondrina.com.br/CADIncidentManagement';
const loginUrl = `${baseUrl}/?ReturnUrl=%2fCADIncidentManagement%2fg%2f6ac2842af62b497aa5b0e515ef4b2ce9`;
const browserUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const usuario = process.env.CIOP_INCIDENTES_USUARIO;
const senha = process.env.CIOP_INCIDENTES_SENHA;
let endpoint = '';
const requestTimeoutMs = Number(process.env.CIOP_INCIDENTES_TIMEOUT_MS || 60000);
const requestRetries = Number(process.env.CIOP_INCIDENTES_RETRIES || 20);
const detailConcurrency = Number(process.env.CIOP_INCIDENTES_DETALHES_CONCURRENCY || 8);
const detailLimit = Number(process.env.CIOP_INCIDENTES_DETALHES_LIMITE || 0);
const loadDetails = process.env.CIOP_INCIDENTES_DETALHES !== '0';
const pageLength = Number(process.env.CIOP_INCIDENTES_LOTE || 2000);
const DATA_MINIMA_ISO = String(process.env.CIOP_INCIDENTES_DATA_MIN || "2026-01-01").trim();
const JANELA_ATUALIZACAO_DIAS = Number(process.env.CIOP_INCIDENTES_JANELA_ATUALIZACAO_DIAS || 10);
if (!usuario || !senha) {
  throw new Error('Configure CIOP_INCIDENTES_USUARIO e CIOP_INCIDENTES_SENHA antes de atualizar os incidentes.');
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

function applyBrowserHeaders(headers) {
  if (!headers.has('User-Agent')) headers.set('User-Agent', browserUserAgent);
  if (!headers.has('Accept')) headers.set('Accept', 'text/html,application/json,*/*;q=0.8');
  if (!headers.has('Accept-Language')) headers.set('Accept-Language', 'pt-BR,pt;q=0.9');
}

function copyJar(from, to) {
  to.clear();
  for (const [name, value] of from.entries()) to.set(name, value);
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
  return {
    incidentId: String(row.IncidentID || row.IncidentNr || ''),
    id: String(row.IncidentNr || ''),
    data: dateTime.data,
    hora: dateTime.hora,
    veiculo: vehicleNumber(row.VehicleDescription),
    linha: String(row.routename || ''),
    criadoPor: String(row.CreatedBy || ''),
    tipo: tipoOriginal,
    tipoOriginal,
    proprietario: String(row.OwnedBy || ''),
    estado: String(row.StateName || ''),
    natureOfProblem: '',
    instructions: '',
    empresa: String(row.DivisionShortName || ''),
    veiculoDescricao: String(row.VehicleDescription || ''),
  };
}

function rowKey(row) {
  return String(row?.incidentId || row?.id || '').trim();
}

const summaryFields = [
  'id',
  'data',
  'hora',
  'veiculo',
  'linha',
  'criadoPor',
  'tipo',
  'tipoOriginal',
  'proprietario',
  'estado',
  'empresa',
  'veiculoDescricao',
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
      if (row.natureOfProblem || row.instructions) {
        existing.details.set(key, {
          natureOfProblem: String(row.natureOfProblem || ''),
          instructions: String(row.instructions || ''),
        });
        existing.checkedDetailIds.add(key);
      }
    }
    return existing;
  } catch {
    return empty;
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
    headers: apiHeaders(jar, endpoint.replace(/\/Json\/GetDataDictionary$/, '')),
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

async function enrichDetails(jar, rows, candidateRows = rows) {
  if (!loadDetails) return rows;
  const details = existingPayload.details;
  rows.forEach((row) => {
    const cached = details.get(row.incidentId) || details.get(row.id);
    if (cached) {
      row.natureOfProblem = cached.natureOfProblem;
      row.instructions = cached.instructions;
    }
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

const existingPayload = readExistingPayload();
const jar = await login();
fs.mkdirSync(outputDir, { recursive: true });

let start = 0;
let total = null;
const rows = [];

console.log(`Atualização: buscando todos os incidentes TCGL desde ${DATA_MINIMA_ISO.split("-").reverse().join("/")}.`);

while (total === null || start < total) {
  const chunk = await loadChunk(jar, start, pageLength);
  if (chunk.length === 0) break;
  total = Number(chunk[0].QueryRowCount || chunk.length);
  const normalized = chunk.map(normalize).filter((row) => isOnOrAfterMinDate(row));
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
  const chunkNormalizedAll = chunk.map(normalize);
  if (chunkNormalizedAll.length > 0 && chunkNormalizedAll.every(isBeforeMinDate)) {
    console.log(`Atualização: lote anterior a ${DATA_MINIMA_ISO}. Encerrando paginação.`);
    break;
  }
if (chunkNormalizedAll.length > 0 && chunkSemNovidade(chunkNormalizedAll, existingPayload)) {
    const chunkDentroJanela = chunkNormalizedAll.some(isDentroJanelaAtualizacao);
    if (!chunkDentroJanela) {
      console.log(`Atualização: lote sem novidades e fora da janela de ${JANELA_ATUALIZACAO_DIAS} dias. Encerrando paginação.`);
      break;
    }
    console.log(`Atualização: lote sem novidades, mas dentro da janela de ${JANELA_ATUALIZACAO_DIAS} dias - continuando para garantir cobertura completa.`);
  }
  start += pageLength;
}

const { merged: mergedRows, countNovos, countEstado, countDados, novosIds, atualizadosIds } = mergeRows(rows, existingPayload);
if (fs.existsSync(outputFile) && countNovos === 0 && countEstado === 0 && countDados === 0) {
  fs.rmSync(partialFile, { force: true });
  console.log('Atualização incremental: nenhum incidente novo ou atualizado. JSON mantido sem alterações.');
  process.exit(0);
}
const novosParaDetalhe = mergedRows.filter((row) => {
    const key = rowKey(row);
    if (!key) return false;
    const semDetalhe = !String(row.natureOfProblem || "").trim() && !String(row.instructions || "").trim();
    if (novosIds.has(key) && semDetalhe) return true;
    if (isDentroJanelaAtualizacao(row)) return true;
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
console.log(`Incidentes desde ${DATA_MINIMA_ISO}: ${finalRows.length} (registroVazio quando sem natureza/instruções; tipo TCGL preservado).`);

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
