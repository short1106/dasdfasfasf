/* Dulidan Web · boot.js – Terminal-Boot beim ersten Start, überspringbar mit Enter oder Esc */
import { $, h, sleep, store, anim } from './util.js';
import { sfx } from './sound.js';

const el = $('#boot'), lines = $('#bootLines'), bar = $('#bootBar'), pct = $('#bootPct');
const LINES = [
  ['hl', '> dulidan-web --boot --mode=episch'],
  ['', 'Lade Kreativ-Kern'],
  ['', 'Kompiliere Shader: partikel.vert · nebel.frag'],
  ['', 'Spanne WebContentsViews auf'],
  ['', 'Kalibriere Federn: stiffness 170 · damping 14'],
  ['', 'Lade Space Grotesk + JetBrains Mono'],
  ['', 'Verbinde Duisburg ⇄ Öhringen'],
  ['', 'Koffein-Level: kritisch, aber stabil'],
  ['', 'Lade Energiestrahl in die Suchleiste'],
  ['ac', 'Dream. Design. Develop. Dominate.']
];

export const booted = () => store.get('dw_booted', false);

export function runBoot() {
  return new Promise(async done => {
    let skip = false, finished = false;
    const finish = async () => {
      if (finished) return;
      finished = true;
      removeEventListener('keydown', key, true);
      store.set('dw_booted', true);
      sfx('boot');
      el.classList.add('ignite');
      done();
      await sleep(900);
      el.hidden = true; el.classList.remove('ignite', 'glitch');
    };
    const key = e => { if (['Enter', 'Escape', ' '].includes(e.key)) { e.preventDefault(); e.stopPropagation(); skip = true; finish(); } };
    addEventListener('keydown', key, true);
    $('#bootSkip').onclick = () => { skip = true; finish(); };
    lines.replaceChildren();
    bar.style.width = '0';
    el.hidden = false;
    $('#bootSkip').focus();
    const fast = anim() === 'aus';
    for (let i = 0; i < LINES.length && !skip; i++) {
      const [cls, txt] = LINES[i];
      const d = h('div', { class: cls + ' cur' });
      lines.appendChild(d);
      const prefix = i && i < LINES.length - 1 ? '  ' : '';
      for (let c = 0; c <= txt.length && !skip; c += fast ? txt.length : 2) {
        d.textContent = prefix + txt.slice(0, c);
        await sleep(fast ? 0 : 9);
      }
      d.textContent = prefix + txt;
      if (i && i < LINES.length - 1) {
        await sleep(fast ? 20 : 90 + Math.random() * 150);
        if (skip) break;
        d.appendChild(h('span', { class: 'ok' }, '  [OK]'));
      }
      d.classList.remove('cur');
      const p = Math.round(((i + 1) / LINES.length) * 100);
      bar.style.width = p + '%'; pct.textContent = p + '%';
      if (i === 4 || i === 8) { el.classList.remove('glitch'); void el.offsetWidth; el.classList.add('glitch'); }
      await sleep(fast ? 10 : 70);
    }
    if (!skip) await sleep(500);
    finish();
  });
}
