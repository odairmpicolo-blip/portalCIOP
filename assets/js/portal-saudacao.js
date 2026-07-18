const MASCULINO_TERMINA_A = new Set([
    "joshua", "luca", "nikita", "mustafa", "barnabe"
]);

const FEMININO_SEM_A = new Set([
    "beatriz", "raquel", "isabel", "mabel", "carmem", "ines", "mercedes",
    "alice", "nicole", "michelle", "rachel", "gisele", "gabrielle", "jane", "june",
    "rose", "claire", "marileide", "sueli", "luz", "sol", "judith", "ingrid", "geneci"
]);

const FEMININO_TERMINA_E = new Set([
    "simone", "irene", "michele", "caroline", "eliane", "silviane", "claudine",
    "ruth", "edite", "suzane", "ivone", "ione", "cleonice"
]);

export const MESES_PORTAL = [
    {
        mes: "Janeiro",
        campanha: "Janeiro Branco",
        conscientizacao: "Cuidar da mente é cuidar bem da vida",
        cor: "#64748b",
        corClara: "#f8fafc",
        corEscura: "#334155",
        gradiente: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
        campanhaImg: "assets/img/janeiro-branco-campanha.png",
        lacoImg: "assets/img/lacos/laco-janeiro.png"
    },
    {
        mes: "Fevereiro",
        campanha: "Fevereiro Roxo",
        conscientizacao: "Conscientização e prevenção sobre Lúpus, Fibromialgia e Alzheimer",
        cor: "#9333ea",
        corClara: "#ffedd5",
        corEscura: "#7c3aed",
        gradiente: "linear-gradient(135deg, #9333ea 0%, #ea580c 100%)",
        campanhaImg: "assets/img/fevereiro-roxo-campanha.png",
        lacoImg: "assets/img/lacos/laco-fevereiro.png"
    },
    {
        mes: "Março",
        campanha: "Março Lilás",
        conscientizacao: "Prevenção ao câncer de colo do útero",
        cor: "#9333ea",
        corClara: "#f3e8ff",
        corEscura: "#6b21a8",
        gradiente: "linear-gradient(135deg, #f5f0ff 0%, #e9d5ff 55%, #c084fc 100%)",
        campanhaImg: "assets/img/marco-lilas-campanha.png",
        lacoImg: "assets/img/lacos/laco-marco.png"
    },
    {
        mes: "Abril",
        campanha: "Abril Azul",
        conscientizacao: "Mês de conscientização sobre o autismo",
        cor: "#06b6d4",
        corClara: "#cffafe",
        corEscura: "#0e7490",
        gradiente: "linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)",
        campanhaImg: "assets/img/abril-azul-campanha.png",
        lacoImg: "assets/img/lacos/laco-abril.png"
    },
    {
        mes: "Maio",
        campanha: "Maio Amarelo",
        conscientizacao: "Mês da conscientização sobre a paz no trânsito",
        cor: "#eab308",
        corClara: "#fef9c3",
        corEscura: "#a16207",
        gradiente: "linear-gradient(135deg, #facc15 0%, #eab308 100%)",
        campanhaImg: "assets/img/maio-amarelo-campanha.png",
        lacoImg: "assets/img/lacos/laco-maio.png"
    },
    {
        mes: "Junho",
        campanha: "Junho Violeta",
        conscientizacao: "Mês de combate à violação dos direitos da pessoa idosa",
        cor: "#7b2d8e",
        corClara: "#c084fc",
        corEscura: "#5b1f73",
        gradiente: "linear-gradient(135deg, #9d4edd 0%, #6b21a8 100%)",
        lacoImg: "assets/img/lacos/laco-junho.png"
    },
    {
        mes: "Julho",
        campanha: "Julho Amarelo & Verde",
        conscientizacao: "Prevenção das hepatites virais\nMês de conscientização mundial sobre o câncer de cabeça e pescoço",
        cor: "#84cc16",
        corClara: "#fde047",
        corEscura: "#15803d",
        gradiente: "linear-gradient(135deg, #22c55e 0%, #eab308 100%)",
        campanhaImg: "assets/img/julho-amarelo-campanha.png",
        lacoImg: "assets/img/lacos/laco-julho.png"
    },
    {
        mes: "Agosto",
        campanha: "Agosto Dourado",
        conscientizacao: "Mês dedicado ao incentivo à amamentação",
        cor: "#c8920a",
        corClara: "#fef3c7",
        corEscura: "#92400e",
        gradiente: "linear-gradient(135deg, #fef9ef 0%, #f5ead6 100%)",
        campanhaImg: "assets/img/agosto-dourado-campanha.png",
        lacoImg: "assets/img/lacos/laco-agosto.png"
    },
    {
        mes: "Setembro",
        campanha: "Setembro Amarelo",
        conscientizacao: "Prevenção ao suicídio e valorização da vida",
        cor: "#eed15c",
        corClara: "#fef9c3",
        corEscura: "#854d0e",
        gradiente: "linear-gradient(135deg, #f5de7a 0%, #eed15c 100%)",
        campanhaImg: "assets/img/setembro-amarelo-campanha.png",
        lacoImg: "assets/img/lacos/laco-setembro.png"
    },
    {
        mes: "Outubro",
        campanha: "Outubro Rosa",
        conscientizacao: "Mês de conscientização sobre o câncer de mama",
        cor: "#db2777",
        corClara: "#fce7f3",
        corEscura: "#be185d",
        gradiente: "linear-gradient(135deg, #fdf2f8 0%, #fbcfe8 100%)",
        campanhaImg: "assets/img/outubro-rosa-campanha.png",
        lacoImg: "assets/img/lacos/laco-outubro.png"
    },
    {
        mes: "Novembro",
        campanha: "Novembro Azul",
        conscientizacao: "Mês de combate ao câncer de próstata",
        cor: "#0ea5e9",
        corClara: "#e0f2fe",
        corEscura: "#1e3a8a",
        gradiente: "linear-gradient(135deg, #f8fcff 0%, #e0f2fe 100%)",
        campanhaImg: "assets/img/novembro-azul-campanha.png",
        lacoImg: "assets/img/lacos/laco-novembro.png"
    },
    {
        mes: "Dezembro",
        campanha: "Dezembro Vermelho",
        conscientizacao: "Mês de enfrentamento ao HIV/AIDS e outras IST",
        cor: "#dc2626",
        corClara: "#fecaca",
        corEscura: "#991b1b",
        gradiente: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
        campanhaImg: "assets/img/dezembro-vermelho-campanha.png",
        lacoImg: "assets/img/lacos/laco-dezembro.png"
    }
];

function normalizarNome(nome) {
    return String(nome || "")
        .trim()
        .split(/\s+/)[0]
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

export function ehNomeFeminino(nomeCompleto) {
    const n = normalizarNome(nomeCompleto);
    if (!n) return false;
    if (FEMININO_SEM_A.has(n) || FEMININO_TERMINA_E.has(n)) return true;
    if (MASCULINO_TERMINA_A.has(n)) return false;
    return n.endsWith("a");
}

function ehGeneroFeminino(genero) {
    const g = String(genero || "").trim().toLowerCase();
    return g === "f" || g === "fem" || g === "feminino" || g === "feminina" || g === "mulher";
}

export function textoSaudacao(nome, genero) {
    const feminino = ehGeneroFeminino(genero) || ehNomeFeminino(nome);
    return feminino ? "Bem-vinda" : "Bem-vindo";
}

export function temaMesAtual(dataRef, opts = {}) {
    if (opts.temaOverride) return opts.temaOverride;
    const sim = resolverMesSimulado();
    if (sim) return sim;
    const d = dataRef instanceof Date ? dataRef : new Date();
    return MESES_PORTAL[d.getMonth()] || MESES_PORTAL[0];
}

function resolverMesSimulado() {
    const params = new URLSearchParams(window.location.search);
    const raw = String(params.get("mes") || params.get("simularMes") || "").trim();
    if (!raw) return null;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 12) return MESES_PORTAL[n - 1];
    const norm = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const idx = MESES_PORTAL.findIndex((t) =>
        t.mes.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === norm
    );
    return idx >= 0 ? MESES_PORTAL[idx] : null;
}

function partesCampanha(tema) {
    const palavras = String(tema.campanha || "").trim().split(/\s+/);
    if (palavras.length >= 2 && palavras[0].toLowerCase() === tema.mes.toLowerCase()) {
        return { mes: palavras[0], destaque: palavras.slice(1).join(" ") };
    }
    return { mes: tema.mes, destaque: palavras[palavras.length - 1] || tema.campanha };
}

function resolverAsset(relPath) {
    const rel = String(relPath || "").replace(/^\//, "");
    const path = String(window.location?.pathname || "").replace(/\\/g, "/");
    const pagesIdx = path.indexOf("/pages/");
    if (pagesIdx >= 0) return path.slice(0, pagesIdx) + "/" + rel;
    try {
        return new URL(rel, window.location.href).href;
    } catch {
        return rel;
    }
}

function svgLaco(corClara, corEscura) {
    const uid = "ribbonGrad" + Math.random().toString(36).slice(2, 8);
    return '<svg class="header-hero-ribbon-svg" viewBox="0 0 35 35" aria-hidden="true" focusable="false">' +
        "<defs><linearGradient id=\"" + uid + "\" x1=\"20%\" y1=\"0%\" x2=\"80%\" y2=\"100%\">" +
        "<stop offset=\"0%\" stop-color=\"" + corClara + "\"/>" +
        "<stop offset=\"100%\" stop-color=\"" + corEscura + "\"/>" +
        "</linearGradient></defs>" +
        "<path fill=\"url(#" + uid + ")\" d=\"M17.573 2.811C14.812 6.448 9.867 9.636 5.092 9.636 2.276 9.636 0 11.912 0 14.708c0 3.637 2.761 6.825 5.092 9.637 3.637 4.572 9.092 7.958 12.481 10.769 3.389-2.811 8.844-6.197 12.481-10.769 2.331-2.811 5.092-6 5.092-9.637 0-2.796-2.276-5.072-5.092-5.072-4.775 0-9.72-3.188-12.481-6.817z\"/>" +
        "<path fill=\"rgba(255,255,255,.18)\" d=\"M12 12c2-2.5 4.5-3.5 5.5-3.5s3.5 1 5.5 3.5\"/>" +
        "</svg>";
}

function htmlLaco(tema) {
    if (tema.lacoImg) {
        const src = resolverAsset(tema.lacoImg);
        return '<img class="header-hero-ribbon-img" src="' + src + '" alt="" decoding="async">';
    }
    return svgLaco(tema.corClara, tema.corEscura);
}

export function aplicarSaudacaoHero(nome, opts = {}) {
    const hero = document.getElementById("headerHero");
    const bloc = document.getElementById("heroSaudacaoBloc");
    const saudacaoEl = document.getElementById("heroSaudacao");
    const nomeEl = document.getElementById("heroNomeUsuario");
    const mesNomeEl = document.getElementById("heroMesNome");
    const campanhaDestaqueEl = document.getElementById("heroCampanhaDestaque");
    const mesEl = document.getElementById("heroMesConsciencia");
    const ribbonEl = document.getElementById("heroRibbon");
    const campanhaEl = document.getElementById("heroCampanha");
    const bannerEl = document.getElementById("heroCampanhaBanner");
    const logoMes = document.getElementById("heroLogoMes");
    const campanhaMeta = document.getElementById("heroCampanhaMeta");
    if (!hero || !saudacaoEl || !nomeEl) return;

    const texto = String(nome || window.portalUsuario?.nome || "").trim();
    const partes = texto.split(/\s+/);
    const primeiro = partes[0] || texto || "usuário";
    const genero = opts.genero ?? window.portalUsuario?.genero ?? "";
    const saudacao = textoSaudacao(primeiro, genero);

    saudacaoEl.textContent = saudacao;
    nomeEl.textContent = primeiro;
    hero.setAttribute("aria-label", saudacao + ", " + primeiro);

    const tema = temaMesAtual(new Date(), opts);
    const campanha = partesCampanha(tema);
    const tituloCampanha = tema.campanha + ": " + tema.conscientizacao;
    const logoSrc = tema.lacoImg || null;

    hero.dataset.mes = tema.mes.toLowerCase();
    hero.style.setProperty("--hero-mes-cor", tema.cor);
    hero.style.setProperty("--hero-mes-escura", tema.corEscura);
    hero.style.setProperty("--hero-mes-gradiente", tema.gradiente);
    if (bloc) {
        bloc.style.setProperty("--hero-mes-cor", tema.cor);
        bloc.style.setProperty("--hero-mes-escura", tema.corEscura);
        bloc.style.setProperty("--hero-mes-gradiente", tema.gradiente);
    }

    if (mesNomeEl) mesNomeEl.textContent = campanha.mes;
    if (campanhaDestaqueEl) campanhaDestaqueEl.textContent = campanha.destaque;
    if (mesEl) mesEl.textContent = tema.conscientizacao;

    if (logoSrc && bannerEl && logoMes) {
        const src = resolverAsset(logoSrc) + "?v=" + encodeURIComponent(tema.mes.toLowerCase());
        bannerEl.onerror = () => {
            logoMes.hidden = true;
            if (ribbonEl) {
                ribbonEl.innerHTML = htmlLaco(tema);
                ribbonEl.classList.add("hero-pro-ribbon-fallback");
                ribbonEl.title = tituloCampanha;
            }
        };
        bannerEl.onload = () => {
            logoMes.hidden = false;
            if (ribbonEl) {
                ribbonEl.innerHTML = "";
                ribbonEl.classList.remove("hero-pro-ribbon-fallback");
            }
        };
        bannerEl.alt = tituloCampanha;
        bannerEl.dataset.mesAtual = tema.mes;
        if (bannerEl.getAttribute("src") !== src) bannerEl.src = src;
        logoMes.classList.remove("hero-pro-logo--banner");
        logoMes.classList.add("hero-pro-logo--emblem");
        logoMes.hidden = false;
        if (campanhaMeta) campanhaMeta.hidden = false;
        if (campanhaEl) {
            campanhaEl.hidden = false;
            campanhaEl.title = tituloCampanha;
        }
        return;
    }

    if (logoMes) logoMes.hidden = true;
    if (bannerEl) {
        bannerEl.removeAttribute("src");
        bannerEl.dataset.mesAtual = "";
    }
    if (campanhaMeta) campanhaMeta.hidden = false;
    if (campanhaEl) {
        campanhaEl.hidden = false;
        campanhaEl.title = tituloCampanha;
    }
    if (ribbonEl) {
        ribbonEl.innerHTML = htmlLaco(tema);
        ribbonEl.classList.add("hero-pro-ribbon-fallback");
        ribbonEl.title = tituloCampanha;
    }
}
