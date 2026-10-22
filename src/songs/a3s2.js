// Album 3 — DROP · 10. Trois contre Quatre (anneaux sur chaque noire + lames en triolets de blanches)
export default {
  id: 'a3s2', album: 3, n: 2, title: 'Trois contre Quatre',
  bpm: 145, beatsPerBar: 4, swing: 0, key: 'F', scale: 'phrygian',
  approach: 0.90, omegaMax: 410, gap: 'S',
  music: { kit: 'rave', bass: 'wobble' },
  sections: [
    { name: 'DÉCOMPTE', kind: 'count', bars: 1 },
    { name: 'INTRO', kind: 'intro', bars: 4,
      chart: [['2:1', 'M', 'TUNNEL', { n: 6, every: 2, a: 90, w: 'L' }]] },
    { name: 'COUPLET', kind: 'verse', bars: 8,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { n: 32, every: 1, from: 'p', amp: 70, w: 'S' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 120 }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { n: 32, every: 1, from: 'p', amp: 80, w: 'S' }],
        ['1:1/3', 'M', 'LAMES', { n: 24, every: '4/3', from: 'opp', arc: 120 }],
      ] },
    { name: 'MONTÉE', kind: 'build', bars: 4,
      chart: [
        ['1:1/3', 'M', 'LAMES', { n: 6, every: '4/3', from: 'opp', arc: 140 }],
        ['3:1/3', 'M', 'LAMES', { n: 12, every: '2/3', from: 'opp', arc: 120 }],
      ] },
    { name: 'DROP', kind: 'drop', bars: 8,
      chart: [
        ['1:1', 'FX', 'DROP'],
        ['1:1', 'M', 'ZIGZAG', { n: 32, every: '1/2', from: 'p', amp: 40, w: 'S' }],
        ['5:1', 'M', 'ZIGZAG', { n: 16, every: 1, from: 'p', amp: 90, w: 'S' }],
        ['1:1/3', 'M', 'LAMES', { n: 24, every: '4/3', from: 'opp', arc: 110 }],
      ] },
    { name: 'PAUSE', kind: 'pause', bars: 2, chart: [['2:1', 'R', 'p', 'M']] },
    { name: 'COUPLET', kind: 'verse', bars: 8,
      chart: [
        ['1:1', 'M', 'ESCALIER', { n: 32, every: 1, from: 'p', step: 45, w: 'S' }],
        ['1:1/3', 'M', 'LAMES', { n: 24, every: '4/3', from: 'opp', arc: 100 }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { n: 32, every: 1, from: 'p', amp: 100, w: 'S' }],
        ['1:1/3', 'M', 'LAMES', { n: 24, every: '4/3', from: 'opp', arc: 130 }],
      ] },
    { name: 'DROP', kind: 'drop', bars: 12,
      chart: [
        ['1:1', 'FX', 'DROP'],
        ['1:1', 'ROT', 50, 4],
        ['1:1', 'M', 'ESCALIER', { n: 32, every: '1/2', from: 'p', step: 20, w: 'S' }],
        ['5:1', 'M', 'ZIGZAG', { n: 16, every: 1, from: 'p', amp: 90, w: 'S' }],
        ['9:1', 'ROT', -50, 4],
        ['9:1', 'M', 'ESCALIER', { n: 32, every: '1/2', from: 'p', step: -20, w: 'S' }],
        ['1:1/3', 'M', 'LAMES', { n: 36, every: '4/3', from: 'opp', arc: 110 }],
        ['12:13', 'ROT', 0, 1],
      ] },
    { name: 'OUTRO', kind: 'outro', bars: 1, chart: [['1:1', 'R', 'p', 'XL']] },
  ],
};
