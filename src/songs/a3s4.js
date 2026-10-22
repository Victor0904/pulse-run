// Album 3 — DROP · 12. 174 (drum & bass ; doublés rapides, W à 3 brèches, XS au dernier drop, éclairs isolés en tunnel)
export default {
  id: 'a3s4', album: 3, n: 4, title: '174',
  bpm: 174, beatsPerBar: 4, swing: 0, key: 'F', scale: 'phrygian',
  approach: 0.85, omegaMax: 440, gap: 'S',
  music: { kit: 'dnb', bass: 'wobble' },
  sections: [
    { name: 'DÉCOMPTE', kind: 'count', bars: 1 },
    { name: 'INTRO', kind: 'intro', bars: 4, half: true,
      chart: [['2:1', 'M', 'TUNNEL', { n: 6, every: 2, a: 90, w: 'L' }]] },
    { name: 'COUPLET', kind: 'verse', bars: 8, half: true,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { n: 16, every: '1/4', pat: 'x.........x.....', from: 'p', amp: 90, w: 'S' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: '1/4', pat: 'x.......x.......', from: 'opp', arc: 140 }],
      ] },
    { name: 'MONTÉE', kind: 'build', bars: 4,
      chart: [
        ['1:5', 'M', 'LAMES', { n: 4, every: 2, from: 'opp', arc: 140 }],
        ['3:1', 'M', 'LAMES', { n: 4, every: 1, from: 'opp', arc: 140 }],
        ['4:1', 'M', 'LAMES', { n: 8, every: '1/2', from: 'opp', arc: 100 }],
      ] },
    { name: 'DROP', kind: 'drop', bars: 16,
      chart: [
        ['1:1', 'FX', 'DROP'],
        ['1:1', 'M', 'DOUBLES', { n: 8, every: 4, from: 'p', step: 60, sp: 'rapide', w: 'S' }],
        ['1:9', 'M', 'ZIGZAG', { type: 'W', rot: 30, n: 8, every: 4, from: 'p', amp: 40, w: 'S', n2: 3, sep: 120 }],
        ['9:1', 'M', 'ESCALIER', { n: 32, every: 1, from: 'p', step: 40, w: 'S' }],
        ['13:3', 'M', 'TUNNEL', { n: 3, every: 4, a: 'last', sp: 'eclair', w: 'S' }],
      ] },
    { name: 'PAUSE', kind: 'pause', bars: 2, chart: [['2:1', 'R', 'p', 'M']] },
    { name: 'COUPLET', kind: 'verse', bars: 8, half: true,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { n: 16, every: '1/4', pat: 'x.........x.....', from: 'p', amp: 100, w: 'S' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: '1/4', pat: 'x.......x.......', from: 'opp', arc: 140 }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        ['1:1', 'M', 'ESCALIER', { type: 'W', rot: -30, n: 32, every: 1, from: 'p', step: 30, w: 'S', n2: 3, sep: 120 }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 80 }],
      ] },
    { name: 'MONTÉE', kind: 'build', bars: 4,
      chart: [
        ['1:5', 'M', 'LAMES', { n: 4, every: 2, from: 'opp', arc: 140 }],
        ['3:1', 'M', 'LAMES', { n: 4, every: 1, from: 'opp', arc: 140 }],
        ['4:1', 'M', 'LAMES', { n: 8, every: '1/2', from: 'opp', arc: 100 }],
      ] },
    { name: 'DROP', kind: 'drop', bars: 16,
      chart: [
        ['1:1', 'FX', 'DROP'],
        ['1:1', 'M', 'DOUBLES', { n: 8, every: 4, from: 'p', step: -60, sp: 'rapide', w: 'S' }],
        ['1:9', 'M', 'ZIGZAG', { n: 8, every: 4, from: 'p', amp: 50, w: 'S' }],
        ['9:1', 'M', 'ZIGZAG', { n: 24, every: 1, from: 'p', amp: 70, w: 'XS' }],
        ['15:1', 'M', 'TUNNEL', { n: 4, every: 2, a: 'p', sp: 'eclair', w: 'XS' }],
      ] },
    { name: 'COUPLET', kind: 'verse', bars: 8, half: true,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { n: 16, every: '1/4', pat: 'x.........x.....', from: 'p', amp: 90, w: 'S' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: '1/4', pat: 'x.......x.......', from: 'opp', arc: 140 }],
      ] },
    { name: 'OUTRO', kind: 'outro', bars: 1, chart: [['1:1', 'R', 'p', 'XL']] },
  ],
};
