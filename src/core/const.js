// Constantes de jeu (GAME_DESIGN §1–§4). Unité : u (largeur logique 360 u). Angles en degrés, 0° = droite, 90° = bas.
export const R_CORE = 24, R_EMIT = 30, R_ORBIT = 118, R_FADE0 = 142, R_FADE1 = 206, R_KILL = 232, R_OUT = 232;
export const D_OUT = 88, D_IN = 114;
export const RAD = Math.PI / 180;
export const ALPHA_H = Math.asin(4 / 118) / RAD;          // 1,94° : demi-ouverture angulaire de la hitbox
export const GRACE = 3;                                    // élargissement des brèches pour la collision (°)
export const HR = 3;                                       // demi-épaisseur de collision (u)
export const RWIN = HR + 4;                                // fenêtre radiale de contact (u)
export const RAY_HALF = 2.5;                               // demi-largeur de collision d'un rayon (°)
export const GAPS = { XL: 72, L: 58, M: 46, S: 36, XS: 28 };
export const GAP_ORDER = ['XL', 'L', 'M', 'S', 'XS'];
export const SPEEDS = { lent: 1.5, normal: 1, rapide: 0.6, eclair: 0.4 };
export const STEP = 1 / 240, MAX_STEPS = 32, MENU_STEP = 1 / 60;
export const INVULN = 0.5, MAX_POULS = 4, REGEN_PASSES = 24;
export const K_DRAG = 1.15, HOLD_SPEED = 420, HOLD_RAMP = 0.04, MAX_DRAG_SPEED = 1440;
export const SENSITIVITIES = [0.8, 1.0, 1.25, 1.5];
export const REACTION = 0.10;                              // réaction accordée par le validateur (s)
export const OMEGA_CAP = 440, OMEGA_CAP_ECHO = 500;
export const MAX_IN_FLIGHT = 14, MAX_RAYS = 4;
export const POOL_OBSTACLES = 48;
export const RAY_TELE_MIN = 0.40;

export const C = {
  bg0: '#07060D', bg1: '#0F0C1C', bg2: '#18132C', bg3: '#251D44', groove: '#17122A',
  danger: '#FF2E63', dangerCore: '#FFD3DE', fast: '#FF8A2A', fastCore: '#FFE6CC',
  player: '#C8FF2E', playerSoft: '#E6FF9A', white: '#FFFFFF', ok: '#9A93C4', good: '#7CF5FF',
  gold: '#FFD23F', onde: '#7CF5FF', hi: '#F4F1FF', mid: '#ABA4CF', lo: '#5F5880',
};

export const ALBUMS = [
  null,
  { n: 1, id: 'a1', name: 'BATTEMENTS', style: 'deep house', accent: '#8A5CFF', dark: '#2A1A5C', stars: 0,
    key: 'A', scale: 'minor', chords: ['i', 'VI', 'III', 'VII'], kit: 'house', bass: 'rond', omega: [240, 300] },
  { n: 2, id: 'a2', name: 'SYNCOPE', style: 'funk house', accent: '#1FE5C2', dark: '#0C3B3A', stars: 10,
    key: 'D', scale: 'dorian', chords: ['i7', 'IV7', 'i7', 'v7'], kit: 'funk', bass: 'funk', omega: [320, 380] },
  { n: 3, id: 'a3', name: 'DROP', style: 'rave · drum & bass', accent: '#3F7BFF', dark: '#13235C', stars: 25,
    key: 'F', scale: 'phrygian', chords: ['i', 'bII', 'i', 'VII'], kit: 'rave', bass: 'wobble', omega: [400, 440] },
];

export const wrap = a => ((a % 360) + 360) % 360;
export const adiff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;   // a − b dans [−180, 180)
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
