/* Dulidan Web · audio.js – Pegel aus den Tabs glätten, Kicks erkennen, CSS-Variablen --au/--bass setzen */
import { anim } from './util.js';

export const audio = { bass: 0, mid: 0, high: 0, level: 0, tabId: null, active: false };
const raw = new Map();           // tabId -> { b, m, h, l, t }
const subs = new Set(), kicks = new Set();
let run = false, avgBass = 0, lastKick = 0;

export const onAudio = f => subs.add(f);
export const onKick = f => kicks.add(f);

export function feed(e) {
  raw.set(e.id, { b: e.b, m: e.m, h: e.h, l: e.l, t: performance.now() });
  if (!run) { run = true; requestAnimationFrame(loop); }
}
export function forgetTab(id) { raw.delete(id); }

/* Schnell hoch, langsam runter – fühlt sich wie ein VU-Meter an */
const follow = (v, t) => v + (t - v) * (t > v ? 0.55 : 0.12);

function loop(now) {
  let top = null;
  for (const [id, r] of raw) {
    if (now - r.t > 400) { r.b = r.m = r.h = r.l = 0; }
    if (!top || r.l > top.l) top = { id, ...r };
  }
  const off = anim() === 'aus';
  const t = top && !off ? top : { b: 0, m: 0, h: 0, l: 0, id: null };
  audio.bass = follow(audio.bass, t.b); audio.mid = follow(audio.mid, t.m);
  audio.high = follow(audio.high, t.h); audio.level = follow(audio.level, t.l);
  audio.tabId = t.l > 0.02 ? t.id : audio.level > 0.02 ? audio.tabId : null;
  audio.active = audio.level > 0.015;

  avgBass = avgBass * 0.96 + audio.bass * 0.04;
  if (audio.bass > 0.42 && audio.bass > avgBass * 1.35 && now - lastKick > 260) { lastKick = now; kicks.forEach(f => f(audio.bass)); }

  const r = document.documentElement.style;
  r.setProperty('--au', audio.level.toFixed(3));
  r.setProperty('--bass', audio.bass.toFixed(3));
  subs.forEach(f => f(audio));

  if (audio.level < 0.002 && ![...raw.values()].some(x => x.l > 0)) {
    run = false; audio.active = false; audio.tabId = null;
    r.setProperty('--au', 0); r.setProperty('--bass', 0);
    subs.forEach(f => f(audio));
    return;
  }
  requestAnimationFrame(loop);
}
