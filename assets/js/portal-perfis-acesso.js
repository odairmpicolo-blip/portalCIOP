/* Portal CIOP — catálogo e persistência de acesso por perfil/usuário */
import { db } from "./portal-firestore.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const EMAIL_DONO_PERFIS = "odair.marin@icloud.com";
export const STORAGE_KEY = "portal-perfis-acesso-v2";
export const DOC_PATH = ["config", "perfisAcesso"];

export const PERFIS_PORTAL = [
  "Administrador",
  "Supervisor",
  "Gerência",
  "Analista",
  "SAC",
  "Fiscalização",
  "Monitoramento",
  "Secretária",
];

/** Módulos configuráveis (home + menu lateral) */
export const MODULOS_PORTAL = [
  { id: "lancar-servico", label: "Lançar Serviço", grupo: "Operação" },
  { id: "liberacao-lancamento", label: "Liberação (lançamento)", grupo: "Operação" },
  { id: "terminais-agora", label: "Terminais Agora", grupo: "Operação" },
  { id: "itinerarios", label: "Itinerários", grupo: "Operação" },
  { id: "onibus-agora", label: "Ônibus Agora", grupo: "Operação" },
  { id: "fleetbus-agora", label: "FleetBus Agora", grupo: "Operação" },
  { id: "criar-relatorio", label: "Criar Relatório", grupo: "Operação" },
  { id: "saida-carros-drive", label: "Saída de carros (Drive)", grupo: "Operação" },
  { id: "diarios-bordo", label: "Diários de bordo", grupo: "Operação" },
  { id: "desvios", label: "Desvios", grupo: "Operação" },
  { id: "tabelas-horarias", label: "Tabelas Horárias", grupo: "Operação" },
  { id: "drive-monitoramento", label: "Drive Monitoramento", grupo: "Operação" },
  { id: "horarios-fiscais", label: "Horários para fiscais", grupo: "Operação" },
  { id: "canva", label: "Canva", grupo: "Operação" },
  { id: "cenario-atual", label: "Cenário Atual", grupo: "Operação" },
  { id: "pontos-controle", label: "Pontos de controle", grupo: "Operação" },
  { id: "planilha", label: "Planilha", grupo: "Operação" },
  { id: "gerenciar-patio", label: "Gerenciar Pátio", grupo: "Operação" },
  { id: "escala-saida-carros", label: "Saída de carros (escala)", grupo: "Operação" },
  { id: "relatorios", label: "Relatórios", grupo: "Operação" },
  { id: "consulta-decreto", label: "Consulta do Decreto", grupo: "Operação" },
  { id: "dashboard-servico", label: "Dashboard de Serviço", grupo: "Indicadores" },
  { id: "ipv", label: "IPV", grupo: "Indicadores" },
  { id: "icv", label: "ICV", grupo: "Indicadores" },
  { id: "autuacoes", label: "Autuações", grupo: "Indicadores" },
  { id: "evidencias", label: "Evidências", grupo: "Indicadores" },
  { id: "incidentes", label: "Incidentes", grupo: "Indicadores" },
  { id: "incidentes-analise", label: "Analytics de Incidentes", grupo: "Indicadores" },
  { id: "liberacao-dashboard", label: "Liberação (dashboard)", grupo: "Indicadores" },
  { id: "comparacao-km", label: "Comparação de KM", grupo: "Indicadores" },
  { id: "dados-telemetria", label: "Dados de telemetria", grupo: "Indicadores" },
  { id: "pontualidade", label: "Pontualidade", grupo: "Indicadores" },
  { id: "side-escala", label: "Menu: Escala", grupo: "Menu lateral" },
  { id: "side-pedido-imagem", label: "Menu: Pedido de Imagem", grupo: "Menu lateral" },
  { id: "side-gerenciamento-incidentes", label: "Menu: Gerenciamento de Incidentes", grupo: "Menu lateral" },
  { id: "side-clever", label: "Menu: Clever Reports", grupo: "Menu lateral" },
  { id: "side-fleetbus", label: "Menu: FleetBus", grupo: "Menu lateral" },
  { id: "side-gsg", label: "Menu: GSG Sistem", grupo: "Menu lateral" },
  { id: "side-globus", label: "Menu: Globus", grupo: "Menu lateral" },
  { id: "side-mobilibus", label: "Menu: Mobilibus", grupo: "Menu lateral" },
  { id: "gerenciar-usuarios", label: "Menu: Gerenciar Usuários", grupo: "Menu lateral" },
  { id: "side-ponto", label: "Menu: Ponto Eletrônico", grupo: "Menu lateral" },
  { id: "side-reconhecimento", label: "Menu: Reconhecimento Facial", grupo: "Menu lateral" },
  { id: "side-linea", label: "Menu: Linea", grupo: "Menu lateral" },
  { id: "adicionar-aviso", label: "Menu: Adicionar Aviso", grupo: "Menu lateral" },
];

export function normalizarPerfilKey(perfil) {
  return String(perfil || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizarEmailKey(email) {
  return String(email || "").trim().toLowerCase();
}

export function defaultsAcessos() {
  const todos = MODULOS_PORTAL.map((m) => m.id);
  const mapa = {};
  PERFIS_PORTAL.forEach((perfil) => {
    const key = normalizarPerfilKey(perfil);
    if (key === "administrador") mapa[key] = ["*"];
    else mapa[key] = [...todos];
  });
  return mapa;
}

function estadoVazio() {
  return { acessos: defaultsAcessos(), usuarios: {} };
}

function lerCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return {
      acessos: data.acessos && typeof data.acessos === "object" ? data.acessos : defaultsAcessos(),
      usuarios: data.usuarios && typeof data.usuarios === "object" ? data.usuarios : {},
    };
  } catch (_) {
    return null;
  }
}

function gravarCache(estado) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        acessos: estado.acessos || {},
        usuarios: estado.usuarios || {},
        atualizadoEm: new Date().toISOString(),
      })
    );
  } catch (_) {}
}

function aplicarEstadoGlobal(estado) {
  window.portalPerfisAcesso = estado.acessos || {};
  window.portalUsuariosAcesso = estado.usuarios || {};
  return estado;
}

export async function carregarAcessosPerfis() {
  const cache = lerCache();
  if (cache) aplicarEstadoGlobal(cache);

  try {
    const snap = await getDoc(doc(db, ...DOC_PATH));
    if (snap.exists()) {
      const data = snap.data() || {};
      const estado = {
        acessos: data.acessos && typeof data.acessos === "object" ? data.acessos : defaultsAcessos(),
        usuarios: data.usuarios && typeof data.usuarios === "object" ? data.usuarios : {},
      };
      gravarCache(estado);
      return aplicarEstadoGlobal(estado);
    }
  } catch (err) {
    console.warn("Não foi possível carregar acessos de perfis:", err);
  }

  if (cache) return cache;
  const defaults = estadoVazio();
  return aplicarEstadoGlobal(defaults);
}

export async function salvarAcessosPerfis(estado) {
  const payload = {
    acessos: estado.acessos || {},
    usuarios: estado.usuarios || {},
    atualizadoEm: serverTimestamp(),
    atualizadoPor: String(window.portalUsuario?.email || "").toLowerCase(),
  };
  await setDoc(doc(db, ...DOC_PATH), payload, { merge: true });
  gravarCache(payload);
  return aplicarEstadoGlobal(payload);
}

export function listaModulosDePerfil(perfil, mapa) {
  const key = normalizarPerfilKey(perfil);
  const acessos = mapa || window.portalPerfisAcesso;
  if (!acessos) return null;
  const lista = acessos[key];
  if (!Array.isArray(lista)) return null;
  if (lista.includes("*")) return MODULOS_PORTAL.map((m) => m.id);
  return lista;
}

export function perfilTemModulo(perfil, moduloId, mapa) {
  const lista = listaModulosDePerfil(perfil, mapa);
  if (!lista || !moduloId) return null;
  return lista.includes(moduloId) || lista.includes("*");
}

export function usuarioTemModulo(email, perfil, moduloId) {
  if (!moduloId) return null;
  const emailKey = normalizarEmailKey(email);
  const usuarios = window.portalUsuariosAcesso;
  if (usuarios && Object.prototype.hasOwnProperty.call(usuarios, emailKey)) {
    const lista = usuarios[emailKey];
    if (!Array.isArray(lista)) return null;
    if (lista.includes("*")) return true;
    return lista.includes(moduloId);
  }
  return perfilTemModulo(perfil, moduloId);
}
