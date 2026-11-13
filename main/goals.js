'use strict';
/* Dulidan Web · Torjubel: verfolgt „Mein Verein“ über OpenLigaDB und meldet jedes Tor
   Ruhig alle 90 s, während ein Spiel läuft alle 30 s. Bei einem eigenen Tor: Explosion am Bildschirmrand (auf jeder Seite)
   plus Windows-Benachrichtigung. Gespeichert in userData/club.json. */
const fs = require('node:fs');
const path = require('node:path');

let file = null, club = null, timer = 0, scores = new Map(), fetcher = null, onGoal = () => {};
const POLL_IDLE = +process.env.DW_GOAL_POLL || 90000, POLL_LIVE = +process.env.DW_GOAL_POLL || 30000;

function load() { try { club = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { club = null; } }
function save() { try { if (club) fs.writeFileSync(file, JSON.stringify(club)); else fs.rmSync(file, { force: true }); } catch {} }

function score(m) {
  const g = m.goals || [];
  if (g.length) { const x = g[g.length - 1]; return [x.scoreTeam1 | 0, x.scoreTeam2 | 0, x]; }
  const r = (m.matchResults || []).slice().sort((a, b) => (b.resultOrderID || 0) - (a.resultOrderID || 0))[0];
  return r ? [r.pointsTeam1 | 0, r.pointsTeam2 | 0, null] : [0, 0, null];
}
const isLive = m => { const t = Date.parse(m.matchDateTimeUTC || m.matchDateTime); return !m.matchIsFinished && t && Date.now() >= t - 10 * 60000 && Date.now() - t < 2.6 * 3600e3; };

async function poll() {
  clearTimeout(timer);
  if (!club) return;
  let live = false;
  try {
    const r = await fetcher(`https://api.openligadb.de/getmatchesbyteam/${encodeURIComponent(club.filter)}/1/1`);
    const ms = await r.json();
    for (const m of Array.isArray(ms) ? ms : []) {
      if (!isLive(m)) continue;
      live = true;
      const [s1, s2, last] = score(m), home = (m.team1 && m.team1.teamName || '').includes(club.filter);
      const mine = home ? s1 : s2, prev = scores.get(m.matchID);
      scores.set(m.matchID, { mine, s1, s2 });
      /* Erste Sicht auf ein laufendes Spiel: nur merken, nicht jubeln (sonst knallt es beim Start für alte Tore) */
      if (prev && mine > prev.mine) {
        const t1 = m.team1 || {}, t2 = m.team2 || {};
        onGoal({ club: club.name, home: t1.shortName || t1.teamName, away: t2.shortName || t2.teamName, s1, s2, minute: last && last.matchMinute, scorer: last && last.goalGetterName, own: true });
      } else if (prev && (s1 + s2) > (prev.s1 + prev.s2)) {
        const t1 = m.team1 || {}, t2 = m.team2 || {};
        onGoal({ club: club.name, home: t1.shortName || t1.teamName, away: t2.shortName || t2.teamName, s1, s2, minute: last && last.matchMinute, scorer: last && last.goalGetterName, own: false });
      }
    }
  } catch (e) { if (process.env.DW_DEBUG) console.log('[tore]', e.message); }
  timer = setTimeout(poll, live ? POLL_LIVE : POLL_IDLE);
}

function init(userData, fetchFn, goalFn) {
  file = path.join(userData, 'club.json'); fetcher = fetchFn; onGoal = goalFn;
  load();
  if (club) timer = setTimeout(poll, 4000);
}
function set(filter, name) {
  club = filter ? { filter: String(filter).slice(0, 40), name: String(name || filter).slice(0, 60) } : null;
  scores = new Map(); save(); clearTimeout(timer);
  if (club) poll();
  return club;
}
module.exports = { init, set, get: () => club };
