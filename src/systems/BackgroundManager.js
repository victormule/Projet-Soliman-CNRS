/**
 * BackgroundManager.js
 *
 */

export class BackgroundManager {
  constructor() {
    this._names = ['vitrine', 'phrenologie', 'collaboration', 'chapitre1'];
  }

  /**
   * Affiche un fond, cache instantanément tous les autres.
   * @param {string} name - Nom du fond ('vitrine', 'phrenologie', etc.)
   * @param {number} durationMs - Durée du fade in du fond affiché
   * @returns {Promise} Résout quand le fade in est terminé
   */
  show(name, durationMs = 1200) {
    // Cacher les autres instantanément (sans transition)
    this._names.forEach(id => {
      if (id === name) return;
      const el = document.getElementById(`bg-${id}`);
      if (!el) return;
      el.style.transition = 'none';
      el.style.opacity = '0';
      // Cas spécial chapitre1 : retirer la classe zoom
      if (id === 'chapitre1') el.classList.remove('zoomed');
    });

    // Afficher le fond demandé avec fade
    const target = document.getElementById(`bg-${name}`);
    if (!target) return Promise.resolve();

    target.style.transition = `opacity ${durationMs}ms ease`;
    target.style.opacity = '1';

    return new Promise(resolve => setTimeout(resolve, durationMs + 20));
  }

  /**
   * Masque un fond spécifique avec fade.
   * @param {string} name - Nom du fond
   * @param {number} durationMs - Durée du fade out
   * @returns {Promise}
   */
  hide(name, durationMs = 400) {
    const el = document.getElementById(`bg-${name}`);
    if (!el) return Promise.resolve();

    el.style.transition = `opacity ${durationMs}ms ease`;
    el.style.opacity = '0';

    return new Promise(resolve => setTimeout(resolve, durationMs + 20));
  }

  /**
   * Tous les fonds à 0, sans transition.
   * Utilisé pour garantir l'état noir avant une scène.
   */
  blackout() {
    this._names.forEach(name => {
      const el = document.getElementById(`bg-${name}`);
      if (!el) return;
      el.style.transition = 'none';
      el.style.opacity = '0';
      if (name === 'chapitre1') el.classList.remove('zoomed');
    });
  }

  /**
   * Cas spécial chapitre1 : zoom animé.
   * @returns {Promise}
   */
  showChapitre1Zoom(durationMs = 1600) {
    this.blackout();
    const el = document.getElementById('bg-chapitre1');
    if (!el) return Promise.resolve();

    // Laisser le navigateur prendre en compte les styles reset
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        el.classList.add('zoomed');
        setTimeout(resolve, durationMs + 20);
      });
    });
  }
}
