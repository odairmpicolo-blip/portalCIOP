import { initPortalAwsRuntime, awsApiEnabled, awsFetch, firebaseIdToken } from "./portal-aws-config.js";

const $ = (id) => document.getElementById(id);
const pct = (n) => n == null || !Number.isFinite(n)
  ? "—"
  : (n * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
const num = (n) => Number(n || 0).toLocaleString("pt-BR");
const isoHoje = () => new Date().toISOString().slice(0, 10);
const brData = (iso) => {
  const p = String(iso || "").split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
};

async function carregar() {
  const de = $("fDe").value;
  const ate = $("fAte").value;
  $("status").textContent = "Consultando banco…";
  await initPortalAwsRuntime();
  if (!awsApiEnabled()) {
    $("status").textContent = "API AWS indisponível.";
    return;
  }
  const token = await firebaseIdToken();
  const r = await awsFetch(`/cr0108/ipv-ajustado?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`, { token });
  if (!r?.ok) throw new Error(r?.erro || "Falha na API");
  pintar(r);
}

function pintar(r) {
  $("status").textContent = r.aviso
    ? r.aviso
    : `${brData(r.de)} a ${brData(r.ate)} · ${num(r.incidentes)} incidentes · ${num(r.linhas?.length)} linhas`;
  $("kpis").innerHTML = [
    ["IPV Custom", pct(r.ipv), "ponderado pelos pontos processados"],
    ["IPV + Incidentes", pct(r.ipvAjustado), `+${Number(r.ganhoPp || 0).toFixed(2)} p.p.`, true],
    ["Incidentes CAD", num(r.incidentes), "1 incidente = 1 viagem"],
    ["Pontos recuperados", num(r.extraPontos), "pontos da linha × incidentes"],
    ["Pontos processados", num(r.volume), "denominador do Custom (Clever 2/6)"]
  ].map(([label, value, sub, hi]) =>
    `<article class="kpi-card${hi ? " highlight" : ""}">
      <div class="kpi-title">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-sub">${sub}</div>
    </article>`
  ).join("");

  $("nota").innerHTML =
    `Cada incidente do Relatório 002 é <strong>uma viagem</strong>. Essa viagem recupera <strong>todos os pontos de controle da linha</strong> — ` +
    `na 904, quatro: Terminal Acapulco, Estação Catuai, Terminal Oeste e Terminal Vivi Xavier. ` +
    `O denominador permanece o total de pontos processados no Custom (${num(r.volume)} neste recorte). ` +
    `Numerador = pontos no horário + (incidentes × pontos daquela linha).`;

  $("tbodyLinhas").innerHTML = (r.linhas || []).map((l) => `<tr>
    <td class="lin">${l.linha || "—"}</td>
    <td>${num(l.incidentes)}</td>
    <td>${l.pontosControle ? num(l.pontosControle) : "—"}</td>
    <td>${num(l.pontosRecuperados)}</td>
  </tr>`).join("") || `<tr><td colspan="4">Sem incidentes neste recorte.</td></tr>`;

  $("tbodyDias").innerHTML = (r.dias || []).map((d) => {
    const cls = d.customPendente ? "pend" : "";
    return `<tr class="${cls}">
      <td>${brData(d.data)}</td>
      <td>${pct(d.ipv)}</td>
      <td>${pct(d.ipvAjustado)}</td>
      <td>${num(d.incidentes)}</td>
      <td>${num(d.extra)}</td>
      <td>${num(d.volume || d.pontos)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="6">Sem Custom neste recorte. Se for hoje, o Clever ainda pode não ter fechado o dia.</td></tr>`;
}

function setPeriodo(de, ate) {
  $("fDe").value = de;
  $("fAte").value = ate;
  carregar().catch((err) => { $("status").textContent = err.message || String(err); });
}

$("btnHoje").addEventListener("click", () => {
  const h = isoHoje();
  setPeriodo(h, h);
});
$("btnJunho").addEventListener("click", () => setPeriodo("2026-06-01", "2026-06-30"));
$("fDe").addEventListener("change", () => carregar().catch((err) => { $("status").textContent = err.message; }));
$("fAte").addEventListener("change", () => carregar().catch((err) => { $("status").textContent = err.message; }));
$("btnPdf").addEventListener("click", () => window.print());

const h = isoHoje();
$("fDe").value = h;
$("fAte").value = h;
carregar().catch((err) => { $("status").textContent = err.message || String(err); });
