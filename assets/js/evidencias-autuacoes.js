/* Evidências de Autuações — rascunhos locais (IndexedDB) + import PDF CMTU */
import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs";

const DB_NAME = "ciop-evidencias-autuacoes";
const DB_VERSION = 1;
const STORE = "autos";
const OBS_PADRAO =
  "OBS: Existe uma solicitação de alteração da tabela horária para o próximo cenário.";

const FILE_RE =
  /^(\d{2}\.\d{2}\.\d{4})\s*-\s*(.+?)\s*-\s*Carro\s+(\S+)\s*-\s*Linha\s+(\S+)\s*-\s*Mot\s+(\S+)/i;

const SHEET_ID = "1zY_BFsidZyF4RnzKTZkZAlmo-Qiz6JEdIEb3E2xoIeA";
const GID_FUNCIONARIOS = "1931884858";
const FUNC_CACHE_KEY = "ciop_evidencias_funcionarios_v1";

let db;
let autos = [];
let selectedId = null;
let dirty = false;
let funcionarios = [];
let autuacoesIndex = new Map();

const $ = (id) => document.getElementById(id);

function placaDoCarro(carro) {
  const key = String(carro || "").trim();
  const map = window.CIOP_VEICULOS_PLACA || {};
  return map[key] || "";
}

function funcionarioPorMatricula(matricula) {
  const reg = String(matricula || "").trim();
  if (!reg) return null;
  return funcionarios.find((f) => f.registro === reg) || null;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const src = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n" && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

async function carregarFuncionarios() {
  try {
    const cached = JSON.parse(localStorage.getItem(FUNC_CACHE_KEY) || "null");
    if (cached?.ts && Date.now() - cached.ts < 6 * 60 * 60 * 1000 && Array.isArray(cached.dados)) {
      funcionarios = cached.dados;
      preencherDatalistFuncionarios();
    }
  } catch (_) {}

  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID_FUNCIONARIOS}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar funcionários (" + res.status + ")");
  const rows = parseCsv(await res.text());
  funcionarios = rows
    .slice(1)
    .map((linha) => ({
      registro: String(linha[0] || "").trim(),
      nome: String(linha[1] || "").trim(),
      funcao: String(linha[2] || "").trim()
    }))
    .filter((item) => item.registro && item.nome);
  localStorage.setItem(FUNC_CACHE_KEY, JSON.stringify({ ts: Date.now(), dados: funcionarios }));
  preencherDatalistFuncionarios();
}

function preencherDatalistFuncionarios() {
  const lista = $("listaFuncionarios");
  if (!lista) return;
  lista.innerHTML = funcionarios
    .map((f) => `<option value="${escapeHtml(f.registro)}">${escapeHtml(f.nome)} — ${escapeHtml(f.funcao)}</option>`)
    .join("");
  const listaCarros = $("listaCarros");
  if (listaCarros) {
    const carros = Object.keys(window.CIOP_VEICULOS_PLACA || {}).sort();
    listaCarros.innerHTML = carros.map((c) => `<option value="${escapeHtml(c)}"></option>`).join("");
  }
}

async function carregarAutuacoes() {
  try {
    const res = await fetch("../assets/data/autuacoes/dados.json", { cache: "no-store" });
    if (!res.ok) return;
    const payload = await res.json();
    const arr = Array.isArray(payload?.data) ? payload.data : [];
    autuacoesIndex = new Map();
    arr.forEach((item) => {
      const notif = String(item.notificacao || "").trim();
      if (notif) autuacoesIndex.set(notif, item);
      const auto = String(item.auto || "").replace(/^0+/, "");
      if (notif && auto) autuacoesIndex.set(`${notif}#${auto}`, item);
    });
  } catch (err) {
    console.warn("Autuações não carregadas:", err);
  }
}

function enriquecerComCatalogos(auto) {
  if (auto.carro && !auto.placa) {
    auto.placa = placaDoCarro(auto.carro);
  }
  if (auto.matricula && !auto.motorista) {
    const func = funcionarioPorMatricula(auto.matricula);
    if (func) auto.motorista = func.nome;
  }

  const notif = String(auto.notificacao || "").trim();
  const autoId = String(auto.autoId || "").replace(/^0+/, "");
  let hit = null;
  if (notif && autoId) hit = autuacoesIndex.get(`${notif}#${autoId}`);
  if (!hit && notif) hit = autuacoesIndex.get(notif);
  if (hit) {
    if (!auto.motivo) auto.motivo = hit.motivo || "";
    if (!auto.data) auto.data = hit.data_br || "";
    if (!auto.autoNumero || /^\d{2,6}$/.test(auto.autoNumero) || /^-?M\d+$/.test(auto.autoNumero) || /^\d{4,5}\/\d{4}-M\d+$/.test(auto.autoNumero)) {
      const mPart = String(hit.auto || "").padStart(7, "0");
      auto.autoNumero = `${hit.notificacao}-M${mPart}`;
      auto.notificacao = hit.notificacao;
    }
  }
  return auto;
}

function aplicarLookupFormulario() {
  const auto = selected();
  if (!auto) return;
  const carro = $("fCarro").value.trim();
  const matricula = $("fMatricula").value.trim();
  if (carro) {
    const placa = placaDoCarro(carro);
    if (placa) $("fPlaca").value = placa;
  }
  if (matricula) {
    const func = funcionarioPorMatricula(matricula);
    if (func) $("fMotorista").value = func.nome;
  }
  dirty = true;
}

function uid() {
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txStore(mode = "readonly") {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function dbGetAll() {
  return new Promise((resolve, reject) => {
    const req = txStore().getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(item) {
  return new Promise((resolve, reject) => {
    const req = txStore("readwrite").put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const req = txStore("readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function blankAuto(extra = {}) {
  return {
    id: uid(),
    status: "rascunho",
    lote: "",
    origem: "manual",
    autoNumero: "",
    notificacao: "",
    autoId: "",
    data: "",
    horario: "",
    carro: "",
    placa: "",
    linha: "",
    local: "",
    matricula: "",
    motorista: "",
    motivo: "",
    texto1: "",
    texto2: "",
    texto3: "",
    obs: OBS_PADRAO,
    imagens: [],
    paginaAuto: "",
    paginaNotif: "",
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...extra
  };
}

function parseEvidenceFilename(name) {
  const base = String(name || "").replace(/\.pdf$/i, "").trim();
  const m = base.match(FILE_RE);
  if (!m) return null;
  return {
    data: m[1].replace(/\./g, "/"),
    motivo: m[2].trim(),
    carro: m[3].trim(),
    linha: m[4].trim(),
    matricula: m[5].replace(/\.pdf$/i, "").trim()
  };
}

function extractPageText(page) {
  return page.getTextContent().then((tc) => tc.items.map((it) => it.str).join(" "));
}

function extractAutoHints(textNotif, textAuto = "") {
  const t = `${textNotif || ""}\n${textAuto || ""}`;
  const dates = [...t.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)].map((m) => m[1]);
  const notif =
    (t.match(/Notifica[cç][aã]o\s*(?:n[oº°.]?\s*)?(\d{4,5}\/\d{4})/i) || [])[1] ||
    (t.match(/\b(\d{5}\/\d{4})\b/) || [])[1] ||
    "";
  const autoMatch =
    t.match(/Auto\s+de\s+Infra[cç][aã]o\s+de\s+n[oº°.]?\s*0*(\d{2,6})/i) ||
    t.match(/\bn[oº°.]?\s*0*(\d{2,6})\b/i);
  const autoId = autoMatch ? String(autoMatch[1]) : "";

  const hourMatch =
    t.match(/\b(?:[àa]s\s*)?(\d{1,2})[h:](\d{2})\b/i) ||
    t.match(/\b(\d{2}):(\d{2})\b/);
  const horario = hourMatch
    ? `${String(hourMatch[1]).padStart(2, "0")}:${hourMatch[2]}`
    : "";

  const linhaMatch =
    t.match(/\bLinha\s*[:\-]?\s*(\d{2,4})\b/i) ||
    t.match(/\bL\.?\s*(\d{2,4})\b/);
  const carroMatch = t.match(/\b(?:Carro|Ve[ií]culo|Prefixo)\s*[:\-]?\s*(\d{3,4})\b/i);

  const motivoKeys = [
    ["ATRASO", /atraso/i],
    ["SUPRESSÃO", /supress/i],
    ["PERMANÊNCIA", /perman/i],
    ["NÃO REALIZOU LOGIN", /login|n[aã]o\s+realizou/i],
    ["ELEVADOR DEFEITUOSO", /elevador/i],
    ["ADIANTADO", /adiantad/i]
  ];
  let motivo = "";
  for (const [label, re] of motivoKeys) {
    if (re.test(t)) {
      motivo = label;
      break;
    }
  }

  const localMatch =
    t.match(/Lugar\s+da\s+Infra[cç][aã]o\s*[:\-]?\s*([^\n]{4,80})/i) ||
    t.match(/\b(?:Terminal|Garagem|Av\.|Avenida|Rua)\s+[^\n,]{3,60}/i);
  const local = localMatch ? String(localMatch[1] || localMatch[0] || "").trim() : "";

  let autoNumero = "";
  if (notif && autoId) {
    autoNumero = `${notif}-M${String(autoId).padStart(7, "0")}`;
  } else if (autoId) {
    autoNumero = String(autoId).padStart(4, "0");
  }

  return {
    data: dates.find((d) => !d.startsWith("01/01")) || dates[0] || "",
    horario,
    linha: linhaMatch ? linhaMatch[1] : "",
    carro: carroMatch ? carroMatch[1] : "",
    motivo,
    local,
    notificacao: notif,
    autoId,
    autoNumero
  };
}

async function renderPdfPage(pdf, pageNumber, scale = 1.35) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function importNotificationPdf(file, onProgress) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const total = pdf.numPages;
  const lote = file.name.replace(/\.pdf$/i, "");
  const created = [];

  for (let i = 1; i <= total; i += 2) {
    if (onProgress) onProgress(i, total);
    const notifPage = i;
    const autoPage = Math.min(i + 1, total);
    const pageNotif = await pdf.getPage(notifPage);
    const pageAutoObj = autoPage !== notifPage ? await pdf.getPage(autoPage) : null;
    const textNotif = await extractPageText(pageNotif);
    const textAuto = pageAutoObj ? await extractPageText(pageAutoObj) : "";
    const hints = extractAutoHints(textNotif, textAuto);
    const paginaNotif = await renderPdfPage(pdf, notifPage, 1.15);
    const paginaAuto = autoPage !== notifPage ? await renderPdfPage(pdf, autoPage, 1.25) : "";

    const item = enriquecerComCatalogos(
      blankAuto({
        lote,
        origem: "notificacao-cmtu",
        autoNumero: hints.autoNumero,
        notificacao: hints.notificacao,
        autoId: hints.autoId,
        data: hints.data,
        horario: hints.horario,
        linha: hints.linha,
        carro: hints.carro,
        local: hints.local,
        motivo: hints.motivo,
        paginaNotif,
        paginaAuto,
        imagens: []
      })
    );
    if (item.carro && item.motivo && !item.texto1) {
      item.texto1 = `Através do CAD, consta que o veículo ${item.carro} foi autuado por ${String(item.motivo).toLowerCase()}.`;
    }
    if (item.horario && !item.texto2) {
      item.texto2 = `Horário de tabela CMTU - ${item.horario}`;
    }
    created.push(item);
    await dbPut(item);
  }
  return created;
}

async function importEvidencePdf(file) {
  const parsed = parseEvidenceFilename(file.name) || {};
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const first = await renderPdfPage(pdf, 1, 1.2);
  const item = enriquecerComCatalogos(
    blankAuto({
      lote: file.name,
      origem: "evidencia-pdf",
      data: parsed.data || "",
      motivo: parsed.motivo || "",
      carro: parsed.carro || "",
      linha: parsed.linha || "",
      matricula: parsed.matricula || "",
      paginaAuto: first,
      imagens: []
    })
  );
  if (item.carro && item.motivo && !item.texto1) {
    item.texto1 = `Através do CAD, consta que o veículo ${item.carro} foi autuado por ${String(item.motivo).toLowerCase()}.`;
  }
  await dbPut(item);
  return item;
}

function statusLabel(status) {
  return (
    {
      rascunho: "Rascunho",
      evidenciado: "Com evidência",
      pronto: "Pronto",
      finalizado: "Finalizado"
    }[status] || status
  );
}

function computeStatus(auto) {
  const hasImg = (auto.imagens || []).length > 0;
  const hasCore = auto.carro && auto.data && (auto.autoNumero || auto.motivo);
  if (auto.status === "finalizado") return "finalizado";
  if (hasImg && hasCore && (auto.texto1 || auto.texto2)) return "pronto";
  if (hasImg) return "evidenciado";
  return "rascunho";
}

function setStatus(msg, isError = false) {
  const el = $("statusLine");
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle("is-error", isError);
}

function selected() {
  return autos.find((a) => a.id === selectedId) || null;
}

function readFormInto(auto) {
  auto.autoNumero = $("fAutoNumero").value.trim();
  auto.data = $("fData").value.trim();
  auto.horario = $("fHorario").value.trim();
  auto.carro = $("fCarro").value.trim();
  auto.placa = $("fPlaca").value.trim();
  auto.linha = $("fLinha").value.trim();
  auto.local = $("fLocal").value.trim();
  auto.matricula = $("fMatricula").value.trim();
  auto.motorista = $("fMotorista").value.trim();
  auto.motivo = $("fMotivo").value.trim();
  auto.texto1 = $("fTexto1").value.trim();
  auto.texto2 = $("fTexto2").value.trim();
  auto.texto3 = $("fTexto3").value.trim();
  auto.obs = $("fObs").value.trim();
  auto.status = computeStatus(auto);
  auto.atualizadoEm = new Date().toISOString();
  dirty = true;
}

function fillForm(auto) {
  $("fAutoNumero").value = auto.autoNumero || "";
  $("fData").value = auto.data || "";
  $("fHorario").value = auto.horario || "";
  $("fCarro").value = auto.carro || "";
  $("fPlaca").value = auto.placa || "";
  $("fLinha").value = auto.linha || "";
  $("fLocal").value = auto.local || "";
  $("fMatricula").value = auto.matricula || "";
  $("fMotorista").value = auto.motorista || "";
  $("fMotivo").value = auto.motivo || "";
  $("fTexto1").value = auto.texto1 || "";
  $("fTexto2").value = auto.texto2 || "";
  $("fTexto3").value = auto.texto3 || "";
  $("fObs").value = auto.obs || OBS_PADRAO;
  dirty = false;
  renderDocsPanes(auto);
  renderImageGrid(auto);
  $("editorEmpty").hidden = true;
  $("editorPanel").hidden = false;
  if ($("actionsBar")) $("actionsBar").hidden = false;
  $("sheetTitle").textContent = auto.carro
    ? `${auto.carro} — ${auto.data || "sem data"}`
    : "Nova evidência";
}

function renderDocsPanes(auto) {
  const notifEl = $("paneNotif");
  const autoEl = $("paneAuto");
  if (!notifEl || !autoEl) return;

  // Rascunhos antigos: auto-cmtu na galeria vira painel do auto
  if (!auto.paginaAuto) {
    const legacy = (auto.imagens || []).find((i) => i.tipo === "auto-cmtu");
    if (legacy) auto.paginaAuto = legacy.dataUrl;
  }

  notifEl.outerHTML = auto.paginaNotif
    ? `<img id="paneNotif" src="${auto.paginaNotif}" alt="Capa / Notificação">`
    : `<div id="paneNotif" class="sheet-docs-empty">Importe o PDF da CMTU para ver a capa</div>`;
  autoEl.outerHTML = auto.paginaAuto
    ? `<img id="paneAuto" src="${auto.paginaAuto}" alt="Auto">`
    : `<div id="paneAuto" class="sheet-docs-empty">Página do auto</div>`;
}

function evidenciasSomente(auto) {
  return (auto.imagens || []).filter((i) => i.tipo !== "auto-cmtu" && i.tipo !== "notif-cmtu");
}

function renderImageGrid(auto) {
  const grid = $("imageGrid");
  grid.innerHTML = "";
  evidenciasSomente(auto).forEach((img, idx) => {
    const card = document.createElement("div");
    card.className = "img-card";
    card.innerHTML = `
      <img src="${img.dataUrl}" alt="Evidência ${idx + 1}">
      <button type="button" class="img-remove" data-id="${img.id}" title="Remover">×</button>
      <span class="img-label">${img.tipo || "imagem"} ${idx + 1}</span>
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll(".img-remove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const autoNow = selected();
      if (!autoNow) return;
      autoNow.imagens = autoNow.imagens.filter((i) => i.id !== btn.dataset.id);
      autoNow.status = computeStatus(autoNow);
      await dbPut(autoNow);
      renderImageGrid(autoNow);
      renderList();
      setStatus("Imagem removida.");
    });
  });
}

function renderList() {
  const q = ($("buscaLista").value || "").toLowerCase().trim();
  const list = $("listaAutos");
  const filtered = autos
    .slice()
    .sort((a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)))
    .filter((a) => {
      if (!q) return true;
      return [a.carro, a.linha, a.autoNumero, a.motivo, a.motorista, a.data, a.lote]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

  list.innerHTML = "";
  if (!filtered.length) {
    list.innerHTML = `<div class="list-empty">Nenhum auto ainda. Solte o PDF da CMTU ou uma evidência.</div>`;
  }

  filtered.forEach((a) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `auto-item${a.id === selectedId ? " is-active" : ""} status-${a.status}`;
    el.innerHTML = `
      <div class="auto-item-top">
        <strong>${a.carro || "—"}</strong>
        <span class="pill">${statusLabel(a.status)}</span>
      </div>
      <div class="auto-item-meta">${a.data || "sem data"} · Linha ${a.linha || "—"} · Mot ${a.matricula || "—"}</div>
      <div class="auto-item-sub">${a.autoNumero ? `Auto ${a.autoNumero}` : a.motivo || a.lote || "Sem número"}</div>
    `;
    el.addEventListener("click", () => selectAuto(a.id));
    list.appendChild(el);
  });

  $("kpiTotal").textContent = String(autos.length);
  $("kpiProntos").textContent = String(autos.filter((a) => a.status === "pronto" || a.status === "finalizado").length);
  $("kpiRascunhos").textContent = String(autos.filter((a) => a.status === "rascunho").length);
}

async function selectAuto(id) {
  if (dirty && selected()) {
    readFormInto(selected());
    await dbPut(selected());
  }
  selectedId = id;
  const auto = selected();
  if (!auto) return;
  enriquecerComCatalogos(auto);
  fillForm(auto);
  renderList();
}

async function saveCurrent() {
  const auto = selected();
  if (!auto) return;
  readFormInto(auto);
  await dbPut(auto);
  dirty = false;
  renderList();
  setStatus("Rascunho salvo neste computador.");
}

async function addImages(files) {
  const auto = selected();
  if (!auto) {
    setStatus("Selecione um auto antes de anexar imagens.", true);
    return;
  }
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    const dataUrl = await readFileAsDataUrl(file);
    auto.imagens.push({ id: uid(), dataUrl, tipo: "evidencia" });
  }
  auto.status = computeStatus(auto);
  await dbPut(auto);
  renderImageGrid(auto);
  renderList();
  setStatus(`${files.length} imagem(ns) anexada(s).`);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function buildSheetHtml(auto) {
  const imgs = evidenciasSomente(auto)
    .map((img) => `<img src="${img.dataUrl}" alt="Evidência">`)
    .join("");
  const notif = auto.paginaNotif
    ? `<img src="${auto.paginaNotif}" alt="Capa">`
    : `<div class="sheet-docs-empty">Sem capa</div>`;
  const autoPage = auto.paginaAuto
    ? `<img src="${auto.paginaAuto}" alt="Auto">`
    : `<div class="sheet-docs-empty">Sem auto</div>`;
  return `
    <article class="sheet-a4">
      <div class="sheet-brand">
        <img src="../assets/img/CIOP Sem Fundo.png" alt="CIOP">
        <div class="sheet-org">Centro de Inteligência Operacional de Londrina - PR</div>
        <img src="../assets/img/LOGO_TCGL-removebg-preview.png" alt="TCGL">
      </div>
      <div class="sheet-capa">
        <div class="sheet-capa-title">Auto de Infração</div>
        <div class="sheet-capa-numero">
          <div class="sheet-capa-numero-text">${escapeHtml(auto.autoNumero) || "—"}</div>
        </div>
      </div>
      <section class="sheet-docs">
        <div class="sheet-docs-pane"><label>Capa / Notificação</label>${notif}</div>
        <div class="sheet-docs-pane"><label>Auto</label>${autoPage}</div>
      </section>
      <section class="sheet-gallery ${imgs ? "" : "is-empty"}">
        ${imgs || "<div class='sheet-gallery-empty'>Área de evidências (imagens)</div>"}
      </section>
      <section class="sheet-text">
        <p>${escapeHtml(auto.texto1)}</p>
        <p>${escapeHtml(auto.texto2)}</p>
        <p>${escapeHtml(auto.texto3)}</p>
      </section>
      <section class="sheet-grid">
        <div><span>Carro</span><b>${escapeHtml(auto.carro)}</b></div>
        <div><span>Placa</span><b>${escapeHtml(auto.placa)}</b></div>
        <div><span>Data</span><b>${escapeHtml(auto.data)}</b></div>
        <div><span>Horário</span><b>${escapeHtml(auto.horario)}</b></div>
        <div><span>Linha</span><b>${escapeHtml(auto.linha)}</b></div>
        <div class="span-2"><span>Local</span><b>${escapeHtml(auto.local)}</b></div>
        <div><span>Matrícula</span><b>${escapeHtml(auto.matricula)}</b></div>
        <div class="span-2"><span>Motorista</span><b>${escapeHtml(auto.motorista)}</b></div>
        <div class="span-2"><span>Motivo</span><b>${escapeHtml(auto.motivo)}</b></div>
      </section>
      <p class="sheet-obs">${escapeHtml(auto.obs)}</p>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openPreview() {
  const auto = selected();
  if (!auto) return;
  readFormInto(auto);
  $("previewBody").innerHTML = buildSheetHtml(auto);
  $("previewModal").hidden = false;
}

function closePreview() {
  $("previewModal").hidden = true;
}

function printPreview() {
  const auto = selected();
  if (!auto) return;
  readFormInto(auto);
  const win = window.open("", "_blank");
  if (!win) {
    setStatus("Permita pop-ups para imprimir/exportar PDF.", true);
    return;
  }
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Evidência ${auto.carro || ""}</title>
    <style>
      @page{size:A4;margin:10mm}
      body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0}
      .sheet-a4{border:1px solid #c9d0dc}
      .sheet-brand{display:grid;grid-template-columns:90px 1fr 90px;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid #ddd}
      .sheet-brand img{height:48px;object-fit:contain;justify-self:center}
      .sheet-org{text-align:center;font-weight:800;color:#06245c;font-size:13px;text-transform:uppercase}
      .sheet-capa{display:grid;grid-template-columns:26% 1fr;border-bottom:2px solid #1a1a1a;min-height:48px}
      .sheet-capa-title{display:flex;align-items:center;justify-content:center;border-right:2px solid #1a1a1a;background:#f7f8fa;font-size:15px;font-weight:900;text-transform:uppercase;color:#0b1b3f;padding:8px}
      .sheet-capa-numero{display:flex;align-items:center;padding:8px 12px}
      .sheet-capa-numero-text{font-size:15px;font-weight:800;color:#06245c}
      .sheet-docs{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #ddd;background:#f3f5f8}
      .sheet-docs-pane{padding:6px;border-right:1px solid #d5deee}
      .sheet-docs-pane:last-child{border-right:0}
      .sheet-docs-pane label{display:block;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:4px}
      .sheet-docs-pane img{width:100%;border:1px solid #c9d0dc;background:#fff}
      .sheet-docs-empty{min-height:180px;display:grid;place-items:center;border:1px dashed #c9d4e5;background:#fff;color:#94a3b8;font-size:11px;font-weight:700}
      .sheet-gallery{margin:10px 12px;min-height:160px;border:1px dashed #c9d4e5;padding:8px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px}
      .sheet-gallery img{width:100%;border:1px solid #dfe5ef}
      .sheet-gallery-empty{display:grid;place-items:center;color:#667085;min-height:120px}
      .sheet-text{padding:0 14px}
      .sheet-text p{margin:0 0 8px;font-size:13px;line-height:1.45}
      .sheet-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px 14px}
      .sheet-grid div{border:1px solid #dfe5ef;padding:6px 8px}
      .sheet-grid .span-2{grid-column:span 2}
      .sheet-grid span{display:block;font-size:10px;color:#667085;font-weight:700;text-transform:uppercase}
      .sheet-grid b{font-size:13px}
      .sheet-obs{padding:0 14px 16px;font-size:12px;font-weight:700}
    </style></head><body>${buildSheetHtml(auto)}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

async function finalizeCurrent() {
  const auto = selected();
  if (!auto) return;
  readFormInto(auto);
  auto.status = "finalizado";
  await dbPut(auto);
  dirty = false;
  renderList();
  setStatus("Evidência marcada como finalizada (local).");
}

async function deleteCurrent() {
  const auto = selected();
  if (!auto) return;
  if (!confirm(`Excluir evidência do carro ${auto.carro || "—"}?`)) return;
  await dbDelete(auto.id);
  autos = autos.filter((a) => a.id !== auto.id);
  selectedId = autos[0]?.id || null;
  if (selectedId) fillForm(selected());
  else {
    $("editorEmpty").hidden = false;
    $("editorPanel").hidden = true;
    if ($("actionsBar")) $("actionsBar").hidden = true;
  }
  renderList();
  setStatus("Evidência excluída.");
}

async function handleFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  setStatus("Processando arquivos...");
  try {
    for (const file of files) {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".pdf") && !file.type.startsWith("image/")) {
        setStatus(`Ignorado: ${file.name}`, true);
        continue;
      }
      if (file.type.startsWith("image/")) {
        if (!selected()) {
          const item = blankAuto({ lote: file.name, origem: "imagem" });
          item.imagens.push({ id: uid(), dataUrl: await readFileAsDataUrl(file), tipo: "evidencia" });
          item.status = computeStatus(item);
          await dbPut(item);
          autos.unshift(item);
          selectedId = item.id;
          fillForm(item);
        } else {
          await addImages([file]);
        }
        continue;
      }

      const isNotif =
        /notifica/i.test(file.name) ||
        /cmtu/i.test(file.name) ||
        file.size > 8_000_000;

      if (isNotif && !parseEvidenceFilename(file.name)) {
        setStatus(`Lendo notificação CMTU (${file.name})...`);
        const created = await importNotificationPdf(file, (cur, total) => {
          setStatus(`Replicando autos ${Math.min(cur + 1, total)}/${total}...`);
        });
        autos = created.concat(autos);
        selectedId = created[0]?.id || selectedId;
        if (selectedId) fillForm(selected());
        setStatus(`${created.length} autos criados a partir da notificação.`);
      } else {
        const item = await importEvidencePdf(file);
        autos.unshift(item);
        selectedId = item.id;
        fillForm(item);
        setStatus(`Evidência importada: ${file.name}`);
      }
    }
    renderList();
  } catch (err) {
    console.error(err);
    setStatus(`Falha ao importar: ${err.message || err}`, true);
  }
}

function wireDropZone(zone, input, handler) {
  const prevent = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) => {
    zone.addEventListener(ev, prevent);
  });
  zone.addEventListener("dragover", () => zone.classList.add("is-drag"));
  zone.addEventListener("dragleave", () => zone.classList.remove("is-drag"));
  zone.addEventListener("drop", (e) => {
    zone.classList.remove("is-drag");
    handler(e.dataTransfer.files);
  });
  zone.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    handler(input.files);
    input.value = "";
  });
}

function bindFormDirty() {
  [
    "fAutoNumero",
    "fData",
    "fHorario",
    "fCarro",
    "fPlaca",
    "fLinha",
    "fLocal",
    "fMatricula",
    "fMotorista",
    "fMotivo",
    "fTexto1",
    "fTexto2",
    "fTexto3",
    "fObs"
  ].forEach((id) => {
    $(id).addEventListener("input", () => {
      dirty = true;
    });
  });

  ["fCarro", "fMatricula"].forEach((id) => {
    $(id).addEventListener("change", aplicarLookupFormulario);
    $(id).addEventListener("blur", aplicarLookupFormulario);
  });
  $("fCarro").addEventListener("input", () => {
    const placa = placaDoCarro($("fCarro").value);
    if (placa) $("fPlaca").value = placa;
  });
  $("fMatricula").addEventListener("input", () => {
    const func = funcionarioPorMatricula($("fMatricula").value);
    if (func) $("fMotorista").value = func.nome;
  });
}

async function boot() {
  db = await openDb();
  await Promise.all([
    carregarAutuacoes().catch((err) => console.warn(err)),
    carregarFuncionarios().catch((err) => {
      console.warn(err);
      setStatus("Funcionários indisponíveis no momento — preencha a matrícula manualmente.", true);
    })
  ]);
  autos = (await dbGetAll()).map((a) => enriquecerComCatalogos(a));
  renderList();
  if (autos[0]) selectAuto(autos[0].id);
  else {
    $("editorEmpty").hidden = false;
    $("editorPanel").hidden = true;
    if ($("actionsBar")) $("actionsBar").hidden = true;
  }

  wireDropZone($("dropImport"), $("fileImport"), handleFiles);
  wireDropZone($("dropImages"), $("fileImages"), addImages);

  $("buscaLista").addEventListener("input", renderList);
  $("btnNovo").addEventListener("click", async () => {
    const item = blankAuto({ lote: "manual" });
    await dbPut(item);
    autos.unshift(item);
    selectAuto(item.id);
    setStatus("Novo auto criado.");
  });
  $("btnSalvar").addEventListener("click", saveCurrent);
  $("btnPreview").addEventListener("click", openPreview);
  $("btnPrint").addEventListener("click", printPreview);
  $("btnFinalizar").addEventListener("click", finalizeCurrent);
  $("btnExcluir").addEventListener("click", deleteCurrent);
  $("btnClosePreview").addEventListener("click", closePreview);
  $("btnPrintPreview").addEventListener("click", printPreview);
  $("previewModal").addEventListener("click", (e) => {
    if (e.target.id === "previewModal") closePreview();
  });
  bindFormDirty();
  setStatus(
    `${autos.length} evidência(s) · ${funcionarios.length} funcionários · ${Object.keys(window.CIOP_VEICULOS_PLACA || {}).length} placas.`
  );
}

window.portalAguardarUsuario(() => {
  boot().catch((err) => {
    console.error(err);
    setStatus(`Erro ao iniciar: ${err.message || err}`, true);
  });
});
