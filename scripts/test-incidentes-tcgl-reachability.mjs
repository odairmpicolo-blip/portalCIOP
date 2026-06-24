/**
 * Testa se o host TCGL responde (login page). Uso: Lambda smoke test / diagnóstico.
 */
const url = "https://cioplondrina.com.br/CADIncidentManagement/";
const timeoutMs = Number(process.env.CIOP_INCIDENTES_TIMEOUT_MS || 15000);

async function main() {
  const start = Date.now();
  const res = await fetch(url, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; PortalCIOP-IncidentesSync/1.0)"
    }
  });
  const ms = Date.now() - start;
  const ok = res.status >= 200 && res.status < 500;
  const body = await res.text();
  const hasLogin = /login|password|IncidentManagement/i.test(body);
  console.log(
    JSON.stringify({
      ok,
      status: res.status,
      ms,
      hasLoginHint: hasLogin,
      url
    })
  );
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message, url }));
  process.exit(1);
});
