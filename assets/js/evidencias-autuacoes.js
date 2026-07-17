/* Evidências de Autuações — rascunhos locais (IndexedDB) + import PDF CMTU */
import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs";

const DB_NAME = "ciop-evidencias-autuacoes";
const DB_VERSION = 1;
const STORE = "autos";
const OBS_PADRAO =
  "OBS: Existe uma solicitação de alteração da tabela horária para o próximo cenário.";
const ASSINATURA_PADRAO = { nome: "emerson borges de medeiros", codigo: "42" };

const FILE_RE =
  /^(\d{2}\.\d{2}\.\d{4})\s*-\s*(.+?)\s*-\s*Carro\s+(\S+)\s*-\s*Linha\s+(\S+)\s*-\s*Mot\s+(\S+)/i;

let db;
let autos = [];
let selectedId = null;
let dirty = false;

const $ = (id) => document.getElementById(id);

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
    assinaturaNome: ASSINATURA_PADRAO.nome,
    assinaturaCodigo: ASSINATURA_PADRAO.codigo,
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

function extractAutoHints(text) {
  const t = String(text || "");
  const dates = [...t.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)].map((m) => m[1]);
  const autoMatch =
    t.match(/Auto\s+de\s+Infra[cç][aã]o\s+de\s+n[oº°.]?\s*0*(\d{2,6})/i) ||
    t.match(/\bn[oº°.]?\s*0*(\d{2,6})\b/i);
  return {
    data: dates[0] || "",
    autoNumero: autoMatch ? String(autoMatch[1]).padStart(4, "0") : ""
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
    const textNotif = (await (await pdf.getPage(notifPage)).getTextContent())
      .items.map((it) => it.str)
      .join(" ");
    const hints = extractAutoHints(textNotif);
    const paginaNotif = await renderPdfPage(pdf, notifPage, 1.15);
    const paginaAuto = autoPage !== notifPage ? await renderPdfPage(pdf, autoPage, 1.25) : "";

    const item = blankAuto({
      lote,
      origem: "notificacao-cmtu",
      autoNumero: hints.autoNumero,
      data: hints.data,
      motivo: "",
      paginaNotif,
      paginaAuto,
      imagens: paginaAuto ? [{ id: uid(), dataUrl: paginaAuto, tipo: "auto-cmtu" }] : []
    });
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
  const item = blankAuto({
    lote: file.name,
    origem: "evidencia-pdf",
    data: parsed.data || "",
    motivo: parsed.motivo || "",
    carro: parsed.carro || "",
    linha: parsed.linha || "",
    matricula: parsed.matricula || "",
    paginaAuto: first,
    imagens: [{ id: uid(), dataUrl: first, tipo: "evidencia-pdf" }]
  });
  if (parsed.carro && parsed.motivo) {
    item.texto1 = `Através do CAD, consta que o veículo ${parsed.carro} foi autuado por ${parsed.motivo.toLowerCase()}.`;
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
  auto.assinaturaNome = $("fAssinaturaNome").value.trim();
  auto.assinaturaCodigo = $("fAssinaturaCodigo").value.trim();
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
  $("fAssinaturaNome").value = auto.assinaturaNome || ASSINATURA_PADRAO.nome;
  $("fAssinaturaCodigo").value = auto.assinaturaCodigo || ASSINATURA_PADRAO.codigo;
  dirty = false;
  renderImageGrid(auto);
  $("editorEmpty").hidden = true;
  $("editorPanel").hidden = false;
  $("sheetTitle").textContent = auto.carro
    ? `${auto.carro} — ${auto.data || "sem data"}`
    : "Nova evidência";
}

function renderImageGrid(auto) {
  const grid = $("imageGrid");
  grid.innerHTML = "";
  (auto.imagens || []).forEach((img, idx) => {
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
  const imgs = (auto.imagens || [])
    .map((img) => `<img src="${img.dataUrl}" alt="Evidência">`)
    .join("");
  return `
    <article class="sheet">
      <header class="sheet-head">
        <img class="sheet-logo" src="../assets/img/CIOP Sem Fundo.png" alt="CIOP">
        <div class="sheet-head-center">
          <div class="sheet-org">CENTRO DE INTELIGÊNCIA OPERACIONAL DE LONDRINA - PR</div>
          <div class="sheet-title">AUTO DE INFRAÇÃO</div>
          <div class="sheet-auto">${auto.autoNumero || "—"}</div>
        </div>
        <img class="sheet-logo sheet-logo-tcgl" src="../assets/img/LOGO_TCGL-removebg-preview.png" alt="TCGL">
      </header>
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
        <div><span>Local</span><b>${escapeHtml(auto.local)}</b></div>
        <div><span>Matrícula</span><b>${escapeHtml(auto.matricula)}</b></div>
        <div><span>Motorista</span><b>${escapeHtml(auto.motorista)}</b></div>
        <div class="span-2"><span>Motivo</span><b>${escapeHtml(auto.motivo)}</b></div>
      </section>
      <p class="sheet-obs">${escapeHtml(auto.obs)}</p>
      <footer class="sheet-sign">
        <div>
          <div class="sign-name">${escapeHtml(auto.assinaturaNome)}</div>
          <div class="sign-code">${escapeHtml(auto.assinaturaCodigo)}</div>
        </div>
      </footer>
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
      @page{size:A4;margin:12mm}
      body{font-family:Arial,Helvetica,sans-serif;color:#101828;margin:0}
      .sheet{border:1px solid #dfe5ef;padding:14px}
      .sheet-head{display:grid;grid-template-columns:90px 1fr 90px;gap:10px;align-items:center;border-bottom:2px solid #06245c;padding-bottom:10px}
      .sheet-logo{height:52px;object-fit:contain}
      .sheet-logo-tcgl{height:56px}
      .sheet-org{text-align:center;font-weight:800;color:#06245c;font-size:12px}
      .sheet-title{text-align:center;font-weight:900;font-size:20px;margin-top:4px;color:#071f57}
      .sheet-auto{text-align:center;font-size:12px;font-weight:700;color:#ff6b00;margin-top:4px}
      .sheet-gallery{margin:12px 0;min-height:220px;border:1px dashed #c9d4e5;padding:8px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
      .sheet-gallery img{width:100%;height:auto;border:1px solid #dfe5ef}
      .sheet-gallery-empty{display:grid;place-items:center;color:#667085;min-height:200px}
      .sheet-text p{margin:0 0 8px;font-size:13px;line-height:1.45}
      .sheet-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}
      .sheet-grid div{border:1px solid #dfe5ef;padding:6px 8px;border-radius:4px}
      .sheet-grid .span-2{grid-column:span 2}
      .sheet-grid span{display:block;font-size:10px;color:#667085;font-weight:700;text-transform:uppercase}
      .sheet-grid b{font-size:13px}
      .sheet-obs{margin:12px 0;font-size:12px;font-weight:700}
      .sheet-sign{display:flex;justify-content:flex-end;margin-top:24px}
      .sign-name{font-weight:800;text-transform:lowercase}
      .sign-code{font-size:12px;color:#667085}
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
    "fObs",
    "fAssinaturaNome",
    "fAssinaturaCodigo"
  ].forEach((id) => {
    $(id).addEventListener("input", () => {
      dirty = true;
    });
  });
}

async function boot() {
  db = await openDb();
  autos = await dbGetAll();
  renderList();
  if (autos[0]) selectAuto(autos[0].id);
  else {
    $("editorEmpty").hidden = false;
    $("editorPanel").hidden = true;
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
  setStatus(`${autos.length} evidência(s) no rascunho local.`);
}

window.portalAguardarUsuario(() => {
  boot().catch((err) => {
    console.error(err);
    setStatus(`Erro ao iniciar: ${err.message || err}`, true);
  });
});
