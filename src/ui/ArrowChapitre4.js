/**
 * ArrowChapitre4.js
 * -----------------------------------------------------------------------------
 * Flèche de retour du Chapitre 4 — strictement identique aux cinq autres du
 * site : cercle + chevron tracés en animation SVG, hover doré (scale 1.22 +
 * glow) et explosion dorée au clic (_rippleClick).
 *
 * ⚠️ ELLE EST BLANCHE, ET C'EST VOULU — alors même que le chapitre 4 est le
 * seul écran CLAIR du site. Sa place (bas-gauche, marge min(vW,vH)×0,05) tombe
 * TOUJOURS dans la bande photographique, qui occupe la moitié gauche de
 * l'écran et dont le fond est un tissu sombre : c'est du blanc sur du noir,
 * comme partout ailleurs. Une flèche à l'encre sombre y disparaîtrait
 * complètement — essayé, invisible.
 *   Corollaire à garder en tête : si `layout.photo_width_pct` (chp4-config)
 *   descendait sous ~15 %, la flèche se retrouverait sur le papier et il
 *   faudrait alors — et seulement alors — lui donner une encre sombre.
 *
 * Position : bas-gauche, chevron ← (convention « retour » du projet, identique
 * à ArrowCollaboration / ArrowChp2Opening / ArrowChp3Opening).
 * z 600 : au-dessus du chapitre (#chapitre4-root = 500), sous le curseur.
 */

import { ArrowBase } from './ArrowBase.js';

/* Chevron « retour » ← — identique aux autres flèches de retour du site. */
const PATH_LEFT = 'M48 35 L22 35 M33 24 L22 35 L33 46';

export class ArrowChp4 extends ArrowBase {
  constructor(config) {
    super(config, 'arrow-chp4', PATH_LEFT,
          "Quitter le chapitre et revenir à l'espace collaboratif");
  }

  _applyPosition() {
    const vW     = Math.max(this.config.MIN_SIZE.width,  window.innerWidth);
    const vH     = Math.max(this.config.MIN_SIZE.height, window.innerHeight);
    const margin = Math.round(Math.min(vW, vH) * 0.05);
    Object.assign(this.el.style, {
      top:       '',
      right:     '',
      bottom:    margin + 'px',
      left:      margin + 'px',
      transform: 'none',
      zIndex:    '600',
    });
  }
}
