/**
 * Mensagens e aviso nas telas de dashboard (Fase 7).
 */
export function mensagemErroPortal(err) {
  const codigo = err?.codigo || "";
  const status = Number(err?.status || err?.statusCode || 0);
  const map = {
    SEM_CADASTRO: "Seu e-mail não está cadastrado no portal.",
    ACESSO_DESATIVADO: "Seu acesso está desativado. Fale com o administrador.",
    DATA_INVALIDA: "Data inválida. Use o formato AAAA-MM-DD.",
    NAO_ENCONTRADA: "Não encontramos esse recurso.",
    CORS: "A origem não está autorizada a chamar a API.",
    ERRO_INTERNO: "A API falhou. Tente de novo em instantes.",
    NAO_AUTENTICADO: "Sessão expirada. Entre de novo."
  };
  if (map[codigo]) return map[codigo];
  if (status === 401) return map.NAO_AUTENTICADO;
  if (status === 403) return "Sem permissão para este dado.";
  const msg = String(err?.message || err || "").trim();
  if (/failed to fetch|load failed|networkerror/i.test(msg)) {
    return "Não foi possível conectar à API. Verifique a rede e tente de novo.";
  }
  if (/timeout/i.test(msg)) return "A consulta demorou demais. Tente de novo.";
  return msg || "Não foi possível carregar os dados.";
}

export function mostrarAvisoDashboard(texto, tipo = "erro") {
  if (typeof document === "undefined") return;
  let el = document.getElementById("portalDashAviso");
  if (!el) {
    el = document.createElement("div");
    el.id = "portalDashAviso";
    el.setAttribute("role", "alert");
    const alvo = document.querySelector("main.container, main, .wrap, .shell") || document.body;
    alvo.prepend(el);
  }
  const tom = tipo === "ok" ? "ok" : tipo === "info" ? "info" : "erro";
  el.className = "portal-dash-aviso portal-dash-aviso--" + tom;
  const limpo = String(texto || "").trim();
  el.hidden = !limpo;
  el.textContent = limpo;
}

export function limparAvisoDashboard() {
  mostrarAvisoDashboard("");
}

if (typeof window !== "undefined") {
  window.portalMensagemErro = mensagemErroPortal;
  window.portalMostrarAvisoDashboard = mostrarAvisoDashboard;
  window.portalLimparAvisoDashboard = limparAvisoDashboard;
}
