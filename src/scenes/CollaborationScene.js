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

  /** La flèche de cette scène — un départ l'efface et la rend inaccessible.
      Voir Scene.beginLeave(). */
  arrows() { return [this._arrow]; }

  async enter(params = {}) {
    await super.enter(params);

    /** @type {Object} Raccourci de configuration de la scène. */
    const C         = window.CONFIG.COLLABORATION;
    /** @type {number} Origine temporelle absolue de la scène. */
    const t0        = Date.now();
    /** @type {boolean} Retour depuis un chapitre (1 à 4) : les cercles
     * reparaissent plus vite, on ne refait pas attendre le visiteur. */
    const fromChap1 = params.from === 'chapitre1' || params.from === 'chapitre2'
                   || params.from === 'chapitre3' || params.from === 'chapitre4';

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
      this.torch.setCentered(false);

      // Ambiance sonore :
      // - on atténue le son musée s'il tourne déjà,
      // - on lance la boucle propre à l'espace collaboratif.
      this.audio.fadeMusee(0, 1500);
      this.audio.startCollabLoop();

      // (Le titre « Espace collaboratif » n'est plus posé ici. Cette scène
      //  devinait, pour l'entrée comme pour la sortie, ce que la scène d'à-côté
      //  affichait — et se trompait dès que la carte du parcours contournait
      //  l'espace collaboratif. Il est maintenant DÉCLARÉ dans la table LIEUX
      //  d'app.js et posé à la frontière. Voir src/ui/Title.js.)

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
      this.torch.grow(C.torch.grow_duration);

      // ───────────────────────────────────────────────────────────────────────
      // 4) Apparition de la flèche de navigation
      // ───────────────────────────────────────────────────────────────────────
      // _waitUntil() attend le temps restant pour atteindre un instant absolu
      // depuis t0. Cela rend la chronologie robuste même si les étapes
      // précédentes ont pris légèrement plus ou moins de temps.
      await this._waitUntil(t0, C.arrow.appear_at);

      // La flèche est visible, mais la navigation reste protégée par
      // _navigationActive tant que l'introduction n'est pas totalement finie.
      // Départ par leaveTo() — UN SEUL CHEMIN pour quitter une scène, celui
      // qu'emprunte aussi la carte : il ferme le verrou et efface la flèche.
      this._arrow.show(() => {
        if (this._navigationActive) this.leaveTo('phrenologie');
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
          if (action) this.leaveTo(action);
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
      this.announceEntered();

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

    // (Le titre du musée n'est plus rétabli ici : la scène qui ARRIVE déclare
    //  le sien, et la frontière l'applique.)

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
    // (La colonne de titres est redimensionnée par app.js — une fois, pour
    //  tout le site. Quatre scènes en portaient une copie, aucune tout à fait
    //  identique aux autres.)
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

  /* Les helpers temporels (addTimer, _waitUntil, _scheduleAt) vivent dans
     core/Scene.js et NULLE PART AILLEURS. Cette scène en portait la dernière
     copie mot pour mot — deux vérités possibles pour un même contrat de
     nettoyage des minuteries. Supprimée : la classe de base suffit. */
}
