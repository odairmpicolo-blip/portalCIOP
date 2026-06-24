/**
 * Leitura e normalização da planilha de Terminais Agora (Node + portal).
 */

export const SHEET_ID = "1ndvKADOPINtmO-i3UyNTj0q7a4VGQKE77-LiLiQj7bg";
export const GID_DADOS = "960902644";
export const GID_PROGRAMACAO = "1037933022";
export const BASE_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=`;

export const CAMPOS = {
  nome: ["nome", "pessoa", "colaborador", "funcionario", "funcionário", "agente", "fiscal", "operador", "nome completo"],
  matricula: ["matricula", "matrícula", "codigo", "código", "id", "registro", "regist"],
  email: ["email", "e-mail", "mail"],
  cargo: ["cargo", "função", "funcao", "atividade", "perfil"],
  equipe: ["equipe", "turno", "grupo"],
  telefone: ["telefone", "celular", "contato", "fone"],
  data: ["data", "dia", "dt"],
  horario: ["horario", "horário", "periodo", "período", "escala"],
  inicio: ["inicio", "início", "hora inicio", "hora início", "entrada", "das"],
  fim: ["fim", "termino", "término", "saida", "saída", "ate", "até"],
  terminal: ["terminal", "local", "posto", "ponto", "base", "localizacao", "localização"],
  observacao: ["observacao", "observação", "obs", "comentario", "comentário", "nota"]
};

export const TERMINAIS_PADRAO = [
  { ordem: 1, nome: "Terminal Central Superior", telefone: "9 8817-3595", aliases: ["terminal central superior", "central superior"] },
  { ordem: 2, nome: "Terminal Central Inferior", telefone: "9 8817-4766", aliases: ["terminal central inferior", "central inferior"] },
  { ordem: 3, nome: "Terminal Vivi Xavier", telefone: "9 8819-6639", aliases: ["terminal vivi xavier", "vivi xavier"] },
  { ordem: 4, nome: "Estação Catuaí", telefone: "9 9955-9341", aliases: ["estacao catuai", "terminal shopping catuai", "shopping catuai", "terminal catuai"] },
  { ordem: 5, nome: "Terminal Ouro Verde", telefone: "9 8822-0705", aliases: ["terminal ouro verde", "ouro verde"] },
  { ordem: 6, nome: "Terminal Milton Gavetti", telefone: "9 8819-1319", aliases: ["terminal milton gavetti", "milton gavetti"] },
  { ordem: 7, nome: "Terminal Acapulco", telefone: "9 9182-5735", aliases: ["terminal acapulco", "acapulco"] },
  { ordem: 8, nome: "Terminal Oeste", telefone: "9 9955-9369", aliases: ["terminal oeste", "terminal regiao oeste", "regiao oeste", "oeste"] }
];

export function normalizarChave(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizarTerminal(texto) {
  return normalizarTexto(texto)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function terminalPadraoInfo(terminal) {
  const chave = normalizarTerminal(terminal);
  return TERMINAIS_PADRAO.find((item) =>
    item.aliases.some((alias) => chave === alias || chave.includes(alias))
  ) || null;
}

export function chaveTerminalComparacao(terminal) {
  const info = terminalPadraoInfo(terminal);
  return info ? `padrao:${info.ordem}` : `raw:${normalizarTerminal(terminal)}`;
}

function inicioDoDia(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function formatHora(date) {
  if (!date || Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "\"") {
      if (quoted && next === "\"") {
        cell += "\"";
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((value) => String(value).trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => String(value).trim() !== "")) rows.push(row);
  return rows;
}

export function csvToObjects(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0].map((header, index) => {
    const value = String(header || "").trim();
    return value || `COL${index + 1}`;
  });
  return rows.slice(1).map((values) => {
    const item = {};
    headers.forEach((header, index) => {
      const value = values[index] || "";
      item[header] = value;
      item[`COL${index + 1}`] = value;
    });
    return item;
  });
}

function normalizarLinha(row) {
  const out = {};
  Object.keys(row || {}).forEach((key) => {
    out[normalizarChave(key)] = String(row[key] ?? "").trim();
  });
  return out;
}

function pegar(row, aliases) {
  for (const alias of aliases) {
    const value = row[normalizarChave(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function pegarColuna(row, index) {
  return String(row[normalizarChave(`COL${index}`)] || "").trim();
}

function parseData(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const parts = text.slice(0, 10).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  let match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? Number(`20${match[3]}`) : Number(match[3]);
    return new Date(year, Number(match[2]) - 1, Number(match[1]));
  }
  match = text.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (match) {
    const now = new Date();
    return new Date(now.getFullYear(), Number(match[2]) - 1, Number(match[1]));
  }
  if (/^\d+(\.\d+)?$/.test(text) && Number(text) > 20000) {
    const excelEpoch = new Date(1899, 11, 30);
    excelEpoch.setDate(excelEpoch.getDate() + Math.floor(Number(text)));
    return inicioDoDia(excelEpoch);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : inicioDoDia(parsed);
}

function extrairHoras(text) {
  const matches = String(text || "").match(/\b([01]?\d|2[0-3])(?:[:hH]([0-5]\d))?\b/g) || [];
  return matches.map((item) => {
    const clean = item.replace(/[hH]/, ":");
    const parts = clean.split(":");
    const hora = Number(parts[0]);
    const minuto = parts[1] === undefined ? 0 : Number(parts[1]);
    return hora * 60 + minuto;
  });
}

function montarIntervalo(data, inicioMin, fimMin) {
  if (!data) return null;
  let inicio = inicioMin;
  let fim = fimMin;
  if (inicio === null && fim === null) {
    inicio = 0;
    fim = 1439;
  } else if (inicio !== null && fim === null) {
    fim = inicio + 59;
  } else if (inicio === null && fim !== null) {
    inicio = Math.max(0, fim - 59);
  }
  const start = new Date(data.getFullYear(), data.getMonth(), data.getDate(), Math.floor(inicio / 60), inicio % 60, 0, 0);
  const end = new Date(data.getFullYear(), data.getMonth(), data.getDate(), Math.floor(fim / 60), fim % 60, 59, 999);
  if (end <= start) end.setDate(end.getDate() + 1);
  return { start, end };
}

function pareceTelefone(value) {
  const text = String(value || "").trim();
  return /\d/.test(text) && !/^terminal\b/i.test(text);
}

export function normalizarDados(rows) {
  const mapa = new Map();
  const mapaTerminalTelefone = new Map();
  const lista = rows.map((row) => {
    const clean = normalizarLinha(row);
    const telefoneFuncionario = pegarColuna(clean, 3);
    const telefoneTerminalValor = pegarColuna(clean, 6);
    const telefone = pareceTelefone(telefoneFuncionario) ? telefoneFuncionario : "";
    const telefoneTerminalLinha = pareceTelefone(telefoneTerminalValor) ? telefoneTerminalValor : "";
    const terminal = pegar(clean, CAMPOS.terminal) || pegarColuna(clean, 5) || (/^terminal\b/i.test(telefoneFuncionario) ? telefoneFuncionario : "");
    const pessoa = {
      nome: pegar(clean, CAMPOS.nome) || pegarColuna(clean, 2),
      matricula: pegar(clean, CAMPOS.matricula) || pegarColuna(clean, 1),
      email: pegar(clean, CAMPOS.email),
      cargo: pegar(clean, CAMPOS.cargo),
      equipe: pegar(clean, CAMPOS.equipe),
      telefone,
      telefoneTerminal: telefoneTerminalLinha,
      terminal
    };
    if (pessoa.nome) mapa.set(`nome:${normalizarTexto(pessoa.nome)}`, pessoa);
    if (pessoa.matricula) mapa.set(`mat:${normalizarTexto(pessoa.matricula)}`, pessoa);
    if (pessoa.email) mapa.set(`email:${normalizarTexto(pessoa.email)}`, pessoa);
    if (pessoa.terminal && pessoa.telefoneTerminal) {
      mapaTerminalTelefone.set(chaveTerminalComparacao(pessoa.terminal), pessoa.telefoneTerminal);
    }
    return pessoa;
  }).filter((pessoa) => pessoa.nome || pessoa.matricula || pessoa.email || pessoa.terminal);
  return { lista, mapa, mapaTerminalTelefone };
}

export function normalizarProgramacao(rows, dadosMapa) {
  return rows.map((row, index) => {
    const clean = normalizarLinha(row);
    const nome = pegar(clean, CAMPOS.nome);
    const matricula = pegar(clean, CAMPOS.matricula);
    const email = pegar(clean, CAMPOS.email);
    const pessoaDados = dadosMapa.get(`mat:${normalizarTexto(matricula)}`)
      || dadosMapa.get(`email:${normalizarTexto(email)}`)
      || dadosMapa.get(`nome:${normalizarTexto(nome)}`)
      || {};
    const data = parseData(pegar(clean, CAMPOS.data));
    const horarioTexto = pegar(clean, CAMPOS.horario);
    const inicioTexto = pegar(clean, CAMPOS.inicio);
    const fimTexto = pegar(clean, CAMPOS.fim);
    let inicioMin = extrairHoras(inicioTexto)[0];
    let fimMin = extrairHoras(fimTexto)[0];
    const horasPeriodo = extrairHoras(horarioTexto);
    if (inicioMin === undefined && horasPeriodo.length) inicioMin = horasPeriodo[0];
    if (fimMin === undefined && horasPeriodo.length > 1) fimMin = horasPeriodo[1];
    const intervalo = montarIntervalo(data, inicioMin === undefined ? null : inicioMin, fimMin === undefined ? null : fimMin);
    const terminal = pegar(clean, CAMPOS.terminal);
    const observacao = pegar(clean, CAMPOS.observacao);
    const item = {
      id: index + 1,
      nome: nome || pessoaDados.nome || "Sem nome",
      matricula: matricula || pessoaDados.matricula || "",
      email: email || pessoaDados.email || "",
      cargo: pegar(clean, CAMPOS.cargo) || pessoaDados.cargo || "",
      equipe: pegar(clean, CAMPOS.equipe) || pessoaDados.equipe || "",
      telefone: pessoaDados.telefone || "",
      terminal: terminal || "Sem terminal",
      observacao,
      data,
      start: intervalo ? intervalo.start : null,
      end: intervalo ? intervalo.end : null,
      horario: horarioTexto || (intervalo ? `${formatHora(intervalo.start)} - ${formatHora(intervalo.end)}` : "")
    };
    return item;
  }).filter((item) => item.data && item.start && item.end && (item.nome || item.terminal));
}

export async function buscarAba(gid) {
  const url = `${BASE_CSV}${gid}&_=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (/<!doctype|<html|Acesse a sua conta|Fazer login|ServiceLogin/i.test(text.slice(0, 1200))) {
    throw new Error("A planilha não está liberada para leitura pública por CSV.");
  }
  return csvToObjects(text);
}

export async function carregarSnapshotPlanilha() {
  const resultado = await Promise.allSettled([buscarAba(GID_DADOS), buscarAba(GID_PROGRAMACAO)]);
  const dadosRows = resultado[0].status === "fulfilled" ? resultado[0].value : [];
  if (resultado[1].status !== "fulfilled") throw resultado[1].reason;
  const dados = normalizarDados(dadosRows);
  const registros = normalizarProgramacao(resultado[1].value, dados.mapa);
  return {
    DADOS: dados.lista,
    REGISTROS: registros,
    mapaTerminalTelefone: dados.mapaTerminalTelefone
  };
}

export function serializarSnapshot(snapshot) {
  return {
    atualizadoEm: new Date().toISOString(),
    fonte: "Planilha Google",
    totalDados: snapshot.DADOS.length,
    totalRegistros: snapshot.REGISTROS.length,
    DADOS: snapshot.DADOS,
    REGISTROS: snapshot.REGISTROS.map((item) => ({
      ...item,
      data: item.data instanceof Date ? item.data.toISOString() : item.data,
      start: item.start instanceof Date ? item.start.toISOString() : item.start,
      end: item.end instanceof Date ? item.end.toISOString() : item.end
    })),
    MAP_TERMINAL_TELEFONE: Object.fromEntries(snapshot.mapaTerminalTelefone)
  };
}

export function reidratarSnapshot(payload) {
  if (!payload) return null;
  return {
    DADOS: payload.DADOS || [],
    MAP_TERMINAL_TELEFONE: payload.MAP_TERMINAL_TELEFONE || {},
    REGISTROS: (payload.REGISTROS || []).map((item) => ({
      ...item,
      data: item.data ? new Date(item.data) : null,
      start: item.start ? new Date(item.start) : null,
      end: item.end ? new Date(item.end) : null
    })),
    atualizadoEm: payload.atualizadoEm || null,
    fonte: payload.fonte || ""
  };
}
