# -*- coding: utf-8 -*-
"""Série diária de desvios por viagem programada, para a página de Ajustes poder
filtrar por De/Até em dia.

Cada viagem programada passa uma vez por dia em cada ponto de controle (medido: 99,96%
dos pares dia+viagem têm exatamente uma passagem), então não é preciso histograma diário
— basta UM desvio por dia. Isso permite guardar o ano inteiro como uma string de 1 byte
por dia por viagem.

Codificação: uma string de N caracteres por viagem, N = número de dias do período.
    posição = índice do dia
    caractere = ALFABETO[desvio + 46]   (desvio de -45 a +45)
    ALFABETO[0] = sem passagem naquele dia
Desvios fora de ±45 (0,003% das passagens) são achatados no limite: como o teste de
deslocamento vai só de -20 a +20 e a faixa "No horário" é -2..+6, achatar não muda
nenhuma conclusão.

Uso:
    python3 diario.py <pasta-raiz> <pasta-dados> [--lote=N]
"""
import csv, glob, gzip, json, os, pickle, re, sys, collections

RAIZ, DADOS = sys.argv[1], sys.argv[2]
LOTE = next((int(a.split("=")[1]) for a in sys.argv if a.startswith("--lote=")), None)
CACHE = os.path.join(DADOS, "_diario2.pkl")
LIM = 45

# 92 símbolos ASCII seguros em JSON: "!" + 35..126 menos a barra invertida.
ALFABETO = "!" + "".join(chr(c) for c in range(35, 127) if c != 92)
assert len(ALFABETO) == 92, len(ALFABETO)

hhmm = re.compile(r"^(\d{1,2}):(\d{2})$")

def limpa(s): return re.sub(r"\s+", " ", (s or "").strip())

def minutos(txt):
    s = (txt or "").strip()
    if not s: return None
    neg = s.startswith("-")
    m = re.match(r"^(\d{1,3}):(\d{2})", s.lstrip("-+"))
    if not m: return None
    v = int(m.group(1)) * 60 + int(m.group(2))
    return -v if neg else v

def cod_linha(s):
    s = limpa(s)
    m = re.match(r"^(\S+)\s*-\s*(.*)$", s)
    return (m.group(1), m.group(2)) if m else (s, "")

def data_do_arquivo(caminho):
    m = re.search(r"(\d{4})[.\-_](\d{2})[.\-_](\d{2})", os.path.basename(caminho))
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None

est = {"dias": {}, "nomes": {}, "obs": collections.defaultdict(dict)}
if os.path.exists(CACHE):
    with open(CACHE, "rb") as fh: est = pickle.load(fh)

todos = sorted(glob.glob(os.path.join(RAIZ, "*", "*.csv")))
pendentes = [p for p in todos if (data_do_arquivo(p) or "") not in est["dias"]]
print(f"CSVs: {len(todos)}   já na série: {len(est['dias'])}   pendentes: {len(pendentes)}")

lote = pendentes[:LOTE] if LOTE else pendentes
for caminho in lote:
    dia = data_do_arquivo(caminho)
    est["dias"][dia] = None
    with open(caminho, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            d = minutos(r.get("Diferença"))
            if d is None or abs(d) > 90: continue
            d = max(-LIM, min(LIM, d))
            prog = limpa(r.get("Programado"))
            if not hhmm.match(prog): continue
            cod, nome = cod_linha(r.get("Linha"))
            est["nomes"][cod] = nome
            chave = (cod, limpa(r.get("Direção")) or "—",
                     limpa(r.get("Ponto de controle")) or "—", prog)
            est["obs"][chave].setdefault(dia, []).append(d)

if lote:
    with open(CACHE, "wb") as fh: pickle.dump(est, fh, protocol=4)
    print(f"processados: {len(lote)} dias   chaves: {len(est['obs'])}")

restantes = len(pendentes) - len(lote)
if restantes:
    print(f"FALTAM {restantes} dias — rode de novo.")
    sys.exit(0)

# ------------------------------------------------------------------ saída
dias = sorted(est["dias"])
idx = {d: i for i, d in enumerate(dias)}
vazio = ALFABETO[0]
chaves, series, extras = [], [], []
for chave in sorted(est["obs"]):
    porDia = est["obs"][chave]
    # sem corte: o detalhamento por ponto precisa fechar com o total da linha
    buf = [vazio] * len(dias)
    k = len(chaves)
    for dia, lista in porDia.items():
        buf[idx[dia]] = ALFABETO[lista[0] + LIM + 1]
        # 0,04% dos dias têm mais de uma passagem na mesma viagem; vão numa lista
        # lateral para o recorte por data continuar somando exatamente igual ao Python.
        for d in lista[1:]:
            extras.append([k, idx[dia], d])
    chaves.append(list(chave))
    series.append("".join(buf))

saida = os.path.join(DADOS, "serie-diaria.json")
with open(saida, "w", encoding="utf-8") as fh:
    json.dump({"dias": dias, "alfabeto": ALFABETO, "limite": LIM,
               "nomes": est["nomes"], "chaves": chaves, "series": series,
               "extras": extras},
              fh, ensure_ascii=False, separators=(",", ":"))
print(f"  passagens extras (mesmo dia, mesma viagem): {len(extras)}")

bruto = os.path.getsize(saida)
with open(saida, "rb") as fh: comp = len(gzip.compress(fh.read(), 9))
print(f"serie-diaria.json: {len(chaves)} viagens x {len(dias)} dias")
print(f"  bruto: {bruto/1024/1024:.2f} MB   gzip: {comp/1024/1024:.2f} MB")
