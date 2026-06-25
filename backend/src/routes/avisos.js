import { Router } from "express";
import { query } from "../db.js";
import { requireFirebaseUser } from "../middleware/auth.js";
import { buscarPerfilUsuario, podePostarAviso } from "../lib/usuario-perfil.js";

const router = Router();

function normalizarEmail(valor) {
  return String(valor || "").trim().toLowerCase();
}

function normalizarLista(valor) {
  if (Array.isArray(valor)) return valor.map((v) => String(v || "").trim()).filter(Boolean);
  return String(valor || "")
    .split(/[\n,;]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function criarPerfisRegra(perfis) {
  const variantes = new Set();
  normalizarLista(perfis).forEach((perfil) => {
    const original = String(perfil || "").trim();
    const semAcento = original.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    [original, semAcento, original.toLowerCase(), semAcento.toLowerCase()].forEach((item) => {
      if (item) variantes.add(item);
    });
  });
  return [...variantes];
}

function jsonArray(valor) {
  if (Array.isArray(valor)) return valor;
  if (typeof valor === "string") {
    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

function rowParaAviso(row) {
  const payload = row.payload || {};
  return {
    id: row.id,
    titulo: payload.titulo || "",
    mensagem: payload.mensagem || "",
    publico: row.publico === true,
    perfis: payload.perfis || [],
    perfisRegra: jsonArray(row.perfis_regra).length ? jsonArray(row.perfis_regra) : (payload.perfisRegra || []),
    perfisBusca: payload.perfisBusca || [],
    usuarios: jsonArray(row.usuarios).length ? jsonArray(row.usuarios) : (payload.usuarios || []),
    autorEmail: payload.autorEmail || "",
    autorNome: payload.autorNome || "",
    inicioEm: row.inicio_em,
    fimEm: row.fim_em,
    ativo: row.ativo !== false,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em
  };
}

async function usuarioContexto(req) {
  const email = normalizarEmail(req.user?.email);
  const perfil = await buscarPerfilUsuario(email);
  return { email, perfil, gestor: podePostarAviso(email, perfil) };
}

router.get("/", requireFirebaseUser, async (req, res) => {
  const gestor = String(req.query.gestor || "") === "1";
  try {
    const ctx = await usuarioContexto(req);
    let result;

    if (gestor) {
      if (!ctx.gestor) {
        res.status(403).json({ ok: false, erro: "Sem permissão para listar avisos de gestão" });
        return;
      }
      result = await query(
        `SELECT id, payload, publico, ativo, inicio_em, fim_em, perfis_regra, usuarios, criado_em, atualizado_em
         FROM avisos
         WHERE ativo = TRUE
         ORDER BY inicio_em DESC`
      );
    } else {
      const perfil = String(ctx.perfil || "").trim();
      const perfilSemAcento = perfil.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      result = await query(
        `SELECT id, payload, publico, ativo, inicio_em, fim_em, perfis_regra, usuarios, criado_em, atualizado_em
         FROM avisos
         WHERE ativo = TRUE
           AND inicio_em <= NOW()
           AND fim_em >= NOW()
           AND (
             publico = TRUE
             OR usuarios @> jsonb_build_array($1)
             OR perfis_regra @> jsonb_build_array($2)
             OR perfis_regra @> jsonb_build_array($3)
             OR perfis_regra @> jsonb_build_array($4)
           )
         ORDER BY inicio_em DESC`,
        [ctx.email, perfil, perfil.toLowerCase(), perfilSemAcento]
      );
    }

    res.json({ ok: true, avisos: result.rows.map(rowParaAviso), origem: "aws" });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

router.post("/", requireFirebaseUser, async (req, res) => {
  try {
    const ctx = await usuarioContexto(req);
    if (!ctx.gestor) {
      res.status(403).json({ ok: false, erro: "Sem permissão para publicar avisos" });
      return;
    }

    const body = req.body || {};
    const titulo = String(body.titulo || "").trim();
    const mensagem = String(body.mensagem || "").trim();
    const inicioEm = new Date(body.inicioEm);
    const fimEm = new Date(body.fimEm);
    if (!titulo || !mensagem) {
      res.status(400).json({ ok: false, erro: "Informe título e mensagem" });
      return;
    }
    if (Number.isNaN(inicioEm.getTime()) || Number.isNaN(fimEm.getTime()) || fimEm <= inicioEm) {
      res.status(400).json({ ok: false, erro: "Período de exposição inválido" });
      return;
    }

    const id = String(body.id || "").trim()
      || `aviso_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const perfis = normalizarLista(body.perfis);
    const perfisRegra = criarPerfisRegra(perfis);
    const usuarios = normalizarLista(body.usuarios).map(normalizarEmail).filter(Boolean);
    const payload = {
      titulo,
      mensagem,
      publico: body.publico === true,
      perfis,
      perfisRegra,
      perfisBusca: perfis.map((p) => p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
      usuarios,
      autorEmail: normalizarEmail(body.autorEmail || ctx.email),
      autorNome: String(body.autorNome || "").trim(),
      ativo: body.ativo !== false
    };

    await query(
      `INSERT INTO avisos (
         id, payload, publico, ativo, inicio_em, fim_em, perfis_regra, usuarios, criado_em, atualizado_em
       ) VALUES ($1, $2::jsonb, $3, TRUE, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         payload = EXCLUDED.payload,
         publico = EXCLUDED.publico,
         ativo = EXCLUDED.ativo,
         inicio_em = EXCLUDED.inicio_em,
         fim_em = EXCLUDED.fim_em,
         perfis_regra = EXCLUDED.perfis_regra,
         usuarios = EXCLUDED.usuarios,
         atualizado_em = NOW()`,
      [id, JSON.stringify(payload), payload.publico, inicioEm.toISOString(), fimEm.toISOString(), JSON.stringify(perfisRegra), JSON.stringify(usuarios)]
    );

    const saved = await query(
      `SELECT id, payload, publico, ativo, inicio_em, fim_em, perfis_regra, usuarios, criado_em, atualizado_em
       FROM avisos WHERE id = $1`,
      [id]
    );
    res.json({ ok: true, aviso: rowParaAviso(saved.rows[0]) });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

router.delete("/:id", requireFirebaseUser, async (req, res) => {
  try {
    const ctx = await usuarioContexto(req);
    if (!ctx.gestor) {
      res.status(403).json({ ok: false, erro: "Sem permissão para excluir avisos" });
      return;
    }
    const id = String(req.params.id || "").trim();
    if (!id) {
      res.status(400).json({ ok: false, erro: "Aviso inválido" });
      return;
    }
    await query(`DELETE FROM avisos WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

export default router;
