// Sauvegarde localStorage avec backup et migrations (GAME_DESIGN §14), reprise de PULSAR.
// Lecture : principal → s'il est absent/illisible → backup → sinon défaut. Écriture : l'ancienne valeur part dans .bak.
export const SAVE_KEY = 'pulserun.save';
export const BAK_KEY = 'pulserun.save.bak';
// v0 : format de pré-version (sans numéro : `coins`, `settings.cameraFollow`, `calib.offsetMs`) → v1 (format §14)
export const CURRENT_VERSION = 1;

export function defaultSettings() {
  return { sfx: 0.8, music: 0.7, vibration: true, reducedMotion: 'auto', fps: 'auto', control: 'glisser', sensitivity: 1.0,
    invert: false, camera: 'suiveuse', cameraChosen: false, ghosts: true, quality: 'auto' };
}
export function emptySongRecord() {
  return { stars: [0, 0, 0], best: 0, acc: 0, rank: null, combo: 0, bestPct: 0, plays: 0, clears: 0, gold: false, echo: null };
}
export function defaultSave(now = Date.now()) {
  return {
    v: CURRENT_VERSION,
    created: now,
    settings: defaultSettings(),
    calib: { done: false, audioMs: 0, judgeMs: 30, profiles: {} },
    ondes: 0,
    songs: {},
    infinite: { best: 0, bestTime: 0, bestBlock: 0, daily: { date: '', best: 0, rewarded: false } },
    daily: { date: '', list: [] },
    owned: { cursor: ['etincelle'], trail: ['none'], core: ['membrane'], bg: ['sillons'], tick: ['pluck'] },
    equipped: { cursor: 'etincelle', trail: 'none', core: 'membrane', bg: 'sillons', tick: 'pluck' },
    trophies: {},
    stats: { playTime: 0, perfects: 0, maxCombo: 0, runs: 0 },
    last: { song: 'a1s1' },
    hints: { calibOffered: false, swipe: false },
  };
}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = v => JSON.parse(JSON.stringify(v));
// Fusion profonde : les clés manquantes viennent du défaut, les champs inconnus sont conservés.
export function deepMerge(def, obj) {
  if (!isObj(obj)) return clone(def);
  const out = clone(def);
  for (const k of Object.keys(obj)) {
    if (isObj(def[k]) && isObj(obj[k])) out[k] = deepMerge(def[k], obj[k]);
    else if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

const MIGRATIONS = {
  // v0 → v1
  1: s => {
    const o = Object.assign({}, s);
    if (typeof o.coins === 'number' && typeof o.ondes !== 'number') { o.ondes = o.coins; delete o.coins; }
    if (isObj(o.settings) && typeof o.settings.cameraFollow === 'boolean' && o.settings.camera === undefined) {
      o.settings = Object.assign({}, o.settings, { camera: o.settings.cameraFollow ? 'suiveuse' : 'fixe' });
      delete o.settings.cameraFollow;
    }
    if (isObj(o.calib) && typeof o.calib.offsetMs === 'number' && o.calib.audioMs === undefined) {
      o.calib = Object.assign({}, o.calib, { audioMs: o.calib.offsetMs, done: true }); delete o.calib.offsetMs;
    }
    return o;
  },
};

export function migrate(save) {
  let s = isObj(save) ? save : {};
  const from = typeof s.v === 'number' ? s.v : 0;
  for (let v = from + 1; v <= CURRENT_VERSION; v++) if (MIGRATIONS[v]) s = MIGRATIONS[v](s);
  const merged = deepMerge(defaultSave(typeof s.created === 'number' ? s.created : Date.now()), s);
  merged.v = CURRENT_VERSION;
  for (const id of Object.keys(merged.songs)) merged.songs[id] = deepMerge(emptySongRecord(), merged.songs[id]);
  if (!Array.isArray(merged.daily.list)) merged.daily.list = [];
  if (typeof merged.ondes !== 'number' || !isFinite(merged.ondes) || merged.ondes < 0) merged.ondes = 0;
  return merged;
}

function parse(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  try { const o = JSON.parse(raw); return isObj(o) && (typeof o.ondes === 'number' || typeof o.coins === 'number') ? o : null; }
  catch { return null; }
}
export function loadSave(storage) {
  let raw = null, bak = null;
  try { raw = storage.getItem(SAVE_KEY); } catch { /* stockage indisponible */ }
  const main = parse(raw);
  if (main) return { save: migrate(main), source: 'main' };
  try { bak = storage.getItem(BAK_KEY); } catch { /* idem */ }
  const b = parse(bak);
  if (b) return { save: migrate(b), source: 'backup' };
  return { save: defaultSave(), source: 'new' };
}
export function writeSave(storage, save) {
  try {
    const old = storage.getItem(SAVE_KEY);
    if (old) storage.setItem(BAK_KEY, old);
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch { return false; }
}
export function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, _map: m };
}
export function songRec(save, id) { return save.songs[id] || (save.songs[id] = emptySongRecord()); }
