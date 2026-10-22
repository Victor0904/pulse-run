// Album 3 — DROP · 9. Bassline (demi-temps / double-temps : couplets lents, drops en doubles-croches rapides)
export default {
  id: 'a3s1', album: 3, n: 1, title: 'Bassline',
  bpm: 140, beatsPerBar: 4, swing: 0, key: 'F', scale: 'phrygian',
  approach: 0.95, omegaMax: 400, gap: 'S',
  music: { kit: 'rave', bass: 'wobble' },
  sections: [
    { name: 'DÉCOMPTE', kind: 'count', bars: 1 },
    { name: 'INTRO', kind: 'intro', bars: 4,
      chart: [['2:1', 'M', 'TUNNEL', { n: 6, every: 2, a: 90, w: 'L' }]] },
    { name: 'COUPLET', kind: 'verse', bars: 8, half: true, drums: { k: 'x.........x.....', s: '........x.......' },
      chart: [
        ['1:1', 'M', 'ZIGZAG', { n: 16, every: 2, from: 'p', amp: 100, sp: 'lent', w: 'S' }],
        ['1:9', 'M', 'LAMES', { n: 8, every: 4, from: 'opp', arc: 140 }],
      ] },
    { name: 'MONTÉE', kind: 'build', bars: 4,
      chart: [
        ['1:5', 'M', 'LAMES', { n: 4, every: 2, from: 'opp', arc: 140 }],
        ['3:1', 'M', 'LAMES', { n: 4, every: 1, from: 'opp', arc: 140 }],
        ['4:1', 'M', 'LAMES', { n: 8, every: '1/2', from: 'opp', arc: 100 }],
      ] },
    { name: 'DROP', kind: 'drop', bars: 8,
      chart: [
        ['1:1', 'FX', 'DROP'],
        ['1:1', 'M', 'TUNNEL', { n: 40, every: '1/4', pat: 'xxxxxxxx..x...x.', a: 'p', sp: 'rapide', w: 'S' }],
        ['5:1', 'M', 'ESCALIER', { n: 40, every: '1/4', pat: 'xxxxxxxx..x...x.', from: 'p', step: 15, sp: 'rapide', w: 'S' }],
      ] },
    { name: 'COUPLET', kind: 'verse', bars: 8, half: true, drums: { k: 'x.........x.....', s: '........x.......' },
      chart: [
        ['1:9', 'M', 'ZIGZAG', { n: 15, every: 2, from: 'p', amp: 110, sp: 'lent', w: 'S' }],
        ['1:9', 'M', 'LAMES', { n: 8, every: 4, from: 'opp', arc: 140 }],
      ] },
    { name: 'MONTÉE', kind: 'build', bars: 4,
      chart: [
        ['1:5', 'M', 'LAMES', { n: 4, every: 2, from: 'opp', arc: 140 }],
        ['3:1', 'M', 'LAMES', { n: 4, every: 1, from: 'opp', arc: 140 }],
        ['4:1', 'M', 'LAMES', { n: 8, every: '1/2', from: 'opp', arc: 100 }],
      ] },
    { name: 'DROP', kind: 'drop', bars: 8,
      chart: [
        ['1:1', 'FX', 'DROP'],
        ['1:1', 'M', 'ESCALIER', { n: 40, every: '1/4', pat: 'xxxxxxxx..x...x.', from: 'p', step: -15, sp: 'rapide', w: 'S' }],
        ['5:1', 'M', 'TUNNEL', { n: 20, every: '1/4', pat: 'xxxxxxxx..x...x.', a: 'p+60', sp: 'rapide', w: 'S' }],
        ['7:1', 'M', 'ESCALIER', { n: 20, every: '1/4', pat: 'xxxxxxxx..x...x.', from: 'p', step: 15, sp: 'rapide', w: 'S' }],
      ] },
    { name: 'PAUSE', kind: 'pause', bars: 2, chart: [['2:1', 'R', 'p', 'M', { sp: 'lent' }]] },
    { name: 'COUPLET', kind: 'verse', bars: 8, half: true, drums: { k: 'x.........x.....', s: '........x.......' },
      chart: [
        ['1:9', 'M', 'ZIGZAG', { n: 15, every: 2, from: 'p', amp: 120, sp: 'lent', w: 'S' }],
        ['1:9', 'M', 'LAMES', { n: 8, every: 4, from: 'opp', arc: 150 }],
      ] },
    { name: 'DROP', kind: 'drop', bars: 8,
      chart: [
        ['1:1', 'FX', 'DROP'],
        ['1:1', 'ROT', 120, 4],
        ['1:1', 'M', 'TUNNEL', { n: 40, every: '1/4', pat: 'xxxxxxxx..x...x.', a: 'p', sp: 'rapide', w: 'S' }],
        ['5:1', 'M', 'ESCALIER', { n: 40, every: '1/4', pat: 'xxxxxxxx..x...x.', from: 'p', step: -15, sp: 'rapide', w: 'S' }],
        ['8:13', 'ROT', 0, 1],
      ] },
    { name: 'OUTRO', kind: 'outro', bars: 1, chart: [['1:1', 'R', 'p', 'XL']] },
  ],
};
