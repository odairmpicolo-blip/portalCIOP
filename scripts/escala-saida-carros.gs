/**
 * Escalação / Saída de Carros — Web App STANDALONE
 * Planilha: 1F9L3b2JZPOMyEixvkTIML_UNNkvPZTZyGI4g05H4ln0
 *
 * GET ?recurso=saida_carros&data=YYYY-MM-DD[&maquina=...][&ignorar_data=1][&debug=1]
 */

const ESCALA_VERSAO = "2026-06-25-escala-saida-v3";
const ESCALA_SPREADSHEET_ID = "1F9L3b2JZPOMyEixvkTIML_UNNkvPZTZyGI4g05H4ln0";
const ESCALA_GID = 1482156234;

const CHAVES_CABECALHO_SAIDA_ = [
  "data", "maquina", "linha", "work_id", "carro", "carro_escalado",
  "f_carro", "motorista", "horario_de_inicio", "horario_saida_da_garagem",
  "local_inicio", "preparo", "observacoes", "subst", "saida_real", "inicio_real",
  "serv", "inicio", "reg", "loc"
];

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    return json_(montarRespostaEscalaGet_(params));
  } catch (err) {
    return json_({ ok: false, erro: err.message || String(err) });
  }
}

function montarRespostaEscalaGet_(params) {
  const recurso = String(params.recurso || "saida_carros").toLowerCase();
  const dataFiltro = normalizarDataIso_(params.data || "");
  const maquinaFiltro = String(params.maquina || "").trim();
  const ignorarData = String(params.ignorar_data || "") === "1";
  const debug = String(params.debug || "") === "1";

  if (recurso !== "saida_carros") {
    return { ok: false, erro: "Recurso não suportado: " + recurso };
  }
  if (!dataFiltro && !ignorarData) {
    return { ok: false, erro: "Informe a data (data=YYYY-MM-DD)." };
  }

  const leitura = lerSaidaCarrosCompleto_(dataFiltro, maquinaFiltro, ignorarData);
  const payload = {
    ok: true,
    dados: leitura.dados,
    colunas: leitura.colunas,
    meta: {
      versao: ESCALA_VERSAO,
      recurso: recurso,
      saida_ref: Object.assign({}, resolverSaidaCarrosPorData_(dataFiltro), {
        aba: leitura.abaNome,
        gid: leitura.gid,
        linha_cabecalho: leitura.linhaCabecalho,
        linhas_lidas: leitura.linhasLidas,
        ignorou_filtro_data: leitura.ignorouFiltroData
      })
    }
  };

  if (debug) {
    payload.meta.debug = leitura.debug;
  }

  return payload;
}

function resolverSaidaCarrosPorData_(dataIso) {
  return {
    spreadsheetId: ESCALA_SPREADSHEET_ID,
    gid: ESCALA_GID,
    origem: "semanal",
    data: dataIso || ""
  };
}

function abrirPlanilhaEscala_() {
  return SpreadsheetApp.openById(ESCALA_SPREADSHEET_ID);
}

function abrirAbaPorGid_(gid) {
  const sheets = abrirPlanilhaEscala_().getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === gid) return sheets[i];
  }
  return null;
}

function pontuarLinhaCabecalhoSaida_(cabecalho) {
  let score = 0;
  const vistos = {};
  cabecalho.forEach(function (chave) {
    if (!chave || vistos[chave]) return;
    vistos[chave] = true;
    if (CHAVES_CABECALHO_SAIDA_.indexOf(chave) >= 0) score += 3;
    else if (/horario|carro|linha|maquina|motorista|work|local|preparo|obs|inicio|saida|subst|f_carro|serv|reg|loc|turno/.test(chave)) score += 1;
  });
  return score;
}

function detectarIndiceCabecalhoSaida_(valores) {
  let melhorIdx = -1;
  let melhorScore = 0;
  const maxScan = Math.min(20, valores.length);
  for (let i = 0; i < maxScan; i++) {
    const cabecalho = valores[i].map(normalizarChave_);
    const colsValidas = cabecalho.filter(Boolean).length;
    if (colsValidas < 3) continue;
    const score = pontuarLinhaCabecalhoSaida_(cabecalho);
    if (score > melhorScore) {
      melhorScore = score;
      melhorIdx = i;
    }
  }
  return melhorScore >= 2 ? melhorIdx : -1;
}

function linhaCorrespondeDataSaida_(dataIso, dataFiltro, ignorarData) {
  if (ignorarData || !dataFiltro) return true;
  if (!dataIso) return true;
  return dataIso === dataFiltro;
}

function linhaTemConteudoSaida_(bruto) {
  if (pickCampo_(bruto, [
    "work_id", "workid", "work", "serv", "carro", "carro_escalado", "linha", "maquina",
    "horario_de_inicio", "horario_inicio", "inicio", "horario_saida_da_garagem", "motorista"
  ])) return true;
  const vals = Object.keys(bruto).filter(function (k) {
    return bruto[k] != null && String(bruto[k]).trim() !== "";
  });
  return vals.length >= 3;
}

function montarColunasDeCabecalho_(cabecalho, titulos) {
  const colunas = [];
  cabecalho.forEach(function (chave, idx) {
    if (!chave) return;
    colunas.push({
      chave: chave,
      rotulo: String(titulos[idx] || chave).trim()
    });
  });
  return colunas;
}

function lerSaidaCarrosDaAba_(sheet, dataFiltro, maquinaFiltro, ignorarData) {
  const debug = {
    aba: sheet.getName(),
    gid: sheet.getSheetId(),
    linhas_planilha: 0,
    linha_cabecalho: null,
    linhas_com_conteudo: 0,
    linhas_apos_filtro_data: 0
  };

  const range = sheet.getDataRange();
  if (!range) return { dados: [], colunas: [], debug: debug, linhaCabecalho: 0, linhasLidas: 0 };

  const valores = range.getValues();
  debug.linhas_planilha = valores.length;
  if (valores.length < 2) return { dados: [], colunas: [], debug: debug, linhaCabecalho: 0, linhasLidas: 0 };

  const headerIdx = detectarIndiceCabecalhoSaida_(valores);
  if (headerIdx < 0) return { dados: [], colunas: [], debug: debug, linhaCabecalho: 0, linhasLidas: 0 };

  debug.linha_cabecalho = headerIdx + 1;
  const titulos = valores[headerIdx];
  const cabecalho = titulos.map(normalizarChave_);
  const colunas = montarColunasDeCabecalho_(cabecalho, titulos);
  const dados = [];

  for (let i = headerIdx + 1; i < valores.length; i++) {
    const bruto = {};
    cabecalho.forEach(function (chave, idx) {
      if (!chave) return;
      bruto[chave] = valorCelula_(valores[i][idx]);
    });
    if (!linhaTemConteudoSaida_(bruto)) continue;
    debug.linhas_com_conteudo++;
    const dataBr = pickCampo_(bruto, ["data", "dia", "data_saida", "data_dia", "dt", "date"]);
    const dataIso = normalizarDataIso_(dataBr);
    if (!linhaCorrespondeDataSaida_(dataIso, dataFiltro, ignorarData)) continue;
    debug.linhas_apos_filtro_data++;
    const item = Object.assign({}, bruto, mapearSaidaCarros_(bruto, dataIso, dataBr));
    if (!filtrarMaquina_(item, maquinaFiltro)) continue;
    dados.push(item);
  }

  return {
    dados: dados,
    colunas: colunas,
    debug: debug,
    linhaCabecalho: headerIdx + 1,
    linhasLidas: valores.length - headerIdx - 1
  };
}

function lerSaidaCarrosCompleto_(dataFiltro, maquinaFiltro, ignorarDataForcado) {
  const ss = abrirPlanilhaEscala_();
  const sheets = ss.getSheets();
  const ordem = [];

  const preferida = abrirAbaPorGid_(ESCALA_GID);
  if (preferida) ordem.push(preferida);
  sheets.forEach(function (sheet) {
    if (preferida && sheet.getSheetId() === preferida.getSheetId()) return;
    ordem.push(sheet);
  });

  let melhor = null;
  ordem.forEach(function (sheet) {
    const lido = lerSaidaCarrosDaAba_(sheet, dataFiltro, maquinaFiltro, ignorarDataForcado);
    if (!melhor || lido.dados.length > melhor.dados.length) melhor = lido;
  });

  if (!melhor || melhor.dados.length || ignorarDataForcado) {
    return finalizarLeitura_(melhor, ignorarDataForcado);
  }

  ordem.forEach(function (sheet) {
    const lido = lerSaidaCarrosDaAba_(sheet, dataFiltro, maquinaFiltro, true);
    if (!melhor || lido.dados.length > melhor.dados.length) melhor = lido;
  });

  return finalizarLeitura_(melhor, true);
}

function finalizarLeitura_(melhor, ignorouFiltroData) {
  if (!melhor) {
    return {
      dados: [],
      colunas: [],
      abaNome: "",
      gid: ESCALA_GID,
      linhaCabecalho: 0,
      linhasLidas: 0,
      ignorouFiltroData: ignorouFiltroData
    };
  }
  return {
    dados: melhor.dados,
    colunas: melhor.colunas,
    abaNome: melhor.debug.aba || "",
    gid: melhor.debug.gid || ESCALA_GID,
    linhaCabecalho: melhor.linhaCabecalho,
    linhasLidas: melhor.linhasLidas,
    ignorouFiltroData: ignorouFiltroData,
    debug: melhor.debug
  };
}

function lerColunasSaidaCarros_() {
  const leitura = lerSaidaCarrosCompleto_("", "", true);
  return leitura.colunas;
}

function lerSaidaCarros_(dataFiltro, maquinaFiltro) {
  return lerSaidaCarrosCompleto_(dataFiltro, maquinaFiltro, false).dados;
}

function mapearSaidaCarros_(bruto, dataIso, dataBr) {
  const dataExibir = dataBr || (dataIso ? formatarDataBr_(dataIso) : "");
  const carroEscalado = pickCampo_(bruto, [
    "carro_escalado", "carro_esc", "veiculo_escalado", "prefixo_escalado"
  ]);
  const carro = pickCampo_(bruto, ["carro", "prefixo", "veiculo", "frota"]);
  return {
    data: dataExibir,
    maquina: pickCampo_(bruto, ["maquina", "maquina_", "maq", "equipamento"]),
    linha: pickCampo_(bruto, ["linha", "linha_"]),
    work_id: pickCampo_(bruto, ["work_id", "workid", "work", "serv", "id_servico"]),
    carro: carro,
    carro_escalado: carroEscalado || carro,
    f_carro: pickCampo_(bruto, ["f_carro", "f_carro_", "fcarro"]),
    subst: pickCampo_(bruto, ["subst", "substituto", "substituicao"]),
    motorista: pickCampo_(bruto, ["motorista", "matricula", "mot", "registro", "reg"]),
    preparo: pickCampo_(bruto, ["preparo", "tempo_preparo"]),
    horario_saida_da_garagem: pickCampo_(bruto, [
      "horario_saida_da_garagem", "horario_de_saida_da_garagem", "horario_saida", "saida_programada", "previsto", "horario"
    ]),
    saida_real: pickCampo_(bruto, ["saida_real", "realizado", "saida_efetiva", "hora_real", "h_real"]),
    local_inicio: pickCampo_(bruto, ["local_inicio", "local", "terminal", "loc"]),
    horario_de_inicio: pickCampo_(bruto, ["horario_de_inicio", "horario_inicio", "inicio_programado", "inicio"]),
    inicio_real: pickCampo_(bruto, ["inicio_real", "inicio_efetivo"]),
    observacoes: pickCampo_(bruto, ["observacoes", "obs", "observacao"]),
    _origem: "saida_carros"
  };
}

function pickCampo_(obj, chaves) {
  for (let i = 0; i < chaves.length; i++) {
    if (obj[chaves[i]]) return obj[chaves[i]];
  }
  return "";
}

function normalizarMaquina_(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function filtrarMaquina_(item, maquinaFiltro) {
  if (!maquinaFiltro) return true;
  return normalizarMaquina_(item.maquina) === normalizarMaquina_(maquinaFiltro);
}

function formatarDataBr_(iso) {
  const p = String(iso || "").slice(0, 10).split("-");
  if (p.length !== 3) return iso;
  return p[2] + "/" + p[1] + "/" + p[0];
}

function formatarHoraCelula_(valor) {
  if (typeof valor === "number" && isFinite(valor) && valor >= 0 && valor < 1) {
    const total = Math.round(valor * 24 * 60);
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return Utilities.formatString("%02d:%02d", h, m);
  }
  return "";
}

function valorCelula_(valor) {
  if (valor == null || valor === "") return "";
  const horaFracao = formatarHoraCelula_(valor);
  if (horaFracao) return horaFracao;
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor)) {
    const tz = Session.getScriptTimeZone();
    if (valor.getHours() === 0 && valor.getMinutes() === 0 && valor.getSeconds() === 0) {
      return Utilities.formatDate(valor, tz, "dd/MM/yyyy");
    }
    return Utilities.formatDate(valor, tz, "HH:mm");
  }
  const texto = String(valor).trim();
  const hhmm = texto.match(/^(\d{1,2})[:h](\d{2})$/);
  if (hhmm) {
    return Utilities.formatString("%02d:%02d", Number(hhmm[1]), Number(hhmm[2]));
  }
  return texto;
}

function normalizarChave_(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizarDataIso_(valor) {
  if (!valor) return "";
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor)) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const texto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    return br[3] + "-" + br[2].padStart(2, "0") + "-" + br[1].padStart(2, "0");
  }
  return "";
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
