import { Scene }            from '../core/Scene.js';
import { bus }              from '../core/EventBus.js';
import { ArrowChp2Opening, ArrowChp2Part } from '../ui/ArrowChapitre2.js';
import { CloseCross }       from '../ui/CloseCross.js';
import { runSkippableQuoteSequence } from '../sequences/QuoteSequence.js';
import { SkipButton }       from '../ui/SkipButton.js';
import { CONFIG as CHP2 }   from '../../Chapitre2/chp2-src/chp2-config.js';

/**
 * Chapitre2Scene — v4.0 (harmonisation UI)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NAVIGATION :
 *  ┌─────────────────────────────────────────────────────────────────────────┐
 *  │  CollaborationScene ──[cercle II]──► Chapitre2Scene (openning)           │
 *  │  openning ──[crâne 136]──► Invibilisation                                │
 *  │  openning ──[crâne 137]──► Peine démesurée                               │
 *  │  openning ──[crâne 138]──► Violence et ses traces (cartel)               │
 *  │  Sous-parties ──[flèche ←]──► openning   (extinction/rallumage bougie)   │
 *  │  openning    ──[flèche ←]──► Collaboration (extinction progressive)      │
 *  └─────────────────────────────────────────────────────────────────────────┘
 *
 * FLÈCHES (toutes ArrowBase, identiques au reste du site) :
 *  - 1 flèche openning (#arrow-chp2-opening) → Espace collaboratif.
 *  - 3 flèches indépendantes, une par sous-partie, qui se (re)construisent en
 *    animation SVG à chaque ouverture → retour openning.
 *  Une seule est visible à la fois. La scène est l'unique chef d'orchestre :
 *    • l'openning prévient « bougie allumée / sous-partie ouverte / retour »
 *      via le pont setArrowCallbacks (flèche openning) ;
 *    • chaque sous-partie émet « <part>-ready » (dessiner la flèche) et
 *      « <part>:return / :closed » (retirer la flèche) ;
 *    • un clic sur une flèche de sous-partie émet « chp2:request-return »,
 *      capté par la sous-partie ouverte, qui rejoue son extinction puis
 *      réémet « <part>:return » → l'openning rallume la bougie progressivement.
 *
 * TITRE (3 niveaux cinématographiques) :
 *  - #site-title        : « Espace collaboratif »  (posé par CollaborationScene,
 *                          conservé tel quel pendant tout le chapitre 2).
 *  - #chapitre-subtitle : « L'héritage colonial du musée »  (entrée → sortie chp2).
 *  - #chapitre-part-title : titre de la sous-partie  (entrée → sortie sous-partie).
 */

/* ── Chemins ────────────────────────────────────────────────────────────── */
const ASSET_PATH  = 'Chapitre2/';          // depuis la racine serveur (img src)
const MODULE_PATH = '../../Chapitre2/';    // depuis src/scenes/ (import())

/* ── Sous-parties : mapping identifiant ⇄ événements du module ───────────── */
const PARTS = {
  invibilisation: {
    ready:   'chp2:invibilisation-ready',
    return:  ['invibilisation:return', 'invibilisation:closed'],
  },
  'peine-demesuree': {
    ready:   'chp2:peine-ready',
    return:  ['peineDemesuree:return', 'peine-demesuree:closed'],
  },
  cartel: {
    ready:   'chp2:cartel-ready',
    return:  ['cartel:return', 'cartel:closed'],
  },
};

/* ── Constants ──────────────────────────────────────────────────────────── */
const CHp2_BODY_CLASSES = ['cartel-open', 'invibilisation-open', 'peine-demesuree-open'];
const CSS_LINK_IDS      = [
  'chp2-css-violence', 'chp2-css-opening',
  'chp2-css-invibilisation', 'chp2-css-peine',
];

/* ─────────────────────────────────────────────────────────────────────────── */

export class Chapitre2Scene extends Scene {
  /**
   * @param {Object} systems
   * @param {Object} systems.audio       AudioManager global
   * @param {Object} systems.bgMgr       BackgroundManager
   * @param {Object} systems.transition  TransitionManager
   */
  constructor(systems) {
    super('chapitre2');

    this.audio      = systems.audio;
    this.bgMgr      = systems.bgMgr;
    this.transition = systems.transition;

    /** Flèche openning → Collaboration. */
    this._openingArrow = new ArrowChp2Opening(window.CONFIG);

    /** Une flèche INDÉPENDANTE par sous-partie (openning ← retour). */
    this._partArrows = {
      invibilisation:    new ArrowChp2Part(window.CONFIG, 'invibilisation'),
      'peine-demesuree': new ArrowChp2Part(window.CONFIG, 'peine-demesuree'),
      cartel:            new ArrowChp2Part(window.CONFIG, 'violence'),
    };

    /** Sous-partie actuellement ouverte (clé de PARTS) ou null. */
    this._openPart = null;

    /** Croix de fermeture média (partagée : un seul média ouvert à la fois).
        Identique aux flèches (dérivée d'ArrowBase). Pilotée par les sous-parties
        via les événements 'chp2:show-close-cross' / 'chp2:hide-close-cross' ;
        son clic émet 'chp2:close-cross-clicked' que la sous-partie traite. */
    this._closeCross = new CloseCross(window.CONFIG, 'close-cross-chp2');

    /** DOM conteneur du chapitre 2. */
    this._container = null;

    /** Module chp2-openning chargé dynamiquement. */
    this._module = null;

    /** Listeners window (ready / return) à retirer en sortie. */
    this._windowListeners = [];

    /** Bouton « Passer » de la citation de sortie (réutilisé du chapitre 1). */
    this._skip = new SkipButton(window.CONFIG);

    /** Garde-fou d'idempotence : la citation de sortie ne joue qu'une fois. */
    this._outroPlaying = false;

    /**
     * Texte de la citation typée affichée à la sortie du chapitre 2,
     * juste avant le retour à l'espace collaboratif (écran noir, son coupé).
     * Le « \n » initial offre une respiration verticale, comme au chapitre 1.
     */
    this._outroQuoteText =
      '\n« Ce qui m\u2019a le plus marqué ? sans hésiter : le traitement de son ' +
      'corps. Appendre qu\u2019il a été disséqué, exposé, puis conservé comme un ' +
      'objet c\u2019est choquant. J\u2019ai eu l\u2019impression qu\u2019on ' +
      'l\u2019avait complètement déshumanisé. C\u2019est comme si on voulait ' +
      'punir son corps même après sa mort. Ce geste m\u2019a paru violent, cruel, ' +
      'et profondément injuste. Ça m\u2019a vraiment touché et ouvert les yeux sur ' +
      'la violence physique et symbolique du colonialisme »';
  }

  /* ── Cycle de vie ──────────────────────────────────────────────────────── */

  async enter(params = {}) {
    await super.enter(params);

    this._openPart = null;
    this._outroPlaying = false;

    try {
      // Active le contexte chapitre 2 : curseur custom + remontée z des titres
      // au-dessus du root plein écran (sinon titres/sous-titres masqués).
      document.body.classList.add('chp2-active');

      this.bgMgr.blackout();
      await this.transition.fadeVeil(0, 0);

      // Tier 2 : sous-titre « L'héritage colonial du musée » sous « Espace collaboratif »
      this._showSubtitle();
      this._hidePartTitle(true);

      // ── ORDRE D'ENTRÉE (noir garanti, zéro flash) ──────────────────────
      // 1. CSS AVANT le DOM et ATTENDU : sans la feuille, les images du
      //    travelling et des sous-parties s'affichent brutes.
      // 2. DOM injecté AVEC son rideau noir (#chp2-boot, styles inline).
      // 3. Attente du DÉCODAGE de #chp2-img : measure() lit
      //    getBoundingClientRect().width pour placer lumières et hotspots ;
      //    mesurer une image non décodée fausse toute la géométrie.
      // 4. Module importé, puis 'chp2:opening-ready' quand le canvas
      //    d'obscurité est en place (il naît display:none → travelling en clair).
      // 5. Levée du rideau : on ne dévoile qu'un aplat noir, la bougie s'allume.
      await this._injectCSS();
      this._injectDOM();
      await this._waitForImage();

      // Listeners ready/return des sous-parties (avant le module, par sûreté)
      this._registerWindowListeners();

      // Charger et démarrer le module openning.
      // CACHE-BUST OBLIGATOIRE : ce module exécute tout son setup au niveau
      // top-level (refs DOM, boucles RAF, LightSystem). Sans la query unique,
      // import() renverrait l'instance MISE EN CACHE au 2ᵉ passage → refs DOM
      // périmées + LightSystem détruite. La query force une réévaluation propre
      // contre le DOM fraîchement réinjecté à chaque entrée.
      this._module = await import(
        /* @vite-ignore */ `${MODULE_PATH}chp2-src/chp2-openning.js?v=${Date.now()}`
      );

      // Pont AUDIO : toute l'ambiance du chapitre 2 passe par l'AudioManager
      // central partagé (piste 'chp2'). Injecté AVANT startChapitre2().
      this._module.setAudioManager?.(this.audio);

      // Pont flèche OPENNING : le module pilote son apparition/disparition.
      //  - showFn : bougie allumée OU retour d'une sous-partie
      //  - hideFn : départ vers Collaboration OU ouverture d'une sous-partie
      this._module.setArrowCallbacks?.(
        () => this._showOpeningArrow(),
        () => this._openingArrow.hide()
      );

      // ⚠️ S'abonner AVANT de démarrer : le signal peut arriver très vite.
      const openingReady = this._waitOpeningReady();

      await this._module.startChapitre2?.();

      // On attend que la nuit soit posée (canvas d'obscurité affiché), puis on
      // lève le rideau. Jusque-là l'écran est noir, quoi qu'il arrive.
      await openingReady;
      this._raiseBootCurtain();

    } catch (err) {
      if (err.message === 'scene_aborted') return;
      console.error('[Chapitre2Scene] Erreur enter() :', err);
      // Secours : ne jamais rester bloqué derrière le rideau noir.
      this._raiseBootCurtain();
    }
  }

  async exit(params = {}) {
    try { await this._module?.stopChapitre2?.(); } catch { /* absorbé */ }

    // Garantie anti-résidu : coupe l'ambiance chp2 même si le module a échoué.
    this.audio.stopChp2Loop?.();

    // Masquer toutes les flèches (openning + sous-parties)
    this._openingArrow.hide();
    Object.values(this._partArrows).forEach(a => a.hide());
    this._closeCross.hide();
    this._openPart = null;

    // Résidus éventuels de la citation de sortie (si exit() survient pendant le
    // typing) : invalider la séquence, retirer le bouton et nettoyer la quote.
    this._outroPlaying = false;
    this._skip.destroy();
    const quoteEl = document.getElementById('chapter-quote');
    if (quoteEl) {
      this.transition.quoteTypingToken++;   // stoppe tout typing résiduel
      quoteEl.classList.remove('visible');
      quoteEl.style.transition = '';
      quoteEl.style.opacity = '';
      quoteEl.innerHTML = '';
    }

    // Tier 2 + tier 3 : disparaissent en quittant le chapitre 2.
    // (#site-title « Espace collaboratif » reste géré par CollaborationScene.)
    this._hidePartTitle(true);
    this._hideSubtitle();

    // Retirer les listeners window
    this._unregisterWindowListeners();
    this._openingReadyCleanup?.();
    this._openingReadyCleanup = null;

    CHp2_BODY_CLASSES.forEach(cls => document.body.classList.remove(cls));
    document.body.classList.remove('chp2-active');
    this._removeDOM();
    this._removeCSS();
    this._module = null;

    await super.exit(params);

    this.bgMgr.blackout();
    await this.transition.fadeVeil(0, 0);
  }

  onResize() {
    this._openingArrow.resize?.();
    Object.values(this._partArrows).forEach(a => a.resize?.());
    this._skip.resize();
    this._resizeTitleFonts();
  }

  /** Recalcule la taille de police du sous-titre et du titre de sous-partie. */
  _resizeTitleFonts() {
    const f  = window.CONFIG.FONTS?.subtitle;
    if (!f) return;
    const vW = Math.max(window.CONFIG.MIN_SIZE.width, window.innerWidth);
    const sz = Math.max(f.size_min, Math.min(f.size_max, Math.round(vW * f.size_vw / 100))) + 'px';
    const sub  = document.getElementById('chapitre-subtitle');
    const part = document.getElementById('chapitre-part-title');
    if (sub?.classList.contains('visible'))  sub.style.fontSize  = sz;
    if (part?.classList.contains('visible')) part.style.fontSize = sz;
  }

  /* ── Flèche OPENNING → Collaboration ───────────────────────────────────
     show() : ArrowBase dessine cercle + chevron (animation SVG native).
     Clic   : explosion dorée ArrowBase, puis demande au module une sortie
              cinématographique (extinction progressive de la bougie + fondu)
              qui se termine par 'chp2:navigate-back' → navigation réelle.
  ─────────────────────────────────────────────────────────────────────────── */

  _showOpeningArrow() {
    if (!this.isActive) return;
    // Garantie explicite : aucune flèche de sous-partie ne doit subsister au
    // moment où la flèche openning se dessine (évite tout chevauchement visuel).
    Object.values(this._partArrows).forEach(a => a.hide());
    this._openPart = null;
    this._openingArrow.show(() => this._leaveToCollaboration());
  }

  _leaveToCollaboration() {
    // Le sous-titre et le titre de sous-partie s'estompent en fondu pendant
    // l'extinction de la bougie (le #site-title « Espace collaboratif » reste).
    this._hidePartTitle(false);
    this._hideSubtitle(false);

    // Délègue l'extinction progressive (lumière + son + fondu) au module ;
    // il émettra 'chp2:navigate-back' une fois le noir atteint.
    if (this._module?.leaveToCollaboration) {
      this._module.leaveToCollaboration();
    } else {
      // Filet de sécurité : navigation directe si le module n'expose rien.
      bus.emit('navigate', { to: 'collaboration', from: 'chapitre2' });
    }
  }

  /* ── Citation de sortie (écran noir, son off, typing, « Passer ») ───────
     Insérée entre la fin du chapitre 2 et le retour à l'espace collaboratif,
     sur le même principe que Chapitre1Scene.transitionOutWithQuote().
  ─────────────────────────────────────────────────────────────────────────── */

  /**
   * Joue la citation typée de sortie, puis navigue vers l'espace collaboratif.
   * -----------------------------------------------------------------------------
   * Pré-conditions garanties par le module au moment de 'chp2:navigate-back' :
   *  - la bougie est éteinte,
   *  - la piste audio chp2 est coupée,
   *  - #chp2-fade est opaque → l'écran est noir.
   *
   * #chapter-quote et #skip-btn sont remontés au-dessus de #chapitre2-root
   * (z-index 600) par la règle CSS `body.chp2-active`, active tant que la scène
   * n'est pas quittée : la citation et le bouton s'affichent donc sur le noir.
   *
   * Idempotente via le drapeau _outroPlaying.
   */
  async _playOutroQuote() {
    if (this._outroPlaying) return;
    this._outroPlaying = true;

    // Garantie « son off » — idempotent même si le module a déjà coupé la piste.
    this.audio.stopChp2Loop?.(0);

    const quoteEl = document.getElementById('chapter-quote');

    try {
      // Mécanique typing + skip + fin naturelle, déléguée au module partagé.
      await runSkippableQuoteSequence({
        transition: this.transition,
        text: this._outroQuoteText,
        charDelay: 54,
        skipDelay: CHP2.timing?.skip_btn_delay ?? 2000,
        afterTypingDelay: 2800,
        showSkipButton: (onClick)        => this._skip.show(onClick),
        hideSkipButton: (immediate = false) => this._skip.hide(immediate),
        wait: (ms) => this._rawWait(ms),

        // Reste valide tant que la scène est active et qu'on n'a pas navigué.
        isStillValid: () => this.isActive && this._outroPlaying,
      });
    } catch {
      // Interruption silencieuse (ex : sortie de scène pendant le typing).
    }

    // La scène a pu être quittée pendant le typing : on n'enchaîne que si valide.
    if (!this.isActive || !this._outroPlaying) return;

    // Fondu de sortie de la citation (fidèle au doExit du chapitre 1).
    if (quoteEl) {
      this.transition.quoteTypingToken++;   // parité défensive avec le chapitre 1
      quoteEl.style.transition = 'opacity 1400ms cubic-bezier(0.55,0,0.45,1)';
      quoteEl.style.opacity = '0';

      await this._rawWait(1450);

      quoteEl.style.transition = '';
      quoteEl.style.opacity = '';
      quoteEl.classList.remove('visible');
      quoteEl.innerHTML = '';
    }

    // Le bouton « Passer » disparaît proprement.
    this._skip.hide(true);

    if (!this.isActive) return;

    // Navigation réelle. L'écran reste noir (#chp2-fade) jusqu'à exit(), qui
    // bascule sur le blackout global avant le fondu d'entrée de Collaboration :
    // aucune coupure visible entre les deux scènes.
    bus.emit('navigate', { to: 'collaboration', from: 'chapitre2' });
  }

  /* ── Flèches de SOUS-PARTIE → openning ─────────────────────────────────
     Affichée quand la sous-partie signale '<part>-ready' (dessin SVG),
     retirée sur '<part>:return/:closed'. Le clic émet 'chp2:request-return'
     que la sous-partie ouverte capte pour rejouer son extinction.
  ─────────────────────────────────────────────────────────────────────────── */

  _showPartArrow(part) {
    if (!this.isActive) return;
    const arrow = this._partArrows[part];
    if (!arrow) return;
    this._openPart = part;
    arrow.show(() => {
      // Une seule sous-partie ouverte à la fois : la sous-partie concernée
      // capte l'événement et rejoue sa séquence de retour vers l'openning.
      window.dispatchEvent(new CustomEvent('chp2:request-return'));
    });
    this._showPartTitle(part);
  }

  _hidePartArrow(part) {
    this._partArrows[part]?.hide();
    this._closeCross.hide();
    if (this._openPart === part) this._openPart = null;
    this._hidePartTitle();
  }

  /* ── Titres (3 niveaux) ────────────────────────────────────────────────
     #site-title « Espace collaboratif » : posé par CollaborationScene, conservé.
     #chapitre-subtitle « L'héritage colonial du musée » : tier 2 (chp2).
     #chapitre-part-title : tier 3 (sous-partie).
  ─────────────────────────────────────────────────────────────────────────── */

  _applySubtitleFont(el) {
    const f = window.CONFIG.FONTS?.subtitle;
    if (!f || !el) return;
    const vW = Math.max(window.CONFIG.MIN_SIZE.width, window.innerWidth);
    el.style.fontFamily    = f.family;
    el.style.fontSize      = Math.max(f.size_min, Math.min(f.size_max,
                              Math.round(vW * f.size_vw / 100))) + 'px';
    el.style.fontWeight    = f.weight;
    el.style.letterSpacing = f.spacing;
    el.style.fontStyle     = f.style;
  }

  _showSubtitle() {
    const el = document.getElementById('chapitre-subtitle');
    if (!el) return;
    el.innerHTML = CHP2.subtitle ?? 'L\u2019héritage colonial du musée';
    this._applySubtitleFont(el);
    // Temporisation : ne pas chevaucher le fondu d'entrée de scène.
    setTimeout(() => { if (this.isActive) el.classList.add('visible'); }, 400);
  }

  _hideSubtitle(immediate = true) {
    const el = document.getElementById('chapitre-subtitle');
    if (!el) return;
    if (immediate) {
      el.style.transition = 'none';
      el.classList.remove('visible');
      requestAnimationFrame(() => { el.style.transition = ''; });
    } else {
      el.classList.remove('visible');   // laisse jouer la transition CSS de sortie
    }
  }

  _showPartTitle(part) {
    const el = document.getElementById('chapitre-part-title');
    if (!el) return;
    const label = CHP2.parts?.[part] ?? '';
    if (!label) return;
    el.innerHTML = label;
    this._applySubtitleFont(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (this.isActive) el.classList.add('visible');
    }));
  }

  _hidePartTitle(immediate = false) {
    const el = document.getElementById('chapitre-part-title');
    if (!el) return;
    if (immediate) {
      el.style.transition = 'none';
      el.classList.remove('visible');
      requestAnimationFrame(() => { el.style.transition = ''; });
    } else {
      el.classList.remove('visible');   // laisse jouer la transition CSS de sortie
    }
  }

  /* ── Listeners window : ready / return des sous-parties ────────────────
     - '<part>-ready'           → dessiner la flèche + afficher le titre de partie.
     - '<part>:return'/':closed' → retirer la flèche + masquer le titre de partie.
       (couvre aussi les fermetures Escape/backdrop indépendantes de la flèche.)
     La flèche OPENNING reste pilotée par le pont setArrowCallbacks.
  ─────────────────────────────────────────────────────────────────────────── */

  _registerWindowListeners() {
    this._unregisterWindowListeners();

    // Sortie cinématographique openning → Collaboration (émise par le module
    // une fois la bougie éteinte et le fondu au noir terminés). À ce stade
    // l'écran est déjà noir et le son chp2 coupé : on insère la citation typée
    // (avec bouton « Passer ») AVANT la navigation réelle, comme au chapitre 1.
    const onNavBack = () => {
      if (this.isActive) this._playOutroQuote();
    };
    window.addEventListener('chp2:navigate-back', onNavBack);
    this._windowListeners.push({ event: 'chp2:navigate-back', fn: onNavBack });

    // Croix de fermeture média : une sous-partie demande son affichage quand
    // un média/zoom s'ouvre, et son retrait à la fermeture. Le clic sur la croix
    // (avec explosion dorée, comme une flèche) émet 'chp2:close-cross-clicked'
    // que la sous-partie concernée écoute pour fermer son média.
    const onShowCloseCross = () => {
      this._closeCross.show(() =>
        window.dispatchEvent(new CustomEvent('chp2:close-cross-clicked'))
      );
    };
    const onHideCloseCross = () => this._closeCross.hide();
    window.addEventListener('chp2:show-close-cross', onShowCloseCross);
    window.addEventListener('chp2:hide-close-cross', onHideCloseCross);
    this._windowListeners.push({ event: 'chp2:show-close-cross', fn: onShowCloseCross });
    this._windowListeners.push({ event: 'chp2:hide-close-cross', fn: onHideCloseCross });

    Object.entries(PARTS).forEach(([part, ev]) => {
      const onReady  = () => this._showPartArrow(part);
      const onReturn = () => this._hidePartArrow(part);

      window.addEventListener(ev.ready, onReady);
      this._windowListeners.push({ event: ev.ready, fn: onReady });

      ev.return.forEach(evt => {
        window.addEventListener(evt, onReturn);
        this._windowListeners.push({ event: evt, fn: onReturn });
      });
    });
  }

  _unregisterWindowListeners() {
    this._windowListeners.forEach(({ event, fn }) =>
      window.removeEventListener(event, fn)
    );
    this._windowListeners = [];
  }

  /* ── DOM ─────────────────────────────────────────────────────────────── */

  _injectDOM() {
    if (this._container) return;
    const app = document.getElementById('app');
    if (!app) return;

    const root = document.createElement('div');
    root.id = 'chapitre2-root';
    root.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:500',
      'overflow:hidden', 'background:#000',
    ].join(';');

    root.innerHTML = /* html */`
      <!-- TRAVELLING -->
      <div id="chp2-scene">
        <div id="chp2-shake">
          <img id="chp2-img" src="${ASSET_PATH}chp2-images/vue-general.webp" alt="Vue" draggable="false">
          <img class="chp2-overlay" id="chp2-ov-136" src="${ASSET_PATH}chp2-images/crane-136.png" alt="" draggable="false">
          <img class="chp2-overlay" id="chp2-ov-137" src="${ASSET_PATH}chp2-images/crane-137.png" alt="" draggable="false">
          <img class="chp2-overlay" id="chp2-ov-138" src="${ASSET_PATH}chp2-images/crane-138.png" alt="" draggable="false">
        </div>
      </div>
      <div id="chp2-legend">
        <span class="chp2-num"   id="chp2-leg-num"></span>
        <span class="chp2-label" id="chp2-leg-label"></span>
      </div>
      <div id="chp2-bar"></div>
      <div id="chp2-fade"></div>

      <!-- CARTEL -->
      <div id="cartel-root" aria-hidden="true">
        <main class="stage-frame">
          <div class="display-stage" data-role="stage"></div>
        </main>
        <div class="backdrop" data-role="backdrop" aria-hidden="true"></div>
        <p class="close-hint" role="status" aria-live="polite">Cliquer en dehors ou Échap pour refermer</p>
      </div>

      <!-- INVIBILISATION -->
      <div id="invibilisation-root" aria-hidden="true">
        <div class="sr-only">
          <h1>Eyes — Installation web interactive autour d'yeux de verre anciens</h1>
        </div>
        <div id="loader"><div id="loader-track"><div id="loader-fill"></div></div></div>
        <div id="srt-subtitles"></div>
        <main id="scene">
          <div id="gw1" class="globe-wrap"><div class="globe-scale">
            <img id="g1n" class="layer globe-normal" src="${ASSET_PATH}chp2-images/EyesGlobe.webp"        srcset="${ASSET_PATH}chp2-images/EyesGlobe-800.webp 800w, ${ASSET_PATH}chp2-images/EyesGlobe-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesGlobe.webp 1920w"        sizes="100vw" width="1920" height="1342" alt="" decoding="async">
            <img id="g1p" class="layer globe-play"   src="${ASSET_PATH}chp2-images/EyesGlobePlay.webp"    srcset="${ASSET_PATH}chp2-images/EyesGlobePlay-800.webp 800w, ${ASSET_PATH}chp2-images/EyesGlobePlay-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesGlobePlay.webp 1920w"    sizes="100vw" width="1920" height="1342" alt="" decoding="async" fetchpriority="low">
          </div></div>
          <div id="gw2" class="globe-wrap"><div class="globe-scale">
            <img id="g2n" class="layer globe-normal" src="${ASSET_PATH}chp2-images/EyesGlobe2.webp"       srcset="${ASSET_PATH}chp2-images/EyesGlobe2-800.webp 800w, ${ASSET_PATH}chp2-images/EyesGlobe2-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesGlobe2.webp 1920w"       sizes="100vw" width="1920" height="1342" alt="" decoding="async">
            <img id="g2p" class="layer globe-play"   src="${ASSET_PATH}chp2-images/EyesGlobePlay2.webp"   srcset="${ASSET_PATH}chp2-images/EyesGlobePlay2-800.webp 800w, ${ASSET_PATH}chp2-images/EyesGlobePlay2-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesGlobePlay2.webp 1920w"   sizes="100vw" width="1920" height="1342" alt="" decoding="async" fetchpriority="low">
          </div></div>
          <div id="gw3" class="globe-wrap"><div class="globe-scale">
            <img id="g3n" class="layer globe-normal" src="${ASSET_PATH}chp2-images/EyesGlobe3.webp"       srcset="${ASSET_PATH}chp2-images/EyesGlobe3-800.webp 800w, ${ASSET_PATH}chp2-images/EyesGlobe3-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesGlobe3.webp 1920w"       sizes="100vw" width="1920" height="1342" alt="" decoding="async">
            <img id="g3p" class="layer globe-play"   src="${ASSET_PATH}chp2-images/EyesGlobePlay3.webp"   srcset="${ASSET_PATH}chp2-images/EyesGlobePlay3-800.webp 800w, ${ASSET_PATH}chp2-images/EyesGlobePlay3-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesGlobePlay3.webp 1920w"   sizes="100vw" width="1920" height="1342" alt="" decoding="async" fetchpriority="low">
          </div></div>
          <div id="gw4" class="globe-wrap"><div class="globe-scale">
            <img id="g4n" class="layer globe-normal" src="${ASSET_PATH}chp2-images/EyesGlobe4.webp"       srcset="${ASSET_PATH}chp2-images/EyesGlobe4-800.webp 800w, ${ASSET_PATH}chp2-images/EyesGlobe4-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesGlobe4.webp 1920w"       sizes="100vw" width="1920" height="1342" alt="" decoding="async">
            <img id="g4p" class="layer globe-play"   src="${ASSET_PATH}chp2-images/EyesGlobePlay4.webp"   srcset="${ASSET_PATH}chp2-images/EyesGlobePlay4-800.webp 800w, ${ASSET_PATH}chp2-images/EyesGlobePlay4-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesGlobePlay4.webp 1920w"   sizes="100vw" width="1920" height="1342" alt="" decoding="async" fetchpriority="low">
          </div></div>
          <img id="r1"  class="layer" src="${ASSET_PATH}chp2-images/EyesReflet.webp"     srcset="${ASSET_PATH}chp2-images/EyesReflet-800.webp 800w, ${ASSET_PATH}chp2-images/EyesReflet-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesReflet.webp 1920w"     sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="r2"  class="layer" src="${ASSET_PATH}chp2-images/EyesReflet2.webp"    srcset="${ASSET_PATH}chp2-images/EyesReflet2-800.webp 800w, ${ASSET_PATH}chp2-images/EyesReflet2-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesReflet2.webp 1920w"    sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="r3"  class="layer" src="${ASSET_PATH}chp2-images/EyesReflet3.webp"    srcset="${ASSET_PATH}chp2-images/EyesReflet3-800.webp 800w, ${ASSET_PATH}chp2-images/EyesReflet3-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesReflet3.webp 1920w"    sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="r4"  class="layer" src="${ASSET_PATH}chp2-images/EyesReflet4.webp"    srcset="${ASSET_PATH}chp2-images/EyesReflet4-800.webp 800w, ${ASSET_PATH}chp2-images/EyesReflet4-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesReflet4.webp 1920w"    sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="gf1" class="layer" src="${ASSET_PATH}chp2-images/EyesGlobeFixe.webp"  srcset="${ASSET_PATH}chp2-images/EyesGlobeFixe-800.webp 800w, ${ASSET_PATH}chp2-images/EyesGlobeFixe-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesGlobeFixe.webp 1920w"  sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="gf2" class="layer" src="${ASSET_PATH}chp2-images/EyesGlobeFixe2.webp" srcset="${ASSET_PATH}chp2-images/EyesGlobeFixe2-800.webp 800w, ${ASSET_PATH}chp2-images/EyesGlobeFixe2-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesGlobeFixe2.webp 1920w" sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="gf3" class="layer" src="${ASSET_PATH}chp2-images/EyesGlobeFixe3.webp" srcset="${ASSET_PATH}chp2-images/EyesGlobeFixe3-800.webp 800w, ${ASSET_PATH}chp2-images/EyesGlobeFixe3-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesGlobeFixe3.webp 1920w" sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="gf4" class="layer" src="${ASSET_PATH}chp2-images/EyesGlobeFixe4.webp" srcset="${ASSET_PATH}chp2-images/EyesGlobeFixe4-800.webp 800w, ${ASSET_PATH}chp2-images/EyesGlobeFixe4-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesGlobeFixe4.webp 1920w" sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="sk"  class="layer" src="${ASSET_PATH}chp2-images/EyesSkin.webp"        srcset="${ASSET_PATH}chp2-images/EyesSkin-800.webp 800w, ${ASSET_PATH}chp2-images/EyesSkin-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesSkin.webp 1920w"        sizes="100vw" width="1920" height="1342" alt="" decoding="async" fetchpriority="high">
        </main>
        <img id="sk-play1"       src="${ASSET_PATH}chp2-images/EyesSkinPlay1Cut.webp"       srcset="${ASSET_PATH}chp2-images/EyesSkinPlay1Cut-800.webp 800w, ${ASSET_PATH}chp2-images/EyesSkinPlay1Cut-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesSkinPlay1Cut.webp 1920w"            sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <img id="sk-play2"       src="${ASSET_PATH}chp2-images/EyesSkinPlay2Cut.webp"       srcset="${ASSET_PATH}chp2-images/EyesSkinPlay2Cut-800.webp 800w, ${ASSET_PATH}chp2-images/EyesSkinPlay2Cut-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesSkinPlay2Cut.webp 1920w"            sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <img id="sk-play3"       src="${ASSET_PATH}chp2-images/EyesSkinPlay3Cut.webp"       srcset="${ASSET_PATH}chp2-images/EyesSkinPlay3Cut-800.webp 800w, ${ASSET_PATH}chp2-images/EyesSkinPlay3Cut-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesSkinPlay3Cut.webp 1920w"            sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <img id="sk-play4"       src="${ASSET_PATH}chp2-images/EyesSkinPlay4Cut.webp"       srcset="${ASSET_PATH}chp2-images/EyesSkinPlay4Cut-800.webp 800w, ${ASSET_PATH}chp2-images/EyesSkinPlay4Cut-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesSkinPlay4Cut.webp 1920w"            sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <img id="sk-play-final1" src="${ASSET_PATH}chp2-images/EyesSkinPlay1CutFinal.webp" srcset="${ASSET_PATH}chp2-images/EyesSkinPlay1CutFinal-800.webp 800w, ${ASSET_PATH}chp2-images/EyesSkinPlay1CutFinal-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesSkinPlay1CutFinal.webp 1920w" sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <img id="sk-play-final2" src="${ASSET_PATH}chp2-images/EyesSkinPlay2CutFinal.webp" srcset="${ASSET_PATH}chp2-images/EyesSkinPlay2CutFinal-800.webp 800w, ${ASSET_PATH}chp2-images/EyesSkinPlay2CutFinal-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesSkinPlay2CutFinal.webp 1920w" sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <img id="sk-play-final3" src="${ASSET_PATH}chp2-images/EyesSkinPlay3CutFinal.webp" srcset="${ASSET_PATH}chp2-images/EyesSkinPlay3CutFinal-800.webp 800w, ${ASSET_PATH}chp2-images/EyesSkinPlay3CutFinal-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesSkinPlay3CutFinal.webp 1920w" sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <img id="sk-play-final4" src="${ASSET_PATH}chp2-images/EyesSkinPlay4CutFinal.webp" srcset="${ASSET_PATH}chp2-images/EyesSkinPlay4CutFinal-800.webp 800w, ${ASSET_PATH}chp2-images/EyesSkinPlay4CutFinal-1200.webp 1200w, ${ASSET_PATH}chp2-images/EyesSkinPlay4CutFinal.webp 1920w" sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <button id="btn-close" aria-label="Fermer">
          <svg viewBox="0 0 18 18" fill="none">
            <line x1="2" y1="2" x2="16" y2="16"/>
            <line x1="16" y1="2" x2="2" y2="16"/>
          </svg>
        </button>
        <div id="caption-wrap" aria-label="Menu légende">
          <aside id="caption" aria-label="Légende">
            <p>L'échelle de Martin-Schultz est une échelle colorimétrique en 16&nbsp;tons utilisée en anthropologie physique pour déterminer approximativement la couleur des yeux.</p>
          </aside>
          <div id="caption-tab" role="button" aria-label="Afficher la légende" tabindex="0">
            <svg id="caption-tab-svg" aria-hidden="true">
              <path class="bg-path"   id="caption-bg"/>
              <path class="line-path" id="caption-line"/>
            </svg>
          </div>
        </div>
        <div id="video-overlay">
          <video id="voyeur-video" preload="none" playsinline></video>
        </div>
        <div id="text-overlay" role="dialog" aria-modal="true" aria-labelledby="text-quote">
          <div class="text-content">
            <span class="text-label">Témoignage</span>
            <p id="text-quote" class="text-quote">« ça m'a beaucoup questionnée sur la manière dont on construit les récits historiques&nbsp;: qui décide de ce que l'on montre, de ce que l'on cache, et pourquoi&nbsp;? »</p>
          </div>
        </div>
      </div>

      <!-- PEINE DÉMESURÉE -->
      <div id="peine-demesuree-root" aria-hidden="true">
        <svg class="svg-filters" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="rough" x="-8%" y="-8%" width="116%" height="116%">
              <feTurbulence type="fractalNoise" baseFrequency="0.065" numOctaves="4" seed="3" result="noise"/>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
            </filter>
          </defs>
        </svg>
        <div id="cinematic-veil"></div>
        <div class="viewport">
          <div class="wrap" id="main-wrap">
            <div class="titre-bloc" id="titre-bloc">
              <h1 aria-label="L'Humanité">
                <span class="grand-titre" translate="no" id="grand-titre" data-original="l'Humanité">l'Humanité</span>
              </h1>
            </div>
            <div class="meta-row" id="meta-row">
              <div class="meta-gauche" id="meta-gauche">QUATRIEME ANNEE. — N° 997.</div>
              <div class="meta-centre" id="meta-centre">JOURNAL SOCIALISTE QUOTIDIEN</div>
              <div class="meta-droite" id="meta-droite">MERCREDI 9 JANVIER 1907.</div>
            </div>
            <div class="grille draw-border-top" id="grille">
              <div class="col col-prix" id="col-0"><div class="prix-haut"><span class="chiffre-5">5</span><span class="lettre-c">C.</span></div><div class="prix-bas">Le Numéro</div></div>
              <div class="col col-redac" id="col-1">
                <div class="redac-titre">RÉDACTION, ADMINISTRATION &amp; ANNONCES</div>
                <div class="redac-adresse">110, Rue Richelieu, Paris</div>
                <div class="redac-disclaimer">Tout ce qui concerne l'Administration du journal doit être adressé à l'Administrateur.</div>
                <div class="redac-tel">TÉLÉPHONE : 102-69</div>
              </div>
              <div class="col col-directeur" id="col-2"><div class="dir-label">Directeur Politique :</div><div class="dir-nom">JEAN JAURÈS</div></div>
              <div class="col col-abos" id="col-3">
                <div class="abos-entete"><span>ABONNEMENTS</span><span class="col-paris">Paris &amp; Dép.</span><span class="col-etr">Étranger</span></div>
                <div class="abos-ligne"><span class="abos-nom"><span class="abos-mot">Un Mois</span><span class="abos-points">............................................</span></span><span class="px-paris">1 fr. 50</span><span class="px-etr">»&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; »</span></div>
                <div class="abos-ligne"><span class="abos-nom"><span class="abos-mot">Trois Mois</span><span class="abos-points">...........................................</span></span><span class="px-paris">4 fr. 50</span><span class="px-etr">9 fr. &nbsp;&nbsp;&nbsp;»</span></div>
                <div class="abos-ligne"><span class="abos-nom"><span class="abos-mot">Six Mois</span><span class="abos-points">...............................................</span></span><span class="px-paris">9 fr.&nbsp;&nbsp; »</span><span class="px-etr">16 fr. 50</span></div>
                <div class="abos-ligne"><span class="abos-nom"><span class="abos-mot">Un An</span><span class="abos-points">..................................................</span></span><span class="px-paris">18 fr.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span class="px-etr">31 fr.&nbsp;&nbsp;&nbsp; »</span></div>
                <div class="abos-pied">Les Abonnements sont reçus SANS FRAIS dans tous les bureaux de Poste.</div>
              </div>
              <div class="col col-prix" id="col-4"><div class="prix-haut"><span class="chiffre-5">5</span><span class="lettre-c">C.</span></div><div class="prix-bas">Le Numéro</div></div>
            </div>
            <div class="article-main" id="article-main">
              <div class="article-inner">
                <h1 class="article-title"><br>Le meurtrier de Kléber</h1><br>
                <div class="article-column" id="article-column">
                  <div id="marge-titre"></div>
                  <div id="marge-droite"></div>
                  <button class="video-close" id="video-close" type="button" aria-label="Fermer la vidéo">Fermer</button>
                  <div class="article-stage" id="article-stage">
                    <div class="article-text-layer" id="article-text-layer">
                      <div class="article-body-wrap">
                        <div class="article-body article-body-reserve" aria-hidden="true">
                          <p>On vient d'exposer dans les galeries du pavillon d'anatomie comparée, au Muséum, un squelette qui n'y figure d'ailleurs qu'à titre de pièce anatomique, mais qui a son histoire.</p>
                          <p>Ce squelette est celui de Souleiman el Aleby, le meurtrier de Kléber.</p>
                          <p>Souleiman el Aleby n'était point un meurtrier vulgaire. Il avait été <span class="mot-clef" data-key="condamne" data-categorie="Démesure" data-titre="« Condamné par le conseil de guerre »">condamné par le conseil de guerre</span> du Caire à avoir la main droite brûlée, à être empalé et exposé aux oiseaux de proie, simplement.</p>
                          <p>Il subit sa peine le 25 prairial an VIII. Il étendit sur le bûcher la main qui avait frappé le général français, et la laissa griller sans proférer une plainte, sans qu'un muscle de son visage trahît <span class="mot-clef" data-key="souffrance" data-categorie="Témoignage Guillaume" data-titre="« Horrible souffrance »">l'horrible souffrance</span> qu'il endurait. Mais <span class="mot-clef" data-key="bourreau" data-categorie="L'âme noire" data-titre="« le bourreau »">le bourreau</span> qui attisait le brasier ayant laissé tomber son tisonnier rouge sur le bras du condamné, Souleiman el Aleby protesta avec violence&nbsp;:</p>
                          <p>— <span class="mot-clef" data-key="supplice" data-categorie="Au tribunal" data-titre="« Ce supplice, cria-t-il, n'est pas dans mon jugement. »">Ce supplice, cria-t-il, n'est pas dans mon jugement.</span></p>
                          <p>Et ce fut la seule révolte du musulman, qui subit jusqu'au bout sa peine avec le même stoïcisme.</p>
                        </div>
                        <div class="article-body article-body-typing" id="article-body"></div>
                      </div>
                    </div>
                    <div class="article-video-layer" id="article-video-layer" aria-hidden="true">
                      <div class="video-panel" id="media-panel-video">
                        <video id="article-video" controls playsinline preload="metadata"></video>
                      </div>
                      <div class="video-panel" id="media-panel-audio" style="display:none;">
                        <div class="audio-stage">
                          <button class="audio-toggle" id="audio-toggle">Lecture</button>
                          <div class="audio-progress"><div class="audio-bar" id="audio-bar"></div></div>
                          <audio id="article-audio" preload="metadata">
                            <track id="audio-track" kind="subtitles" src="${ASSET_PATH}chp2-medias/temoignage-guillaume.vtt" srclang="fr" default>
                          </audio>
                          <div class="audio-subtitles" id="audio-subtitles"></div>
                        </div>
                      </div>
                    </div>
                    <div class="curtain curtain--left"      aria-hidden="true"></div>
                    <div class="curtain curtain--right"     aria-hidden="true"></div>
                    <div class="curtain-line curtain-line--left"  aria-hidden="true"></div>
                    <div class="curtain-line curtain-line--right" aria-hidden="true"></div>
                  </div>
                </div><br>
                <template id="article-content-template" translate="no">
                  <p>On vient d'exposer dans les galeries du pavillon d'anatomie comparée, au Muséum, un squelette qui n'y figure d'ailleurs qu'à titre de pièce anatomique, mais qui a son histoire.</p>
                  <p>Ce squelette est celui de Souleiman el Aleby, le meurtrier de Kléber.</p>
                  <p>Souleiman el Aleby n'était point un meurtrier vulgaire. Il avait été <span class="mot-clef" data-key="condamne" data-categorie="Démesure" data-titre="« Condamné par le conseil de guerre »">condamné par le conseil de guerre</span> du Caire à avoir la main droite brûlée, à être empalé et exposé aux oiseaux de proie, simplement.</p>
                  <p>Il subit sa peine le 25 prairial an VIII. Il étendit sur le bûcher la main qui avait frappé le général français, et la laissa griller sans proférer une plainte, sans qu'un muscle de son visage trahît <span class="mot-clef" data-key="souffrance" data-categorie="Témoignage Guillaume" data-titre="« Horrible souffrance »">l'horrible souffrance</span> qu'il endurait. Mais <span class="mot-clef" data-key="bourreau" data-categorie="L'âme noire" data-titre="« le bourreau »">le bourreau</span> qui attisait le brasier ayant laissé tomber son tisonnier rouge sur le bras du condamné, Souleiman el Aleby protesta avec violence&nbsp;:</p>
                  <p>— <span class="mot-clef" data-key="supplice" data-categorie="Au tribunal" data-titre="« Ce supplice, cria-t-il, n'est pas dans mon jugement. »">Ce supplice, cria-t-il, n'est pas dans mon jugement.</span></p>
                  <p>Et ce fut la seule révolte du musulman, qui subit jusqu'au bout sa peine avec le même stoïcisme.</p>
                </template>
              </div>
              <div class="article-footer-meta">
                <div class="article-footer-left">Article extrait du journal l'Humanité N°5 de 1907</div>
                <div class="article-footer-right">ABOUNADDARA - CNRS - 2026</div>
              </div>
            </div>
          </div>
        </div>
        <!-- Flèche retour gérée par Chapitre2Scene (ArrowChp2Part 'peine-demesuree') -->
      </div>

      <!-- RIDEAU DE CHARGEMENT — garantie « noir quoi qu'il arrive ».
           Styles 100% INLINE : indépendant des 4 feuilles du chapitre (qui
           peuvent arriver tard) et de l'état du LightSystem (dont le canvas
           d'obscurité naît display:none → le travelling serait visible en
           pleine lumière). Levé sur 'chp2:opening-ready'. -->
      <div id="chp2-boot" style="position:absolute;inset:0;z-index:2147483000;background:#000;opacity:1;pointer-events:none;"></div>
    `;

    app.appendChild(root);
    this._container = root;
  }

  _removeDOM() {
    if (!this._container) return;
    this._container.remove();
    this._container = null;
  }

  /* ── Chargement & rideau ─────────────────────────────────────────────── */

  /**
   * Attend le DÉCODAGE de l'image du travelling (pas seulement son
   * téléchargement) : measure() en dérive imgW, donc la position des lumières
   * et des zones de clic. Ne bloque jamais l'entrée (timeout + résolution
   * sur erreur).
   */
  _waitForImage(timeoutMs = 6000) {
    const img = document.getElementById('chp2-img');
    if (!img) return Promise.resolve();

    const decoded = (async () => {
      try {
        if (img.decode) await img.decode();
        else if (!img.complete) {
          await new Promise(res => {
            img.addEventListener('load',  res, { once: true });
            img.addEventListener('error', res, { once: true });
          });
        }
      } catch { /* image absente : on n'empêche pas l'entrée */ }
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    })();

    const timeout = new Promise(res => this.addTimer(res, timeoutMs));
    return Promise.race([decoded, timeout]);
  }

  /**
   * Résolue quand le module signale que le canvas d'obscurité est en place
   * ('chp2:opening-ready'). Timeout de sécurité : on lève quoi qu'il arrive.
   */
  _waitOpeningReady(timeoutMs = 12000) {
    return new Promise(resolve => {
      const onReady = () => { cleanup(); resolve(); };
      const cleanup = () => window.removeEventListener('chp2:opening-ready', onReady);
      window.addEventListener('chp2:opening-ready', onReady, { once: true });
      this._openingReadyCleanup = cleanup;
      this.addTimer(() => { cleanup(); resolve(); }, timeoutMs);
    });
  }

  /** Lève le rideau noir : dessous, il n'y a plus qu'un aplat noir. */
  _raiseBootCurtain() {
    const boot = document.getElementById('chp2-boot');
    if (!boot) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      boot.style.transition = 'opacity 320ms ease';
      boot.style.opacity    = '0';
      this.addTimer(() => boot.remove(), 400);
    }));
  }

  /* ── CSS ─────────────────────────────────────────────────────────────── */

  /**
   * Injecte les 4 feuilles du chapitre et résout quand elles sont APPLIQUÉES.
   * Idempotent (ré-entrée : <link> déjà présent). 'error' résout aussi, pour ne
   * jamais bloquer l'entrée si un fichier manque.
   */
  _injectCSS() {
    const sheets = [
      { id: 'chp2-css-violence',       href: 'Chapitre2/chp2-style/chp2-violence-et-trace.css' },
      { id: 'chp2-css-opening',        href: 'Chapitre2/chp2-style/chp2-openning.css'          },
      { id: 'chp2-css-invibilisation', href: 'Chapitre2/chp2-style/chp2-invibilisation.css'    },
      { id: 'chp2-css-peine',          href: 'Chapitre2/chp2-style/chp2-peine-demesuree.css'   },
    ];

    return Promise.all(sheets.map(({ id, href }) => new Promise(resolve => {
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.sheet) resolve();
        else existing.addEventListener('load', () => resolve(), { once: true });
        return;
      }
      const link = Object.assign(document.createElement('link'), { id, rel: 'stylesheet', href });
      link.addEventListener('load',  () => resolve(), { once: true });
      link.addEventListener('error', () => resolve(), { once: true });
      document.head.appendChild(link);
    })));
  }

  _removeCSS() {
    CSS_LINK_IDS.forEach(id => document.getElementById(id)?.remove());
  }
}
