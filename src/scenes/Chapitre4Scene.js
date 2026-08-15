import { Scene }            from '../core/Scene.js';
import { bus }              from '../core/EventBus.js';
import { ArrowChp4 }        from '../ui/ArrowChapitre4.js';
// La CONFIG du chapitre (données pures, aucun effet de bord) est importée
// STATIQUEMENT — comme aux chapitres 2 et 3. La scène en a besoin AVANT le
// moteur : pour le sous-titre, affiché pendant le chargement, et pour le chemin
// de la photo, qu'elle doit poser puis attendre. Le MOTEUR, lui, reste en
// import() dynamique (pattern factory).
import { CONFIG as CHP4 }   from '../../Chapitre4/chp4-src/chp4-config.js';
import { releaseMediaElements } from '../utils/helpers.js';

/**
 * Chapitre4Scene — intégration SPA du chapitre 4 (« Une histoire complexe »)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NAVIGATION :
 *  ┌─────────────────────────────────────────────────────────────────────────┐
 *  │  CollaborationScene ──[cercle IV]──► Chapitre4Scene                      │
 *  │    · l'extinction de torche + le fondu au noir + l'arrêt de              │
 *  │      collaboration.mp3 sont déjà assurés par CollaborationScene.exit()   │
 *  │      (générique pour toute destination chapitre).                        │
 *  │    · enter() ouvre le chapitre : page blanche → crâne → fracture →       │
 *  │      cinq bulles dessinées une à une.                                    │
 *  │  Dessin fini ──[flèche ←]──► leaveToCollaboration() (module) : fondu au  │
 *  │      noir + coupe le son, puis 'chp4:navigate-back' → Espace collaboratif│
 *  └─────────────────────────────────────────────────────────────────────────┘
 *
 * LE SEUL ÉCRAN CLAIR DU SITE. Trois conséquences, toutes traitées ailleurs
 * mais qu'il faut avoir en tête ici :
 *   · titre, sous-titre et bouton plein écran passent à l'encre sombre
 *     (style.css, section « CHAPITRE 4 », sous body.chp4-active) ;
 *   · la flèche de retour a sa propre palette (ArrowChapitre4) ;
 *   · l'entrée ne se fait PAS en fondu depuis le noir mais par un lever de
 *     lumière — le rideau se lève sur du noir, et c'est le moteur qui fait
 *     monter le jour. Jamais de flash blanc.
 *
 * AUDIO : le chapitre n'a pas d'ambiance. Ses quatre sons sont portés par les
 * bulles elles-mêmes (éléments <audio> propres, analysés via le contexte Web
 * Audio du site). stopChapitre4() garantit l'arrêt total en sortie.
 *
 * DOM : injecté dans #chapitre4-root (position:fixed, z 500), IDs préfixés
 * chp4-*. PATTERN FACTORY : le module n'a aucun effet de bord au chargement ;
 * startChapitre4() monte le moteur contre le DOM réinjecté, stopChapitre4() le
 * démonte. Import unique, sans cache-bust.
 */

const MODULE_PATH = '../../Chapitre4/';   // depuis src/scenes/ (import())
const CSS_LINK_ID = 'chp4-css-opening';
const CSS_HREF    = 'Chapitre4/chp4-style/chp4-opening.css';

export class Chapitre4Scene extends Scene {
  /**
   * @param {Object} systems
   * @param {Object} systems.audio       AudioManager global
   * @param {Object} systems.bgMgr       BackgroundManager
   * @param {Object} systems.transition  TransitionManager
   */
  constructor(systems) {
    super('chapitre4');

    this.audio      = systems.audio;
    this.bgMgr      = systems.bgMgr;
    this.transition = systems.transition;

    /** Flèche de retour → Espace collaboratif (encre sombre : page claire). */
    this._arrow = new ArrowChp4(window.CONFIG);

    /** DOM conteneur du chapitre 4. */
    this._container = null;

    /** Module chp4-opening chargé dynamiquement. */
    this._module = null;

    /** Listeners window ('chp4:navigate-back') à retirer en sortie. */
    this._windowListeners = [];
  }

  /* ── Cycle de vie ──────────────────────────────────────────────────────── */

  async enter(params = {}) {
    await super.enter(params);

    this._pendingTo = null;       // réarmé à chaque entrée
    this._pendingParams = null;

    try {
      // Contexte chapitre 4 : curseur custom, remontée z des titres et du
      // bouton plein écran au-dessus du root (z 500), et bascule de tout ce
      // petit monde en encre sombre (cf. body.chp4-active dans style.css).
      document.body.classList.add('chp4-active');

      this.bgMgr.blackout();
      await this.transition.fadeVeil(0, 0);

      // Tier 2 : sous-titre du chapitre sous « Espace collaboratif »
      // (#site-title reste géré par CollaborationScene).
      this._showSubtitle();

      // ── ORDRE D'ENTRÉE (noir garanti, zéro flash) ──────────────────────
      // 1. CSS AVANT le DOM : la photo naît à `opacity:0` par la feuille (et
      //    par un style en ligne, en secours). Injecter le DOM d'abord
      //    montrerait le crâne à nu le temps que le <link> arrive.
      // 2. DOM injecté AVEC son rideau noir (#chp4-boot, styles en ligne).
      // 3. Attente du DÉCODAGE de la photo — 2592 × 1728, elle ne doit pas
      //    apparaître par bandes au moment où le moteur la révèle.
      // 4. Module chargé, œuvre chargée et mise en état → 'chp4:page-ready'.
      // 5. Levée du rideau : dessous, l'écran est noir (#chp4-dawn), et c'est
      //    le moteur qui fait monter la lumière.
      await this._injectCSS();
      this._injectDOM();
      await this._waitForImage();

      // Listener de retour (avant le module, par sûreté).
      this._registerWindowListeners();

      this._module = await import(`${MODULE_PATH}chp4-src/chp4-opening.js`);

      // Le contexte Web Audio du site sert à l'analyse des ondes dans les
      // bulles ; les sons, eux, restent internes au chapitre.
      this._module.setAudioManager?.(this.audio);

      // Pont flèche : le moteur la fait paraître quand TOUT est dessiné, et
      // la retire au départ.
      this._module.setArrowCallbacks?.(
        () => this._showArrow(),
        () => this._arrow.hide()
      );

      // ⚠️ S'abonner AVANT de démarrer : startChapitre4() émet
      // 'chp4:page-ready' au cours de son exécution, une écoute posée après
      // serait trop tardive.
      const pageReady = this._waitPageReady();

      await this._module.startChapitre4?.();

      await pageReady;
      this._raiseBootCurtain();

      // Le site change de scène sans changer d'URL : sans ce signal, ni le
      // lecteur d'écran ni le titre de l'onglet n'apprennent l'arrivée — et
      // la carte ne sait pas où allumer son point.
      bus.emit('scene:entered', { name: 'chapitre4' });

    } catch (err) {
      if (err?.message === 'scene_aborted') return;
      console.error('[Chapitre4Scene] Erreur enter() :', err);
      // Secours : ne jamais rester bloqué derrière le rideau noir.
      this._raiseBootCurtain();
    }
  }

  async exit(params = {}) {
    try { await this._module?.stopChapitre4?.(); } catch { /* absorbé */ }

    this._arrow.hide();
    this._unregisterWindowListeners();
    this._pageReadyCleanup?.();
    this._pageReadyCleanup = null;

    this._hideSubtitle();

    document.body.classList.remove('chp4-active');
    this._removeDOM();
    this._removeCSS();
    this._module = null;

    await super.exit(params);

    this.bgMgr.blackout();
    await this.transition.fadeVeil(0, 0);
  }

  onResize() {
    this._arrow.resize?.();
    this._applySubtitleFont(document.getElementById('chapitre-subtitle'));
    // Le dessin lui-même n'a rien à recalculer (il vit dans le viewBox du SVG,
    // le navigateur le remet à l'échelle) — mais la RÉPARTITION entre la
    // photographie et le dessin suit la forme de la fenêtre : c'est le moteur
    // qui la refait. Voir chp4-config → layout.
    this._module?.onResize?.();
  }

  /* ── Sous-titre (tier 2) ────────────────────────────────────────────────
     Réutilise le #chapitre-subtitle statique de index.html — même mécanique
     qu'aux chapitres 2 et 3 (fondu + translation portés par .visible en CSS).
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
    if (!CHP4.subtitle) {
      console.warn('[chp4] chp4-config.subtitle absent : aucun sous-titre affiché.');
      return;
    }
    el.innerHTML = CHP4.subtitle;
    this._applySubtitleFont(el);
    // Temporisation : ne pas chevaucher le fondu d'entrée de scène.
    this.addTimer(() => { if (this.isActive) el.classList.add('visible'); }, 400);
  }

  /**
   * @param {boolean} immediate  true  → coupe net (retour Espace collaboratif),
   *                             false → laisse jouer la transition CSS de sortie.
   */
  _hideSubtitle(immediate = true) {
    const el = document.getElementById('chapitre-subtitle');
    if (!el) return;
    if (immediate) {
      el.style.transition = 'none';
      el.classList.remove('visible');
      requestAnimationFrame(() => { el.style.transition = ''; });
    } else {
      el.classList.remove('visible');
    }
  }

  /* ── Flèche de retour ──────────────────────────────────────────────────── */

  _showArrow() {
    if (!this.isActive) return;
    this._arrow.show(() => this._leaveToCollaboration());
  }

  /**
   * Départ vers une destination QUELCONQUE en gardant la sortie écrite du
   * chapitre (fondu, son coupé). La flèche de retour est le cas particulier
   * leaveTo('collaboration') ; la carte peut viser plus loin.
   */
  leaveTo(to, params = {}) {
    this._pendingTo     = to;
    this._pendingParams = params;
    this._leaveToCollaboration();
  }

  _leaveToCollaboration() {
    // Le fondu #chp4-fade vit DANS #chapitre4-root (z 500) alors que le
    // sous-titre est remonté à z 600 : sans ceci il flotterait au-dessus du
    // noir puis disparaîtrait sèchement. On le fait s'effacer en douceur, en
    // parallèle du fondu du moteur (~1,1 s).
    this._hideSubtitle(false);

    if (this._module?.leaveToCollaboration) {
      this._module.leaveToCollaboration();
    } else {
      // Filet de sécurité : navigation directe si le module n'expose rien.
      bus.emit('navigate', { to: this._pendingTo ?? 'collaboration', from: 'chapitre4', ...(this._pendingParams ?? {}) });
    }
  }

  /* ── Listeners window ──────────────────────────────────────────────────── */

  _registerWindowListeners() {
    this._unregisterWindowListeners();

    // Émis par le moteur une fois le fondu au noir atteint et le son coupé.
    const onNavBack = () => {
      if (this.isActive) {
        bus.emit('navigate', { to: this._pendingTo ?? 'collaboration', from: 'chapitre4', ...(this._pendingParams ?? {}) });
      }
    };
    window.addEventListener('chp4:navigate-back', onNavBack);
    this._windowListeners.push({ event: 'chp4:navigate-back', fn: onNavBack });
  }

  _unregisterWindowListeners() {
    this._windowListeners.forEach(({ event, fn }) =>
      window.removeEventListener(event, fn)
    );
    this._windowListeners = [];
  }

  /* ── DOM ─────────────────────────────────────────────────────────────────
     Le moteur ne crée que le SVG de l'œuvre, qu'il greffe dans #chp4-art. Tout
     le reste — la scène, la photo, le lever de lumière, le fondu de sortie —
     est posé ici, avant même que le module ne soit téléchargé : c'est ce qui
     permet d'attendre le décodage de la photo pendant que le module arrive.
  ─────────────────────────────────────────────────────────────────────────── */

  _injectDOM() {
    if (this._container) return;
    const app = document.getElementById('app');
    if (!app) return;

    const root = document.createElement('div');
    root.id = 'chapitre4-root';
    root.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:500',
      'overflow:hidden', 'background:#000',
    ].join(';');

    root.innerHTML = /* html */`
      <div id="chp4-stage">

        <!-- LE CRÂNE — opacity:0 en INLINE (et pas seulement via la feuille) :
             si le CSS tardait, la photo s'afficherait à nu par-dessus le noir
             d'ouverture. Le moteur pilote ensuite cette même propriété. -->
        <div id="chp4-photo-wrap">
          <img id="chp4-photo" style="opacity:0"
               src="${CHP4.assets.photo}"
               alt="" draggable="false" decoding="async">
          <div id="chp4-photo-veil"></div>
        </div>

        <!-- LE DESSIN — l'œuvre y est greffée par le moteur (chargée en fetch
             puis inlinée, seul moyen d'atteindre chaque tracé pour l'animer). -->
        <div id="chp4-art"></div>

        <!-- PROFONDEUR — lumière et matière du papier, par-dessus tout le
             reste et transparents au clic (cf. chp4-config → depth). -->
        <div id="chp4-vignette"></div>
        <div id="chp4-grain"></div>
      </div>

      <!-- LE LEVER DE LUMIÈRE — noir opaque au départ : c'est ce que le rideau
           découvre. Le moteur fait ensuite monter le halo puis effacer le noir. -->
      <div id="chp4-dawn"><div id="chp4-bloom"></div></div>

      <!-- FONDU DE SORTIE → Espace collaboratif (piloté par leaveToCollaboration) -->
      <div id="chp4-fade"></div>

      <!-- RIDEAU DE CHARGEMENT — garantie « noir quoi qu'il arrive ».
           Styles 100 % EN LIGNE : ne dépend NI de la feuille du chapitre (qui
           peut arriver tard), NI d'une variable CSS, NI de l'état du moteur.
           Levé sur le signal 'chp4:page-ready', quand l'œuvre est chargée et
           mise en état — dessous, il n'y a qu'un aplat noir. -->
      <div id="chp4-boot" style="position:absolute;inset:0;z-index:2147483000;background:#000;opacity:1;pointer-events:none;"></div>
    `;

    app.appendChild(root);
    this._container = root;
  }

  _removeDOM() {
    if (!this._container) return;
    // Libération des médias avant retrait — même raison qu'au chapitre 2 (voir
    // releaseMediaElements). Les sons des bulles vivent ici.
    releaseMediaElements(this._container);
    this._container.remove();
    this._container = null;
  }

  /* ── Chargement & révélation ───────────────────────────────────────────── */

  /**
   * Attend que la photo du crâne soit DÉCODÉE (pas seulement téléchargée) :
   * 2592 × 1728, elle apparaîtrait par bandes si le moteur la révélait pendant
   * son décodage. Ne bloque jamais l'entrée : délai de garde + résolution sur
   * erreur (mieux vaut un chapitre sans photo qu'un écran noir).
   */
  _waitForImage(timeoutMs = 8000) {
    const img = document.getElementById('chp4-photo');
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
      } catch { /* image absente ou décodage refusé : on n'empêche pas l'entrée */ }
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    })();

    const timeout = new Promise(res => this.addTimer(res, timeoutMs));
    return Promise.race([decoded, timeout]);
  }

  /**
   * Promesse résolue quand le moteur signale que l'œuvre est montée
   * ('chp4:page-ready'). Doit être créée AVANT startChapitre4().
   * Délai de garde : on lève le rideau quoi qu'il arrive.
   */
  _waitPageReady(timeoutMs = 12000) {
    return new Promise(resolve => {
      const onReady = () => { cleanup(); resolve(); };
      const cleanup = () => window.removeEventListener('chp4:page-ready', onReady);
      window.addEventListener('chp4:page-ready', onReady, { once: true });
      this._pageReadyCleanup = cleanup;
      this.addTimer(() => { cleanup(); resolve(); }, timeoutMs);
    });
  }

  /**
   * Lève le rideau noir. Sous lui, #chp4-dawn est un aplat noir opaque : la
   * levée ne dévoile donc jamais le dessin — c'est le moteur qui, ensuite,
   * fait monter la lumière.
   */
  _raiseBootCurtain() {
    const boot = document.getElementById('chp4-boot');
    if (!boot) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      boot.style.transition = 'opacity 320ms ease';
      boot.style.opacity    = '0';
      this.addTimer(() => boot.remove(), 400);
    }));
  }

  /* ── CSS ─────────────────────────────────────────────────────────────── */

  /**
   * Injecte la feuille du chapitre et résout QUAND elle est appliquée.
   * Idempotent : sur une ré-entrée, le <link> déjà présent est réutilisé.
   * 'error' résout aussi → ne bloque jamais l'entrée si le fichier manque.
   */
  _injectCSS() {
    return new Promise((resolve) => {
      const existing = document.getElementById(CSS_LINK_ID);
      if (existing) {
        if (existing.sheet) resolve();
        else existing.addEventListener('load', () => resolve(), { once: true });
        return;
      }
      const link = Object.assign(document.createElement('link'), {
        id:   CSS_LINK_ID,
        rel:  'stylesheet',
        href: CSS_HREF,
      });
      link.addEventListener('load',  () => resolve(), { once: true });
      link.addEventListener('error', () => resolve(), { once: true });
      document.head.appendChild(link);
    });
  }

  _removeCSS() {
    document.getElementById(CSS_LINK_ID)?.remove();
  }
}
