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
import { CompassMap }         from './ui/CompassMap.js';
import * as Journey           from './systems/Journey.js';
import { VitrineScene }       from './scenes/VitrineScene.js';
import { PhrenologieScene }   from './scenes/PhrenologieScene.js';
import { CollaborationScene } from './scenes/CollaborationScene.js';
import { Chapitre2Scene }   from './scenes/Chapitre2Scene.js';
import { Chapitre3Scene }   from './scenes/Chapitre3Scene.js';
import { Chapitre4Scene }   from './scenes/Chapitre4Scene.js';
import { Chapitre1Scene }    from './scenes/Chapitre1Scene.js';
import { announce }          from './utils/a11y.js';

const C = window.CONFIG;

/* (Il y avait ici un registre — window.CONFIG.CHAPITRE1 = chp1-config — pour
   les systèmes PARTAGÉS. Ses trois seuls lecteurs étaient les alias torche de
   TorchSystem/MediaPlayer, supprimés à l'audit de juillet 2026 parce qu'ils
   n'avaient aucun effet. Chaque scène de chapitre importe désormais sa config
   directement, chp1 comme chp2 et chp3 : une règle, sans exception.) */

/* ── 1. Viewport minimal ─────────────────────────────────────── */
const appEl = document.getElementById('app');
if (appEl) {
  appEl.style.minWidth  = C.MIN_SIZE.width  + 'px';
  appEl.style.minHeight = C.MIN_SIZE.height + 'px';
}

/* ── Appareil tactile : détection UNIQUE + classe body.is-touch ──────────────
   Calculée tôt : le curseur personnalisé (bloc suivant) ET la hauteur stable
   (100svh, plus bas) en dépendent tous deux.
   La classe permet au CSS de basculer sur une hauteur STABLE (100svh) : sur
   téléphone, la barre du navigateur apparaît/disparaît au toucher et fait
   « respirer » le viewport — tout ce qui est calé dessus (fixed/inset:0,
   height:100%) saute. svh = zone toujours visible → plus aucun mouvement. */
const IS_TOUCH_DEVICE = window.matchMedia?.('(pointer: coarse)').matches
                     || 'ontouchstart' in window;
if (IS_TOUCH_DEVICE) document.body.classList.add('is-touch');

/* ── 2. Curseur personnalisé — RÉSERVÉ AU TACTILE ────────────────
   Hors tactile, le site montre désormais le curseur natif de l'OS, avec son
   comportement par défaut (cf. style.css, section « CURSEUR — natif partout,
   sauf sur les appareils tactiles ») : ce bloc, qui positionne #cursor et
   pilote ses états (.active/.hotspot), n'a donc plus de raison de tourner sur
   souris/trackpad. Sur tactile, il reste nécessaire : c'est encore lui qui
   fait suivre le curseur au doigt (ex. viseur de « Peine démesurée »). */
if (IS_TOUCH_DEVICE) {
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

/* ── 5bis. La boussole / carte du parcours ───────────────────────────────────
   UN SEUL INTERRUPTEUR, lu ici et nulle part ailleurs : CONFIG.MAP.active.
   À false, l'objet n'est jamais construit — pas de DOM, pas d'écouteur, pas de
   coût. La carte demande de la place et du survol : elle reste réservée à
   l'ordinateur (MAP.ordinateur_seulement), d'où la lecture de IS_TOUCH_DEVICE,
   déjà calculée plus haut.

   Elle paraît EN MÊME TEMPS QU'UNE FLÈCHE, et seulement là : ArrowBase émet
   'nav-arrow:shown' / ':hidden' pour ses neuf flèches (la croix de fermeture
   d'un média en est explicitement exclue). Aucune scène n'a à s'en occuper. */
const carteActive = !!C.MAP?.active && !(C.MAP?.ordinateur_seulement && IS_TOUCH_DEVICE);
const compass = carteActive ? new CompassMap(C, refSizeFn) : null;

if (compass) {
  bus.on('nav-arrow:shown',  () => compass.show());
  bus.on('nav-arrow:hidden', () => compass.hide());

  /* Le saut. La boussole ne connaît AUCUNE mise en scène : elle nomme une
     destination, et c'est la scène courante qui décide comment y aller.
     DEUX CAS, et un seul avait été prévu :
       · une autre scène → leaveTo() joue la sortie écrite (bougie, citation,
         fondu) puis navigue. Voir core/Scene.js → leaveTo.
       · un autre LIEU de la scène courante → jumpWithin(). Le chapitre 2 a
         quatre points sur la carte (son ouverture et ses trois installations) :
         y sauter ne change pas de scène. Ce cas retournait ici sans rien faire,
         ce qui rendait la carte inopérante à l'intérieur du chapitre 2. */
  compass.setOnJump((to, part) => {
    const scene = manager.currentScene;
    if (!scene) return;
    if (scene.name === to) { scene.jumpWithin({ part: part ?? null }); return; }
    scene.leaveTo(to, part ? { part } : {});
  });

  /* Un lieu SUPERPOSÉ (une sous-partie du chapitre 2) : la scène ne change pas,
     mais le point courant de la carte, si. */
  bus.on('journey:place', ({ id }) => compass.setCurrent(id));

  /* Un média passe au premier plan : la boussole s'éclipse avec la flèche, et
     revient avec elle. Émis par les scènes qui superposent un lecteur à leur
     décor — la règle d'auteur ne change pas d'un chapitre à l'autre. */
  bus.on('place:media', ({ ouvert }) => compass.eclipse(!!ouvert));

  /* LA CARTE PREND LA PLACE DES TITRES. Dépliée, elle occupe exactement le
     coin où ils s'écrivent : les laisser dessous ferait deux dessins l'un sur
     l'autre. Ils s'effacent donc AVANT que le cadre ne se trace, et ne
     reviennent qu'une fois le dé-tracé fini.

     ⚠️ CE N'EST PAS UN SIGNAL DU BUS, ET C'EST VOULU. Un signal se lance et
     s'oublie ; ici la carte a besoin d'une RÉPONSE — combien de temps le geste
     demande — pour savoir quand tracer. D'où une porte, comme setOnJump : la
     carte nomme ce qu'elle veut, la racine de composition sait à qui le
     demander. Title.eclipse rend la durée de son geste. */
  compass.setEclipseTitres((masquer) => title.eclipse(masquer));

  /* LA COLONNE SE REFERME QUAND LA BOUSSOLE N'EST PAS LÀ. Les titres occupent
     sa place tant qu'elle n'est pas dessinée, et GLISSENT vers la droite quand
     elle paraît. Ici un simple signal suffit : personne n'attend de réponse. */
  bus.on('carte:presence', ({ presente }) => title.decaler(!!presente));
}

/* ── 5ter. LES DEUX PLACES DES TITRES ────────────────────────────────────────
   Les trois niveaux de titre ont DEUX bords gauches, et glissent de l'un à
   l'autre :

     --col-titres       à droite de la boussole (MAP.titres_gauche_pct)
     --col-titres-seul  à SA place, quand elle n'est pas dessinée
                        (MAP.gauche_pct — le bord même de la colonne)

   Sans cela, la colonne paraissait décrochée du bord chaque fois que la
   boussole n'était pas là : au début d'une scène (elle ne paraît qu'avec la
   flèche), pendant un média, ou sur un appareil où la carte est désactivée.

   Le bord des titres se règle À PART de celui de la boussole, et non par un
   écart calculé depuis elle : ajuster l'une ne doit pas emmener les autres.

   Publié en variables CSS parce que les titres sont placés par la feuille de
   style : c'est le seul moyen que le réglage vive dans config.js sans être
   recopié dans style.css. La cadence du glissement y va aussi — c'est le CSS
   qui l'interpole, le JS ne fait que nommer la place visée (Title.decaler). */
function poserColonne() {
  const M = C.MAP;
  if (M?.titres_gauche_pct == null || M?.gauche_pct == null || M?.titres_glisse == null) {
    console.warn('[app] MAP.titres_gauche_pct / gauche_pct / titres_glisse ' +
                 'manquants : les titres se posent contre le bord de l’écran.');
  }
  const r = document.documentElement.style;
  r.setProperty('--col-titres',      (M?.titres_gauche_pct ?? 0) + '%');
  r.setProperty('--col-titres-seul', (M?.gauche_pct        ?? 0) + '%');
  r.setProperty('--col-glisse',      (M?.titres_glisse     ?? 0) + 'ms');

  /* Au départ, la boussole n'est pas encore dessinée — et si la carte est
     désactivée (MAP.active, ou appareil tactile) elle ne le sera jamais : les
     titres tiennent alors la place SANS jamais glisser, puisque plus personne
     n'émettra 'carte:presence'. */
  if (!r.getPropertyValue('--col-titres-courant') || !carteActive) {
    r.setProperty('--col-titres-courant', 'var(--col-titres-seul)');
  }
}
poserColonne();

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
manager.register(new Chapitre4Scene(systems));

/* ── 8. Navigation ─────────────────────────────────────────────
   ⚠️ LES PARAMÈTRES SONT TRANSMIS. Cette ligne ne passait que `to` : tout ce
   qu'une scène joignait à sa demande de navigation (par exemple la sous-partie
   à ouvrir en arrivant, `{ part: 'invisibilisation' }`) était silencieusement
   jeté ici. SceneManager.go les fait suivre à enter(). */
bus.on('navigate', ({ to, ...params }) => {
  // La carte ne traverse jamais une transition dépliée : on quitte un lieu,
  // elle se referme. Elle se redessinera pliée avec la flèche suivante.
  compass?.reset();
  manager.go(to, params);
});

/* ── 8ter. CE QUE CHAQUE LIEU DÉCLARE ────────────────────────────────────────
   UNE LIGNE PAR SCÈNE, ET UN SEUL ENDROIT. Tout ce qui n'est pas déclaré ici
   n'est pas là quand on entre : le son se tait, le titre revient à celui du
   site, les sous-titres de chapitre sont effacés.

   Appliquée À LA FRONTIÈRE — dans le noir, entre exit() et enter() : le seul
   instant où plus aucune scène n'est à l'écran, donc le seul où l'on peut tout
   remettre à plat sans que rien ne se voie.

   ⚠️ C'EST LA SEULE TABLE À TENIR À JOUR. Une scène ajoutée sans ligne ici
   entre dans le silence, sous le titre du site, et le dit en console : c'est le
   bon mode de panne (on remarque un manque, on ne subit pas un débordement).

   ⚠️ POURQUOI UNE TABLE PLUTÔT QU'UN RÉGLAGE PAR SCÈNE. Ce qu'il faut garder
   dépend de la scène qui ARRIVE, pas de celle qui part : une scène ne peut donc
   pas porter seule la réponse. C'était le défaut d'origine, deux fois — chaque
   exit() devinait sa destination pour le son, CollaborationScene la devinait
   pour le titre. Les deux devinettes étaient justes tant qu'on n'accédait aux
   chapitres QUE par l'espace collaboratif ; la carte du parcours a ouvert
   d'autres routes et les deux se sont mises à mentir, mesurément (le musée
   jouait par-dessus les chapitres 3 et 4 ; « Abounaddara — CNRS — 2026 »
   s'affichait au-dessus d'un chapitre).

   sons  : noms des pistes d'AudioManager.tracks à laisser vivre. Les chapitres
           gèrent leurs propres <audio>/<video> ; le registre les couvre aussi.
   titre : niveau 1 de la colonne de titres — 'site' ou 'collab' (voir Title).
           Les chapitres sont chez l'espace collaboratif : ils en gardent le
           titre et posent leur propre sous-titre par-dessous. */
const LIEUX = {
  vitrine:       { sons: ['musee'],            titre: 'site'   },
  phrenologie:   { sons: ['musee'],            titre: 'site'   },
  collaboration: { sons: ['musee', 'collab'],  titre: 'collab' },
  // 'phreno' puis 'silence' — démarrées APRÈS la frontière
  chapitre1:     { sons: [],                   titre: 'collab' },
  chapitre2:     { sons: [],                   titre: 'collab' },  // 'chp2' — idem
  chapitre3:     { sons: [],                   titre: 'collab' },  // ambiance interne
  chapitre4:     { sons: [],                   titre: 'collab' },  // seulement les bulles
};

manager.onBoundary = ({ to }) => {
  const lieu = LIEUX[to];
  if (!lieu) console.warn(`[app] LIEUX : scène « ${to} » non déclarée — silence et titre du site.`);
  audio.enforceSilence(lieu?.sons ?? []);
  /* ⚠️ L'ÉCLIPSE SE REMET À PLAT ICI, ET C'EST LA GARANTIE. La carte fait
     revenir les titres par une minuterie (elle attend la fin de son dé-tracé) ;
     une minuterie peut être annulée — changement de scène pendant un repli,
     boussole démontée. Sans cette remise à plat, un titre resterait éclipsé
     pour toute la scène suivante : une panne silencieuse et durable. Dans le
     noir, on ne joue rien, on rend l'état neuf. */
  title.resetEclipse();
  title.set(lieu?.titre ?? 'site');
  // Les niveaux 2 et 3 appartiennent à la scène qui les pose : elle les
  // redéclare en entrant, ou ils ne sont pas là.
  title.clearChapter();
};

/* ── 8bis. Annonce des changements de scène ──────────────────────────────────
   Le site change de scène sans changer d'URL ni de titre : pour un lecteur
   d'écran, absolument rien ne se passe. On annonce donc chaque arrivée dans
   une région live, et on met le titre du document à jour (utile aussi pour
   l'onglet et l'historique du navigateur). */
const SCENE_NAMES = {
  vitrine:       'La vitrine',
  phrenologie:   'La phrénologie',
  collaboration: 'Espace collaboratif',
  chapitre1:     'Chapitre I — Le crâne',
  chapitre2:     "Chapitre II — L'héritage colonial du musée",
  chapitre3:     'Chapitre III — La Galerie des Batailles',
  chapitre4:     'Chapitre IV — Une histoire complexe',
};
const BASE_TITLE = document.title;
bus.on('scene:entered', ({ name }) => {
  const label = SCENE_NAMES[name];
  if (!label) return;
  announce(label);
  document.title = `${label} — ${BASE_TITLE}`;
  // La carte retient le chemin parcouru et allume le point où l'on se trouve.
  Journey.visit(name);
  compass?.setCurrent(name);
});

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
    poserColonne();
    // La colonne de titres (les trois niveaux) se redimensionne ICI, une fois,
    // pour tout le site. Quatre scènes en portaient chacune une copie — et
    // aucune ne traitait exactement les mêmes éléments que les autres.
    title.resize();
    manager.onResize();
    player.resize();
    fullscreen.resize();
    compass?.resize();
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
      poserColonne();
      title.resize();
      manager.onResize();
      player.resize();
      fullscreen.resize();
      compass?.resize();
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
let startScreen = document.getElementById('start-screen');
if (startScreen) {
  startScreen.addEventListener('click', async () => {

    // Fullscreen — doit être dans le handler du clic utilisateur
    _requestFullscreen();

    // Déverrouiller AudioContext
    OrientationLock.setAudioContext(audio.getContext());

    // Fade out + suppression de l'écran
    document.body.classList.add('experience-started');

    // Le bouton plein écran redevient atteignable au clavier (il était hors
    // tabulation tant que l'écran d'accueil couvrait la page — voir Fullscreen).
    fullscreen.rebuild();
    startScreen.style.transition = `opacity ${C.START_SCREEN.fadeOut}ms ease`;
    startScreen.style.opacity    = '0';
    // `startScreen = null` après le retrait : la variable de module gardait
    // sinon l'écran d'accueil vivant (arbre détaché) pour toute la session.
    setTimeout(() => { startScreen?.remove(); startScreen = null; },
               C.START_SCREEN.fadeOut + 100);

    // Noir complet avant la première scène
    bgMgr.blackout();

    // Démarrer
    await manager.startAt('vitrine');

  }, { once: true });
}
