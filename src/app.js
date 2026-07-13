/**
 * app.js — v4
 *
 * CHANGEMENTS vs v3 :
 * - CollaborationScene enregistrée et active
 * - TransitionManager instancié et injecté dans systems
 *   (CollaborationScene l'utilise pour swapSiteTitle)
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

const C = window.CONFIG;

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
bus.on('player:open', ({ src, label }) => player.open(src, label));
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

/* ── 11. Resize ──────────────────────────────────────────────── */
window.addEventListener('resize', () => {
  torch.resize();
  manager.onResize();
  player.resize();
  fullscreen.rebuild();
});

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
