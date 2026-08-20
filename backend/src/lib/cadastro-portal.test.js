import { test } from "node:test";
import assert from "node:assert/strict";
import { cadastroAtivo, resolverCadastro, normalizarPerfil } from "./cadastro-portal.js";

test("normalizarPerfil ignora acento", () => {
  assert.equal(normalizarPerfil("Gerência"), "gerencia");
});

test("sem Firestore e sem cadastro local = recusar", () => {
  assert.equal(resolverCadastro(null, null), null);
});

test("Firestore desativado recusa mesmo com local", () => {
  const r = resolverCadastro({ email: "a@b.c", ativo: false, perfil: "Usuario" }, { perfil: "Administrador" });
  assert.equal(cadastroAtivo(r), false);
});

test("fallback local só se Firestore não achou", () => {
  const r = resolverCadastro(null, { email: "a@b.c", perfil: "Monitoramento" });
  assert.equal(r.perfil, "Monitoramento");
  assert.equal(cadastroAtivo(r), true);
});
