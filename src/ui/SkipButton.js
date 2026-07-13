/**
 * SkipButton.js
 * -----------------------------------------------------------------------------
 * Bouton « Passer » autonome et réutilisable.
 *
 * INTENTION
 * -----------------------------------------------------------------------------
 * Le chapitre 1 embarquait sa propre implémentation du bouton « Passer »
 * (méthodes _getSkipSize / _showSkipButton / _hideSkipButton) couplée au
 * système de listeners de la classe Scene (this.on / this._cleanup).
 *
 * Pour réutiliser EXACTEMENT le même bouton dans la sortie du chapitre 2 sans
 * dupliquer la logique dans la scène ET sans modifier le flux éprouvé du
 * chapitre 1, on isole ici le comportement dans une petite classe autonome :
 *
 *  - elle pilote le conteneur global #skip-btn,
 *  - elle gère ses propres écouteurs (aucune dépendance à Scene.on),
 *  - chaque show() reconstruit entièrement le DOM interne : les anciens nœuds
 *    (et donc leurs écouteurs) sont remplacés, ce qui évite toute fuite,
 *  - destroy() garantit un état neutre en sortie de scène.
 *
 * Le rendu visuel (SVG, animation du contour puis du label, hover doré, tailles
 * proportionnelles à CONFIG.ARROW) est identique à celui du chapitre 1.
 */

export class SkipButton {
  /**
   * @param {Object} config  window.CONFIG (lecture de ARROW / MIN_SIZE).
   * @param {string} [elementId='skip-btn']  ID du conteneur global.
   */
  constructor(config, elementId = 'skip-btn') {
    this.config = config;
    this.el = document.getElementById(elementId);

    /** Callback courant — conservé pour reconstruire le bouton au resize. */
    this._onClick = null;

    /** Timer de nettoyage du DOM après le fondu de sortie. */
    this._clearTimer = null;
  }

  /**
   * Calcule les dimensions du bouton.
   * -----------------------------------------------------------------------------
   * Même logique proportionnelle que les flèches / fullscreen du site :
   * - hauteur basée sur min(vW, vH) bornée par CONFIG.ARROW,
   * - largeur = 3 × hauteur (bouton horizontal lisible).
   *
   * @returns {{W:number, H:number}}
   */
  _getSize() {
    const vW = Math.max(this.config.MIN_SIZE.width, window.innerWidth);
    const vH = Math.max(this.config.MIN_SIZE.height, window.innerHeight);
    const A = this.config.ARROW;

    const sz = Math.round(
      Math.max(A.size_min, Math.min(A.size_max, Math.min(vW, vH) * A.size_vh / 100))
    );

    return { W: sz * 3, H: sz };
  }

  /**
   * Affiche le bouton « Passer » et anime son apparition.
   * -----------------------------------------------------------------------------
   * Le DOM interne est reconstruit à chaque appel : cela simplifie la gestion
   * des dimensions, du resize et des états visuels, et garantit qu'aucun ancien
   * écouteur ne subsiste.
   *
   * @param {Function} onClick  Callback exécuté au clic.
   */
  show(onClick) {
    if (!this.el) return;

    // Un nouvel affichage annule un éventuel nettoyage différé en cours.
    if (this._clearTimer) {
      clearTimeout(this._clearTimer);
      this._clearTimer = null;
    }

    this._onClick = onClick;

    const { W, H } = this._getSize();
    const perim = 2 * (W + H);

    // Taille du texte ajustée à la hauteur du bouton, avec bornes de sécurité.
    const fs = Math.min(15, Math.max(9, Math.round(H * 0.38)));

    this.el.innerHTML = `
      <div class="skip-wrap" data-clickable="true" aria-label="Passer">
        <svg width="${W}" height="${H}">
          <rect class="skip-rect" x="1" y="1" width="${W - 2}" height="${H - 2}"
            stroke-dasharray="${perim}" stroke-dashoffset="${perim}"/>
          <text class="skip-label" x="${W / 2}" y="${H / 2}"
            font-size="${fs}" font-family="Cinzel, serif" font-weight="400"
            letter-spacing="0.18em" fill="rgba(255,255,255,0.82)"
            dominant-baseline="middle" text-anchor="middle">Passer</text>
        </svg>
      </div>`;

    const wrap  = this.el.querySelector('.skip-wrap');
    const rect  = this.el.querySelector('.skip-rect');
    const label = this.el.querySelector('.skip-label');
    if (!wrap || !rect || !label) return;

    // Dimensions pilotées en JS pour rester cohérentes avec le calcul runtime.
    wrap.style.width  = W + 'px';
    wrap.style.height = H + 'px';

    // Hover entrée : accentuation dorée.
    wrap.addEventListener('pointerenter', () => {
      wrap.classList.add('hovered');
      rect.setAttribute('stroke', 'rgba(255,230,130,0.95)');
      rect.style.filter =
        'drop-shadow(0 0 7px rgba(255,210,80,0.80)) drop-shadow(0 0 20px rgba(255,170,30,0.50))';
      label.setAttribute('fill', 'rgba(255,220,120,1)');
    });

    // Hover sortie : retour à l'état neutre.
    wrap.addEventListener('pointerleave', () => {
      wrap.classList.remove('hovered');
      rect.setAttribute('stroke', 'rgba(255,255,255,0.72)');
      rect.style.filter = '';
      label.setAttribute('fill', 'rgba(255,255,255,0.82)');
    });

    // Clic : déclenche le callback courant. Les nœuds étant recréés à chaque
    // show(), l'écouteur disparaît naturellement avec l'ancien DOM.
    wrap.addEventListener('click', (e) => {
      e.stopPropagation();
      this._onClick?.();
    });

    // Affichage du conteneur (pointer-events + opacité gérés par le CSS .visible).
    this.el.classList.add('visible');

    // Animation différée : d'abord le contour, puis le label.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      rect.classList.add('drawn');
      this._clearTimer = setTimeout(() => label.classList.add('drawn'), 850);
    }));
  }

  /**
   * Masque le bouton « Passer ».
   * -----------------------------------------------------------------------------
   * @param {boolean} immediate
   * - true  : vide immédiatement le contenu,
   * - false : laisse jouer le fondu CSS puis nettoie le DOM.
   */
  hide(immediate = false) {
    if (!this.el) return;

    this.el.classList.remove('visible');

    if (this._clearTimer) {
      clearTimeout(this._clearTimer);
      this._clearTimer = null;
    }

    const clearFn = () => {
      // On ne vide que si le bouton n'a pas été réaffiché entre-temps.
      if (!this.el.classList.contains('visible')) this.el.innerHTML = '';
    };

    if (immediate) clearFn();
    else this._clearTimer = setTimeout(clearFn, 700);
  }

  /**
   * Reconstruit le bouton avec les nouvelles dimensions s'il est visible.
   * À appeler depuis le onResize() de la scène.
   */
  resize() {
    if (this.el?.classList.contains('visible') && this._onClick) {
      this.show(this._onClick);
    }
  }

  /**
   * Réinitialisation complète : masquage immédiat + oubli du callback.
   * À appeler en sortie de scène.
   */
  destroy() {
    this._onClick = null;
    this.hide(true);
  }
}
