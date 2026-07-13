/**
 * ArrowChapitre3.js
 * -----------------------------------------------------------------------------
 * Flèche de retour du Chapitre 3 — dérivée de ArrowBase, donc strictement
 * identique au reste du site : cercle + chevron tracés en animation SVG, hover
 * doré (scale 1.22 + glow) et explosion dorée au clic (_rippleClick).
 *
 *   ArrowChp3Opening (#arrow-chp3-opening)
 *     - Affichée sur le travelling du chapitre 3 (départ de la boucle), puis
 *       ré-affichée après chaque fermeture de « tableau » (reveal).
 *     - Masquée à l'ouverture d'un reveal (le pont setArrowCallbacks du module
 *       la pilote via _arrowShow / _arrowHide).
 *     - Clic → sortie cinématographique du module (leaveToCollaboration) qui
 *       fond au noir puis émet 'chp3:navigate-back' → retour Espace collaboratif.
 *
 * Position : bas-gauche, chevron ← (convention « retour » du projet, identique
 * à ArrowCollaboration / ArrowChapitre1 / ArrowChp2Opening).
 * z 600 : au-dessus du travelling (#chapitre3-root = 500), sous le curseur.
 */

import { ArrowBase } from './ArrowBase.js';

/* Chevron « retour » ← — identique aux autres flèches de retour du site. */
const PATH_LEFT = 'M48 35 L22 35 M33 24 L22 35 L33 46';

/** Position commune : bas-gauche, marge proportionnelle à min(vW, vH). */
function applyBottomLeft(el, config, zIndex) {
  const vW     = Math.max(config.MIN_SIZE.width,  window.innerWidth);
  const vH     = Math.max(config.MIN_SIZE.height, window.innerHeight);
  const margin = Math.round(Math.min(vW, vH) * 0.05);
  Object.assign(el.style, {
    top:       '',
    right:     '',
    bottom:    margin + 'px',
    left:      margin + 'px',
    transform: 'none',
    zIndex:    String(zIndex),
  });
}

export class ArrowChp3Opening extends ArrowBase {
  constructor(config) {
    super(config, 'arrow-chp3-opening', PATH_LEFT);
  }
  _applyPosition() {
    applyBottomLeft(this.el, this.config, 600);
  }
}
