/**
 * CloseCross.js
 * -----------------------------------------------------------------------------
 * Croix de fermeture de média, dérivée de ArrowBase — donc STRICTEMENT
 * identique aux flèches du site : cercle + tracé animés en SVG, hover doré
 * (scale 1.22 + glow), et explosion dorée au clic (_rippleClick de ArrowBase).
 *
 * Réutilise tout le comportement de ArrowBase ; seule la géométrie (un « X »
 * au lieu d'un chevron) et la position (haut-droite, comme la croix du
 * chapitre 1 / du MediaPlayer) sont spécialisées ici.
 *
 * data-arrow="true" est posé par ArrowBase → le curseur passe en hotspot au
 * survol, exactement comme sur les flèches.
 */

import { ArrowBase } from './ArrowBase.js';

/* « X » centré dans le viewBox 0 0 70 70 d'ArrowBase (cercle r32 en 35,35).
   Longueur totale ≈ 60 pour coller au stroke-dasharray (PLEN=60) du tracé
   d'ArrowBase → l'animation de dessin se joue intégralement. */
const PATH_CROSS = 'M24.5 24.5 L45.5 45.5 M45.5 24.5 L24.5 45.5';

export class CloseCross extends ArrowBase {
  /**
   * @param {Object} config  CONFIG global
   * @param {string} [domId] identifiant DOM (défaut : 'close-cross-chp2')
   */
  constructor(config, domId = 'close-cross-chp2') {
    super(config, domId, PATH_CROSS);
  }

  /* Haut-droite, marge à 3.5% de min(vW,vH) — comme la croix du chapitre 1.
     z très élevé : au-dessus des overlays média des sous-parties (confinés
     dans le contexte d'empilement de #chapitre2-root, z500). */
  _applyPosition() {
    const vW     = Math.max(this.config.MIN_SIZE.width,  window.innerWidth);
    const vH     = Math.max(this.config.MIN_SIZE.height, window.innerHeight);
    const margin = Math.round(Math.min(vW, vH) * 0.035);
    Object.assign(this.el.style, {
      top:       margin + 'px',
      right:     margin + 'px',
      bottom:    '',
      left:      '',
      transform: 'none',
      zIndex:    '9999',
    });
  }
}
