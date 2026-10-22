// Défis du jour (3, seed = hash(date) + 1) et trophées (20) — GAME_DESIGN §12.3, §12.4. Pur.
import { mulberry32, hashString } from '../core/rng.js';
import { SONGS } from '../songs/index.js';
import { albumUnlocked, bossBeaten, infiniteUnlocked, cleared, totalStars, albumStars, songUnlocked, grant } from './economy.js';

export const REWARD = [40, 60, 90];
// modèles : id, texte, but, condition de disponibilité (contenus débloqués uniquement)
const EASY = [
  { id: 'perfect100', text: '100 PARFAIT', goal: 100 },
  { id: 'clear2', text: 'Termine 2 morceaux', goal: 2 },
  { id: 'play5', text: 'Joue 5 minutes', goal: 300 },
];
const MED = [
  { id: 'rankA', text: 'Rang A sur un morceau de l’album {a}', goal: 1, album: true },
  { id: 'combo120', text: 'Combo 120', goal: 120 },
  { id: 'clean2', text: '2 sections propres d’affilée', goal: 2 },
  { id: 'loop90', text: '90 s en Boucle', goal: 90, need: 'loop' },
];
const HARD = [
  { id: 'nohit2', text: 'Sans faute sur un morceau ≥ 2', goal: 1 },
  { id: 'acc95', text: 'Précision 95 %', goal: 1 },
  { id: 'block10', text: 'Bloc 10 en Boucle', goal: 10, need: 'loop' },
  { id: 'bossNoHit', text: 'Boss sans faute', goal: 1, need: 'boss' },
];
const avail = (save, m) => !m.need || (m.need === 'loop' ? infiniteUnlocked(save) : SONGS.some(s => s.boss && songUnlocked(save, s)));

export function generateDaily(save, dateKey) {
  const rnd = mulberry32(hashString(dateKey) + 1);
  const pickOne = list => { const ok = list.filter(m => avail(save, m)); return ok[Math.floor(rnd() * ok.length)]; };
  const albums = [1, 2, 3].filter(n => albumUnlocked(save, n));
  return [EASY, MED, HARD].map((L, k) => {
    const m = pickOne(L);
    const album = m.album ? albums[Math.floor(rnd() * albums.length)] : 0;
    return { id: m.id, text: m.text.replace('{a}', album), goal: m.goal, album, prog: 0, done: false, claimed: false, tier: k, reward: REWARD[k] };
  });
}
export function ensureDaily(save, dateKey) {
  if (save.daily.date !== dateKey || !save.daily.list.length) { save.daily.date = dateKey; save.daily.list = generateDaily(save, dateKey); }
  return save.daily.list;
}
// ev : { kind: 'song'|'loop'|'training', perfect, playTime, won, rank, album, songN, boss, hits, acc, maxCombo, maxCleanRun, time, block }
export function progressDaily(save, ev) {
  const changed = [];
  for (const c of save.daily.list) {
    if (c.done) continue;
    const before = c.prog;
    const isSong = ev.kind === 'song';
    switch (c.id) {
      case 'perfect100': if (ev.kind !== 'training') c.prog += ev.perfect || 0; break;
      case 'clear2': if (isSong && ev.won) c.prog += 1; break;
      case 'play5': c.prog += Math.round(ev.playTime || 0); break;      // l'entraînement compte aussi
      case 'rankA': if (isSong && ev.won && ev.album === c.album && ['A', 'S', 'S+'].includes(ev.rank)) c.prog = 1; break;
      case 'combo120': if (ev.kind !== 'training') c.prog = Math.max(c.prog, ev.maxCombo || 0); break;
      case 'clean2': if (ev.kind !== 'training') c.prog = Math.max(c.prog, ev.maxCleanRun || 0); break;
      case 'loop90': if (ev.kind === 'loop') c.prog = Math.max(c.prog, Math.floor(ev.time || 0)); break;
      case 'nohit2': if (isSong && ev.won && ev.hits === 0 && ev.songN >= 2) c.prog = 1; break;
      case 'acc95': if (isSong && ev.won && ev.acc >= 0.95) c.prog = 1; break;
      case 'block10': if (ev.kind === 'loop') c.prog = Math.max(c.prog, ev.block || 0); break;
      case 'bossNoHit': if (isSong && ev.won && ev.boss && ev.hits === 0) c.prog = 1; break;
    }
    if (c.prog >= c.goal) { c.prog = c.goal; c.done = true; }
    if (c.prog !== before) changed.push(c);
  }
  return changed;
}
export function claimDaily(save, i) {
  const c = save.daily.list[i];
  if (!c || !c.done || c.claimed) return 0;
  c.claimed = true; save.ondes += c.reward; return c.reward;
}
export const claimable = save => save.daily.list.filter(c => c.done && !c.claimed).length;

// ------------------------------------------------------------------ trophées (20)
const sumRank = (save, album, ranks) => SONGS.filter(s => s.album === album).every(s => save.songs[s.id] && ranks.includes(save.songs[s.id].rank));
export const TROPHIES = [
  { id: 'premier', name: 'Premier Pouls', desc: 'Terminer Premier Pouls', reward: 25, test: (s) => cleared(s, 'a1s1') },
  { id: 'p1000', name: '1 000 PARFAIT', desc: 'Cumuler 1 000 PARFAIT', reward: 50, test: (s) => s.stats.perfects >= 1000 },
  { id: 'p10000', name: '10 000 PARFAIT', desc: 'Cumuler 10 000 PARFAIT', reward: 150, test: (s) => s.stats.perfects >= 10000 },
  { id: 'combo200', name: 'Combo 200', desc: 'Combo de 200', reward: 50, test: (s) => s.stats.maxCombo >= 200 },
  { id: 'combo500', name: 'Combo 500', desc: 'Combo de 500', reward: 120, test: (s) => s.stats.maxCombo >= 500 },
  { id: 'sansfaute', name: 'Sans faute', desc: 'Terminer un morceau sans perdre de Pouls', reward: 40, test: (s) => Object.values(s.songs).some(r => r.stars[2]) },
  { id: 'rangS', name: 'Rang S', desc: 'Obtenir un rang S', reward: 40, test: (s) => Object.values(s.songs).some(r => r.rank === 'S' || r.rank === 'S+') },
  { id: 'rangSp', name: 'Rang S+', desc: 'Obtenir un rang S+', reward: 80, test: (s) => Object.values(s.songs).some(r => r.rank === 'S+') },
  { id: 'album1', name: 'Album 1 terminé', desc: 'Terminer les 5 morceaux de BATTEMENTS', reward: 60, test: (s) => SONGS.filter(x => x.album === 1).every(x => cleared(s, x.id)) },
  { id: 'album2', name: 'Album 2 terminé', desc: 'Terminer les 5 morceaux de SYNCOPE', reward: 80, test: (s) => SONGS.filter(x => x.album === 2).every(x => cleared(s, x.id)) },
  { id: 'album3', name: 'Album 3 terminé', desc: 'Terminer les 5 morceaux de DROP', reward: 100, test: (s) => SONGS.filter(x => x.album === 3).every(x => cleared(s, x.id)) },
  { id: 'coeur', name: 'Battre Le Cœur', desc: 'Vaincre le boss de l’album 1', reward: 50, test: (s) => bossBeaten(s, 1) },
  { id: 'metronome', name: 'Battre Le Métronome', desc: 'Vaincre le boss de l’album 2', reward: 80, test: (s) => bossBeaten(s, 2) },
  { id: 'membrane', name: 'Battre La Membrane', desc: 'Vaincre le boss de l’album 3', reward: 120, test: (s) => bossBeaten(s, 3) },
  { id: 'etoilesAlbum', name: 'Toutes les étoiles d’un album', desc: '15 ★ sur un album', reward: 100, test: (s) => [1, 2, 3].some(n => albumStars(s, n) >= 15) },
  { id: 'etoiles45', name: '45 ★', desc: 'Toutes les étoiles du jeu', reward: 150, test: (s) => totalStars(s) >= 45 },
  { id: 'bloc10', name: 'Bloc 10', desc: 'Atteindre le bloc 10 en Boucle', reward: 50, test: (s) => s.infinite.bestBlock >= 10 },
  { id: 'bloc20', name: 'Bloc 20', desc: 'Atteindre le bloc 20 en Boucle', reward: 120, test: (s) => s.infinite.bestBlock >= 20 },
  { id: 'silence', name: 'Survivre au silence', desc: 'Finir une section SILENCE sans RATÉ', reward: 60, test: (s, ctx) => !!(ctx && ctx.silenceClean) || !!s.trophies.silence },
  { id: 'calibre', name: 'Calibré', desc: 'Finir la calibration', reward: 25, test: (s) => s.calib.done },
];
// « Tout en S sur un album » → Couronne (curseur)
export const crownEarned = s => [1, 2, 3].some(n => sumRank(s, n, ['S', 'S+']));

export function checkTrophies(save, ctx) {
  const got = [];
  for (const t of TROPHIES) {
    if (save.trophies[t.id]) continue;
    if (t.test(save, ctx)) { save.trophies[t.id] = Date.now(); save.ondes += t.reward; got.push(t); }
  }
  if (crownEarned(save) && !save.owned.cursor.includes('couronne')) { grant(save, 'cursor', 'couronne'); got.push({ id: 'couronne', name: 'Couronne', reward: 0 }); }
  return got;
}
