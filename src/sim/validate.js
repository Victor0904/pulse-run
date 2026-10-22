// Validateur d'équité (GAME_DESIGN §7.4). Bloquant dans les tests : chaque morceau livré, chaque charte Écho et
// 200 graines de Boucle doivent passer. Travaille sur une grille angulaire de 0,5° (720 cases).
// Règle 1 implémentée par propagation de l'ensemble atteignable : R(j) = dilatation(R(i), ω·max(0, Δt − 0,10)) ∩ sûr(j),
// ce qui couvre aussi les enchaînements à plusieurs franchissements (un choix de côté qui mènerait à une impasse).
import { ALPHA_H, RAY_HALF, R_ORBIT, RWIN, GRACE, MAX_IN_FLIGHT, MAX_RAYS, REACTION, GAPS, wrap } from '../core/const.js';
import { linkedOk } from './music.js';

export const CELLS = 720, CELL = 360 / CELLS;
const INF = 1e9;
export const cellOf = a => Math.floor(wrap(a) / CELL + 1e-9) % CELLS;
export const angOf = c => (c + 0.5) * CELL;

// met `val` sur les cases à moins de `half` degrés de `center` (bornes incluses côté intérieur)
export function markArc(mask, center, half, val) {
  if (half <= 0) return;
  if (half >= 180) { mask.fill(val); return; }
  const c = wrap(center);
  const a0 = c - half, n = Math.ceil((2 * half) / CELL) + 2;
  let k = Math.floor(wrap(a0) / CELL);
  for (let i = 0; i < n; i++) {
    const idx = (k + i) % CELLS, ang = angOf(idx);
    let d = Math.abs(ang - c); if (d > 180) d = 360 - d;
    if (d <= half) mask[idx] = val;
  }
}

// angle monde d'un obstacle à l'instant t (brèche / centre d'arc / rayon)
export function obAngle(chart, ob, t) {
  return ob.ang + chart.rotAt(t) - chart.rotAt(ob.tc) + ob.rotPS * (t - ob.tc) + chart.rotAt(ob.tc);
}
export function needleAngle(chart, nd, t) {
  const b = chart.tempo.secToBeat(t) - nd.beat0;
  return nd.center - nd.amp * Math.cos(Math.PI * b);
}
export const isRing = ob => ob.type === 'R' || ob.type === 'I' || ob.type === 'W';

// Groupes de franchissements simultanés (≤ 2 ms)
export function crossingGroups(chart) {
  const G = [];
  for (const ob of chart.obstacles) {
    const g = G[G.length - 1];
    if (g && ob.tc - g.t < 0.002) g.m.push(ob); else G.push({ t: ob.tc, m: [ob] });
  }
  return G;
}

// Masque des positions sûres pour un groupe (brèches visuelles rétrécies de αh ; lames et rayons élargis de αh)
export function safeMask(chart, g, out, opts = {}) {
  const mask = out || new Uint8Array(CELLS);
  const shrink = opts.shrink !== undefined ? opts.shrink : ALPHA_H;
  mask.fill(1);
  const tmp = opts.tmp || new Uint8Array(CELLS);
  for (const ob of g.m) {
    const a = ob.ang;   // repère de l'arène (la rotation d'arène est comptée en réduisant ω)
    if (isRing(ob)) {
      tmp.fill(0);
      for (let q = 0; q < ob.n; q++) markArc(tmp, a + q * ob.sep, ob.w / 2 - shrink, 1);
      for (let i = 0; i < CELLS; i++) mask[i] &= tmp[i];
    } else if (ob.type === 'A') markArc(mask, a, ob.arc / 2 + ALPHA_H + (opts.bladeMargin || 0), 0);
    else if (ob.type === 'S') markArc(mask, a, RAY_HALF + ALPHA_H + (opts.rayMargin || 0), 0);
  }
  // rayons déjà actifs et aiguilles
  blockRays(chart, g.t, g.t, mask, opts.rayMargin || 0);
  return mask;
}
// rayons actifs pendant [t0, t1] (et aiguilles) → 0 dans le masque
export function blockRays(chart, t0, t1, mask, margin = 0) {
  const obs = chart.obstacles;
  for (let i = 0; i < obs.length; i++) {
    const r = obs[i];
    if (r.type !== 'S') continue;
    if (r.tc > t1 + 1e-6) break;
    if (r.tc + r.dur < t0 - 1e-6) continue;
    // un rayon qui ne fait que commencer à t1 (ou finir à t0) ne barre pas le trajet : il est dans le masque du groupe
    if (t1 > t0 && (r.tc >= t1 - 1e-6 || r.tc + r.dur <= t0 + 1e-6)) continue;
    markArc(mask, r.ang, RAY_HALF + ALPHA_H + margin, 0);
  }
  for (const nd of chart.needles) {
    if (nd.t1 <= t0 + 1e-6 || nd.t0 - barLen(chart, nd.t0) > t1) continue;
    markArc(mask, nd.center, nd.amp + RAY_HALF + ALPHA_H + 1 + margin, 0);
  }
  return mask;
}
const barLen = (chart, t) => chart.tempo.beatLenAt(t) * chart.bpb;

// Distances (en cases) depuis l'ensemble `src` sans traverser `blocked` (cercle) → dist (Float64Array)
export function ringDist(src, blocked, dist) {
  const d = dist || new Float64Array(CELLS);
  for (let i = 0; i < CELLS; i++) d[i] = src[i] && !blocked[i] ? 0 : INF;
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < CELLS * 2; k++) { const i = k % CELLS, p = (i + CELLS - 1) % CELLS; if (!blocked[i] && d[p] + 1 < d[i]) d[i] = d[p] + 1; }
    for (let k = CELLS * 2 - 1; k >= 0; k--) { const i = k % CELLS, p = (i + 1) % CELLS; if (!blocked[i] && d[p] + 1 < d[i]) d[i] = d[p] + 1; }
  }
  return d;
}

// ---------------------------------------------------------------- modèle physique (règle 1b, ajoutée — voir NOTES.md)
// Un anneau touche pendant toute la traversée de la bande |r − R_ORBIT| < 7 u, soit ±7/v s autour de tc : on doit être
// dans sa brèche (élargie de la grâce) pendant toute cette fenêtre. Masque physique et demi-fenêtre d'un groupe :
export function physMask(chart, g, out, margin = 0, tmp) {
  const mask = out || new Uint8Array(CELLS), t2 = tmp || new Uint8Array(CELLS);
  mask.fill(1);
  for (const ob of g.m) {
    const a = ob.ang;
    if (isRing(ob)) {
      t2.fill(0);
      for (let q = 0; q < ob.n; q++) markArc(t2, a + q * ob.sep, ob.w / 2 + GRACE - ALPHA_H - margin, 1);
      for (let i = 0; i < CELLS; i++) mask[i] &= t2[i];
    } else if (ob.type === 'A') markArc(mask, a, ob.arc / 2 + ALPHA_H + margin, 0);
    else markArc(mask, a, RAY_HALF + ALPHA_H + margin, 0);
  }
  return mask;
}
export function halfWin(chart, g) {
  let hw = 0, rot = 0;
  for (const ob of g.m) {
    if (ob.type === 'S') continue;
    const h = RWIN / ob.v; if (h > hw) hw = h;
    if (Math.abs(ob.rotPS) > rot) rot = Math.abs(ob.rotPS);
  }
  return { hw, rot };
}
// vitesse de rotation d'arène maximale (°/s) sur [t0, t1] : à retrancher de ω (repère de l'arène)
export function rotRateMax(chart, t0, t1) {
  const K = chart.rotKnots;
  let m = 0;
  const rate = t => { const e = 1e-3; return Math.abs(chart.rotAt(t + e) - chart.rotAt(t - e)) / (2 * e); };
  m = Math.max(rate(t0), rate(t1));
  for (const k of K) if (k.t > t0 && k.t < t1) m = Math.max(m, Math.abs(k.w));
  return m;
}
// dilate `src` de `reach` degrés sans sortir de `allowed`
export function dilateIn(src, allowed, reach, out, ws) {
  const blocked = ws.blk, dist = ws.dist;
  for (let i = 0; i < CELLS; i++) blocked[i] = allowed[i] ? 0 : 1;
  ringDist(src, blocked, dist);
  const r = Math.max(0, reach) / CELL + 1e-9;
  for (let i = 0; i < CELLS; i++) out[i] = allowed[i] && dist[i] <= r ? 1 : 0;
  return out;
}
export function makeWs() {
  return { blk: new Uint8Array(CELLS), dist: new Float64Array(CELLS), a: new Uint8Array(CELLS), b: new Uint8Array(CELLS), c: new Uint8Array(CELLS),
    mi: new Uint8Array(CELLS), mj: new Uint8Array(CELLS), ray: new Uint8Array(CELLS), tmp: new Uint8Array(CELLS) };
}
// Positions atteignables au franchissement `gj` depuis l'ensemble `src` au franchissement `gi` (ou l'inverse : le modèle
// est symétrique dans le temps), à la vitesse ω, en respectant les fenêtres de contact et les rayons actifs.
export function physTransition(chart, src, gi, gj, omega, out, ws, margin = 0) {
  const Mi = physMask(chart, gi, ws.mi, margin, ws.tmp), Mj = physMask(chart, gj, ws.mj, margin, ws.tmp);
  const t0 = Math.min(gi.t, gj.t), t1 = Math.max(gi.t, gj.t), dt = t1 - t0;
  const ray = ws.ray; ray.fill(1); blockRays(chart, t0, t1, ray, margin);
  const wi = halfWin(chart, gi), wj = halfWin(chart, gj);
  omega = Math.max(0, omega - rotRateMax(chart, t0 - wi.hw, t1 + wj.hw));
  const oi = Math.max(0, omega - wi.rot), oj = Math.max(0, omega - wj.rot);
  const A = ws.a, B = ws.b, C = ws.c;
  for (let i = 0; i < CELLS; i++) { Mi[i] &= ray[i]; Mj[i] &= ray[i]; A[i] = src[i] & Mi[i]; }
  const endI = Math.min(dt, wi.hw), startJ = Math.max(0, dt - wj.hw);
  if (endI <= startJ) {
    dilateIn(A, Mi, oi * endI, B, ws);
    dilateIn(B, ray, omega * (startJ - endI), C, ws);
    for (let i = 0; i < CELLS; i++) C[i] &= Mj[i];
    dilateIn(C, Mj, oj * (dt - startJ), out, ws);
  } else {
    dilateIn(A, Mi, oi * startJ, B, ws);
    for (let i = 0; i < CELLS; i++) { C[i] = Mi[i] & Mj[i]; B[i] &= C[i]; }
    dilateIn(B, C, Math.min(oi, oj) * (endI - startJ), A, ws);
    dilateIn(A, Mj, oj * (dt - endI), out, ws);
  }
  return out;
}

export function validateChart(chart, opts = {}) {
  const errors = [], warn = [];
  const omega = opts.omegaMax || chart.omegaMax;
  const cap = chart.opts && chart.opts.echo ? 500 : 440;
  if (omega > cap) errors.push(`omegaMax ${omega} > plafond ${cap}`);
  const G = crossingGroups(chart);
  const stats = { crossings: chart.obstacles.length, groups: G.length, omegaReq: 0, omegaAt: 0, maxInFlight: 0, maxRays: 0, duration: chart.duration, needles: chart.needles.length };
  // 4. obstacles impossibles
  for (const ob of chart.obstacles) {
    if (isRing(ob) && !(ob.w >= GAPS.XS)) errors.push(`anneau sans brèche ≥ XS à ${ob.tc.toFixed(3)} s`);
    if (ob.type === 'A' && (ob.arc > 200 || ob.arc <= 0)) errors.push(`lame de ${ob.arc}° à ${ob.tc.toFixed(3)} s`);
  }
  // 1. vitesse exigée (spec) : Dmin entre positions sûres de deux franchissements consécutifs ≤ ω · max(0, Δt − 0,10)
  const startT = opts.startT !== undefined ? opts.startT : -Infinity;
  const safeA = new Uint8Array(CELLS), safeB = new Uint8Array(CELLS), tmp = new Uint8Array(CELLS), blocked = new Uint8Array(CELLS), dist = new Float64Array(CELLS);
  const desc = g => g.m.map(o => o.type).join('+');
  let prev = null;
  for (const g of G) {
    if (g.t < startT) continue;
    safeMask(chart, g, safeB, { tmp });
    let any = 0; for (let i = 0; i < CELLS; i++) any |= safeB[i];
    if (!any) { errors.push(`aucune position sûre à ${g.t.toFixed(3)} s (${desc(g)})`); prev = null; continue; }
    if (prev) {
      const dt = g.t - prev.t;
      tmp.fill(1); blockRays(chart, prev.t, g.t, tmp); for (let i = 0; i < CELLS; i++) blocked[i] = tmp[i] ? 0 : 1;
      ringDist(safeA, blocked, dist);
      let dmin = INF; for (let i = 0; i < CELLS; i++) if (safeB[i] && dist[i] < dmin) dmin = dist[i];
      const D = dmin * CELL, budget = Math.max(0, dt - REACTION), rr = rotRateMax(chart, prev.t, g.t);
      const req = D <= 0 ? 0 : budget > 0 ? D / budget + rr : Infinity;
      if (req > stats.omegaReq) { stats.omegaReq = req; stats.omegaAt = g.t; }
      if (D > (omega - rr) * budget + 1e-6) errors.push(`règle 1 : ${D.toFixed(1)}° en ${(dt * 1000).toFixed(0)} ms (${req === Infinity ? '∞' : req.toFixed(0)}°/s > ${omega}) à ${g.t.toFixed(3)} s (${desc(prev)} → ${desc(g)})`);
    }
    safeA.set(safeB); prev = g;
  }
  // 1b. faisabilité physique (fenêtres de contact) : propagation de l'ensemble atteignable à la vitesse ω
  const ws = makeWs();
  let R = new Uint8Array(CELLS).fill(1), Rn = new Uint8Array(CELLS), gp = null;
  for (const g of G) {
    if (g.t < startT) continue;
    if (!gp) { physMask(chart, g, R, 0.5, ws.tmp); gp = g; continue; }
    physTransition(chart, R, gp, g, omega, Rn, ws, 0.5);
    let any = 0; for (let i = 0; i < CELLS; i++) any |= Rn[i];
    if (!any) {
      errors.push(`règle 1b (fenêtres de contact) : infranchissable à ${g.t.toFixed(3)} s (Δt ${((g.t - gp.t) * 1000).toFixed(0)} ms, ${desc(gp)} → ${desc(g)})`);
      physMask(chart, g, Rn, 0.5, ws.tmp);
    }
    const sw = R; R = Rn; Rn = sw; gp = g;
  }
  // 2. espacement radial et dépassements
  const dirOf = ob => (ob.type === 'I' ? -1 : ob.type === 'S' ? 0 : 1);
  const obs = chart.obstacles;
  for (let i = 0; i < obs.length; i++) {
    const a = obs[i]; if (!isRing(a)) continue;
    for (let j = i + 1; j < obs.length; j++) {
      const b = obs[j]; if (b.tc - a.tc > 2.5) break;
      if (!isRing(b) || dirOf(b) !== dirOf(a) || b.tc - a.tc < 0.002) continue;
      if (b.dbl === 2 && a.dbl === 1 && Math.abs(b.beat - a.beat - 0.25) < 1e-6) continue; // doublé : paire voulue (2e anneau fin)
      // b franchit après a : distance à l'orbite au passage de a
      if (b.v * (b.tc - a.tc) < 14 - 1e-6) errors.push(`espacement ${(b.v * (b.tc - a.tc)).toFixed(1)} u < 14 u à ${b.tc.toFixed(3)} s`);
      if (a.born > b.born + 1e-6 && a.v > b.v) {
        // a (né après, plus rapide, franchit avant) dépasse b : instant et distance à l'orbite du croisement
        const tx = (a.tc * a.v - b.tc * b.v) / (a.v - b.v);
        const dOrb = (a.tc - tx) * a.v;
        if (tx > a.born && dOrb < 30 - 1e-6) errors.push(`dépassement à ${dOrb.toFixed(0)} u de l'orbite (< 30) à ${a.tc.toFixed(3)} s`);
      }
    }
  }
  // 3. densité (obstacles triés par tc ; une naissance précède son franchissement de ≤ 2,5 s)
  const lower = t => { let lo = 0, hi = obs.length; while (lo < hi) { const m = (lo + hi) >> 1; if (obs[m].tc < t) lo = m + 1; else hi = m; } return lo; };
  for (let i = 0; i < obs.length; i++) {
    const t = obs[i].born;
    let n = 0, rays = 0;
    for (let j = lower(t); j < obs.length && obs[j].tc <= t + 2.5; j++) { const o = obs[j]; if (o.type !== 'S' && o.born <= t + 1e-9) n++; }
    if (obs[i].type === 'S') { const ts = obs[i].tc; for (let j = lower(ts - 3); j < obs.length && obs[j].tc <= ts + 1e-9; j++) { const o = obs[j]; if (o.type === 'S' && o.tc + o.dur >= ts) rays++; } }
    if (n > stats.maxInFlight) stats.maxInFlight = n;
    if (rays > stats.maxRays) stats.maxRays = rays;
  }
  if (stats.maxInFlight > MAX_IN_FLIGHT) errors.push(`densité ${stats.maxInFlight} obstacles en vol > ${MAX_IN_FLIGHT}`);
  if (stats.maxRays > MAX_RAYS) errors.push(`${stats.maxRays} rayons actifs > ${MAX_RAYS}`);
  // 5. calage : la note de l'instrument lié existe au même instant (écart 0)
  if (!opts.skipNotes) {
    const byT = new Map();
    for (const n of chart.notes) { const k = n.t; let a = byT.get(k); if (!a) byT.set(k, a = []); a.push(n.inst); }
    for (const ob of obs) {
      const a = byT.get(ob.tc);
      if (!a || !a.some(i => linkedOk(ob, i))) errors.push(`obstacle ${ob.type} sans note liée à ${ob.tc.toFixed(4)} s`);
    }
  }
  // 6. premier obstacle ≥ 1 mesure après le décompte ; dernier sur le dernier temps fort de l'OUTRO
  if (!opts.infinite && obs.length) {
    const cnt = chart.sections.find(s => s.kind === 'count');
    if (cnt && obs[0].beat < cnt.beat0 + cnt.beats + chart.bpb - 1e-9) errors.push(`premier obstacle trop tôt (temps ${obs[0].beat})`);
    const last = obs[obs.length - 1], sec = chart.sections[last.sec];
    const inBar = (last.beat - sec.beat0) % chart.bpb;
    if (sec.kind !== 'outro' || Math.abs(inBar % 2) > 1e-9) errors.push(`dernier obstacle hors temps fort de l'OUTRO (${sec.name}, temps ${inBar})`);
    for (let s = last.sec + 1; s < chart.sections.length; s++) if (chart.sections[s].crossings) errors.push('obstacles après l’OUTRO');
  }
  return { ok: errors.length === 0, errors, warn, stats };
}
