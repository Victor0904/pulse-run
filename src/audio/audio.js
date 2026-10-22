// Moteur audio 100 % synthétisé (DESIGN §11). Graphe : musique → duck (sidechain) → filtre musique → gain musique →
// master → compresseur ; sfx → gain sfx → master. Ordonnanceur à lookahead (setInterval 25 ms, 120 ms d'avance) qui lit
// les notes de la charte compilée : une note = songStart + t, exactement l'instant de son obstacle.
import { INST } from '../sim/music.js';
import { pentatonic } from '../sim/music.js';

const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
const LOOKAHEAD = 0.12, TICK = 25, MAX_VOICES = 48;
const PRIO = { [INST.K]: 0, [INST.GK]: 0, [INST.SB]: 0, [INST.BS]: 1, [INST.CL]: 2, [INST.SN]: 2, [INST.ST]: 2, [INST.CR]: 2, [INST.SW]: 2, [INST.WD]: 0,
  [INST.PD]: 3, [INST.LD]: 3, [INST.HH]: 4, [INST.OH]: 4, [INST.GH]: 4, [INST.AR]: 5, [INST.RI]: 3 };

export class AudioEngine {
  constructor() {
    this.ctx = null; this.ok = false; this.voices = 0;
    this.sfxVol = 0.8; this.musicVol = 0.7;
    this.song = null; this.timer = null; this.menu = null; this.lastCount = 0;
  }
  // création / reprise au premier geste
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        const c = this.ctx = new AC({ latencyHint: 'interactive' });
        this.master = c.createGain(); this.master.gain.value = 0.9;
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
        this.master.connect(comp); comp.connect(c.destination);
        this.musicGain = c.createGain(); this.musicGain.gain.value = this.musicVol; this.musicGain.connect(this.master);
        this.silence = c.createGain(); this.silence.connect(this.musicGain);           // FX SILENCE
        this.musicFilter = c.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 18000;
        this.musicFilter.connect(this.silence);
        this.duck = c.createGain(); this.duck.connect(this.musicFilter);
        this.drums = c.createGain(); this.drums.connect(this.musicFilter);
        this.sfx = c.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
        this.passBus = c.createGain(); this.passBus.connect(this.sfx);
        // bruit
        const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0);
        let s = 12345; for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x7fffffff) * 2 - 1; }
        this.noise = nb;
        // réverbe (IR générée : bruit stéréo 1,6 s, décroissance exp(−4t), adoucie)
        const len = Math.floor(c.sampleRate * 1.6), ir = c.createBuffer(2, len, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const a = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const w = (s / 0x7fffffff) * 2 - 1; lp += (w - lp) * 0.45; a[i] = lp * Math.exp(-4 * i / c.sampleRate); } }
        this.reverb = c.createConvolver(); this.reverb.buffer = ir; this.reverbSend = c.createGain(); this.reverbSend.gain.value = 0.6;
        this.reverbSend.connect(this.reverb); this.reverb.connect(this.musicFilter);
        // délai 3/16 de temps, feedback .30, passe-bas 3 kHz dans la boucle
        this.delay = c.createDelay(2); this.delay.delayTime.value = 0.28; const fb = c.createGain(); fb.gain.value = 0.3;
        const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3000;
        this.delaySend = c.createGain(); this.delaySend.connect(this.delay); this.delay.connect(dlp); dlp.connect(fb); fb.connect(this.delay); dlp.connect(this.musicFilter);
        this.ok = true;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    } catch { this.ok = false; return false; }
  }
  get running() { return this.ok && this.ctx.state === 'running'; }
  now() { return this.ctx ? this.ctx.currentTime : 0; }
  outputLatency() { if (!this.ctx) return 0; return (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0); }
  setVolumes(sfx, music) {
    this.sfxVol = sfx; this.musicVol = music;
    if (this.ctx) { const t = this.ctx.currentTime; this.sfx.gain.setTargetAtTime(sfx, t, 0.03); this.musicGain.gain.setTargetAtTime(music, t, 0.03); }
  }
  suspend() { if (this.ctx && this.ctx.state === 'running') return this.ctx.suspend(); return Promise.resolve(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') return this.ctx.resume(); return Promise.resolve(); }

  // ------------------------------------------------------------------ voix
  voice(dur, prio) {
    if (this.voices >= MAX_VOICES && prio > 2) return false;
    if (this.voices >= MAX_VOICES + 16) return false;
    this.voices++;
    setTimeout(() => { this.voices--; }, (dur + 0.1) * 1000 + Math.max(0, (this.at - this.ctx.currentTime) * 1000));
    return true;
  }
  env(g, t, a, peak, dur, rev) {
    if (rev) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur); g.gain.setValueAtTime(0.0001, t + dur + 0.004); return; }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
  }
  osc(type, f0, f1, t, dur, peak, dest, lp, a = 0.003, rev = false, detune = 0) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (detune) o.detune.value = detune;
    this.env(g, t, a, peak, dur, rev);
    let n = o;
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); n = f; }
    n.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dur + 0.05);
    return g;
  }
  noiseHit(t, dur, peak, type, f, q, dest, rev = false, f1) {
    const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = dur > 0.9; fl.type = type; fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (q) fl.Q.value = q;
    this.env(g, t, 0.002, peak, dur, rev);
    s.connect(fl); fl.connect(g); g.connect(dest);
    s.start(t, (t * 7.31) % 0.5); s.stop(t + dur + 0.05);
    return g;
  }

  // ------------------------------------------------------------------ instruments (DESIGN §11.2)
  play(n, at, style) {
    if (!this.voice(Math.max(0.15, n.d || 0.3), PRIO[n.inst] ?? 3)) return;
    this.at = at;
    const rev = !!n.rev, v = n.v || 1, D = this.drums;
    switch (n.inst) {
      case INST.K: case INST.GK: {
        const pk = (n.inst === INST.GK ? 0.5 : 0.9) * v;
        let dest = D;
        if (style.kit === 'rave' || style.kit === 'dnb') { const ws = this.ctx.createWaveShaper(); ws.curve = this.tanh6 || (this.tanh6 = curve(6)); ws.connect(D); dest = ws; }
        this.osc('sine', 160, 42, at, 0.28, pk, dest, 0, 0.002, rev);
        this.noiseHit(at, 0.004, 0.15 * v, 'highpass', 3000, 0, D);
        this.duck.gain.setValueAtTime(0.45, at); this.duck.gain.setTargetAtTime(1, at, 0.05);
        break;
      }
      case INST.CL: for (let i = 0; i < 3; i++) this.noiseHit(at + i * 0.01, i === 2 ? 0.12 : 0.008, 0.35 * v, 'bandpass', 1500, 1.2, D, rev); this.send(this.reverbSend, at, 0.15); break;
      case INST.GH: this.noiseHit(at, 0.008, 0.12 * v, 'bandpass', 1500, 1.2, D); break;
      case INST.SN: this.noiseHit(at, 0.18, 0.4 * v, 'bandpass', 1800, 1, D, rev); this.osc('triangle', 185, 185, at, 0.09, 0.3 * v, D, 0, 0.002, rev); break;
      case INST.HH: this.noiseHit(at, 0.028, 0.09 * v, 'highpass', 8000, 0, D); break;
      case INST.OH: this.noiseHit(at, 0.16, 0.07 * v, 'highpass', 8000, 0, D); break;
      case INST.CR: this.noiseHit(at, 1.4, 0.12 * v, 'highpass', 5000, 0, D, rev); this.noiseHit(at, 0.8, 0.05 * v, 'bandpass', 9000, 3, D); break;
      case INST.WD: this.osc('sine', n.p || 1200, n.p || 1200, at, 0.03, 0.25, this.sfx); break;
      case INST.SB: this.osc('sine', 60, 28, at, 1.2, 0.5, D); break;
      case INST.SW: this.noiseHit(at - Math.min(0.5, style.beat), Math.min(0.5, style.beat), 0.12, 'lowpass', 6000, 0, D, true); break;
      case INST.RI: { const d = n.d || 4; this.noiseHit(at, d, 0.12, 'bandpass', 400, 4, this.duck, true, 8000); break; }
      case INST.BS: this.bass(n, at, style); break;
      case INST.PD: {
        const f = mtof(n.p), d = n.d || 2, lp = style.album === 3 ? 800 : 1200;
        for (const dt of [-8, 8]) { const g = this.osc('sawtooth', f, f, at, d, 0.025, this.duck, lp, 0.35, rev, dt); this.send(this.reverbSend, at, 0.25, g); }
        break;
      }
      case INST.AR: {
        const f = mtof(n.p || 69), g = this.osc('triangle', f, f, at, 0.14, 0.06 * v, this.duck, n.lp ? 1000 : 3000, 0.004, rev);
        this.osc('square', f, f, at, 0.1, 0.015 * v, this.duck, n.lp ? 1000 : 3000, 0.004, rev);
        this.send(this.delaySend, at, 0.25, g);
        break;
      }
      case INST.LD: {
        const f = mtof(n.p), d = Math.max(0.12, n.d || 0.2);
        for (const dt of [-6, 6]) { const g = this.osc('square', f, f, at, d, 0.045 * v, this.duck, 2600, 0.01, rev, dt); this.send(this.delaySend, at, 0.3, g); }
        break;
      }
      case INST.ST: { const r = style.root || 53; for (const k of [0, 3, 7]) this.osc('sawtooth', mtof(r + 12 + k), mtof(r + 12 + k), at, 0.25, 0.05, this.duck, 2500, 0.004, rev); break; }
    }
  }
  send(bus, at, amt, node) { if (node) { const g = this.ctx.createGain(); g.gain.value = amt; node.connect(g); g.connect(bus); } }
  bass(n, at, style) {
    const f = mtof(n.p), d = Math.max(0.08, n.d || 0.2), c = this.ctx;
    if (style.bass === 'funk') {
      const o = c.createOscillator(), s = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
      o.type = 'square'; s.type = 'sine'; o.frequency.value = f; s.frequency.value = f / 2;
      fl.type = 'lowpass'; fl.Q.value = 8; fl.frequency.setValueAtTime(2400, at); fl.frequency.exponentialRampToValueAtTime(400, at + 0.12);
      this.env(g, at, 0.004, 0.24, d, n.rev);
      o.connect(fl); s.connect(fl); fl.connect(g); g.connect(this.duck); o.start(at); s.start(at); o.stop(at + d + 0.1); s.stop(at + d + 0.1);
    } else if (style.bass === 'wobble') {
      const o1 = c.createOscillator(), o2 = c.createOscillator(), sub = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
      o1.type = o2.type = 'sawtooth'; sub.type = 'sine'; o1.frequency.value = o2.frequency.value = f; o1.detune.value = -12; o2.detune.value = 12; sub.frequency.value = f / 2;
      fl.type = 'lowpass'; fl.Q.value = 10; fl.frequency.value = 600;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 1 / Math.max(0.05, (n.lfo || 0.5) * (style.beat || 0.43)); lg.gain.value = 790;
      const off = c.createConstantSource ? c.createConstantSource() : null;
      lfo.connect(lg); lg.connect(fl.frequency); if (off) { off.offset.value = 1010; off.connect(fl.frequency); fl.frequency.value = 0; off.start(at); off.stop(at + d + 0.1); }
      const ws = c.createWaveShaper(); ws.curve = this.tanh3 || (this.tanh3 = curve(3));
      this.env(g, at, 0.01, 0.26, d, n.rev);
      o1.connect(fl); o2.connect(fl); sub.connect(g); fl.connect(ws); ws.connect(g); g.connect(this.duck);
      for (const o of [o1, o2, sub, lfo]) { o.start(at); o.stop(at + d + 0.1); }
    } else {
      const o = c.createOscillator(), s = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
      o.type = 'triangle'; s.type = 'sine'; o.frequency.value = f; s.frequency.value = f / 2;
      fl.type = 'lowpass'; fl.frequency.value = 700; fl.Q.value = 2;
      this.env(g, at, 0.005, 0.3, d, n.rev);
      o.connect(fl); s.connect(fl); fl.connect(g); g.connect(this.duck); o.start(at); s.start(at); o.stop(at + d + 0.12); s.stop(at + d + 0.12);
    }
  }

  // ------------------------------------------------------------------ morceau
  // songStart : heure audio du temps 0 du morceau ; fromT : temps de départ (entraînement)
  startSong(chart, songStart, fromT = 0) {
    this.stopMenu();
    this.song = { chart, start: songStart, idx: 0, from: fromT };
    const N = chart.notes;
    while (this.song.idx < N.length && N[this.song.idx].t < fromT - 0.001) this.song.idx++;
    this.style = this.styleOf(chart, 0);
    this.silence.gain.cancelScheduledValues(0); this.silence.gain.setValueAtTime(1, this.ctx.currentTime);
    this.musicFilter.frequency.cancelScheduledValues(0); this.musicFilter.frequency.setValueAtTime(18000, this.ctx.currentTime);
    // FX SILENCE : tout coupé (10 ms), retour sec au 1er temps suivant
    for (const f of chart.fx) if (f.kind === 'SILENCE') {
      const a = songStart + f.t, b = songStart + chart.secOf(f.beat + f.bars * chart.bpb);
      if (b < this.ctx.currentTime) continue;
      this.silence.gain.setValueAtTime(1, Math.max(this.ctx.currentTime, a - 0.001)); this.silence.gain.linearRampToValueAtTime(0, a + 0.01);
      this.silence.gain.setValueAtTime(0, b - 0.002); this.silence.gain.setValueAtTime(1, b);
      this.passBus.gain.setValueAtTime(1, a); this.passBus.gain.setValueAtTime(0, a + 0.01); this.passBus.gain.setValueAtTime(1, b);
    }
    this.startTimer();
  }
  styleOf(chart, si) {
    const sec = chart.sections[si] || chart.sections[0], album = sec ? sec.album : chart.album;
    const kits = { 1: 'house', 2: 'funk', 3: 'rave' }, basses = { 1: 'rond', 2: 'funk', 3: 'wobble' }, roots = { 1: 57, 2: 50, 3: 53 };
    const base = chart.infinite ? { kit: kits[album], bass: basses[album] } : chart.music;
    return { kit: base.kit, bass: base.bass, album, root: roots[album], beat: 60 / chart.tempo.bpmAt(sec ? sec.beat0 : 0) };
  }
  startTimer() { if (!this.timer) this.timer = setInterval(() => this.tick(), TICK); this.tick(); }
  stopSong() { this.song = null; }
  tick() {
    if (!this.running) return;
    const c = this.ctx;
    if (this.song) {
      const S = this.song, N = S.chart.notes, until = c.currentTime - S.start + LOOKAHEAD, cap = c.currentTime - S.start + 1;
      let n = 0;
      while (S.idx < N.length && N[S.idx].t < until && N[S.idx].t < cap && n < 200) {
        const nt = N[S.idx++]; n++;
        const at = S.start + nt.t;
        if (at < c.currentTime - 0.02) continue;
        if (nt.sec !== this.lastSec) { this.lastSec = nt.sec; this.style = this.styleOf(S.chart, nt.sec); this.delay.delayTime.setValueAtTime(this.style.beat * 0.75, Math.max(c.currentTime, at)); }
        this.play(nt, Math.max(at, c.currentTime), this.style);
      }
    }
    if (this.menu) this.menuTick();
  }
  // note de passage : programmée à l'heure audio songStart + tc (§9.3, DESIGN §11.4)
  passNote(tc, grade, combo, low, tick, key) {
    if (!this.running || !this.song) return;
    const at = Math.max(this.ctx.currentTime, this.song.start + tc);
    const pen = this.penta || (this.penta = {}), sc = pen[key] || (pen[key] = pentatonic(key || 'A', 5));
    let f = mtof(sc[combo % 10] - (low ? 12 : 0));
    const B = this.passBus;
    if (grade === 0) { this.osc('sine', 400, 400, at, 0.02, 0.04, B); return; }
    const pk = grade === 2 ? 0.1 : 0.06;
    switch (tick) {
      case 'cloche': { const c = this.ctx, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
        car.frequency.value = f; mod.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 4, at); mg.gain.exponentialRampToValueAtTime(1, at + 0.3);
        mod.connect(mg); mg.connect(car.frequency); this.env(g, at, 0.003, pk, 0.3); car.connect(g); g.connect(B); car.start(at); mod.start(at); car.stop(at + 0.4); mod.stop(at + 0.4); break; }
      case 'marimba': this.osc('sine', f, f, at, 0.22, pk, B); this.osc('sine', f * 4, f * 4, at, 0.08, pk * 0.12, B); break;
      case 'voix': { const c = this.ctx, bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 5; bp.connect(B);
        for (const dt of [-7, 7]) this.osc('sawtooth', f, f, at, 0.18, pk * 2.5, bp, 0, 0.01, false, dt); break; }
      default: this.osc('triangle', f, f, at, 0.16, pk, B, 0, 0.004); this.osc('sine', f * 2, f * 2, at, 0.12, pk * 0.3, B);
    }
  }
  // ------------------------------------------------------------------ SFX (DESIGN §11.5)
  sfxNow(name, arg) {
    if (!this.running) return;
    const c = this.ctx, t = c.currentTime, S = this.sfx;
    switch (name) {
      case 'hit':
        this.noiseHit(t, 0.25, 0.4, 'lowpass', 1200, 0, S, false, 200); this.osc('sine', 90, 40, t, 0.2, 0.4, S);
        this.musicFilter.frequency.cancelScheduledValues(t); this.musicFilter.frequency.setValueAtTime(this.musicFilter.frequency.value, t);
        this.musicFilter.frequency.exponentialRampToValueAtTime(500, t + 0.02); this.musicFilter.frequency.setTargetAtTime(18000, t + 0.08, 0.12);
        break;
      case 'death':
        this.musicFilter.frequency.cancelScheduledValues(t); this.musicFilter.frequency.setValueAtTime(this.musicFilter.frequency.value, t);
        this.musicFilter.frequency.exponentialRampToValueAtTime(150, t + 0.6);
        this.silence.gain.cancelScheduledValues(t); this.silence.gain.setValueAtTime(this.silence.gain.value, t); this.silence.gain.linearRampToValueAtTime(0, t + 0.6);
        this.osc('sawtooth', 300, 40, t, 0.6, 0.3, S, 1000);
        this.song = null;
        break;
      case 'mult': { const q = arg || t; this.osc('sine', 600, 1800, q, 0.08, 0.12, S); for (const k of [0, 7, 12]) this.osc('triangle', mtof(69 + k), mtof(69 + k), q, 0.2, 0.05, S); break; }
      case 'pouls': for (let i = 0; i < 3; i++) this.osc('triangle', mtof(69 + [0, 4, 7][i]), mtof(69 + [0, 4, 7][i]), t + i * 0.07, 0.12, 0.12, S); break;
      case 'clean': this.bell(1568, t, 0.1); this.bell(2093, t + 0.12, 0.1); break;
      case 'win': this.noiseHit(t, 1.4, 0.15, 'highpass', 5000, 0, S); for (const k of [0, 3, 7]) this.osc('sawtooth', mtof(57 + k), mtof(57 + k), t, 2, 0.03, S, 1500, 0.05);
        for (let i = 0; i < 6; i++) this.osc('triangle', mtof(69 + [0, 3, 7, 12, 15, 19][i]), mtof(69 + [0, 3, 7, 12, 15, 19][i]), t + i * 0.09, 0.2, 0.08, S); break;
      case 'star': this.bell([1568, 1976, 2349][arg || 0], arg2t(arg, t), 0.14); break;
      case 'rank': for (const f of [523, 784, 1047]) this.osc('sine', f, f, t, 0.4, 0.16 / 3, S); if (arg) this.noiseHit(t, 0.6, 0.06, 'highpass', 8000, 0, S); break;
      case 'tap': this.osc('sine', 660, 660, t, 0.025, 0.08, S); break;
      case 'ok': this.osc('sine', 880, 1320, t, 0.06, 0.08, S); break;
      case 'back': this.osc('sine', 660, 440, t, 0.06, 0.08, S); break;
      case 'buy': [523, 659, 784, 1047].forEach((f, i) => this.osc('triangle', f, f, t + i * 0.06, 0.1, 0.1, S)); this.osc('sine', 2093, 2093, t + 0.24, 0.2, 0.1, S); break;
      case 'count': if (performance.now() - this.lastCount > 40) { this.lastCount = performance.now(); this.osc('square', 1800, 1800, t, 0.012, 0.03, S); } break;
      case 'wood': this.osc('sine', arg ? 1600 : 1200, arg ? 1600 : 1200, t, 0.03, 0.25, S); break;
    }
  }
  bell(f, t, pk) {
    const c = this.ctx, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 4, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.3);
    mod.connect(mg); mg.connect(car.frequency); this.env(g, t, 0.003, pk, 0.5); car.connect(g); g.connect(this.sfx);
    car.start(t); mod.start(t); car.stop(t + 0.6); mod.stop(t + 0.6);
  }
  // bois programmé (calibration, décompte de reprise)
  woodAt(at, accent) { if (!this.running) return; this.osc('sine', accent ? 1600 : 1200, accent ? 1600 : 1200, at, 0.03, 0.25, this.sfx); }
  kickAt(at) { if (!this.running) return; this.osc('sine', 160, 42, at, 0.28, 0.8, this.sfx); }

  // ------------------------------------------------------------------ musique de menu (96 BPM, pad + kick doux + pluck)
  startMenu(album = 1, lowpass = false) {
    if (!this.ok) return;
    this.song = null;
    const c = this.ctx;
    if (this.menu && this.menu.album === album && this.menu.lp === lowpass) return;
    const beat = 60 / 96, start = this.menu ? this.menu.next : c.currentTime + 0.1;
    this.menu = { album, lp: lowpass, beat, step: this.menu ? this.menu.step : 0, next: start };
    this.silence.gain.cancelScheduledValues(0); this.silence.gain.setValueAtTime(1, c.currentTime);
    this.musicFilter.frequency.cancelScheduledValues(0);
    this.musicFilter.frequency.setTargetAtTime(lowpass ? 2000 : 18000, c.currentTime, 0.3);
    this.startTimer();
  }
  stopMenu() { this.menu = null; }
  menuBeatPhase() { if (!this.menu || !this.ctx) return 0; const m = this.menu; return ((this.ctx.currentTime - (m.next - m.beat / 4 * 0)) / m.beat) % 1; }
  menuTick() {
    const m = this.menu, c = this.ctx, sixteenth = m.beat / 4;
    const chords = { 1: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], 2: [[50, 53, 57, 60], [55, 59, 62, 65], [50, 53, 57, 60], [57, 60, 64, 67]], 3: [[53, 56, 60], [54, 58, 61], [53, 56, 60], [51, 55, 58]] }[m.album];
    const style = { kit: ['house', 'house', 'funk', 'rave'][m.album], bass: ['rond', 'rond', 'funk', 'wobble'][m.album], album: m.album, beat: m.beat, root: 57 };
    while (m.next < c.currentTime + LOOKAHEAD) {
      const s = m.step % 16, bar = Math.floor(m.step / 16), ch = chords[bar % 4], at = m.next;
      if (s === 0) { this.play({ inst: INST.PD, p: ch[0], d: m.beat * 4, v: 1 }, at, style); this.play({ inst: INST.PD, p: ch[1], d: m.beat * 4, v: 1 }, at, style); this.play({ inst: INST.PD, p: ch[2], d: m.beat * 4, v: 1 }, at, style); }
      if (s % 4 === 0) this.play({ inst: INST.K, v: 0.55 }, at, style);
      if (s % 4 === 2) this.play({ inst: INST.HH, v: 0.6 }, at, style);
      if (s % 2 === 0) this.play({ inst: INST.AR, p: ch[(s >> 1) % ch.length] + 12, v: 0.7 }, at, style);
      if (m.album > 1 && s % 8 === 4) this.play({ inst: m.album === 3 ? INST.SN : INST.CL, v: 0.6 }, at, style);
      m.step++; m.next += sixteenth;
    }
  }
  // instant de la prochaine croche de la musique du menu (transitions calées sur la musique, ≤ 150 ms)
  nextEighthDelay() {
    if (!this.menu || !this.running) return 0;
    const e = this.menu.beat / 2, ph = (this.ctx.currentTime % e);
    return Math.min(0.15, e - ph);
  }
}
function arg2t(a, t) { return t; }
function curve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }
