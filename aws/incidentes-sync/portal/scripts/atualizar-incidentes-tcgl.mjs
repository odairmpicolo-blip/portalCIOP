/**
 * Busca incidentes no TCGL (Gerenciamento de Incidentes) — VERSÃO LAMBDA.
 *
 * Igual à versão que roda no Mac (login com navegador real, porque o TCGL
 * passa a rejeitar com HTTP 500 qualquer login feito por requisição HTTP
 * crua), mas usando playwright-core + @sparticuz/chromium (Chromium
 * empacotado especificamente para rodar dentro do Lambda), em vez do
 * pacote "playwright" completo (que baixa um navegador do jeito errado
 * pro Lambda).
 *
 * Mesma lógica de normalização/merge/paginação da versão do Mac.
 * Não substituir este arquivo pelo scripts/atualizar-incidentes-tcgl.mjs do Mac.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium as playwright } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';

const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const outputDir = process.env.PORTAL_DATA_DIR || path.join(portalRoot, 'assets', 'data');
const outputFile = path.join(outputDir, 'incidentes-tcgl.json');
const partialFile = path.join(outputDir, 'incidentes-tcgl.partial.json');
const baseUrl = 'https://cioplondrina.com.br/CADIncidentManagement';
const loginUrl = `${baseUrl}/?ReturnUrl=%2fCADIncidentManagement%2fg%2f6ac2842af62b497aa5b0e515ef4b2ce9`;
const browserUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const usuario = process.env.CIOP_INCIDENTES_USUARIO;
const senha = process.env.CIOP_INCIDENTES_SENHA;
const requestTimeoutMs = Number(process.env.CIOP_INCIDENTES_TIMEOUT_MS || 60000);
const requestRetries = Number(process.env.CIOP_INCIDENTES_RETRIES || 6);
const detailConcurrency = Number(process.env.CIOP_INCIDENTES_DETALHES_CONCURRENCY || 4);
const detailLimit = Number(process.env.CIOP_INCIDENTES_DETALHES_LIMITE || 0);
const loadDetails = process.env.CIOP_INCIDENTES_DETALHES !== '0';
const pageLength = Number(process.env.CIOP_INCIDENTES_LOTE || 2000);
const DATA_MINIMA_ISO = String(process.env.CIOP_INCIDENTES_DATA_MIN || "2026-01-01").trim();

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
  'OperatorBadgeNumber',
  'Operator',
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function guidFrom(url) {
  return String(url || '').match(/\/CADIncidentManagement\/g\/([a-f0-9]{32})/i)?.[1] || '';
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

function apiHeaders(refererUrl) {
  return {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    Referer: refererUrl,
    Origin: 'https://cioplondrina.com.br',
    Accept: 'application/json, text/javascript, */*; q=0.01',
  };
}

// ---- Sessão via navegador real (playwright-core + @sparticuz/chromium) ----

let session = null; // { browser, context, guid, endpoint, refererUrl, userDataDir }

async function abrirNavegadorELogar() {
  const userDataDir = `/tmp/pw-${randomUUID()}`;
  const browser = await playwright.launch({
    args: chromiumBinary.args,
    executablePath: await chromiumBinary.executablePath(),
    headless: true,
  });
  const context = await browser.newContext({
    userAgent: browserUserAgent,
    locale: 'pt-BR',
  });
  const page = await context.newPage();
  try {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: requestTimeoutMs });

    await page.fill('input[name="UserName"]', usuario);
    await page.fill('input[name="Password"]', senha);

    const submit = page.locator('button[type="submit"], input[type="submit"]').first();
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: requestTimeoutMs }).catch(() => {}),
      submit.click(),
    ]);
    await page.waitForLoadState('networkidle', { timeout: requestTimeoutMs }).catch(() => {});

    const currentUrl = page.url();
    const aindaTemSenha = await page.locator('input[name="Password"]').count();
    if (aindaTemSenha > 0) {
      throw new Error('Login rejeitado — verifique CIOP_INCIDENTES_USUARIO e CIOP_INCIDENTES_SENHA (Secrets Manager).');
    }

    const guid = guidFrom(currentUrl);
    if (!guid) throw new Error('Não foi possível identificar a sessão após login (URL: ' + currentUrl + ').');

    const endpoint = `${baseUrl}/g/${guid}/Json/GetDataDictionary`;
    const refererUrl = `${baseUrl}/g/${guid}`;

    const verify = await context.request.post(endpoint, {
      headers: apiHeaders(refererUrl),
      data: bodyFor(0, 1).toString(),
      timeout: requestTimeoutMs,
    });
    if (!verify.ok()) {
      const preview = (await verify.text()).slice(0, 200);
      throw new Error(`API TCGL retornou HTTP ${verify.status()}${preview ? `: ${preview}` : ''}`);
    }

    await page.close();
    return { browser, context, guid, endpoint, refererUrl, userDataDir };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

async function login() {
  if (session) {
    await session.browser.close().catch(() => {});
    if (session.userDataDir) await fs.promises.rm(session.userDataDir, { recursive: true, force: true }).catch(() => {});
    session = null;
  }
  session = await abrirNavegadorELogar();
  return session;
}

async function fecharSessao() {
  if (session) {
    await session.browser.close().catch(() => {});
    if (session.userDataDir) await fs.promises.rm(session.userDataDir, { recursive: true, force: true }).catch(() => {});
    session = null;
  }
}

async function postComRetry(url, dataBody) {
  let lastError = null;
  for (let attempt = 1; attempt <= requestRetries; attempt += 1) {
    try {
      const resp = await session.context.request.post(url, {
        headers: apiHeaders(session.refererUrl),
        data: dataBody,
        timeout: requestTimeoutMs,
      });
      if (resp.status() >= 500 && attempt < requestRetries) {
        await delay(attempt * 4000);
        continue;
      }
      return resp;
    } catch (error) {
      lastError = error;
      if (attempt >= requestRetries) break;
      console.log(`Tentativa ${attempt} falhou ao acessar ${url}. Nova tentativa em ${attempt * 4}s.`);
      await delay(attempt * 4000);
    }
  }
  throw lastError;
}

// ---- Normalização / merge (idêntico à versão do Mac) ----------------------

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

async function loadChunk(start, length, allowRelogin = true) {
  const resp = await postComRetry(session.endpoint, bodyFor(start, length).toString());

  if ((resp.status() === 401 || resp.status() === 403) && allowRelogin) {
    console.log(`HTTP ${resp.status()} ao buscar lote ${start}. Refazendo login...`);
    await login();
    return loadChunk(start, length, false);
  }

  if (!resp.ok()) {
    const preview = (await resp.text()).slice(0, 180);
    throw new Error(`HTTP ${resp.status()} ao buscar lote iniciado em ${start}${preview ? `: ${preview}` : ''}`);
  }

  const text = await resp.text();
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
    departamento: String(row.DepartmentName || ''),
    motoristaNr: String(row.OperatorBadgeNumber || ''),
    motorista: String(row.Operator || ''),
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
  'departamento',
  'motoristaNr',
  'motorista',
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
      if (row.natureOfProblem || row.instructions || row.cmtuJustificativa || row.cmtuReprovadoPor || row.cmtuAprovadoPor) {
        existing.details.set(key, {
          natureOfProblem: String(row.natureOfProblem || ''),
          instructions: String(row.instructions || ''),
          cmtuAprovado: !!row.cmtuAprovado,
          cmtuReprovado: !!row.cmtuReprovado,
          cmtuAprovadoPor: String(row.cmtuAprovadoPor || ''),
          cmtuReprovadoPor: String(row.cmtuReprovadoPor || ''),
          cmtuJustificativa: String(row.cmtuJustificativa || ''),
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
const CMTU_FLDS = {
  aprovado: 'Fld399db56cedb24ee780e6b87e71874555',
  aprovadoPor: 'Fld6631eda4a45d406aaf78431411577d79',
  justificativa: 'Fldb514e1beb9804c82b69ee4bd8e66ff88',
  reprovado: 'Fldd405c26ca6e04803bd19b704de79aca3',
  reprovadoPor: 'Fld3eed174a78904cd3ae1f8d4d171a4556',
};
const DETAIL_COLS_CMTU = Object.values(CMTU_FLDS);
let usarColunasCmtu = process.env.CIOP_INCIDENTES_CMTU_COLS !== '0';

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
  return {
    cmtuAprovado: flagSim(valorCampo(row, [CMTU_FLDS.aprovado, 'cmtuAprovado'])),
    cmtuReprovado: flagSim(valorCampo(row, [CMTU_FLDS.reprovado, 'cmtuReprovado'])),
    cmtuAprovadoPor: valorCampo(row, [CMTU_FLDS.aprovadoPor, 'cmtuAprovadoPor']),
    cmtuReprovadoPor: valorCampo(row, [CMTU_FLDS.reprovadoPor, 'cmtuReprovadoPor']),
    cmtuJustificativa: valorCampo(row, [CMTU_FLDS.justificativa, 'cmtuJustificativa']),
  };
}

function semCmtu(row) {
  return !String(row?.cmtuJustificativa || '').trim()
    && !String(row?.cmtuReprovadoPor || '').trim()
    && !String(row?.cmtuAprovadoPor || '').trim();
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

async function postUnified(incidentId, cols) {
  const body = new URLSearchParams();
  body.set('DataSourceKey', 'CADIncidentManagement.Sql.Unified');
  cols.forEach((column) => body.append('Columns[]', column));
  body.set('SortColumn', 'IncidentID');
  body.set('ResultType', '1');
  body.set('SortDirection', '1');
  body.set('DisplayStart', '0');
  body.set('DisplayLength', '1');
  body.set('ColumnsSearch[IncidentID]', String(incidentId));
  body.set('timezoneOffset', '180');
  const resp = await postComRetry(session.endpoint, body.toString());
  if (!resp.ok()) throw new Error(`HTTP ${resp.status()} no detalhe do incidente ${incidentId}`);
  const json = JSON.parse(await resp.text());
  return Array.isArray(json) ? json[0] : null;
}

async function loadIncidentDetail(incidentId) {
  let row = null;
  try {
    row = await postUnified(
      incidentId,
      usarColunasCmtu ? [...DETAIL_COLS_BASE, ...DETAIL_COLS_CMTU] : DETAIL_COLS_BASE
    );
  } catch (err) {
    if (usarColunasCmtu) {
      usarColunasCmtu = false;
      console.log(`Colunas CMTU falharam (${err.message}). Seguindo só com Natureza/Instruções.`);
    }
    row = await postUnified(incidentId, DETAIL_COLS_BASE);
  }
  return {
    natureOfProblem: String(row?.NatureOfProblem || ''),
    instructions: String(row?.Instructions || ''),
    ...parseCmtuDeObjeto(row),
  };
}

async function enrichDetails(rows, candidateRows = rows) {
  if (!loadDetails) return rows;
  const details = existingPayload.details;
  rows.forEach((row) => {
    const cached = details.get(row.incidentId) || details.get(row.id);
    if (cached) aplicarDetalhe(row, cached);
  });

  let pending = candidateRows.filter((row) => {
    const key = rowKey(row);
    if (!key) return false;
    return true;
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
        const detail = await loadIncidentDetail(row.incidentId);
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

// ---- Execução principal -----------------------------------------------

const existingPayload = readExistingPayload();

try {
  await login();
  fs.mkdirSync(outputDir, { recursive: true });

  let start = 0;
  let total = null;
  const rows = [];

  console.log(`Atualização Lambda (navegador real): buscando incidentes TCGL desde ${DATA_MINIMA_ISO.split("-").reverse().join("/")}.`);

  while (total === null || start < total) {
    const chunk = await loadChunk(start, pageLength);
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
      console.log("Atualização: lote sem incidentes novos nem mudança de estado. Encerrando paginação.");
      break;
    }
    start += pageLength;
  }

  const { merged: mergedRows, countNovos, countEstado, countDados, novosIds, atualizadosIds } = mergeRows(rows, existingPayload);
  const cmtuBackfillLimite = Number(process.env.CIOP_INCIDENTES_CMTU_BACKFILL || 8000);
  let cmtuPendentes = 0;
  const novosParaDetalhe = mergedRows.filter((row) => {
    const key = rowKey(row);
    if (!key) return false;
    if (novosIds.has(key) || atualizadosIds.has(key)) return true;
    if (semCmtu(row) && cmtuPendentes < cmtuBackfillLimite) {
      cmtuPendentes += 1;
      return true;
    }
    return false;
  });
  if (fs.existsSync(outputFile) && countNovos === 0 && countEstado === 0 && countDados === 0 && novosParaDetalhe.length === 0) {
    fs.rmSync(partialFile, { force: true });
    console.log('Atualização incremental: nenhum incidente novo ou atualizado. JSON mantido sem alterações.');
    await fecharSessao();
    process.exit(0);
  }
  await enrichDetails(mergedRows, novosParaDetalhe);
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
    idsProcessados: processedIds,
    idsDetalhesConsultados: checkedDetailIds,
    incidentes: finalRows,
  };

  fs.writeFileSync(outputFile, JSON.stringify(payload));
  fs.rmSync(partialFile, { force: true });
  console.log(`Arquivo gerado: ${outputFile}`);
} finally {
  await fecharSessao();
}
