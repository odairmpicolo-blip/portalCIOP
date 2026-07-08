import { carregarDadosIncidentes } from "./incidentes-dados-leitura.js";

const MAPA_ANALISTAS = {
  "12159": "Gabriel L. TCGL",
  "10610": "ANDRE G. TCGL",
  "12036": "CLEONICE F. TCGL",
  "9163": "HENRIQUE B. TCGL",
  "10828": "Wilson F. TCGL",
  "12244": "JOAO C. TCGL",
  "12947": "Emanuel I. TCGL",
  "12198": "DENIS M. TCGL",
  "12701": "FELIPE K. TCGL",
  "11937": "SERGIO C. TCGL",
  "9061": "ODAIR M. PICOLO",
  "11015": "ISLAN SANTIGO",
  "12197": "JOAO S. TCGL",
  "5784": "LUIZ C. REHDER",
  "12338": "Pedro S. TCGL"
};

function normalizarNome(valor) {
  return String(valor || "")
  .normalize("NFD")
.replace(/[^\x00-\x7F]/g, "")
  .toUpperCase()
  .trim();
}

function construirModal() {
  const existente = document.getElementById("alertaIncidentesOverlay");
  if (existente) return existente;

const style = document.createElement("style");
  style.textContent = [
    "#alertaIncidentesOverlay{position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(6,36,92,.55);padding:16px}",
    "#alertaIncidentesOverlay.hide{display:none}",
    ".alerta-incidentes-box{max-width:420px;width:100%;background:#fff;border-radius:14px;box-shadow:0 24px 60px rgba(16,24,40,.35);padding:24px;font-family:Arial,Helvetica,sans-serif;color:#101828}",
    ".alerta-incidentes-icone{width:48px;height:48px;border-radius:50%;background:#fff4e5;color:#ff6b00;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;margin-bottom:14px}",
    ".alerta-incidentes-titulo{font-size:17px;font-weight:900;color:#06245c;margin:0 0 8px}",
    ".alerta-incidentes-texto{font-size:13.5px;line-height:1.5;color:#344054;margin:0 0 18px;white-space:pre-line}",
    ".alerta-incidentes-acoes{display:flex;gap:10px;justify-content:flex-end}",
    ".alerta-incidentes-btn{border:0;border-radius:8px;padding:10px 16px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit}",
    ".alerta-incidentes-btn.secundario{background:#eef2f7;color:#344054}",
    ".alerta-incidentes-btn.primario{background:#06245c;color:#fff}",
    ".alerta-incidentes-btn.primario:hover{background:#0b3a8a}"
  ].join("");
  document.head.appendChild(style);

const overlay = document.createElement("div");
  overlay.id = "alertaIncidentesOverlay";
  overlay.innerHTML = '<div class="alerta-incidentes-box" role="alertdialog" aria-modal="true" aria-labelledby="alertaIncidentesTitulo"><div class="alerta-incidentes-icone" aria-hidden="true">!</div><h2 class="alerta-incidentes-titulo" id="alertaIncidentesTitulo">Incidentes pendentes com você</h2><p class="alerta-incidentes-texto" id="alertaIncidentesTexto"></p><div class="alerta-incidentes-acoes"><button type="button" class="alerta-incidentes-btn secundario" id="alertaIncidentesFechar">Fechar</button><button type="button" class="alerta-incidentes-btn primario" id="alertaIncidentesVer">Ver incidentes</button></div></div>';
  document.body.appendChild(overlay);

overlay.querySelector("#alertaIncidentesFechar").addEventListener("click", () => overlay.classList.add("hide"));
  overlay.addEventListener("click", (evento) => {
    if (evento.target === overlay) overlay.classList.add("hide");
  });

return overlay;
}

function mostrarAlerta(quantidade, nomeExato) {
  const overlay = construirModal();
  const texto = overlay.querySelector("#alertaIncidentesTexto");
  texto.textContent = (quantidade === 1
                       ? "Você tem 1 incidente em que é o analista e o proprietário, já com Natureza do Problema e Instrução preenchidas."
                       : "Você tem " + quantidade + " incidentes em que é o analista e o proprietário, já com Natureza do Problema e Instrução preenchidas.")
  + "\nEles podem precisar de acompanhamento.";

overlay.querySelector("#alertaIncidentesVer").onclick = () => {
  const params = new URLSearchParams({ criador: nomeExato, proprietario: nomeExato });
  window.location.href = "pages/incidentes-dashboard.html?" + params.toString();
};

overlay.classList.remove("hide");
}

async function verificarIncidentesDoUsuario() {
  const usuario = window.portalUsuario;
  const registro = String(usuario?.registro || "").trim();
  if (!registro) return;

const nomeAnalista = MAPA_ANALISTAS[registro];
  if (!nomeAnalista) return;

const alvo = normalizarNome(nomeAnalista);

try {
  const { payload } = await carregarDadosIncidentes({});
  const incidentes = Array.isArray(payload?.incidentes) ? payload.incidentes : [];

  const pendentes = incidentes.filter((linha) => {
    if (String(linha?.empresa || "").toUpperCase() !== "TCGL") return false;
    if (String(linha?.estado || "").trim() === "Cancelado") return false;
    if (normalizarNome(linha?.criadoPor) !== alvo) return false;
    if (normalizarNome(linha?.proprietario) !== alvo) return false;
    if (!String(linha?.natureOfProblem || "").trim()) return false;
    if (!String(linha?.instructions || "").trim()) return false;
    return true;
  });

  if (pendentes.length > 0) {
    const nomeExato = pendentes[0].criadoPor || nomeAnalista;
    mostrarAlerta(pendentes.length, nomeExato);
  }
} catch (erro) {
  console.warn("Não foi possível verificar alerta de incidentes:", erro);
}
}

export function iniciarAlertaIncidentes() {
  if (window.portalUsuarioValidado) {
    verificarIncidentesDoUsuario();
    return;
  }
  window.addEventListener("portal:usuario-validado", () => verificarIncidentesDoUsuario(), { once: true });
}

iniciarAlertaIncidentes();
