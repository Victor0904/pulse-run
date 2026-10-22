// Album 1 — BATTEMENTS · 3. Contretemps (anneaux entre les temps, tresillo 3-3-2, premiers anneaux rapides)
export default {
  id: 'a1s3', album: 1, n: 3, title: 'Contretemps',
  bpm: 112, beatsPerBar: 4, swing: 0, key: 'A', scale: 'minor',
  approach: 1.25, omegaMax: 280, gap: 'L',
  music: { kit: 'house', bass: 'rond' },
  sections: [
    { name: 'DÉCOMPTE', kind: 'count', bars: 1 },
    { name: 'INTRO', kind: 'intro', bars: 4,
      chart: [['2:1', 'M', 'TUNNEL', { n: 6, every: 2, a: 90, w: 'XL' }]] },
    { name: 'COUPLET', kind: 'verse', bars: 8,
      chart: [
        // temps (XL) + « et » du 2e temps (L, marqué contretemps)
        ['1:1', 'M', 'TUNNEL', { n: 16, every: 2, a: 90, w: 'XL' }],
        ['1:7', 'M', 'ZIGZAG', { n: 16, every: 2, from: 90, amp: 80, w: 'L' }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        ['1:1', 'M', 'ESCALIER', { n: 24, every: '1/2', pat: 'x..x..x.', from: 'p', step: 25, w: 'M' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 120 }],
      ] },
    { name: 'PAUSE', kind: 'pause', bars: 2, chart: [['2:1', 'R', 'p', 'XL']] },
    { name: 'COUPLET', kind: 'verse', bars: 8,
      chart: [['1:1', 'M', 'ZIGZAG', { n: 32, every: '1/2', pat: 'x..x', from: 'p', amp: 60, w: 'L' }]] },
    { name: 'MONTÉE', kind: 'build', bars: 4,
      chart: [
        ['1:5', 'M', 'LAMES', { n: 4, every: 2, from: 'opp', arc: 140 }],
        ['3:1', 'M', 'LAMES', { n: 4, every: 1, from: 'opp', arc: 140 }],
        ['4:1', 'M', 'LAMES', { n: 8, every: '1/2', from: 'opp', arc: 110 }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 12,
      chart: [
        ['1:1', 'M', 'ESCALIER', { n: 24, every: '1/2', pat: 'x..x..x.', from: 'p', step: -25, w: 'M' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 120 }],
        // premiers anneaux rapides (orange), toujours en tunnel
        ['9:1', 'M', 'TUNNEL', { n: 4, every: 1, a: 'p+30', sp: 'rapide', w: 'M' }],
        ['10:1', 'M', 'TUNNEL', { n: 8, every: '1/2', a: 'p-30', sp: 'rapide', w: 'M' }],
        ['11:1', 'M', 'TUNNEL', { n: 4, every: 1, a: 'p+30', sp: 'rapide', w: 'M' }],
        ['12:1', 'M', 'TUNNEL', { n: 4, every: 1, a: 'p-30', sp: 'rapide', w: 'M' }],
      ] },
    { name: 'OUTRO', kind: 'outro', bars: 1, chart: [['1:1', 'R', 'p', 'XL']] },
  ],
};
