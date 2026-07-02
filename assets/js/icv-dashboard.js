const ICV_DATA_BASE = "../assets/data/icv";
const ICV_API_URL = "https://script.google.com/macros/s/AKfycbwp-s3tzcxQl0gsm20zSfBb7Rw0bQwKnIX0hB9j_nLDIALZKvu3xeGL9G1jo-SSsXhQ9A/exec";
const ICV_CSV_URL = "https://docs.google.com/spreadsheets/d/1g-CaJQF2iDK04HiAcD0OM0ilS_eZ4rGppWq6saHO0Do/export?format=csv&gid=0";

const monthToQuarter = {
  "01": "Q1", "02": "Q1", "03": "Q1",
  "04": "Q2", "05": "Q2", "06": "Q2",
  "07": "Q3", "08": "Q3", "09": "Q3",
  "10": "Q4", "11": "Q4", "12": "Q4"
};

const monthNames = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr", "05": "Mai", "06": "Jun",
  "07": "Jul", "08": "Ago", "09": "Set", "10": "Out", "11": "Nov", "12": "Dez"
};

const fullMonthNames = {
  "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril", "05": "Maio", "06": "Junho",
  "07": "Julho", "08": "Agosto", "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro"
};

let rawData = [];
let chartInstance = null;

function pick(row, keys) {
  for (const key of keys) {
    if (row?.[key] != null && String(row[key]).trim() !== "") return row[key];
  }
  return null;
}

function parseDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const y = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${y}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parseViagensCount(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 && value < 500 ? Math.round(value * 1000) : Math.round(value);
  }
  let text = String(value).trim().replace(/\s/g, "");
  if (!text) return 0;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (text.includes(",") && !text.includes(".")) {
    text = text.replace(",", ".");
  } else if (/^\d+\.\d{1,3}$/.test(text)) {
    return Math.round(Number(text) * 1000);
  } else {
    text = text.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(text);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function parseSupressaoCount(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const n = Number(String(value).trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function parsePercent(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1 ? value / 100 : value;
  }
  const text = String(value).trim().replace("%", "").replace(",", ".");
  const n = Number(text);
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((v) => v.trim());
}

function parseCsv(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || ""]));
  });
}

function normalizeRows(rows) {
  return rows.map((row) => {
    const date = parseDate(pick(row, ["date", "data", "Data", "DATA", "Dia", "dia"]));
    if (!date) return null;
    const viag_prog = parseViagensCount(pick(row, ["viag_prog", "Viag. Prog", "Viag Prog", "Viagens Programadas"]));
    const viagens = parseViagensCount(pick(row, ["viagens", "Viagens", "Viagens Realizadas"]));
    const supressao = parseSupressaoCount(pick(row, ["supressao", "Supressão", "Supressao"]));
    const icvRaw = pick(row, ["icv", "ICV", "Índice de Cumprimento de Viagem"]);
    const icv = icvRaw != null && icvRaw !== ""
      ? parsePercent(icvRaw)
      : (viag_prog > 0 ? viagens / viag_prog : 0);
    if (!viag_prog && !viagens && !supressao && !icv) return null;
    return { date, viag_prog, viagens, supressao, icv };
  }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
}

function formatDateBR(dateValue) {
  if (!dateValue || dateValue === "--") return "--";
  const parts = String(dateValue).split("-");
  return parts.length === 3 ? parts.reverse().join("/") : dateValue;
}

function formatInt(n) {
  return Math.round(Number(n) || 0).toLocaleString("pt-BR");
}

function formatPctDecimal(val) {
  return ((Number(val) || 0) * 100).toFixed(2) + "%";
}

function formatarSubtitulo(anoSel, trimSel, mesSel, diaSel) {
  if (diaSel !== "todos") return `ICV — Dia ${formatDateBR(diaSel)}`;
  if (mesSel !== "todos") {
    const mes = fullMonthNames[mesSel] || mesSel;
    return anoSel !== "todos" ? `ICV — ${mes} de ${anoSel}` : `ICV — ${mes}`;
  }
  if (trimSel !== "todos") {
    const nomes = { Q1: "1º Trimestre", Q2: "2º Trimestre", Q3: "3º Trimestre", Q4: "4º Trimestre" };
    const trim = nomes[trimSel] || trimSel;
    return anoSel !== "todos" ? `ICV — ${trim} ${anoSel}` : `ICV — ${trim}`;
  }
  if (anoSel !== "todos") return `ICV — Ano ${anoSel}`;
  return "ICV — Histórico Completo";
}

function agregarLinhas(rows) {
  const total = rows.reduce((acc, row) => {
    acc.viag_prog += row.viag_prog;
    acc.viagens += row.viagens;
    acc.supressao += row.supressao;
    return acc;
  }, { viag_prog: 0, viagens: 0, supressao: 0 });
  total.icv = total.viag_prog > 0 ? total.viagens / total.viag_prog : 0;
  return total;
}

function montarVisualizacao(filteredData, anoSel, mesSel, diaSel) {
  if (!filteredData.length) {
    return {
      tituloGrafico: "Nenhum dado para exibir",
      tituloTabela: "Nenhum dado para exibir",
      colunaPeriodo: "Período",
      linhas: [],
      chartLabels: [],
      chartIcv: []
    };
  }

  if (diaSel !== "todos") {
    const d = filteredData[0];
    const linhas = [{
      periodo: formatDateBR(diaSel),
      viag_prog: d.viag_prog,
      viagens: d.viagens,
      supressao: d.supressao,
      icv: d.icv * 100
    }];
    return {
      tituloGrafico: `ICV — Dia ${formatDateBR(diaSel)}`,
      tituloTabela: `Detalhamento — Dia ${formatDateBR(diaSel)}`,
      colunaPeriodo: "Data",
      linhas,
      chartLabels: [formatDateBR(diaSel)],
      chartIcv: [d.icv * 100]
    };
  }

  if (mesSel !== "todos") {
    const ordenados = filteredData.slice().sort((a, b) => a.date.localeCompare(b.date));
    const linhas = ordenados.map((d) => ({
      periodo: formatDateBR(d.date),
      viag_prog: d.viag_prog,
      viagens: d.viagens,
      supressao: d.supressao,
      icv: d.icv * 100
    }));
    return {
      tituloGrafico: `ICV Diário — ${fullMonthNames[mesSel]}`,
      tituloTabela: `Detalhamento Diário — ${fullMonthNames[mesSel]}${anoSel !== "todos" ? ` de ${anoSel}` : ""}`,
      colunaPeriodo: "Data",
      linhas,
      chartLabels: ordenados.map((d) => `${d.date.split("-")[2]}/${d.date.split("-")[1]}`),
      chartIcv: ordenados.map((d) => d.icv * 100)
    };
  }

  const groupKey = {};
  filteredData.forEach((d) => {
    const parts = d.date.split("-");
    const key = anoSel === "todos" ? `${parts[0]}-${parts[1]}` : parts[1];
    if (!groupKey[key]) groupKey[key] = [];
    groupKey[key].push(d);
  });

  const linhas = [];
  const chartLabels = [];
  const chartIcv = [];

  Object.keys(groupKey).sort().forEach((key) => {
    const agg = agregarLinhas(groupKey[key]);
    let periodo;
    let labelGrafico;
    if (anoSel === "todos") {
      const [yr, mn] = key.split("-");
      periodo = `${fullMonthNames[mn]}/${yr}`;
      labelGrafico = `${monthNames[mn]}/${yr.substring(2)}`;
    } else {
      periodo = fullMonthNames[key] || monthNames[key] || key;
      labelGrafico = monthNames[key] || key;
    }
    linhas.push({
      periodo,
      viag_prog: agg.viag_prog,
      viagens: agg.viagens,
      supressao: agg.supressao,
      icv: agg.icv * 100
    });
    chartLabels.push(labelGrafico);
    chartIcv.push(agg.icv * 100);
  });

  const tituloGrafico = anoSel !== "todos"
    ? `ICV Mensal — Ano ${anoSel}`
    : "ICV Mensal — Histórico";
  const tituloTabela = anoSel !== "todos"
    ? `Resumo Mensal — Ano ${anoSel}`
    : "Resumo Mensal — Histórico Completo";

  return { tituloGrafico, tituloTabela, colunaPeriodo: "Período", linhas, chartLabels, chartIcv };
}

function calcularMelhorMes(dados) {
  const meses = {};
  dados.forEach((item) => {
    const parts = item.date.split("-");
    const key = `${parts[0]}-${parts[1]}`;
    if (!meses[key]) meses[key] = [];
    meses[key].push(item);
  });
  return Object.entries(meses)
    .map(([key, rows]) => {
      const agg = agregarLinhas(rows);
      const mn = key.split("-")[1];
      const yr = key.split("-")[0];
      return {
        label: `${fullMonthNames[mn]}/${yr}`,
        icv: agg.icv
      };
    })
    .sort((a, b) => b.icv - a.icv)[0] || null;
}

function initFilters() {
  const anoSelect = document.getElementById("anoFilter");
  const diaSelect = document.getElementById("diaFilter");
  anoSelect.innerHTML = '<option value="todos">Todos os Anos</option>';
  diaSelect.innerHTML = '<option value="todos">Todos os Dias</option>';
  const uniqueYears = [...new Set(rawData.map((d) => d.date.split("-")[0]))].sort();
  uniqueYears.forEach((year) => {
    if (!year || year === "undefined") return;
    const option = document.createElement("option");
    option.value = year;
    option.innerText = year;
    anoSelect.appendChild(option);
  });
  if (uniqueYears.length) anoSelect.value = uniqueYears[uniqueYears.length - 1];
  updateDayDropdown();
}

function updateDayDropdown() {
  const diaSelect = document.getElementById("diaFilter");
  const selectedYear = document.getElementById("anoFilter").value;
  const selectedMonth = document.getElementById("mesFilter").value;
  const prevValue = diaSelect.value;
  diaSelect.innerHTML = '<option value="todos">Todos os Dias</option>';
  const filteredDates = rawData.filter((d) => {
    const parts = d.date.split("-");
    if (selectedYear !== "todos" && parts[0] !== selectedYear) return false;
    if (selectedMonth !== "todos" && parts[1] !== selectedMonth) return false;
    return true;
  });
  [...new Set(filteredDates.map((d) => d.date))].sort().forEach((date) => {
    const option = document.createElement("option");
    option.value = date;
    option.innerText = formatDateBR(date);
    diaSelect.appendChild(option);
  });
  if ([...diaSelect.options].some((o) => o.value === prevValue)) diaSelect.value = prevValue;
}

function updateFilters(trigger) {
  const anoSel = document.getElementById("anoFilter").value;
  const trimSel = document.getElementById("trimestreFilter").value;
  const mesSel = document.getElementById("mesFilter").value;
  const diaSel = document.getElementById("diaFilter").value;

  if (trigger === "ano") {
    document.getElementById("trimestreFilter").value = "todos";
    document.getElementById("mesFilter").value = "todos";
    document.getElementById("diaFilter").value = "todos";
  } else if (trigger === "trimestre") {
    document.getElementById("diaFilter").value = "todos";
    document.getElementById("mesFilter").value = "todos";
  } else if (trigger === "mes") {
    document.getElementById("diaFilter").value = "todos";
    if (mesSel !== "todos") document.getElementById("trimestreFilter").value = monthToQuarter[mesSel];
  } else if (trigger === "dia" && diaSel !== "todos") {
    const parts = diaSel.split("-");
    document.getElementById("anoFilter").value = parts[0];
    document.getElementById("mesFilter").value = parts[1];
    document.getElementById("trimestreFilter").value = monthToQuarter[parts[1]];
  }

  updateDayDropdown();
  renderDashboard();
}

function renderizarTabela(visual) {
  const tbody = document.getElementById("tableBody");
  const thPeriodo = document.getElementById("thColPeriodo");
  document.getElementById("tableDynamicTitle").innerText = visual.tituloTabela;
  if (thPeriodo) thPeriodo.innerText = visual.colunaPeriodo;

  if (!visual.linhas.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">Nenhum dado encontrado para os filtros aplicados.</td></tr>';
    return;
  }

  tbody.innerHTML = visual.linhas.map((row) => `
    <tr>
      <td>${row.periodo}</td>
      <td>${formatInt(row.viag_prog)}</td>
      <td>${formatInt(row.viagens)}</td>
      <td>${formatInt(row.supressao)}</td>
      <td class="icv-cell">${row.icv.toFixed(2)}%</td>
    </tr>`).join("");
}

function renderChart(visual) {
  document.getElementById("chartDynamicTitle").innerText = visual.tituloGrafico;
  const ctx = document.getElementById("barChartCanvas").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  if (!visual.chartLabels.length) return;

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: visual.chartLabels,
      datasets: [{
        label: "ICV",
        data: visual.chartIcv,
        backgroundColor: "rgba(15, 118, 110, 0.75)",
        borderColor: "#0f766e",
        borderWidth: 1.5,
        borderRadius: 4,
        maxBarThickness: 42
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
          suggestedMin: 70,
          suggestedMax: 100,
          ticks: {
            callback: (v) => `${v}%`
          }
        },
        x: {
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ICV: ${ctx.raw.toFixed(2)}%`
          }
        },
        datalabels: {
          anchor: "end",
          align: "top",
          color: "#0f766e",
          font: { weight: "700", size: 9 },
          formatter: (v) => `${v.toFixed(1)}%`
        }
      }
    }
  });
}

function renderDashboard() {
  const anoSel = document.getElementById("anoFilter").value;
  const trimSel = document.getElementById("trimestreFilter").value;
  const mesSel = document.getElementById("mesFilter").value;
  const diaSel = document.getElementById("diaFilter").value;

  const filteredData = rawData.filter((d) => {
    const parts = d.date.split("-");
    const y = parts[0];
    const m = parts[1];
    const q = monthToQuarter[m];
    if (diaSel !== "todos") return d.date === diaSel;
    if (anoSel !== "todos" && y !== anoSel) return false;
    if (trimSel !== "todos" && q !== trimSel) return false;
    if (mesSel !== "todos" && m !== mesSel) return false;
    return true;
  });

  document.getElementById("dashboardSubtitle").innerText = formatarSubtitulo(anoSel, trimSel, mesSel, diaSel);

  const totais = agregarLinhas(filteredData);
  const melhorMes = calcularMelhorMes(filteredData);

  document.getElementById("kpiMelhorMes").innerText = melhorMes ? formatPctDecimal(melhorMes.icv) : "-";
  document.getElementById("kpiMelhorMesLabel").innerText = melhorMes ? melhorMes.label : "--";
  document.getElementById("kpiViagProg").innerText = filteredData.length ? formatInt(totais.viag_prog) : "-";
  document.getElementById("kpiViagens").innerText = filteredData.length ? formatInt(totais.viagens) : "-";
  document.getElementById("kpiSupressao").innerText = filteredData.length ? formatInt(totais.supressao) : "-";
  document.getElementById("kpiPctSupressao").innerText = totais.viag_prog > 0
    ? ((totais.supressao / totais.viag_prog) * 100).toFixed(2) + "%"
    : "-";

  const visual = montarVisualizacao(filteredData, anoSel, mesSel, diaSel);
  renderizarTabela(visual);
  renderChart(visual);
}

async function carregarSnapshot() {
  try {
    const res = await fetch(`${ICV_DATA_BASE}/dados.json`, { cache: "no-store" });
    if (!res.ok) return null;
    const payload = await res.json();
    const rows = normalizeRows(payload.dados || []);
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

async function carregarApi() {
  const sep = ICV_API_URL.includes("?") ? "&" : "?";
  const response = await fetch(`${ICV_API_URL}${sep}_=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status} na API ICV`);
  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload : (payload.dados || payload.data || payload.rows || []);
  return normalizeRows(rows);
}

async function carregarCsv() {
  const response = await fetch(`${ICV_CSV_URL}&_=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (/accounts\.google\.com|ServiceLogin|<html/i.test(text)) {
    throw new Error("Planilha ICV precisa estar publicada ou compartilhada para leitura.");
  }
  return normalizeRows(parseCsv(text));
}

async function loadDashboardData() {
  const snapshot = await carregarSnapshot();
  if (snapshot?.length) {
    rawData = snapshot;
    initFilters();
    renderDashboard();
  } else {
    window.portalMostrarCarregando?.("Carregando ICV...");
    document.getElementById("dashboardSubtitle").innerText = "Carregando dados...";
  }

  try {
    let novos = [];
    try {
      novos = await carregarApi();
    } catch (apiError) {
      console.warn("API ICV:", apiError);
      novos = await carregarCsv();
    }
    if (novos.length) {
      rawData = novos;
      initFilters();
      renderDashboard();
    } else if (!snapshot?.length) {
      rawData = [];
      document.getElementById("dashboardSubtitle").innerText = "Sem dados ICV disponíveis";
      initFilters();
      renderDashboard();
    }
  } catch (error) {
    console.error(error);
    if (!snapshot?.length) {
      document.getElementById("dashboardSubtitle").innerText = `Erro: ${error.message}`;
      initFilters();
      renderDashboard();
    }
  } finally {
    window.portalOcultarCarregando?.();
  }
}

window.updateFilters = updateFilters;

export function iniciarIcvDashboard() {
  if (typeof Chart !== "undefined" && typeof ChartDataLabels !== "undefined") {
    Chart.register(ChartDataLabels);
  }
  loadDashboardData();
}
