// Album 2 — BOSS · LE MÉTRONOME (aiguille-pendule ; Allegro 128 · Adagio 96 · Presto 144 · Finale 160)
export default {
  id: 'a2boss', album: 2, n: 5, boss: true, bossKind: 'metronome', title: 'LE MÉTRONOME',
  bpm: 128, beatsPerBar: 4, swing: 0, key: 'D', scale: 'dorian',
  approach: 1.00, omegaMax: 420, gap: 'M',
  music: { kit: 'funk', bass: 'funk' },
  sections: [
    { name: 'DÉCOMPTE', kind: 'count', bars: 1 },
    { name: 'ALLEGRO', kind: 'verse', phase: 'P1', bars: 15, layers: { arp: 1 },
      chart: [
        // aiguille en HAUT (inoffensive pour qui reste en bas), anneaux syncopés en bas
        ['1:1', 'N', 270, 75, 15],
        ['2:1', 'M', 'ZIGZAG', { n: 42, every: '1/4', pat: 'x.....x...x.....', from: 90, amp: 110, w: 'S' }],
        ['2:5', 'M', 'LAMES', { n: 28, every: 2, from: 'opp', arc: 100 }],
      ] },
    { name: 'ADAGIO', kind: 'chorus', phase: 'P2', bars: 12,
      chart: [
        ['1:1', 'R', 180, 'M'],
        ['2:1', 'TEMPO', 96, 0],
        ['3:1', 'N', 90, 75, 10],
        // aiguille en BAS : anneaux lents, brèche du côté opposé (en haut)
        ['2:1', 'M', 'ZIGZAG', { n: 22, every: 2, from: 270, amp: 120, sp: 'lent', w: 'S' }],
      ] },
    { name: 'PRESTO', kind: 'drop', phase: 'P3', bars: 16,
      chart: [
        ['1:1', 'TEMPO', 144, 8],
        ['1:1', 'R', 190, 'M'],
        // deux aiguilles (haut + bas) : on vit sur un côté (gauche ou droite)
        ['3:1', 'N', 270, 60, 14],
        ['3:1', 'N', 90, 60, 14],
        ['2:1', 'M', 'ZIGZAG', { n: 112, every: '1/2', from: 180, amp: 20, w: 'XS', n2: 2, sep: 180, sp: 'rapide' }],
      ] },
    { name: 'FINALE', kind: 'drop', phase: 'P4', bars: 19,
      chart: [
        ['1:1', 'TEMPO', 160, 0],
        ['1:1', 'FX', 'DROP'],
        ['1:1', 'M', 'ZIGZAG', { n: 16, every: 1, from: 'p', amp: 70, w: 'M' }],
        ['5:1', 'ROT', 90, 4],
        ['5:1', 'M', 'ZIGZAG', { n: 36, every: '1/4', pat: 'xxxxxxxx....x...', from: 'p', amp: 20, sp: 'eclair', w: 'M' }],
        ['9:1', 'ROT', -90, 4],
        ['9:1', 'M', 'ZIGZAG', { n: 36, every: '1/4', pat: 'xxxxxxxx....x...', from: 'p+40', amp: 20, sp: 'eclair', w: 'M' }],
        ['13:1', 'ROT', 0, 2],
        ['13:1', 'M', 'ZIGZAG', { n: 28, every: 1, from: 'p', amp: 100, w: 'S' }],
      ] },
    { name: 'OUTRO', kind: 'outro', bars: 1, chart: [['1:1', 'R', 'p', 'XL']] },
  ],
};
