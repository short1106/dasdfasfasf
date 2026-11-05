'use strict';
/* Dulidan Web · Sprachpakete für den lokalen Übersetzer (Mozilla Bergamot)
   Lädt Modelle einmalig aus dem öffentlichen Bergamot-Speicher, prüft die SHA-256-Prüfsumme aus dem Verzeichnis
   und legt sie in userData ab – danach übersetzt Dulidan Web offline, kein Text verlässt den Rechner. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const VERSION = '0.3.3';
const BASE = process.env.DW_MODEL_BASE || `https://storage.googleapis.com/bergamot-models-sandbox/${VERSION}`;

let dir = null, fetcher = null, registry = null;
const pending = new Map();

function init(userData, fetchFn) { dir = path.join(userData, 'translate-models', VERSION); fetcher = fetchFn; }

async function download(name) {
  const r = await fetcher(`${BASE}/${name}`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

/* Verzeichnis aller Sprachpaare (zwischengespeichert, damit es auch offline geht) */
async function getRegistry() {
  if (registry) return registry;
  const file = path.join(dir, 'registry.json');
  try { registry = JSON.parse((await download('registry.json')).toString('utf8')); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(registry)); }
  catch (e) { if (fs.existsSync(file)) registry = JSON.parse(fs.readFileSync(file, 'utf8')); else throw e; }
  return registry;
}

/* name = "registry.json" oder "<paar>/<datei>", z. B. "deen/vocab.deen.spm" */
async function get(name) {
  if (name === 'registry.json') return Buffer.from(JSON.stringify(await getRegistry()));
  const m = /^([a-z]{4})\/([\w.\-]+)$/.exec(name);
  if (!m) throw new Error('Ungültiger Name');
  const reg = await getRegistry();
  const entry = reg[m[1]] && Object.values(reg[m[1]]).find(f => f && f.name === m[2]);
  if (!entry) throw new Error('Unbekannte Datei');
  const file = path.join(dir, m[1], m[2]);
  if (fs.existsSync(file)) return fs.promises.readFile(file);
  if (pending.has(name)) return pending.get(name);
  const job = (async () => {
    const buf = await download(name);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    if (entry.expectedSha256Hash && hash !== entry.expectedSha256Hash) throw new Error('Prüfsumme falsch');
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, buf);
    return buf;
  })();
  pending.set(name, job);
  try { return await job; } finally { pending.delete(name); }
}

/* Welche Paare liegen schon lokal? (für „offline bereit“ in der Oberfläche) */
function installed() {
  try { return fs.readdirSync(dir).filter(d => /^[a-z]{4}$/.test(d)); } catch { return []; }
}

module.exports = { init, get, installed };
