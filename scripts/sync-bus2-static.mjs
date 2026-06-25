/**
 * Baixa rotas e horários Bus2/Mobilibus para JSON estático (sem CORS no browser).
 * Uso: node scripts/sync-bus2-static.mjs
 */
import fs from "node:fs";
import path from "node:path";

const PROJECT_HASH = "2fvn7";
const API = "https://mobilibus.com/api";
const outDir = path.join(process.cwd(), "assets", "data", "bus2");
const ttDir = path.join(outDir, "timetables");
const shapeDir = path.join(outDir, "shapes");

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

function ordenarRotas(a, b) {
  const na = parseInt(String(a.shortName).replace(/\D/g, ""), 10);
  const nb = parseInt(String(b.shortName).replace(/\D/g, ""), 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return String(a.shortName).localeCompare(String(b.shortName), "pt-BR", { numeric: true });
}

async function main() {
  fs.mkdirSync(ttDir, { recursive: true });
  fs.mkdirSync(shapeDir, { recursive: true });

  console.log("[bus2] project-details…");
  const project = await fetchJson(`${API}/project-details?project_hash=${PROJECT_HASH}`);
  const projectId = project.projectId;

  console.log("[bus2] routes…");
  const routes = (await fetchJson(`${API}/routes?origin=web&project_id=${projectId}`)).slice().sort(ordenarRotas);

  let ttOk = 0;
  let shapeOk = 0;
  for (const route of routes) {
    try {
      const tt = await fetchJson(`${API}/timetable?origin=web&v=2&project_id=${projectId}&route_id=${route.routeId}`);
      fs.writeFileSync(path.join(ttDir, `${route.routeId}.json`), JSON.stringify(tt));
      ttOk += 1;
      const tripId = tt?.timetable?.trips?.[0]?.tripId;
      if (tripId && !fs.existsSync(path.join(shapeDir, `${tripId}.json`))) {
        try {
          const shape = await fetchJson(`${API}/trip-details?origin=web&v=2&trip_id=${tripId}`);
          fs.writeFileSync(path.join(shapeDir, `${tripId}.json`), JSON.stringify(shape));
          shapeOk += 1;
        } catch {
          /* rota sem shape */
        }
      }
    } catch (err) {
      console.warn(`[bus2] timetable ${route.shortName} (${route.routeId}): ${err.message}`);
    }
  }

  fs.writeFileSync(path.join(outDir, "project.json"), JSON.stringify(project, null, 2));
  fs.writeFileSync(path.join(outDir, "routes.json"), JSON.stringify(routes, null, 2));
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(
      {
        atualizadoEm: new Date().toISOString(),
        projectId,
        hash: PROJECT_HASH,
        rotas: routes.length,
        timetables: ttOk,
        shapes: shapeOk
      },
      null,
      2
    )
  );

  console.log(`[bus2] OK — ${routes.length} rotas, ${ttOk} horários, ${shapeOk} shapes`);
}

main().catch((err) => {
  console.error("[bus2] ERRO:", err.message || err);
  process.exit(1);
});
