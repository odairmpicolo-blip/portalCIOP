import { initPortalAwsRuntime, awsApiEnabled, awsFetch, firebaseIdToken } from "./portal-aws-config.js";

const $ = (id) => document.getElementById(id);
const pct = (n) => n == null || !Number.isFinite(n)
  ? "—"
  : (n * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
const num = (n) => Number(n || 0).toLocaleString("pt-BR");
const isoHoje = () => new Date().toISOString().slice(0, 10);

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
    : `${r.de} a ${r.ate} · ${num(r.incidentes)} incidentes 002 · ${num(r.dias?.length)} dias`;
  $("kpis").innerHTML = [
    ["IPV Custom", pct(r.ipv), "ponderado por pontos (Clever 2/6)"],
    ["IPV + incidentes", pct(r.ipvAjustado), `+${Number(r.ganhoPp || 0).toFixed(2)} p.p.`],
    ["Incidentes 002", num(r.incidentes), "viagens desculpadas no período"],
    ["Pontos no denominador", num(r.volume), "mesmo peso do 91,34%"]
  ].map(([label, value, sub]) =>
    `<article class="pa-kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></article>`
  ).join("");

  $("tbody").innerHTML = (r.dias || []).map((d) => {
    const cls = d.customPendente ? "pend" : "";
    return `<tr class="${cls}">
      <td>${d.data}</td>
      <td>${pct(d.ipv)}</td>
      <td>${pct(d.ipvAjustado)}</td>
      <td>${num(d.incidentes)}</td>
      <td>${num(d.viagens)}</td>
      <td>${num(d.pontos)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="6">Sem Custom neste recorte. Se for hoje, o Clever ainda não fechou o dia.</td></tr>`;
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

const h = isoHoje();
$("fDe").value = h;
$("fAte").value = h;
carregar().catch((err) => { $("status").textContent = err.message || String(err); });
