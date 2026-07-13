/**
 * viewport.js
 * Gestion des dimensions viewport avec taille minimale
 */

/**
 * Applique la taille minimale définie dans CONFIG
 */
export function applyMinSize(config) {
  const ms = config.MIN_SIZE;
  if (!ms) return;

  const app = document.getElementById('app');
  if (app) {
    app.style.minWidth = ms.width + 'px';
    app.style.minHeight = ms.height + 'px';
  }
  
  document.documentElement.style.minWidth = ms.width + 'px';
  document.documentElement.style.minHeight = ms.height + 'px';
}

/**
 * Largeur viewport clampée au minimum
 */
export function vW(config) {
  return Math.max(config.MIN_SIZE.width, window.innerWidth);
}

/**
 * Hauteur viewport clampée au minimum
 */
export function vH(config) {
  return Math.max(config.MIN_SIZE.height, window.innerHeight);
}

/**
 * Taille de police proportionnelle depuis CONFIG.FONTS
 * @param {string} key - Clé dans CONFIG.FONTS
 */
export function fontPx(key, config) {
  const f = config.FONTS?.[key];
  if (!f) return 12;
  
  const raw = vW(config) * f.size_vw / 100;
  return Math.round(Math.max(f.size_min, Math.min(f.size_max, raw)));
}
