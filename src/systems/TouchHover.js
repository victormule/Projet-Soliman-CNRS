/**
 * TouchHover.js
 * -----------------------------------------------------------------------------
 * Sur écran tactile, le survol au glissé du doigt ne fonctionne pas nativement :
 * dès que le doigt touche l'écran, le navigateur applique un « implicit pointer
 * capture » — tous les pointermove suivants sont routés vers l'élément touché au
 * départ, et les pointerenter/pointerleave des AUTRES éléments ne se déclenchent
 * jamais. Résultat : glisser le doigt sur un bouton n'active pas son survol.
 *
 * Ce module rétablit le comportement attendu : à chaque déplacement du doigt, il
 * lit l'élément réellement SOUS le doigt (document.elementFromPoint) et émet des
 * pointerenter / pointerleave synthétiques sur les cibles à survol. Les
 * composants n'ont rien à changer : ils reçoivent enter/leave comme avec une
 * souris.
 *
 * Cible : appareils tactiles uniquement (sur souris, enter/leave marchent déjà).
 *
 * Intégration (une ligne dans app.js, après création des éléments UI) :
 *   import { TouchHover } from './systems/TouchHover.js';
 *   TouchHover.init();
 */

/* Sélecteur des éléments porteurs d'un effet de survol dans tout le site. */
const HOVER_SELECTOR = [
  '.doc-btn',
  '.nav-btn-zone',
  '.roman-btn',
  '[data-arrow]',
  '#fs-btn',
  '.skip-wrap',
  '.hotspot-zone',
].join(',');

export const TouchHover = {
  _current: null,
  _started: false,

  init() {
    if (this._started) return;
    this._started = true;

    const isTouch = window.matchMedia?.('(pointer: coarse)').matches
                 || 'ontouchstart' in window;
    if (!isTouch) return;                    // souris : enter/leave natifs suffisent

    const onMove = e => this._update(e.clientX, e.clientY);
    // pointerdown : le premier contact doit déjà activer le survol sous le doigt.
    document.addEventListener('pointerdown', onMove, { passive: true });
    document.addEventListener('pointermove', onMove, { passive: true });
    // Fin de contact : on retire le survol courant.
    const onUp = () => this._leaveCurrent();
    document.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('pointercancel', onUp, { passive: true });
  },

  _update(x, y) {
    // Élément réellement sous le doigt, puis sa cible « à survol » la plus proche.
    const raw = document.elementFromPoint(x, y);
    const target = raw ? raw.closest(HOVER_SELECTOR) : null;

    if (target === this._current) return;    // pas de changement → rien à faire

    // Quitte l'ancienne cible.
    this._leaveCurrent();

    // Entre sur la nouvelle.
    if (target) {
      this._current = target;
      this._dispatch(target, 'pointerenter', x, y);
    }
  },

  _leaveCurrent() {
    if (this._current) {
      this._dispatch(this._current, 'pointerleave');
      this._current = null;
    }
  },

  /** Émet un PointerEvent synthétique (type enter/leave) sur el. */
  _dispatch(el, type, x = 0, y = 0) {
    // pointerenter/leave ne « bouillonnent » pas : on cible directement el.
    const ev = new PointerEvent(type, {
      bubbles: false,
      cancelable: false,
      clientX: x,
      clientY: y,
      pointerType: 'touch',
    });
    el.dispatchEvent(ev);
  },
};
