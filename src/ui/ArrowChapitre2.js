/**
 * ArrowChapitre2.js
 * -----------------------------------------------------------------------------
 * Flèches harmonisées du Chapitre 2 — toutes dérivées de ArrowBase, donc
 * strictement identiques au reste du site : cercle + chevron tracés en
 * animation SVG, hover doré (scale 1.22 + glow), et explosion dorée au clic
 * (_rippleClick de ArrowBase).
 *
 * Le chapitre 2 comporte deux familles de flèches, toutes positionnées en
 * bas-gauche et pointant vers la gauche ← (convention « retour » du projet,
 * identique à ArrowCollaboration / ArrowChapitre1) :
 *
 *   1. ArrowChp2Opening  (#arrow-chp2-opening)
 *      - Affichée sur l'openning (travelling) une fois la bougie allumée.
 *      - Clic → retour vers l'Espace collaboratif.
 *
 *   2. ArrowChp2Part     (#arrow-chp2-invibilisation | -peine | -violence)
 *      - Une instance INDÉPENDANTE par sous-partie.
 *      - Affichée quand la sous-partie est prête (événement *-ready).
 *      - Clic → retour vers l'openning (referme la sous-partie).
 *      - z-index élevé pour passer au-dessus des overlays des sous-parties
 *        (qui sont confinés dans le contexte d'empilement de #chapitre2-root).
 *
 * Une seule flèche est visible à la fois : pas de conflit de z-index réel,
 * mais on sépare les deux familles pour rester lisible et évolutif.
 */

import { ArrowBase } from './ArrowBase.js';

/* Chevron « retour » ← — identique à ArrowCollaboration / ArrowChapitre1. */
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

/* ─────────────────────────────────────────────────────────────────────────
   Flèche openning → Espace collaboratif
   z 600 : au-dessus du travelling (#chapitre2-root = 500), sous le curseur.
─────────────────────────────────────────────────────────────────────────── */
export class ArrowChp2Opening extends ArrowBase {
  constructor(config) {
    super(config, 'arrow-chp2-opening', PATH_LEFT);
  }
  _applyPosition() {
    applyBottomLeft(this.el, this.config, 600);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   Flèche sous-partie → openning
   z très élevé : les roots des sous-parties (invibilisation 1000, cartel,
   peine 9000) sont confinés DANS le contexte d'empilement de
   #chapitre2-root (z 500). Vu depuis #app, tout le chapitre 2 vaut donc 500 :
   un z >= 600 suffit, on prend 9999 pour rester sans ambiguïté.
─────────────────────────────────────────────────────────────────────────── */
export class ArrowChp2Part extends ArrowBase {
  /**
   * @param {Object} config  CONFIG global
   * @param {string} partId  identifiant de sous-partie (suffixe du domId)
   */
  constructor(config, partId) {
    super(config, `arrow-chp2-${partId}`, PATH_LEFT);
  }
  _applyPosition() {
    applyBottomLeft(this.el, this.config, 9999);
  }
}
