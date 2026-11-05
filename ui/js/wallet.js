/* Dulidan Web · wallet.js – Panel „Adressen & Karten“
   Zeigt nur Beschriftungen (Karten maskiert). Gespeichert wird ausschließlich über das Angebot in der Adressleiste. */
import { $, h, icon, api, toast } from './util.js';
import { burst } from './fx.js';
import { sfx } from './sound.js';
import { registerPanel } from './panels.js';

let armed = null;

async function build() {
  const [items, cfg] = await Promise.all([api.wallet.list(), api.wallet.config()]);
  const toggle = h('button', { class: 'toggle' + (cfg.offer ? ' on' : ''), onclick: async () => { const v = !toggle.classList.contains('on'); toggle.classList.toggle('on', v); await api.wallet.config({ offer: v }); } }, h('i'));
  const group = (type, title, ico, empty) => {
    const list = items.filter(i => i.type === type);
    return h('div', { class: 'set' }, h('div', { class: 'set-l' }, icon(ico), title),
      list.length ? h('ul', { class: 'pw-list' }, ...list.map((it, i) => row(it, i, ico))) : h('div', { class: 'set-d' }, empty));
  };
  $('#walletBody').replaceChildren(
    h('div', { class: 'set' },
      h('div', { class: 'row' }, h('span', {}, 'Speichern anbieten'), toggle),
      h('div', { class: 'set-d' }, 'Nach dem Absenden eines Formulars fragt Dulidan Web, ob es Adresse oder Karte speichern soll. Beim nächsten Mal erscheint am Feld ein Vorschlag – ausgefüllt wird erst nach deinem Klick, abgeschickt wird nie automatisch.')),
    group('address', 'Adressen', 'home', 'Noch keine Adressen gespeichert.'),
    group('card', 'Karten', 'card', 'Noch keine Karten gespeichert.'),
    h('div', { class: 'pw-note' }, icon('shield'), h('span', {}, 'Alles bleibt verschlüsselt auf diesem Gerät. Die Prüfnummer (CVC) wird nie gespeichert – die gibst du beim Bezahlen immer selbst ein.'))
  );
}
function row(it, i, ico) {
  const del = h('button', { class: 'icon-btn sm fx danger', 'data-cursor': 'LÖSCHEN', onclick: async ev => {
    const b = ev.currentTarget;
    if (armed !== it.id) { armed = it.id; document.querySelectorAll('#wallet .armed').forEach(x => x.classList.remove('armed')); b.classList.add('armed'); toast('Nochmal klicken zum Löschen'); return; }
    armed = null;
    const r = b.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, { n: 50, speed: 6, life: 50 }); sfx('shatter');
    await api.wallet.remove(it.id);
    build();
  } }, icon('trash'));
  return h('li', { class: 'pw-item', style: `--i:${i}` },
    h('span', { class: 'pw-fav' }, icon(ico)),
    h('div', { class: 'pw-main' }, h('div', { class: 'pw-host' }, it.title), h('div', { class: 'pw-user' }, it.sub)),
    h('div', { class: 'pw-acts' }, del));
}

export function initWallet() { registerPanel('wallet', build); }
