(function (global) {
"use strict";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
const nInt = (n) => Number(n || 0).toLocaleString("pt-BR");

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

function isoDe(valor) {
  const t = String(valor || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor.toISOString().slice(0, 10);
  return "";
}

function normalizar(row) {
  if (!row || typeof row !== "object") return null;
  const dataIso = isoDe(pick(row, ["data_iso", "data_ref", "data", "date", "event_date", "dia"]));
  const dataBr = dataIso ? dataIso.split("-").reverse().join("/") : String(pick(row, ["data", "date"]));
  return {
    incidentId: String(pick(row, ["incidentId", "incident_id", "id", "numero", "event_id"])),
    data: dataBr,
    dataIso,
    hora: String(pick(row, ["hora", "time", "hora_evento", "event_time"])).slice(0, 8),
    veiculo: String(pick(row, ["veiculo", "vehicle", "bus", "prefixo"])),
    linha: String(pick(row, ["linha", "route", "line", "route_name"])),
    tipo: String(pick(row, ["tipo", "type", "event_type", "tipoOriginal", "natureza"])),
    estado: String(pick(row, ["estado", "status", "state"])),
    criadoPor: String(pick(row, ["criadoPor", "created_by", "analista", "criado_por"])),
    proprietario: String(pick(row, ["proprietario", "owner", "agente"])),
    natureOfProblem: String(pick(row, ["natureOfProblem", "natureza", "problem", "descricao"])),
    instructions: String(pick(row, ["instructions", "instrucoes", "comments", "observacao"])),
    motorista: String(pick(row, ["motorista", "driver", "operador"])),
    motoristaNr: String(pick(row, ["motoristaNr", "driver_nr", "matricula"])),
    departamento: String(pick(row, ["departamento", "department"]))
  };
}

function chave(row) {
  return row.incidentId || [row.dataIso, row.hora, row.veiculo, row.linha].join("|");
}

function mesclar(listas) {
  const mapa = new Map();
  listas.forEach((lista) => {
    (lista || []).forEach((row) => {
      const n = normalizar(row);
      if (!n) return;
      mapa.set(chave(n), n);
    });
  });
  return [...mapa.values()].sort((a, b) =>
    String(b.dataIso).localeCompare(String(a.dataIso)) || String(b.hora).localeCompare(String(a.hora))
  );
}

const state = { all: [], filtered: [], origem: "arquivo", page: 1, pageSize: 100, seq: 0 };

function status(msg) {
  const el = $("statusLine");
  if (el) el.textContent = msg;
}

function aplicar(lista, origem) {
  state.all = lista;
  state.origem = origem || state.origem;
  preencherFiltros();
  filtrar();
}

function preencherFiltros() {
  const tipos = [...new Set(state.all.map((r) => r.tipo).filter(Boolean))].sort();
  const linhas = [...new Set(state.all.map((r) => r.linha).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { numeric: true })
  );
  const selT = $("fTipo"), selL = $("fLinha");
  const tVal = selT.value, lVal = selL.value;
  selT.innerHTML = '<option value="">Todos</option>' + tipos.map((t) => `<option>${esc(t)}</option>`).join("");
  selL.innerHTML = '<option value="">Todas</option>' + linhas.map((t) => `<option>${esc(t)}</option>`).join("");
  if ([...selT.options].some((o) => o.value === tVal)) selT.value = tVal;
  if ([...selL.options].some((o) => o.value === lVal)) selL.value = lVal;
}

function filtrar() {
  const q = ($("fBusca").value || "").trim().toLowerCase();
  const tipo = $("fTipo").value;
  const linha = $("fLinha").value;
  const de = $("fDe").value;
  const ate = $("fAte").value;
  state.filtered = state.all.filter((r) => {
    if (tipo && r.tipo !== tipo) return false;
    if (linha && r.linha !== linha) return false;
    if (de && r.dataIso && r.dataIso < de) return false;
    if (ate && r.dataIso && r.dataIso > ate) return false;
    if (!q) return true;
    const blob = `${r.incidentId} ${r.veiculo} ${r.linha} ${r.tipo} ${r.motorista} ${r.criadoPor} ${r.natureOfProblem}`.toLowerCase();
    return blob.includes(q);
  });
  state.page = 1;
  render();
}

function renderKpis() {
  const lista = state.filtered;
  const porTipo = new Map();
  const porLinha = new Map();
  lista.forEach((r) => {
    if (r.tipo) porTipo.set(r.tipo, (porTipo.get(r.tipo) || 0) + 1);
    if (r.linha) porLinha.set(r.linha, (porLinha.get(r.linha) || 0) + 1);
  });
  const topTipo = [...porTipo.entries()].sort((a, b) => b[1] - a[1])[0];
  const topLinha = [...porLinha.entries()].sort((a, b) => b[1] - a[1])[0];
  $("kpis").innerHTML = `
    <div class="kpi"><div class="label">Incidentes</div><div class="value">${nInt(lista.length)}</div>
      <div class="sub">${nInt(state.all.length)} no recorte carregado · ${esc(state.origem)}</div></div>
    <div class="kpi"><div class="label">Tipos</div><div class="value">${nInt(porTipo.size)}</div>
      <div class="sub">${topTipo ? esc(topTipo[0]) + " · " + nInt(topTipo[1]) : "—"}</div></div>
    <div class="kpi"><div class="label">Linha com mais registros</div><div class="value">${topLinha ? esc(topLinha[0]) : "—"}</div>
      <div class="sub">${topLinha ? nInt(topLinha[1]) + " incidentes" : "sem recorte"}</div></div>`;
}

function renderTabela() {
  const ini = (state.page - 1) * state.pageSize;
  const fatia = state.filtered.slice(ini, ini + state.pageSize);
  const tb = $("tabelaBody");
  if (!fatia.length) {
    tb.innerHTML = '<tr><td colspan="10" class="aviso">Nenhum incidente para os filtros.</td></tr>';
  } else {
    tb.innerHTML = fatia.map((r) => `<tr>
      <td>${esc(r.incidentId)}</td>
      <td>${esc(r.data)}</td>
      <td>${esc(r.hora)}</td>
      <td>${esc(r.veiculo)}</td>
      <td class="txt">${esc(r.linha)}</td>
      <td class="txt">${esc(r.tipo)}</td>
      <td class="txt">${esc(r.motorista || r.motoristaNr)}</td>
      <td class="txt">${esc(r.criadoPor)}</td>
      <td>${esc(r.estado)}</td>
      <td class="txt">${esc(r.natureOfProblem)}</td>
    </tr>`).join("");
  }
  const totalPag = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  $("pageInfo").textContent = `${nInt(state.filtered.length)} registros · página ${state.page} de ${totalPag}`;
  $("prevPage").disabled = state.page <= 1;
  $("nextPage").disabled = state.page >= totalPag;
}

function render() {
  renderKpis();
  renderTabela();
}

function csvValue(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function baixarCsv() {
  const cab = ["ID", "Data", "Hora", "Veículo", "Linha", "Tipo", "Motorista", "Analista", "Status", "Natureza"];
  const linhas = state.filtered.map((r) => [r.incidentId, r.data, r.hora, r.veiculo, r.linha, r.tipo, r.motorista, r.criadoPor, r.estado, r.natureOfProblem]);
  const csv = [cab, ...linhas].map((l) => l.map(csvValue).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = "incidentes-cad.csv";
  a.click();
}

async function jsonCad() {
  try {
    const res = await fetch("../assets/data/incidentes-cad.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return { lista: [], origem: "arquivo 002" };
    const payload = await res.json();
    const lista = Array.isArray(payload.incidentes) ? payload.incidentes : (Array.isArray(payload) ? payload : []);
    return { lista, origem: "arquivo 002", payload };
  } catch (_) {
    return { lista: [], origem: "arquivo 002" };
  }
}

async function iniciar() {
  const seq = ++state.seq;
  status("Carregando JSON do 002…");
  const arq = await jsonCad();
  if (seq !== state.seq) return;
  aplicar(mesclar([arq.lista]), arq.origem);
  status(arq.lista.length
    ? `${nInt(arq.lista.length)} registros no JSON 002 · buscando o banco…`
    : "JSON 002 vazio · buscando o relatório 002 no banco…");

  const segundoPlano = async () => {
    try {
      const cfg = await import("./portal-aws-config.js");
      if (typeof cfg.initPortalAwsRuntime === "function") await cfg.initPortalAwsRuntime();
      if (!cfg.awsApiEnabled()) {
        status(`${nInt(state.all.length)} registros · ${state.origem}`);
        return;
      }
      const token = await cfg.firebaseIdToken();
      const cad = await cfg.awsFetch("/cr0108/cad", { token });
      if (seq !== state.seq) return;
      const itens = cad && cad.itens ? cad.itens : [];
      if (itens.length) {
        aplicar(mesclar([itens]), "banco 002" + (cad.tabela ? " · " + cad.tabela : ""));
        status(`${nInt(state.all.length)} incidentes do relatório 002`);
      } else {
        status(`${nInt(state.all.length)} registros · ${state.origem}` + (cad && cad.tabela == null ? " · tabela 002 ainda não encontrada" : ""));
      }
    } catch (err) {
      console.info("Incidentes CAD: banco 002 não veio.", err && err.message);
      status(`${nInt(state.all.length)} registros · ${state.origem}`);
    }
  };

  if (window.portalUsuarioValidado) segundoPlano();
  else window.addEventListener("portal:usuario-validado", segundoPlano, { once: true });
}

function ligar() {
  ["fBusca"].forEach((id) => $(id).addEventListener("input", filtrar));
  ["fTipo", "fLinha", "fDe", "fAte"].forEach((id) => $(id).addEventListener("change", filtrar));
  $("btnLimpar").addEventListener("click", () => {
    $("fBusca").value = ""; $("fTipo").value = ""; $("fLinha").value = "";
    $("fDe").value = ""; $("fAte").value = "";
    filtrar();
  });
  $("btnCsv").addEventListener("click", baixarCsv);
  $("pageSize").addEventListener("change", () => {
    state.pageSize = Number($("pageSize").value) || 100;
    state.page = 1;
    renderTabela();
  });
  $("prevPage").addEventListener("click", () => { if (state.page > 1) { state.page -= 1; renderTabela(); } });
  $("nextPage").addEventListener("click", () => {
    const totalPag = Math.ceil(state.filtered.length / state.pageSize);
    if (state.page < totalPag) { state.page += 1; renderTabela(); }
  });
}

global.IncidentesCad = { iniciar, ligar };
})(window);
