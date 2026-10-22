// Arrangement génératif (DESIGN §11.3) : notes de musique d'une section, calculées à la compilation à partir du
// style d'album, du type de section et des couches. Pur (testable sous Node). Les notes portent leur instant en
// secondes, calculé par la même carte de tempo que les obstacles.
import { ALBUMS, wrap } from '../core/const.js';
import { mulberry32, hashString } from '../core/rng.js';

export const INST = {
  K: 0, GK: 1, CL: 2, SN: 3, GH: 4, HH: 5, OH: 6, CR: 7, WD: 8, BS: 9, PD: 10, AR: 11, LD: 12, RI: 13, SB: 14, SW: 15, ST: 16,
};
export const INST_NAMES = ['kick', 'ghostkick', 'clap', 'snare', 'ghost', 'hat', 'openhat', 'crash', 'bois', 'basse', 'pad', 'arp', 'lead', 'riser', 'subdrop', 'souffle', 'stab'];

// Instrument lié à chaque type d'obstacle (GAME_DESIGN §4.2, §7.4-5)
export function linkedInst(ob, chart) {
  const sec = chart.sections[ob.sec], alb = sec ? sec.album : chart.album;
  switch (ob.type) {
    case 'R': return ob.dbl === 2 ? INST.GK : INST.K;
    case 'I': return INST.SW;
    case 'W': return INST.AR;
    case 'A': return alb === 3 ? INST.SN : INST.CL;
    case 'S': return alb === 3 ? INST.ST : INST.CR;
  }
  return INST.K;
}
export function linkedOk(ob, inst) {
  switch (ob.type) {
    case 'R': return inst === INST.K || inst === INST.GK;
    case 'I': return inst === INST.SW;
    case 'W': return inst === INST.AR;
    case 'A': return inst === INST.CL || inst === INST.SN;
    case 'S': return inst === INST.CR || inst === INST.ST;
  }
  return false;
}

const ROOTS = { A: 57, D: 50, F: 53, C: 48, E: 52, G: 55 };
export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
};
const ROMAN = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };
export function chordNotes(roman, key, scale) {
  const root = ROOTS[key] ?? 57, sc = SCALES[scale] || SCALES.minor;
  const r = String(roman).replace(/^b/, '').replace(/7$/, '').toUpperCase();
  const d = ROMAN[r] ?? 0, seventh = /7$/.test(roman);
  const deg = k => root + sc[(d + k) % 7] + 12 * Math.floor((d + k) / 7);
  const out = [deg(0), deg(2), deg(4)];
  if (seventh) out.push(deg(6));
  return out;
}
// Pentatonique mineure (notes de passage, lead) à partir de la tonique, octave donnée
export function pentatonic(key, octave = 5) {
  const base = (ROOTS[key] ?? 57) % 12 + 12 * (octave + 1);
  const iv = [0, 3, 5, 7, 10], out = [];
  for (let k = 0; k < 10; k++) out.push(base + iv[k % 5] + 12 * Math.floor(k / 5));
  return out;
}

const KITS = {
  house: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', h16: 'xxxxxxxxxxxxxxxx' },
  funk: { k: 'x.....x...x.....', s: '....x.......x...', g: '..x..x....x..x.x', h: 'xxoxxxoxxxoxxxox', h16: 'xxoxxxoxxxoxxxox' },
  rave: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', h16: 'x.xxx.xxx.xxx.xx' },
  dnb: { k: 'x.........x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', h16: 'xxxxxxxxxxxxxxxx' },
};
const LAYERS = {
  count: { hat: 1, wood: 1 },
  intro: { hat: 1, pad: 1, kick: 'from5' },
  verse: { kick: 1, clap: 1, hat: 1, bass: 1, pad: 1 },
  build: { kick: 'build', clap: 'roll', hat: 1, bass: 'cutlast', pad: 1, arp: 1, riser: 1 },
  chorus: { kick: 1, clap: 1, hat: '16', bass: 1, pad: 1, arp: 1, lead: 1, crash: 1 },
  drop: { kick: 1, clap: 1, hat: 1, bass: 'oct', arp: 1, lead: 1, sub: 1, crash: 1 },
  pause: { pad: 1, arp: 'lp' },
  outro: { kick: 'first', hat: 1, pad: 1, crash: 1 },
};

function leadMotif(chart) {
  if (chart._lead) return chart._lead;
  const rnd = mulberry32(hashString(chart.id + ':lead'));
  const m = [];
  for (let s = 0; s < 32; s += 2) {
    if (rnd() < (s % 8 === 0 ? 0.85 : 0.5)) m.push([s, Math.floor(rnd() * 7), rnd() < 0.3 ? 4 : 2]);
  }
  return (chart._lead = m);
}

export function arrangeSection(chart, sec, def) {
  const notes = chart.notes, bpb = chart.bpb;
  const albN = sec.album || chart.album, alb = ALBUMS[albN] || ALBUMS[1];
  const key = def.album ? alb.key : chart.key, scale = def.album ? alb.scale : chart.scale;
  const kitName = (def.music && def.music.kit) || (def.album ? alb.kit : chart.music.kit);
  const kit = KITS[kitName] || KITS.house;
  const bassKind = (def.music && def.music.bass) || (def.album ? alb.bass : chart.music.bass);
  const L = Object.assign({}, LAYERS[sec.kind] || LAYERS.verse);
  if (def.layers) for (const k of Object.keys(def.layers)) L[k] = def.layers[k] ? (L[k] && L[k] !== 0 ? L[k] : 1) : 0;
  const dr = def.drums || {};
  const pk = dr.k || kit.k, ps = dr.s || kit.s, pg = dr.g || kit.g, ph = dr.h || (L.hat === '16' ? kit.h16 : kit.h);
  const chords = def.chords || (def.album ? alb.chords : null) || chart.chordsDefault || alb.chords;
  const songBar0 = Math.round(sec.beat0 / bpb);
  const penta = pentatonic(key, 5), motif = leadMotif(chart);
  const add = (beat, inst, p, lenBeats, v, extra) => {
    const t = chart.secOf(beat);
    const n = { beat, t, inst, p, d: lenBeats ? chart.secOf(beat + lenBeats) - t : 0, v, sec: sec.idx, linked: false, rev: false };
    if (extra) Object.assign(n, extra);
    notes.push(n);
  };
  const half = def.half || false; // demi-temps (LFO 1/4)
  for (let bar = 0; bar < sec.bars; bar++) {
    const bb = sec.beat0 + bar * bpb;
    const lastBar = bar === sec.bars - 1, last2 = bar >= sec.bars - 2;
    const ch = chordNotes(chords[(def.chords ? bar : songBar0 + bar) % chords.length], key, scale);
    const root = ch[0];
    for (let s = 0; s < bpb * 4; s++) {
      const b = bb + s / 4, c16 = s % 16;
      // kick
      let k = false;
      if (L.kick === 1) k = pk[c16] === 'x';
      else if (L.kick === 'from5') k = bar >= 4 && pk[c16] === 'x';
      else if (L.kick === 'first') k = bar === 0 && c16 % 4 === 0;
      else if (L.kick === 'build') k = last2 ? c16 % 2 === 0 : c16 % 4 === 0;
      if (k) add(b, INST.K, 0, 0, 0.9);
      // caisse / clap
      const snareInst = albN === 3 ? INST.SN : INST.CL;
      if (L.clap === 1 && ps[c16] === 'x') add(b, snareInst, 0, 0, 0.9);
      else if (L.clap === 'roll') {
        // roulement : noires, puis croches (2e moitié), puis doubles-croches (dernière mesure)
        if (lastBar || (bar >= sec.bars / 2 && c16 % 2 === 0) || c16 % 4 === 0) add(b, snareInst, 0, 0, 0.35 + 0.5 * (bar + c16 / 16) / sec.bars);
      }
      if (L.clap === 1 && pg && pg[c16] === 'x') add(b, INST.GH, 0, 0, 0.3);
      // hats
      if (L.hat) { const hc = ph[c16]; if (hc === 'x') add(b, INST.HH, 0, 0, c16 % 4 === 2 ? 0.9 : 0.55); else if (hc === 'o') add(b, INST.OH, 0, 0, 0.8); }
      // basse
      if (L.bass && !(L.bass === 'cutlast' && lastBar)) {
        const oct = L.bass === 'oct' ? 0 : -12;
        if (bassKind === 'rond') { if (c16 % 2 === 0) add(b, INST.BS, root - 12 + oct + (c16 >= 12 ? 12 : 0), 0.5, 0.9); }
        else if (bassKind === 'funk') {
          const pat = 'x..x..x...x.x...';
          if (pat[c16] === 'x') { const seq = [0, 0, 7, 12, 0, 10]; add(b, INST.BS, root - 12 + oct + seq[(c16 + bar) % seq.length], 0.5, 0.9, { glide: c16 > 0 }); }
        } else if (c16 === 0) add(b, INST.BS, root - 12 + oct, bpb, 0.9, { lfo: half ? 1 : sec.kind === 'drop' ? 0.25 : 0.5 });
      }
      // arpège (doubles-croches, notes de l'accord)
      if (L.arp && (L.arp !== 'lp' || c16 % 2 === 0)) {
        if (c16 % 2 === 0 || sec.kind === 'drop' || sec.kind === 'chorus') add(b, INST.AR, ch[(s >> (L.arp === 'lp' ? 1 : 0)) % ch.length] + 12, 0.25, L.arp === 'lp' ? 0.5 : 0.7, L.arp === 'lp' ? { lp: true } : null);
      }
      // bois du décompte
      if (L.wood && c16 % 4 === 0) add(b, INST.WD, c16 === 0 ? 1600 : 1200, 0, 1);
    }
    // pad (accord tenu une mesure)
    if (L.pad) for (const n of ch) add(bb, INST.PD, n, bpb, 1);
    // lead (motif de 2 mesures)
    if (L.lead) for (const [st, deg, len] of motif) {
      if ((st >> 4) !== bar % 2) continue;
      add(bb + (st % 16) / 4, INST.LD, penta[deg], len / 4, 0.8);
    }
  }
  if (L.riser) add(sec.beat0, INST.RI, 0, sec.beats, 1);
  if (L.crash) add(sec.beat0, INST.CR, 0, 0, 0.9);
  if (L.sub) add(sec.beat0, INST.SB, 0, 0, 1);
  // FX de la section : DROP = sub-drop + crash
  for (const f of chart.fx) if (f.sec === sec.idx && f.kind === 'DROP' && f.beat !== sec.beat0) { add(f.beat, INST.SB, 0, 0, 1); add(f.beat, INST.CR, 0, 0, 0.9); }
  // INVERSE : enveloppes à l'envers dans la plage
  for (const f of chart.fx) if (f.sec === sec.idx && f.kind === 'INVERSE') {
    const e0 = f.beat, e1 = f.beat + f.bars * bpb;
    for (let i = notes.length - 1; i >= 0 && notes[i].sec === sec.idx; i--) if (notes[i].beat >= e0 && notes[i].beat < e1) notes[i].rev = true;
  }
  return wrap(0);
}
