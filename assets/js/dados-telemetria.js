import {
  carregarTelemetriaAws,
  importarTelemetriaAws,
  telemetriaAwsDisponivel,
  aguardarAuthTelemetria
} from "./telemetria-aws.js";
import { initPortalAwsRuntime } from "./portal-aws-config.js";
import {
  agregarLinhasTelemetria,
  nomeColunaClever,
  normalizarLinhaTelemetria,
  normalizarColunaTelemetria
} from "./telemetria-merge.js";

const FROTA = (window.FROTA_PATIO || []).slice().sort((a, b) =>
  String(a.veiculo).localeCompare(String(b.veiculo), "pt-BR", { numeric: true })
);

const CHAVES_VEICULO = [
  "veiculo", "veículo", "vehicle id", "vehicle_id", "prefixo", "carro", "numero", "número", "n°", "nº",
  "frota", "id_veiculo", "codigo", "código", "placa", "vehicle", "bus"
];

const CHAVES_DATA = ["data", "date", "dia", "dt", "data_ref", "data referencia"];

const KPI_DEFS = [
  { id: "can", rotulos: ["eventos", "registros can", "number of events"] },
  { id: "kmInicial", rotulos: ["km/inicial", "km inicial", "start distance"] },
  { id: "kmFinal", rotulos: ["km/final", "km final", "end distance"] },
  { id: "kmPercorrido", rotulos: ["distancia", "distância", "km percorrido", "daily distance"] }
];

const COLUNAS_OCULTAS = [
  "cliente",
  "customer id",
  "customer_id",
  "temperatura cabine",
  "avg cabin temp",
  "avg_cabin_temp",
  "temp cabine"
];

function colunaOculta(nome) {
  const n = normChave(nome);
  return COLUNAS_OCULTAS.some((k) => n === k || n.includes(k));
}

function colunasExibiveis(headers, colVeiculo) {
  return (headers || []).filter((h) => h !== colVeiculo && !colunaOculta(h));
}

function colunaTemperatura(nome) {
  const n = normChave(nome);
  return n.includes("temp.") || n.includes("temperatura");
}

function formatarTemperatura(val) {
  const s = String(val ?? "").trim();
  if (!s) return "";
  const num = Number(s.replace(",", "."));
  if (Number.isNaN(num)) return s;
  const formatted = num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted}ºC`;
}

function formatarCelula(col, val) {
  const s = String(val ?? "").trim();
  if (!s) return "";
  if (colunaTemperatura(col)) return formatarTemperatura(s);
  return s;
}

function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normChave(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nomeColunaPadrao(nome) {
  return normalizarColunaTelemetria(nomeColunaClever(nome) || nome);
}

function normVeiculo(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  if (digits) return String(parseInt(digits, 10));
  return s.toUpperCase();
}

function valorPreenchido(v) {
  const s = String(v ?? "").trim();
  if (!s) return false;
  const low = s.toLowerCase();
  return !["-", "—", "n/a", "na", "null", "undefined", "#n/a"].includes(low);
}

function detectarDelimitador(linha) {
  const virgulas = (linha.match(/,/g) || []).length;
  const pontos = (linha.match(/;/g) || []).length;
  return pontos > virgulas ? ";" : ",";
}

function parseCsv(texto) {
  const src = texto.replace(/^\uFEFF/, "");
  const delim = detectarDelimitador((src.split(/\r?\n/).find((l) => l.trim()) || ""));
  const linhas = [];
  let row = [];
  let cell = "";
  let emAspas = false;

  const pushCell = () => { row.push(cell); cell = ""; };
  const pushRow = () => {
    if (row.length > 1 || row[0] !== "" || cell) pushCell();
    if (row.some((x) => String(x).trim() !== "")) linhas.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];
    if (emAspas) {
      if (c === "\"" && next === "\"") { cell += "\""; i++; }
      else if (c === "\"") emAspas = false;
      else cell += c;
      continue;
    }
    if (c === "\"") { emAspas = true; continue; }
    if (c === "\r") continue;
    if (c === "\n") { pushCell(); pushRow(); continue; }
    if (c === delim) { pushCell(); continue; }
    cell += c;
  }
  if (cell.length || row.length) { pushCell(); pushRow(); }
  return linhas;
}

function converterLinhasCsv(linhas) {
  if (!linhas.length) return { headers: [], rows: [] };
  const pares = [];
  linhas[0].forEach((h, i) => {
    const col = nomeColunaPadrao(String(h).trim());
    if (col) pares.push({ i, col });
  });
  const headers = [...new Set(pares.map((p) => p.col))];
  const rows = linhas.slice(1).map((cols) => {
    const obj = {};
    pares.forEach(({ i, col }) => {
      obj[col] = cols[i] != null ? String(cols[i]).trim() : "";
    });
    return obj;
  });
  return { headers, rows };
}

function detectarColunaVeiculo(headers) {
  const normHeaders = headers.map((h) => normChave(h));
  for (let i = 0; i < normHeaders.length; i++) {
    const n = normHeaders[i];
    if (CHAVES_VEICULO.some((k) => n === k || n.includes(k))) return headers[i];
  }
  return headers[0] || "";
}

function detectarColunaData(headers) {
  const normHeaders = headers.map((h) => normChave(h));
  for (let i = 0; i < normHeaders.length; i++) {
    const n = normHeaders[i];
    if (CHAVES_DATA.some((k) => n === k || n.startsWith(k))) return headers[i];
  }
  return "";
}

function detectarColunasKpi(headers) {
  const map = {};
  KPI_DEFS.forEach((def) => {
    const col = headers.find((h) => {
      const n = normChave(h);
      return def.rotulos.some((r) => n === r || n.includes(r));
    });
    if (col) map[def.id] = col;
  });
  return map;
}

function parseDataCsv(val) {
  const s = String(val || "").trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${day}`;
  }
  return "";
}

function normalizarDataIsoApi(val) {
  return parseDataCsv(val) || String(val || "").slice(0, 10);
}

function chaveLinha(row, colVeiculo, colData) {
  return `${parseDataCsv(row[colData])}|${normVeiculo(row[colVeiculo])}`;
}

function mesclarHeaders(atual, novo) {
  const set = new Set([...(atual || []), ...novo]);
  return [...set];
}

function unificarLinhasPorVeiculoData(rows, colVeiculo, colData) {
  const grupos = new Map();
  (rows || []).forEach((row) => {
    const key = chaveLinha(row, colVeiculo, colData);
    if (!key || key.includes("undefined") || key.startsWith("|") || key.endsWith("|")) return;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(row);
  });
  return [...grupos.values()].map((grupo) => agregarLinhasTelemetria(grupo));
}

function mesclarRows(atual, novas, colVeiculo, colData) {
  return unificarLinhasPorVeiculoData([...(atual || []), ...(novas || [])], colVeiculo, colData);
}

function payloadParaLinha(row, colVeiculo, colData) {
  const dataIso = parseDataCsv(row[colData]);
  const veiculo = normVeiculo(row[colVeiculo]);
  if (!dataIso || !veiculo) return null;
  return { data_iso: dataIso, veiculo, payload: { ...row } };
}

function linhasAwsParaRows(dados, headers, colVeiculo, colData) {
  const map = new Map();
  (dados || []).forEach((item) => {
    let payload = item.payload || item;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch (_) { payload = {}; }
    }
    const row = limparColunasExcluidas({ ...payload });
    const veiculo = item.veiculo || item.veiculo_norm || row.veiculo_norm;
    const dataIso = normalizarDataIsoApi(item.data_iso || row.data_iso);
    if (colVeiculo && !row[colVeiculo] && veiculo) row[colVeiculo] = veiculo;
    if (colData && dataIso) {
      const [y, m, d] = dataIso.split("-");
      row[colData] = `${d}-${m}-${y}`;
    }
    row.data_iso = dataIso;
    const key = chaveLinha(row, colVeiculo, colData);
    if (!key || key.startsWith("|") || key.endsWith("|")) return;
    const prev = map.get(key);
    if (prev) prev.push(row);
    else map.set(key, [row]);
  });
  return [...map.values()].flatMap((grupo) => {
    const agregado = agregarLinhasTelemetria(grupo);
    return agregado && Object.keys(agregado).length ? [agregado] : [];
  });
}

function arquivosDosRegistrosAws(dados) {
  const nomes = new Set();
  (dados || []).forEach((item) => {
    const nome = String(item?.origem_arquivo || "").trim();
    if (nome) nomes.add(nome);
  });
  return [...nomes];
}

function headersDoPayload(payload) {
  const ignore = new Set(["data_iso", "veiculo_norm"]);
  return Object.keys(payload || {}).filter((k) => !ignore.has(k) && !colunaOculta(k));
}

function limparColunasExcluidas(row) {
  return normalizarLinhaTelemetria(row);
}

function filtrarRowsPorData(rows, colData, dataDe, dataAte) {
  if (!colData || (!dataDe && !dataAte)) return rows;
  const de = dataDe ? String(dataDe).slice(0, 10) : "";
  const ate = dataAte ? String(dataAte).slice(0, 10) : "";
  return rows.filter((row) => {
    const iso = parseDataCsv(row[colData]);
    if (!iso) return false;
    if (de && iso < de) return false;
    if (ate && iso > ate) return false;
    return true;
  });
}

function calcularStats(rows, colVeiculo, colunasKpi) {
  const frotaIds = new Set(FROTA.map((f) => normVeiculo(f.veiculo)));
  const noArquivo = new Set();
  const sets = { can: new Set(), kmInicial: new Set(), kmFinal: new Set(), kmPercorrido: new Set() };

  rows.forEach((row) => {
    const id = normVeiculo(row[colVeiculo]);
    if (!frotaIds.has(id)) return;
    noArquivo.add(id);
    KPI_DEFS.forEach((def) => {
      const col = colunasKpi[def.id];
      if (col && valorPreenchido(row[col])) sets[def.id].add(id);
    });
  });

  return {
    frota: FROTA.length,
    noArquivo: noArquivo.size,
    comCan: sets.can.size,
    comKmInicial: sets.kmInicial.size,
    comKmFinal: sets.kmFinal.size,
    comKmPercorrido: sets.kmPercorrido.size,
    linhas: rows.length,
    veiculosArquivo: new Set(rows.map((r) => normVeiculo(r[colVeiculo])).filter(Boolean)).size
  };
}

function classeLinhaDado(row, colunasKpi) {
  const cols = KPI_DEFS.map((d) => colunasKpi[d.id]).filter(Boolean);
  if (!cols.length) return "";
  let filled = 0;
  cols.forEach((col) => { if (valorPreenchido(row[col])) filled++; });
  if (filled === 0) return "row-sem-dados";
  if (filled < cols.length) return "row-incoerente";
  return "";
}

function dataIsoPadrao(offsetDias) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return d.toISOString().slice(0, 10);
}

function periodoBuscaAws() {
  return { de: dataIsoPadrao(-120), ate: dataIsoPadrao(30) };
}

function headersVisiveis(headers, colVeiculo) {
  const ignore = new Set(["data_iso", "veiculo_norm"]);
  return (headers || []).filter((h) => h !== colVeiculo && !ignore.has(h) && !colunaOculta(h));
}

function rowsFromSource(src, headersIniciais, colVeiculoGuess, colDataGuess) {
  const lista = src.rows || [];
  if (!lista.length) return [];
  const first = lista[0];
  if (first?.payload || (first?.veiculo && !first?.[colVeiculoGuess])) {
    return linhasAwsParaRows(lista, headersIniciais, colVeiculoGuess, colDataGuess);
  }
  return lista.map((r) => ({ ...r }));
}

function aguardar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatarDataBr(iso) {
  const [y, m, d] = String(iso || "").split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

let dadosBrutos = null;
let colunasMarcadas = new Set();
let awsAtivo = false;
let abaDataAtiva = "todas";
let sortCol = null;
let sortDir = "asc";
let primeiraCarga = true;
const CACHE_STORAGE_KEY = "portal_telemetria_v3";
const CACHE_LEGACY_KEYS = ["portal_telemetria_v1", "portal_telemetria_v2"];

function limparCacheTelemetriaLegado() {
  CACHE_LEGACY_KEYS.forEach((k) => {
    try { localStorage.removeItem(k); } catch (_) { /* ignore */ }
  });
}

function persistirCacheTelemetria() {
  if (!dadosBrutos?.rows?.length) return;
  try {
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify({
      headers: dadosBrutos.headers,
      rows: dadosBrutos.rows,
      colVeiculo: dadosBrutos.colVeiculo,
      colData: dadosBrutos.colData,
      colunasKpi: dadosBrutos.colunasKpi,
      arquivos: dadosBrutos.arquivos,
      salvoEm: new Date().toISOString()
    }));
  } catch (_) { /* quota */ }
}

function restaurarCacheTelemetria() {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return false;
    const cache = JSON.parse(raw);
    if (!cache?.rows?.length || !cache.colVeiculo || !cache.colData) return false;
    aplicarDadosBrutos(cache, { resetarAba: false });
    return true;
  } catch (_) {
    return false;
  }
}

function detectarHeadersTelemetria(dados) {
  const set = new Set();
  (dados || []).forEach((item) => {
    let payload = item?.payload || item;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch (_) { payload = null; }
    }
    headersDoPayload(payload).forEach((h) => set.add(h));
  });
  return [...set];
}

function aplicarDadosBrutos(src, opcoes = {}) {
  const headersIniciais = src.headers?.length ? src.headers : detectarHeadersTelemetria(src.rows);
  const colVeiculoGuess = src.colVeiculo || detectarColunaVeiculo(headersIniciais);
  const colDataGuess = src.colData || detectarColunaData(headersIniciais);
  let rows = rowsFromSource(src, headersIniciais, colVeiculoGuess, colDataGuess);
  rows = rows.map((r) => normalizarLinhaTelemetria(r));
  const headers = headersVisiveis([...new Set(rows.flatMap((r) => Object.keys(r)))], null);
  const colVeiculo = detectarColunaVeiculo(headers) || detectarColunaVeiculo(rows.flatMap((r) => Object.keys(r))) || colVeiculoGuess;
  const colData = detectarColunaData(headers) || detectarColunaData(rows.flatMap((r) => Object.keys(r))) || colDataGuess;
  const headersFinal = headersVisiveis([...new Set(rows.flatMap((r) => Object.keys(r)))], colVeiculo);

  dadosBrutos = {
    headers: mesclarHeaders([], headersFinal),
    rows: unificarLinhasPorVeiculoData(rows, colVeiculo, colData),
    colVeiculo,
    colData,
    colunasKpi: detectarColunasKpi(headersFinal),
    arquivos: src.arquivos || []
  };
  colunasMarcadas = new Set(colunasExibiveis(dadosBrutos.headers, colVeiculo));
  montarFiltroVeiculos();
  montarFiltroDatas(true);
  montarPainelColunas();
  if (primeiraCarga && opcoes.resetarAba !== false) {
    abaDataAtiva = "todas";
    primeiraCarga = false;
  }
  renderizar();
  persistirCacheTelemetria();
  return dadosBrutos.rows.length;
}

function atualizarInfoBanco(extra) {
  const el = $("infoBanco");
  if (!el) return;
  if (extra) {
    el.textContent = extra;
    return;
  }
  if (!dadosBrutos?.rows?.length) {
    el.textContent = "Nenhum registro salvo no banco AWS ainda.";
    return;
  }
  const arquivos = dadosBrutos.arquivos?.length ? dadosBrutos.arquivos.join(", ") : "—";
  const datas = dadosBrutos.rows.map((r) => parseDataCsv(r[dadosBrutos.colData])).filter(Boolean).sort();
  const periodo = datas.length ? `${formatarDataBr(datas[0])} a ${formatarDataBr(datas[datas.length - 1])}` : "—";
  el.textContent = `${dadosBrutos.rows.length} registro(s) unificado(s) por veículo e data · ${periodo} · arquivos: ${arquivos}${awsAtivo ? " · AWS" : ""}`;
}

function renderResumoVazio() {
  $("statFrota").textContent = FROTA.length;
  ["statNoArquivo", "statCan", "statKmInicial", "statKmFinal", "statKmPercorrido"].forEach((id) => {
    $(id).textContent = "—";
  });
}

function renderTabelaVazia(msg) {
  const head = $("tabelaDadosHead");
  const corpo = $("tabelaDadosCorpo");
  if (head) head.innerHTML = "<tr><th>Veículo</th></tr>";
  if (corpo) corpo.innerHTML = `<tr><td>${escapeHtml(msg || "Nenhum dado carregado.")}</td></tr>`;
  if ($("contagemDados")) $("contagemDados").textContent = "0 registro(s)";
  if ($("abasDataWrap")) $("abasDataWrap").hidden = true;
}

function garantirSortPadrao() {
  if (!dadosBrutos) {
    sortCol = null;
    sortDir = "asc";
    return;
  }
  const colsValidas = new Set([dadosBrutos.colVeiculo, ...dadosBrutos.headers]);
  if (!sortCol || !colsValidas.has(sortCol)) {
    sortCol = dadosBrutos.colVeiculo;
    sortDir = "asc";
  }
}

function iconeSort(col) {
  if (sortCol !== col) return "↕";
  return sortDir === "asc" ? "↑" : "↓";
}

function valorOrdenacao(row, col) {
  const colVeiculo = dadosBrutos.colVeiculo;
  const raw = String(row[col] ?? "").trim();
  if (col === colVeiculo) return normVeiculo(raw);
  if (col === dadosBrutos.colData) return parseDataCsv(raw) || raw;
  const num = Number(raw.replace(/\./g, "").replace(",", "."));
  if (raw && !Number.isNaN(num) && /^-?[\d.,\s]+$/.test(raw)) return num;
  return raw.toLowerCase();
}

function ordenarRows(rows, col, dir) {
  const colVeiculo = dadosBrutos.colVeiculo;
  const mul = dir === "desc" ? -1 : 1;
  return rows.slice().sort((a, b) => {
    const va = valorOrdenacao(a, col);
    const vb = valorOrdenacao(b, col);
    let cmp = 0;
    if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
    else cmp = String(va).localeCompare(String(vb), "pt-BR", { numeric: true, sensitivity: "base" });
    if (cmp !== 0) return cmp * mul;
    return normVeiculo(a[colVeiculo]).localeCompare(normVeiculo(b[colVeiculo]), "pt-BR", { numeric: true });
  });
}

function cabecalhoOrdenavel(col, label, extraClass = "") {
  const ativo = sortCol === col ? " sort-ativo" : "";
  return `<th class="sortable${extraClass}${ativo}" data-sort-col="${escapeHtml(col)}" title="Ordenar ${escapeHtml(label)}" aria-sort="${sortCol === col ? (sortDir === "asc" ? "ascending" : "descending") : "none"}">${escapeHtml(label)}<span class="sort-seta">${iconeSort(col)}</span></th>`;
}

function alternarOrdenacao(col) {
  if (!dadosBrutos || !col) return;
  if (sortCol === col) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortCol = col;
    sortDir = "asc";
  }
  renderTabelaDados(rowsFiltradas(), colunasSelecionadas());
}

function colunasSelecionadas() {
  if (!dadosBrutos) return [];
  const todas = colunasExibiveis(dadosBrutos.headers, dadosBrutos.colVeiculo);
  if (!colunasMarcadas.size) return todas;
  return todas.filter((c) => colunasMarcadas.has(c));
}

function rowsBaseFiltro() {
  if (!dadosBrutos) return [];
  let rows = dadosBrutos.rows.slice();
  rows = filtrarRowsPorData(rows, dadosBrutos.colData, $("filtroDataDe").value, $("filtroDataAte").value);
  const veicFiltro = $("filtroVeiculo").value;
  if (veicFiltro) rows = rows.filter((r) => normVeiculo(r[dadosBrutos.colVeiculo]) === veicFiltro);
  return rows;
}

function rowsFiltradas() {
  let rows = rowsBaseFiltro();
  if (abaDataAtiva && abaDataAtiva !== "todas") {
    rows = rows.filter((r) => parseDataCsv(r[dadosBrutos.colData]) === abaDataAtiva);
  }
  return rows;
}

function renderAbasData(baseRows) {
  const wrap = $("abasDataWrap");
  const container = $("abasData");
  if (!wrap || !container || !dadosBrutos) return;

  const contagem = new Map();
  baseRows.forEach((r) => {
    const iso = parseDataCsv(r[dadosBrutos.colData]);
    if (!iso) return;
    contagem.set(iso, (contagem.get(iso) || 0) + 1);
  });

  const datas = [...contagem.keys()].sort((a, b) => b.localeCompare(a));
  if (!datas.length) {
    wrap.hidden = true;
    container.innerHTML = "";
    abaDataAtiva = "todas";
    return;
  }

  wrap.hidden = false;
  if (abaDataAtiva !== "todas" && !contagem.has(abaDataAtiva)) abaDataAtiva = "todas";

  const botoes = [`<button type="button" role="tab" data-aba-data="todas" class="${abaDataAtiva === "todas" ? "ativo" : ""}" aria-selected="${abaDataAtiva === "todas"}">Todas (${baseRows.length})</button>`];
  datas.forEach((iso) => {
    const ativo = abaDataAtiva === iso;
    const carros = new Set(baseRows.filter((r) => parseDataCsv(r[dadosBrutos.colData]) === iso).map((r) => normVeiculo(r[dadosBrutos.colVeiculo]))).size;
    botoes.push(`<button type="button" role="tab" data-aba-data="${iso}" class="${ativo ? "ativo" : ""}" aria-selected="${ativo}" title="Dia completo 00:00–23:59">${formatarDataBr(iso)} · ${carros} carro(s)</button>`);
  });

  container.innerHTML = botoes.join("");
  container.querySelectorAll("[data-aba-data]").forEach((btn) => {
    btn.addEventListener("click", () => {
      abaDataAtiva = btn.getAttribute("data-aba-data") || "todas";
      renderizar();
    });
  });

  const ativoEl = container.querySelector(".ativo");
  if (ativoEl) ativoEl.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function atualizarRotuloColunas() {
  const btn = $("filtroColunasBtn");
  if (!btn || !dadosBrutos) return;
  const total = colunasExibiveis(dadosBrutos.headers, dadosBrutos.colVeiculo).length;
  const n = colunasSelecionadas().length;
  if (!n || n === total) btn.textContent = "Todas as colunas";
  else if (n === 1) btn.textContent = colunasSelecionadas()[0];
  else btn.textContent = `${n} colunas`;
}

function posicionarPainelColunas() {
  const btn = $("filtroColunasBtn");
  const panel = $("filtroColunasPanel");
  if (!btn || !panel || panel.hidden) return;
  const r = btn.getBoundingClientRect();
  panel.style.left = `${Math.max(8, r.left)}px`;
  panel.style.top = `${r.bottom + 4}px`;
  panel.style.minWidth = `${Math.max(220, r.width)}px`;
}

function fecharPainelColunas() {
  const panel = $("filtroColunasPanel");
  const btn = $("filtroColunasBtn");
  if (!panel || !btn) return;
  panel.hidden = true;
  btn.setAttribute("aria-expanded", "false");
}

function montarPainelColunas() {
  const panel = $("filtroColunasPanel");
  if (!dadosBrutos || !panel) return;
  const cols = colunasExibiveis(dadosBrutos.headers, dadosBrutos.colVeiculo);
  if (!colunasMarcadas.size) cols.forEach((c) => colunasMarcadas.add(c));
  panel.innerHTML = `<div class="filtro-colunas-acoes">
      <button type="button" data-col-acao="todas">Todas</button>
      <button type="button" data-col-acao="nenhuma">Nenhuma</button>
    </div>${cols.map((col) => {
    const checked = colunasMarcadas.has(col) ? " checked" : "";
    return `<label class="filtro-colunas-opt"><input type="checkbox" value="${escapeHtml(col)}"${checked}> ${escapeHtml(col)}</label>`;
  }).join("")}`;
  panel.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) colunasMarcadas.add(cb.value);
      else colunasMarcadas.delete(cb.value);
      atualizarRotuloColunas();
      renderizar();
    });
  });
  panel.querySelectorAll("[data-col-acao]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const acao = btn.getAttribute("data-col-acao");
      if (acao === "todas") cols.forEach((c) => colunasMarcadas.add(c));
      else colunasMarcadas.clear();
      panel.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.checked = colunasMarcadas.has(cb.value);
      });
      atualizarRotuloColunas();
      renderizar();
    });
  });
  atualizarRotuloColunas();
}

function montarFiltroVeiculos() {
  const sel = $("filtroVeiculo");
  if (!sel) return;
  const atual = sel.value;
  sel.innerHTML = `<option value="">Todos (${FROTA.length})</option>${FROTA.map((f) =>
    `<option value="${escapeHtml(normVeiculo(f.veiculo))}">${escapeHtml(f.veiculo)}</option>`
  ).join("")}`;
  if ([...sel.options].some((o) => o.value === atual)) sel.value = atual;
}

function montarFiltroDatas(forceReset) {
  if (!dadosBrutos || !dadosBrutos.colData) return;
  const datas = dadosBrutos.rows.map((r) => parseDataCsv(r[dadosBrutos.colData])).filter(Boolean).sort();
  const de = $("filtroDataDe");
  const ate = $("filtroDataAte");
  if (!datas.length) {
    if (forceReset) {
      de.value = dataIsoPadrao(-30);
      ate.value = dataIsoPadrao(0);
    }
    return;
  }
  const min = datas[0];
  const max = datas[datas.length - 1];
  de.min = min;
  de.max = max;
  ate.min = min;
  ate.max = max;
  if (forceReset || !de.value || !ate.value) {
    de.value = min;
    ate.value = max;
  } else {
    if (de.value < min) de.value = min;
    if (de.value > max) de.value = max;
    if (ate.value < min) ate.value = min;
    if (ate.value > max) ate.value = max;
    if (de.value > ate.value) ate.value = de.value;
  }
}

function hintFiltrosAtivos() {
  const hint = $("filtroAtivoHint");
  if (!hint || !dadosBrutos) return;
  const partes = [];
  const de = $("filtroDataDe").value;
  const ate = $("filtroDataAte").value;
  const veic = $("filtroVeiculo").value;
  const totalCol = colunasExibiveis(dadosBrutos.headers, dadosBrutos.colVeiculo).length;
  const nCol = colunasSelecionadas().length;
  if (de || ate) partes.push(`período ${de || "…"} a ${ate || "…"} (00:00–23:59)`);
  if (veic) partes.push(`carro ${veic}`);
  if (nCol && nCol < totalCol) partes.push(`${nCol} coluna(s)`);
  if (!partes.length) { hint.hidden = true; return; }
  hint.hidden = false;
  hint.textContent = `Filtros ativos: ${partes.join(" · ")}`;
}

function renderResumo(stats) {
  $("statFrota").textContent = stats.frota;
  $("statNoArquivo").textContent = stats.noArquivo;
  $("statCan").textContent = stats.comCan;
  $("statKmInicial").textContent = stats.comKmInicial;
  $("statKmFinal").textContent = stats.comKmFinal;
  $("statKmPercorrido").textContent = stats.comKmPercorrido;
}

function renderTabelaDados(rows, cols) {
  const head = $("tabelaDadosHead");
  const corpo = $("tabelaDadosCorpo");
  const colunasKpi = dadosBrutos.colunasKpi || {};
  const colVeiculo = dadosBrutos.colVeiculo;
  garantirSortPadrao();

  const colsVisiveis = cols.length ? cols : colunasExibiveis(dadosBrutos.headers, colVeiculo);
  head.innerHTML = `<tr>
    ${cabecalhoOrdenavel(colVeiculo, colVeiculo || "Veículo", " col-fix")}
    ${colsVisiveis.map((c) => cabecalhoOrdenavel(c, c)).join("")}
  </tr>`;

  head.querySelectorAll("th[data-sort-col]").forEach((th) => {
    th.addEventListener("click", () => alternarOrdenacao(th.getAttribute("data-sort-col")));
  });

  $("contagemDados").textContent = abaDataAtiva !== "todas"
    ? `${rows.length} registro(s) · ${formatarDataBr(abaDataAtiva)} (00:00–23:59)`
    : `${rows.length} registro(s)`;

  if (!rows.length) {
    corpo.innerHTML = `<tr><td colspan="${colsVisiveis.length + 1}">Nenhum registro no período selecionado.</td></tr>`;
    return;
  }

  const sorted = ordenarRows(rows, sortCol, sortDir);

  corpo.innerHTML = sorted.map((row) => {
    const rowCls = classeLinhaDado(row, colunasKpi);
    const cells = colsVisiveis.map((col) => {
      const val = formatarCelula(col, row[col] ?? "");
      return `<td>${escapeHtml(val) || "<span class=\"cell-vazio\">—</span>"}</td>`;
    }).join("");
    return `<tr${rowCls ? ` class="${rowCls}"` : ""}>
      <td class="col-fix veiculo">${escapeHtml(row[colVeiculo])}</td>
      ${cells}
    </tr>`;
  }).join("");
}

function renderizar() {
  $("painelResultado").hidden = false;
  if (!dadosBrutos?.rows?.length) {
    renderResumoVazio();
    renderTabelaVazia("Nenhum registro no período. Use + CSV para lançar novos dados.");
    atualizarInfoBanco();
    return;
  }
  const cols = colunasSelecionadas();
  const baseRows = rowsBaseFiltro();
  renderAbasData(baseRows);
  const rows = rowsFiltradas();
  const stats = calcularStats(rows, dadosBrutos.colVeiculo, dadosBrutos.colunasKpi);
  atualizarInfoBanco();
  hintFiltrosAtivos();
  renderResumo(stats);
  renderTabelaDados(rows, cols);
  $("painelVazio").hidden = true;
}

function limparFiltros() {
  if (!dadosBrutos) return;
  abaDataAtiva = "todas";
  sortCol = dadosBrutos.colVeiculo;
  sortDir = "asc";
  $("filtroVeiculo").value = "";
  montarFiltroDatas(true);
  const cols = colunasExibiveis(dadosBrutos.headers, dadosBrutos.colVeiculo);
  colunasMarcadas = new Set(cols);
  montarPainelColunas();
  fecharPainelColunas();
  renderizar();
}

async function salvarAws(linhasImport, nomeArquivo, meta) {
  const colVeiculo = meta?.colVeiculo || dadosBrutos?.colVeiculo;
  const colData = meta?.colData || dadosBrutos?.colData;
  if (!colVeiculo || !colData) return { ok: false, motivo: "colunas veículo/data não detectadas" };
  const unificadas = unificarLinhasPorVeiculoData(linhasImport, colVeiculo, colData);
  const payload = unificadas.map((r) => payloadParaLinha(r, colVeiculo, colData)).filter(Boolean);
  if (!payload.length) return { ok: false, motivo: "sem linhas válidas" };
  try {
    awsAtivo = await telemetriaAwsDisponivel();
    if (!awsAtivo) return { ok: false, motivo: "aws indisponível" };
    let ultimoErro = "erro ao salvar";
    for (let i = 0; i < 3; i++) {
      try {
        const res = await importarTelemetriaAws(payload, nomeArquivo, (lote, total, linhas) => {
          $("statusUpload").textContent = `Salvando ${nomeArquivo} na AWS… lote ${lote}/${total} (${linhas} linhas)`;
        });
        return { ok: true, inseridos: res.inseridos };
      } catch (err) {
        ultimoErro = err.message || ultimoErro;
        await aguardar(800 + i * 400);
      }
    }
    return { ok: false, motivo: ultimoErro };
  } catch (err) {
    return { ok: false, motivo: err.message || "erro aws" };
  }
}

function aplicarRegistrosAws(res) {
  if (!res?.dados?.length) return 0;
  const headers = detectarHeadersTelemetria(res.dados);
  const colVeiculo = detectarColunaVeiculo(headers);
  const colData = detectarColunaData(headers);
  const rows = linhasAwsParaRows(res.dados, headers, colVeiculo, colData);
  return aplicarDadosBrutos({
    headers,
    rows,
    colVeiculo,
    colData,
    colunasKpi: detectarColunasKpi(headers),
    arquivos: arquivosDosRegistrosAws(res.dados)
  });
}

async function recarregarComFiltroDatas() {
  renderizar();
}

async function carregarAws(opcoes = {}) {
  const tentativas = opcoes.tentativas ?? 3;
  const authTentativas = opcoes.authTentativas ?? 12;
  let ultimoErro = "erro ao carregar AWS";
  try {
    await initPortalAwsRuntime();
    awsAtivo = await telemetriaAwsDisponivel();
    if (!awsAtivo) return { ok: false, motivo: "API AWS não configurada" };

    const autenticou = await aguardarAuthTelemetria(authTentativas);
    if (!autenticou) return { ok: false, motivo: "sessão não autenticada" };

    const { de, ate } = periodoBuscaAws();
    for (let i = 0; i < tentativas; i++) {
      try {
        if (opcoes.onProgress) opcoes.onProgress(i + 1, tentativas);
        const res = await carregarTelemetriaAws(de, ate);
        if (!res?.dados?.length) {
          if (opcoes.permitirVazio && dadosBrutos) {
            dadosBrutos.rows = [];
            persistirCacheTelemetria();
            return { ok: true, total: 0 };
          }
          return { ok: false, motivo: "nenhum registro na AWS" };
        }
        const total = aplicarRegistrosAws(res);
        return { ok: true, total };
      } catch (err) {
        ultimoErro = err.message || ultimoErro;
        if (/401|403|autentic|sessão|token/i.test(ultimoErro)) {
          await aguardarAuthTelemetria(8, 400);
        }
        await aguardar(700 + i * 300);
      }
    }
    return { ok: false, motivo: ultimoErro };
  } catch (err) {
    awsAtivo = false;
    return { ok: false, motivo: err.message || ultimoErro };
  }
}

async function carregarAwsInicial() {
  atualizarInfoBanco("Carregando dados do banco AWS…");
  let result = await carregarAws({ tentativas: 3, authTentativas: 15 });
  if (!result.ok && /autentic|401|403|sessão|token/i.test(result.motivo)) {
    atualizarInfoBanco("Renovando sessão…");
    await aguardar(400);
    result = await carregarAws({ tentativas: 2, authTentativas: 8 });
  }
  return result;
}

function incorporarCsv(parsed, nomeArquivo) {
  const colVeiculo = detectarColunaVeiculo(parsed.headers);
  const colData = detectarColunaData(parsed.headers);
  parsed.rows = unificarLinhasPorVeiculoData(parsed.rows, colVeiculo, colData);

  if (!dadosBrutos) {
    aplicarDadosBrutos({
      headers: parsed.headers.slice(),
      rows: parsed.rows.slice(),
      colVeiculo,
      colData,
      colunasKpi: detectarColunasKpi(parsed.headers),
      arquivos: [nomeArquivo]
    }, { resetarAba: false });
    return;
  }

  dadosBrutos.headers = mesclarHeaders(dadosBrutos.headers, parsed.headers);
  dadosBrutos.colVeiculo = colVeiculo || dadosBrutos.colVeiculo;
  dadosBrutos.colData = colData || dadosBrutos.colData;
  dadosBrutos.colunasKpi = { ...dadosBrutos.colunasKpi, ...detectarColunasKpi(parsed.headers) };
  dadosBrutos.rows = mesclarRows(dadosBrutos.rows, parsed.rows, dadosBrutos.colVeiculo, dadosBrutos.colData);
  if (!dadosBrutos.arquivos.includes(nomeArquivo)) dadosBrutos.arquivos.push(nomeArquivo);

  colunasMarcadas = new Set(colunasExibiveis(dadosBrutos.headers, dadosBrutos.colVeiculo));
  montarFiltroVeiculos();
  montarFiltroDatas(false);
  montarPainelColunas();
  renderizar();
  persistirCacheTelemetria();
}

async function processarTextoCsv(texto, nomeArquivo) {
  const parsed = converterLinhasCsv(parseCsv(texto));
  if (!parsed.headers.length) throw new Error("CSV sem cabeçalho válido.");
  if (!parsed.rows.length) throw new Error("CSV sem linhas de dados.");

  const colVeiculo = detectarColunaVeiculo(parsed.headers);
  const colData = detectarColunaData(parsed.headers);
  parsed.rows = unificarLinhasPorVeiculoData(parsed.rows, colVeiculo, colData);

  $("statusUpload").textContent = `Salvando ${nomeArquivo} na AWS (${parsed.rows.length} veículo(s)/dia)...`;
  const salvo = await salvarAws(parsed.rows, nomeArquivo, { colVeiculo, colData });
  if (salvo.ok) {
    $("statusUpload").textContent = `Arquivo ${nomeArquivo} salvo na AWS (${salvo.inseridos} linha(s))`;
    $("statusUpload").className = "status-upload ok";
    persistirCacheTelemetria();
    const recarregou = await carregarAws({ tentativas: 5 });
    if (!recarregou.ok) {
      incorporarCsv(parsed, nomeArquivo);
      $("statusUpload").textContent += ` · recarregar falhou (${recarregou.motivo})`;
      $("statusUpload").className = "status-upload warn";
    }
  } else {
    incorporarCsv(parsed, nomeArquivo);
    $("statusUpload").textContent = salvo.motivo === "aws indisponível"
      ? `${nomeArquivo} só local (AWS indisponível)`
      : `${nomeArquivo} só local (${salvo.motivo})`;
    $("statusUpload").className = "status-upload warn";
  }
}

function lerArquivos(fileList) {
  const files = [...(fileList || [])].filter((f) => f && (/\.csv$/i.test(f.name) || f.type === "text/csv"));
  if (!files.length) {
    $("msgVazio").textContent = "Selecione um ou mais arquivos .csv";
    return;
  }
  (async () => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      $("statusUpload").textContent = `Processando ${i + 1}/${files.length}: ${file.name}…`;
      $("statusUpload").className = "status-upload muted";
      await lerArquivo(file);
    }
  })().catch((err) => {
    $("statusUpload").textContent = err.message || "Falha ao processar arquivos.";
    $("statusUpload").className = "status-upload warn";
  });
}

async function lerArquivo(file) {
  if (!file) return;
  if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
    $("msgVazio").textContent = "Selecione um arquivo .csv";
    return;
  }
  $("statusUpload").textContent = `Lendo ${file.name}...`;
  $("statusUpload").className = "status-upload muted";
  const reader = new FileReader();
  await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsText(file, "UTF-8");
  });
  try {
    await processarTextoCsv(String(reader.result || ""), file.name);
  } catch (err) {
    $("statusUpload").textContent = err.message || "Falha ao processar o CSV.";
    $("statusUpload").className = "status-upload warn";
  }
}

async function iniciar() {
  if (!FROTA.length) {
    $("msgVazio").textContent = "Lista da frota (250 veículos) não carregada.";
    return;
  }

  await initPortalAwsRuntime();

  $("painelResultado").hidden = false;
  montarFiltroVeiculos();
  $("filtroDataDe").value = "";
  $("filtroDataAte").value = "";
  $("statFrota").textContent = FROTA.length;
  limparCacheTelemetriaLegado();
  renderResumoVazio();
  renderTabelaVazia("Carregando dados do banco AWS…");
  atualizarInfoBanco("Carregando dados do banco AWS…");

  const input = $("csvInput");
  const zona = $("uploadZona");

  input.addEventListener("change", () => {
    lerArquivos(input.files);
    input.value = "";
  });

  zona.addEventListener("dragover", (e) => { e.preventDefault(); zona.classList.add("drag"); });
  zona.addEventListener("dragleave", () => zona.classList.remove("drag"));
  zona.addEventListener("drop", (e) => {
    e.preventDefault();
    zona.classList.remove("drag");
    lerArquivos(e.dataTransfer?.files);
  });
  zona.addEventListener("click", () => input.click());
  zona.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
  });

  ["filtroDataDe", "filtroDataAte"].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("change", () => { recarregarComFiltroDatas(); });
  });
  const filtroVeic = $("filtroVeiculo");
  if (filtroVeic) filtroVeic.addEventListener("change", () => renderizar());

  const btnCol = $("filtroColunasBtn");
  const panelCol = $("filtroColunasPanel");
  if (btnCol && panelCol) {
    btnCol.addEventListener("click", (e) => {
      e.stopPropagation();
      const abrir = panelCol.hidden;
      if (abrir) {
        panelCol.hidden = false;
        btnCol.setAttribute("aria-expanded", "true");
        posicionarPainelColunas();
      } else fecharPainelColunas();
    });
    panelCol.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => fecharPainelColunas());
    window.addEventListener("resize", () => posicionarPainelColunas());
    window.addEventListener("scroll", () => posicionarPainelColunas(), true);
  }

  $("btnLimparFiltros")?.addEventListener("click", () => limparFiltros());

  $("statusUpload").textContent = "Pronto para lançar novo CSV";
  $("statusUpload").className = "status-upload muted";
  const carregou = await carregarAwsInicial();
  if (carregou.ok) {
    $("statusUpload").textContent = "Pronto para lançar novo CSV";
    $("statusUpload").className = "status-upload muted";
  } else if (restaurarCacheTelemetria()) {
    const hint = /token|sessão|expirad/i.test(carregou.motivo)
      ? `${carregou.motivo} — saia e entre de novo no portal`
      : carregou.motivo;
    atualizarInfoBanco(`Dados locais exibidos · AWS: ${hint}`);
  } else {
    renderResumoVazio();
    renderTabelaVazia(`Sem dados no banco (${carregou.motivo}). Use + CSV para lançar.`);
    atualizarInfoBanco(`Não foi possível carregar: ${carregou.motivo}`);
    $("statusUpload").textContent = "Pronto para lançar novo CSV";
    $("statusUpload").className = "status-upload muted";
  }
}

function bootstrapTelemetria() {
  if (typeof window.portalAguardarUsuario === "function") {
    window.portalAguardarUsuario(() => { iniciar(); });
  } else if (window.portalUsuarioValidado) {
    iniciar();
  } else {
    window.addEventListener("portal:usuario-validado", () => { iniciar(); }, { once: true });
  }
}

bootstrapTelemetria();
