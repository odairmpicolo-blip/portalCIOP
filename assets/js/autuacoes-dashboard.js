const API_URL = "https://script.google.com/macros/s/AKfycbylz8scwboPQLeOKWUpw9YqKxomjts1aa8KUwodAuq5IE3T9s7RXd6GJcfMnS9qu6DI/exec";
let DATA = [];
let monthChart = null;
let agentChart = null;

const COLORS = ["#1359c7", "#28a64a", "#ff6b00", "#7045b8", "#de1b1b", "#f6bf26", "#00a6a6", "#7a8b99", "#9b59b6", "#2c3e50", "#e67e22", "#16a085"];

function byId(id) { return document.getElementById(id); }

function pickValue(row, keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
        if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
    }
    return "";
}

function normalizarCabecalho(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function indicePorCabecalho(headers, candidatos) {
    const mapa = headers.map(normalizarCabecalho);
    for (const nome of candidatos) {
        const idx = mapa.indexOf(normalizarCabecalho(nome));
        if (idx >= 0) return idx;
    }
    return -1;
}

function parseNumero(valor) {
    if (valor === null || valor === undefined || valor === "") return 0;
    if (typeof valor === "number" && Number.isFinite(valor)) return valor;
    let texto = String(valor).trim();
    if (!texto || texto === "-") return 0;
    texto = texto.replace(/R\$\s?/gi, "").replace(/\s/g, "");
    if (texto.includes(",") && texto.includes(".")) {
        texto = texto.replace(/\./g, "").replace(",", ".");
    } else if (texto.includes(",")) {
        texto = texto.replace(",", ".");
    }
    const n = Number(texto);
    return Number.isFinite(n) ? n : 0;
}

function parseDateValue(value) {
    if (!value) return { iso: "", br: "" };
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, "0");
        const d = String(value.getDate()).padStart(2, "0");
        return { iso: `${y}-${m}-${d}`, br: `${d}/${m}/${y}` };
    }
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
        const iso = text.slice(0, 10);
        return { iso, br: iso.split("-").reverse().join("/") };
    }
    const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (br) {
        const day = br[1].padStart(2, "0");
        const month = br[2].padStart(2, "0");
        const year = br[3].length === 2 ? `20${br[3]}` : br[3];
        return { iso: `${year}-${month}-${day}`, br: `${day}/${month}/${year}` };
    }
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, "0");
        const d = String(parsed.getDate()).padStart(2, "0");
        return { iso: `${y}-${m}-${d}`, br: `${d}/${m}/${y}` };
    }
    return { iso: "", br: text };
}

function normalizeRows(payload) {
    let rows = Array.isArray(payload) ? payload : (payload.data || payload.dados || payload.rows || payload.valores || []);
    if (Array.isArray(rows) && Array.isArray(rows[0])) {
        const headers = rows[0].map((h) => String(h).trim());
        rows = rows.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i]])));
    }
    return rows.map((row, index) => {
        let date = parseDateValue(pickValue(row, ["data_iso", "DATA_ISO", "Data ISO", "date", "data", "DATA", "Data"]));
        if (!date.iso) date = parseDateValue(pickValue(row, ["data_br", "DATA_BR", "Data BR"]));
        const dataBr = date.br || pickValue(row, ["data_br", "DATA_BR", "Data BR"]);
        const valorTarifas = parseNumero(pickValue(row, ["valor_tarifas", "valorTarifas", "tarifas", "Valor do auto em tarifas", "valor do auto em tarifas", "TARIFAS"]));
        const valorReais = parseNumero(pickValue(row, ["valor_reais", "valorReais", "valor em R$", "Valor em R$", "VALOR R$", "valor_r$"]));
        return {
            ordem: pickValue(row, ["ordem", "Ordem", "ORDEM"]) || index + 1,
            data_iso: date.iso,
            data_br: dataBr,
            notificacao: pickValue(row, ["notificacao", "Notificação", "Notificacao", "NOTIFICAÇÃO", "NOTIFICACAO", "Notificação Nº", "Notificacao Nº"]),
            auto: String(pickValue(row, ["auto", "Auto", "AUTO", "Auto de Infração Nº", "Auto de Infracao Nº"]) || ""),
            motivo: pickValue(row, ["motivo", "Motivo", "MOTIVO"]),
            agente: pickValue(row, ["agente", "Agente", "AGENTE"]),
            grupo: pickValue(row, ["grupo", "Grupo", "GRUPO"]),
            artigo: pickValue(row, ["artigo", "Artigo", "ARTIGO"]),
            valor_tarifas: valorTarifas,
            valor_reais: valorReais
        };
    }).filter((d) => d.data_iso || d.data_br || d.notificacao || d.auto || d.motivo || d.agente);
}

function formatInt(n) { return Number(n || 0).toLocaleString("pt-BR"); }

function formatMoeda(n) {
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatTarifas(n) {
    const v = Number(n || 0);
    if (!v) return "0";
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}

function montarUrlSemCache(url) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}atualizado=${Date.now()}`;
}

function uniqueSorted(key) {
    return [...new Set(DATA.map((d) => d[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function fillSelect(id, values) {
    const sel = byId(id);
    values.forEach((v) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v;
        sel.appendChild(o);
    });
}

function getFiltered() {
    const di = byId("dataInicio").value;
    const df = byId("dataFim").value;
    const motivo = byId("motivoFilter").value;
    const agente = byId("agenteFilter").value;
    const busca = byId("busca").value.toLowerCase().trim();
    return DATA.filter((d) => {
        if (di && d.data_iso && d.data_iso < di) return false;
        if (df && d.data_iso && d.data_iso > df) return false;
        if (motivo && d.motivo !== motivo) return false;
        if (agente && d.agente !== agente) return false;
        if (busca) {
            const s = [
                d.notificacao, d.auto, d.motivo, d.agente, d.data_br, d.grupo, d.artigo
            ].join(" ").toLowerCase();
            if (!s.includes(busca)) return false;
        }
        return true;
    });
}

function groupSum(rows, key) {
    const m = new Map();
    rows.forEach((d) => {
        const k = d[key] || "Não informado";
        m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
}

function somaCampo(rows, key) {
    return rows.reduce((acc, row) => acc + Number(row[key] || 0), 0);
}

function labelMes(iso) {
    if (!iso || iso.length < 7) return "Sem data";
    const [y, m] = iso.split("-");
    const dt = new Date(Number(y), Number(m) - 1, 1);
    return dt.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

function agruparPorMes(rows) {
    const mapa = new Map();
    rows.forEach((row) => {
        const chave = row.data_iso ? row.data_iso.slice(0, 7) : "0000-00";
        if (!mapa.has(chave)) mapa.set(chave, { mes: chave, total: 0, valor: 0 });
        const item = mapa.get(chave);
        item.total += 1;
        item.valor += Number(row.valor_reais || 0);
    });
    return [...mapa.values()]
        .filter((item) => item.mes !== "0000-00")
        .sort((a, b) => a.mes.localeCompare(b.mes));
}

function hexToRgb(hex) {
    const h = String(hex || "").replace("#", "");
    if (h.length !== 6) return { r: 19, g: 89, b: 199 };
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function rgbaHex(hex, alpha) {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

function gradienteColunas(chart, corBase) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return corBase;
    const g = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    g.addColorStop(0, rgbaHex(corBase, 0.35));
    g.addColorStop(0.55, rgbaHex(corBase, 0.72));
    g.addColorStop(1, corBase);
    return g;
}

function destruirGraficos() {
    if (monthChart) { monthChart.destroy(); monthChart = null; }
    if (agentChart) { agentChart.destroy(); agentChart = null; }
}

function desenharGraficoMes(rows) {
    const canvas = byId("monthChart");
    const empty = byId("monthChartEmpty");
    if (!canvas || typeof Chart === "undefined") return;
    const dados = agruparPorMes(rows);
    if (!dados.length) {
        empty.hidden = false;
        canvas.style.display = "none";
        if (monthChart) { monthChart.destroy(); monthChart = null; }
        return;
    }
    empty.hidden = true;
    canvas.style.display = "block";
    const labels = dados.map((d) => labelMes(d.mes));
    const valores = dados.map((d) => d.valor);
    const cor = "#ff6b00";
    if (monthChart) monthChart.destroy();
    monthChart = new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Total R$",
                data: valores,
                backgroundColor(ctx) { return gradienteColunas(ctx.chart, cor); },
                borderRadius: 10,
                maxBarThickness: 42
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label(ctx) { return formatMoeda(ctx.raw); }
                    }
                },
                datalabels: {
                    anchor: "end",
                    align: "top",
                    color: "#071f57",
                    font: { weight: "800", size: 10 },
                    formatter(value) { return value > 0 ? formatMoeda(value).replace(/\s/g, "") : ""; }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { weight: "700", size: 10 } } },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback(value) { return formatMoeda(value).replace(/\s/g, ""); },
                        font: { size: 10 }
                    }
                }
            }
        },
        plugins: typeof ChartDataLabels !== "undefined" ? [ChartDataLabels] : []
    });
}

function desenharGraficoAgentes(rows) {
    const canvas = byId("agentChart");
    const empty = byId("agentChartEmpty");
    if (!canvas || typeof Chart === "undefined") return;
    const agentes = groupSum(rows, "agente").slice(0, 12);
    if (!agentes.length) {
        empty.hidden = false;
        canvas.style.display = "none";
        if (agentChart) { agentChart.destroy(); agentChart = null; }
        return;
    }
    empty.hidden = true;
    canvas.style.display = "block";
    const labels = agentes.map(([nome]) => nome.split(" ").slice(0, 2).join(" "));
    const valores = agentes.map(([, qtd]) => qtd);
    const cor = "#1359c7";
    if (agentChart) agentChart.destroy();
    agentChart = new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Autuações",
                data: valores,
                backgroundColor(ctx) { return gradienteColunas(ctx.chart, cor); },
                borderRadius: 10,
                maxBarThickness: 46
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title(items) { return agentes[items[0].dataIndex]?.[0] || ""; },
                        label(ctx) { return `${formatInt(ctx.raw)} autuação(ões)`; }
                    }
                },
                datalabels: {
                    anchor: "end",
                    align: "top",
                    color: "#071f57",
                    font: { weight: "900", size: 11 },
                    formatter(value) { return formatInt(value); }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { weight: "700", size: 10 }, maxRotation: 45, minRotation: 0 } },
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } }
            }
        },
        plugins: typeof ChartDataLabels !== "undefined" ? [ChartDataLabels] : []
    });
}

function drawPie(items, total) {
    const canvas = byId("pieChart");
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = 62;
    ctx.clearRect(0, 0, w, h);
    if (!total) {
        ctx.fillStyle = "#667085";
        ctx.textAlign = "center";
        ctx.fillText("Sem dados", cx, cy);
        byId("legend").innerHTML = "";
        return;
    }
    let start = -Math.PI / 2;
    items.forEach(([name, val], i) => {
        const ang = (val / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, start + ang);
        ctx.closePath();
        ctx.fillStyle = COLORS[i % COLORS.length];
        ctx.fill();
        start += ang;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.fillStyle = "#071f57";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("100%", cx, cy);
    byId("legend").innerHTML = items.map(([name, val], i) =>
        `<div class="legend-row"><span class="dot" style="background:${COLORS[i % COLORS.length]}"></span><span>${escapeHtml(name)}</span><b>${((val / total) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</b></div>`
    ).join("");
}

function renderTable(rows) {
    const htmlRows = rows.map((d) =>
        `<tr>
            <td>${d.ordem}</td>
            <td>${escapeHtml(d.data_br)}</td>
            <td>${escapeHtml(d.notificacao)}</td>
            <td>${escapeHtml(d.auto)}</td>
            <td class="left">${escapeHtml(d.grupo)}</td>
            <td class="left">${escapeHtml(d.artigo)}</td>
            <td class="left">${escapeHtml(d.motivo)}</td>
            <td class="left">${escapeHtml(d.agente)}</td>
            <td>${formatTarifas(d.valor_tarifas)}</td>
            <td class="money">${formatMoeda(d.valor_reais)}</td>
        </tr>`
    ).join("");
    byId("tableBody").innerHTML = htmlRows ||
        '<tr><td colspan="10" class="no-data">Sem dados para os filtros selecionados.</td></tr>';
}

function render() {
    const rows = getFiltered();
    const total = rows.length;
    const ag = groupSum(rows, "agente");
    const mot = groupSum(rows, "motivo");
    const totalReais = somaCampo(rows, "valor_reais");
    const totalTarifas = somaCampo(rows, "valor_tarifas");
    const ticketMedio = total ? totalReais / total : 0;

    byId("totalAutuacoes").textContent = formatInt(total);
    byId("totalGastoReais").textContent = formatMoeda(totalReais);
    byId("totalTarifas").textContent = formatTarifas(totalTarifas);
    byId("ticketMedioReais").textContent = formatMoeda(ticketMedio);
    byId("totalAgentes").textContent = formatInt(ag.length);
    byId("totalMotivos").textContent = formatInt(mot.length);
    byId("topMotivoValor").textContent = mot[0] ? formatInt(mot[0][1]) : "0";
    byId("topMotivoNome").textContent = mot[0] ? mot[0][0] : "Sem dados";
    byId("topAgenteValor").textContent = ag[0] ? formatInt(ag[0][1]) : "0";
    byId("topAgenteNome").textContent = ag[0] ? ag[0][0] : "Sem dados";

    renderTable(rows);
    drawPie(mot, total);
    desenharGraficoMes(rows);
    desenharGraficoAgentes(rows);
}

function init() {
    byId("motivoFilter").innerHTML = '<option value="">Todos os motivos</option>';
    byId("agenteFilter").innerHTML = '<option value="">Todos os agentes</option>';
    fillSelect("motivoFilter", uniqueSorted("motivo"));
    fillSelect("agenteFilter", uniqueSorted("agente"));
    const dates = DATA.map((d) => d.data_iso).filter(Boolean).sort();
    if (dates.length) {
        byId("dataInicio").value = dates[0];
        byId("dataFim").value = dates[dates.length - 1];
    }
    ["dataInicio", "dataFim", "motivoFilter", "agenteFilter", "busca"].forEach((id) => {
        byId(id).addEventListener("input", render);
    });
    render();
}

async function loadData() {
    window.portalMostrarCarregando?.("Carregando autuações");
    if (!API_URL) {
        init();
        window.portalOcultarCarregando?.();
        return;
    }
    try {
        const response = await fetch(montarUrlSemCache(API_URL), { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (payload.status === "error") throw new Error(payload.message || "Erro na API");
        DATA = normalizeRows(payload);
    } catch (error) {
        console.error("Erro ao carregar dados do Google Sheets:", error);
    }
    init();
    window.portalOcultarCarregando?.();
}

function limparFiltros() {
    const dates = DATA.map((d) => d.data_iso).filter(Boolean).sort();
    byId("dataInicio").value = dates[0] || "";
    byId("dataFim").value = dates[dates.length - 1] || "";
    byId("motivoFilter").value = "";
    byId("agenteFilter").value = "";
    byId("busca").value = "";
    render();
}

window.limparFiltros = limparFiltros;
window.portalAguardarUsuario?.(loadData);
