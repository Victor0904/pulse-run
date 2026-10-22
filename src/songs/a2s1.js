// Album 2 — SYNCOPE · 5. Néon Funk (basse syncopée = anneaux tournants W ; SPIRALE ; clap = lames)
export default {
  id: 'a2s1', album: 2, n: 1, title: 'Néon Funk',
  bpm: 118, beatsPerBar: 4, swing: 0, key: 'D', scale: 'dorian',
  approach: 1.10, omegaMax: 320, gap: 'M',
  music: { kit: 'funk', bass: 'funk' },
  sections: [
    { name: 'DÉCOMPTE', kind: 'count', bars: 1 },
    { name: 'INTRO', kind: 'intro', bars: 4,
      chart: [['2:1', 'M', 'TUNNEL', { n: 6, every: 2, a: 90, w: 'XL' }]] },
    { name: 'COUPLET', kind: 'verse', bars: 8,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { type: 'W', rot: 20, n: 24, every: '1/4', pat: 'x..x..x.........', from: 'p', amp: 70, w: 'M' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 120 }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        ['1:1', 'M', 'SPIRALE', { n: 16, every: 1, from: 'p', rot: 20, w: 'M' }],
        ['5:1', 'M', 'SPIRALE', { n: 16, every: 1, from: 'p+90', rot: -20, w: 'M' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 120 }],
      ] },
    { name: 'PAUSE', kind: 'pause', bars: 2, chart: [['2:1', 'R', 'p', 'L']] },
    { name: 'COUPLET', kind: 'verse', bars: 8,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { type: 'W', rot: -20, n: 40, every: '1/4', pat: 'x..x..x...x.x...', from: 'p', amp: 60, w: 'M' }],
      ] },
    { name: 'MONTÉE', kind: 'build', bars: 4,
      chart: [
        ['1:5', 'M', 'LAMES', { n: 4, every: 2, from: 'opp', arc: 120 }],
        ['3:1', 'M', 'LAMES', { n: 4, every: 1, from: 'opp', arc: 120 }],
        ['4:1', 'M', 'LAMES', { n: 8, every: '1/2', from: 'opp', arc: 90 }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        ['1:1', 'M', 'SPIRALE', { n: 16, every: 1, from: 'p', rot: -25, w: 'M' }],
        ['5:1', 'M', 'SPIRALE', { n: 16, every: 1, from: 'p-90', rot: 25, w: 'M' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 120 }],
      ] },
    { name: 'REFRAIN', kind: 'drop', bars: 8,
      chart: [
        ['1:1', 'FX', 'DROP'],
        ['1:1', 'M', 'SPIRALE', { n: 32, every: '1/2', from: 'p', rot: 30, w: 'M' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 110 }],
      ] },
    { name: 'OUTRO', kind: 'outro', bars: 1, chart: [['1:1', 'R', 'p', 'XL']] },
  ],
};
