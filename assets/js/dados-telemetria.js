import {
  carregarTelemetriaAws,
  importarTelemetriaAws,
  telemetriaAwsDisponivel
} from "./telemetria-aws.js";

const FROTA = (window.FROTA_PATIO || []).slice().sort((a, b) =>
  String(a.veiculo).localeCompare(String(b.veiculo), "pt-BR", { numeric: true })
);

const CHAVES_VEICULO = [
  "veiculo", "veículo", "prefixo", "carro", "numero", "número", "n°", "nº",
  "frota", "id_veiculo", "codigo", "código", "placa", "vehicle", "bus"
];

const CHAVES_DATA = ["data", "date", "dia", "dt", "data_ref", "data referencia"];

const KPI_DEFS = [
  { id: "can", rotulos: ["registros can", "registro can"] },
  { id: "kmInicial", rotulos: ["km inicial"] },
  { id: "kmFinal", rotulos: ["km final"] },
  { id: "kmPercorrido", rotulos: ["km percorrido"] }
];

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
    .replace(/\s+/g, " ")
    .trim();
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
  const headers = linhas[0].map((h) => String(h).trim());
  const rows = linhas.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] != null ? String(cols[i]).trim() : ""; });
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
  let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return "";
}

function chaveLinha(row, colVeiculo, colData) {
  return `${parseDataCsv(row[colData])}|${normVeiculo(row[colVeiculo])}`;
}

function mesclarHeaders(atual, novo) {
  const set = new Set([...(atual || []), ...novo]);
  return [...set];
}

function mesclarRows(atual, novas, colVeiculo, colData) {
  const map = new Map();
  (atual || []).forEach((r) => map.set(chaveLinha(r, colVeiculo, colData), r));
  novas.forEach((r) => map.set(chaveLinha(r, colVeiculo, colData), r));
  return [...map.values()];
}

function payloadParaLinha(row, colVeiculo, colData) {
  const dataIso = parseDataCsv(row[colData]);
  const veiculo = normVeiculo(row[colVeiculo]);
  if (!dataIso || !veiculo) return null;
  return { data_iso: dataIso, veiculo, payload: { ...row } };
}

function linhasAwsParaRows(dados, headers, colVeiculo, colData) {
  return (dados || []).map((item) => {
    const row = { ...(item.payload || item) };
    if (colVeiculo && !row[colVeiculo] && item.veiculo) row[colVeiculo] = item.veiculo;
    if (colData && !row[colData] && item.data_iso) {
      const [y, m, d] = String(item.data_iso).split("-");
      row[colData] = `${d}-${m}-${y}`;
    }
    return row;
  });
}

function filtrarRowsPorData(rows, colData, dataDe, dataAte) {
  if (!colData || (!dataDe && !dataAte)) return rows;
  return rows.filter((row) => {
    const iso = parseDataCsv(row[colData]);
    if (!iso) return false;
    if (dataDe && iso < dataDe) return false;
    if (dataAte && iso > dataAte) return false;
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

let dadosBrutos = null;
let colunasMarcadas = new Set();
let awsAtivo = false;

function colunasSelecionadas() {
  if (!dadosBrutos) return [];
  const todas = dadosBrutos.headers.filter((h) => h !== dadosBrutos.colVeiculo);
  if (!colunasMarcadas.size) return todas;
  return todas.filter((c) => colunasMarcadas.has(c));
}

function rowsFiltradas() {
  if (!dadosBrutos) return [];
  let rows = dadosBrutos.rows.slice();
  rows = filtrarRowsPorData(rows, dadosBrutos.colData, $("filtroDataDe").value, $("filtroDataAte").value);
  const veicFiltro = $("filtroVeiculo").value;
  if (veicFiltro) rows = rows.filter((r) => normVeiculo(r[dadosBrutos.colVeiculo]) === veicFiltro);
  return rows;
}

function atualizarRotuloColunas() {
  const btn = $("filtroColunasBtn");
  if (!btn || !dadosBrutos) return;
  const total = dadosBrutos.headers.filter((h) => h !== dadosBrutos.colVeiculo).length;
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
  const cols = dadosBrutos.headers.filter((h) => h !== dadosBrutos.colVeiculo);
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
  if (forceReset || !de.value) {
    de.value = min;
    ate.value = max;
  }
}

function hintFiltrosAtivos() {
  const hint = $("filtroAtivoHint");
  if (!hint || !dadosBrutos) return;
  const partes = [];
  const de = $("filtroDataDe").value;
  const ate = $("filtroDataAte").value;
  const veic = $("filtroVeiculo").value;
  const totalCol = dadosBrutos.headers.filter((h) => h !== dadosBrutos.colVeiculo).length;
  const nCol = colunasSelecionadas().length;
  if (de || ate) partes.push(`período ${de || "…"} a ${ate || "…"}`);
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

  const colsVisiveis = cols.length ? cols : dadosBrutos.headers.filter((h) => h !== colVeiculo);
  head.innerHTML = `<tr>
    <th class="col-fix">${escapeHtml(colVeiculo || "Veículo")}</th>
    ${colsVisiveis.map((c) => `<th title="${escapeHtml(c)}">${escapeHtml(c)}</th>`).join("")}
  </tr>`;

  $("contagemDados").textContent = `${rows.length} registro(s)`;

  if (!rows.length) {
    corpo.innerHTML = `<tr><td colspan="${colsVisiveis.length + 1}">Nenhum registro no período selecionado.</td></tr>`;
    return;
  }

  const sorted = rows.slice().sort((a, b) => {
    const da = parseDataCsv(a[dadosBrutos.colData]) || "";
    const db = parseDataCsv(b[dadosBrutos.colData]) || "";
    if (da !== db) return db.localeCompare(da);
    return normVeiculo(a[colVeiculo]).localeCompare(normVeiculo(b[colVeiculo]), "pt-BR", { numeric: true });
  });

  corpo.innerHTML = sorted.map((row) => {
    const rowCls = classeLinhaDado(row, colunasKpi);
    const cells = colsVisiveis.map((col) => {
      const val = row[col] ?? "";
      return `<td>${escapeHtml(val) || "<span class=\"cell-vazio\">—</span>"}</td>`;
    }).join("");
    return `<tr${rowCls ? ` class="${rowCls}"` : ""}>
      <td class="col-fix veiculo">${escapeHtml(row[colVeiculo])}</td>
      ${cells}
    </tr>`;
  }).join("");
}

function renderizar() {
  if (!dadosBrutos) return;
  const cols = colunasSelecionadas();
  const rows = rowsFiltradas();
  const stats = calcularStats(rows, dadosBrutos.colVeiculo, dadosBrutos.colunasKpi);
  const totalLinhas = dadosBrutos.rows.length;
  const arquivos = dadosBrutos.arquivos?.length ? dadosBrutos.arquivos.join(", ") : "—";
  $("infoUpload").textContent = `${totalLinhas} linha(s) acumulada(s) · ${stats.veiculosArquivo} veículo(s) · arquivos: ${arquivos}${awsAtivo ? " · AWS" : ""}`;
  hintFiltrosAtivos();
  renderResumo(stats);
  renderTabelaDados(rows, cols);
  $("painelVazio").hidden = totalLinhas > 0;
  $("painelResultado").hidden = false;
}

function limparFiltros() {
  if (!dadosBrutos) return;
  $("filtroVeiculo").value = "";
  montarFiltroDatas(true);
  const cols = dadosBrutos.headers.filter((h) => h !== dadosBrutos.colVeiculo);
  colunasMarcadas = new Set(cols);
  montarPainelColunas();
  fecharPainelColunas();
  renderizar();
}

async function salvarAws(linhasImport, nomeArquivo) {
  const payload = linhasImport.map((r) => payloadParaLinha(r, dadosBrutos.colVeiculo, dadosBrutos.colData)).filter(Boolean);
  if (!payload.length) return { ok: false, motivo: "sem linhas válidas" };
  try {
    awsAtivo = await telemetriaAwsDisponivel();
    if (!awsAtivo) return { ok: false, motivo: "aws indisponível" };
    const res = await importarTelemetriaAws(payload, nomeArquivo);
    return { ok: true, inseridos: res.inseridos };
  } catch (err) {
    return { ok: false, motivo: err.message || "erro aws" };
  }
}

async function carregarAws() {
  try {
    awsAtivo = await telemetriaAwsDisponivel();
    if (!awsAtivo) return false;
    const de = $("filtroDataDe").value || dataIsoPadrao(-90);
    const ate = $("filtroDataAte").value || dataIsoPadrao(0);
    const res = await carregarTelemetriaAws(de, ate);
    if (!res?.dados?.length) return false;

    const sample = res.dados[0]?.payload || res.dados[0];
    const headers = Object.keys(sample);
    const colVeiculo = detectarColunaVeiculo(headers);
    const colData = detectarColunaData(headers);
    const rows = linhasAwsParaRows(res.dados, headers, colVeiculo, colData);

    dadosBrutos = {
      headers: mesclarHeaders([], headers),
      rows,
      colVeiculo,
      colData,
      colunasKpi: detectarColunasKpi(headers),
      arquivos: ["AWS"]
    };
    colunasMarcadas = new Set(dadosBrutos.headers.filter((h) => h !== colVeiculo));
    montarFiltroVeiculos();
    montarFiltroDatas(true);
    montarPainelColunas();
    renderizar();
    return true;
  } catch (_) {
    awsAtivo = false;
    return false;
  }
}

function incorporarCsv(parsed, nomeArquivo) {
  const colVeiculo = detectarColunaVeiculo(parsed.headers);
  const colData = detectarColunaData(parsed.headers);

  if (!dadosBrutos) {
    dadosBrutos = {
      headers: parsed.headers.slice(),
      rows: parsed.rows.slice(),
      colVeiculo,
      colData,
      colunasKpi: detectarColunasKpi(parsed.headers),
      arquivos: [nomeArquivo]
    };
  } else {
    dadosBrutos.headers = mesclarHeaders(dadosBrutos.headers, parsed.headers);
    dadosBrutos.colVeiculo = colVeiculo || dadosBrutos.colVeiculo;
    dadosBrutos.colData = colData || dadosBrutos.colData;
    dadosBrutos.colunasKpi = { ...dadosBrutos.colunasKpi, ...detectarColunasKpi(parsed.headers) };
    dadosBrutos.rows = mesclarRows(dadosBrutos.rows, parsed.rows, dadosBrutos.colVeiculo, dadosBrutos.colData);
    if (!dadosBrutos.arquivos.includes(nomeArquivo)) dadosBrutos.arquivos.push(nomeArquivo);
  }

  colunasMarcadas = new Set(dadosBrutos.headers.filter((h) => h !== dadosBrutos.colVeiculo));
  montarFiltroVeiculos();
  montarFiltroDatas(false);
  montarPainelColunas();
  renderizar();
}

async function processarTextoCsv(texto, nomeArquivo) {
  const parsed = converterLinhasCsv(parseCsv(texto));
  if (!parsed.headers.length) throw new Error("CSV sem cabeçalho válido.");
  if (!parsed.rows.length) throw new Error("CSV sem linhas de dados.");

  incorporarCsv(parsed, nomeArquivo);

  $("infoUpload").textContent = `Salvando ${nomeArquivo} na AWS...`;
  const salvo = await salvarAws(parsed.rows, nomeArquivo);
  if (salvo.ok) {
    $("statusAws").textContent = `Salvo na AWS (${salvo.inseridos} linha(s))`;
    $("statusAws").className = "status-aws ok";
  } else {
    $("statusAws").textContent = salvo.motivo === "aws indisponível"
      ? "Dados acumulados localmente (AWS indisponível)"
      : `Acumulado localmente (${salvo.motivo})`;
    $("statusAws").className = "status-aws warn";
  }
  renderizar();
}

function lerArquivo(file) {
  if (!file) return;
  if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
    $("msgVazio").textContent = "Selecione um arquivo .csv";
    return;
  }
  $("infoUpload").textContent = `Lendo ${file.name}...`;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await processarTextoCsv(String(reader.result || ""), file.name);
    } catch (err) {
      $("infoUpload").textContent = err.message || "Falha ao processar o CSV.";
    }
  };
  reader.onerror = () => { $("infoUpload").textContent = "Não foi possível ler o arquivo."; };
  reader.readAsText(file, "UTF-8");
}

async function iniciar() {
  if (!FROTA.length) {
    $("msgVazio").textContent = "Lista da frota (250 veículos) não carregada.";
    return;
  }

  montarFiltroVeiculos();
  $("statFrota").textContent = FROTA.length;
  $("filtroDataDe").value = dataIsoPadrao(-90);
  $("filtroDataAte").value = dataIsoPadrao(0);

  const input = $("csvInput");
  const zona = $("uploadZona");

  input.addEventListener("change", () => {
    lerArquivo(input.files && input.files[0]);
    input.value = "";
  });

  zona.addEventListener("dragover", (e) => { e.preventDefault(); zona.classList.add("drag"); });
  zona.addEventListener("dragleave", () => zona.classList.remove("drag"));
  zona.addEventListener("drop", (e) => {
    e.preventDefault();
    zona.classList.remove("drag");
    lerArquivo(e.dataTransfer?.files?.[0]);
  });
  zona.addEventListener("click", () => input.click());
  zona.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
  });

  ["filtroDataDe", "filtroDataAte", "filtroVeiculo"].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("change", async () => {
      if (awsAtivo) {
        const de = $("filtroDataDe").value;
        const ate = $("filtroDataAte").value;
        try {
          const res = await carregarTelemetriaAws(de, ate, $("filtroVeiculo").value || undefined);
          if (res?.dados?.length && dadosBrutos) {
            const extra = linhasAwsParaRows(res.dados, dadosBrutos.headers, dadosBrutos.colVeiculo, dadosBrutos.colData);
            dadosBrutos.rows = mesclarRows(dadosBrutos.rows, extra, dadosBrutos.colVeiculo, dadosBrutos.colData);
          }
        } catch (_) { /* mantém dados locais */ }
      }
      renderizar();
    });
  });

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

  $("infoUpload").textContent = "Carregando dados da AWS...";
  const carregou = await carregarAws();
  if (!carregou) {
    $("infoUpload").textContent = "Adicione um CSV — os dados serão acumulados e salvos na AWS.";
    $("statusAws").textContent = "Aguardando primeiro arquivo";
    $("statusAws").className = "status-aws muted";
  }
}

if (window.portalUsuarioValidado) iniciar();
else window.addEventListener("portal:usuario-validado", iniciar, { once: true });
