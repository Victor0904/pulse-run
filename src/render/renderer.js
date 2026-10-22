// Rendu Canvas 2D (DESIGN §3–§9). Arène en unités « u » (largeur 360 u), HUD en px CSS, toujours dessiné en dernier
// sur des panneaux sombres. Glows et textes pré-rendus, obstacles tracés par lots (paliers d'α), aucune allocation
// dans la boucle (hors chaînes de nombres, mises en cache quand elles changent).
import { R_CORE, R_EMIT, R_ORBIT, R_FADE0, R_FADE1, R_KILL, R_OUT, RAD, C, ALBUMS, adiff, wrap } from '../core/const.js';

const PALETTES = [
  { accent: '#8A5CFF', dark: '#2A1A5C' }, { accent: '#1FE5C2', dark: '#0C3B3A' }, { accent: '#3F7BFF', dark: '#13235C' },
];
const BUCKETS = [1, 0.85, 0.7, 0.55, 0.4, 0.28, 0.16, 0.08];
const FONT_UI = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const FONT_NUM = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const QUALITY_DPR = [2, 1.5, 1, 1];
export const fmtNum = n => { const s = String(Math.max(0, Math.round(n))); let o = ''; for (let i = 0; i < s.length; i++) { if (i && (s.length - i) % 3 === 0) o += ' '; o += s[i]; } return o; };
const spaced = s => s.split('').join(' ');

function sprite(color, r, inner = 0.25) {
  const c = document.createElement('canvas'); c.width = c.height = r * 2;
  const g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, color); gr.addColorStop(inner, color + 'AA'); gr.addColorStop(1, color + '00');
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c;
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function lerpHex(a, b, f) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((x >> s) & 255) * (1 - f) + ((y >> s) & 255) * f);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    // pas de desynchronized (leçon de PULSAR : artefacts sur certains GPU)
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.quality = 0; this.dpr = 1; this.W = 360; this.H = 640; this.k = 1; this.Hu = 640; this.Cy = 286;
    this.safeTop = 0; this.safeBottom = 0;
    this.parts = []; for (let i = 0; i < 640; i++) this.parts.push({ life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, spr: null, s: 10, rot: 0, vr: 0, shard: false });
    this.judge = { grade: -1, t0: -9 };
    this.trauma = 0; this.flash = 0; this.border = 0; this.aberr = 0; this.lastAberr = -9; this.multFx = -9; this.multLevel = 1;
    this.winFx = -9; this.dropFx = -9; this.poulsFx = -9; this.lostSeg = -1; this.lostT = -9;
    this.trail = new Float32Array(16); this.trailN = 0; this.trailT = 0;
    this.gapTmp = new Float32Array(4);
    this.scoreStr = '0'; this.scoreVal = -1; this.comboStr = ''; this.comboVal = -1;
    this.palIdx = 0; this.pal = PALETTES[0];
    this.makeSprites();
    this.dash6 = [6, 6]; this.dash86 = [8, 6]; this.dash46 = [4, 6]; this.noDash = [];
    this.hud = { pause: { x: 0, y: 0, w: 56, h: 56 } };
    this.frameCount = 0;
  }
  makeSprites() {
    this.SPR = {
      player: sprite(C.player, 32), soft: sprite(C.playerSoft, 16), good: sprite(C.good, 16), ok: sprite(C.ok, 16),
      danger: sprite(C.danger, 16), core: sprite(C.dangerCore, 16), white: sprite('#FFFFFF', 16), onde: sprite(C.onde, 16),
    };
    // textes de jugement pré-rendus (DESIGN §7)
    const mk = (txt, px, fill, stroke) => {
      const c = document.createElement('canvas'), s = 2; c.width = 220 * s; c.height = 40 * s;
      const g = c.getContext('2d'); g.scale(s, s); g.font = `800 ${px}px ${FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const t = spaced(txt);
      if (stroke) { g.lineWidth = 3; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(t, 110, 20); }
      g.fillStyle = fill; g.fillText(t, 110, 20); return c;
    };
    this.JUDGE = [mk('OK', 12, C.ok), mk('BIEN', 13, C.good), mk('PARFAIT', 15, '#FFFFFF', C.player), mk('RATÉ', 15, C.danger, '#07060D')];
  }
  setQuality(q) { this.quality = q; }

  resize(cssW, cssH, safeTop, safeBottom) {
    const dpr = Math.min(window.devicePixelRatio || 1, QUALITY_DPR[this.quality]);
    this.dpr = dpr; this.W = cssW; this.H = cssH;
    this.cv.width = Math.round(cssW * dpr); this.cv.height = Math.round(cssH * dpr);
    this.cv.style.width = cssW + 'px'; this.cv.style.height = cssH + 'px';
    this.k = cssW / 360; this.Hu = 360 * cssH / cssW;
    this.safeTop = safeTop; this.safeBottom = safeBottom;
    const st = safeTop / this.k, sb = safeBottom / this.k;
    const topPlay = st + 60, bottomPlay = this.Hu - sb - 128;
    this.Cy = Math.max(250, Math.round((topPlay + bottomPlay) / 2));
    this.makeBackground();
  }
  setPalette(idx, bgSkin) {
    if (idx === this.palIdx && bgSkin === this.bgSkin && this.groove) return;
    this.palIdx = idx; this.bgSkin = bgSkin || 'sillons';
    this.pal = PALETTES[idx % 3];
    this.makeBackground();
  }
  makeBackground() {
    const k = this.k, dpr = this.dpr, R = 400;
    const make = (accentDark) => {
      // canvas à la taille de l'écran (pixels réels), centré sur le cœur : blit 1:1 à chaque frame
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(this.W * dpr)); c.height = Math.max(1, Math.round(this.H * dpr));
      const g = c.getContext('2d'), s = k * dpr;
      g.fillStyle = C.bg0; g.fillRect(0, 0, c.width, c.height);
      g.translate(180 * k * dpr, this.Cy * k * dpr); g.scale(s, s);
      if (this.bgSkin === 'polaire') {
        g.strokeStyle = C.groove; g.lineWidth = 1;
        for (let r = 48; r <= R; r += 48) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
        g.strokeStyle = accentDark; g.beginPath();
        for (let a = 0; a < 360; a += 15) { g.moveTo(Math.cos(a * RAD) * 36, Math.sin(a * RAD) * 36); g.lineTo(Math.cos(a * RAD) * R, Math.sin(a * RAD) * R); }
        g.globalAlpha = 0.6; g.stroke();
      } else if (this.bgSkin === 'constellation') {
        let s0 = 9871;
        const rnd = () => ((s0 = (s0 * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 260; i++) { const a = rnd() * Math.PI * 2, r = 40 + rnd() * (R - 40); g.fillStyle = i % 5 ? C.groove : accentDark; g.globalAlpha = 0.9; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, i % 7 ? 1.2 : 2.2, 0, Math.PI * 2); g.fill(); }
        g.globalAlpha = 0.5; g.strokeStyle = accentDark; g.beginPath(); g.arc(0, 0, 150, 0, Math.PI * 2); g.stroke();
      } else {
        for (let r = 36, i = 0; r <= R; r += 12, i++) {
          g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
          g.strokeStyle = i % 4 === 3 ? accentDark : C.groove; g.globalAlpha = 0.9; g.lineWidth = 1; g.stroke();
        }
      }
      return c;
    };
    this.groove = make(this.pal.dark);
    this.grooveDrop = make(this.pal.accent);
    // liseré de beat : dégradé radial pré-rendu
    const gs = Math.ceil(2 * 260 * k * dpr), gl = document.createElement('canvas'); gl.width = gl.height = gs;
    const gg = gl.getContext('2d'), gr = gg.createRadialGradient(gs / 2, gs / 2, 20 * k * dpr, gs / 2, gs / 2, gs / 2);
    gr.addColorStop(0, this.pal.accent); gr.addColorStop(1, hexA(this.pal.accent, 0)); gg.fillStyle = gr; gg.fillRect(0, 0, gs, gs);
    this.glow = gl;
  }

  // ------------------------------------------------------------------ effets (appelés par main sur les événements)
  emit(phi, r, n, spr, v0, v1, life, shard) {
    const x = Math.cos(phi * RAD) * r, y = Math.sin(phi * RAD) * r, P = this.parts;
    const cnt = Math.max(1, Math.round(n * (this.reduced || this.quality >= 3 ? 0.5 : 1)));
    let c = 0;
    for (let i = 0; i < P.length && c < cnt; i++) {
      const p = P[i]; if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2, v = v0 + Math.random() * (v1 - v0);
      p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.life = p.max = life * (0.7 + Math.random() * 0.3);
      p.spr = spr; p.s = shard ? 7 : 10; p.shard = !!shard; p.rot = Math.random() * 6; p.vr = (Math.random() - 0.5) * 20; c++;
    }
  }
  onJudge(grade, phi, ob, t, gapCenter) {
    this.gapCenter = gapCenter || phi;
    this.judge.grade = grade; this.judge.t0 = t;
    const spr = grade === 2 ? this.SPR.soft : grade === 1 ? this.SPR.good : this.SPR.ok;
    this.emit(phi, R_ORBIT, grade === 2 ? 12 : grade === 1 ? 6 : 3, spr, 60, 140, 0.35);
    if (grade === 2 && ob && ob.type !== 'A' && ob.type !== 'S') {
      const half = ob.w / 2, g = this.gapCenter;
      this.emit(g - half, R_ORBIT, 4, this.SPR.core, 30, 90, 0.3); this.emit(g + half, R_ORBIT, 4, this.SPR.core, 30, 90, 0.3);
    }
  }
  onHit(phi, t, pouls, reduced) {
    this.judge.grade = 3; this.judge.t0 = t;
    this.emit(phi, R_ORBIT, 18, this.SPR.danger, 40, 160, 0.5, true);
    if (!reduced) { this.flash = 0.08; if (t - this.lastAberr > 1) { this.aberr = 0.16; this.lastAberr = t; } this.trauma = Math.min(1, this.trauma + 0.35); }
    else this.border = 0.25;
    this.lostSeg = pouls; this.lostT = t;
  }
  onMult(level, t) { this.multFx = t; this.multLevel = level; }
  onPoulsUp(t) { this.poulsFx = t; this.emit(0, 0, 6, this.SPR.soft, 60, 120, 0.5); }
  onDeath(phi, t, reduced) { this.emit(phi, R_ORBIT, 10, this.SPR.soft, 40, 140, 0.7, true); if (!reduced) this.trauma = Math.min(1, this.trauma + 0.5); }
  onWin(t) { this.winFx = t; this.emit(0, 0, 60, this.SPR.soft, 60, 220, 1.0); this.emit(0, 0, 20, this.SPR.white, 80, 260, 0.8); }
  onDrop(t, reduced) { this.dropFx = t; if (!reduced && t - this.lastAberr > 1) { this.aberr = 0.12; this.lastAberr = t; } }
  update(dt) {
    const P = this.parts;
    for (let i = 0; i < P.length; i++) { const p = P[i]; if (p.life > 0) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.rot += p.vr * dt; } }
    this.trauma = Math.max(0, this.trauma - 1.6 * dt);
    this.flash = Math.max(0, this.flash - dt); this.border = Math.max(0, this.border - dt); this.aberr = Math.max(0, this.aberr - dt);
  }
  resetFx() { for (const p of this.parts) p.life = 0; this.judge.grade = -1; this.trauma = this.flash = this.border = this.aberr = 0; this.trailN = 0; this.multFx = this.winFx = this.dropFx = this.lostT = -9; }

  // ------------------------------------------------------------------ frame
  // v : { game, chart, t, phi, omega, cam, reduced, ghosts, skins, hud, dead, deathT, won }
  frame(v) {
    const ctx = this.ctx, k = this.k, dpr = this.dpr, W = this.W, H = this.H, ch = v.chart, t = v.t;
    this.reduced = v.reduced; this.frameCount++;
    // enveloppes de beat (calculées depuis le temps de jeu)
    const tp = ch.tempo, bl = tp.beatLenAt(t), bt = tp.secToBeat(t), bi = Math.floor(bt), bf = (bt - bi) * bl;
    const beatEnv = t >= -5 ? Math.exp(-bf / 0.11) : 0;
    const barPos = ((bi % ch.bpb) + ch.bpb) % ch.bpb;
    const downEnv = barPos === 0 ? Math.exp(-bf / 0.18) : 0;
    this.beatIdx = barPos; this.beatEnv = beatEnv;
    const pal = this.pal;
    let accent = pal.accent, accentDark = pal.dark;
    if (v.prism) { const f = v.prism; const a = Math.floor(f) % 3, b = (a + 1) % 3, x = f - Math.floor(f); accent = lerpHex(PALETTES[a].accent, PALETTES[b].accent, x); accentDark = lerpHex(PALETTES[a].dark, PALETTES[b].dark, x); }
    this.accent = accent;
    const base = dpr;
    ctx.setTransform(base, 0, 0, base, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = C.bg0; ctx.fillRect(0, 0, W, H);
    const sh = v.reduced ? 0 : 8 * this.trauma * this.trauma;
    const ox = sh ? (Math.random() * 2 - 1) * sh : 0, oy = sh ? (Math.random() * 2 - 1) * sh : 0;
    const cx = 180 * k + ox * k, cy = this.Cy * k + oy * k;
    this.cx = cx; this.cy = cy;
    // sillons (respiration sur le temps)
    const inDrop = t - this.dropFx >= 0 && t - this.dropFx < bl * ch.bpb && !v.reduced;
    const bgc = inDrop ? this.grooveDrop : this.groove;
    const breathe = v.reduced || this.quality >= 1 || beatEnv < 0.03 ? 1 : 1 + 0.012 * beatEnv;
    ctx.globalAlpha = 0.9;
    if (breathe === 1) ctx.drawImage(bgc, ox * k, oy * k, W, H);
    else { const bw = W * breathe, bh = H * breathe; ctx.drawImage(bgc, cx - (180 * k) * breathe, cy - this.Cy * k * breathe, bw, bh); }
    const lis = (v.reduced ? 0.05 : 0.10) * beatEnv;
    if (lis > 0.004 && this.quality < 2) { ctx.globalAlpha = lis; const s = 520 * k; ctx.drawImage(this.glow, cx - s / 2, cy - s / 2, s, s); }
    ctx.globalAlpha = 1;
    // repère de l'arène (caméra)
    const cam = v.cam === 'suiveuse' ? (90 - v.phi) * RAD : 0;
    const ca = Math.cos(cam) * k * base, sa = Math.sin(cam) * k * base;
    ctx.setTransform(ca, sa, -sa, ca, cx * base, cy * base);
    const rot = ch.rotAt(t);
    // orbite + 12 graduations
    ctx.globalAlpha = 0.14 + (v.reduced ? 0.1 : 0.18) * beatEnv; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, R_ORBIT, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.3; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const a = (i * 30 + rot) * RAD, l = i === 3 ? 10 : 6; ctx.moveTo(Math.cos(a) * (R_ORBIT + 3), Math.sin(a) * (R_ORBIT + 3)); ctx.lineTo(Math.cos(a) * (R_ORBIT + 3 + l), Math.sin(a) * (R_ORBIT + 3 + l)); }
    ctx.stroke(); ctx.globalAlpha = 1;
    const g = v.game;
    if (g) {
      if (v.ghosts) this.drawGhosts(g, ch, t);
      this.drawTelegraphs(g, ch, t, bl);
      this.drawObstacles(g, ch, t, v);
      this.drawNeedles(g, ch, t, bl);
      if (this.aberr > 0 && !v.reduced) this.drawAberration(g, t);
    }
    this.drawCore(v, t, beatEnv, downEnv, accent, bl);
    // particules
    ctx.globalCompositeOperation = 'lighter';
    const P = this.parts;
    for (let i = 0; i < P.length; i++) {
      const p = P[i]; if (p.life <= 0) continue;
      const f = p.life / p.max, s = p.s * (0.5 + f * 0.5);
      ctx.globalAlpha = f; ctx.drawImage(p.spr, p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (g && !(v.dead && v.deathAge > 0.12)) this.drawPlayer(v, t);
    // repère écran
    ctx.setTransform(base, 0, 0, base, 0, 0);
    this.drawCombo(v, t, beatEnv, downEnv);
    this.drawJudge(v, t);
    // victoire : anneau blanc qui balaie l'écran
    const wf = t - this.winFx;
    if (wf >= 0 && wf < 0.9) { ctx.globalAlpha = (1 - wf / 0.9) * 0.8; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, (24 + wf * 600) * k, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    // mort : désaturation progressive (voile bg-0)
    if (v.dead) { ctx.globalAlpha = Math.min(0.4, v.deathAge * 0.8); ctx.fillStyle = C.bg0; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (v.hud) this.drawHUD(v, t, beatEnv);
    if (this.flash > 0) { ctx.globalAlpha = 0.22 * this.flash / 0.08; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    else if (this.border > 0) { ctx.globalAlpha = 0.6 * this.border / 0.25; ctx.strokeStyle = C.danger; ctx.lineWidth = 12; ctx.strokeRect(0, 0, W, H); ctx.globalAlpha = 1; }
    const df = t - this.dropFx;
    if (df >= 0 && df < 0.1 && !v.reduced) { ctx.globalAlpha = 0.35 * (1 - df / 0.1); ctx.fillStyle = accent; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }

  drawGhosts(g, ch, t) {
    // les 2 prochains franchissements d'anneau
    const ctx = this.ctx; let n = 0, first = null;
    ctx.lineCap = 'round'; ctx.strokeStyle = C.player; ctx.lineWidth = 6;
    const A = g.active;
    let a1 = null, a2 = null;
    for (let i = 0; i < g.nActive; i++) {
      const o = A[i];
      if (o.type === 'A' || o.type === 'S' || o.judged || o.tc < t - 0.02) continue;
      if (!a1 || o.tc < a1.tc) { a2 = a1; a1 = o; } else if (!a2 || o.tc < a2.tc) a2 = o;
    }
    for (let k2 = 0; k2 < 2; k2++) {
      const o = k2 === 0 ? a1 : a2; if (!o) continue;
      if (k2 === 1 && a1 && Math.abs(o.tc - a1.tc) < 0.002 && o.ang === a1.ang) continue;
      const p = Math.min(1, Math.max(0, (t - o.born) / Math.max(0.05, o.lead)));
      ctx.globalAlpha = p * (k2 === 0 ? 0.55 : 0.22);
      const c0 = o.ang + ch.rotAt(o.tc);
      ctx.beginPath();
      for (let q = 0; q < o.n; q++) { const c = c0 + q * o.sep; ctx.moveTo(Math.cos((c - o.w / 2) * RAD) * R_ORBIT, Math.sin((c - o.w / 2) * RAD) * R_ORBIT); ctx.arc(0, 0, R_ORBIT, (c - o.w / 2) * RAD, (c + o.w / 2) * RAD); }
      ctx.stroke();
      if (o.dbl === 1) { ctx.lineWidth = 2; ctx.beginPath(); for (let q = 0; q < o.n; q++) { const c = c0 + q * o.sep; ctx.moveTo(Math.cos((c - o.w / 2) * RAD) * 122, Math.sin((c - o.w / 2) * RAD) * 122); ctx.arc(0, 0, 122, (c - o.w / 2) * RAD, (c + o.w / 2) * RAD); } ctx.stroke(); ctx.lineWidth = 6; }
      n++; if (!first) first = o;
    }
    ctx.globalAlpha = 1;
  }
  drawTelegraphs(g, ch, t, bl) {
    const ctx = this.ctx, A = g.active;
    // rayons en télégraphe (pointillé + flèche de remplissage)
    ctx.lineCap = 'butt';
    for (let i = 0; i < g.nActive; i++) {
      const o = A[i]; if (o.type !== 'S' || t >= o.tc) continue;
      const a = g.angleAt(o, t) * RAD, cs = Math.cos(a), sn = Math.sin(a), p = Math.max(0, Math.min(1, 1 - (o.tc - t) / o.lead));
      ctx.globalAlpha = 0.45; ctx.strokeStyle = C.danger; ctx.lineWidth = 2; ctx.setLineDash(this.dash86);
      ctx.beginPath(); ctx.moveTo(cs * R_EMIT, sn * R_EMIT); ctx.lineTo(cs * R_KILL, sn * R_KILL); ctx.stroke(); ctx.setLineDash(this.noDash);
      ctx.globalAlpha = 0.85; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cs * R_EMIT, sn * R_EMIT);
      const rr = R_EMIT + (R_KILL - R_EMIT) * p; ctx.lineTo(cs * rr, sn * rr); ctx.stroke();
    }
    // liseré d'annonce des implosions (1 temps avant la naissance)
    const obs = ch.obstacles, i0 = g.ip;
    ctx.strokeStyle = C.danger; ctx.lineWidth = 6;
    for (let j = i0; j < g.order.length && j < i0 + 24; j++) {
      const o = g.order[j]; if (o.born > t + bl) break;
      if (o.type !== 'I' || o.born < t) continue;
      ctx.globalAlpha = 0.35 * (1 - (o.born - t) / bl);
      const c0 = o.ang + ch.rotAt(t);
      ctx.beginPath();
      for (let q = 0; q < o.n; q++) { const s = c0 + q * o.sep + o.w / 2, e = c0 + (q + 1 < o.n ? (q + 1) * o.sep : 360) - o.w / 2; if (e > s) { ctx.moveTo(Math.cos(s * RAD) * 200, Math.sin(s * RAD) * 200); ctx.arc(0, 0, 200, s * RAD, e * RAD); } }
      ctx.stroke();
    }
    void obs; ctx.globalAlpha = 1;
  }
  // un anneau (ou une lame) dans le chemin courant
  pathOb(g, o, r, t) {
    const ctx = this.ctx;
    if (o.type === 'A') { const c = g.angleAt(o, t), a0 = (c - o.arc / 2) * RAD, a1 = (c + o.arc / 2) * RAD; ctx.moveTo(Math.cos(a0) * r, Math.sin(a0) * r); ctx.arc(0, 0, r, a0, a1); return; }
    const c0 = g.angleAt(o, t), G = this.gapTmp, n = o.n;
    for (let q = 0; q < n; q++) G[q] = wrap(c0 + q * o.sep);
    // tri (n ≤ 3)
    for (let a = 1; a < n; a++) for (let b = a; b > 0 && G[b] < G[b - 1]; b--) { const x = G[b]; G[b] = G[b - 1]; G[b - 1] = x; }
    for (let q = 0; q < n; q++) {
      const s = G[q] + o.w / 2, e = (q + 1 < n ? G[q + 1] : G[0] + 360) - o.w / 2;
      if (e > s) { ctx.moveTo(Math.cos(s * RAD) * r, Math.sin(s * RAD) * r); ctx.arc(0, 0, r, s * RAD, e * RAD); }
    }
  }
  obAlpha(o, r, t, v) {
    let alpha = Math.min(1, 0.45 + (t - o.born) / 0.15 * 0.55);
    const past = o.type === 'I' ? r < R_ORBIT : r > R_ORBIT;
    if (past) { const f = o.type === 'I' ? (R_ORBIT - r) / (R_ORBIT - R_EMIT) : Math.max(0, (r - R_FADE0) / (R_FADE1 - R_FADE0)); alpha *= Math.max(0, 1 - f); }
    if (o.hit) alpha *= 0.35;
    if (v.dead && o === v.fatal) alpha = Math.floor(v.deathAge / 0.12) % 2 === 0 && v.deathAge < 0.48 ? 1 : v.deathAge < 0.48 ? 0.3 : 1;
    return alpha;
  }
  drawObstacles(g, ch, t, v) {
    const ctx = this.ctx, A = g.active, halo = this.quality < 3, n = g.nActive;
    // une seule évaluation par obstacle et par frame : rayon et palier d'α (−1 = non dessiné)
    const R = this.obR || (this.obR = new Float32Array(96)), B = this.obB || (this.obB = new Int8Array(96));
    const used = this.bUsed || (this.bUsed = new Uint8Array(BUCKETS.length * 2 * 2));
    used.fill(0);
    for (let i = 0; i < n; i++) {
      const o = A[i]; B[i] = -1;
      if (o.type === 'S') continue;
      const r = g.radius(o, t); if (r < 4 || r > R_KILL) continue;
      const al = this.obAlpha(o, r, t, v); if (al < 0.01) continue;
      let b = 0; while (b + 1 < BUCKETS.length && al < (BUCKETS[b] + BUCKETS[b + 1]) / 2) b++;
      R[i] = r; B[i] = b;
      used[(b * 2 + (o.sp < 1 ? 1 : 0)) * 2 + (o.off ? 1 : 0)] = 1;
    }
    ctx.lineCap = 'round';
    for (let fast = 0; fast < 2; fast++) {
      const col = fast ? C.fast : C.danger, core = fast ? C.fastCore : C.dangerCore;
      for (let b = 0; b < BUCKETS.length; b++) {
        const u = (b * 2 + fast) * 2, anyOn = used[u], anyOff = used[u + 1];
        if (!anyOn && !anyOff) continue;
        const bucketA = BUCKETS[b];
        ctx.beginPath();
        for (let i = 0; i < n; i++) { const o = A[i]; if (B[i] === b && (o.sp < 1) === !!fast) this.pathOb(g, o, R[i], t); }
        const ws = 0.5 + 0.5 * bucketA;
        if (halo) { ctx.globalAlpha = bucketA * 0.16; ctx.strokeStyle = col; ctx.lineWidth = 16 * ws; ctx.stroke(); }
        ctx.globalAlpha = bucketA; ctx.strokeStyle = col; ctx.lineWidth = 8 * ws; ctx.stroke();
        // trait cœur (pointillé si contretemps)
        ctx.strokeStyle = core; ctx.globalAlpha = bucketA * 0.9; ctx.lineWidth = 2.5 * Math.max(0.6, ws);
        for (let pass = 0; pass < 2; pass++) {
          if (pass === 0 && !anyOn) continue; if (pass === 1 && !anyOff) continue;
          ctx.beginPath();
          for (let i = 0; i < n; i++) { const o = A[i]; if (B[i] === b && (o.sp < 1) === !!fast && o.off === (pass === 1)) this.pathOb(g, o, R[i], t); }
          if (pass === 1) ctx.setLineDash(this.dash6);
          ctx.stroke();
          if (pass === 1) ctx.setLineDash(this.noDash);
        }
        // lèvres des brèches, barres de lames, chevrons (rapides / implosions)
        ctx.lineWidth = 2; ctx.globalAlpha = bucketA; ctx.beginPath();
        for (let i = 0; i < n; i++) { const o = A[i]; if (B[i] === b && (o.sp < 1) === !!fast) this.pathDetails(g, o, R[i], t); }
        ctx.stroke();
      }
    }
    // rayons actifs
    for (let i = 0; i < g.nActive; i++) {
      const o = A[i]; if (o.type !== 'S' || t < o.tc) continue;
      const end = o.tc + o.dur, w = t > end ? Math.max(0, 1 - (t - end) / 0.08) : 1;
      if (w <= 0) continue;
      const a = g.angleAt(o, t) * RAD, cs = Math.cos(a), sn = Math.sin(a);
      ctx.beginPath(); ctx.moveTo(cs * R_EMIT, sn * R_EMIT); ctx.lineTo(cs * R_KILL, sn * R_KILL);
      ctx.lineCap = 'round';
      if (halo) { ctx.globalAlpha = 0.16; ctx.strokeStyle = C.danger; ctx.lineWidth = 14 * w; ctx.stroke(); }
      ctx.globalAlpha = o.hit ? 0.4 : 1; ctx.strokeStyle = C.danger; ctx.lineWidth = 6 * w; ctx.stroke();
      ctx.strokeStyle = C.dangerCore; ctx.globalAlpha = 0.9; ctx.lineWidth = 2 * w; ctx.stroke();
      if (!v.reduced && t - o.tc < 0.04) { ctx.globalAlpha = 0.6; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }
  pathDetails(g, o, r, t) {
    const ctx = this.ctx;
    if (o.type === 'A') {
      const c = g.angleAt(o, t);
      for (let s = -1; s <= 1; s += 2) { const a = (c + s * o.arc / 2) * RAD, cs = Math.cos(a), sn = Math.sin(a); ctx.moveTo(cs * (r - 5), sn * (r - 5)); ctx.lineTo(cs * (r + 5), sn * (r + 5)); }
      return;
    }
    const c0 = g.angleAt(o, t);
    for (let q = 0; q < o.n; q++) for (let s = -1; s <= 1; s += 2) {
      const a = (c0 + q * o.sep + s * o.w / 2) * RAD, cs = Math.cos(a), sn = Math.sin(a);
      ctx.moveTo(cs * (r + 4), sn * (r + 4)); ctx.lineTo(cs * (r + 10), sn * (r + 10));
    }
    // sillage des W : petits arcs derrière chaque bord, dans le sens de rotation
    if (o.type === 'W' && o.rotPS) {
      const dir = o.rotPS > 0 ? -1 : 1;
      for (let q = 0; q < o.n; q++) for (let s = -1; s <= 1; s += 2) {
        const e = c0 + q * o.sep + s * o.w / 2, a0 = e + dir * 4 * (s * dir > 0 ? 0 : 1);
        const x0 = (e + dir * 3) * RAD, x1 = (e + dir * 10) * RAD;
        ctx.moveTo(Math.cos(Math.min(x0, x1)) * (r - 6), Math.sin(Math.min(x0, x1)) * (r - 6)); ctx.arc(0, 0, r - 6, Math.min(x0, x1), Math.max(x0, x1)); void a0;
      }
    }
    if (o.type === 'I' || o.sp < 1) {
      const nCh = o.type === 'I' ? 12 : o.sp <= 0.4 ? 12 : 6, dir = o.type === 'I' ? -1 : 1;
      for (let j = 0; j < nCh; j++) {
        const a = c0 + 180 + (j - (nCh - 1) / 2) * (300 / nCh);
        let inGap = false; for (let q = 0; q < o.n; q++) if (Math.abs(adiff(a, c0 + q * o.sep)) < o.w / 2 + 6) inGap = true;
        if (inGap) continue;
        const ar = a * RAD, cs = Math.cos(ar), sn = Math.sin(ar), tx = -sn, ty = cs, tip = r + dir * 6, bs = r - dir;
        ctx.moveTo(cs * bs + tx * 4, sn * bs + ty * 4); ctx.lineTo(cs * tip, sn * tip); ctx.lineTo(cs * bs - tx * 4, sn * bs - ty * 4);
      }
    }
  }
  drawNeedles(g, ch, t, bl) {
    const N = ch.needles; if (!N.length) return;
    const ctx = this.ctx;
    for (let k2 = 0; k2 < N.length; k2++) {
      const nd = N[k2], tele = nd.t0 - bl * ch.bpb;
      if (t < tele || t > nd.t1 + 0.3) continue;
      const rot = ch.rotAt(t);
      // trajectoire future : arc pointillé r 140 entre les deux extrémités
      ctx.globalAlpha = 0.25; ctx.strokeStyle = C.danger; ctx.lineWidth = 2; ctx.setLineDash(this.dash46);
      ctx.beginPath(); ctx.arc(0, 0, 140, (nd.center + rot - nd.amp) * RAD, (nd.center + rot + nd.amp) * RAD); ctx.stroke(); ctx.setLineDash(this.noDash);
      const b = ch.tempo.secToBeat(t) - nd.beat0, ang = (t < nd.t0 ? nd.center - nd.amp : nd.center - nd.amp * Math.cos(Math.PI * b)) + rot;
      const a = ang * RAD, cs = Math.cos(a), sn = Math.sin(a), on = t >= nd.t0 && t <= nd.t1;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cs * R_EMIT, sn * R_EMIT); ctx.lineTo(cs * R_KILL, sn * R_KILL);
      if (on) { ctx.globalAlpha = 0.16; ctx.lineWidth = 14; ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = C.dangerCore; ctx.lineWidth = 2; ctx.stroke(); }
      else { ctx.globalAlpha = 0.45; ctx.lineWidth = 2; ctx.setLineDash(this.dash86); ctx.stroke(); ctx.setLineDash(this.noDash); }
      // contrepoids turquoise (inoffensif)
      ctx.globalAlpha = 1; ctx.fillStyle = '#1FE5C2'; ctx.beginPath();
      const x = cs * 60, y = sn * 60; ctx.moveTo(x + cs * 7, y + sn * 7); ctx.lineTo(x - sn * 5, y + cs * 5); ctx.lineTo(x - cs * 7, y - sn * 7); ctx.lineTo(x + sn * 5, y - cs * 5); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  drawAberration(g, t) {
    const ctx = this.ctx, off = 6 * this.aberr / 0.16;
    ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 6;
    for (let s = 0; s < 2; s++) {
      ctx.strokeStyle = s ? 'rgba(0,200,255,.35)' : 'rgba(255,0,60,.35)';
      ctx.beginPath();
      for (let i = 0; i < g.nActive; i++) { const o = g.active[i]; if (o.type === 'S') continue; const r = g.radius(o, t); if (r > 4 && r < R_KILL) { ctx.moveTo(r + (s ? -off : off), 0); ctx.arc(s ? -off : off, 0, r, 0, Math.PI * 2); } }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  drawCore(v, t, beatEnv, downEnv, accent, bl) {
    const ctx = this.ctx, g = v.game, ch = v.chart;
    const amp = v.reduced ? 0.06 : 0.16;
    let rc = R_CORE * (1 + amp * beatEnv + (v.reduced ? 0.02 : 0.10) * downEnv);
    this.rc = rc;
    const kind = ch.bossKind;
    ctx.lineWidth = 3;
    if (kind === 'coeur') {
      // deux lobes, lub-dub : 2 pulses à 1/4 de temps d'écart
      const bt = ch.tempo.secToBeat(t), f = (bt - Math.floor(bt)) * bl;
      const s = 1 + (v.reduced ? 0.05 : 0.22) * Math.exp(-f / 0.07) + (v.reduced ? 0.03 : 0.12) * (f > bl / 4 ? Math.exp(-(f - bl / 4) / 0.07) : 0);
      ctx.save(); ctx.scale(s, s);
      ctx.fillStyle = C.bg1; ctx.strokeStyle = '#8A5CFF';
      // deux lobes (cercles r 18 à x ±11) + pointe vers le bas (y +30)
      ctx.beginPath(); ctx.moveTo(0, 30); ctx.arc(-11, -4, 18, 160 * RAD, 307.6 * RAD); ctx.arc(11, -4, 18, 232.4 * RAD, 380 * RAD); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#FFFFFF'; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.2; ctx.beginPath();
      const cracks = g ? g.cracks : 0;
      if (cracks > 0) { ctx.moveTo(-4, -16); ctx.lineTo(-8, -4); ctx.lineTo(-2, 6); }
      if (cracks > 1) { ctx.moveTo(10, -14); ctx.lineTo(6, 0); ctx.lineTo(12, 10); }
      if (cracks > 2) { ctx.moveTo(0, 12); ctx.lineTo(-4, 20); ctx.lineTo(1, 26); }
      ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1;
      this.rc = 30;
    } else if (kind === 'metronome') {
      ctx.fillStyle = C.bg1; ctx.strokeStyle = '#1FE5C2';
      ctx.beginPath(); ctx.moveTo(-20, 15); ctx.lineTo(20, 15); ctx.lineTo(12, -15); ctx.lineTo(-12, -15); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 5 * (1 + 0.3 * beatEnv), 0, Math.PI * 2); ctx.fillStyle = '#1FE5C2'; ctx.fill();
      this.rc = 24;
    } else if (kind === 'membrane') {
      // cône concentrique : recule pendant le télégraphe d'une onde éclair, claque à ×1,3
      let sc = 1 + (v.reduced ? 0.04 : 0.12) * beatEnv;
      if (g) for (let i = 0; i < g.nActive; i++) { const o = g.active[i]; if (o.sp <= 0.4 && t < o.tc && t > o.tc - o.lead - bl) { sc = t < o.born ? 0.75 : 1.3 - 0.3 * (t - o.born) / o.lead; break; } }
      const sil = ch.fx.some(f => f.kind === 'SILENCE' && t >= f.t && t < ch.secOf(f.beat + f.bars * ch.bpb));
      if (sil) sc = 1;
      ctx.strokeStyle = '#3F7BFF'; ctx.fillStyle = C.bg1;
      ctx.beginPath(); ctx.arc(0, 0, 40 * sc, 0, Math.PI * 2); ctx.fill();
      for (const r of [40, 32, 24, 16, 8]) { ctx.globalAlpha = r === 40 ? 1 : 0.6; ctx.lineWidth = r === 40 ? 3 : 1.5; ctx.beginPath(); ctx.arc(0, 0, r * sc, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1; this.rc = 40 * sc;
    } else {
      const skin = v.skins ? v.skins.core : 'membrane';
      ctx.fillStyle = C.bg1; ctx.beginPath(); ctx.arc(0, 0, rc, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = accent; ctx.stroke();
      ctx.lineWidth = 1;
      if (skin === 'vinyle') {
        ctx.globalAlpha = 0.45; for (let r = 7; r < rc - 3; r += 3) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx.fillStyle = C.player; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      } else if (skin === 'oeil') {
        ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(0, 0, rc * 0.8, rc * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(0, 0, rc * 0.28 * (1 + 0.3 * beatEnv), 0, Math.PI * 2); ctx.fill();
      } else if (skin === 'oscillo') {
        ctx.globalAlpha = 0.9; ctx.strokeStyle = C.player; ctx.beginPath();
        for (let x = -rc * 0.8; x <= rc * 0.8; x += 2) { const y = Math.sin(x * 0.4 + t * 12) * rc * 0.3 * (0.3 + beatEnv); if (x === -rc * 0.8) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
      } else if (skin === 'soleil') {
        ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(0, 0, rc - 3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.6; ctx.beginPath(); for (let a = 0; a < 360; a += 30) { const r0 = rc + 2, r1 = rc + 5 + 4 * beatEnv; ctx.moveTo(Math.cos(a * RAD) * r0, Math.sin(a * RAD) * r0); ctx.lineTo(Math.cos(a * RAD) * r1, Math.sin(a * RAD) * r1); } ctx.stroke();
      } else {
        ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(0, 0, rc * 17 / 24, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(0, 0, rc * 11 / 24, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(0, 0, rc * 5 / 24, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // le cœur « tousse » à chaque naissance d'obstacle
    if (g) {
      ctx.strokeStyle = C.danger; ctx.lineWidth = 1.5;
      for (let i = 0; i < g.nActive; i++) {
        const o = g.active[i]; if (o.type === 'S' || o.type === 'I') continue;
        const age = t - o.born; if (age < 0 || age >= 0.09) continue;
        ctx.globalAlpha = 0.6 * (1 - age / 0.09); ctx.beginPath(); ctx.arc(0, 0, this.rc + age / 0.09 * 10, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // palier de multiplicateur : anneau lime 24 → 70
    const mf = t - this.multFx;
    if (mf >= 0 && mf < 0.26) { ctx.globalAlpha = 1 - mf / 0.26; ctx.strokeStyle = C.player; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 24 + mf / 0.26 * 46, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  drawPlayer(v, t) {
    const ctx = this.ctx, phi = v.phi, a = phi * RAD, x = Math.cos(a) * R_ORBIT, y = Math.sin(a) * R_ORBIT;
    const skin = v.skins ? v.skins.cursor : 'etincelle', trail = v.skins ? v.skins.trail : 'none';
    // traînée : 10 dernières positions
    if (t - this.trailT > 0.012) {
      this.trailT = t;
      for (let i = this.trail.length - 1; i > 0; i--) this.trail[i] = this.trail[i - 1];
      this.trail[0] = phi; if (this.trailN < 10) this.trailN++;
    }
    if (trail !== 'none' || skin === 'comete') {
      ctx.lineCap = 'round';
      for (let i = 1; i < this.trailN; i++) {
        if (trail === 'pointilles' && i % 2) continue;
        const p0 = this.trail[i - 1], p1 = this.trail[i];
        if (Math.abs(adiff(p1, p0)) < 0.2) continue;
        const f = 1 - i / 10;
        const cols = trail === 'spectre' ? ['#C8FF2E', '#7CF5FF', '#8A5CFF'] : null;
        for (let s = 0; s < (cols ? 3 : 1); s++) {
          ctx.globalAlpha = 0.5 * f; ctx.strokeStyle = cols ? cols[s] : skin === 'comete' ? '#7CF5FF' : C.playerSoft; ctx.lineWidth = 1 + 3 * f;
          const r = R_ORBIT + (cols ? (s - 1) * 3 : 0), d = adiff(p1, p0);
          ctx.beginPath(); ctx.arc(0, 0, r, Math.min(p0, p0 + d) * RAD, Math.max(p0, p0 + d) * RAD); ctx.stroke();
        }
      }
      if (trail === 'echo') for (let i = 3; i <= 9; i += 3) { if (i >= this.trailN) break; ctx.globalAlpha = 0.25; this.cursorShape('etincelle', this.trail[i] * RAD, Math.cos(this.trail[i] * RAD) * R_ORBIT, Math.sin(this.trail[i] * RAD) * R_ORBIT, 1, false); }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
    ctx.drawImage(this.SPR.player, x - 20, y - 20, 40, 40);
    ctx.globalCompositeOperation = 'source-over';
    const blink = v.game && t - v.game.lastHitT < 0.5 && Math.floor((t - v.game.lastHitT) * 16) % 2 === 0;
    ctx.globalAlpha = blink ? 0.35 : 1;
    const st = 1 + Math.min(0.3, Math.abs(v.omega || 0) / 3000);
    this.cursorShape(skin, a, x, y, Math.abs(v.omega || 0) > 300 ? st : 1, true);
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(200,255,46,.5)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  }
  cursorShape(skin, a, x, y, st, full) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a - Math.PI / 2); ctx.scale(st, 1);
    // repère local : −y vers le centre
    ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = C.player; ctx.fillStyle = 'rgba(200,255,46,.22)';
    ctx.beginPath();
    switch (skin) {
      case 'chevron': ctx.moveTo(0, -10); ctx.lineTo(8, 6); ctx.lineTo(0, 2); ctx.lineTo(-8, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
      case 'croche': ctx.ellipse(-2, 3, 7, 5, -20 * RAD, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(4, 2); ctx.lineTo(4, -12); ctx.quadraticCurveTo(10, -8, 9, -2); ctx.stroke(); break;
      case 'diapason': ctx.strokeStyle = C.playerSoft; ctx.moveTo(-4, -12); ctx.lineTo(-4, 2); ctx.quadraticCurveTo(0, 8, 4, 2); ctx.lineTo(4, -12); ctx.moveTo(0, 6); ctx.lineTo(0, 12); ctx.stroke(); break;
      case 'prisme': ctx.moveTo(0, -10); ctx.lineTo(9, 7); ctx.lineTo(-9, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 1; ctx.strokeStyle = '#7CF5FF'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 4); ctx.stroke(); ctx.strokeStyle = '#8A5CFF'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-4, 4); ctx.stroke(); break;
      case 'cristal': ctx.strokeStyle = '#FFFFFF'; ctx.moveTo(0, -11); ctx.lineTo(6, -4); ctx.lineTo(6, 4); ctx.lineTo(0, 11); ctx.lineTo(-6, 4); ctx.lineTo(-6, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = C.player; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.moveTo(-6, -4); ctx.lineTo(6, 4); ctx.stroke(); break;
      case 'couronne': ctx.moveTo(-8, 6); ctx.lineTo(-6, -6); ctx.lineTo(-2, 2); ctx.lineTo(0, -10); ctx.lineTo(2, 2); ctx.lineTo(6, -6); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(8, 6); ctx.stroke(); break;
      case 'comete': ctx.strokeStyle = '#7CF5FF'; ctx.fillStyle = 'rgba(124,245,255,.22)'; // puis losange
      // fallthrough
      default: ctx.moveTo(0, -9); ctx.lineTo(7, 0); ctx.lineTo(0, 9); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, -14); ctx.stroke();
    }
    ctx.restore(); void full;
  }
  drawCombo(v, t, beatEnv) {
    const g = v.game, ctx = this.ctx, k = this.k;
    if (v.countdown) {
      // décompte 4·3·2·1 de 48 px dans le cœur
      ctx.fillStyle = C.player; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.6 + 0.4 * beatEnv; ctx.font = `800 48px ${FONT_NUM}`; ctx.fillText(v.countdown, this.cx, this.cy + 2); ctx.globalAlpha = 1;
      return;
    }
    if (!g || g.combo <= 0 || v.chart.bossKind === 'membrane' && v.silenceCount) return;
    if (g.combo !== this.comboVal) { this.comboVal = g.combo; this.comboStr = String(g.combo); }
    ctx.globalAlpha = 0.95; ctx.fillStyle = C.player; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    this.blitText('combo', this.comboStr, g.combo < 100 ? `800 22px ${FONT_NUM}` : `800 18px ${FONT_NUM}`, C.player, this.cx, this.cy + 1, 'center');
    if (g.mult > 1) {
      const mf = t - this.multFx, sc = mf >= 0 && mf < 0.3 ? 1.4 - mf / 0.3 * 0.4 : 1;
      ctx.font = `800 ${Math.round(10 * sc)}px ${FONT_UI}`;
      ctx.fillText(g.mult === 2 ? '×2' : g.mult === 3 ? '×3' : '×4', this.cx, this.cy + (this.rc + 10) * k);
    }
    ctx.globalAlpha = 1;
  }
  drawJudge(v, t) {
    const j = this.judge; if (j.grade < 0) return;
    const age = t - j.t0; if (age < 0 || age >= 0.4) return;
    const ctx = this.ctx, k = this.k;
    const pa = (v.cam === 'suiveuse' ? 90 : v.phi) * RAD;
    const jx = this.cx + Math.cos(pa) * 96 * k, jy = this.cy + Math.sin(pa) * 96 * k - age / 0.4 * 8 * k;
    const sc = age < 0.08 ? 1.25 - age / 0.08 * 0.25 : 1;
    ctx.globalAlpha = age < 0.08 ? 1 : 1 - (age - 0.08) / 0.32;
    const sp = this.JUDGE[j.grade], w = 110 * sc, h = 20 * sc;
    ctx.drawImage(sp, jx - w, jy - h, w * 2, h * 2);
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ HUD (px CSS, panneaux sombres, toujours au-dessus)
  drawHUD(v, t, beatEnv) {
    const ctx = this.ctx, h = v.hud, W = this.W, m = 12, top = this.safeTop, g = v.game;
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(7,6,13,.55)'; ctx.fillRect(0, 0, W, top + 72);
    ctx.globalAlpha = 0.92;
    // Pouls
    for (let i = 0; i < 4; i++) {
      const x = m + i * 18, y = top + 20, full = g && (h.infinitePouls || i < g.pouls);
      const pulse = g && g.pouls === 1 && i === 0 && !h.infinitePouls ? 1 + 0.25 * beatEnv : 1;
      const lost = i === this.lostSeg && t - this.lostT < 0.3;
      ctx.beginPath(); this.roundRect(x, y - 4 * pulse, 14, 8 * pulse, 3);
      if (lost) { ctx.fillStyle = C.danger; ctx.globalAlpha = 1 - (t - this.lostT) / 0.3; ctx.fill(); ctx.globalAlpha = 0.92; }
      else if (full) { ctx.fillStyle = C.player; ctx.fill(); } else { ctx.strokeStyle = C.lo; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    // titre
    this.blitText('title', h.title, `700 11px ${FONT_UI}`, C.mid, W / 2 + 10, top + 20, 'center', W - 190);
    // pause 48×48 (zone tactile 56×56)
    const px = W - m - 24, py = top + 22;
    this.hud.pause.x = W - 64; this.hud.pause.y = top; this.hud.pause.w = 64; this.hud.pause.h = 52;
    ctx.fillStyle = C.mid; ctx.fillRect(px - 6, py - 8, 4, 16); ctx.fillRect(px + 2, py - 8, 4, 16);
    ctx.strokeStyle = 'rgba(171,164,207,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py, 20, 0, Math.PI * 2); ctx.stroke();
    // score
    if (g && g.score !== this.scoreVal) { this.scoreVal = g.score; this.scoreStr = fmtNum(g.score); }
    this.blitText('score', this.scoreStr, `800 18px ${FONT_NUM}`, C.gold, m, top + 52, 'left');
    // progression / barre de boss / bloc
    const py2 = top + 52;
    if (h.boss) {
      // nom de phase au-dessus de la barre, barre pleine largeur sous la 2e ligne
      const bw = W - 2 * m, by = top + 74;
      ctx.fillStyle = 'rgba(7,6,13,.55)'; ctx.fillRect(0, top + 72, W, 26);
      ctx.fillStyle = C.bg3; ctx.fillRect(m, by + 8, bw, 6);
      ctx.fillStyle = this.accent; ctx.fillRect(m, by + 8, bw * h.progress, 6);
      ctx.fillStyle = '#FFFFFF'; for (const p of h.marks) ctx.fillRect(m + bw * p - 1, by + 6, 2, 10);
      if (h.gauge !== undefined) { ctx.fillStyle = C.player; ctx.fillRect(m, by + 16, bw * Math.min(1, h.gauge), 2); }
      this.blitText('phase', h.phaseName, `800 10px ${FONT_UI}`, C.hi, m, by + 1, 'left', W - 2 * m);
    } else if (h.loop) {
      this.blitText('loop', h.loopStr, `700 12px ${FONT_NUM}`, C.hi, W / 2 + 10, py2, 'center');
    } else {
      const pw = W >= 400 ? 160 : 120, px2 = W / 2 - pw / 2 + 14;
      ctx.fillStyle = C.bg3; ctx.fillRect(px2, py2 - 2, pw, 4);
      ctx.fillStyle = this.accent; ctx.fillRect(px2, py2 - 2, pw * h.progress, 4);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; for (const p of h.marks) ctx.fillRect(px2 + pw * p, py2 - 4, 1, 8);
      if (h.bestPct > 0 && h.bestPct < 1) { ctx.fillStyle = C.gold; ctx.beginPath(); const rx = px2 + pw * h.bestPct; ctx.moveTo(rx, py2 - 5); ctx.lineTo(rx - 3, py2 - 9); ctx.lineTo(rx + 3, py2 - 9); ctx.fill(); }
    }
    // points de mesure
    const nb = v.chart.bpb;
    for (let i = 0; i < nb; i++) {
      const x = W - m - 6 - (nb - 1 - i) * 14; ctx.beginPath(); ctx.arc(x, py2, 4, 0, Math.PI * 2);
      ctx.fillStyle = t >= 0 && i === this.beatIdx ? (i === 0 ? C.player : '#FFFFFF') : C.bg3; ctx.fill();
    }
    // bandeau (un seul message à la fois)
    const b = h.banner;
    if (b) {
      let txt = b.text;
      if (b.dots) { const bl = v.chart.tempo.beatLenAt(t), filled = Math.max(0, Math.min(4, Math.floor((t - b.t0) / bl) + 1)); txt = b.text + '   ' + '●●●●'.slice(0, filled) + '○○○○'.slice(0, 4 - filled); }
      if (txt !== this.bannerTxt) { this.bannerTxt = txt; this.bannerSp = spaced(txt); ctx.font = `800 12px ${FONT_UI}`; this.bannerW = ctx.measureText(this.bannerSp).width + 24; }
      const bw = Math.min(W - 24, this.bannerW), by = top + (h.boss ? 102 : 84);
      ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(7,6,13,.78)'; ctx.beginPath(); this.roundRect(W / 2 - bw / 2, by, bw, 28, 6); ctx.fill();
      this.blitText('banner', this.bannerSp, `800 12px ${FONT_UI}`, b.good ? C.player : b.accent ? this.accent : C.hi, W / 2, by + 14, 'center', W - 36);
      ctx.globalAlpha = 0.92;
    }
    // indication 1er morceau dans la zone du pouce
    if (h.hint) {
      const wob = v.reduced ? 0 : Math.sin(v.chart.tempo.secToBeat(t) * Math.PI) * 6;
      ctx.fillStyle = 'rgba(7,6,13,.55)'; ctx.fillRect(W / 2 - 80, this.H - this.safeBottom - 76, 160, 32);
      ctx.textAlign = 'center'; ctx.font = `600 14px ${FONT_UI}`; ctx.fillStyle = C.mid;
      ctx.fillText(h.hint, W / 2 + wob, this.H - this.safeBottom - 60);
    }
    if (h.fps) { ctx.textAlign = 'left'; ctx.font = `600 10px ${FONT_NUM}`; ctx.fillStyle = C.lo; ctx.fillText(h.fps, m, this.H - this.safeBottom - 12); }
    ctx.globalAlpha = 1;
  }
  // texte pré-rendu (mis en cache tant qu'il ne change pas)
  textSprite(slot, text, font, color, stroke) {
    const c = this.tcache || (this.tcache = {}), key = text + '|' + font + '|' + color + '|' + this.dpr;
    let e = c[slot];
    if (e && e.key === key) return e;
    const cv = e ? e.cv : document.createElement('canvas'), g = cv.getContext('2d'), d = this.dpr;
    g.font = font; const w = Math.ceil(g.measureText(text).width) + 8, h = Math.ceil(parseInt(font.match(/(\d+)px/)[1], 10) * 1.5) + 4;
    cv.width = w * d; cv.height = h * d;
    g.setTransform(d, 0, 0, d, 0, 0); g.font = font; g.textBaseline = 'middle'; g.textAlign = 'left';
    if (stroke) { g.lineWidth = 2; g.strokeStyle = stroke; g.strokeText(text, 4, h / 2); }
    g.fillStyle = color; g.fillText(text, 4, h / 2);
    e = c[slot] = { key, cv, w, h };
    return e;
  }
  blitText(slot, text, font, color, x, y, align, maxW) {
    const e = this.textSprite(slot, text, font, color);
    let w = e.w, h = e.h; if (maxW && w > maxW) { h = h * maxW / w; w = maxW; }
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x - 4;
    this.ctx.drawImage(e.cv, x0, y - h / 2, w, h);
  }
  roundRect(x, y, w, h, r) { const c = this.ctx; c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  hudRects() { return this.hud; }
}
export { PALETTES, ALBUMS, R_OUT };
