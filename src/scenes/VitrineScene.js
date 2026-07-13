/**
 * VitrineScene.js
 * -----------------------------------------------------------------------------
 * Rôle
 * -----------------------------------------------------------------------------
 * Cette scène constitue l'entrée de l'expérience.
 * Elle orchestre une mise en place simple, lente et lisible :
 *   1. apparition du fond "vitrine" ;
 *   2. courte pause avant l'allumage ;
 *   3. croissance progressive de la torche ;
 *   4. apparition de la flèche d'ouverture ;
 *   5. activation de la navigation vers la scène suivante.
 *
 * Philosophie temporelle
 * -----------------------------------------------------------------------------
 * Tous les timings importants sont pilotés depuis CONFIG.VITRINE et, surtout,
 * les moments-clés sont exprimés en temps ABSOLU depuis le début de enter().
 * Cela évite les dérives de synchronisation lorsqu'on ajuste séparément :
 *   - la durée du fade du fond ;
 *   - la pause avant la torche ;
 *   - la durée de croissance de la torche ;
 *   - l'instant précis d'apparition de la flèche.
 *
 * Exemple :
 *   si CONFIG.VITRINE.arrow.appear_at = 5000,
 *   la flèche doit apparaître à t = 5000 ms après enter(),
 *   même si le fond ou la torche ont été ralentis ou accélérés.
 *
 * Contraintes de maintenance
 * -----------------------------------------------------------------------------
 * - Ne pas modifier l'ordre global sans vérifier la mise en scène voulue.
 * - La navigation doit rester inactive tant que l'animation de la flèche
 *   n'est pas terminée, afin d'éviter un départ prématuré.
 * - Cette classe repose sur les helpers hérités de Scene :
 *     super.enter(), super.exit(), pause(), _rawWait(), etc.
 */

import { Scene }        from '../core/Scene.js';
import { bus }          from '../core/EventBus.js';
import { ArrowOpening } from '../ui/ArrowOpening.js';

export class VitrineScene extends Scene {
  constructor(systems) {
    super('vitrine');

    /**
     * Services injectés par l'application.
     * -----------------------------------------------------------------------
     * audio : gestion des boucles sonores et fondus audio.
     * torch : système de torche / lumière interactive.
     * bgMgr : gestionnaire des fonds de scène.
     * title : composant chargé de révéler et redimensionner le titre principal.
     */
    this.audio = systems.audio;
    this.torch = systems.torch;
    this.bgMgr = systems.bgMgr;
    this.title = systems.title;

    /**
     * Flèche d'ouverture propre à la scène vitrine.
     * Le composant gère son rendu SVG, son animation et son resize.
     */
    this._arrow = new ArrowOpening(window.CONFIG);

    /**
     * Indique si le titre a déjà été révélé au moins une fois.
     * On évite ainsi de rejouer inutilement son animation si la scène est
     * revisitée plus tard dans le parcours.
     */
    this._titleShown = false;

    /**
     * Verrou de navigation.
     * Tant que ce flag vaut false, les interactions de navigation (clic flèche,
     * scroll) ne doivent produire aucun changement de scène.
     */
    this._navigationActive = false;
  }

  async enter(params = {}) {
    await super.enter(params);

    /**
     * Alias local vers la configuration de la scène.
     * Permet de raccourcir les accès et de rendre la lecture du flux plus claire.
     */
    const C = window.CONFIG.VITRINE;

    /**
     * Référence temporelle absolue du enter().
     *
     * Toute la scène se cale à partir de ce timestamp. On peut ainsi attendre
     * "jusqu'à t = X ms" au lieu d'empiler des délais relatifs, ce qui rend la
     * chorégraphie beaucoup plus robuste quand on ajuste la config.
     */
    const t0 = Date.now();

    /**
     * À chaque entrée de scène, on repart d'un état non navigable.
     * La navigation ne sera activée qu'une fois la flèche entièrement dessinée.
     */
    this._navigationActive = false;

    try {
      // ---------------------------------------------------------------------
      // 1) Préparation de la torche
      // ---------------------------------------------------------------------
      // On neutralise toute animation résiduelle potentiellement héritée d'une
      // scène précédente avant de reconfigurer la torche pour la vitrine.
      this.torch.cancelGrow();
      this.torch.cancelFade();
      this.torch.setRadius(0);
      this.torch.setTarget(C.torch.size);

      // ---------------------------------------------------------------------
      // 2) Ambiance sonore musée
      // ---------------------------------------------------------------------
      // Si la boucle musée n'a pas encore été initialisée, on la démarre.
      // Sinon, on effectue simplement un fondu vers le volume de référence afin
      // d'assurer une continuité sonore propre entre les scènes.
      if (!this.audio.tracks.musee.src) {
        await this.audio.startMuseeLoop();
      } else {
        this.audio.fadeMusee(window.CONFIG.AUDIO.musee_vol, 800);
      }

      // ---------------------------------------------------------------------
      // 3) Révélation du titre principal
      // ---------------------------------------------------------------------
      // Le titre ne doit être animé qu'une seule fois dans le parcours pour
      // conserver son impact d'ouverture. En revanche, son resize reste géré
      // ailleurs via onResize().
      if (!this._titleShown) {
        this.title.reveal();
        this._titleShown = true;
      }

      // ---------------------------------------------------------------------
      // 4) Apparition du fond de la scène
      // ---------------------------------------------------------------------
      // Le fond "vitrine" est révélé via le BackgroundManager. Cette étape est
      // attendue explicitement afin de conserver une montée visuelle posée.
      await this.bgMgr.show('vitrine', C.timing.bg_fade_in);

      // Pause volontaire entre le fond et la torche pour laisser respirer
      // l'image avant l'apparition de la lumière.
      await this.pause(C.timing.pause_before_torch);

      // ---------------------------------------------------------------------
      // 5) Démarrage de la torche
      // ---------------------------------------------------------------------
      // La torche croît progressivement jusqu'à son rayon cible. Le rayon cible
      // a déjà été défini plus haut par setTarget().
      this.torch.grow(this.torch.torchTargetRadius, C.torch.grow_duration);

      // ---------------------------------------------------------------------
      // 6) Apparition de la flèche à temps ABSOLU
      // ---------------------------------------------------------------------
      // On n'attend pas "encore X ms" à partir d'ici ; on attend jusqu'à ce que
      // le temps total écoulé depuis t0 atteigne C.arrow.appear_at.
      // Cela garantit un déclenchement stable, indépendamment des autres durées.
      await this._waitUntil(t0, C.arrow.appear_at);

      // La flèche ouvre la navigation vers la phrénologie, mais seulement une
      // fois _navigationActive passé à true.
      this._arrow.show(() => {
        if (this._navigationActive) bus.emit('navigate', { to: 'phrenologie' });
      });

      // ---------------------------------------------------------------------
      // 7) Verrouillage de la navigation jusqu'à fin du dessin SVG
      // ---------------------------------------------------------------------
      // On attend la fin de l'animation de dessin pour éviter que l'utilisateur
      // puisse quitter la scène alors que l'invitation visuelle n'est pas encore
      // complètement construite.
      await this.pause(C.arrow.draw_duration);

      // À partir d'ici, la scène est considérée comme entièrement disponible.
      this._navigationActive = true;
      bus.emit('scene:entered', { name: 'vitrine' });

    } catch {
      /**
       * Interruption volontaire.
       *
       * Les méthodes de la classe Scene peuvent interrompre proprement enter()
       * lorsqu'un exit() survient pendant une attente asynchrone.
       * Ici, on absorbe simplement cette interruption sans bruit.
       */
    }
  }

  async exit(params = {}) {
    /**
     * On coupe immédiatement toute possibilité de navigation dès le début de la
     * sortie pour éviter un double déclenchement pendant les animations d'exit.
     */
    this._navigationActive = false;

    const C = window.CONFIG.VITRINE;

    await super.exit(params);

    // -----------------------------------------------------------------------
    // Séquence de sortie visuelle
    // -----------------------------------------------------------------------
    // 1. masquer la flèche ;
    // 2. éteindre progressivement la torche ;
    // 3. masquer le fond ;
    // 4. laisser un très court noir de respiration si configuré.
    this._arrow.hide();
    await this.torch.fadeOut(C.torch.fade_out_duration);
    await this.bgMgr.hide('vitrine', 400);
    await this._rawWait(C.timing.exit_black_pause);

    bus.emit('scene:exited', { name: 'vitrine' });
  }



  onResize() {
    /**
     * La scène délègue le recalcul de dimensions à ses composants.
     *
     * - la flèche recalcule sa géométrie SVG ;
     * - le titre adapte sa taille à la nouvelle taille de viewport.
     */
    this._arrow.resize();
    this.title?.resize();
  }

  /**
   * Attend jusqu'à ce que l'instant absolu cible soit atteint.
   *
   * @param {number} t0 - Timestamp de référence, généralement capturé au début
   *                      de enter() avec Date.now().
   * @param {number} targetMs - Temps cible en millisecondes à atteindre depuis
   *                            t0. Exemple : 5000 signifie "attendre jusqu'à
   *                            t0 + 5000 ms".
   *
   * Comportement :
   * - si l'instant cible est déjà dépassé, la méthode résout immédiatement ;
   * - sinon, elle attend uniquement le temps restant ;
   * - l'attente passe par pause(), donc reste compatible avec les mécanismes
   *   d'interruption propres à la classe Scene.
   */
  async _waitUntil(t0, targetMs) {
    const remaining = targetMs - (Date.now() - t0);
    if (remaining > 0) await this.pause(remaining);
  }
}
