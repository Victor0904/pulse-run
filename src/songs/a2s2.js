// Album 2 — SYNCOPE · 6. Ghost Notes (ghost notes = lames fines rapprochées ; accents = lames larges ; premiers rayons)
export default {
  id: 'a2s2', album: 2, n: 2, title: 'Ghost Notes',
  bpm: 122, beatsPerBar: 4, swing: 0, key: 'D', scale: 'dorian',
  approach: 1.05, omegaMax: 340, gap: 'M',
  music: { kit: 'funk', bass: 'funk' },
  sections: [
    { name: 'DÉCOMPTE', kind: 'count', bars: 1 },
    { name: 'INTRO', kind: 'intro', bars: 4,
      chart: [['2:1', 'M', 'TUNNEL', { n: 6, every: 2, a: 90, w: 'XL' }]] },
    { name: 'COUPLET', kind: 'verse', bars: 8,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { n: 24, every: '1/4', pat: 'x.....x...x.....', from: 'p', amp: 80, w: 'M' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 160 }],
        ['5:1', 'M', 'LAMES', { n: 16, every: '1/4', pat: '..x..x.......x.x', from: 'opp', arc: 60 }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        ['1:1', 'M', 'EVENTAIL', { n: 4, every: '1/2', from: 'p+90', step: 45 }],
        ['2:1', 'M', 'ESCALIER', { n: 28, every: 1, from: 'p', step: 40, w: 'M' }],
        ['2:2', 'M', 'LAMES', { n: 14, every: 2, from: 'opp', arc: 160 }],
      ] },
    { name: 'PAUSE', kind: 'pause', bars: 2, chart: [['2:1', 'R', 'p', 'L']] },
    { name: 'COUPLET', kind: 'verse', bars: 8,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { n: 24, every: '1/4', pat: 'x.....x...x.....', from: 'p', amp: 90, w: 'M' }],
        ['1:3', 'M', 'LAMES', { n: 28, every: '1/4', pat: '..x..x.......x.x', from: 'opp', arc: 60 }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 160 }],
      ] },
    { name: 'MONTÉE', kind: 'build', bars: 4,
      chart: [
        ['1:5', 'M', 'LAMES', { n: 4, every: 2, from: 'opp', arc: 150 }],
        ['3:1', 'M', 'LAMES', { n: 4, every: 1, from: 'opp', arc: 150 }],
        ['4:1', 'M', 'LAMES', { n: 8, every: '1/2', from: 'opp', arc: [60, 120] }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        ['1:1', 'M', 'EVENTAIL', { n: 4, every: '1/2', from: 'p-90', step: -45 }],
        ['2:1', 'M', 'ZIGZAG', { n: 28, every: 1, from: 'p', amp: 100, w: 'M' }],
        ['2:2', 'M', 'LAMES', { n: 14, every: 2, from: 'opp', arc: 160 }],
      ] },
    { name: 'REFRAIN', kind: 'drop', bars: 12,
      chart: [
        ['1:1', 'FX', 'DROP'],
        ['1:1', 'M', 'EVENTAIL', { n: 4, every: '1/2', from: 'p+90', step: 45 }],
        ['2:1', 'M', 'ZIGZAG', { n: 28, every: 1, from: 'p', amp: 100, w: 'M' }],
        ['2:2', 'M', 'LAMES', { n: 14, every: 2, from: 'opp', arc: 160 }],
        ['9:1', 'M', 'EVENTAIL', { n: 4, every: '1/2', from: 'p+90', step: 45 }],
        ['10:1', 'M', 'ESCALIER', { n: 12, every: 1, from: 'p', step: -40, w: 'M' }],
        ['10:3', 'M', 'LAMES', { n: 11, every: '1/4', pat: '..x..x.......x.x', from: 'opp', arc: 60 }],
      ] },
    { name: 'OUTRO', kind: 'outro', bars: 1, chart: [['1:1', 'R', 'p', 'XL']] },
  ],
};
