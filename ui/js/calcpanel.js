/* Dulidan Web · calcpanel.js – Rechner-Panel oben rechts (Tastatur und Maus) */
import { $, h, toast, anim } from './util.js';
import { evaluate, format } from '../../shared/calc.js';
import { registerPanel, panelOpen } from './panels.js';
import { burst } from './fx.js';
import { sfx } from './sound.js';

let expr = '', last = null;
const hist = [];
const KEYS = [
  ['sin', 'fn'], ['cos', 'fn'], ['tan', 'fn'], ['^', 'op'], ['√', 'fn'],
  ['(', 'op'], [')', 'op'], ['%', 'op'], ['÷', 'op'], ['C', 'clr'],
  ['7'], ['8'], ['9'], ['×', 'op'], ['⌫', 'clr'],
  ['4'], ['5'], ['6'], ['−', 'op'], ['π', 'fn'],
  ['1'], ['2'], ['3'], ['+', 'op'], ['!', 'op'],
  ['±', 'op'], ['0'], [',', 'op'], ['=', 'eq']
];

function live() {
  const ex = $('#calcExpr'), out = $('#calcOut');
  ex.textContent = expr || '0';
  let v = null;
  try { v = expr ? evaluate(expr) : null; } catch {}
  out.classList.toggle('err', v === null && !!expr);
  out.textContent = v === null ? (expr ? '…' : '0') : format(v);
  ex.scrollLeft = ex.scrollWidth;
}
function press(k, el) {
  if (k === 'C') expr = '';
  else if (k === '⌫') expr = expr.slice(0, -1);
  else if (k === '=') return equals(el);
  else if (k === '±') expr = expr.startsWith('-(') && expr.endsWith(')') ? expr.slice(2, -1) : expr ? `-(${expr})` : '-';
  else if (k === 'sin' || k === 'cos' || k === 'tan' || k === '√') expr += k + '(';
  else expr += k;
  sfx('hover');
  live();
}
function equals(el) {
  let v;
  try { v = evaluate(expr); } catch { const o = $('#calcOut'); o.classList.remove('shake'); void o.offsetWidth; o.classList.add('shake'); sfx('close'); return; }
  hist.unshift([expr, v]); hist.length = Math.min(hist.length, 6);
  last = v; expr = String(+v.toPrecision(12)).replace('.', ',');
  const o = $('#calcOut');
  o.classList.remove('pop'); void o.offsetWidth; o.classList.add('pop');
  if (el) { const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, { n: 50, speed: 6, life: 45 }); }
  sfx('fire');
  live(); renderHist();
}
function renderHist() {
  $('#calcHist').replaceChildren(...hist.map(([e, v]) => h('li', { onclick: () => { expr = e; live(); } }, h('span', {}, e), h('b', {}, '= ' + format(v)))));
}
function build() {
  const pad = h('div', { class: 'calc-pad' }, ...KEYS.map(([k, kind], i) => {
    const b = h('button', { class: 'ck fx' + (kind ? ' ' + kind : ''), style: `--i:${i}`, onclick: e => press(k, e.currentTarget) }, k);
    return b;
  }));
  const copy = h('button', { class: 'icon-btn sm fx', 'data-cursor': 'KOPIEREN', onclick: () => {
    const t = $('#calcOut').textContent; if (t && t !== '…') { navigator.clipboard.writeText(t).catch(() => {}); toast('Ergebnis kopiert: ' + t); }
  } }, '⧉');
  $('#calcBody').replaceChildren(
    h('div', { class: 'calc-screen' }, h('div', { class: 'calc-expr mono', id: 'calcExpr' }), h('div', { class: 'calc-out', id: 'calcOut' }, '0'), copy),
    pad,
    h('ul', { class: 'calc-hist mono', id: 'calcHist' })
  );
  live(); renderHist();
}

export function initCalc() {
  registerPanel('calc', build);
  /* Tastatur, solange der Rechner offen ist */
  addEventListener('keydown', e => {
    if (panelOpen() !== 'calc' || e.ctrlKey || e.metaKey || e.altKey) return;
    const map = { Enter: '=', '=': '=', Backspace: '⌫', Delete: 'C', '*': '×', '/': '÷', '-': '−', x: '×', ',': ',', '.': ',' };
    const k = map[e.key] || (/^[\d+%^()!]$/.test(e.key) ? e.key : null);
    if (!k) return;
    e.preventDefault();
    const btn = [...document.querySelectorAll('#calc .ck')].find(b => b.textContent === k);
    if (btn && anim() !== 'aus') { btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit'); }
    press(k, btn);
  });
}
export const calcValue = () => last;
