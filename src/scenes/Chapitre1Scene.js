import { Scene }               from '../core/Scene.js';
import { bus }                 from '../core/EventBus.js';
import { runSkippableQuoteSequence } from '../sequences/QuoteSequence.js';
import { ArrowCollaboration }  from '../ui/ArrowCollaboration.js';
import { Chapter1LightSystem } from '../systems/Chapter1LightSystem.js';

/**
 * Scène "Chapitre 1"
 * -----------------------------------------------------------------------------
 * Cette scène est la plus riche du parcours :
 *
 * 1. Elle démarre sur une introduction cinématique :
 *    - fond préparé derrière un voile noir,
 *    - ouverture du voile,
 *    - montée progressive de la lumière,
 *    - lecture d'un son d'introduction.
 *
 * 2. Elle bascule ensuite vers une phase interactive :
 *    - apparition d'une image de base,
 *    - activation de hotspots,
 *    - affichage d'un titre de survol,
 *    - possibilité d'ouvrir des médias,
 *    - navigation via une flèche dédiée.
 *
 * 3. Elle se termine par une séquence de sortie scénarisée :
 *    - affichage d'une citation typée,
 *    - possibilité de skipper,
 *    - extinction progressive,
 *    - navigation vers l'espace collaboration.
 *
 * IMPORTANT
 * -----------------------------------------------------------------------------
 * - Cette classe orchestre fortement le DOM, l'audio et la lumière.
 * - La moindre modification sur l'ordre des appels peut produire des régressions
 *   de timing, d'état visuel ou de navigation.
 * - L'objectif ici est donc de documenter clairement les responsabilités
 *   de chaque méthode, sans altérer le comportement existant.
 */
export class Chapitre1Scene extends Scene {
  /**
   * @param {Object} systems
   * @param {Object} systems.audio       Gestionnaire audio global
   * @param {Object} systems.bgMgr       Gestionnaire des fonds / background layers
   * @param {Object} systems.transition  Gestionnaire des transitions (voile, quote, etc.)
   * @param {Object} systems.player      Lecteur média (audio / vidéo)
   * @param {Object} systems.torch       Système de torche global
   */
  constructor(systems) {
    super('chapitre1');

    // Références systèmes globaux
    this.audio      = systems.audio;
    this.bgMgr      = systems.bgMgr;
    this.transition = systems.transition;
    this.player     = systems.player;
    this.torch      = systems.torch;

    // Composants spécifiques à cette scène
    // - flèche de navigation propre au chapitre 2
    // - système de lumière dédié (indépendant de la torche globale)
    this._arrow = new ArrowCollaboration(window.CONFIG);
    this._light = new Chapter1LightSystem(window.CONFIG, 'app');

    // Références DOM utilisées très fréquemment dans la scène
    this._skipBtn      = document.getElementById('skip-btn');
    this._subtitle     = document.getElementById('chapitre-subtitle');
    this._hotspotLayer = document.getElementById('hotspot-layer');
    this._hoverTitleEl = document.getElementById('hover-title');
    this._bgChap1      = document.getElementById('bg-chapitre1');
    this._overlayTorch = document.getElementById('overlay-canvas');

    // Éléments DOM créés dynamiquement
    this._introOverlay = null;
    this._baseLayer = null;

    // États liés aux hotspots / hover
    this._activeHotspot = null;
    this._hotspotLeaveTimer = null;
    this._playerHoverTitle = null;
    this._hoverTitleCurrent = null;
    this._hoverTitleLeaveTimer = null;

    // Drapeaux d'état de scène
    // ----------------------------------------------------------------------------
    // _interactiveReady     : les hotspots et la navigation sont réellement actifs
    // _isInteractive        : la scène est passée dans son mode interactif
    // _isTransitioningOut   : la scène est en train de sortir, on bloque les actions
    // _phase                : phase textuelle utile pour resize / debugging
    this._interactiveReady = false;
    this._isInteractive = false;
    this._isTransitioningOut = false;
    this._phase = 'idle';
  }

  /**
   * Entrée dans la scène.
   * -----------------------------------------------------------------------------
   * Séquence globale :
   *
   * 1. Reset complet de l'état visuel et logique.
   * 2. Préparation du background de chapitre 2 derrière un voile opaque.
   * 3. Ouverture cinématique du voile.
   * 4. Démarrage de la lumière intro.
   * 5. Lecture du son d'introduction.
   * 6. Soit :
   *    - passage automatique à l'interactif à la fin du son,
   *    - soit apparition d'un bouton "Passer" permettant de forcer ce passage.
   *
   * Toute interruption (sortie de scène, navigation forcée, etc.) est absorbée
   * par le bloc try/catch pour éviter de casser la promesse d'entrée.
   */
  async enter(params = {}) {
    await super.enter(params);

    // Remise à zéro interne
    this._resetState();

    // Synchronisation avec le player :
    // si le média est fermé, on restaure certains états visuels (lumière, flèche, etc.)
    this._installPlayerCloseSync();

    // La torche globale ne doit pas interférer visuellement avec la lumière spécifique
    // de ce chapitre. On la masque donc dès l'entrée.
    this._hideGlobalTorch();

    // Nettoyage défensif d'une éventuelle UI interactive résiduelle
    this._cleanupInteractiveUI({ stopAudio: true, clearPlayer: true });

    // On s'assure qu'aucune citation n'est encore visible
    this.transition.hideQuote(0);

    // Le bouton skip n'a rien à faire à l'écran au démarrage
    this._hideSkipButton(true);

    // Le sous-titre est caché par défaut, il sera réaffiché au bon moment
    this._hideSubtitle(true);

    // La flèche interactive ne doit pas apparaître en intro
    this._arrow.hide();

    // Classe body utilisée pour activer certaines couches / comportements CSS
    document.body.classList.remove('page3');

    // ─────────────────────────────────────────────────────────────────────────────
    // Préparer l'image DERRIÈRE le voile noir
    // ----------------------------------------------------------------------------
    // Principe :
    // - on n'appelle pas de blackout ici avant l'ouverture du voile ;
    // - on prépare le fond complet pendant que le voile est opaque ;
    // - quand le voile s'ouvre, l'image est déjà prête, ce qui évite les flashes.
    if (this._bgChap1) {
      this._bgChap1.style.transition = 'none';
      this._bgChap1.style.transform = 'scale(1)';
      this._bgChap1.style.filter = '';
      this._bgChap1.style.backgroundImage = 'url("Chapitre1/chp1-images/chapitre1.webp")';
      this._bgChap1.style.backgroundSize = 'cover';
      this._bgChap1.style.backgroundPosition = 'center center';
      this._bgChap1.style.backgroundRepeat = 'no-repeat';
      this._bgChap1.style.backgroundColor = '#000';
      this._bgChap1.style.opacity = '1';
    }

    // Voile totalement opaque au départ : rien ne doit être visible derrière
    await this.transition.fadeVeil(1, 0);

    try {
      this._phase = 'intro';

      // Préchargement explicite de l'image d'intro tant que le voile est fermé.
      // Même si elle est probablement en cache, cela sécurise la transition.
      await this._preloadImage('Chapitre1/chp1-images/chapitre1.webp');

      // Prépare le sous-titre visuellement.
      // Il devient "visible", mais reste masqué au regard tant que le voile couvre la scène.
      this._showSubtitle();

      // Affiche la lumière dédiée au chapitre 2, mais totalement éteinte au départ.
      this._light.show();
      this._light.setFraction(0, 0);

      // Ouvre le voile : la scène se révèle proprement sur fond noir.
      await this.transition.fadeVeil(0, 1400);

      // La lumière s'allume progressivement après l'ouverture.
      this._light.animateToFraction(this._getIntroLightFrac(), this._getLightIntroDuration(), 1);

      // Petit délai avant le lancement du son d'introduction.
      await this.pause(window.CONFIG.CHAPITRE1.timing?.phren_sound_delay ?? 1800);

      // Lance le son d'introduction spécifique du chapitre.
      const src = await this.audio.playPhrenoSound();

      // Si aucun son n'a pu être joué, on passe directement à l'interactif.
      if (!src) {
        await this._startInteractivePhase(false);
        return;
      }

      // VERY IMPORTANT :
      // On attache l'écouteur de fin immédiatement, avant tout autre délai,
      // afin de ne jamais rater l'événement "ended".
      src.addEventListener('ended', () => {
        if (!this.isActive || this._isInteractive || this._isTransitioningOut) return;
        this._startInteractivePhase(false);
      }, { once: true });

      // Signal d'entrée de scène pour le reste de l'application
      bus.emit('scene:entered', { name: 'chapitre1' });

      // Délai configurable avant d'autoriser le skip pendant le son
      const skipIntroDelay = window.CONFIG.CHAPITRE1.timing?.skip_intro_delay ?? 0;
      if (skipIntroDelay > 0) await this.pause(skipIntroDelay);

      // Si le son s'est terminé entre temps ou si la scène a changé d'état,
      // on ne montre pas le bouton de skip.
      if (!this.isActive || this._isInteractive || this._isTransitioningOut) return;

      // Le bouton "Passer" force la transition vers la phase interactive.
      this._showSkipButton(() => {
        if (!this.isActive || this._isInteractive || this._isTransitioningOut) return;
        this._startInteractivePhase(true);
      });
    } catch {
      // Interruption silencieuse volontaire :
      // typiquement quand exit() invalide les timers / pauses en cours.
    }
  }

  /**
   * Lance la phase interactive.
   * -----------------------------------------------------------------------------
   * @param {boolean} fromSkip
   * - true  : la transition a été déclenchée par le bouton "Passer"
   * - false : la transition s'est faite naturellement à la fin du son
   *
   * Rôle :
   * - bascule l'état interne,
   * - termine proprement l'audio d'intro,
   * - réalise la transition visuelle intro -> base interactive,
   * - active ensuite la flèche, les hotspots, la classe body et l'ambiance audio.
   */
  async _startInteractivePhase(fromSkip) {
    if (!this.isActive || this._isInteractive || this._isTransitioningOut) return;

    this._isInteractive = true;
    this._interactiveReady = false;
    this._phase = 'transition-to-interactive';

    // Gestion audio :
    // - on coupe le son phrénologique,
    // - on réduit le fond musée, plus ou moins vite selon l'origine du basculement.
    if (fromSkip) {
      this.audio.stopPhrenoSound();
      this.audio.fadeMusee(0, 260);
    } else {
      this.audio.stopPhrenoSound();
      this.audio.fadeMusee(0, 700);
    }

    // Le bouton skip n'a plus de raison d'être après bascule
    this._hideSkipButton();

    // Transition visuelle de l'image intro vers l'image interactive
    await this._transitionIntroToBase();

    if (!this.isActive || this._isTransitioningOut) return;

    this._phase = 'interactive';

    // Le sous-titre reste visible pendant la phase interactive
    this._showSubtitle();

    // Affichage différé de la flèche de sortie
    this.addTimer(() => {
      if (!this.isActive || this._isTransitioningOut) return;
      this._arrow.show(() => {
        if (!this.isActive || this._isTransitioningOut || !this._interactiveReady) return;
        this.transitionOutWithQuote();
      });
    }, 420);

    // Construction différée des hotspots et activation de la couche interactive
    this.addTimer(() => {
      if (!this.isActive || this._isTransitioningOut) return;
      document.body.classList.add('page3');
      this._buildHotspots();
      this._interactiveReady = true;
    }, 760);

    // Démarrage de la boucle sonore d'ambiance
    this.addTimer(() => {
      if (!this.isActive || this._isTransitioningOut) return;
      this.audio.startSanzaLoop();
    }, 180);
  }

  /**
   * Déclenche la sortie de scène avec citation.
   * -----------------------------------------------------------------------------
   * Cette méthode orchestre une outro cinématique relativement complexe :
   *
   * 1. Verrouillage de l'interactivité.
   * 2. Fermeture du player si besoin.
   * 3. Nettoyage des hotspots / UI interactive.
   * 4. Remontée du voile noir.
   * 5. Coupure / mute des ambiances.
   * 6. Lancement d'un silence de fond.
   * 7. Typing de la citation avec possibilité de "Passer".
   * 8. Sortie visuelle commune (naturelle ou skip).
   * 9. Navigation vers "collaboration".
   */
  async transitionOutWithQuote() {
    if (!this.isActive || this._isTransitioningOut) return;

    this._isTransitioningOut = true;
    this._interactiveReady = false;
    this._phase = 'outro';

    // Texte affiché pendant l'outro
    const QUOTE_TEXT = `"\nCe qui a été le plus difficile à comprendre ou à aborder ?\n\nCe qui m'a le plus dérangé, c'est l'ambiguïté de son geste. Est-ce qu'il est un assassin ? un résistant ? un fanatique ? un héros ? ce n'est pas facile de trancher. On se rend vite compte que ça dépend du point de vue.\n\nEt comme il n'a pas laissé de traces écrites personnelles, on doit lire entre les lignes des récits officiels. C'est frustrant de ne pas vraiment savoir qui il était, ce qu'il pensait, ce qu'il ressentait. Mais c'est aussi ce qui rend cette recherche passionnante."  E. , lycéenne`;

    // Si le player est ouvert, on force sa fermeture avant la sortie
    if (this.player?.active) this.player._forceClose();

    // La flèche doit disparaître immédiatement
    this._arrow.hide();

    // Le bouton skip courant (s'il existe) est supprimé
    this._hideSkipButton(true);

    // Nettoyage des éléments interactifs.
    // Le sous-titre reste volontairement visible à ce stade.
    this._cleanupInteractiveUI({ stopAudio: true, clearPlayer: false });
    document.body.classList.remove('page3');

    // Le voile remonte : le sous-titre reste visible car son z-index est supérieur
    await this.transition.fadeVeil(1, 1100);

    // Sécurisation audio globale
    this.audio.stopPhrenoSound();
    this.audio.stopSanzaLoop(280);
    this.audio.hardMuseeMute();

    // On met le fond en noir total
    this.bgMgr.blackout();

    // Lance un silence de fond en boucle pendant toute la lecture / typing
  

    /**
     * Séquence de sortie finale commune.
     * ---------------------------------------------------------------------------
     * Elle est identique que la citation aille à son terme ou qu'elle soit skippée.
     * On évite ainsi les divergences d'état difficiles à déboguer.
     */
    const doExit = async () => {
      // 1) Extinction douce du sous-titre
      this._hideSubtitle(false);

      // 2) Fondu du texte de quote
      const quoteEl = document.getElementById('chapter-quote');
      if (quoteEl) {
        // On stoppe toute animation de typing sans vider immédiatement le DOM :
        // le contenu doit rester affiché le temps du fondu.
        this.transition.quoteTypingToken++;
        quoteEl.style.transition = 'opacity 1400ms cubic-bezier(0.55,0,0.45,1)';
        quoteEl.style.opacity = '0';

        await this._rawWait(1450);

        // Nettoyage DOM / styles
        quoteEl.style.transition = '';
        quoteEl.style.opacity = '';
        quoteEl.classList.remove('visible');
        quoteEl.innerHTML = '';
      }

      // 3) Extinction de la lumière dédiée
      await this._light.animateToFraction(0, 600, 0);
      this._light.hide(true);

      // 4) Court silence dans le noir complet
      await this._rawWait(400);

      // 5) Sortie audio + ouverture vers la scène suivante
      await this.transition.fadeVeil(0, 280);
      bus.emit('navigate', { to: 'collaboration', from: 'chapitre1' });
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // Typing de la citation
    // ----------------------------------------------------------------------------
    // ── Typing externalisé ────────────────────────────────────────
    // Le sous-titre reste visible au-dessus du voile et du fond noir.
    // La mécanique "typing + skip + fin naturelle" est maintenant déléguée
    // à un module indépendant pour alléger la scène.
    await runSkippableQuoteSequence({
      transition: this.transition,
      text: QUOTE_TEXT,
      charDelay: 54,
      skipDelay: window.CONFIG.CHAPITRE1.timing?.skip_btn_delay ?? 2000,
      afterTypingDelay: 2800,
      showSkipButton: (onClick) => this._showSkipButton(onClick),
      hideSkipButton: (immediate = false) => this._hideSkipButton(immediate),
      wait: (ms) => this._rawWait(ms),

      // La séquence ne doit continuer que tant que :
      // - la scène est encore active,
      // - on est toujours dans la phase de sortie.
      isStillValid: () => this.isActive && this._isTransitioningOut,
    });

    // Dans tous les cas (fin naturelle ou skip), on enchaîne
    // sur la même sortie cinématique.
    await doExit();
  }

  /**
   * Sortie de scène.
   * -----------------------------------------------------------------------------
   * Remet tous les états à zéro pour garantir une prochaine entrée propre.
   */
  async exit(params = {}) {
    this._interactiveReady = false;
    this._isInteractive = false;
    this._isTransitioningOut = false;
    this._phase = 'idle';

    if (this.player?.active) this.player._forceClose();

    this._cleanupInteractiveUI({ stopAudio: true, clearPlayer: true });
    this._arrow.hide();
    this._hideSkipButton(true);
    this._hideSubtitle(true);
    this._removeIntroOverlay(true);
    this._removeBaseLayer();
    this._light.hide(true);
    document.body.classList.remove('page3');

    await super.exit(params);

    // Nettoyage final des couches de transition / fond
    this.transition.hideQuote(0);
    await this.transition.fadeVeil(0, 0);
    this.bgMgr.blackout();
    this._showGlobalTorch();

    bus.emit('scene:exited', { name: 'chapitre1' });
  }

  /**
   * Gestion du resize global.
   * -----------------------------------------------------------------------------
   * Rôle :
   * - redimensionner les composants dynamiques,
   * - recaler la lumière selon la phase courante,
   * - reconstruire le bouton skip si nécessaire,
   * - recalculer les tailles typographiques.
   */
  onResize() {
    this._arrow.resize();
    this._light.resize();
    this._syncIntroOverlayRect();

    if (this._phase === 'intro') {
      this._light.setFraction(this._getIntroLightFrac(), this._light.opacity || 1);
    } else if (this._phase === 'interactive' || this._phase === 'transition-to-interactive') {
      this._light.setFraction(this._getInteractiveLightFrac(), this._light.opacity || 1);
    }

    // Si le bouton Skip est actuellement visible, on le reconstruit
    // avec les nouvelles dimensions calculées.
    if (this._skipBtn?.classList.contains('visible')) {
      const currentOnClick = this._skipBtn._currentOnClick;
      if (currentOnClick) this._showSkipButton(currentOnClick);
    }

    this._resizeTitleFonts();
  }

  /**
   * Recalcule la taille du titre principal et du sous-titre.
   * -----------------------------------------------------------------------------
   * Utilise les paramètres typographiques centralisés dans CONFIG.FONTS.
   */
  _resizeTitleFonts() {
    // Titre principal du site
    const titleEl = document.getElementById('site-title');
    if (titleEl) {
      const f = window.CONFIG.FONTS?.title;
      if (f) {
        const vW = Math.max(window.CONFIG.MIN_SIZE.width, window.innerWidth);
        const sz = Math.max(f.size_min, Math.min(f.size_max, Math.round(vW * f.size_vw / 100)));
        titleEl.style.fontSize = sz + 'px';
      }
    }

    // Sous-titre du chapitre, seulement s'il est actuellement visible
    if (this._subtitle?.classList.contains('visible')) {
      const f = window.CONFIG.FONTS?.subtitle;
      const vW = Math.max(window.CONFIG.MIN_SIZE.width, window.innerWidth);
      if (f && this._subtitle) {
        const sz = Math.max(f.size_min, Math.min(f.size_max, Math.round(vW * f.size_vw / 100)));
        this._subtitle.style.fontSize = sz + 'px';
      }
    }
  }

  /**
   * Enregistre un timer dans la liste interne de la scène.
   * -----------------------------------------------------------------------------
   * Cela permet à la classe Scene de nettoyer proprement les timeouts à la sortie.
   *
   * @param {Function} fn
   * @param {number} delayMs
   * @returns {number} id du setTimeout
   */
  addTimer(fn, delayMs) {
    const id = setTimeout(() => {
      this._timers = this._timers.filter(t => t !== id);
      fn();
    }, delayMs);
    this._timers.push(id);
    return id;
  }

  /**
   * Masque la torche globale.
   * -----------------------------------------------------------------------------
   * Pendant le chapitre 2, on s'appuie sur Chapter1LightSystem.
   * La torche standard doit donc être complètement neutralisée.
   */
  _hideGlobalTorch() {
    if (!this._overlayTorch) return;
    this.torch?.cancelGrow?.();
    this.torch?.cancelFade?.();
    this.torch?.setRadius?.(0);
    this._overlayTorch.style.opacity = '0';
    this._overlayTorch.style.display = 'none';
  }

  /**
   * Réaffiche la torche globale.
   * -----------------------------------------------------------------------------
   * Utilisé en sortie de scène pour rendre la main aux autres scènes.
   */
  _showGlobalTorch() {
    if (!this._overlayTorch) return;
    this._overlayTorch.style.display = 'block';
    this._overlayTorch.style.opacity = '1';
  }

  /**
   * Réinitialise les états internes de la scène.
   * -----------------------------------------------------------------------------
   * Méthode défensive appelée au début de enter().
   */
  _resetState() {
    this._activeHotspot = null;
    this._hotspotLeaveTimer = null;
    this._playerHoverTitle = null;
    this._hoverTitleCurrent = null;
    this._hoverTitleLeaveTimer = null;
    this._interactiveReady = false;
    this._isInteractive = false;
    this._isTransitioningOut = false;
    this._phase = 'idle';
  }

  /**
   * Synchronise la scène avec la fermeture du media player.
   * -----------------------------------------------------------------------------
   * Quand un média est refermé, il faut :
   * - restaurer la lumière de la scène,
   * - restaurer la flèche si l'interactif est disponible,
   * - recalculer l'état du hover title,
   * - notifier le bus global.
   */
  _installPlayerCloseSync() {
    if (!this.player) return;

    this.player.setOnClose(() => {
      // Le titre de hover n'est plus "forcé" par le player
      this._playerHoverTitle = null;

      // Si aucune zone n'est encore survolée, on efface la référence du titre courant
      const stillOnZone = document.querySelector('.hotspot-zone:hover');
      if (!stillOnZone) this._hoverTitleCurrent = null;

      // Restauration de la lumière normale du chapitre 2
      if (this.isActive && !this._isTransitioningOut) {
        this._light.animateToFraction(
          this._getInteractiveLightFrac(),
          this._getLightMediaDuration(),
          1
        );
      }

      // Restauration visuelle de la flèche si la scène est toujours interactive
      if (this.isActive && this._interactiveReady && !this._isTransitioningOut) {
        const ms = window.CONFIG.PLAYER.torch_ms || 800;
        this._arrow.el.style.transition = `opacity ${ms / 1000}s ease`;
        this._arrow.el.style.opacity = this._arrow.el.classList.contains('visible') ? '1' : '0';
      }

      bus.emit('player:close', {});
    });
  }

  /**
   * Précharge une image de façon asynchrone.
   * -----------------------------------------------------------------------------
   * @param {string} url
   * @returns {Promise<boolean>} true si chargée, false si erreur
   */
  async _preloadImage(url) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  /**
   * Transition visuelle entre l'image d'intro et l'image de base interactive.
   * -----------------------------------------------------------------------------
   * Architecture utilisée :
   *
   * - _bgChap1 conserve l'image d'intro initiale
   * - un layer temporaire "base layer" est créé dessous avec l'image de base
   * - les deux couches sont animées en parallèle :
   *   - la base dézoome et apparaît,
   *   - l'intro zoome légèrement et s'efface
   *
   * Ensuite, on remplace proprement le fond principal par l'image de base
   * et on supprime le layer temporaire.
   */
  async _transitionIntroToBase() {
    if (!this._bgChap1) return;

    // Préchargement de l'image de base avant toute animation
    await this._preloadImage('Chapitre1/chp1-images/chapitre1base.webp');

    // Durée commune de la transition, synchronisée avec la lumière
    const DURATION = this._getLightTransDuration();

    // Création / récupération de la couche temporaire de base
    const baseLayer = this._ensureBaseLayer();
    baseLayer.style.transition = 'none';
    baseLayer.style.opacity = '0';
    baseLayer.style.transform = 'scale(1.12)';
    void baseLayer.offsetHeight; // force reflow

    // Optimisation navigateur pendant l'animation
    this._bgChap1.style.willChange = 'opacity, transform';

    // Double requestAnimationFrame :
    // garantit que les styles initiaux ont bien été pris en compte avant transition
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // Animation du base layer : dézoom + apparition
    baseLayer.style.transition = [
      `opacity ${DURATION}ms cubic-bezier(0.25,0.46,0.45,0.94) 80ms`,
      `transform ${DURATION}ms cubic-bezier(0.25,0.46,0.45,0.94)`
    ].join(', ');
    baseLayer.style.opacity = '1';
    baseLayer.style.transform = 'scale(1)';

    // Animation du fond d'intro : léger zoom avant + disparition
    this._bgChap1.style.transition = [
      `opacity ${DURATION * 0.85}ms cubic-bezier(0.42,0,0.78,1)`,
      `transform ${DURATION}ms cubic-bezier(0.25,0.46,0.45,0.94)`
    ].join(', ');
    this._bgChap1.style.transform = 'scale(1.10)';
    this._bgChap1.style.opacity = '0';

    // La lumière accompagne cette transition en parallèle
    await this._light.animateToFraction(this._getInteractiveLightFrac(), this._getLightTransDuration(), 1);

    // Petite temporisation de sécurité avant nettoyage final
    await this._rawWait(150);

    // Remise à plat :
    // _bgChap1 devient la couche principale de base interactive
    this._bgChap1.style.transition = 'none';
    this._bgChap1.style.transform = 'scale(1)';
    this._bgChap1.style.opacity = '1';
    this._bgChap1.style.willChange = '';
    this._bgChap1.style.backgroundImage = 'url("Chapitre1/chp1-images/chapitre1base.webp")';
    this._bgChap1.style.backgroundSize = '100% 100%';
    this._bgChap1.style.backgroundPosition = 'center center';
    this._bgChap1.style.backgroundRepeat = 'no-repeat';

    this._removeBaseLayer();
  }

  /**
   * Garantit l'existence d'un layer temporaire sous _bgChap1.
   * -----------------------------------------------------------------------------
   * Ce layer sert uniquement pendant la transition intro -> interactif.
   *
   * @returns {HTMLDivElement}
   */
  _ensureBaseLayer() {
    if (this._baseLayer) return this._baseLayer;

    const el = document.createElement('div');
    el.id = 'chapter1-base-layer';
    el.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:0',   // Sous _bgChap1
      'pointer-events:none',
      'background-image:url("Chapitre1/chp1-images/chapitre1base.webp")',
      'background-size:100% 100%',
      'background-position:center center',
      'background-repeat:no-repeat',
      'background-color:#000',
      'opacity:0'
    ].join(';');

    const app = document.getElementById('app');

    // On l'insère avant _bgChap1 pour garantir son ordre d'empilement
    if (app && this._bgChap1) {
      app.insertBefore(el, this._bgChap1);
    } else {
      app?.appendChild(el);
    }

    this._baseLayer = el;
    return el;
  }

  /**
   * Supprime le layer temporaire de base.
   */
  _removeBaseLayer() {
    if (!this._baseLayer) return;
    this._baseLayer.remove();
    this._baseLayer = null;
  }

  /**
   * Garantit l'existence de l'overlay d'intro.
   * -----------------------------------------------------------------------------
   * Cet élément n'est pas central dans la version actuelle, mais il est conservé
   * pour des besoins d'empilement / extensions visuelles.
   */
  _ensureIntroOverlay() {
    if (this._introOverlay) return this._introOverlay;

    const el = document.createElement('div');
    el.id = 'chapter1-image-overlay';

    const app = document.getElementById('app');
    const lightCanvas = document.getElementById('chapter1-fixed-light');

    if (app && lightCanvas) app.insertBefore(el, lightCanvas);
    else app?.appendChild(el);

    this._introOverlay = el;
    this._syncIntroOverlayRect();
    return el;
  }

  /**
   * Recale l'overlay d'intro sur toute la surface utile.
   */
  _syncIntroOverlayRect() {
    if (!this._introOverlay) return;
    this._introOverlay.style.position = 'absolute';
    this._introOverlay.style.inset = '0';
    this._introOverlay.style.zIndex = '1';
    this._introOverlay.style.pointerEvents = 'none';
  }

  /**
   * Supprime l'overlay d'intro.
   * -----------------------------------------------------------------------------
   * @param {boolean} immediate
   * - true  : suppression immédiate
   * - false : fondu puis suppression
   */
  _removeIntroOverlay(immediate = false) {
    if (!this._introOverlay) return;

    if (immediate) {
      this._introOverlay.remove();
      this._introOverlay = null;
      this._baseLayer = null;
      return;
    }

    this._introOverlay.style.opacity = '0';
    setTimeout(() => {
      this._introOverlay?.remove();
      this._introOverlay = null;
      this._baseLayer = null;
    }, 420);
  }

  /**
   * Rayon de lumière utilisé pendant l'intro.
   */
  _getIntroLightFrac() {
    return window.CONFIG.CHAPITRE1.light?.intro_frac ?? 0.64;
  }

  /**
   * Rayon de lumière utilisé pendant la phase interactive.
   */
  _getInteractiveLightFrac() {
    return window.CONFIG.CHAPITRE1.light?.interactive_frac ?? 0.72;
  }

  /**
   * Rayon de lumière utilisé pendant la lecture d'un média.
   * -----------------------------------------------------------------------------
   * La lumière est volontairement resserrée pour focaliser l'attention.
   */
  _getMediaLightFrac() {
    return window.CONFIG.CHAPITRE1.light?.media_frac ?? 0.32;
  }

  /**
   * Durée d'apparition de la lumière en intro.
   */
  _getLightIntroDuration() {
    return window.CONFIG.CHAPITRE1.light?.intro_duration ?? 2200;
  }

  /**
   * Durée de transition lumineuse intro -> interactif.
   */
  _getLightTransDuration() {
    return window.CONFIG.CHAPITRE1.light?.trans_duration ?? 2000;
  }

  /**
   * Durée de transition lumineuse associée au player.
   */
  _getLightMediaDuration() {
    return window.CONFIG.CHAPITRE1.light?.media_duration ?? 800;
  }

  /**
   * Nettoyage complet de l'UI interactive.
   * -----------------------------------------------------------------------------
   * Cette méthode supprime / réinitialise :
   * - listeners liés aux hotspots,
   * - timers de hover,
   * - couche hotspot,
   * - titre de hover,
   * - états curseur,
   * - debug panel éventuel,
   * - boucle audio d'ambiance,
   * - player si demandé.
   *
   * @param {Object} options
   * @param {boolean} options.stopAudio
   * @param {boolean} options.clearPlayer
   */
  _cleanupInteractiveUI({ stopAudio = true, clearPlayer = false } = {}) {
    this._cleanup();

    if (this._hotspotLeaveTimer) {
      clearTimeout(this._hotspotLeaveTimer);
      this._hotspotLeaveTimer = null;
    }

    if (this._hoverTitleLeaveTimer !== null) {
      clearTimeout(this._hoverTitleLeaveTimer);
      this._hoverTitleLeaveTimer = null;
    }

    if (this._activeHotspot) {
      document.getElementById(this._activeHotspot)?.classList.remove('active');
      this._activeHotspot = null;
    }

    this._hotspotLayer.innerHTML = '';
    this._hoverTitleEl?.classList.remove('visible');
    this._hoverTitleCurrent = null;
    this._playerHoverTitle = null;

    document.getElementById('cursor')?.classList.remove('hotspot');
    document.getElementById('_dbg_panel')?.remove();

    if (stopAudio) this.audio.stopSanzaLoop(320);
    if (clearPlayer && this.player?.active) this.player._forceClose();
  }

  /**
   * Construit dynamiquement les hotspots définis dans CONFIG.
   * -----------------------------------------------------------------------------
   * Pour chaque zone :
   * - positionnement en pourcentage,
   * - hover : affiche l'image d'accentuation + le titre,
   * - leave : masque l'image / gère le titre,
   * - click : ouvre le média et adapte la lumière.
   */
  _buildHotspots() {
    const C = window.CONFIG.CHAPITRE1;
    const HS = C.hotspots;
    const isDbg = !!C.debug;
    const cursor = document.getElementById('cursor');

    this._hotspotLayer.innerHTML = '';
    this._hoverTitleCurrent = null;
    this._playerHoverTitle = null;

    // Chargement différé des images de survol : leur URL est stockée en
    // data-bg dans index.html (et non en background-image) pour éviter de les
    // télécharger au démarrage du site. On les active seulement ici, à
    // l'entrée en phase interactive du chapitre 1. removeAttribute rend
    // l'opération idempotente si _buildHotspots est rappelée.
    document.querySelectorAll('.hotspot-img[data-bg]').forEach(el => {
      el.style.backgroundImage = `url("${el.dataset.bg}")`;
      el.removeAttribute('data-bg');
    });

    if (this._hoverTitleLeaveTimer !== null) {
      clearTimeout(this._hoverTitleLeaveTimer);
      this._hoverTitleLeaveTimer = null;
    }

    this._hoverTitleEl?.classList.remove('visible');

    // Palette de debug pour visualiser facilement les zones
    const DBG_FILL   = [
      'rgba(255,80,80,.28)',
      'rgba(80,160,255,.28)',
      'rgba(80,220,120,.28)',
      'rgba(255,200,60,.28)',
      'rgba(200,80,255,.28)',
      'rgba(60,220,220,.28)',
      'rgba(255,140,40,.28)',
      'rgba(180,255,80,.28)'
    ];

    const DBG_STROKE = [
      '#f88',
      '#6af',
      '#5e8',
      '#fd4',
      '#d6f',
      '#4ee',
      '#fa6',
      '#af5'
    ];

    HS.forEach((h, i) => {
      const zone = document.createElement('div');
      zone.className = 'hotspot-zone';
      zone.dataset.hspot = h.img;
      zone.style.left = h.l + '%';
      zone.style.top = h.t + '%';
      zone.style.width = h.w + '%';
      zone.style.height = h.h + '%';

      // Si le label est purement numérique, on le reformate pour l'affichage
      const displayLabel = /^\d+$/.test(h.label.trim())
        ? 'Zone\u00A0' + h.label.trim()
        : h.label;

      // Mode debug : visualiser les zones et leur identifiant
      if (isDbg) {
        zone.style.background = DBG_FILL[i % DBG_FILL.length];
        zone.style.border = '1.5px dashed ' + DBG_STROKE[i % DBG_STROKE.length];
        zone.style.boxSizing = 'border-box';
        zone.style.borderRadius = '2px';

        const lbl = document.createElement('span');
        lbl.textContent = h.label;
        lbl.style.cssText =
          'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
          'font-family:monospace;font-size:clamp(8px,.9vw,11px);font-weight:bold;' +
          'color:' + DBG_STROKE[i % DBG_STROKE.length] + ';' +
          'text-shadow:0 1px 3px #000;pointer-events:none;text-align:center;padding:2px;';
        zone.appendChild(lbl);
      }

      // Hover entrée :
      // - montre l'image hotspot associée
      // - met le curseur en mode actif
      // - affiche le titre contextuel
      // pointerenter/leave : couvre souris ET tactile. Sur mobile, le module
      // TouchHover dispatche ces événements sur la zone réellement sous le doigt
      // (le sélecteur .hotspot-zone y est enregistré), donc le survol des zones
      // du crâne fonctionne aussi au glissé du doigt.
      this.on(zone, 'pointerenter', () => {
        if (!this._interactiveReady || this._isTransitioningOut) return;
        this._showHotspotImg(h.img);
        cursor?.classList.add('active', 'hotspot');
        this._setHoverTitle(displayLabel);
      });

      // Hover sortie :
      // - masque l'image associée
      // - restaure l'état du curseur
      // - supprime éventuellement le titre si le player ne le maintient pas
      this.on(zone, 'pointerleave', () => {
        if (!this._interactiveReady) return;
        this._hideHotspotImg();
        cursor?.classList.remove('hotspot');
        if (!(this.player?.active && this._playerHoverTitle === displayLabel)) {
          this._clearHoverTitle();
        }
      });

      // Click :
      // - réduit la lumière
      // - masque visuellement la flèche
      // - ouvre le média correspondant via le bus
      this.on(zone, 'click', () => {
        if (!this._interactiveReady || !h.media || this._isTransitioningOut) return;

        this._playerHoverTitle = displayLabel;

        if (this._hoverTitleLeaveTimer !== null) {
          clearTimeout(this._hoverTitleLeaveTimer);
          this._hoverTitleLeaveTimer = null;
        }

        // Réduction de la lumière pendant la lecture média
        const L = window.CONFIG.CHAPITRE1.light;
        const mediaDur = L?.media_duration ?? 800;
        this._light.animateToFraction(this._getMediaLightFrac(), mediaDur, 1);

        // La flèche est masquée pendant qu'un média est au premier plan
        const P = window.CONFIG.PLAYER;
        this._arrow.el.style.transition = `opacity ${(P.torch_ms || 800) / 1000}s ease`;
        this._arrow.el.style.opacity = '0';

        bus.emit('player:open', { src: h.media, label: h.label });
      });

      this._hotspotLayer.appendChild(zone);
    });
  }

  /**
   * Active visuellement une image de hotspot.
   * -----------------------------------------------------------------------------
   * Une seule image peut être active à la fois.
   *
   * @param {string} imgId
   */
  _showHotspotImg(imgId) {
    if (this._hotspotLeaveTimer) {
      clearTimeout(this._hotspotLeaveTimer);
      this._hotspotLeaveTimer = null;
    }

    if (this._activeHotspot === imgId) return;

    if (this._activeHotspot) {
      document.getElementById(this._activeHotspot)?.classList.remove('active');
    }

    this._activeHotspot = imgId;
    document.getElementById(imgId)?.classList.add('active');
  }

  /**
   * Masque l'image de hotspot active avec un léger délai.
   * -----------------------------------------------------------------------------
   * Ce micro délai évite certains scintillements de hover.
   */
  _hideHotspotImg() {
    if (this._hotspotLeaveTimer) clearTimeout(this._hotspotLeaveTimer);

    this._hotspotLeaveTimer = setTimeout(() => {
      if (this._activeHotspot) {
        document.getElementById(this._activeHotspot)?.classList.remove('active');
      }
      this._activeHotspot = null;
      this._hotspotLeaveTimer = null;
    }, 40);
  }
  /**
   * Affiche ou met à jour le titre de survol associé aux hotspots.
   * -----------------------------------------------------------------------------
   * Ce titre apparaît en bas de l'écran lorsque l'utilisateur survole une zone
   * interactive du chapitre.
   *
   * Responsabilités :
   * - appliquer la configuration typographique dynamique,
   * - annuler un éventuel masquage différé en cours,
   * - éviter les mises à jour inutiles si le texte est identique,
   * - gérer soit :
   *   1) la première apparition,
   *   2) soit la transition douce entre deux intitulés.
   *
   * @param {string} newText
   * Texte à afficher dans le titre de survol.
   */
  _setHoverTitle(newText) {
    const el = this._hoverTitleEl;

    // Garde-fou :
    // on ne fait rien si l'élément DOM n'existe pas
    // ou si aucun texte exploitable n'a été fourni.
    if (!el || !newText) return;

    // Application de la configuration typographique centralisée.
    // Le titre de hover doit rester responsive et cohérent avec la DA globale.
    const f = window.CONFIG.FONTS?.hover_title;
    if (f) {
      const vW = Math.max(window.CONFIG.MIN_SIZE.width, window.innerWidth);
      const sz = Math.max(
        f.size_min,
        Math.min(f.size_max, Math.round(vW * f.size_vw / 100))
      );

      el.style.fontFamily = f.family;
      el.style.fontSize = sz + 'px';
      el.style.fontWeight = f.weight;
      el.style.letterSpacing = f.spacing;
      el.style.fontStyle = f.style;

      // La couleur est optionnelle dans la config.
      if (f.color) el.style.color = f.color;
    }

    // Si un masquage différé avait été programmé par _clearHoverTitle(),
    // on l'annule car un nouveau survol vient d'arriver.
    if (this._hoverTitleLeaveTimer !== null) {
      clearTimeout(this._hoverTitleLeaveTimer);
      this._hoverTitleLeaveTimer = null;
    }

    // Si le texte affiché est déjà le bon, on ne relance aucune animation
    // pour éviter les micro-clignotements inutiles.
    if (this._hoverTitleCurrent === newText) return;

    // Cas 1 :
    // aucun titre n'était encore actif → première apparition.
    if (!this._hoverTitleCurrent) {
      el.innerHTML = `<span class="ht-text">${newText}</span>`;
      this._hoverTitleCurrent = newText;

      // Double requestAnimationFrame :
      // permet de garantir que le DOM a bien pris en compte le nouveau contenu
      // avant d'ajouter la classe "visible" et de déclencher la transition CSS.
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
    } else {
      // Cas 2 :
      // un titre est déjà affiché → on effectue une transition douce entre
      // l'ancien texte et le nouveau, sans masquer tout le bloc.
      const span = el.querySelector('.ht-text');

      // Sécurité :
      // si pour une raison quelconque le span interne n'existe plus,
      // on reconstruit directement le contenu minimal.
      if (!span) {
        el.innerHTML = `<span class="ht-text">${newText}</span>`;
        this._hoverTitleCurrent = newText;
        return;
      }

      // On lance un petit fondu sortant sur le texte actuel.
      span.classList.add('fading');
      this._hoverTitleCurrent = newText;

      // Une fois le mini fade terminé, on remplace le contenu
      // puis on retire l'état de fondu pour laisser le nouveau texte réapparaître.
      setTimeout(() => {
        span.innerHTML = newText;
        span.classList.remove('fading');
      }, 230);
    }
  }

  /**
   * Masque le titre de survol avec un très léger délai.
   * -----------------------------------------------------------------------------
   * Ce délai court sert à lisser l'expérience utilisateur :
   * il évite qu'un minuscule trou entre deux zones hover provoque
   * un clignotement désagréable du titre.
   */
  _clearHoverTitle() {
    // Si un timer de masquage existe déjà, on le remplace proprement.
    if (this._hoverTitleLeaveTimer !== null) clearTimeout(this._hoverTitleLeaveTimer);

    this._hoverTitleLeaveTimer = setTimeout(() => {
      this._hoverTitleEl?.classList.remove('visible');
      this._hoverTitleCurrent = null;
      this._hoverTitleLeaveTimer = null;
    }, 30);
  }

  /**
   * Affiche le sous-titre du chapitre.
   * -----------------------------------------------------------------------------
   * Le contenu texte provient de CONFIG.CHAPITRE1.subtitle
   * et sa mise en forme s'appuie sur CONFIG.FONTS.subtitle.
   *
   * Le sous-titre peut être rappelé plusieurs fois dans la scène :
   * - pendant l'intro,
   * - après la transition vers l'interactif,
   * - après certains resets visuels.
   */
  _showSubtitle() {
    const C = window.CONFIG.CHAPITRE1;

    // Rien à afficher si la configuration ou l'élément DOM est absent.
    if (!C?.subtitle || !this._subtitle) return;

    this._subtitle.innerHTML = C.subtitle;

    // Application du style typographique responsive.
    const f = window.CONFIG.FONTS?.subtitle;
    const vW = Math.max(window.CONFIG.MIN_SIZE.width, window.innerWidth);

    if (f) {
      this._subtitle.style.fontFamily = f.family;
      this._subtitle.style.fontSize =
        Math.max(f.size_min, Math.min(f.size_max, Math.round(vW * f.size_vw / 100))) + 'px';
      this._subtitle.style.fontWeight = f.weight;
      this._subtitle.style.letterSpacing = f.spacing;
      this._subtitle.style.fontStyle = f.style;
    }

    // La classe "visible" déclenche les transitions CSS d'entrée.
    this._subtitle.classList.add('visible');
  }

  /**
   * Masque le sous-titre du chapitre.
   * -----------------------------------------------------------------------------
   * Deux modes :
   * - immediate = true  : suppression instantanée, sans animation
   * - immediate = false : sortie douce avec fondu + léger déplacement
   *
   * @param {boolean} immediate
   * true : suppression instantanée (pas d'animation)
   */
  _hideSubtitle(immediate = false) {
    if (!this._subtitle) return;

    if (immediate) {
      // Mode hard reset :
      // utile quand on doit remettre l'état à zéro sans laisser d'animation
      // résiduelle (ex : changement brutal de phase / exit).
      this._subtitle.style.transition = 'none';
      this._subtitle.classList.remove('visible');

      // Force un reflow pour s'assurer que le navigateur enregistre bien
      // l'état sans transition avant la prochaine réapparition.
      void this._subtitle.offsetHeight;

      // On rend ensuite la main aux transitions CSS normales.
      this._subtitle.style.transition = '';
      return;
    }

    // Sortie douce :
    // le sous-titre s'estompe et remonte légèrement pour une disparition discrète.
    this._subtitle.style.transition =
      'color 0.6s ease, opacity 0.75s ease, transform 0.85s cubic-bezier(0.55,0,0.45,1)';
    this._subtitle.style.opacity = '0';
    this._subtitle.style.transform = 'translateY(-6px)';

    setTimeout(() => {
      if (!this._subtitle) return;

      // Nettoyage complet après animation pour retrouver un état neutre.
      this._subtitle.classList.remove('visible');
      this._subtitle.style.opacity = '';
      this._subtitle.style.transform = '';
      this._subtitle.style.transition = '';
    }, 900);
  }

  /**
   * Calcule les dimensions du bouton "Passer".
   * -----------------------------------------------------------------------------
   * Le dimensionnement suit la même logique proportionnelle que les autres
   * éléments UI (flèches, fullscreen, etc.) afin de conserver une cohérence
   * visuelle dans toute l'expérience.
   *
   * Règle :
   * - la hauteur suit la taille de référence ARROW
   * - la largeur vaut 3 × la hauteur pour obtenir un bouton rectangulaire
   *
   * @returns {{W:number, H:number}}
   * W = largeur, H = hauteur
   */
  _getSkipSize() {
    // Même logique de calcul que fs-btn et arrow :
    // on se base sur min(vW, vH) avec bornes min/max.
    const vW = Math.max(window.CONFIG.MIN_SIZE.width, window.innerWidth);
    const vH = Math.max(window.CONFIG.MIN_SIZE.height, window.innerHeight);
    const A = window.CONFIG.ARROW;

    const sz = Math.round(
      Math.max(
        A.size_min,
        Math.min(A.size_max, Math.min(vW, vH) * A.size_vh / 100)
      )
    );

    // Largeur : 3× la hauteur pour obtenir un bouton horizontal lisible.
    return { W: sz * 3, H: sz };
  }

  /**
   * Affiche le bouton "Passer".
   * -----------------------------------------------------------------------------
   * Le bouton est injecté dynamiquement dans le DOM avec un SVG :
   * - contour rectangulaire dessiné en animation,
   * - label centré,
   * - hover lumineux,
   * - callback de clic configurable.
   *
   * Particularité importante :
   * un listener DOM direct est ajouté en plus du système this.on(...)
   * pour garantir que le clic reste fonctionnel même si la liste interne
   * des listeners a été modifiée pendant certaines transitions sensibles.
   *
   * @param {Function} onClick
   * Callback à exécuter lors du clic sur "Passer".
   */
  _showSkipButton(onClick) {
    if (!this._skipBtn) return;

    const { W, H } = this._getSkipSize();
    const perim = 2 * (W + H);

    // Taille du texte ajustée à la hauteur du bouton avec bornes de sécurité.
    const fs = Math.min(15, Math.max(9, Math.round(H * 0.38)));

    // Le bouton est reconstruit entièrement à chaque affichage :
    // cela simplifie la gestion des dimensions, du resize et des états visuels.
    this._skipBtn.innerHTML = `
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

    const wrap = this._skipBtn.querySelector('.skip-wrap');
    const rect = this._skipBtn.querySelector('.skip-rect');
    const label = this._skipBtn.querySelector('.skip-label');

    // Les dimensions sont pilotées ici en JS et non en CSS
    // pour rester cohérentes avec le calcul runtime.
    wrap.style.width = W + 'px';
    wrap.style.height = H + 'px';

    // Hover entrée :
    // accentue le bouton visuellement pour signaler son interactivité.
    this.on(wrap, 'pointerenter', () => {
      wrap.classList.add('hovered');
      rect.setAttribute('stroke', 'rgba(255,230,130,0.95)');
      rect.style.filter =
        'drop-shadow(0 0 7px rgba(255,210,80,0.80)) drop-shadow(0 0 20px rgba(255,170,30,0.50))';
      label.setAttribute('fill', 'rgba(255,220,120,1)');
    });

    // Hover sortie :
    // restaure l'état visuel neutre du bouton.
    this.on(wrap, 'pointerleave', () => {
      wrap.classList.remove('hovered');
      rect.setAttribute('stroke', 'rgba(255,255,255,0.72)');
      rect.style.filter = '';
      label.setAttribute('fill', 'rgba(255,255,255,0.82)');
    });

    // Listener standard géré par le système de cleanup de la scène.
    this.on(wrap, 'click', () => onClick?.());

    // Listener direct de sécurité :
    // garantit que le clic est bien capté même si la liste this._listeners
    // a été altérée pendant une phase délicate (outro, typing, skip, etc.).
    wrap.dataset.skipBound = '1';

    const _directClick = (e) => {
      e.stopPropagation();
      onClick?.();
      wrap.removeEventListener('click', _directClick);
    };

    wrap.addEventListener('click', _directClick);

    // On conserve le callback pour pouvoir reconstruire le bouton au resize
    // sans perdre son comportement.
    this._skipBtn._currentOnClick = onClick;

    // Affichage visuel du conteneur
    this._skipBtn.classList.add('visible');

    // Déclenchement différé de l'animation SVG :
    // - d'abord le contour
    // - puis le label
    requestAnimationFrame(() => requestAnimationFrame(() => {
      rect.classList.add('drawn');
      setTimeout(() => label.classList.add('drawn'), 850);
    }));
  }

  /**
   * Masque le bouton "Passer".
   * -----------------------------------------------------------------------------
   * Deux modes :
   * - immediate = true  : vide immédiatement le contenu
   * - immediate = false : laisse le temps au fondu CSS, puis nettoie le DOM
   *
   * @param {boolean} immediate
   */
  _hideSkipButton(immediate = false) {
    if (!this._skipBtn) return;

    // On retire l'état visible pour déclencher le fade-out CSS.
    this._skipBtn.classList.remove('visible');

    const clearFn = () => {
      // On ne vide le DOM que si le bouton n'a pas été réaffiché entre-temps.
      if (!this._skipBtn.classList.contains('visible')) this._skipBtn.innerHTML = '';
    };

    if (immediate) clearFn();
    else setTimeout(clearFn, 700);
  }
      }
