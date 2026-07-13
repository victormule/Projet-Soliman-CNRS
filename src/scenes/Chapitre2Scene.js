import { Scene }            from '../core/Scene.js';
import { bus }              from '../core/EventBus.js';
import { ArrowChp2Opening, ArrowChp2Part } from '../ui/ArrowChapitre2.js';
import { CloseCross }       from '../ui/CloseCross.js';
import { runSkippableQuoteSequence } from '../sequences/QuoteSequence.js';
import { SkipButton }       from '../ui/SkipButton.js';
import { CONFIG as CHP2 }   from '../../Chapitre2/chp2-src/chp2-config.js';
import { buildChapitre2DOM } from '../../Chapitre2/chp2-src/chp2-dom.js';

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

      // Charger et démarrer le module openning (pattern factory : aucun effet
      // de bord au chargement ; startChapitre2() fait l'init contre le DOM
      // fraîchement injecté, stopChapitre2() défait tout). Le module n'est
      // donc téléchargé et évalué qu'UNE fois pour toute la session.
      this._module = await import(
        `${MODULE_PATH}chp2-src/chp2-openning.js`
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

    root.innerHTML = buildChapitre2DOM(ASSET_PATH);

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
