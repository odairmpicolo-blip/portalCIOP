/* Personal preferences never grant access: every shortcut is checked against the original module. */
(function () {
  var dialog, chooser, status, noticesDialog, initialized = false, memoryList = null, saving = false, lastEmail = '';
  var defaults = ['pages/monitoramento.html', 'pages/Folhadeservico1.html', 'pages/liberacao-lancamento.html', 'pages/criar-relatorio.html'];
  function account() { return String(window.portalUsuario?.email || '').trim().toLowerCase(); }
  function key() { return 'ciop-home-shortcuts-v1:' + encodeURIComponent(account()); }
  function sanitize(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (v) {
      return typeof v === 'string' && v.length <= 500 && /^(pages\/|https?:\/\/)/i.test(v);
    }).slice(0, 6);
  }
  function localSelected() {
    try {
      if (!account()) return null;
      var value = JSON.parse(localStorage.getItem(key()));
      return Array.isArray(value) ? sanitize(value) : null;
    } catch (_) { return null; }
  }
  function persistLocal(values) {
    if (!account()) return;
    localStorage.setItem(key(), JSON.stringify(values));
    memoryList = values;
  }
  function firestoreApi() {
    return Promise.all([
      import('./portal-firestore.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
    ]).then(function (mods) {
      return { db: mods[0].db, doc: mods[1].doc, getDoc: mods[1].getDoc, setDoc: mods[1].setDoc, serverTimestamp: mods[1].serverTimestamp };
    });
  }
  function lerNuvem() {
    var email = account();
    if (!email) return Promise.resolve(null);
    return firestoreApi().then(function (api) {
      return api.getDoc(api.doc(api.db, 'preferenciasUsuario', email)).then(function (pref) {
        if (pref.exists() && Array.isArray(pref.data().acessosRapidos)) return sanitize(pref.data().acessosRapidos);
        return null;
      }).catch(function () { return null; }).then(function (fromPref) {
        if (fromPref !== null) return fromPref;
        return api.getDoc(api.doc(api.db, 'presenca', email)).then(function (pres) {
          if (pres.exists() && Array.isArray(pres.data().acessosRapidos)) return sanitize(pres.data().acessosRapidos);
          return null;
        });
      });
    });
  }
  function salvarNuvem(values) {
    var email = account();
    if (!email) return Promise.reject(new Error('sem conta'));
    return firestoreApi().then(function (api) {
      var payload = { acessosRapidos: values, acessosRapidosEm: api.serverTimestamp() };
      return api.setDoc(api.doc(api.db, 'preferenciasUsuario', email), payload, { merge: true }).then(function () {
        return api.setDoc(api.doc(api.db, 'presenca', email), payload, { merge: true }).catch(function () {});
      }).catch(function () {
        return api.setDoc(api.doc(api.db, 'presenca', email), payload, { merge: true });
      });
    });
  }
  function carregarNuvem() {
    if (!account()) return;
    if (account() !== lastEmail) { memoryList = null; lastEmail = account(); }
    lerNuvem().then(function (cloud) {
      if (cloud !== null) {
        persistLocal(cloud);
        refresh();
        return;
      }
      var local = localSelected();
      if (local && local.length) return salvarNuvem(local);
    }).catch(function (error) {
      console.warn('[portal-home-settings] nuvem', error);
    });
  }
  function modules() {
    var result = new Map();
    document.querySelectorAll('.card-section a.card').forEach(function (card) {
      if (card.hidden || card.style.display === 'none') return;
      if (card.matches('[data-perfis], [data-usuarios], [data-modulo]') && !card.classList.contains('portal-card-visivel')) return;
      var href = card.getAttribute('href');
      if (href && !result.has(href)) result.set(href, card);
    });
    return result;
  }
  function selected() {
    if (Array.isArray(memoryList)) return memoryList;
    var local = localSelected();
    if (Array.isArray(local)) return local;
    return defaults;
  }
  function refresh() {
    var quick = document.getElementById('homeQuick');
    if (!quick) return;
    refreshAdmin();
    var allowed = modules();
    quick.replaceChildren();
    selected().forEach(function (href) {
      var source = allowed.get(href);
      if (!source) return;
      var link = document.createElement('a');
      link.href = source.getAttribute('href');
      if (source.target) { link.target = source.target; link.rel = 'noopener noreferrer'; }
      var icon = source.querySelector('.card-figure svg');
      if (icon) link.appendChild(icon.cloneNode(true));
      var title = document.createElement('strong');
      var titleText = source.querySelector('.card-title')?.textContent.trim() || 'Abrir módulo';
      title.textContent = titleText;
      var description = document.createElement('span');
      var SHORT = {
        'ICV': 'Cumprimento de viagem',
        'Incidentes CAD': 'Relatório CAD',
        'Monitoramento': 'Operação ao vivo',
        'Monitoramento Ao Vivo': 'Operação ao vivo',
        'Lançar serviço': 'Novo lançamento',
        'Lançar Serviço': 'Novo lançamento',
        'Liberação': 'Fila de liberações',
        'Criar relatório': 'Novo relatório',
        'Criar Relatório': 'Novo relatório',
        'IPV': 'Pontualidade das viagens',
        'Autuações': 'Consulta de autuações',
        'Dashboard de Serviço': 'Indicadores da folha',
        'pages/criar-relatorio.html': 'Novo relatório',
        'pages/criar-relatoriov2.html': 'Novo relatório'
      };
      var raw = source.querySelector('.card-desc')?.textContent.replace(/\s+/g, ' ').trim() || 'Acessar módulo';
      var hrefKey = (source.getAttribute('href') || '').replace(/^\.\.\//, '');
      description.textContent = SHORT[titleText] || SHORT[hrefKey] || (raw.length > 42 ? raw.slice(0, raw.lastIndexOf(' ', 40) || 40) : raw);
      link.append(title, description);
      quick.appendChild(link);
    });
    if (!quick.children.length && account()) {
      var empty = document.createElement('button');
      empty.type = 'button'; empty.className = 'home-quick-empty';
      empty.textContent = 'Escolher meus acessos rápidos'; empty.addEventListener('click', open);
      quick.appendChild(empty);
    }
  }
  function refreshAdmin() {
    var section = dialog?.querySelector('.home-settings-admin');
    if (!section) return;
    section.hidden = !Array.from(section.querySelectorAll('.home-settings-action')).some(function (action) {
      return !action.hidden && action.classList.contains('portal-card-visivel');
    });
  }
  function renderNotices() {
    if (!noticesDialog) return;
    var list = noticesDialog.querySelector('.home-notices-list'); list.replaceChildren();
    var items = document.querySelectorAll('#avisosLista .notice-item');
    noticesDialog.querySelector('.home-notices-count').textContent = items.length === 1 ? '1 aviso disponível' : items.length + ' avisos disponíveis';
    items.forEach(function (source) {
      var item = document.createElement('article'); item.className = 'home-notice-list-item'; item.setAttribute('role', 'listitem');
      var content = source.querySelector('.notice-item-body');
      if (content) item.appendChild(content.cloneNode(true));
      else item.textContent = source.textContent;
      item.querySelectorAll('[id]').forEach(function (element) { element.removeAttribute('id'); });
      list.appendChild(item);
    });
    if (!items.length) {
      var empty = document.createElement('p'); empty.className = 'home-notices-empty';
      empty.textContent = document.querySelector('#avisosLista .notice-empty')?.textContent || 'Nenhum aviso no momento.';
      list.appendChild(empty);
    }
  }
  function openNotices() {
    if (!noticesDialog || noticesDialog.open) return;
    renderNotices(); noticesDialog.showModal();
  }
  function renderChooser() {
    chooser.replaceChildren();
    var chosen = new Set(selected());
    modules().forEach(function (source, href) {
      var label = document.createElement('label'); label.className = 'home-settings-module';
      var input = document.createElement('input'); input.type = 'checkbox'; input.value = href; input.checked = chosen.has(href);
      var text = document.createElement('span'); text.textContent = source.querySelector('.card-title')?.textContent.trim() || 'Módulo';
      label.append(input, text); chooser.appendChild(label);
    });
    chooser.onchange = function (event) {
      if (chooser.querySelectorAll('input:checked').length > 6) { event.target.checked = false; status.textContent = 'Escolha até 6 acessos rápidos.'; }
      else status.textContent = '';
    };
  }
  function avisarSalvo(texto) {
    var toast = document.getElementById('homeSettingsToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'homeSettingsToast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = texto;
    toast.classList.remove('is-visible');
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    clearTimeout(avisarSalvo.timer);
    avisarSalvo.timer = setTimeout(function () { toast.classList.remove('is-visible'); }, 3500);
  }
  function open() {
    if (!dialog || dialog.open) return;
    renderChooser(); status.textContent = '';
    document.getElementById('sidebar')?.classList.remove('active');
    document.getElementById('overlay')?.classList.remove('active');
    dialog.showModal();
  }
  function init() {
    if (initialized) return;
    initialized = true;
    dialog = document.createElement('dialog'); dialog.id = 'homeSettingsDialog';
    dialog.setAttribute('aria-labelledby', 'homeSettingsTitle');
    dialog.innerHTML = '<div class="home-settings-top"><div><p class="home-settings-eyebrow">CONFIGURAÇÕES</p><h2 id="homeSettingsTitle">Ajustes</h2></div><button type="button" class="home-settings-close" aria-label="Fechar ajustes">×</button></div><section class="home-settings-section home-settings-security"><details id="homeSettingsPassword"><summary><span class="home-settings-lock" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg></span><span><strong>Alterar senha</strong><small>Atualize sua senha de acesso.</small></span></summary><div id="homeSettingsPasswordSlot"></div></details></section><section class="home-settings-section home-settings-admin" hidden><h3>Administração</h3><div class="home-settings-admin-actions"></div></section><section class="home-settings-section"><h3>Aparência</h3><p>Escolha o tema que combina com você.</p><div id="homeSettingsTheme"></div></section><section class="home-settings-section"><h3>Acessos rápidos</h3><p>Escolha até 6 módulos para ter sempre à mão. Eles ficam na sua conta e abrem em qualquer computador ou celular.</p><div id="homeSettingsModules"></div></section><p id="homeSettingsStatus" role="status" aria-live="polite"></p><div class="home-settings-footer"><small>Salvos na sua conta, em qualquer lugar.</small><button type="button" class="home-settings-save">Salvar acessos</button></div>';
    var novidades = document.createElement('section'); novidades.className = 'home-settings-section';
    novidades.innerHTML = '<h3>Sobre o portal</h3><button type="button" class="home-settings-action">Rever novidades do portal</button>';
    novidades.querySelector('button').onclick = function () { dialog.close(); window.portalNovidades?.abrir(); };
    dialog.querySelector('.home-settings-footer').before(novidades);
    var version = document.createElement('p'); version.className = 'home-settings-version';
    var verMeta = document.querySelector('meta[name="portal-ciop-version"]');
    var verNum = String((verMeta && verMeta.getAttribute('content')) || '').trim();
    version.textContent = /^\d+\.\d+\.\d+$/.test(verNum) ? ('Portal CIOP · v' + verNum) : '';
    if (!version.textContent) version.hidden = true;
    dialog.appendChild(version);
    document.body.appendChild(dialog);
    chooser = dialog.querySelector('#homeSettingsModules'); status = dialog.querySelector('#homeSettingsStatus');
    var passwordSection = dialog.querySelector('#homeSettingsPassword');
    var passwordPanel = document.getElementById('senhaPanel');
    if (passwordPanel) dialog.querySelector('#homeSettingsPasswordSlot').appendChild(passwordPanel);
    passwordSection.addEventListener('toggle', function () { window.toggleSenhaPanel?.(passwordSection.open); });
    passwordPanel?.querySelector('.secondary')?.addEventListener('click', function () { passwordSection.open = false; });
    dialog.addEventListener('close', function () { passwordSection.open = false; window.toggleSenhaPanel?.(false); });
    var adminActions = dialog.querySelector('.home-settings-admin-actions');
    [document.getElementById('sidebarAdicionarAviso'), document.querySelector('#homeOutros a[data-modulo="gerenciar-usuarios"]')].forEach(function (action) {
      if (!action) return;
      action.classList.add('home-settings-action'); adminActions.appendChild(action);
      action.addEventListener('click', function () { dialog.close(); }, { capture: true });
      new MutationObserver(refreshAdmin).observe(action, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
    });
    document.querySelector('.home-nav a[data-home-nav="admin"]')?.remove();
    noticesDialog = document.createElement('dialog'); noticesDialog.id = 'homeNoticesDialog';
    noticesDialog.setAttribute('aria-labelledby', 'homeNoticesTitle');
    noticesDialog.innerHTML = '<div class="home-settings-top"><div><p class="home-settings-eyebrow">CENTRAL DE AVISOS</p><h2 id="homeNoticesTitle">Seus avisos</h2><p class="home-notices-count"></p></div><button type="button" class="home-settings-close" aria-label="Fechar avisos">×</button></div><div class="home-notices-list" role="list"></div>';
    document.body.appendChild(noticesDialog);
    noticesDialog.querySelector('.home-settings-close').addEventListener('click', function () { noticesDialog.close(); });
    var sourceNotices = document.getElementById('avisosLista');
    if (sourceNotices) new MutationObserver(function () { if (noticesDialog.open) renderNotices(); }).observe(sourceNotices, { childList: true, subtree: true, characterData: true });
    var picker = document.querySelector('.dk-theme-picker');
    if (picker) {
      dialog.querySelector('#homeSettingsTheme').appendChild(picker);
      picker.querySelectorAll('.dk-theme-opt').forEach(function (button) {
        var text = document.createElement('span');
        text.textContent = { light: 'Claro', dark: 'Escuro', auto: 'Automático' }[button.dataset.dkPref];
        button.appendChild(text);
      });
    }
    dialog.querySelector('.home-settings-close').addEventListener('click', function () { dialog.close(); });
    dialog.querySelector('.home-settings-save').addEventListener('click', function () {
      if (!account()) { status.textContent = 'Aguarde a identificação da sua conta para salvar.'; return; }
      if (saving) return;
      var allowed = modules();
      var values = Array.from(chooser.querySelectorAll('input:checked')).map(function (input) { return input.value; }).filter(function (href) { return allowed.has(href); }).slice(0, 6);
      var buttonSave = dialog.querySelector('.home-settings-save');
      try { persistLocal(values); } catch (_) {
        status.textContent = 'Não foi possível salvar neste navegador. Verifique se o armazenamento está permitido.';
        return;
      }
      refresh();
      saving = true;
      buttonSave.disabled = true;
      status.textContent = 'Salvando na sua conta...';
      salvarNuvem(values).then(function () {
        status.textContent = '';
        dialog.close();
        avisarSalvo('Acessos rápidos salvos na sua conta. Disponíveis em qualquer lugar.');
      }).catch(function () {
        status.textContent = 'Salvo neste aparelho. Não deu para sincronizar na nuvem agora.';
        avisarSalvo('Salvo neste aparelho. Tente de novo para usar em outro local.');
      }).then(function () {
        saving = false;
        buttonSave.disabled = false;
      });
    });
    var button = document.createElement('button'); button.type = 'button'; button.className = 'home-nav-btn'; button.setAttribute('aria-haspopup', 'dialog');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-.6 2.3-2 .9-2-.7L2.5 9l1.6 1.7v2.6L2.5 15l1.9 3.5 2-.7 2 .9L9 21h6l.6-2.3 2-.9 2 .7 1.9-3.5-1.6-1.7v-2.6L21.5 9l-1.9-3.5-2 .7-2-.9L15 3Z"/><circle cx="12" cy="12" r="3"/></svg>Ajustes';
    button.addEventListener('click', open); document.querySelector('.home-nav')?.appendChild(button);
    var personalize = document.createElement('button'); personalize.type = 'button'; personalize.className = 'home-personalize'; personalize.textContent = 'Personalizar'; personalize.addEventListener('click', open);
    document.querySelector('.home-quick-head')?.appendChild(personalize);
    refresh();
    carregarNuvem();
    window.addEventListener('portal:usuario-validado', carregarNuvem);
  }
  window.portalHomeSettings = { init: init, refresh: refresh, openNotices: openNotices };
})();
