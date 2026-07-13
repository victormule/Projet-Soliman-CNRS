/**
 * CollaborationScene.js
 * -----------------------------------------------------------------------------
 * Rôle de la scène
 * -----------------------------------------------------------------------------
 * Cette scène orchestre la transition vers l'espace collaboratif.
 *
 * Responsabilités principales :
 *   1. Préparer l'environnement visuel et sonore de la scène.
 *   2. Piloter la chronologie d'apparition des éléments interactifs.
 *   3. Activer la navigation uniquement une fois l'introduction terminée.
 *   4. Gérer proprement la sortie de scène et la restauration de l'état global.
 *
 * Important :
 * - Les temps d'apparition sont exprimés en délais ABSOLUS depuis le début de
 *   enter(). Ce choix garantit une mise en scène stable, indépendante des
 *   sous-animations déjà lancées (fade, torche, SVG, etc.).
 * - Cette classe ne contient pas la logique de rendu bas niveau des composants
 *   (flèche, cercles, fond, torche) : elle coordonne uniquement leur séquence.
 */

import { Scene }              from '../core/Scene.js';
import { bus }                from '../core/EventBus.js';
import { ArrowCollaboration } from '../ui/ArrowCollaboration.js';

export class CollaborationScene extends Scene {
  /**
   * Initialise la scène "collaboration" et mémorise les systèmes partagés.
   *
   * @param {Object} systems - Dépendances injectées par l'application.
   * @param {Object} systems.audio - Gestionnaire audio global.
   * @param {Object} systems.torch - Système de torche / focus lumineux.
   * @param {Object} systems.bgMgr - Gestionnaire des fonds de scène.
   * @param {Object} systems.circles - Composant des cercles romains.
   * @param {Object} [systems.transition] - Gestionnaire optionnel des titres /
   *                                       transitions textuelles.
   */
  constructor(systems) {
    super('collaboration');

    /** @type {Object} Contrôle les boucles et fondus audio. */
    this.audio      = systems.audio;
    /** @type {Object} Gère la torche centrale et ses animations. */
    this.torch      = systems.torch;
    /** @type {Object} Gère l'affichage / masquage des backgrounds. */
    this.bgMgr      = systems.bgMgr;
    /** @type {Object} Composant interactif des cercles romains. */
    this.circles    = systems.circles;
    /** @type {?Object} Outil de transition de titre, utilisé si disponible. */
    this.transition = systems.transition ?? null;

    /**
     * Flèche de navigation spécifique à la scène Collaboration.
     * Elle est construite une fois ici puis affichée / masquée au fil du cycle
     * de vie de la scène.
     */
    this._arrow = new ArrowCollaboration(window.CONFIG);

    /**
     * Verrou de navigation.
     *
     * false :
     *   - les callbacks UI existent éventuellement déjà,
     *   - mais l'utilisateur ne doit pas encore pouvoir naviguer.
     *
     * true :
     *   - la scène a terminé son intro,
     *   - les interactions peuvent déclencher des changements de scène.
     */
    this._navigationActive = false;
  }

  /**
   * Entre dans la scène et lance toute la mise en place temporelle.
   *
   * Déroulé global :
   *   - reset de la torche,
   *   - démarrage audio,
   *   - révélation du fond,
   *   - croissance de la torche,
   *   - apparition de la flèche,
   *   - apparition des cercles,
   *   - activation finale de la navigation.
   *
   * @param {Object} [params={}]
   * @param {string} [params.from] - Nom de la scène source. Utilisé ici pour
   *                                 accélérer l'apparition des cercles lors
   *                                 d'un retour depuis chapitre1.
   */
  async enter(params = {}) {
    await super.enter(params);

    /** @type {Object} Raccourci de configuration de la scène. */
    const C         = window.CONFIG.COLLABORATION;
    /** @type {number} Origine temporelle absolue de la scène. */
    const t0        = Date.now();
    /** @type {boolean} Retour depuis un chapitre (1 ou 2) : le titre
     * « Espace collaboratif » est déjà en place, on ne le reswape pas. */
    const fromChap1 = params.from === 'chapitre1' || params.from === 'chapitre2' || params.from === 'chapitre3';

    // À chaque entrée, on verrouille les interactions jusqu'à la fin de l'intro.
    this._navigationActive = false;

    try {
      // ───────────────────────────────────────────────────────────────────────
      // 1) Préparation de l'environnement
      // ───────────────────────────────────────────────────────────────────────
      // On annule les animations résiduelles de torche pour repartir d'un état
      // parfaitement propre, quelle que soit la scène précédente.
      this.torch.cancelGrow();
      this.torch.cancelFade();
      this.torch.setRadius(0);
      this.torch.setTarget(C.torch.size);
      this.torch.uncenterTorch();

      // Ambiance sonore :
      // - on atténue le son musée s'il tourne déjà,
      // - on lance la boucle propre à l'espace collaboratif.
      this.audio.fadeMusee(0, 1500);
      this.audio.startCollabLoop();

      // Quand on arrive depuis chapitre1, le titre collaboratif est déjà en
      // place visuellement. On évite donc de le reswaper pour ne pas créer de
      // clignotement ou de micro-fondu inutile.
      if (!fromChap1) this.transition?.swapSiteTitle(true);

      // ───────────────────────────────────────────────────────────────────────
      // 2) Affichage du fond de scène
      // ───────────────────────────────────────────────────────────────────────
      // Révélation du background "collaboration".
      await this.bgMgr.show('collaboration', C.timing.bg_fade_in);

      // Petite respiration avant de lancer la torche, afin de séparer les
      // temps visuels : fond d'abord, lumière ensuite.
      await this.pause(C.timing.pause_before_torch);

      // ───────────────────────────────────────────────────────────────────────
      // 3) Démarrage de la torche
      // ───────────────────────────────────────────────────────────────────────
      // La torche grandit vers sa taille cible. Cette animation se lance en
      // parallèle du reste de la chronologie et n'a pas besoin d'être await.
      this.torch.grow(this.torch.torchTargetRadius, C.torch.grow_duration);

      // ───────────────────────────────────────────────────────────────────────
      // 4) Apparition de la flèche de navigation
      // ───────────────────────────────────────────────────────────────────────
      // _waitUntil() attend le temps restant pour atteindre un instant absolu
      // depuis t0. Cela rend la chronologie robuste même si les étapes
      // précédentes ont pris légèrement plus ou moins de temps.
      await this._waitUntil(t0, C.arrow.appear_at);

      // La flèche est visible, mais la navigation reste protégée par
      // _navigationActive tant que l'introduction n'est pas totalement finie.
      this._arrow.show(() => {
        if (this._navigationActive) bus.emit('navigate', { to: 'phrenologie' });
      });

      // ───────────────────────────────────────────────────────────────────────
      // 5) Apparition des cercles romains
      // ───────────────────────────────────────────────────────────────────────
      // Cas particulier : si l'on revient depuis chapitre1, on accélère
      // l'apparition des cercles pour fluidifier le retour utilisateur.
      const circlesTarget = fromChap1
        ? C.circles.appear_at_return
        : C.circles.appear_at;

      // On programme l'affichage des cercles à un instant absolu, sans bloquer
      // le reste du déroulé. Cela permet à la flèche de terminer sa propre
      // animation pendant que les autres éléments se préparent.
      this._scheduleAt(t0, circlesTarget, () => {
        if (!this.isActive) return;

        // Chaque cercle reçoit un callback adapté à l'entrée correspondante de
        // configuration. Les callbacks restent inoffensifs tant que la
        // navigation n'est pas activée.
        const callbacks = C.circles.actions.map((action) => () => {
          if (!this._navigationActive) return;
          if (action) bus.emit('navigate', { to: action });
        });

        this.circles.show(callbacks);
      });

      // ───────────────────────────────────────────────────────────────────────
      // 6) Activation finale de la navigation
      // ───────────────────────────────────────────────────────────────────────
      // On attend la fin du dessin de la flèche avant d'autoriser les actions
      // de navigation, pour conserver une intro lisible et maîtrisée.
      await this.pause(C.arrow.draw_duration);

      this._navigationActive = true;
      bus.emit('scene:entered', { name: 'collaboration' });

    } catch {
      // Toute interruption (ex: changement de scène pendant enter()) est
      // volontairement absorbée ici. Le cleanup structurel est géré par exit().
    }
  }

  /**
   * Quitte la scène et nettoie progressivement les éléments affichés.
   *
   * Déroulé global :
   *   - blocage de la navigation,
   *   - masquage des éléments UI,
   *   - extinction audio / torche / fond,
   *   - restauration éventuelle du titre musée,
   *   - émission de l'événement de sortie.
   *
   * @param {Object} [params={}]
   * @param {string} [params.to] - Nom de la scène cible.
   */
  async exit(params = {}) {
    // Dès le début de exit(), aucune interaction ne doit encore pouvoir
    // déclencher de navigation concurrente.
    this._navigationActive = false;

    const C       = window.CONFIG.COLLABORATION;
    /**
     * Détermine si l'on retourne vers une scène "musée".
     * Dans ce cas, on rétablit l'ambiance sonore musée et le titre principal.
     */
    const toMusee = params.to === 'vitrine' || params.to === 'phrenologie';

    await super.exit(params);

    // Masquage immédiat de l'UI interactive propre à cette scène.
    this._arrow.hide();
    this.circles.hide();

    // On coupe progressivement l'ambiance collaborative.
    this.audio.stopCollabLoop(C.audio.fade_out);

    // Si l'on revient dans le parcours musée, on remet le niveau musée cible.
    if (toMusee) this.audio.fadeMusee(window.CONFIG.AUDIO.musee_vol, 2000);

    // Sortie visuelle : d'abord la lumière, puis le fond.
    await this.torch.fadeOut(C.torch.fade_out_duration);
    await this.bgMgr.hide('collaboration', 400);

    // On restaure le titre du musée si la destination le nécessite.
    if (toMusee) this.transition?.swapSiteTitle(false);

    // Très courte pause dans le noir pour garder un cut propre entre scènes.
    await this._rawWait(C.timing.exit_black_pause);

    bus.emit('scene:exited', { name: 'collaboration' });
  }



  /**
   * Recalcule les dimensions des composants dépendants du viewport.
   *
   * Cette méthode est appelée lors d'un resize global. Elle délègue le
   * redimensionnement aux composants concernés et recalcule la taille du titre
   * affiché si nécessaire.
   */
  onResize() {
    this._arrow.resize();

    // Si les cercles sont actuellement visibles, on recalcule leur géométrie
    // immédiatement pour éviter un décalage entre layout et zone interactive.
    if (this.circles?.el?.classList.contains('visible')) {
      this._resizeCircles();
    }

    // Le titre peut contenir soit "Espace collaboratif", soit une autre
    // variation injectée par le système de transition. On ne touche donc à la
    // taille que s'il y a déjà du contenu.
    const titleEl = document.getElementById('site-title');
    if (titleEl && titleEl.innerHTML) {
      const f = window.CONFIG.FONTS?.title;
      if (f) {
        const vW = Math.max(window.CONFIG.MIN_SIZE.width, window.innerWidth);
        titleEl.style.fontSize = Math.max(
          f.size_min,
          Math.min(f.size_max, Math.round(vW * f.size_vw / 100))
        ) + 'px';
      }
    }
  }

  /**
   * Recalcule la taille et l'espacement des cercles romains en fonction du
   * viewport courant.
   *
   * Objectif : conserver une hiérarchie visuelle stable entre petits et grands
   * écrans tout en respectant les bornes de lisibilité.
   */
  _resizeCircles() {
    const C   = window.CONFIG.COLLABORATION.circles;
    const vW  = Math.max(window.CONFIG.MIN_SIZE.width,  window.innerWidth);
    const vH  = Math.max(window.CONFIG.MIN_SIZE.height, window.innerHeight);
    const sz  = Math.max(36, Math.round(vH * C.size_vh  / 100));
    const gap = Math.max(8,  Math.round(vH * (C.gap_vh ?? 3) / 100));

    const el = this.circles.el;
    el.style.gap = gap + 'px';
    el.style.top = (C.top_pct ?? 50) + '%';

    // La taille de la numérotation romaine suit la typographie déclarée en
    // config si elle existe ; sinon un ratio par défaut basé sur le diamètre
    // du cercle est appliqué.
    const fRoman = window.CONFIG.FONTS?.roman;
    const fontSize = fRoman
      ? Math.max(fRoman.size_min, Math.min(fRoman.size_max, Math.round(vW * fRoman.size_vw / 100)))
      : Math.round(sz * 0.28);

    el.querySelectorAll('.roman-btn').forEach(btn => {
      btn.style.width  = sz + 'px';
      btn.style.height = sz + 'px';

      const svg = btn.querySelector('svg');
      if (svg) {
        svg.setAttribute('width',  sz);
        svg.setAttribute('height', sz);
      }

      const num = btn.querySelector('.roman-num');
      if (num) num.setAttribute('font-size', fontSize);
    });
  }

  /**
   * Programme l'exécution d'une fonction à un instant absolu de la scène.
   *
   * Exemple : si targetMs vaut 5000, la fonction sera appelée à t0 + 5000 ms,
   * même si plusieurs opérations ont déjà consommé une partie de ce temps.
   *
   * @param {number} t0 - Timestamp de référence (début de scène).
   * @param {number} targetMs - Instant absolu visé depuis t0, en millisecondes.
   * @param {Function} fn - Fonction à exécuter.
   */
  _scheduleAt(t0, targetMs, fn) {
    const remaining = Math.max(0, targetMs - (Date.now() - t0));
    this.addTimer(fn, remaining);
  }

  /**
   * Attend jusqu'à un instant absolu donné depuis t0.
   *
   * Si l'instant est déjà dépassé, la méthode se résout immédiatement.
   * L'attente passe par pause(), donc reste compatible avec les interruptions
   * de scène gérées par la classe de base.
   *
   * @param {number} t0 - Timestamp de référence (début de scène).
   * @param {number} targetMs - Instant absolu à atteindre depuis t0.
   */
  async _waitUntil(t0, targetMs) {
    const remaining = targetMs - (Date.now() - t0);
    if (remaining > 0) await this.pause(remaining);
  }

  /**
   * Enregistre un timer nettoyable par le système de scène.
   *
   * La classe Scene maintient un tableau _timers vidé lors des sorties.
   * Cette méthode s'aligne sur ce contrat pour éviter qu'un setTimeout lancé
   * dans une scène continue à agir après un changement d'écran.
   *
   * @param {Function} fn - Fonction déclenchée à l'expiration.
   * @param {number} delayMs - Délai avant exécution, en millisecondes.
   * @returns {number} Identifiant natif du setTimeout.
   */
  addTimer(fn, delayMs) {
    const id = setTimeout(() => {
      this._timers = this._timers.filter(t => t !== id);
      fn();
    }, delayMs);
    this._timers.push(id);
    return id;
  }
}
