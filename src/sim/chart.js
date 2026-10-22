// Compilation d'un morceau (GAME_DESIGN §7) : sections → obstacles typés triés + notes de musique + carte de tempo,
// rotation d'arène, effets. Pur (aucun accès navigateur) : testable sous Node.
// La règle d'or : chaque obstacle reçoit la note de son instrument lié AU MÊME INSTANT (même calcul beat → seconde).
import { GAPS, GAP_ORDER, SPEEDS, D_OUT, D_IN, RAY_TELE_MIN, ALBUMS, wrap } from '../core/const.js';
import { TempoMap, swingWarp } from '../core/tempo.js';
import { arrangeSection, INST, linkedInst } from './music.js';

const RING_TYPES = { R: 1, I: 1, D: 1, W: 1 };
const MIN_LEAD = 0.42;

// '3:5' → (3−1)·bpb + (5−1)/4 ; '2:4/3' → (2−1)·bpb + (4−1)/3
export function parsePos(pos, bpb = 4) {
  if (typeof pos === 'number') return pos;
  const m = /^(\d+):(\d+)(\/3)?$/.exec(String(pos).trim());
  if (!m) throw new Error('position invalide : ' + pos);
  const bar = +m[1], step = +m[2];
  if (bar < 1 || step < 1) throw new Error('position invalide : ' + pos);
  if (m[3]) { if (step > bpb * 3) throw new Error('pas de triolet hors mesure : ' + pos); return (bar - 1) * bpb + (step - 1) / 3; }
  if (step > bpb * 4) throw new Error('pas hors mesure : ' + pos);
  return (bar - 1) * bpb + (step - 1) / 4;
}
// '1/2' → 0,5 noire ; 2 → 2 noires
export function parseEvery(e) {
  if (e === undefined || e === null) return 1;
  if (typeof e === 'number') return e;
  const m = /^(\d+)\/(\d+)$/.exec(String(e));
  if (m) return +m[1] / +m[2];
  const v = parseFloat(e); if (!isFinite(v)) throw new Error('every invalide : ' + e);
  return v;
}
// Angle : nombre absolu, 'p', 'p+45', 'p-90' (relatif à la brèche précédente), 'opp' (lames : opposé à la brèche
// de l'anneau qui précède dans le temps, résolu après tri).
function resolveAngle(spec, prev) {
  if (typeof spec === 'number') return wrap(spec);
  if (spec === undefined || spec === null) return wrap(prev);
  const s = String(spec);
  if (s === 'opp' || s === 'last') return s;
  const m = /^p([+-]\d+(?:\.\d+)?)?$/.exec(s);
  if (!m) throw new Error('angle invalide : ' + spec);
  return wrap(prev + (m[1] ? parseFloat(m[1]) : 0));
}
function gapW(code, fallback, shrink) {
  let c = code || fallback;
  if (typeof c === 'number') return c;
  if (!(c in GAPS)) throw new Error('taille de brèche inconnue : ' + c);
  if (shrink) c = GAP_ORDER[Math.min(GAP_ORDER.length - 1, GAP_ORDER.indexOf(c) + shrink)];
  return GAPS[c];
}

// Positions d'une macro : n positions espacées de `every`, ou selon un motif 'x..x..x.' (un caractère = every).
function macroBeats(b0, o) {
  const n = o.n || 1, every = parseEvery(o.every), out = [];
  if (o.pat) {
    const pat = String(o.pat);
    for (let k = 0; out.length < n; k++) {
      if (k > 10000) throw new Error('motif vide : ' + pat);
      if (pat[k % pat.length] !== '.') out.push(b0 + k * every);
    }
  } else for (let i = 0; i < n; i++) out.push(b0 + i * every);
  return out;
}

export class Chart {
  constructor(meta, opts = {}) {
    const alb = ALBUMS[meta.album] || ALBUMS[1];
    this.id = meta.id; this.title = meta.title; this.album = meta.album; this.n = meta.n;
    this.boss = !!meta.boss; this.bossKind = meta.bossKind || null;
    this.bpm = meta.bpm; this.bpb = meta.beatsPerBar || 4; this.swing = meta.swing || 0;
    this.key = meta.key || alb.key; this.scale = meta.scale || alb.scale;
    this.opts = { speed: opts.speed || 1, echo: !!opts.echo };
    this.approach = (meta.approach / this.opts.speed) * (this.opts.echo ? 0.8 : 1);
    this.omegaMax = this.opts.echo ? Math.min(500, meta.omegaMax + 60) : meta.omegaMax;
    this.gap = meta.gap || 'L';
    this.music = Object.assign({ kit: alb.kit, bass: alb.bass }, meta.music || {});
    this.tempo = new TempoMap(meta.bpm, this.opts.speed);
    this.sections = []; this.obstacles = []; this.notes = []; this.needles = [];
    this.rots = []; this.fx = []; this.rotKnots = [{ t: -1e9, w: 0, a: 0 }];
    this.beat = 0;            // temps-noire courant (fin de la dernière section ajoutée)
    this.prevGap = 90;        // brèche précédente (résolution des 'p')
    this.lastRingGap = 90;
    this.seed = meta.seed || 0;
    this.duration = 0;
    this.lastCrossT = 0;
    this._rotIdx = 0;
  }

  // ------------------------------------------------------------------ rotation d'arène (ROT)
  // vitesse angulaire w(t) : rampe linéaire vers la cible pendant la transition, puis constante. Angle = intégrale.
  addRot(t0, t1, target) {
    const K = this.rotKnots, last = K[K.length - 1];
    if (t0 < last.t) t0 = last.t;
    const a0 = last.a + last.w * (t0 - last.t);
    K.push({ t: t0, w: last.w, a: a0 });
    if (t1 > t0) K.push({ t: t1, w: target, a: a0 + ((last.w + target) / 2) * (t1 - t0) });
    else K.push({ t: t0, w: target, a: a0 });
  }
  rotAt(t) {
    const K = this.rotKnots;
    let i = this._rotIdx;
    if (i >= K.length || K[i].t > t) i = 0;
    while (i + 1 < K.length && K[i + 1].t <= t) i++;
    this._rotIdx = i;
    const k = K[i];
    if (i + 1 < K.length) {
      // dans une rampe : w varie linéairement entre k et k+1
      const n = K[i + 1], dt = t - k.t, span = n.t - k.t;
      if (span > 0 && n.w !== k.w) { const w = k.w + ((n.w - k.w) * dt) / span; return k.a + ((k.w + w) / 2) * dt; }
    }
    return k.a + k.w * (t - k.t);
  }

  secOf(beat) { return this.tempo.beatToSec(swingWarp(beat, this.swing)); }

  // ------------------------------------------------------------------ ajout d'une section
  appendSection(def) {
    const bpb = this.bpb, b0 = this.beat, beats = def.bars * bpb;
    const idx = this.sections.length;
    const sec = {
      idx, name: def.name, kind: def.kind, bars: def.bars, beat0: b0, beats, phase: def.phase || null,
      t0: 0, t1: 0, crossings: 0, album: def.album || this.album,
      approach: def.approach ? (def.approach / this.opts.speed) * (this.opts.echo ? 0.8 : 1) : this.approach,
      gap: def.gap || this.gap, block: def.block, mini: def.mini || null,
    };
    const shrink = this.opts.echo ? 1 : 0;
    // 1. événements globaux (TEMPO d'abord : ils déterminent les secondes)
    const chart = def.chart || [];
    const tempos = [];
    for (const ev of chart) if (ev[1] === 'TEMPO') tempos.push([b0 + parsePos(ev[0], bpb), ev[2], ev[3] || 0]);
    tempos.sort((a, b) => a[0] - b[0]);
    for (const [b, bpm, over] of tempos) this.tempo.addChange(b, bpm, over);
    sec.t0 = this.secOf(b0); sec.t1 = this.secOf(b0 + beats);
    this.sections.push(sec);

    // 2. dépliage des macros et des événements simples (angles 'p' résolus dans l'ordre de la liste)
    const raw = [];
    let prev = this.prevGap;
    const pushRing = (type, beat, ang, o, extra) => {
      void type; void beat; void ang; void o; void extra;
    };
    for (const ev of chart) {
      const [pos, type] = ev;
      if (type === 'TEMPO') continue;
      const beat = b0 + parsePos(pos, bpb);
      if (type === 'ROT') { const t0 = this.secOf(beat), t1 = this.secOf(beat + (ev[3] || 0)); this.addRot(t0, t1, ev[2]); this.rots.push({ beat, t: t0, speed: ev[2], sec: idx }); continue; }
      if (type === 'FX') { this.fx.push({ beat, t: this.secOf(beat), kind: ev[2], bars: ev[3] || (ev[2] === 'INVERSE' ? def.bars : 1), sec: idx }); continue; }
      if (type === 'N') {
        const bars = ev[4] || def.bars;
        this.needles.push({ beat0: beat, t0: this.secOf(beat), t1: this.secOf(beat + bars * bpb), center: wrap(ev[2]), amp: ev[3], sec: idx, beatEnd: beat + bars * bpb });
        continue;
      }
      if (type === 'M') { this._macro(ev[2], ev[3] || {}, beat, () => prev, v => { prev = v; }, raw, sec, shrink); continue; }
      const o = ev[4] || {};
      if (type === 'R' || type === 'I' || type === 'W') {
        const ang = resolveAngle(ev[2], prev); if (typeof ang === 'number') prev = ang;
        raw.push({ type, beat, ang, w: gapW(ev[3], sec.gap, shrink), n: o.n || 1, sep: o.sep || 180, sp: SPEEDS[o.sp] || 1, spName: o.sp || 'normal', rot: o.rot || (type === 'W' ? 20 : 0), offF: o.off });
      } else if (type === 'D') {
        const ang = resolveAngle(ev[2], prev); prev = ang;
        const base = { ang, w: gapW(ev[3], sec.gap, shrink), n: o.n || 1, sep: o.sep || 180, sp: SPEEDS[o.sp] || 1, spName: o.sp || 'normal', rot: 0 };
        raw.push(Object.assign({ type: 'R', beat, dbl: 1 }, base));
        raw.push(Object.assign({ type: 'R', beat: beat + 0.25, dbl: 2, thin: true }, base));
      } else if (type === 'A') {
        const ang = resolveAngle(ev[2], prev);
        raw.push({ type: 'A', beat, ang, arc: ev[3] || 120, sp: SPEEDS[o.sp] || 1, spName: o.sp || 'normal', rot: 0, offF: o.off });
      } else if (type === 'S') {
        const ang = resolveAngle(ev[2], prev);
        raw.push({ type: 'S', beat, ang, durB: ev[3] || 0.25, sp: 1, spName: 'normal', rot: 0 });
      } else throw new Error(`type inconnu « ${type} » (${this.id})`);
    }
    this.prevGap = prev;

    for (const e of raw) if (e.beat >= b0 + beats - 1e-9 || e.beat < b0 - 1e-9) throw new Error(`${this.id} : obstacle hors de la section ${def.name} (temps ${e.beat - b0})`);
    // 3. tri chronologique, 'opp', FX INVERSE (les anneaux deviennent des implosions)
    raw.sort((a, b) => a.beat - b.beat || (a.type === 'A') - (b.type === 'A'));
    let lastRing = this.lastRingGap;
    for (const e of raw) {
      if (e.ang === 'opp') e.ang = wrap(lastRing + 180);
      else if (e.ang === 'last') e.ang = lastRing;
      if (RING_TYPES[e.type]) lastRing = e.ang;
    }
    this.lastRingGap = lastRing;
    for (const f of this.fx) if (f.kind === 'INVERSE' && f.sec === idx) {
      const e0 = f.beat, e1 = f.beat + f.bars * bpb;
      for (const e of raw) if (e.beat >= e0 && e.beat < e1 && e.type === 'R') { e.type = 'I'; e.inv = true; }
    }

    // 4. musique de la section (avant les notes liées, pour ne pas doubler une note déjà présente)
    const firstNote = this.notes.length;
    arrangeSection(this, sec, def);

    // 5. obstacles compilés + note liée
    const have = new Set();
    for (let i = firstNote; i < this.notes.length; i++) { const nt = this.notes[i]; have.add(nt.inst + '@' + nt.beat.toFixed(5)); }
    for (const e of raw) {
      const ob = this._compileOb(e, sec);
      this.obstacles.push(ob);
      sec.crossings++;
      const inst = linkedInst(ob, this);
      const key = inst + '@' + ob.beat.toFixed(5);
      if (!have.has(key)) {
        have.add(key);
        this.notes.push({ beat: ob.beat, t: ob.tc, inst, p: 0, d: 0, v: ob.thin ? 0.55 : 1, sec: idx, linked: true, rev: !!e.inv });
      }
      ob.inst = inst;
    }
    this.notes.sort((a, b) => a.t - b.t || a.inst - b.inst);
    this.obstacles.sort((a, b) => a.tc - b.tc || a.i - b.i);
    for (let i = 0; i < this.obstacles.length; i++) this.obstacles[i].i = i;
    this.beat = b0 + beats;
    this.duration = sec.t1;
    return sec;
  }

  _compileOb(e, sec) {
    const tc = this.secOf(e.beat);
    const frac = e.beat - Math.floor(e.beat + 1e-9);
    const ob = {
      i: this.obstacles.length, type: e.type, beat: e.beat, tc, ang: e.ang, sec: sec.idx,
      w: e.w || 0, arc: e.arc || 0, n: e.n || 1, sep: e.sep || 180, sp: e.sp || 1, spName: e.spName || 'normal',
      off: e.offF !== undefined ? !!e.offF : frac > 1e-6, thin: !!e.thin, dbl: e.dbl || 0, etau: !!e.etau,
      rotPS: 0, lead: 0, v: 0, dur: 0, born: 0, inst: 0, inv: !!e.inv,
      // état d'exécution (remis à zéro par Game.reset)
      st: 0, judged: false, hit: false, grade: -1, noted: false, broke: -1,
    };
    if (e.type === 'S') {
      const bl = this.tempo.beatLenAt(tc);
      ob.lead = Math.max(bl, RAY_TELE_MIN);
      ob.dur = this.secOf(e.beat + e.durB) - tc;
    } else {
      ob.lead = Math.max(MIN_LEAD, sec.approach * ob.sp);
      ob.v = (e.type === 'I' ? D_IN : D_OUT) / ob.lead;
      if (e.type === 'W') ob.rotPS = (e.rot * this.tempo.bpmAt(e.beat)) / 60;   // °/temps → °/s
    }
    ob.born = tc - ob.lead;
    if (ob.type !== 'S' && ob.type !== 'A' && ob.n > 1) ob.sep = e.sep || 360 / ob.n;
    return ob;
  }

  _macro(name, o, b0, getPrev, setPrev, raw, sec, shrink) {
    const beats = macroBeats(b0, o);
    const ring = (type, beat, ang, extra) => {
      const a = resolveAngle(ang, getPrev()); if (typeof a === 'number') setPrev(a);
      raw.push(Object.assign({ type, beat, ang: a, w: gapW(o.w, sec.gap, shrink), n: o.n2 || 1, sep: o.sep || 180,
        sp: SPEEDS[o.sp] || 1, spName: o.sp || 'normal', rot: 0, offF: o.off }, extra || {}));
    };
    const from = o.from !== undefined ? o.from : o.a;
    switch (name) {
      case 'TUNNEL': {
        const a0 = resolveAngle(from, getPrev());
        for (const b of beats) ring(o.type || 'R', b, a0, o.type === 'W' ? { rot: o.rot || 20 } : null);
        break;
      }
      case 'ESCALIER': {
        const a0 = resolveAngle(from, getPrev()), step = o.step || 30;
        beats.forEach((b, i) => ring(o.type || 'R', b, wrap(a0 + i * step), o.type === 'W' ? { rot: o.rot || 20 } : null));
        break;
      }
      case 'ZIGZAG': {
        const a0 = resolveAngle(from, getPrev()), amp = o.amp || 60;
        beats.forEach((b, i) => ring(o.type || 'R', b, wrap(a0 + (i % 2 ? amp / 2 : -amp / 2)), o.type === 'W' ? { rot: o.rot || 20 } : null));
        break;
      }
      case 'SPIRALE': {
        const a0 = resolveAngle(from, getPrev()), rot = o.rot || 20, every = parseEvery(o.every);
        beats.forEach((b, i) => ring('W', b, wrap(a0 + i * rot * every), { rot }));
        break;
      }
      case 'ALTERNE': {
        const a0 = resolveAngle(from, getPrev());
        beats.forEach((b, i) => {
          if (i === 0) ring('R', b, a0, { n: 2, sep: 180 });
          else ring('R', b, wrap(a0 + (i % 2 ? 180 : 0)));
        });
        break;
      }
      case 'ETAU': case 'ÉTAU': {
        const a0 = resolveAngle(from, getPrev());
        for (const b of beats) { ring('R', b, a0, { etau: true }); ring('I', b, a0, { etau: true }); }
        break;
      }
      case 'EVENTAIL': case 'ÉVENTAIL': {
        const a0 = resolveAngle(from, getPrev()), step = o.step || 45;
        beats.forEach((b, i) => raw.push({ type: 'S', beat: b, ang: wrap(a0 + i * step), durB: o.d || 0.25, sp: 1, rot: 0 }));
        break;
      }
      case 'CROIX': {
        const a0 = resolveAngle(from, getPrev()), rot = o.rot || 45;
        beats.forEach((b, i) => { for (let k = 0; k < 4; k++) raw.push({ type: 'S', beat: b, ang: wrap(a0 + k * 90 + i * rot), durB: o.d || 0.25, sp: 1, rot: 0 }); });
        break;
      }
      case 'PORTE': {
        const a0 = resolveAngle(from, getPrev()), op = o.ouverture || 70, arc = o.arc || 110;
        for (const b of beats) for (const s of [-1, 1]) raw.push({ type: 'A', beat: b, ang: wrap(a0 + s * (op / 2 + arc / 2)), arc, sp: SPEEDS[o.sp] || 1, spName: o.sp || 'normal', rot: 0 });
        break;
      }
      case 'LAMES': {
        const arc = o.arc || 120, step = o.step || 0;
        beats.forEach((b, i) => {
          const a = from === 'opp' || from === undefined ? 'opp' : wrap(resolveAngle(from, getPrev()) + i * step);
          raw.push({ type: 'A', beat: b, ang: a, arc: Array.isArray(arc) ? arc[i % arc.length] : arc, sp: SPEEDS[o.sp] || 1, spName: o.sp || 'normal', rot: 0 });
        });
        break;
      }
      case 'DOUBLES': {   // doublés en série (lub-dub)
        const a0 = resolveAngle(from, getPrev()), step = o.step || 0;
        beats.forEach((b, i) => {
          const a = wrap(a0 + i * step); setPrev(a);
          const base = { ang: a, w: gapW(o.w, sec.gap, shrink), n: o.n2 || 1, sep: o.sep || 180, sp: SPEEDS[o.sp] || 1, spName: o.sp || 'normal', rot: 0 };
          raw.push(Object.assign({ type: 'R', beat: b, dbl: 1 }, base));
          raw.push(Object.assign({ type: 'R', beat: b + 0.25, dbl: 2, thin: true }, base));
        });
        break;
      }
      default: throw new Error('macro inconnue : ' + name);
    }
  }

  finalize() {
    // instant du dernier franchissement (victoire) ; durée = fin de la dernière section
    let last = 0;
    for (const o of this.obstacles) { const e = o.type === 'S' ? o.tc + o.dur : o.tc; if (e > last) last = e; }
    this.lastCrossT = last;
    this.crossings = this.obstacles.length;
    return this;
  }
}

export function compileSong(song, opts = {}) {
  const ch = new Chart(song, opts);
  for (const s of song.sections) ch.appendSection(s);
  return ch.finalize();
}

// Ordre de naissance (les lents naissent plus tôt, les rapides plus tard) : sert au spawn.
export function spawnOrder(chart) {
  return chart.obstacles.slice().sort((a, b) => a.born - b.born || a.i - b.i);
}
export { INST };
