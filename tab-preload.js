'use strict';
/* Läuft in jeder Webseite (isoliert). Meldet nur den Scroll-Fortschritt, stellt der Seite nichts bereit. */
const { ipcRenderer } = require('electron');

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
