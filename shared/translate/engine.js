/* Dulidan Übersetzer · engine.js – lokal (Mozilla Bergamot, offline und privat) mit Online-Ausweich (MyMemory)
   Lokal gibt es Deutsch, Englisch, Spanisch, Französisch u. a. (über Englisch als Zwischensprache).
   Japanisch und Türkisch haben keine lokalen Modelle und gehen online. */

export const LANGS = [
  ['de', 'Deutsch', 'DE'], ['en', 'Englisch', 'EN'], ['ja', 'Japanisch', 'JA'],
  ['es', 'Spanisch', 'ES'], ['fr', 'Französisch', 'FR'], ['tr', 'Türkisch', 'TR']
];
export const langName = c => (LANGS.find(l => l[0] === c) || [c, c.toUpperCase()])[1];

/* ===== Sprache erkennen: Schrift (Japanisch) oder häufige Wörter ===== */
const STOP = {
  de: 'der die das und ist nicht ich du wir sie ein eine zu mit auf für von den dem es auch wie was',
  en: 'the and is are not you we they a an to with on for of it this that what how be',
  es: 'el la los las y es no yo tú nosotros un una de con en por para que qué cómo está',
  fr: 'le la les et est ne pas je tu nous vous un une de avec sur pour que qui comment',
  tr: 've bir bu da de ne için ile çok ben sen biz mi mı değil var yok gibi nasıl'
};
const STOPSETS = Object.fromEntries(Object.entries(STOP).map(([k, v]) => [k, new Set(v.split(' '))]));
export function detect(text) {
  const t = text.trim();
  if (!t) return null;
  if (/[぀-ヿ一-鿿]/.test(t)) return 'ja';
  if (/[ğışİĞŞ]/.test(t)) return 'tr';
  if (/[äöüß]/i.test(t)) return 'de';
  if (/[ñ¿¡]/.test(t)) return 'es';
  if (/[çœàèùâêîôû]/i.test(t)) return 'fr';
  const words = t.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  let best = null, score = 0;
  for (const [k, set] of Object.entries(STOPSETS)) {
    const s = words.reduce((a, w) => a + (set.has(w) ? 1 : 0), 0);
    if (s > score) { score = s; best = k; }
  }
  return best || 'en';
}

/* ===== Lokal: Bergamot läuft als Worker in dieser Seite, Sprachpakete holt die App (geprüft, zwischengespeichert) ===== */
let local = null, localPairs = null;
async function api(name) {
  const r = await fetch('/api/model?f=' + encodeURIComponent(name), { headers: { 'x-dw': '1' } });
  if (!r.ok) throw new Error('Sprachpaket nicht ladbar');
  return r;
}
async function localEngine() {
  if (local) return local;
  local = (async () => {
    const { LatencyOptimisedTranslator, TranslatorBacking } = await import('/vendor/bergamot/translator.js');
    class Backing extends TranslatorBacking {
      async loadModelRegistery() {
        const reg = await (await api('registry.json')).json();
        localPairs = new Set(Object.keys(reg));
        /* Dateinamen bekommen ihr Sprachpaar vorangestellt: "deen/model.deen…" */
        return Object.entries(reg).map(([k, files]) => ({ from: k.slice(0, 2), to: k.slice(2, 4),
          files: Object.fromEntries(Object.entries(files).map(([p, f]) => [p, f && f.name ? { ...f, name: k + '/' + f.name } : f])) }));
      }
      async fetch(name) { return (await api(name)).arrayBuffer(); }
    }
    const backing = new Backing({ downloadTimeout: 0 });
    await backing.registry;
    return new LatencyOptimisedTranslator({}, backing);
  })();
  local.catch(() => { local = null; });
  return local;
}
/* Geht das Paar lokal? Direkt oder über Englisch */
export async function canLocal(from, to) {
  try { await localEngine(); } catch { return false; }
  if (!localPairs) return false;
  return localPairs.has(from + to) || (localPairs.has(from + 'en') && localPairs.has('en' + to));
}

/* ===== Online: MyMemory (kostenlos, ohne Konto, über den App-Proxy) ===== */
async function online(text, from, to) {
  /* Höchstens ~450 Zeichen pro Anfrage: an Satzgrenzen teilen */
  const parts = [];
  let cur = '';
  for (const s of text.split(/(?<=[.!?。！？\n])\s*/)) {
    if ((cur + ' ' + s).length > 450 && cur) { parts.push(cur); cur = s; } else cur = cur ? cur + ' ' + s : s;
  }
  if (cur) parts.push(cur);
  const out = [];
  for (const p of parts) {
    const u = 'https://api.mymemory.translated.net/get?' + new URLSearchParams({ q: p, langpair: from + '|' + to });
    const r = await fetch('/api/fetch?' + new URLSearchParams({ u }), { headers: { 'x-dw': '1' } });
    const j = await r.json();
    if (j.status >= 400 || !j.body) throw new Error('Online-Übersetzer nicht erreichbar');
    const d = JSON.parse(j.body);
    if (d.quotaFinished || d.responseStatus === 429) throw new Error('Tageslimit des Online-Übersetzers erreicht – morgen geht es weiter');
    if (d.responseStatus && d.responseStatus !== 200) throw new Error(String(d.responseDetails || 'Online-Fehler'));
    out.push(String(d.responseData && d.responseData.translatedText || ''));
  }
  return out.join(' ');
}

/* ===== Übersetzen: lokal, wenn möglich, sonst online. Rückgabe { text, engine } ===== */
export async function translate(text, from, to, onStatus = () => {}) {
  if (from === to) return { text, engine: 'gleich' };
  if (await canLocal(from, to)) {
    try {
      onStatus('local');
      const t = await localEngine();
      const r = await t.translate({ from, to, text, html: false });
      return { text: r.target.text, engine: 'local' };
    } catch (e) {
      if (e && /Superseded|Cancelled/.test(e.constructor && e.constructor.name || e.message)) throw e;
      console.warn('Lokal fehlgeschlagen, versuche online', e);
    }
  }
  onStatus('online');
  return { text: await online(text, from, to), engine: 'online' };
}
