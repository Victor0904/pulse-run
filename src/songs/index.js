// Catalogue des 15 morceaux (3 albums × 4 morceaux + 1 boss). Ordre = ordre de jeu.
import a1s1 from './a1s1.js';
import a1s2 from './a1s2.js';
import a1s3 from './a1s3.js';
import a1s4 from './a1s4.js';
import a1boss from './a1boss.js';
import a2s1 from './a2s1.js';
import a2s2 from './a2s2.js';
import a2s3 from './a2s3.js';
import a2s4 from './a2s4.js';
import a2boss from './a2boss.js';
import a3s1 from './a3s1.js';
import a3s2 from './a3s2.js';
import a3s3 from './a3s3.js';
import a3s4 from './a3s4.js';
import a3boss from './a3boss.js';

export const SONGS = [a1s1, a1s2, a1s3, a1s4, a1boss, a2s1, a2s2, a2s3, a2s4, a2boss, a3s1, a3s2, a3s3, a3s4, a3boss];
export const SONG_BY_ID = Object.fromEntries(SONGS.map(s => [s.id, s]));
export const albumSongs = n => SONGS.filter(s => s.album === n);
