/**
 * ArrowCarnet.js
 *
 * Flèche de la scène Carnet de recherche (retour vers la phrénologie, d'où
 * l'on y entre par la barre de navigation).
 *
 * POSITION   : bas gauche de l'écran
 * DIRECTION  : pointe vers la gauche  ←
 * DOM ID     : #arrow-carnet
 *
 * Même dessin et même place que la flèche de l'espace collaboratif — les deux
 * scènes sont sœurs sur la carte, sous la phrénologie. Mais PAS la même
 * instance ni le même élément : ArrowBase retrouve son DOM par identifiant, et
 * deux scènes qui partageraient #arrow-collaboration se l'effaceraient l'une
 * l'autre (la sortie de l'une fait son hide() pendant que l'autre fait son
 * show()).
 */

import { ArrowBase } from './ArrowBase.js';

export class ArrowCarnet extends ArrowBase {
  constructor(config) {
    super(
      config,
      'arrow-carnet',
      'M48 35 L22 35 M33 24 L22 35 L33 46',  // ← pointe vers la gauche
      'Revenir à la phrénologie'
    );
  }

  _applyPosition(sz) {
    const vW     = Math.max(this.config.MIN_SIZE.width,  window.innerWidth);
    const vH     = Math.max(this.config.MIN_SIZE.height, window.innerHeight);
    const margin = Math.round(Math.min(vW, vH) * 0.05);

    Object.assign(this.el.style, {
      top:       '',
      right:     '',
      bottom:    margin + 'px',
      left:      margin + 'px',
      transform: 'none',
    });
  }
}
