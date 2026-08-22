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
const AUTUACOES_PLANILHA_API =
  "https://script.google.com/macros/s/AKfycbylz8scwboPQLeOKWUpw9YqKxomjts1aa8KUwodAuq5IE3T9s7RXd6GJcfMnS9qu6DI/exec";
const AUTUACOES_PLANILHA_URL =
  "https://docs.google.com/spreadsheets/d/1kkohM1xJMbQvyyJKayOBpgtL0qFWKQGSa1U8lhwwbes/edit?gid=150506325";

let db;
let autos = [];
let selectedId = null;
let dirty = false;
let funcionarios = [];
let autuacoesIndex = new Map();
let autuacoesPorAuto = new Map();

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
    autuacoesPorAuto = new Map();
    arr.forEach((item) => {
      const notif = String(item.notificacao || "").trim();
      if (notif) autuacoesIndex.set(notif, item);
      const auto = String(item.auto || "").replace(/^0+/, "");
      if (auto) {
        const lista = autuacoesPorAuto.get(auto) || [];
        lista.push(item);
        autuacoesPorAuto.set(auto, lista);
      }
      if (notif && auto) autuacoesIndex.set(`${notif}#${auto}`, item);
    });
  } catch (err) {
    console.warn("Autuações não carregadas:", err);
  }
}

function catalogoDoAuto(auto) {
  const notif = String(auto.notificacao || auto.protocolo || "").trim();
  const autoId = String(auto.autoId || "").replace(/^0+/, "");
  if (notif && autoId) {
    const hit = autuacoesIndex.get(`${notif}#${autoId}`);
    if (hit) return hit;
  }
  if (notif && autuacoesIndex.has(notif)) return autuacoesIndex.get(notif);
  if (autoId) {
    const lista = autuacoesPorAuto.get(autoId) || [];
    if (auto.data) {
      const porData = lista.find((h) => h.data_br === auto.data);
      if (porData) return porData;
    }
    if (lista.length === 1) return lista[0];
  }
  return null;
}

function enriquecerComCatalogos(auto) {
  if (auto.carro && !auto.placa) {
    auto.placa = placaDoCarro(auto.carro);
  }
  if (auto.matricula && !auto.motorista) {
    const func = funcionarioPorMatricula(auto.matricula);
    if (func) auto.motorista = func.nome;
  }

  const hit = catalogoDoAuto(auto);
  if (hit) {
    if (!auto.autuador) auto.autuador = hit.agente || "";
    if (!auto.motivo) auto.motivo = hit.motivo || "";
    if (!auto.data) auto.data = hit.data_br || "";
    if (!auto.notificacao) auto.notificacao = hit.notificacao || "";
    if (!auto.protocolo) auto.protocolo = hit.notificacao || "";
    if (!auto.autoId) auto.autoId = String(hit.auto || "").replace(/^0+/, "");
    const mPart = String(hit.auto || auto.autoId || "").padStart(7, "0");
    const artigo = String(hit.artigo || "").replace(/^Infração\s*n[ºo°.]?\s*/i, "").trim();
    auto.autoNumero = artigo
      ? `${hit.notificacao}-M${mPart} · ${hit.motivo || ""} · ${artigo}`
      : `${hit.notificacao}-M${mPart}`;
  } else if (auto.notificacao && auto.autoId) {
    auto.protocolo = auto.protocolo || auto.notificacao;
    auto.autoNumero =
      auto.autoNumero || `${auto.notificacao}-M${String(auto.autoId).padStart(7, "0")}`;
  } else if (auto.autoId && !auto.autoNumero) {
    auto.autoNumero = String(auto.autoId).padStart(4, "0");
  }
  if (!auto.protocolo && auto.notificacao) auto.protocolo = auto.notificacao;
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
    protocolo: "",
    autoId: "",
    data: "",
    horario: "",
    carro: "",
    placa: "",
    linha: "",
    local: "",
    matricula: "",
    motorista: "",
    autuador: "",
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
  return page.getTextContent().then((tc) => {
    const lines = [];
    let lastY = null;
    let buf = "";
    for (const it of tc.items) {
      const y = Math.round((it.transform && it.transform[5]) || 0);
      const str = String(it.str || "");
      if (lastY != null && Math.abs(y - lastY) > 5) {
        if (buf.trim()) lines.push(buf.trim());
        buf = str;
      } else {
        buf += (buf && str ? " " : "") + str;
      }
      lastY = y;
    }
    if (buf.trim()) lines.push(buf.trim());
    return lines.join("\n");
  });
}

function normalizarDigitosOcr(valor) {
  return String(valor || "")
    .toUpperCase()
    .replace(/[LÍÌÎI|!T]/g, "1")
    .replace(/[OQD]/g, "0")
    .replace(/[S]/g, "5")
    .replace(/[Z]/g, "2")
    .replace(/[B]/g, "8")
    .replace(/[G]/g, "6")
    .replace(/[A]/g, "4")
    .replace(/[^0-9/]/g, "");
}

function extrairNotificacao(text) {
  const linhas = String(text || "").split("\n").slice(0, 22);
  for (const ln of linhas) {
    if (!/norr|notif|uorr|horrr|n["oº°]/i.test(ln) && !/\d{4,5}\s*\/\s*20/.test(ln)) continue;
    const apos = ln.split(/n["oº°.]{0,4}\s*/i).pop() || ln;
    const bruto = normalizarDigitosOcr(apos);
    const m = bruto.match(/(\d{4,5}\/20\d{2})/);
    if (m && autuacoesIndex.has(m[1])) return m[1];
    if (m && Number(m[1].slice(0, 4)) >= 3000) return m[1];
  }
  const all = normalizarDigitosOcr(String(text || "").slice(0, 900));
  const m = all.match(/(\d{5}\/20\d{2})/);
  return m && autuacoesIndex.has(m[1]) ? m[1] : "";
}

function extrairProtocoloRequerimento(text) {
  const m = String(text || "").match(/protocolado\s+sob\s+n[oº°.]?\s*([0-9A-Za-z]{8,})/i);
  return m ? m[1].replace(/[^0-9A-Za-z]/g, "") : "";
}

function extrairAutoId(textNotif, textAuto) {
  const notif = String(textNotif || "");
  const auto = String(textAuto || "");
  const cands = [];
  const infraRe = /[IiÍl1]nfra[cçãa][\s\S]{0,90}?(?:n[oº°a."]+\s*|no\s+)0*(\d{2,6})/gi;
  let m;
  while ((m = infraRe.exec(notif))) cands.push(String(m[1]).replace(/^0+/, ""));
  const stampRe = /\b0{3,}(\d{2,4})\b/g;
  while ((m = stampRe.exec(auto))) {
    const n = String(m[1]).replace(/^0+/, "");
    if (n && n !== "1") cands.push(n);
  }
  const seen = [];
  for (const c of cands) {
    if (c && !seen.includes(c)) seen.push(c);
  }
  for (const c of seen) {
    const lista = autuacoesPorAuto.get(c) || [];
    if (lista.length === 1) return c;
  }
  for (const c of seen) {
    if (autuacoesPorAuto.has(c)) return c;
  }
  return seen.find((c) => Number(c) >= 40 && Number(c) < 20000) || seen[0] || "";
}

function extrairDataLavratura(text) {
  const m = String(text || "").match(/Que em\s+(\d{1,2})[/.](\d{1,2})[/.](\d{4})/i);
  if (!m) {
    const d = String(text || "").match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/);
    return d ? `${d[1]}/${d[2]}/${d[3]}` : "";
  }
  let dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = m[3];
  if (dia > 31) dia = Number(String(m[1]).replace(/^7/, "1"));
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return "";
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}

function extrairCarroLinha(text) {
  const t = String(text || "");
  const linhaMatch =
    t.match(/\bLinha\s*[:.\-]?\s*(\d{2,4})\b/i) ||
    t.match(/\bL\.?\s*(\d{2,4})\b/);
  const carroMatch = t.match(/\b(?:Carro|Ve[ií]culo|Prefixo)\s*[:.\-]?\s*(\d{3,4})\b/i);
  let carro = carroMatch ? carroMatch[1] : "";
  let linha = linhaMatch ? linhaMatch[1] : "";
  if (!carro) {
    const frota = window.CIOP_VEICULOS_PLACA || {};
    const nums = [...t.matchAll(/\b(\d{4})\b/g)].map((x) => x[1]);
    carro =
      nums.find((n) => frota[n] && !["1213", "3379", "7900", "1082", "2024", "2026"].includes(n)) ||
      "";
  }
  if (linha === "1213" || linha === "2026" || linha === "1082") linha = "";
  return { carro, linha };
}

function extractAutoHints(textNotif, textAuto = "") {
  const t = `${textNotif || ""}\n${textAuto || ""}`;
  let notificacao = extrairNotificacao(textNotif) || extrairNotificacao(t);
  let autoId = extrairAutoId(textNotif, textAuto);
  const protocoloReq = extrairProtocoloRequerimento(t);
  let data = extrairDataLavratura(textNotif);

  if (notificacao && autuacoesIndex.has(notificacao)) {
    const hit = autuacoesIndex.get(notificacao);
    if (!autoId) autoId = String(hit.auto || "").replace(/^0+/, "");
    if (!data) data = hit.data_br || "";
  }
  if (autoId && autuacoesPorAuto.has(autoId)) {
    const lista = autuacoesPorAuto.get(autoId);
    const hit = (data && lista.find((h) => h.data_br === data)) || (lista.length === 1 ? lista[0] : null);
    if (hit) {
      notificacao = notificacao || hit.notificacao;
      data = data || hit.data_br;
    }
  }

  const hourMatch =
    t.match(/\b(?:[àa]s\s*)?(\d{1,2})[h:](\d{2})\b/i) ||
    t.match(/\b(\d{2}):(\d{2})\b/);
  const horario = hourMatch
    ? `${String(hourMatch[1]).padStart(2, "0")}:${hourMatch[2]}`
    : "";

  const { carro, linha } = extrairCarroLinha(t);

  const motivoKeys = [
    ["ATRASO", /atraso/i],
    ["SUPRESSÃO", /supress/i],
    ["PERMANÊNCIA", /perman/i],
    ["NÃO REALIZOU LOGIN", /login|autentica|n[aã]o\s+realizou/i],
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

  const protocolo = notificacao || protocoloReq || "";
  let autoNumero = "";
  if (notificacao && autoId) {
    autoNumero = `${notificacao}-M${String(autoId).padStart(7, "0")}`;
  } else if (autoId) {
    autoNumero = String(autoId).padStart(4, "0");
  }

  return {
    data,
    horario,
    linha,
    carro,
    motivo,
    local,
    notificacao,
    protocolo,
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
        protocolo: hints.protocolo,
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
  let hints = {};
  try {
    const page = await pdf.getPage(1);
    hints = extractAutoHints(await extractPageText(page), "");
  } catch (_) {}
  const item = enriquecerComCatalogos(
    blankAuto({
      lote: file.name,
      origem: "evidencia-pdf",
      data: parsed.data || hints.data || "",
      motivo: parsed.motivo || hints.motivo || "",
      carro: parsed.carro || hints.carro || "",
      linha: parsed.linha || hints.linha || "",
      matricula: parsed.matricula || "",
      autoNumero: hints.autoNumero || "",
      notificacao: hints.notificacao || "",
      protocolo: hints.protocolo || "",
      autoId: hints.autoId || "",
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
  auto.protocolo = $("fProtocolo") ? $("fProtocolo").value.trim() : auto.protocolo;
  if (auto.protocolo && !auto.notificacao) auto.notificacao = auto.protocolo;
  auto.data = $("fData").value.trim();
  auto.horario = $("fHorario").value.trim();
  auto.carro = $("fCarro").value.trim();
  auto.placa = $("fPlaca").value.trim();
  auto.linha = $("fLinha").value.trim();
  auto.local = $("fLocal").value.trim();
  auto.matricula = $("fMatricula").value.trim();
  auto.motorista = $("fMotorista").value.trim();
  auto.autuador = $("fAutuador") ? $("fAutuador").value.trim() : auto.autuador;
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
  if ($("fProtocolo")) $("fProtocolo").value = auto.protocolo || auto.notificacao || "";
  $("fData").value = auto.data || "";
  $("fHorario").value = auto.horario || "";
  $("fCarro").value = auto.carro || "";
  $("fPlaca").value = auto.placa || "";
  $("fLinha").value = auto.linha || "";
  $("fLocal").value = auto.local || "";
  $("fMatricula").value = auto.matricula || "";
  $("fMotorista").value = auto.motorista || "";
  if ($("fAutuador")) $("fAutuador").value = auto.autuador || "";
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
      return [a.carro, a.linha, a.autoNumero, a.protocolo, a.notificacao, a.motivo, a.motorista, a.autuador, a.data, a.lote]
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
        <strong>${a.carro || (a.autoId ? `Auto ${a.autoId}` : "—")}</strong>
        <span class="pill">${statusLabel(a.status)}</span>
      </div>
      <div class="auto-item-meta">${a.data || "sem data"} · Carro ${a.carro || "—"} · Linha ${a.linha || "—"}</div>
      <div class="auto-item-sub">${a.protocolo || a.notificacao ? `Prot. ${a.protocolo || a.notificacao}` : ""} ${a.autoId ? `· Auto ${a.autoId}` : a.autoNumero ? `· ${a.autoNumero}` : a.motivo || a.lote || "Sem número"}</div>
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
  setStatus("Salvo neste computador. Registrando na planilha...");
  try {
    const planilha = await registrarNaPlanilha(auto);
    auto.planilhaLinha = planilha.linha;
    auto.planilhaAcao = planilha.acao;
    await dbPut(auto);
    const acao = planilha.acao === "update" ? "atualizado" : "incluído";
    setStatus(`Salvo na planilha (linha ${planilha.linha}, ${acao}). Gerando PDF...`);
  } catch (err) {
    console.warn(err);
    setStatus(
      `Salvo neste computador, mas a planilha não gravou: ${err.message || err}. Gerando PDF...`,
      true
    );
  }
  try {
    await baixarPdfAuto(auto);
    setStatus(`PDF baixado: ${nomeArquivoPdf(auto)}`);
  } catch (err) {
    console.warn(err);
    setStatus(`Salvo, mas o PDF não saiu: ${err.message || err}`, true);
  }
}

function payloadPlanilha(auto) {
  const usuario = window.portalUsuario || {};
  return {
    evidencias: "1",
    action: "upsert",
    notificacao: auto.protocolo || auto.notificacao || "",
    protocolo: auto.protocolo || auto.notificacao || "",
    auto: String(auto.autoId || "").replace(/^0+/, ""),
    autoId: String(auto.autoId || "").replace(/^0+/, ""),
    data: auto.data || "",
    motivo: auto.motivo || "",
    carro: auto.carro || "",
    linha: auto.linha || "",
    placa: auto.placa || "",
    horario: auto.horario || "",
    motorista: auto.motorista || "",
    autuador: auto.autuador || "",
    agente: auto.autuador || "",
    matricula: auto.matricula || "",
    local: auto.local || "",
    usuario: usuario.email || usuario.nome || ""
  };
}

async function registrarNaPlanilha(auto) {
  const dados = payloadPlanilha(auto);
  if (!dados.notificacao && !dados.auto) {
    throw new Error("preencha o protocolo/notificação ou o número do auto");
  }
  let payload = null;
  try {
    const res = await fetch(AUTUACOES_PLANILHA_API, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(dados)
    });
    const texto = await res.text();
    payload = JSON.parse(texto);
  } catch (_) {
    const qs = new URLSearchParams(dados);
    const res = await fetch(`${AUTUACOES_PLANILHA_API}?${qs}`, { cache: "no-store" });
    payload = await res.json();
  }
  if (!payload || payload.status === "error" || payload.ok === false || !payload.linha) {
    throw new Error(payload?.message || payload?.erro || "Apps Script ainda sem gravação (reimplante o Web App)");
  }
  return payload;
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
        <div class="sheet-brand-logo">
          <img src="../assets/img/CIOP Sem Fundo.png" alt="CIOP">
        </div>
        <div class="sheet-org">
          <p class="sheet-org-kicker">Portal CIOP · TCGL Operações</p>
          <p class="sheet-org-title">Centro de Inteligência Operacional<br>Londrina — PR</p>
        </div>
        <div class="sheet-brand-logo is-tcgl">
          <img src="../assets/img/LOGO_TCGL-removebg-preview.png" alt="TCGL">
        </div>
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
        <div class="span-2"><span>Protocolo</span><b>${escapeHtml(auto.protocolo || auto.notificacao)}</b></div>
        <div class="span-2"><span>Local</span><b>${escapeHtml(auto.local)}</b></div>
        <div><span>Matrícula</span><b>${escapeHtml(auto.matricula)}</b></div>
        <div class="span-2"><span>Motorista</span><b>${escapeHtml(auto.motorista)}</b></div>
        <div class="span-2"><span>Autuador</span><b>${escapeHtml(auto.autuador)}</b></div>
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

function nomeArquivoPdf(auto) {
  const data = String(auto.data || "sem-data").replace(/\//g, ".");
  const mot = String(auto.motivo || "evidencia").replace(/[\\/:*?"<>|]/g, " ").trim();
  const carro = auto.carro || "s-carro";
  const linha = auto.linha || "s-linha";
  const autoN = auto.autoId || auto.protocolo || auto.id;
  return `${data} - ${mot} - Carro ${carro} - Linha ${linha} - Auto ${autoN}.pdf`.replace(/\s+/g, " ");
}

function sanitizarNome(valor) {
  return String(valor || "lote")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function carregarScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const ja = document.querySelector(`script[data-portal-src="${src}"]`);
    if (ja) {
      if (ja.dataset.loaded === "1") return resolve();
      ja.addEventListener("load", () => resolve());
      ja.addEventListener("error", () => reject(new Error("Falha ao carregar " + src)));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.dataset.portalSrc = src;
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => reject(new Error("Falha ao carregar " + src));
    document.head.appendChild(s);
  });
}

async function garantirLibsPdf(comZip = false) {
  if (!window.jspdf?.jsPDF) {
    await carregarScriptOnce("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js");
  }
  if (!window.html2canvas) {
    await carregarScriptOnce("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
  }
  if (comZip && !window.JSZip) {
    await carregarScriptOnce("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js");
  }
  if (!window.jspdf?.jsPDF || !window.html2canvas) {
    throw new Error("Bibliotecas de PDF não carregaram.");
  }
  if (comZip && !window.JSZip) throw new Error("JSZip não carregou.");
}

function aguardarImagens(raiz) {
  const imgs = [...raiz.querySelectorAll("img")];
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
}

function montarOffscreenFicha(auto) {
  let host = $("pdfOffscreen");
  if (!host) {
    host = document.createElement("div");
    host.id = "pdfOffscreen";
    document.body.appendChild(host);
  }
  host.innerHTML = buildSheetHtml(auto);
  const art = host.querySelector(".sheet-a4");
  art.style.width = "794px";
  art.style.background = "#fff";
  art.style.overflow = "visible";
  art.querySelectorAll(".sheet-brand, .sheet-brand-logo, .sheet-brand-logo img").forEach((el) => {
    el.style.background = "#fff";
    el.style.overflow = "visible";
  });
  return { host, art };
}

async function pdfBlobDoAuto(auto) {
  await garantirLibsPdf(false);
  const { host, art } = montarOffscreenFicha(auto);
  await aguardarImagens(art);
  await new Promise((r) => requestAnimationFrame(() => r()));
  const canvas = await window.html2canvas(art, {
    scale: 2,
    backgroundColor: "#ffffff",
    logging: false,
    useCORS: true,
    windowWidth: art.scrollWidth,
    windowHeight: art.scrollHeight,
    onclone(doc) {
      const clone = doc.getElementById("pdfOffscreen");
      if (!clone) return;
      clone.style.background = "#fff";
      clone.querySelectorAll(".sheet-a4, .sheet-brand, .sheet-brand-logo, img").forEach((el) => {
        el.style.background = "#ffffff";
        el.style.overflow = "visible";
      });
    }
  });
  host.innerHTML = "";
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * pageW) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.78);
  const sliceHpx = (pageH / imgH) * canvas.height;
  let offset = 0;
  let pagina = 0;
  while (offset < canvas.height - 2) {
    const h = Math.min(sliceHpx, canvas.height - offset);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.max(1, Math.round(h));
    slice.getContext("2d").drawImage(canvas, 0, offset, canvas.width, h, 0, 0, canvas.width, h);
    const sliceHmm = (slice.height * pageW) / canvas.width;
    if (pagina > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.78), "JPEG", 0, 0, imgW, sliceHmm, undefined, "FAST");
    offset += h;
    pagina += 1;
    if (pagina > 20) break;
  }
  return pdf.output("blob");
}

function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function baixarPdfAuto(auto) {
  const blob = await pdfBlobDoAuto(auto);
  baixarBlob(blob, nomeArquivoPdf(auto));
  return blob;
}

function autosDoLote(auto) {
  const lote = String(auto?.lote || "").trim();
  if (!lote) return autos.slice();
  const doLote = autos.filter((a) => a.lote === lote);
  return doLote.length ? doLote : autos.slice();
}

function loteTodoFinalizado(auto) {
  const grupo = autosDoLote(auto);
  return grupo.length > 0 && grupo.every((a) => a.status === "finalizado");
}

async function baixarPastaPdfs(lista) {
  const grupo = lista && lista.length ? lista : autos.slice();
  if (!grupo.length) throw new Error("Não há evidências para exportar.");
  await garantirLibsPdf(true);
  const zip = new window.JSZip();
  const pasta = zip.folder(sanitizarNome(grupo[0].lote || "Evidencias-CMTU")) || zip;
  for (let i = 0; i < grupo.length; i++) {
    const item = grupo[i];
    setStatus(`Gerando PDF ${i + 1}/${grupo.length}: ${item.carro || item.autoId || item.id}...`);
    const blob = await pdfBlobDoAuto(item);
    pasta.file(nomeArquivoPdf(item), blob);
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const nomeZip = `${sanitizarNome(grupo[0].lote || "Evidencias-CMTU")}.zip`;
  baixarBlob(zipBlob, nomeZip);
  setStatus(`Pasta baixada: ${nomeZip} (${grupo.length} PDFs, uma folha por página).`);
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
      body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;background:#fff}
      .sheet-a4{border:1px solid #d5deee;background:#fff;overflow:visible}
      .sheet-brand{display:grid;grid-template-columns:minmax(148px,22%) minmax(0,1fr) minmax(108px,18%);gap:16px;align-items:center;padding:16px 18px 14px;background:#fff;position:relative;overflow:visible}
      .sheet-brand::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,#06245c,#0b3a8a 52%,#ff6b00)}
      .sheet-brand-logo{display:flex;align-items:center;height:58px;padding:4px 8px;background:#fff;overflow:visible}
      .sheet-brand-logo img{display:block;height:50px;width:auto;max-width:100%;object-fit:contain;object-position:left center;background:#fff}
      .sheet-brand-logo.is-tcgl{justify-content:flex-end}
      .sheet-brand-logo.is-tcgl img{object-position:right center;height:52px}
      .sheet-org{text-align:center;color:#06245c}
      .sheet-org-kicker{margin:0 0 4px;font-size:9px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#ff6b00}
      .sheet-org-title{margin:0;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;line-height:1.35}
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
      .sheet-gallery{margin:10px 12px;min-height:160px;border:1px dashed #c9d4e5;padding:8px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;background:#fff}
      .sheet-gallery.is-empty{min-height:0;border:0;padding:0;margin:6px 12px}
      .sheet-gallery img{width:100%;border:1px solid #dfe5ef}
      .sheet-gallery-empty{display:none}
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
  if (loteTodoFinalizado(auto)) {
    setStatus("Lote concluído. Montando pasta com todos os PDFs...");
    try {
      await baixarPastaPdfs(autosDoLote(auto));
    } catch (err) {
      console.warn(err);
      setStatus(`Lote finalizado, mas a pasta não saiu: ${err.message || err}`, true);
    }
  } else {
    const grupo = autosDoLote(auto);
    const falta = grupo.filter((a) => a.status !== "finalizado").length;
    setStatus(`Evidência finalizada. Faltam ${falta} neste lote. Ao terminar todas, a pasta de PDFs é baixada.`);
  }
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

function dataChave(valor) {
  const m = String(valor || "").match(/(\d{2})[./](\d{2})[./](\d{4})/);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : "";
}

function acharAutoDoLote(lote, parsed) {
  if (!parsed || !lote.length) return null;
  const data = dataChave(parsed.data);
  const mot = String(parsed.motivo || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .slice(0, 6);
  const doDia = lote.filter((a) => data && dataChave(a.data) === data);
  const base = doDia.length ? doDia : lote;
  const porMotivo = mot
    ? base.filter((a) =>
        String(a.motivo || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .includes(mot)
      )
    : base;
  const lista = (porMotivo.length ? porMotivo : base).filter((a) => !a.carro);
  return lista[0] || null;
}

async function handleFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  setStatus("Processando arquivos...");
  const loteCriado = [];
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
        loteCriado.push(...created);
        autos = created.concat(autos);
        selectedId = created[0]?.id || selectedId;
        if (selectedId) fillForm(selected());
        setStatus(`${created.length} autos criados a partir da notificação.`);
      } else {
        const parsed = parseEvidenceFilename(file.name);
        const alvo = acharAutoDoLote(loteCriado, parsed);
        if (alvo && parsed) {
          alvo.carro = parsed.carro || alvo.carro;
          alvo.linha = parsed.linha || alvo.linha;
          alvo.matricula = parsed.matricula || alvo.matricula;
          alvo.motivo = parsed.motivo || alvo.motivo;
          alvo.data = parsed.data || alvo.data;
          alvo.placa = placaDoCarro(alvo.carro) || alvo.placa;
          const func = funcionarioPorMatricula(alvo.matricula);
          if (func) alvo.motorista = func.nome;
          const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
          const shot = await renderPdfPage(pdf, 1, 1.15);
          alvo.imagens.push({ id: uid(), dataUrl: shot, tipo: "evidencia" });
          alvo.status = computeStatus(alvo);
          await dbPut(alvo);
          selectedId = alvo.id;
          fillForm(alvo);
          setStatus(`Evidência ligada ao auto ${alvo.autoId || alvo.protocolo}: carro ${alvo.carro}, linha ${alvo.linha}.`);
        } else {
          const item = await importEvidencePdf(file);
          autos.unshift(item);
          selectedId = item.id;
          fillForm(item);
          setStatus(`Evidência importada: ${file.name}`);
        }
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
    "fProtocolo",
    "fData",
    "fHorario",
    "fCarro",
    "fPlaca",
    "fLinha",
    "fLocal",
    "fMatricula",
    "fMotorista",
    "fAutuador",
    "fMotivo",
    "fTexto1",
    "fTexto2",
    "fTexto3",
    "fObs"
  ].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", () => {
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
  wireDropZone($("dropImport"), $("fileImport"), handleFiles);
  wireDropZone($("dropImages"), $("fileImages"), addImages);

  autos = (await dbGetAll()).map((a) => enriquecerComCatalogos(a));
  renderList();
  if (autos[0]) selectAuto(autos[0].id);
  else {
    $("editorEmpty").hidden = false;
    $("editorPanel").hidden = true;
    if ($("actionsBar")) $("actionsBar").hidden = true;
  }

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
  $("btnPastaPdfs")?.addEventListener("click", async () => {
    const atual = selected();
    try {
      await baixarPastaPdfs(autosDoLote(atual));
    } catch (err) {
      setStatus(`Não foi possível montar a pasta: ${err.message || err}`, true);
    }
  });
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
