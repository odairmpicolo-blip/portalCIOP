import {
  carregarSnapshotTelemetriaJson,
  carregarSnapshotTelemetriaPlanilha,
  carregarManifestTelemetria,
  filtrarSnapshotRegistros,
  mesclarRegistrosTelemetria,
  mesclarSnapshotPorFonte,
  normalizarFontesRegistros,
  inferirFonteRegistro
} from "./telemetria-dados-leitura.js";
import {
  agregarLinhasTelemetria,
  normalizarLinhaTelemetria,
  normalizarColunaTelemetria
} from "./telemetria-merge.js";

const FROTA = (window.FROTA_PATIO || []).slice().sort((a, b) =>
  String(a.veiculo).localeCompare(String(b.veiculo), "pt-BR", { numeric: true })
);

const PLANILHA_TELEMETRIA_URL = "https://docs.google.com/spreadsheets/d/1Z_rFA-1jz7-kq4juGp5uFG4WMpVBloML98hDgWcX9gQ/edit";
const CHAVE_PLANILHA_STORAGE = "telemetria_planilha_ao_vivo";
const DIAS_CARREGAMENTO_INICIAL = 120;
let fonteAtiva = "comparacao";
let planilhaAoVivo = false;
let snapshotRaw = null;
let periodoCarregado = { de: "", ate: "" };
let debounceFiltroTimer = null;
let veiculosAtencao = [];
let veiculosAtencaoDetalhe = [];
let filtroAtencaoAtivo = false;

const CHAVES_VEICULO = [
  "veiculo", "veículo", "vehicle id", "vehicle_id", "prefixo", "carro", "numero", "número", "n°", "nº",
  "frota", "id_veiculo", "codigo", "código", "placa", "vehicle", "bus"
];

const CHAVES_DATA = ["data", "date", "dia", "dt", "data_ref", "data referencia"];

const KPI_DEFS = [
  { id: "can", rotulos: ["registros can", "eventos", "number of events"] },
  { id: "kmInicial", rotulos: ["km inicial", "km/inicial", "start distance"] },
  { id: "kmFinal", rotulos: ["km final", "km/final", "end distance"] },
  { id: "kmPercorrido", rotulos: ["km percorrido", "distancia", "distância", "daily distance"] }
];

const COLUNAS_OCULTAS = [
  "data_iso",
  "veiculo_norm"
];

const METRICAS_COMPARACAO = [
  "Km Inicial",
  "Km Final",
  "Km Percorrido"
];

const COLUNAS_TABELA = [
  "Data",
  "Km Inicial",
  "Km Final",
  "Km Percorrido"
];

function colunaOculta(nome) {
  const n = normChave(nome);
  return COLUNAS_OCULTAS.some((k) => n === k || n.includes(k));
}

function colunasExibiveis(headers, colVeiculo) {
  const headerList = headers || [];
  if (dadosBrutos?.modo === "atencao" || dadosBrutos?.modo === "comparacao") {
    return headerList.filter((h) => h !== colVeiculo && !colunaOculta(h));
  }
  const isComparacao = headerList.includes("Status")
    || headerList.some((h) => /\((Clever|TCGL|FleetBus)\)$/.test(h));
  if (isComparacao) {
    return headerList.filter((h) => h !== colVeiculo && !colunaOculta(h));
  }
  return COLUNAS_TABELA.slice();
}

function colunaComparacaoLado(col) {
  const m = String(col).match(/^(.+)\s+\((Clever|TCGL|FleetBus)\)$/);
  return m ? { metrica: m[1], lado: m[2] } : null;
}

function toleranciaMetrica() {
  return 1;
}

function metricasDivergentes(clever, tcgl) {
  return METRICAS_COMPARACAO.some((metrica) => {
    const valC = clever?.[metrica] ?? "";
    const valT = tcgl?.[metrica] ?? "";
    const nC = parseNumero(valC);
    const nT = parseNumero(valT);
    const temC = valorPreenchido(valC) && Number.isFinite(nC);
    const temT = valorPreenchido(valT) && Number.isFinite(nT);
    if (!temC && !temT) return false;
    if (!temC || !temT) return true;
    return Math.abs(nT - nC) > toleranciaMetrica();
  });
}

function cabecalhosComparacao() {
  return [
    "Data",
    "Km Percorrido (TCGL)",
    "Km Percorrido (Clever)",
    "Km Percorrido (FleetBus)",
    "Clever / TCGL %",
    "FleetBus / TCGL %",
    "FleetBus / Clever %"
  ];
}

function pctKmCleverSobreTcgl(clever, tcgl) {
  const kmC = parseNumero(clever?.["Km Percorrido"]);
  const kmT = parseNumero(tcgl?.["Km Percorrido"]);
  if (!Number.isFinite(kmC) || !Number.isFinite(kmT) || kmT <= 0) return null;
  return (kmC / kmT) * 100;
}

function pctKmSobreDivisor(numerador, divisor) {
  const kmN = parseNumero(numerador?.["Km Percorrido"]);
  const kmD = parseNumero(divisor?.["Km Percorrido"]);
  if (!Number.isFinite(kmN) || !Number.isFinite(kmD) || kmD <= 0) return null;
  return (kmN / kmD) * 100;
}

function statusComparacaoKm(clever, tcgl, semClever, semTcgl) {
  if (semClever && semTcgl) return "Sem dados";
  if (semClever) return "Sem Clever";
  if (semTcgl) return "Sem TCGL";
  const pct = pctKmCleverSobreTcgl(clever, tcgl);
  if (pct == null) return "—";
  return `${formatarDecimal(pct, 1)}%`;
}

function statusComparacaoGenerico(ladoA, ladoB, semA, semB, nomeA, nomeB) {
  if (semA && semB) return "Sem dados";
  if (semA) return `Sem ${nomeA}`;
  if (semB) return `Sem ${nomeB}`;
  const pct = pctKmSobreDivisor(ladoA, ladoB);
  if (pct == null) return "—";
  return `${formatarDecimal(pct, 1)}%`;
}

function colunaChave(col) {
  return normChave(col);
}

function parseNumero(val) {
  const s = String(val ?? "").trim();
  if (!s) return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  let normalized = s;
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = s.split(".");
    normalized = parts.length > 2 ? parts.join("") : s;
  }
  const n = Number(normalized);
  return Number.isNaN(n) ? NaN : n;
}

function formatarInteiro(val) {
  const n = parseNumero(val);
  if (Number.isNaN(n)) return String(val ?? "").trim();
  return Math.round(n).toLocaleString("pt-BR");
}

function formatarDecimal(val, dec = 2) {
  const n = parseNumero(val);
  if (Number.isNaN(n)) return String(val ?? "").trim();
  return n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function colunaTemperatura(nome) {
  const n = colunaChave(nome);
  return n.includes("temperatura");
}

function formatarCelula(col, val, row) {
  if (row?.__semDados) {
    if (col === dadosBrutos?.colData && !String(val ?? "").trim()) return "Sem dados";
    if (fonteAtiva === "comparacao" || dadosBrutos?.modo === "comparacao") return "Sem dados";
    return "";
  }
  if (row?.__comparacao) {
    const info = colunaComparacaoLado(col);
    if (info) {
      const s = String(val ?? "").trim();
      const semLado = (info.lado === "Clever" && row.__semDadosClever)
        || (info.lado === "TCGL" && row.__semDadosTcgl)
        || (info.lado === "FleetBus" && (row.__semDadosFleetBus ?? false));
      if (!s) return semLado ? "—" : "";
      if (normChave(info.metrica).includes("km")) return formatarInteiro(s);
      return formatarDecimal(s);
    }
    if (col.endsWith("%")) return String(val ?? "").trim() || "—";
    if (col === "Status") return String(val ?? "").trim();
  }
  const s = String(val ?? "").trim();
  const n = colunaChave(col);

  if (n === "inicio" || n === "fim") {
    return s ? formatarDataHoraBr(s) : "";
  }
  if (!s) return "";

  const dataIso = row && dadosBrutos?.colData ? parseDataCsv(row[dadosBrutos.colData]) : "";

  if (n === "data" || col === dadosBrutos?.colData) {
    const iso = parseDataCsv(s) || dataIso;
    return iso ? formatarDataBr(iso) : s;
  }
  if (n === "registros can" || n === "eventos") return formatarInteiro(s);
  if (n === "km inicial" || n === "km final" || n === "km percorrido" || n === "distancia") {
    return formatarInteiro(s);
  }
  if (n === "horas motor") return formatarDecimal(s, 1);
  if (n.includes("media km")) return `${formatarDecimal(s)} km/l`;
  if (n.includes("velocidade")) return `${formatarInteiro(s)} Km/h`;
  if (colunaTemperatura(col)) return `${formatarInteiro(s)}ºc`;
  if (n.includes("pressao ar")) return `${formatarInteiro(s)}`;
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
  return normalizarColunaTelemetria(nome);
}

function encontrarLinhaCabecalho(linhas) {
  const chavesVeiculo = ["veiculo", "vehicle id", "vehicle"];
  for (let i = 0; i < Math.min(linhas.length, 8); i++) {
    const row = linhas[i] || [];
    const textos = row.map((c) => normChave(String(c ?? "").trim())).filter(Boolean);
    if (textos.some((t) => chavesVeiculo.includes(t) || t.includes("veiculo"))) return i;
  }
  return 0;
}

function converterLinhasPlanilha(linhas) {
  if (!linhas.length) return { headers: [], rows: [] };
  const idx = encontrarLinhaCabecalho(linhas);
  const pares = [];
  (linhas[idx] || []).forEach((h, i) => {
    const col = nomeColunaPadrao(String(h).trim());
    if (col) pares.push({ i, col });
  });
  const headers = [...new Set(pares.map((p) => p.col))];
  const rows = linhas.slice(idx + 1).map((cols) => {
    const obj = {};
    pares.forEach(({ i, col }) => {
      obj[col] = cols[i] != null ? String(cols[i]).trim() : "";
    });
    return obj;
  }).filter((row) => Object.values(row).some(valorPreenchido));
  return { headers, rows };
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
  return converterLinhasPlanilha(linhas);
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
  return COLUNAS_TABELA.filter((c) => set.has(c)).concat(
    [...set].filter((c) => !COLUNAS_TABELA.includes(c) && !colunaOculta(c))
  );
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

  rows.forEach((row) => {
    if (row.__semDados) return;
    const id = normVeiculo(row[colVeiculo]);
    if (!frotaIds.has(id)) return;
    noArquivo.add(id);
  });

  const KM_DIARIO_MAX = 1000;
  const kmPorFonte = (regs) => {
    const mapa = new Map();
    regs.forEach((reg) => {
      let payload = reg.payload || reg;
      if (typeof payload === "string") try { payload = JSON.parse(payload); } catch (_) { payload = {}; }
      const row = normalizarLinhaTelemetria({ ...payload });
      const km = parseNumero(row["Km Percorrido"]);
      if (!Number.isFinite(km) || km <= 0 || km > KM_DIARIO_MAX) return;
      const key = `${reg.data_iso}|${normVeiculo(reg.veiculo)}`;
      mapa.set(key, (mapa.get(key) || 0) + km);
    });
    return mapa;
  };

  const cleverMap = kmPorFonte((snapshotRaw?.dados || []).filter((d) => inferirFonteRegistro(d) === "clever"));
  const tcglMap = kmPorFonte((snapshotRaw?.dados || []).filter((d) => inferirFonteRegistro(d) === "tcgl"));
  const fleetbusMap = kmPorFonte((snapshotRaw?.dados || []).filter((d) => inferirFonteRegistro(d) === "fleetbus"));

  const somaPar = (mapA, mapB) => {
    let somaA = 0, somaB = 0;
    mapA.forEach((valA, key) => {
      const valB = mapB.get(key);
      if (valB != null && valB > 0) {
        somaA += valA;
        somaB += valB;
      }
    });
    return { somaA, somaB };
  };

  const parCleverTcgl = somaPar(cleverMap, tcglMap);
  const parFleetbusTcgl = somaPar(fleetbusMap, tcglMap);
  const parFleetbusClever = somaPar(fleetbusMap, cleverMap);

  const pctStr = (num, den) => {
    if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return "—";
    let pct = (num / den) * 100;
    if (pct > 100) pct = 200 - pct;
    return `${formatarDecimal(pct, 1)}%`;
  };

  const atencaoMap = new Map();
  const obterAtencao = (v) => {
    if (!atencaoMap.has(v)) atencaoMap.set(v, { veiculo: v, diasTcgl: 0, diasClever: 0, diasFaltando: 0, datasFaltando: [], kmIrreal: [] });
    return atencaoMap.get(v);
  };

  const cleverRaw = (snapshotRaw?.dados || []).filter((d) => inferirFonteRegistro(d) === "clever");

  const todasDatasClever = new Set();
  const datasTcglPorVeiculo = new Map();
  tcglMap.forEach((_km, key) => {
    const [dt, v] = key.split("|");
    if (!datasTcglPorVeiculo.has(v)) datasTcglPorVeiculo.set(v, new Set());
    datasTcglPorVeiculo.get(v).add(dt);
  });
  const datasCleverPorVeiculo = new Map();
  cleverMap.forEach((_km, key) => {
    const [dt, v] = key.split("|");
    todasDatasClever.add(dt);
    if (!datasCleverPorVeiculo.has(v)) datasCleverPorVeiculo.set(v, new Set());
    datasCleverPorVeiculo.get(v).add(dt);
  });

  const hoje = new Date();
  hoje.setDate(hoje.getDate() - 3);
  const corteIso = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}-${String(hoje.getDate()).padStart(2,"0")}`;

  datasTcglPorVeiculo.forEach((datasTcgl, veiculo) => {
    const datasClever = datasCleverPorVeiculo.get(veiculo) || new Set();
    const faltando = [...todasDatasClever].filter((d) => d <= corteIso && !datasClever.has(d)).sort();
    if (faltando.length >= 3) {
      const info = obterAtencao(veiculo);
      info.diasTcgl = datasTcgl.size;
      info.diasClever = datasClever.size;
      info.diasFaltando = faltando.length;
      info.datasFaltando = faltando;
    }
  });

  cleverRaw.forEach((reg) => {
    let payload = reg.payload || reg;
    if (typeof payload === "string") try { payload = JSON.parse(payload); } catch (_) { payload = {}; }
    const row = normalizarLinhaTelemetria({ ...payload });
    const km = parseNumero(row["Km Percorrido"]);
    if (Number.isFinite(km) && km > KM_DIARIO_MAX) {
      const v = normVeiculo(reg.veiculo);
      const info = obterAtencao(v);
      info.kmIrreal.push({ data: reg.data_iso, km: Math.round(km) });
    }
  });

  veiculosAtencaoDetalhe = [...atencaoMap.values()].sort((a, b) => a.veiculo.localeCompare(b.veiculo, "pt-BR", { numeric: true }));
  veiculosAtencao = veiculosAtencaoDetalhe.map((d) => d.veiculo);

  return {
    frota: FROTA.length,
    noArquivo: noArquivo.size,
    pctCleverTcgl: pctStr(parCleverTcgl.somaA, parCleverTcgl.somaB),
    pctFleetbusTcgl: pctStr(parFleetbusTcgl.somaA, parFleetbusTcgl.somaB),
    pctFleetbusClever: pctStr(parFleetbusClever.somaA, parFleetbusClever.somaB),
    atencao: veiculosAtencao.length
  };
}

function classeLinhaDado(row, colunasKpi) {
  if (row.__semDados) return "row-sem-dados";
  if (row.__comparacao) {
    if (row.__semDadosClever && row.__semDadosTcgl) return "row-sem-dados";
    if (row.__semDadosClever || row.__semDadosTcgl) return "row-sem-dados";
    if (row.__divergente) return "row-incoerente";
    return "";
  }
  const cols = KPI_DEFS.map((d) => colunasKpi[d.id]).filter(Boolean);
  if (!cols.length) return "";
  let filled = 0;
  cols.forEach((col) => { if (valorPreenchido(row[col])) filled++; });
  if (filled === 0) return "row-sem-dados";
  if (filled < cols.length) return "row-incoerente";
  return "";
}

function contextoDiaUnico() {
  const de = $("filtroDataDe")?.value || "";
  const ate = $("filtroDataAte")?.value || "";
  if (de && ate && de === ate) return de;
  return "";
}

function linhaSemDados(veiculo, dataIso) {
  const colVeiculo = dadosBrutos.colVeiculo;
  const colData = dadosBrutos.colData;
  const row = { __semDados: true };
  row[colVeiculo] = veiculo;
  if (colData && dataIso) {
    const [y, m, d] = dataIso.split("-");
    row[colData] = `${d}-${m}-${y}`;
    row.data_iso = dataIso;
  }
  if (fonteAtiva === "comparacao" || dadosBrutos?.modo === "comparacao") {
    row.__comparacao = true;
    row.__semDadosClever = true;
    row.__semDadosTcgl = true;
    row.__semDadosFleetBus = true;
    cabecalhosComparacao().forEach((col) => {
      if (col !== "Data") row[col] = "";
    });
  }
  return row;
}

function expandirFrotaSemDados(rows) {
  const diaUnico = contextoDiaUnico();
  const expandir = FROTA.length && dadosBrutos && (!$("filtroVeiculo")?.value) && diaUnico;
  if (!expandir) return rows;

  const colVeiculo = dadosBrutos.colVeiculo;
  const presentes = new Set(rows.map((r) => normVeiculo(r[colVeiculo])).filter(Boolean));
  const dataIso = diaUnico || null;
  const extras = [];

  FROTA.forEach((f) => {
    const id = normVeiculo(f.veiculo);
    if (!id || presentes.has(id)) return;
    extras.push(linhaSemDados(f.veiculo, dataIso || null));
  });

  return [...rows, ...extras];
}

function headersPlanilhaTelemetria() {
  return COLUNAS_TABELA.slice();
}

function periodoCarregamentoInicial() {
  return { de: dataIsoPadrao(-DIAS_CARREGAMENTO_INICIAL), ate: dataIsoPadrao(0) };
}

function periodoFiltroDom() {
  return {
    de: $("filtroDataDe")?.value || "",
    ate: $("filtroDataAte")?.value || ""
  };
}

function filtrarRegistrosPorPeriodo(registros) {
  const { de, ate } = periodoFiltroDom();
  if (!de && !ate) return registros;
  return registros.filter((r) => {
    const d = r.data_iso;
    if (!d) return false;
    if (de && d < de) return false;
    if (ate && d > ate) return false;
    return true;
  });
}

function precisaRecarregarSnapshot(de, ate) {
  if (!de || !ate) return false;
  if (!periodoCarregado.de || !periodoCarregado.ate) return true;
  return de < periodoCarregado.de || ate > periodoCarregado.ate;
}

function aplicarSnapshotBruto(snap, { mesclar = false } = {}) {
  let dados = normalizarFontesRegistros(snap.dados || []);
  if (mesclar && snapshotRaw?.dados?.length) {
    dados = mesclarRegistrosTelemetria(snapshotRaw.dados, dados);
  }
  snapshotRaw = {
    ...snap,
    dados
  };
  const clever = snapshotRaw.dados.filter((d) => d.fonte === "clever").length;
  const tcgl = snapshotRaw.dados.filter((d) => d.fonte === "tcgl").length;
  const fleetbus = snapshotRaw.dados.filter((d) => d.fonte === "fleetbus").length;
  snapshotRaw.total = snapshotRaw.dados.length;
  snapshotRaw.total_clever = clever;
  snapshotRaw.total_tcgl = tcgl;
  snapshotRaw.total_fleetbus = fleetbus;
  const datas = snapshotRaw.dados.map((d) => d.data_iso).filter(Boolean).sort();
  periodoCarregado = {
    de: datas[0] || $("filtroDataDe")?.value || "",
    ate: datas[datas.length - 1] || $("filtroDataAte")?.value || ""
  };
}

function periodoCarregamentoAtual() {
  const { de, ate } = periodoFiltroDom();
  return {
    de: de || periodoCarregado.de || periodoCarregamentoInicial().de,
    ate: ate || periodoCarregado.ate || periodoCarregamentoInicial().ate
  };
}

function fontePlanilhaAtual() {
  return fonteAtiva === "comparacao" ? "todos" : fonteAtiva;
}

function aplicarSnapshotMesclado(snap, { fonte = "todos" } = {}) {
  const mesclado = mesclarSnapshotPorFonte(snapshotRaw, snap, { fonte });
  if (!mesclado?.dados?.length) return false;
  aplicarSnapshotBruto(mesclado);
  return true;
}

async function atualizarDaPlanilha({ silencioso = false } = {}) {
  const { de, ate } = periodoCarregamentoAtual();
  const fonte = fontePlanilhaAtual();
  const el = $("statusJson");
  if (el && !silencioso) {
    el.textContent = "Atualizando planilha…";
    el.className = "status-json muted";
  }
  const snap = await carregarSnapshotTelemetriaPlanilha({ fonte, de, ate, skipCache: true });
  if (!snap?.dados?.length) return false;
  const ok = aplicarSnapshotMesclado(snap, { fonte });
  if (ok) atualizarStatusJson();
  return ok;
}

async function onChavePlanilhaChange() {
  const chave = $("chavePlanilhaAoVivo");
  planilhaAoVivo = Boolean(chave?.checked);
  try {
    sessionStorage.setItem(CHAVE_PLANILHA_STORAGE, planilhaAoVivo ? "1" : "0");
  } catch (_) { /* ignore */ }
  if (planilhaAoVivo) {
    await atualizarDaPlanilha();
    aplicarFonteAtiva();
    return;
  }
  atualizarStatusJson();
}
async function garantirDadosFonte(fonte) {
  if (!planilhaAoVivo) return;
  if (fonte === "comparacao") {
    await garantirDadosFonte("clever");
    await garantirDadosFonte("tcgl");
    await garantirDadosFonte("fleetbus");
    return;
  }
  if (!["clever", "tcgl", "fleetbus"].includes(fonte)) return;
  if (registrosDaFonte(fonte).length) return;

  const { de, ate } = periodoCarregamentoAtual();
  const el = $("statusJson");
  if (el) {
    el.textContent = `Carregando ${fonte.toUpperCase()}…`;
    el.className = "status-json muted";
  }

  const snap = await carregarSnapshotTelemetriaPlanilha({ fonte, de, ate });
  if (!snap?.dados?.length) return;

  aplicarSnapshotMesclado(snap, { fonte });
  atualizarStatusJson();
}

function dataIsoPadrao(offsetDias) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
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

async function carregarSnapshotInicial() {
  const { de, ate } = periodoCarregamentoInicial();
  if ($("filtroDataDe")) $("filtroDataDe").value = de;
  if ($("filtroDataAte")) $("filtroDataAte").value = ate;

  const json = await carregarSnapshotTelemetriaJson();
  if (json?.dados?.length) {
    aplicarSnapshotBruto(json);
    await aguardar(0);
    aplicarFonteAtiva();
    atualizarStatusJson();
  }

  if (planilhaAoVivo) {
    try {
      const ok = await atualizarDaPlanilha({ silencioso: Boolean(json?.dados?.length) });
      if (ok) {
        await aguardar(0);
        aplicarFonteAtiva();
        atualizarStatusJson();
      }
    } catch (err) {
      console.warn("Planilha ao vivo:", err);
      if (json?.dados?.length) atualizarStatusJson();
    }
  }

  return Boolean(snapshotRaw?.dados?.length);
}

function registrosDaFonte(fonte) {
  return (snapshotRaw?.dados || []).filter((d) => inferirFonteRegistro(d) === fonte);
}

function payloadParaRow(reg, colVeiculo, colData) {
  let payload = reg.payload || reg;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch (_) { payload = {}; }
  }
  const row = normalizarLinhaTelemetria({ ...payload });
  row[colVeiculo] = reg.veiculo || row.Veiculo || row[colVeiculo];
  row[colData] = reg.data_iso || row.Data || row[colData];
  row.data_iso = reg.data_iso;
  row.__fonte = inferirFonteRegistro(reg);
  return row;
}

function calcPct(numerador, divisor) {
  const n = parseNumero(numerador);
  const d = parseNumero(divisor);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0 || n > 1000 || d > 1000) return "";
  let pct = (n / d) * 100;
  if (pct > 100) pct = 200 - pct;
  return `${formatarDecimal(pct, 1)}%`;
}

function montarLinhasComparacao() {
  const cleverRegs = filtrarRegistrosPorPeriodo(registrosDaFonte("clever"));
  const tcglRegs = filtrarRegistrosPorPeriodo(registrosDaFonte("tcgl"));
  const fleetbusRegs = filtrarRegistrosPorPeriodo(registrosDaFonte("fleetbus"));
  const mapa = new Map();

  const indexar = (lista, campo) => {
    lista.forEach((reg) => {
      const key = `${reg.data_iso}|${normVeiculo(reg.veiculo)}`;
      if (!mapa.has(key)) {
        mapa.set(key, { data_iso: reg.data_iso, veiculo: normVeiculo(reg.veiculo), clever: null, tcgl: null, fleetbus: null });
      }
      mapa.get(key)[campo] = reg.payload || reg;
    });
  };
  indexar(cleverRegs, "clever");
  indexar(tcglRegs, "tcgl");
  indexar(fleetbusRegs, "fleetbus");

  const colVeiculo = "Veiculo";
  const colData = "Data";
  const rows = [];

  mapa.forEach((item) => {
    const c = item.clever ? normalizarLinhaTelemetria({ ...item.clever }) : null;
    const t = item.tcgl ? normalizarLinhaTelemetria({ ...item.tcgl }) : null;
    const f = item.fleetbus ? normalizarLinhaTelemetria({ ...item.fleetbus }) : null;

    const kmClever = c?.["Km Percorrido"] ?? "";
    const kmTcgl = t?.["Km Percorrido"] ?? "";
    const kmFleetbus = f?.["Km Percorrido"] ?? "";

    const row = {
      [colVeiculo]: item.veiculo,
      [colData]: item.data_iso,
      data_iso: item.data_iso,
      __comparacao: true,
      __semDados: !c && !t && !f,
      __semDadosClever: !c,
      __semDadosTcgl: !t,
      __semDadosFleetBus: !f,
      "Km Percorrido (TCGL)": kmTcgl,
      "Km Percorrido (Clever)": kmClever,
      "Km Percorrido (FleetBus)": kmFleetbus,
      "Clever / TCGL %": calcPct(kmClever, kmTcgl),
      "FleetBus / TCGL %": calcPct(kmFleetbus, kmTcgl),
      "FleetBus / Clever %": calcPct(kmFleetbus, kmClever)
    };

    rows.push(row);
  });

  return {
    headers: cabecalhosComparacao(),
    rows,
    colVeiculo,
    colData
  };
}

function fmtDatasCurtas(datasIso) {
  return (datasIso || []).map((d) => { const p = d.split("-"); return `${p[2]}/${p[1]}`; }).join(", ");
}

function montarLinhasAtencao() {
  const colVeiculo = "Veículo";
  const headers = [colVeiculo, "Problema", "Dias TCGL", "Dias Clever", "Dias Faltando", "Datas Faltando"];
  const rows = veiculosAtencaoDetalhe.map((info) => {
    const problemas = [];
    if (info.diasClever === 0) problemas.push("Sem Clever");
    else if (info.diasFaltando >= 3) problemas.push("Clever parcial");
    if (info.kmIrreal.length) problemas.push("Km irreal");
    return {
      [colVeiculo]: info.veiculo,
      "Problema": problemas.join(" + "),
      "Dias TCGL": String(info.diasTcgl),
      "Dias Clever": String(info.diasClever),
      "Dias Faltando": String(info.diasFaltando),
      "Datas Faltando": fmtDatasCurtas(info.datasFaltando) || "—"
    };
  });
  return { headers, rows, colVeiculo, colData: null };
}

async function exportarPdfAtencao() {
  if (!veiculosAtencaoDetalhe.length) return;
  if (!window.jspdf?.jsPDF) { alert("Biblioteca PDF não carregou."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const m = 10;

  doc.setTextColor(6, 36, 92);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("VEÍCULOS QUE PRECISAM DE ATENÇÃO", pageW / 2, 14, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(102, 112, 133);
  doc.text("Portal CIOP · Telemetria Clever · TCGL", pageW / 2, 20, { align: "center" });

  const de = $("filtroDataDe")?.value || "—";
  const ate = $("filtroDataAte")?.value || "—";
  doc.text(`Período: ${de} a ${ate}`, pageW / 2, 25, { align: "center" });
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageW - m, 25, { align: "right" });
  doc.text(`Total: ${veiculosAtencaoDetalhe.length} veículo(s)`, m, 25, { align: "left" });

  const cols = ["Veículo", "Problema", "Dias TCGL", "Dias Clever", "Dias Faltando", "Datas Faltando"];
  const head = [cols];
  const body = veiculosAtencaoDetalhe.map((info) => {
    const problemas = [];
    if (info.diasClever === 0) problemas.push("Sem Clever");
    else if (info.diasFaltando >= 3) problemas.push("Clever parcial");
    if (info.kmIrreal.length) problemas.push("Km irreal");
    return [
      info.veiculo,
      problemas.join(" + "),
      String(info.diasTcgl),
      String(info.diasClever),
      String(info.diasFaltando),
      fmtDatasCurtas(info.datasFaltando) || "—"
    ];
  });

  doc.autoTable({
    head, body, startY: 30,
    margin: { left: m, right: m },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5, valign: "middle", textColor: [16, 24, 40] },
    headStyles: { fillColor: [230, 81, 0], textColor: [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [255, 243, 224] },
    columnStyles: {
      0: { halign: "center", cellWidth: 18 },
      1: { halign: "left", cellWidth: 30 },
      2: { halign: "center", cellWidth: 18 },
      3: { halign: "center", cellWidth: 18 },
      4: { halign: "center", cellWidth: 18 },
      5: { halign: "left" }
    },
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 1) return;
      const raw = data.cell.raw;
      if (raw.includes("Sem Clever")) data.cell.styles.textColor = [230, 81, 0];
      else if (raw.includes("Km irreal")) data.cell.styles.textColor = [198, 40, 40];
    },
    didDrawPage: (data) => {
      const pg = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Página ${data.pageNumber} de ${pg}`, pageW / 2, doc.internal.pageSize.getHeight() - 5, { align: "center" });
    }
  });

  const hoje = new Date().toISOString().slice(0, 10);
  doc.save(`atencao-clever-${hoje}.pdf`);
}

function aplicarFonteAtiva() {
  if (!snapshotRaw?.dados?.length) return 0;

  if (fonteAtiva === "atencao") {
    const atencao = montarLinhasAtencao();
    dadosBrutos = {
      headers: atencao.headers,
      rows: atencao.rows,
      colVeiculo: atencao.colVeiculo,
      colData: atencao.colData,
      colunasKpi: {},
      arquivos: ["atencao-clever"],
      modo: "atencao"
    };
  } else if (fonteAtiva === "comparacao") {
    const comp = montarLinhasComparacao();
    dadosBrutos = {
      headers: comp.headers,
      rows: comp.rows,
      colVeiculo: comp.colVeiculo,
      colData: comp.colData,
      colunasKpi: detectarColunasKpi(comp.headers),
      arquivos: ["planilha-google"],
      modo: "comparacao"
    };
  } else {
    const registros = filtrarRegistrosPorPeriodo(registrosDaFonte(fonteAtiva));
    const colVeiculo = "Veiculo";
    const colData = "Data";
    const headers = headersPlanilhaTelemetria();
    const rows = registros.map((r) => payloadParaRow(r, colVeiculo, colData));
    aplicarDadosBrutos({
      headers,
      rows,
      colVeiculo,
      colData,
      colunasKpi: detectarColunasKpi(headers),
      arquivos: [`planilha-${fonteAtiva}`],
      modo: fonteAtiva
    }, { resetarAba: false });
    return dadosBrutos.rows.length;
  }

  colunasMarcadas = new Set(colunasExibiveis(dadosBrutos.headers, dadosBrutos.colVeiculo));
  montarFiltroVeiculos();
  montarFiltroDatas(true);
  montarPainelColunas();
  renderizar();
  return dadosBrutos.rows.length;
}

async function selecionarFonte(fonte) {
  const validas = ["clever", "tcgl", "fleetbus", "comparacao", "atencao"];
  if (!validas.includes(fonte) || fonte === fonteAtiva) return;
  fonteAtiva = fonte;
  sortCol = null;
  if (fonte !== "atencao") await garantirDadosFonte(fonte);
  aplicarFonteAtiva();
  renderAbasFonte();
}

function renderAbasFonte() {
  const container = $("abasFonte");
  if (!container) return;
  const qtd = veiculosAtencao.length;
  const opcoes = [
    { id: "comparacao", rotulo: "COMPARAÇÃO" },
    { id: "tcgl", rotulo: "TCGL" },
    { id: "clever", rotulo: "CLEVER" },
    { id: "fleetbus", rotulo: "FLEETBUS" },
    { id: "atencao", rotulo: `ATENÇÃO${qtd ? ` (${qtd})` : ""}` }
  ];
  container.innerHTML = opcoes.map((o) =>
    `<button type="button" role="tab" data-fonte="${o.id}" class="${fonteAtiva === o.id ? "ativo" : ""}${o.id === "atencao" && qtd ? " tab-alerta" : ""}" aria-selected="${fonteAtiva === o.id}">${o.rotulo}</button>`
  ).join("");
  container.querySelectorAll("[data-fonte]").forEach((btn) => {
    btn.addEventListener("click", () => selecionarFonte(btn.getAttribute("data-fonte")));
  });
  const chave = $("chavePlanilhaAoVivo");
  if (chave) chave.checked = planilhaAoVivo;
}

async function atualizarStatusJson() {
  const el = $("statusJson");
  if (!el) return;
  const snap = snapshotRaw;
  const quando = snap?.atualizadoEm ? new Date(snap.atualizadoEm).toLocaleString("pt-BR") : null;
  const clever = snap?.total_clever ?? "—";
  const tcgl = snap?.total_tcgl ?? "—";
  const origem = snap?.origem_carregamento;
  const rotuloOrigem = origem === "planilha" ? "Planilha"
    : origem === "cache" ? "Planilha (cache)"
      : origem === "json" ? "JSON"
        : "Dados";
  if (quando) {
    const periodo = periodoCarregado.de && periodoCarregado.ate
      ? ` · ${formatarDataBr(periodoCarregado.de)}–${formatarDataBr(periodoCarregado.ate)}`
      : "";
    const modo = planilhaAoVivo ? rotuloOrigem : `${rotuloOrigem} · rápido`;
    const fb = snap?.total_fleetbus ?? 0;
    const fbLabel = fb ? ` · FleetBus ${fb}` : "";
    el.textContent = `${modo} · ${quando}${periodo} · TCGL ${tcgl} · Clever ${clever}${fbLabel}`;
    el.className = "status-json ok";
    return;
  }
  const manifest = await carregarManifestTelemetria();
  if (manifest?.atualizadoEm) {
    const quandoManifest = new Date(manifest.atualizadoEm).toLocaleString("pt-BR");
    el.textContent = `JSON · ${quandoManifest} · TCGL ${manifest.total_tcgl ?? tcgl} · Clever ${manifest.total_clever ?? clever}`;
    el.className = "status-json ok";
  } else {
    el.textContent = "JSON local";
    el.className = "status-json muted";
  }
}

function formatarDataBr(iso) {
  const [y, m, d] = String(iso || "").split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatarDataHoraBr(val) {
  const s = String(val ?? "").trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})[ T](\d{2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]} ${m[4]}:${m[5]}`;
  return s;
}

let dadosBrutos = null;
let colunasMarcadas = new Set();
let awsAtivo = false;
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
    primeiraCarga = false;
  }
  renderizar();
  persistirCacheTelemetria();
  return dadosBrutos.rows.length;
}

function renderResumoVazio() {
  $("statFrota").textContent = FROTA.length;
  ["statNoArquivo", "statPctCleverTcgl", "statPctFleetbusTcgl", "statPctCleverFleetbus", "statAtencao"].forEach((id) => {
    $(id).textContent = "—";
  });
  const card = $("cardAtencao");
  if (card) card.classList.remove("alerta");
}

function renderTabelaVazia(msg) {
  const head = $("tabelaDadosHead");
  const corpo = $("tabelaDadosCorpo");
  if (head) head.innerHTML = "<tr><th>Veículo</th></tr>";
  if (corpo) corpo.innerHTML = `<tr><td>${escapeHtml(msg || "Nenhum dado carregado.")}</td></tr>`;
  if ($("contagemDados")) $("contagemDados").textContent = "0 registro(s)";
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
  if (dadosBrutos.modo === "comparacao" || dadosBrutos.modo === "atencao") return todas;
  if (!colunasMarcadas.size) return todas;
  return todas.filter((c) => colunasMarcadas.has(c));
}

function rowsBaseFiltro() {
  if (!dadosBrutos) return [];
  let rows = dadosBrutos.rows.slice();
  rows = filtrarRowsPorData(rows, dadosBrutos.colData, $("filtroDataDe").value, $("filtroDataAte").value);
  const veicFiltro = $("filtroVeiculo").value;
  if (veicFiltro) rows = rows.filter((r) => normVeiculo(r[dadosBrutos.colVeiculo]) === veicFiltro);
  if (filtroAtencaoAtivo && veiculosAtencao.length) {
    const ids = new Set(veiculosAtencao);
    rows = rows.filter((r) => ids.has(normVeiculo(r[dadosBrutos.colVeiculo])));
  }
  return rows;
}

function rowsFiltradasDados() {
  return rowsBaseFiltro();
}

function rowsFiltradas() {
  return expandirFrotaSemDados(rowsFiltradasDados());
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
  const fieldColunas = document.querySelector(".filter-field--colunas");
  if (fieldColunas) fieldColunas.hidden = dadosBrutos?.modo === "comparacao";
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
  const hoje = dataIsoPadrao(0);
  if (!datas.length) {
    if (forceReset) {
      de.value = dataIsoPadrao(-30);
      ate.value = hoje;
    }
    return;
  }
  const min = datas[0];
  const maxDados = datas[datas.length - 1];
  const max = maxDados > hoje ? maxDados : hoje;
  de.min = min;
  de.max = max;
  ate.min = min;
  ate.max = max;
  if (forceReset || !de.value || !ate.value) {
    de.value = min;
    ate.value = hoje;
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
  $("statPctCleverTcgl").textContent = stats.pctCleverTcgl;
  $("statPctFleetbusTcgl").textContent = stats.pctFleetbusTcgl;
  $("statPctCleverFleetbus").textContent = stats.pctFleetbusClever;
  $("statAtencao").textContent = stats.atencao;
  const card = $("cardAtencao");
  if (card) card.classList.toggle("alerta", stats.atencao > 0);
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

  $("contagemDados").textContent = (() => {
    const semDados = rows.filter((r) => r.__semDados).length;
    const comDados = rows.length - semDados;
    if (semDados) return `${rows.length} linha(s) · ${comDados} com dados · ${semDados} sem registro no período`;
    return `${rows.length} registro(s)`;
  })();

  if (!rows.length) {
    corpo.innerHTML = `<tr><td colspan="${colsVisiveis.length + 1}">Nenhum registro no período selecionado.</td></tr>`;
    return;
  }

  const sorted = ordenarRows(rows, sortCol, sortDir);

  corpo.innerHTML = sorted.map((row) => {
    const rowCls = classeLinhaDado(row, colunasKpi);
    const cells = colsVisiveis.map((col) => {
      const val = formatarCelula(col, row[col] ?? "", row);
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
    const fontesVivo = ["clever", "fleetbus", "comparacao"];
    const msg = fonteAtiva === "atencao"
      ? "Nenhum veículo com problema detectado. Todos os dados Clever estão normais."
      : !planilhaAoVivo && fontesVivo.includes(fonteAtiva)
      ? "Sem dados no JSON para esta fonte. Ative Planilha ao vivo para buscar na planilha Google."
      : "Nenhum registro no período. Ative Planilha ao vivo ou ajuste as datas.";
    renderTabelaVazia(msg);
    return;
  }
  const cols = colunasSelecionadas();
  const rowsDados = rowsFiltradasDados();
  const rows = fonteAtiva === "atencao" ? rowsDados : expandirFrotaSemDados(rowsDados);
  const stats = calcularStats(rowsDados, dadosBrutos.colVeiculo, dadosBrutos.colunasKpi);
  hintFiltrosAtivos();
  renderResumo(stats);
  renderTabelaDados(rows, cols);
  $("painelVazio").hidden = true;
  const btnPdf = $("btnExportPdfAtencao");
  if (btnPdf) btnPdf.hidden = fonteAtiva !== "atencao";
}

function limparFiltros() {
  if (!dadosBrutos) return;
  sortCol = dadosBrutos.colVeiculo;
  sortDir = "asc";
  filtroAtencaoAtivo = false;
  const cardAt = $("cardAtencao");
  if (cardAt) cardAt.classList.remove("filtro-ativo");
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
        await aguardar(1200 + i * 600);
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
  clearTimeout(debounceFiltroTimer);
  debounceFiltroTimer = setTimeout(async () => {
    const de = $("filtroDataDe")?.value || "";
    const ate = $("filtroDataAte")?.value || "";
    if (precisaRecarregarSnapshot(de, ate) && planilhaAoVivo) {
      const el = $("statusJson");
      if (el) {
        el.textContent = "Carregando período…";
        el.className = "status-json muted";
      }
      const fonte = fontePlanilhaAtual();
      const snap = await carregarSnapshotTelemetriaPlanilha({ fonte, de, ate, skipCache: true });
      if (snap?.dados?.length) {
        aplicarSnapshotMesclado(snap, { fonte });
      }
      atualizarStatusJson();
    }
    aplicarFonteAtiva();
  }, 350);
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
  await renovarSessaoTelemetria();
  let result = await carregarAws({ tentativas: 4, authTentativas: 20 });
  if (!result.ok && /token|sessão|sessao|401|403|autentic|expirad/i.test(result.motivo)) {
    await renovarSessaoTelemetria();
    await aguardar(500);
    result = await carregarAws({ tentativas: 3, authTentativas: 12 });
  }
  return result;
}

function avisarAwsIndisponivel(motivo) {
  const msg = String(motivo || "erro AWS");
  const auth = /token|sessão|sessao|401|403|autentic|expirad/i.test(msg);
  const el = $("statusUpload");
  if (!el) return;
  if (auth) {
    el.textContent = "Dados exibidos · AWS: sessão inválida (saia e entre de novo para sincronizar)";
  } else {
    el.textContent = `Dados exibidos · AWS indisponível (${msg})`;
  }
  el.className = "status-upload warn";
}

function mostrarErroCarregamento(motivo) {
  if (dadosBrutos?.rows?.length) {
    avisarAwsIndisponivel(motivo);
    renderizar();
    return;
  }
  const msg = String(motivo || "erro desconhecido");
  const auth = /token|sessão|sessao|401|403|autentic|expirad/i.test(msg);
  renderResumoVazio();
  renderTabelaVazia(auth
    ? "Sessão expirada. Saia, entre de novo e clique em Tentar novamente."
    : `Sem dados no banco (${msg}). Use + XLSX para lançar.`);
  if (auth) {
    const corpo = $("tabelaDadosCorpo");
    if (corpo) {
      corpo.innerHTML = `<tr><td>${escapeHtml(msg)} <button type="button" id="btnRetryTelemetria" class="btn-limpar-filtros" style="margin-left:8px">Tentar novamente</button></td></tr>`;
    }
  }
  $("btnRetryTelemetria")?.addEventListener("click", async () => {
    renderTabelaVazia("Carregando dados do banco AWS…");
    await renovarSessaoTelemetria();
    const res = await carregarAws({ tentativas: 4, authTentativas: 15 });
    if (res.ok) {
      $("statusUpload").textContent = "Pronto para lançar nova planilha";
      $("statusUpload").className = "status-upload muted";
      renderizar();
      return;
    }
    mostrarErroCarregamento(res.motivo || "sessão inválida");
  });
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

async function processarPlanilha(parsed, nomeArquivo) {
  if (!parsed.headers.length) throw new Error("Planilha sem cabeçalho válido.");
  if (!parsed.rows.length) throw new Error("Planilha sem linhas de dados.");

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

async function processarTextoCsv(texto, nomeArquivo) {
  const parsed = converterLinhasCsv(parseCsv(texto));
  await processarPlanilha(parsed, nomeArquivo);
}

async function processarXlsx(buffer, nomeArquivo) {
  if (typeof XLSX === "undefined") throw new Error("Biblioteca XLSX não carregada.");
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  const parsed = converterLinhasPlanilha(linhas);
  await processarPlanilha(parsed, nomeArquivo);
}

function arquivoTelemetriaValido(file) {
  if (!file) return false;
  return /\.(csv|xlsx)$/i.test(file.name)
    || file.type === "text/csv"
    || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

function lerArquivos(fileList) {
  const files = [...(fileList || [])].filter(arquivoTelemetriaValido);
  if (!files.length) {
    $("msgVazio").textContent = "Selecione um ou mais arquivos .xlsx ou .csv";
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
  if (!arquivoTelemetriaValido(file)) {
    $("msgVazio").textContent = "Selecione um arquivo .xlsx ou .csv";
    return;
  }
  $("statusUpload").textContent = `Lendo ${file.name}...`;
  $("statusUpload").className = "status-upload muted";
  try {
    if (/\.xlsx$/i.test(file.name)) {
      const buffer = await file.arrayBuffer();
      await processarXlsx(buffer, file.name);
    } else {
      const reader = new FileReader();
      const texto = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
        reader.readAsText(file, "UTF-8");
      });
      await processarTextoCsv(String(texto || ""), file.name);
    }
  } catch (err) {
    $("statusUpload").textContent = err.message || "Falha ao processar o arquivo.";
    $("statusUpload").className = "status-upload warn";
  }
}

async function iniciar() {
  if (!FROTA.length) {
    $("msgVazio").textContent = "Lista da frota (250 veículos) não carregada.";
    return;
  }

  $("painelResultado").hidden = false;
  montarFiltroVeiculos();
  $("filtroDataDe").value = "";
  $("filtroDataAte").value = "";
  $("statFrota").textContent = FROTA.length;
  limparCacheTelemetriaLegado();
  renderResumoVazio();
  renderTabelaVazia("Carregando dados…");
  planilhaAoVivo = true;
  const chavePlanilha = $("chavePlanilhaAoVivo");
  if (chavePlanilha) {
    chavePlanilha.checked = true;
    chavePlanilha.addEventListener("change", () => onChavePlanilhaChange());
  }
  renderAbasFonte();

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

  const cardAtencao = $("cardAtencao");
  if (cardAtencao) {
    cardAtencao.style.cursor = "pointer";
    cardAtencao.addEventListener("click", () => {
      selecionarFonte("atencao");
    });
  }

  const btnPdf = $("btnExportPdfAtencao");
  if (btnPdf) btnPdf.addEventListener("click", () => exportarPdfAtencao());

  try {
    const temSnapshot = await carregarSnapshotInicial();
    if (!temSnapshot) {
      renderTabelaVazia("Não foi possível carregar os dados de telemetria. Verifique a conexão ou tente novamente.");
      const el = $("statusJson");
      if (el) {
        el.innerHTML = `Erro no JSON · <a href="${PLANILHA_TELEMETRIA_URL}" target="_blank" rel="noopener">Abrir planilha</a>`;
        el.className = "status-json warn";
      }
    }
  } catch (err) {
    console.error("Telemetria:", err);
    renderTabelaVazia("Erro ao carregar telemetria: " + (err?.message || "falha desconhecida"));
    const el = $("statusJson");
    if (el) {
      el.textContent = "Erro no carregamento";
      el.className = "status-json warn";
    }
  }
}

function bootstrapTelemetria() {
  let iniciou = false;
  const start = () => {
    if (iniciou) return;
    iniciou = true;
    iniciar();
  };
  if (window.portalUsuarioValidado) {
    start();
    return;
  }
  window.addEventListener("portal:usuario-validado", start, { once: true });
  if (typeof window.portalAguardarUsuario === "function") {
    window.portalAguardarUsuario(start);
  }
}

bootstrapTelemetria();
