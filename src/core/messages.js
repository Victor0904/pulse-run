// Messages du bandeau (DESIGN §8.3) : sections et événements de structure annoncés 1 mesure avant, avec 4 points
// qui se remplissent sur les temps ; événements de jeu (section propre, Résonance, palier). Tout passe par Banner :
// un seul message à la fois, jamais deux fois le même.
import { PRIO } from './banner.js';
import { EV } from '../sim/sim.js';

const fmtN = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function feedBanners(chart, banner, fromT = -Infinity) {
  let n = 0;
  const bar = t => chart.tempo.beatLenAt(t) * chart.bpb, beat = t => chart.tempo.beatLenAt(t);
  // événements de structure par instant (fusionnés dans le bandeau de section s'ils tombent sur son début)
  const extras = new Map();
  const addExtra = (t, txt) => { const k = Math.round(t * 1000); extras.set(k, (extras.get(k) ? extras.get(k) + ' · ' : '') + txt); };
  let lastBpm = chart.tempo.segs[0].a;
  for (let i = 1; i < chart.tempo.segs.length; i++) {
    const s = chart.tempo.segs[i];
    const target = s.b;
    if (Math.abs(target - lastBpm) < 0.5) continue;
    if (s.a !== s.b || i === chart.tempo.segs.length - 1 || chart.tempo.segs[i - 1].a === chart.tempo.segs[i - 1].b) {
      const up = target > lastBpm;
      addExtra(s.t0, `TEMPO ${up ? '▲' : '▼'} ${Math.round(target / chart.tempo.scale)}`);
      lastBpm = target;
    }
  }
  for (const f of chart.fx) {
    if (f.kind === 'SILENCE') addExtra(f.t, 'SILENCE');
    else if (f.kind === 'INVERSE') addExtra(f.t, 'REWIND');
    else if (f.kind === 'DROP') addExtra(f.t, 'DROP');
  }
  for (const r of chart.rots) if (r.speed !== 0) addExtra(r.t, 'ROTATION');
  const used = new Set();
  chart.sections.forEach((sec, i) => {
    if (sec.kind === 'count' || sec.t0 < fromT) return;
    const k = Math.round(sec.t0 * 1000);
    let text = sec.name, accent = sec.kind === 'drop';
    const ex = extras.get(k);
    if (ex) { used.add(k); const parts = ex.split(' · ').filter(p => p !== sec.name); if (parts.length) { text += ' · ' + parts.join(' · '); accent = true; } }
    if (sec.mini) accent = true;
    if (banner.push({ key: `sec:${i}`, text, t0: sec.t0 - bar(sec.t0), t1: sec.t0 + beat(sec.t0), prio: PRIO.section, accent, dots: true, at: sec.t0 })) n++;
  });
  for (const [k, txt] of extras) {
    if (used.has(k)) continue;
    const t = k / 1000;
    if (t < fromT) continue;
    if (banner.push({ key: `fx:${k}`, text: txt, t0: t - bar(t), t1: t + beat(t), prio: PRIO.fx, accent: true, dots: true, at: t })) n++;
  }
  return n;
}

// Événements de jeu → messages (renvoie true si un message a été proposé)
export function gameEventBanner(banner, e, chart) {
  const bar = chart.tempo.beatLenAt(e.t) * chart.bpb;
  if (e.type === EV.SECTION_CLEAN) return banner.push({ key: `clean:${e.b}`, text: `SECTION PROPRE +${fmtN(e.a)}`, t0: e.t, t1: e.t + bar, prio: PRIO.clean, accent: false, good: true });
  if (e.type === EV.CRACK) return banner.push({ key: `crack:${e.b}`, text: `RÉSONANCE +${fmtN(e.a)}`, t0: e.t, t1: e.t + bar, prio: PRIO.boss, accent: true, good: true });
  if (e.type === EV.PALIER) return banner.push({ key: `palier:${e.a}`, text: `PALIER ${e.a / 4 + 1} · +1 POULS`, t0: e.t, t1: e.t + bar, prio: PRIO.palier, accent: true });
  return false;
}
