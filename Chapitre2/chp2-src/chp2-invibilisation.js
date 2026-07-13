/**
 * chp2-invibilisation.js — Logique de l'installation "Invibilisation".
 *
 * ÉTAPE 3 : module ESM avec API publique mount/unmount.
 *
 * Différences avec l'original :
 *   - IIFE → module ESM exposant openInvibilisation() / closeInvibilisation() / isInvibilisationOpen().
 *   - Init lazy : tout le code top-level est déplacé dans mount(root). Tant que
 *     openInvibilisation() n'est pas appelé, rien ne tourne.
 *   - DOM scopé : document.getElementById('X') → root.querySelector('#X').
 *     Cela permet à #scene (et autres IDs) de coexister avec le travelling.
 *   - Listeners traçables : tous les addEventListener (document, window) sont
 *     enregistrés et retirés au destroy(). RAF et timeouts également.
 *   - Médias et SRT remappés : `media/X` → `chp2-medias/X`.
 *   - Cycle re-ouvrable : open → close → re-open repart d'un état propre.
 *     Le loader n'est plus `.remove()` mais caché en CSS pour pouvoir être réutilisé.
 *
 * Le code interne (calculs zoom, hover RAF, oscillateurs trembles, SRT…) est
 * conservé à l'identique. Le refactor est structurel, pas algorithmique.
 *
 * Chemins assets attendus :
 *   chp2-images/Eyes*.webp
 *   chp2-medias/Voyeur.mp4, chp2-medias/lea.mp4, chp2-medias/violence.mp3,
 *   chp2-medias/violence.srt
 */

'use strict';

/* =============================================================================
   ÉTAT DU MODULE
============================================================================= */

let _mounted = null;  // { root, destroy } quand l'installation est ouverte, null sinon

export function isInvibilisationOpen() {
  return _mounted !== null;
}

/** Ouvre l'installation. No-op si déjà ouverte. Retourne true si l'ouverture a eu lieu. */
/** Helper curseur doux (#cursor.hotspot-soft) — pulse atténué d'invibilisation. */
function setEyeSoftCursor(on) {
  const c = document.getElementById('cursor');
  if (c) c.classList.toggle('hotspot-soft', !!on);
}

export function openInvibilisation() {
  if (_mounted) return false;
  const root = document.getElementById('invibilisation-root');
  if (!root) {
    console.error('[Invibilisation] Élément #invibilisation-root introuvable.');
    return false;
  }
  root.classList.add('is-open');
  _mounted = mount(root);
  return true;
}

/** Ferme l'installation et nettoie tout. */
export function closeInvibilisation() {
  if (!_mounted) return false;
  _mounted.destroy();
  _mounted = null;
  const root = document.getElementById('invibilisation-root');
  if (root) root.classList.remove('is-open');
  window.dispatchEvent(new CustomEvent('invibilisation:closed'));
  return true;
}

/* =============================================================================
   MONTAGE — tout le code original tourne ici, dans un scope par-mount.
============================================================================= */

function mount(root) {

/* ----- helpers de scoping DOM ----- */
const $ = (id) => root.querySelector('#' + id);
const $$ = (sel) => root.querySelectorAll(sel);

/* ----- registres de cleanup ----- */
const _listeners = [];        // [{ target, type, fn, opts }]
const _timeouts  = [];        // setTimeout ids
const _rafs      = [];        // requestAnimationFrame ids

function on(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  _listeners.push({ target, type, fn, opts });
}

function setT(fn, ms) {
  const id = setTimeout(() => {
    const i = _timeouts.indexOf(id);
    if (i >= 0) _timeouts.splice(i, 1);
    fn();
  }, ms);
  _timeouts.push(id);
  return id;
}

function rafT(fn) {
  const id = requestAnimationFrame((t) => {
    const i = _rafs.indexOf(id);
    if (i >= 0) _rafs.splice(i, 1);
    fn(t);
  });
  _rafs.push(id);
  return id;
}

/* =============================================================================
   CONFIGURATION (constantes du module original)
============================================================================= */

const IMG_W = 1920;
const IMG_H = 1342;

const R_WAKE  = 0.34;
const R_CLOSE = 0.06;

const MAX_MOVE   = 0.009;
const LERP_SPEED = 0.055;

const T_WAKE_FADE  = 400;
const T_SLEEP_FADE = 700;

const TREMBLE_AMP = 0.35;
const TREMBLE_FREQ = [
  { wx: 0.11 * Math.PI * 2, wy: 0.17 * Math.PI * 2, px: 0.0, py: 1.3 },
  { wx: 0.23 * Math.PI * 2, wy: 0.09 * Math.PI * 2, px: 2.1, py: 0.7 },
];
const TREMBLE_INV_N = 1 / TREMBLE_FREQ.length;

const T_PLAY_IN   = 600;
const T_SCALE_IN  = 700;
const SCALE_MAX   = 1.05;
const T_PLAY_OUT  = 700;
const T_SCALE_OUT = 800;
const EASE_FADE_IN   = 'cubic-bezier(0.4, 0, 0.6, 1)';
const EASE_FADE_OUT  = 'cubic-bezier(0.4, 0, 0.6, 1)';
const EASE_SCALE_IN  = 'cubic-bezier(0.2, 0, 0.2, 1)';
const EASE_SCALE_OUT = 'cubic-bezier(0.4, 0, 0.2, 1)';

const ZOOM_DURATION = 3600;

const ZOOM_EASE     = 'cubic-bezier(0.8, 0, 1, 1)';

const GLOBE_EASE    = 'cubic-bezier(0.4, 0, 0.2, 1)';

const T_LOADER_HOLD = 1200;
const T_LOADER_FADE = 2000;

const UNZOOM_DUR    = 1800;
const UNZOOM_EASE   = 'cubic-bezier(0.4, 0, 0.2, 1)';

const UNZOOM_GLOBE_DUR  = 1600;
const UNZOOM_GLOBE_EASE = 'cubic-bezier(0.45, 0, 0.55, 1)';

const GLOBE_PROGRESS_END  = 0.20;
const T_CROSSFADE_START   = Math.round(ZOOM_DURATION * 0.16);
const T_CROSSFADE_DUR     = 1200;
const T_CROSSFADE_FINAL_START = Math.round(ZOOM_DURATION * 0.30);
const T_CROSSFADE_FINAL_DUR   = 1800;
const T_VIDEO_AFTER_ZOOM  = 400;

const T_UNCROSSFADE_FINAL_DUR = Math.round(UNZOOM_DUR * 0.60);
const T_UNCROSSFADE_CUT_DUR   = Math.round(UNZOOM_DUR * 0.24);
const T_UNCROSSFADE_CUT_DELAY = T_UNCROSSFADE_FINAL_DUR;

function lerp(a, b, t) { return a + (b - a) * t; }

function setOpacity(el, v, ms, ease) {
  el.style.transition = `opacity ${ms}ms ${ease || 'ease'}`;
  el.style.opacity    = String(v);
}

function setScale(el, v, ms, ease) {
  el.style.transition = `transform ${ms}ms ${ease}`;
  el.style.transform  = `scale(${v})`;
}

function clearTransition(el) {
  el.style.transition = '';
}

let rect = buildRect();

function buildRect() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ir = IMG_W / IMG_H;
  const vr = vw / vh;
  if (vr > ir) {

    const rH = vh;
    const rW = rH * ir;
    return { rW, rH, oX: (vw - rW) / 2, oY: 0, vw, vh };
  } else {

    const rW = vw;
    const rH = rW / ir;
    return { rW, rH, oX: 0, oY: (vh - rH) / 2, vw, vh };
  }
}

function imgToViewport(cx, cy) {
  return {
    x: rect.oX + rect.rW * cx,
    y: rect.oY + rect.rH * cy,
  };
}

function projectToViewport(cx, cy, S, sceneTx, sceneTy) {
  const { vw, vh } = rect;
  const O  = { x: vw / 2, y: vh / 2 };
  const px = rect.oX + rect.rW * cx;
  const py = rect.oY + rect.rH * cy;
  return {
    x: S * (px - O.x) + O.x + sceneTx,
    y: S * (py - O.y) + O.y + sceneTy,
  };
}

const EYES_CFG = [
  {
    wrap:'gw1', gN:'g1n', gP:'g1p', fixe:'gf1',
    cx: 0.6162, cy: 0.3894,
    hasVideo: true,
    skPlayId: 'sk-play1',
    skPlayFinalId: 'sk-play-final1',
    videoSrc: 'Chapitre2/chp2-medias/Voyeur.mp4',
    cutL: 1289.0 / 2600,
    cutT:  482.4 / 1817,
    cutW:  623.6 / 2600,
    cutH:  462.1 / 1817,

    cutFinalScale:    12.15,
    cutFinalOX:        -2  / 2600,
    cutFinalOY:        2  / 1817,
    cutFinalStretchX:  0.95,
    cutFinalStretchY:  1,

    zoomScale:  120,
    sceneCX:   0  / 2600,
    sceneCY: +10  / 1817,
    globeOX: -12  / 2600,
    globeOY: +38  / 1817,
  },
  {
    wrap:'gw2', gN:'g2n', gP:'g2p', fixe:'gf2',
    cx: 0.4019, cy: 0.3795,
    hasVideo: true,
    skPlayId: 'sk-play2',
    skPlayFinalId: 'sk-play-final2',
    videoSrc: 'Chapitre2/chp2-medias/lea.mp4',
    cutL:  727.8 / 2600,
    cutT:  463.0 / 1817,
    cutW:  644.0 / 2600,
    cutH:  480.0 / 1817,
    cutFinalScale:    12,
    cutFinalOX:        1  / 2600,
    cutFinalOY:        0  / 1817,
    cutFinalStretchX:  0.95,
    cutFinalStretchY:  1.05,

    zoomScale:  120,
    sceneCX:   0  / 2600,
    sceneCY:  +18  / 1817,
    globeOX:  +16  / 2600,
    globeOY:  +30  / 1817,
  },
  {
    wrap:'gw3', gN:'g3n', gP:'g3p', fixe:'gf3',
    cx: 0.3994, cy: 0.6183,
    hasVideo: true,
    hasAudioOnly: true,
    skPlayId: 'sk-play3',
    skPlayFinalId: 'sk-play-final3',
    videoSrc: null,
    audioSrc: 'Chapitre2/chp2-medias/violence.mp3',
    cutL:  723.2 / 2600,
    cutT:  868.8 / 1817,
    cutW:  637.8 / 2600,
    cutH:  472.1 / 1817,
    cutFinalScale:    12.1,
    cutFinalOX:        -1  / 2600,
    cutFinalOY:        1  / 1817,
    cutFinalStretchX:  0.95,
    cutFinalStretchY:  1,

    zoomScale:  120,
    sceneCX:   +2  / 2600,
    sceneCY:  -12  / 1817,
    globeOX:  +18  / 2600,
    globeOY:  -22  / 1817,
  },
  {
    /* Œil 4 — testimonial (texte au lieu de média).
       Position : symétrique de l'œil 3 dans la grille de l'écrin
       (case bas-droite). hasText:true déclenche l'overlay texte
       après la séquence de zoom standard.
       Les skPlayId/skPlayFinalId sont laissés null tant que
       les images SkinPlay4Cut(.Final).webp ne sont pas fournies :
       l'overlay texte plein-écran masque le scene zoomée 120x,
       donc aucun glitch visuel n'est perceptible.                */
    wrap:'gw4', gN:'g4n', gP:'g4p', fixe:'gf4',
    cx: 0.6100, cy: 0.6266,
    hasVideo: false,
    hasAudioOnly: false,
    hasText: true,
    skPlayId: 'sk-play4',
    skPlayFinalId: 'sk-play-final4',
    videoSrc: null,
    audioSrc: null,
    /* Cut box mirrorée de l'œil 3 (au cas où les images skinPlay4
       seraient ajoutées plus tard — la zone est déjà calibrée). */
    cutL: 1280.0 / 2600,
    cutT:  884.8 / 1817,
    cutW:  628.8 / 2600,
    cutH:  472.1 / 1817,
    cutFinalScale:    12.1,
    cutFinalOX:        +2  / 2600,
    cutFinalOY:        +1  / 1817,
    cutFinalStretchX:  0.90,
    cutFinalStretchY:  0.95,

    zoomScale:  120,
    sceneCX:   9  / 2600,
    sceneCY:  -14  / 1817,
    globeOX:  0  / 2600,
    globeOY:  -22  / 1817,
  },
];

const eyes = EYES_CFG.map(cfg => {
  const wEl  = $(cfg.wrap);
  const sEl  = wEl.querySelector('.globe-scale');
  const gNEl = $(cfg.gN);
  const gPEl = $(cfg.gP);
  const gfEl = $(cfg.fixe);
  const skPlayEl      = cfg.skPlayId      ? $(cfg.skPlayId)      : null;
  const skPlayFinalEl = cfg.skPlayFinalId ? $(cfg.skPlayFinalId) : null;

  const stX  = (cfg.cutFinalStretchX != null) ? cfg.cutFinalStretchX : 1;
  const stY  = (cfg.cutFinalStretchY != null) ? cfg.cutFinalStretchY : 1;
  const oFX  = cfg.cutFinalOX || 0;
  const oFY  = cfg.cutFinalOY || 0;

  const irisX = cfg.cx + cfg.sceneCX;
  const irisY = cfg.cy + cfg.sceneCY;
  const cutFinalW = stX / cfg.cutFinalScale;
  const cutFinalH = stY / cfg.cutFinalScale;
  const cutFinalL = irisX + oFX - cutFinalW / 2;
  const cutFinalT = irisY + oFY - cutFinalH / 2;

  return {
    wEl, sEl, gNEl, gPEl, gfEl,
    cx: cfg.cx, cy: cfg.cy,
    hasVideo: cfg.hasVideo,
    hasAudioOnly: cfg.hasAudioOnly || false,
    hasText: cfg.hasText || false,
    skPlayEl,
    skPlayFinalEl,
    videoSrc: cfg.videoSrc,
    audioSrc: cfg.audioSrc || null,
    cutL: cfg.cutL, cutT: cfg.cutT, cutW: cfg.cutW, cutH: cfg.cutH,
    cutFinalScale: cfg.cutFinalScale,
    cutFinalL, cutFinalT, cutFinalW, cutFinalH,
    zoomScale: cfg.zoomScale,
    sceneCX: cfg.sceneCX, sceneCY: cfg.sceneCY,
    globeOX: cfg.globeOX, globeOY: cfg.globeOY,

    tx: 0, ty: 0,
    vx: 0, vy: 0,

    state: 'idle',
    wasInWake:  false,
    wasInClose: false,
    isPlay: false,
    tremblePhase: Math.random() * Math.PI * 2,
    _lastTransform: '',
  };
});

const eye1 = eyes[0];
const eye2 = eyes[1];
const eye3 = eyes[2];
const eye4 = eyes[3];

const scene    = $('scene');
const btnClose = $('btn-close');
// La flèche de retour vers l'openning est désormais gérée par Chapitre2Scene
// (ArrowChp2Part 'invibilisation'), harmonisée avec le reste du site.
// Le module se contente d'émettre 'chp2:invibilisation-ready' quand la
// sous-partie est prête, et d'écouter 'chp2:request-return' pour repartir.


/* Overlay témoignage (œil 4) */
const textOverlay = $('text-overlay');

const captionWrapEl  = $('caption-wrap');
const captionEl      = $('caption');
const captionTabEl   = $('caption-tab');
const captionSvg     = $('caption-tab-svg');
const captionLine    = $('caption-line');
const captionBg      = $('caption-bg');

/*
  Géométrie du SVG :
  - Hauteur SVG = TIP_H (profondeur de la flèche)
  - La ligne va de (0,0) → descend en V au centre → (W,0)
  - Le fond noir remplit le rectangle jusqu'à cette ligne
    = path qui part du coin haut-gauche, longe la ligne, revient
*/
const TIP_W = 60;  /* demi-largeur du rectangle haut de la languette px */
const MH    = 10;  /* hauteur de la partie rectangulaire (les "murs") px */
const TIP_H = 28;  /* hauteur totale jusqu'à la pointe px                */

function buildCaptionPaths() {
  const W  = window.innerWidth;
  const cx = W / 2;

  captionSvg.setAttribute('viewBox', `0 0 ${W} ${TIP_H}`);
  captionSvg.setAttribute('width',  W);
  captionSvg.setAttribute('height', TIP_H);

  /* ── Forme "maison à l'envers" ────────────────────────────
     Ligne horizontale, descend en murs verticaux, épaulements,
     puis converge vers la pointe centrale.
     Points :
       (0,0) → (cx-TIP_W,0)          ligne gauche
       (cx-TIP_W, MH)                 mur gauche
       (cx, TIP_H)                    pointe
       (cx+TIP_W, MH)                 mur droit
       (cx+TIP_W, 0)                  remontée droite
       (W, 0)                         ligne droite           */
  const shape = [
    `M 0,0`,
    `L ${cx - TIP_W},0`,
    `L ${cx - TIP_W},${MH}`,
    `L ${cx},${TIP_H}`,
    `L ${cx + TIP_W},${MH}`,
    `L ${cx + TIP_W},0`,
    `L ${W},0`,
  ].join(' ');

  captionLine.setAttribute('d', shape);

  const len = captionLine.getTotalLength();
  captionLine.style.setProperty('--line-len', len);
  captionLine.style.strokeDasharray = len;
  if (!captionLine.classList.contains('drawn')) {
    captionLine.style.strokeDashoffset = len;
  }

  /* Fond : même forme fermée */
  captionBg.setAttribute('d',
    `M ${cx - TIP_W},0 L ${cx - TIP_W},${MH} L ${cx},${TIP_H} L ${cx + TIP_W},${MH} L ${cx + TIP_W},0 Z`
  );

  /* --menu-h = hauteur du fond texte.
     Le translateY au repos = -(menu-h + 2vh), donc la ligne
     apparaît exactement à 2vh du bord supérieur.            */
  const menuH = captionEl.getBoundingClientRect().height;
  if (menuH > 0) captionWrapEl.style.setProperty('--menu-h', menuH + 'px');
}

/*
  Construction du SVG du menu : différée hors du chemin critique.
  Raison : getTotalLength() + getBoundingClientRect() forcent un reflow
  synchrone, et le menu n'est de toute façon pas visible (opacity:0)
  avant la fin du chargement des images.
  On recalcule aussi après chargement de la police (la hauteur du texte
  peut changer quand Cormorant Garamond remplace la police de substitution,
  ce qui est particulièrement visible sur mobile en fenêtre réduite).
*/
if ('requestIdleCallback' in window) {
  requestIdleCallback(buildCaptionPaths, { timeout: 1500 });
} else {
  setTimeout(buildCaptionPaths, 0);
}
/* Recalcul après chargement de la font (évite le décalage FOUT) */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(buildCaptionPaths);
}
on(window, 'resize', buildCaptionPaths, { passive: true });

/* ── Ouverture / fermeture ─────────────────────────────────── */
function isCaptionLocked() { return zoomed || videoPlaying; }

// Vrai dès que la flèche de retour a été cliquée (fadeOutAndReturn() a posé
// root.dataset.returning='true'). La sous-partie se ferme : plus aucune action
// ni ouverture de média ne doit pouvoir démarrer pendant le fondu de sortie.
function isReturning() { return root.dataset.returning === 'true'; }

function openCaption() {
  if (isCaptionLocked()) return;
  captionWrapEl.classList.add('expanded');
  // Volet déplié → on estompe les titres/sous-titres (le bouton plein écran reste).
  document.body.classList.add('invibilisation-legend-open');
}
function closeCaption() {
  captionWrapEl.classList.remove('expanded');
  document.body.classList.remove('invibilisation-legend-open');
}

/* « Prêt » : affiche la légende + demande à Chapitre2Scene de DESSINER la flèche
   de retour (event 'chp2:invibilisation-ready'). Émis UNE seule fois.
   ─────────────────────────────────────────────────────────────────────────────
   Robustesse : si l'utilisateur clique très vite un œil avant la fin de la
   révélation, on est déjà 'zoomed' au moment prévu → on NE marque PAS comme émis
   et on diffère. La sortie du média (doUnzoom) rappellera ce helper, qui dessinera
   alors la flèche si elle n'était pas encore apparue. */
let _readyEmitted = false;
function emitReadyOnce() {
  if (_readyEmitted) return;
  if (zoomed || videoPlaying) return;              // média/zoom en cours → différé
  if (root.dataset.returning === 'true') return;   // sortie de la sous-partie → non
  _readyEmitted = true;
  captionWrapEl.classList.add('visible');
  window.dispatchEvent(new CustomEvent('chp2:invibilisation-ready'));
  setTimeout(() => { if (!zoomed && !videoPlaying) animateCaptionLine(); }, 200);
}

captionWrapEl.addEventListener('mouseenter', openCaption,  { passive: true });
captionWrapEl.addEventListener('mouseleave', closeCaption, { passive: true });

captionTabEl.addEventListener('click', () => {
  if (isReturning()) return;
  captionWrapEl.classList.contains('expanded') ? closeCaption() : openCaption();
});
captionTabEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    captionWrapEl.classList.contains('expanded') ? closeCaption() : openCaption();
  }
});

function fadeOutAndReturn() {
    if (root.dataset.returning === 'true') return;
    root.dataset.returning = 'true';

    btnClose.classList.remove('visible');
  window.dispatchEvent(new CustomEvent('chp2:hide-close-cross'));

    // Sortie : extinction progressive de la lumière (fondu au noir) + flûte.
    fluteOut(true, EXIT_FADE);

    // Baseline DÉTERMINISTE : on fige opacity:1 sans transition puis on force un
    // reflow. Sans ça, à la 1ʳᵉ visite la transition peut être ignorée (root
    // n'a jamais eu d'opacité inline) → fermeture sèche. Avec le reflow, le
    // fondu 1→0 part toujours d'un état committé.
    root.style.transition = 'none';
    root.style.opacity    = '1';
    void root.offsetWidth;

    let _done = false;
    function finish() {
        if (_done) return;
        _done = true;
        root.removeEventListener('transitionend', onEnd);
        closeInvibilisation();                      // nettoie et ferme l'overlay
        window.dispatchEvent(new CustomEvent('invibilisation:return'));
    }
    function onEnd(e) {
        if (e.target === root && e.propertyName === 'opacity') finish();
    }
    root.addEventListener('transitionend', onEnd);
    // Filet de sécurité : si transitionend ne se déclenche pas, on ferme quand même.
    setT(finish, EXIT_FADE + 250);

    // Lancer le fondu à la frame suivante (baseline déjà committée).
    rafT(() => {
        root.style.transition = `opacity ${EXIT_FADE}ms ease`;
        root.style.opacity    = '0';
    });
}

// Retour déclenché par la flèche harmonisée (Chapitre2Scene) via event global.
on(window, 'chp2:request-return', () => {
    if (zoomed || videoPlaying) return;
    fadeOutAndReturn();
});

/* ── Séquence au chargement ───────────────────────────────────
   1. La ligne se trace (1400ms)
   2. Le fond noir apparaît en fondu (500ms)
   3. Le wrapper devient interactif (.ready)                    */
function animateCaptionLine() {
  captionLine.classList.add('drawn');
  setTimeout(() => { if (!zoomed && !videoPlaying) captionBg.classList.add('shown'); }, 1200);
  setTimeout(() => { if (!zoomed && !videoPlaying) captionWrapEl.classList.add('ready'); }, 1800);
}

const videoOverlay = $('video-overlay');
const videoEl      = $('voyeur-video');

const T_VIDEO_FADE_IN  = 800;
const T_VIDEO_FADE_OUT = 600;

let videoPlaying = false;

let zoomed     = false;
let zoomedEye  = null;
let _unzooming = false;
let _tBtnShow = null, _tVideo = null;

let _zoomSceneTx = 0;
let _zoomSceneTy = 0;

function doWake(eye) {
  eye.state = 'awake';
  setOpacity(eye.gfEl, 0, T_WAKE_FADE, 'ease-in');
  wakeRAF();
}

function doSleep(eye) {
  if (zoomed) return;
  eye.state  = 'idle';
  eye.isPlay = false;
  setOpacity(eye.gPEl, 0, T_PLAY_OUT,  EASE_FADE_OUT);
  setScale(eye.sEl, 1,    T_SCALE_OUT, EASE_SCALE_OUT);
  eye.wEl.classList.remove('clickable');
  setEyeSoftCursor(false);
  setOpacity(eye.gfEl, 1, T_SLEEP_FADE, 'ease-out');
  eye.tx = 0; eye.ty = 0;
}

function doEnterPlay(eye) {
  if (eye.state === 'play' || zoomed || isReturning()) return;
  eye.state  = 'play';
  eye.isPlay = true;
  setOpacity(eye.gPEl, 1, T_PLAY_IN,  EASE_FADE_IN);
  setScale(eye.sEl, SCALE_MAX, T_SCALE_IN, EASE_SCALE_IN);

  eye.wEl.classList.add('clickable');
  setEyeSoftCursor(true);
}

function doExitPlay(eye) {
  if (eye.state !== 'play' || zoomed) return;
  eye.state  = 'awake';
  eye.isPlay = false;
  setOpacity(eye.gPEl, 0, T_PLAY_OUT,  EASE_FADE_OUT);
  setScale(eye.sEl, 1,    T_SCALE_OUT, EASE_SCALE_OUT);
  eye.wEl.classList.remove('clickable');
  setEyeSoftCursor(false);
  wakeRAF();
}

/*
  Audio lazy-init : éviter de créer l'élément avant qu'il soit utilisé,
  pour ne pas pénaliser le back/forward cache du navigateur.
  Singleton — une seule instance partagée pour tous les œils audio.
*/
let _audioEl = null;
function getAudioEl() {
  if (!_audioEl) _audioEl = new Audio();
  return _audioEl;
}

/* ============================================================
   AMBIANCE FLÛTE (propre à l'installation)
   ─────────────────────────────────────────────────────────────
   Jouée en boucle pendant l'exploration des yeux, en fondu.
   - fade-in à la révélation de la scène,
   - fade-out + pause pendant la lecture d'un média (vidéo/audio/témoignage),
   - reprise (fade-in) au retour sur l'échelle des yeux,
   - coupée à la sortie de l'installation et nettoyée au destroy().
   Audio local au module (et non l'AudioManager central) : il doit se
   synchroniser avec l'état média local (videoPlaying) et disparaître avec
   l'installation.
   ============================================================ */
const _invCfg    = (window.CONFIG && window.CONFIG.CHAPITRE2 && window.CONFIG.CHAPITRE2.invibilisation) || {};
const FLUTE_SRC  = 'Chapitre2/chp2-medias/flute.mp3';
const FLUTE_VOL  = (_invCfg.fluteVol    != null) ? _invCfg.fluteVol    : 0.05;  // volume cible (config)
const FLUTE_FADE = (_invCfg.fluteFadeMs != null) ? _invCfg.fluteFadeMs : 1500;  // durée des fondus (ms)
const EXIT_FADE  = (_invCfg.exitFadeMs  != null) ? _invCfg.exitFadeMs  : 2500;  // extinction de sortie (ms)
let _fluteEl = null;
let _fluteRaf = 0;

function getFluteEl() {
  if (!_fluteEl) {
    _fluteEl = new Audio(FLUTE_SRC);
    _fluteEl.loop = true;
    _fluteEl.volume = 0;
    _fluteEl.preload = 'auto';
  }
  return _fluteEl;
}

/** Fond le volume de la flûte vers `target` (0..1). pauseAtEnd : pause si 0. */
function fluteFade(target, ms, pauseAtEnd) {
  const el = getFluteEl();
  if (_fluteRaf) { cancelAnimationFrame(_fluteRaf); _fluteRaf = 0; }
  if (target > 0 && el.paused) { el.play().catch(() => {}); }
  const from = el.volume;
  const t0 = performance.now();
  const dur = Math.max(1, ms || FLUTE_FADE);
  const step = (now) => {
    const p = Math.min((now - t0) / dur, 1);
    const e = 0.5 - 0.5 * Math.cos(p * Math.PI);
    el.volume = Math.max(0, Math.min(1, from + (target - from) * e));
    if (p < 1) {
      _fluteRaf = requestAnimationFrame(step);
    } else {
      _fluteRaf = 0;
      if (target === 0 && pauseAtEnd) { try { el.pause(); } catch {} }
    }
  };
  _fluteRaf = requestAnimationFrame(step);
}

function fluteIn(ms)        { fluteFade(FLUTE_VOL, ms, false); }
function fluteOut(pause, ms) { fluteFade(0, ms, pause !== false); }

/* ============================================================
   GESTION DES SOUS-TITRES SRT
   ============================================================ */

const srtContainer = $('srt-subtitles');
let srtCues = [];
let srtRafId = 0;
let srtActive = false;

/** Parse un fichier SRT en tableau de cues {start, end, text} */
function parseSRT(raw) {
  const cues = [];
  const blocks = raw.trim().split(/\n\s*\n/);
  const timeRe = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/;

  for (const block of blocks) {
    const lines = block.trim().split(/\n/);
    if (lines.length < 2) continue;

    // Trouver la ligne avec le timecode
    let timeLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) { timeLine = i; break; }
    }
    if (timeLine === -1) continue;

    const m = lines[timeLine].match(timeRe);
    if (!m) continue;

    const toMs = (h, min, s, ms) =>
      (parseInt(h, 10) * 3600 + parseInt(min, 10) * 60 + parseInt(s, 10)) * 1000 + parseInt(ms, 10);

    const start = toMs(m[1], m[2], m[3], m[4]);
    const end   = toMs(m[5], m[6], m[7], m[8]);
    const text  = lines.slice(timeLine + 1).join('\n').trim();

    if (text) cues.push({ start, end, text });
  }
  return cues.sort((a, b) => a.start - b.start);
}

/** Charge le fichier SRT au démarrage */
function loadSRT(url) {
  return fetch(url)
    .then(r => r.ok ? r.text() : Promise.reject(new Error('SRT non trouvé')))
    .then(raw => { srtCues = parseSRT(raw); })
    .catch(err => { console.warn('SRT load error:', err.message); srtCues = []; });
}

/* Chargement paresseux et idempotent : on ne télécharge SRT + police qu'une seule fois,
   et seulement quand c'est utile. Hors chemin critique. */
let _srtLoadPromise = null;
function ensureSRTLoaded() {
  if (_srtLoadPromise) return _srtLoadPromise;
  _srtLoadPromise = loadSRT('Chapitre2/chp2-medias/violence.srt');
  return _srtLoadPromise;
}

let _fontLoaded = false;
function ensureSubtitleFont() {
  // Police désormais chargée via <link media="print"> dans le <head> — non-bloquante.
  // Cette fonction est conservée pour compatibilité mais n'injecte plus rien.
}


/** Met à jour l'affichage des sous-titres selon le temps audio */
function updateSRT(currentTimeMs) {
  if (!srtCues.length) return;

  const t = Math.round(currentTimeMs);
  const cue = srtCues.find(c => t >= c.start && t < c.end);

  if (cue) {
    // 1. On prépare les lignes du SRT
    const lines = cue.text.split(/\n/);
    const srtHtml = lines.map(l => `<span class="srt-line">${escapeHtml(l)}</span>`).join('');
    
    // 2. On prépare votre crédit avec un style intégré pour aller au plus vite
    const creditHtml = `<div style="margin-top: 16px; font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(16px, 1.5vw, 24px); color: rgba(255, 255, 255, 0.7); font-style: italic; letter-spacing: 0.05em;">— A., Étudiante</div>`;
    
    // 3. On injecte le tout dans le conteneur
    srtContainer.innerHTML = srtHtml + creditHtml;
    srtContainer.classList.add('visible');
  } else {
    srtContainer.classList.remove('visible');
    srtContainer.innerHTML = '';
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Boucle RAF pour synchroniser les sous-titres avec l'audio */
function srtTick() {
  if (!srtActive) return;

  let currentTime = 0;
  if (zoomedEye && zoomedEye.hasAudioOnly) {
    // _audioEl existe forcément ici : startSRT() n'est appelé qu'après getAudioEl()
    currentTime = (_audioEl ? _audioEl.currentTime : 0) * 1000;
  } else if (zoomedEye && zoomedEye.hasVideo && !zoomedEye.hasAudioOnly) {
    currentTime = videoEl.currentTime * 1000;
  }

  updateSRT(currentTime);
  srtRafId = requestAnimationFrame(srtTick);
}

function startSRT() {
  if (srtActive) return;
  srtActive = true;
  srtTick();
}

function stopSRT() {
  srtActive = false;
  cancelAnimationFrame(srtRafId);
  srtRafId = 0;
  srtContainer.classList.remove('visible');
  srtContainer.innerHTML = '';
}

/* ============================================================
   FIN GESTION SRT
   ============================================================ */

function openMedia(eye) {
  if (isReturning()) return;
  if (!zoomed || zoomedEye !== eye) return;
  videoPlaying = true;
  // Filet de sécurité : menu définitivement masqué pendant la lecture
  captionWrapEl.classList.remove('visible', 'expanded', 'ready');

  if (eye.hasText) {
    /* Œil 4 — Témoignage. Pas de média à charger : on affiche
       l'overlay texte qui couvre toute la scène (comme le video-
       overlay couvre la scène pour les œils vidéo).               */
    textOverlay.classList.add('active');
    /* requestAnimationFrame pour s'assurer que le navigateur applique
       d'abord display/active avant la transition d'opacité.          */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!videoPlaying) return;
        textOverlay.classList.add('visible');
      });
    });
    return;
  }

  if (eye.hasAudioOnly) {

    // Filet de sécurité : si l'utilisateur clique avant le chargement idle, on force ici.
    // Idempotent — ne refait pas le fetch si déjà chargé.
    ensureSRTLoaded();
    // La police n'est utile que pour les sous-titres : on la charge ici, pas au boot.
    ensureSubtitleFont();

    const audioEl = getAudioEl();
    if (audioEl.src !== eye.audioSrc) {
      audioEl.src = eye.audioSrc;
    }
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
    audioEl.onended = () => {
      if (videoPlaying && zoomedEye === eye) closeMedia(eye);
    };
    // Démarrer les sous-titres SRT pour l'audio
    startSRT();
  } else {

    if (videoEl.src !== eye.videoSrc) {
      videoEl.src = eye.videoSrc;
    }
    videoOverlay.classList.add('active');
    videoOverlay.style.transition = `opacity ${T_VIDEO_FADE_IN}ms ease`;
    videoOverlay.style.opacity    = '1';
    setTimeout(() => {
      if (!videoPlaying) return;
      videoEl.currentTime = 0;
      const p = videoEl.play();
      if (p !== undefined) {
        p.catch(() => {
          videoOverlay.addEventListener('click', () => videoEl.play(), { once: true });
        });
      }
    }, 80);
  }
}

function closeMedia(eye) {
  if (!videoPlaying) return;
  videoPlaying = false;

  // Arrêter les sous-titres
  stopSRT();

  if (eye.hasText) {
    /* Œil 4 — Fermeture du témoignage : fade-out de l'overlay texte
       puis dézoom standard. La durée du fade matche T_VIDEO_FADE_OUT
       pour cohérence avec les œils vidéo.                            */
    textOverlay.classList.remove('visible');
    setTimeout(() => {
      textOverlay.classList.remove('active');
      doUnzoom(eye);
    }, T_VIDEO_FADE_OUT);
    return;
  }

  if (eye.hasAudioOnly) {

    if (_audioEl) {
      _audioEl.pause();
      _audioEl.currentTime = 0;
      _audioEl.onended = null;
    }
    doUnzoom(eye);
  } else {

    videoEl.pause();
    videoOverlay.style.transition = `opacity ${T_VIDEO_FADE_OUT}ms ease`;
    videoOverlay.style.opacity    = '0';
    setTimeout(() => {
      videoOverlay.classList.remove('active');
      videoEl.currentTime = 0;
      doUnzoom(eye);
    }, T_VIDEO_FADE_OUT);
  }
}

videoEl.addEventListener('ended', () => {
  if (videoPlaying && zoomedEye && !zoomedEye.hasAudioOnly) closeMedia(zoomedEye);
});

function computeZoomTransform(eye) {
  const { vw, vh, rW, rH, oX, oY } = rect;
  const S = eye.zoomScale;

  const irisX = oX + rW * (eye.cx + eye.sceneCX);
  const irisY = oY + rH * (eye.cy + eye.sceneCY);

  const tx = S * (vw / 2 - irisX);
  const ty = S * (vh / 2 - irisY);
  return { S, tx, ty };
}

function applyZoomTransforms(eye, animated) {
  const { S, tx, ty } = computeZoomTransform(eye);

  const globeDur = Math.round(ZOOM_DURATION * GLOBE_PROGRESS_END);

  const trScene = animated ? `transform ${ZOOM_DURATION}ms ${ZOOM_EASE}` : 'none';

  const trGlobe = animated ? `transform ${globeDur}ms ${GLOBE_EASE}`     : 'none';

  scene.style.transition = trScene;
  scene.style.transform  = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) scale(${S})`;
  _zoomSceneTx = tx;
  _zoomSceneTy = ty;

  const gvx = eye.globeOX * rect.rW;
  const gvy = eye.globeOY * rect.rH;
  eye.wEl.style.transition = trGlobe;
  eye.wEl.style.transform  = `translate3d(${gvx.toFixed(4)}px,${gvy.toFixed(4)}px,0)`;
  eye._lastTransform        = eye.wEl.style.transform;
  eye.vx = gvx; eye.vy = gvy;
  eye.tx = gvx; eye.ty = gvy;

  if (eye.skPlayEl) {
    applyZoomToSkPlay(eye, S, tx, ty, animated);
  }
}

function setupSkLayerInitial(el, cutL, cutT, cutW, cutH) {
  if (!el) return;
  const initLeft = rect.oX + rect.rW * cutL;
  const initTop  = rect.oY + rect.rH * cutT;
  const initW    = rect.rW * cutW;
  const initH    = rect.rH * cutH;

  el.style.transition = 'none';
  el.style.left   = initLeft.toFixed(2) + 'px';
  el.style.top    = initTop.toFixed(2)  + 'px';
  el.style.width  = initW.toFixed(2)    + 'px';
  el.style.height = initH.toFixed(2)    + 'px';
  el.style.transform = 'translate3d(0,0,0) scale(1)';
  el.style.opacity = '0';
  void el.offsetHeight;
}

function applyZoomToSkLayer(el, cutL, cutT, cutW, cutH, S, sceneTx, sceneTy, animated, crossfadeDelayMs, crossfadeDurMs) {
  if (!el) return;

  const initLeft = rect.oX + rect.rW * cutL;
  const initTop  = rect.oY + rect.rH * cutT;

  const finalTL = projectToViewport(cutL, cutT, S, sceneTx, sceneTy);
  const deltaX = finalTL.x - initLeft;
  const deltaY = finalTL.y - initTop;

  if (animated) {

    el.style.transition =
      `transform ${ZOOM_DURATION}ms ${ZOOM_EASE},` +
      `opacity ${crossfadeDurMs}ms ease ${crossfadeDelayMs}ms`;
    el.style.transform = `translate3d(${deltaX.toFixed(2)}px,${deltaY.toFixed(2)}px,0) scale(${S})`;
    el.style.opacity = '1';
  } else {

    el.style.transition = 'none';
    el.style.left   = initLeft.toFixed(2) + 'px';
    el.style.top    = initTop.toFixed(2)  + 'px';
    el.style.width  = (rect.rW * cutW).toFixed(2) + 'px';
    el.style.height = (rect.rH * cutH).toFixed(2) + 'px';
    el.style.transform = `translate3d(${deltaX.toFixed(2)}px,${deltaY.toFixed(2)}px,0) scale(${S})`;
    el.style.opacity = '1';
  }
}

function setupSkPlayInitial(eye) {
  setupSkLayerInitial(eye.skPlayEl,      eye.cutL,      eye.cutT,      eye.cutW,      eye.cutH);
  setupSkLayerInitial(eye.skPlayFinalEl, eye.cutFinalL, eye.cutFinalT, eye.cutFinalW, eye.cutFinalH);
}

function applyZoomToSkPlay(eye, S, sceneTx, sceneTy, animated) {
  applyZoomToSkLayer(
    eye.skPlayEl, eye.cutL, eye.cutT, eye.cutW, eye.cutH,
    S, sceneTx, sceneTy, animated,
    T_CROSSFADE_START, T_CROSSFADE_DUR
  );
  applyZoomToSkLayer(
    eye.skPlayFinalEl, eye.cutFinalL, eye.cutFinalT, eye.cutFinalW, eye.cutFinalH,
    S, sceneTx, sceneTy, animated,
    T_CROSSFADE_FINAL_START, T_CROSSFADE_FINAL_DUR
  );
}

function doZoom(eye) {
  if (isReturning()) return;
  zoomedEye  = eye;
  eye.state  = 'zoomed';
  eye.wEl.classList.remove('clickable');

  // Zoom : on coupe l'ambiance flûte (fade-out + pause), un peu avant le média.
  fluteOut(true);
  // ... et on masque la flèche de sortie pendant la lecture du média
  // (sans la détruire : simple classe CSS, son état/handler sont préservés).
  document.body.classList.add('invibilisation-media');

  // Légende : disparaît pendant le zoom (ready retiré pour couper pointer-events)
  captionWrapEl.classList.remove('visible', 'expanded', 'ready');
  document.body.classList.remove('invibilisation-legend-open');  // titres réaffichés

  scene.style.willChange   = 'transform';
  eye.wEl.style.willChange = 'transform';
  if (eye.skPlayEl) {
    eye.skPlayEl.style.willChange = 'transform, opacity';
  }
  if (eye.skPlayFinalEl) {
    eye.skPlayFinalEl.style.willChange = 'transform, opacity';
  }

  eyes.forEach(e => {
    if (e !== eye) { e.tx = 0; e.ty = 0; e.vx = 0; e.vy = 0; }
  });

  setupSkPlayInitial(eye);

  requestAnimationFrame(() => {
    zoomed = true;
    setEyeSoftCursor(false);

    applyZoomTransforms(eye, true);

    _tBtnShow = setTimeout(() => {
      // Croix de fermeture (style chapitre 1, gérée par Chapitre2Scene).
      window.dispatchEvent(new CustomEvent('chp2:show-close-cross'));
    }, ZOOM_DURATION + 100);

    if (eye.hasVideo || eye.hasAudioOnly || eye.hasText) {
      _tVideo = setTimeout(() => {
        _tVideo = null;
        openMedia(eye);
      }, ZOOM_DURATION + T_VIDEO_AFTER_ZOOM);
    }
  });
}

function doUnzoom(eye) {
  if (_unzooming) return;
  _unzooming    = true;

  // Retour vers l'échelle des yeux : l'ambiance flûte reprend (fade-in),
  // pendant le dézoom, un peu après la fermeture du média.
  fluteIn();
  // ... et la flèche de sortie réapparaît (retrait de la classe média).
  document.body.classList.remove('invibilisation-media');

  // Arrêter les sous-titres immédiatement
  stopSRT();

  clearTimeout(_tBtnShow); _tBtnShow = null;
  clearTimeout(_tVideo);   _tVideo   = null;

  btnClose.classList.remove('visible');
  window.dispatchEvent(new CustomEvent('chp2:hide-close-cross'));

  const { S, tx: sceneTx, ty: sceneTy } = computeZoomTransform(eye);

  function freezeLayerAtZoomEnd(el, cutL, cutT) {
    if (!el) return;
    const initLeft = rect.oX + rect.rW * cutL;
    const initTop  = rect.oY + rect.rH * cutT;
    const finalTL  = projectToViewport(cutL, cutT, S, sceneTx, sceneTy);
    const deltaX   = finalTL.x - initLeft;
    const deltaY   = finalTL.y - initTop;
    el.style.transition = 'none';
    el.style.transform  = `translate3d(${deltaX.toFixed(2)}px,${deltaY.toFixed(2)}px,0) scale(${S})`;
    el.style.opacity    = '1';
    void el.offsetHeight;
  }

  function animateLayerOut(el, opDur, opDelay) {
    if (!el) return;
    el.style.transition =
      `transform ${UNZOOM_DUR}ms ${UNZOOM_EASE},` +
      `opacity   ${opDur}ms ease ${opDelay}ms`;
    el.style.transform = 'translate3d(0,0,0) scale(1)';
    el.style.opacity   = '0';
  }

  freezeLayerAtZoomEnd(eye.skPlayFinalEl, eye.cutFinalL, eye.cutFinalT);
  freezeLayerAtZoomEnd(eye.skPlayEl,      eye.cutL,      eye.cutT);

  scene.style.transition = 'none';
  scene.style.transform  = `translate(${sceneTx.toFixed(2)}px,${sceneTy.toFixed(2)}px) scale(${S})`;
  void scene.offsetHeight;

  const gvx = eye.globeOX * rect.rW;
  const gvy = eye.globeOY * rect.rH;
  eye.wEl.style.transition = 'none';
  eye.wEl.style.transform  = `translate3d(${gvx.toFixed(4)}px,${gvy.toFixed(4)}px,0)`;
  eye._lastTransform        = eye.wEl.style.transform;
  eye.vx = gvx; eye.vy = gvy;
  eye.tx = gvx; eye.ty = gvy;

  requestAnimationFrame(() => {

    scene.style.transition = `transform ${UNZOOM_DUR}ms ${UNZOOM_EASE}`;
    scene.style.transform  = 'translate(0px,0px) scale(1)';
    _zoomSceneTx = 0;
    _zoomSceneTy = 0;

    animateLayerOut(eye.skPlayFinalEl, T_UNCROSSFADE_FINAL_DUR, 0);

    animateLayerOut(eye.skPlayEl, T_UNCROSSFADE_CUT_DUR, T_UNCROSSFADE_CUT_DELAY);
  });

  setTimeout(() => {
    zoomed        = false;
    zoomedEye     = null;
    _unzooming    = false;
    eye.tx = 0; eye.ty = 0;
    wakeRAF();
    // Sortie du média : si la flèche n'était pas encore apparue (clic très
    // rapide à l'ouverture), on la dessine maintenant. Idempotent sinon.
    emitReadyOnce();
  }, UNZOOM_DUR);

  setTimeout(() => {
    scene.style.transition   = '';
    scene.style.transform    = '';
    scene.style.willChange   = '';
    eye.wEl.style.willChange = '';

    [eye.skPlayEl, eye.skPlayFinalEl].forEach(el => {
      if (!el) return;
      el.style.willChange = '';
      el.style.transition = '';
      el.style.transform  = '';
      el.style.opacity    = '';
      el.style.left = el.style.top = el.style.width = el.style.height = '';
    });

    eyes.forEach(e => { e._lastTransform = ''; });

    const sx = rect.oX + rect.rW * eye.cx;
    const sy = rect.oY + rect.rH * eye.cy;
    const dx = mouseX - sx;
    const dy = mouseY - sy;
    const d2 = mouseOnPage ? dx * dx + dy * dy : Infinity;
    const dim = Math.min(rect.vw, rect.vh);
    const rWakeSq  = (dim * R_WAKE)  ** 2;
    const rCloseSq = (dim * R_CLOSE) ** 2;

    if (d2 < rCloseSq && mouseOnPage) {
      eye.state  = 'play';
      eye.isPlay = true;
      eye.wEl.classList.add('clickable');
    } else if (d2 < rWakeSq && mouseOnPage) {
      eye.state = 'awake';
    } else {
      eye.state  = 'idle';
      eye.isPlay = false;
      setOpacity(eye.gPEl, 0, T_PLAY_OUT,  EASE_FADE_OUT);
      setScale(eye.sEl, 1,    T_SCALE_OUT, EASE_SCALE_OUT);
      setOpacity(eye.gfEl, 1, T_SLEEP_FADE, 'ease-out');
    }

    eye.wasInWake  = d2 < rWakeSq  && mouseOnPage;
    eye.wasInClose = d2 < rCloseSq && mouseOnPage;

    wakeRAF();

    // Légende : réapparaît après le dézoom avec l'animation complète
    // Guard : ne pas afficher si un nouveau zoom/média a démarré entre-temps
    setTimeout(() => {
      if (zoomed || videoPlaying) return;
      captionLine.classList.remove('drawn');
      captionBg.classList.remove('shown');
      captionWrapEl.classList.remove('ready');
      void captionLine.getBoundingClientRect();
      captionWrapEl.classList.add('visible');
      setTimeout(() => { if (!zoomed && !videoPlaying) animateCaptionLine(); }, 80);
    }, 500);
  }, UNZOOM_DUR + 200);
}

// Détection tactile (une fois) : sur tactile, le clic sur un œil ne peut pas
// s'appuyer sur l'état 'play' progressif (le doigt se pose directement sur
// l'œil sans la phase d'approche). On autorise alors le zoom si le point touché
// est à portée (rayon R_CLOSE), en forçant l'état au passage.
const _isTouch = window.matchMedia?.('(pointer: coarse)').matches
              || 'ontouchstart' in window;

/** True si (mouseX,mouseY) est dans le rayon de déclenchement de l'œil. */
function _pointerWithinEye(eye) {
  const sx = rect.oX + rect.rW * eye.cx;
  const sy = rect.oY + rect.rH * eye.cy;
  const dx = mouseX - sx;
  const dy = mouseY - sy;
  const dim = Math.min(rect.vw, rect.vh);
  const rCloseSq = (dim * R_CLOSE) ** 2;
  return mouseOnPage && (dx * dx + dy * dy) < rCloseSq;
}

/** Peut-on zoomer cet œil au clic ? (souris : état 'play' ; tactile : proximité) */
function _canZoomOnClick(eye) {
  if (zoomed || isReturning()) return false;
  if (eye.state === 'play') return true;
  // Tactile : le doigt est posé sur/près de l'œil → on force play puis zoom.
  if (_isTouch && _pointerWithinEye(eye)) {
    if (eye.state !== 'play') doEnterPlay(eye);
    return true;
  }
  return false;
}

eye1.wEl.addEventListener('click', () => {
  if (_canZoomOnClick(eye1)) doZoom(eye1);
});

eye2.wEl.addEventListener('click', () => {
  if (_canZoomOnClick(eye2)) doZoom(eye2);
});

eye3.wEl.addEventListener('click', () => {
  if (_canZoomOnClick(eye3)) doZoom(eye3);
});

eye4.wEl.addEventListener('click', () => {
  if (_canZoomOnClick(eye4)) doZoom(eye4);
});

btnClose.addEventListener('click', () => {
  if (!zoomedEye) return;
  if (videoPlaying) {
    closeMedia(zoomedEye);
  } else {
    doUnzoom(zoomedEye);
  }
});

// Croix de fermeture (Chapitre2Scene) : clic → même action que l'ancien bouton.
on(window, 'chp2:close-cross-clicked', () => {
  if (!zoomedEye) return;
  if (videoPlaying) {
    closeMedia(zoomedEye);
  } else {
    doUnzoom(zoomedEye);
  }
});

on(document, 'keydown', e => {
  if (e.key !== 'Escape' || !zoomedEye) return;
  if (videoPlaying) {
    closeMedia(zoomedEye);
  } else {
    doUnzoom(zoomedEye);
  }
});

function trembleOffset(eye, t) {
  let ox = 0, oy = 0;
  const p = eye.tremblePhase;
  const n = TREMBLE_FREQ.length;
  for (let i = 0; i < n; i++) {
    const f = TREMBLE_FREQ[i];
    ox += Math.sin(t * f.wx + f.px + p) * TREMBLE_AMP;
    oy += Math.sin(t * f.wy + f.py + p) * TREMBLE_AMP;
  }
  return { ox: ox * TREMBLE_INV_N, oy: oy * TREMBLE_INV_N };
}

let mouseX      = -99999;
let mouseY      = -99999;
let mouseOnPage = false;
let mouseDirty  = false;

// Position du pointeur : pilote la proximité des yeux (réveil/play/tremble).
// pointermove couvre souris ET tactile ; pointerdown capte le premier contact
// (au tactile, aucun move n'est émis tant que le doigt n'a pas touché l'écran).
function _onPointerPos(e) {
  mouseX = e.clientX;
  mouseY = e.clientY;
  mouseOnPage = true;
  mouseDirty  = true;
  wakeRAF();
}
on(document, 'pointermove', _onPointerPos, { passive: true });
on(document, 'pointerdown', _onPointerPos, { passive: true });

// Fin de contact tactile ou sortie de page : les yeux se rendorment.
// (pointerup/cancel pour le tactile ; pointerleave sur document pour la souris.)
function _onPointerAway() {
  mouseOnPage = false;
  mouseDirty  = true;
  if (zoomed) return;
  for (let i = 0; i < eyes.length; i++) {
    const eye = eyes[i];
    eye.wasInWake  = false;
    eye.wasInClose = false;
    if (eye.state === 'awake' || eye.state === 'play') doSleep(eye);
  }
  wakeRAF();
}
on(document, 'pointerup',     _onPointerAway, { passive: true });
on(document, 'pointercancel', _onPointerAway, { passive: true });
on(document, 'pointerleave',  _onPointerAway, { passive: true });

let _resizeTimer = null;

on(window, 'resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    rect = buildRect();
    if (zoomed && zoomedEye) {
      applyZoomTransforms(zoomedEye, false);
    }
    wakeRAF();
  }, 60);
}, { passive: true });

let _rafId      = 0;
let _rafActive  = false;
const VEL_EPSILON = 0.02;

function wakeRAF() {
  if (_rafActive) return;
  _rafActive = true;
  _rafId = requestAnimationFrame(tick);
}

function tick(timestamp) {
  const t = timestamp * 0.001;

  const { oX, oY, rW, rH, vw, vh } = rect;
  const dim      = Math.min(vw, vh);
  const rWakePx  = dim * R_WAKE;
  const rClosePx = dim * R_CLOSE;
  const rWakeSq  = rWakePx  * rWakePx;
  const rCloseSq = rClosePx * rClosePx;
  const maxMovePx = vw * MAX_MOVE;

  mouseDirty = false;
  let needsMoreFrames = false;

  for (let i = 0; i < eyes.length; i++) {
    const eye = eyes[i];

    if (zoomed && eye === zoomedEye) continue;

    const sx  = oX + rW * eye.cx;
    const sy  = oY + rH * eye.cy;

    const ddx = mouseX - sx;
    const ddy = mouseY - sy;
    const d2  = (mouseOnPage && !zoomed) ? ddx * ddx + ddy * ddy : Infinity;

    const inWake  = d2 < rWakeSq;
    const inClose = d2 < rCloseSq;

    const enteredWake  =  inWake  && !eye.wasInWake;
    const exitedWake   = !inWake  &&  eye.wasInWake;
    const enteredClose =  inClose && !eye.wasInClose;
    const exitedClose  = !inClose &&  eye.wasInClose;

    eye.wasInWake  = inWake;
    eye.wasInClose = inClose;

    if (!zoomed) {
      if      (enteredWake  && eye.state === 'idle' ) doWake(eye);
      else if (exitedWake   && eye.state === 'awake') doSleep(eye);
      else if (exitedWake   && eye.state === 'play' ) doSleep(eye);
      else if (enteredClose && eye.state === 'awake') doEnterPlay(eye);
      else if (exitedClose  && eye.state === 'play' ) doExitPlay(eye);
    }

    const isActive = eye.state !== 'idle';
    if (isActive && inWake && d2 > 0 && !zoomed) {
      const dist  = Math.sqrt(d2);
      const inf   = 1 - dist / rWakePx;
      const scale = maxMovePx * inf / dist;
      eye.tx = ddx * scale;
      eye.ty = ddy * scale;
    } else {
      eye.tx = 0;
      eye.ty = 0;
    }

    let noiseX = 0, noiseY = 0;
    if (isActive && !zoomed) {
      const tr = trembleOffset(eye, t);
      noiseX = tr.ox;
      noiseY = tr.oy;
    }

    eye.vx = lerp(eye.vx, eye.tx + noiseX, LERP_SPEED);
    eye.vy = lerp(eye.vy, eye.ty + noiseY, LERP_SPEED);

    const tx = ((eye.vx * 100) | 0) / 100;
    const ty = ((eye.vy * 100) | 0) / 100;
    const tStr = `translate3d(${tx}px,${ty}px,0)`;

    if (eye._lastTransform !== tStr) {
      eye.wEl.style.transform = tStr;
      eye._lastTransform = tStr;
    }

    if (isActive) {
      needsMoreFrames = true;
    } else {
      const dvx = Math.abs(eye.vx - eye.tx);
      const dvy = Math.abs(eye.vy - eye.ty);
      if (dvx > VEL_EPSILON || dvy > VEL_EPSILON) {
        needsMoreFrames = true;
      }
    }
  }

  if (needsMoreFrames || mouseDirty) {
    _rafId = requestAnimationFrame(tick);
  } else {
    _rafActive = false;
  }
}

wakeRAF();

const criticalImages = Array.from(
  $$('img.layer:not(.globe-play)')
);
const deferredImages = Array.from(
  $$(
    'img.globe-play,' +
    '#sk-play1,#sk-play2,#sk-play3,#sk-play4,' +
    '#sk-play-final1,#sk-play-final2,#sk-play-final3,#sk-play-final4'
  )
);

const loaderFill = $('loader-fill');
const loaderEl   = $('loader');
let loadedN = 0;
const total = criticalImages.length;

function bumpProgress() {
  loadedN++;
  loaderFill.style.width = ((loadedN / total) * 100) + '%';
}

function whenReady(img) {
  if (typeof img.decode === 'function') {
    return img.decode().catch(() => {});
  }
  return new Promise(res => {
    if (img.complete && img.naturalWidth > 0) res();
    else {
      img.addEventListener('load',  res, { once: true });
      img.addEventListener('error', res, { once: true });
    }
  });
}

function decodeIdle(list) {
  if (!list.length) return;
  const next = list.shift();
  whenReady(next).then(() => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => decodeIdle(list), { timeout: 500 });
    } else {
      setTimeout(() => decodeIdle(list), 50);
    }
  });
}

Promise.all(
  criticalImages.map(img => whenReady(img).then(bumpProgress))
).then(() => {

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {

      decodeIdle(deferredImages.slice());

      setTimeout(() => {
        loaderEl.style.transition = `opacity ${T_LOADER_FADE}ms ease`;
        loaderEl.classList.add('out');

        // Allumage progressif = dissolution du voile noir : la flûte monte avec.
        if (!videoPlaying) fluteIn();

        setTimeout(() => {
          // Avant : loaderEl.remove() (destructif → empêchait toute réouverture).
          // Maintenant : on cache le loader en CSS, il pourra être réinitialisé au prochain mount.
          loaderEl.style.display = 'none';
          // Le wrapper apparaît, puis la ligne se trace.
          // Émission « prête » idempotente : si on a déjà zoomé (clic très
          // rapide), c'est différé à la sortie du média (cf. doUnzoom).
setTimeout(() => { emitReadyOnce(); }, 900);
          // SRT chargé hors chemin critique, une fois la page prête + interaction possible
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => ensureSRTLoaded(), { timeout: 3000 });
          } else {
            setTimeout(() => ensureSRTLoaded(), 200);
          }
        }, T_LOADER_FADE + 100);
      }, T_LOADER_HOLD);
    });
  });
});

/* =============================================================================
   FIN DU MOUNT — retourne l'API de cleanup
============================================================================= */

return {
  destroy() {
    // 1. Annuler tous les timers et RAF
    _timeouts.forEach(clearTimeout);
    _timeouts.length = 0;
    _rafs.forEach(cancelAnimationFrame);
    _rafs.length = 0;

    delete root.dataset.returning;

    // 2. Stopper proprement les boucles internes (drapeaux locaux)
    _rafActive = false;
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = 0; }
    if (srtRafId) { cancelAnimationFrame(srtRafId); srtRafId = 0; }
    srtActive = false;

    // 3. Stopper médias
    try { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); } catch {}
    if (_audioEl) {
      try { _audioEl.pause(); _audioEl.src = ''; _audioEl.onended = null; } catch {}
      _audioEl = null;
    }
    // Ambiance flûte : annuler le fondu en cours, arrêter et libérer.
    if (_fluteRaf) { cancelAnimationFrame(_fluteRaf); _fluteRaf = 0; }
    if (_fluteEl) {
      try { _fluteEl.pause(); _fluteEl.src = ''; } catch {}
      _fluteEl = null;
    }
    // Filet : retirer la classe média (sinon la flèche resterait masquée).
    document.body.classList.remove('invibilisation-media');
    // Filet : couper le pulse doux du curseur s'il était actif.
    setEyeSoftCursor(false);
    // Filet : retirer la classe légende (sinon les titres resteraient estompés).
    document.body.classList.remove('invibilisation-legend-open');

    // 4. Détacher tous les listeners enregistrés
    for (const { target, type, fn, opts } of _listeners) {
      try { target.removeEventListener(type, fn, opts); } catch {}
    }
    _listeners.length = 0;

    // 5. Réinitialiser l'état visuel pour permettre une réouverture propre.
    //    On ne supprime PAS les nœuds DOM (root reste tel quel pour réutilisation).
    //    Le loader est juste recaché en repassant ses styles à zéro.
    try {
      const loader = $('loader');
      if (loader) {
        loader.classList.remove('out');
        loader.style.transition = '';
        loader.style.opacity = '';
        loader.style.display = ''; // au cas où on l'aurait masqué
      }
      const fill = $('loader-fill');
      if (fill) fill.style.width = '0';

      const capWrap = $('caption-wrap');
      if (capWrap) capWrap.classList.remove('visible', 'expanded', 'ready');
      const capLine = $('caption-line');
      if (capLine) capLine.classList.remove('drawn');
      const capBg = $('caption-bg');
      if (capBg) capBg.classList.remove('shown');

      // SRT container vidé
      srtContainer.classList.remove('visible');
      srtContainer.innerHTML = '';

      // Overlays vidéo / texte / btn-close
      videoOverlay.classList.remove('active');
      videoOverlay.style.transition = '';
      videoOverlay.style.opacity = '';
      textOverlay.classList.remove('active', 'visible');
      btnClose.classList.remove('visible');
  window.dispatchEvent(new CustomEvent('chp2:hide-close-cross'));

      // Scene : reset transform & transitions
      scene.style.transition = '';
      scene.style.transform  = '';
      scene.style.willChange = '';

      // Yeux : reset transforms et willChange
      for (const eye of eyes) {
        eye.wEl.style.transition = '';
        eye.wEl.style.transform  = '';
        eye.wEl.style.willChange = '';
        eye.wEl.classList.remove('clickable');
        eye.sEl.style.transition = '';
        eye.sEl.style.transform  = '';
        eye.gPEl.style.transition = '';
        eye.gPEl.style.opacity    = '';
        eye.gfEl.style.transition = '';
        eye.gfEl.style.opacity    = '';
        if (eye.skPlayEl) {
          eye.skPlayEl.style.cssText = '';
        }
        if (eye.skPlayFinalEl) {
          eye.skPlayFinalEl.style.cssText = '';
        }
      }
    } catch (err) {
      console.warn('[Invibilisation] cleanup partial error:', err);
    }
  }
};

} // end mount()