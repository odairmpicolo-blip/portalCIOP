# -*- coding: utf-8 -*-
"""Carga incremental do CR-0108.

Lê APENAS os CSVs de dias que ainda não entraram nos agregados (compara com as datas
já presentes em por-dia.json) e soma os contadores aos JSONs existentes. Todos os
agregados do portal são somas puras, então o resultado é idêntico ao de reprocessar a
pasta inteira — só que em segundos em vez de minutos.

Uso:
    python3 incremental.py <pasta-raiz> <pasta-dados>

Régua (definida pela operação; NÃO usa as colunas "Status"/"OTP Status" do arquivo):
    -2 .. +6 = No horário | -10 .. -3 = Adiantado | +7 .. +15 = Atrasado
    >= +16 ou <= -11 = Divergente.  Negativo = passou antes do programado.
"""
import csv, glob, json, os, re, sys, collections, datetime

RAIZ, DADOS = sys.argv[1], sys.argv[2]

CH = ["noHorario", "adiantado", "atrasado", "divergente"]
def novo(): return {k: 0 for k in CH} | {"total": 0, "somaDif": 0, "semDif": 0}

def minutos(txt):
    s = (txt or "").strip()
    if not s: return None
    neg = s.startswith("-")
    m = re.match(r"^(\d{1,3}):(\d{2})(?::(\d{2}))?$", s.lstrip("-+"))
    if not m: return None
    v = int(m.group(1)) * 60 + int(m.group(2))
    return -v if neg else v

def classificar(d):
    if d is None: return None
    if -2 <= d <= 6: return "noHorario"
    if -10 <= d <= -3: return "adiantado"
    if 7 <= d <= 15: return "atrasado"
    return "divergente"

def limpa(s): return re.sub(r"\s+", " ", (s or "").strip())

def nome_linha(s):
    s = limpa(s)
    m = re.match(r"^(\S+)\s*-\s*(.*)$", s)
    return (m.group(1), m.group(2)) if m else (s, "")

def operador(s):
    s = limpa(s)
    m = re.match(r"^(.*),\s*(\d+)$", s)
    return (m.group(2), m.group(1)) if m else ("", s)

def ler(nome):
    with open(os.path.join(DADOS, nome), encoding="utf-8") as fh:
        return json.load(fh)

def gravar(nome, obj):
    p = os.path.join(DADOS, nome)
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(p) / 1024

# ------------------------------------------------------------------ o que falta entrar
meta = ler("meta.json")
dias_existentes = {r["data"] for r in ler("por-dia.json")}

def data_do_arquivo(caminho):
    m = re.search(r"(\d{4})[.\-_](\d{2})[.\-_](\d{2})", os.path.basename(caminho))
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None

todos = sorted(glob.glob(os.path.join(RAIZ, "*", "*.csv")))
novos = [c for c in todos if (data_do_arquivo(c) or "") not in dias_existentes]

print(f"CSVs na pasta: {len(todos)}   dias já agregados: {len(dias_existentes)}")
if not novos:
    print("Nada novo — agregados já estão em dia.")
    sys.exit(0)
print("Dias novos a carregar:")
for c in novos:
    print(f"   {data_do_arquivo(c)}  {os.path.basename(c)}")

# ------------------------------------------------------------------ lê só os dias novos
acc = {nome: collections.defaultdict(novo) for nome in [
    "dia", "dia_linha", "linha", "ponto", "hora", "operador", "veiculo", "garagem",
    "dia_garagem", "sentido", "dia_hora", "mes_ponto", "mes_operador", "mes_veiculo",
    "mes_linha", "mes_sentido"]}
mhl = collections.defaultdict(lambda: {k: 0 for k in CH} | {"total": 0})
nomes_linha, nomes_operador = {}, {}
lidos = 0

def soma(d, chave, cls, dif):
    a = d[chave]
    a["total"] += 1
    if cls is None:
        a["semDif"] += 1
        return
    a[cls] += 1
    a["somaDif"] += dif

for caminho in novos:
    with open(caminho, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            data = limpa(r.get("Data"))
            if not data: continue
            dd, mm, yy = data.split("/")
            iso, mes = f"{yy}-{mm}-{dd}", f"{yy}-{mm}"
            dif = minutos(r.get("Diferença"))
            cls = classificar(dif)
            gar = limpa(r.get("Garagem")) or "—"
            cod, nome = nome_linha(r.get("Linha"))
            nomes_linha.setdefault(cod, nome)
            matricula, nomeop = operador(r.get("Operador"))
            chave_op = matricula or nomeop
            nomes_operador.setdefault(chave_op, nomeop)
            veic = limpa(r.get("Veículo"))
            ponto = limpa(r.get("Ponto de controle")) or "—"
            sentido = limpa(r.get("Direção")) or "—"
            prog = limpa(r.get("Programado"))
            hora = prog[:2] if re.match(r"^\d{2}:", prog) else "??"
            lidos += 1

            soma(acc["dia"], iso, cls, dif)
            soma(acc["dia_linha"], (iso, cod), cls, dif)
            soma(acc["linha"], cod, cls, dif)
            soma(acc["ponto"], ponto, cls, dif)
            soma(acc["hora"], hora, cls, dif)
            soma(acc["operador"], chave_op, cls, dif)
            soma(acc["veiculo"], veic, cls, dif)
            soma(acc["garagem"], gar, cls, dif)
            soma(acc["dia_garagem"], (iso, gar), cls, dif)
            soma(acc["sentido"], sentido, cls, dif)
            soma(acc["dia_hora"], (iso, hora), cls, dif)
            soma(acc["mes_ponto"], (mes, ponto), cls, dif)
            soma(acc["mes_operador"], (mes, chave_op), cls, dif)
            soma(acc["mes_veiculo"], (mes, veic), cls, dif)
            soma(acc["mes_linha"], (mes, cod), cls, dif)
            soma(acc["mes_sentido"], (mes, sentido), cls, dif)

            a = mhl[(mes, hora, cod, sentido)]
            a["total"] += 1
            if cls is not None: a[cls] += 1

print(f"\nregistros lidos: {lidos}")

# ------------------------------------------------------------------ funde com o existente
def fundir(arquivo, campos, acumulador):
    """campos = nomes das colunas-chave do arquivo."""
    base = {}
    for r in ler(arquivo):
        chave = tuple(r[c] for c in campos)
        base[chave] = {k: r.get(k, 0) for k in CH} | {
            "total": r.get("total", 0), "somaDif": r.get("somaDif", 0), "semDif": r.get("semDif", 0)}
    for chave, v in acumulador.items():
        chave = chave if isinstance(chave, tuple) else (chave,)
        alvo = base.setdefault(chave, novo())
        for k in CH + ["total", "somaDif", "semDif"]:
            alvo[k] += v[k]
    saida = []
    for chave in sorted(base):
        linha = dict(zip(campos, chave))
        linha.update(base[chave])
        saida.append(linha)
    kb = gravar(arquivo, saida)
    print(f"  {arquivo}: {len(saida)} linhas, {kb:.0f} KB")

# rótulos preservados do arquivo anterior + os novos
rot_linha = dict(meta.get("linhas", {})); rot_linha.update({k: v for k, v in nomes_linha.items() if v})
rot_op = {r["matricula"]: r.get("nome", "") for r in ler("por-operador.json")}
rot_op.update({k: v for k, v in nomes_operador.items() if v})

fundir("por-dia.json", ["data"], acc["dia"])
fundir("por-ponto.json", ["ponto"], acc["ponto"])
fundir("por-hora.json", ["hora"], acc["hora"])
fundir("por-veiculo.json", ["veiculo"], acc["veiculo"])
fundir("por-garagem.json", ["garagem"], acc["garagem"])
fundir("por-sentido.json", ["sentido"], acc["sentido"])
fundir("por-dia-linha.json", ["data", "linha"], acc["dia_linha"])
fundir("por-dia-garagem.json", ["data", "garagem"], acc["dia_garagem"])
fundir("por-dia-hora.json", ["data", "hora"], acc["dia_hora"])
fundir("por-mes-ponto.json", ["mes", "ponto"], acc["mes_ponto"])
fundir("por-mes-veiculo.json", ["mes", "veiculo"], acc["mes_veiculo"])
fundir("por-mes-sentido.json", ["mes", "sentido"], acc["mes_sentido"])

# os dois com rótulo precisam de tratamento próprio
def fundir_rotulado(arquivo, campos, acumulador, campo_chave, mapa, campo_rotulo="nome"):
    base = {}
    for r in ler(arquivo):
        chave = tuple(r[c] for c in campos)
        base[chave] = {k: r.get(k, 0) for k in CH} | {
            "total": r.get("total", 0), "somaDif": r.get("somaDif", 0), "semDif": r.get("semDif", 0)}
    for chave, v in acumulador.items():
        chave = chave if isinstance(chave, tuple) else (chave,)
        alvo = base.setdefault(chave, novo())
        for k in CH + ["total", "somaDif", "semDif"]:
            alvo[k] += v[k]
    saida = []
    for chave in sorted(base):
        linha = dict(zip(campos, chave))
        linha[campo_rotulo] = mapa.get(linha[campo_chave], "")
        linha.update(base[chave])
        saida.append(linha)
    kb = gravar(arquivo, saida)
    print(f"  {arquivo}: {len(saida)} linhas, {kb:.0f} KB")

fundir_rotulado("por-linha.json", ["linha"], acc["linha"], "linha", rot_linha)
fundir_rotulado("por-mes-linha.json", ["mes", "linha"], acc["mes_linha"], "linha", rot_linha)
fundir_rotulado("por-operador.json", ["matricula"], acc["operador"], "matricula", rot_op)
fundir_rotulado("por-mes-operador.json", ["mes", "matricula"], acc["mes_operador"], "matricula", rot_op)

# por-mes-hora-linha.json usa chaves curtas
base_mhl = {}
for r in ler("por-mes-hora-linha.json"):
    base_mhl[(r["m"], r["h"], r["l"], r["s"])] = {
        "noHorario": r["n"], "adiantado": r["a"], "atrasado": r["t"], "divergente": r["d"], "total": r["T"]}
for chave, v in mhl.items():
    alvo = base_mhl.setdefault(chave, {k: 0 for k in CH} | {"total": 0})
    for k in CH + ["total"]:
        alvo[k] += v[k]
itens = [{"m": k[0], "h": k[1], "l": k[2], "s": k[3], "n": v["noHorario"], "a": v["adiantado"],
          "t": v["atrasado"], "d": v["divergente"], "T": v["total"]} for k, v in sorted(base_mhl.items())]
kb = gravar("por-mes-hora-linha.json", itens)
print(f"  por-mes-hora-linha.json: {len(itens)} linhas, {kb:.0f} KB")

# ------------------------------------------------------------------ meta
dias = [r["data"] for r in ler("por-dia.json")]
meta.update({
    "gerado": datetime.datetime.now().isoformat(timespec="seconds"),
    "arquivos": len(todos),
    "registros": meta.get("registros", 0) + lidos,
    "primeiroDia": min(dias),
    "ultimoDia": max(dias),
    "linhas": {k: rot_linha.get(k, "") for k in sorted(rot_linha)},
})
gravar("meta.json", meta)
print(f"\nmeta: {meta['arquivos']} arquivos, {meta['registros']} registros, "
      f"{meta['primeiroDia']} a {meta['ultimoDia']}")
