// Bandeau de messages en jeu : UN SEUL message affiché à la fois, jamais deux fois le même (leçon de PULSAR).
// Chaque message a une clé ; un message dont la clé est déjà affichée ou en file est ignoré. Priorité : un message plus
// prioritaire remplace le message courant (qui n'est pas réaffiché) ; sinon il attend sa place. Pur (testable sous Node).
export const PRIO = { section: 1, info: 2, fx: 3, clean: 2, palier: 3, boss: 3 };

export class Banner {
  constructor() { this.cur = null; this.queue = []; this.shown = new Set(); this.log = []; }
  reset() { this.cur = null; this.queue.length = 0; this.shown.clear(); this.log.length = 0; }
  // msg : { key, text, t0 (début d'affichage), t1 (fin), prio, accent, dots }
  push(msg) {
    if (this.shown.has(msg.key)) return false;
    if (this.cur && this.cur.key === msg.key) return false;
    if (this.queue.some(m => m.key === msg.key)) return false;
    this.queue.push(msg);
    this.queue.sort((a, b) => b.prio - a.prio || a.t0 - b.t0);
    return true;
  }
  // message à afficher à l'instant t (ou null)
  update(t) {
    if (this.cur && t >= this.cur.t1) this.cur = null;
    // purge des messages périmés
    for (let i = this.queue.length - 1; i >= 0; i--) if (this.queue[i].t1 <= t) { this.shown.add(this.queue[i].key); this.queue.splice(i, 1); }
    for (let i = 0; i < this.queue.length; i++) {
      const m = this.queue[i];
      if (m.t0 > t) continue;
      if (!this.cur || m.prio > this.cur.prio) {
        this.queue.splice(i, 1);
        if (this.cur) this.shown.add(this.cur.key);
        this.cur = m; this.shown.add(m.key); this.log.push({ key: m.key, t });
      }
      break;
    }
    return this.cur;
  }
}
