/* Dulidan Web · groups.js – Tab-Gruppen (Arbeit, Musik, Shopping …) in der Tableiste
   Jede Gruppe hat einen Chip vor ihrem ersten Tab. Klick auf den Chip klappt die Gruppe zu oder auf, ihre Tabs tragen die Gruppenfarbe.
   Mitglieder stehen immer zusammen. Im Orbit werden die Gruppen zu Sternbildern (overview.js, Stil „Sternbilder“).
   Aufbau: Vorlagen · Zustand · Leiste anordnen · Menü am Tab */
import { h, anim } from './util.js';
import { hold, release } from './view.js';
import { sfx } from './sound.js';
import { burst } from './fx.js';

export const PRESETS = [
  { name: 'Arbeit', color: '#7ab8ff', emoji: '💼' },
  { name: 'Musik', color: '#ff7ae6', emoji: '🎵' },
  { name: 'Shopping', color: '#ffc27a', emoji: '🛍' },
  { name: 'Social', color: '#7affc1', emoji: '💬' },
  { name: 'Lernen', color: '#c79bff', emoji: '📚' },
  { name: 'Spiele', color: '#ff6b81', emoji: '🎮' }
];
const SPARE = ['#7af3ff', '#ffe27a', '#ff9d6b', '#a8ff7a'];

/* name → { name, color, emoji, collapsed } */
export const groups = new Map();

export function ensureGroup(name, extra = {}) {
  name = String(name || '').trim().slice(0, 24);
  if (!name) return null;
  let g = groups.get(name);
  if (!g) {
    const p = PRESETS.find(x => x.name.toLowerCase() === name.toLowerCase());
    g = { name: p ? p.name : name, color: p ? p.color : SPARE[groups.size % SPARE.length], emoji: p ? p.emoji : '✦', collapsed: false };
    groups.set(g.name, g);
  }
  Object.assign(g, extra);
  return g;
}

/* Leiste neu ordnen: Gruppen zusammenhalten, Chips setzen, zugeklappte Tabs einziehen.
   tabs = Map id → Tab, onToggle(name) beim Klick auf einen Chip */
export function layoutGroups(wrap, tabs, onToggle) {
  const els = [...wrap.children].filter(e => e.classList.contains('tab') && !e.classList.contains('closing'));
  const seen = new Set();
  for (const el of els) {
    const t = tabs.get(Number(el.dataset.id)), g = t && t.group;
    if (!g || seen.has(g)) continue;
    seen.add(g);
    /* Alle Mitglieder direkt hinter den ersten ziehen */
    let last = el;
    for (const o of els) { if (o === el) continue; const ot = tabs.get(Number(o.dataset.id)); if (ot && ot.group === g) { last.after(o); last = o; } }
  }
  for (const name of [...groups.keys()]) if (!seen.has(name)) groups.delete(name);
  const keep = new Set();
  for (const el of [...wrap.children].filter(e => e.classList.contains('tab'))) {
    const t = tabs.get(Number(el.dataset.id)), g = t && t.group ? groups.get(t.group) : null;
    el.classList.toggle('grouped', !!g);
    el.classList.toggle('gcollapsed', !!(g && g.collapsed));
    if (g) el.style.setProperty('--gc', g.color); else el.style.removeProperty('--gc');
    if (!g || el.classList.contains('closing')) continue;
    const prev = el.previousElementSibling;
    const prevT = prev && prev.classList.contains('tab') ? tabs.get(Number(prev.dataset.id)) : null;
    if (prevT && prevT.group === g.name && !prev.classList.contains('closing')) continue;
    /* Erster Tab der Gruppe: Chip davor */
    let chip = prev && prev.classList.contains('tgrp') && prev.dataset.g === g.name ? prev : wrap.querySelector(`.tgrp[data-g="${CSS.escape(g.name)}"]`);
    if (!chip) {
      chip = h('button', { class: 'tgrp' + (anim() !== 'aus' ? ' enter' : ''), dataset: { g: g.name, cursor: 'GRUPPE' } });
      chip.addEventListener('pointerdown', e => e.stopPropagation());
      chip.addEventListener('click', e => { e.stopPropagation(); onToggle(chip.dataset.g); });
      chip.addEventListener('animationend', () => chip.classList.remove('enter'));
    }
    if (el.previousElementSibling !== chip) el.before(chip);
    const n = [...tabs.values()].filter(x => x.group === g.name).length;
    chip.style.setProperty('--gc', g.color);
    chip.classList.toggle('collapsed', !!g.collapsed);
    chip.title = g.name + (g.collapsed ? ' – aufklappen' : ' – zuklappen');
    chip.replaceChildren(h('i', {}, g.emoji), h('span', {}, g.name), h('b', {}, String(n)));
    keep.add(chip);
  }
  for (const c of [...wrap.querySelectorAll('.tgrp')]) if (!keep.has(c)) c.remove();
}

/* Kleiner Knall beim Zu-/Aufklappen, von der Chip-Mitte aus */
export function chipBurst(wrap, name) {
  const c = wrap.querySelector(`.tgrp[data-g="${CSS.escape(name)}"]`);
  if (!c || anim() === 'aus') return;
  const r = c.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, { n: 50, speed: 7, life: 40, size: 2 });
  c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
}

/* ===== Menü am Tab (Rechtsklick): Gruppe wählen, neue anlegen, entfernen ===== */
let menuEl = null;
export async function tabMenu(e, t, { assign, toggle, closeGroup }) {
  closeMenu();
  e.preventDefault();
  /* Das Menü fällt über die Seite: View dafür kurz verstecken */
  await hold('tgmenu');
  const items = [];
  const names = [...new Set([...groups.keys(), ...PRESETS.map(p => p.name)])];
  items.push(h('div', { class: 'tgm-h' }, t.group ? 'GRUPPE · ' + t.group.toUpperCase() : 'ZU GRUPPE HINZUFÜGEN'));
  for (const n of names) {
    const g = groups.get(n) || PRESETS.find(p => p.name === n);
    items.push(h('button', { class: 'tgm-i' + (t.group === n ? ' on' : ''), style: '--gc:' + g.color, onclick: () => { closeMenu(); assign(t, n); } },
      h('i', {}, g.emoji), h('span', {}, n), t.group === n ? h('b', {}, '✓') : null));
  }
  const inp = h('input', { class: 'tgm-in', placeholder: 'Neue Gruppe …', maxlength: '24', spellcheck: 'false' });
  inp.addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'Enter' && inp.value.trim()) { const v = inp.value.trim(); closeMenu(); assign(t, v); }
    else if (ev.key === 'Escape') closeMenu();
  });
  items.push(inp);
  if (t.group) {
    const g = t.group;
    items.push(h('div', { class: 'tgm-sep' }));
    items.push(h('button', { class: 'tgm-i', onclick: () => { closeMenu(); toggle(g); } }, h('i', {}, '◇'), h('span', {}, 'Gruppe zuklappen')));
    items.push(h('button', { class: 'tgm-i', onclick: () => { closeMenu(); assign(t, null); } }, h('i', {}, '↶'), h('span', {}, 'Aus Gruppe entfernen')));
    items.push(h('button', { class: 'tgm-i danger', onclick: () => { closeMenu(); closeGroup(g); } }, h('i', {}, '✕'), h('span', {}, 'Ganze Gruppe schließen')));
  }
  menuEl = h('div', { class: 'tg-menu', role: 'menu' }, ...items);
  document.body.append(menuEl);
  const r = t.el.getBoundingClientRect(), mw = 230;
  menuEl.style.left = Math.max(8, Math.min(innerWidth - mw - 8, r.left)) + 'px';
  menuEl.style.top = r.bottom + 6 + 'px';
  sfx('open');
  setTimeout(() => { addEventListener('pointerdown', outside, true); addEventListener('keydown', escKey, true); }, 0);
}
const outside = e => { if (menuEl && !menuEl.contains(e.target)) closeMenu(); };
const escKey = e => { if (e.key === 'Escape') { e.preventDefault(); closeMenu(); } };
export function closeMenu() {
  if (!menuEl) return;
  removeEventListener('pointerdown', outside, true); removeEventListener('keydown', escKey, true);
  const m = menuEl; menuEl = null;
  m.classList.add('out');
  setTimeout(() => m.remove(), 180);
  release('tgmenu');
}
export const menuOpen = () => !!menuEl;
