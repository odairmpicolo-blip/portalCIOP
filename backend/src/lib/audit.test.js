import { test } from "node:test";
import assert from "node:assert/strict";
import { recorteJson } from "./audit.js";

test("recorteJson preserva objeto pequeno", () => {
  assert.deepEqual(recorteJson({ a: 1 }), { a: 1 });
  assert.equal(recorteJson(null), null);
});

test("recorteJson corta payload grande", () => {
  const grande = { texto: "x".repeat(20000) };
  const out = recorteJson(grande);
  assert.equal(out._truncado, true);
  assert.ok(out.bytes > 8000);
  assert.ok(out.trecho.length <= 8000);
});
