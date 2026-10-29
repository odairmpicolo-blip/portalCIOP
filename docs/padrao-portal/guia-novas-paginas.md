# Guia: novas páginas

Passo a passo para um módulo no **portal clássico**. Não vale para `portal-app/` nem para kiosk TV.

## 1. Arquivos compartilhados (obrigatório)

| Peça | Caminho |
| --- | --- |
| Boot + tema | `assets/js/theme-toggle.js?v=20261029fav2` no **`<head>`** |
| Tokens (opcional explícito) | `assets/css/portal-tokens.css?v=20261026liquid1` — o DS também injeta |
| Marca | `img.portal-brand-art` |
| Auth | `assets/js/auth.js` (sessão, overlay, permissões, voltar Portal) |
| Rodapé | `assets/js/portal-footer.js` |
| Dados AWS (se precisar) | `portal-aws-config.js` + `awsFetch` |

Não copiar `portal-home-2026.css`. Não marcar `portal-home-2026` no `html`.

## 2. Integração na home e permissões

Em `index.html` (e hub `pages/relatorios.html` se couber):

```html
<a href="pages/meu-modulo.html" class="card" data-modulo="meu-modulo"
   data-perfis="Administrador,Supervisor,Gerência,Gerencia,Analista">
```

`auth.js` só mostra o card com `.portal-card-visivel`. Módulo restrito a e-mails: `data-usuarios` + `data-somente-usuarios="true"` (padrão já usado em evidências). Cadastrar o id em `admin-usuarios.html` se o módulo entrar na lista de acessos.

## 3. Tema e tokens

Boot inline + `theme-toggle.js` no head. Cores só `var(--portal-*)`. Gráfico: ouvir `dk-theme-change`. Adiantado/atrasado: `--portal-op-early` / `--portal-op-late`.

## 4. Estados obrigatórios

Carregando, sucesso com período/fonte, vazio (`—` / mensagem), erro em português. Não enviar, apagar nem gravar no exemplo.

## 5. HTML mínimo (compatível)

Colocar em `pages/meu-modulo.html`. Caminhos `../assets/…`.

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <script>
  (function () {
    try {
      var stored = localStorage.getItem("dk-theme");
      if (stored !== "dark" && stored !== "light" && stored !== "auto") stored = "auto";
      var dark = stored === "dark";
      if (stored === "auto") {
        var p = {};
        new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).forEach(function (x) { if (x.type !== "literal") p[x.type] = +x.value; });
        var doy = Math.floor((Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(p.year, 0, 0)) / 864e5);
        var k = Math.cos((doy - 172) / 365 * 2 * Math.PI);
        var hrs = p.hour + p.minute / 60;
        dark = hrs < 6.15 + 0.8 * k || hrs >= 18.35 - 0.55 * k;
      }
      document.documentElement.classList.add(dark ? "dk-dark" : "dk-light");
      document.documentElement.setAttribute("data-dk-pref", stored);
      document.documentElement.setAttribute("data-dk-resolved", dark ? "dark" : "light");
    } catch (e) {}
  })();
  </script>
  <script>document.documentElement.classList.add("portal-auth-pending");</script>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/png" href="../assets/img/portal-favicon.png?v=20261029fav2">
  <title>Meu módulo - Portal CIOP</title>
  <script src="../assets/js/theme-toggle.js?v=20261029fav2"></script>
</head>
<body>
  <header class="header">
    <a href="../index.html" class="btn-portal">Portal</a>
    <div class="title-wrap">
      <h1>Meu módulo</h1>
      <p class="subtitle">Descrição em uma linha</p>
    </div>
    <div class="header-actions">
      <img class="portal-brand-art" src="../assets/img/portal-ciop-claro.png?v=20261029logo1"
           width="1024" height="349" alt="Portal CIOP TCGL Operações">
    </div>
  </header>
  <main class="container">
    <section class="filters" aria-label="Filtros">
      <label class="campo">De
        <input type="date" id="fDe">
      </label>
      <label class="campo">Até
        <input type="date" id="fAte">
      </label>
      <button type="button" class="btn-primary" id="btnBuscar">Atualizar</button>
    </section>
    <p id="status">Carregando período…</p>
    <div class="kpis"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Linha</th><th class="num">Viagens</th></tr></thead>
        <tbody id="tbody"><tr><td colspan="2">Sem dados neste recorte.</td></tr></tbody>
      </table>
    </div>
  </main>
  <script src="../assets/js/auth.js"></script>
  <script src="../assets/js/portal-footer.js" defer></script>
</body>
</html>
```

`theme-toggle.js` injeta o design system. Não redefinir `.btn-portal` na página.

## 6. Validar sem dados reais

Servidor local (`python3 -m http.server`). Usuário de **teste**. Não clicar em enviar relatório, não gravar Firestore de produção, não publicar. Dados de demo: linha 999, prefixo 0000. Catálogo: [catalogo.html](catalogo.html).

## 7. Checklist

- [ ] `lang="pt-BR"`, viewport, título do módulo
- [ ] Boot de tema no head + `theme-toggle.js`
- [ ] `portal-brand-art` + botão Portal
- [ ] Tokens; Adiantado vermelho / Atrasado âmbar se a métrica existir
- [ ] Filtros min 160 px; tabela no wrap; KPI nowrap
- [ ] Carregando / vazio / erro
- [ ] `data-modulo` / perfis se for card da home
- [ ] Claro, escuro, auto; 390, 768, 1366, 1920
- [ ] Reduced motion; foco visível
- [ ] Sem POST de verdade no caminho de demo
- [ ] Documentação atualizada se criou componente compartilhado
