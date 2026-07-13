/**
 * ArrowCollaboration.js
 *
 * Flèche de la scène Collaboration (retour vers Phréno).
 *
 * POSITION   : bas gauche de l'écran
 * DIRECTION  : pointe vers la gauche  ←
 * DOM ID     : #arrow-collaboration
 *
 * Usage dans CollaborationScene :
 *   this._arrow = new ArrowCollaboration(window.CONFIG);
 *   this._arrow.show(() => bus.emit('navigate', { to: 'phrenologie' }));
 */

import { ArrowBase } from './ArrowBase.js';

export class ArrowCollaboration extends ArrowBase {
  constructor(config) {
    super(
      config,
      'arrow-collaboration',
      'M48 35 L22 35 M33 24 L22 35 L33 46'  // ← pointe vers la gauche
    );
  }

  _applyPosition(sz) {
    const vW     = Math.max(this.config.MIN_SIZE.width,  window.innerWidth);
    const vH     = Math.max(this.config.MIN_SIZE.height, window.innerHeight);
    const margin = Math.round(Math.min(vW, vH) * 0.05);

    Object.assign(this.el.style, {
      top:       '',
      right:     '',
      // Bas gauche : aligné avec le coin bas-gauche
      bottom:    margin + 'px',
      left:      margin + 'px',
      transform: 'none',
    });
  }
}
