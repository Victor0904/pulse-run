// Horloge de jeu (GAME_DESIGN §9.1–9.2). Référence : AudioContext.currentTime. Le currentTime avance par paquets
// (3–20 ms) : on extrapole avec performance.now() et on lisse l'écart (≤ ±1 ms de correction par lecture/frame),
// avec recalage immédiat si l'erreur dépasse 40 ms (onglet gelé, réveil). Le temps rendu ne recule jamais.
// Testable sous Node : la source est injectée.

export const MAX_SLEW = 0.001, RESYNC = 0.040, MAX_EXTRAP = 0.06;

// Source audio : { ctxTime(): s, perfNow(): ms, outputTimestamp(): {contextTime, performanceTime} | null }
export class SmoothClock {
  constructor(src) {
    this.src = src;
    this.offset = null;        // estimation lissée de (temps audio − perf/1000)
    this.last = -Infinity;     // dernière valeur rendue (monotone)
    this.lastCtx = -1; this.lastPerf = 0;
    this.resyncs = 0;
  }
  // estimation brute du temps audio courant
  raw() {
    const src = this.src, now = src.perfNow();
    const ts = src.outputTimestamp ? src.outputTimestamp() : null;
    if (ts && ts.performanceTime > 0 && ts.contextTime > 0) return ts.contextTime + (now - ts.performanceTime) / 1000;
    const c = src.ctxTime();
    if (c !== this.lastCtx) { this.lastCtx = c; this.lastPerf = now; }
    // extrapolation bornée : un contexte suspendu (currentTime figé) ne doit pas faire avancer le temps
    return this.lastCtx + Math.min(MAX_EXTRAP, (now - this.lastPerf) / 1000);
  }
  // à appeler une fois par frame : renvoie le temps audio lissé (s)
  read() {
    const now = this.src.perfNow() / 1000, est = this.raw(), target = est - now;
    if (this.offset === null) this.offset = target;
    else {
      const err = target - this.offset;
      if (Math.abs(err) > RESYNC) { this.offset = target; this.resyncs++; }
      else this.offset += err > MAX_SLEW ? MAX_SLEW : err < -MAX_SLEW ? -MAX_SLEW : err;
    }
    const v = Math.max(this.last, now + this.offset);
    this.last = v;
    return v;
  }
  // après pause / reprise : l'écart change d'un coup (contexte suspendu) → recalage, sans recul
  reset() { this.offset = null; this.lastCtx = -1; }
}

// Horloge de secours sans WebAudio : même interface (temps « audio » = performance.now() hors pauses)
export class PerfSource {
  constructor(perfNow) { this.perfNow = perfNow; this.paused = false; this.acc = 0; this.t0 = perfNow(); this.pausedAt = 0; }
  ctxTime() { return ((this.paused ? this.pausedAt : this.perfNow()) - this.t0) / 1000; }
  outputTimestamp() { return null; }
  suspend() { if (!this.paused) { this.paused = true; this.pausedAt = this.perfNow(); } }
  resume() { if (this.paused) { this.t0 += this.perfNow() - this.pausedAt; this.paused = false; } }
}

// Temps de jeu (§9.1) : tJeu = tAudio − sortieLatence − calib.audioMs/1000
export function gameTime(audioTime, songStart, outLatency, calibAudioMs) {
  return audioTime - songStart - outLatency - calibAudioMs / 1000;
}
export const clampLatency = l => Math.max(0, Math.min(0.4, l || 0));
