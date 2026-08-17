"""
Copia ou baixa planilhas de Tabelas Horárias para importação no portal.

Fontes:
  - Pasta local (Google Drive no PC):
    G:/Meu Drive/02 - TCGLL/Tabelas horárias
  - Drive web: https://drive.google.com/drive/folders/1TKryDACuyao1v2wE9GGSM0rws2oOnQu5

Uso:
  python scripts/baixar-tabelas-horarias-drive.py --local
  python scripts/baixar-tabelas-horarias-drive.py --drive   # requer pip install gdown

Depois: node scripts/importar-tabelas-horarias.mjs
"""

from __future__ import annotations

import re
import shutil
import sys
import time
from pathlib import Path

PORTAL_ROOT = Path(__file__).resolve().parents[1]
IMPORT_ROOT = PORTAL_ROOT / "assets" / "import" / "tabelas-horarias"
DRIVE_CACHE = IMPORT_ROOT / "_drive"
LOCAL_PADRAO = Path(r"G:/Meu Drive/02 - TCGLL/Tabelas horárias")

PASTAS_DRIVE = {
    "uteis": "1qvIHV56PGi6rlv83W3gifFDsqWkE7ayO",
    "sabado": "1-78LDJIc0tDU2nhiodQw6EOIdPU5HKl7",
    "domingo": "1xtoHkCL7GoBKT4ST0ZIOHjGgClz8CzS4",
}

MAPA_LOCAL = {
    "uteis": ("1", ("TEIS", "ÚTEIS", "UTEIS")),
    "sabado": ("2", ("BADO", "SÁBADO", "SABADO")),
    "domingo": ("3", ("DOMINGO",)),
}

DATA_RE = re.compile(r"(\d{2})-(\d{2})-(\d{4})")
PAUSA_SEG = 2.5


def data_do_nome(nome: str) -> tuple[int, str]:
    m = DATA_RE.search(nome)
    if not m:
        return (0, "")
    d, mo, y = m.groups()
    return (int(f"{y}{mo}{d}"), f"{y}-{mo}-{d}")


def linha_do_nome(nome: str) -> str:
    base = Path(nome).stem.strip()
    base = DATA_RE.sub("", base).strip(" -_")
    base = re.sub(r"\s+", " ", base)
    m = re.match(r"^(\d[\d\-AOPaop\s]*)", base)
    if m:
        return re.sub(r"[-_\s]+$", "", re.sub(r"\s+", "", m.group(1).strip()))
    return re.sub(r"[-_\s]+$", "", re.sub(r"\s+", "", base.split()[0] if base else ""))


def achar_pasta_local(origem: Path, tipo: str) -> Path | None:
    prefixo, termos = MAPA_LOCAL[tipo]
    for pasta in origem.iterdir():
        if not pasta.is_dir():
            continue
        nome = pasta.name.upper()
        if nome.startswith(prefixo) or any(t in nome for t in termos):
            return pasta
    return None


def organizar_arquivos(origem: Path, tipo: str) -> int:
    destino = IMPORT_ROOT / tipo
    if destino.exists():
        shutil.rmtree(destino)
    destino.mkdir(parents=True, exist_ok=True)

    candidatos: dict[str, tuple[int, Path]] = {}
    for arquivo in origem.rglob("*.xlsx"):
        if "anteriores" in str(arquivo).lower():
            continue
        linha = linha_do_nome(arquivo.name)
        if not linha or not linha[0].isdigit():
            continue
        score, _ = data_do_nome(arquivo.name)
        atual = candidatos.get(linha)
        if not atual or score >= atual[0]:
            candidatos[linha] = (score, arquivo)

    for linha, (_, arquivo) in sorted(candidatos.items(), key=lambda x: x[0]):
        shutil.copy2(arquivo, destino / f"{linha}.xlsx")

    print(f"[{tipo}] {len(candidatos)} planilha(s) organizadas")
    return len(candidatos)


def copiar_de_local(origem: Path) -> int:
    if not origem.exists():
        raise SystemExit(f"Pasta local não encontrada: {origem}")
    IMPORT_ROOT.mkdir(parents=True, exist_ok=True)
    total = 0
    for tipo in MAPA_LOCAL:
        pasta = achar_pasta_local(origem, tipo)
        if not pasta:
            print(f"[{tipo}] pasta não encontrada em {origem}")
            continue
        print(f"[{tipo}] lendo {pasta}")
        total += organizar_arquivos(pasta, tipo)
    return total


def baixar_pasta(tipo: str, folder_id: str) -> Path:
    import gdown

    dest = DRIVE_CACHE / tipo
    dest.mkdir(parents=True, exist_ok=True)

    lista = gdown.download_folder(id=folder_id, skip_download=True, quiet=True)
    atuais = [f for f in lista if not str(f.path).replace("/", "\\").lower().startswith("anteriores")]
    print(f"\n[{tipo}] {len(atuais)} planilha(s) atuais (de {len(lista)} no Drive)")

    ok = 0
    for i, item in enumerate(atuais, 1):
        nome = Path(str(item.path)).name
        alvo = dest / nome
        if alvo.exists() and alvo.stat().st_size > 1024:
            ok += 1
            continue
        for tentativa in range(1, 4):
            try:
                gdown.download(id=item.id, output=str(alvo), quiet=True)
                if alvo.exists() and alvo.stat().st_size > 0:
                    ok += 1
                    break
            except Exception as exc:
                if tentativa == 3:
                    print(f"  falhou {nome}: {exc}")
                else:
                    time.sleep(10 * tentativa)
        if i % 10 == 0:
            print(f"  [{tipo}] {i}/{len(atuais)} processados ({ok} ok)")
        time.sleep(PAUSA_SEG)

    print(f"[{tipo}] {ok}/{len(atuais)} baixados em {dest}")
    return dest


def baixar_do_drive() -> int:
    try:
        import gdown  # noqa: F401
    except ImportError:
        print("Instale gdown: pip install gdown")
        sys.exit(1)

    IMPORT_ROOT.mkdir(parents=True, exist_ok=True)
    total = 0
    for tipo, folder_id in PASTAS_DRIVE.items():
        baixar_pasta(tipo, folder_id)
        total += organizar_arquivos(DRIVE_CACHE / tipo, tipo)
    return total


def main() -> None:
    args = sys.argv[1:]
    usar_drive = "--drive" in args
    usar_local = "--local" in args or not usar_drive

    if usar_local:
        origem = LOCAL_PADRAO
        for i, arg in enumerate(args):
            if arg == "--local" and i + 1 < len(args) and not args[i + 1].startswith("-"):
                origem = Path(args[i + 1])
        total = copiar_de_local(origem)
    else:
        total = baixar_do_drive()

    print(f"\nPronto: {total} planilha(s) em assets/import/tabelas-horarias/")
    print("Execute: node scripts/importar-tabelas-horarias.mjs")


if __name__ == "__main__":
    main()
