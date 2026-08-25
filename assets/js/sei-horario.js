const SHEET_ID = "1zY_BFsidZyF4RnzKTZkZAlmo-Qiz6JEdIEb3E2xoIeA";
const GID_FUNCIONARIOS = "1931884858";
const FUNC_CACHE_KEY = "ciop_evidencias_funcionarios_v1";

const DESTINATARIOS = [
  "pessoal@tcgl.com.br",
  "rehder@tcgl.com.br",
  "monitoramento@tcgl.com.br",
  "planejamento@tcgl.com.br",
  "rony0712@hotmail.com",
  "secretaria@mov1.com.br"
];

const $ = (id) => document.getElementById(id);

let funcionarios = [];
let linhas = [];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function hojeBr() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date());
}

function isoParaBr(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return hojeBr();
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function brParaIso(br) {
  const m = String(br || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function usuarioSessao() {
  return window.portalUsuario || {};
}

function resolverRemetente() {
  const user = usuarioSessao();
  const login = String(user.email || "").trim().toLowerCase();
  const nome = String(user.nome || "").trim();
  const cargo = String(user.cargo || user.perfil || "").trim();

  if (login === "odair.marin@icloud.com" || /^odair\b/i.test(nome)) {
    return { email: "planejamento@tcgl.com.br", nome: "Odair Marino Picolo" };
  }
  const secretaria =
    /geneci/i.test(nome) ||
    /geneci/i.test(login) ||
    /secretár/i.test(cargo) ||
    login.includes("secretaria");
  if (secretaria) {
    const deEmpresa = /@(tcgl\.com\.br|mov1\.com\.br)$/i.test(login);
    return {
      email: deEmpresa ? login : login || "secretaria@tcgl.com.br",
      nome: nome || "Secretaria"
    };
  }
  if (/@(tcgl\.com\.br|mov1\.com\.br)$/i.test(login)) {
    return { email: login, nome: nome || login };
  }
  return { email: "planejamento@tcgl.com.br", nome: nome || "CIOP / TCGL" };
}

async function carregarFuncionarios() {
  try {
    const cached = JSON.parse(localStorage.getItem(FUNC_CACHE_KEY) || "null");
    if (cached?.ts && Date.now() - cached.ts < 6 * 60 * 60 * 1000 && Array.isArray(cached.dados)) {
      funcionarios = cached.dados;
    }
  } catch (_) {}

  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID_FUNCIONARIOS}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar funcionários (" + res.status + ")");
  const rows = parseCsv(await res.text());
  funcionarios = rows
    .slice(1)
    .map((linha) => ({
      registro: String(linha[0] || "").trim(),
      nome: String(linha[1] || "").trim(),
      funcao: String(linha[2] || "").trim()
    }))
    .filter((item) => item.registro && item.nome);
  localStorage.setItem(FUNC_CACHE_KEY, JSON.stringify({ ts: Date.now(), dados: funcionarios }));
}

function funcionarioPorRegistro(reg) {
  const k = String(reg || "").trim();
  return funcionarios.find((f) => f.registro === k) || null;
}

function funcionarioPorNome(nome) {
  const k = String(nome || "").trim().toLowerCase();
  if (!k) return null;
  const exatos = funcionarios.filter((f) => f.nome.toLowerCase() === k);
  return exatos.length === 1 ? exatos[0] : null;
}

function linhaVazia() {
  return { func: "", nome: "", inicio1: "", fim1: "", inicio2: "", fim2: "" };
}

function renderTabela() {
  const tbody = $("seiLinhas");
  tbody.innerHTML = linhas
    .map((row, i) => {
      return `<tr data-i="${i}">
        <td><input class="sei-func" value="${escapeHtml(row.func)}" list="listaFuncionarios" placeholder="9163"></td>
        <td><input class="sei-nome" value="${escapeHtml(row.nome)}" list="listaNomes" placeholder="Nome"></td>
        <td><input class="sei-h sei-i1" type="time" value="${escapeHtml(row.inicio1)}"></td>
        <td><input class="sei-h sei-f1" type="time" value="${escapeHtml(row.fim1)}"></td>
        <td><input class="sei-h sei-i2" type="time" value="${escapeHtml(row.inicio2)}"></td>
        <td><input class="sei-h sei-f2" type="time" value="${escapeHtml(row.fim2)}"></td>
        <td><button type="button" class="btn-x" data-del="${i}" title="Remover">×</button></td>
      </tr>`;
    })
    .join("");
  $("listaFuncionarios").innerHTML = funcionarios
    .map((f) => `<option value="${escapeHtml(f.registro)}">${escapeHtml(f.nome)}</option>`)
    .join("");
  const listaNomes = $("listaNomes");
  if (listaNomes) {
    listaNomes.innerHTML = funcionarios
      .map((f) => `<option value="${escapeHtml(f.nome)}"></option>`)
      .join("");
  }
  atualizarPreview();
}

function lerLinhasDaTela() {
  linhas = [...$("seiLinhas").querySelectorAll("tr")].map((tr) => ({
    func: tr.querySelector(".sei-func")?.value.trim() || "",
    nome: tr.querySelector(".sei-nome")?.value.trim() || "",
    inicio1: tr.querySelector(".sei-i1")?.value || "",
    fim1: tr.querySelector(".sei-f1")?.value || "",
    inicio2: tr.querySelector(".sei-i2")?.value || "",
    fim2: tr.querySelector(".sei-f2")?.value || ""
  }));
}

function fmtHora(v) {
  if (!v) return "";
  const m = String(v).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return v;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function dataComunicado() {
  const iso = $("seiData")?.value;
  if (iso) return isoParaBr(iso);
  return hojeBr();
}

function linhasValidas() {
  return linhas.filter((r) => r.func || r.nome);
}

function montarHtmlEmail() {
  const data = dataComunicado();
  const remetente = resolverRemetente();
  const rows = linhasValidas();
  const trs = rows
    .map(
      (r) => `<tr>
        <td style="border:1px solid #c5c5c5;padding:6px 8px;">${escapeHtml(data)}</td>
        <td style="border:1px solid #c5c5c5;padding:6px 8px;">${escapeHtml(r.func)}</td>
        <td style="border:1px solid #c5c5c5;padding:6px 8px;">${escapeHtml(r.nome)}</td>
        <td style="border:1px solid #c5c5c5;padding:6px 8px;">${escapeHtml(fmtHora(r.inicio1))}</td>
        <td style="border:1px solid #c5c5c5;padding:6px 8px;">${escapeHtml(fmtHora(r.fim1))}</td>
        <td style="border:1px solid #c5c5c5;padding:6px 8px;">${escapeHtml(fmtHora(r.inicio2))}</td>
        <td style="border:1px solid #c5c5c5;padding:6px 8px;">${escapeHtml(fmtHora(r.fim2))}</td>
      </tr>`
    )
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.45;">
<p>Informamos que, em virtude das necessidades do setor, os horários dos colaboradores listados abaixo foram alterados conforme apresentado:</p>
<table style="border-collapse:collapse;font-size:13px;margin:12px 0 16px;">
  <thead>
    <tr>
      <th style="border:1px solid #c5c5c5;padding:6px 8px;text-align:left;">Data</th>
      <th style="border:1px solid #c5c5c5;padding:6px 8px;text-align:left;">FUNC</th>
      <th style="border:1px solid #c5c5c5;padding:6px 8px;text-align:left;">NOME</th>
      <th style="border:1px solid #c5c5c5;padding:6px 8px;text-align:left;">INICIO 1</th>
      <th style="border:1px solid #c5c5c5;padding:6px 8px;text-align:left;">FIM 1</th>
      <th style="border:1px solid #c5c5c5;padding:6px 8px;text-align:left;">INICIO 2</th>
      <th style="border:1px solid #c5c5c5;padding:6px 8px;text-align:left;">FIM 2</th>
    </tr>
  </thead>
  <tbody>${trs}</tbody>
</table>
<p>Qualquer dúvida, estou à disposição.</p>
<p>Atenciosamente,<br><strong>${escapeHtml(remetente.nome)}</strong></p>
</div>`;
}

function montarTextoEmail() {
  const data = dataComunicado();
  const remetente = resolverRemetente();
  const rows = linhasValidas();
  const linhasTxt = rows
    .map(
      (r) =>
        `${data}\t${r.func}\t${r.nome}\t${fmtHora(r.inicio1)}\t${fmtHora(r.fim1)}\t${fmtHora(r.inicio2)}\t${fmtHora(r.fim2)}`
    )
    .join("\n");
  return [
    "Informamos que, em virtude das necessidades do setor, os horários dos colaboradores listados abaixo foram alterados conforme apresentado:",
    "",
    "Data\tFUNC\tNOME\tINICIO 1\tFIM 1\tINICIO 2\tFIM 2",
    linhasTxt,
    "",
    "Qualquer dúvida, estou à disposição.",
    "",
    "Atenciosamente,",
    remetente.nome
  ].join("\n");
}

function atualizarPreview() {
  const remetente = resolverRemetente();
  if ($("seiDe")) $("seiDe").textContent = `${remetente.nome} <${remetente.email}>`;
  if ($("seiPara")) $("seiPara").textContent = DESTINATARIOS.join(", ");
  if ($("seiAssuntoPrev")) $("seiAssuntoPrev").textContent = assuntoEmail();
  if ($("seiPreview")) $("seiPreview").innerHTML = montarHtmlEmail();
}

function setStatus(msg, tipo) {
  const el = $("seiStatus");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("is-error", tipo === "erro");
  el.classList.toggle("is-ok", tipo === "ok");
}

function assuntoEmail() {
  return `Alteração de horário de trabalho — ${dataComunicado()}`;
}

function validarLinhas() {
  lerLinhasDaTela();
  const rows = linhasValidas();
  if (!rows.length) {
    setStatus("Inclua ao menos um colaborador.", "erro");
    return null;
  }
  for (const r of rows) {
    if (!r.func || !r.nome) {
      setStatus("Preencha FUNC e NOME em todas as linhas.", "erro");
      return null;
    }
  }
  return rows;
}

async function copiarTexto(texto) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = texto;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

async function copiarCorpoFormatado(html, texto) {
  try {
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([texto], { type: "text/plain" })
        })
      ]);
      return;
    }
  } catch (_) {}
  await copiarTexto(texto);
}

async function copiarDestinatarios() {
  await copiarTexto(DESTINATARIOS.join("; "));
  setStatus("Destinatários copiados. Cole no campo Para do e-mail.", "ok");
}

async function copiarAssunto() {
  await copiarTexto(assuntoEmail());
  setStatus("Assunto copiado.", "ok");
}

async function copiarCorpo() {
  if (!validarLinhas()) return;
  const btn = $("seiCopiarCorpo");
  btn.disabled = true;
  try {
    await copiarCorpoFormatado(montarHtmlEmail(), montarTextoEmail());
    setStatus("Corpo copiado com a tabela. Cole no e-mail da sua conta.", "ok");
  } catch (err) {
    setStatus(err.message || "Não foi possível copiar.", "erro");
  } finally {
    btn.disabled = false;
  }
}

function novaLinha() {
  lerLinhasDaTela();
  linhas.push(linhaVazia());
  renderTabela();
}

function wire() {
  $("seiData").value = brParaIso(hojeBr());
  linhas = [linhaVazia(), linhaVazia(), linhaVazia(), linhaVazia()];
  renderTabela();
  atualizarPreview();

  $("seiData").addEventListener("change", () => {
    lerLinhasDaTela();
    atualizarPreview();
  });
  $("seiAdd").addEventListener("click", novaLinha);
  $("seiCopiarPara").addEventListener("click", () => copiarDestinatarios().catch((err) => setStatus(err.message, "erro")));
  $("seiCopiarAssunto").addEventListener("click", () => copiarAssunto().catch((err) => setStatus(err.message, "erro")));
  $("seiCopiarCorpo").addEventListener("click", () => copiarCorpo());

  $("seiLinhas").addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-del]");
    if (!btn) return;
    lerLinhasDaTela();
    linhas.splice(Number(btn.dataset.del), 1);
    if (!linhas.length) linhas.push(linhaVazia());
    renderTabela();
  });
  $("seiLinhas").addEventListener("change", (ev) => {
    const tr = ev.target.closest("tr");
    if (!tr) return;
    if (ev.target.classList.contains("sei-func")) {
      const f =
        funcionarioPorRegistro(ev.target.value) || funcionarioPorNome(ev.target.value);
      if (f) {
        ev.target.value = f.registro;
        tr.querySelector(".sei-nome").value = f.nome;
      }
    }
    if (ev.target.classList.contains("sei-nome")) {
      const f = funcionarioPorNome(ev.target.value);
      if (f) tr.querySelector(".sei-func").value = f.registro;
    }
    lerLinhasDaTela();
    atualizarPreview();
  });
  $("seiLinhas").addEventListener("input", () => {
    lerLinhasDaTela();
    atualizarPreview();
  });
}

let iniciado = false;
async function iniciar() {
  if (iniciado) return;
  iniciado = true;
  wire();
  setStatus("Carregando funcionários...");
  try {
    await carregarFuncionarios();
    renderTabela();
    setStatus(`${funcionarios.length} funcionários na base. Copie o corpo e cole no seu e-mail.`, "ok");
  } catch (err) {
    setStatus(err.message || "Não foi possível carregar a lista de funcionários.", "erro");
  }
  atualizarPreview();
}

if (window.portalUsuarioValidado) iniciar();
window.addEventListener("portal:usuario-validado", iniciar, { once: true });
