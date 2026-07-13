/**
 * OrientationLock.js
 * -----------------------------------------------------------------------------
 * Sur TÉLÉPHONE, impose le mode paysage (horizontal). En portrait :
 *   - un overlay noir plein écran couvre TOUT le site,
 *   - un message invite à tourner l'appareil,
 *   - le son est coupé (AudioContext suspendu + tous les <audio>/<video> en pause),
 *   - le média repris exactement où il en était dès le retour en paysage.
 *
 * Autonome et découplé : aucun couplage avec les scènes. Il tente d'abord le
 * VRAI verrouillage matériel (screen.orientation.lock, dispo en plein écran /
 * PWA sur Android) ; si l'API n'est pas disponible ou refuse (cas d'iOS
 * notamment), il retombe sur l'overlay + coupure son, qui suffit à garantir
 * l'expérience.
 *
 * Cible : appareils TACTILES (pointer: coarse). Sur desktop, un portrait de
 * fenêtre est légitime → le verrou ne s'active pas.
 *
 * Intégration (une ligne dans index.html, avant </body>) :
 *   <script type="module">
 *     import { OrientationLock } from './src/systems/OrientationLock.js';
 *     OrientationLock.init();
 *   </script>
 * Ou, si un AudioManager central existe, lui passer son AudioContext pour une
 * coupure/reprise plus fine :
 *   OrientationLock.init({ audioContext: audio.getContext() });
 */

const OVERLAY_ID = 'orientation-lock';

export const OrientationLock = {
  _overlay: null,
  _audioCtx: null,
  _pausedMedia: [],
  _ctxWasRunning: false,
  _active: false,
  _started: false,

  /**
   * @param {Object}  [opts]
   * @param {AudioContext} [opts.audioContext]  Contexte Web Audio à suspendre.
   * @param {string}  [opts.message]            Texte affiché en portrait.
   */
  init(opts = {}) {
    if (this._started) return;
    this._started  = true;
    this._audioCtx = opts.audioContext ?? null;
    this._message  = opts.message ?? 'Veuillez tourner votre appareil';

    // Uniquement sur appareil tactile : un desktop en fenêtre portrait est OK.
    this._isTouch = window.matchMedia?.('(pointer: coarse)').matches
                 || 'ontouchstart' in window;
    if (!this._isTouch) return;

    this._buildOverlay();

    // Écoute des changements d'orientation, par tous les canaux disponibles.
    const check = () => this._evaluate();
    window.addEventListener('resize', check, { passive: true });
    window.addEventListener('orientationchange', check, { passive: true });
    if (screen.orientation?.addEventListener) {
      screen.orientation.addEventListener('change', check);
    } else {
      const mq = window.matchMedia('(orientation: portrait)');
      mq.addEventListener?.('change', check);
    }

    // Tentative de VERROUILLAGE matériel (échoue silencieusement si indispo).
    this._tryHardLock();

    this._evaluate();
  },

  /** Permet d'injecter/mettre à jour l'AudioContext après coup. */
  setAudioContext(ctx) { this._audioCtx = ctx; },

  /* ── Détection ─────────────────────────────────────────────────────────── */

  _isPortrait() {
    // On privilégie l'API orientation ; repli sur les dimensions.
    const t = screen.orientation?.type;
    if (t) return t.startsWith('portrait');
    if (typeof window.orientation === 'number') {
      return window.orientation === 0 || window.orientation === 180;
    }
    return window.innerHeight > window.innerWidth;
  },

  _evaluate() {
    if (!this._isTouch) return;
    const portrait = this._isPortrait();
    if (portrait && !this._active) this._activate();
    else if (!portrait && this._active) this._deactivate();
  },

  /* ── Activation / désactivation ────────────────────────────────────────── */

  _activate() {
    this._active = true;
    this._muteAll();
    if (this._overlay) {
      this._overlay.style.display = 'flex';
      requestAnimationFrame(() => this._overlay.classList.add('visible'));
    }
  },

  _deactivate() {
    this._active = false;
    if (this._overlay) {
      this._overlay.classList.remove('visible');
      const el = this._overlay;
      setTimeout(() => { if (!this._active) el.style.display = 'none'; }, 420);
    }
    this._unmuteAll();
    // Nouvelle tentative de verrouillage : l'utilisateur vient de passer en
    // paysage, c'est le bon moment (souvent lié à un geste).
    this._tryHardLock();
  },

  /* ── Son & médias ──────────────────────────────────────────────────────── */

  _muteAll() {
    // 1. Web Audio : suspendre le contexte central (coupe toute la synthèse).
    if (this._audioCtx && this._audioCtx.state === 'running') {
      this._ctxWasRunning = true;
      this._audioCtx.suspend().catch(() => {});
    }
    // 2. Éléments média HTML (<audio>/<video> des chapitres) : pause + mémoire.
    this._pausedMedia = [];
    document.querySelectorAll('audio, video').forEach(m => {
      if (!m.paused) {
        this._pausedMedia.push(m);
        try { m.pause(); } catch {}
      }
    });
  },

  _unmuteAll() {
    if (this._ctxWasRunning && this._audioCtx) {
      this._ctxWasRunning = false;
      this._audioCtx.resume().catch(() => {});
    }
    // On NE force PAS la reprise des <video> (l'utilisateur peut ne pas vouloir
    // que ça reparte seul) — sauf s'ils tournaient : on relance à l'identique.
    this._pausedMedia.forEach(m => { m.play?.().catch(() => {}); });
    this._pausedMedia = [];
  },

  /* ── Verrouillage matériel (best effort) ───────────────────────────────── */

  async _tryHardLock() {
    try {
      if (screen.orientation?.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch {
      // Indisponible (iOS, hors plein écran…) : l'overlay prend le relais.
    }
  },

  /* ── Overlay ───────────────────────────────────────────────────────────── */

  _buildOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;

    const el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.innerHTML = `
      <div class="ol-inner">
        <div class="ol-icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="6" width="24" height="42" rx="4"
                  stroke="currentColor" stroke-width="2"/>
            <path class="ol-rot" d="M12 40 A 22 22 0 0 0 40 54"
                  stroke="currentColor" stroke-width="2" fill="none"
                  stroke-linecap="round"/>
            <path d="M40 54 l-5 -1 M40 54 l-1 -5"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <p class="ol-text">${this._message}</p>
      </div>`;

    document.body.appendChild(el);
    this._overlay = el;
    this._injectCSS();
  },

  _injectCSS() {
    if (document.getElementById('orientation-lock-css')) return;
    const style = document.createElement('style');
    style.id = 'orientation-lock-css';
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483600;            /* au-dessus de TOUT le site */
        display: none;
        align-items: center;
        justify-content: center;
        background: #000;
        opacity: 0;
        transition: opacity 400ms ease;
        cursor: none;
        -webkit-tap-highlight-color: transparent;
      }
      #${OVERLAY_ID}.visible { opacity: 1; }
      #${OVERLAY_ID} .ol-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.6em;
        padding: 8vw;
        text-align: center;
        color: rgba(210, 175, 90, 0.92);
      }
      #${OVERLAY_ID} .ol-icon {
        width: clamp(52px, 16vw, 88px);
        color: rgba(210, 175, 90, 0.88);
        animation: olTilt 2.4s ease-in-out infinite;
      }
      #${OVERLAY_ID} .ol-icon svg { width: 100%; height: auto; display: block; }
      #${OVERLAY_ID} .ol-text {
        font-family: 'Cinzel', serif;
        font-size: clamp(0.8rem, 3.4vw, 1.15rem);
        font-weight: 400;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        line-height: 1.6;
        color: rgba(236, 228, 212, 0.9);
      }
      /* Bascule douce de l'icône : suggère le geste de rotation. */
      @keyframes olTilt {
        0%, 100% { transform: rotate(0deg); }
        50%      { transform: rotate(-90deg); }
      }
      @media (prefers-reduced-motion: reduce) {
        #${OVERLAY_ID} .ol-icon { animation: none; }
      }
    `;
    document.head.appendChild(style);
  },
};
