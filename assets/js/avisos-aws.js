import {
  awsApiEnabled,
  awsFetch,
  firebaseIdToken,
  initPortalAwsRuntime
} from "./portal-aws-config.js";

function normalizarDataAviso(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function normalizarAvisoApi(aviso) {
  if (!aviso) return null;
  return {
    ...aviso,
    inicioEm: normalizarDataAviso(aviso.inicioEm),
    fimEm: normalizarDataAviso(aviso.fimEm),
    criadoEm: normalizarDataAviso(aviso.criadoEm),
    atualizadoEm: normalizarDataAviso(aviso.atualizadoEm)
  };
}

async function tokenAvisos() {
  return firebaseIdToken();
}

export async function listarAvisosAws({ gestor = false } = {}) {
  await initPortalAwsRuntime();
  if (!awsApiEnabled()) return null;
  const token = await tokenAvisos();
  const path = gestor ? "/avisos?gestor=1" : "/avisos";
  const data = await awsFetch(path, { token });
  return (data.avisos || []).map(normalizarAvisoApi).filter(Boolean);
}

export async function salvarAvisoAws(aviso) {
  await initPortalAwsRuntime();
  if (!awsApiEnabled()) return null;
  const token = await tokenAvisos();
  const inicioEm = normalizarDataAviso(aviso?.inicioEm);
  const fimEm = normalizarDataAviso(aviso?.fimEm);
  const data = await awsFetch("/avisos", {
    method: "POST",
    token,
    body: {
      id: aviso?.id || "",
      titulo: aviso?.titulo,
      mensagem: aviso?.mensagem,
      publico: aviso?.publico === true,
      perfis: aviso?.perfis || [],
      usuarios: aviso?.usuarios || [],
      inicioEm: inicioEm?.toISOString(),
      fimEm: fimEm?.toISOString(),
      autorEmail: aviso?.autorEmail,
      autorNome: aviso?.autorNome,
      ativo: aviso?.ativo !== false
    }
  });
  return normalizarAvisoApi(data.aviso);
}

export async function excluirAvisoAws(id) {
  await initPortalAwsRuntime();
  if (!awsApiEnabled()) return null;
  const token = await tokenAvisos();
  await awsFetch(`/avisos/${encodeURIComponent(String(id || "").trim())}`, {
    method: "DELETE",
    token
  });
  return true;
}
