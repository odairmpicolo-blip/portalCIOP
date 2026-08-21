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
    const frame = $("cadAdsFrame");
    if (frame && cadAdsSessao && cadAdsSessao.Username && frame.src !== href) frame.src = href;
  }

  function abrirPopupProgramacao() {
    const href = urlVisualizacaoProgramacao();
    const modal = $("cadAdsModal");
    const frame = $("cadAdsFrame");
    if (frame && (!frame.src || frame.src === "about:blank")) frame.src = href;
    if (modal) modal.hidden = false;
  }

  function fecharPopupProgramacao() {
    const modal = $("cadAdsModal");
    if (modal) modal.hidden = true;
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

  function unicos(lista) {
    return [...new Set(lista.map((x) => String(x)))];
  }

  function listaHtml(linhas, vazio) {
    if (!linhas.length) return `<p class="mn-vazio">${vazio}</p>`;
    return `<ul class="mn-lista">${linhas.join("")}</ul>`;
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

  function mostrarProgramacao(cad, q) {
    const linhas = filtra(cad.programacao || [], q, ["codigo", "descricao"]);
    const vis = linhas.slice(0, LIMITE_LISTA);
    $("mnProgMeta").textContent = `${linhas.length} linhas na programação · ${cad.totais?.tabelas ?? 0} tabelas`;
    $("mnProg").innerHTML = listaHtml(
      vis.map((p) => {
        const amostra = unicos(p.amostra || []).slice(0, 6).join(", ");
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
        const tabs = unicos((cad.tabelas || []).filter((t) => {
          const w = parseWorkId(t);
          if (w) return w.rota === codigo;
          return String(t).startsWith(codigo);
        }));
        $("mnProgDetalhe").hidden = false;
        $("mnProgDetalheTitulo").textContent = `Serviços da linha ${codigo} (${tabs.length})`;
        $("mnProgDetalheLista").innerHTML = tabs
          .slice(0, 400)
          .map((t) => {
            const w = parseWorkId(t);
            const extra = w ? `<span class="mn-chip">${w.rotuloDia}</span>` : "";
            return `<li>${esc(t)}${extra}</li>`;
          })
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
    }
    if (!cad) {
      $("mnStatus").textContent = "Ainda não há dump do CAD. A tabela de status usa a frota ao vivo.";
    } else {
      $("mnStatus").textContent = `Cadastros atualizados em ${fmtQuando(cad.atualizadoEm)}`;
    }
    let abaReg = "veiculos";
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
    ligarShell();
    iniciarStatusAoVivo(cad);
  }

  function abrirPainel(nome) {
    const id = "pane" + nome.charAt(0).toUpperCase() + nome.slice(1);
    document.querySelectorAll(".cad-pane").forEach((p) => p.classList.toggle("ativo", p.id === id));
    document.querySelectorAll(".cad-views [data-abrir]").forEach((b) => {
      b.classList.toggle("ativo", b.getAttribute("data-abrir") === nome);
    });
    if (nome === "mapa") setTimeout(() => window.__cadMapInvalidate?.(), 80);
  }

  function ligarShell() {
    document.querySelectorAll(".cad-views [data-abrir]").forEach((el) => {
      el.addEventListener("click", () => abrirPainel(el.getAttribute("data-abrir")));
    });
    $("btnAbrirProgramacao")?.addEventListener("click", abrirPopupProgramacao);
    $("cadAdsFechar")?.addEventListener("click", fecharPopupProgramacao);
    $("cadAdsNovaAba")?.addEventListener("click", () => {
      window.open(urlVisualizacaoProgramacao(), "cadAdsProg", "noopener");
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") fecharPopupProgramacao();
    });
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
    let veiculo = "No horário";
    if (CODIGOS_FORA.has(rt) || rt === "") veiculo = "Fora de serviço";
    else if (CODIGOS_OCIOSO.has(rt)) veiculo = "Ocioso";
    else if (delay != null && delay < -ADIANTADO_SEG) veiculo = "Adiantado";
    else if (delay != null && delay > ATRASADO_SEG) veiculo = "Atrasado";
    const cor =
      veiculo === "Adiantado" ? "#c81e1e" :
      veiculo === "Atrasado" ? "#eab308" :
      veiculo === "No horário" ? "#16a34a" :
      veiculo === "Ocioso" ? "#38bdf8" :
      "#94a3b8";
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
      logon: Boolean(String(v.oid || "").trim()),
      lat: Number(v.lat),
      lon: Number(v.lon)
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
      aba: "todos",
      abertos: new Set(["Adiantado", "Atrasado"]),
      mapFiltro: "todos"
    };

    const mapa = {
      leaflet: null,
      tiles: null,
      modo: "mapa",
      camada: null,
      markers: new Map()
    };

    function noBrasil(lat, lon) {
      return Number.isFinite(lat) && Number.isFinite(lon) && lat < -10 && lat > -34 && lon < -34 && lon > -74;
    }

    function htmlFicha(r) {
      const op = nomeMotorista(cad, r.oid);
      return `<div class="cad-map-lab"><b>NV</b> ${esc(r.vid)}<br><b>NP</b> ${esc(r.servico || "—")}<br><b>DT</b> ${esc(r.des || "—")}<br><b>RT</b> ${esc(r.rt || "—")}<br><b>NC</b> ${esc(r.oid || "—")}<br><b>OP</b> ${esc(op || "—")}</div>`;
    }

    function htmlIcone(r) {
      return `<div class="cad-map-mk"><span class="cad-map-pin" style="background:${esc(r.cor)}" title="${esc(r.vid)}"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="3" y="7" width="18" height="9" rx="1.5" fill="#fff"/><circle cx="8" cy="17" r="1.6" fill="#111"/><circle cx="16" cy="17" r="1.6" fill="#111"/></svg></span></div>`;
    }

    function listaMapa() {
      const q = norm($("mapBusca")?.value || "");
      return estado.rows.filter((r) => {
        if (!noBrasil(r.lat, r.lon)) return false;
        if (estado.mapFiltro === "tcgl" && r.operadora !== "TCGL") return false;
        if (estado.mapFiltro === "fora" && r.veiculo !== "Fora de serviço" && r.veiculo !== "Ocioso") return false;
        if (q && !norm(r.vid).includes(q) && !norm(r.rt).includes(q) && !norm(r.servico).includes(q)) return false;
        return true;
      });
    }

    function garantirMapa() {
      if (mapa.leaflet || typeof L === "undefined" || !$("cadMap")) return;
      mapa.leaflet = L.map("cadMap", { zoomControl: true }).setView([-23.31, -51.17], 13);
      mapa.tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap"
      }).addTo(mapa.leaflet);
      mapa.camada = L.layerGroup().addTo(mapa.leaflet);
      window.__cadMapInvalidate = () => mapa.leaflet.invalidateSize();
      document.querySelectorAll("[data-tiles]").forEach((btn) => {
        btn.addEventListener("click", () => {
          mapa.modo = btn.getAttribute("data-tiles");
          document.querySelectorAll("[data-tiles]").forEach((b) => b.classList.toggle("ativo", b === btn));
          mapa.leaflet.removeLayer(mapa.tiles);
          mapa.tiles = mapa.modo === "hibrido"
            ? L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "Esri" })
            : L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" });
          mapa.tiles.addTo(mapa.leaflet);
        });
      });
      document.querySelectorAll("[data-map-filtro]").forEach((btn) => {
        btn.addEventListener("click", () => {
          estado.mapFiltro = btn.getAttribute("data-map-filtro");
          document.querySelectorAll("[data-map-filtro]").forEach((b) => b.classList.toggle("ativo", b === btn));
          pintarMapa();
        });
      });
      $("mapBusca")?.addEventListener("input", pintarMapa);
      $("mapBusca")?.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter") return;
        const q = norm($("mapBusca").value);
        const hit = estado.rows.find((r) => noBrasil(r.lat, r.lon) && (norm(r.vid) === q || norm(r.vid).includes(q)));
        if (!hit) return;
        mapa.leaflet.setView([hit.lat, hit.lon], 17);
        requestAnimationFrame(() => mapa.markers.get(hit.vid)?.openPopup());
      });
    }

    function pintarMapa() {
      garantirMapa();
      if (!mapa.leaflet) return;
      const lista = listaMapa();
      const vistos = new Set();
      for (const r of lista) {
        vistos.add(r.vid);
        const icon = L.divIcon({
          className: "cad-map-icon",
          html: htmlIcone(r),
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        const destaque = r.veiculo === "Adiantado" || r.veiculo === "Atrasado" ? 200 : 0;
        let mk = mapa.markers.get(r.vid);
        if (!mk) {
          mk = L.marker([r.lat, r.lon], { icon, zIndexOffset: destaque });
          mk.bindTooltip("", { direction: "right", offset: [12, 0], className: "cad-map-tip", opacity: 1 });
          mk.bindPopup("", { className: "cad-map-pop", offset: [0, -8] });
          mk.addTo(mapa.camada);
          mapa.markers.set(r.vid, mk);
        } else {
          mk.setLatLng([r.lat, r.lon]);
          mk.setIcon(icon);
          mk.setZIndexOffset(destaque);
        }
        mk.setTooltipContent(htmlFicha(r));
        mk.setPopupContent(htmlFicha(r) + `<p class="cad-map-sit">${esc(r.veiculo)} · ${esc(r.operadora)}</p>`);
      }
      for (const [vid, mk] of mapa.markers) {
        if (vistos.has(vid)) continue;
        mapa.camada.removeLayer(mk);
        mapa.markers.delete(vid);
      }
    }

    function listaFiltrada() {
      const ve = $("stFiltroVeic")?.value || "";
      const q = norm($("stBusca")?.value || "");
      return estado.rows.filter((r) => {
        if (estado.aba === "tcgl" && r.operadora !== "TCGL") return false;
        if (estado.aba === "cmtu" && r.operadora !== "CMTU") return false;
        if (estado.aba === "semcom" && r.comunicacao !== "Não Comunicando") return false;
        if (ve && r.veiculo !== ve) return false;
        if (q) {
          const blob = norm([r.vid, r.rt, r.servico, r.oid, r.des].join(" "));
          if (!blob.includes(q)) return false;
        }
        return true;
      });
    }

    function pintarKpisStatus() {
      const rows = estado.rows;
      const nAd = rows.filter((r) => r.veiculo === "Adiantado").length;
      const nAt = rows.filter((r) => r.veiculo === "Atrasado").length;
      const nOff = rows.filter((r) => r.comunicacao !== "Comunicando").length;
      $("stKpis").innerHTML = `
        <div class="st-kpi"><b>${rows.length}</b><span>Na rua agora</span></div>
        <div class="st-kpi adiantado"><b>${nAd}</b><span>Adiantados</span></div>
        <div class="st-kpi atrasado"><b>${nAt}</b><span>Atrasados</span></div>
        <div class="st-kpi"><b>${nOff}</b><span>Sem comunicação</span></div>`;
    }

    function pintar() {
      const lista = listaFiltrada();
      pintarKpisStatus();

      const grupos = new Map();
      for (const r of lista) {
        if (!grupos.has(r.veiculo)) grupos.set(r.veiculo, []);
        grupos.get(r.veiculo).push(r);
      }
      const ordem = ["Adiantado", "Atrasado", "No horário", "Ocioso", "Fora de serviço"];
      const cols = `<tr>
        <th>Veículo</th><th>Situação</th><th>Linha</th><th>Atraso</th>
        <th>Motorista</th><th>Serviço</th><th>Destino</th><th>Última comunicação</th>
      </tr>`;
      let body = "";
      for (const st of ordem) {
        if (!grupos.has(st)) continue;
        const arr = grupos.get(st);
        const aberto = estado.abertos.has(st);
        body += `<tr class="st-g" data-g="${st}"><td colspan="8">${st} (${arr.length}) ${aberto ? "▾" : "▸"}</td></tr>`;
        if (!aberto) continue;
        arr.sort((a, b) => a.vid.localeCompare(b.vid, "pt", { numeric: true }));
        for (const r of arr) {
          const atraso = r.delayMin === "" ? "—" : (r.delayMin > 0 ? "+" + r.delayMin + " min" : r.delayMin + " min");
          body += `<tr class="st-row">
            <td>${esc(r.vid)}</td>
            <td><i class="st-cor" style="background:${esc(r.cor)}"></i>${esc(r.veiculo)}</td>
            <td>${esc(r.rt || "—")}</td>
            <td>${esc(atraso)}</td>
            <td>${esc(nomeMotorista(cad, r.oid) || "—")}</td>
            <td>${esc(r.servico || "—")}</td>
            <td>${esc(r.des || "—")}</td>
            <td>${esc(fmtTmstmp(r.tmstmp))}</td>
          </tr>`;
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
    $("stFiltroVeic")?.addEventListener("change", pintar);
    $("stBusca")?.addEventListener("input", pintar);

    async function puxar() {
      try {
        const base = await resolverProxy();
        const data = await fetch(base + "/getvehiclesdelay", { cache: "no-store" }).then((r) => r.json());
        const agora = Date.now();
        estado.rows = extrairListaBustime(data, "vehicle").map((v) => classificarVeiculo(v, agora));
        if ($("stLive")) $("stLive").textContent = `Atualizado ${new Date().toLocaleTimeString("pt-BR")}`;
        pintar();
        pintarMapa();
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
