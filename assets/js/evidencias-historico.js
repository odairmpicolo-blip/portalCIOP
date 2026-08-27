import { listarEvidenciasNuvem } from "./evidencias-nuvem.js";

const PLANILHA_CSV =
  "https://docs.google.com/spreadsheets/d/1kkohM1xJMbQvyyJKayOBpgtL0qFWKQGSa1U8lhwwbes/export?format=csv&gid=150506325";
const DB_NAME = "ciop-evidencias-autuacoes";
const STORE = "autos";

function $(id) {
  return document.getElementById(id);
}

function padNotificacao(valor) {
  const digits = String(valor || "").replace(/\D/g, "");
  if (!digits) return "";
  return `Nº ${String(parseInt(digits, 10)).padStart(6, "0")}`;
}

function parseCsv(texto) {
  const linhas = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const s = String(texto || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      linhas.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    linhas.push(row);
  }
  return linhas.filter((r) => r.some((c) => String(c || "").trim()));
}

function rowsFromCsv(texto) {
  const matriz = parseCsv(texto);
  if (matriz.length < 2) return [];
  const headers = matriz[0].map((h) => String(h || "").trim());
  return matriz.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] != null ? String(cols[i]).trim() : "";
    });
    return obj;
  });
}

function dataIso(br) {
  const m = String(br || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function pareceData(valor) {
  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(valor || "").trim());
}

function ehEvidenciaPlanilha(row) {
  const carro = String(row.Carro || "").trim();
  const evid = String(row["Evidenciado em"] || "").trim();
  return Boolean(carro) || pareceData(evid);
}

function chaveRegistro(row) {
  return [
    String(row.protocolo || row["Notificação Nº"] || "").trim(),
    String(row.autoId || row["Auto de Infração Nº"] || "").replace(/\D/g, "")
  ].join("#");
}

function normalizarPlanilha(row) {
  return {
    origem: "planilha",
    data: row.Data || "",
    dataIso: dataIso(row.Data),
    protocolo: row["Notificação Nº"] || "",
    autoId: String(row["Auto de Infração Nº"] || "").replace(/\D/g, ""),
    motivo: row.Motivo || "",
    agente: row.Agente || "",
    carro: row.Carro || "",
    linha: row.Linha || "",
    placa: row.Placa || "",
    horario: row.Horário || "",
    motorista: row.Motorista || "",
    matricula: row.Matrícula || "",
    evidenciadoEm: pareceData(row["Evidenciado em"]) ? row["Evidenciado em"] : "",
    usuario: row.Usuário || "",
    local: row.Local || "",
    status: "planilha"
  };
}

function normalizarNuvem(meta) {
  return {
    origem: "nuvem",
    id: meta.id,
    data: meta.data || "",
    dataIso: dataIso(meta.data),
    protocolo: meta.protocolo || meta.notificacao || "",
    autoId: String(meta.autoId || "").replace(/\D/g, ""),
    motivo: meta.motivo || "",
    agente: meta.autuador || "",
    carro: meta.carro || "",
    linha: meta.linha || "",
    placa: meta.placa || "",
    horario: meta.horario || "",
    motorista: meta.motorista || "",
    matricula: meta.matricula || "",
    evidenciadoEm: "",
    usuario: meta.atualizadoPor || "",
    local: meta.local || "",
    status: meta.status || "nuvem"
  };
}

function normalizarLocal(auto) {
  return {
    origem: "local",
    id: auto.id,
    data: auto.data || "",
    dataIso: dataIso(auto.data),
    protocolo: auto.protocolo || auto.notificacao || "",
    autoId: String(auto.autoId || "").replace(/\D/g, ""),
    motivo: auto.motivo || "",
    agente: auto.autuador || "",
    carro: auto.carro || "",
    linha: auto.linha || "",
    placa: auto.placa || "",
    horario: auto.horario || "",
    motorista: auto.motorista || "",
    matricula: auto.matricula || "",
    evidenciadoEm: "",
    usuario: "",
    local: auto.local || "",
    status: auto.status || "rascunho",
    lote: auto.lote || ""
  };
}

function abrirDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function lerAutosLocais() {
  return abrirDb()
    .then(
      (db) =>
        new Promise((resolve, reject) => {
          const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        })
    )
    .catch(() => []);
}

function mesclar(planilha, locais, nuvem) {
  const mapa = new Map();
  planilha.forEach((row) => mapa.set(chaveRegistro(row), row));
  const extra = [...(nuvem || []), ...(locais || [])];
  extra.forEach((row) => {
    const k = chaveRegistro(row);
    if (!k || k === "#") {
      mapa.set(`${row.origem}:${row.id}`, row);
      return;
    }
    if (!mapa.has(k)) mapa.set(k, row);
    else {
      const atual = mapa.get(k);
      const origens = new Set([atual.origem, row.origem].filter(Boolean));
      let origem = row.origem;
      if (origens.has("planilha") && (origens.has("nuvem") || origens.has("local"))) origem = "ambos";
      mapa.set(k, { ...atual, ...row, id: row.id || atual.id, origem });
    }
  });
  return [...mapa.values()].sort((a, b) => {
    const da = a.evidenciadoEm ? dataIso(a.evidenciadoEm) : a.dataIso;
    const dbv = b.evidenciadoEm ? dataIso(b.evidenciadoEm) : b.dataIso;
    return String(dbv || "").localeCompare(String(da || "")) || String(b.protocolo).localeCompare(String(a.protocolo));
  });
}

function setStatus(msg, erro) {
  const el = $("statusLinha");
  el.textContent = msg;
  el.classList.toggle("erro", Boolean(erro));
}

function valorFiltro(row, campo) {
  if (campo === "q") {
    return [
      row.data,
      row.protocolo,
      row.autoId,
      row.motivo,
      row.agente,
      row.carro,
      row.linha,
      row.motorista,
      row.usuario
    ]
      .join(" ")
      .toLowerCase();
  }
  return "";
}

function aplicarFiltros(lista) {
  const q = String($("filtroQ").value || "")
    .trim()
    .toLowerCase();
  const de = $("filtroDe").value;
  const ate = $("filtroAte").value;
  return lista.filter((row) => {
    const iso = row.evidenciadoEm ? dataIso(row.evidenciadoEm) : row.dataIso;
    if (de && iso && iso < de) return false;
    if (ate && iso && iso > ate) return false;
    if (q && !valorFiltro(row, "q").includes(q)) return false;
    return true;
  });
}

function badgeOrigem(row) {
  if (row.origem === "ambos") return '<span class="tag tag-ok">Planilha + AWS</span>';
  if (row.origem === "nuvem") return '<span class="tag tag-ok">AWS</span>';
  if (row.origem === "local") return '<span class="tag">Rascunho neste computador</span>';
  return '<span class="tag tag-sheet">Planilha</span>';
}

function renderTabela(lista) {
  const tb = $("tbodyHist");
  if (!lista.length) {
    tb.innerHTML = `<tr><td colspan="11" class="empty">Nenhuma evidência neste filtro.</td></tr>`;
    return;
  }
  tb.innerHTML = lista
    .map((row) => {
      const notif = padNotificacao(row.autoId) || "—";
      const abrir = row.id
        ? `<a class="btn-link" href="evidencias-autuacoes.html?id=${encodeURIComponent(row.id)}">Abrir editor</a>`
        : "";
      return `<tr>
        <td>${row.data || "—"}</td>
        <td>${row.protocolo || "—"}</td>
        <td>${notif}</td>
        <td>${row.motivo || "—"}</td>
        <td>${row.carro || "—"}</td>
        <td>${row.linha || "—"}</td>
        <td>${row.motorista || "—"}</td>
        <td>${row.agente || "—"}</td>
        <td>${row.evidenciadoEm || "—"}</td>
        <td>${row.usuario || "—"}</td>
        <td>${badgeOrigem(row)} ${abrir}</td>
      </tr>`;
    })
    .join("");
}

function exportarCsv(lista) {
  const cols = [
    "Data",
    "Protocolo",
    "Notificação",
    "Motivo",
    "Carro",
    "Linha",
    "Motorista",
    "Agente",
    "Evidenciado em",
    "Usuário"
  ];
  const linhas = [cols.join(";")];
  lista.forEach((row) => {
    const vals = [
      row.data,
      row.protocolo,
      padNotificacao(row.autoId),
      row.motivo,
      row.carro,
      row.linha,
      row.motorista,
      row.agente,
      row.evidenciadoEm,
      row.usuario
    ].map((v) => `"${String(v || "").replace(/"/g, '""')}"`);
    linhas.push(vals.join(";"));
  });
  const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "historico-evidencias-autuacoes.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

let cache = [];

async function carregar() {
  setStatus("Carregando histórico da planilha...");
  let planilha = [];
  try {
    const res = await fetch(`${PLANILHA_CSV}&t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const texto = await res.text();
    planilha = rowsFromCsv(texto).filter(ehEvidenciaPlanilha).map(normalizarPlanilha);
  } catch (err) {
    console.warn(err);
    setStatus(`Planilha indisponível: ${err.message || err}`, true);
  }
  const locais = (await lerAutosLocais()).map(normalizarLocal);
  let nuvem = [];
  try {
    nuvem = (await listarEvidenciasNuvem()).map(normalizarNuvem);
  } catch (err) {
    console.warn(err);
  }
  cache = mesclar(planilha, locais, nuvem);
  const filtrada = aplicarFiltros(cache);
  renderTabela(filtrada);
  setStatus(
    `${filtrada.length} evidência(s) · ${planilha.length} na planilha · ${nuvem.length} na AWS · ${locais.length} neste computador.`
  );
}

let iniciado = false;
function iniciar() {
  if (iniciado) return;
  iniciado = true;
  $("btnBuscar").addEventListener("click", () => {
    const filtrada = aplicarFiltros(cache);
    renderTabela(filtrada);
    setStatus(`${filtrada.length} evidência(s) no filtro.`);
  });
  $("filtroQ").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("btnBuscar").click();
  });
  $("btnCsv").addEventListener("click", () => exportarCsv(aplicarFiltros(cache)));
  carregar();
}

if (typeof window.portalAguardarUsuario === "function") {
  window.portalAguardarUsuario(() => iniciar());
} else if (window.portalUsuarioValidado) iniciar();
else window.addEventListener("portal:usuario-validado", iniciar, { once: true });
