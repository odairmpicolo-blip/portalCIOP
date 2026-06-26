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
        campanha: "Junho Roxo",
        conscientizacao: "Combate à violência contra o idoso",
        cor: "#7c3aed",
        corClara: "#f5f3ff",
        corEscura: "#5b21b6",
        gradiente: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)"
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

function svgLaco(cor) {
    return '<svg class="header-hero-ribbon-svg" viewBox="0 0 32 40" aria-hidden="true" focusable="false">' +
        '<path fill="' + cor + '" d="M16 2c-3.2 5.2-10 8.2-10 16.2 0 5.8 3.6 9.8 7.2 13.2l2.8 2.6 2.8-2.6c3.6-3.4 7.2-7.4 7.2-13.2C26 10.2 19.2 7.2 16 2Z"/>' +
        '<path fill="rgba(255,255,255,.28)" d="M13 18c1.2-2.4 3-3.8 3-3.8s1.8 1.4 3 3.8"/>' +
    "</svg>";
}

export function aplicarSaudacaoHero(nome) {
    const hero = document.getElementById("headerHero");
    const saudacaoEl = document.getElementById("heroSaudacao");
    const nomeEl = document.getElementById("heroNomeUsuario");
    const mesEl = document.getElementById("heroMesConsciencia");
    const ribbonEl = document.getElementById("heroRibbon");
    if (!hero || !saudacaoEl || !nomeEl) return;

    const texto = String(nome || window.portalUsuario?.nome || "").trim();
    const partes = texto.split(/\s+/);
    const primeiro = partes[0] || texto || "usuário";
    const feminino = ehNomeFeminino(texto);

    saudacaoEl.textContent = feminino ? "Bem-vinda" : "Bem-vindo";
    nomeEl.textContent = primeiro;

    const tema = temaMesAtual(new Date());
    hero.dataset.mes = tema.mes.toLowerCase();
    hero.style.setProperty("--hero-mes-cor", tema.cor);
    hero.style.setProperty("--hero-mes-escura", tema.corEscura);
    hero.style.setProperty("--hero-mes-gradiente", tema.gradiente);
    hero.style.background = tema.gradiente;
    hero.style.boxShadow = "0 8px 22px " + tema.cor + "33";

    if (mesEl) {
        mesEl.textContent = tema.mes + " · " + tema.campanha + " — " + tema.conscientizacao;
        mesEl.style.color = "rgba(255,255,255,.92)";
    }

    if (ribbonEl) {
        ribbonEl.innerHTML = svgLaco("#ffffff");
        ribbonEl.title = tema.campanha + ": " + tema.conscientizacao;
    }
}
