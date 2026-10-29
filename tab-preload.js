'use strict';
/* Läuft in jeder Webseite (isoliert). Stellt der Seite nichts bereit.
   Meldet Scroll-Fortschritt und – wenn Medien laufen – Audio-Pegel (Bass, Mitten, Höhen, Gesamt). */
const { ipcRenderer } = require('electron');

/* ===== Scroll ===== */
let last = -1, queued = false;
function report() {
  queued = false;
  const d = document.documentElement;
  if (!d) return;
  const max = Math.max(1, d.scrollHeight - innerHeight);
  const p = Math.min(1, Math.max(0, scrollY / max));
  if (Math.abs(p - last) > 0.002) { last = p; ipcRenderer.send('scroll', p); }
}
const queue = () => { if (!queued) { queued = true; requestAnimationFrame(report); } };
addEventListener('scroll', queue, { passive: true, capture: true });
addEventListener('resize', queue, { passive: true });
addEventListener('DOMContentLoaded', () => { last = -1; queue(); });
addEventListener('load', queue);

/* ===== Audio ===== */
/* captureStream() zapft den Ton nur ab – die Wiedergabe der Seite bleibt unverändert.
   Geschützte oder fremde Medien werfen hier einen Fehler und werden übersprungen. */
let ctx = null, timer = 0, silent = 0;
const taps = new Map();

function analyserFor(el) {
  if (taps.has(el)) return taps.get(el);
  let stream;
  try { stream = el.captureStream ? el.captureStream() : null; } catch { stream = null; }
  if (!stream) { taps.set(el, null); return null; }
  ctx = ctx || new AudioContext();
  const an = ctx.createAnalyser();
  an.fftSize = 512; an.smoothingTimeConstant = 0.55;
  const mute = ctx.createGain(); mute.gain.value = 0;
  an.connect(mute).connect(ctx.destination);
  const tap = { an, srcs: new Map(), data: new Uint8Array(an.frequencyBinCount) };
  const attach = () => {
    for (const tr of stream.getAudioTracks()) {
      if (tap.srcs.has(tr.id)) continue;
      try { const s = ctx.createMediaStreamSource(new MediaStream([tr])); s.connect(an); tap.srcs.set(tr.id, s); } catch {}
    }
  };
  attach();
  stream.addEventListener('addtrack', attach);
  taps.set(el, tap);
  return tap;
}

function band(d, a, b) { let s = 0; for (let i = a; i < b; i++) s += d[i]; return s / ((b - a) * 255); }

function sample() {
  let B = 0, M = 0, H = 0, L = 0, playing = false;
  for (const [el, tap] of taps) {
    if (!tap || el.paused || el.muted || !el.volume) continue;
    playing = true;
    tap.an.getByteFrequencyData(tap.data);
    const d = tap.data;
    const b = band(d, 1, 8), m = band(d, 8, 60), h = band(d, 60, 180);
    B = Math.max(B, b); M = Math.max(M, m); H = Math.max(H, h); L = Math.max(L, b * 0.5 + m * 0.35 + h * 0.15);
  }
  if (!playing || L < 0.01) {
    if (++silent === 3) ipcRenderer.send('audio', [0, 0, 0, 0]);
    if (!playing && silent > 30) { clearInterval(timer); timer = 0; }
    return;
  }
  silent = 0;
  ipcRenderer.send('audio', [B, M, H, L]);
}

addEventListener('play', e => {
  const el = e.target;
  if (!(el instanceof HTMLMediaElement)) return;
  analyserFor(el);
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (!timer) { silent = 0; timer = setInterval(sample, 33); }
}, true);
