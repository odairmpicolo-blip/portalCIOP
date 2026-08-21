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

  function hojeIsoLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function dataIncidenteIso(r) {
    if (r?.data_iso) return String(r.data_iso).slice(0, 10);
    const br = String(r?.data || "").trim();
    const p = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (p) return `${p[3]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
    return /^\d{4}-\d{2}-\d{2}/.test(br) ? br.slice(0, 10) : "";
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

  function tipoIncidente(row) {
    const original = String(row?.tipoOriginal || "").trim();
    const tipo = original && original.toUpperCase() !== "VAZIO" ? original : String(row?.tipo || "").trim();
    if (tipo.toUpperCase() === "AE") return "AE (Botão de Emergência)";
    return tipo || "Sem informação";
  }

  function mostrarIncidentes(inc, q) {
    const hoje = hojeIsoLocal();
    const dataBr = new Date(`${hoje}T00:00:00`).toLocaleDateString("pt-BR");
    const rows = (Array.isArray(inc?.incidentes) ? inc.incidentes : [])
      .filter((r) => String(r.empresa || "TCGL").toUpperCase() === "TCGL")
      .filter((r) => dataIncidenteIso(r) === hoje);
    rows.sort((a, b) => Number(b.incidentId || b.id || 0) - Number(a.incidentId || a.id || 0));
    const lista = filtra(rows, q, [
      "id", "incidentId", "veiculo", "linha", "tipo", "tipoOriginal", "estado",
      "criadoPor", "data", "hora", "motorista", "motoristaNr", "proprietario",
      "departamento", "natureOfProblem", "instructions"
    ]);
    const btnInc = $("btnAbaIncidentes");
    if (btnInc) {
      btnInc.innerHTML = `Incidentes<span class="cad-nav-count">${rows.length}</span>`;
    }
    if ($("mnIncTitulo")) $("mnIncTitulo").textContent = `Incidentes TCGL · ${dataBr}`;
    if ($("mnIncMeta")) {
      $("mnIncMeta").textContent = `${rows.length} incidente${rows.length === 1 ? "" : "s"} hoje` +
        (q ? ` · ${lista.length} no filtro` : "") +
        ` · atualizado ${fmtQuando(inc?.atualizadoEm)}`;
    }
    const tbody = $("mnInc");
    const vazio = $("mnIncVazio");
    if (!tbody) return;
    tbody.innerHTML = lista.map((r) => {
      const id = r.id || r.incidentId || "";
      return `<tr>
        <td><a class="pill" href="https://cioplondrina.com.br/CADIncidentManagement/" target="_blank" rel="noopener" data-incidente-id="${esc(id)}">${esc(id)}</a></td>
        <td>${esc(r.data || "")}</td>
        <td>${esc(r.hora || "")}</td>
        <td>${esc(r.departamento || "")}</td>
        <td title="${esc(r.veiculoDescricao || r.veiculo || "")}">${esc(r.veiculo || "")}</td>
        <td>${esc(r.linha || "")}</td>
        <td>${esc(r.criadoPor || "")}</td>
        <td>${esc(r.motoristaNr || "")}</td>
        <td>${esc(r.motorista || "")}</td>
        <td>${esc(tipoIncidente(r))}</td>
        <td>${esc(r.proprietario || "")}</td>
        <td>${esc(r.estado || "")}</td>
        <td>${esc(r.natureOfProblem || "")}</td>
        <td>${esc(r.instructions || "")}</td>
      </tr>`;
    }).join("");
    if (vazio) vazio.hidden = lista.length > 0;
  }

  async function carregarPayloadIncidentes() {
    try {
      const mod = await import("../assets/js/incidentes-dados-leitura.js?v=20260821cad24");
      const res = await mod.carregarDadosIncidentes();
      if (res?.payload) return res.payload;
    } catch (err) { /* fallback JSON estático */ }
    try {
      const rInc = await fetch(INC_JSON, { cache: "no-store" });
      if (rInc.ok) return await rInc.json();
    } catch (err) { /* opcional */ }
    return null;
  }

  async function iniciar() {
    let cad = null;
    let inc = null;
    try {
      const [rCad, payloadInc] = await Promise.all([
        fetch(CAD_JSON, { cache: "no-store" }),
        carregarPayloadIncidentes()
      ]);
      if (rCad.ok) cad = await rCad.json();
      inc = payloadInc;
    } catch (err) { /* JSON local opcional */ }
    const atualizar = () => mostrarIncidentes(inc, $("mnBuscaInc")?.value || "");
    $("mnBuscaInc")?.addEventListener("input", atualizar);
    $("mnInc")?.addEventListener("click", (ev) => {
      const link = ev.target.closest("a[data-incidente-id]");
      const id = link?.getAttribute("data-incidente-id");
      if (id && navigator.clipboard?.writeText) navigator.clipboard.writeText(id).catch(() => {});
    });
    atualizar();
    ligarLinksProgramacaoCad();
    ligarShell();
    iniciarStatusAoVivo(cad);
  }

  function abrirPainel(nome) {
    const mapaNome = nome === "sinotico" ? "mapa" : nome;
    const id = "pane" + mapaNome.charAt(0).toUpperCase() + mapaNome.slice(1);
    const eraSinotico = document.body.classList.contains("cad-sinotico");
    document.querySelectorAll(".cad-pane").forEach((p) => p.classList.toggle("ativo", p.id === id));
    document.querySelectorAll(".cad-views [data-abrir]").forEach((b) => {
      b.classList.toggle("ativo", b.getAttribute("data-abrir") === nome);
    });
    document.body.classList.toggle("cad-sinotico", nome === "sinotico");
    if (nome === "sinotico") window.__cadEntrarSinotico?.();
    else if (eraSinotico) window.__cadSairSinotico?.();
    if (mapaNome === "mapa") setTimeout(() => window.__cadMapInvalidate?.(), 80);
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
    $("cadAdsModal")?.addEventListener("click", (ev) => {
      if (ev.target.id === "cadAdsModal") fecharPopupProgramacao();
    });
  }

  const CODIGOS_OCIOSO = new Set(["PI", "DH", "PO"]);
  const CODIGOS_FORA = new Set(["U"]);
  const ADIANTADO_SEG = 120;
  const ATRASADO_SEG = 360;
  const SEM_COM_SEG = 180;
  const STATUS_CORES = {
    adiantado: "#D30000",
    atrasado: "#FFFF00",
    noHorario: "#8FD400",
    semPrevisao: "#374151",
    ocioso: "#7DD3FC",
    foraServico: "#3f4757",
    reserva: "#7c3aed",
    garagem: "#0f766e",
    gpsInvalido: "#0b1f4d"
  };
  const ANCORA_GPS_INVALIDO_VID = "411";
  const GARAGEM_TCGL_PONTO = { lat: -23.29298, lng: -51.16151 };
  const VIA_CORES = ["#2db4bf","#06245c","#ff6b00","#0b3a8a","#059669","#8b5cf6","#eab308","#ec4899","#38bdf8","#64748b"];
  const TERMINAIS = [
    { nome: "Central", lat: -23.3082945, lng: -51.1608587, raio: 300 },
    { nome: "Vivi Xavier", lat: -23.2607767, lng: -51.1729136, raio: 250 },
    { nome: "Shopping Catuaí", lat: -23.3437533, lng: -51.1860741, raio: 250 },
    { nome: "Ouro Verde", lat: -23.2816540, lng: -51.1710105, raio: 250 },
    { nome: "Milton Gavetti", lat: -23.2815404, lng: -51.1525856, raio: 250 },
    { nome: "Acapulco", lat: -23.3603910, lng: -51.1552581, raio: 250 },
    { nome: "Oeste", lat: -23.2971857, lng: -51.1871866, raio: 250 }
  ];
  const GARAGEM_AREA = { nome: "Garagem TCGL", lat: -23.293796, lng: -51.155893, raio: 250 };
  const PES_POR_METRO = 3.28084;
  const VEL_MINIMA_FANTASMA_KMH = 15;

  function contrastHex(hex) {
    const c = String(hex || "").replace("#", "");
    if (c.length !== 6) return "#fff";
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#06245c" : "#fff";
  }

  function operadoraVid(vid) {
    const n = parseInt(vid, 10);
    if (!Number.isFinite(n)) return "";
    if (n >= 0 && n <= 5000) return "TCGL";
    if (n >= 5001 && n <= 9999) return "LondriSul";
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

  function distanciaMetros(lat1, lng1, lat2, lng2) {
    const dLat = (lat1 - lat2) * 111320;
    const dLng = (lng1 - lng2) * 111320 * Math.cos(lat1 * Math.PI / 180);
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  function dentroDaGaragem(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return distanciaMetros(lat, lng, GARAGEM_AREA.lat, GARAGEM_AREA.lng) <= GARAGEM_AREA.raio;
  }

  function terminalDoPonto(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    let achado = null, menor = Infinity;
    for (const t of TERMINAIS) {
      const d = distanciaMetros(lat, lng, t.lat, t.lng);
      if (d <= t.raio && d < menor) {
        menor = d;
        achado = t;
      }
    }
    return achado;
  }

  function rotuloStatus(chave, reservaNome) {
    if (chave === "gpsInvalido") return "GPS inválido";
    if (chave === "reserva") return "Reserva" + (reservaNome ? " · " + reservaNome : "");
    if (chave === "garagem") return "Fora de serviço · Garagem";
    if (chave === "foraServico") return "Fora de serviço";
    if (chave === "noHorario") return "No horário";
    if (chave === "adiantado") return "Adiantado";
    if (chave === "atrasado") return "Atrasado";
    if (chave === "semPrevisao") return "Sem previsão";
    if (chave === "ocioso") return "Ocioso";
    return chave;
  }

  function categoriaOperacional(rt) {
    const n = parseInt(String(rt || ""), 10);
    if (Number.isFinite(n) && n >= 80 && n <= 999) return "produtivo";
    if (CODIGOS_OCIOSO.has(rt)) return "ocioso";
    return "foraServico";
  }

  function classificarVeiculo(v, agora, extra) {
    const rt = String(v.rt || "").trim();
    const delay = v.delaySec == null ? null : Number(v.delaySec);
    const t = parseTmstmp(v.tmstmp);
    const idade = t ? (agora - t.getTime()) / 1000 : 9999;
    const comunicando = idade <= SEM_COM_SEG;
    const gpsInvalido = Boolean(extra?.gpsInvalido);
    const lat = extra?.lat != null ? extra.lat : Number(v.lat);
    const lon = extra?.lon != null ? extra.lon : Number(v.lon);
    const cat = categoriaOperacional(rt);
    let chave = "noHorario";
    if (gpsInvalido) chave = "gpsInvalido";
    else if (cat === "ocioso") chave = "ocioso";
    else if (cat === "foraServico") chave = "foraServico";
    else if (delay == null || !Number.isFinite(delay)) chave = "semPrevisao";
    else if (delay < -ADIANTADO_SEG) chave = "adiantado";
    else if (delay > ATRASADO_SEG) chave = "atrasado";
    else chave = "noHorario";
    const terminal = (!gpsInvalido && chave === "foraServico") ? terminalDoPonto(lat, lon) : null;
    const naGaragem = !gpsInvalido && chave === "foraServico" && !terminal && dentroDaGaragem(lat, lon);
    if (chave === "foraServico" && terminal) chave = "reserva";
    else if (chave === "foraServico" && naGaragem) chave = "garagem";
    const veiculo = rotuloStatus(chave, terminal?.nome);
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
      chave,
      cor: STATUS_CORES[chave] || STATUS_CORES.foraServico,
      operadora: operadoraVid(v.vid),
      logon: Boolean(String(v.oid || "").trim()),
      lat,
      lon,
      latOriginal: Number(v.lat),
      lonOriginal: Number(v.lon),
      gpsInvalido,
      naGaragem,
      terminalReserva: terminal?.nome || "",
      hdg: v.hdg != null ? Number(v.hdg) : (v.heading != null ? Number(v.heading) : 0),
      pid: v.pid != null ? String(v.pid) : "",
      pdist: v.pdist != null && v.pdist !== "" ? Number(v.pdist) : "",
      tatripid: String(v.tatripid || v.origtatripno || v.tripid || "").trim(),
      rid: String(v.rid || "").replace(/^N\/A$/i, ""),
      delaySec: delay
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

  const FUNC_SHEET = "https://docs.google.com/spreadsheets/d/1zY_BFsidZyF4RnzKTZkZAlmo-Qiz6JEdIEb3E2xoIeA/export?format=csv&gid=1931884858";
  const funcionariosByReg = new Map();

  function chaveReg(s) {
    const d = String(s || "").replace(/\D/g, "");
    return d.replace(/^0+/, "") || d;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    const src = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      const next = src[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          i++;
        } else inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        row.push(cell);
        cell = "";
        continue;
      }
      if (ch === "\n" && !inQuotes) {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        continue;
      }
      cell += ch;
    }
    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }

  function ingestFuncionarios(lista) {
    if (!Array.isArray(lista)) return;
    for (const item of lista) {
      if (typeof item === "string") continue;
      const registro = String(item.registro || item[0] || "").trim();
      const nome = String(item.nome || item[1] || "").trim();
      const funcao = String(item.funcao || item[2] || "").trim();
      const k = chaveReg(registro);
      if (k && nome) funcionariosByReg.set(k, { registro, nome, funcao });
    }
  }

  function hidratarFuncionariosCache() {
    try {
      const ev = JSON.parse(localStorage.getItem("ciop_evidencias_funcionarios_v1") || "null");
      if (ev?.dados) ingestFuncionarios(ev.dados);
    } catch { /* ignore */ }
    try {
      const rel = JSON.parse(localStorage.getItem("portal_criar_relatorio_csv_v1") || "null");
      const rows = rel?.gids?.["1931884858"];
      if (Array.isArray(rows)) ingestFuncionarios(rows.slice(1).map((linha) => ({ registro: linha[0], nome: linha[1], funcao: linha[2] })));
    } catch { /* ignore */ }
  }

  async function carregarFuncionariosFolha() {
    hidratarFuncionariosCache();
    const txt = await fetch(FUNC_SHEET, { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    });
    funcionariosByReg.clear();
    ingestFuncionarios(parseCsv(txt).slice(1));
    try {
      localStorage.setItem("ciop_evidencias_funcionarios_v1", JSON.stringify({
        ts: Date.now(),
        dados: [...funcionariosByReg.values()]
      }));
    } catch { /* ignore */ }
  }

  function fichaPessoa(cad, oid) {
    const bruto = String(oid || "").trim();
    if (!bruto) return { nc: "", op: "" };
    const k = chaveReg(bruto);
    const folha = funcionariosByReg.get(k);
    if (folha) return { nc: folha.registro, op: folha.nome };
    const cadHit = (cad?.funcionarios || []).find((n) => chaveReg(n) === k || String(n).includes(bruto));
    if (cadHit && cadHit !== bruto) return { nc: bruto, op: String(cadHit) };
    return { nc: bruto, op: "" };
  }

  function nomeMotorista(cad, oid) {
    const p = fichaPessoa(cad, oid);
    if (p.nc && p.op) return `${p.nc} · ${p.op}`;
    return p.nc || p.op;
  }

  const FB = {
    waitMs: 5000,
    signals: {
      speed: ["20", "6054", "100", "99", "168"],
      rpm: ["11", "4670", "50", "140"],
      odometer: ["4563", "4669", "19", "66", "67", "122", "244", "68", "18"],
      fuel: ["33", "81", "25", "72", "4660", "63", "64", "9", "10"]
    },
    indice: null,
    cache: new Map(),
    predCache: new Map()
  };

  function pickSignal(signals, ids) {
    if (!signals) return null;
    for (const id of ids) {
      if (signals[id] != null && Number.isFinite(Number(signals[id]))) return Number(signals[id]);
    }
    return null;
  }

  function fmtNumBR(v, digits) {
    if (v == null || v === "" || !Number.isFinite(Number(v))) return "—";
    return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: digits ?? 0, minimumFractionDigits: digits ?? 0 });
  }

  function proxyFleetbus(cleverUrl) {
    return String(cleverUrl || "").replace(/\/clever\/?$/, "") + "/fleetbus";
  }

  async function indiceFleetbus(cleverUrl) {
    if (FB.indice) return FB.indice;
    const data = await fetch(proxyFleetbus(cleverUrl) + "/vehicles", { cache: "no-store" }).then((r) => r.json());
    const lista = Array.isArray(data) ? data : (data.vehicles || data.items || data.data || []);
    FB.indice = new Map();
    for (const v of lista) {
      const num = String(v.vehicleNumber || "").match(/^(\d+)/)?.[1];
      if (num) FB.indice.set(num, v.vehicleId);
    }
    return FB.indice;
  }

  async function telemetriaFleetbus(cleverUrl, vid) {
    const hit = FB.cache.get(vid);
    if (hit && Date.now() - hit.ts < 20000) return hit.data;
    const indice = await indiceFleetbus(cleverUrl);
    const id = indice.get(String(vid).replace(/\D/g, "") ? String(vid).match(/^\d+/)?.[0] : vid);
    if (id == null) {
      FB.cache.set(vid, { ts: Date.now(), data: "sem-match" });
      return "sem-match";
    }
    const data = await fetch(
      proxyFleetbus(cleverUrl) + "/live?vehicleId=" + encodeURIComponent(id) + "&waitMs=" + FB.waitMs,
      { cache: "no-store" }
    ).then((r) => r.json());
    const src = { ...(data.signals || {}), ...(data.normalized || {}) };
    const out = {
      speed: pickSignal(src, FB.signals.speed),
      rpm: pickSignal(src, FB.signals.rpm),
      odometer: pickSignal(src, FB.signals.odometer),
      fuel: pickSignal(src, FB.signals.fuel),
      faults: Array.isArray(data.faults) ? data.faults : []
    };
    FB.cache.set(vid, { ts: Date.now(), data: out });
    return out;
  }

  async function previsoesVid(cleverUrl, vid) {
    const hit = FB.predCache.get(vid);
    if (hit && Date.now() - hit.ts < 20000) return hit.data;
    try {
      const data = await fetch(cleverUrl + "/getpredictions?vid=" + encodeURIComponent(vid), { cache: "no-store" }).then((r) => r.json());
      const lista = extrairListaBustime(data, "prd").slice(0, 6).map((p) => ({
        parada: p.stpnm || p.stpid || "—",
        quando: p.prdctdn === "DUE" || p.prdctdn === "0" ? "APROXIMANDO" : (p.prdctdn != null ? `${p.prdctdn} MIN` : "—")
      }));
      FB.predCache.set(vid, { ts: Date.now(), data: lista });
      return lista;
    } catch {
      FB.predCache.set(vid, { ts: Date.now(), data: [] });
      return [];
    }
  }

  function direcaoCardinal(hdg) {
    if (!Number.isFinite(Number(hdg))) return "—";
    const dirs = ["Norte", "Nordeste", "Leste", "Sudeste", "Sul", "Sudoeste", "Oeste", "Noroeste"];
    return dirs[Math.round(((Number(hdg) % 360) + 360) % 360 / 45) % 8];
  }

  function fichaFrota(vid) {
    const n = String(vid || "").replace(/\D/g, "").replace(/^0+/, "") || String(vid || "").trim();
    const lista = Array.isArray(window.CIOP_FROTA_CONSULTA) ? window.CIOP_FROTA_CONSULTA : [];
    const hit = lista.find((v) => {
      const p = String(v.prefixo || "").replace(/\D/g, "").replace(/^0+/, "");
      return p && p === n;
    });
    if (!hit) return { placa: "", modelo: "", tecnologia: "" };
    const raw = String(hit.modelo || "").replace(/\s+/g, " ").replace(/\s*-\s*/g, " - ").trim();
    const partes = raw.split(" - ").map((s) => s.trim()).filter(Boolean);
    const modelo = partes.filter((p) => !/^(\d+(?:[.,]\d+)?)\s*M$/i.test(p)).join(" - ") || raw;
    return {
      placa: String(hit.placa || "").trim(),
      modelo,
      tecnologia: String(hit.tecnologia || "").trim()
    };
  }

  function tipoVeiculo(cad, vid) {
    const n = String(vid || "").trim();
    const cadV = (cad?.veiculos || []).find((v) => String(v.numero) === n);
    const patio = (window.FROTA_PATIO || []).find((f) => String(f.veiculo) === n);
    const partes = [cadV?.modelo, patio?.rotulo || patio?.tecnologia, patio?.climatizacao].filter(Boolean);
    return [...new Set(partes)].join(" · ") || "—";
  }

  function telemetriaPopupHtml(telemetria) {
    if (telemetria == null || telemetria === "carregando") {
      return '<div class="veiculo-panel-telemetria-titulo">Telemetria · FleetBus</div><div class="veiculo-panel-telemetria-msg">Carregando telemetria...</div>';
    }
    if (telemetria === "sem-match") {
      return '<div class="veiculo-panel-telemetria-titulo">Telemetria · FleetBus</div><div class="veiculo-panel-telemetria-msg">Veículo sem cadastro no FleetBus.</div>';
    }
    if (telemetria === "erro") {
      return '<div class="veiculo-panel-telemetria-titulo">Telemetria · FleetBus</div><div class="veiculo-panel-telemetria-msg">Falha ao carregar telemetria.</div>';
    }
    const grid = [
      ["Velocidade · FleetBus", telemetria.speed != null ? fmtNumBR(telemetria.speed) + " km/h" : "—"],
      ["RPM", telemetria.rpm != null ? fmtNumBR(telemetria.rpm) : "—"],
      ["Odômetro", telemetria.odometer != null ? fmtNumBR(telemetria.odometer, 1) + " km" : "—"],
      ["Combustível", telemetria.fuel != null ? fmtNumBR(telemetria.fuel) + " %" : "—"]
    ].map(([k, val]) => '<div class="popup-item">' + esc(k) + "<strong>" + esc(val) + "</strong></div>").join("");
    const faults = Array.isArray(telemetria.faults) ? telemetria.faults : [];
    const falhasHtml = faults.length
      ? '<div class="veiculo-panel-falhas"><div class="veiculo-panel-falhas-titulo">Falhas (' + faults.length + ")</div>" +
        faults.slice(0, 4).map((f) => '<div class="veiculo-panel-falha">' + esc(f.description || "Falha") + "</div>").join("") +
        "</div>"
      : '<div class="veiculo-panel-falhas ok">Sem falhas registradas</div>';
    return '<div class="veiculo-panel-telemetria-titulo">Telemetria · FleetBus</div><div class="veiculo-panel-grid">' + grid + "</div>" + falhasHtml;
  }

  function itemPopup(rotulo, valor) {
    return '<div class="popup-item">' + esc(rotulo) + "<strong>" + esc(valor || "—") + "</strong></div>";
  }

  function textoStatusQtd(r) {
    if (r.chave === "ocioso" || r.chave === "foraServico" || r.chave === "reserva" || r.chave === "garagem" || r.chave === "gpsInvalido" || r.chave === "semPrevisao" || r.delayMin === "") return r.veiculo;
    const min = Math.abs(r.delayMin);
    return r.veiculo + (min ? " · " + min + " min" : "");
  }

  function itemInfo(rotulo, valor) {
    return '<div class="oa-vinfo-item"><span>' + esc(rotulo) + "</span><strong>" + esc(valor || "—") + "</strong></div>";
  }

  function popupVeiculoHtml(cad, r, telemetria) {
    const frota = fichaFrota(r.vid);
    const patio = (window.FROTA_PATIO || []).find((f) => String(f.veiculo) === String(r.vid));
    const tec = frota.tecnologia || patio?.rotulo || patio?.tecnologia || tipoVeiculo(cad, r.vid);
    const fg = contrastHex(r.cor);
    return '<div class="oa-vinfo-head">' +
        '<span class="oa-vinfo-chip" style="background:' + esc(r.cor) + ";color:" + fg + '">' + esc(r.rt || r.vid) + "</span>" +
        '<span class="oa-vinfo-status" style="background:' + esc(r.cor) + ";color:" + fg + '">' + esc(textoStatusQtd(r)) + "</span>" +
      "</div>" +
      (r.gpsInvalido
        ? '<p class="veiculo-panel-aviso">Posição fora do Brasil — ícone ancorado na garagem.</p>'
        : "") +
      '<p class="oa-vinfo-sec">Operação</p>' +
      '<div class="oa-vinfo-grid">' +
        itemInfo("Motorista", nomeMotorista(cad, r.oid) || "N/A") +
        itemInfo("Trabalho", r.servico || r.rid || "—") +
        itemInfo("Bloco", r.tabela || "N/A") +
        itemInfo("Sentido", r.sentido || "—") +
        itemInfo("Via", r.des || "—") +
        itemInfo("Tecnologia", tec) +
        itemInfo("Placa", frota.placa) +
        itemInfo("Modelo", frota.modelo) +
      "</div>" +
      '<p class="oa-vinfo-sec">Posição</p>' +
      '<div class="oa-vinfo-grid">' +
        itemInfo("Velocidade", r.spd === "" ? "—" : fmtNumBR(r.spd) + " km/h") +
        itemInfo("Atualizado", fmtTmstmp(r.tmstmp)) +
        itemInfo("Latitude", Number.isFinite(r.lat) ? r.lat.toFixed(5) : "—") +
        itemInfo("Longitude", Number.isFinite(r.lon) ? r.lon.toFixed(5) : "—") +
      "</div>" +
      '<p class="oa-vinfo-sec">Telemetria FleetBus</p>' +
      telemetriaPopupHtml(telemetria);
  }

  function popupMapaHtml(cad, r, telemetria) {
    const p = fichaPessoa(cad, r.oid);
    const frota = fichaFrota(r.vid);
    const patio = (window.FROTA_PATIO || []).find((f) => String(f.veiculo) === String(r.vid));
    const tec = frota.tecnologia || patio?.rotulo || patio?.tecnologia || tipoVeiculo(cad, r.vid);
    return '<div class="veiculo-panel-inner" style="--cor:' + esc(r.cor) + '">' +
      '<div class="veiculo-panel-head">' +
        '<span class="veiculo-panel-chip" style="background:' + esc(r.cor) + ";color:" + contrastHex(r.cor) + '">' + esc(r.vid) + "</span>" +
        "<div>" +
          '<div class="veiculo-panel-title">Veículo ' + esc(r.vid) + " · " + esc(r.operadora || "") + "</div>" +
          '<span class="veiculo-panel-status" style="background:' + esc(r.cor) + ";color:" + contrastHex(r.cor) + '">' + esc(textoStatusQtd(r)) + "</span>" +
        "</div>" +
      "</div>" +
      '<div class="veiculo-panel-grid veiculo-panel-grid-3">' +
        itemPopup("Registro", p.nc || r.oid || "—") + itemPopup("Nome", p.op || "—") + itemPopup("Velocidade", r.spd === "" ? "—" : fmtNumBR(r.spd) + " km/h") +
      "</div>" +
      '<div class="veiculo-panel-grid veiculo-panel-grid-via">' + itemPopup("Linha", r.rt || "—") + itemPopup("Via", r.des || "—") + "</div>" +
      '<div class="veiculo-panel-grid veiculo-panel-grid-3">' +
        itemPopup("Bloco", r.tabela || "—") + itemPopup("Trabalho", r.servico || r.rid || "—") + itemPopup("Sentido", r.sentido || "—") +
      "</div>" +
      '<div class="veiculo-panel-grid veiculo-panel-grid-3">' +
        itemPopup("Placa", frota.placa) + itemPopup("Modelo", frota.modelo) + itemPopup("Tecnologia", tec) +
      "</div>" +
      telemetriaPopupHtml(telemetria) +
    "</div>";
  }

  function iniciarStatusAoVivo(cad) {
    const estado = {
      rows: [],
      aba: "todos",
      abertos: new Set(["Adiantado", "Atrasado"]),
      mapFiltro: "todos",
      mapOp: "",
      stOp: "",
      linhasSel: new Set(),
      buscaLinha: "",
      rotas: [],
      patternsCache: new Map(),
      perfOficial: null,
      popupVid: null
    };
    const janelaMapa = { leaflet: null, tiles: null, marcador: null };

    const mapa = {
      leaflet: null,
      tiles: null,
      modo: "mapa",
      camada: null,
      markers: new Map(),
      ghost: null,
      ghostMarkers: new Map(),
      traco: null,
      paradas: null,
      terminais: null
    };

    function noBrasil(lat, lon) {
      return Number.isFinite(lat) && Number.isFinite(lon) && lat < -10 && lat > -34 && lon < -34 && lon > -74;
    }

    function htmlIcone(r, extraClass, corOverride) {
      const cor = corOverride || r.cor || STATUS_CORES.noHorario;
      const cz = "#fff";
      const rot = Number.isFinite(r.hdg) ? r.hdg : 0;
      const uid = "b" + String(r.vid || "x").replace(/\W/g, "") + (extraClass ? "g" : "");
      const numero = esc(r.vid || "—");
      return '<div class="veh-pin ' + (extraClass || "") + '">' +
        '<svg viewBox="0 0 60 60" aria-hidden="true">' +
          '<defs>' +
            '<linearGradient id="busBevel' + uid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>' +
            '<radialGradient id="busGloss' + uid + '" cx=".32" cy=".2" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
            '<linearGradient id="beakBevel' + uid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>' +
            '<linearGradient id="chumboGlass' + uid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#636d7c"/><stop offset=".5" stop-color="#333b47"/><stop offset="1" stop-color="#14171d"/></linearGradient>' +
            '<linearGradient id="glassShine' + uid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
          '</defs>' +
          '<g transform="rotate(' + rot + ' 30 26)">' +
            '<path d="M30 1 L46 30 L14 30 Z" fill="' + esc(cor) + '" stroke="rgba(0,0,0,.5)" stroke-width="2.8" stroke-linejoin="round"/>' +
            '<path d="M30 1 L46 30 L14 30 Z" fill="url(#beakBevel' + uid + ')" stroke="none"/>' +
          '</g>' +
          '<rect x="13" y="9" width="34" height="34" rx="10" fill="' + esc(cor) + '" stroke="rgba(0,0,0,.45)" stroke-width="1.4"/>' +
          '<rect x="13" y="9" width="34" height="34" rx="10" fill="url(#busBevel' + uid + ')"/>' +
          '<rect x="13" y="9" width="34" height="34" rx="10" fill="url(#busGloss' + uid + ')"/>' +
          '<rect x="25" y="10.5" width="10" height="3.5" rx="1.2" fill="' + cz + '"/>' +
          '<rect x="17" y="15" width="26" height="21" rx="6" fill="' + cz + '"/>' +
          '<rect x="20" y="17.3" width="20" height="11.5" rx="2.8" fill="url(#chumboGlass' + uid + ')" stroke="rgba(0,0,0,.55)" stroke-width="1"/>' +
          '<rect x="20" y="17.3" width="20" height="11.5" rx="2.8" fill="url(#glassShine' + uid + ')"/>' +
          '<text x="30" y="25.9" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="7.2" font-weight="800" letter-spacing=".2" fill="#fff">' + numero + '</text>' +
          '<circle cx="22.5" cy="33" r="2.1" fill="' + cz + '"/><circle cx="37.5" cy="33" r="2.1" fill="' + cz + '"/>' +
          '<rect x="20.3" y="35" width="4.4" height="3.4" rx="1" fill="' + cz + '"/><rect x="35.3" y="35" width="4.4" height="3.4" rx="1" fill="' + cz + '"/>' +
        '</svg></div>';
    }

    function modoSinotico() {
      return document.body.classList.contains("cad-sinotico");
    }

    function listaMapa() {
      const q = norm($("mapBusca")?.value || "");
      const sel = estado.linhasSel;
      return estado.rows.filter((r) => {
        if (r.gpsInvalido) {
          /* entra no mapa ancorado */
        } else if (!noBrasil(r.lat, r.lon)) return false;
        if (modoSinotico()) {
          if (!sel.size || !sel.has(r.rt)) return false;
        } else if (sel.size && !sel.has(r.rt)) return false;
        if (estado.mapOp && r.operadora !== estado.mapOp) return false;
        if (estado.mapFiltro === "fora" && r.chave !== "foraServico" && r.chave !== "ocioso" && r.chave !== "reserva" && r.chave !== "garagem") return false;
        if (estado.mapFiltro === "reserva" && r.chave !== "reserva") return false;
        if (estado.mapFiltro === "garagem" && r.chave !== "garagem") return false;
        if (q && !norm(r.vid).includes(q) && !norm(r.rt).includes(q) && !norm(r.servico).includes(q) && !norm(r.des).includes(q) && !norm(nomeMotorista(cad, r.oid)).includes(q)) return false;
        return true;
      });
    }

    function corRota(rt, i) {
      const hit = estado.rotas.find((x) => x.routeId === rt);
      if (hit?.color) return hit.color;
      return VIA_CORES[(i || 0) % VIA_CORES.length];
    }

    function rotasVisiveis() {
      const q = norm(estado.buscaLinha);
      return estado.rotas.filter((r) => {
        const n = parseInt(r.shortName, 10);
        if (Number.isFinite(n) && (n < 80 || n > 999)) return false;
        if (q && !norm(r.shortName).includes(q) && !norm(r.longName).includes(q)) return false;
        return true;
      });
    }

    function pintarListaLinhas() {
      const box = $("listaLinhas");
      if (!box) return;
      const lista = rotasVisiveis();
      box.innerHTML = lista.map((r, i) => {
        const cor = corRota(r.routeId, i);
        const ativo = estado.linhasSel.has(r.routeId);
        return `<button type="button" class="line-btn${ativo ? " active" : ""}" data-id="${esc(r.routeId)}">
          <span class="line-count zero" data-contagem="${esc(r.routeId)}">0</span>
          <span class="line-chip" style="background:${esc(cor)};color:${contrastHex(cor)}">${esc(r.shortName)}</span>
          <span class="line-meta"><div class="line-name">Linha ${esc(r.shortName)}</div><div class="line-route">${esc(r.longName || "")}</div></span>
        </button>`;
      }).join("") || `<p class="mn-vazio">Nenhuma linha.</p>`;
      box.querySelectorAll(".line-btn").forEach((btn) => {
        btn.addEventListener("click", () => selecionarLinha(btn.getAttribute("data-id")));
      });
      atualizarContagemLinhas();
      const sel = $("stFiltroLinha");
      if (sel && !sel.dataset.ok) {
        sel.innerHTML = `<option value="">Todas as linhas</option>` + estado.rotas.map((r) => `<option value="${esc(r.routeId)}">${esc(r.shortName)}</option>`).join("");
        sel.dataset.ok = "1";
        sel.addEventListener("change", pintar);
      }
    }

    function atualizarContagemLinhas() {
      const por = new Map();
      for (const r of estado.rows) {
        if (r.chave === "ocioso" || r.chave === "foraServico" || r.chave === "reserva" || r.chave === "garagem" || r.chave === "gpsInvalido") continue;
        por.set(r.rt, (por.get(r.rt) || 0) + 1);
      }
      document.querySelectorAll("#listaLinhas .line-count").forEach((el) => {
        const n = por.get(el.getAttribute("data-contagem")) || 0;
        el.textContent = n;
        el.classList.toggle("zero", n === 0);
      });
    }

    function desenharTerminais() {
      if (!mapa.leaflet || mapa.terminais) return;
      mapa.terminais = L.layerGroup().addTo(mapa.leaflet);
      const areas = TERMINAIS.map((t) => ({ ...t, cor: "#7c3aed" })).concat([{ ...GARAGEM_AREA, cor: "#0f766e" }]);
      for (const t of areas) {
        L.circle([t.lat, t.lng], {
          radius: t.raio, color: t.cor, weight: 1.5, opacity: 0.75, dashArray: "5 4",
          fillColor: t.cor, fillOpacity: 0.1, interactive: false
        }).addTo(mapa.terminais);
        L.marker([t.lat, t.lng], {
          interactive: false,
          icon: L.divIcon({
            className: "terminal-rotulo-wrap",
            html: `<span class="terminal-rotulo" style="background:${esc(t.cor)}">${esc(t.nome)}</span>`,
            iconSize: [0, 0]
          })
        }).addTo(mapa.terminais);
      }
    }

    function limparTraco() {
      if (mapa.traco) { mapa.leaflet.removeLayer(mapa.traco); mapa.traco = null; }
      if (mapa.paradas) { mapa.leaflet.removeLayer(mapa.paradas); mapa.paradas = null; }
    }

    function limparFantasmas() {
      mapa.ghostMarkers.forEach((mk) => mapa.ghost?.removeLayer(mk));
      mapa.ghostMarkers.clear();
    }

    async function obterPontosPadrao(pid) {
      if (!pid) return [];
      if (estado.patternsCache.has(pid)) return estado.patternsCache.get(pid);
      try {
        const base = await resolverProxy();
        const data = await fetch(base + "/getpatterns?pid=" + encodeURIComponent(pid), { cache: "no-store" }).then((r) => r.json());
        const patterns = extrairListaBustime(data, "ptr");
        const pat = patterns.find((p) => String(p.pid) === String(pid)) || patterns[0];
        const pontos = (pat?.pt || [])
          .map((p) => ({ lat: Number(p.lat), lon: Number(p.lon), pdist: Number(p.pdist) }))
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.pdist));
        estado.patternsCache.set(pid, pontos);
        return pontos;
      } catch {
        estado.patternsCache.set(pid, []);
        return [];
      }
    }

    function interpolarNoTrajeto(pontos, alvoPdist) {
      if (!pontos.length) return null;
      const min = pontos[0].pdist, max = pontos[pontos.length - 1].pdist;
      const alvo = Math.max(min, Math.min(alvoPdist, max));
      for (let i = 1; i < pontos.length; i++) {
        const a = pontos[i - 1], b = pontos[i];
        if (alvo <= b.pdist) {
          const span = b.pdist - a.pdist;
          const f = span > 0 ? (alvo - a.pdist) / span : 0;
          return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f };
        }
      }
      const last = pontos[pontos.length - 1];
      return { lat: last.lat, lon: last.lon };
    }

    async function desenharTracosSelecionados() {
      limparTraco();
      const ids = [...estado.linhasSel];
      if (!ids.length || !mapa.leaflet) return;
      try {
        const base = await resolverProxy();
        const linhas = [];
        const paradas = [];
        let todos = [];
        for (const routeId of ids) {
          const data = await fetch(base + "/getpatterns?rt=" + encodeURIComponent(routeId), { cache: "no-store" }).then((r) => r.json());
          const patterns = extrairListaBustime(data, "ptr");
          const cor = corRota(routeId, 0);
          for (const pat of patterns) {
            if (!Array.isArray(pat.pt)) continue;
            const latlngs = pat.pt.map((p) => [Number(p.lat), Number(p.lon)]).filter(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo));
            if (latlngs.length) {
              linhas.push(L.polyline(latlngs, { color: "#fff", weight: 10, opacity: 0.65, lineCap: "round", lineJoin: "round" }));
              linhas.push(L.polyline(latlngs, { color: cor, weight: 5.5, opacity: 1, lineCap: "round", lineJoin: "round" }));
              todos = todos.concat(latlngs);
            }
            for (const p of pat.pt) {
              if (p.typ !== "S" || !Number.isFinite(Number(p.lat))) continue;
              paradas.push(L.circleMarker([Number(p.lat), Number(p.lon)], {
                radius: 5, weight: 2.5, color: "#fff", fillColor: cor, fillOpacity: 1
              }).bindTooltip(esc(p.stpnm || "Parada"), { direction: "top" }));
            }
          }
        }
        if (!linhas.length) return;
        mapa.traco = L.layerGroup(linhas).addTo(mapa.leaflet);
        mapa.paradas = L.layerGroup(paradas).addTo(mapa.leaflet);
        if (todos.length) mapa.leaflet.fitBounds(L.latLngBounds(todos), { padding: [50, 50], maxZoom: 16 });
      } catch { /* ignore */ }
    }

    async function atualizarFantasmas() {
      if (!mapa.leaflet) return;
      if (!estado.linhasSel.size) {
        limparFantasmas();
        return;
      }
      if (!mapa.ghost) mapa.ghost = L.layerGroup().addTo(mapa.leaflet);
      const alvos = listaMapa().filter((r) => r.pid && r.pdist !== "" && r.delaySec != null && r.chave !== "noHorario" && r.chave !== "ocioso" && r.chave !== "foraServico" && r.chave !== "reserva" && r.chave !== "garagem" && r.chave !== "gpsInvalido");
      const resultados = await Promise.all(alvos.map(async (r) => ({ r, pontos: await obterPontosPadrao(r.pid) })));
      const vistos = new Set();
      for (const { r, pontos } of resultados) {
        if (!pontos.length) continue;
        const velKmh = Number(r.spd) > 3 ? Number(r.spd) : VEL_MINIMA_FANTASMA_KMH;
        const velFtSeg = (velKmh * 1000 / 3600) * PES_POR_METRO;
        const pos = interpolarNoTrajeto(pontos, Number(r.pdist) + Number(r.delaySec) * velFtSeg);
        if (!pos) continue;
        vistos.add(r.vid);
        const rotulo = "Posição prevista · " + r.vid + " · " + r.veiculo;
        const icon = L.divIcon({
          className: "bus-marker-wrap",
          html: htmlIcone(r, "ghost-pin-veh", "#ffffff"),
          iconSize: [96, 96],
          iconAnchor: [48, 42]
        });
        let mk = mapa.ghostMarkers.get(r.vid);
        if (!mk) {
          mk = L.marker([pos.lat, pos.lon], { icon, zIndexOffset: -200, interactive: false })
            .bindTooltip(rotulo, { direction: "top", offset: [0, -50], className: "ghost-tooltip" })
            .addTo(mapa.ghost);
          mapa.ghostMarkers.set(r.vid, mk);
        } else {
          mk.setLatLng([pos.lat, pos.lon]);
          mk.setIcon(icon);
          mk.setTooltipContent(rotulo);
        }
      }
      for (const [vid, mk] of mapa.ghostMarkers) {
        if (vistos.has(vid)) continue;
        mapa.ghost.removeLayer(mk);
        mapa.ghostMarkers.delete(vid);
      }
    }

    async function selecionarLinha(rt) {
      if (!rt) return;
      if (estado.linhasSel.has(rt)) estado.linhasSel.delete(rt);
      else estado.linhasSel.add(rt);
      pintarListaLinhas();
      pintarMapa();
      if (estado.linhasSel.size) {
        await desenharTracosSelecionados();
        await atualizarFantasmas();
      } else {
        limparTraco();
        limparFantasmas();
      }
    }

    function fmtPct(v) {
      if (v == null || !Number.isFinite(Number(v))) return "—";
      return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
    }

    function dadosPerformance() {
      const of = estado.perfOficial;
      if (of?.indices && typeof of.indices.noHorario === "number" && !estado.linhasSel.size) {
        return { oficial: true, pct: of.indices.noHorario, atrasadoPct: of.indices.atrasado, adiantadoPct: of.indices.adiantado, geradoEm: of.geradoEm || of.atualizadoEm };
      }
      const prod = estado.rows.filter((r) => r.chave === "adiantado" || r.chave === "atrasado" || r.chave === "noHorario");
      const recorte = estado.linhasSel.size ? prod.filter((r) => estado.linhasSel.has(r.rt)) : prod;
      const nH = recorte.filter((r) => r.chave === "noHorario").length;
      const nAt = recorte.filter((r) => r.chave === "atrasado").length;
      const nAd = recorte.filter((r) => r.chave === "adiantado").length;
      const t = recorte.length;
      return { oficial: false, pct: t ? (nH / t) * 100 : null, noHorario: nH, atrasado: nAt, adiantado: nAd, total: t, filtro: estado.linhasSel.size ? [...estado.linhasSel].join(", ") : null };
    }

    function atualizarChipPerformance() {
      const d = dadosPerformance();
      if ($("statIndicePerformance")) $("statIndicePerformance").textContent = fmtPct(d.pct);
    }

    function pintarModalPerformance() {
      const d = dadosPerformance();
      atualizarChipPerformance();
      if ($("oaIndicePerfNumero")) $("oaIndicePerfNumero").textContent = fmtPct(d.pct);
      if ($("oaIndicePerfSubtitulo")) {
        $("oaIndicePerfSubtitulo").textContent = d.oficial
          ? "Indicador oficial OTP/CAD · apurado " + (d.geradoEm ? new Date(d.geradoEm).toLocaleString("pt-BR") : "—")
          : (d.filtro ? "Recorte da linha " + d.filtro + " · cálculo local pelo Clever" : "Estimativa local pelo Clever");
      }
      const p = (v) => (d.total ? (v / d.total) * 100 : (d.oficial ? d : 0));
      const ad = d.oficial ? d.adiantadoPct : p(d.adiantado);
      const nh = d.oficial ? d.pct : p(d.noHorario);
      const at = d.oficial ? d.atrasadoPct : p(d.atrasado);
      const barras = [
        { lab: "Adiantado", val: ad, cor: STATUS_CORES.adiantado },
        { lab: "No horário", val: nh, cor: STATUS_CORES.noHorario },
        { lab: "Atrasado", val: at, cor: STATUS_CORES.atrasado }
      ];
      const alvo = $("oaIndicePerfBreakdown");
      if (!alvo) return;
      alvo.innerHTML = `<div class="oa-perf-card"><h4>OTP</h4>
        <p class="oa-perf-card-sub">Aderência ao horário</p>
        <div class="oa-perf-bars">${barras.map((b) => {
          const v = Math.max(0, Math.min(100, Number(b.val) || 0));
          return `<div class="oa-perf-bar-col"><span class="oa-perf-bar-val" style="background:${b.cor};color:#fff">${fmtPct(b.val)}</span><span class="oa-perf-bar" style="height:${v}%;background:${b.cor}"></span></div>`;
        }).join("")}</div>
        <div class="oa-perf-bars" style="height:auto;border:0">${barras.map((b) => `<span class="oa-perf-bar-lab" style="width:48px">${b.lab}</span>`).join("")}</div>
      </div>`;
    }

    async function carregarPerformance() {
      try {
        const dados = await fetch("../assets/data/performance.json?t=" + Date.now(), { cache: "no-store" }).then((r) => r.json());
        if (dados?.indices) estado.perfOficial = dados;
      } catch { /* local fallback */ }
      atualizarChipPerformance();
    }

    async function carregarRotas() {
      if (estado.rotas.length) return;
      try {
        const base = await resolverProxy();
        const data = await fetch(base + "/getroutes", { cache: "no-store" }).then((r) => r.json());
        estado.rotas = extrairListaBustime(data, "routes").map((r, i) => ({
          routeId: String(r.rt || ""),
          shortName: String(r.rt || "?"),
          longName: String(r.rtnm || ""),
          color: r.rtclr ? (String(r.rtclr).startsWith("#") ? r.rtclr : "#" + r.rtclr) : VIA_CORES[i % VIA_CORES.length]
        })).filter((r) => r.routeId).sort((a, b) => String(a.shortName).localeCompare(b.shortName, "pt", { numeric: true }));
        pintarListaLinhas();
      } catch { /* ignore */ }
    }

    function pintarMiniMapa(r, recentrar) {
      const el = $("stVeicMapa");
      if (!el || typeof L === "undefined" || !Number.isFinite(r.lat) || !Number.isFinite(r.lon)) return;
      if (!janelaMapa.leaflet) {
        janelaMapa.leaflet = L.map(el, { zoomControl: true, attributionControl: false }).setView([r.lat, r.lon], 16);
        janelaMapa.tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(janelaMapa.leaflet);
      }
      const icon = L.divIcon({
        className: "bus-marker-wrap",
        html: htmlIcone(r, "highlight"),
        iconSize: [96, 96],
        iconAnchor: [48, 42]
      });
      if (!janelaMapa.marcador) {
        janelaMapa.marcador = L.marker([r.lat, r.lon], { icon }).addTo(janelaMapa.leaflet);
      } else {
        janelaMapa.marcador.setLatLng([r.lat, r.lon]);
        janelaMapa.marcador.setIcon(icon);
      }
      if (recentrar) janelaMapa.leaflet.setView([r.lat, r.lon], 16, { animate: false });
      setTimeout(() => janelaMapa.leaflet.invalidateSize(), 80);
    }

    async function abrirPopupStatus(vid) {
      const r = estado.rows.find((x) => x.vid === vid);
      if (!r) return;
      estado.popupVid = vid;
      const overlay = $("stVeicOverlay");
      const box = $("stVeicBox");
      if (!overlay || !box) return;
      if ($("stVeicTitulo")) $("stVeicTitulo").textContent = "Veículo " + r.vid;
      if ($("stVeicSubtitulo")) $("stVeicSubtitulo").textContent = [r.operadora, r.veiculo].filter(Boolean).join(" · ");
      box.innerHTML = popupVeiculoHtml(cad, r, FB.cache.get(vid)?.data || "carregando");
      overlay.hidden = false;
      pintarMiniMapa(r, true);
      try {
        const base = await resolverProxy();
        const fb = await telemetriaFleetbus(base, vid);
        if (estado.popupVid === vid) {
          const atual = estado.rows.find((x) => x.vid === vid) || r;
          box.innerHTML = popupVeiculoHtml(cad, atual, fb);
        }
      } catch { /* ignore */ }
    }

    function fecharPopupStatus() {
      estado.popupVid = null;
      const overlay = $("stVeicOverlay");
      if (overlay) overlay.hidden = true;
    }

    function blobPaleta(r) {
      const p = fichaPessoa(cad, r.oid);
      const frota = fichaFrota(r.vid);
      return norm([
        r.vid, r.rt, r.des, r.servico, r.tabela, r.rid, r.operadora, r.veiculo,
        r.oid, p.nc, p.op, frota.placa, frota.modelo, frota.tecnologia
      ].join(" "));
    }

    function buscarNaPaleta(termo) {
      const q = norm(termo);
      if (!q) return [];
      const placaQ = String(termo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      return estado.rows.filter((r) => {
        if (blobPaleta(r).includes(q)) return true;
        if (placaQ.length >= 4) {
          const pl = fichaFrota(r.vid).placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
          if (pl && pl.includes(placaQ)) return true;
        }
        return false;
      }).sort((a, b) => a.vid.localeCompare(b.vid, "pt", { numeric: true })).slice(0, 40);
    }

    function renderPaleta(termo) {
      const lista = $("oaPaletaLista");
      if (!lista) return;
      if (!String(termo || "").trim()) {
        lista.innerHTML = '<li class="oa-paleta-vazio">Digite veículo, linha, placa, serviço, tecnologia ou registro.</li>';
        return;
      }
      const achados = buscarNaPaleta(termo);
      if (!achados.length) {
        lista.innerHTML = '<li class="oa-paleta-vazio">Nenhum veículo com esse termo.</li>';
        return;
      }
      lista.innerHTML = achados.map((r, i) => {
        const frota = fichaFrota(r.vid);
        const p = fichaPessoa(cad, r.oid);
        const linha = r.rt ? ("Linha " + r.rt) : r.veiculo;
        return '<li class="oa-paleta-item' + (i === 0 ? " ativo" : "") + '" data-vid="' + esc(r.vid) + '">' +
          '<span class="oa-paleta-vid" style="background:' + esc(r.cor) + ';color:' + contrastHex(r.cor) + '">' + esc(r.vid) + "</span>" +
          '<span class="oa-paleta-txt"><b>' + esc([r.operadora, linha, frota.placa].filter(Boolean).join(" · ")) + "</b>" +
          "<span>" + esc([p.nc && p.op ? p.nc + " · " + p.op : (p.nc || p.op || "—"), r.servico || "", frota.tecnologia || frota.modelo || "", r.veiculo].filter(Boolean).join(" · ")) + "</span></span></li>";
      }).join("");
      lista.querySelectorAll(".oa-paleta-item").forEach((el) => {
        el.addEventListener("click", () => escolherNaPaleta(el.getAttribute("data-vid")));
      });
    }

    function paletaAberta() {
      return $("oaPaletaOverlay")?.classList.contains("open");
    }

    function abrirPaleta() {
      $("oaPaletaOverlay")?.classList.add("open");
      const campo = $("oaPaletaInput");
      if (campo) {
        campo.value = "";
        setTimeout(() => campo.focus(), 40);
      }
      renderPaleta("");
    }

    function fecharPaleta() {
      $("oaPaletaOverlay")?.classList.remove("open");
    }

    function escolherNaPaleta(vid) {
      if (!vid) return;
      fecharPaleta();
      abrirPopupStatus(vid);
    }

    function garantirMapa() {
      if (mapa.leaflet || typeof L === "undefined" || !$("cadMap")) return;
      mapa.leaflet = L.map("cadMap", { zoomControl: true }).setView([-23.31, -51.17], 13);
      mapa.tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap"
      }).addTo(mapa.leaflet);
      mapa.camada = L.layerGroup().addTo(mapa.leaflet);
      desenharTerminais();
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
      document.querySelectorAll("[data-map-op]").forEach((btn) => {
        btn.addEventListener("click", () => {
          estado.mapOp = btn.getAttribute("data-map-op") || "";
          document.querySelectorAll("[data-map-op]").forEach((b) => b.classList.toggle("ativo", b === btn));
          pintarMapa();
        });
      });
      document.querySelectorAll("[data-map-filtro]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const f = btn.getAttribute("data-map-filtro");
          estado.mapFiltro = estado.mapFiltro === f ? "todos" : f;
          document.querySelectorAll("[data-map-filtro]").forEach((b) => {
            b.classList.toggle("ativo", b.getAttribute("data-map-filtro") === estado.mapFiltro);
          });
          pintarMapa();
        });
      });
      $("mapBusca")?.addEventListener("input", pintarMapa);
      $("mapBusca")?.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter") return;
        const q = norm($("mapBusca").value);
        const porVid = estado.rows.find((r) => noBrasil(r.lat, r.lon) && (norm(r.vid) === q || norm(r.vid).includes(q)));
        if (porVid) {
          abrirVeiculoNoMapa(porVid.vid);
          return;
        }
        const porLinha = estado.rotas.find((r) => norm(r.shortName) === q || norm(r.shortName).includes(q));
        if (porLinha) selecionarLinha(porLinha.routeId);
      });
      $("buscaLinha")?.addEventListener("input", () => {
        estado.buscaLinha = $("buscaLinha").value;
        pintarListaLinhas();
      });
      $("btnLimparLinha")?.addEventListener("click", () => {
        estado.linhasSel.clear();
        limparTraco();
        limparFantasmas();
        pintarListaLinhas();
        pintarMapa();
      });
      function fecharPaineisMapa() {
        const busca = $("oaBuscaPainel");
        const linhas = $("oaLinhasPainel");
        if (busca) busca.hidden = true;
        if (linhas) linhas.hidden = true;
        $("oaBtnLupa")?.classList.remove("aberto");
        $("oaBtnLinhas")?.classList.remove("aberto");
      }
      function abrirPainelLinhas() {
        const linhas = $("oaLinhasPainel");
        const busca = $("oaBuscaPainel");
        if (busca) busca.hidden = true;
        $("oaBtnLupa")?.classList.remove("aberto");
        if (linhas) linhas.hidden = false;
        $("oaBtnLinhas")?.classList.add("aberto");
        const dica = document.querySelector(".map-linhas-dica");
        const limpar = $("btnLimparLinha");
        if (dica) dica.textContent = modoSinotico()
          ? "Marque uma ou mais linhas. Só elas aparecem, com o fantasminha."
          : "Clique na linha para filtrar. Pode marcar várias.";
        if (limpar) limpar.textContent = modoSinotico() ? "Limpar seleção" : "Todas as linhas";
        pintarListaLinhas();
      }
      window.__cadAbrirLinhas = abrirPainelLinhas;
      window.__cadEntrarSinotico = () => {
        estado.linhasSel.clear();
        limparTraco();
        limparFantasmas();
        abrirPainelLinhas();
        pintarMapa();
      };
      window.__cadSairSinotico = () => {
        estado.linhasSel.clear();
        limparTraco();
        limparFantasmas();
        pintarListaLinhas();
        pintarMapa();
      };
      $("oaBtnLupa")?.addEventListener("click", () => {
        const painel = $("oaBuscaPainel");
        const abrir = painel?.hidden;
        fecharPaineisMapa();
        if (abrir && painel) {
          painel.hidden = false;
          $("oaBtnLupa").classList.add("aberto");
          $("mapBusca")?.focus();
        }
      });
      $("oaBtnLinhas")?.addEventListener("click", () => {
        const painel = $("oaLinhasPainel");
        const abrir = painel?.hidden;
        fecharPaineisMapa();
        if (abrir) abrirPainelLinhas();
      });
    }

    async function enriquecerPopup(vid, mk) {
      const r = estado.rows.find((x) => x.vid === vid);
      if (!r || !mk.isPopupOpen()) return;
      mk.setPopupContent(popupMapaHtml(cad, r, FB.cache.get(vid)?.data || "carregando"));
      let fb = "erro";
      try {
        const base = await resolverProxy();
        fb = await telemetriaFleetbus(base, vid);
      } catch { /* ignore */ }
      const atual = estado.rows.find((x) => x.vid === vid);
      if (!atual || !mk.isPopupOpen()) return;
      mk.setPopupContent(popupMapaHtml(cad, atual, fb));
    }

    function abrirVeiculoNoMapa(vid) {
      abrirPainel("mapa");
      garantirMapa();
      pintarMapa();
      const r = estado.rows.find((x) => x.vid === vid);
      if (!r || !noBrasil(r.lat, r.lon) || !mapa.leaflet) return;
      setTimeout(() => {
        mapa.leaflet.invalidateSize();
        mapa.leaflet.setView([r.lat, r.lon], 16);
        const mk = mapa.markers.get(vid);
        mk?.openPopup();
      }, 120);
    }

    function pintarMapa() {
      garantirMapa();
      if (!mapa.leaflet) return;
      const lista = listaMapa();
      const vistos = new Set();
      for (const r of lista) {
        vistos.add(r.vid);
        const icon = L.divIcon({
          className: "bus-marker-wrap",
          html: htmlIcone(r),
          iconSize: [96, 96],
          iconAnchor: [48, 42],
          popupAnchor: [0, -42]
        });
        const destaque = r.chave === "adiantado" || r.chave === "atrasado" ? 200 : 0;
        let mk = mapa.markers.get(r.vid);
        if (!mk) {
          mk = L.marker([r.lat, r.lon], { icon, zIndexOffset: destaque });
          mk.bindPopup(() => {
            const atual = estado.rows.find((x) => x.vid === r.vid) || r;
            return popupMapaHtml(cad, atual, FB.cache.get(r.vid)?.data);
          }, { className: "veiculo-popup", offset: [0, -6], autoPanPadding: [30, 30] });
          mk.on("popupopen", () => enriquecerPopup(r.vid, mk));
          mk.addTo(mapa.camada);
          mapa.markers.set(r.vid, mk);
        } else {
          mk.setLatLng([r.lat, r.lon]);
          mk.setIcon(icon);
          mk.setZIndexOffset(destaque);
          if (mk.isPopupOpen()) mk.setPopupContent(popupMapaHtml(cad, r, FB.cache.get(r.vid)?.data));
        }
      }
      for (const [vid, mk] of mapa.markers) {
        if (vistos.has(vid)) continue;
        mapa.camada.removeLayer(mk);
        mapa.markers.delete(vid);
      }
      atualizarFantasmas();
      atualizarContagemLinhas();
      atualizarChipPerformance();
    }

    function listaFiltrada() {
      const ve = $("stFiltroVeic")?.value || "";
      const q = norm($("stBusca")?.value || "");
      return estado.rows.filter((r) => {
        if (r.chave === "gpsInvalido") return false;
        if (estado.stOp && r.operadora !== estado.stOp) return false;
        if (estado.aba === "fora" && r.chave !== "foraServico" && r.chave !== "ocioso" && r.chave !== "reserva" && r.chave !== "garagem") return false;
        if (ve && r.chave !== "gpsInvalido") {
          const ok =
            !ve ||
            r.veiculo === ve ||
            (ve === "Reserva" && r.chave === "reserva") ||
            (ve === "Garagem" && r.chave === "garagem") ||
            (ve === "Fora de serviço" && r.chave === "foraServico");
          if (!ok) return false;
        }
        const linha = $("stFiltroLinha")?.value || "";
        if (linha && r.rt !== linha) return false;
        if (q) {
          const blob = norm([r.vid, r.rt, r.servico, r.oid, r.des, r.operadora, nomeMotorista(cad, r.oid)].join(" "));
          if (!blob.includes(q)) return false;
        }
        return true;
      });
    }

    function pintarKpisStatus() {
      const base = estado.stOp ? estado.rows.filter((r) => r.operadora === estado.stOp) : estado.rows;
      const naRua = base.filter((r) => r.chave !== "gpsInvalido" && r.chave !== "reserva" && r.chave !== "garagem");
      const nAd = naRua.filter((r) => r.chave === "adiantado").length;
      const nAt = naRua.filter((r) => r.chave === "atrasado").length;
      const nRes = base.filter((r) => r.chave === "reserva").length;
      const nGa = estado.rows.filter((r) => r.chave === "garagem").length;
      if ($("statReserva")) $("statReserva").textContent = estado.rows.filter((r) => r.chave === "reserva").length;
      if ($("statGaragem")) $("statGaragem").textContent = nGa;
      if ($("stKpis")) {
        $("stKpis").innerHTML = `
        <div class="st-kpi"><b>${naRua.length}</b><span>Na rua agora</span></div>
        <div class="st-kpi adiantado"><b>${nAd}</b><span>Adiantados</span></div>
        <div class="st-kpi atrasado"><b>${nAt}</b><span>Atrasados</span></div>
        <div class="st-kpi"><b>${nRes}</b><span>Reserva</span></div>
        <div class="st-kpi"><b>${nGa}</b><span>Garagem TCGL</span></div>`;
      }
    }

    function pintarErros() {
      const gps = estado.rows.filter((r) => r.chave === "gpsInvalido");
      const sem = estado.rows.filter((r) => r.comunicacao !== "Comunicando" && r.chave !== "gpsInvalido");
      if ($("errosGpsTitulo")) $("errosGpsTitulo").textContent = `GPS inválido (${gps.length})`;
      if ($("errosComTitulo")) $("errosComTitulo").textContent = `Sem comunicação (${sem.length})`;
      if ($("errosMeta")) $("errosMeta").textContent = `${gps.length + sem.length} veículos com erro · ${gps.length} GPS · ${sem.length} sem comunicação`;
      const li = (r) => `<li><strong>${esc(r.vid)}</strong> <span>${esc(r.operadora)} · ${esc(r.rt || "—")} · ${esc(fmtTmstmp(r.tmstmp))}</span></li>`;
      if ($("errosGpsLista")) $("errosGpsLista").innerHTML = gps.length ? gps.map(li).join("") : "<li>Nenhum veículo com GPS inválido.</li>";
      if ($("errosComLista")) $("errosComLista").innerHTML = sem.length ? sem.map(li).join("") : "<li>Todos comunicando.</li>";
    }

    function pintar() {
      const lista = listaFiltrada();
      pintarKpisStatus();
      pintarErros();

      const grupos = new Map();
      for (const r of lista) {
        const g = r.chave === "reserva" ? "Reserva" : r.chave === "garagem" ? "Garagem" : r.chave === "foraServico" ? "Fora de serviço" : r.chave === "noHorario" ? "No horário" : r.chave === "adiantado" ? "Adiantado" : r.chave === "atrasado" ? "Atrasado" : r.chave === "semPrevisao" ? "Sem previsão" : r.chave === "ocioso" ? "Ocioso" : r.veiculo;
        if (!grupos.has(g)) grupos.set(g, []);
        grupos.get(g).push(r);
      }
      const ordem = ["Adiantado", "Atrasado", "No horário", "Sem previsão", "Ocioso", "Reserva", "Garagem", "Fora de serviço"];
      const cols = `<tr>
        <th>Veículo</th><th>Empresa</th><th>Situação</th><th>Linha</th><th>Atraso</th>
        <th>Motorista</th><th>Serviço</th><th>Destino</th><th>Última comunicação</th>
      </tr>`;
      let body = "";
      for (const st of ordem) {
        if (!grupos.has(st)) continue;
        const arr = grupos.get(st);
        const aberto = estado.abertos.has(st);
        body += `<tr class="st-g" data-g="${st}"><td colspan="9">${st} (${arr.length}) ${aberto ? "▾" : "▸"}</td></tr>`;
        if (!aberto) continue;
        arr.sort((a, b) => a.vid.localeCompare(b.vid, "pt", { numeric: true }));
        for (const r of arr) {
          const atraso = r.delayMin === "" ? "—" : (r.delayMin > 0 ? "+" + r.delayMin + " min" : r.delayMin + " min");
          const opCls = r.operadora === "LondriSul" ? "lsul" : "tcgl";
          body += `<tr class="st-row" data-vid="${esc(r.vid)}">
            <td>${esc(r.vid)}</td>
            <td><span class="st-op ${opCls}">${esc(r.operadora || "—")}</span></td>
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
      $("cadStatusLista").querySelectorAll("tr.st-row[data-vid]").forEach((tr) => {
        tr.addEventListener("click", () => abrirPopupStatus(tr.getAttribute("data-vid")));
      });
    }

    window.__cadPintarStatus = pintar;

    document.querySelectorAll("[data-st-op]").forEach((btn) => {
      btn.addEventListener("click", () => {
        estado.stOp = btn.getAttribute("data-st-op") || "";
        document.querySelectorAll("[data-st-op]").forEach((b) => b.classList.toggle("ativo", b === btn));
        pintar();
      });
    });
    document.querySelectorAll("[data-st-aba]").forEach((btn) => {
      btn.addEventListener("click", () => {
        estado.aba = btn.getAttribute("data-st-aba");
        document.querySelectorAll("[data-st-aba]").forEach((b) => b.classList.toggle("ativo", b === btn));
        pintar();
      });
    });
    $("stFiltroVeic")?.addEventListener("change", pintar);
    $("stBusca")?.addEventListener("input", pintar);
    $("kpiIndicePerformance")?.addEventListener("click", () => {
      pintarModalPerformance();
      const ov = $("oaIndicePerfOverlay");
      if (ov) ov.hidden = false;
    });
    $("oaIndicePerfFechar")?.addEventListener("click", () => { const ov = $("oaIndicePerfOverlay"); if (ov) ov.hidden = true; });
    $("oaIndicePerfOverlay")?.addEventListener("click", (ev) => { if (ev.target.id === "oaIndicePerfOverlay") ev.currentTarget.hidden = true; });
    $("stVeicFechar")?.addEventListener("click", fecharPopupStatus);
    $("stVeicOverlay")?.addEventListener("click", (ev) => { if (ev.target.id === "stVeicOverlay") fecharPopupStatus(); });
    $("oaPaletaInput")?.addEventListener("input", (e) => renderPaleta(e.target.value));
    $("oaPaletaInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        escolherNaPaleta($("oaPaletaLista")?.querySelector(".oa-paleta-item")?.getAttribute("data-vid"));
      }
    });
    $("oaPaletaOverlay")?.addEventListener("click", (e) => {
      if (e.target.id === "oaPaletaOverlay") fecharPaleta();
    });
    document.addEventListener("keydown", (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "");
      if ((mod && (e.key === "t" || e.key === "T" || e.key === "k" || e.key === "K"))
        || (e.key === "/" && !digitando && !mod)) {
        e.preventDefault();
        abrirPaleta();
        return;
      }
      if (e.key === "Escape" && paletaAberta()) {
        fecharPaleta();
      }
    });

    async function puxar() {
      try {
        const base = await resolverProxy();
        const data = await fetch(base + "/getvehiclesdelay", { cache: "no-store" }).then((r) => r.json());
        const agora = Date.now();
        const bruto = extrairListaBustime(data, "vehicle");
        const ancoraRef = bruto.find((x) => String(x.vid ?? "") === ANCORA_GPS_INVALIDO_VID);
        let ancora = GARAGEM_TCGL_PONTO;
        const alat = Number(ancoraRef?.lat), alng = Number(ancoraRef?.lon);
        if (noBrasil(alat, alng)) ancora = { lat: alat, lng: alng };
        let nGps = 0;
        estado.rows = bruto.map((v) => {
          const latB = Number(v.lat), lonB = Number(v.lon);
          const op = operadoraVid(v.vid);
          const coordOk = noBrasil(latB, lonB);
          const gpsInvalido = !coordOk && op === "TCGL";
          if (!coordOk && !gpsInvalido) return null;
          let lat = latB, lon = lonB;
          if (gpsInvalido) {
            const ang = nGps * 2.39996;
            const raio = 0.00030 + nGps * 0.00010;
            lat = ancora.lat + raio * Math.cos(ang);
            lon = ancora.lng + raio * Math.sin(ang);
            nGps += 1;
          }
          return classificarVeiculo(v, agora, { lat, lon, gpsInvalido });
        }).filter(Boolean);
        if ($("stLive")) $("stLive").textContent = `Atualizado ${new Date().toLocaleTimeString("pt-BR")}`;
        pintar();
        pintarMapa();
      } catch {
        if ($("stLive")) $("stLive").textContent = "BusTime indisponível";
        $("cadStatusLista").innerHTML = `<p class="st-vazio">Não foi possível ler a frota ao vivo.</p>`;
      }
    }

    hidratarFuncionariosCache();
    carregarPerformance();
    carregarRotas();
    garantirMapa();
    puxar();
    setInterval(puxar, 30000);
    carregarFuncionariosFolha()
      .then(() => {
        pintar();
        pintarMapa();
      })
      .catch(() => {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
