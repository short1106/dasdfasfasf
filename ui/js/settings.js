/* Dulidan Web · settings.js – Suchmaschinen, Shortcuts, Akzente, Animationsstufe */
import { store, hexToRgb, rgbToHex, mixRgb } from './util.js';

export const ENGINES = {
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=%s' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=%s' },
  brave: { name: 'Brave', url: 'https://search.brave.com/search?q=%s' },
  ecosia: { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=%s' },
  startpage: { name: 'Startpage', url: 'https://www.startpage.com/do/search?query=%s' }
};

export const SHORTCUTS = {
  yt: { name: 'YouTube', icon: 'yt', url: 'https://www.youtube.com/results?search_query=%s', home: 'https://www.youtube.com' },
  gh: { name: 'GitHub', icon: 'gh', url: 'https://github.com/search?q=%s', home: 'https://github.com' },
  wiki: { name: 'Wikipedia', icon: 'wiki', url: 'https://de.wikipedia.org/w/index.php?search=%s', home: 'https://de.wikipedia.org' },
  maps: { name: 'Maps', icon: 'maps', url: 'https://www.google.com/maps/search/%s', home: 'https://www.google.com/maps' },
  mc: { name: 'Minecraft Wiki', icon: 'mc', url: 'https://de.minecraft.wiki/?search=%s', home: 'https://de.minecraft.wiki' }
};

export const ACCENTS = {
  dulidan: { name: 'Dulidan', c: ['#8122b5', '#c020b8', '#ff7ae6'] },
  cyber: { name: 'Cyber', c: ['#2a3bff', '#00b7ff', '#7af3ff'] },
  toxic: { name: 'Toxic', c: ['#0f8a4a', '#39e36b', '#c8ff7a'] },
  inferno: { name: 'Inferno', c: ['#b5161f', '#ff5a1f', '#ffc27a'] },
  royal: { name: 'Royal', c: ['#4b1fb5', '#8a5cff', '#d2b8ff'] },
  ice: { name: 'Ice', c: ['#3b6b9a', '#9fd8ff', '#ffffff'] }
};

/* Aus einer freien Farbe die drei Akzenttöne ableiten */
export function deriveAccent(hex) {
  const m = hexToRgb(hex);
  return [rgbToHex(mixRgb(m, [20, 0, 40], 0.4)), rgbToHex(m), rgbToHex(mixRgb(m, [255, 255, 255], 0.5))];
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEFAULTS = { engine: 'duckduckgo', anim: reduced ? 'aus' : 'episch', accent: 'dulidan', custom: '#c020b8', sound: false, adblock: true, restore: true };

const subs = new Set();
export const settings = { ...DEFAULTS, ...store.get('dw_settings', {}) };
if (!ENGINES[settings.engine]) settings.engine = DEFAULTS.engine;

export function setSetting(k, v) {
  settings[k] = v;
  store.set('dw_settings', settings);
  apply();
  subs.forEach(f => f(k, v));
}
export const onSettings = f => subs.add(f);

export function accentColors() {
  return settings.accent === 'custom' ? deriveAccent(settings.custom) : (ACCENTS[settings.accent] || ACCENTS.dulidan).c;
}

export function apply() {
  const r = document.documentElement;
  r.dataset.anim = settings.anim;
  const [v, m, p] = accentColors();
  r.style.setProperty('--vio', v); r.style.setProperty('--mag', m); r.style.setProperty('--pink', p);
  r.style.setProperty('--vio-rgb', hexToRgb(v).join(',')); r.style.setProperty('--mag-rgb', hexToRgb(m).join(',')); r.style.setProperty('--pink-rgb', hexToRgb(p).join(','));
}
apply();
