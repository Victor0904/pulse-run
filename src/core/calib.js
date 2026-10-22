// Calibration (GAME_DESIGN §9.4) : mesures pures, testables sous Node.
// Étape 1 « ce que tu ENTENDS » : Lson = moyenne tronquée des (tap − clic entendu) = latence audio résiduelle + tactile.
// Étape 2 « ce que tu VOIS » : Limage = moyenne tronquée des (tap − passage visuel) = latence d'affichage + tactile.
// Résultat : audioMs = Lson − Limage (borné −150…+350) ; judgeMs = clamp(Limage − 20, 0, 80).
export const CALIB_BPM = 100, CALIB_TAPS = 16, CALIB_VISUAL_PERIOD = 0.6, CALIB_TRIM = 3, CALIB_MAX_SD = 45;

// écart de chaque tap à l'événement le plus proche (s) ; events triés
export function tapDeltas(taps, events) {
  const out = [];
  for (const t of taps) {
    let best = Infinity;
    for (const e of events) { const d = t - e; if (Math.abs(d) < Math.abs(best)) best = d; }
    if (isFinite(best)) out.push(best);
  }
  return out;
}
// moyenne tronquée : on retire les `k` valeurs les plus éloignées de la médiane
export function trimmedMean(values, k = CALIB_TRIM) {
  if (!values.length) return 0;
  const s = values.slice().sort((a, b) => a - b), med = s[Math.floor(s.length / 2)];
  const kept = values.slice().sort((a, b) => Math.abs(a - med) - Math.abs(b - med)).slice(0, Math.max(1, values.length - k));
  return kept.reduce((a, b) => a + b, 0) / kept.length;
}
export function stdDev(values, k = CALIB_TRIM) {
  if (values.length < 2) return 0;
  const m = trimmedMean(values, k);
  const s = values.slice().sort((a, b) => Math.abs(a - m) - Math.abs(b - m)).slice(0, Math.max(2, values.length - k));
  return Math.sqrt(s.reduce((a, v) => a + (v - m) * (v - m), 0) / (s.length - 1));
}
// deltas en secondes → résultat en ms
export function computeCalibration(audioDeltas, visualDeltas) {
  const Lson = trimmedMean(audioDeltas) * 1000, Limage = trimmedMean(visualDeltas) * 1000;
  const sd = Math.max(stdDev(audioDeltas), stdDev(visualDeltas)) * 1000;
  const audioMs = Math.round(Math.max(-150, Math.min(350, Lson - Limage)));
  const judgeMs = Math.round(Math.max(0, Math.min(80, Limage - 20)));
  return { Lson: Math.round(Lson), Limage: Math.round(Limage), audioMs, judgeMs, sd: Math.round(sd), reliable: sd <= CALIB_MAX_SD };
}
// profil de sortie audio : latence de sortie arrondie à 10 ms (un casque BT et le haut-parleur gardent leur réglage)
export function profileKey(outputLatencyS) { return String(Math.round(Math.max(0, outputLatencyS || 0) * 100) * 10); }
// réglage fin : pas de 5 ms, ±100 ms autour de la mesure
export function nudge(base, current, dir) {
  const v = current + dir * 5;
  return Math.max(base - 100, Math.min(base + 100, Math.max(-150, Math.min(350, v))));
}
