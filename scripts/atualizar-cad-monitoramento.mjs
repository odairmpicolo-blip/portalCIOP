/**
 * Extrai cadastros e programação do CAD (Incident Management) para o Monitoramento.
 * Credenciais: CIOP_INCIDENTES_USUARIO / CIOP_INCIDENTES_SENHA
 *   ou ~/.config/ciop-portal/incidentes.env
 * Uso: node scripts/atualizar-cad-monitoramento.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = process.env.PORTAL_ROOT || path.resolve(scriptDir, "..");
const outDir = path.join(portalRoot, "assets", "data", "cad");
const baseUrl = "https://cioplondrina.com.br/CADIncidentManagement";
const loginUrl = `${baseUrl}/?ReturnUrl=%2fCADIncidentManagement%2fg%2f6ac2842af62b497aa5b0e515ef4b2ce9`;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function carregarEnvLocal() {
  const arquivo = path.join(os.homedir(), ".config", "ciop-portal", "incidentes.env");
  if (!fs.existsSync(arquivo)) return;
  for (const linha of fs.readFileSync(arquivo, "utf8").split("\n")) {
    const t = linha.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

carregarEnvLocal();
const usuario = process.env.CIOP_INCIDENTES_USUARIO || process.env.CAD_USER;
const senha = process.env.CIOP_INCIDENTES_SENHA || process.env.CAD_PASS;
if (!usuario || !senha) {
  throw new Error("Configure CIOP_INCIDENTES_USUARIO e CIOP_INCIDENTES_SENHA.");
}

function cookieHeader(jar) {
  return Array.from(jar.entries()).map(([n, v]) => `${n}=${v}`).join("; ");
}

function storeCookies(jar, response) {
  const cookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  cookies.forEach((cookie) => {
    const [pair] = cookie.split(";");
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  });
}

function field(html, name) {
  const pattern = new RegExp(`name=["']${name}["'][^>]*value=["']([^"']*)["']`, "i");
  return html.match(pattern)?.[1] || "";
}

function guidFrom(html) {
  return html.match(/\/CADIncidentManagement\/g\/([a-f0-9]{32})/i)?.[1] || "";
}

async function request(jar, url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("User-Agent", UA);
  headers.set("Accept-Language", "pt-BR,pt;q=0.9");
  if (jar.size) headers.set("Cookie", cookieHeader(jar));
  const response = await fetch(url, { ...options, headers, redirect: "manual", signal: AbortSignal.timeout(60000) });
  storeCookies(jar, response);
  return response;
}

async function login() {
  const jar = new Map();
  const first = await request(jar, loginUrl);
  const loginHtml = await first.text();
  const guid = guidFrom(loginHtml);
  if (!guid) throw new Error("Não foi possível identificar a sessão de login do CAD.");
  const body = new URLSearchParams();
  body.set("UserName", usuario);
  body.set("Password", senha);
  body.set("TdId", field(loginHtml, "TdId") || "1");
  body.set("OnLoadActionsGuid", field(loginHtml, "OnLoadActionsGuid"));
  const action = `${baseUrl}/g/${guid}/Account/LogOn`;
  const logon = await request(jar, action, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: loginUrl, Origin: "https://cioplondrina.com.br" },
    body
  });
  const html = await logon.text();
  if (/field-validation-error|validation-summary-errors/i.test(html)) {
    throw new Error("Usuário ou senha rejeitados no CAD.");
  }
  const active = guidFrom(html) || guid;
  return { jar, guid: active };
}

function celula(row, col) {
  if (row == null) return "";
  if (Array.isArray(row)) return String(row[0] ?? "").trim();
  if (typeof row === "object") return String(row[col] ?? row.Name ?? row.name ?? "").trim();
  return String(row).trim();
}

async function lista(jar, guid, key, col, length = 8000) {
  const body = new URLSearchParams();
  body.set("DataSourceKey", key);
  body.set("Start", "0");
  body.set("Length", String(length));
  body.append("Columns[]", col);
  const referer = `${baseUrl}/g/${guid}`;
  const response = await request(jar, `${baseUrl}/g/${guid}/Json/GetDataDictionary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: referer,
      Origin: "https://cioplondrina.com.br",
      Accept: "application/json"
    },
    body
  });
  const txt = await response.text();
  let data;
  try {
    data = JSON.parse(txt);
  } catch {
    throw new Error(`${key}: resposta não-JSON (${response.status})`);
  }
  if (data && typeof data === "object" && data.Exception) {
    throw new Error(`${key}: ${String(data.Exception).slice(0, 180)}`);
  }
  if (!Array.isArray(data)) return [];
  return data.map((row) => celula(row, col)).filter(Boolean);
}

function parseVeiculo(nome) {
  const m = String(nome).match(/^#?(\d+)\s*[-–]\s*(.*)$/);
  if (m) return { numero: m[1], nome: nome, modelo: m[2].trim() };
  const soNum = String(nome).match(/^#?(\d+)$/);
  if (soNum) return { numero: soNum[1], nome, modelo: "" };
  return { numero: "", nome, modelo: "" };
}

function parseLinha(nome) {
  const m = String(nome).match(/^(\d{3,4})\s*[:\-]\s*(.*)$/);
  if (m) return { codigo: m[1], nome, descricao: m[2].trim() };
  return { codigo: "", nome, descricao: nome };
}

function agruparProgramacao(linhas, tabelas) {
  const porCodigo = new Map();
  for (const linha of linhas) {
    const codigo = linha.codigo || "—";
    if (!porCodigo.has(codigo)) {
      porCodigo.set(codigo, { codigo, descricao: linha.descricao || linha.nome, tabelas: 0, amostra: [] });
    }
  }
  for (const tab of tabelas) {
    const m = String(tab).match(/^(\d{3})/);
    const codigo = m ? m[1] : "outros";
    if (!porCodigo.has(codigo)) {
      porCodigo.set(codigo, { codigo, descricao: "", tabelas: 0, amostra: [] });
    }
    const item = porCodigo.get(codigo);
    item.tabelas += 1;
    if (item.amostra.length < 12) item.amostra.push(tab);
  }
  return [...porCodigo.values()].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), "pt-BR", { numeric: true }));
}

const { jar, guid } = await login();
console.log("CAD logado, extraindo listas…");

const [
  veiculosNome,
  linhasNome,
  tabelasNome,
  blocosNome,
  garagens,
  divisoes,
  funcionariosNome,
  tiposIncidente,
  departamentos,
  servicos
] = await Promise.all([
  lista(jar, guid, "VehicleListAll", "Name", 3000),
  lista(jar, guid, "RouteListAll", "Name", 2000),
  lista(jar, guid, "RunListAll", "Name", 60000),
  lista(jar, guid, "BlockListAll", "Name", 20000),
  lista(jar, guid, "DepotListAll", "Name", 200),
  lista(jar, guid, "DivisionListAll", "Name", 50),
  lista(jar, guid, "EmployeeListAll", "Name", 4000),
  lista(jar, guid, "IncidentTypeList", "FullName", 400),
  lista(jar, guid, "DepartmentList", "Name", 50),
  lista(jar, guid, "ServiceTypeListAll", "Name", 50)
]);

const veiculos = veiculosNome.map(parseVeiculo);
const linhas = linhasNome.map(parseLinha);
const programacao = agruparProgramacao(linhas, tabelasNome);

const payload = {
  atualizadoEm: new Date().toISOString(),
  fonte: "CAD Incident Management",
  totais: {
    veiculos: veiculos.length,
    linhas: linhas.length,
    tabelas: tabelasNome.length,
    blocos: blocosNome.length,
    funcionarios: funcionariosNome.length,
    garagens: garagens.length,
    tiposIncidente: tiposIncidente.length
  },
  veiculos,
  linhas,
  tabelas: tabelasNome,
  programacao,
  garagens,
  divisoes,
  funcionarios: funcionariosNome,
  tiposIncidente,
  departamentos,
  servicos
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "monitoramento.json"), JSON.stringify(payload));
fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify({ atualizadoEm: payload.atualizadoEm, totais: payload.totais, arquivo: "monitoramento.json" }, null, 2) + "\n"
);
console.log("OK", payload.totais);
