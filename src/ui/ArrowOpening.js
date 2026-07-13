/**
 * ArrowOpening.js
 *
 * Flèche de la scène Vitrine (scène d'ouverture).
 *
 * POSITION   : bas de l'écran, centré horizontalement
 * DIRECTION  : pointe vers le bas  ↓
 * DOM ID     : #arrow-opening
 *
 * Usage dans VitrineScene :
 *   this._arrow = new ArrowOpening(window.CONFIG);
 *   this._arrow.show(() => bus.emit('navigate', { to: 'phrenologie' }));
 */

import { ArrowBase } from './ArrowBase.js';

export class ArrowOpening extends ArrowBase {
  constructor(config) {
    super(
      config,
      'arrow-opening',
      'M35 22 L35 48 M24 37 L35 48 L46 37'  // ↓ pointe vers le bas
    );
  }

  _applyPosition(sz) {
    const vW     = Math.max(this.config.MIN_SIZE.width,  window.innerWidth);
    const vH     = Math.max(this.config.MIN_SIZE.height, window.innerHeight);
    const margin = Math.round(Math.min(vW, vH) * 0.05);

    Object.assign(this.el.style, {
      top:       '',
      right:     '',
      // Bas de l'écran, centré sur l'axe X
      bottom:    margin + 'px',
      left:      '50%',
      transform: 'translateX(-50%)',
    });
  }
}
