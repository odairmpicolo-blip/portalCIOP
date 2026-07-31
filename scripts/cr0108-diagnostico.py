# -*- coding: utf-8 -*-
"""Diagnóstico de pontualidade + sugestão de horários, com carga incremental.

Substitui diagnostico.py e horarios.py, que varriam os 210 CSVs a cada execução. Aqui o
histograma de desvios fica gravado num cache; cada rodada lê só os dias que ainda não
entraram e soma. As duas análises saem do MESMO histograma:

    cache[(linha, sentido, ponto, programado)][desvio] = ocorrências

  - diagnostico-pontos.json  agrega por (linha, sentido, ponto) e por faixa horária,
                             que é derivada de programado[:2];
  - sugestao-horarios.json   usa a chave completa, com o horário programado.

Uso:
    python3 diagnostico_inc.py <pasta-raiz> <pasta-dados> [--lote=N] [--gerar]

    --lote=N   processa no máximo N dias novos nesta rodada (para ambientes com limite
               de tempo de execução). Sem isso, processa tudo que estiver pendente.
    --gerar    regera os JSONs mesmo que nenhum dia novo tenha entrado.

Régua: No horário = -2..+6 min. Desvios com |d| > 90 min são descartados como outlier.
"""
import csv, glob, gzip, json, os, re, sys, collections, statistics, datetime

RAIZ, DADOS = sys.argv[1], sys.argv[2]
LOTE = next((int(a.split("=")[1]) for a in sys.argv if a.startswith("--lote=")), None)
FORCAR = "--gerar" in sys.argv
CACHE = os.path.join(DADOS, "_hist-cr0108.json.gz")

LIM = 90            # outlier
MIN_PONTO = 60      # massa mínima para um ponto de controle virar diagnóstico
MIN_FAIXA = 20      # massa mínima para uma faixa horária aparecer
MIN_HORARIO = 20    # massa mínima para um horário programado virar sugestão
MIN_RECUP = 5       # ganho mínimo para a sugestão sair do ruído
SEP = "\x1f"

hhmm = re.compile(r"^(\d{1,2}):(\d{2})$")

def minutos(txt):
    s = (txt or "").strip()
    if not s: return None
    neg = s.startswith("-")
    m = re.match(r"^(\d{1,3}):(\d{2})", s.lstrip("-+"))
    if not m: return None
    v = int(m.group(1)) * 60 + int(m.group(2))
    return -v if neg else v

def limpa(s): return re.sub(r"\s+", " ", (s or "").strip())

def cod_linha(s):
    s = limpa(s)
    m = re.match(r"^(\S+)\s*-\s*(.*)$", s)
    return (m.group(1), m.group(2)) if m else (s, "")

def data_do_arquivo(caminho):
    m = re.search(r"(\d{4})[.\-_](\d{2})[.\-_](\d{2})", os.path.basename(caminho))
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None

# ------------------------------------------------------------------ cache
def carregar_cache():
    if not os.path.exists(CACHE):
        return {"dias": set(), "nomes": {}, "hist": collections.defaultdict(collections.Counter)}
    with gzip.open(CACHE, "rt", encoding="utf-8") as fh:
        bruto = json.load(fh)
    hist = collections.defaultdict(collections.Counter)
    for chave, cnt in bruto["hist"].items():
        hist[tuple(chave.split(SEP))] = collections.Counter({int(d): n for d, n in cnt.items()})
    return {"dias": set(bruto["dias"]), "nomes": bruto["nomes"], "hist": hist}

def gravar_cache(c):
    with gzip.open(CACHE, "wt", encoding="utf-8") as fh:
        json.dump({
            "dias": sorted(c["dias"]),
            "nomes": c["nomes"],
            "hist": {SEP.join(k): {str(d): n for d, n in v.items()} for k, v in c["hist"].items()},
        }, fh, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(CACHE) / 1024 / 1024

# ------------------------------------------------------------------ análise
def no_horario(cnt, shift=0):
    """Quantas passagens ficariam em -2..+6 se o horário programado mudasse `shift` min."""
    return sum(n for d, n in cnt.items() if -2 <= (d - shift) <= 6)

def avalia(cnt):
    total = sum(cnt.values())
    atual = no_horario(cnt, 0)
    melhor_shift, melhor = 0, atual
    for s in range(-20, 21):
        v = no_horario(cnt, s)
        if v > melhor or (v == melhor and abs(s) < abs(melhor_shift)):
            melhor, melhor_shift = v, s
    desvios = []
    for d, n in sorted(cnt.items()): desvios.extend([d] * n)
    p10 = desvios[int(len(desvios) * 0.10)]
    p90 = desvios[int(len(desvios) * 0.90)]
    return {"n": total, "pctAtual": 100 * atual / total, "shift": melhor_shift,
            "pctPotencial": 100 * melhor / total, "ganhoPct": 100 * (melhor - atual) / total,
            "recuperadas": melhor - atual, "mediana": statistics.median(desvios),
            "p10": p10, "p90": p90, "amplitude": p90 - p10}

def arred(d): return {k: (round(v, 2) if isinstance(v, float) else v) for k, v in d.items()}

def para_min(hm):
    m = hhmm.match(hm)
    return int(m.group(1)) * 60 + int(m.group(2)) if m else None

def para_hm(mi):
    mi %= 1440
    return f"{mi // 60:02d}:{mi % 60:02d}"

def gerar(c):
    hist_pto = collections.defaultdict(collections.Counter)
    hist_hora = collections.defaultdict(collections.Counter)
    for (cod, sent, pto, prog), cnt in c["hist"].items():
        hora = prog[:2] if re.match(r"^\d{2}:", prog) else "??"
        hist_pto[(cod, sent, pto)].update(cnt)
        hist_hora[(cod, sent, pto, hora)].update(cnt)

    # ---- diagnostico-pontos.json
    itens = []
    for chave, cnt in hist_pto.items():
        if sum(cnt.values()) < MIN_PONTO: continue
        cod, sent, pto = chave
        a = avalia(cnt)
        faixas = []
        for (c2, s2, p2, h), cf in hist_hora.items():
            if (c2, s2, p2) != chave or sum(cf.values()) < MIN_FAIXA: continue
            faixas.append({"hora": h, **arred(avalia(cf))})
        faixas.sort(key=lambda f: -f["recuperadas"])
        itens.append({"linha": cod, "linhaNome": c["nomes"].get(cod, ""), "sentido": sent,
                      "ponto": pto, **arred(a), "faixas": faixas[:5],
                      "faixasHomogeneas": len({f["shift"] for f in faixas}) <= 2 if faixas else None})
    itens.sort(key=lambda i: -i["recuperadas"])
    agora = datetime.datetime.now().isoformat(timespec="seconds")
    with open(os.path.join(DADOS, "diagnostico-pontos.json"), "w", encoding="utf-8") as fh:
        json.dump({"gerado": agora,
                   "criterio": "No horário = -2..+6 min. Deslocamento testado de -20 a +20 min no horário programado.",
                   "minimoPassagens": MIN_PONTO, "itens": itens},
                  fh, ensure_ascii=False, separators=(",", ":"))

    # ---- sugestao-horarios.json
    sug = []
    for (cod, sent, pto, prog), cnt in c["hist"].items():
        if not hhmm.match(prog) or sum(cnt.values()) < MIN_HORARIO: continue
        a = avalia(cnt)
        if a["shift"] == 0 or a["recuperadas"] < MIN_RECUP: continue
        sug.append({"linha": cod, "sentido": sent, "ponto": pto, "programado": prog,
                    "sugerido": para_hm(para_min(prog) + a["shift"]),
                    "n": a["n"], "pctAtual": round(a["pctAtual"], 2), "shift": a["shift"],
                    "pctPotencial": round(a["pctPotencial"], 2),
                    "ganhoPct": round(a["ganhoPct"], 2), "recuperadas": a["recuperadas"],
                    "mediana": a["mediana"], "amplitude": a["amplitude"]})
    sug.sort(key=lambda i: -i["recuperadas"])
    with open(os.path.join(DADOS, "sugestao-horarios.json"), "w", encoding="utf-8") as fh:
        json.dump({"gerado": agora, "minimoOcorrencias": MIN_HORARIO, "minimoRecuperadas": MIN_RECUP,
                   "faixaNoHorario": [-2, 6],
                   "linhas": {k: v for k, v in sorted(c["nomes"].items())
                              if any(i["linha"] == k for i in sug)},
                   "itens": sug},
                  fh, ensure_ascii=False, separators=(",", ":"))

    print(f"diagnostico-pontos.json: {len(itens)} pontos de controle")
    print(f"sugestao-horarios.json : {len(sug)} horários com ajuste sugerido "
          f"({sum(i['recuperadas'] for i in sug)} passagens recuperáveis)")

# ------------------------------------------------------------------ execução
c = carregar_cache()
todos = sorted(glob.glob(os.path.join(RAIZ, "*", "*.csv")))
pendentes = [p for p in todos if (data_do_arquivo(p) or "") not in c["dias"]]
print(f"CSVs na pasta: {len(todos)}   já no histograma: {len(c['dias'])}   pendentes: {len(pendentes)}")

lote = pendentes[:LOTE] if LOTE else pendentes
for caminho in lote:
    dia = data_do_arquivo(caminho)
    with open(caminho, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            d = minutos(r.get("Diferença"))
            if d is None or abs(d) > LIM: continue
            cod, nome = cod_linha(r.get("Linha"))
            c["nomes"][cod] = nome
            c["hist"][(cod, limpa(r.get("Direção")) or "—",
                       limpa(r.get("Ponto de controle")) or "—",
                       limpa(r.get("Programado")))][d] += 1
    c["dias"].add(dia)

if lote:
    mb = gravar_cache(c)
    print(f"processados agora: {len(lote)} dias ({lote[0] and data_do_arquivo(lote[0])} "
          f"a {data_do_arquivo(lote[-1])})   cache: {mb:.1f} MB, {len(c['hist'])} chaves")

restantes = len(pendentes) - len(lote)
if restantes:
    print(f"FALTAM {restantes} dias — rode de novo para continuar.")
elif lote or FORCAR:
    gerar(c)
else:
    print("Nada novo — diagnóstico já está em dia.")
