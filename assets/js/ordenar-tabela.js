/* Ordenação por clique no cabeçalho, com seta indicando a direção.
   Genérico: vale para qualquer tabela do portal. Lê o texto da célula e entende
   número em pt-BR ("1.234", "92,08%", "-3 min"), hora ("07:35") e texto.

   Como as tabelas são remontadas a cada filtro, a ativação é chamada de novo depois
   de cada render — daí o data-ord-ativo, que evita empilhar listeners.

   Tabelas com linhas de agrupamento (tr.grupo-linha) perdem os cabeçalhos de grupo
   quando o usuário ordena por outra coluna: agrupar e ordenar por outra coisa ao
   mesmo tempo não faz sentido. Voltando para a ordem padrão, o agrupamento volta. */
(function (global) {
    "use strict";

    const RE_HORA = /^(\d{1,2}):(\d{2})$/;

    function valorDaCelula(td) {
        const bruto = (td ? td.textContent : "").trim();
        if (!bruto) return { t: 1, v: "" };

        const hora = RE_HORA.exec(bruto);
        if (hora) return { t: 0, v: Number(hora[1]) * 60 + Number(hora[2]) };

        /* Número em pt-BR, tolerando %, sinal, "min", "p.p." e o separador de milhar.
           O portal usa o menos tipográfico (−, U+2212) em vários lugares: sem normalizar
           para o hífen ASCII, "−2 min" seria lido como +2 e a ordenação inverteria. */
        const limpo = bruto
            .replace(/[−–—]/g, "-")
            .replace(/[^\d,.\-+]/g, "")
            .replace(/\.(?=\d{3}\b)/g, "")
            .replace(",", ".")
            .replace(/\.+$/, "");
        if (limpo && /^[-+]?\d*\.?\d+$/.test(limpo)) return { t: 0, v: parseFloat(limpo) };

        return { t: 1, v: bruto.toLocaleLowerCase("pt-BR") };
    }

    function comparar(a, b) {
        if (a.t !== b.t) return a.t - b.t;              // números antes de texto
        if (a.t === 0) return a.v - b.v;
        return a.v.localeCompare(b.v, "pt-BR", { numeric: true, sensitivity: "base" });
    }

    function ativar(tabela) {
        if (!tabela) return;
        const cabecalho = tabela.tHead && tabela.tHead.rows.length
            ? tabela.tHead.rows[tabela.tHead.rows.length - 1] : null;
        const corpo = tabela.tBodies[0];
        if (!cabecalho || !corpo || cabecalho.dataset.ordAtivo === "1") return;
        cabecalho.dataset.ordAtivo = "1";

        const ths = Array.prototype.slice.call(cabecalho.cells);
        ths.forEach(function (th, indice) {
            if (!th.textContent.trim()) return;         // colunas de ícone/vazias ficam de fora
            th.classList.add("th-ord");
            th.setAttribute("role", "button");
            th.setAttribute("tabindex", "0");
            th.title = "Clique para ordenar";

            function ordenar() {
                const crescente = th.dataset.dir !== "asc";
                ths.forEach(function (outro) {
                    delete outro.dataset.dir;
                    outro.classList.remove("ord-asc", "ord-desc");
                });
                th.dataset.dir = crescente ? "asc" : "desc";
                th.classList.add(crescente ? "ord-asc" : "ord-desc");

                const linhas = Array.prototype.slice.call(corpo.rows);
                const grupos = linhas.filter(function (tr) { return tr.classList.contains("grupo-linha"); });
                grupos.forEach(function (tr) { tr.remove(); });

                const dados = linhas
                    .filter(function (tr) { return !tr.classList.contains("grupo-linha"); })
                    .map(function (tr, i) { return { tr: tr, i: i, v: valorDaCelula(tr.cells[indice]) }; });

                dados.sort(function (a, b) {
                    const c = comparar(a.v, b.v);
                    return (crescente ? c : -c) || (a.i - b.i);   // empate mantém a ordem original
                });

                const frag = document.createDocumentFragment();
                dados.forEach(function (d) { frag.appendChild(d.tr); });
                corpo.appendChild(frag);
            }

            th.addEventListener("click", ordenar);
            th.addEventListener("keydown", function (e) {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ordenar(); }
            });
        });
    }

    /* Ativa em todas as tabelas do container, menos as auxiliares (.mini, dentro de detalhe). */
    function ativarTudo(raiz) {
        const escopo = raiz || document;
        Array.prototype.forEach.call(escopo.querySelectorAll("table"), function (t) {
            if (t.classList.contains("mini") || t.classList.contains("sem-ordenacao")) return;
            ativar(t);
        });
    }

    /* As páginas remontam as tabelas a cada filtro; em vez de pedir que cada render
       chame a ativação, um observador reativa sozinho o que aparecer. */
    let agendado = null;
    function observar() {
        ativarTudo();
        new MutationObserver(function () {
            if (agendado) return;
            agendado = setTimeout(function () { agendado = null; ativarTudo(); }, 60);
        }).observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observar);
    else observar();

    global.OrdenarTabela = { ativar: ativar, ativarTudo: ativarTudo };
})(window);
