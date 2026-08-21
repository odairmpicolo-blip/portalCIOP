import { test } from "node:test";
import assert from "node:assert/strict";
import { ehDataIso, intervaloDatas, dataIsoOuVazio, exigirObjeto } from "./validar.js";
import { HttpError } from "./http.js";

test("ehDataIso aceita calendário real e recusa 31/02", () => {
  assert.equal(ehDataIso("2026-08-20"), true);
  assert.equal(ehDataIso("2026-02-31"), false);
  assert.equal(ehDataIso("20/08/2026"), false);
  assert.equal(ehDataIso(""), false);
});

test("intervaloDatas exige de <= ate", () => {
  const r = intervaloDatas("2026-08-01", "2026-08-20");
  assert.equal(r.de, "2026-08-01");
  assert.equal(r.ate, "2026-08-20");
  assert.throws(() => intervaloDatas("2026-08-20", "2026-08-01"), HttpError);
  assert.throws(() => intervaloDatas("", "2026-08-01"), HttpError);
});

test("dataIsoOuVazio permite omitir o filtro", () => {
  assert.equal(dataIsoOuVazio(""), "");
  assert.equal(dataIsoOuVazio("2026-01-02"), "2026-01-02");
  assert.throws(() => dataIsoOuVazio("ontem"), HttpError);
});

test("intervalo opcional recusa 31/02 e aceita filtro vazio", () => {
  assert.deepEqual(intervaloDatas("", "", { obrigatorio: false }), { de: "", ate: "" });
  assert.throws(() => intervaloDatas("2026-02-31", "2026-08-01", { obrigatorio: false }), HttpError);
});

test("exigirObjeto recusa array e null", () => {
  assert.deepEqual(exigirObjeto({ a: 1 }), { a: 1 });
  assert.throws(() => exigirObjeto(null), HttpError);
  assert.throws(() => exigirObjeto([]), HttpError);
});
