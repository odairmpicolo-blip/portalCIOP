(function (global) {
  "use strict";

  const SHEET_ID = "1zY_BFsidZyF4RnzKTZkZAlmo-Qiz6JEdIEb3E2xoIeA";
  const GID_FUNCIONARIOS = "1931884858";
  const CACHE_KEY = "portal_consulta_funcionarios_v1";
  const CACHE_TTL_MS = 60 * 60 * 1000;

  function parseCsv(texto) {
    const linhas = [];
    let linha = [];
    let campo = "";
    let aspas = false;
    for (let i = 0; i < texto.length; i += 1) {
      const c = texto[i];
      const prox = texto[i + 1];
      if (c === '"') {
        if (aspas && prox === '"') {
          campo += '"';
          i += 1;
        } else {
          aspas = !aspas;
        }
      } else if (c === "," && !aspas) {
        linha.push(campo);
        campo = "";
      } else if ((c === "\n" || c === "\r") && !aspas) {
        if (c === "\r" && prox === "\n") i += 1;
        linha.push(campo);
        if (linha.some((item) => String(item).trim())) linhas.push(linha);
        linha = [];
        campo = "";
      } else {
        campo += c;
      }
    }
    linha.push(campo);
    if (linha.some((item) => String(item).trim())) linhas.push(linha);
    return linhas;
  }

  function normalizarLinhas(linhas) {
    const lista = (linhas || [])
      .slice(1)
      .map((linha) => ({
        registro: String(linha[0] || "").trim(),
        nome: String(linha[1] || "").trim(),
        funcao: String(linha[2] || "").trim()
      }))
      .filter((item) => item.registro && item.nome);
    const porRegistro = new Map();
    for (const item of lista) {
      if (!porRegistro.has(item.registro)) porRegistro.set(item.registro, item);
    }
    return [...porRegistro.values()].sort(
      (a, b) => Number(a.registro) - Number(b.registro) || a.nome.localeCompare(b.nome, "pt-BR")
    );
  }

  function lerCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.ts || !Array.isArray(parsed.dados)) return null;
      if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed.dados;
    } catch (_) {
      return null;
    }
  }

  function gravarCache(dados) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), dados }));
    } catch (_) {}
  }

  async function buscarPlanilha() {
    const url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/export?format=csv&gid=" + GID_FUNCIONARIOS + "&_=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Falha ao carregar funcionários (" + res.status + ")");
    return normalizarLinhas(parseCsv(await res.text()));
  }

  async function carregarFuncionariosCiop(opcoes) {
    const forcar = Boolean(opcoes && opcoes.forcar);
    if (!forcar) {
      const cache = lerCache();
      if (cache?.length) return cache;
    }
    const dados = await buscarPlanilha();
    gravarCache(dados);
    return dados;
  }

  global.CIOP_SHEET_FUNCIONARIOS = { SHEET_ID, GID_FUNCIONARIOS };
  global.carregarFuncionariosCiop = carregarFuncionariosCiop;
})(window);
