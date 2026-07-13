/**
 * ArrowMenu.js
 *
 * Flèche de la scène Phréno (menu/navigation principale).
 *
 * POSITION   : haut de l'écran, centré horizontalement
 * DIRECTION  : pointe vers le haut  ↑
 * DOM ID     : #arrow-menu
 *
 * ── RÉGLER LA HAUTEUR DE LA FLÈCHE ───────────────────────────────────────────
 * La marge depuis le haut vaut  min(largeurViewport, hauteurViewport) × pct.
 * Elle est proportionnelle au viewport : la flèche garde sa place relative sur
 * tous les écrans, y compris téléphone en paysage.
 *
 * Le facteur `pct` se règle dans config.js, SANS toucher à ce fichier :
 *
 *     CONFIG.PHRENOLOGIE.arrow.margin_pct
 *
 *   0.05  → position d'origine (basse)
 *   0.035 → valeur actuelle
 *   0.02  → très haute, presque collée au bord
 *   0     → collée au bord supérieur
 *
 * Exemple : sur un écran 1920×1080, min = 1080.
 *   0.05  → 54 px du haut
 *   0.035 → 38 px du haut
 *   0.02  → 22 px du haut
 *
 * Si la clé est absente, on retombe sur 0.05 : aucune régression possible.
 *
 * Usage dans PhrenologieScene :
 *   this._arrow = new ArrowMenu(window.CONFIG);
 *   this._arrow.show(() => bus.emit('navigate', { to: 'vitrine' }));
 */

import { ArrowBase } from './ArrowBase.js';

/** Marge par défaut si la configuration n'en fournit pas. */
const DEFAULT_MARGIN_PCT = 0.05;

export class ArrowMenu extends ArrowBase {
  constructor(config) {
    super(
      config,
      'arrow-menu',
      'M35 48 L35 22 M24 33 L35 22 L46 33'  // ↑ pointe vers le haut
    );
  }

  _applyPosition(sz) {
    const vW  = Math.max(this.config.MIN_SIZE.width,  window.innerWidth);
    const vH  = Math.max(this.config.MIN_SIZE.height, window.innerHeight);

    const pct = this.config.PHRENOLOGIE?.arrow?.margin_pct ?? DEFAULT_MARGIN_PCT;
    const margin = Math.round(Math.min(vW, vH) * pct);

    Object.assign(this.el.style, {
      bottom:    '',
      right:     '',
      // Haut de l'écran, centré sur l'axe X
      top:       margin + 'px',
      left:      '50%',
      transform: 'translateX(-50%)',
    });
  }
}
