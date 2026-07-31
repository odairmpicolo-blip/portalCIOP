#!/usr/bin/env node
/**
 * Importa os relatórios diários do CR-0108 (pontualidade por ponto de controle) para o
 * Aurora DSQL e, de quebra, regenera os agregados estáticos que a página do portal lê.
 *
 * Uso:
 *   node backend/scripts/importar-cr0108-csv.mjs <pasta-raiz> [--somente-json] [--desde=AAAA-MM-DD]
 *
 * A <pasta-raiz> é a pasta "108 - reports", com uma subpasta por mês e um CSV por dia:
 *   108 - reports/07 - Julho 2026/2026.07.28.csv
 *
 * Régua de classificação (critério do CIOP, definido pela operação). NÃO usamos as colunas
 * "Status" nem "OTP Status" do arquivo original: elas divergem entre si — num dia de amostra
 * havia 676 passagens que uma considera no horário e a outra considera fora.
 *
 *   -2 .. +6   min  -> No horário
 *  -10 .. -3   min  -> Adiantado
 *   +7 .. +15  min  -> Atrasado
 *  >= +16 ou <= -11 -> Divergente
 *
 * Valor negativo na coluna "Diferença" = passou ANTES do horário programado.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

/* O acesso ao banco é carregado sob demanda: com --somente-json o script roda em qualquer
   máquina, sem credenciais da AWS e sem as dependências do backend instaladas. */
let db = null;
async function banco() {
    if (!db) db = await import("../src/db.js");
    return db;
}
const query = async (...args) => (await banco()).query(...args);
const withTransaction = async (...args) => (await banco()).withTransaction(...args);

const RAIZ = process.argv[2];
const SOMENTE_JSON = process.argv.includes("--somente-json");
const DESDE = (process.argv.find(a => a.startsWith("--desde=")) || "").split("=")[1] || null;
const SAIDA_JSON = path.resolve(process.cwd(), "assets/data/cr0108");
const LOTE = 500;

if (!RAIZ) {
    console.error("Uso: node backend/scripts/importar-cr0108-csv.mjs <pasta-raiz> [--somente-json] [--desde=AAAA-MM-DD]");
    process.exit(1);
}

/* ------------------------------------------------------------------ classificação */

const CLASSES = ["noHorario", "adiantado", "atrasado", "divergente"];

/** "-00:03" -> -3 ; "01:20" -> 80. Retorna null quando a célula está vazia/ilegível. */
export function minutosDiferenca(txt) {
    const bruto = String(txt ?? "").trim();
    if (!bruto) return null;
    const negativo = bruto.startsWith("-");
    const m = bruto.replace(/^[-+]/, "").match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return null;
    const min = Number(m[1]) * 60 + Number(m[2]);
    return negativo ? -min : min;
}

export function classificar(min) {
    if (min == null) return null;
    if (min >= -2 && min <= 6) return "noHorario";
    if (min >= -10 && min <= -3) return "adiantado";
    if (min >= 7 && min <= 15) return "atrasado";
    return "divergente";
}

/* ------------------------------------------------------------------ leitura do CSV */

/** Split de linha CSV respeitando aspas — o campo Operador vem entre aspas com vírgulas. */
function partirLinha(linha) {
    const saida = [];
    let atual = "", aspas = false;
    for (let i = 0; i < linha.length; i++) {
        const c = linha[i];
        if (c === '"') {
            if (aspas && linha[i + 1] === '"') { atual += '"'; i++; }
            else aspas = !aspas;
        } else if (c === "," && !aspas) { saida.push(atual); atual = ""; }
        else atual += c;
    }
    saida.push(atual);
    return saida;
}

const limpar = s => String(s ?? "").replace(/\s+/g, " ").trim();

function partirLinhaOnibus(txt) {
    const s = limpar(txt);
    const m = s.match(/^(\S+)\s*-\s*(.*)$/);
    return m ? { codigo: m[1], nome: m[2] } : { codigo: s, nome: "" };
}

function partirOperador(txt) {
    const s = limpar(txt);
    const m = s.match(/^(.*),\s*(\d+)$/);
    return m ? { matricula: m[2], nome: m[1] } : { matricula: "", nome: s };
}

function isoDaData(txt) {
    const m = limpar(txt).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

async function* lerCsv(arquivo) {
    const rl = readline.createInterface({
        input: fs.createReadStream(arquivo, { encoding: "utf8" }),
        crlfDelay: Infinity
    });
    let cabecalho = null;
    for await (const linha of rl) {
        if (!linha.trim()) continue;
        const campos = partirLinha(linha.replace(/^﻿/, ""));
        if (!cabecalho) { cabecalho = campos.map(limpar); continue; }
        const reg = {};
        cabecalho.forEach((c, i) => { reg[c] = campos[i]; });
        yield reg;
    }
}

function listarArquivos(raiz) {
    const achados = [];
    for (const mes of fs.readdirSync(raiz).sort()) {
        const dir = path.join(raiz, mes);
        if (!fs.statSync(dir).isDirectory()) continue;
        for (const nome of fs.readdirSync(dir).sort()) {
            if (!nome.toLowerCase().endsWith(".csv")) continue;
            const iso = nome.replace(/\.csv$/i, "").replace(/\./g, "-");
            if (DESDE && iso < DESDE) continue;
            achados.push({ caminho: path.join(dir, nome), data: iso });
        }
    }
    return achados;
}

/* ------------------------------------------------------------------ schema */

const DDL = `
CREATE TABLE IF NOT EXISTS cr0108_passagem (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    data            DATE        NOT NULL,
    garagem         TEXT,
    bloco           TEXT,
    linha           TEXT,
    linha_nome      TEXT,
    sentido         TEXT,
    variacao        TEXT,
    operador_mat    TEXT,
    operador_nome   TEXT,
    veiculo         TEXT,
    ponto_controle  TEXT,
    programado      TEXT,
    realizado       TEXT,
    hora_programada SMALLINT,
    diferenca_min   INTEGER,
    classe          TEXT,
    importado_em    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cr0108_passagem_data_idx     ON cr0108_passagem (data);
CREATE INDEX IF NOT EXISTS cr0108_passagem_linha_idx    ON cr0108_passagem (linha, data);
CREATE INDEX IF NOT EXISTS cr0108_passagem_veiculo_idx  ON cr0108_passagem (veiculo, data);
CREATE INDEX IF NOT EXISTS cr0108_passagem_operador_idx ON cr0108_passagem (operador_mat, data);
CREATE INDEX IF NOT EXISTS cr0108_passagem_ponto_idx    ON cr0108_passagem (ponto_controle, data);
`;

/* ------------------------------------------------------------------ agregados */

const vazio = () => ({ noHorario: 0, adiantado: 0, atrasado: 0, divergente: 0, total: 0, somaDif: 0, semDif: 0 });

function somar(mapa, chave, classe, dif) {
    if (!mapa.has(chave)) mapa.set(chave, vazio());
    const acc = mapa.get(chave);
    acc.total += 1;
    if (classe == null) { acc.semDif += 1; return; }
    acc[classe] += 1;
    acc.somaDif += dif;
}

/* ------------------------------------------------------------------ main */

async function main() {
    const arquivos = listarArquivos(RAIZ);
    if (!arquivos.length) {
        console.error(`Nenhum CSV encontrado em ${RAIZ}`);
        process.exit(1);
    }
    console.log(`CR-0108: ${arquivos.length} arquivos a processar${DESDE ? ` (desde ${DESDE})` : ""}`);

    if (!SOMENTE_JSON) {
        console.log("Garantindo schema no Aurora DSQL…");
        for (const stmt of DDL.split(";").map(s => s.trim()).filter(Boolean)) {
            await query(stmt);
        }
    }

    const porDia = new Map(), porDiaLinha = new Map(), porDiaHora = new Map();
    const porMesPonto = new Map(), porMesOperador = new Map(), porMesVeiculo = new Map();
    const porMesLinha = new Map(), porMesSentido = new Map();
    const nomesLinha = new Map(), nomesOperador = new Map();
    let totalLidos = 0, totalGravados = 0;

    for (const { caminho, data } of arquivos) {
        let lote = [];
        let doDia = 0;

        // Reimportação é idempotente: apaga o dia antes de gravar de novo.
        if (!SOMENTE_JSON) await query("DELETE FROM cr0108_passagem WHERE data = $1", [data]);

        for await (const reg of lerCsv(caminho)) {
            const iso = isoDaData(reg["Data"]) || data;
            const dif = minutosDiferenca(reg["Diferença"]);
            const classe = classificar(dif);
            const { codigo: linha, nome: linhaNome } = partirLinhaOnibus(reg["Linha"]);
            const { matricula, nome: operadorNome } = partirOperador(reg["Operador"]);
            const veiculo = limpar(reg["Veículo"]);
            const ponto = limpar(reg["Ponto de controle"]) || "—";
            const sentido = limpar(reg["Direção"]) || "—";
            const garagem = limpar(reg["Garagem"]) || "—";
            const programado = limpar(reg["Programado"]);
            const hora = /^\d{2}:/.test(programado) ? Number(programado.slice(0, 2)) : null;
            const mes = iso.slice(0, 7);
            const chaveOp = matricula || operadorNome;

            if (!nomesLinha.has(linha)) nomesLinha.set(linha, linhaNome);
            if (!nomesOperador.has(chaveOp)) nomesOperador.set(chaveOp, operadorNome);

            somar(porDia, iso, classe, dif);
            somar(porDiaLinha, `${iso}|${linha}`, classe, dif);
            somar(porDiaHora, `${iso}|${hora == null ? "??" : String(hora).padStart(2, "0")}`, classe, dif);
            somar(porMesPonto, `${mes}|${ponto}`, classe, dif);
            somar(porMesOperador, `${mes}|${chaveOp}`, classe, dif);
            somar(porMesVeiculo, `${mes}|${veiculo}`, classe, dif);
            somar(porMesLinha, `${mes}|${linha}`, classe, dif);
            somar(porMesSentido, `${mes}|${sentido}`, classe, dif);

            totalLidos += 1; doDia += 1;
            if (SOMENTE_JSON) continue;

            lote.push([iso, garagem, limpar(reg["Bloco"]), linha, linhaNome, sentido,
                limpar(reg["Variação"]), matricula, operadorNome, veiculo, ponto,
                programado, limpar(reg["Hora Realizada"]), hora, dif, classe]);

            if (lote.length >= LOTE) { totalGravados += await gravar(lote); lote = []; }
        }
        if (!SOMENTE_JSON && lote.length) totalGravados += await gravar(lote);
        console.log(`  ${data}: ${doDia} passagens`);
    }

    // ---- publica os JSON que a página lê -------------------------------------
    fs.mkdirSync(SAIDA_JSON, { recursive: true });
    const gravarJson = (nome, dados) => {
        fs.writeFileSync(path.join(SAIDA_JSON, nome), JSON.stringify(dados), "utf8");
        console.log(`  ${nome}`);
    };
    const lista = (mapa, campos) => [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([chave, v]) => {
            const partes = chave.split("|");
            const obj = {};
            campos.forEach((c, i) => { obj[c] = partes[i]; });
            return { ...obj, ...v };
        });

    const dias = [...porDia.keys()].sort();
    console.log("Publicando agregados em assets/data/cr0108/…");
    gravarJson("por-dia.json", lista(porDia, ["data"]));
    gravarJson("por-dia-linha.json", lista(porDiaLinha, ["data", "linha"]));
    gravarJson("por-dia-hora.json", lista(porDiaHora, ["data", "hora"]));
    gravarJson("por-mes-ponto.json", lista(porMesPonto, ["mes", "ponto"]));
    gravarJson("por-mes-veiculo.json", lista(porMesVeiculo, ["mes", "veiculo"]));
    gravarJson("por-mes-sentido.json", lista(porMesSentido, ["mes", "sentido"]));
    gravarJson("por-mes-linha.json", lista(porMesLinha, ["mes", "linha"])
        .map(r => ({ ...r, nome: nomesLinha.get(r.linha) || "" })));
    gravarJson("por-mes-operador.json", lista(porMesOperador, ["mes", "matricula"])
        .map(r => ({ ...r, nome: nomesOperador.get(r.matricula) || "" })));
    gravarJson("meta.json", {
        gerado: new Date().toISOString().slice(0, 19),
        arquivos: arquivos.length,
        registros: totalLidos,
        primeiroDia: dias[0],
        ultimoDia: dias[dias.length - 1],
        linhas: Object.fromEntries([...nomesLinha.entries()].sort()),
        regra: { noHorario: [-2, 6], adiantado: [-10, -3], atrasado: [7, 15], divergenteAcima: 16, divergenteAbaixo: -11 }
    });

    console.log(`\nLidos: ${totalLidos}${SOMENTE_JSON ? "" : ` · gravados no DSQL: ${totalGravados}`}`);
}

async function gravar(lote) {
    // INSERT multi-linha: 500 tuplas por ida ao banco em vez de 500 round-trips.
    const colunas = 16;
    const valores = lote.map((_, i) =>
        "(" + Array.from({ length: colunas }, (_, j) => `$${i * colunas + j + 1}`).join(",") + ")"
    ).join(",");
    const sql = `INSERT INTO cr0108_passagem
        (data, garagem, bloco, linha, linha_nome, sentido, variacao, operador_mat, operador_nome,
         veiculo, ponto_controle, programado, realizado, hora_programada, diferenca_min, classe)
        VALUES ${valores}`;
    await withTransaction(async client => { await client.query(sql, lote.flat()); });
    return lote.length;
}

main().catch(err => {
    console.error("Falha na importação do CR-0108:", err);
    process.exit(1);
});
