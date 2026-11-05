/* Dulidan Web · sound.js – synthetische Mikro-Sounds (WebAudio, standardmäßig aus) */
import { settings } from './settings.js';

let ctx = null, last = 0;
function ac() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, dur, type = 'sine', gain = 0.04, slide = 0) {
  const c = ac(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, from, to, gain = 0.05) {
  const c = ac(), t = c.currentTime, n = c.sampleRate * dur, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = b; f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(c.destination); s.start(t);
}

const LIB = {
  hover: () => tone(2400, 0.03, 'sine', 0.012),
  click: () => { tone(900, 0.08, 'triangle', 0.05, 0.4); },
  open: () => noise(0.35, 400, 4000, 0.05),
  close: () => noise(0.3, 3500, 300, 0.04),
  fire: () => { tone(160, 0.5, 'sawtooth', 0.05, 0.25); noise(0.5, 2000, 120, 0.08); },
  tab: () => { tone(520, 0.12, 'sine', 0.04, 2); },
  shatter: () => { noise(0.45, 6000, 800, 0.06); tone(1400, 0.2, 'square', 0.015, 0.3); },
  boot: () => { tone(80, 1.2, 'sawtooth', 0.04, 6); noise(1, 200, 6000, 0.05); }
};

export function sfx(name) {
  if (!settings.sound || !LIB[name]) return;
  const now = performance.now();
  if (name === 'hover' && now - last < 40) return;
  last = now;
  try { LIB[name](); } catch {}
}
