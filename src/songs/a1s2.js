// Album 1 — BATTEMENTS · 2. Quatre Temps (tout en noires ; « boum-tchak » : anneau sur le kick, lame sur le clap)
export default {
  id: 'a1s2', album: 1, n: 2, title: 'Quatre Temps',
  bpm: 108, beatsPerBar: 4, swing: 0, key: 'A', scale: 'minor',
  approach: 1.30, omegaMax: 260, gap: 'L',
  music: { kit: 'house', bass: 'rond' },
  sections: [
    { name: 'DÉCOMPTE', kind: 'count', bars: 1 },
    { name: 'INTRO', kind: 'intro', bars: 4,
      chart: [['2:1', 'M', 'TUNNEL', { n: 6, every: 2, a: 90, w: 'XL' }]] },
    { name: 'COUPLET', kind: 'verse', bars: 8,
      chart: [['1:1', 'M', 'ZIGZAG', { n: 32, every: 1, from: 'p', amp: 90, w: 'L' }]] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { n: 16, every: 2, from: 'p', amp: 90, w: 'L' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 140 }],
      ] },
    { name: 'PAUSE', kind: 'pause', bars: 2, chart: [['2:1', 'R', 'p', 'XL']] },
    { name: 'MONTÉE', kind: 'build', bars: 4,
      chart: [
        ['1:5', 'M', 'LAMES', { n: 4, every: 2, from: 'opp', arc: 140 }],
        ['3:1', 'M', 'LAMES', { n: 4, every: 1, from: 'opp', arc: 140 }],
        ['4:1', 'M', 'LAMES', { n: 8, every: '1/2', from: 'opp', arc: 100 }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { n: 16, every: 2, from: 'p', amp: 120, w: 'L' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 140 }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { n: 16, every: 1, from: 'p+45', amp: 100, w: 'L' }],
        ['5:1', 'M', 'ESCALIER', { n: 8, every: 2, from: 'p', step: 45, w: 'L' }],
        ['5:5', 'M', 'LAMES', { n: 8, every: 2, from: 'opp', arc: 140 }],
      ] },
    { name: 'OUTRO', kind: 'outro', bars: 1, chart: [['1:1', 'R', 'p', 'XL']] },
  ],
};
