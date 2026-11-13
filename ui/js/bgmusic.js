/* Dulidan Web · bgmusic.js – Hintergrundmusik je Design: Dulidan → DULIDAN ANTHEM, Japan → SAKURA NO KAZE, Russland → DULIDAN KAZACHOK
   Die Tracks kommen aus der Engine in music.js (aus Dulidanopoly, live synthetisiert). Damit sie nicht stört, läuft sie nur,
   solange die Startseite zu sehen ist, kein Tab Ton macht und das Fenster sichtbar ist; Wechsel werden kurz entprellt.
   Aufbau: Zuordnung · Zustand prüfen · Start/Stopp */
import { settings } from './settings.js';

const TRACK = { dulidan: 'anthem', japan: 'japan', russland: 'russia', kasachstan: 'anthem' };
let state = { home: false, tabAudio: false, disco: false }, timer = 0;
const M = () => window.DULI_MUSIC;

export const trackFor = theme => TRACK[theme] || 'anthem';
export function trackName(theme) { const m = M(); const t = m && m.tracks.find(x => x.id === trackFor(theme)); return t ? t.name + ' · ' + t.sub : ''; }

/* Neuer Zustand von außen (Startseite sichtbar? Ton aus einem Tab? Disko?) – entscheidet nach kurzer Pause */
export function musicState(patch) {
  Object.assign(state, patch);
  clearTimeout(timer);
  timer = setTimeout(apply, state.home ? 450 : 120);
}
export function apply() {
  const m = M(); if (!m) return;
  const want = !!settings.music && state.home && !state.tabAudio && !state.disco && !document.hidden;
  const id = trackFor(settings.theme);
  m.setVol(Math.max(0, Math.min(1, settings.musicVol ?? 0.45)));
  if (want) { if (!m.playing || m.track !== id) m.start(id); }
  else if (m.playing) m.stop();
}
document.addEventListener('visibilitychange', () => musicState({}));
/* Falls der Browser Ton erst nach einer Geste erlaubt: beim ersten Klick nochmal versuchen */
addEventListener('pointerdown', () => { const m = M(); if (m && settings.music && state.home && !m.playing) apply(); }, { once: true, capture: true });
