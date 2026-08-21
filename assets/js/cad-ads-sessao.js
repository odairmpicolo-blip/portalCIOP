import { db } from "./portal-firestore.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const EMAIL_DONO = "odair.marin@icloud.com";
const REST = "https://cioplondrina.com.br:8891/CADAdvancedDynamicSchedulingREST/service.svc";
const REF = doc(db, "config", "cadAds");

const SESSAO = {
  RestURL: REST,
  InternalUserID: "1107",
  Username: "E+4usYvZ6BJ2f9AMqv8aXa4tc2Oaov9UMZw8C+j4Z+4=",
  Password: "XnTaIFmQiUd1lz5KYRLMsBTjMLv/lhjsbUIeojHfiRk=",
  NodeId: "CADCLIENT_SDDS_LDB*PEDRO",
  ScheduleType: "run",
  ShowOnlyCancelButton: "False",
  Use24HourFormat: "True",
  SelectedDispGr: "1",
  UsingCadClient: "true",
  locale: "pt-BR",
  lang: "pt-BR",
  incidentsVisibleInDM: "10",
  selectedDateFormat: "2",
  domainPort: "9943",
  EnableMTRAM: "False",
  SubmCancelWorkToRTOE: "False",
  RestrictDSACurSerDay: "False",
  SchShowDisplayMode: "7",
  RemoveWorkIDLeadingZero: "True",
  UnavailabilityTaskID: "9997"
};

function aplicar(sessao) {
  window.__cadAplicarSessaoAds?.(sessao);
}

function emailOk(cadastro) {
  return String(cadastro?.email || "").toLowerCase() === EMAIL_DONO;
}

async function carregar(cadastro) {
  if (!emailOk(cadastro)) {
    aplicar(null);
    return;
  }
  try {
    const snap = await getDoc(REF);
    if (snap.exists() && snap.data()?.Username) {
      aplicar(snap.data());
      return;
    }
    await setDoc(REF, SESSAO, { merge: true });
    aplicar(SESSAO);
  } catch {
    aplicar(SESSAO);
  }
}

if (typeof window.portalAguardarUsuario === "function") {
  window.portalAguardarUsuario(carregar);
} else {
  window.addEventListener("portal:usuario-validado", (ev) => carregar(ev.detail || window.portalUsuario), { once: true });
}
