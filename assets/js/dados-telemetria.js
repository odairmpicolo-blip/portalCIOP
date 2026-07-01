(function () {
    const FROTA = (window.FROTA_PATIO || []).slice().sort((a, b) =>
        String(a.veiculo).localeCompare(String(b.veiculo), "pt-BR", { numeric: true })
    );

    const CHAVES_VEICULO = [
        "veiculo", "veículo", "prefixo", "carro", "numero", "número", "n°", "nº",
        "frota", "id_veiculo", "codigo", "código", "placa", "vehicle", "bus"
    ];

    const CHAVES_DATA = ["data", "date", "dia", "dt", "data_ref", "data referencia"];

    function $(id) { return document.getElementById(id); }

    function escapeHtml(s) {
        return String(s ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function normChave(s) {
        return String(s || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
    }

    function normVeiculo(v) {
        const s = String(v ?? "").trim();
        if (!s) return "";
        const digits = s.replace(/\D/g, "");
        if (digits) return String(parseInt(digits, 10));
        return s.toUpperCase();
    }

    function valorPreenchido(v) {
        const s = String(v ?? "").trim();
        if (!s) return false;
        const low = s.toLowerCase();
        return !["-", "—", "n/a", "na", "null", "undefined", "#n/a"].includes(low);
    }

    function detectarDelimitador(linha) {
        const virgulas = (linha.match(/,/g) || []).length;
        const pontos = (linha.match(/;/g) || []).length;
        return pontos > virgulas ? ";" : ",";
    }

    function parseCsv(texto) {
        const src = texto.replace(/^\uFEFF/, "");
        const delim = detectarDelimitador((src.split(/\r?\n/).find((l) => l.trim()) || ""));
        const linhas = [];
        let row = [];
        let cell = "";
        let emAspas = false;

        const pushCell = () => { row.push(cell); cell = ""; };
        const pushRow = () => {
            if (row.length > 1 || row[0] !== "" || cell) pushCell();
            if (row.some((x) => String(x).trim() !== "")) linhas.push(row);
            row = [];
        };

        for (let i = 0; i < src.length; i++) {
            const c = src[i];
            const next = src[i + 1];
            if (emAspas) {
                if (c === "\"" && next === "\"") { cell += "\""; i++; }
                else if (c === "\"") emAspas = false;
                else cell += c;
                continue;
            }
            if (c === "\"") { emAspas = true; continue; }
            if (c === "\r") continue;
            if (c === "\n") { pushCell(); pushRow(); continue; }
            if (c === delim) { pushCell(); continue; }
            cell += c;
        }
        if (cell.length || row.length) { pushCell(); pushRow(); }
        return linhas;
    }

    function converterLinhasCsv(linhas) {
        if (!linhas.length) return { headers: [], rows: [] };
        const headers = linhas[0].map((h) => String(h).trim());
        const rows = linhas.slice(1).map((cols) => {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = cols[i] != null ? String(cols[i]).trim() : ""; });
            return obj;
        });
        return { headers, rows };
    }

    function detectarColunaVeiculo(headers) {
        const normHeaders = headers.map((h) => normChave(h));
        for (let i = 0; i < normHeaders.length; i++) {
            const n = normHeaders[i];
            if (CHAVES_VEICULO.some((k) => n === k || n.includes(k))) return headers[i];
        }
        return headers[0] || "";
    }

    function detectarColunaData(headers) {
        const normHeaders = headers.map((h) => normChave(h));
        for (let i = 0; i < normHeaders.length; i++) {
            const n = normHeaders[i];
            if (CHAVES_DATA.some((k) => n === k || n.startsWith(k))) return headers[i];
        }
        return "";
    }

    function parseDataCsv(val) {
        const s = String(val || "").trim();
        if (!s) return "";
        let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        return "";
    }

    function filtrarRowsPorData(rows, colData, dataDe, dataAte) {
        if (!colData || (!dataDe && !dataAte)) return rows;
        return rows.filter((row) => {
            const iso = parseDataCsv(row[colData]);
            if (!iso) return false;
            if (dataDe && iso < dataDe) return false;
            if (dataAte && iso > dataAte) return false;
            return true;
        });
    }

    function indexarCsv(rows, colVeiculo) {
        const map = new Map();
        const extras = [];
        rows.forEach((row) => {
            const id = normVeiculo(row[colVeiculo]);
            if (!id) return;
            if (map.has(id)) map.get(id).push(row);
            else map.set(id, [row]);
            extras.push(id);
        });
        return { map, idsCsv: new Set(extras) };
    }

    function agregarLinhasVeiculo(linhas, colunasDados) {
        const campos = {};
        const campoStats = {};
        let preenchidos = 0;
        colunasDados.forEach((col) => {
            let filled = 0;
            linhas.forEach((row) => {
                if (valorPreenchido(row[col])) filled++;
            });
            campos[col] = filled > 0;
            campoStats[col] = { filled, total: linhas.length };
            if (campos[col]) preenchidos++;
        });
        return { campos, campoStats, preenchidos };
    }

    function estadoCampoVeiculo(stats) {
        if (!stats || !stats.total) return "miss";
        if (stats.filled === stats.total) return "ok";
        if (stats.filled > 0) return "part";
        return "bad";
    }

    function tituloCampo(stats) {
        if (!stats || !stats.total) return "Sem registro no CSV";
        if (stats.filled === stats.total) return `Dado em todos os ${stats.total} registro(s)`;
        if (stats.filled > 0) return `Dado em ${stats.filled} de ${stats.total} registro(s)`;
        return "Sem dado em nenhum registro";
    }

    function analisar(headers, rows, colVeiculo, colunasEscolhidas) {
        const todasColunas = headers.filter((h) => h !== colVeiculo);
        const colunasDados = colunasEscolhidas && colunasEscolhidas.length
            ? todasColunas.filter((c) => colunasEscolhidas.includes(c))
            : todasColunas;
        const { map: csvPorVeiculo, idsCsv } = indexarCsv(rows, colVeiculo);
        const frotaIds = new Set(FROTA.map((f) => normVeiculo(f.veiculo)));

        const veiculos = FROTA.map((item) => {
            const id = normVeiculo(item.veiculo);
            const linhasCsv = csvPorVeiculo.get(id) || [];
            const { campos, campoStats, preenchidos } = agregarLinhasVeiculo(linhasCsv, colunasDados);
            const totalCols = colunasDados.length;
            const noCsv = linhasCsv.length > 0;
            let status = "sem_registro";
            if (noCsv && preenchidos === totalCols && totalCols > 0) status = "completo";
            else if (noCsv && preenchidos > 0) status = "parcial";
            else if (noCsv) status = "vazio";
            return {
                veiculo: item.veiculo,
                rotulo: item.rotulo || "",
                id,
                noCsv,
                status,
                campos,
                campoStats,
                preenchidos,
                totalCols,
                linhasCsv: linhasCsv.length
            };
        });

        const foraFrota = [];
        idsCsv.forEach((id) => {
            if (!frotaIds.has(id)) {
                foraFrota.push({ id, linhas: csvPorVeiculo.get(id) || [] });
            }
        });

        const resumoColunas = colunasDados.map((col) => {
            let ok = 0;
            veiculos.forEach((v) => {
                if (v.campos[col]) ok++;
            });
            return {
                coluna: col,
                comDado: ok,
                semDado: FROTA.length - ok,
                pct: FROTA.length ? Math.round((ok / FROTA.length) * 100) : 0
            };
        });

        const stats = {
            frota: FROTA.length,
            noCsv: veiculos.filter((v) => v.noCsv).length,
            completos: veiculos.filter((v) => v.status === "completo").length,
            parciais: veiculos.filter((v) => v.status === "parcial").length,
            vazios: veiculos.filter((v) => v.status === "vazio").length,
            semRegistro: veiculos.filter((v) => !v.noCsv).length,
            foraFrota: foraFrota.length,
            colunas: colunasDados.length,
            linhasCsv: rows.length,
            veiculosCsv: idsCsv.size
        };

        return {
            colVeiculo,
            colunasDados,
            veiculos,
            resumoColunas,
            stats,
            foraFrota,
            totalLinhasCsv: rows.length
        };
    }

    function rotuloStatus(v) {
        if (v.status === "completo") return `Completo · ${v.linhasCsv} reg.`;
        if (v.status === "parcial") return `Parcial · ${v.linhasCsv} reg.`;
        if (v.status === "vazio") return `Sem dados · ${v.linhasCsv} reg.`;
        return "Sem registro no CSV";
    }

    function classeStatus(status) {
        if (status === "completo") return "st-ok";
        if (status === "parcial") return "st-warn";
        if (status === "vazio") return "st-muted";
        return "st-bad";
    }

    function classeLinhaVeiculo(v) {
        if (v.status === "parcial") return "row-incoerente";
        if (v.status === "vazio" || !v.noCsv) return "row-sem-dados";
        return "";
    }

    function sufixoVeiculoFiltro(status) {
        if (status === "parcial") return " ◐";
        if (status === "vazio" || status === "sem_registro") return " ✗";
        return "";
    }

    let dadosBrutos = null;
    let analiseAtual = null;
    let filtroAtual = "todos";
    let colunasMarcadas = new Set();

    function colunasSelecionadas() {
        if (!dadosBrutos) return [];
        const todas = dadosBrutos.headers.filter((h) => h !== dadosBrutos.colVeiculo);
        if (!colunasMarcadas.size) return todas;
        return todas.filter((c) => colunasMarcadas.has(c));
    }

    function atualizarRotuloColunas() {
        const btn = $("filtroColunasBtn");
        if (!btn || !dadosBrutos) return;
        const total = dadosBrutos.headers.filter((h) => h !== dadosBrutos.colVeiculo).length;
        const n = colunasSelecionadas().length;
        if (!n || n === total) btn.textContent = "Todas as colunas";
        else if (n === 1) btn.textContent = colunasSelecionadas()[0];
        else btn.textContent = `${n} colunas`;
    }

    function posicionarPainelColunas() {
        const btn = $("filtroColunasBtn");
        const panel = $("filtroColunasPanel");
        if (!btn || !panel || panel.hidden) return;
        const r = btn.getBoundingClientRect();
        panel.style.left = `${Math.max(8, r.left)}px`;
        panel.style.top = `${r.bottom + 4}px`;
        panel.style.minWidth = `${Math.max(220, r.width)}px`;
    }

    function fecharPainelColunas() {
        const panel = $("filtroColunasPanel");
        const btn = $("filtroColunasBtn");
        if (!panel || !btn) return;
        panel.hidden = true;
        btn.setAttribute("aria-expanded", "false");
    }

    function montarPainelColunas() {
        const panel = $("filtroColunasPanel");
        if (!dadosBrutos || !panel) return;
        const cols = dadosBrutos.headers.filter((h) => h !== dadosBrutos.colVeiculo);
        if (!colunasMarcadas.size) cols.forEach((c) => colunasMarcadas.add(c));
        panel.innerHTML = `<div class="filtro-colunas-acoes">
            <button type="button" data-col-acao="todas">Todas</button>
            <button type="button" data-col-acao="nenhuma">Nenhuma</button>
        </div>${cols.map((col) => {
            const checked = colunasMarcadas.has(col) ? " checked" : "";
            return `<label class="filtro-colunas-opt"><input type="checkbox" value="${escapeHtml(col)}"${checked}> ${escapeHtml(col)}</label>`;
        }).join("")}`;
        panel.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
            cb.addEventListener("change", () => {
                if (cb.checked) colunasMarcadas.add(cb.value);
                else colunasMarcadas.delete(cb.value);
                atualizarRotuloColunas();
                reaplicarAnalise();
            });
        });
        panel.querySelectorAll("[data-col-acao]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const acao = btn.getAttribute("data-col-acao");
                if (acao === "todas") cols.forEach((c) => colunasMarcadas.add(c));
                else colunasMarcadas.clear();
                panel.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
                    cb.checked = colunasMarcadas.has(cb.value);
                });
                atualizarRotuloColunas();
                reaplicarAnalise();
            });
        });
        atualizarRotuloColunas();
    }

    function montarFiltroVeiculos(statusPorId) {
        const sel = $("filtroVeiculo");
        if (!sel) return;
        const atual = sel.value;
        const mapa = statusPorId || new Map();
        sel.innerHTML = `<option value="">Todos (${FROTA.length})</option>${FROTA.map((f) => {
            const id = normVeiculo(f.veiculo);
            const st = mapa.get(id) || "";
            const marca = sufixoVeiculoFiltro(st);
            return `<option value="${escapeHtml(id)}">${escapeHtml(f.veiculo)}${marca}</option>`;
        }).join("")}`;
        if ([...sel.options].some((o) => o.value === atual)) sel.value = atual;
    }

    function atualizarFiltroVeiculosStatus() {
        if (!analiseAtual) return;
        const mapa = new Map(analiseAtual.veiculos.map((v) => [v.id, v.status]));
        const sel = $("filtroVeiculo");
        const atual = sel && sel.value;
        montarFiltroVeiculos(mapa);
        if (sel && atual && [...sel.options].some((o) => o.value === atual)) sel.value = atual;
    }

    function montarFiltroDatas() {
        if (!dadosBrutos || !dadosBrutos.colData) return;
        const datas = dadosBrutos.rows
            .map((r) => parseDataCsv(r[dadosBrutos.colData]))
            .filter(Boolean)
            .sort();
        if (!datas.length) return;
        const min = datas[0];
        const max = datas[datas.length - 1];
        const de = $("filtroDataDe");
        const ate = $("filtroDataAte");
        de.min = min;
        de.max = max;
        ate.min = min;
        ate.max = max;
        if (!de.value) { de.value = min; ate.value = max; }
    }

    function hintFiltrosAtivos() {
        const hint = $("filtroAtivoHint");
        if (!hint || !dadosBrutos) return;
        const partes = [];
        const de = $("filtroDataDe").value;
        const ate = $("filtroDataAte").value;
        const veic = $("filtroVeiculo").value;
        const totalCol = dadosBrutos.headers.filter((h) => h !== dadosBrutos.colVeiculo).length;
        const nCol = colunasSelecionadas().length;
        if (de || ate) partes.push(`período ${de || "…"} a ${ate || "…"}`);
        if (veic) partes.push(`carro ${veic}`);
        if (nCol && nCol < totalCol) partes.push(`${nCol} coluna(s)`);
        if (!partes.length) { hint.hidden = true; return; }
        hint.hidden = false;
        hint.textContent = `Filtros ativos: ${partes.join(" · ")}`;
    }

    function reaplicarAnalise() {
        if (!dadosBrutos) return;
        let rows = dadosBrutos.rows.slice();
        rows = filtrarRowsPorData(rows, dadosBrutos.colData, $("filtroDataDe").value, $("filtroDataAte").value);
        const veicFiltro = $("filtroVeiculo").value;
        if (veicFiltro) {
            rows = rows.filter((r) => normVeiculo(r[dadosBrutos.colVeiculo]) === veicFiltro);
        }
        const cols = colunasSelecionadas();
        if (!cols.length) {
            $("infoUpload").textContent = "Selecione ao menos uma coluna nos filtros.";
            return;
        }
        analiseAtual = analisar(dadosBrutos.headers, rows, dadosBrutos.colVeiculo, cols);
        const meta = `${dadosBrutos.nomeArquivo} · ${rows.length} linha(s) após filtros · ${analiseAtual.stats.veiculosCsv} veículo(s) · ${cols.length} coluna(s)`;
        $("infoUpload").textContent = meta;
        hintFiltrosAtivos();
        renderResumo(analiseAtual.stats);
        renderColunas(analiseAtual.resumoColunas);
        atualizarFiltroVeiculosStatus();
        renderFrota();
        renderForaFrota(analiseAtual.foraFrota);
    }

    function limparFiltros() {
        if (!dadosBrutos) return;
        $("filtroVeiculo").value = "";
        montarFiltroDatas();
        const cols = dadosBrutos.headers.filter((h) => h !== dadosBrutos.colVeiculo);
        colunasMarcadas = new Set(cols);
        montarPainelColunas();
        fecharPainelColunas();
        filtroAtual = "todos";
        document.querySelectorAll("[data-filtro-frota]").forEach((b) => {
            b.classList.toggle("ativo", b.getAttribute("data-filtro-frota") === "todos");
        });
        reaplicarAnalise();
    }

    function renderResumo(stats) {
        $("statFrota").textContent = stats.frota;
        $("statNoCsv").textContent = stats.noCsv;
        $("statCompletos").textContent = stats.completos;
        $("statParciais").textContent = stats.parciais;
        $("statSemRegistro").textContent = stats.semRegistro;
        $("statColunas").textContent = stats.colunas;
        $("statForaFrota").textContent = stats.foraFrota;
        $("statLinhasCsv").textContent = stats.linhasCsv;
        $("statVeiculosCsv").textContent = stats.veiculosCsv;
    }

    function renderColunas(resumoColunas) {
        const corpo = $("tabelaColunasCorpo");
        if (!resumoColunas.length) {
            corpo.innerHTML = "<tr><td colspan=\"4\">Nenhuma coluna de dados no CSV.</td></tr>";
            return;
        }
        corpo.innerHTML = resumoColunas.map((c) => {
            const pctCls = c.pct >= 90 ? "pct-ok" : c.pct >= 50 ? "pct-warn" : "pct-bad";
            return `<tr>
                <td>${escapeHtml(c.coluna)}</td>
                <td class="num">${c.comDado}</td>
                <td class="num">${c.semDado}</td>
                <td class="num ${pctCls}">${c.pct}%</td>
            </tr>`;
        }).join("");
    }

    function veiculosFiltrados() {
        if (!analiseAtual) return [];
        let lista = analiseAtual.veiculos;
        const veicFiltro = $("filtroVeiculo") && $("filtroVeiculo").value;
        if (veicFiltro) lista = lista.filter((v) => v.id === veicFiltro);
        if (filtroAtual === "completo") return lista.filter((v) => v.status === "completo");
        if (filtroAtual === "parcial") return lista.filter((v) => v.status === "parcial");
        if (filtroAtual === "sem_registro") return lista.filter((v) => !v.noCsv);
        if (filtroAtual === "vazio") return lista.filter((v) => v.status === "vazio");
        return lista;
    }

    function renderFrota() {
        if (!analiseAtual) return;
        const cols = analiseAtual.colunasDados;
        const head = $("tabelaFrotaHead");
        const corpo = $("tabelaFrotaCorpo");
        head.innerHTML = `<tr>
            <th class="col-fix">Veículo</th>
            <th class="col-fix">Perfil</th>
            <th class="col-fix">Reg.</th>
            <th class="col-fix">Status</th>
            ${cols.map((c) => `<th title="${escapeHtml(c)}">${escapeHtml(c)}</th>`).join("")}
        </tr>`;

        const lista = veiculosFiltrados();
        $("contagemFrota").textContent = `${lista.length} de ${analiseAtual.veiculos.length} veículo(s)`;

        corpo.innerHTML = lista.map((v) => {
            const cells = cols.map((col) => {
                if (!v.noCsv) return `<td class="cell-miss" title="Sem registro no CSV">—</td>`;
                const st = estadoCampoVeiculo(v.campoStats[col]);
                const title = escapeHtml(tituloCampo(v.campoStats[col]));
                if (st === "ok") return `<td class="cell-ok" title="${title}">✓</td>`;
                if (st === "part") return `<td class="cell-part" title="${title}">◐</td>`;
                return `<td class="cell-bad" title="${title}">✗</td>`;
            }).join("");
            const rowCls = classeLinhaVeiculo(v);
            return `<tr${rowCls ? ` class="${rowCls}"` : ""}>
                <td class="col-fix veiculo">${escapeHtml(v.veiculo)}</td>
                <td class="col-fix perfil">${escapeHtml(v.rotulo)}</td>
                <td class="col-fix num">${v.linhasCsv || "—"}</td>
                <td class="col-fix"><span class="status-pill ${classeStatus(v.status)}">${rotuloStatus(v)}</span></td>
                ${cells}
            </tr>`;
        }).join("");
    }

    function renderForaFrota(foraFrota) {
        const bloco = $("blocoForaFrota");
        if (!foraFrota.length) {
            bloco.hidden = true;
            return;
        }
        bloco.hidden = false;
        $("listaForaFrota").innerHTML = foraFrota
            .sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true }))
            .map((x) => `<span class="tag-fora">${escapeHtml(x.id)}</span>`)
            .join("");
    }

    function mostrarResultado() {
        $("painelVazio").hidden = true;
        $("painelResultado").hidden = false;
    }

    function mostrarVazio(msg) {
        $("painelVazio").hidden = false;
        $("painelResultado").hidden = true;
        $("msgVazio").textContent = msg || "Envie um arquivo CSV para analisar os 250 veículos da frota.";
    }

    function processarTextoCsv(texto, nomeArquivo) {
        const parsed = converterLinhasCsv(parseCsv(texto));
        if (!parsed.headers.length) throw new Error("CSV sem cabeçalho válido.");
        if (!parsed.rows.length) throw new Error("CSV sem linhas de dados.");

        const colVeiculo = detectarColunaVeiculo(parsed.headers);
        const colData = detectarColunaData(parsed.headers);
        dadosBrutos = {
            headers: parsed.headers,
            rows: parsed.rows,
            colVeiculo,
            colData,
            nomeArquivo
        };
        colunasMarcadas = new Set(parsed.headers.filter((h) => h !== colVeiculo));
        montarFiltroVeiculos();
        montarFiltroDatas();
        montarPainelColunas();
        reaplicarAnalise();
        mostrarResultado();
    }

    function lerArquivo(file) {
        if (!file) return;
        if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
            mostrarVazio("Selecione um arquivo .csv");
            return;
        }
        $("infoUpload").textContent = `Lendo ${file.name}...`;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                processarTextoCsv(String(reader.result || ""), file.name);
            } catch (err) {
                mostrarVazio(err.message || "Falha ao processar o CSV.");
                $("infoUpload").textContent = "";
            }
        };
        reader.onerror = () => {
            mostrarVazio("Não foi possível ler o arquivo.");
            $("infoUpload").textContent = "";
        };
        reader.readAsText(file, "UTF-8");
    }

    function iniciar() {
        const input = $("csvInput");
        const zona = $("uploadZona");

        input.addEventListener("change", () => {
            lerArquivo(input.files && input.files[0]);
            input.value = "";
        });

        zona.addEventListener("dragover", (e) => {
            e.preventDefault();
            zona.classList.add("drag");
        });
        zona.addEventListener("dragleave", () => zona.classList.remove("drag"));
        zona.addEventListener("drop", (e) => {
            e.preventDefault();
            zona.classList.remove("drag");
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            lerArquivo(file);
        });
        zona.addEventListener("click", () => input.click());
        zona.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
        });

        document.querySelectorAll("[data-filtro-frota]").forEach((btn) => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("[data-filtro-frota]").forEach((b) => b.classList.remove("ativo"));
                btn.classList.add("ativo");
                filtroAtual = btn.getAttribute("data-filtro-frota") || "todos";
                renderFrota();
            });
        });

        ["filtroDataDe", "filtroDataAte", "filtroVeiculo"].forEach((id) => {
            const el = $(id);
            if (el) el.addEventListener("change", () => reaplicarAnalise());
        });

        const btnCol = $("filtroColunasBtn");
        const panelCol = $("filtroColunasPanel");
        const wrapCol = document.querySelector(".filter-field--colunas");
        if (btnCol && panelCol) {
            btnCol.addEventListener("click", (e) => {
                e.stopPropagation();
                const abrir = panelCol.hidden;
                if (abrir) {
                    panelCol.hidden = false;
                    btnCol.setAttribute("aria-expanded", "true");
                    posicionarPainelColunas();
                } else fecharPainelColunas();
            });
            panelCol.addEventListener("click", (e) => e.stopPropagation());
            document.addEventListener("click", () => fecharPainelColunas());
            window.addEventListener("resize", () => posicionarPainelColunas());
            window.addEventListener("scroll", () => posicionarPainelColunas(), true);
        }

        const btnLimpar = $("btnLimparFiltros");
        if (btnLimpar) btnLimpar.addEventListener("click", () => limparFiltros());

        if (!FROTA.length) {
            mostrarVazio("Lista da frota (250 veículos) não carregada.");
            return;
        }
        mostrarVazio();
    }

    if (window.portalUsuarioValidado) iniciar();
    else window.addEventListener("portal:usuario-validado", iniciar, { once: true });
})();
