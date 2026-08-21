(function () {
  const CAD_JSON = "../assets/data/cad/monitoramento.json";
  const INC_JSON = "../assets/data/incidentes-tcgl.json";
  const LIMITE_LISTA = 400;
  const CAD_ADS_APP = "https://cioplondrina.com.br:8891/CADAdvancedDynamicScheduling/App/";
  const CAD_ADS_REST = "https://cioplondrina.com.br:8891/CADAdvancedDynamicSchedulingREST/service.svc";
  let cadAdsSessao = null;

  function urlVisualizacaoProgramacao() {
    const base = {
      RestURL: CAD_ADS_REST,
      ScheduleType: "run",
      Use24HourFormat: "True",
      locale: "pt-BR",
      lang: "pt-BR",
      RemoveWorkIDLeadingZero: "True"
    };
    const q = new URLSearchParams(cadAdsSessao && cadAdsSessao.Username ? { ...base, ...cadAdsSessao } : base);
    return CAD_ADS_APP + "?" + q.toString() + "#/";
  }

  function ligarLinksProgramacaoCad() {
    const href = urlVisualizacaoProgramacao();
    document.querySelectorAll("[data-cad-ads]").forEach((a) => {
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
    });
  }

  window.__cadAplicarSessaoAds = function (sessao) {
    cadAdsSessao = sessao;
    ligarLinksProgramacaoCad();
  };

  const $ = (id) => document.getElementById(id);

  function norm(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
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

  function isoHoje() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseWorkId(raw) {
    const id = String(raw || "").trim();
    const digits = id.replace(/\D/g, "");
    if (digits.length === 8 && digits[0] === "2") {
      const util = digits.slice(1);
      return { id: digits, dia: "sabado", rotuloDia: "SÁBADO", util, rota: util.slice(0, 3) };
    }
    if (digits.length === 8 && digits[0] === "3") {
      const util = digits.slice(1);
      return { id: digits, dia: "domingo", rotuloDia: "DOMINGO", util, rota: util.slice(0, 3) };
    }
    if (digits.length === 7) {
      return { id: digits, dia: "util", rotuloDia: "ÚTIL", util: digits, rota: digits.slice(0, 3) };
    }
    return null;
  }

  function workIdsUnicos(cad) {
    const map = new Map();
    for (const t of cad.tabelas || []) {
      const w = parseWorkId(t);
      if (!w) continue;
      if (!map.has(w.id)) map.set(w.id, w);
    }
    return [...map.values()];
  }

  function descricaoLinha(cad, codigo) {
    const l = (cad.linhas || []).find((x) => x.codigo === codigo);
    return l?.descricao || l?.nome || "";
  }

  function pintarViz(cad, modoDia) {
    const tipo = $("cadVizTipo").value;
    const q = String($("cadVizBloco").value || "").trim();
    const data = $("cadVizData").value;
    const todos = workIdsUnicos(cad);
    const parsedQ = parseWorkId(q);
    let lista = [];

    if (tipo === "rota") {
      const rota = q.replace(/\D/g, "").slice(0, 4);
      lista = todos.filter((w) => w.rota === rota || w.rota === rota.padStart(3, "0"));
    } else if (parsedQ) {
      lista = todos.filter((w) => w.id === parsedQ.id || w.util === parsedQ.util);
    } else if (q) {
      const n = norm(q);
      lista = todos.filter((w) => w.id.includes(n) || w.util.includes(n));
    }

    if (modoDia === "servico" && parsedQ) {
      const alvo = parsedQ.dia;
      const doDia = lista.filter((w) => w.dia === alvo);
      if (doDia.length) lista = doDia;
    }

    const principal = lista.find((w) => parsedQ && w.id === parsedQ.id) || lista[0];
    const dataBr = data ? data.split("-").reverse().join("/") : "—";
    if (principal) {
      $("cadVizInfo").textContent = `Dia de serviço: ${principal.rotuloDia} · Work-ID ${principal.id} · ${dataBr}`;
    } else {
      $("cadVizInfo").textContent = q
        ? "Nenhum Work-ID com esse filtro no dump do CAD."
        : "Informe o bloco (7 dígitos no útil; sábado começa com 2; domingo com 3).";
    }

    const horas = ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00", "24:00"];
    $("cadVizHoras").innerHTML = horas.map((h) => `<span>${h}</span>`).join("");
    if (principal) {
      $("cadVizFaixa").innerHTML = `<div class="cad-timeline-bloco" style="left:8%;width:55%">Rota: ${principal.rota} · ${principal.id}</div>`;
    } else {
      $("cadVizFaixa").innerHTML = "";
    }

    const box = $("cadVizViagens");
    if (!lista.length) {
      box.innerHTML = `<p class="cad-vazio-viz">Sem viagens para este filtro. Os horários registrados pelo veículo entram quando a extração de paradas estiver ligada — mande as próximas imagens da tela.</p>`;
      return;
    }
    box.innerHTML = lista
      .slice(0, 40)
      .map((w) => {
        const nome = descricaoLinha(cad, w.rota);
        return `<article class="cad-viagem">
          <div class="cad-viagem-meta">
            <span>Rota: ${w.rota}${nome ? " · " + nome : ""}</span>
            <span>Serviço: ${w.util}</span>
            <span>WorkID1: ${w.id}</span>
            <span>${w.rotuloDia}</span>
          </div>
          <div class="cad-viagem-paradas">
            <div class="cad-parada"><strong>Garagem</strong><em>— —</em></div>
            <div class="cad-parada"><strong>Pontos da viagem</strong><em>aguardando dump de paradas</em></div>
          </div>
        </article>`;
      })
      .join("");
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
          .map((t) => {
            const w = parseWorkId(t);
            const extra = w ? ` · ${w.rotuloDia}` : "";
            return `<li><button type="button" class="mn-row" data-work="${t}" style="display:block;width:100%;text-align:left;cursor:pointer;background:none;border:0;font:inherit;font-weight:700">${t}${extra}</button></li>`;
          })
          .join("");
        $("mnProgDetalheLista").querySelectorAll("[data-work]").forEach((b) => {
          b.addEventListener("click", () => {
            $("cadVizBloco").value = b.getAttribute("data-work");
            $("cadVizTipo").value = "bloco";
            pintarViz(cad, document.querySelector("[data-modo-dia].ativo")?.getAttribute("data-modo-dia") || "servico");
            $("cadViz").scrollIntoView({ behavior: "smooth", block: "start" });
          });
        });
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
    }
    if (!cad) {
      $("mnStatus").textContent = "Ainda não há dump do CAD. A tabela de status usa a frota ao vivo.";
    } else {
      $("mnStatus").textContent = `CAD ${fmtQuando(cad.atualizadoEm)} · ${cad.fonte || ""}`;
      pintarKpis(cad.totais || {});
    }
    let abaReg = "veiculos";
    let modoDia = "servico";
    if ($("cadVizData")) $("cadVizData").value = isoHoje();
    if (cad && $("cadVizForm")) {
      pintarViz(cad, modoDia);
      $("cadVizForm").addEventListener("submit", (ev) => {
        ev.preventDefault();
        pintarViz(cad, modoDia);
      });
      $("cadVizBloco").addEventListener("input", () => pintarViz(cad, modoDia));
      $("cadVizTipo").addEventListener("change", () => pintarViz(cad, modoDia));
      document.querySelectorAll("[data-modo-dia]").forEach((btn) => {
        btn.addEventListener("click", () => {
          modoDia = btn.getAttribute("data-modo-dia");
          document.querySelectorAll("[data-modo-dia]").forEach((b) => b.classList.toggle("ativo", b === btn));
          pintarViz(cad, modoDia);
        });
      });
    }

    const atualizar = () => {
      if (!cad) return;
      mostrarProgramacao(cad, $("mnBuscaProg").value);
      mostrarRegistros(cad, abaReg, $("mnBuscaReg").value);
      mostrarIncidentes(inc, $("mnBuscaInc").value);
    };

    $("mnBuscaProg")?.addEventListener("input", atualizar);
    $("mnBuscaReg")?.addEventListener("input", atualizar);
    $("mnBuscaInc")?.addEventListener("input", atualizar);
    document.querySelectorAll("[data-reg-aba]").forEach((btn) => {
      btn.addEventListener("click", () => {
        abaReg = btn.getAttribute("data-reg-aba");
        document.querySelectorAll("[data-reg-aba]").forEach((b) => b.classList.toggle("ativo", b === btn));
        atualizar();
      });
    });
    atualizar();
    ligarLinksProgramacaoCad();
    ligarShell(cad, inc);
    iniciarStatusAoVivo(cad);
  }

  function toast(msg) {
    const el = document.createElement("div");
    el.className = "cad-toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  function abrirPainel(nome) {
    const alvo = nome === "fora" ? "mapa" : nome;
    const id = "pane" + alvo.charAt(0).toUpperCase() + alvo.slice(1);
    document.querySelectorAll(".cad-pane").forEach((p) => p.classList.toggle("ativo", p.id === id));
    document.querySelectorAll(".cad-views [data-abrir]").forEach((b) => {
      const v = b.getAttribute("data-abrir");
      b.classList.toggle("ativo", v === nome || (alvo === "mapa" && nome !== "fora" && v === "mapa"));
    });
  }

  function ligarShell(cad, inc) {
    const nInc = Array.isArray(inc?.incidentes) ? inc.incidentes.length : 0;
    if ($("cadNInc")) $("cadNInc").textContent = nInc;
    if ($("cadNEventos")) $("cadNEventos").textContent = nInc;
    if ($("cadNJornada")) $("cadNJornada").textContent = cad?.totais?.tabelas ?? "—";
    const user = $("usuarioLogado")?.textContent;
    if ($("cadUserBar") && user) $("cadUserBar").textContent = "Logado como " + user;

    document.querySelectorAll(".cad-tabs [data-ribbon]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rid = btn.getAttribute("data-ribbon");
        document.querySelectorAll(".cad-tabs [data-ribbon]").forEach((b) => b.classList.toggle("ativo", b === btn));
        document.querySelectorAll("[data-ribbon-pane]").forEach((p) => {
          p.hidden = p.getAttribute("data-ribbon-pane") !== rid;
        });
      });
    });
    document.querySelectorAll("[data-abrir]").forEach((el) => {
      el.addEventListener("click", () => abrirPainel(el.getAttribute("data-abrir")));
    });
    document.querySelectorAll("[data-cad-so]").forEach((el) => {
      el.addEventListener("click", () => toast("Isso fica no Clever CAD desktop."));
    });
    $("cadTelaCheia")?.addEventListener("click", () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
    setInterval(() => {
      if ($("cadRelogio")) $("cadRelogio").textContent = new Date().toLocaleTimeString("pt-BR");
    }, 1000);
    $("cadCmdForm")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const q = $("cadCmd").value.trim();
      if (!q) return;
      $("stBusca").value = q;
      abrirPainel("status");
      window.__cadPintarStatus?.();
    });
    $("cadLocalizarBtn")?.addEventListener("click", () => $("cadCmd").focus());
  }

  const CODIGOS_OCIOSO = new Set(["PI", "DH", "PO"]);
  const CODIGOS_FORA = new Set(["U"]);
  const ADIANTADO_SEG = 120;
  const ATRASADO_SEG = 360;
  const SEM_COM_SEG = 180;

  function operadoraVid(vid) {
    const n = parseInt(vid, 10);
    if (!Number.isFinite(n)) return "";
    if (n >= 0 && n <= 5000) return "TCGL";
    if (n >= 5001 && n <= 9999) return "CMTU";
    return "";
  }

  function parseTmstmp(tmstmp) {
    const s = String(tmstmp || "").trim();
    const m = s.match(/^(\d{4})(\d{2})(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  }

  function fmtTmstmp(tmstmp) {
    const d = parseTmstmp(tmstmp);
    if (!d) return tmstmp || "—";
    return d.toLocaleString("pt-BR");
  }

  function extrairListaBustime(data, chave) {
    const raiz = data?.["bustime-response"] ?? data ?? {};
    const val = raiz[chave];
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }

  function classificarVeiculo(v, agora) {
    const rt = String(v.rt || "").trim();
    const delay = v.delaySec == null ? null : Number(v.delaySec);
    const t = parseTmstmp(v.tmstmp);
    const idade = t ? (agora - t.getTime()) / 1000 : 9999;
    const comunicando = idade <= SEM_COM_SEG;
    let veiculo = "Normal";
    if (CODIGOS_FORA.has(rt) || rt === "") veiculo = "Fora de serviço";
    else if (CODIGOS_OCIOSO.has(rt)) veiculo = "Escala";
    else if (delay != null && delay < -ADIANTADO_SEG) veiculo = "Horário Adiantado";
    else if (delay != null && delay > ATRASADO_SEG) veiculo = "Horário Atrasado";
    if (!comunicando && !t) veiculo = "Desligado";
    const cor =
      veiculo === "Horário Adiantado" ? "#c81e1e" :
      veiculo === "Horário Atrasado" ? "#eab308" :
      veiculo === "Normal" ? "#8FD400" :
      veiculo === "Escala" ? "#38bdf8" :
      "#9ca3af";
    const wid = String(v.tablockid || v.rid || "").replace(/^N\/A$/i, "");
    const parsed = parseWorkId(wid) || parseWorkId(v.rid);
    return {
      vid: String(v.vid || ""),
      rt,
      delayMin: delay == null ? "" : Math.round(delay / 60),
      oid: String(v.oid || "").trim(),
      servico: parsed?.id || wid || String(v.rid || ""),
      tabela: String(v.tablockid || ""),
      spd: v.spd != null ? Number(v.spd) : "",
      des: v.des || "",
      sentido: v.rtdir || "",
      tmstmp: v.tmstmp,
      comunicacao: comunicando ? "Comunicando" : "Não Comunicando",
      veiculo,
      cor,
      operadora: operadoraVid(v.vid),
      logon: Boolean(String(v.oid || "").trim())
    };
  }

  async function resolverProxy() {
    const fallback = "https://62wvo4yk9b.execute-api.sa-east-1.amazonaws.com/clever";
    try {
      const cfg = await fetch("../assets/data/portal-runtime.json", { cache: "no-store" }).then((r) => r.json());
      let url = String(cfg?.awsApiUrl || "").replace(/\/+$/, "");
      if (url && !url.endsWith("/clever")) url += "/clever";
      const local = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(url);
      const onLocal = /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
      if (url && (!local || onLocal)) return url;
    } catch { /* fallback */ }
    return fallback;
  }

  function nomeMotorista(cad, oid) {
    if (!oid) return "";
    const lista = cad?.funcionarios || [];
    const hit = lista.find((n) => String(n).includes(oid));
    return hit || oid;
  }

  function iniciarStatusAoVivo(cad) {
    const estado = {
      rows: [],
      aba: "tcgl",
      abertos: new Set(["Comunicando", "Comunicando|Horário Adiantado"])
    };

    function listaFiltrada() {
      const com = $("stFiltroCom")?.value || "";
      const ve = $("stFiltroVeic")?.value || "";
      const q = norm($("stBusca")?.value || "");
      return estado.rows.filter((r) => {
        if (estado.aba === "tcgl" && r.operadora !== "TCGL") return false;
        if (estado.aba === "cmtu" && r.operadora !== "CMTU") return false;
        if (estado.aba === "semcom" && r.comunicacao !== "Não Comunicando") return false;
        if (estado.aba === "soft" && r.logon) return false;
        if (com && r.comunicacao !== com) return false;
        if (ve && r.veiculo !== ve) return false;
        if (q) {
          const blob = norm([r.vid, r.rt, r.servico, r.tabela, r.oid, r.des].join(" "));
          if (!blob.includes(q)) return false;
        }
        return true;
      });
    }

    function pintar() {
      const lista = listaFiltrada();
      const logon = estado.rows.filter((r) => r.logon).length;
      if ($("stLogon")) $("stLogon").textContent = String(logon);
      if ($("stLogoff")) $("stLogoff").textContent = String(estado.rows.length - logon);
      if ($("cadNStatus")) $("cadNStatus").textContent = String(estado.rows.length);

      const grupos = new Map();
      for (const r of lista) {
        if (!grupos.has(r.comunicacao)) grupos.set(r.comunicacao, new Map());
        const sub = grupos.get(r.comunicacao);
        if (!sub.has(r.veiculo)) sub.set(r.veiculo, []);
        sub.get(r.veiculo).push(r);
      }

      const ordemCom = ["Não Comunicando", "Comunicando"];
      const ordemVeic = ["Desligado", "Fora de serviço", "Escala", "Fora de rota", "Horário Adiantado", "Horário Atrasado", "Normal"];
      const cols = `<tr>
        <th>Veículo</th><th></th><th>Status do veículo</th><th>Linha</th><th>Atraso</th>
        <th>ID</th><th>Motorista</th><th>Serviço</th><th>Vel.</th><th>Destino</th>
        <th>Sentido</th><th>Tabela</th><th>Última com.</th><th>Status da comunicação</th><th>Garagem</th>
      </tr>`;
      let body = "";
      for (const com of ordemCom) {
        if (!grupos.has(com)) continue;
        const sub = grupos.get(com);
        let nCom = 0;
        sub.forEach((arr) => { nCom += arr.length; });
        const abertoCom = estado.abertos.has(com);
        body += `<tr class="st-g" data-g="${com}"><td colspan="15">Status da Comunicação: ${com} (${nCom})</td></tr>`;
        if (!abertoCom) continue;
        const keys = [...sub.keys()].sort((a, b) => ordemVeic.indexOf(a) - ordemVeic.indexOf(b));
        for (const st of keys) {
          const arr = sub.get(st);
          const key = com + "|" + st;
          const aberto = estado.abertos.has(key);
          body += `<tr class="st-s" data-g="${key}"><td colspan="15">Status do veículo: ${st} (${arr.length})</td></tr>`;
          if (!aberto) continue;
          arr.sort((a, b) => a.vid.localeCompare(b.vid, "pt", { numeric: true }));
          for (const r of arr) {
            body += `<tr class="st-row">
              <td>${esc(r.vid)}</td>
              <td><i class="st-cor" style="background:${esc(r.cor)}"></i></td>
              <td>${esc(r.veiculo)}</td>
              <td>${esc(r.rt)}</td>
              <td>${esc(r.delayMin)}</td>
              <td>${esc(r.oid)}</td>
              <td>${esc(nomeMotorista(cad, r.oid))}</td>
              <td>${esc(r.servico)}</td>
              <td>${esc(r.spd)}</td>
              <td>${esc(r.des)}</td>
              <td>${esc(r.sentido)}</td>
              <td>${esc(r.tabela)}</td>
              <td>${esc(fmtTmstmp(r.tmstmp))}</td>
              <td>${esc(r.comunicacao)}</td>
              <td>${esc(r.operadora || "—")}</td>
            </tr>`;
          }
        }
      }
      $("cadStatusLista").innerHTML = lista.length
        ? `<table class="st-table"><thead>${cols}</thead><tbody>${body}</tbody></table>`
        : `<p class="st-vazio">Nenhum veículo neste filtro.</p>`;
      $("cadStatusLista").querySelectorAll("[data-g]").forEach((tr) => {
        tr.addEventListener("click", () => {
          const k = tr.getAttribute("data-g");
          if (estado.abertos.has(k)) estado.abertos.delete(k);
          else estado.abertos.add(k);
          pintar();
        });
      });
    }

    window.__cadPintarStatus = pintar;

    document.querySelectorAll("[data-st-aba]").forEach((btn) => {
      btn.addEventListener("click", () => {
        estado.aba = btn.getAttribute("data-st-aba");
        document.querySelectorAll("[data-st-aba]").forEach((b) => b.classList.toggle("ativo", b === btn));
        pintar();
      });
    });
    $("stFiltroCom")?.addEventListener("change", pintar);
    $("stFiltroVeic")?.addEventListener("change", pintar);
    $("stBusca")?.addEventListener("input", pintar);

    async function puxar() {
      try {
        const base = await resolverProxy();
        const data = await fetch(base + "/getvehiclesdelay", { cache: "no-store" }).then((r) => r.json());
        const agora = Date.now();
        estado.rows = extrairListaBustime(data, "vehicle").map((v) => classificarVeiculo(v, agora));
        if ($("stLive")) $("stLive").textContent = `Ao vivo ${new Date().toLocaleTimeString("pt-BR")} · ${estado.rows.length} veículos`;
        pintar();
      } catch {
        if ($("stLive")) $("stLive").textContent = "BusTime indisponível";
        $("cadStatusLista").innerHTML = `<p class="st-vazio">Não foi possível ler a frota ao vivo.</p>`;
      }
    }

    puxar();
    setInterval(puxar, 30000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
