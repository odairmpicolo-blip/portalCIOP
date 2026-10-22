(function () {
  function norm(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function catalogo(lista) {
    return (lista || []).map((f) => {
      const registro = String(f.registro || "").trim();
      const nome = String(f.nome || "").trim();
      const funcao = String(f.funcao || "").trim();
      return {
        registro,
        nome,
        funcao,
        busca: norm([registro, nome, funcao].join(" "))
      };
    });
  }

  let FUNCIONARIOS = [];

  function buscar(q) {
    const bruto = String(q || "").trim();
    if (!bruto) return [];
    const n = norm(bruto);
    const exatos = [];
    const resto = [];
    for (const f of FUNCIONARIOS) {
      if (f.registro === bruto) {
        exatos.push(f);
        continue;
      }
      if (f.registro.indexOf(bruto) !== -1 || f.busca.indexOf(n) !== -1) {
        resto.push(f);
      }
    }
    return exatos.concat(resto);
  }

  function setStatus(msg, tipo) {
    const el = document.getElementById("cvStatus");
    el.textContent = msg || "";
    el.dataset.tipo = tipo || "";
  }

  function limparLista() {
    const lista = document.getElementById("cvLista");
    const qtd = document.getElementById("cvQtd");
    lista.innerHTML = "";
    lista.hidden = true;
    qtd.hidden = true;
    qtd.textContent = "";
  }

  function pintarLista(hit) {
    const lista = document.getElementById("cvLista");
    const qtd = document.getElementById("cvQtd");
    lista.innerHTML = "";
    const n = hit.length;
    if (!n) {
      qtd.hidden = true;
      qtd.textContent = "";
      lista.hidden = true;
      return;
    }
    qtd.hidden = false;
    qtd.textContent = n === 1 ? "1 funcionário" : n + " funcionários";
    const frag = document.createDocumentFragment();
    hit.forEach((f) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cv-item";
      btn.setAttribute("aria-label", "Abrir " + f.registro + " " + f.nome);
      const strong = document.createElement("strong");
      strong.textContent = f.registro;
      const nome = document.createElement("span");
      nome.textContent = f.nome || "—";
      const funcao = document.createElement("em");
      funcao.textContent = f.funcao || "—";
      btn.append(strong, nome, funcao);
      btn.addEventListener("click", () => abrir(f));
      li.appendChild(btn);
      frag.appendChild(li);
    });
    lista.appendChild(frag);
    lista.hidden = false;
  }

  function abrir(f) {
    const dlg = document.getElementById("cvPopup");
    document.getElementById("cvRegistro").textContent = f.registro || "—";
    document.getElementById("cvNome").textContent = f.nome || "—";
    document.getElementById("cvFuncao").textContent = f.funcao || "—";
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  }

  function atualizarResultados(abrirUnico) {
    const q = document.getElementById("cvBusca").value;
    const bruto = String(q || "").trim();
    if (!FUNCIONARIOS.length) {
      setStatus("Carregando a listagem de funcionários…", "info");
      limparLista();
      return;
    }
    if (!bruto) {
      setStatus("Digite o registro, o nome completo ou a função.", "info");
      limparLista();
      return;
    }
    const hit = buscar(q);
    if (!hit.length) {
      setStatus("Nenhum funcionário com esse registro, nome ou função.", "erro");
      pintarLista([]);
      return;
    }
    setStatus("");
    pintarLista(hit);
    if (!abrirUnico) return;
    const unico = hit.find((f) => f.registro === bruto) || (hit.length === 1 ? hit[0] : null);
    if (unico) abrir(unico);
  }

  function consultar() {
    atualizarResultados(true);
  }

  async function iniciar() {
    const busca = document.getElementById("cvBusca");
    const params = new URLSearchParams(location.search);
    const q0 = params.get("q") || "";
    busca.value = q0;
    document.getElementById("cvConsultar").addEventListener("click", consultar);
    busca.addEventListener("input", () => atualizarResultados(false));
    busca.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        consultar();
      }
    });
    document.getElementById("cvFechar").addEventListener("click", () => {
      document.getElementById("cvPopup").close();
    });
    busca.focus();

    setStatus("Carregando a listagem de funcionários…", "info");
    try {
      if (typeof window.carregarFuncionariosCiop !== "function") {
        throw new Error("Módulo de funcionários indisponível.");
      }
      FUNCIONARIOS = catalogo(await window.carregarFuncionariosCiop());
      if (!FUNCIONARIOS.length) {
        setStatus("A listagem de funcionários veio vazia.", "erro");
        return;
      }
      setStatus(FUNCIONARIOS.length + " funcionários na base. Digite o registro, o nome ou a função.", "info");
      if (q0) consultar();
    } catch (err) {
      setStatus(err.message || "Não foi possível carregar os funcionários.", "erro");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
