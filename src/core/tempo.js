// Carte de tempo (GAME_DESIGN §7.2) : conversion temps (noires) ⇄ secondes, avec changements de tempo
// instantanés ou progressifs (BPM interpolé linéairement en fonction du temps-noire pendant la transition)
// et swing (la croche « et » est placée à swing × noire ; 0 = droit). La musique et la charte utilisent
// la MÊME carte : un obstacle et sa note ont exactement le même instant.

// Swing : déforme la partie fractionnaire d'un temps. f ∈ [0, .5] → [0, s], [.5, 1] → [s, 1]. Identité si s = 0 ou .5.
export function swingWarp(beat, swing) {
  if (!swing || swing === 0.5) return beat;
  const b0 = Math.floor(beat), f = beat - b0;
  if (f === 0) return beat;
  return b0 + (f <= 0.5 ? (f / 0.5) * swing : swing + ((f - 0.5) / 0.5) * (1 - swing));
}

export class TempoMap {
  // bpm : tempo initial ; scale : facteur de vitesse (entraînement 0,7 / 0,85 / 1)
  constructor(bpm, scale = 1) {
    this.scale = scale;
    // segments : { b0, t0, a, b, len } — a/b = BPM début/fin, len = durée en temps (Infinity pour le dernier)
    this.segs = [{ b0: 0, t0: 0, a: bpm * scale, b: bpm * scale, len: Infinity }];
  }
  // Nouveau tempo `bpm` à partir du temps `beat`, transition sur `over` temps (0 = instantané). Les événements
  // doivent être ajoutés dans l'ordre chronologique.
  addChange(beat, bpm, over = 0) {
    const target = bpm * this.scale;
    let last = this.segs[this.segs.length - 1];
    if (beat < last.b0) throw new Error('TEMPO hors ordre');
    const cur = this.bpmAt(beat);
    // tronque le dernier segment au point de changement
    if (last.len === Infinity) {
      last.len = beat - last.b0;
      if (last.len <= 1e-9) { this.segs.pop(); }
    }
    let b = beat, t = this._t(beat, last);
    if (this.segs.length === 0) t = 0;
    if (over > 0) {
      this.segs.push({ b0: b, t0: t, a: cur, b: target, len: over });
      t = t + this.segDur(this.segs[this.segs.length - 1]);
      b += over;
    }
    this.segs.push({ b0: b, t0: t, a: target, b: target, len: Infinity });
  }
  _t(beat, seg) { return seg.t0 + this.segSec(seg, beat - seg.b0); }
  // secondes écoulées dans un segment après x temps
  segSec(s, x) {
    if (s.a === s.b) return (x * 60) / s.a;
    const bp = s.a + ((s.b - s.a) * x) / s.len;
    return ((60 * s.len) / (s.b - s.a)) * Math.log(bp / s.a);
  }
  segDur(s) { return this.segSec(s, s.len); }
  segAt(beat) {
    const S = this.segs;
    for (let i = S.length - 1; i > 0; i--) if (beat >= S[i].b0) return S[i];
    return S[0];
  }
  segAtSec(t) {
    const S = this.segs;
    for (let i = S.length - 1; i > 0; i--) if (t >= S[i].t0) return S[i];
    return S[0];
  }
  bpmAt(beat) {
    const s = this.segAt(beat);
    if (s.a === s.b) return s.a;
    const x = Math.min(s.len, Math.max(0, beat - s.b0));
    return s.a + ((s.b - s.a) * x) / s.len;
  }
  beatToSec(beat) { const s = this.segAt(beat); return s.t0 + this.segSec(s, beat - s.b0); }
  secToBeat(t) {
    const s = this.segAtSec(t), dt = t - s.t0;
    if (s.a === s.b) return s.b0 + (dt * s.a) / 60;
    // inverse de segSec : bp = a · exp(dt (b − a) / (60 len))
    const bp = s.a * Math.exp((dt * (s.b - s.a)) / (60 * s.len));
    return s.b0 + ((bp - s.a) * s.len) / (s.b - s.a);
  }
  beatLenAt(t) { return 60 / this.bpmAt(this.secToBeat(t)); }
}
