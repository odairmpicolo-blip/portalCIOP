/**
 * Tabelas Horárias — Web App (catálogo + leitura/edição)
 *
 * Planilha mestre (a configurar): abas CATÁLOGO + DADOS ou JSON importado
 *
 * GET ?tabelas=1&recurso=manifest
 * GET ?tabelas=1&recurso=tabela&id=315-uteis
 * GET ?tabelas=1&recurso=tabela&tipo=uteis&linha=315
 * POST ?tabelas=1 action=update (payload JSON da tabela)
 */

const TABELAS_VERSAO = "2026-06-23-tabelas-v1";

function montarRespostaTabelasGet_(params) {
  const recurso = String(params.recurso || "manifest").toLowerCase();
  if (recurso === "manifest") {
    return {
      ok: true,
      manifest: lerManifestTabelas_(),
      meta: { versao: TABELAS_VERSAO, origem: "apps_script" }
    };
  }
  if (recurso === "tabela") {
    const payload = lerTabelaPorParametros_(params);
    if (!payload) return { ok: false, erro: "Tabela não encontrada." };
    return { ok: true, tabela: payload, meta: { versao: TABELAS_VERSAO } };
  }
  return { ok: false, erro: "Recurso inválido." };
}

function montarRespostaTabelasPost_(params) {
  const action = String(params.action || "update").toLowerCase();
  if (action === "update") return gravarTabela_(params);
  return { ok: false, erro: "Ação inválida." };
}

/** TODO: apontar para planilha mestre após importação do Drive */
function lerManifestTabelas_() {
  return {
    versao: TABELAS_VERSAO,
    tipos: {
      uteis: { rotulo: "Dias úteis", total: 84 },
      sabado: { rotulo: "Sábado", total: 70 },
      domingo: { rotulo: "Domingo", total: 57 }
    },
    tabelas: []
  };
}

function lerTabelaPorParametros_(params) {
  const id = String(params.id || "");
  const tipo = String(params.tipo || "");
  const linha = String(params.linha || "");
  // Implementar leitura na planilha mestre ou PropertiesService após migração
  return null;
}

function gravarTabela_(params) {
  return { ok: false, erro: "Gravação ainda não configurada na planilha mestre." };
}
