#!/usr/bin/env python3
"""Registra a rota /cr0108 na API do portal — nos DOIS lugares que ela precisa existir.

O API Gateway do portal não tem catch-all: cada rota é declarada no CloudFormation.
Por isso registrar só no Express não resolve — o gateway devolve 404 antes de chamar
o Lambda. Este script mexe em:

  backend/src/index.js          importa e monta o router
  aws/portal-api/template.yaml  declara ANY /cr0108 e ANY /cr0108/{proxy+}

É idempotente: rodar de novo não duplica nada. Faz backup .bak de cada arquivo.

Uso, na raiz do repositório:
    python3 scripts/ligar-cr0108-api.py
"""
import re, shutil, sys
from pathlib import Path

raiz = Path(__file__).resolve().parent.parent
mudou = False


def editar(caminho, transformar):
    global mudou
    p = raiz / caminho
    if not p.exists():
        sys.exit(f"ERRO: não achei {caminho} — rode a partir da raiz do repositório.")
    antes = p.read_text(encoding="utf-8")
    depois, nota = transformar(antes)
    if depois is None:
        print(f"  {caminho}: {nota}")
        return
    shutil.copy2(p, p.with_suffix(p.suffix + ".bak"))
    p.write_text(depois, encoding="utf-8")
    print(f"  {caminho}: {nota}  (backup em {p.name}.bak)")
    mudou = True


# ---------------------------------------------------------------- index.js
def js(txt):
    if "routes/cr0108.js" in txt:
        return None, "já registrado"

    imports = list(re.finditer(r'^import .+ from "\./routes/.+";$', txt, re.M))
    usos = list(re.finditer(r'^app\.use\("/[^"]+",\s*\w+\);$', txt, re.M))
    if not imports or not usos:
        sys.exit("ERRO: não reconheci o formato do index.js — faça a mão.")

    # de trás para frente, para o primeiro insert não deslocar o segundo
    fim = usos[-1].end()
    txt = txt[:fim] + '\napp.use("/cr0108", cr0108Router);' + txt[fim:]
    fim = imports[-1].end()
    txt = txt[:fim] + '\nimport cr0108Router from "./routes/cr0108.js";' + txt[fim:]
    return txt, "import + app.use adicionados"


# ---------------------------------------------------------------- template.yaml
ROTAS = """  PortalApiRouteCr0108:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref Bus2ProxyApiId
      RouteKey: ANY /cr0108
      Target: !Sub integrations/${PortalApiIntegration}

  PortalApiRouteCr0108Proxy:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref Bus2ProxyApiId
      RouteKey: "ANY /cr0108/{proxy+}"
      Target: !Sub integrations/${PortalApiIntegration}

"""


def yaml(txt):
    if "PortalApiRouteCr0108" in txt:
        return None, "já declarado"
    marca = "  PortalApiPermission:"
    if marca not in txt:
        sys.exit("ERRO: não achei PortalApiPermission no template.yaml — faça a mão.")
    return txt.replace(marca, ROTAS + marca, 1), "ANY /cr0108 e /cr0108/{proxy+} declaradas"


print("Ligando a rota /cr0108 na API do portal:")
editar("backend/src/index.js", js)
editar("aws/portal-api/template.yaml", yaml)

if not mudou:
    print("\nNada a fazer — já estava tudo no lugar.")
    sys.exit(0)

print("""
Pronto. Agora:

  1. Confira o que mudou:
       git diff

  2. Implante (precisa da AWS CLI configurada):
       bash scripts/deploy-portal-api.sh

  3. Teste — o esperado agora é 401, e não 404:
       curl -i "$(python3 -c "import json;print(json.load(open('assets/data/portal-runtime.json'))['awsApiUrl'])")/cr0108/meta"

  4. Se deu 401, comite:
       git add backend/src/index.js aws/portal-api/template.yaml
       git commit -m "API: registra a rota /cr0108 no Express e no API Gateway"
       git push
""")
