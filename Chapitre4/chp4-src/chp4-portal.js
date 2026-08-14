/**
 * chp4-portal.js — LA CARTE, EN POP-UP DANS LE SITE
 * ─────────────────────────────────────────────────────────────────────────────
 * La bulle du bas ne porte pas un mot mais une capture d'écran : elle ouvre la
 * carte interactive du projet, dans un cadre posé sur la page — on ne quitte
 * pas le chapitre.
 *
 * LE PANNEAU S'OUVRE DEPUIS LA BULLE : son `transform-origin` est calé sur la
 * position à l'écran de la bulle cliquée, si bien qu'il en jaillit au lieu
 * d'apparaître de nulle part. C'est ce qui relie le geste à son effet.
 *
 * ⚠️ EN-TÊTE DE L'HÉBERGEUR — soliman-map.netlify.app répond aujourd'hui
 * « X-Frame-Options: SAMEORIGIN ». Tant que cet en-tête est là, le navigateur
 * REFUSE d'afficher la carte dans notre cadre, quoi que fasse ce fichier : la
 * décision est prise côté serveur, avant que notre code ne voie quoi que ce
 * soit. Le correctif (un fichier `_headers` sur le site de la carte) est écrit
 * dans chp4-config.js, section `map`. En attendant, `fallback_after` fait
 * paraître sous le cadre une porte de sortie — « ouvrir dans un nouvel onglet ».
 * Aucune détection automatique n'est tentée : un cadre bloqué charge une page
 * d'erreur du navigateur, qui déclenche `load` comme une page normale et reste
 * illisible depuis notre origine. Prétendre le détecter serait mentir.
 */

import { Motion, EASE } from './chp4-draw.js';

export class MapPortal {
  /**
   * @param {Object} cfg  chp4-config → map
   * @param {HTMLElement} host  conteneur du chapitre (#chapitre4-root)
   */
  constructor(cfg, host) {
    this.cfg    = cfg;
    this.host   = host;
    this.el     = null;
    this.motion = null;
    this._abort = null;
    this._onClosed = null;
  }

  get isOpen() { return !!this.el; }

  /**
   * @param {DOMRect} [fromRect]  rectangle écran de la bulle cliquée — sert de
   *                              point de fuite à l'ouverture.
   * @param {Function} [onClosed] rappelé quand le panneau a fini de se refermer
   *                              (la bulle reprend alors son état de repos).
   */
  open(fromRect, onClosed) {
    if (this.el) return;
    this._onClosed = onClosed ?? null;
    this.motion = new Motion();
    this._abort = new AbortController();
    const { signal } = this._abort;
    const C = this.cfg;

    const root = document.createElement('div');
    root.id = 'chp4-portal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', C.title);
    root.innerHTML = /* html */`
      <div class="chp4-portal-scrim"></div>
      <div class="chp4-portal-panel" style="width:${C.width_pct}vw;height:${C.height_pct}vh;">
        <div class="chp4-portal-bar">
          <span class="chp4-portal-title">${C.title}</span>
          <button class="chp4-portal-close" type="button"
                  data-clickable="1" aria-label="Fermer la carte">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.5 6.2 L17.4 17.6 M17.6 6.4 L6.3 17.5"/>
            </svg>
          </button>
        </div>
        <div class="chp4-portal-frame">
          <iframe title="${C.title}" src="${C.url}"
                  referrerpolicy="no-referrer-when-downgrade"
                  allow="fullscreen"></iframe>
        </div>
      </div>
      <div class="chp4-portal-escape" aria-live="polite"></div>
    `;
    this.host.appendChild(root);
    this.el = root;

    const panel = root.querySelector('.chp4-portal-panel');

    /* Point de fuite : le centre de la bulle, ramené en pourcentage du panneau
       (transform-origin n'accepte pas de coordonnées écran). */
    if (fromRect) {
      const p = panel.getBoundingClientRect();
      const ox = ((fromRect.left + fromRect.width  / 2 - p.left) / p.width)  * 100;
      const oy = ((fromRect.top  + fromRect.height / 2 - p.top)  / p.height) * 100;
      panel.style.transformOrigin =
        `${Math.max(-40, Math.min(140, ox))}% ${Math.max(-40, Math.min(140, oy))}%`;
    }

    this.motion.animate(root.querySelector('.chp4-portal-scrim'),
      [{ opacity: 0 }, { opacity: 1 }], { duration: C.open_duration, easing: EASE.soft });
    this.motion.animate(panel, [
      { opacity: 0, transform: 'scale(0.42)' },
      { opacity: 1, transform: 'scale(1)' },
    ], { duration: C.open_duration, easing: EASE.out });

    /* Porte de sortie, sous le panneau — voir l'avertissement en tête de
       fichier. `fallback_after: 0` la supprime. */
    if (C.fallback_after > 0) {
      this.motion.after(C.fallback_after, () => {
        const slot = root.querySelector('.chp4-portal-escape');
        if (!slot) return;
        slot.innerHTML =
          `<span>La carte ne s'affiche pas&nbsp;?</span>` +
          `<a href="${C.url}" target="_blank" rel="noopener noreferrer" data-clickable="1">` +
          `Ouvrir dans un nouvel onglet ↗</a>`;
        this.motion.animate(slot, [{ opacity: 0 }, { opacity: 1 }],
          { duration: 600, easing: EASE.soft });
      });
    }

    root.querySelector('.chp4-portal-close')
        .addEventListener('click', () => this.close(), { signal });

    // Clic sur le voile (jamais sur le panneau) → fermeture.
    root.querySelector('.chp4-portal-scrim')
        .addEventListener('click', () => this.close(), { signal });

    // Échap. En capture : la touche ne doit pas atteindre le chapitre (qui,
    // lui, la lit comme « arrêter l'écoute en cours »).
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
    }, { signal, capture: true });
  }

  close() {
    if (!this.el) return;
    const root  = this.el;
    const panel = root.querySelector('.chp4-portal-panel');
    const C     = this.cfg;

    // Détaché tout de suite : plus aucun clic, plus aucune touche pendant la
    // fermeture (sinon un double-clic rappelle close() sur un DOM en sursis).
    this.el = null;
    this._abort?.abort();
    this._abort = null;
    const done = this._onClosed;
    this._onClosed = null;

    const motion = this.motion;
    motion.animate(root.querySelector('.chp4-portal-scrim'),
      [{ opacity: 1 }, { opacity: 0 }], { duration: C.close_duration, easing: EASE.soft });
    motion.animate(panel, [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.5)' },
    ], { duration: C.close_duration, easing: EASE.soft });

    motion.after(C.close_duration + 40, () => {
      root.remove();
      motion.stop();
      done?.();
    });
    this.motion = null;
    // Le Motion local survit juste le temps du fondu : il se suicide ci-dessus.
    // `destroy()` couvre le cas où le chapitre est quitté entre-temps.
    this._dying = motion;
  }

  /** Démontage sec (sortie du chapitre en pleine consultation). */
  destroy() {
    this._abort?.abort();
    this._abort = null;
    this._onClosed = null;
    this.motion?.stop();
    this._dying?.stop();
    this.motion = null;
    this._dying = null;
    this.el?.remove();
    this.el = null;
  }
}
