import { test } from "node:test";
import assert from "node:assert/strict";
import { ipvAjustadoDia, ipvAjustadoPeriodo, fracaoIpv } from "./ipv-ajustado.js";

test("fracaoIpv aceita 91.34 e 0.9134", () => {
  assert.equal(fracaoIpv(91.34), 0.9134);
  assert.equal(fracaoIpv(0.9134), 0.9134);
});

test("dia: incidente vira pontos pela média pontos/viagem", () => {
  const a = ipvAjustadoDia({ ipv: 0.90, pontos: 1000, viagens: 100, incidentes: 5 });
  assert.equal(a.porViagem, 10);
  assert.equal(a.noHorario, 900);
  assert.equal(a.extra, 50);
  assert.equal(a.ipvAjustado, 0.95);
});

test("periodo pondera como o 91,34% do Clever", () => {
  const p = ipvAjustadoPeriodo([
    { ipv: 0.90, pontos: 1000, viagens: 100, incidentes: 0 },
    { ipv: 0.80, pontos: 3000, viagens: 300, incidentes: 0 }
  ]);
  assert.equal(p.ipv, 0.825);
  assert.equal(p.ipvAjustado, 0.825);
});

test("acréscimo de incidentes não passa de 100%", () => {
  const a = ipvAjustadoDia({ ipv: 0.99, pontos: 100, viagens: 10, incidentes: 50 });
  assert.equal(a.ipvAjustado, 1);
});
