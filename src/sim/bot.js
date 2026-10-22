// Bot planificateur (tests, simulation, démo du titre, test navigateur).
// Paramètres : vitesse max (°/s), latence de réaction (s), précision (0–1 : bruit de visée et de timing), graine.
// Planification : ensemble faisable calculé à rebours sur les `horizon` prochains franchissements (même modèle que le
// validateur), puis cible = case faisable la plus proche, de préférence au centre des brèches (zone PARFAIT).
import { STEP, ALPHA_H, RAY_HALF, GRACE, R_ORBIT, RWIN, wrap, adiff } from '../core/const.js';
import { mulberry32 } from '../core/rng.js';
import { CELLS, crossingGroups, blockRays, ringDist, markArc, cellOf, angOf, isRing, physMask, physTransition, makeWs } from './validate.js';

export class Bot {
  constructor(chart, o = {}) {
    this.chart = chart;
    this.speed = o.speed || 1440; this.latency = o.latency || 0; this.precision = o.precision === undefined ? 1 : o.precision;
    this.horizon = o.horizon || 6; this.react = o.react !== undefined ? o.react : 0.06; this.hold = !!o.hold;
    this.rng = mulberry32((o.seed || 1) >>> 0);
    this.groups = crossingGroups(chart); this.nObs = chart.obstacles.length;
    this.gi = 0; this.planned = -1; this.target = 90; this.noise = 0; this.delay = this.latency;
    this.F = []; for (let i = 0; i < 12; i++) this.F.push(new Uint8Array(CELLS));
    this.safe = new Uint8Array(CELLS); this.tmp = new Uint8Array(CELLS); this.tmp2 = new Uint8Array(CELLS);
    this.blocked = new Uint8Array(CELLS); this.dist = new Float64Array(CELLS); this.q = new Uint8Array(CELLS);
    this.ws = makeWs(); this.speedPlan = o.speedPlan || 1; this.jd = o.judgeDelay !== undefined ? o.judgeDelay : 0.03;
  }
  gauss() { const u = 1 - this.rng(), v = this.rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  refresh() {
    if (this.chart.obstacles.length !== this.nObs) {
      const t = this.groups[this.gi] ? this.groups[this.gi].t : -1e9;
      this.groups = crossingGroups(this.chart); this.nObs = this.chart.obstacles.length;
      this.gi = 0; while (this.gi < this.groups.length && this.groups[this.gi].t < t - 1e-6) this.gi++;
      this.planned = -1;
    }
  }

  // planifie la cible pour le groupe gi
  plan(phi) {
    const G = this.groups, ch = this.chart, H = Math.min(this.horizon, G.length - this.gi);
    if (H <= 0) return;
    // à rebours, avec le modèle physique du validateur (règle 1b) : F(k) = positions au franchissement k depuis
    // lesquelles toute la suite (sur l'horizon) reste faisable à la vitesse du bot
    const ws = this.ws, m = 1;
    physMask(ch, G[this.gi + H - 1], this.F[H - 1], m, ws.tmp);
    for (let k = H - 2; k >= 0; k--) {
      physTransition(ch, this.F[k + 1], G[this.gi + k + 1], G[this.gi + k], this.speed * this.speedPlan, this.F[k], ws, m);
      let any = 0; for (let i = 0; i < CELLS; i++) any |= this.F[k][i];
      if (!any) physMask(ch, G[this.gi + k], this.F[k], m, ws.tmp);
    }
    // cible : premier groupe contenant un anneau (les lames et rayons seuls n'imposent pas de position : on file
    // déjà vers l'anneau suivant, les fenêtres de contact sont respectées par moveOk)
    let ks = 0;
    for (let k = 0; k < H; k++) { if (G[this.gi + k].m.some(isRing)) { ks = k; break; } }
    const g = G[this.gi + ks], F0 = this.F[ks], q = this.q;
    q.fill(1);
    for (const ob of g.m) {
      const a = ob.ang;
      // zone PARFAIT visée (25 % de la demi-brèche), décalée de la rotation propre d'un W pendant le décalage de jugement
      if (isRing(ob)) { this.tmp.fill(0); const c = a + ob.rotPS * (this.jd + STEP); for (let s = 0; s < ob.n; s++) markArc(this.tmp, c + s * ob.sep, ob.w / 2 * 0.25, 1); for (let i = 0; i < CELLS; i++) q[i] &= this.tmp[i]; }
      else if (ob.type === 'A') markArc(q, a, ob.arc / 2 + 14, 0);
      else markArc(q, a, RAY_HALF + 14, 0);
    }
    // distance depuis la position courante (sans traverser les rayons actifs d'ici au franchissement)
    this.tmp2.fill(1); blockRays(ch, this.lastT, this.lastT, this.tmp2, 1);
    for (let i = 0; i < CELLS; i++) this.blocked[i] = this.tmp2[i] ? 0 : 1;
    const pa = phi - ch.rotAt(this.lastT);   // position dans le repère de l'arène
    this.tmp.fill(0); this.tmp[cellOf(pa)] = 1; this.blocked[cellOf(pa)] = 0;
    ringDist(this.tmp, this.blocked, this.dist);
    let best = -1, bd = 1e9, best2 = -1, bd2 = 1e9;
    for (let i = 0; i < CELLS; i++) {
      if (!F0[i]) continue;
      const d = this.dist[i];
      if (q[i] && d < bd) { bd = d; best = i; }
      if (d < bd2) { bd2 = d; best2 = i; }
    }
    let pick = best >= 0 ? best : best2;
    if (ks > 0 && pick >= 0) {
      // lames / rayons d'abord : on s'approche au plus près de la cible de l'anneau en restant sûr pour eux
      const S = this.tmp; S.set(this.F[0]);
      for (let k = 0; k < ks; k++) { physMask(ch, G[this.gi + k], this.tmp2, 1.5, ws.tmp); for (let i = 0; i < CELLS; i++) S[i] &= this.tmp2[i]; }
      // de préférence à ≥ 14° des lames et rayons (PARFAIT)
      const S2 = ws.c; S2.set(S);
      for (let k = 0; k < ks; k++) for (const ob of G[this.gi + k].m) {
        if (ob.type === 'A') markArc(S2, ob.ang, ob.arc / 2 + 14, 0); else if (ob.type === 'S') markArc(S2, ob.ang, RAY_HALF + 14, 0);
      }
      let any2 = 0; for (let i = 0; i < CELLS; i++) any2 |= S2[i] && this.dist[i] < 1e8;
      if (any2) S.set(S2);
      if (!S[pick]) {
        let b3 = -1, d3 = 1e9;
        for (let i = 0; i < CELLS; i++) if (S[i] && this.dist[i] < 1e8) { let d = Math.abs(i - pick); if (d > CELLS / 2) d = CELLS - d; if (d < d3) { d3 = d; b3 = i; } }
        if (b3 >= 0) pick = b3;
      }
    }
    if (pick >= 0) this.target = angOf(pick);
    // bruit de visée / de timing (précision)
    const p = this.precision;
    this.noise = p >= 1 ? 0 : this.gauss() * (1 - p) * 20;
    this.delay = Math.max(0, this.latency + (p >= 1 ? 0 : this.gauss() * (1 - p) * 0.05));
    this.planned = this.gi;
  }

  // angle monde visé (sans déplacer le Curseur) : sert au pilote tactile du test navigateur
  aim(game) {
    this.refresh();
    const t = game.t; this.lastT = t;
    const G = this.groups, jd = game.opts.judgeDelay + STEP;
    while (this.gi < G.length && G[this.gi].t + jd + this.delay < t - 1e-9) this.gi++;
    if (this.gi >= G.length) return game.phi;
    if (this.planned !== this.gi) this.plan(game.phi);
    return wrap(this.target + this.chart.rotAt(t));
  }
  // renvoie le déplacement (°) souhaité pour ce pas ; à appliquer via game.drag(), ou game.hold() en mode Maintenir
  update(game) {
    this.refresh();
    const t = game.t; this.lastT = t;
    const G = this.groups;
    // groupe visé : le premier non franchi (avec la latence : on reste sur l'ancien un peu après son passage)
    const jd = game.opts.judgeDelay + STEP;
    while (this.gi < G.length && G[this.gi].t + jd + this.delay < t - 1e-9) { this.gi++; }
    if (this.gi >= G.length) { if (this.hold) game.hold(0); return 0; }
    if (this.planned !== this.gi) this.plan(game.phi);
    const aim = wrap(this.target + this.chart.rotAt(t) + this.noise);
    let d = adiff(aim, game.phi);
    // sens de parcours : ne pas traverser un rayon actif
    d = this.routeDir(game, d);
    const maxStep = this.speed * STEP;
    let mv = Math.abs(d) <= maxStep ? d : Math.sign(d) * maxStep;
    // ne pas quitter une brèche pendant la fenêtre de contact d'un obstacle
    if (mv !== 0 && !this.moveOk(game, game.phi + mv)) mv = 0;
    // suivre une brèche qui tourne (W, rotation d'arène) pendant la fenêtre de contact
    if (mv === 0) { const tr = this.track(game, maxStep); if (tr !== 0 && this.moveOk(game, game.phi + tr)) mv = tr; }
    if (this.hold) {
      const dir = Math.abs(mv) > 0 && (Math.abs(d) > Math.max(0.6, game.holdV * STEP) || Math.sign(mv) !== Math.sign(d)) ? Math.sign(mv) : 0;
      game.hold(dir);
      return 0;
    }
    if (mv) game.drag(mv);
    return mv;
  }
  track(game, maxStep) {
    const tj = game.t + 2 * STEP - game.opts.judgeDelay;
    for (let i = 0; i < game.nActive; i++) {
      const ob = game.active[i];
      if (ob.hit || ob.type === 'S' || ob.type === 'A') continue;
      if (Math.abs(game.radius(ob, tj) - R_ORBIT) >= RWIN + 1) continue;
      const g = game.angleAt(ob, game.t + 2 * STEP);
      let best = 0, bd = 999;
      for (let q = 0; q < ob.n; q++) { const d = adiff(g + q * ob.sep, game.phi); if (Math.abs(d) < Math.abs(bd)) { bd = d; best = q; } }
      void best;
      if (Math.abs(bd) > ob.w / 2 + GRACE - ALPHA_H - 1.5) return Math.sign(bd) * Math.min(maxStep, Math.abs(bd));
    }
    return 0;
  }
  routeDir(game, d) {
    // y a-t-il un rayon actif (ou qui s'activera bientôt) sur l'arc parcouru dans le sens de d ?
    const ch = this.chart, t = game.t;
    const blockedOn = (from, delta) => {
      for (let i = 0; i < game.nActive; i++) {
        const ob = game.active[i];
        let lim;
        if (ob.type === 'S') { if (t > ob.tc + ob.dur + 0.02 || ob.tc - t > 0.25) continue; lim = RAY_HALF + ALPHA_H + 1; }
        else if (ob.type === 'A') {
          // lame imminente : ne pas passer à travers son arc (sauf si on y est déjà : il faut en sortir)
          if (t > ob.tc + 0.12 || ob.tc - t > 0.6) continue;
          lim = ob.arc / 2 + ALPHA_H + 1;
          if (Math.abs(adiff(game.angleAt(ob, t), from)) < lim) continue;
        } else continue;
        const a = game.angleAt(ob, t), rel = adiff(a, from);
        if (delta > 0 ? rel > -lim && rel < delta + lim : rel < lim && rel > delta - lim) return true;
      }
      return false;
    };
    if (!blockedOn(game.phi, d)) return d;
    const alt = d > 0 ? d - 360 : d + 360;
    if (!blockedOn(game.phi, alt)) return alt;
    return 0;
  }
  moveOk(game, phiNext) {
    const t = game.t, tj = t + STEP - game.opts.judgeDelay, ta = t + STEP;
    for (let i = 0; i < game.nActive; i++) {
      const ob = game.active[i];
      if (ob.hit) continue;
      if (ob.type === 'S') {
        if (tj >= ob.tc - 0.02 && tj <= ob.tc + ob.dur + 0.02 && Math.abs(adiff(phiNext, game.angleAt(ob, ta))) < RAY_HALF + ALPHA_H + 0.5) return false;
        continue;
      }
      const r = game.radius(ob, tj);
      // lames : on n'entre pas dans leur arc 0,12 s avant la fenêtre de contact (on risquerait d'y être pris)
      const pre = ob.type === 'A' && !ob.judged ? ob.v * 0.12 : 0;
      if (r < R_ORBIT - RWIN - 1 - pre || r > R_ORBIT + RWIN + 1) continue;
      const nowSafe = game.safeVs(ob, game.phi, t), nextSafe = this.safeStrict(game, ob, phiNext, ta);
      if (nowSafe && !nextSafe) return false;
    }
    // aiguilles
    const ch = this.chart;
    for (const nd of ch.needles) {
      if (tj < nd.t0 - 0.05 || tj > nd.t1 + 0.05) continue;
      const lim = nd.amp + RAY_HALF + ALPHA_H + 0.5, c = nd.center + ch.rotAt(ta);
      const dn = Math.abs(adiff(phiNext, c)), dc = Math.abs(adiff(game.phi, c));
      if (dn < lim && dn <= dc) return false;   // on peut toujours s'éloigner du centre de la zone (pour en sortir)
    }
    return true;
  }
  safeStrict(game, ob, phi, t) {
    if (ob.type === 'A') return Math.abs(adiff(phi, game.angleAt(ob, t))) >= ob.arc / 2 + ALPHA_H + 0.5;
    return game.nearestGap(ob, phi, t) <= ob.w / 2 + GRACE - ALPHA_H - 0.5;
  }
}

// Joue une partie complète sous Node avec un bot. Renvoie le résultat.
export function playWithBot(Game, chart, botOpts = {}, gameOpts = {}) {
  const game = new Game(chart, gameOpts);
  const bot = new Bot(chart, botOpts);
  const end = chart.lastCrossT + 1;
  let guard = 0;
  while (!game.over && game.t < end && guard++ < 2e6) {
    bot.update(game);
    game.step();
  }
  return { won: game.won, dead: game.dead, score: game.score, acc: game.accuracy(), perfect: game.perfect, good: game.good, ok: game.okc, miss: game.miss, hits: game.hits, maxCombo: game.maxCombo, pct: game.progress(), t: game.t, game };
}
