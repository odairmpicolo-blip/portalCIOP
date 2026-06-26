const MASCULINO_TERMINA_A = new Set([
    "joshua", "luca", "nikita", "mustafa", "barnabe"
]);

const FEMININO_SEM_A = new Set([
    "beatriz", "raquel", "isabel", "mabel", "carmem", "ines", "inês", "mercedes",
    "alice", "nicole", "michelle", "rachel", "gisele", "gabrielle", "jane", "june",
    "rose", "claire", "marileide", "sueli", "luz", "sol"
]);

export const MESES_PORTAL = [
    {
        mes: "Janeiro",
        campanha: "Janeiro Branco",
        conscientizacao: "Paz e saúde mental",
        cor: "#64748b",
        corClara: "#f8fafc",
        corEscura: "#334155",
        gradiente: "linear-gradient(135deg, #94a3b8 0%, #475569 100%)"
    },
    {
        mes: "Fevereiro",
        campanha: "Fevereiro Roxo",
        conscientizacao: "Lúpus, fibromialgia e malformação de Chiari",
        cor: "#9333ea",
        corClara: "#f3e8ff",
        corEscura: "#6b21a8",
        gradiente: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)"
    },
    {
        mes: "Março",
        campanha: "Março Lilás",
        conscientizacao: "Combate à violência contra a mulher",
        cor: "#c084fc",
        corClara: "#faf5ff",
        corEscura: "#7e22ce",
        gradiente: "linear-gradient(135deg, #d8b4fe 0%, #9333ea 100%)"
    },
    {
        mes: "Abril",
        campanha: "Abril Azul",
        conscientizacao: "Conscientização sobre o autismo",
        cor: "#2563eb",
        corClara: "#eff6ff",
        corEscura: "#1e40af",
        gradiente: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
    },
    {
        mes: "Maio",
        campanha: "Maio Amarelo",
        conscientizacao: "Segurança no trânsito",
        cor: "#eab308",
        corClara: "#fefce8",
        corEscura: "#a16207",
        gradiente: "linear-gradient(135deg, #facc15 0%, #ca8a04 100%)"
    },
    {
        mes: "Junho",
        campanha: "Junho Violeta",
        conscientizacao: "Mês de combate à violação dos direitos da pessoa idosa",
        cor: "#7b2d8e",
        corClara: "#c084fc",
        corEscura: "#5b1f73",
        gradiente: "linear-gradient(135deg, #9d4edd 0%, #6b21a8 100%)"
    },
    {
        mes: "Julho",
        campanha: "Julho Amarelo",
        conscientizacao: "Prevenção das hepatites virais",
        cor: "#f59e0b",
        corClara: "#fffbeb",
        corEscura: "#b45309",
        gradiente: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)"
    },
    {
        mes: "Agosto",
        campanha: "Agosto Dourado",
        conscientizacao: "Aleitamento materno",
        cor: "#d97706",
        corClara: "#fff7ed",
        corEscura: "#9a3412",
        gradiente: "linear-gradient(135deg, #f59e0b 0%, #c2410c 100%)"
    },
    {
        mes: "Setembro",
        campanha: "Setembro Amarelo",
        conscientizacao: "Prevenção ao suicídio e valorização da vida",
        cor: "#facc15",
        corClara: "#fef9c3",
        corEscura: "#854d0e",
        gradiente: "linear-gradient(135deg, #fde047 0%, #eab308 100%)"
    },
    {
        mes: "Outubro",
        campanha: "Outubro Rosa",
        conscientizacao: "Prevenção ao câncer de mama",
        cor: "#ec4899",
        corClara: "#fdf2f8",
        corEscura: "#be185d",
        gradiente: "linear-gradient(135deg, #f472b6 0%, #db2777 100%)"
    },
    {
        mes: "Novembro",
        campanha: "Novembro Azul",
        conscientizacao: "Prevenção ao câncer de próstata",
        cor: "#1d4ed8",
        corClara: "#eff6ff",
        corEscura: "#1e3a8a",
        gradiente: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)"
    },
    {
        mes: "Dezembro",
        campanha: "Dezembro Vermelho",
        conscientizacao: "Prevenção ao HIV/AIDS",
        cor: "#dc2626",
        corClara: "#fef2f2",
        corEscura: "#991b1b",
        gradiente: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
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
    if (FEMININO_SEM_A.has(n)) return true;
    if (MASCULINO_TERMINA_A.has(n)) return false;
    return n.endsWith("a");
}

export function temaMesAtual(dataRef) {
    const d = dataRef instanceof Date ? dataRef : new Date();
    return MESES_PORTAL[d.getMonth()] || MESES_PORTAL[0];
}

function partesCampanha(tema) {
    const palavras = String(tema.campanha || "").trim().split(/\s+/);
    if (palavras.length >= 2 && palavras[0].toLowerCase() === tema.mes.toLowerCase()) {
        return { mes: palavras[0], destaque: palavras.slice(1).join(" ") };
    }
    return { mes: tema.mes, destaque: palavras[palavras.length - 1] || tema.campanha };
}

function svgLaco(corClara, corEscura) {
    const uid = "ribbonGrad" + Math.random().toString(36).slice(2, 8);
    return '<svg class="header-hero-ribbon-svg" viewBox="0 0 56 64" aria-hidden="true" focusable="false">' +
        "<defs><linearGradient id=\"" + uid + "\" x1=\"18%\" y1=\"0%\" x2=\"82%\" y2=\"100%\">" +
        "<stop offset=\"0%\" stop-color=\"" + corClara + "\"/>" +
        "<stop offset=\"55%\" stop-color=\"" + corEscura + "\"/>" +
        "<stop offset=\"100%\" stop-color=\"" + corEscura + "\"/>" +
        "</linearGradient></defs>" +
        "<path fill=\"url(#" + uid + ")\" d=\"M28 4c-2 3.5-8 6.5-12 12.5-3.5 5-3.5 11.5 0 16.5 2.5 3.5 6 6.5 9 9.5l3 2.8 3-2.8c3-3 6.5-6 9-9.5 3.5-5 3.5-11.5 0-16.5C36 10.5 30 7.5 28 4Z\"/>" +
        "<path fill=\"url(#" + uid + ")\" opacity=\".92\" d=\"M16 38c-4 2.5-8 6-8 11s4 9.5 8 12.5l4 3 4-3c4-3 8-7 8-12.5s-4-8.5-8-11l-4-2.5-4 2.5Z\"/>" +
        "<path fill=\"rgba(255,255,255,.22)\" d=\"M22 22c1.5-2.5 3.5-4 6-4s4.5 1.5 6 4\"/>" +
        "</svg>";
}

export function aplicarSaudacaoHero(nome) {
    const hero = document.getElementById("headerHero");
    const saudacaoEl = document.getElementById("heroSaudacao");
    const nomeEl = document.getElementById("heroNomeUsuario");
    const mesNomeEl = document.getElementById("heroMesNome");
    const campanhaDestaqueEl = document.getElementById("heroCampanhaDestaque");
    const mesEl = document.getElementById("heroMesConsciencia");
    const ribbonEl = document.getElementById("heroRibbon");
    const campanhaEl = document.getElementById("heroCampanha");
    if (!hero || !saudacaoEl || !nomeEl) return;

    const texto = String(nome || window.portalUsuario?.nome || "").trim();
    const partes = texto.split(/\s+/);
    const primeiro = partes[0] || texto || "usuário";
    const feminino = ehNomeFeminino(texto);

    saudacaoEl.textContent = feminino ? "Bem-vinda" : "Bem-vindo";
    nomeEl.textContent = primeiro;

    const tema = temaMesAtual(new Date());
    const campanha = partesCampanha(tema);
    hero.dataset.mes = tema.mes.toLowerCase();
    hero.style.setProperty("--hero-mes-cor", tema.cor);
    hero.style.setProperty("--hero-mes-escura", tema.corEscura);
    hero.style.removeProperty("background");
    hero.style.removeProperty("box-shadow");

    if (mesNomeEl) mesNomeEl.textContent = campanha.mes;
    if (campanhaDestaqueEl) campanhaDestaqueEl.textContent = campanha.destaque;
    if (mesEl) mesEl.textContent = tema.conscientizacao;

    if (ribbonEl) {
        ribbonEl.innerHTML = svgLaco(tema.corClara, tema.corEscura);
        ribbonEl.title = tema.campanha + ": " + tema.conscientizacao;
    }
    if (campanhaEl) {
        campanhaEl.title = tema.campanha + ": " + tema.conscientizacao;
    }
}
