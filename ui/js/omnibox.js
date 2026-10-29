/* Dulidan Web · omnibox.js
   Aufbau: Eingabe auflösen (URL / Suche / Shortcut) · Energiestrahl · Live-Vorschläge mit Stagger und Feder-Highlight */
import { $, h, icon, api, anim, amp, Highlighter, hostOf } from './util.js';
import { settings, ENGINES, SHORTCUTS } from './settings.js';
import { searchLocal } from './data.js';
import { tryCalc, format } from '../../shared/calc.js';
import { sfx } from './sound.js';

const fill = (tpl, q) => tpl.replace('%s', encodeURIComponent(q));
const HOSTLIKE = /^(?:[\w-]+\.)+[a-z][a-z0-9-]{1,62}(?::\d{1,5})?(?:[/?#].*)?$/i;
const LOCAL = /^(?:localhost|\d{1,3}(?:\.\d{1,3}){3}|\[[\da-f:]+\])(?::\d{1,5})?(?:[/?#].*)?$/i;

export const engineName = () => ENGINES[settings.engine].name;

export function splitShortcut(text) {
  const m = /^(yt|gh|wiki|maps|mc)\s(.*)$/is.exec(text);
  return m ? { key: m[1].toLowerCase(), rest: m[2] } : null;
}

/* Text → Ziel. sc = bereits aktiver Shortcut-Chip */
export function resolve(raw, sc = null) {
  const q = raw.trim();
  if (sc) {
    const s = SHORTCUTS[sc];
    return q ? { url: fill(s.url, q), kind: 'shortcut', sc, label: `${s.name}: ${q}` } : { url: s.home, kind: 'shortcut', sc, label: s.name };
  }
  if (!q) return null;
  const s = splitShortcut(q);
  if (s) return resolve(s.rest, s.key);
  if (/^(https?|file|dulidan):\/\//i.test(q)) return { url: q, kind: 'url', label: q };
  if (!/\s/.test(q)) {
    if (LOCAL.test(q)) return { url: 'http://' + q, kind: 'url', label: q };
    if (HOSTLIKE.test(q) && !/^\d+(\.\d+)+$/.test(q)) return { url: 'https://' + q, kind: 'url', label: q };
  }
  return { url: fill(ENGINES[settings.engine].url, q), kind: 'search', label: q };
}

/* ===== Energiestrahl: Winkel rast beim Tippen um die Leiste ===== */
export class Beam {
  constructor(el) { this.el = el; this.a = Math.random() * 360; this.v = 0; this.on = false; this.run = false; this.typeT = 0; this.au = 0; }
  audio(level) { this.au = level; if (level > 0.02) this.loop(); }
  focus(v) { this.on = v; if (v) { this.v += 300; this.loop(); } }
  kick() {
    this.v = Math.min(this.v + 420 * Math.max(0.4, amp()), 2600);
    this.typeT = performance.now();
    this.el.classList.add('typing');
    this.loop();
  }
  loop() {
    if (this.run || anim() === 'aus') return;
    this.run = true;
    let last = performance.now();
    const f = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.v *= Math.pow(0.12, dt);
      this.a = (this.a + (this.on ? 70 : 0) * dt + this.v * dt + this.au * 1100 * dt) % 360;
      this.el.style.setProperty('--beam', this.a + 'deg');
      if (now - this.typeT > 450) this.el.classList.remove('typing');
      if (this.on || this.v > 2 || this.au > 0.01) requestAnimationFrame(f); else this.run = false;
    };
    requestAnimationFrame(f);
  }
}

/* ===== Live-Vorschläge ===== */
const box = $('#suggest'), list = $('#sgList'), hl = new Highlighter($('#sgHl'));
let owner = null;

function mark(text, q) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return [text];
  return [text.slice(0, i), h('mark', {}, text.slice(i, i + q.length)), text.slice(i + q.length)];
}

export class Suggest {
  /* opts: input, form, chip, onGo(target, from), onOpen(), onClose(), offset */
  constructor(opts) {
    Object.assign(this, opts);
    this.items = []; this.sel = -1; this.sc = null; this.open = false; this.seq = 0; this.prevKeys = new Set();
    this.beam = new Beam(this.form);
    const inp = this.input;
    inp.addEventListener('focus', () => { this.form.classList.add('focus'); this.beam.focus(true); inp.select(); });
    inp.addEventListener('blur', () => { this.form.classList.remove('focus'); this.beam.focus(false); setTimeout(() => { if (document.activeElement !== inp) this.close(); }, 120); });
    inp.addEventListener('input', () => {
      this.beam.kick();
      const s = !this.sc && splitShortcut(inp.value);
      if (s) { this.setChip(s.key); inp.value = s.rest; }
      this.update();
    });
    inp.addEventListener('keydown', e => this.key(e));
    this.form.addEventListener('submit', e => { e.preventDefault(); this.go(this.sel >= 0 ? this.items[this.sel] : null); });
  }

  setChip(key) {
    this.sc = key;
    const c = this.chip;
    if (!key) { c.hidden = true; return; }
    const s = SHORTCUTS[key];
    c.replaceChildren(icon(s.icon), s.name.toUpperCase());
    c.hidden = false;
    c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
    sfx('tab');
  }

  key(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!this.open) { this.update(); return; }
      e.preventDefault();
      const n = this.items.length; if (!n) return;
      this.select(e.key === 'ArrowDown' ? (this.sel + 1) % n : (this.sel - 1 + n) % n);
    } else if (e.key === 'Escape') {
      if (this.open) { e.preventDefault(); this.close(); } else if (this.onEscape) this.onEscape();
    } else if (e.key === 'Backspace' && this.sc && !this.input.value) {
      e.preventDefault(); this.setChip(null); this.update();
    } else if (e.key === 'Tab' && this.open && this.sel >= 0 && this.items[this.sel].fill) {
      e.preventDefault(); this.input.value = this.items[this.sel].fill; this.update();
    }
  }

  select(i, instant = false) {
    this.sel = i;
    const els = [...list.children].filter(x => x.classList.contains('sg-item'));
    els.forEach((el, k) => el.classList.toggle('sel', k === i));
    hl.to(els[i], instant);
    if (i >= 0) sfx('hover');
  }

  async update() {
    const q = this.input.value, seq = ++this.seq;
    const items = this.local(q);
    this.render(items);
    const remoteQ = q.trim();
    if (!remoteQ || (!this.sc && resolve(q)?.kind === 'url')) return;
    await new Promise(r => setTimeout(r, 90));
    if (seq !== this.seq) return;
    const sug = await api.suggest(remoteQ).catch(() => []);
    if (seq !== this.seq || !this.open && !items.length) return;
    const have = new Set(items.map(i => i.text.toLowerCase()));
    const extra = sug.filter(s => !have.has(s.toLowerCase()) && s.toLowerCase() !== remoteQ.toLowerCase()).slice(0, 8 - items.length).map(s => {
      const t = resolve(s, this.sc);
      return { key: 'r:' + s, icon: this.sc ? SHORTCUTS[this.sc].icon : 'search', text: s, hint: this.sc ? SHORTCUTS[this.sc].name : '', target: t, fill: s, q: remoteQ };
    });
    this.render(items.concat(extra));
  }

  local(q) {
    const out = [], t = resolve(q, this.sc);
    if (!t) return out;
    /* Rechnung? Ergebnis sofort als erster Vorschlag – Enter kopiert es */
    const v = this.sc ? null : tryCalc(q);
    if (v !== null) out.push({ key: 'calc', icon: 'calc', text: `= ${format(v)}`, hint: 'Rechner · Enter kopiert', target: { kind: 'calc', value: format(v) } });
    if (t.kind === 'shortcut') out.push({ key: 'p', icon: SHORTCUTS[t.sc].icon, text: q.trim() ? `${q.trim()}` : `${SHORTCUTS[t.sc].name} öffnen`, hint: q.trim() ? `${SHORTCUTS[t.sc].name} durchsuchen` : 'Öffnen', target: t });
    else if (t.kind === 'url') out.push({ key: 'p', icon: 'globe', text: q.trim(), hint: 'Öffnen', target: t });
    else out.push({ key: 'p', icon: 'search', text: q.trim(), hint: `${engineName()} · Suche`, target: t, q: q.trim() });
    if (!this.sc) for (const e of searchLocal(q.trim(), 4)) {
      out.push({ key: 'l:' + e.url, icon: e.src === 'bookmark' ? 'star' : 'history', text: e.title || hostOf(e.url), sub: e.url, hint: e.src === 'bookmark' ? 'Lesezeichen' : 'Verlauf', target: { url: e.url, kind: 'url' }, q: q.trim() });
    }
    return out;
  }

  render(items) {
    this.items = items;
    if (!items.length) { this.close(); return; }
    const keep = this.prevKeys;
    let n = 0;
    const nodes = items.map((it, i) => {
      const li = h('li', { class: 'sg-item', role: 'option', dataset: { i } },
        icon(it.icon), h('span', { class: 't' }, ...mark(it.text, it.q || this.input.value.trim())), it.hint ? h('span', { class: 'h' }, it.hint) : null);
      if (keep.has(it.key) && it.key !== 'p') li.style.animation = 'none'; else li.style.setProperty('--i', n++);
      li.addEventListener('pointerdown', e => { e.preventDefault(); this.go(it); });
      li.addEventListener('pointerenter', () => this.select(i));
      return li;
    });
    this.prevKeys = new Set(items.map(i => i.key));
    list.replaceChildren(...nodes);
    if (!this.open || owner !== this) this.show();
    this.position();
    this.select(Math.min(Math.max(this.sel, 0), items.length - 1), true);
  }

  position() {
    const r = this.form.getBoundingClientRect(), off = this.offset ?? 8;
    Object.assign(box.style, { left: r.left - 4 + 'px', top: r.bottom + off + 'px', width: r.width + 8 + 'px' });
  }

  show() {
    if (owner && owner !== this) owner.close();
    owner = this; this.open = true; this.sel = 0; hl.snap = true;
    box.hidden = false;
    box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
    this.onOpen && this.onOpen();
  }

  close() {
    if (!this.open) return;
    this.open = false; this.sel = -1; this.prevKeys = new Set(); this.seq++;
    if (owner === this) { owner = null; box.hidden = true; }
    this.onClose && this.onClose();
  }

  go(item) {
    const target = item ? item.target : resolve(this.input.value, this.sc);
    if (!target) return;
    this.close();
    this.onGo(target, this);
  }

  reset(text = '') { this.input.value = text; this.setChip(null); }
}
