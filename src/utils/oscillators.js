/**
 * oscillators.js
 * Oscillateurs pour animations organiques (torche)
 */

/**
 * Configuration des oscillateurs
 * Chaque oscillateur a : speed (s), phase (p), amplitude (a)
 */
export const O = {
  b1: { s: 0.00044, p: Math.random() * 6.28, a: 0.062 },
  b2: { s: 0.00071, p: Math.random() * 6.28, a: 0.038 },
  f1: { s: 0.0088,  p: Math.random() * 6.28, a: 0.024 },
  f2: { s: 0.0141,  p: Math.random() * 6.28, a: 0.017 },
  f3: { s: 0.0229,  p: Math.random() * 6.28, a: 0.011 },
  f4: { s: 0.0373,  p: Math.random() * 6.28, a: 0.006 },
  dx: { s: 0.00058, p: Math.random() * 6.28, a: 3.2 },
  dy: { s: 0.00074, p: Math.random() * 6.28, a: 2.5 },
  w:  { s: 0.00041, p: Math.random() * 6.28, a: 1.0 },
};

/**
 * Fonction oscillateur
 * @param {object} o - Configuration oscillateur {s, p, a}
 * @param {number} t - Timestamp
 * @returns {number} Valeur oscillée
 */
export function osc(o, t) {
  return Math.sin(t * o.s + o.p) * o.a;
}
