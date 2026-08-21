(function () {
  const CAD_JSON = "../assets/data/cad/monitoramento.json";
  const INC_JSON = "../assets/data/incidentes-tcgl.json";
  const LIMITE_LISTA = 400;

  const $ = (id) => document.getElementById(id);

  function norm(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function fmtQuando(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  function filtra(lista, q, campos) {
    const n = norm(q);
    if (!n) return lista;
    return lista.filter((item) => {
      if (typeof item === "string") return norm(item).includes(n);
      return campos.some((c) => norm(item[c]).includes(n));
    });
  }

  function pintarKpis(totais) {
    const box = $("mnKpis");
    const itens = [
      ["Veículos", totais.veiculos],
      ["Linhas", totais.linhas],
      ["Tabelas", totais.tabelas],
      ["Blocos", totais.blocos],
      ["Registros de gente", totais.funcionarios],
      ["Tipos de incidente", totais.tiposIncidente]
    ];
    box.innerHTML = itens
      .map(([rotulo, n]) => `<div class="mn-kpi"><b>${n ?? "—"}</b><span>${rotulo}</span></div>`)
      .join("");
  }

  function listaHtml(linhas, vazio) {
    if (!linhas.length) return `<p class="mn-vazio">${vazio}</p>`;
    return `<ul class="mn-lista">${linhas.join("")}</ul>`;
  }

  function mostrarProgramacao(cad, q) {
    const linhas = filtra(cad.programacao || [], q, ["codigo", "descricao"]);
    const vis = linhas.slice(0, LIMITE_LISTA);
    $("mnProgMeta").textContent = `${linhas.length} linhas na programação · ${cad.totais?.tabelas ?? 0} tabelas`;
    $("mnProg").innerHTML = listaHtml(
      vis.map((p) => {
        const amostra = (p.amostra || []).slice(0, 8).join(", ");
        return `<li><button type="button" class="mn-row" data-linha="${p.codigo}">
          <strong>${p.codigo}</strong>
          <span>${p.descricao || "—"}</span>
          <em>${p.tabelas} tabelas</em>
          ${amostra ? `<small>${amostra}</small>` : ""}
        </button></li>`;
      }),
      "Nenhuma linha com esse filtro."
    );
    $("mnProg").querySelectorAll("[data-linha]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const codigo = btn.getAttribute("data-linha");
        const tabs = (cad.tabelas || []).filter((t) => String(t).startsWith(codigo));
        $("mnProgDetalhe").hidden = false;
        $("mnProgDetalheTitulo").textContent = `Tabelas da linha ${codigo} (${tabs.length})`;
        $("mnProgDetalheLista").innerHTML = tabs
          .slice(0, 800)
          .map((t) => `<li>${t}</li>`)
          .join("");
        $("mnProgDetalhe").scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });
  }

  function mostrarRegistros(cad, aba, q) {
    const box = $("mnRegs");
    if (aba === "veiculos") {
      const lista = filtra(cad.veiculos || [], q, ["numero", "nome", "modelo"]);
      $("mnRegsMeta").textContent = `${lista.length} veículos`;
      box.innerHTML = listaHtml(
        lista.slice(0, LIMITE_LISTA).map((v) => `<li><strong>${v.numero || "—"}</strong> <span>${v.modelo || v.nome}</span></li>`),
        "Nenhum veículo."
      );
      return;
    }
    if (aba === "funcionarios") {
      const lista = filtra(cad.funcionarios || [], q, []);
      $("mnRegsMeta").textContent = `${lista.length} registros`;
      box.innerHTML = listaHtml(
        lista.slice(0, LIMITE_LISTA).map((n) => `<li><span>${n}</span></li>`),
        "Nenhum registro."
      );
      return;
    }
    if (aba === "garagens") {
      const extra = [...(cad.garagens || []), ...(cad.divisoes || []).map((d) => "Divisão: " + d)];
      const lista = filtra(extra, q, []);
      $("mnRegsMeta").textContent = `${cad.garagens?.length || 0} garagens · ${cad.divisoes?.length || 0} divisões`;
      box.innerHTML = listaHtml(
        lista.map((n) => `<li><span>${n}</span></li>`),
        "Sem garagens."
      );
      return;
    }
    const tipos = filtra(cad.tiposIncidente || [], q, []);
    $("mnRegsMeta").textContent = `${tipos.length} tipos · ${(cad.departamentos || []).length} departamentos`;
    box.innerHTML = listaHtml(
      tipos.slice(0, LIMITE_LISTA).map((n) => `<li><span>${n}</span></li>`),
      "Sem tipos."
    );
  }

  function mostrarIncidentes(inc, q) {
    const rows = Array.isArray(inc?.incidentes) ? inc.incidentes.slice() : [];
    rows.sort((a, b) => Number(b.incidentId || b.id || 0) - Number(a.incidentId || a.id || 0));
    const lista = filtra(rows, q, ["id", "veiculo", "linha", "tipo", "estado", "criadoPor", "data"]);
    $("mnIncMeta").textContent = `${lista.length} de ${rows.length} registros · atualizado ${fmtQuando(inc?.atualizadoEm)}`;
    $("mnInc").innerHTML = listaHtml(
      lista.slice(0, 80).map((r) => `<li>
        <strong>${r.id || r.incidentId}</strong>
        <span>${r.data || ""} ${r.hora || ""} · ${r.veiculo || "—"} · ${r.linha || "—"}</span>
        <em>${r.tipo || r.estado || ""}</em>
      </li>`),
      "Nenhum incidente no JSON local."
    );
  }

  async function iniciar() {
    $("mnStatus").textContent = "Carregando CAD…";
    let cad = null;
    let inc = null;
    try {
      const [rCad, rInc] = await Promise.all([
        fetch(CAD_JSON, { cache: "no-store" }),
        fetch(INC_JSON, { cache: "no-store" })
      ]);
      if (rCad.ok) cad = await rCad.json();
      if (rInc.ok) inc = await rInc.json();
    } catch (err) {
      $("mnStatus").textContent = "Não foi possível ler os JSON locais.";
      return;
    }
    if (!cad) {
      $("mnStatus").textContent = "Ainda não há dump do CAD. Rode scripts/atualizar-cad-monitoramento.mjs.";
      return;
    }
    $("mnStatus").textContent = `CAD ${fmtQuando(cad.atualizadoEm)} · ${cad.fonte || ""}`;
    pintarKpis(cad.totais || {});
    let abaReg = "veiculos";

    const atualizar = () => {
      const qProg = $("mnBuscaProg").value;
      const qReg = $("mnBuscaReg").value;
      const qInc = $("mnBuscaInc").value;
      mostrarProgramacao(cad, qProg);
      mostrarRegistros(cad, abaReg, qReg);
      mostrarIncidentes(inc, qInc);
    };

    $("mnBuscaProg").addEventListener("input", atualizar);
    $("mnBuscaReg").addEventListener("input", atualizar);
    $("mnBuscaInc").addEventListener("input", atualizar);
    document.querySelectorAll("[data-reg-aba]").forEach((btn) => {
      btn.addEventListener("click", () => {
        abaReg = btn.getAttribute("data-reg-aba");
        document.querySelectorAll("[data-reg-aba]").forEach((b) => b.classList.toggle("ativo", b === btn));
        atualizar();
      });
    });
    atualizar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
