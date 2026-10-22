// Album 2 — SYNCOPE · 7. Swing Station (swing 0,58 ; vitesses mêlées : le rapide double le lent avant r = 88)
export default {
  id: 'a2s3', album: 2, n: 3, title: 'Swing Station',
  bpm: 124, beatsPerBar: 4, swing: 0.58, key: 'D', scale: 'dorian',
  approach: 1.05, omegaMax: 360, gap: 'M',
  music: { kit: 'funk', bass: 'funk' },
  sections: [
    { name: 'DÉCOMPTE', kind: 'count', bars: 1 },
    { name: 'INTRO', kind: 'intro', bars: 4,
      chart: [['2:1', 'M', 'TUNNEL', { n: 6, every: 2, a: 90, w: 'XL' }]] },
    { name: 'COUPLET', kind: 'verse', bars: 8,
      chart: [
        ['1:1', 'M', 'ESCALIER', { n: 32, every: '1/2', pat: 'x..x', from: 'p', step: 25, w: 'M' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 120 }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        // le rapide (lancé après) franchit sur le temps, le lent 3/4 de temps plus tard, même brèche
        ['1:1', 'M', 'ZIGZAG', { n: 16, every: 2, from: 'p', amp: 60, sp: 'rapide', w: 'M' }],
        ['1:4', 'M', 'TUNNEL', { n: 16, every: 2, a: 'last', sp: 'lent', w: 'M' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 120 }],
      ] },
    { name: 'PAUSE', kind: 'pause', bars: 2, chart: [['2:1', 'R', 'p', 'L']] },
    { name: 'COUPLET', kind: 'verse', bars: 8,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { n: 32, every: '1/2', pat: 'x..x', from: 'p', amp: 50, w: 'M' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 120 }],
      ] },
    { name: 'MONTÉE', kind: 'build', bars: 4,
      chart: [
        ['1:5', 'M', 'LAMES', { n: 4, every: 2, from: 'opp', arc: 120 }],
        ['3:1', 'M', 'LAMES', { n: 4, every: 1, from: 'opp', arc: 120 }],
        ['4:1', 'M', 'LAMES', { n: 8, every: '1/2', from: 'opp', arc: 90 }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 12,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { n: 24, every: 2, from: 'p', amp: 60, sp: 'rapide', w: 'M' }],
        ['1:4', 'M', 'TUNNEL', { n: 24, every: 2, a: 'last', sp: 'lent', w: 'M' }],
        ['1:5', 'M', 'LAMES', { n: 24, every: 2, from: 'opp', arc: 120 }],
      ] },
    { name: 'DROP', kind: 'drop', bars: 8,
      chart: [
        ['1:1', 'FX', 'DROP'],
        ['1:1', 'M', 'ZIGZAG', { n: 32, every: 1, from: 'p', amp: 60, w: 'S' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 100 }],
      ] },
    { name: 'OUTRO', kind: 'outro', bars: 1, chart: [['1:1', 'R', 'p', 'XL']] },
  ],
};
