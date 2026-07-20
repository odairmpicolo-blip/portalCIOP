const API_URL = "https://script.google.com/macros/s/AKfycbylz8scwboPQLeOKWUpw9YqKxomjts1aa8KUwodAuq5IE3T9s7RXd6GJcfMnS9qu6DI/exec";
const AUTUACOES_DATA_BASE = "../assets/data/autuacoes";
const AUTUACOES_MANIFEST_URL = AUTUACOES_DATA_BASE + "/manifest.json";
const AUTUACOES_SNAPSHOT_URL = AUTUACOES_DATA_BASE + "/dados.json";
const AUTUACOES_DATA_INICIO = "2015-01-01";
const SYNC_DIAS_RECENTES = 14;
const CACHE_STORAGE_KEY = "portal_autuacoes_dashboard_v2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let DATA = [];
let periodChart = null;
let agentChart = null;
let sortState = { key: "data_iso", dir: "desc" };

const COLORS = ["#00d4ff", "#1359c7", "#ff6b00", "#7045b8", "#28a64a", "#f6bf26", "#00a6a6", "#de1b1b", "#9b59b6", "#16a085", "#e67e22", "#4d7cff"];

function isDarkTheme() {
    return document.documentElement.classList.contains("dk-dark")
        || (window.innerWidth <= 720 && !document.documentElement.classList.contains("native-light"));
}

function chartTheme() {
    if (isDarkTheme()) {
        return {
            navy: "#e8edf2",
            muted: "#ffffff",
            cyan: "#00d4ff",
            blue: "#38bdf8",
            orange: "#ff6b00",
            grid: "rgba(255,255,255,.12)",
            tooltipBg: "rgba(20,20,24,.94)",
            tooltipBorder: "rgba(0,212,255,.35)"
        };
    }
    return {
        navy: "#071f57",
        muted: "#667085",
        cyan: "#00d4ff",
        blue: "#1359c7",
        orange: "#ff6b00",
        grid: "rgba(6,36,92,.06)",
        tooltipBg: "rgba(7,31,87,.94)",
        tooltipBorder: "rgba(0,212,255,.35)"
    };
}

let CHART_THEME = chartTheme();

function refreshChartTheme() {
    CHART_THEME = chartTheme();
    if (typeof Chart !== "undefined") {
        Chart.defaults.color = CHART_THEME.muted;
        Chart._autuacoesTheme = false;
    }
}

function tooltipFuturo() {
    return {
        backgroundColor: CHART_THEME.tooltipBg,
        titleColor: "#fff",
        bodyColor: "#e2e8f0",
        borderColor: CHART_THEME.tooltipBorder,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        displayColors: false,
        titleFont: { weight: "700", size: 12 },
        bodyFont: { weight: "600", size: 11 }
    };
}

const ANIMACAO_FUTURO = { duration: 900, easing: "easeOutQuart" };

function fonteGrafico(peso, tamanho) {
    return { family: "'Segoe UI', system-ui, Arial, sans-serif", weight: peso, size: tamanho };
}

function configurarChartDefaults() {
    refreshChartTheme();
    if (typeof Chart === "undefined" || Chart._autuacoesTheme) return;
    Chart.defaults.font.family = "'Segoe UI', system-ui, Arial, sans-serif";
    Chart.defaults.color = CHART_THEME.muted;
    Chart._autuacoesTheme = true;
}

function escalaLinearFuturo(eixo = "y") {
    return {
        beginAtZero: true,
        border: { display: false },
        grid: {
            color: CHART_THEME.grid,
            drawTicks: false,
            ...(eixo === "x" ? {} : { lineWidth: 1 })
        },
        ticks: {
            color: CHART_THEME.muted,
            font: fonteGrafico("600", 10),
            padding: 6
        }
    };
}

function gradienteNeonVertical(chart, corInicio, corFim) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return corInicio;
    const g = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    g.addColorStop(0, rgbaHex(corInicio, 0.25));
    g.addColorStop(0.45, rgbaHex(corInicio, 0.75));
    g.addColorStop(1, corFim);
    return g;
}

function gradienteNeonHorizontal(chart, idx, total) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return CHART_THEME.blue;
    const t = total > 1 ? idx / (total - 1) : 0;
    const corA = `hsl(${210 + t * 40}, 88%, 52%)`;
    const corB = `hsl(${195 + t * 30}, 95%, 62%)`;
    const g = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
    g.addColorStop(0, rgbaHex(CHART_THEME.navy, 0.55));
    g.addColorStop(0.35, corA);
    g.addColorStop(1, corB);
    return g;
}

function arredondarRetangulo(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, w, h, r);
        return;
    }
    ctx.rect(x, y, w, h);
}

const pluginTrilhaBarras = {
    id: "trilhaBarras",
    beforeDatasetsDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        if (!meta?.data?.length || chart.config.options.indexAxis !== "y") return;
        const { ctx, chartArea } = chart;
        ctx.save();
        meta.data.forEach((bar) => {
            const h = Math.abs(bar.height || 0);
            const y = bar.y - h / 2;
            ctx.fillStyle = "rgba(6,36,92,.05)";
            ctx.beginPath();
            arredondarRetangulo(ctx, chartArea.left, y, chartArea.right - chartArea.left, h, 6);
            ctx.fill();
        });
        ctx.restore();
    }
};

const pluginBrilhoBarras = {
    id: "brilhoBarras",
    afterDatasetsDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        if (!meta?.data?.length) return;
        const { ctx } = chart;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        meta.data.forEach((bar) => {
            const isHorizontal = chart.config.options.indexAxis === "y";
            if (isHorizontal) {
                const left = Math.min(bar.x, bar.base);
                const w = Math.abs(bar.x - bar.base);
                const h = Math.abs(bar.height || 0);
                if (w < 8) return;
                ctx.fillStyle = "rgba(255,255,255,.18)";
                ctx.beginPath();
                arredondarRetangulo(ctx, left + 2, bar.y - h / 2 + 2, Math.max(w - 4, 0), Math.max(h * 0.35, 2), 4);
                ctx.fill();
            } else {
                const top = Math.min(bar.y, bar.base);
                const h = Math.abs(bar.y - bar.base);
                const w = Math.abs(bar.width || 0);
                if (h < 8) return;
                ctx.fillStyle = "rgba(255,255,255,.2)";
                ctx.beginPath();
                arredondarRetangulo(ctx, bar.x - w / 2 + 2, top + 2, Math.max(w - 4, 0), Math.max(h * 0.25, 2), 4);
                ctx.fill();
            }
        });
        ctx.restore();
    }
};

function truncarTexto(ctx, texto, maxWidth) {
    const t = String(texto || "");
    if (!maxWidth || maxWidth <= 0 || ctx.measureText(t).width <= maxWidth) return t;
    let curto = t;
    while (curto.length > 3 && ctx.measureText(`${curto}…`).width > maxWidth) curto = curto.slice(0, -1);
    return `${curto}…`;
}

const pluginNomeAgenteNaBarra = {
    id: "nomeAgenteNaBarra",
    afterDatasetsDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        if (!meta?.data?.length) return;
        const { ctx, data } = chart;
        ctx.save();
        ctx.font = "700 10px 'Segoe UI', system-ui, Arial, sans-serif";
        ctx.textBaseline = "middle";
        meta.data.forEach((bar, i) => {
            const label = String(data.labels[i] || "");
            if (!label) return;
            const barLeft = Math.min(bar.x, bar.base);
            const barRight = Math.max(bar.x, bar.base);
            const barWidth = Math.max(barRight - barLeft, 0);
            const pad = 10;
            const texto = truncarTexto(ctx, label, Math.max(barWidth - pad * 2 - 28, 0));
            ctx.textAlign = "left";
            ctx.shadowColor = "rgba(7,31,87,.45)";
            ctx.shadowBlur = 4;
            ctx.fillStyle = "#fff";
            ctx.fillText(texto, barLeft + pad, bar.y);
        });
        ctx.restore();
    }
};

function pluginsChartJs() {
    const list = [];
    if (typeof ChartDataLabels !== "undefined") list.push(ChartDataLabels);
    list.push(pluginTrilhaBarras, pluginBrilhoBarras);
    return list;
}

const TABLE_COLUMNS = [
    { key: "ordem", label: "Ordem", type: "number" },
    { key: "data_iso", label: "Data", type: "date", display: "data_br" },
    { key: "notificacao", label: "Notificação Nº", type: "text" },
    { key: "auto", label: "Auto Nº", type: "text" },
    { key: "grupo", label: "Grupo", type: "text" },
    { key: "artigo", label: "Artigo", type: "text" },
    { key: "motivo", label: "Motivo", type: "text" },
    { key: "agente", label: "Agente", type: "text" },
    { key: "valor_tarifas", label: "Tarifas", type: "number" },
    { key: "valor_reais", label: "Valor R$", type: "number", money: true }
];

function byId(id) { return document.getElementById(id); }

function pickValue(row, keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
        if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
    }
    return "";
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
        return {
            ordem: Number(pickValue(row, ["ordem", "Ordem", "ORDEM"]) || index + 1),
            data_iso: date.iso,
            data_br: dataBr,
            notificacao: pickValue(row, ["notificacao", "Notificação", "Notificacao", "NOTIFICAÇÃO", "NOTIFICACAO", "Notificação Nº", "Notificacao Nº"]),
            auto: String(pickValue(row, ["auto", "Auto", "AUTO", "Auto de Infração Nº", "Auto de Infracao Nº"]) || ""),
            motivo: pickValue(row, ["motivo", "Motivo", "MOTIVO"]),
            agente: pickValue(row, ["agente", "Agente", "AGENTE"]),
            grupo: pickValue(row, ["grupo", "Grupo", "GRUPO"]),
            artigo: pickValue(row, ["artigo", "Artigo", "ARTIGO"]),
            valor_tarifas: parseNumero(pickValue(row, ["valor_tarifas", "valorTarifas", "tarifas", "Valor do auto em tarifas", "valor do auto em tarifas", "TARIFAS"])),
            valor_reais: parseNumero(pickValue(row, ["valor_reais", "valorReais", "valor em R$", "Valor em R$", "VALOR R$", "valor_r$"]))
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
    return url + sep + "_=" + Date.now();
}

function isoHojeAutuacoes() {
    return new Date().toISOString().slice(0, 10);
}

function montarUrlAutuacoes(params) {
    const sep = API_URL.includes("?") ? "&" : "?";
    const qs = new URLSearchParams(Object.assign({
        data_de: AUTUACOES_DATA_INICIO,
        data_ate: isoHojeAutuacoes(),
        completo: "1"
    }, params || {}));
    return API_URL + sep + qs.toString() + "&_=" + Date.now();
}

function lerCacheAutuacoesLocal() {
    try {
        const raw = localStorage.getItem(CACHE_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.payload || !parsed?.ts) return null;
        if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
        return parsed.payload;
    } catch (_) {
        return null;
    }
}

function salvarCacheAutuacoesLocal(payload) {
    try {
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify({ ts: Date.now(), payload }));
    } catch (_) {}
}

function chaveRegistroAutuacao(row) {
    return [
        row?.data_iso || row?.data_br || "",
        row?.notificacao || "",
        row?.auto || "",
        row?.ordem || ""
    ].join("|");
}

function mesclarAutuacoes(base, novos) {
    const mapa = new Map();
    (base || []).forEach((row) => mapa.set(chaveRegistroAutuacao(row), row));
    (novos || []).forEach((row) => mapa.set(chaveRegistroAutuacao(row), row));
    return [...mapa.values()];
}

function isoDiasAtrasAutuacoes(dias) {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return d.toISOString().slice(0, 10);
}

async function carregarSnapshotAutuacoes() {
    try {
        const res = await fetch(AUTUACOES_SNAPSHOT_URL, { cache: "no-store" });
        if (!res.ok) return null;
        const payload = await res.json();
        const rows = normalizeRows(payload);
        if (!rows.length) return null;
        return { payload, rows };
    } catch (_) {
        return null;
    }
}

async function sincronizarAutuacoesRecentes() {
    const dataDe = isoDiasAtrasAutuacoes(SYNC_DIAS_RECENTES);
    const dataAte = isoDiasAtrasAutuacoes(0);
    const response = await fetch(montarUrlAutuacoes({ data_de: dataDe, data_ate: dataAte, completo: "0" }), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.status === "error") throw new Error(payload.message || "Erro na API");
    return normalizeRows(payload);
}

function aplicarPayloadAutuacoes(payload, origem) {
    DATA = normalizeRows(payload);
    init();
    if (origem) console.info("Autuações carregadas:", origem, DATA.length);
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

function intervaloDatasBase() {
    const dates = DATA.map((d) => d.data_iso).filter(Boolean).sort();
    return { inicio: dates[0] || "", fim: dates[dates.length - 1] || "" };
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
            const s = [d.notificacao, d.auto, d.motivo, d.agente, d.data_br, d.grupo, d.artigo].join(" ").toLowerCase();
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

function somaReaisPorAgente(rows, agente) {
    if (!agente) return 0;
    return rows.reduce((acc, row) => acc + (row.agente === agente ? Number(row.valor_reais || 0) : 0), 0);
}

function nivelAgrupamentoTemporal() {
    const base = intervaloDatasBase();
    const inicio = byId("dataInicio").value || base.inicio;
    const fim = byId("dataFim").value || base.fim;
    const filtroPadrao = base.inicio && base.fim && inicio === base.inicio && fim === base.fim;

    if (filtroPadrao) {
        return { nivel: "year", titulo: "Autuações ano a ano" };
    }
    if (inicio.slice(0, 7) === fim.slice(0, 7)) {
        return { nivel: "day", titulo: "Autuações dia a dia" };
    }
    if (inicio.slice(0, 4) === fim.slice(0, 4)) {
        return { nivel: "month", titulo: "Autuações mês a mês" };
    }
    return { nivel: "year", titulo: "Autuações ano a ano" };
}

function chavePeriodo(dataIso, nivel) {
    if (!dataIso) return "";
    if (nivel === "year") return dataIso.slice(0, 4);
    if (nivel === "month") return dataIso.slice(0, 7);
    return dataIso;
}

function labelPeriodo(chave, nivel) {
    if (!chave) return "Sem data";
    if (nivel === "year") return chave;
    if (nivel === "month") {
        const [y, m] = chave.split("-");
        const dt = new Date(Number(y), Number(m) - 1, 1);
        return dt.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
    }
    const [y, m, d] = chave.split("-");
    return `${d}/${m}/${y.slice(2)}`;
}

function agruparPorPeriodo(rows, nivel) {
    const mapa = new Map();
    rows.forEach((row) => {
        const chave = chavePeriodo(row.data_iso, nivel);
        if (!chave) return;
        mapa.set(chave, (mapa.get(chave) || 0) + 1);
    });
    return [...mapa.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([chave, total]) => ({ chave, total }));
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

function escurecerHex(hex, fator = 0.3) {
    const c = hexToRgb(hex);
    return `rgb(${Math.round(c.r * (1 - fator))},${Math.round(c.g * (1 - fator))},${Math.round(c.b * (1 - fator))})`;
}

function clarearHex(hex, fator = 0.22) {
    const c = hexToRgb(hex);
    return `rgb(${Math.min(255, Math.round(c.r + (255 - c.r) * fator))},${Math.min(255, Math.round(c.g + (255 - c.g) * fator))},${Math.min(255, Math.round(c.b + (255 - c.b) * fator))})`;
}

function nomeAgenteCurto(nome) {
    const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (partes.length <= 2) return partes.join(" ");
    return `${partes[0]} ${partes[partes.length - 1]}`;
}

function atualizarRotulosAno(dados, cfg) {
    const el = byId("periodChartYears");
    if (!el) return;
    if (cfg.nivel === "year" && dados.length) {
        el.hidden = false;
        el.innerHTML = dados.map((d) =>
            `<span class="year-chip">${escapeHtml(labelPeriodo(d.chave, cfg.nivel))}</span>`
        ).join("");
    } else {
        el.hidden = true;
        el.innerHTML = "";
    }
}

function desenharGraficoPeriodo(rows) {
    const canvas = byId("periodChart");
    const empty = byId("periodChartEmpty");
    const titulo = byId("periodChartTitle");
    if (!canvas || typeof Chart === "undefined") return;
    configurarChartDefaults();

    const cfg = nivelAgrupamentoTemporal();
    if (titulo) titulo.textContent = cfg.titulo;

    const dados = agruparPorPeriodo(rows, cfg.nivel);
    atualizarRotulosAno(dados, cfg);

    if (!dados.length) {
        empty.hidden = false;
        canvas.style.display = "none";
        if (periodChart) { periodChart.destroy(); periodChart = null; }
        return;
    }

    empty.hidden = true;
    canvas.style.display = "block";
    const labels = dados.map((d) => labelPeriodo(d.chave, cfg.nivel));
    const valores = dados.map((d) => d.total);
    const eAno = cfg.nivel === "year";

    if (periodChart) periodChart.destroy();
    periodChart = new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Autuações",
                data: valores,
                backgroundColor(ctx) { return gradienteNeonVertical(ctx.chart, CHART_THEME.orange, "#ffb347"); },
                borderRadius: { topLeft: 10, topRight: 10, bottomLeft: 4, bottomRight: 4 },
                borderSkipped: false,
                maxBarThickness: 48
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: ANIMACAO_FUTURO,
            layout: { padding: { top: eAno ? 10 : 32, left: 4, right: 8 } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...tooltipFuturo(),
                    callbacks: {
                        title(items) { return items[0]?.label || ""; },
                        label(ctx) { return `${formatInt(ctx.raw)} autuação(ões)`; }
                    }
                },
                datalabels: {
                    anchor: "end",
                    align: "top",
                    offset: 4,
                    color: CHART_THEME.navy,
                    font: fonteGrafico("800", 11),
                    formatter(value) { return formatInt(value); }
                }
            },
            scales: {
                x: {
                    ...escalaLinearFuturo("x"),
                    display: !eAno,
                    grid: { display: false },
                    ticks: { ...escalaLinearFuturo("x").ticks, font: fonteGrafico("700", 10), color: CHART_THEME.navy }
                },
                y: escalaLinearFuturo("y")
            }
        },
        plugins: pluginsChartJs()
    });
}

function desenharGraficoAgentes(rows) {
    const canvas = byId("agentChart");
    const empty = byId("agentChartEmpty");
    if (!canvas || typeof Chart === "undefined") return;
    configurarChartDefaults();

    const agentes = groupSum(rows, "agente").slice(0, 10);
    if (!agentes.length) {
        empty.hidden = false;
        canvas.style.display = "none";
        if (agentChart) { agentChart.destroy(); agentChart = null; }
        return;
    }

    empty.hidden = true;
    canvas.style.display = "block";
    const labels = agentes.map(([nome]) => nomeAgenteCurto(nome));
    const valores = agentes.map(([, qtd]) => qtd);
    const totalAgentes = labels.length;

    if (agentChart) agentChart.destroy();
    agentChart = new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Autuações",
                data: valores,
                backgroundColor(ctx) { return gradienteNeonHorizontal(ctx.chart, ctx.dataIndex, totalAgentes); },
                borderRadius: { topRight: 10, bottomRight: 10, topLeft: 4, bottomLeft: 4 },
                borderSkipped: false,
                barThickness: 20
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            animation: ANIMACAO_FUTURO,
            layout: { padding: { top: 4, right: 48, left: 4, bottom: 4 } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...tooltipFuturo(),
                    callbacks: {
                        title(items) { return agentes[items[0].dataIndex]?.[0] || ""; },
                        label(ctx) { return `${formatInt(ctx.raw)} autuação(ões)`; }
                    }
                },
                datalabels: {
                    anchor: "end",
                    align: "end",
                    offset: 6,
                    color: CHART_THEME.navy,
                    backgroundColor: "rgba(255,255,255,.88)",
                    borderRadius: 6,
                    padding: { top: 3, bottom: 3, left: 6, right: 6 },
                    font: fonteGrafico("800", 10),
                    formatter(value) { return formatInt(value); }
                }
            },
            scales: {
                x: {
                    ...escalaLinearFuturo("x"),
                    ticks: { ...escalaLinearFuturo("x").ticks, stepSize: 1 }
                },
                y: {
                    ...escalaLinearFuturo("y"),
                    grid: { display: false },
                    ticks: { display: false }
                }
            }
        },
        plugins: [...pluginsChartJs(), pluginNomeAgenteNaBarra]
    });
}

let pieResizeObserver = null;
const PIE_TILT = 0.62;

function prepararCanvasPie(canvas) {
    const wrap = canvas?.parentElement;
    const max = 172;
    const wrapW = wrap ? wrap.clientWidth : max;
    const size = Math.min(Math.max(Math.floor(wrapW) || max, 108), max);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, size };
}

function observarResizePie() {
    const wrap = byId("pieChart")?.parentElement;
    if (!wrap || pieResizeObserver || typeof ResizeObserver === "undefined") return;
    let timer = null;
    pieResizeObserver = new ResizeObserver(() => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            const rows = getFiltered();
            drawPie(groupSum(rows, "motivo"), rows.length);
        }, 120);
    });
    pieResizeObserver.observe(wrap);
}

function arcoDonut(ctx, cx, cy, rOut, rIn, a0, a1) {
    ctx.beginPath();
    ctx.arc(cx, cy, rOut, a0, a1);
    ctx.arc(cx, cy, rIn, a1, a0, true);
    ctx.closePath();
}

function gradienteSegmento3D(ctx, cx, cy, cor, a0, a1, rIn, rOut) {
    const mid = (a0 + a1) / 2;
    const gx = cx + Math.cos(mid) * rOut * 0.75;
    const gy = cy + Math.sin(mid) * rOut * 0.75;
    const g = ctx.createRadialGradient(gx, gy, rIn * 0.4, cx, cy, rOut);
    g.addColorStop(0, clarearHex(cor, 0.28));
    g.addColorStop(0.5, cor);
    g.addColorStop(1, escurecerHex(cor, 0.32));
    return g;
}

function drawPie(items, total) {
    const canvas = byId("pieChart");
    if (!canvas) return;
    const { ctx, size } = prepararCanvasPie(canvas);
    const cx = size / 2;
    const cy = size / 2 - size * 0.02;
    const tilt = PIE_TILT;
    const depth = size * 0.065;
    const rOut = size * 0.36;
    const rIn = size * 0.22;
    const gap = 0.038;
    ctx.clearRect(0, 0, size, size);

    if (!total) {
        ctx.fillStyle = CHART_THEME.muted;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `700 ${Math.max(12, size * 0.08)}px 'Segoe UI', system-ui, Arial, sans-serif`;
        ctx.fillText("Sem dados", cx, cy);
        byId("legend").innerHTML = "";
        return;
    }

    ctx.save();
    const aura = ctx.createRadialGradient(cx, cy - size * 0.04, 0, cx, cy, rOut * 1.35);
    aura.addColorStop(0, "rgba(0,212,255,.12)");
    aura.addColorStop(0.55, "rgba(19,89,199,.06)");
    aura.addColorStop(1, "transparent");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.ellipse(cx, cy + depth, rOut * 1.1, rOut * 1.1 * tilt, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    let start = -Math.PI / 2;
    const slices = items.map(([name, val], i) => {
        const ang = (val / total) * Math.PI * 2;
        const slice = {
            name,
            val,
            a0: start + gap,
            a1: start + ang - gap,
            ang,
            cor: COLORS[i % COLORS.length]
        };
        start += ang;
        return slice;
    }).filter((s) => s.a1 > s.a0);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, tilt);
    ctx.translate(-cx, -cy);

    for (let layer = 5; layer >= 1; layer--) {
        const ly = (depth * layer) / tilt / 5;
        slices.forEach(({ a0, a1, cor }) => {
            ctx.save();
            ctx.translate(0, ly);
            arcoDonut(ctx, cx, cy, rOut, rIn, a0, a1);
            ctx.fillStyle = escurecerHex(cor, 0.12 + layer * 0.07);
            ctx.fill();
            ctx.restore();
        });
    }

    ctx.shadowColor = "rgba(0,212,255,.22)";
    ctx.shadowBlur = size * 0.04;
    slices.forEach(({ a0, a1, cor }) => {
        arcoDonut(ctx, cx, cy, rOut, rIn, a0, a1);
        ctx.fillStyle = gradienteSegmento3D(ctx, cx, cy, cor, a0, a1, rIn, rOut);
        ctx.fill();
        ctx.strokeStyle = rgbaHex(cor, 0.45);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, rOut - 1, a0 + 0.015, a1 - 0.015);
        ctx.strokeStyle = rgbaHex("#ffffff", 0.4);
        ctx.lineWidth = 1.2;
        ctx.stroke();
    });
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(cx, cy, rIn - 1.5, 0, Math.PI * 2);
    const hub = ctx.createRadialGradient(cx, cy - rIn * 0.35, 0, cx, cy, rIn);
    hub.addColorStop(0, "#ffffff");
    hub.addColorStop(0.65, "#eef6ff");
    hub.addColorStop(1, "#c7ddff");
    ctx.fillStyle = hub;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,212,255,.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = CHART_THEME.navy;
    ctx.font = `800 ${Math.max(15, size * 0.12)}px 'Segoe UI', system-ui, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,212,255,.35)";
    ctx.shadowBlur = 8;
    ctx.fillText(formatInt(total), cx, cy - size * 0.02);
    ctx.shadowBlur = 0;
    ctx.fillStyle = CHART_THEME.muted;
    ctx.font = `600 ${Math.max(9, size * 0.052)}px 'Segoe UI', system-ui, Arial, sans-serif`;
    ctx.fillText("autuações", cx, cy + size * 0.085);
    ctx.restore();

    byId("legend").innerHTML = items.slice(0, 10).map(([name, val], i) => {
        const pct = ((val / total) * 100);
        const cor = COLORS[i % COLORS.length];
        return `<div class="legend-row">
            <span class="dot" style="background:${cor}"></span>
            <span class="legend-name">${escapeHtml(name)}</span>
            <span class="legend-bar-wrap"><span class="legend-bar" style="width:${pct.toFixed(1)}%;background:linear-gradient(90deg,${cor},${rgbaHex(cor, 0.45)})"></span></span>
            <b>${pct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</b>
        </div>`;
    }).join("");
}

function sortIcon(key) {
    if (sortState.key !== key) return "↕";
    return sortState.dir === "asc" ? "↑" : "↓";
}

function renderTableHead() {
    const head = byId("tableHead");
    if (!head) return;
    head.innerHTML = `<tr>${TABLE_COLUMNS.map((col) =>
        `<th class="sortable" data-sort="${col.key}" scope="col">${escapeHtml(col.label)} <span class="sort-indicator">${sortIcon(col.key)}</span></th>`
    ).join("")}</tr>`;
    head.querySelectorAll("th.sortable").forEach((th) => {
        th.addEventListener("click", () => {
            const key = th.dataset.sort;
            if (sortState.key === key) {
                sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
            } else {
                sortState.key = key;
                sortState.dir = colDefaultDir(key);
            }
            render();
        });
    });
}

function colDefaultDir(key) {
    const col = TABLE_COLUMNS.find((c) => c.key === key);
    if (!col) return "asc";
    if (col.type === "number" || col.type === "date") return "desc";
    return "asc";
}

function compareRows(a, b, col) {
    const dir = sortState.dir === "asc" ? 1 : -1;
    let va = a[col.key];
    let vb = b[col.key];
    if (col.type === "number") {
        va = Number(va || 0);
        vb = Number(vb || 0);
        return (va - vb) * dir;
    }
    if (col.type === "date") {
        va = String(va || "");
        vb = String(vb || "");
        return va.localeCompare(vb) * dir;
    }
    va = String(va || "").toLocaleLowerCase("pt-BR");
    vb = String(vb || "").toLocaleLowerCase("pt-BR");
    return va.localeCompare(vb, "pt-BR") * dir;
}

function sortRows(rows) {
    const col = TABLE_COLUMNS.find((c) => c.key === sortState.key) || TABLE_COLUMNS[1];
    return [...rows].sort((a, b) => compareRows(a, b, col));
}

function renderTable(rows) {
    const sorted = sortRows(rows);
    const htmlRows = sorted.map((d) =>
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
        `<tr><td colspan="${TABLE_COLUMNS.length}" class="no-data">Sem dados para os filtros selecionados.</td></tr>`;

    byId("tableHead")?.querySelectorAll(".sort-indicator").forEach((el) => {
        const th = el.closest("th");
        if (th) el.textContent = sortIcon(th.dataset.sort);
    });
}

function render() {
    refreshChartTheme();
    const rows = getFiltered();
    const total = rows.length;
    const ag = groupSum(rows, "agente");
    const mot = groupSum(rows, "motivo");
    const totalReais = somaCampo(rows, "valor_reais");
    const totalTarifas = somaCampo(rows, "valor_tarifas");

    byId("totalAutuacoes").textContent = formatInt(total);
    byId("topAgenteValor").textContent = ag[0] ? formatInt(ag[0][1]) : "0";
    byId("topAgenteNome").textContent = ag[0] ? ag[0][0] : "Sem dados";
    byId("topAgenteReais").textContent = ag[0] ? formatMoeda(somaReaisPorAgente(rows, ag[0][0])) : formatMoeda(0);
    byId("topMotivoValor").textContent = mot[0] ? formatInt(mot[0][1]) : "0";
    byId("topMotivoNome").textContent = mot[0] ? mot[0][0] : "Sem dados";
    byId("totalTarifas").textContent = formatTarifas(totalTarifas);
    byId("totalGastoReais").textContent = formatMoeda(totalReais);

    renderTable(rows);
    drawPie(mot, total);
    desenharGraficoAgentes(rows);
    desenharGraficoPeriodo(rows);
}

function init() {
    byId("motivoFilter").innerHTML = '<option value="">Todos os motivos</option>';
    byId("agenteFilter").innerHTML = '<option value="">Todos os agentes</option>';
    fillSelect("motivoFilter", uniqueSorted("motivo"));
    fillSelect("agenteFilter", uniqueSorted("agente"));
    const dates = intervaloDatasBase();
    if (dates.inicio) byId("dataInicio").value = dates.inicio;
    if (dates.fim) byId("dataFim").value = dates.fim;
    renderTableHead();
    observarResizePie();
    ["dataInicio", "dataFim", "motivoFilter", "agenteFilter", "busca"].forEach((id) => {
        byId(id).addEventListener("input", render);
    });
    render();
}

async function loadData() {
    const cacheLocal = lerCacheAutuacoesLocal();
    let mostrouDados = false;

    const snapshot = await carregarSnapshotAutuacoes();
    if (snapshot?.rows?.length) {
        DATA = snapshot.rows;
        init();
        salvarCacheAutuacoesLocal(snapshot.payload);
        console.info("Autuações carregadas: arquivo JSON", DATA.length);
        mostrouDados = true;
    } else if (cacheLocal) {
        aplicarPayloadAutuacoes(cacheLocal, "cache local");
        mostrouDados = true;
    }

    if (!API_URL) {
        if (!mostrouDados) init();
        return;
    }

    if (!mostrouDados) {
        window.portalMostrarCarregando?.("Carregando autuações");
    }

    try {
        const recentes = await sincronizarAutuacoesRecentes();
        if (recentes.length) {
            if (mostrouDados) {
                DATA = mesclarAutuacoes(DATA, recentes);
                init();
                salvarCacheAutuacoesLocal({ status: "ok", data: DATA, data_de: snapshot?.payload?.data_de, data_ate: snapshot?.payload?.data_ate });
                console.info("Autuações atualizadas: JSON + recentes", DATA.length);
            } else {
                const response = await fetch(montarUrlAutuacoes(), { cache: "no-store" });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const payload = await response.json();
                if (payload.status === "error") throw new Error(payload.message || "Erro na API");
                salvarCacheAutuacoesLocal(payload);
                aplicarPayloadAutuacoes(payload, payload.cache ? "servidor (cache)" : "planilha");
            }
        } else if (!mostrouDados) {
            const response = await fetch(montarUrlAutuacoes(), { cache: "no-store" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            if (payload.status === "error") throw new Error(payload.message || "Erro na API");
            salvarCacheAutuacoesLocal(payload);
            aplicarPayloadAutuacoes(payload, payload.cache ? "servidor (cache)" : "planilha");
        }
        if (!DATA.length) {
            console.warn("Autuações retornou vazio.");
        }
    } catch (error) {
        console.error("Erro ao carregar dados do Google Sheets:", error);
        if (!mostrouDados) {
            const tbody = byId("tableBody");
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="${TABLE_COLUMNS.length}" class="no-data">Não foi possível carregar as autuações. Confira se o Apps Script está publicado. (${escapeHtml(error.message)})</td></tr>`;
            }
            init();
        }
    } finally {
        window.portalOcultarCarregando?.();
    }
}

function limparFiltros() {
    const dates = intervaloDatasBase();
    byId("dataInicio").value = dates.inicio || "";
    byId("dataFim").value = dates.fim || "";
    byId("motivoFilter").value = "";
    byId("agenteFilter").value = "";
    byId("busca").value = "";
    render();
}

window.limparFiltros = limparFiltros;
window.addEventListener("dk-theme-change", function () {
    try { render(); } catch (e) {}
});
window.portalAguardarUsuario?.(loadData);
