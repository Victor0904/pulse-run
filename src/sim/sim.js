// Simulation déterministe (GAME_DESIGN §2–§5) : avancée par pas fixes de 1/240 s jusqu'au temps de jeu `t`
// (dérivé de l'horloge audio). Aucune horloge propre, aucun accès navigateur, aucune allocation dans step().
import {
  R_ORBIT, R_EMIT, R_KILL, R_OUT, RWIN, ALPHA_H, GRACE, RAY_HALF, STEP, MAX_STEPS, INVULN, MAX_POULS, REGEN_PASSES,
  HOLD_SPEED, HOLD_RAMP, MAX_DRAG_SPEED, POOL_OBSTACLES, wrap, adiff,
} from '../core/const.js';
import { multFor, BASE_POINTS } from './scoring.js';

export const EV = {
  JUDGE: 1, HIT: 2, MULT: 3, POULS_UP: 4, SECTION_CLEAN: 5, DEATH: 6, WIN: 7, PASS: 8, SPAWN: 9, CRACK: 10,
  SECTION: 11, PALIER: 12, BEAT: 13, REVOKE: 14,
};
export const GRADE = { OK: 0, BIEN: 1, PARFAIT: 2, RATE: 3 };
const EV_CAP = 256;

export class Game {
  constructor(chart, opts = {}) {
    this.chart = chart;
    this.opts = Object.assign({ judgeDelay: 0.03, passLead: 0.06, infinitePouls: false, startSection: 0, mode: 'song' }, opts);
    this.active = new Array(POOL_OBSTACLES + 16).fill(null);
    this.events = []; for (let i = 0; i < EV_CAP; i++) this.events.push({ type: 0, t: 0, a: 0, b: 0, c: 0, ob: null });
    this.evHead = 0; this.evTail = 0;
    this.secStats = [];
    this.reset();
  }

  reset() {
    const ch = this.chart, o = this.opts;
    for (const ob of ch.obstacles) { ob.st = 0; ob.judged = false; ob.hit = false; ob.grade = -1; ob.noted = false; ob.broke = -1; ob.pts = 0; ob.passed = false; }
    this.nActive = 0; for (let i = 0; i < this.active.length; i++) this.active[i] = null;
    const s0 = ch.sections[o.startSection] || ch.sections[0];
    // entraînement : départ 1 mesure avant la section choisie (décompte)
    this.tStart = o.startSection > 0 ? s0.t0 - ch.tempo.beatLenAt(s0.t0) * ch.bpb : 0;
    this.skipBefore = o.startSection > 0 ? s0.t0 - 1e-6 : -1e9;
    this.t = this.tStart; this.prevT = this.t;
    this.phi = 90; this.phiPrev = 90; this.omega = 0;
    this.pending = 0; this.holdDir = 0; this.holdV = 0;
    this.pouls = MAX_POULS; this.combo = 0; this.maxCombo = 0; this.mult = 1; this.streak = 0;
    this.score = 0; this.perfect = 0; this.good = 0; this.okc = 0; this.miss = 0; this.hits = 0; this.judgedN = 0;
    this.invulnUntil = -1e9; this.lastHitT = -1e9;
    this.dead = false; this.won = false; this.over = false; this.deathT = 0; this.fatal = null;
    this.lastJudgedTc = 0; this.secIdx = this.sectionAt(this.t); this.secDone = this.secIdx;
    this.secStats.length = 0;
    for (let i = 0; i < ch.sections.length; i++) this.secStats.push({ n: 0, miss: 0, perfect: 0 });
    this.cleanSections = 0; this.cleanRun = 0; this.maxCleanRun = 0; this.cracks = 0;
    this.needleHit = new Int32Array(Math.max(1, ch.needles.length)).fill(-1);
    this.lastBeat = Math.floor(ch.tempo.secToBeat(this.t));
    this.beatsSurvived = 0; this.moved = 0;
    this.buildOrder();
    this.evHead = this.evTail = 0;
  }
  buildOrder() {
    this.order = this.chart.obstacles.filter(ob => ob.st === 0).sort((a, b) => a.born - b.born || a.tc - b.tc);
    this.ip = 0;
  }
  sectionAt(t) {
    const S = this.chart.sections;
    for (let i = S.length - 1; i >= 0; i--) if (t >= S[i].t0) return i;
    return 0;
  }

  // ------------------------------------------------------------------ événements (file circulaire pré-allouée)
  emit(type, a = 0, b = 0, c = 0, ob = null) {
    const e = this.events[this.evTail];
    e.type = type; e.t = this.t; e.a = a; e.b = b; e.c = c; e.ob = ob;
    this.evTail = (this.evTail + 1) % EV_CAP;
    if (this.evTail === this.evHead) this.evHead = (this.evHead + 1) % EV_CAP; // débordement : on perd le plus ancien
  }
  pollEvent() {
    if (this.evHead === this.evTail) return null;
    const e = this.events[this.evHead]; this.evHead = (this.evHead + 1) % EV_CAP; return e;
  }

  // ------------------------------------------------------------------ entrées
  drag(dDeg) { this.pending += dDeg; this.moved += Math.abs(dDeg); }
  hold(dir) { if (dir !== this.holdDir) { if (dir === 0 || Math.sign(dir) !== Math.sign(this.holdDir)) this.holdV = 0; this.holdDir = dir; } }

  // ------------------------------------------------------------------ géométrie
  radius(ob, t) {
    return ob.type === 'I' ? R_ORBIT + (ob.tc - t) * ob.v : R_ORBIT - (ob.tc - t) * ob.v;
  }
  angleAt(ob, t) { const ch = this.chart; return ob.ang + ch.rotAt(t) + ob.rotPS * (t - ob.tc); }
  // distance angulaire du Curseur à la brèche la plus proche (centre) → { d, c }
  nearestGap(ob, phi, t) {
    const g = this.angleAt(ob, t);
    let bd = 999;
    for (let q = 0; q < ob.n; q++) { const d = Math.abs(adiff(phi, g + q * ob.sep)); if (d < bd) bd = d; }
    return bd;
  }
  // le Curseur est-il en sécurité face à `ob` à l'instant t (géométrie de collision) ?
  safeVs(ob, phi, t) {
    if (ob.type === 'A') return Math.abs(adiff(phi, this.angleAt(ob, t))) >= ob.arc / 2 + ALPHA_H;
    if (ob.type === 'S') return Math.abs(adiff(phi, this.angleAt(ob, t))) >= RAY_HALF + ALPHA_H;
    // anneau : entièrement dans une brèche élargie de GRACE
    return this.nearestGap(ob, phi, t) <= ob.w / 2 + GRACE - ALPHA_H;
  }
  gradeOf(ob, phi, t) {
    if (ob.type === 'A') return Math.abs(adiff(phi, this.angleAt(ob, t))) - ob.arc / 2 >= 12 ? 2 : 1;
    if (ob.type === 'S') return Math.abs(adiff(phi, this.angleAt(ob, t))) - RAY_HALF >= 12 ? 2 : 1;
    const dl = this.nearestGap(ob, phi, t) / (ob.w / 2);
    return dl <= 0.45 ? 2 : dl <= 0.8 ? 1 : 0;
  }

  // ------------------------------------------------------------------ avance jusqu'à t (pas fixes)
  advanceTo(tTarget) {
    let n = 0;
    while (!this.over && this.t + STEP <= tTarget + 1e-9 && n < MAX_STEPS) { this.step(); n++; }
    // retard trop important (onglet gelé) : on rattrape sans simuler chaque pas intermédiaire au-delà de 32
    if (!this.over && tTarget - this.t > STEP * MAX_STEPS) { while (!this.over && this.t + STEP <= tTarget) this.step(); }
    return n;
  }

  step() {
    const ch = this.chart;
    this.prevT = this.t; this.phiPrev = this.phi;
    const t = (this.t += STEP);
    // contrôle
    if (this.pending !== 0) {
      const cap = MAX_DRAG_SPEED * STEP;
      const mv = this.pending > cap ? cap : this.pending < -cap ? -cap : this.pending;
      this.phi += mv; this.pending -= mv;
    }
    if (this.holdDir !== 0) {
      this.holdV = Math.min(HOLD_SPEED, this.holdV + (HOLD_SPEED / HOLD_RAMP) * STEP);
      this.phi += this.holdDir * this.holdV * STEP;
    }
    this.phi = wrap(this.phi);
    const w = adiff(this.phi, this.phiPrev) / STEP;
    this.omega += (w - this.omega) * 0.25;

    // naissances
    const ord = this.order;
    while (this.ip < ord.length && ord[this.ip].born <= t) {
      const ob = ord[this.ip++];
      if (ob.tc < this.skipBefore) { ob.st = 3; continue; }
      if (ob.st !== 0) continue;
      ob.st = 1; this.addActive(ob);
      this.emit(EV.SPAWN, 0, 0, 0, ob);
    }

    const tj = t - this.opts.judgeDelay;
    const phi = this.phi;
    const A = this.active;
    for (let i = 0; i < this.nActive; i++) {
      const ob = A[i];
      if (this.over) break;
      // note de passage : décidée un peu avant tc si le Curseur est déjà en sécurité
      if (!ob.noted && t >= ob.tc - this.opts.passLead) {
        ob.noted = true;
        if (this.safeVs(ob, phi, ob.tc)) this.emit(EV.PASS, this.gradeOf(ob, phi, ob.tc), ob.type === 'A' || ob.type === 'S' ? 1 : 0, 0, ob);
      }
      if (ob.type === 'S') {
        const on = tj >= ob.tc && tj <= ob.tc + ob.dur;
        if (!ob.judged && tj >= ob.tc) this.judge(ob, t);
        else if (on && !ob.hit && !this.safeVs(ob, phi, t)) this.hit(ob, t);
        continue;
      }
      const r = this.radius(ob, tj);
      const inWin = Math.abs(r - R_ORBIT) < RWIN;
      if (!ob.judged && tj >= ob.tc) this.judge(ob, t);
      else if (inWin && !ob.hit && !this.safeVs(ob, phi, t)) this.hit(ob, t);
    }
    // aiguilles (boss Métronome)
    const N = ch.needles;
    for (let k = 0; k < N.length; k++) {
      const nd = N[k];
      if (tj < nd.t0 || tj > nd.t1) continue;
      const b = ch.tempo.secToBeat(tj) - nd.beat0, ang = nd.center + ch.rotAt(t) - nd.amp * Math.cos(Math.PI * b);
      if (Math.abs(adiff(phi, ang)) < RAY_HALF + ALPHA_H) {
        const swing = Math.floor(b + 0.5);
        if (this.needleHit[k] !== swing) { this.needleHit[k] = swing; this.hit(null, tj, k); }
      }
    }
    // retrait des obstacles sortis
    let j = 0;
    for (let i = 0; i < this.nActive; i++) {
      const ob = A[i];
      let keep = true;
      if (ob.type === 'S') keep = t <= ob.tc + ob.dur + 0.12;
      else { const r = this.radius(ob, t); keep = ob.type === 'I' ? r >= R_EMIT - 2 : r <= R_KILL; }
      if (keep) A[j++] = ob; else { ob.st = 2; A[i] = null; }
    }
    for (let i = j; i < this.nActive; i++) A[i] = null;
    this.nActive = j;

    // temps (Boucle : +10 × mult par temps survécu)
    const beatNow = Math.floor(ch.tempo.secToBeat(t));
    if (beatNow > this.lastBeat) {
      this.lastBeat = beatNow;
      if (t >= 0) { this.beatsSurvived++; if (this.opts.mode === 'infinite') this.score += 10 * this.mult; }
    }
    // fin de section (après la fenêtre de jugement du dernier obstacle)
    const S = ch.sections;
    while (this.secDone < S.length && t >= S[this.secDone].t1 + 0.25) { this.endSection(this.secDone); this.secDone++; }
    const si = this.sectionAt(t);
    if (si !== this.secIdx) { this.secIdx = si; this.emit(EV.SECTION, si); this.onSection(si); }
    // victoire
    if (this.opts.mode !== 'infinite' && !this.over && t >= ch.lastCrossT + 0.3) {
      this.won = true;
      for (; this.secDone < S.length; this.secDone++) this.endSection(this.secDone);
      this.over = true; this.emit(EV.WIN);
    }
  }

  addActive(ob) {
    if (this.nActive >= this.active.length) {
      // pool plein : on recycle l'obstacle le plus avancé au-delà de l'orbite (jamais un obstacle à venir)
      let best = -1, bt = 1e9;
      for (let i = 0; i < this.nActive; i++) if (this.active[i].judged && this.active[i].tc < bt) { bt = this.active[i].tc; best = i; }
      if (best < 0) return;
      this.active[best].st = 2; this.active[best] = ob; return;
    }
    this.active[this.nActive++] = ob;
  }

  judge(ob, tj) {
    ob.judged = true;
    this.lastJudgedTc = ob.tc;
    if (ob.hit) return;
    if (!this.safeVs(ob, this.phi, tj)) { this.hit(ob, tj); return; }
    const g = this.gradeOf(ob, this.phi, tj);
    this.award(ob, g);
  }

  award(ob, g) {
    ob.grade = g; ob.passed = true;
    this.combo++; this.streak++; this.judgedN++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const m = multFor(this.combo);
    if (m > this.mult) this.emit(EV.MULT, m);
    this.mult = m;
    const pts = BASE_POINTS[g] * m;
    ob.pts = pts; this.score += pts;
    if (g === 2) this.perfect++; else if (g === 1) this.good++; else this.okc++;
    const ss = this.secStats[ob.sec]; if (ss) { ss.n++; if (g === 2) ss.perfect++; }
    this.emit(EV.JUDGE, g, ob.type === 'A' || ob.type === 'S' ? 1 : 0, this.combo, ob);
    if (this.streak >= REGEN_PASSES) {
      this.streak = 0;
      if (this.pouls < MAX_POULS) { this.pouls++; this.emit(EV.POULS_UP, this.pouls); }
    }
  }

  // RATÉ : −1 Pouls (sauf invulnérabilité), combo à 0. Un obstacle ne frappe qu'une fois.
  hit(ob, tj, needle = -1) {
    const t = this.t;
    if (ob) {
      if (ob.hit) return;
      ob.hit = true; ob.broke = this.phi;
      if (ob.passed) {
        // l'obstacle avait été jugé réussi à tc mais touche pendant la fin de sa fenêtre : on annule le gain
        this.score -= ob.pts; ob.pts = 0;
        if (ob.grade === 2) this.perfect--; else if (ob.grade === 1) this.good--; else if (ob.grade === 0) this.okc--;
        const ss0 = this.secStats[ob.sec]; if (ss0 && ob.grade === 2) ss0.perfect--;
        if (ss0) ss0.n--;
        this.judgedN--; ob.passed = false; this.emit(EV.REVOKE, 0, 0, 0, ob);
      }
      if (!ob.judged) { ob.judged = true; this.lastJudgedTc = ob.tc; }
      ob.grade = 3;
      this.miss++; this.judgedN++;
      const ss = this.secStats[ob.sec]; if (ss) { ss.n++; ss.miss++; }
    } else {
      const ss = this.secStats[this.secIdx]; if (ss) ss.miss++;
    }
    this.combo = 0; this.streak = 0; this.mult = 1;
    if (t < this.invulnUntil) return;   // compté RATÉ, sans perte de Pouls
    this.invulnUntil = t + INVULN; this.lastHitT = t; this.hits++;
    if (!this.opts.infinitePouls) this.pouls--;
    this.emit(EV.HIT, this.pouls, needle, 0, ob);
    if (this.pouls <= 0 && !this.opts.infinitePouls) {
      this.pouls = 0; this.dead = true; this.over = true; this.deathT = t; this.fatal = ob;
      this.emit(EV.DEATH, 0, 0, 0, ob);
    }
  }

  endSection(i) {
    const ss = this.secStats[i], sec = this.chart.sections[i];
    if (!ss || this.over) return;
    if (sec.t0 < this.skipBefore - 1e-3) return;
    if (ss.n > 0 && ss.miss === 0) {
      const bonus = 1000 * this.mult; this.score += bonus; this.cleanSections++; this.cleanRun++;
      if (this.cleanRun > this.maxCleanRun) this.maxCleanRun = this.cleanRun;
      this.emit(EV.SECTION_CLEAN, bonus, i);
    } else if (ss.n > 0) this.cleanRun = 0;
    // Résonance (boss) : ≥ 70 % de PARFAIT dans la phase → fissure + 5 000 × mult
    if (sec.phase && ss.n > 0 && ss.perfect / ss.n >= 0.7) {
      const bonus = 5000 * this.mult; this.score += bonus; this.cracks++;
      this.emit(EV.CRACK, bonus, i);
    }
  }
  onSection(i) {
    const sec = this.chart.sections[i];
    if (sec && sec.block > 0 && sec.block % 4 === 0 && this.opts.mode === 'infinite') {
      if (this.pouls < MAX_POULS) this.pouls++;
      this.emit(EV.PALIER, sec.block);
    }
  }

  // ------------------------------------------------------------------ résultats
  get crossingsTotal() { return this.perfect + this.good + this.okc + this.miss; }
  accuracy() {
    const n = this.perfect + this.good + this.okc + this.miss;
    return n ? (this.perfect + 0.7 * this.good + 0.35 * this.okc) / n : 0;
  }
  progress() {
    const d = this.chart.duration || 1;
    return Math.max(0, Math.min(1, (this.won ? d : this.lastJudgedTc) / d));
  }
}
