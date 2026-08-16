/**
 * PhrenologieScene.js
 * -----------------------------------------------------------------------------
 * Rôle
 * -----
 * Cette scène orchestre l'écran « phrenologie » :
 *   - affichage du fond correspondant ;
 *   - mise en route de la torche ;
 *   - apparition de la flèche de navigation ;
 *   - apparition différée des boutons documents ;
 *   - apparition différée de la barre de navigation ;
 *   - activation finale des interactions utilisateur.
 *
 * Philosophie d'orchestration
 * ---------------------------
 * Tous les délais sont pilotés depuis un temps de référence unique `t0`, capturé
 * au début de `enter()`. Les apparitions sont donc exprimées en temps ABSOLU
 * depuis l'entrée dans la scène, et non en enchaînement relatif dépendant de la
 * durée effective des étapes précédentes.
 *
 * Ce choix garantit deux choses :
 *   1. un calage fin de la mise en scène dans `config.js` ;
 *   2. une maintenance plus simple, car chaque élément peut être réglé sans
 *      dérégler la chronologie générale.
 *
 * Réglages principaux côté configuration
 * --------------------------------------
 *   CONFIG.PHRENOLOGIE.arrow.appear_at   → moment d'apparition de la flèche
 *   CONFIG.PHRENOLOGIE.docs.appear_at    → moment d'apparition des boutons docs
 *   CONFIG.PHRENOLOGIE.navbar.appear_at  → moment d'apparition de la navbar
 *
 * Contrat de stabilité
 * --------------------
 * Ce fichier se limite à l'orchestration de scène. Les composants visuels réels
 * (fond, torche, flèche, boutons, navbar) restent responsables de leur propre
 * rendu, de leurs animations internes et de leur nettoyage.
 */

import { Scene }            from '../core/Scene.js';
import { bus }              from '../core/EventBus.js';
import { ArrowMenu }        from '../ui/ArrowMenu.js';
import { DocumentOverlay }  from '../ui/DocumentOverlay.js';

export class PhrenologieScene extends Scene {
  /**
   * @param {Object} systems - Dépendances injectées par l'application.
   *
   * Dépendances attendues :
   *   - audio   : gestionnaire audio global
   *   - torch   : système de torche / lumière focalisée
   *   - bgMgr   : gestionnaire des backgrounds
   *   - docBtns : composant des boutons documents
   *   - navBar  : composant de la barre de navigation
   *
   * Remarque :
   * La scène ne crée pas ces systèmes. Elle ne fait que les coordonner.
   */
  constructor(systems) {
    super('phrenologie');

    /** Gestion des ambiances et transitions sonores. */
    this.audio = systems.audio;

    /** Système de torche utilisé pour focaliser l'attention dans la scène. */
    this.torch = systems.torch;

    /** Gestionnaire responsable de l'affichage / masquage des fonds. */
    this.bgMgr = systems.bgMgr;

    /** Ensemble des boutons documents affichés dans la scène. */
    this.docBtns = systems.docBtns;

    /** Barre de navigation secondaire affichée en bas d'écran. */
    this.navBar = systems.navBar;

    /**
     * Flèche principale de navigation.
     *
     * Ici, on utilise `ArrowMenu`, orientée et positionnée selon sa propre
     * configuration interne et/ou la configuration globale.
     */
    this._arrow = new ArrowMenu(window.CONFIG);

    /**
     * Verrou central des interactions.
     *
     * Tant que ce drapeau vaut `false`, les callbacks UI peuvent exister mais ne
     * doivent produire aucune navigation. Cela évite toute action utilisateur
     * prématurée pendant les animations d'entrée.
     */
    this._navigationActive = false;

    /**
     * Affichage des documents et du texte « À Propos ».
     * Posé en z-index 7 : sous #nav-bar (8) et #doc-btns (9), donc les boutons
     * restent cliquables pendant qu'un document est ouvert, et un clic ailleurs
     * referme. L'overlay crée son DOM à la première ouverture seulement.
     *
     * On lui confie la torche : tant qu'un document est ouvert, son fond opaque
     * recouvre la scène, l'overlay met donc le rendu de la torche en pause (voir
     * TorchSystem.pause/resume) — tout le budget de frame revient à l'animation.
     */
    this._docOverlay = new DocumentOverlay(window.CONFIG, this.torch);
  }

  /**
   * Cycle d'entrée de scène.
   *
   * Séquence :
   *   1. Réinitialiser l'état d'interaction.
   *   2. Préparer la torche.
   *   3. Démarrer ou rétablir l'ambiance sonore musée.
   *   4. Afficher le fond de scène.
   *   5. Démarrer la croissance de la torche.
   *   6. Faire apparaître la flèche au temps absolu configuré.
   *   7. Programmer l'apparition des boutons documents.
   *   8. Programmer l'apparition de la navbar.
   *   9. Activer la navigation lorsque le dessin de la flèche est terminé.
   *
   * Tous les délais d'apparition sont calculés relativement à `t0`.
   *
   * @param {Object} params - Paramètres éventuels de navigation entrante.
   */

  /** La flèche de cette scène — un départ l'efface et la rend inaccessible.
      Voir Scene.beginLeave(). */
  arrows() { return [this._arrow]; }

  async enter(params = {}) {
    await super.enter(params);

    /**
     * Raccourci vers la configuration de la scène.
     * On évite ainsi de répéter `window.CONFIG.PHRENOLOGIE` partout.
     */
    const C = window.CONFIG.PHRENOLOGIE;

    /**
     * Référence temporelle absolue pour toute la chorégraphie d'entrée.
     * Toutes les apparitions pilotées par `_waitUntil()` et `_scheduleAt()`
     * s'alignent sur cet instant.
     */
    const t0 = Date.now();

    /**
     * À chaque entrée de scène, on repart d'un état non interactif.
     * Les callbacks peuvent être installés, mais restent inertes tant que ce
     * flag n'est pas rouvert en fin de séquence.
     */
    this._navigationActive = false;

    try {
      // ─────────────────────────────────────────────────────────────────────
      // 1) Préparation de la torche
      // ─────────────────────────────────────────────────────────────────────
      // On annule toute animation résiduelle venant d'une scène précédente :
      // cela évite les interférences visuelles (grow/fade encore en cours).
      this.torch.cancelGrow();
      this.torch.cancelFade();

      // MODE DE TORCHE (config : PHRENOLOGIE.torch.mode) — 'fixed' fige la
      // torche au centre et l'ouvre large ; 'follow' la laisse suivre le
      // curseur. Le mode choisit aussi la taille : les deux vont ensemble
      // (une torche fixe et intime n'éclairerait qu'un coin de la page).
      const torchFixed = C.torch.mode === 'fixed';
      this.torch.setCentered(torchFixed);

      // On repart d'une torche éteinte, puis on fixe sa taille cible avant le
      // démarrage de l'animation de croissance.
      this.torch.setRadius(0);
      this.torch.setTarget(torchFixed
        ? (C.torch.size_fixed ?? C.torch.size)
        : C.torch.size);

      // ─────────────────────────────────────────────────────────────────────
      // 2) Ambiance sonore musée
      // ─────────────────────────────────────────────────────────────────────
      // Si aucune piste musée n'est encore chargée / lancée, on démarre la
      // boucle. Sinon, on ramène simplement le volume à la valeur attendue,
      // pour assurer une continuité sonore entre les scènes.
      if (!this.audio.tracks.musee.src) {
        await this.audio.startMuseeLoop();
      } else {
        this.audio.fadeMusee(window.CONFIG.AUDIO.musee_vol, 800);
      }

      // ─────────────────────────────────────────────────────────────────────
      // 3) Apparition du fond de scène
      // ─────────────────────────────────────────────────────────────────────
      // Le fond « phrenologie » est affiché avec son fondu d'entrée, puis on
      // laisse une courte respiration avant d'allumer la torche.
      await this.bgMgr.show('phrenologie', C.timing.bg_fade_in);
      await this.pause(C.timing.pause_before_torch);

      // ─────────────────────────────────────────────────────────────────────
      // 4) Démarrage de la torche
      // ─────────────────────────────────────────────────────────────────────
      // La torche grandit jusqu'à son rayon cible. L'appel n'est pas attendu,
      // afin de laisser la scène continuer sa chorégraphie en parallèle.
      this.torch.grow(C.torch.grow_duration);

      // ─────────────────────────────────────────────────────────────────────
      // 5) Apparition de la flèche de navigation
      // ─────────────────────────────────────────────────────────────────────
      // On attend le moment ABSOLU défini dans la configuration, quel que soit
      // le temps déjà consommé par les étapes précédentes.
      await this._waitUntil(t0, C.arrow.appear_at);

      // La flèche est affichée avec un callback de navigation protégé par le
      // verrou `_navigationActive` (vérifié dans leaveTo). Si le texte
      // « À Propos » est posé à l'écran, sa fumée de sortie précède le départ.
      this._arrow.show(() => this.leaveTo('vitrine'));

      // ─────────────────────────────────────────────────────────────────────
      // 6) Apparition programmée des boutons documents
      // ─────────────────────────────────────────────────────────────────────
      // Cette apparition est planifiée en parallèle. Elle n'attend PAS la fin
      // du dessin de la flèche : les deux temporalités restent indépendantes.
      this._scheduleAt(t0, C.docs.appear_at, () => {
        if (!this.isActive) return;

        /**
         * On convertit la configuration `actions` en callbacks exécutables.
         *
         * Convention actuelle :
         *   - `null`     → aucune action
         *   - 'collab'   → navigation vers la scène collaboration
         *
         * Le garde-fou `_navigationActive` reste présent ici aussi, afin que le
         * composant puisse apparaître visuellement avant d'être réellement actif.
         */
        /**
         * Chaque `action` est une clé de CONFIG.DOCUMENTS ('doc-1'…'doc-4').
         * Rappeler la clé déjà ouverte referme (bascule) ; cliquer un autre
         * bouton remplace le contenu affiché.
         */
        const docCallbacks = C.docs.actions.map((action) => () => {
          if (!this._navigationActive || !action) return;
          this._docOverlay.open(action);
        });

        this.docBtns.show(
          docCallbacks,
          () => { if (this._navigationActive) this._docOverlay.open('about'); }
        );
      });

      // ─────────────────────────────────────────────────────────────────────
      // 7) Apparition programmée de la barre de navigation
      // ─────────────────────────────────────────────────────────────────────
      // Même logique que pour les boutons documents : on programme l'apparition
      // à un instant absolu, sans bloquer le fil principal d'entrée.
      this._scheduleAt(t0, C.navbar.appear_at, () => {
        if (!this.isActive) return;

        /**
         * Adaptation des actions déclaratives en callbacks concrets.
         * La scène reste l'unique responsable de la navigation réelle — via
         * leaveTo, qui vérifie le verrou et laisse passer la fumée de
         * l'« À Propos » avant le départ.
         */
        const navCallbacks = C.navbar.actions.map((action) => () => {
          if (action === 'collab') this.leaveTo('collaboration');
        });

        this.navBar.show(navCallbacks);
      });

      // ─────────────────────────────────────────────────────────────────────
      // 8) Activation finale de la navigation
      // ─────────────────────────────────────────────────────────────────────
      // On attend explicitement la fin du dessin de la flèche avant de rendre
      // les interactions effectives. Cela garantit que l'utilisateur n'interrompt
      // pas la mise en scène avant qu'elle soit visuellement prête.
      await this.pause(C.arrow.draw_duration);

      this._navigationActive = true;

      // Signal applicatif : la scène est complètement entrée et utilisable.
      this.announceEntered();

    } catch {
      /**
       * Cas normal en pratique : `exit()` peut interrompre `pause()` pendant que
       * l'entrée est en cours. On absorbe donc silencieusement l'interruption.
       */
    }
  }

  /**
   * Cycle de sortie de scène.
   *
   * Objectifs :
   *   - couper immédiatement la navigation utilisateur ;
   *   - laisser `Scene` nettoyer ses timers / listeners ;
   *   - masquer les composants visuels propres à la scène ;
   *   - éteindre la torche et le fond ;
   *   - émettre le signal applicatif de sortie.
   *
   * @param {Object} params - Paramètres éventuels de navigation sortante.
   */
  async exit(params = {}) {
    // Verrou immédiat : aucune interaction ne doit rester active pendant exit().
    this._navigationActive = false;

    /** Raccourci configuration pour la sortie. */
    const C = window.CONFIG.PHRENOLOGIE;

    // Laisse la classe mère effectuer son nettoyage standard.
    await super.exit(params);

    // Masquage des composants propres à la scène.
    // L'overlay est DÉTRUIT (et non simplement fermé) : son DOM, ses timers et
    // ses éventuelles incrustations ne doivent rien laisser derrière eux.
    this._docOverlay.destroy();
    this._arrow.hide();
    this.docBtns.hide();
    this.navBar.hide();

    // Extinction progressive de la torche puis retrait du fond.
    await this.torch.fadeOut(C.torch.fade_out_duration);

    // La scène défait ce qu'elle a posé : le mode 'fixed' ne doit pas fuir vers
    // la scène suivante (toutes ne recentrent pas la torche en entrant). On le
    // rend APRÈS l'extinction : à rayon nul, le retour au curseur ne se voit pas.
    this.torch.setCentered(false);
    await this.bgMgr.hide('phrenologie', 400);

    // Micro-pause dans le noir pour lisser la transition vers la scène suivante.
    await this._rawWait(C.timing.exit_black_pause);

    bus.emit('scene:exited', { name: 'phrenologie' });
  }



  /**
   * Gestion du resize viewport.
   *
   * Responsabilités : redimensionner les composants UI qui en ont besoin.
   * (La colonne de titres appartient à src/ui/Title.js et se redimensionne
   * depuis app.js, une fois pour tout le site.)
   */
  onResize() {
    this._arrow.resize();
    this.docBtns.resize();
    this.navBar.resize();
    this._docOverlay.resize();   // retrace les cadres aux nouvelles dimensions
  }

  /**
   * Navigation sortante UNIFIÉE (flèche, navbar).
   *
   * Si le texte « À Propos » est posé à l'écran, sa FUMÉE de sortie passe
   * d'abord : close() renvoie le temps qu'elle demande (0 pour tout autre
   * contenu, ou un texte encore en train de s'écrire — fondu ordinaire), et la
   * navigation part à la fin. Le verrou se referme aussitôt : un seul départ,
   * pas de double clic pendant que la fumée passe. Le timer passe par
   * `addTimer` : si la scène est quittée autrement entre-temps, `Scene.exit()`
   * l'annule.
   *
   * @param {string} to - Scène de destination (clé SceneManager).
   */
  leaveTo(to, params = {}) {
    if (!this._navigationActive) return;
    // Le verrou et l'effacement de la flèche AVANT la fumée : elle dure ~2,2 s,
    // pendant lesquelles la flèche restait cliquable. beginLeave() ferme aussi
    // _navigationActive — la garde ci-dessus suffit donc pour les clics suivants.
    if (!this.beginLeave()) return;
    const wait = this._docOverlay.close() || 0;
    if (wait > 0) {
      this.addTimer(() => bus.emit('navigate', { to, ...params }), wait);
    } else {
      bus.emit('navigate', { to, ...params });
    }
  }


  /* Les helpers temporels (addTimer, _waitUntil, _scheduleAt) vivent dans
     core/Scene.js et NULLE PART AILLEURS. Quatre scènes en portaient une copie
     mot pour mot : quatre vérités possibles pour un même contrat de nettoyage
     des minuteries. Supprimées — la classe de base suffit. */

}
