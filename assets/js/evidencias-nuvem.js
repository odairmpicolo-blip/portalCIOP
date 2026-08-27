/**
 * Fichas de evidência na AWS: metadados no DSQL, fotos no S3 (presign).
 * IndexedDB continua como cache local para montar o PDF.
 */
import {
  awsApiEnabled,
  awsFetch,
  firebaseIdToken,
  initPortalAwsRuntime
} from "./portal-aws-config.js";

const CAMPOS_TEXTO = [
  "status",
  "lote",
  "origem",
  "autoNumero",
  "notificacao",
  "protocolo",
  "autoId",
  "data",
  "horario",
  "carro",
  "placa",
  "linha",
  "linhaNome",
  "local",
  "matricula",
  "motorista",
  "autuador",
  "motivo",
  "texto1",
  "texto2",
  "texto3",
  "obs",
  "ordemPdf",
  "planilhaLinha",
  "planilhaAcao",
  "atualizadoEm"
];

async function tokenAws() {
  await initPortalAwsRuntime();
  if (!awsApiEnabled()) throw new Error("API AWS não configurada");
  return firebaseIdToken();
}

function fingerprint(dataUrl) {
  const s = String(dataUrl || "");
  if (!s) return "";
  return `${s.length}:${s.slice(5, 24)}:${s.slice(-32)}`;
}

function dataUrlParaBlob(dataUrl) {
  const s = String(dataUrl || "");
  const m = s.match(/^data:([^;,]+);base64,(.+)$/);
  if (!m) throw new Error("Imagem inválida para upload");
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] || "image/jpeg" });
}

function blobParaDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function enviarSlot(token, autoId, slot, dataUrl, prevKey, prevFp) {
  const fp = fingerprint(dataUrl);
  if (!dataUrl) return { key: "", fp: "" };
  if (fp && fp === prevFp && prevKey) return { key: prevKey, fp };
  const blob = dataUrlParaBlob(dataUrl);
  const contentType = blob.type || "image/jpeg";
  const presign = await awsFetch("/evidencias/presign", {
    method: "POST",
    token,
    body: { id: autoId, slot, contentType }
  });
  if (!presign?.ok || !presign.uploadUrl || !presign.key) {
    throw new Error(presign?.erro || "Falha ao preparar upload no S3");
  }
  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": presign.contentType || contentType },
    body: blob
  });
  if (!put.ok) {
    throw new Error(`Falha no envio ao S3 (HTTP ${put.status})`);
  }
  return { key: presign.key, fp };
}

async function baixarPorChave(token, id, key) {
  if (!key) return "";
  const signed = await awsFetch(`/evidencias/${encodeURIComponent(id)}/download?key=${encodeURIComponent(key)}`, {
    method: "GET",
    token
  });
  if (!signed?.ok || !signed.url) throw new Error(signed?.erro || "Link de download indisponível");
  const res = await fetch(signed.url);
  if (!res.ok) throw new Error(`Falha ao baixar do S3 (HTTP ${res.status})`);
  return blobParaDataUrl(await res.blob());
}

export function metaParaAuto(meta) {
  const auto = { id: meta.id };
  CAMPOS_TEXTO.forEach((campo) => {
    if (meta[campo] != null) auto[campo] = meta[campo];
  });
  auto.imagens = [];
  auto.paginaAuto = "";
  auto.paginaNotif = "";
  auto.paginaAutoKey = meta.paginaAutoKey || "";
  auto.paginaNotifKey = meta.paginaNotifKey || "";
  auto.paginaAutoFp = meta.paginaAutoFp || "";
  auto.paginaNotifFp = meta.paginaNotifFp || "";
  auto.imagensRemotas = Array.isArray(meta.imagens) ? meta.imagens : [];
  auto.nuvemEm = meta.atualizadoEm || "";
  auto.hidratarNuvem = Boolean(auto.paginaAutoKey || auto.paginaNotifKey || auto.imagensRemotas.length);
  auto.origem = auto.origem || "nuvem";
  return auto;
}

export function precisaMidiaNuvem(auto) {
  if (!auto) return false;
  if (auto.hidratarNuvem) return true;
  const faltaCapa = !auto.paginaNotif && auto.paginaNotifKey;
  const faltaAuto = !auto.paginaAuto && auto.paginaAutoKey;
  const faltaImg = !(auto.imagens || []).length && (auto.imagensRemotas || []).length;
  return Boolean(faltaCapa || faltaAuto || faltaImg);
}

export async function listarEvidenciasNuvem() {
  const token = await tokenAws();
  const res = await awsFetch("/evidencias", { method: "GET", token });
  if (!res?.ok) throw new Error(res?.erro || "Falha ao listar evidências na AWS");
  return Array.isArray(res.dados) ? res.dados : [];
}

export async function hidratarEvidenciaNuvem(auto) {
  const token = await tokenAws();
  const res = await awsFetch(`/evidencias/${encodeURIComponent(auto.id)}`, { method: "GET", token });
  const data = res?.evidencias || res?.dados || auto;
  CAMPOS_TEXTO.forEach((campo) => {
    if (data[campo] != null) auto[campo] = data[campo];
  });
  auto.paginaAutoKey = data.paginaAutoKey || auto.paginaAutoKey || "";
  auto.paginaNotifKey = data.paginaNotifKey || auto.paginaNotifKey || "";
  auto.paginaAutoFp = data.paginaAutoFp || "";
  auto.paginaNotifFp = data.paginaNotifFp || "";
  auto.imagensRemotas = Array.isArray(data.imagens) ? data.imagens : auto.imagensRemotas || [];
  if (auto.paginaNotifKey) auto.paginaNotif = await baixarPorChave(token, auto.id, auto.paginaNotifKey);
  if (auto.paginaAutoKey) auto.paginaAuto = await baixarPorChave(token, auto.id, auto.paginaAutoKey);
  const midias = [];
  for (const img of auto.imagensRemotas) {
    midias.push({
      id: img.id,
      tipo: img.tipo || "evidencia",
      dataUrl: await baixarPorChave(token, auto.id, img.key)
    });
  }
  if (midias.length) auto.imagens = midias;
  auto.hidratarNuvem = false;
  auto.nuvemEm = auto.atualizadoEm || data.atualizadoEm || "";
  return auto;
}

export async function salvarEvidenciaNuvem(auto) {
  if (!auto?.id) throw new Error("Evidência sem id");
  const token = await tokenAws();
  const prev = {};
  try {
    const atual = await awsFetch(`/evidencias/${encodeURIComponent(auto.id)}`, { method: "GET", token });
    Object.assign(prev, atual?.evidencias || {});
  } catch (_) {
    /* primeira gravação */
  }

  const capa = await enviarSlot(
    token,
    auto.id,
    "paginaNotif",
    auto.paginaNotif,
    prev.paginaNotifKey,
    prev.paginaNotifFp
  );
  const folha = await enviarSlot(
    token,
    auto.id,
    "paginaAuto",
    auto.paginaAuto,
    prev.paginaAutoKey,
    prev.paginaAutoFp
  );

  const imagens = [];
  for (const img of auto.imagens || []) {
    if (!img?.dataUrl) continue;
    const antigo = (prev.imagens || []).find((x) => x.id === img.id) || {};
    const enviado = await enviarSlot(
      token,
      auto.id,
      `img_${String(img.id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}`,
      img.dataUrl,
      antigo.key,
      antigo.fp
    );
    imagens.push({
      id: img.id,
      tipo: img.tipo || "evidencia",
      key: enviado.key,
      fp: enviado.fp
    });
  }

  const body = { id: auto.id };
  CAMPOS_TEXTO.forEach((campo) => {
    body[campo] = auto[campo] == null ? "" : auto[campo];
  });
  body.atualizadoEm = auto.atualizadoEm || new Date().toISOString();
  body.paginaNotifKey = capa.key;
  body.paginaNotifFp = capa.fp;
  body.paginaAutoKey = folha.key;
  body.paginaAutoFp = folha.fp;
  body.imagens = imagens;

  const salvo = await awsFetch(`/evidencias/${encodeURIComponent(auto.id)}`, {
    method: "PUT",
    token,
    body
  });
  if (!salvo?.ok) throw new Error(salvo?.erro || "Falha ao gravar evidência na AWS");

  auto.paginaNotifKey = capa.key;
  auto.paginaAutoKey = folha.key;
  auto.paginaNotifFp = capa.fp;
  auto.paginaAutoFp = folha.fp;
  auto.imagensRemotas = imagens;
  auto.nuvemEm = body.atualizadoEm;
  auto.hidratarNuvem = false;
  return salvo;
}

export async function excluirEvidenciaNuvem(id) {
  const chave = String(id || "").trim();
  if (!chave) return;
  const token = await tokenAws();
  await awsFetch(`/evidencias/${encodeURIComponent(chave)}`, { method: "DELETE", token });
}

export function mesclarLocalComNuvem(locais, nuvem) {
  const mapa = new Map();
  (locais || []).forEach((item) => mapa.set(item.id, item));
  (nuvem || []).forEach((meta) => {
    const local = mapa.get(meta.id);
    const cloudTs = String(meta.atualizadoEm || "");
    const localTs = String(local?.atualizadoEm || "");
    if (!local) {
      mapa.set(meta.id, metaParaAuto(meta));
      return;
    }
    if (cloudTs && cloudTs > localTs) {
      const atualizado = metaParaAuto(meta);
      atualizado.lote = atualizado.lote || local.lote;
      mapa.set(meta.id, atualizado);
    } else {
      local.paginaAutoKey = local.paginaAutoKey || meta.paginaAutoKey || "";
      local.paginaNotifKey = local.paginaNotifKey || meta.paginaNotifKey || "";
      local.imagensRemotas = local.imagensRemotas || meta.imagens || [];
      if (!local.nuvemEm) local.nuvemEm = meta.atualizadoEm || "";
    }
  });
  return [...mapa.values()];
}

export function pendenteNuvem(auto) {
  if (!auto?.id) return false;
  const ts = auto.atualizadoEm || "";
  return Boolean(ts) && ts !== auto.nuvemEm;
}
