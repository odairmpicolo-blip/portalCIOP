import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ipvAjustadoDia,
  ipvAjustadoPeriodo,
  fracaoIpv,
  chaveLinha,
  extraPontosIncidentes,
  pontosOficiaisDaLinha,
  pontoOficial,
  minutosDeHora,
  pontosRecuperadosDoIncidente
} from "./ipv-ajustado.js";

test("fracaoIpv aceita 91.34 e 0.9134", () => {
  assert.equal(fracaoIpv(91.34), 0.9134);
  assert.equal(fracaoIpv(0.9134), 0.9134);
});

test("chaveLinha unifica 904 e 0904", () => {
  assert.equal(chaveLinha("904"), "904");
  assert.equal(chaveLinha("0904"), "904");
  assert.equal(chaveLinha(" 904 "), "904");
  assert.equal(chaveLinha("LINHA 904"), "904");
});

test("1 incidente na 904 recupera os 4 pontos da linha, não a média da rede", () => {
  const cat = extraPontosIncidentes(
    [{ linha: "904", n: 1 }],
    new Map([["904", 4]])
  );
  assert.equal(cat.extra, 4);
  const a = ipvAjustadoDia({ ipv: 0.90, pontos: 1000, extraPontos: cat.extra, incidentes: 1 });
  assert.equal(a.noHorario, 900);
  assert.equal(a.extra, 4);
  assert.equal(a.ipvAjustado, 0.904);
});

test("média da rede (pontos/viagens) NÃO é usada", () => {
  const cat = extraPontosIncidentes(
    [{ linha: "904", n: 5 }],
    new Map([["904", 4]])
  );
  assert.equal(cat.extra, 20);
  assert.notEqual(cat.extra, 5 * (1000 / 100));
});

test("periodo pondera como o 91,34% do Clever", () => {
  const p = ipvAjustadoPeriodo([
    { ipv: 0.90, pontos: 1000, extraPontos: 0, incidentes: 0 },
    { ipv: 0.80, pontos: 3000, extraPontos: 0, incidentes: 0 }
  ]);
  assert.equal(p.ipv, 0.825);
  assert.equal(p.ipvAjustado, 0.825);
});

test("acréscimo de incidentes não passa de 100%", () => {
  const a = ipvAjustadoDia({ ipv: 0.99, pontos: 100, extraPontos: 50, incidentes: 10 });
  assert.equal(a.ipvAjustado, 1);
});

test("407: 11 checkpoints do CR-0108 viram 3 pontos oficiais", () => {
  const nomes = pontosOficiaisDaLinha([
    "Terminal Central pista B",
    "Terminal Central piso inferior",
    "Terminal Milton Gavetti",
    "Avenida Saul Elkind 585",
    "Jumper",
    "Rua Francisco Bueno"
  ]);
  assert.deepEqual(nomes, ["Terminal Central", "Terminal Milton Gavetti", "Bairro"]);
  assert.equal(pontoOficial("Terminal Central piso superior"), "Terminal Central");
});

test("liga o horário da instrução ao ponto realizado", () => {
  assert.equal(minutosDeHora(" 10:40"), 10 * 60 + 40);
  const rec = pontosRecuperadosDoIncidente(
    [
      { ponto: "Terminal Central pista B", programado: " 11:45", realizado: " 10:42", desvio: 0 },
      { ponto: "Terminal Milton Gavetti", programado: " 09:52", realizado: " 09:55", desvio: 3 }
    ],
    { instrucao: "CARRO SAINDO NO HORARIO DAS 10:40 TERMINAL PI", duracao: "00:13" }
  );
  assert.equal(rec.extra, 1);
  assert.deepEqual(rec.pontos, ["Terminal Central"]);
});
