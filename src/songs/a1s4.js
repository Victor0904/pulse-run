// Album 1 — BATTEMENTS · 4. Double Cœur (2 brèches : choisir son côté ; ALTERNE ; premier DROP + rotation d'arène)
export default {
  id: 'a1s4', album: 1, n: 4, title: 'Double Cœur',
  bpm: 116, beatsPerBar: 4, swing: 0, key: 'A', scale: 'minor',
  approach: 1.20, omegaMax: 300, gap: 'M',
  music: { kit: 'house', bass: 'rond' },
  sections: [
    { name: 'DÉCOMPTE', kind: 'count', bars: 1 },
    { name: 'INTRO', kind: 'intro', bars: 4,
      chart: [['2:1', 'M', 'TUNNEL', { n: 6, every: 2, a: 90, w: 'L' }]] },
    { name: 'COUPLET', kind: 'verse', bars: 8,
      chart: [
        ['1:1', 'M', 'ESCALIER', { n: 16, every: 1, from: 'p', step: 45, w: 'M', n2: 2, sep: 180 }],
        ['5:1', 'M', 'ZIGZAG', { n: 16, every: 1, from: 'p', amp: 100, w: 'M', n2: 2, sep: 120 }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        ['1:1', 'M', 'ALTERNE', { n: 8, every: 2, from: 'p', w: 'M' }],
        ['5:1', 'M', 'ALTERNE', { n: 8, every: 2, from: 'p+90', w: 'M' }],
        ['1:5', 'M', 'LAMES', { n: 16, every: 2, from: 'opp', arc: 100 }],
      ] },
    { name: 'PAUSE', kind: 'pause', bars: 2, chart: [['2:1', 'R', 'p', 'L', { n: 2, sep: 180 }]] },
    { name: 'COUPLET', kind: 'verse', bars: 8,
      chart: [['1:1', 'M', 'ZIGZAG', { n: 32, every: 1, from: 'p', amp: 80, w: 'M', n2: 2, sep: 180 }]] },
    { name: 'MONTÉE', kind: 'build', bars: 4,
      chart: [
        ['1:5', 'M', 'LAMES', { n: 4, every: 2, from: 'opp', arc: 120 }],
        ['3:1', 'M', 'LAMES', { n: 4, every: 1, from: 'opp', arc: 120 }],
        ['4:1', 'M', 'LAMES', { n: 8, every: '1/2', from: 'opp', arc: 90 }],
      ] },
    { name: 'DROP', kind: 'drop', bars: 8,
      chart: [
        ['1:1', 'FX', 'DROP'],
        ['1:1', 'ROT', 40, 4],
        ['1:1', 'M', 'ESCALIER', { n: 32, every: '1/2', from: 'p', step: 20, w: 'M' }],
        ['5:1', 'M', 'ZIGZAG', { n: 32, every: '1/2', from: 'p', amp: 46, w: 'M' }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        ['1:1', 'ROT', 0, 2],
        ['1:1', 'M', 'ALTERNE', { n: 8, every: 2, from: 'p', w: 'M' }],
        ['1:5', 'M', 'LAMES', { n: 8, every: 2, from: 'opp', arc: 100 }],
        ['5:1', 'M', 'ZIGZAG', { n: 16, every: 1, from: 'p', amp: 90, w: 'M', n2: 2, sep: 120 }],
      ] },
    { name: 'OUTRO', kind: 'outro', bars: 1, chart: [['1:1', 'R', 'p', 'XL']] },
  ],
};
