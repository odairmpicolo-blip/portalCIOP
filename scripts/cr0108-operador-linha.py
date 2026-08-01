# -*- coding: utf-8 -*-
"""Agregado mês x operador x linha, para o ranking de motoristas mostrar em quais linhas
cada um roda — e como se sai em cada uma.

Chaves curtas para o arquivo não inflar: m=mês k=matrícula l=linha
n/a/t/d=classes T=total S=soma das diferenças.

Uso:
    python3 operador_linha.py <pasta-raiz> <pasta-dados> [--lote=N]
"""
import csv, glob, json, os, pickle, re, sys, collections

RAIZ, DADOS = sys.argv[1], sys.argv[2]
LOTE = next((int(a.split("=")[1]) for a in sys.argv if a.startswith("--lote=")), None)
CACHE = os.path.join(DADOS, "_op_linha2.pkl")

def limpa(s): return re.sub(r"\s+", " ", (s or "").strip())

def minutos(txt):
    s = (txt or "").strip()
    if not s: return None
    neg = s.startswith("-")
    m = re.match(r"^(\d{1,3}):(\d{2})", s.lstrip("-+"))
    if not m: return None
    v = int(m.group(1)) * 60 + int(m.group(2))
    return -v if neg else v

def classe(d):
    if d is None: return None
    if -2 <= d <= 6: return "n"
    if -10 <= d <= -3: return "a"
    if 7 <= d <= 15: return "t"
    return "d"

def operador(s):
    s = limpa(s)
    m = re.match(r"^(.*),\s*(\d+)$", s)
    return (m.group(2), m.group(1)) if m else ("", s)

def data_do_arquivo(c):
    m = re.search(r"(\d{4})[.\-_](\d{2})[.\-_](\d{2})", os.path.basename(c))
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None

def zero(): return {"n": 0, "a": 0, "t": 0, "d": 0, "T": 0, "S": 0}   # nomeada: lambda não vai para o pickle

est = {"dias": set(), "agg": collections.defaultdict(zero)}
if os.path.exists(CACHE):
    with open(CACHE, "rb") as fh: est = pickle.load(fh)

todos = sorted(glob.glob(os.path.join(RAIZ, "*", "*.csv")))
pend = [c for c in todos if (data_do_arquivo(c) or "") not in est["dias"]]
print(f"CSVs: {len(todos)}   já agregados: {len(est['dias'])}   pendentes: {len(pend)}")

lote = pend[:LOTE] if LOTE else pend
for caminho in lote:
    with open(caminho, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            data = limpa(r.get("Data"))
            if not data: continue
            dd, mm, yy = data.split("/")
            mes = f"{yy}-{mm}"
            ln = limpa(r.get("Linha"))
            cod = (re.match(r"^(\S+)", ln).group(1) if re.match(r"^(\S+)", ln) else ln)
            matricula, nome = operador(r.get("Operador"))
            chave_op = matricula or nome
            a = est["agg"][(mes, chave_op, cod)]
            a["T"] += 1
            c = classe(minutos(r.get("Diferença")))
            if c:
                a[c] += 1
                a["S"] += minutos(r.get("Diferença"))
    est["dias"].add(data_do_arquivo(caminho))

if lote:
    with open(CACHE, "wb") as fh: pickle.dump(est, fh, protocol=4)
    print(f"processados: {len(lote)} dias   combinações: {len(est['agg'])}")

restantes = len(pend) - len(lote)
if restantes:
    print(f"FALTAM {restantes} dias — rode de novo.")
    sys.exit(0)

itens = [{"m": k[0], "k": k[1], "l": k[2], **v} for k, v in sorted(est["agg"].items())]
saida = os.path.join(DADOS, "por-mes-operador-linha.json")
with open(saida, "w", encoding="utf-8") as fh:
    json.dump(itens, fh, ensure_ascii=False, separators=(",", ":"))
import gzip
with open(saida, "rb") as fh: comp = len(gzip.compress(fh.read(), 9))
print(f"por-mes-operador-linha.json: {len(itens)} linhas   "
      f"{os.path.getsize(saida)/1024/1024:.2f} MB   gzip: {comp/1024:.0f} KB")
