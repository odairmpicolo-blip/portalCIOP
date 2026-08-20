/**
 * Respostas JSON no mesmo formato em todas as rotas:
 *   { ok: true, ... }
 *   { ok: false, erro: "texto para a tela", codigo: "DATA_INVALIDA" }
 */

export class HttpError extends Error {
  constructor(status, mensagem, codigo = "ERRO") {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

export function jsonErro(res, status, erro, codigo = "ERRO") {
  res.status(status).json({ ok: false, erro, codigo });
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function isProducao() {
  return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) || process.env.NODE_ENV === "production";
}

/** Quatro argumentos: o Express só trata como error middleware se vier `next`. */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  const cors = String(err?.message || "").startsWith("CORS");
  if (cors) {
    jsonErro(res, 403, "Origem não permitida", "CORS");
    return;
  }

  const status = Number(err?.status || err?.statusCode) || 500;
  const codigo = err?.codigo || (status >= 500 ? "ERRO_INTERNO" : "ERRO");
  const vazarDetalhe = status < 500 || !isProducao();
  const erro = vazarDetalhe
    ? String(err?.message || "Erro")
    : "Erro interno";

  if (status >= 500) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        method: req.method,
        path: req.path,
        codigo,
        msg: String(err?.message || ""),
        uid: req.user?.uid || null
      })
    );
  }

  jsonErro(res, status, erro, codigo);
}
