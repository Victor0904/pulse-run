// Économie, déblocages, boutique (GAME_DESIGN §8.4, §12). Pur.
import { SONGS, SONG_BY_ID, albumSongs } from '../songs/index.js';
import { ALBUMS } from '../core/const.js';
import { rankBetter } from '../sim/scoring.js';
import { songRec } from './save.js';

export const totalStars = save => Object.values(save.songs).reduce((a, r) => a + (r.stars ? r.stars.reduce((x, y) => x + y, 0) : 0), 0);
export const albumStars = (save, n) => albumSongs(n).reduce((a, s) => a + (save.songs[s.id] ? save.songs[s.id].stars.reduce((x, y) => x + y, 0) : 0), 0);
export const cleared = (save, id) => !!(save.songs[id] && save.songs[id].clears > 0);
export const albumUnlocked = (save, n) => n === 1 || totalStars(save) >= ALBUMS[n].stars;
export const bossBeaten = (save, n) => cleared(save, `a${n}boss`);
export const echoUnlocked = (save, n) => bossBeaten(save, n);
export const infiniteUnlocked = save => cleared(save, 'a1s2');

export function songUnlocked(save, song) {
  if (!albumUnlocked(save, song.album)) return false;
  const list = albumSongs(song.album);
  if (song.boss) return list.filter(s => !s.boss).every(s => cleared(save, s.id));
  const i = list.indexOf(song);
  return i === 0 || cleared(save, list[i - 1].id);
}
export function lockReason(save, song) {
  if (!albumUnlocked(save, song.album)) return `★ ${totalStars(save)} / ${ALBUMS[song.album].stars} pour débloquer`;
  if (song.boss) return '4 morceaux à terminer';
  const list = albumSongs(song.album), i = list.indexOf(song);
  return i > 0 ? `Termine ${list[i - 1].title}` : '';
}
export function nextSong(save, song) {
  const i = SONGS.indexOf(song);
  for (let k = i + 1; k < SONGS.length; k++) if (songUnlocked(save, SONGS[k])) return SONGS[k];
  return null;
}
// morceau proposé par JOUER : le dernier joué s'il n'est pas fini, sinon le suivant à faire
export function suggestedSong(save) {
  const last = SONG_BY_ID[save.last && save.last.song] || SONGS[0];
  if (!cleared(save, last.id) && songUnlocked(save, last)) return last;
  for (const s of SONGS) if (songUnlocked(save, s) && !cleared(save, s.id)) return s;
  return last;
}

// ------------------------------------------------------------------ gains (§12.1)
export const songReward = (won, score) => (won ? 10 + Math.floor(score / 1000) : 3 + Math.floor(score / 1500));
export const loopReward = score => 5 + Math.floor(score / 1200);

// res : { won, score, acc, rank, hits, maxCombo, pct, perfect } ; opts : { echo, training }
export function applySongResult(save, song, res, opts = {}) {
  const out = { ondes: 0, newStars: [false, false, false], record: false, pctRecord: false, rankBonus: 0, gold: false, unlocked: [] };
  save.stats.runs++;
  if (opts.training) return out;                                 // entraînement : 0 ◎, aucun record
  const before = SONGS.filter(s => songUnlocked(save, s)).map(s => s.id);
  const r = songRec(save, song.id);
  r.plays++;
  out.ondes += songReward(res.won, res.score);
  if (res.won) {
    r.clears++;
    if (opts.echo) {
      if (!r.gold) { r.gold = true; out.gold = true; out.ondes += 40; }
      r.echo = Math.max(r.echo || 0, res.score);
    } else {
      const st = [1, res.acc >= 0.85 ? 1 : 0, res.hits === 0 ? 1 : 0];
      for (let k = 0; k < 3; k++) if (st[k] && !r.stars[k]) { r.stars[k] = 1; out.newStars[k] = true; out.ondes += 15; }
      if (rankBetter(res.rank, r.rank)) {
        if ((res.rank === 'S' || res.rank === 'S+') && r.rank !== 'S' && r.rank !== 'S+') out.rankBonus = res.rank === 'S+' ? 50 : 30;
        else if (res.rank === 'S+' && r.rank === 'S') out.rankBonus = 20;      // complète jusqu'au bonus S+
        r.rank = res.rank;
      }
      out.ondes += out.rankBonus;
      if (res.score > r.best) { r.best = res.score; out.record = true; }
      if (res.acc > r.acc) r.acc = res.acc;
      r.bestPct = 1;
    }
  } else if (!opts.echo && res.pct > r.bestPct) { r.bestPct = res.pct; out.pctRecord = true; }
  if (!opts.echo && res.maxCombo > r.combo) r.combo = res.maxCombo;
  save.ondes += out.ondes;
  save.last.song = song.id;
  out.unlocked = SONGS.filter(s => songUnlocked(save, s) && !before.includes(s.id)).map(s => s.id);
  return out;
}
export function applyLoopResult(save, res, opts = {}) {
  const inf = save.infinite, out = { ondes: loopReward(res.score), record: false, dailyReward: 0 };
  save.stats.runs++;
  if (res.score > inf.best) { inf.best = res.score; out.record = true; }
  if (res.time > inf.bestTime) inf.bestTime = res.time;
  if (res.block > inf.bestBlock) inf.bestBlock = res.block;
  if (opts.daily) {
    const d = inf.daily;
    if (d.date !== opts.date) { d.date = opts.date; d.best = 0; d.rewarded = false; }
    if (res.score > d.best) d.best = res.score;
    if (!d.rewarded && res.time >= 60) { d.rewarded = true; out.dailyReward = 30; }
  }
  out.ondes += out.dailyReward;
  save.ondes += out.ondes;
  return out;
}

// ------------------------------------------------------------------ boutique (§12.2) — cosmétique uniquement
export const SHOP = {
  cursor: { label: 'CURSEURS', items: [
    ['etincelle', 'Étincelle', 0], ['chevron', 'Chevron', 200], ['croche', 'Croche', 300], ['diapason', 'Diapason', 400],
    ['prisme', 'Prisme', 600], ['comete', 'Comète', 600], ['cristal', 'Cristal', 800], ['couronne', 'Couronne', null]] },
  trail: { label: 'TRAÎNÉES', items: [['none', 'Aucune', 0], ['ruban', 'Ruban', 150], ['pointilles', 'Pointillés', 250], ['spectre', 'Spectre', 500], ['echo', 'Écho', 700]] },
  core: { label: 'CŒURS', items: [['membrane', 'Membrane', 0], ['vinyle', 'Vinyle', 300], ['oeil', 'Œil', 500], ['oscillo', 'Oscilloscope', 600], ['soleil', 'Soleil noir', 900]] },
  bg: { label: 'FONDS', items: [['sillons', 'Sillons', 0], ['polaire', 'Grille polaire', 400], ['constellation', 'Constellation', 600]] },
  tick: { label: 'SONS', items: [['pluck', 'Pluck', 0], ['cloche', 'Cloche FM', 350], ['marimba', 'Marimba', 350], ['voix', 'Voix synthé', 500]] },
};
export const shopItem = (cat, id) => { const it = SHOP[cat] && SHOP[cat].items.find(x => x[0] === id); return it ? { id: it[0], name: it[1], price: it[2] } : null; };
export const owns = (save, cat, id) => save.owned[cat].includes(id);
export function buy(save, cat, id) {
  const it = shopItem(cat, id);
  if (!it) return { ok: false, why: 'inconnu' };
  if (owns(save, cat, id)) return { ok: false, why: 'déjà acheté' };
  if (it.price === null) return { ok: false, why: 'trophée' };
  if (save.ondes < it.price) return { ok: false, why: 'pas assez d’Ondes' };
  save.ondes -= it.price; save.owned[cat].push(id);
  return { ok: true };
}
export function equip(save, cat, id) {
  if (!owns(save, cat, id)) return false;
  save.equipped[cat] = id; return true;
}
export function grant(save, cat, id) { if (!owns(save, cat, id)) save.owned[cat].push(id); }
