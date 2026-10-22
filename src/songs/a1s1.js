// Album 1 — BATTEMENTS · 1. Premier Pouls (tutoriel déguisé, uniquement des anneaux R)
export default {
  id: 'a1s1', album: 1, n: 1, title: 'Premier Pouls',
  bpm: 100, beatsPerBar: 4, swing: 0, key: 'A', scale: 'minor',
  approach: 1.35, omegaMax: 240, gap: 'XL',
  music: { kit: 'house', bass: 'rond', pad: 'chaud', lead: 'pluck', menuLoop: 0 },
  tutorial: true,
  sections: [
    { name: 'DÉCOMPTE', kind: 'count', bars: 1 },
    { name: 'INTRO', kind: 'intro', bars: 4, layers: { kick: 1 },
      chart: [['2:1', 'M', 'TUNNEL', { n: 3, every: 4, a: 90, w: 'XL' }]] },
    { name: 'COUPLET', kind: 'verse', bars: 8,
      chart: [['1:1', 'M', 'ZIGZAG', { n: 16, every: 2, from: 90, amp: 80, w: 'XL' }]] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        ['1:1', 'M', 'ESCALIER', { n: 16, every: 1, from: 90, step: 30, w: 'L' }],
        ['5:1', 'M', 'ESCALIER', { n: 16, every: 1, from: 'p', step: -30, w: 'L' }],
      ] },
    { name: 'PAUSE', kind: 'pause', bars: 2,
      chart: [['2:1', 'R', 'p', 'XL']] },
    { name: 'COUPLET', kind: 'verse', bars: 8,
      chart: [
        ['1:1', 'M', 'ZIGZAG', { n: 8, every: 2, from: 'p', amp: 90, w: 'L' }],
        ['5:1', 'M', 'ESCALIER', { n: 8, every: 2, from: 'p', step: 45, w: 'L' }],
      ] },
    { name: 'REFRAIN', kind: 'chorus', bars: 8,
      chart: [
        ['1:1', 'M', 'TUNNEL', { n: 8, every: '1/2', a: 'p', w: 'L' }],
        ['2:1', 'M', 'ESCALIER', { n: 12, every: 1, from: 'p+30', step: 30, w: 'L' }],
        ['5:1', 'M', 'TUNNEL', { n: 8, every: '1/2', a: 'p', w: 'L' }],
        ['6:1', 'M', 'ESCALIER', { n: 12, every: 1, from: 'p-30', step: -30, w: 'L' }],
      ] },
    { name: 'OUTRO', kind: 'outro', bars: 1,
      chart: [['1:1', 'R', 'p', 'XL']] },
  ],
};
