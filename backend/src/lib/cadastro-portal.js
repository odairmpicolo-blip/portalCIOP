/** Quem pode usar o portal: precisa de cadastro ativo (Firestore ou fallback local). */

export function normalizarPerfil(perfil) {
  return String(perfil || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function cadastroAtivo(cadastro) {
  return Boolean(cadastro && cadastro.ativo !== false);
}

/**
 * @param {object|null} firestore
 * @param {object|null} local
 * @returns {object|null} cadastro ou null = recusar
 */
export function resolverCadastro(firestore, local) {
  if (firestore) return { ...firestore, ativo: firestore.ativo !== false };
  if (local) return { ...local, ativo: local.ativo !== false };
  return null;
}
