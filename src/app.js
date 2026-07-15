/**
 * app.js — racine de composition du site.
 *
 * Construit les systèmes partagés (audio, torche, fonds, transitions),
 * les composants UI, enregistre les six scènes auprès du SceneManager,
 * câble le bus d'événements (navigation, player) et les entrées globales
 * (scroll, resize, écran de démarrage). Voir CLAUDE.md pour la carte
 * complète de l'architecture.
 */

import { SceneManager }       from './core/SceneManager.js';
import { bus }                from './core/EventBus.js';
import { AudioManager }       from './systems/AudioManager.js';
import { TorchSystem }        from './systems/TorchSystem.js';
import { BackgroundManager }  from './systems/BackgroundManager.js';
import { TransitionManager }  from './core/TransitionManager.js';
import { OrientationLock }    from './systems/OrientationLock.js';
import { TouchHover }         from './systems/TouchHover.js';
import { Title }              from './ui/Title.js';
import { DocumentButtons }    from './ui/DocumentButtons.js';
import { NavigationBar }      from './ui/NavigationBar.js';
import { RomanCircles }       from './ui/RomanCircles.js';
import { MediaPlayer }        from './ui/MediaPlayer.js';
import { Fullscreen }         from './ui/Fullscreen.js';
import { VitrineScene }       from './scenes/VitrineScene.js';
import { PhrenologieScene }   from './scenes/PhrenologieScene.js';
import { CollaborationScene } from './scenes/CollaborationScene.js';
import { Chapitre2Scene }   from './scenes/Chapitre2Scene.js';
import { Chapitre3Scene }   from './scenes/Chapitre3Scene.js';
import { Chapitre1Scene }    from './scenes/Chapitre1Scene.js';
import { CONFIG as CHP1CONFIG } from '../Chapitre1/chp1-config.js';

const C = window.CONFIG;

/* Registre : la config du chapitre 1 (module ESM) est exposée aux systèmes
   PARTAGÉS (TorchSystem, MediaPlayer) qui lisent window.CONFIG.CHAPITRE1.
   Posé AVANT toute construction de système. Chapitre1Scene, elle, importe
   le module directement (même pattern que les chapitres 2 et 3). */
window.CONFIG.CHAPITRE1 = CHP1CONFIG;

/* ── 1. Viewport minimal ─────────────────────────────────────── */
const appEl = document.getElementById('app');
if (appEl) {
  appEl.style.minWidth  = C.MIN_SIZE.width  + 'px';
  appEl.style.minHeight = C.MIN_SIZE.height + 'px';
}

/* ── 2. Curseur personnalisé ──────────────────────────────────── */
const cursorEl = document.getElementById('cursor');
if (cursorEl) {
  const moveCursor = e => {
    cursorEl.style.left = e.clientX + 'px';
    cursorEl.style.top  = e.clientY + 'px';
  };
  // pointermove : suivi continu (souris + doigt en contact).
  // pointerdown : positionnement immédiat dès que le doigt touche l'écran.
  document.addEventListener('pointermove', moveCursor, { passive: true });
  document.addEventListener('pointerdown', moveCursor, { passive: true });

  document.addEventListener('pointerdown', () => cursorEl.classList.add('active'));
  document.addEventListener('pointerup',   () => cursorEl.classList.remove('active'));

  // Détection des zones cliquables : pointerover couvre souris ET tactile
  // (au premier contact, le curseur prend l'état « hotspot » sur un bouton).
  document.addEventListener('pointerover', e => {
    const isClickable = e.target.closest(
      '[data-clickable], [data-arrow], .doc-btn, .roman-btn, .nav-btn-zone, #fs-btn'
    );
    cursorEl.classList.toggle('hotspot', !!isClickable);
  }, { passive: true });
}

/* ── Appareil tactile : détection UNIQUE + classe body.is-touch ──────────────
   La classe permet au CSS de basculer sur une hauteur STABLE (100svh) : sur
   téléphone, la barre du navigateur apparaît/disparaît au toucher et fait
   « respirer » le viewport — tout ce qui est calé dessus (fixed/inset:0,
   height:100%) saute. svh = zone toujours visible → plus aucun mouvement. */
const IS_TOUCH_DEVICE = window.matchMedia?.('(pointer: coarse)').matches
                     || 'ontouchstart' in window;
if (IS_TOUCH_DEVICE) document.body.classList.add('is-touch');

/* ── 3. Systèmes partagés ────────────────────────────────────── */
const audio      = new AudioManager(C);

/* ── Verrou d'orientation (téléphone → paysage obligatoire) ──────────────
   Overlay + coupure son en mode portrait sur appareil tactile. Autonome ;
   on lui confiera l'AudioContext central dès qu'il sera déverrouillé (au
   clic de démarrage), pour couper toute la synthèse Web Audio d'un coup. */
OrientationLock.init({ message: 'Veuillez tourner votre appareil' });

/* Survol tactile : au glissé du doigt, active les effets de hover de l'élément
   réellement sous le doigt (contourne l'implicit pointer capture du tactile). */
TouchHover.init();
const torch      = new TorchSystem(C);
const bgMgr      = new BackgroundManager();
const transition = new TransitionManager(C);

/* ── 4. Taille de référence ──────────────────────────────────── */
// NavigationBar, MediaPlayer et Fullscreen s'alignent sur cette taille.
// Elle correspond à la taille des flèches de scène.
const refSizeFn = () => {
  const vW = Math.max(C.MIN_SIZE.width,  window.innerWidth);
  const vH = Math.max(C.MIN_SIZE.height, window.innerHeight);
  const A   = C.ARROW;
  return Math.round(Math.max(A.size_min, Math.min(A.size_max, Math.min(vW, vH) * A.size_vh / 100)));
};

/* ── 5. Composants UI partagés ───────────────────────────────── */
// Arrow n'est PAS instanciée ici — chaque scène crée la sienne.
const title      = new Title(C);
const docBtns    = new DocumentButtons(C);
const navBar     = new NavigationBar(C, refSizeFn);
const circles    = new RomanCircles(C);
const player     = new MediaPlayer(C, refSizeFn, torch, audio);
const fullscreen = new Fullscreen(C, refSizeFn);

/* ── 6. Systems injectés ─────────────────────────────────────── */
const systems = {
  audio,
  torch,
  bgMgr,
  transition,
  title,
  docBtns,
  navBar,
  circles,
  player,
};

/* ── 7. Scènes ───────────────────────────────────────────────── */
const manager = new SceneManager();

manager.register(new VitrineScene(systems));
manager.register(new PhrenologieScene(systems));
manager.register(new CollaborationScene(systems));
manager.register(new Chapitre1Scene(systems));
manager.register(new Chapitre2Scene(systems));
manager.register(new Chapitre3Scene(systems));

/* ── 8. Navigation ───────────────────────────────────────────── */
bus.on('navigate', ({ to }) => manager.go(to));

/* ── 9. Player ───────────────────────────────────────────────── */
bus.on('player:open', ({ src, label, credit }) => player.open(src, label, credit));
player.setOnClose((prevTitle) => bus.emit('player:close', { prevTitle }));

/* ── 10. Scroll ──────────────────────────────────────────────── */
let lastWheel = 0;
let lastTouch = { y: null, t: 0 };

window.addEventListener('wheel', e => {
  const now = Date.now();
  if (now - lastWheel < 800) return;
  lastWheel = now;
  manager.currentScene?.handleScroll?.(e.deltaY > 0 ? 'down' : 'up');
}, { passive: true });

window.addEventListener('touchstart', e => {
  if (e.touches[0]) lastTouch = { y: e.touches[0].clientY, t: Date.now() };
}, { passive: true });

window.addEventListener('touchend', e => {
  if (!lastTouch.y || !e.changedTouches[0]) return;
  const dy = lastTouch.y - e.changedTouches[0].clientY;
  if (Date.now() - lastTouch.t > 400 || Math.abs(dy) < 40) return;
  const now = Date.now();
  if (now - lastWheel < 800) return;
  lastWheel = now;
  manager.currentScene?.handleScroll?.(dy > 0 ? 'down' : 'up');
  lastTouch = { y: null, t: 0 };
}, { passive: true });

/* ── 11. Resize ──────────────────────────────────────────────────────────────
   THROTTLÉ (rAF) + garde de dimensions. Sur mobile, l'apparition/disparition de
   la barre d'URL fait varier innerHeight et émet une RAFALE de 'resize'. Sans
   throttle, arrows/fullscreen se re-rendaient (innerHTML réécrit) en boucle →
   clignotement + saut de la flèche, du bouton plein écran et de la légende.
   On coalesce à un rendu par frame, et on ignore les 'resize' fantômes (mêmes
   dimensions). fullscreen.resize() ne reconstruit que si la taille a changé. */
let _resizeQueued = false;
let _lastVW = window.innerWidth;
let _lastVH = window.innerHeight;
window.addEventListener('resize', () => {
  if (_resizeQueued) return;
  _resizeQueued = true;
  requestAnimationFrame(() => {
    _resizeQueued = false;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (vw === _lastVW && vh === _lastVH) return;      // resize « fantôme »

    // ⚠️ CHROME-TOGGLE MOBILE : sur tactile, TOUCHER l'écran fait apparaître/
    // disparaître la barre du navigateur → innerHeight change SANS que la largeur
    // bouge. Recalculer les positions là-dessus fait « sauter » flèche, plein
    // écran, légende et installation. On l'ignore : seul un vrai changement (la
    // rotation, qui modifie la LARGEUR) déclenche le repositionnement.
    if (IS_TOUCH_DEVICE && vw === _lastVW) { _lastVH = vh; return; }

    _lastVW = vw; _lastVH = vh;
    torch.resize();
    manager.onResize();
    player.resize();
    fullscreen.resize();
  });
}, { passive: true });

/* Le passage plein écran est un VRAI changement de hauteur (largeur intacte) que
   la garde ci-dessus ignorerait sur tactile : on force le relayout ici, après un
   court délai (le temps que le viewport se stabilise). */
['fullscreenchange', 'webkitfullscreenchange'].forEach(ev =>
  document.addEventListener(ev, () => {
    setTimeout(() => {
      _lastVW = window.innerWidth;
      _lastVH = window.innerHeight;
      torch.resize();
      manager.onResize();
      player.resize();
      fullscreen.resize();
    }, 150);
  }));

/* ── 12. Fullscreen au démarrage ─────────────────────────────── */
function _requestFullscreen() {
  const el = document.documentElement;
  const fn = el.requestFullscreen
    || el.webkitRequestFullscreen
    || el.mozRequestFullScreen
    || el.msRequestFullscreen;
  if (fn) fn.call(el).catch(() => {});
}

/* ── 13. Écran de démarrage ──────────────────────────────────── */
const startScreen = document.getElementById('start-screen');
if (startScreen) {
  startScreen.addEventListener('click', async () => {

    // Fullscreen — doit être dans le handler du clic utilisateur
    _requestFullscreen();

    // Déverrouiller AudioContext
    OrientationLock.setAudioContext(audio.getContext());

    // Fade out + suppression de l'écran
    document.body.classList.add('experience-started');
    startScreen.style.transition = `opacity ${C.START_SCREEN.fadeOut}ms ease`;
    startScreen.style.opacity    = '0';
    setTimeout(() => startScreen.remove(), C.START_SCREEN.fadeOut + 100);

    // Noir complet avant la première scène
    bgMgr.blackout();

    // Démarrer
    await manager.startAt('vitrine');

  }, { once: true });
}
