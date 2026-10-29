/* One-time release introduction. Only runs after the existing authentication checks. */
import { db } from './portal-firestore.js';
import { doc, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const RELEASE = 'liquid-glass-20261022';
const root = new URL('../../', import.meta.url);
let dialog, slide = 0, busy = false, stylesReady;
const slides = [
  ['Seu portal evoluiu', 'Uma experiência mais leve para sua operação.', 'O PortalCiOP ganhou um visual de vidro, melhor organização e uma interface que se adapta ao computador, tablet e celular.', 'visual'],
  ['Tudo no seu lugar', 'Mais espaço para o que você usa todos os dias.', 'Na página inicial, os módulos estão organizados por categoria. A quantidade de módulos, usuários ativos e avisos fica entre a saudação e a data.', 'modules'],
  ['Seu portal, do seu jeito', 'As preferências estão em Ajustes.', 'Alterar senha é a primeira opção. Você também pode escolher o tema claro, escuro ou automático e personalizar até 6 acessos rápidos na página inicial. As opções administrativas aparecem conforme sua permissão.', 'settings'],
  ['Avisos ao seu alcance', 'Um toque no sino. Todos os seus avisos.', 'Na página inicial, o sininho abre seus avisos em uma lista. A campanha do mês fica na lateral, com sua própria cor e o laço de conscientização.', 'notices'],
  ['Pronto para começar', 'A mesma identidade em todo o portal.', 'As páginas seguem o novo padrão visual, com seu nome e cargo, melhor leitura e um carregamento com a marca PortalCiOP. Seus acessos continuam seguindo as permissões da sua conta.', 'ready']
];
const paths = {
  visual: '<rect x="3" y="4" width="34" height="25" rx="5"/><path d="M3 11h34M11 11v18M16 17h7M16 22h14"/>',
  modules: '<rect x="5" y="4" width="12" height="12" rx="3"/><rect x="23" y="4" width="12" height="12" rx="3"/><rect x="5" y="22" width="12" height="12" rx="3"/><rect x="23" y="22" width="12" height="12" rx="3"/>',
  settings: '<path d="M5 9h30M5 20h30M5 31h30"/><circle cx="14" cy="9" r="4"/><circle cx="27" cy="20" r="4"/><circle cx="17" cy="31" r="4"/>',
  notices: '<path d="M9 27h22l-3-5V15a8 8 0 0 0-16 0v7zM16 32a4 4 0 0 0 8 0"/><circle cx="30" cy="7" r="4"/>',
  ready: '<circle cx="20" cy="20" r="16"/><path d="m12 20 5 5 11-12"/>'
};
function email() { return String(window.portalUsuario?.email || '').trim().toLowerCase(); }
function key(account) { return 'ciop-novidades:' + RELEASE + ':' + encodeURIComponent(account); }
function cached(account) { try { return ['1', '2'].includes(localStorage.getItem(key(account))); } catch (_) { return false; } }
function remember(account, synced) { try { localStorage.setItem(key(account), synced ? '2' : '1'); } catch (_) {} }

// Presence records already allow each signed-in user to merge their own metadata.
// A transaction prevents two tabs/devices from claiming the same introduction.
// No profile, permission or presence status is changed by this marker.
async function claim(account, alreadySeen) {
  const reference = doc(db, 'presenca', account);
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(reference);
    const seen = snapshot.exists() && snapshot.data().portalIntroducoes?.[RELEASE] === true;
    if (!seen) transaction.set(reference, { portalIntroducoes: { [RELEASE]: true } }, { merge: true });
    return !seen && !alreadySeen;
  });
}
function ensure() {
  if (dialog) return;
  const css = document.createElement('link'); css.rel = 'stylesheet';
  css.href = new URL('assets/css/portal-novidades.css?v=20261022intro1', root).href;
  stylesReady = new Promise(resolve => { css.onload = resolve; css.onerror = resolve; });
  document.head.appendChild(css);
  dialog = document.createElement('dialog'); dialog.id = 'portalNovidades';
  dialog.setAttribute('aria-labelledby', 'portalNovidadesTitulo');
  dialog.setAttribute('aria-describedby', 'portalNovidadesTexto');
  dialog.innerHTML = '<header class="ciop-intro-header"><span>NOVIDADES DO PORTAL</span><button type="button" class="ciop-intro-skip">Fechar apresentação <span aria-hidden="true">×</span></button></header><div class="ciop-intro-art" aria-hidden="true"><img class="ciop-intro-logo-light" alt=""><img class="ciop-intro-logo-dark" alt=""><div class="ciop-intro-symbol"></div><div class="ciop-intro-orbit"></div></div><div class="ciop-intro-copy" aria-live="polite"><p class="ciop-intro-step"></p><h2 id="portalNovidadesTitulo"></h2><p class="ciop-intro-lead"></p><p id="portalNovidadesTexto"></p></div><footer><div class="ciop-intro-dots" role="group" aria-label="Etapas da apresentação"></div><div class="ciop-intro-actions"><button type="button" class="ciop-intro-back">Voltar</button><button type="button" class="ciop-intro-next">Continuar</button></div></footer>';
  dialog.querySelector('.ciop-intro-logo-light').src = new URL('assets/img/portal-ciop-claro.png?v=20261029logo1', root).href;
  dialog.querySelector('.ciop-intro-logo-dark').src = new URL('assets/img/portal-ciop-escuro.png?v=20261029logo1', root).href;
  slides.forEach((item, index) => {
    const button = document.createElement('button'); button.type = 'button';
    button.setAttribute('aria-label', 'Etapa ' + (index + 1) + ': ' + item[0]);
    button.onclick = () => render(index); dialog.querySelector('.ciop-intro-dots').appendChild(button);
  });
  dialog.querySelector('.ciop-intro-skip').onclick = () => dialog.close();
  dialog.querySelector('.ciop-intro-back').onclick = () => render(slide - 1);
  dialog.querySelector('.ciop-intro-next').onclick = () => { if (slide === slides.length - 1) dialog.close(); else render(slide + 1); };
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' && slide < slides.length - 1) { event.preventDefault(); render(slide + 1); }
    if (event.key === 'ArrowLeft' && slide > 0) { event.preventDefault(); render(slide - 1); }
  });
  document.body.appendChild(dialog);
}
function render(index) {
  slide = Math.max(0, Math.min(index, slides.length - 1));
  const data = slides[slide];
  dialog.querySelector('#portalNovidadesTitulo').textContent = data[0];
  dialog.querySelector('.ciop-intro-lead').textContent = data[1];
  dialog.querySelector('#portalNovidadesTexto').textContent = data[2];
  dialog.querySelector('.ciop-intro-step').textContent = String(slide + 1).padStart(2, '0') + ' / 05';
  dialog.querySelector('.ciop-intro-symbol').innerHTML = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + paths[data[3]] + '</svg>';
  dialog.dataset.slide = data[3];
  dialog.querySelector('.ciop-intro-back').disabled = slide === 0;
  dialog.querySelector('.ciop-intro-next').textContent = slide === slides.length - 1 ? 'Começar a usar' : 'Continuar →';
  dialog.querySelectorAll('.ciop-intro-dots button').forEach((button, i) => { button.setAttribute('aria-current', i === slide ? 'step' : 'false'); });
}
function eligible() {
  return window.portalUsuarioValidado && email() && new URLSearchParams(location.search).get('embed') !== 'native-app' && !document.documentElement.classList.contains('native-embedded') && !document.querySelector('#kiosk, .kiosk') && !/login\.html$/i.test(location.pathname) && window.top === window;
}
async function start() {
  if (busy || !eligible() || document.querySelector('dialog[open]')) return;
  busy = true;
  const account = email();
  try { if (localStorage.getItem(key(account)) === '2') { busy = false; return; } } catch (_) {}
  ensure();
  const seenHere = cached(account);
  let synced = false;
  let shouldShow = !seenHere;
  try { shouldShow = await claim(account, seenHere); synced = true; }
  catch (_) { /* Offline: retain a per-account browser marker and reconcile next visit. */ }
  if (email() !== account || !eligible()) { busy = false; return; }
  remember(account, synced);
  if (shouldShow) {
    await stylesReady;
    if (email() === account && eligible() && !document.querySelector('dialog[open]')) { render(0); dialog.showModal(); }
  }
  busy = false;
}
window.portalNovidades = { async abrir() { if (!eligible()) return; ensure(); await stylesReady; render(0); if (!dialog.open) dialog.showModal(); } };
window.addEventListener('portal:usuario-validado', () => window.setTimeout(start, 450));
if (window.portalUsuarioValidado) window.setTimeout(start, 450);
