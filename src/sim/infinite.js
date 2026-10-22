// Mode infini BOUCLE (GAME_DESIGN §10) : blocs de 8 mesures générés à la volée, déterministes (graine), chacun validé.
// Bloc L : BPM min(176, 108 + 4L) · A max(0,72 ; 1,30 − 0,035 L) · brèche L/M/S/XS · ω min(440, 240 + 14 L).
import { Chart } from './chart.js';
import { validateChart, crossingGroups } from './validate.js';
import { mulberry32 } from '../core/rng.js';

export const BLOCK_BARS = 8;
const KINDS = [['COUPLET', 'verse'], ['REFRAIN', 'chorus'], ['MONTÉE', 'build'], ['DROP', 'drop']];
export const blockBpm = L => Math.min(176, 108 + 4 * L);
export const blockApproach = L => Math.max(0.72, 1.30 - 0.035 * L);
export const blockOmega = L => Math.min(440, 240 + 14 * L);
export const paletteOf = L => Math.floor(L / 4) % 4;          // 0 violet · 1 turquoise · 2 bleu · 3 prisme
export function blockGap(L, rnd) { return L <= 3 ? 'L' : L <= 7 ? 'M' : L <= 13 ? 'S' : rnd() < 0.7 ? 'S' : 'XS'; }

function pick(rnd, table) {
  let tot = 0; for (const [, w] of table) tot += w;
  let r = rnd() * tot;
  for (const [v, w] of table) { r -= w; if (r <= 0) return v; }
  return table[table.length - 1][0];
}

// Une macro de `bars` mesures commençant à la mesure `bar` (1-indexée dans le bloc)
function macroFor(L, rnd, bar, bars, kind, gap) {
  const pos = `${bar}:1`, beats = bars * 4, out = [];
  const ev = (every) => Math.max(1, Math.floor(beats / every));
  const sp = L >= 10 && rnd() < 0.25 ? (rnd() < 0.5 ? 'rapide' : 'lent') : undefined;
  if (kind === 'build' && L >= 2) {
    // MONTÉE : lames sur la caisse, densité croissante, rien de neuf
    return [[`${bar}:5`, 'M', 'LAMES', { n: ev(2), every: 2, from: 'opp', arc: 120 + Math.floor(rnd() * 3) * 10 }]];
  }
  const table = [['TUNNEL', 3], ['ESCALIER', 4], ['ZIGZAG', 4]];
  if (L >= 2) table.push(['BOUMTCHAK', 4]);
  if (L >= 3) table.push(['DEUX', 2]);
  if (L >= 4) table.push(['DOUBLES', 2], ['SPIRALE', 2]);
  if (L >= 6) table.push(['EVENTAIL', 2], ['CROIX', 1]);
  if (L >= 8) table.push(['ETAU', 2], ['IMPLO', 2]);
  const m = pick(rnd, table);
  const every = L < 2 ? (rnd() < 0.5 ? 2 : 1) : L < 6 ? (rnd() < 0.6 ? 1 : 2) : (rnd() < 0.5 ? 1 : rnd() < 0.7 ? 0.5 : 2);
  const amp = 40 + Math.floor(rnd() * 5) * 15, step = (rnd() < 0.5 ? -1 : 1) * (20 + Math.floor(rnd() * 4) * 10);
  const o = { w: gap, sp };
  switch (m) {
    case 'TUNNEL': out.push([pos, 'M', 'TUNNEL', Object.assign({ n: ev(every), every, a: `p${rnd() < 0.5 ? '+' : '-'}${Math.floor(rnd() * 4) * 20}` }, o)]); break;
    case 'ESCALIER': out.push([pos, 'M', 'ESCALIER', Object.assign({ n: ev(every), every, from: 'p', step }, o)]); break;
    case 'ZIGZAG': out.push([pos, 'M', 'ZIGZAG', Object.assign({ n: ev(every), every, from: 'p', amp }, o)]); break;
    case 'BOUMTCHAK':
      out.push([pos, 'M', 'ZIGZAG', Object.assign({ n: ev(2), every: 2, from: 'p', amp: amp + 30 }, o)]);
      out.push([`${bar}:5`, 'M', 'LAMES', { n: ev(2), every: 2, from: 'opp', arc: 120 }]);
      break;
    case 'DEUX': out.push([pos, 'M', 'ZIGZAG', Object.assign({ n: ev(Math.max(1, every)), every: Math.max(1, every), from: 'p', amp, n2: 2, sep: rnd() < 0.5 ? 180 : 120 }, o)]); break;
    case 'DOUBLES': out.push([pos, 'M', 'DOUBLES', Object.assign({ n: ev(2), every: 2, from: 'p', step: step / 2 }, o)]); break;
    case 'SPIRALE': out.push([pos, 'M', 'SPIRALE', Object.assign({ n: ev(Math.max(1, every)), every: Math.max(1, every), from: 'p', rot: step > 0 ? 20 : -20 }, o)]); break;
    case 'EVENTAIL':
      out.push([pos, 'M', 'EVENTAIL', { n: 4, every: 0.5, from: 'p+90', step: 45 }]);
      out.push([`${bar}:9`, 'M', 'ZIGZAG', Object.assign({ n: ev(1) - 2, every: 1, from: 'p', amp: 60 }, o)]);
      break;
    case 'CROIX':
      out.push([pos, 'M', 'CROIX', { n: Math.max(1, Math.floor(bars / 2)), every: 8, from: 'p+45', rot: 90, d: 0.5 }]);
      out.push([pos, 'M', 'ZIGZAG', Object.assign({ n: ev(1), every: 1, from: 'p', amp: 40 }, o)]);
      break;
    case 'ETAU':
      out.push([pos, 'M', 'ETAU', Object.assign({ n: ev(4), every: 4, from: 'p' }, o)]);
      out.push([`${bar}:9`, 'M', 'ZIGZAG', Object.assign({ n: ev(4), every: 4, from: 'p', amp: 60 }, o)]);
      break;
    case 'IMPLO': out.push([pos, 'M', 'ZIGZAG', Object.assign({ type: 'I', n: ev(Math.max(1, every)), every: Math.max(1, every), from: 'p', amp }, o)]); break;
  }
  return out;
}
// motifs signature des boss (mini-boss : 4e bloc de chaque palier)
function miniBoss(which, gap) {
  if (which === 0) return [['1:1', 'M', 'DOUBLES', { n: 16, every: 2, from: 'p', step: 30, w: gap }], ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 120 }]];
  if (which === 1) return [['1:1', 'M', 'ZIGZAG', { n: 24, every: 1, from: 'p', amp: 70, w: gap }], ['7:1', 'M', 'ZIGZAG', { n: 9, every: 0.25, pat: 'xxxxxxxx....x...', from: 'p', amp: 12, sp: 'eclair', w: 'M' }]];
  return [['1:1', 'M', 'CROIX', { n: 16, every: 2, from: 'p+45', rot: 36, d: 1.75 }], ['1:5', 'M', 'ESCALIER', { n: 16, every: 2, from: 'p', step: 36, w: gap }]];
}

export class Infinite {
  constructor(seed, opts = {}) {
    this.seed = seed >>> 0;
    this.rnd = mulberry32(this.seed);
    this.chart = new Chart({ id: 'boucle', album: 1, title: opts.daily ? 'BOUCLE DU JOUR' : 'BOUCLE', bpm: 108, approach: 1.30, omegaMax: 440, gap: 'L', seed: this.seed }, {});
    this.chart.infinite = true;
    this.blocks = 0; this.retries = 0; this.fallbacks = 0;
    // décompte + intro d'une mesure (premier anneau ≥ 1 mesure après le décompte)
    this.chart.appendSection({ name: 'DÉCOMPTE', kind: 'count', bars: 1 });
    this.chart.appendSection({ name: 'INTRO', kind: 'intro', bars: 2, layers: { kick: 1 }, chart: [['2:1', 'R', 90, 'XL']] });
    this.chart.finalize();
  }
  snapshot() {
    const c = this.chart;
    return { o: c.obstacles.length, n: c.notes.length, s: c.sections.length, fx: c.fx.length, rots: c.rots.length, rk: c.rotKnots.length,
      nd: c.needles.length, segs: JSON.stringify(c.tempo.segs), beat: c.beat, prevGap: c.prevGap, lastRingGap: c.lastRingGap, duration: c.duration };
  }
  restore(s) {
    const c = this.chart;
    c.obstacles.length = s.o; c.notes.length = s.n; c.sections.length = s.s; c.fx.length = s.fx; c.rots.length = s.rots;
    c.rotKnots.length = s.rk; c.needles.length = s.nd; c.tempo.segs = JSON.parse(s.segs).map(x => (x.len === null ? Object.assign(x, { len: Infinity }) : x));
    c.beat = s.beat; c.prevGap = s.prevGap; c.lastRingGap = s.lastRingGap; c.duration = s.duration; c._rotIdx = 0;
    for (let i = 0; i < c.obstacles.length; i++) c.obstacles[i].i = i;
  }
  blockDef(L, rnd, forceTunnel) {
    const [name, kind] = KINDS[L % 4];
    const gap = blockGap(L, rnd);
    const album = (Math.floor(L / 4) % 3) + 1;
    const chart = [['1:1', 'TEMPO', blockBpm(L), L === 0 ? 0 : 4]];
    if (kind === 'drop') chart.push(['1:1', 'FX', 'DROP']);
    const mini = L % 4 === 3 && L > 0;
    if (L >= 10 && kind === 'drop' && !mini) { chart.push(['1:1', 'ROT', (rnd() < 0.5 ? -1 : 1) * (40 + Math.floor(rnd() * 3) * 20), 4], ['8:13', 'ROT', 0, 1]); }
    let macros;
    if (mini) macros = miniBoss(Math.floor(rnd() * 3), gap);
    else {
      const split = rnd() < 0.5 ? [[1, 4], [5, 4]] : [[1, 3], [4, 3], [7, 2]];
      macros = [];
      split.forEach(([bar, bars], k) => {
        if (forceTunnel === 'all' || (forceTunnel && k === split.length - 1)) macros.push([`${bar}:1`, 'M', 'TUNNEL', { n: bars * 4, every: 1, a: 'p', w: gap }]);
        else macros.push(...macroFor(L, rnd, bar, bars, kind, gap));
      });
    }
    return { name: mini ? 'MINI-BOSS' : name, kind, bars: BLOCK_BARS, block: L, mini, album, approach: blockApproach(L), gap, chart: chart.concat(macros) };
  }
  // ajoute le bloc suivant (validé) ; renvoie la section
  addBlock() {
    const L = this.blocks, c = this.chart;
    const G = crossingGroups(c), startT = G.length ? G[G.length - 1].t : 0;
    for (let attempt = 0; attempt < 7; attempt++) {
      const snap = this.snapshot();
      const force = attempt === 5 ? 'last' : attempt === 6 ? 'all' : null;
      const def = this.blockDef(L, this.rnd, force);
      let ok = false;
      try {
        c.appendSection(def); c.finalize();
        const v = validateChart(c, { omegaMax: blockOmega(L), startT: startT - 1e-6, infinite: true });
        ok = v.ok;
        if (!ok) this.lastErrors = v.errors;
      } catch (e) { ok = false; this.lastErrors = [String(e.message)]; }
      if (ok || attempt === 6) {
        if (attempt > 0) this.retries += attempt;
        if (attempt >= 5) this.fallbacks++;
        this.blocks++;
        return c.sections[c.sections.length - 1];
      }
      this.restore(snap);
    }
    return null;
  }
  // garantit que la charte couvre au moins jusqu'à t (+ marge de 2 blocs pour le spawn et la musique)
  ensure(t) {
    let n = 0;
    while (this.chart.duration < t + 12 && n++ < 4) this.addBlock();
    return n;
  }
}
