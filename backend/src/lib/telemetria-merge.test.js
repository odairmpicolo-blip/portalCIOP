import { test } from "node:test";
import assert from "node:assert/strict";
import {
    normChaveMerge,
    valorPreenchidoMerge,
    parseNumeroMerge,
    estrategiaColunaTelemetria,
    agregarLinhasTelemetria,
    mesclarLinhasTelemetria,
    colunaCleverExcluida,
    nomeColunaClever,
    normalizarColunaTelemetria,
    normalizarLinhaTelemetria
} from "./telemetria-merge.js";

test("normChaveMerge remove acentos, underscores e normaliza espacos", () => {
    assert.equal(normChaveMerge("Média_Km/L"), "media km/l");
    assert.equal(normChaveMerge("  Vel.  Máxima  "), "vel. maxima");
    assert.equal(normChaveMerge(null), "");
    assert.equal(normChaveMerge(undefined), "");
});

test("valorPreenchidoMerge identifica valores vazios ou marcadores de ausencia", () => {
    assert.equal(valorPreenchidoMerge("123"), true);
    assert.equal(valorPreenchidoMerge(""), false);
    assert.equal(valorPreenchidoMerge("  "), false);
    assert.equal(valorPreenchidoMerge("-"), false);
    assert.equal(valorPreenchidoMerge("N/A"), false);
    assert.equal(valorPreenchidoMerge("null"), false);
    assert.equal(valorPreenchidoMerge("undefined"), false);
    assert.equal(valorPreenchidoMerge("#N/A"), false);
    assert.equal(valorPreenchidoMerge(0), true);
});

test("parseNumeroMerge interpreta formatos BR e US corretamente", () => {
    assert.equal(parseNumeroMerge("1.234,56"), 1234.56);
    assert.equal(parseNumeroMerge("1,234.56"), 1234.56);
    assert.equal(parseNumeroMerge("1234,56"), 1234.56);
    assert.equal(parseNumeroMerge("1234.56"), 1234.56);
    assert.equal(parseNumeroMerge("42"), 42);
    assert.equal(Number.isNaN(parseNumeroMerge("")), true);
    assert.equal(Number.isNaN(parseNumeroMerge("abc")), true);
});

test("estrategiaColunaTelemetria classifica colunas conhecidas", () => {
    assert.equal(estrategiaColunaTelemetria("Cliente"), "fixo");
    assert.equal(estrategiaColunaTelemetria("Veiculo"), "fixo");
    assert.equal(estrategiaColunaTelemetria("Inicio"), "min");
    assert.equal(estrategiaColunaTelemetria("Start Time Local"), "min");
    assert.equal(estrategiaColunaTelemetria("Fim"), "max");
    assert.equal(estrategiaColunaTelemetria("End Time Local"), "max");
    assert.equal(estrategiaColunaTelemetria("Horas Motor"), "fixo");
    assert.equal(estrategiaColunaTelemetria("Km Percorrido"), "distancia");
    assert.equal(estrategiaColunaTelemetria("Km Inicial"), "hodometro-inicio");
    assert.equal(estrategiaColunaTelemetria("Km Final"), "hodometro-fim");
});

test("agregarLinhasTelemetria soma colunas numericas e mantem o ultimo valor em colunas fixas", () => {
    const linhas = [
      { Veiculo: "ABC-1234", "Km Percorrido": "10,5", Inicio: "2026-01-01 08:00", Fim: "2026-01-01 09:00" },
      { Veiculo: "ABC-1234", "Km Percorrido": "5,25", Inicio: "2026-01-01 07:30", Fim: "2026-01-01 10:15" }
        ];
    const out = agregarLinhasTelemetria(linhas);
    assert.equal(out.Veiculo, "ABC-1234");
    assert.equal(out["Km Percorrido"], "15.75");
    assert.equal(out.Inicio, "2026-01-01 07:30");
    assert.equal(out.Fim, "2026-01-01 10:15");
});

test("agregarLinhasTelemetria retorna objeto vazio para entrada vazia", () => {
    assert.deepEqual(agregarLinhasTelemetria([]), {});
    assert.deepEqual(agregarLinhasTelemetria(null), {});
});

test("mesclarLinhasTelemetria combina duas linhas somando metricas", () => {
    const atual = { Veiculo: "XYZ-0001", "Km Percorrido": "100" };
    const nova = { Veiculo: "XYZ-0001", "Km Percorrido": "50" };
    const out = mesclarLinhasTelemetria(atual, nova);
    assert.equal(out["Km Percorrido"], "150");
});

test("mesclarLinhasTelemetria ignora lado ausente", () => {
    const nova = { Veiculo: "XYZ-0001", "Km Percorrido": "50" };
    const out = mesclarLinhasTelemetria(null, nova);
    assert.equal(out["Km Percorrido"], "50");
});

test("colunaCleverExcluida reconhece colunas excluidas independente de acentuacao/maiusculas", () => {
    assert.equal(colunaCleverExcluida("Customer ID"), true);
    assert.equal(colunaCleverExcluida("Avg Cabin Temp"), true);
    assert.equal(colunaCleverExcluida("Daily Distance"), false);
});

test("nomeColunaClever traduz nomes conhecidos e ignora colunas excluidas", () => {
    assert.equal(nomeColunaClever("Vehicle ID"), "Veiculo");
    assert.equal(nomeColunaClever("Daily Distance"), "Km Percorrido");
    assert.equal(nomeColunaClever("Customer ID"), null);
    assert.equal(nomeColunaClever("Coluna Desconhecida"), null);
});

test("normalizarColunaTelemetria aplica mapa Clever e oculta colunas internas", () => {
    assert.equal(normalizarColunaTelemetria("Vehicle ID"), "Veiculo");
    assert.equal(normalizarColunaTelemetria("Customer ID"), null);
    assert.equal(normalizarColunaTelemetria("Cliente"), null);
    assert.equal(normalizarColunaTelemetria("Coluna Livre"), "Coluna Livre");
    assert.equal(normalizarColunaTelemetria(""), null);
});

test("normalizarLinhaTelemetria agrupa colunas equivalentes e preserva chaves internas", () => {
    const row = {
          "Vehicle ID": "ABC-1234",
          "Customer ID": "999",
          data_iso: "2026-07-07",
          veiculo_norm: "abc1234"
    };
    const out = normalizarLinhaTelemetria(row);
    assert.equal(out.Veiculo, "ABC-1234");
    assert.equal(out.data_iso, "2026-07-07");
    assert.equal(out.veiculo_norm, "abc1234");
    assert.equal("Customer ID" in out, false);
});

test("hodometro do veiculo 1150 nao vira distancia e o original fica no diagnostico", () => {
    const salto = agregarLinhasTelemetria([{
        Inicio: "2026-09-14 04:35:38",
        Fim: "2026-09-14 23:59:57",
        "Km Inicial": "134931",
        "Km Final": "2415955712",
        "Km Percorrido": "2415820781"
    }]);
    assert.equal(salto.__kmInconsistente, true);
    assert.equal(salto["Km Percorrido"], "");
    assert.equal(salto["Km Inicial"], "134931");
    assert.equal(salto["Km Final"], "2415955712");
    assert.equal(salto.__kmDiagnostico[0].percorrido, "2415820781");
    assert.equal(salto.__kmDiagnostico[0].motivo, "acima do limite de distancia do dia");

    const volta = agregarLinhasTelemetria([{
        Inicio: "2026-09-15 00:00:00",
        Fim: "2026-09-15 22:56:34",
        "Km Inicial": "2415955712",
        "Km Final": "135567",
        "Km Percorrido": "-2415820145"
    }]);
    assert.equal(volta.__kmInconsistente, true);
    assert.equal(volta["Km Percorrido"], "");
    assert.equal(volta.__kmDiagnostico[0].percorrido, "-2415820145");
    assert.equal(volta.__kmDiagnostico[0].motivo, "reinicio ou diferenca negativa do hodometro");
});

test("soma distancias confiaveis na ordem do inicio e nao soma o hodometro", () => {
    const out = agregarLinhasTelemetria([
        { Inicio: "2026-10-30 14:00", Fim: "2026-10-30 18:00", "Km Inicial": "1120", "Km Final": "1200", "Km Percorrido": "80" },
        { Inicio: "2026-10-30 08:00", Fim: "2026-10-30 12:00", "Km Inicial": "1000", "Km Final": "1120", "Km Percorrido": "120" }
    ]);
    assert.equal(out["Km Percorrido"], "200");
    assert.equal(out["Km Inicial"], "1000");
    assert.equal(out["Km Final"], "1200");
    assert.equal(out.__kmInconsistente, undefined);
});

test("exclui o trecho inconsistente e mantem a distancia que da para calcular", () => {
    const out = agregarLinhasTelemetria([
        { Inicio: "2026-10-30 08:00", "Km Inicial": "1000", "Km Final": "1100", "Km Percorrido": "100" },
        { Inicio: "2026-10-30 14:00", "Km Inicial": "2415955712", "Km Final": "135567", "Km Percorrido": "-2415820145" }
    ]);
    assert.equal(out["Km Percorrido"], "100");
    assert.equal(out.__kmInconsistente, undefined);
    assert.equal(out.__kmExcluidos, 1);
    assert.equal(out.__kmDiagnostico[0].percorrido, "-2415820145");
    assert.equal(out["Km Inicial"], "1000");
});

test("sem km informado usa a diferenca do hodometro so quando ela cabe no dia", () => {
    const out = agregarLinhasTelemetria([{
        Inicio: "2026-10-07 00:16:48",
        Fim: "2026-10-07 20:56:28",
        "Km Inicial": "223972",
        "Km Final": "224199"
    }]);
    assert.equal(out["Km Percorrido"], "227");
    assert.equal(out.__kmInconsistente, undefined);
});
