// PULSE RUN — application : boucle de rendu, horloge audio, entrées, flux de partie, sauvegarde.
import { STEP, K_DRAG, MAX_POULS, ALBUMS, RAD } from './core/const.js';
import { SmoothClock, PerfSource, clampLatency } from './core/clock.js';
import { localDateKey, hashString } from './core/rng.js';
import { Banner } from './core/banner.js';
import { feedBanners, gameEventBanner } from './core/messages.js';
import { profileKey } from './core/calib.js';
import { compileSong } from './sim/chart.js';
import { Game, EV } from './sim/sim.js';
import { Bot } from './sim/bot.js';
import { Infinite, paletteOf } from './sim/infinite.js';
import { rankFor, starsFor } from './sim/scoring.js';
import { SONGS, SONG_BY_ID } from './songs/index.js';
import { AudioEngine } from './audio/audio.js';
import { Renderer } from './render/renderer.js';
import { loadSave, writeSave } from './meta/save.js';
import { applySongResult, applyLoopResult } from './meta/economy.js';
import { ensureDaily, progressDaily, checkTrophies } from './meta/challenges.js';
import { UI } from './ui/ui.js';

const DEBUG = /[?&]debug=1/.test(location.search);
const canvas = document.getElementById('game');
const app = window.__pr = {
  mode: 'menu', paused: false, resumeAt: 0, save: null, game: null, chart: null, song: null, opts: {}, inf: null,
  audio: new AudioEngine(), renderer: new Renderer(canvas), banner: new Banner(), ui: null,
  songStart: 0, latency: 0, latT: 0, calibMs: 0, fps: 60, refreshMs: 1000 / 60, quality: 0, qAuto: true,
  frameStats: { n: 0, sum: 0, work: 0 }, renders: 0, steps: 0, drift: [], storage: null,
};
try { app.storage = window.localStorage; } catch { app.storage = null; }
const mem = new Map();
const storage = app.storage || { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
app.save = loadSave(storage).save;
let saveTimer = 0;
app.persist = (now = false) => {
  if (app.mode === 'game' && !app.paused && !now) return;            // jamais pendant un morceau
  clearTimeout(saveTimer);
  if (now) writeSave(storage, app.save); else saveTimer = setTimeout(() => writeSave(storage, app.save), 300);
};

// ------------------------------------------------------------------ horloge
const perfSrc = new PerfSource(() => performance.now());
const audioSrc = {
  perfNow: () => performance.now(),
  ctxTime: () => app.audio.ctx.currentTime,
  outputTimestamp: () => { const c = app.audio.ctx; if (!c || !c.getOutputTimestamp) return null; const ts = c.getOutputTimestamp(); return ts && ts.contextTime > 0 && ts.performanceTime > 0 ? ts : null; },
};
app.clockSrc = perfSrc; app.clock = new SmoothClock(perfSrc);
function useAudioClock() {
  const src = app.audio.ok ? audioSrc : perfSrc;
  if (src !== app.clockSrc) { app.clockSrc = src; app.clock = new SmoothClock(src); }
}
const srcNow = () => (app.clockSrc === perfSrc ? perfSrc.ctxTime() : app.audio.ctx.currentTime);
// getOutputTimestamp donne déjà l'instant entendu : la latence de sortie ne doit alors pas être retranchée deux fois
const usesTs = () => app.clockSrc === audioSrc && !!audioSrc.outputTimestamp();

// ------------------------------------------------------------------ réglages
app.reducedActive = () => { const r = app.save.settings.reducedMotion; return r === 'oui' || (r === 'auto' && matchMedia('(prefers-reduced-motion: reduce)').matches); };
app.camera = () => { const s = app.save.settings; return app.reducedActive() && !s.cameraChosen ? 'fixe' : s.camera; };
app.applySettings = () => {
  const s = app.save.settings;
  app.audio.setVolumes(s.sfx, s.music);
  document.documentElement.dataset.motion = app.reducedActive() ? 'reduced' : 'full';
  app.fpsCap = s.fps === '60';
  app.qAuto = s.quality === 'auto';
  if (!app.qAuto) setQuality({ haute: 0, moyenne: 1, basse: 3 }[s.quality] ?? 0);
  app.persist();
};
function setQuality(q) {
  if (q === app.quality) return;
  app.quality = q; app.renderer.setQuality(q); resize();
}
app.setQuality = setQuality;
app.calibProfile = () => {
  const c = app.save.calib, key = profileKey(app.audio.outputLatency());
  return c.profiles[key] || { audioMs: c.audioMs, judgeMs: c.judgeMs };
};

// ------------------------------------------------------------------ vibration (max 1 appel / 90 ms)
let lastVib = 0;
app.vibrate = pattern => {
  if (!app.save.settings.vibration || !navigator.vibrate) return;
  const now = performance.now(); if (now - lastVib < 90) return; lastVib = now;
  try { navigator.vibrate(pattern); } catch { /* ignoré */ }
};

// ------------------------------------------------------------------ dimensions
function safeInsets() { const p = getComputedStyle(document.getElementById('probe')); return { top: parseFloat(p.paddingTop) || 0, bottom: parseFloat(p.paddingBottom) || 0 }; }
function resize() {
  const s = safeInsets();
  app.renderer.resize(window.innerWidth, window.innerHeight, s.top, s.bottom);
}
addEventListener('resize', () => { resize(); if (innerWidth > innerHeight && innerHeight < 500 && app.mode === 'game') app.pause(); });

// ------------------------------------------------------------------ démo du menu (bot sur une boucle à 96 BPM)
function newDemo() {
  const inf = new Infinite(4242);
  for (let i = 0; i < 6; i++) inf.addBlock();
  const g = new Game(inf.chart, { mode: 'infinite' }), bot = new Bot(inf.chart, { speed: 600, precision: 0.92, seed: 5 });
  g.pouls = MAX_POULS;
  app.demo = { inf, game: g, bot, t: 0 };
}
function stepDemo(dt) {
  const d = app.demo; if (!d) return;
  d.t += dt;
  const g = d.game;
  while (g.t + STEP <= d.t && !g.over) { d.bot.update(g); g.step(); if (g.pouls < 2) g.pouls = MAX_POULS; drainDemo(g); }
  if (g.over || d.t > d.inf.chart.duration - 4) newDemo();
}
function drainDemo(g) { let e; while ((e = g.pollEvent())) if (e.type === EV.JUDGE) app.renderer.onJudge(e.a, g.phi, e.ob, g.t, g.phi); }

// ------------------------------------------------------------------ parties
const chartCache = new Map();
function chartFor(song, opts) {
  const key = `${song.id}|${opts.echo ? 1 : 0}|${opts.speed || 1}`;
  if (!chartCache.has(key)) chartCache.set(key, compileSong(song, { echo: !!opts.echo, speed: opts.speed || 1 }));
  return chartCache.get(key);
}
app.chartFor = chartFor;

// opts : { echo, training: { speed, section } } ; ou startLoop(daily)
app.startSong = (song, opts = {}) => {
  app.audio.unlock(); useAudioClock();
  const chart = chartFor(song, { echo: opts.echo, speed: opts.training ? opts.training.speed : 1 });
  app.save.last.song = song.id;
  begin(chart, { song, ...opts, kind: opts.training ? 'training' : 'song' }, {
    infinitePouls: !!opts.training, startSection: opts.training ? opts.training.section || 0 : opts.debugSection || 0, mode: 'song',
  });
};
app.startLoop = (daily = false) => {
  app.audio.unlock(); useAudioClock();
  const date = localDateKey(), seed = daily ? hashString(date) : (Date.now() >>> 0);
  const inf = new Infinite(seed, { daily });
  inf.ensure(0);
  app.inf = inf;
  begin(inf.chart, { kind: 'loop', daily, date }, { mode: 'infinite' });
};
function begin(chart, opts, gopts) {
  const prof = app.calibProfile();
  app.calibMs = prof.audioMs;
  app.latency = clampLatency(app.audio.outputLatency()); app.latT = performance.now();
  const lead = 0.06 + Math.max(0, app.latency + app.calibMs / 1000);
  if (opts.kind !== 'loop') app.inf = null;
  app.chart = chart; app.opts = opts; app.song = opts.song || null;
  const g = app.game = new Game(chart, Object.assign({ judgeDelay: prof.judgeMs / 1000, passLead: lead }, gopts));
  app.banner.reset(); feedBanners(chart, app.banner, g.tStart);
  const r = app.renderer;
  r.resetFx(); r.setPalette(chart.infinite ? 0 : chart.album - 1, app.save.equipped.bg);
  app.fxIdx = 0; app.dropSeen = new Set();
  // temps 0 du morceau = début du DÉCOMPTE, 0,30 s après le lancement
  const now = srcNow();
  app.songStart = now + 0.30 - g.tStart;
  app.clock.reset(); app.clock.read();
  if (app.audio.ok) app.audio.startSong(chart, app.songStart + (usesTs() ? 0 : 0), g.tStart);
  app.mode = 'game'; app.paused = false; app.resumeAt = 0; app.endShownAt = 0; app.deathPerf = 0; app.winPerf = 0;
  app.lastT = g.t; app.runStart = performance.now(); app.ptr = null; app.moved = false;
  app.silenceStats = null;
  app.drift.length = 0;
  app.ui.show('game');
  app.vibrate([8]);
}
app.restart = () => {
  if (app.opts.kind === 'loop') app.startLoop(app.opts.daily);
  else app.startSong(app.song, app.opts.kind === 'training' ? { training: app.opts.training, echo: app.opts.echo } : { echo: app.opts.echo, training: app.opts.training });
};
app.restartSection = () => {
  if (app.opts.kind !== 'training') return;
  const g = app.game, sec = g.sectionAt(Math.max(0, g.t));
  app.startSong(app.song, { training: Object.assign({}, app.opts.training, { section: Math.max(sec, 1) }), echo: app.opts.echo });
};

// ------------------------------------------------------------------ pause / reprise
app.pause = () => {
  if (app.mode !== 'game' || app.paused || app.game.over) return;
  app.paused = true; app.resumeAt = 0;
  if (app.clockSrc === perfSrc) perfSrc.suspend(); else app.audio.suspend();
  app.ui.show('pause');
  app.persist(true);
};
app.resume = () => {
  if (!app.paused) return;
  // décompte visuel de 3 temps au tempo courant (piloté par performance.now, horloge de jeu figée)
  const bl = app.chart.tempo.beatLenAt(Math.max(0, app.game.t));
  app.resumeAt = performance.now() + 3 * bl * 1000; app.resumeBeat = bl;
  app.ui.show('game');
};
function doResume() {
  app.paused = false; app.resumeAt = 0;
  if (app.clockSrc === perfSrc) perfSrc.resume(); else app.audio.resume();
  app.clock.reset();
}
app.quit = () => {
  // quitter : ◎ d'échec accordées
  if (app.mode === 'game' && app.game && !app.game.over) { app.game.over = true; app.game.dead = true; finish(true); }
  app.audio.stopSong(); app.paused = false;
  if (app.clockSrc === perfSrc) perfSrc.resume(); else app.audio.resume();
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { app.pause(); app.persist(true); }
  else if (app.audio.ctx && app.mode !== 'game') app.audio.resume();
});
addEventListener('pagehide', () => app.persist(true));

// ------------------------------------------------------------------ entrées (un doigt)
function toU(px) { return px / app.renderer.k; }
function inPause(e) { const p = app.renderer.hudRects().pause; return e.clientX >= p.x && e.clientY <= p.y + p.h + 4 && e.clientY >= 0; }
canvas.addEventListener('pointerdown', e => {
  app.audio.unlock();
  if (app.mode !== 'game' || app.paused) return;
  if (inPause(e)) { app.pause(); return; }
  if (app.ptr) return;                                       // seul le premier pointeur actif compte
  app.ptr = { id: e.pointerId, x: e.clientX };
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ignoré */ }
  if (app.save.settings.control === 'maintenir') app.game.hold(e.clientX < innerWidth / 2 ? 1 : -1);
});
canvas.addEventListener('pointermove', e => {
  if (!app.ptr || e.pointerId !== app.ptr.id || app.mode !== 'game' || app.paused) return;
  const s = app.save.settings;
  if (s.control === 'maintenir') { app.game.hold(e.clientX < innerWidth / 2 ? 1 : -1); return; }
  const dx = e.clientX - app.ptr.x; app.ptr.x = e.clientX;
  if (!dx) return;
  app.game.drag(-toU(dx) * K_DRAG * s.sensitivity * (s.invert ? -1 : 1));
  app.moved = true;
});
const up = e => {
  if (!app.ptr || e.pointerId !== app.ptr.id) return;
  app.ptr = null;
  if (app.game) app.game.hold(0);
};
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
// clavier (ordinateur) : ← → maintenus, Échap / P = pause
const keys = { l: false, r: false };
addEventListener('keydown', e => {
  if (app.mode !== 'game') return;
  if (e.key === 'Escape' || e.key === 'p') { app.paused ? app.resume() : app.pause(); return; }
  if (e.key === 'ArrowLeft') keys.l = true; if (e.key === 'ArrowRight') keys.r = true;
  if (!app.paused) { app.game.hold(keys.l && !keys.r ? 1 : keys.r && !keys.l ? -1 : 0); app.moved = true; }
});
addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft') keys.l = false; if (e.key === 'ArrowRight') keys.r = false;
  if (app.game && app.mode === 'game') app.game.hold(keys.l && !keys.r ? 1 : keys.r && !keys.l ? -1 : 0);
});

// ------------------------------------------------------------------ événements de jeu → juice, audio, vibration
function handleEvents(g) {
  const r = app.renderer, a = app.audio, red = app.reducedActive(), ch = app.chart;
  let e;
  while ((e = g.pollEvent())) {
    switch (e.type) {
      case EV.JUDGE: {
        const ob = e.ob;
        let gc = g.phi;
        if (ob && ob.type !== 'A' && ob.type !== 'S') { let bd = 999; const c0 = g.angleAt(ob, g.t); for (let q = 0; q < ob.n; q++) { const c = c0 + q * ob.sep, d = Math.abs(((g.phi - c) % 360 + 540) % 360 - 180); if (d < bd) { bd = d; gc = c; } } }
        r.onJudge(e.a, g.phi, ob, g.t, gc);
        break;
      }
      case EV.PASS: if (a.ok) a.passNote(e.ob.tc, e.a, g.combo, e.b === 1, app.save.equipped.tick, ch.sections[e.ob.sec] ? ALBUMS[ch.sections[e.ob.sec].album].key : 'A'); break;
      case EV.HIT: r.onHit(g.phi, g.t, e.a, red); a.sfxNow('hit'); app.vibrate([45, 25, 45]); break;
      case EV.MULT: {
        r.onMult(e.a, g.t);
        if (a.ok && a.song) { const b = ch.tempo.secToBeat(g.t), nb = Math.ceil(b * 2 + 1e-6) / 2; a.sfxNow('mult', Math.max(a.now(), app.songStart + ch.secOf(nb))); }
        app.vibrate([12]); break;
      }
      case EV.POULS_UP: r.onPoulsUp(g.t); a.sfxNow('pouls'); app.vibrate([10, 30, 10]); break;
      case EV.SECTION_CLEAN: gameEventBanner(app.banner, e, ch); a.sfxNow('clean'); break;
      case EV.CRACK: gameEventBanner(app.banner, e, ch); a.sfxNow('clean'); break;
      case EV.PALIER: gameEventBanner(app.banner, e, ch); r.setPalette(paletteOf(e.a) % 3, app.save.equipped.bg); app.vibrate([10, 30, 10]); break;
      case EV.DEATH: r.onDeath(g.phi, g.t, red); a.sfxNow('death'); app.vibrate([120]); app.deathPerf = performance.now(); break;
      case EV.WIN: r.onWin(g.t); a.sfxNow('win'); app.vibrate([20, 40, 20, 40, 60]); app.winPerf = performance.now(); break;
    }
  }
  // DROP (premier temps) : flash d'accent, aberration, vibration
  const F = ch.fx;
  while (app.fxIdx < F.length && F[app.fxIdx].t <= g.t) {
    const f = F[app.fxIdx++];
    if (f.kind === 'DROP' && f.t > g.t - 0.2) { r.onDrop(g.t, red); app.vibrate([30]); }
  }
}

// ------------------------------------------------------------------ fin de partie
function finish(quit = false) {
  const g = app.game, o = app.opts, s = app.save;
  if (app.mode !== 'game') return;
  app.mode = 'end';
  const playTime = (performance.now() - app.runStart) / 1000;
  const acc = g.accuracy(), won = g.won && !quit;
  const res = { won, score: g.score, acc, rank: won ? rankFor(acc, g.hits === 0) : null, hits: g.hits, maxCombo: g.maxCombo, pct: g.progress(),
    perfect: g.perfect, good: g.good, ok: g.okc, miss: g.miss, time: Math.max(0, g.t), block: 0 };
  s.stats.playTime += playTime;
  if (o.kind !== 'training') { s.stats.perfects += g.perfect; s.stats.maxCombo = Math.max(s.stats.maxCombo, g.maxCombo); }
  let eco = null;
  if (o.kind === 'loop') {
    const sec = app.chart.sections[g.sectionAt(Math.max(0, g.t))];
    res.block = sec && sec.block !== undefined ? sec.block : 0;
    eco = applyLoopResult(s, res, { daily: o.daily, date: o.date });
  } else eco = applySongResult(s, app.song, res, { echo: o.echo, training: o.kind === 'training' });
  // section SILENCE terminée sans RATÉ (trophée)
  let silenceClean = false;
  for (const f of app.chart.fx) if (f.kind === 'SILENCE' && o.kind === 'song') { const ss = g.secStats[f.sec]; if (ss && ss.miss === 0 && g.t > app.chart.sections[f.sec].t1) silenceClean = true; }
  ensureDaily(s, localDateKey());
  const changed = progressDaily(s, { kind: o.kind, perfect: g.perfect, playTime, won, rank: res.rank, album: app.song ? app.song.album : 0, songN: app.song ? app.song.n : 0,
    boss: !!(app.song && app.song.boss), hits: g.hits, acc, maxCombo: g.maxCombo, maxCleanRun: g.maxCleanRun, time: res.time, block: res.block });
  const trophies = o.kind === 'training' ? [] : checkTrophies(s, { silenceClean });
  app.result = { res, eco, changed, trophies, stars: won ? starsFor(res) : [0, 0, 0], quit };
  app.persist(true);
}

// ------------------------------------------------------------------ boucle principale
let last = performance.now(), lastRender = 0;
const fs = { n: 0, sum: 0, t: 0, work: 0, late: 0, good: 0, cool: 0 };
app.ft = fs;
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = Math.min(250, now - last); last = now;
  // « 60 FPS » : on saute les rAF intermédiaires (la simulation reste calée sur l'horloge audio)
  if (app.fpsCap && now - lastRender < 16.6 - 2) return;
  const fdt = lastRender ? Math.min(250, now - lastRender) : 16.7; lastRender = now;
  const w0 = performance.now();
  const r = app.renderer, s = app.save.settings, red = app.reducedActive();
  app.renders++;
  r.update(fdt / 1000);
  if ((app.mode === 'game' || app.mode === 'end') && app.game) {
    const g = app.game, ch = app.chart;
    if (app.mode === 'game' && !app.paused) {
      if (now - app.latT > 2000) { app.latency = clampLatency(app.audio.outputLatency()); app.latT = now; }
      const tA = app.clock.read();
      const lat = usesTs() ? 0 : app.latency;
      const tJ = tA - app.songStart - lat - app.calibMs / 1000;
      if (app.inf) { const before = ch.sections.length; app.inf.ensure(Math.max(0, tJ)); if (ch.sections.length !== before) { g.buildOrder(); while (g.secStats.length < ch.sections.length) g.secStats.push({ n: 0, miss: 0, perfect: 0 }); feedBanners(ch, app.banner, ch.sections[before].t0 - 0.001); } }
      const n0 = g.t;
      if (app.autoBot === 'simple') {
        // pilote léger (mesures de perf) : vise le centre de la prochaine brèche, Pouls infinis
        g.opts.infinitePouls = true;
        let best = null; for (let i = 0; i < g.nActive; i++) { const o = g.active[i]; if (o.type === 'A' || o.type === 'S' || o.judged) continue; if (!best || o.tc < best.tc) best = o; }
        if (best) { const d = ((g.angleAt(best, g.t) - g.phi) % 360 + 540) % 360 - 180; g.pending = 0; g.drag(d); }
        g.advanceTo(tJ);
      } else if (app.autoBot) {
        // crochet de test : un bot pilote le Curseur pas à pas (captures, mesures de perf)
        if (!app.botObj || app.botObj.chart !== ch) app.botObj = new Bot(ch, { speed: 900, precision: 0.97, seed: 9 });
        let n = 0; while (!g.over && g.t + STEP <= tJ + 1e-9 && n++ < 64) { app.botObj.update(g); g.step(); }
      } else g.advanceTo(tJ);
      app.steps += Math.round((g.t - n0) / STEP);
      // dérive audio/visuel : écart entre le temps de jeu et l'horloge audio brute (mesure de test)
      if (app.audio.ok && DEBUG_DRIFT) app.drift.push([tJ, app.audio.ctx.currentTime - app.songStart - app.latency - app.calibMs / 1000 - tJ]);
      handleEvents(g);
      if (g.dead && app.deathPerf && now - app.deathPerf > 700) { finish(); app.ui.show('end'); }
      if (g.won && app.winPerf && now - app.winPerf > 1000) { finish(); app.ui.show('end'); }
      app.renderT = tJ;
    } else if (app.paused && app.resumeAt && now >= app.resumeAt) doResume();
    // interpolation : rendu à tJ − 1 pas, φ interpolé entre les deux derniers pas
    const alpha = app.mode === 'game' && !app.paused && !g.over ? Math.max(0, Math.min(1, (app.renderT - g.t) / STEP)) : 1;
    const phi = g.phiPrev + (((g.phi - g.phiPrev + 540) % 360) - 180) * alpha;
    const tR = g.over ? (g.dead ? g.deathT : g.t) : g.t - STEP + alpha * STEP;
    const sec = ch.sections[g.sectionAt(Math.max(0, tR))];
    let countdown = 0;
    if (app.paused && app.resumeAt) countdown = Math.max(1, Math.ceil((app.resumeAt - now) / (app.resumeBeat * 1000)));
    else if (sec && sec.kind === 'count') countdown = Math.max(1, Math.min(4, 4 - Math.floor(ch.tempo.secToBeat(Math.max(tR, sec.t0)) - sec.beat0)));
    else if (tR < (ch.sections[0] ? ch.sections[0].t0 : 0)) countdown = 4;
    app.view = app.view || {};
    const v = app.view;
    v.game = g; v.chart = ch; v.t = tR; v.phi = phi; v.omega = g.omega; v.cam = app.camera(); v.reduced = red; v.ghosts = s.ghosts;
    v.skins = app.save.equipped; v.dead = g.dead; v.deathT = g.deathT; v.fatal = g.fatal; v.deathAge = app.deathPerf ? (now - app.deathPerf) / 1000 : 0;
    v.countdown = countdown || 0;
    v.prism = ch.infinite && sec && sec.block !== undefined && paletteOf(sec.block) === 3 ? (tR * 0.15) % 3 : 0;
    v.hud = hudState(g, ch, tR, sec);
    r.frame(v);
  } else {
    // menus : démo vivante derrière les écrans, pulsée au tempo
    if (!app.demo) newDemo();
    stepDemo(fdt / 1000);
    const d = app.demo, g = d.game;
    const v = app.view = app.view || {};
    v.game = g; v.chart = d.inf.chart; v.t = g.t; v.phi = g.phi; v.omega = g.omega; v.cam = app.camera(); v.reduced = red; v.ghosts = s.ghosts;
    v.skins = app.save.equipped; v.dead = false; v.countdown = 0; v.prism = 0; v.hud = null; v.deathAge = 0;
    drainDemo(g);
    r.frame(v);
  }
  measure(fdt, performance.now() - w0);
}
const DEBUG_DRIFT = /[?&]drift=1/.test(location.search) || DEBUG;
function hudState(g, ch, t, sec) {
  const h = app.hudObj || (app.hudObj = { marks: [] });
  const o = app.opts;
  h.title = o.kind === 'loop' ? (o.daily ? 'BOUCLE DU JOUR' : 'BOUCLE') : (app.song.title.toUpperCase().slice(0, 18) + (o.kind === 'training' ? ' · ENTR.' : o.echo ? ' · ÉCHO' : ''));
  h.infinitePouls = o.kind === 'training';
  h.banner = app.banner.update(t);
  h.boss = !!(app.song && app.song.boss) && o.kind !== 'loop';
  h.loop = o.kind === 'loop';
  if (h.loop) {
    const sec2 = sec || ch.sections[0], blk = sec2 && sec2.block !== undefined ? sec2.block : 0, tt = Math.max(0, t), mm = Math.floor(tt / 60), ss = Math.floor(tt % 60);
    const key = blk * 10000 + mm * 60 + ss;
    if (key !== h.loopKey) { h.loopKey = key; h.loopStr = `BLOC ${blk} · ${mm}:${ss < 10 ? '0' : ''}${ss}`; }
  } else {
    h.progress = Math.max(0, Math.min(1, t / ch.duration));
    if (h.chart !== ch) { h.chart = ch; h.marks = ch.sections.filter(x => x.t0 > 0 && (!h.boss || x.phase)).map(x => x.t0 / ch.duration); }
    const rec = app.song && app.save.songs[app.song.id];
    h.bestPct = rec ? rec.bestPct : 0;
    if (h.boss) {
      h.phaseName = sec && sec.phase ? `${app.song.title} · ${sec.phase} · ${sec.name}` : app.song.title;
      const ss = sec && g.secStats[sec.idx];
      h.gauge = ss && ss.n ? ss.perfect / ss.n / 0.7 : 0;
    }
  }
  h.hint = app.song && app.song.tutorial && !app.moved && o.kind === 'song' && t > 1 ? '←  glisse  →' : '';
  h.fps = DEBUG ? `${app.fps.toFixed(0)} FPS · ${(1000 / app.refreshMs).toFixed(0)} Hz · Q${app.quality} · DPR ${app.renderer.dpr}` : '';
  return h;
}
// FPS et qualité adaptative (PULSAR v2) : moyenne sur 2 s ; > 18,5 ms → un cran plus bas ; < 13 ms pendant 10 s → un cran plus haut
const iv = new Float32Array(120); let ivI = 0, ivN = 0, fpsAcc = 0, fpsN = 0;
function measure(ms, work) {
  if (ms <= 0 || ms > 1000) return;
  const st = app.frameStats; st.n++; st.sum += ms; st.work += work;
  if (!app.fpsCap) { iv[ivI] = ms; ivI = (ivI + 1) % iv.length; if (ivN < iv.length) ivN++; }
  fpsAcc += ms; fpsN++;
  if (fpsAcc > 500) { app.fps = 1000 * fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  if (app.mode !== 'game' || app.paused) { fs.sum = fs.n = fs.t = fs.work = 0; return; }
  fs.sum += ms; fs.n++; fs.t += ms; fs.work += work;
  if (fs.t >= 2000) {
    if (ivN >= 60) { const a = Array.from(iv.subarray(0, ivN)).sort((x, y) => x - y); const p20 = a[Math.floor(ivN * 0.2)]; app.refreshMs = p20 < app.refreshMs ? p20 : app.refreshMs + (p20 - app.refreshMs) * 0.15; }
    const avg = fs.sum / fs.n, avgWork = fs.work / fs.n;
    app.lastQ = { avg: +avg.toFixed(2), work: +avgWork.toFixed(2) };
    if (fs.cool > 0) fs.cool -= fs.t;
    if (app.qAuto) {
      const budget = app.fpsCap ? 1000 / 60 : app.refreshMs;
      if ((avg > 18.5 || avgWork > budget * 0.85) && app.quality < 3) { setQuality(app.quality + 1); fs.good = 0; fs.cool = 10000; }
      else if (avg < 13 && avgWork < budget * 0.5 && app.quality > 0 && fs.cool <= 0) { fs.good += fs.t; if (fs.good >= 10000) { setQuality(app.quality - 1); fs.good = 0; } }
      else fs.good = 0;
    }
    fs.sum = fs.n = fs.t = fs.work = 0;
  }
}

// ------------------------------------------------------------------ démarrage
app.ui = new UI(app);
resize();
app.applySettings();
ensureDaily(app.save, localDateKey());
app.ui.show('title');
requestAnimationFrame(frame);
document.addEventListener('pointerdown', () => { app.audio.unlock(); if (app.mode !== 'game') { useAudioClock(); if (app.audio.ok && !app.audio.menu && !app.audio.song) app.ui.menuMusic(); } }, { capture: true });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => { /* hors ligne non disponible */ });
app.SONGS = SONGS; app.SONG_BY_ID = SONG_BY_ID; app.EV = EV; app.RAD = RAD; app.finish = finish;
