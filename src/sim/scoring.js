// Score, multiplicateur, rangs, étoiles (GAME_DESIGN §5). Pur.
export const BASE_POINTS = [80, 200, 300, 0];   // OK, BIEN, PARFAIT, RATÉ
export function multFor(combo) { return combo >= 80 ? 4 : combo >= 40 ? 3 : combo >= 16 ? 2 : 1; }

export function accuracyOf(c) {
  const n = c.perfect + c.good + c.ok + c.miss;
  return n ? (c.perfect + 0.7 * c.good + 0.35 * c.ok) / n : 0;
}
// S+ : ≥ 98 % ET sans faute · S ≥ 95 · A ≥ 88 · B ≥ 78 · C ≥ 65 · D
export function rankFor(acc, noHit) {
  if (acc >= 0.98 && noHit) return 'S+';
  if (acc >= 0.95) return 'S';
  if (acc >= 0.88) return 'A';
  if (acc >= 0.78) return 'B';
  if (acc >= 0.65) return 'C';
  return 'D';
}
export const RANK_ORDER = ['D', 'C', 'B', 'A', 'S', 'S+'];
export const rankBetter = (a, b) => RANK_ORDER.indexOf(a) > RANK_ORDER.indexOf(b || 'D') || (b == null && a != null);

// étoiles : terminer · précision ≥ 85 % · sans faute
export function starsFor(res) {
  return [res.won ? 1 : 0, res.won && res.acc >= 0.85 ? 1 : 0, res.won && res.hits === 0 ? 1 : 0];
}

// Score max théorique : tout PARFAIT + toutes les sections propres + toutes les Résonances (boss)
export function maxScore(chart) {
  let score = 0, combo = 0;
  const bySec = new Array(chart.sections.length).fill(0);
  const lastOfSec = new Array(chart.sections.length).fill(-1);
  chart.obstacles.forEach((o, i) => { bySec[o.sec]++; lastOfSec[o.sec] = i; });
  // les bonus de section s'appliquent avec le multiplicateur courant à la fin de la section
  const order = chart.obstacles;
  let si = 0;
  for (let i = 0; i < order.length; i++) {
    combo++; score += 300 * multFor(combo);
    while (si < chart.sections.length && lastOfSec[si] <= i) {
      if (bySec[si] > 0) { score += 1000 * multFor(combo); if (chart.sections[si].phase) score += 5000 * multFor(combo); }
      si++;
    }
  }
  return score;
}
