import crypto from "node:crypto";

/**
 * Verificação de ID token do Firebase sem SDK e sem credencial.
 *
 * O portal autentica no Firebase, e o Firebase assina os tokens com o par de chaves
 * de `securetoken@system.gserviceaccount.com`. A parte pública desses certificados é
 * publicada pelo Google e roda periodicamente. Conferir a assinatura contra eles é a
 * verificação oficial descrita em
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 *
 * O que NÃO dá para fazer por aqui é detectar revogação (logout forçado, conta
 * desativada): isso exige o Admin SDK com credencial. Como o token vive uma hora, a
 * janela de exposição é essa. Se um dia isso incomodar, o caminho é a conta de serviço.
 */

const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cache = { certs: null, validoAte: 0 };

/** Busca os certificados públicos, respeitando o max-age que o Google manda. */
async function buscarCertificados(fetchImpl = fetch) {
  const agora = Date.now();
  if (cache.certs && agora < cache.validoAte) return cache.certs;

  const res = await fetchImpl(CERTS_URL);
  if (!res.ok) throw new Error(`Não consegui buscar os certificados (HTTP ${res.status})`);
  const certs = await res.json();

  const cc = String(res.headers?.get?.("cache-control") || "");
  const m = cc.match(/max-age=(\d+)/);
  const ttl = m ? Number(m[1]) * 1000 : 60 * 60 * 1000;
  cache = { certs, validoAte: agora + ttl };
  return certs;
}

export function limparCacheDeCertificados() {
  cache = { certs: null, validoAte: 0 };
}

const b64url = (s) => Buffer.from(String(s), "base64url");

/**
 * Confere assinatura e claims. Função pura: recebe os certificados prontos, para
 * poder ser testada sem rede.
 */
export function verificarComCertificados(token, certs, { projectId, agoraMs = Date.now(), toleranciaSeg = 120 }) {
  const partes = String(token || "").split(".");
  if (partes.length !== 3) throw new Error("Formato de token inesperado");
  const [cabecalhoB64, payloadB64, assinaturaB64] = partes;

  let cabecalho, payload;
  try {
    cabecalho = JSON.parse(b64url(cabecalhoB64).toString("utf8"));
    payload = JSON.parse(b64url(payloadB64).toString("utf8"));
  } catch (_) {
    throw new Error("Token ilegível");
  }

  // "none" e HMAC seriam formas clássicas de burlar: exigimos RS256 explicitamente.
  if (cabecalho.alg !== "RS256") throw new Error("Algoritmo do token não aceito");
  if (!cabecalho.kid) throw new Error("Token sem identificação da chave");

  const cert = certs?.[cabecalho.kid];
  if (!cert) throw new Error("Chave do token desconhecida");

  const chavePublica = new crypto.X509Certificate(cert).publicKey;
  const assinado = `${cabecalhoB64}.${payloadB64}`;
  const ok = crypto
    .createVerify("RSA-SHA256")
    .update(assinado)
    .verify(chavePublica, b64url(assinaturaB64));
  if (!ok) throw new Error("Assinatura do token inválida");

  const agora = Math.floor(agoraMs / 1000);
  const emissorEsperado = `https://securetoken.google.com/${projectId}`;
  if (payload.iss !== emissorEsperado) throw new Error("Emissor do token inválido");
  if (payload.aud !== projectId) throw new Error("Audiência do token inválida");
  if (!payload.sub) throw new Error("Token sem sujeito");
  if (typeof payload.exp !== "number" || payload.exp + toleranciaSeg < agora) {
    throw new Error("Token expirado");
  }
  if (typeof payload.iat === "number" && payload.iat - toleranciaSeg > agora) {
    throw new Error("Token emitido no futuro");
  }
  if (!payload.email) throw new Error("Token sem e-mail");

  return { email: payload.email, uid: payload.sub };
}

/** Uso normal: busca os certificados (com cache) e verifica. */
export async function verificarIdTokenFirebase(token, { projectId, fetchImpl } = {}) {
  const certs = await buscarCertificados(fetchImpl);
  return verificarComCertificados(token, certs, { projectId });
}
