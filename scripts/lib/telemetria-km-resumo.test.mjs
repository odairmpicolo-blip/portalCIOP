import { test } from "node:test";
import assert from "node:assert/strict";
import { agregarKmTelemetria } from "./telemetria-km-resumo.mjs";

test("agregarKmTelemetria soma km do mês e ignora outlier", () => {
  const { kmPorMes, kmAno } = agregarKmTelemetria([
    { fonte: "tcgl", data_iso: "2026-08-01", veiculo: "1001", payload: { "Km Percorrido": "10" } },
    { fonte: "tcgl", data_iso: "2026-08-01", veiculo: "1001", payload: { "Km Percorrido": "20" } },
    { fonte: "tcgl", data_iso: "2026-08-02", veiculo: "1002", payload: { "Km Percorrido": "5000" } },
    { fonte: "clever", data_iso: "2026-08-01", veiculo: "9", payload: { "Km Percorrido": "5" } }
  ]);
  const ago = kmPorMes.find((r) => r.mes === "2026-08");
  assert.ok(ago);
  assert.equal(ago.tcgl.km, 30);
  assert.equal(ago.tcgl.veiculos, 2);
  assert.equal(ago.tcgl.dias, 2);
  assert.equal(ago.clever.km, 5);
  assert.equal(kmAno["2026"].tcgl.km, 30);
  assert.equal(kmAno["2026"].tcgl.veiculos, 2);
});

test("agregarKmTelemetria ignora fonte desconhecida", () => {
  const { kmPorMes } = agregarKmTelemetria([
    { fonte: "mtran", data_iso: "2026-08-01", veiculo: "1", payload: { "Km Percorrido": "10" } }
  ]);
  assert.equal(kmPorMes.length, 0);
});
