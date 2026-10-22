// Écrans DOM (DESIGN §10) : titre, albums, morceaux + fiche, boucle, boutique, défis & trophées, records, réglages,
// calibration (3 étapes), pause, fin de partie. Le canvas d'arène reste vivant derrière.
import { ALBUMS, C } from '../core/const.js';
import { localDateKey } from '../core/rng.js';
import { computeCalibration, tapDeltas, profileKey, nudge, CALIB_TAPS, CALIB_BPM, CALIB_VISUAL_PERIOD } from '../core/calib.js';
import { SONGS, albumSongs } from '../songs/index.js';
import { maxScore, starsFor } from '../sim/scoring.js';
import { fmtNum } from '../render/renderer.js';
import { totalStars, albumStars, albumUnlocked, songUnlocked, lockReason, cleared, infiniteUnlocked, echoUnlocked, suggestedSong, nextSong,
  SHOP, owns, buy, equip, bossBeaten } from '../meta/economy.js';
import { ensureDaily, claimDaily, claimable, TROPHIES, checkTrophies } from '../meta/challenges.js';
import { defaultSave } from '../meta/save.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = v => `${(v * 100).toFixed(1).replace('.', ',')} %`;
const starStr = st => st.map(x => (x ? '★' : '<span class="off">☆</span>')).join('');
const dur = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class UI {
  constructor(app) {
    this.app = app; this.root = document.getElementById('ui'); this.toastEl = document.getElementById('toast');
    this.current = null; this.stack = []; this.album = 1; this.shopTab = 'cursor'; this.recTab = 1; this.confirmReset = 0;
    this.root.addEventListener('click', e => this.onClick(e));
    this.root.addEventListener('pointerdown', e => this.onDown(e));
    addEventListener('popstate', () => { if (this.current && this.current !== 'title' && this.current !== 'game') this.back(); });
  }
  get save() { return this.app.save; }
  sfx(n) { this.app.audio.sfxNow(n); this.app.vibrate([8]); }
  toast(msg, ms = 1800) { const t = this.toastEl; t.textContent = msg; t.classList.add('on'); clearTimeout(this.tt); this.tt = setTimeout(() => t.classList.remove('on'), ms); }
  menuMusic() { const lp = this.current === 'albums'; this.app.audio.startMenu(lp ? Math.min(3, this.album) : 1, lp); }

  // transitions calées sur la croche suivante de la musique du menu (≤ 150 ms)
  go(name, arg) {
    const d = this.app.audio.nextEighthDelay ? this.app.audio.nextEighthDelay() : 0;
    if (this.current && this.current !== 'game') this.stack.push([this.current, this.arg]);
    try { history.pushState({ s: name }, ''); } catch { /* ignoré */ }
    setTimeout(() => this.show(name, arg), d * 1000);
  }
  back() {
    this.sfx('back');
    const prev = this.stack.pop() || ['title'];
    this.show(prev[0], prev[1]);
  }
  show(name, arg) {
    this.current = name; this.arg = arg;
    const a = this.app;
    if (name !== 'game' && name !== 'pause' && name !== 'end' && a.mode !== 'game') { a.mode = 'menu'; }
    clearInterval(this.revealTimer); clearInterval(this.cdTimer);
    if (this.calib && name !== 'calib') this.stopCalib();
    const html = this['scr_' + name] ? this['scr_' + name](arg) : '';
    this.root.innerHTML = html;
    if (this['after_' + name]) this['after_' + name](arg);
    if (['title', 'albums', 'tracks', 'loop', 'shop', 'defis', 'records', 'settings'].includes(name) && a.audio.ok) this.menuMusic();
    if (name === 'albums') this.app.renderer.setPalette(Math.min(3, this.album) - 1, a.save.equipped.bg);
    else if (name === 'title') this.app.renderer.setPalette(0, a.save.equipped.bg);
  }
  topbar(title, extra = '') {
    return `<div class="topbar"><button class="back" data-act="back" aria-label="Retour">‹</button><h2>${title}</h2>${extra}<span class="money">◎ ${fmtNum(this.save.ondes)}</span></div>`;
  }

  // ------------------------------------------------------------------ titre
  scr_title() {
    const s = this.save, sug = suggestedSong(s), rec = s.songs[sug.id], loop = infiniteUnlocked(s);
    const daily = ensureDaily(s, localDateKey()), done = daily.filter(c => c.done).length, cl = claimable(s);
    const lat = this.app.audio.outputLatency();
    const warn = lat > 0.1 ? `<button class="warn" data-act="calib">⚠ Casque sans fil détecté — calibre ! <span>›</span></button>`
      : (!s.calib.done && s.stats.runs >= 1 ? `<button class="warn" data-act="calib">Calibrer le son et l’image (25 s) <span>›</span></button>` : '');
    return `<div class="screen tr" data-screen="title">
      <div class="topbar"><span class="money">◎ ${fmtNum(s.ondes)}</span><div class="grow"></div><button class="gear" data-act="settings" aria-label="Réglages">⚙</button></div>
      <div class="title-block"><h1><span class="on-beat">PULSE</span> RUN</h1><div class="sub">— esquive au rythme —</div></div>
      <div class="grow"></div>
      <div class="col">
        ${warn}
        <button class="btn btn--primary" data-act="play">▶ JOUER<small>${esc(sug.title)} ${rec ? starStr(rec.stars) : ''}</small></button>
        <div class="row"><button class="btn" data-act="albums">ALBUMS</button><button class="btn ${loop ? '' : 'lock'}" data-act="loop">${loop ? 'BOUCLE ∞' : '🔒 BOUCLE'}</button></div>
        <div class="row"><button class="btn pill" data-act="defis">DÉFIS ${done}/3${cl ? '<i></i>' : ''}</button><button class="btn" data-act="shop">BOUTIQUE</button></div>
      </div></div>`;
  }
  after_title() { document.documentElement.style.setProperty('--beat-ms', '625ms'); }

  // ------------------------------------------------------------------ albums
  scr_albums() {
    const s = this.save, n = this.album, pages = [1, 2, 3, 4];
    const vin = pages.map(p => {
      const off = p - n, locked = p < 4 ? !albumUnlocked(s, p) : !infiniteUnlocked(s);
      const name = p < 4 ? ALBUMS[p].name : 'BOUCLE', st = off === 0 ? '' : `transform: translateX(${off * 62}%) scale(.6); opacity:.5;`;
      return `<div class="vinyl ${off === 0 ? 'center spin' : ''} ${locked ? 'locked' : ''}" data-album="${p < 4 ? p : 1}" style="${st}" data-act="album" data-n="${p}"><div class="label">${locked ? '🔒' : ''}${name}<small>${p < 4 ? 'A' + p : '∞'}</small></div></div>`;
    }).join('');
    let info, btn;
    if (n < 4) {
      const ok = albumUnlocked(s, n), st = albumStars(s, n), need = ALBUMS[n].stars - totalStars(s);
      info = `<h3>${ALBUMS[n].name}</h3><div class="muted">${ALBUMS[n].style}</div><div style="margin-top:6px"><span class="stars">★ ${st} / 15</span> · Boss : ${bossBeaten(s, n) ? '✔' : '—'}${SONGS.filter(x => x.album === n).some(x => s.songs[x.id] && s.songs[x.id].gold) ? ' · <span style="color:var(--c-gold)">◉ or</span>' : ''}</div>`;
      btn = ok ? `<button class="btn btn--primary" data-act="open">OUVRIR</button>` : `<button class="btn btn--primary" disabled>Il te manque ${need} ★</button>`;
    } else {
      info = `<h3>BOUCLE</h3><div class="muted">mode infini · blocs de 8 mesures</div>`;
      btn = infiniteUnlocked(s) ? `<button class="btn btn--primary" data-act="loop">OUVRIR</button>` : `<button class="btn btn--primary" disabled>Termine Quatre Temps</button>`;
    }
    return `<div class="screen veil" data-screen="albums" data-album="${Math.min(3, n)}">${this.topbar('ALBUMS')}
      <div class="carousel" id="carousel">${vin}</div>
      <div class="dots">${pages.map(p => `<b class="${p === n ? 'on' : ''}"></b>`).join('')}</div>
      <div class="albinfo">${info}</div><div class="grow"></div>
      <div class="row" style="margin-bottom:8px"><button class="btn" data-act="prevAlbum" aria-label="Album précédent">‹</button><button class="btn" data-act="nextAlbum" aria-label="Album suivant">›</button></div>
      ${btn}</div>`;
  }
  after_albums() {
    const c = document.getElementById('carousel'); let x0 = null;
    c.addEventListener('pointerdown', e => { x0 = e.clientX; });
    c.addEventListener('pointerup', e => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) this.album = Math.max(1, Math.min(4, this.album + (dx < 0 ? 1 : -1))), this.show('albums'); });
  }

  // ------------------------------------------------------------------ morceaux
  scr_tracks() {
    const s = this.save, n = this.album, list = albumSongs(n), echo = this.echoMode && echoUnlocked(s, n);
    const rows = list.map((song, i) => {
      const ok = songUnlocked(s, song), r = s.songs[song.id];
      const right = r && r.clears ? `${starStr(r.stars)} ${r.rank ? `<span class="rankbadge">${r.rank}</span>` : ''}` : r && r.bestPct ? `<span class="lo">${Math.round(r.bestPct * 100)} %</span>` : '';
      return `<button class="track ${song.boss ? 'boss' : ''} ${ok ? '' : 'lock'}" data-act="song" data-id="${song.id}">
        <span class="n">${song.boss ? '♥' : i + 1}</span><span class="t"><b>${ok ? '' : '🔒 '}${esc(song.title)}${r && r.gold ? ' <span style="color:var(--c-gold)">◉</span>' : ''}</b><span>${ok ? `${song.bpm} BPM` : esc(lockReason(s, song))}${song.boss ? ' · BOSS' : ''}</span></span>
        <span>${ok ? right : ''}</span></button>`;
    }).join('');
    return `<div class="screen solid" data-screen="tracks" data-album="${n}">${this.topbar(ALBUMS[n].name, `<span class="stars">★ ${albumStars(s, n)}/15</span>`)}
      <div class="scroll col">${rows}</div>
      ${echoUnlocked(s, n) ? `<button class="btn ${echo ? 'btn--accent' : ''}" data-act="echo" style="margin-top:8px">ÉCHO ◐ ${echo ? 'ACTIVÉ' : ''}</button>` : ''}
      ${this.sheetHtml()}</div>`;
  }
  sheetHtml() {
    const id = this.sheet; if (!id) return '';
    const s = this.save, song = SONGS.find(x => x.id === id), r = s.songs[id] || { stars: [0, 0, 0], best: 0, acc: 0, combo: 0, bestPct: 0 };
    const ch = this.app.chartFor(song, {}), echoOk = echoUnlocked(s, song.album);
    if (this.training) {
      const reached = ch.sections.map((x, i) => ({ x, i })).filter(({ x, i }) => i > 0 && x.kind !== 'count' && (x.t0 <= (r.bestPct || 0) * ch.duration + 0.01 || r.clears));
      const sp = this.trSpeed || 1, sec = this.trSection || 0;
      return `<div class="scrim" data-act="closeSheet"></div><div class="sheet"><h3>Entraînement</h3><div class="muted">${esc(song.title)} · aucune étoile, aucun record, 0 ◎ · Pouls infinis</div>
        <div class="muted">Vitesse</div><div class="seg">${[0.7, 0.85, 1].map(v => `<button class="${sp === v ? 'on' : ''}" data-act="trSpeed" data-v="${v}">${Math.round(v * 100)} %</button>`).join('')}</div>
        <div class="muted">Départ</div><div class="seg">${[{ x: { name: 'DÉBUT' }, i: 0 }].concat(reached).map(({ x, i }) => `<button class="${sec === i ? 'on' : ''}" data-act="trSection" data-v="${i}">${esc(x.name)}${i ? ' ' + i : ''}</button>`).join('')}</div>
        <button class="btn btn--primary" data-act="trainGo">LANCER</button><button class="btn" data-act="closeTrain">RETOUR</button></div>`;
    }
    return `<div class="scrim" data-act="closeSheet"></div><div class="sheet" data-album="${song.album}"><h3>${esc(song.title)}</h3>
      <div class="kv"><span>Tempo</span><b>${song.bpm} BPM</b><span>Durée</span><b>${dur(ch.duration)}</b><span>Score max</span><b>${fmtNum(maxScore(ch))}</b>
      <span>Record</span><b>${fmtNum(r.best)}</b><span>Précision</span><b>${r.acc ? pct(r.acc) : '—'}</b><span>Combo max</span><b>${r.combo || 0}</b><span>Meilleur %</span><b>${Math.round((r.bestPct || 0) * 100)} %</b></div>
      <div class="kv"><span>${r.stars[0] ? '★' : '☆'} Terminer</span><b></b><span>${r.stars[1] ? '★' : '☆'} Précision ≥ 85 %</span><b>${r.acc ? 'ton record ' + pct(r.acc) : ''}</b><span>${r.stars[2] ? '★' : '☆'} Sans faute</span><b></b></div>
      <button class="btn btn--primary" data-act="playSong" data-id="${id}">JOUER</button>
      <div class="row"><button class="btn" data-act="train">ENTRAÎNEMENT</button>${echoOk ? `<button class="btn btn--accent" data-act="playEcho" data-id="${id}">ÉCHO</button>` : ''}</div>
      ${echoOk ? '<div class="muted center">Écho : approche ×0,8, brèches −1 taille — mode Maintenir non garanti</div>' : ''}</div>`;
  }

  // ------------------------------------------------------------------ boucle
  scr_loop() {
    const inf = this.save.infinite, today = localDateKey(), d = inf.daily.date === today ? inf.daily : { best: 0, rewarded: false };
    return `<div class="screen dim" data-screen="loop">${this.topbar('BOUCLE')}
      <div class="col" style="margin-top:12px"><div class="chal"><b>BOUCLE</b><div class="kv"><span>Meilleur score</span><b>${fmtNum(inf.best)}</b><span>Meilleure durée</span><b>${dur(inf.bestTime)}</b><span>Plus haut bloc</span><b>${inf.bestBlock}</b></div></div>
      <div class="chal pill"><b>BOUCLE DU JOUR · ${today}</b>${d.rewarded ? '' : '<i></i>'}<div class="kv"><span>Record du jour</span><b>${fmtNum(d.best)}</b><span>Récompense (≥ 60 s)</span><b>${d.rewarded ? 'prise' : '◎ 30'}</b></div></div></div>
      <div class="grow"></div><div class="col"><button class="btn btn--primary" data-act="loopGo">BOUCLE</button><button class="btn btn--primary" data-act="loopDaily">BOUCLE DU JOUR</button></div></div>`;
  }

  // ------------------------------------------------------------------ boutique
  scr_shop() {
    const s = this.save, cat = this.shopTab, items = SHOP[cat].items;
    const cards = items.map(([id, name, price]) => {
      const own = owns(s, cat, id), eq = s.equipped[cat] === id;
      const b = eq ? '<button class="btn" disabled>ÉQUIPÉ</button>' : own ? `<button class="btn" data-act="equip" data-id="${id}">ÉQUIPER</button>`
        : price === null ? '<button class="btn" disabled>TROPHÉE</button>' : `<button class="btn ${s.ondes >= price ? '' : 'lock'}" data-act="buy" data-id="${id}">◎ ${price}</button>`;
      return `<div class="card ${eq ? 'eq' : ''}"><canvas width="140" height="140" data-prev="${id}"></canvas><b>${esc(name)}</b>${b}</div>`;
    }).join('');
    return `<div class="screen solid" data-screen="shop">${this.topbar('BOUTIQUE')}
      <div class="tabs">${Object.keys(SHOP).map(k => `<button class="${k === cat ? 'on' : ''}" data-act="tab" data-v="${k}">${SHOP[k].label}</button>`).join('')}</div>
      <div class="scroll"><div class="grid2">${cards}</div><p class="muted center">Cosmétique uniquement : la hitbox est identique pour tous les skins.</p></div></div>`;
  }
  after_shop() {
    // aperçus : le Curseur qui franchit un anneau (dessin statique, couleurs joueur)
    for (const cv of this.root.querySelectorAll('canvas[data-prev]')) {
      const g = cv.getContext('2d'), id = cv.dataset.prev, cat = this.shopTab;
      g.fillStyle = C.bg0; g.fillRect(0, 0, 140, 140); g.translate(70, 70);
      g.strokeStyle = C.danger; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.arc(0, -20, 46, -0.9, Math.PI * 1.25); g.stroke();
      g.strokeStyle = C.dangerCore; g.lineWidth = 1.5; g.stroke();
      if (cat === 'core') { g.fillStyle = C.bg1; g.strokeStyle = '#8A5CFF'; g.lineWidth = 3; g.beginPath(); g.arc(0, -20, 20, 0, 7); g.fill(); g.stroke(); g.fillStyle = C.player; g.font = '800 11px system-ui'; g.textAlign = 'center'; g.fillText(id.slice(0, 6).toUpperCase(), 0, 45); continue; }
      if (cat === 'bg' || cat === 'tick') { g.fillStyle = C.player; g.font = '800 12px system-ui'; g.textAlign = 'center'; g.fillText(cat === 'tick' ? '♪ ' + id.toUpperCase() : id.toUpperCase(), 0, 45); continue; }
      g.translate(0, 30); g.strokeStyle = C.player; g.fillStyle = 'rgba(200,255,46,.22)'; g.lineWidth = 2; g.beginPath();
      const shapes = { chevron: [[0, -10], [8, 6], [0, 2], [-8, 6]], prisme: [[0, -10], [9, 7], [-9, 7]], cristal: [[0, -11], [6, -4], [6, 4], [0, 11], [-6, 4], [-6, -4]], couronne: [[-8, 6], [-6, -6], [-2, 2], [0, -10], [2, 2], [6, -6], [8, 6]] };
      const pts = shapes[id] || [[0, -9], [7, 0], [0, 9], [-7, 0]];
      pts.forEach(([x, y], i) => (i ? g.lineTo(x * 1.6, y * 1.6) : g.moveTo(x * 1.6, y * 1.6))); g.closePath(); g.fill(); g.stroke();
      if (cat === 'trail' && id !== 'none') { g.globalAlpha = 0.5; g.beginPath(); g.arc(0, -138, 120, Math.PI / 2 - 0.05, Math.PI / 2 + 0.45); g.lineWidth = 4; g.strokeStyle = id === 'spectre' ? '#7CF5FF' : C.playerSoft; if (id === 'pointilles') g.setLineDash([6, 6]); g.stroke(); }
      g.globalAlpha = 1; g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 3, 0, 7); g.fill();
    }
  }

  // ------------------------------------------------------------------ défis & trophées
  scr_defis() {
    const s = this.save, list = ensureDaily(s, localDateKey());
    const now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), left = Math.max(0, (mid - now) / 1000);
    const cards = list.map((c, i) => `<div class="chal"><div class="row" style="align-items:center"><b style="flex:3">${esc(c.text)}</b><span class="money" style="flex:1;text-align:right">◎ ${c.reward}</span></div>
      <div class="bar"><i style="width:${Math.round(c.prog / c.goal * 100)}%"></i></div><div class="muted">${c.id === 'play5' ? `${Math.floor(c.prog / 60)} / 5 min` : `${c.prog} / ${c.goal}`}</div>
      ${c.done && !c.claimed ? `<button class="btn btn--primary claim" data-act="claim" data-i="${i}">RÉCLAMER ◎ ${c.reward}</button>` : c.claimed ? '<div class="muted">✔ Réclamé</div>' : ''}</div>`).join('');
    const tro = TROPHIES.map(t => `<div class="${s.trophies[t.id] ? 'got' : ''}" title="${esc(t.name)} — ${esc(t.desc)}" aria-label="${esc(t.name)}">${s.trophies[t.id] ? '◆' : '◇'}</div>`).join('');
    return `<div class="screen solid" data-screen="defis">${this.topbar('DÉFIS')}
      <div class="scroll col"><div class="muted">Nouveaux défis dans ${dur(left / 60).replace(':', ' h ')} min</div>${cards}
      <h2 style="font-size:13px;letter-spacing:.14em;margin:12px 0 4px">TROPHÉES ${Object.keys(s.trophies).filter(k => TROPHIES.some(t => t.id === k)).length}/20</h2>
      <div class="troph">${tro}</div><button class="btn" data-act="records" style="margin-top:8px">RECORDS</button></div></div>`;
  }
  scr_records() {
    const s = this.save, tab = this.recTab;
    let body;
    if (tab < 4) {
      body = `<table class="rec"><tr><th>Morceau</th><th>Score</th><th>Préc.</th><th>Rang</th><th>Combo</th><th>%</th></tr>${albumSongs(tab).map(x => { const r = s.songs[x.id] || {}; return `<tr><td>${esc(x.title)}</td><td>${fmtNum(r.best || 0)}</td><td>${r.acc ? (r.acc * 100).toFixed(1) : '—'}</td><td>${r.rank || '—'}</td><td>${r.combo || 0}</td><td>${Math.round((r.bestPct || 0) * 100)}</td></tr>`; }).join('')}</table>`;
    } else { const i = s.infinite; body = `<div class="kv"><span>Meilleur score</span><b>${fmtNum(i.best)}</b><span>Meilleure durée</span><b>${dur(i.bestTime)}</b><span>Plus haut bloc</span><b>${i.bestBlock}</b><span>Boucle du jour (${i.daily.date || '—'})</span><b>${fmtNum(i.daily.best)}</b></div>`; }
    const st = s.stats;
    return `<div class="screen solid" data-screen="records">${this.topbar('RECORDS')}
      <div class="tabs">${[1, 2, 3, 4].map(k => `<button class="${k === tab ? 'on' : ''}" data-act="recTab" data-v="${k}">${k < 4 ? 'ALBUM ' + k : 'BOUCLE'}</button>`).join('')}</div>
      <div class="scroll">${body}<div class="kv" style="margin-top:16px"><span>Temps joué</span><b>${dur(st.playTime)}</b><span>PARFAIT cumulés</span><b>${fmtNum(st.perfects)}</b><span>Combo max</span><b>${st.maxCombo}</b><span>Tentatives</span><b>${st.runs}</b></div></div></div>`;
  }

  // ------------------------------------------------------------------ réglages
  scr_settings() {
    const s = this.save.settings, c = this.save.calib, prof = this.app.calibProfile();
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${s[key] === v ? 'on' : ''}" data-act="set" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
    const tog = key => `<button class="toggle ${s[key] ? 'on' : ''}" data-act="toggle" data-k="${key}" aria-pressed="${!!s[key]}" aria-label="${key}"></button>`;
    return `<div class="screen solid" data-screen="settings">${this.topbar('RÉGLAGES')}<div class="scroll">
      <div class="set"><span>Son</span><input type="range" min="0" max="100" value="${Math.round(s.sfx * 100)}" data-range="sfx" aria-label="Son"></div>
      <div class="set"><span>Musique</span><input type="range" min="0" max="100" value="${Math.round(s.music * 100)}" data-range="music" aria-label="Musique"></div>
      <div class="set"><span>Vibration</span>${tog('vibration')}</div>
      <div class="set"><span>Calibration<br><small class="muted">son ${prof.audioMs >= 0 ? '+' : ''}${prof.audioMs} ms · jugement ${prof.judgeMs} ms</small></span><button class="btn" data-act="calib">Recalibrer ›</button></div>
      <div class="set"><span>Réglage fin du son</span><div class="nudge" style="flex:0 1 60%"><button class="btn" data-act="fine" data-v="-1" aria-label="plus tôt">◀</button><span class="val">${prof.audioMs} ms</span><button class="btn" data-act="fine" data-v="1" aria-label="plus tard">▶</button></div></div>
      <div class="set"><span>Contrôle</span>${seg('control', [['glisser', 'GLISSER'], ['maintenir', 'MAINTENIR']])}</div>
      <div class="set"><span>Sensibilité</span>${seg('sensitivity', [[0.8, '0,8'], [1, '1'], [1.25, '1,25'], [1.5, '1,5']])}</div>
      <div class="set"><span>Inverser</span>${tog('invert')}</div>
      <div class="set"><span>Caméra</span><div class="seg">${[['suiveuse', 'SUIVEUSE'], ['fixe', 'FIXE']].map(([v, l]) => `<button class="${this.app.camera() === v ? 'on' : ''}" data-act="camera" data-v="${v}">${l}</button>`).join('')}</div></div>
      <div class="set"><span>Fantômes de brèche</span>${tog('ghosts')}</div>
      <div class="set"><span>Mouvements réduits</span>${seg('reducedMotion', [['auto', 'AUTO'], ['oui', 'OUI'], ['non', 'NON']])}</div>
      <div class="set"><span>Fréquence</span>${seg('fps', [['auto', 'AUTO'], ['60', '60 FPS']])}</div>
      <div class="set"><span>Qualité</span>${seg('quality', [['auto', 'AUTO'], ['haute', 'HAUTE'], ['moyenne', 'MOY.'], ['basse', 'BASSE']])}</div>
      <div class="set"><span></span><button class="btn btn--danger" data-act="reset">${this.confirmReset === 1 ? 'Confirmer ?' : this.confirmReset === 2 ? 'Vraiment tout effacer ?' : 'Réinitialiser la sauvegarde'}</button></div>
      <p class="muted center">Calibré : ${c.done ? 'oui' : 'non'} · profil de sortie ${profileKey(this.app.audio.outputLatency())} ms</p></div></div>`;
  }
  after_settings() {
    for (const r of this.root.querySelectorAll('input[data-range]')) r.addEventListener('input', () => { this.save.settings[r.dataset.range] = r.value / 100; this.app.applySettings(); });
  }

  // ------------------------------------------------------------------ calibration (3 étapes + résultat)
  scr_calib() {
    const c = this.calib || (this.calib = { step: 1, taps: [], audioDeltas: null, visualDeltas: null, res: null });
    const dots = `<div class="tapdots">${Array.from({ length: CALIB_TAPS }, (_, i) => (i < c.taps.length ? '●' : '<span class="off">○</span>')).join('')}</div>`;
    const head = `<div class="topbar"><button class="back" data-act="back" aria-label="Retour">‹</button><h2>CALIBRATION</h2><span class="muted">${Math.min(c.step, 3)} / 3</span></div>`;
    if (c.step === 1) return `<div class="screen solid calib" data-screen="calib">${head}<h1>TAPE SUR CE QUE TU<em>ENTENDS</em></h1><p class="muted center">(pas d’image, ferme les yeux si tu veux)</p><div class="grow"></div>${dots}<div class="grow"></div><div class="tapzone" id="tapzone">TAPE ICI</div></div>`;
    if (c.step === 2) return `<div class="screen solid calib" data-screen="calib">${head}<h1>TAPE SUR CE QUE TU<em>VOIS</em></h1><p class="muted center">(son coupé : tape quand l’anneau touche l’orbite)</p><canvas id="calcv" width="440" height="440"></canvas>${dots}<div class="grow"></div><div class="tapzone" id="tapzone">TAPE ICI</div></div>`;
    if (c.step === 3) return `<div class="screen solid calib" data-screen="calib">${head}<h1>VÉRIFIE<em>LE SON</em></h1><p class="muted center">Le kick doit tomber pile quand l’anneau touche l’orbite.</p><canvas id="calcv" width="440" height="440"></canvas>
      <div class="muted center">Le son arrive :</div><div class="nudge"><button class="btn" data-act="cnudge" data-v="-1">◀ plus tôt</button><span class="val" id="cval">${c.res.audioMs >= 0 ? '+' : ''}${c.res.audioMs} ms</span><button class="btn" data-act="cnudge" data-v="1">plus tard ▶</button></div>
      <div class="grow"></div><button class="btn btn--primary" data-act="cresult">CONTINUER</button></div>`;
    const r = c.res, bad = !r.reliable;
    return `<div class="screen solid calib" data-screen="calib">${head}<h1>RÉSULTAT</h1><div class="grow"></div>
      <div class="kv" style="font-size:16px"><span>Son</span><b>${r.audioMs >= 0 ? '+' : ''}${r.audioMs} ms</b><span>Jugement</span><b>${r.judgeMs} ms</b><span>Fiabilité</span><b>±${r.sd} ms</b></div>
      ${bad ? '<p class="center" style="color:var(--c-danger);font-weight:800">Mesure peu fiable, recommence</p>' : ''}<div class="grow"></div>
      <div class="col">${bad ? '<button class="btn btn--primary" data-act="crestart">RECOMMENCER</button><button class="btn" data-act="csave">ENREGISTRER QUAND MÊME</button>'
        : '<button class="btn btn--primary" data-act="csave">ENREGISTRER</button><button class="btn" data-act="crestart">RECOMMENCER</button>'}</div></div>`;
  }
  after_calib() {
    const a = this.app, au = a.audio, c = this.calib;
    au.unlock(); au.stopMenu(); au.stopSong();
    const zone = document.getElementById('tapzone');
    const perf2ctx = ev => (au.ok ? au.now() + ((ev.timeStamp || performance.now()) - performance.now()) / 1000 : (ev.timeStamp || performance.now()) / 1000);
    if (c.step === 1) {
      // clic bois à 100 BPM : 4 temps d'écoute puis les taps
      const beat = 60 / CALIB_BPM, t0 = (au.ok ? au.now() : performance.now() / 1000) + 0.4, clicks = [];
      for (let i = 0; i < 4 + CALIB_TAPS + 6; i++) { const at = t0 + i * beat; clicks.push(at); if (au.ok) au.woodAt(at, i % 4 === 0); }
      c.clicks = clicks; c.listenEnd = t0 + 4 * beat - beat / 2;
      zone.addEventListener('pointerdown', ev => {
        const tc = perf2ctx(ev); if (tc < c.listenEnd) return;
        c.taps.push(tc); zone.classList.add('flash'); setTimeout(() => zone.classList.remove('flash'), 70);
        if (c.taps.length >= CALIB_TAPS) {
          const lat = au.outputLatency();
          c.audioDeltas = tapDeltas(c.taps, c.clicks.map(x => x + lat));
          c.taps = []; c.step = 2; this.show('calib');
        } else this.root.querySelector('.tapdots').innerHTML = Array.from({ length: CALIB_TAPS }, (_, i) => (i < c.taps.length ? '●' : '<span class="off">○</span>')).join('');
      });
    } else if (c.step === 2) {
      const cv = document.getElementById('calcv'), g = cv.getContext('2d'), p0 = performance.now() + 600;
      c.cross = []; for (let i = 0; i < CALIB_TAPS + 12; i++) c.cross.push(p0 + i * CALIB_VISUAL_PERIOD * 1000);
      const draw = () => {
        if (!this.calib || this.calib.step !== 2) return;
        const now = performance.now(); g.setTransform(2, 0, 0, 2, 110 * 2, 110 * 2); g.setTransform(1, 0, 0, 1, 220, 220);
        g.fillStyle = C.bg0; g.fillRect(-220, -220, 440, 440);
        g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 150, 0, 7); g.stroke();
        const ph = ((now - p0) / 1000 / CALIB_VISUAL_PERIOD) % 1, f = ph < 0 ? ph + 1 : ph, r = 40 + 110 * (f / 0.999);
        g.strokeStyle = C.player; g.lineWidth = 10; g.globalAlpha = r > 150 ? Math.max(0, 1 - (r - 150) / 30) : 1; g.beginPath(); g.arc(0, 0, Math.min(r, 180), 0, 7); g.stroke(); g.globalAlpha = 1;
        this.raf = requestAnimationFrame(draw);
      };
      draw();
      zone.addEventListener('pointerdown', ev => {
        const tp = ev.timeStamp || performance.now(); if (tp < p0 - 300) return;
        c.taps.push(tp / 1000); zone.classList.add('flash'); setTimeout(() => zone.classList.remove('flash'), 70);
        if (c.taps.length >= CALIB_TAPS) {
          c.visualDeltas = tapDeltas(c.taps, c.cross.map(x => x / 1000));
          c.res = computeCalibration(c.audioDeltas, c.visualDeltas); c.base = c.res.audioMs;
          c.taps = []; c.step = 3; cancelAnimationFrame(this.raf); this.show('calib');
        } else this.root.querySelector('.tapdots').innerHTML = Array.from({ length: CALIB_TAPS }, (_, i) => (i < c.taps.length ? '●' : '<span class="off">○</span>')).join('');
      });
    } else if (c.step === 3) {
      // 8 mesures de jeu réel en boucle : anneaux danger + kick, réglage par pas de 5 ms
      const cv = document.getElementById('calcv'), g = cv.getContext('2d'), beat = 60 / CALIB_BPM, start = (au.ok ? au.now() : performance.now() / 1000) + 0.3;
      let sched = 0;
      const draw = () => {
        if (!this.calib || this.calib.step !== 3) return;
        const now = au.ok ? au.now() : performance.now() / 1000;
        while (au.ok && start + sched * beat < now + 0.2) { au.kickAt(start + sched * beat); sched++; }
        const lat = au.outputLatency(), tg = now - start - lat - c.res.audioMs / 1000;
        g.setTransform(1, 0, 0, 1, 220, 220); g.fillStyle = C.bg0; g.fillRect(-220, -220, 440, 440);
        g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 150, 0, 7); g.stroke();
        const f = ((tg / beat) % 1 + 1) % 1, r = 150 - (1 - f) * 110;
        for (const rr of [r, r + 110 * 1]) { if (rr > 200) continue; g.strokeStyle = C.danger; g.lineWidth = 10; g.globalAlpha = rr > 150 ? Math.max(0, 1 - (rr - 150) / 40) : 1; g.beginPath(); g.arc(0, 0, rr, 0.5, Math.PI * 2 - 0.2); g.stroke(); }
        g.globalAlpha = 1;
        this.raf = requestAnimationFrame(draw);
      };
      draw();
    }
  }
  stopCalib() { cancelAnimationFrame(this.raf); this.calib = null; }

  // ------------------------------------------------------------------ jeu, pause, fin
  scr_game() { return ''; }
  scr_pause() {
    const a = this.app, g = a.game, sec = a.chart.sections[g.sectionAt(Math.max(0, g.t))];
    const name = a.opts.kind === 'loop' ? 'Boucle' : a.song.title;
    return `<div class="screen veil" data-screen="pause"><div class="grow"></div><div class="col center">
      <h2 style="font-size:28px;margin:0;letter-spacing:.2em">PAUSE</h2><div class="muted">${esc(name)} · ${Math.round(g.progress() * 100)} %</div><div class="muted">${esc(sec ? sec.name : '')} · combo ${g.combo}</div></div>
      <div class="grow"></div><div class="col"><button class="btn btn--primary" data-act="resume">REPRENDRE</button>
      <div class="row"><button class="btn" data-act="restart">RECOMMENCER</button>${a.opts.kind === 'training' ? '<button class="btn" data-act="restartSection">↺ SECTION</button>' : ''}</div>
      <div class="row"><button class="btn" data-act="pauseSettings">RÉGLAGES</button><button class="btn" data-act="quit">${this.confirmQuit ? 'CONFIRMER ?' : 'QUITTER'}</button></div></div></div>`;
  }
  scr_end() {
    const a = this.app, R = a.result, r = R.res, s = this.save, o = a.opts, ch = a.chart;
    this.endShown = performance.now();
    const eco = R.eco, ch1 = R.changed[0];
    const chal = ch1 ? `Défi ${'▮'.repeat(Math.round(ch1.prog / ch1.goal * 4))}${'▯'.repeat(4 - Math.round(ch1.prog / ch1.goal * 4))} ${ch1.id === 'play5' ? Math.floor(ch1.prog / 60) + '/5 min' : ch1.prog + '/' + ch1.goal}` : '';
    const trophies = R.trophies.length ? `<div class="record">TROPHÉE : ${R.trophies.slice(0, 2).map(t => esc(t.name)).join(', ')}${R.trophies.length > 2 ? ` +${R.trophies.length - 2}` : ''}</div>` : '';
    if (o.kind === 'loop') {
      return `<div class="screen veil end" data-screen="end"><div class="grow"></div>
        <div class="cap">${o.daily ? 'BOUCLE DU JOUR' : 'BOUCLE'}</div><div class="pct">BLOC ${r.block}</div>
        <div class="score">${fmtNum(r.score)}</div>${eco.record ? '<div class="record">RECORD !</div>' : ''}
        <div class="stats">Durée ${dur(r.time)} · Précision ${pct(r.acc)} · Combo max ${r.maxCombo}</div>
        <div class="money" style="margin-top:8px">◎ +${eco.ondes}${eco.dailyReward ? ' (dont 30 du jour)' : ''}</div>${trophies}<div class="grow"></div>
        <div class="col"><button class="btn btn--primary" data-act="replay" autofocus>REJOUER</button><button class="btn" data-act="toMenu">MENU</button></div></div>`;
    }
    const song = a.song;
    if (r.won && !R.quit) {
      const nx = nextSong(s, song), splus = r.rank === 'S+';
      const st = R.stars.map((x, i) => `<span class="${x ? '' : 'off'}">${x ? '★' : '☆'}${eco.newStars[i] ? '<span class="new">NOUVEAU</span>' : ''}</span>`).join(' ');
      return `<div class="screen veil end" data-screen="end" data-album="${song.album}"><div class="grow"></div>
        <div class="cap reveal on">${o.kind === 'training' ? 'ENTRAÎNEMENT TERMINÉ' : o.echo ? 'ÉCHO TERMINÉ' : 'MORCEAU TERMINÉ'}</div>
        <div class="rank reveal ${splus ? 'splus' : ''}" data-r="1">${o.kind === 'training' ? '✓' : r.rank}</div>
        <div class="bigstars reveal" data-r="2">${o.kind === 'training' ? '' : st}</div>
        <div class="reveal" data-r="3"><div class="score" id="scoreRoll">0</div>${eco.record ? '<div class="record">RECORD !</div>' : ''}${eco.gold ? '<div class="record">DISQUE D’OR ◉</div>' : ''}</div>
        <div class="stats reveal" data-r="4">PARFAIT ${r.perfect} · BIEN ${r.good} · OK ${r.ok} · RATÉ ${r.miss}<br>Précision ${pct(r.acc)} · Combo max ${r.maxCombo}</div>
        <div class="reveal" data-r="5"><span class="money">◎ +${eco.ondes}</span> <span class="muted">${chal}</span>${trophies}</div><div class="grow"></div>
        <div class="col reveal" data-r="6"><button class="btn btn--primary" data-act="replay" autofocus>REJOUER</button>
        <div class="row">${nx && o.kind !== 'training' ? `<button class="btn" data-act="next" data-id="${nx.id}">SUIVANT ▶</button>` : ''}<button class="btn" data-act="toTracks">MORCEAUX</button></div></div></div>`;
    }
    const g = a.game, sec = ch.sections[g.sectionAt(Math.max(0, g.lastJudgedTc, g.dead ? g.deathT : 0))], rec = s.songs[song.id] || { bestPct: 0 };
    const marks = ch.sections.filter(x => x.t0 > 0).map(x => `<u style="left:${(x.t0 / ch.duration * 100).toFixed(1)}%"></u>`).join('');
    return `<div class="screen veil end" data-screen="end" data-album="${song.album}"><div class="grow"></div>
      <div class="cap dg">TOMBÉ AU ${esc(sec ? sec.name : '')}</div><div class="pct">${Math.round(r.pct * 100)} %</div>
      <div class="progressbar"><i style="width:${(r.pct * 100).toFixed(1)}%"></i>${marks}${rec.bestPct > 0 && rec.bestPct < 1 ? `<em style="left:${(rec.bestPct * 100).toFixed(1)}%"></em>` : ''}</div>
      <div class="muted">${rec.bestPct > 0 && rec.bestPct < 1 ? `record ▲ ${Math.round(rec.bestPct * 100)} %` : ''}${eco.pctRecord ? ' · RECORD !' : ''}</div>
      <div class="stats" style="margin-top:10px">Score ${fmtNum(r.score)}<br>Précision ${pct(r.acc)}</div>
      <div class="money" style="margin-top:6px">◎ +${eco.ondes}</div>${trophies}<div class="grow"></div>
      <div class="col"><button class="btn btn--primary" data-act="replay" autofocus>REJOUER</button>
      <div class="row"><button class="btn" data-act="trainHere">ENTRAÎNEMENT</button><button class="btn" data-act="toTracks">MORCEAUX</button></div></div>
      <p class="muted center">Touche n’importe où pour rejouer</p></div>`;
  }
  after_end() {
    const a = this.app, R = a.result;
    if (a.opts.kind === 'loop' || !R.res.won) return;
    // apparition calée sur les temps de l'outro (1 élément par temps), tap = tout afficher
    const beat = 60 / (a.chart.tempo.bpmAt(a.chart.beat - 1) || 120);
    let k = 1;
    a.audio.startMenu(Math.min(3, a.song.album), false);
    const step = () => {
      const el = this.root.querySelector(`.reveal[data-r="${k}"]`);
      if (!el) { clearInterval(this.revealTimer); return; }
      el.classList.add('on');
      if (k === 1) a.audio.sfxNow('rank', R.res.rank === 'S+');
      if (k === 2) R.stars.forEach((x, i) => { if (x) setTimeout(() => { a.audio.sfxNow('star', i); a.vibrate([18]); }, i * beat * 330); });
      if (k === 3) this.rollScore(R.res.score);
      k++;
    };
    step(); this.revealTimer = setInterval(step, beat * 1000);
  }
  rollScore(target) {
    const el = document.getElementById('scoreRoll'); if (!el) return;
    const t0 = performance.now();
    const f = () => { const p = Math.min(1, (performance.now() - t0) / 800); el.textContent = fmtNum(target * p); this.app.audio.sfxNow('count'); if (p < 1) requestAnimationFrame(f); };
    f();
  }
  revealAll() { clearInterval(this.revealTimer); for (const el of this.root.querySelectorAll('.reveal')) el.classList.add('on'); const s = document.getElementById('scoreRoll'); if (s) s.textContent = fmtNum(this.app.result.res.score); }

  // ------------------------------------------------------------------ actions
  onDown(e) {
    // fin (échec) : un 2e tap n'importe où (hors boutons) 0,5 s après l'apparition = REJOUER
    if (this.current === 'end' && !e.target.closest('button')) {
      const R = this.app.result;
      if (!R.res.won && performance.now() - this.endShown > 500) { this.act('replay'); return; }
      if (R.res.won) this.revealAll();
    }
  }
  onClick(e) {
    const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    this.act(el.dataset.act, el);
  }
  act(act, el) {
    const a = this.app, s = this.save, d = el ? el.dataset : {};
    if (!['back', 'quit'].includes(act)) this.sfx(act === 'play' || act === 'playSong' || act === 'replay' ? 'ok' : 'tap');
    if (act !== 'quit') this.confirmQuit = false;
    switch (act) {
      case 'back': this.sheet = null; this.training = false; this.back(); break;
      case 'play': { const sg = suggestedSong(s); this.album = sg.album; a.startSong(sg); break; }
      case 'albums': this.go('albums'); break;
      case 'album': this.album = +d.n; this.show('albums'); break;
      case 'prevAlbum': this.album = Math.max(1, this.album - 1); this.show('albums'); break;
      case 'nextAlbum': this.album = Math.min(4, this.album + 1); this.show('albums'); break;
      case 'open': this.sheet = null; this.go('tracks'); break;
      case 'loop': if (!infiniteUnlocked(s)) { this.toast('Termine « Quatre Temps » pour débloquer la Boucle'); break; } this.go('loop'); break;
      case 'loopGo': a.startLoop(false); break;
      case 'loopDaily': a.startLoop(true); break;
      case 'song': {
        const song = SONGS.find(x => x.id === d.id);
        if (!songUnlocked(s, song)) { this.toast(lockReason(s, song)); break; }
        const now = performance.now();
        if (this.lastTap && this.lastTap.id === d.id && now - this.lastTap.t < 350) { this.lastTap = null; this.startFromSheet(song, this.echoMode && echoUnlocked(s, song.album)); break; }
        this.lastTap = { id: d.id, t: now };
        this.sheet = d.id; this.training = false; this.show('tracks'); break;
      }
      case 'closeSheet': this.sheet = null; this.training = false; this.show('tracks'); break;
      case 'playSong': this.startFromSheet(SONGS.find(x => x.id === d.id), false); break;
      case 'playEcho': this.startFromSheet(SONGS.find(x => x.id === d.id), true); break;
      case 'echo': this.echoMode = !this.echoMode; this.show('tracks'); break;
      case 'train': this.training = true; this.trSpeed = this.trSpeed || 1; this.trSection = 0; this.show('tracks'); break;
      case 'closeTrain': this.training = false; this.show('tracks'); break;
      case 'trSpeed': this.trSpeed = +d.v; this.show('tracks'); break;
      case 'trSection': this.trSection = +d.v; this.show('tracks'); break;
      case 'trainGo': { const song = SONGS.find(x => x.id === this.sheet); this.sheet = null; this.training = false; a.startSong(song, { training: { speed: this.trSpeed, section: this.trSection } }); break; }
      case 'shop': this.go('shop'); break;
      case 'tab': this.shopTab = d.v; this.show('shop'); break;
      case 'buy': { const r = buy(s, this.shopTab, d.id); if (r.ok) { a.audio.sfxNow('buy'); checkTrophies(s); a.persist(); this.show('shop'); } else this.toast(r.why); break; }
      case 'equip': equip(s, this.shopTab, d.id); a.persist(); if (this.shopTab === 'bg') a.renderer.setPalette(0, d.id); this.show('shop'); break;
      case 'defis': this.go('defis'); break;
      case 'claim': { const n = claimDaily(s, +d.i); if (n) { a.audio.sfxNow('buy'); this.toast(`◎ +${n}`); a.persist(); } this.show('defis'); break; }
      case 'records': this.go('records'); break;
      case 'recTab': this.recTab = +d.v; this.show('records'); break;
      case 'settings': this.go('settings'); break;
      case 'set': { const k = d.k; let v = d.v; if (k === 'sensitivity') v = +v; s.settings[k] = v; a.applySettings(); this.show('settings'); break; }
      case 'toggle': s.settings[d.k] = !s.settings[d.k]; a.applySettings(); this.show('settings'); break;
      case 'camera': s.settings.camera = d.v; s.settings.cameraChosen = true; a.applySettings(); this.show('settings'); break;
      case 'fine': { const key = profileKey(a.audio.outputLatency()), p = a.calibProfile(); const v = nudge(p.audioMs, p.audioMs, +d.v); s.calib.profiles[key] = { audioMs: v, judgeMs: p.judgeMs }; s.calib.audioMs = v; a.persist(); this.show('settings'); break; }
      case 'reset':
        if (this.confirmReset < 2) { this.confirmReset++; this.show('settings'); break; }
        this.confirmReset = 0; a.save = defaultSave(); a.persist(true); a.applySettings(); this.toast('Sauvegarde réinitialisée'); this.stack = []; this.show('title'); break;
      case 'calib': this.calib = null; this.go('calib'); break;
      case 'cnudge': { const c = this.calib; c.res.audioMs = nudge(c.base, c.res.audioMs, +d.v); document.getElementById('cval').textContent = `${c.res.audioMs >= 0 ? '+' : ''}${c.res.audioMs} ms`; break; }
      case 'cresult': this.calib.step = 4; cancelAnimationFrame(this.raf); this.show('calib'); break;
      case 'crestart': this.calib = null; this.show('calib'); break;
      case 'csave': {
        const r = this.calib.res, key = profileKey(a.audio.outputLatency());
        s.calib.audioMs = r.audioMs; s.calib.judgeMs = r.judgeMs; s.calib.done = true; s.calib.profiles[key] = { audioMs: r.audioMs, judgeMs: r.judgeMs };
        checkTrophies(s); a.persist(true); this.toast('Calibration enregistrée'); this.calib = null; this.back(); break;
      }
      case 'resume': a.resume(); break;
      case 'restart': a.restart(); break;
      case 'restartSection': a.restartSection(); break;
      case 'pauseSettings': this.stack = [['pause']]; this.show('settings'); break;
      case 'quit':
        if (!this.confirmQuit) { this.confirmQuit = true; this.sfx('tap'); this.show('pause'); break; }
        this.confirmQuit = false; a.quit(); this.sfx('back'); this.stack = [['title']]; this.show(a.opts.kind === 'loop' ? 'loop' : 'tracks'); break;
      case 'replay': a.restart(); break;
      case 'next': { const sg = SONGS.find(x => x.id === d.id); this.album = sg.album; a.startSong(sg); break; }
      case 'toTracks': if (a.song) this.album = a.song.album; this.stack = [['title'], ['albums']]; this.sheet = null; this.show('tracks'); break;
      case 'toMenu': this.stack = []; this.show('title'); break;
      case 'trainHere': {
        const g = a.game, sec = Math.max(1, g.sectionAt(Math.max(0, g.lastJudgedTc, g.dead ? g.deathT : 0)));
        a.startSong(a.song, { training: { speed: 1, section: sec } }); break;
      }
    }
  }
  startFromSheet(song, echo) { this.sheet = null; this.training = false; this.app.startSong(song, { echo }); }
}
export { cleared, starsFor };
