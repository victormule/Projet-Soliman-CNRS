import { CONFIG } from './chp5-config.js';
/* ⚠️ LE MÊME SYSTÈME DE TORCHE QUE LA PHRÉNOLOGIE, PAS UN SECOND. Il sait déjà
   tout faire : le mode fixe, la taille en fraction du viewport, l'allumage
   progressif, et le repeint SYNCHRONE au redimensionnement — sans lequel un
   canevas-masque se vide d'un coup et laisse la page à nu. C'est le chemin
   qu'a pris « Une peine démesurée » (chapitre 2) avant nous. */
import { TorchSystem } from '../../src/systems/TorchSystem.js';
/* L'INVENTAIRE DE LA VITRINE — deux grandes boîtes qui s'ouvrent sur les
   petites qu'elles contiennent. Un module à part parce qu'il ne touche à rien
   d'ici : ni la caméra, ni la mise au point, ni les cartels. Il ne connaît
   qu'un conteneur et sa propre chronologie, et se défait par `destroy()`. */
import { creerBoites } from './chp5-boites.js';
/* LA FENÊTRE DES PIÈCES — ce qu'une petite boîte ouvre : une vidéo, une prise
   de son ou un texte, au milieu de l'écran. Séparée aussi, et pour la même
   raison : elle ne connaît qu'un conteneur et une pièce à montrer. */
import { creerVisionneuse } from './chp5-visionneuse.js';
/* L'AMBIANCE SONORE — une bande-son par lieu. Le module ne décide rien : le
   moteur lui dit ce qu'on doit entendre, depuis le même calcul que le
   premier plan (voir `accorderAmbiance`). */
import { creerAmbiance } from './chp5-ambiance.js';

let instance = null;

/** Aucun effet de bord au chargement : les références appartiennent à la visite. */
export function startChapitre5(options) {
  stopChapitre5();
  instance = mount(options);
}

export function stopChapitre5() {
  instance?.destroy();
  instance = null;
}

export function leaveChapitre5() { return instance?.leave(); }
export function onResize() { instance?.resize(); }

/**
 * Referme le sous-chapitre ouvert et revient à la photographie.
 * ⚠️ C'EST LA SCÈNE QUI LE DEMANDE, PAS LE MOTEUR QUI DÉCIDE : la flèche de
 * retour appartient à la scène, et c'est elle qui sait si l'on revient ici ou
 * si l'on quitte le chapitre. Le geste lui-même s'annonce par `onPart(null)`,
 * une fois la salle rendue.
 */
export function closeChapitre5Part() { return instance?.closePart(); }

/**
 * VA À UN LIEU DU CHAPITRE — un sous-chapitre (son rang), ou `null` pour la
 * photographie. C'est la CARTE qui le demande (Chapitre5Scene.jumpWithin) ;
 * la flèche, elle, passe par `closeChapitre5Part`.
 *
 * ⚠️ UNE INTENTION, PAS UN ORDRE. On ne coupe jamais un passage en cours : la
 * demande est retenue, et c'est la fin du geste (lieu posé, salle rendue, fin
 * de l'introduction) qui la reprend. D'un sous-chapitre à un autre, on ne
 * repasse pas par la photographie : on rejoint le suivant PAR LE NOIR.
 */
export function goToChapitre5Part(index) { return instance?.allerA(index); }

function mount({ root, audio: audioManager, onReady, onIntroComplete, onListen, onPart, sousChapitre = null }) {
  const IMAGE = CONFIG.image;
  const INTRO = CONFIG.intro;
  const PORTE = CONFIG.porte;

  const RESTIT = CONFIG.restitution;
  const INHUM = CONFIG.inhumation;
  const CAMERA = CONFIG.camera;
  const FOCUS = CONFIG.miseAuPoint;
  const CARTELS = CONFIG.cartels;
  const TEXTES = CONFIG.textes;

  /** LES SOUS-CHAPITRES MIS EN SCÈNE, par leur rang : c'est la config qui
      dit quel lieu chaque chiffre ouvre (`cartels.sousChapitres[].lieu`).
      Un sous-chapitre sans lieu est « à venir » — le gabarit ne lui donne
      pas de `data-part`, rien ne l'ouvre. Un lieu que le moteur ne sait pas
      jouer est dénoncé ici, au montage, plutôt qu'au clic. */
  const MISES_EN_SCENE = new Set(['porte', 'vitrine', 'inhumation']);
  const LIEUX = {};
  CARTELS.sousChapitres.forEach((sousChapitre, index) => {
    if (!sousChapitre.lieu) return;
    if (!MISES_EN_SCENE.has(sousChapitre.lieu)) {
      console.warn('[chp5] Sous-chapitre ' + (index + 1) + ' : lieu inconnu « ' + sousChapitre.lieu + ' ».');
      return;
    }
    LIEUX[index] = sousChapitre.lieu;
  });

  /** L'ARRIVÉE DIRECTE — on entre dans le chapitre PAR un sous-chapitre (la
      carte, depuis une autre scène). Ni introduction ni photographie : le
      rideau se lève sur le noir, et le lieu s'ouvre depuis lui. Jouer cinq
      secondes d'introduction pour les quitter aussitôt, c'est le défaut que
      le chapitre 2 a déjà corrigé (ses bougies allumées pour être soufflées). */
  const arriveeDirecte = sousChapitre !== null && LIEUX[sousChapitre] ? sousChapitre : null;
  if (sousChapitre !== null && arriveeDirecte === null) {
    console.warn('[chp5] Arrivée demandée au sous-chapitre ' + (sousChapitre + 1) + ', qui n\'a pas de lieu : on entre par la photographie.');
  }
  const controller = new AbortController();
  const timers = new Set();
  const frames = new Set();
  let disposed = false;
  let leaving = false;
  let leavePromise = null;
  let finishLeave = null;
  const getElement = id => root.querySelector('#chp5-' + id);
  const on = (target, event, handler, options = {}) =>
    target.addEventListener(event, handler, { ...options, signal: controller.signal });
  function schedule(fn, delay) {
    const id = setTimeout(() => { timers.delete(id); if (!disposed && !leaving) fn(); }, delay);
    timers.add(id);
    return id;
  }
  function nextFrame(fn) {
    const id = requestAnimationFrame(time => { frames.delete(id); if (!disposed && !leaving) fn(time); });
    frames.add(id);
    return id;
  }
  function cancelFrame(id) { cancelAnimationFrame(id); frames.delete(id); }
  function cancelWork() {
    stopLoop();
    timers.forEach(clearTimeout);
    timers.clear();
    frames.forEach(cancelAnimationFrame);
    frames.clear();
  }
  root.style.setProperty('--chp5-intro-fade', INTRO.fadeMs + 'ms');
  root.style.setProperty('--inhumation-bascule', INHUM.basculeMs + 'ms');
  root.style.setProperty('--inhumation-fond', INHUM.fondMs + 'ms');
  root.style.setProperty('--inhumation-obscurite', String(INHUM.obscurite));
  const stage = getElement('stage');
  const camera = getElement('camera');
  const background = getElement('background');
  const leaders = getElement('leaders');
  const introBlack = getElement('introBlack');
  // (#chp5-porte et #chp5-vitrine, les couches elles-mêmes, ne sont pilotées
  //  que par des classes posées sur la scène : pas de référence à tenir.)
  const porteVoile = getElement('porteVoile');
  const porteCadre = getElement('porteCadre');
  const porteGauche = getElement('porteGauche');
  const porteDroite = getElement('porteDroite');
  const vitrinePlein = getElement('vitrinePlein');
  const vitrineVide = getElement('vitrineVide');
  const vitrineTorche = getElement('vitrineTorche');
  const inhumAvant = getElement('inhumationAvant');
  const inhumApres = getElement('inhumationApres');
  const inhumFond = getElement('inhumationFond');
  /** Les deux cadres du panorama : l'image qu'ils portent, et leur portée de
      glissement (`rx`, `ry`, en px de part et d'autre du centre). */
  const cadresPano = [
    { el: getElement('inhumationCadreApres'), img: inhumApres, rx: 0, ry: 0 },
    { el: getElement('inhumationCadreFond'), img: inhumFond, rx: 0, ry: 0 },
  ];
  let panX = 0;              // la main lissée, de -1 (gauche) à 1 (droite)
  let panY = 0;
  const inhumTorche = getElement('inhumationTorche');
  const passer = getElement('passer');
  const plancheCroix = getElement('plancheCroix');
  const plancheCredit = getElement('plancheCredit');
  const nuit = getElement('nuit');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = matchMedia('(hover: none), (pointer: coarse)');
  // ⚠️ LA FENÊTRE EST CRÉÉE ICI, PAS DANS LE MODULE DES BOÎTES, bien qu'elles
  // seules l'ouvrent : c'est la SCÈNE qui doit pouvoir la refermer quand on
  // s'en va, et le moteur qui doit savoir qu'elle est ouverte pour n'en faire
  // qu'un seul calcul de premier plan (cf. `occupe`). Le module des boîtes,
  // lui, nomme une pièce et se tait.
  // ⚠️ SUR LE CONTEXTE AUDIO DU SITE, JAMAIS UN SECOND (comme la sinusoïde
  // de la fenêtre). `temoin` : l'intention courante est écrite sur la racine
  // (`data-ambiance`), pour le banc d'essai et pour qui débogue à l'oreille.
  const ambiance = creerAmbiance({ audioManager, reglages: CONFIG.ambiance, temoin: root });
  const visionneuse = creerVisionneuse({
    conteneur: getElement('doc'),
    audioManager,
    reduceMotion,
    onEtat: ouverte => {
      notifyForeground();
      // On rend la vitrine : c'est là que le crâne s'efface d'un pas.
      if (!ouverte && place === 'vitrine') poserPresence(false);
    },
  });
  const boites = creerBoites({
    conteneur: getElement('boites'),
    legende: getElement('legende'),
    composition: RESTIT.boites,
    cadences: CONFIG.geste,
    photo: RESTIT.photo,
    reduceMotion,
    // ⚠️ LA BOÎTE PASSE AVEC LA PIÈCE : c'est à elle que la fenêtre rend le
    // focus en se refermant. Un `item => …` seul la perdait en route, et le
    // focus tombait sur `body` — sans erreur, sans test qui le vît.
    ouvrirPiece: (item, depuis) => visionneuse.ouvrir(item, depuis),
  });
  /* LES TOMBES ET LE DRAPEAU — le même module, la même fenêtre, la même
     légende ; une autre composition (`inhumation.tombes`) : une rangée sans
     grande, ouverte d'emblée. Le geste, lui, est le même (`CONFIG.geste`) :
     une tombe s'écrit comme une boîte. */
  const tombes = creerBoites({
    conteneur: getElement('tombes'),
    legende: getElement('legende'),
    composition: INHUM.tombes,
    cadences: CONFIG.geste,
    photo: INHUM.photo,
    reduceMotion,
    // Le DRAPEAU n'ouvre pas la fenêtre : il déclare `planche`, et c'est
    // toute la vitrine qui cède la place (voir ouvrirPlanche).
    ouvrirPiece: (item, depuis) => item.planche ? ouvrirPlanche(item, depuis) : visionneuse.ouvrir(item, depuis),
  });

  const callouts = [...root.querySelectorAll('.callout')].map((element, index) => {
    const target = element.querySelector('.target');
    const lineId = element.dataset.line;
    const line = getElement(lineId);
    const dot = getElement(element.dataset.dot);
    const reveal = getElement(`reveal-${lineId.replace('line-', '')}`);
    const interactive = element.classList.contains('nav-callout')
      ? element.querySelector('.nav-link')
      : target;

    return {
      element,
      index,
      target,
      interactive,
      line,
      dot,
      reveal,
      anchorX: Number(element.dataset.anchorX),
      anchorY: Number(element.dataset.anchorY),
      depth: Number(element.dataset.depth),
      phase: Number(element.dataset.phase),
      centerX: 0,
      centerY: 0,
      targetX: 0,
      targetY: 0,
      targetRadius: 0
    };
  });

  let vw = innerWidth;
  let vh = innerHeight;

  let pointerPxX = vw / 2;
  let pointerPxY = vh / 2;
  let pointerNX = 0;
  let pointerNY = 0;
  let smoothNX = 0;
  let smoothNY = 0;

  let cameraX = 0;
  let cameraY = 0;
  let cameraRot = 0;
  let cameraScale = 1.055;

  let objectPosX = 0.5;
  let objectPosY = 0.5;
  let baseCameraShiftX = 0;
  let baseCameraShiftY = 0;
  let targetBaseScale = 1.09;
  let motionFactor = 1;
  let recenterStrength = 0;

  let focusBlur = 0.9;
  let focusFrom = 0.9;
  let focusTo = 0.72;
  let focusStart = performance.now();
  let focusDuration = 850;
  let focusHoldUntil = focusStart + 1800;
  let focusMode = 'steady';
  let huntStart = 0;
  let huntDuration = 0;
  let huntAmplitude = 0;
  let huntCycles = 0;

  let introStartedAt = null;
  let introFinished = false;
  let animationFrame = 0;
  let loopRunning = false;

  /* ── LA PORTE — état du sous-chapitre 1 ────────────────────────────────────
     Quatre avancements, et rien d'autre : tout l'écran s'en déduit (renderPorte).
     Ils vivent ici, et non dans des animations posées une fois, parce qu'un
     redimensionnement en cours de geste — une bascule plein écran, une rotation
     de téléphone — doit pouvoir REDESSINER l'instant présent sans le rejouer. */
  let reculP = 0;          // la photographie s'éloigne et se trouble
  let fermeP = 0;          // les deux battants entrent et se rejoignent
  let voileP = 0;          // la salle disparaît dans la couleur de fond
  let zoomP = 0;           // la caméra pousse sur le panneau
  let nuitP = 0;           // l'extinction, avant de rallumer ailleurs
  let place = null;        // null | 'porte' | 'vitrine' — où l'on se trouve
  let placeGeste = null;   // null | 'attente' | 'aller' | 'retour'
  let placeT0 = 0;
  let placeOuverte = false;  // le lieu est posé : on y est, plus rien ne bouge
  let portePret = null;      // promesse de décodage des deux battants
  let vitrinePret = null;    // promesse de décodage des deux prises
  let inhumPret = null;      // promesse de décodage des deux photographies du « 3 »
  let torche = null;         // TorchSystem du lieu éclairé (vitrine OU inhumation)
                             // — créé à l'entrée, détruit au retour
  let voix = null;           // la voix EN COURS de l'inhumation — celle de
                             // l'arrivée, puis celle du drapeau ; créée à la
                             // demande, VIDÉE après
  let planche = null;        // la planche du drapeau est levée : { item, depuis }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const easeInOut = p => p < 0.5
    ? 4 * p * p * p
    : 1 - Math.pow(-2 * p + 2, 3) / 2;

  function resize() {
    vw = stage.clientWidth;
    vh = stage.clientHeight;
    leaders.setAttribute('viewBox', `0 0 ${vw} ${vh}`);

    const coverScale = Math.max(vw / IMAGE.width, vh / IMAGE.height);
    const renderedW = IMAGE.width * coverScale;
    const renderedH = IMAGE.height * coverScale;

    const overflowX = Math.max(0, renderedW - vw);
    let neededObjectPosX = 0.5;

    if (overflowX > 0.5) {
      const subjectRenderedX = IMAGE.focalX * renderedW;
      const desiredX = vw * 0.52;
      neededObjectPosX = clamp((subjectRenderedX - desiredX) / overflowX, 0, 1);
    }

    const overflowY = Math.max(0, renderedH - vh);
    let neededObjectPosY = 0.5;

    if (overflowY > 0.5) {
      const subjectRenderedY = IMAGE.focalY * renderedH;
      const desiredY = vh * 0.5;
      neededObjectPosY = clamp((subjectRenderedY - desiredY) / overflowY, 0.28, 0.70);
    }

    const aspect = vw / vh;
    recenterStrength = clamp((1.60 - aspect) / (1.60 - 1.05), 0, 1);
    recenterStrength = recenterStrength * recenterStrength * (3 - 2 * recenterStrength);

    targetBaseScale = CAMERA.zoom + recenterStrength * 0.035 + (vw < 600 ? 0.012 : 0);

    objectPosX = 0.5 + (neededObjectPosX - 0.5) * recenterStrength;
    objectPosY = 0.5 + (neededObjectPosY - 0.5) * recenterStrength;

    background.style.objectPosition =
      `${(objectPosX * 100).toFixed(2)}% ${(objectPosY * 100).toFixed(2)}%`;

    const cx = vw / 2;
    const cy = vh / 2;
    const cropX = (vw - renderedW) * objectPosX;
    const cropY = (vh - renderedH) * objectPosY;

    const focalX = cropX + IMAGE.focalX * renderedW;
    const focalY = cropY + IMAGE.focalY * renderedH;
    const scaledFocalX = cx + (focalX - cx) * targetBaseScale;
    const scaledFocalY = cy + (focalY - cy) * targetBaseScale;

    const desiredX = vw * (aspect < 1 ? 0.515 : 0.525);
    const desiredY = vh * (aspect < 1 ? 0.49 : 0.475);
    const wantedShiftX = (desiredX - scaledFocalX) * recenterStrength;
    const wantedShiftY = (desiredY - scaledFocalY) * recenterStrength;

    const leftEdge = cx + (cropX - cx) * targetBaseScale;
    const rightEdge = cx + (cropX + renderedW - cx) * targetBaseScale;
    const topEdge = cy + (cropY - cy) * targetBaseScale;
    const bottomEdge = cy + (cropY + renderedH - cy) * targetBaseScale;

    const minShiftX = vw - rightEdge + 2;
    const maxShiftX = -leftEdge - 2;
    const minShiftY = vh - bottomEdge + 2;
    const maxShiftY = -topEdge - 2;

    baseCameraShiftX = clamp(wantedShiftX, minShiftX, maxShiftX);
    baseCameraShiftY = clamp(wantedShiftY, minShiftY, maxShiftY);
    motionFactor = vw < 600 ? 0.58 : (vw < 900 ? 0.76 : 1);

    publishMur(cx, cropX, coverScale);

    if (reduceMotion) {
      cameraX = 0;
      cameraY = 0;
      cameraRot = 0;
      cameraScale = 1;
      camera.style.transform = 'none';
      background.style.filter = 'blur(.65px)';
    }
  }

  /**
   * LE MUR — où tombe, DANS LA FENÊTRE, le bord gauche du dormant.
   * ───────────────────────────────────────────────────────────────────────────
   * Les cartels de gauche s'arrêtent là : au-delà commence le jour, et aucun
   * texte clair n'y tient. Or cette place ne suit pas la largeur de l'écran
   * mais son RAPPORT — 48,6 % en 16/9, 43,5 % en 3/2, 36,7 % en 4/3 : aucune
   * série de pourcentages CSS ne peut la dire. Calés sur le pire cadrage, les
   * trois cercles se tenaient donc très à gauche sur TOUS les autres.
   * Le moteur la projette ici et la publie ; la feuille y accroche le bord
   * droit des cartels (cf. `--chp5-mur` et `.nav-callout`).
   *
   * ⚠️ AVEC LA CAMÉRA DE BASE, PAS CELLE DE L'IMAGE COURANTE. Deux raisons :
   * la dérive au repos ferait respirer une valeur de MISE EN PAGE, donc
   * relayouter à chaque image ; et l'approche de l'intro déplacerait les
   * cartels pendant qu'ils se dessinent. Publiée une fois par
   * redimensionnement, elle décrit la position d'arrivée — la dérive (±6 px)
   * est absorbée par le retrait de la feuille.
   */
  function publishMur(cx, cropX, coverScale) {
    // Sous « mouvement réduit » la caméra est l'identité : même projection que
    // celle des ancres (cf. sourcePointToViewport), sinon le mur mentirait.
    const scale = reduceMotion ? 1 : targetBaseScale;
    const shift = reduceMotion ? 0 : baseCameraShiftX;
    const px = cropX + IMAGE.murX * coverScale;
    root.style.setProperty('--chp5-mur', (cx + (px - cx) * scale + shift).toFixed(1) + 'px');
  }

  function measureCallouts() {
    // .stage est fixed + inset: 0 : les coordonnées client sont déjà locales à la scène.
    for (const callout of callouts) {
      const rect = callout.element.getBoundingClientRect();
      const targetRect = callout.target.getBoundingClientRect();

      callout.centerX = rect.left + rect.width / 2;
      callout.centerY = rect.top + rect.height / 2;
      callout.targetX = targetRect.left + targetRect.width / 2;
      callout.targetY = targetRect.top + targetRect.height / 2;
      callout.targetRadius = Math.max(targetRect.width, targetRect.height) / 2;
    }
  }

  function sourcePointToViewport(x, y) {
    const coverScale = Math.max(vw / IMAGE.width, vh / IMAGE.height);
    const renderedW = IMAGE.width * coverScale;
    const renderedH = IMAGE.height * coverScale;
    const cropX = (vw - renderedW) * objectPosX;
    const cropY = (vh - renderedH) * objectPosY;

    const px = cropX + x * coverScale;
    const py = cropY + y * coverScale;
    const cx = vw / 2;
    const cy = vh / 2;
    const dx = (px - cx) * cameraScale;
    const dy = (py - cy) * cameraScale;
    const angle = cameraRot * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return {
      x: cx + (dx * cos - dy * sin) + cameraX,
      y: cy + (dx * sin + dy * cos) + cameraY
    };
  }

  function updateLeader(callout, t) {
    const anchor = sourcePointToViewport(callout.anchorX, callout.anchorY);

    callout.dot.setAttribute('cx', anchor.x.toFixed(2));
    callout.dot.setAttribute('cy', anchor.y.toFixed(2));

    const vx = callout.targetX - anchor.x;
    const vy = callout.targetY - anchor.y;
    const distance = Math.max(1, Math.hypot(vx, vy));
    const ux = vx / distance;
    const uy = vy / distance;
    const gap = clamp(vw * 0.006, 7, 11);
    const endX = callout.targetX - ux * (callout.targetRadius + gap);
    const endY = callout.targetY - uy * (callout.targetRadius + gap);
    const dir = endX >= anchor.x ? 1 : -1;
    const distX = Math.abs(endX - anchor.x);

    const sway =
      Math.sin(t * 0.00072 + callout.index * 1.41) * 2.5 +
      Math.sin(t * 0.00131 + callout.index * 0.73) * 0.8;

    const bend = Math.max(30, distX * 0.30);
    const c1x = anchor.x + dir * bend;
    const c1y = anchor.y + sway * 0.55;
    const c2x = endX - dir * Math.min(26, Math.max(15, distX * 0.09));
    const c2y = endY - sway * 0.30;

    const path =
      `M ${anchor.x.toFixed(2)} ${anchor.y.toFixed(2)} ` +
      `C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ` +
      `${c2x.toFixed(2)} ${c2y.toFixed(2)}, ` +
      `${endX.toFixed(2)} ${endY.toFixed(2)}`;

    callout.line.setAttribute('d', path);
    if (callout.reveal) {
      callout.reveal.setAttribute('d', path);
      // Pendant l'intro, limiter chaque masque à l'enveloppe de sa courbe.
      // Les dimensions SVG par défaut couvrent tout l'écran, cinq fois.
      const mask = callout.reveal.parentElement;
      const left = Math.floor(Math.min(anchor.x, c1x, c2x, endX)) - 8;
      const top = Math.floor(Math.min(anchor.y, c1y, c2y, endY)) - 8;
      mask.setAttribute('x', left);
      mask.setAttribute('y', top);
      mask.setAttribute('width', Math.ceil(Math.max(anchor.x, c1x, c2x, endX)) - left + 8);
      mask.setAttribute('height', Math.ceil(Math.max(anchor.y, c1y, c2y, endY)) - top + 8);
    }
  }

  function updateLeaders(t) {
    for (const callout of callouts) updateLeader(callout, t);
  }

  function setHoverState(callout, on) {
    if (callout.element.classList.contains('playing')) return;
    callout.line.classList.toggle('hover', on);
    callout.dot.classList.toggle('hover', on);
  }

  function setupHoverStates() {
    for (const callout of callouts) {
      if (!callout.target || !callout.interactive) continue;

      on(callout.target, 'pointerenter', () => setHoverState(callout, true));
      on(callout.target, 'pointerleave', () => setHoverState(callout, false));
      on(callout.interactive, 'focus', () => setHoverState(callout, true));
      on(callout.interactive, 'blur', () => setHoverState(callout, false));
    }
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '00:00';
    const wholeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(wholeSeconds / 60);
    const remainder = wholeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }

  let currentAudio = null;

  function setAudioVisual(callout, button, playing) {
    callout.classList.toggle('playing', playing);
    button.classList.toggle('playing', playing);
    button.setAttribute('aria-pressed', String(playing));
    button.setAttribute(
      'aria-label',
      playing ? button.dataset.pauseLabel : button.dataset.playLabel
    );

    const line = getElement(callout.dataset.line);
    const dot = getElement(callout.dataset.dot);
    line.classList.toggle('playing', playing);
    dot.classList.toggle('playing', playing);

    if (playing) {
      line.classList.remove('hover');
      dot.classList.remove('hover');
    }
  }

  /**
   * CE QUI PASSE AU PREMIER PLAN — un témoignage qu'on écoute OU la porte en
   * mouvement. La scène n'a qu'un geste à faire (éclipser la flèche, et la
   * boussole avec elle) : elle ne doit donc recevoir qu'UNE réponse, jamais
   * deux vérités concurrentes. Un seul calcul, un seul appel.
   */
  function occupe() {
    // Une pièce ouverte passe devant, elle aussi : c'est un média au premier
    // plan, la flèche et la boussole doivent s'effacer. Les `<video>` de la
    // fenêtre ne sont pas comptées une à une — la fenêtre elle-même répond.
    if (visionneuse.estOuverte()) return true;
    // La planche du drapeau aussi : on écoute, plein écran.
    if (planche) return true;
    return !!placeGeste || [...root.querySelectorAll('audio')].some(audio => !audio.paused);
  }

  function notifyForeground() {
    onListen(occupe());
    accorderAmbiance();
  }

  /**
   * CE QU'ON DOIT ENTENDRE — l'ambiance suit le premier plan, depuis le MÊME
   * appel (`notifyForeground`) : tout ce qui éclipse la flèche passe par là,
   * donc rien de ce qui parle ne peut la laisser jouer dessous. Une seule
   * réponse, recalculée de l'état à chaque fois — jamais une suite d'ordres
   * « allume » / « éteins » qui pourraient arriver dans le désordre.
   *
   * Ce n'est pas exactement `occupe()` : un texte ou la carte mentale ouverts
   * occupent le premier plan, mais on les LIT — l'ambiance reste dessous.
   */
  let silenceFini = false;     // le long silence de l'entrée est passé
  let ambianceEntendue = false; // la photographie a déjà eu sa première montée
  function ambianceVoulue() {
    if (disposed || leaving) return null;
    // Un passage d'un lieu à l'autre — dont la voix d'Alicia, qui se joue
    // pendant l'arrivée au « 3 » — et la planche du drapeau.
    if (placeGeste || planche) return null;
    if (visionneuse.estSonore()) return null;
    if ([...root.querySelectorAll('audio')].some(audio => !audio.paused)) return null;
    if (place) return place;
    return silenceFini ? 'ouverture' : null;
  }

  function accorderAmbiance() {
    const voulue = ambianceVoulue();
    // La toute première montée de la photographie est plus lente : elle sort
    // du long silence de l'entrée.
    const premiere = voulue === 'ouverture' && !ambianceEntendue;
    if (voulue === 'ouverture') ambianceEntendue = true;
    ambiance.vouloir(voulue, premiere ? CONFIG.ambiance.premiereEntreeMs : CONFIG.ambiance.entreeMs);
  }

  let audioRequest = 0;
  let pendingAudio = null;
  function stopAudio() {
    audioRequest++;
    pendingAudio = null;
    currentAudio = null;
    root.querySelectorAll('audio').forEach(audio => audio.pause());
    notifyForeground();
  }

  function setupAudio() {
    root.querySelectorAll('[data-audio]').forEach(button => {
      const audio = getElement(button.dataset.audio);
      const callout = button.closest('.audio-callout');
      const time = callout.querySelector('.time');
      const title = callout.querySelector('.title').textContent.trim();
      button.dataset.playLabel = TEXTES.lire + ' « ' + title + ' »';
      button.dataset.pauseLabel = TEXTES.mettreEnPause + ' « ' + title + ' »';
      setAudioVisual(callout, button, false);

      const updateTime = () => {
        if (Number.isFinite(audio.duration)) {
          time.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
        }
      };
      on(audio, 'loadedmetadata', updateTime);
      on(audio, 'timeupdate', updateTime);
      on(audio, 'play', () => {
        if (disposed || leaving || currentAudio?.audio !== audio) { audio.pause(); return; }
        setAudioVisual(callout, button, true);
        notifyForeground();
      });
      on(audio, 'pause', () => {
        setAudioVisual(callout, button, false);
        notifyForeground();
      });
      on(audio, 'ended', () => {
        audio.currentTime = 0;
        updateTime();
        setAudioVisual(callout, button, false);
        if (currentAudio?.audio === audio) currentAudio = null;
        notifyForeground();
      });
      on(button, 'click', async () => {
        if (disposed || leaving || !introFinished) return;
        if (!audio.paused || pendingAudio === audio) {
          stopAudio();
          return;
        }
        stopAudio();
        const request = audioRequest;
        currentAudio = { audio, button, callout };
        pendingAudio = audio;
        try {
          await audio.play();
          if (disposed || leaving || request !== audioRequest) {
            // Une lecture plus récente du même extrait garde la main.
            if (disposed || leaving || currentAudio?.audio !== audio) audio.pause();
          }
        } catch (error) {
          if (disposed || leaving || request !== audioRequest) return;
          currentAudio = null;
          setAudioVisual(callout, button, false);
          notifyForeground();
          if (error.name !== 'AbortError') console.error('[chp5] Lecture audio impossible.', error);
        } finally {
          if (request === audioRequest) pendingAudio = null;
        }
      });
    });
  }

  function chooseNextFocus(t) {
    const random = Math.random();

    if (random < 0.03) {
      focusMode = 'sharp';
      focusTo = 0.10 + Math.random() * 0.16;
      focusDuration = 430 + Math.random() * 420;
      focusHoldUntil = t + focusDuration + 300 + Math.random() * 650;
      huntAmplitude = 0;
    } else if (random < 0.12) {
      focusMode = 'hunt';
      focusTo = 0.42 + Math.random() * 0.42;
      focusDuration = 520 + Math.random() * 520;
      focusHoldUntil = t + focusDuration + 450 + Math.random() * 900;
      huntStart = t;
      huntDuration = 620 + Math.random() * 620;
      huntAmplitude = 0.38 + Math.random() * 0.48;
      huntCycles = 1.35 + Math.random() * 0.75;
    } else if (random < 0.36) {
      focusMode = 'soft';
      focusTo = 0.82 + Math.random() * 0.43;
      focusDuration = 520 + Math.random() * 650;
      focusHoldUntil = t + focusDuration + 700 + Math.random() * 1500;
      huntAmplitude = 0;
    } else {
      focusMode = 'steady';
      focusTo = 0.40 + Math.random() * 0.48;
      focusDuration = 480 + Math.random() * 720;
      focusHoldUntil = t + focusDuration + 1200 + Math.random() * 2500;
      huntAmplitude = 0;
    }

    focusFrom = focusBlur;
    focusStart = t;
  }

  function updateFocus(t) {
    if (t >= focusHoldUntil) chooseNextFocus(t);

    const progress = clamp((t - focusStart) / focusDuration, 0, 1);
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    focusBlur = focusFrom + (focusTo - focusFrom) * eased;

    let hunt = 0;
    if (focusMode === 'hunt') {
      const huntProgress = clamp((t - huntStart) / huntDuration, 0, 1);
      if (huntProgress < 1) {
        const envelope = Math.pow(1 - huntProgress, 1.65);
        const oscillation = Math.abs(Math.sin(huntProgress * Math.PI * 2 * huntCycles));
        hunt = oscillation * huntAmplitude * envelope;
      }
    }

    const microCorrection =
      Math.sin(t * 0.00105 + 0.8) * 0.035 +
      Math.sin(t * 0.00237 + 2.4) * 0.016;

    const pointerActivity = Math.min(
      1,
      Math.hypot(pointerNX - smoothNX, pointerNY - smoothNY) * 1.8
    );

    const finalBlur = clamp(
      focusBlur + hunt + microCorrection + pointerActivity * FOCUS.main,
      FOCUS.min,
      FOCUS.max
    );

    // Le recul emporte la mise au point avec lui — AJOUTÉ HORS DU CLAMP, qui
    // borne la respiration de l'objectif, pas l'éloignement.
    background.style.filter = `blur(${(finalBlur + reculP * PORTE.flou).toFixed(3)}px)`;
  }

  function updateCamera(t) {
    smoothNX += (pointerNX - smoothNX) * CAMERA.suivi;
    smoothNY += (pointerNY - smoothNY) * CAMERA.suivi;

    // La dérive au repos : les fréquences sont la signature du geste, et
    // restent ici ; son AMPLEUR se règle (`camera.derive`).
    const idleCamX = (
      Math.sin(t * 0.00023 + 0.4) * 4.8 +
      Math.sin(t * 0.00051 + 2.1) * 2.0 +
      Math.sin(t * 0.00107 + 0.7) * 0.75) * CAMERA.derive;

    const idleCamY = (
      Math.sin(t * 0.00019 + 1.5) * 3.7 +
      Math.sin(t * 0.00047 + 0.2) * 1.7 +
      Math.sin(t * 0.00091 + 2.6) * 0.65) * CAMERA.derive;

    let introMotion = 1;
    if (introStartedAt !== null && !introFinished) {
      const progress = clamp((t - introStartedAt) / INTRO.cameraMs, 0, 1);
      introMotion = Math.pow(progress, 0.82);
    }

    cameraX = baseCameraShiftX * introMotion +
      (-smoothNX * CAMERA.parallaxe.x + idleCamX) * motionFactor * introMotion;
    cameraY = baseCameraShiftY * introMotion +
      (-smoothNY * CAMERA.parallaxe.y + idleCamY) * motionFactor * introMotion;

    cameraRot = (
      -smoothNX * 0.075 +
      (Math.sin(t * 0.00017 + 0.9) * 0.055 +
       Math.sin(t * 0.00043 + 2.3) * 0.018) * CAMERA.derive
    ) * motionFactor;

    let introApproach = 1;
    if (introStartedAt !== null && !introFinished) {
      const progress = clamp((t - introStartedAt) / INTRO.cameraMs, 0, 1);
      introApproach = 1 - Math.pow(1 - progress, 3);
    }

    const approachedScale = 1 + (targetBaseScale - 1) * introApproach;
    const respiration = (
      Math.sin(t * 0.00015 + 0.5) * 0.0032 +
      Math.sin(t * 0.00039 + 1.7) * 0.0011
    ) * CAMERA.derive * motionFactor * (0.25 + 0.75 * introApproach);

    // LE RECUL — on s'éloigne de la salle pendant que la porte se referme.
    // Multiplicatif, donc rigoureusement neutre tant que reculP vaut 0.
    cameraScale = (approachedScale + respiration) * (1 - reculP * (1 - PORTE.recul));

    camera.style.transform =
      `translate3d(${cameraX.toFixed(2)}px, ${cameraY.toFixed(2)}px, 0) ` +
      `rotate(${cameraRot.toFixed(4)}deg) scale(${cameraScale.toFixed(5)})`;
  }

  function updateCalloutMotion(t) {
    for (const callout of callouts) {
      const { index, phase, depth } = callout;

      const driftX =
        Math.sin(t * (0.00028 + index * 0.000019) + phase) * (2.3 + index * 0.28) +
        Math.sin(t * 0.00083 + phase * 0.7) * 0.85;

      const driftY =
        Math.cos(t * (0.00024 + index * 0.000017) + phase * 0.8) * (1.8 + index * 0.22) +
        Math.sin(t * 0.00069 + phase) * 0.7;

      let moveX = (smoothNX * CARTELS.parallaxe.x * depth + driftX) * motionFactor;
      let moveY = (smoothNY * CARTELS.parallaxe.y * depth + driftY) * motionFactor;

      const dx = pointerPxX - callout.centerX;
      const dy = pointerPxY - callout.centerY;
      const distance = Math.hypot(dx, dy);
      const influence = Math.max(0, 1 - distance / CARTELS.repousse.rayon);
      const eased = influence * influence * (3 - 2 * influence);

      if (distance > 0.001) {
        moveX += (dx / distance) * eased * CARTELS.repousse.x * motionFactor;
        moveY += (dy / distance) * eased * CARTELS.repousse.y * motionFactor;
      }

      const rotation =
        Math.sin(t * 0.00021 + phase) * 0.065 +
        smoothNX * 0.035 * (index % 2 ? 1 : -1);

      callout.element.style.setProperty('--move-x', `${moveX.toFixed(2)}px`);
      callout.element.style.setProperty('--move-y', `${moveY.toFixed(2)}px`);
      callout.element.style.setProperty('--idle-rot', `${rotation.toFixed(4)}deg`);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     LA PORTE — entrer dans « Dans les réserves du Musée de l'Homme »
     ═══════════════════════════════════════════════════════════════════════════
     Ce n'est pas une scène, c'est un LIEU SUPERPOSÉ : on ne quitte pas le
     chapitre, on recule. La photographie s'éloigne et se trouble, les deux
     battants entrent par les côtés et se rejoignent, le noir prend la salle —
     puis la caméra pousse sur le panneau « Anthropologie biologique ».
     La flèche de retour, pendant ce temps, appartient à la scène : le moteur
     dit seulement ce qui passe au premier plan (onListen) et où l'on se trouve
     (onPart). Voir Chapitre5Scene. */

  /** La porte posée : bornée en hauteur, et en largeur sur les écrans étroits.
      Le noir de part et d'autre n'est pas un défaut de cadrage : la porte est
      en portrait, la fenêtre presque jamais. */
  function porteGeometrie() {
    const ratio = PORTE.width / PORTE.height;
    let h = vh * PORTE.hauteur / 100;
    let w = h * ratio;
    const largeurMax = vw * PORTE.largeurMax / 100;
    if (w > largeurMax) { w = largeurMax; h = w / ratio; }
    return { w, h };
  }

  /**
   * TOUT L'ÉCRAN DE LA PORTE, DÉDUIT DES QUATRE AVANCEMENTS.
   * ───────────────────────────────────────────────────────────────────────────
   * Une écriture par élément, et rien que des `transform` : le compositeur les
   * joue sans repeindre deux images de 2208 × 2968.
   *
   * ⚠️ LE GROS PLAN EST UNE ANCRE QUI GLISSE, PAS UN `transform-origin`. Le
   * panneau doit arriver AU CENTRE de la fenêtre : il faut donc grossir et
   * recadrer en même temps. Le point du cadre qu'on tient au centre passe du
   * milieu de la porte au milieu du panneau pendant que l'échelle monte, et
   * une seule formule — T = centre − ancre × échelle — écrit les deux gestes.
   * Un `transform-origin` posé sur le panneau l'aurait fait grossir SUR PLACE,
   * donc déborder d'un seul côté.
   *
   * ⚠️ LA PLUS PETITE DES DEUX CONTRAINTES GAGNE : le panneau est montré
   * entier, jamais rogné. C'est un document administratif — ce qu'il dit en
   * petit (« Exposition de restes humains ») fait partie de ce qu'on vient
   * lire.
   */
  function renderPorte() {
    const { w, h } = porteGeometrie();
    porteCadre.style.width = w + 'px';
    porteCadre.style.height = h + 'px';

    // ⚠️ CHAQUE BATTANT OCCUPE SA PART DU CADRE, ET ELLE EST FIXE. Les deux
    // images ne sont plus le canevas entier à transparence complémentaire
    // (c'étaient des PNG de 6,5 Mo) mais les deux MORCEAUX de la photographie,
    // coupés sur le joint : le gauche en tient 39 %, le droit 61 %. Posés
    // ainsi, ils refont l'image au pixel près — et les translations qui
    // suivent, elles, n'ont pas changé d'un iota.
    const partGauche = PORTE.joint / PORTE.width * 100;
    porteGauche.style.width = partGauche.toFixed(4) + '%';
    porteDroite.style.left = partGauche.toFixed(4) + '%';
    porteDroite.style.width = (100 - partGauche).toFixed(4) + '%';

    // Chaque battant sort par SON côté : la lisière (`joint`) dit exactement
    // de combien il doit s'effacer pour avoir quitté l'écran.
    const joint = (vw - w) / 2 + PORTE.joint / PORTE.width * w;
    const ouvert = 1 - fermeP;
    porteGauche.style.transform = `translate3d(${(-ouvert * (joint + 6)).toFixed(1)}px,0,0)`;
    porteDroite.style.transform = `translate3d(${(ouvert * (vw - joint + 6)).toFixed(1)}px,0,0)`;

    const panneauW = PORTE.panneau.width / PORTE.width * w;
    const panneauH = PORTE.panneau.height / PORTE.height * h;
    const grosPlan = Math.min(
      vw * PORTE.panneauLargeur / 100 / panneauW,
      vh * PORTE.panneauHauteur / 100 / panneauH
    );
    // Les battants arrivent d'un rien trop près : la porte se pose en reculant
    // avec nous, au lieu de s'immobiliser net.
    const approche = 1 + ouvert * 0.05;
    const echelle = approche + (grosPlan - approche) * zoomP;

    const viseX = (PORTE.panneau.x + PORTE.panneau.width / 2) / PORTE.width * w;
    const viseY = (PORTE.panneau.y + PORTE.panneau.height / 2) / PORTE.height * h;
    const ancreX = w / 2 + (viseX - w / 2) * zoomP;
    const ancreY = h / 2 + (viseY - h / 2) * zoomP;

    porteCadre.style.transform =
      `translate3d(${(vw / 2 - ancreX * echelle).toFixed(1)}px, ` +
      `${(vh / 2 - ancreY * echelle).toFixed(1)}px, 0) ` +
      `scale(${echelle.toFixed(4)})`;

    porteVoile.style.opacity = voileP.toFixed(3);
  }

  /* ── Le noir de passage — un fondu, une seule interpolation ─────────────── */
  let nuitDe = 0, nuitVers = 0, nuitT0 = 0, nuitMs = 1;

  function fondreNuit(vers, ms) {
    nuitDe = nuitP;
    nuitVers = vers;
    nuitT0 = performance.now();
    nuitMs = Math.max(1, ms);
  }

  function updateNuit(t) {
    if (nuitP === nuitVers) return;
    nuitP = nuitDe + (nuitVers - nuitDe) * easeInOut(clamp((t - nuitT0) / nuitMs, 0, 1));
    nuit.style.opacity = nuitP.toFixed(3);
  }

  function poserNuit(valeur) {
    nuitP = nuitDe = nuitVers = valeur;
    nuit.style.opacity = String(valeur);
  }

  /**
   * ⚠️ SOUS « MOUVEMENT RÉDUIT », LA BOUCLE NE TOURNE PAS (voir startLoop) :
   * un fondu posé là n'aurait personne pour l'interpoler et le noir ne
   * viendrait JAMAIS — le décor changerait à vue, sans passage. On pose donc
   * la valeur d'arrivée, et l'on rend la durée réellement attendue (zéro).
   */
  function allerNuit(vers, ms) {
    if (reduceMotion) { poserNuit(vers); return 0; }
    fondreNuit(vers, ms);
    return ms;
  }

  /** L'extinction d'un passage — rien à attendre si l'on est DÉJÀ dans le
      noir (l'arrivée directe, le relais d'un lieu à l'autre). */
  function eteindre(ms) {
    return nuitP >= 0.999 ? 0 : allerNuit(1, ms);
  }

  /* ── LA PORTE — une chronologie, quatre avancements ─────────────────────── */

  function updatePorte(t) {
    const e = t - placeT0;

    if (placeGeste === 'aller') {
      reculP = easeOut(clamp(e / PORTE.reculMs, 0, 1));
      fermeP = easeOut(clamp((e - PORTE.fermeAt) / PORTE.fermeMs, 0, 1));
      // Le fond est complet a l'instant exact ou les battants se rejoignent.
      voileP = clamp(e / (PORTE.fermeAt + PORTE.fermeMs), 0, 1);
      const zoomAt = PORTE.fermeAt + PORTE.fermeMs + PORTE.poseMs;
      zoomP = easeInOut(clamp((e - zoomAt) / PORTE.zoomMs, 0, 1));
      renderPorte();
      if (e >= zoomAt + PORTE.zoomMs) placePosee();
      return;
    }

    // Le retour : le gros plan s'eloigne d'abord, les battants s'ecartent
    // ensuite, et la salle revient avec eux.
    zoomP = 1 - easeInOut(clamp(e / PORTE.retourZoomMs, 0, 1));
    const ouvre = easeInOut(clamp((e - PORTE.ouvreAt) / PORTE.ouvreMs, 0, 1));
    fermeP = voileP = reculP = 1 - ouvre;
    renderPorte();
    if (e >= PORTE.ouvreAt + PORTE.ouvreMs) placeRendue();
  }

  /* ── LA VITRINE — pas une chronologie : des étapes qui s'attendent ───────
     On éteint, on charge (derrière le noir, le temps qu'il faut), on monte le
     décor, on retire le noir sous une torche encore éteinte — l'écran ne
     bouge pas d'un pouce, c'est le canevas qui a pris le relais du voile —
     puis on rallume. Chaque étape vérifie qu'elle a encore lieu d'être. */

  const attendre = ms => new Promise(resolve => schedule(resolve, ms));
  const encore = geste => !disposed && !leaving && place === 'vitrine' && placeGeste === geste;

  /**
   * ⚠️ LA PRISE PLEINE NE DESCEND JAMAIS TOUT À FAIT À ZÉRO, ET C'EST UNE
   * MESURE, PAS UNE COQUETTERIE. À opacité nulle, le compositeur abandonne sa
   * texture et doit la reconstruire au moindre changement : mesuré du temps
   * des masters, une image de 200 ms, puis de 50 et 166 ms. Maintenue à deux
   * millièmes, elle reste résidente. Deux millièmes de la DIFFÉRENCE entre les
   * deux prises, c'est moins d'un niveau sur 255 : rien à l'œil — le crâne est
   * parti.
   */
  const PLANCHER_PLEIN = 0.002;

  /**
   * LE CRÂNE S'EFFACE À MESURE QU'ON CONSULTE LES PIÈCES. La prise pleine est
   * à 100 % tant qu'on n'a rien ouvert, à 0 % quand tout a été vu ; entre les
   * deux, chaque pièce retire sa part.
   *
   * ⚠️ LE PAS SE JOUE À LA FERMETURE DE LA PIÈCE, pas à son ouverture : sous
   * le voile de la fenêtre on ne l'aurait pas vu. On rend la vitrine, et le
   * crâne recule d'un pas, en fondu (`restitution.effacementMs`).
   *
   * ⚠️ ET À L'ARRIVÉE IL EST POSÉ, PAS JOUÉ (`immediat`) : on revient dans un
   * lieu où l'on a déjà lu, le crâne y est déjà à demi parti — on ne doit pas
   * le voir s'effacer de nouveau sous la torche qui s'ouvre.
   *
   * @param {boolean} immediat poser la valeur sans fondu.
   */
  function poserPresence(immediat) {
    const { vues, total } = boites.progres();
    const presence = total > 0 ? 1 - vues / total : 1;
    vitrinePlein.style.transition = (immediat || reduceMotion)
      ? 'none'
      : 'opacity ' + RESTIT.effacementMs + 'ms cubic-bezier(.4,0,.2,1)';
    vitrinePlein.style.opacity = Math.max(PLANCHER_PLEIN, presence).toFixed(3);
  }

  /**
   * LA TORCHE NAÎT À L'ENTRÉE D'UN LIEU ET MEURT AU RETOUR. Laissée en vie, elle
   * repeindrait un canevas plein écran soixante fois par seconde pour toute la
   * visite du chapitre, y compris devant la photographie où elle n'a rien à
   * faire. Chaque lieu éclairé a SON canevas (dans sa couche, qui se montre et
   * se cache avec lui) ; il n'y en a jamais deux vivants à la fois.
   */
  function creerTorche(canvas, taille) {
    torche = new TorchSystem(window.CONFIG, canvas);
    torche.setCentered(true);                 // fixe au centre — comme la phrénologie
    torche.setRadius(0);                      // on part du noir…
    torche.setTarget(taille);                 // …et l'on ouvre jusque-là
  }

  function monterVitrine() {
    stage.classList.add('vitrine-en-jeu');
    poserPresence(true);

    creerTorche(vitrineTorche, RESTIT.torche.size);

    // L'INVENTAIRE S'ÉCRIT PENDANT QUE LA TORCHE S'OUVRE (voir boites.dessinAt) :
    // il compte donc son temps depuis ici, c'est-à-dire depuis le lever du noir.
    boites.monter();
  }

  function demonterVitrine() {
    boites.demonter();
    torche?.destroy();
    torche = null;
    stage.classList.remove('vitrine-en-jeu');
  }

  async function ouvrirVitrine() {
    // ⚠️ LES BOÎTES NE SONT PAS UNE CONDITION D'ENTRÉE. Ce sont neuf dessins,
    // un ornement : si leur chargement échoue, le lieu se joue sans elles
    // plutôt que de renvoyer le visiteur à la photographie. C'est la même
    // règle que pour le son — un agrément n'est jamais une dépendance.
    const [pret] = await Promise.all([
      chargerVitrine(),
      boites.precharger(),
      attendre(eteindre(RESTIT.noirMs)),
    ]);
    if (!encore('attente')) return;
    if (!pret) { placeAbandonnee(); return; }

    monterVitrine();
    placeGeste = 'aller';
    await attendre(allerNuit(0, RESTIT.leveMs));
    if (!encore('aller')) return;

    // La torche a sa PROPRE boucle de rendu : elle s'allume même sous
    // « mouvement réduit », simplement sans durée.
    const allumage = reduceMotion ? 1 : RESTIT.torche.growMs;
    torche.grow(allumage);
    await attendre(allumage);
    if (!encore('aller')) return;
    placePosee();
  }

  async function fermerVitrine() {
    // ⚠️ LES BOÎTES S'EFFACENT AVANT QUE LA LUMIÈRE TOMBE, et l'ordre n'est pas
    // négociable : elles vivent AU-DESSUS du canevas de la torche. Éteindre
    // d'abord, c'est les laisser blanches et intactes sur une photographie
    // déjà noire — un décor qu'on emporte au lieu d'un lieu qu'on quitte.
    visionneuse.fermer();
    const effacement = boites.sortir();
    if (effacement) await attendre(effacement);
    if (!encore('retour')) return;

    await torche.fadeOut(RESTIT.torche.fadeMs);
    if (!encore('retour')) return;

    // Tout est déjà noir : le voile reprend le relais du canevas sans qu'on
    // voie la passation, et c'est LUI qui se retirera sur la salle.
    poserNuit(1);
    demonterVitrine();
    // Vers un autre lieu, le noir reste : c'est lui qui les relie.
    if (!versUnLieu()) {
      await attendre(allerNuit(0, RESTIT.retourMs));
      if (!encore('retour')) return;
    }
    placeRendue();
  }

  /* ── LE PANORAMA — la vitrine au buste et la planche sous la main ─────────
     Chaque image est posée dans un cadre à SES proportions, qui COUVRE la
     fenêtre et la dépasse encore d'un peu (`inhumation.panorama.debord`) :
     pas de bande noire, et du champ de part et d'autre. La main le fait
     glisser — elle à droite, on voit la droite de l'image ; elle en bas, le
     bas —, lissée à chaque image (`suivi`) : un regard qui se déplace, pas
     une image qui suit le curseur. La main partie, l'image revient au centre.

     ⚠️ LA PORTÉE EST TOUT LE DÉBORD, PAS UN DEGRÉ FIXE. Une amplitude fixe
     laisserait hors d'atteinte ce que la couverture rogne — le texte du bas
     de la planche, en 16/10. Du bord gauche au bord droit de la fenêtre, la
     main parcourt l'image entière.

     ⚠️ Sous « mouvement réduit », la boucle ne tourne pas : l'image reste au
     centre, couvrante — sans bande noire, sans mouvement. */
  function poserPanorama() {
    for (const cadre of cadresPano) {
      const iw = cadre.img.naturalWidth;
      const ih = cadre.img.naturalHeight;
      if (!iw || !ih) continue;          // pas encore décodée : on repassera
      const rapport = iw / ih;
      const w = Math.max(vw, vh * rapport) * INHUM.panorama.debord;
      const h = w / rapport;
      cadre.rx = (w - vw) / 2;
      cadre.ry = (h - vh) / 2;
      const style = cadre.el.style;
      style.width = w.toFixed(1) + 'px';
      style.height = h.toFixed(1) + 'px';
      style.left = ((vw - w) / 2).toFixed(1) + 'px';
      style.top = ((vh - h) / 2).toFixed(1) + 'px';
    }
    deplacerPanorama();
  }

  function deplacerPanorama() {
    for (const cadre of cadresPano) {
      cadre.el.style.transform =
        'translate3d(' + (-panX * cadre.rx).toFixed(2) + 'px, ' + (-panY * cadre.ry).toFixed(2) + 'px, 0)';
    }
  }

  function updatePanorama() {
    const dx = pointerNX - panX;
    const dy = pointerNY - panY;
    // Arrivée : on ne réécrit plus rien — zéro travail au repos.
    if (Math.abs(dx) < 0.0004 && Math.abs(dy) < 0.0004) return;
    panX += dx * INHUM.panorama.suivi;
    panY += dy * INHUM.panorama.suivi;
    deplacerPanorama();
  }

  /* ── L'INHUMATION — l'entrée du chapitre 1, rejouée ici ───────────────────
     On éteint ; une torche fixe se rallume sur la vitrine des crânes. Pas de
     flèche, pas de boussole : tant que `placeGeste` court, le premier plan
     est occupé (`occupe`) et la scène les tient éclipsées. Quelques secondes,
     puis la voix, et « Passer ». La voix finie — ou passée —, la photographie
     BASCULE sur la vitrine au buste, la lumière s'élargit, et c'est seulement
     là que le lieu est POSÉ : l'interface revient. */

  const encoreIci = geste => !disposed && !leaving && place === 'inhumation' && placeGeste === geste;

  function chargerInhumation() {
    if (inhumPret) return inhumPret;
    inhumAvant.src = INHUM.avant;
    inhumApres.src = INHUM.apres;
    // La planche du drapeau aussi, dès maintenant : derrière le noir, son
    // décodage ne se voit pas ; au clic sur le drapeau, il se verrait.
    inhumFond.src = INHUM.fond;
    inhumPret = Promise.all([inhumAvant.decode(), inhumApres.decode(), inhumFond.decode()])
      .then(() => true)
      .catch(erreur => {
        if (!disposed) console.warn('[chp5] Les photographies de l\'inhumation n\'ont pas pu etre chargees.', erreur);
        inhumPret = null;   // on retentera à la prochaine visite du lieu
        return false;
      });
    return inhumPret;
  }

  /**
   * ⚠️ LA VOIX EST VIDÉE, PAS RANGÉE : pause, source retirée, `load()`. Un
   * `<audio>` dont la sélection de ressource a commencé reste vivant dans le
   * moteur média (règle d'août 2026) — et celle-ci, qu'on la passe ou qu'on
   * s'en aille, ne doit JAMAIS suivre le visiteur ailleurs.
   */
  function viderVoix() {
    if (!voix) return;
    voix.onended = voix.onerror = voix.onplay = voix.onpause = null;
    voix.pause();
    voix.removeAttribute('src');
    voix.load();
    voix = null;
  }

  function taillePasser() {
    // La taille des flèches du site, comme le « Passer » du chapitre 1
    // (Chapitre1Scene._getSkipSize) : un bouton trois fois plus large que haut.
    const A = window.CONFIG.ARROW;
    const M = window.CONFIG.MIN_SIZE;
    const cote = Math.min(Math.max(M.width, innerWidth), Math.max(M.height, innerHeight));
    const h = Math.round(Math.max(A.size_min, Math.min(A.size_max, cote * A.size_vh / 100)));
    return { w: h * 3, h };
  }

  function dessinerPasser() {
    const { w, h } = taillePasser();
    // ⚠️ Tracé en PIXELS RÉELS : tirets égaux au périmètre, jamais pathLength.
    const perimetre = 2 * ((w - 2) + (h - 2));
    const police = Math.min(15, Math.max(9, Math.round(h * 0.38)));
    passer.innerHTML =
      '<span class="passer-cadre"><svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
        '<rect x="1" y="1" width="' + (w - 2) + '" height="' + (h - 2) + '"' +
        ' stroke-dasharray="' + perimetre + '" stroke-dashoffset="' + perimetre + '"/>' +
        '<text x="' + (w / 2) + '" y="' + (h / 2) + '" font-size="' + police + '"' +
        ' dominant-baseline="middle" text-anchor="middle">' + TEXTES.passer + '</text>' +
      '</svg></span>';
  }

  function montrerPasser() {
    if (!encoreIci('aller')) return;
    dessinerPasser();
    passer.hidden = false;
    // Le clic sur le « 3 » a rendu son cartel inert : le focus est tombé sur
    // `body`. On le pose sur « Passer », seule chose qu'il y ait à faire ici —
    // sans quoi, au clavier, on ne pourrait plus que tout écouter.
    if (!document.activeElement || document.activeElement === document.body) {
      passer.focus({ preventScroll: true });
    }
    nextFrame(() => nextFrame(() => passer.classList.add('passer--visible', 'passer--trace')));
  }

  function cacherPasser(immediat = false) {
    passer.classList.remove('passer--visible');
    const fin = () => {
      if (passer.classList.contains('passer--visible')) return;
      passer.hidden = true;
      passer.classList.remove('passer--trace');
      passer.replaceChildren();
    };
    if (immediat || reduceMotion) fin();
    else schedule(fin, 600);
  }

  function monterInhumation() {
    stage.classList.remove('inhumation-bascule');
    stage.classList.add('inhumation-en-jeu');
    // Les images sont décodées : leurs proportions sont connues. On part du
    // centre, où que soit la main — elle prendra le relais en douceur.
    panX = panY = 0;
    poserPanorama();
    creerTorche(inhumTorche, INHUM.torche.size);
  }

  function demonterInhumation() {
    fermerPlanche(false);
    cacherPasser(true);
    visionneuse.fermer();
    viderVoix();
    tombes.demonter();
    torche?.destroy();
    torche = null;
    stage.classList.remove('inhumation-en-jeu', 'inhumation-bascule', 'inhumation-inhume');
  }

  async function ouvrirInhumation() {
    // La voix se charge PENDANT l'extinction et la torche : ~7 s d'avance sur
    // sa première syllabe, pour 0,9 Mo. Elle n'est pas une condition d'entrée
    // — sans elle, on bascule directement (cf. ecouterVoix).
    voix = new Audio();
    voix.preload = 'auto';
    voix.src = INHUM.voix;

    // Les dessins de la tombe et du drapeau se lisent AUSSI derrière le noir
    // (ils ne servent qu'après la voix, mais leur mesure coûte une image).
    // Comme les boîtes, ils sont un ornement : leur échec n'empêche rien.
    const [pret] = await Promise.all([
      chargerInhumation(),
      tombes.precharger(),
      attendre(eteindre(INHUM.noirMs)),
    ]);
    if (!encoreIci('attente')) return;
    if (!pret) { viderVoix(); placeAbandonnee(); return; }

    monterInhumation();
    placeGeste = 'aller';
    await attendre(allerNuit(0, INHUM.leveMs));
    if (!encoreIci('aller')) return;

    const allumage = reduceMotion ? 1 : INHUM.torche.growMs;
    torche.grow(allumage);
    await attendre(allumage + INHUM.voixApresMs);
    if (!encoreIci('aller')) return;
    ecouterVoix();
  }

  function ecouterVoix() {
    const echec = erreur => {
      if (!encoreIci('aller')) return;
      console.warn('[chp5] La voix de l\'inhumation n\'a pas pu etre lue : on passe a la suite.', erreur);
      basculer();
    };
    voix.onended = () => basculer();
    voix.onerror = () => echec(voix?.error);
    voix.play().then(
      () => schedule(montrerPasser, INHUM.passerApresMs),
      erreur => { if (erreur?.name !== 'AbortError') echec(erreur); });
  }

  /** La voix est finie, ou passée : l'autre photographie monte. */
  async function basculer() {
    if (!encoreIci('aller')) return;
    placeGeste = 'bascule';
    cacherPasser();
    viderVoix();             // coupée net, comme au chapitre 1
    stage.classList.add('inhumation-bascule');
    const duree = reduceMotion ? 1 : INHUM.basculeMs;
    torche.setTarget(INHUM.torche.apres);
    torche.grow(duree);
    await attendre(duree + 150);
    if (!encoreIci('bascule')) return;
    placePosee();            // la flèche revient, la boussole avec elle
    // …puis les tombes et le drapeau s'écrivent, sur l'image assombrie.
    tombes.monter();
  }

  /**
   * LA PLANCHE DU DRAPEAU — plein écran, avec sa voix.
   * Le drapeau ne s'ouvre pas dans la fenêtre : la rangée entière se
   * DÉ-ÉCRIT (les cinq dessins, comme à la sortie du lieu), la planche
   * « L'inhumation symbolique » monte à la place de la vitrine au buste — sans
   * obscurité ni torche, lisible —, et la seconde voix d'Alicia commence. En
   * bas, son crédit, tant qu'elle parle ; en haut à droite, une croix.
   * La voix finie (ou la croix, ou Échap), la planche redescend et la rangée
   * se réécrit. Pas de sinusoïde : c'est la planche qu'on regarde.
   */
  function ouvrirPlanche(item, depuis) {
    if (disposed || leaving || place !== 'inhumation' || !placeOuverte || planche) return;
    planche = { item, depuis };
    tombes.sortir();
    stage.classList.add('inhumation-inhume');
    plancheCredit.querySelector('span').textContent = item.credit;
    plancheCroix.hidden = false;
    nextFrame(() => nextFrame(() => plancheCroix.classList.add('planche-croix--visible')));
    plancheCroix.focus({ preventScroll: true });
    notifyForeground();            // la flèche et la boussole s'effacent

    viderVoix();
    voix = new Audio();
    voix.preload = 'auto';
    // Le fichier est une PIÈCE : il vit avec les autres (⑩ `fenetre.pieces`).
    voix.src = CONFIG.fenetre.pieces + item.piece;
    // Le crédit dit QUI parle, et seulement pendant qu'elle parle.
    voix.onplay = () => plancheCredit.classList.add('planche-credit--visible');
    voix.onpause = () => plancheCredit.classList.remove('planche-credit--visible');
    voix.onended = () => fermerPlanche();
    voix.onerror = () => {
      console.warn('[chp5] La voix du drapeau n\'a pas pu etre lue.', voix?.error);
      fermerPlanche();
    };
    voix.play().catch(erreur => {
      if (erreur?.name !== 'AbortError') console.warn('[chp5] La voix du drapeau n\'a pas pu demarrer.', erreur);
    });
  }

  /**
   * La planche redescend. `retablir` : la rangée se réécrit, et le focus
   * revient au drapeau une fois écrit — à faux quand on QUITTE le lieu (le
   * démontage s'en charge, il n'y a rien à rendre).
   */
  function fermerPlanche(retablir = true) {
    if (!planche) return;
    const { depuis } = planche;
    planche = null;
    viderVoix();
    plancheCredit.classList.remove('planche-credit--visible');
    plancheCroix.classList.remove('planche-croix--visible');
    const cacherCroix = () => { if (!planche) plancheCroix.hidden = true; };
    if (reduceMotion || !retablir) cacherCroix();
    else schedule(cacherCroix, 600);
    stage.classList.remove('inhumation-inhume');
    notifyForeground();
    if (!retablir) return;

    tombes.monter();
    // Le focus était sur la croix, qui s'en va : il revient au drapeau, une
    // fois celui-ci réécrit (un bouton invisible ne le prendrait pas).
    const reecrit = reduceMotion ? 0 : INHUM.tombes.dessinAt + CONFIG.geste.petiteDessinMs + CONFIG.geste.encreMs;
    schedule(() => {
      const perdu = !document.activeElement || document.activeElement === document.body || document.activeElement === plancheCroix;
      if (perdu && depuis?.isConnected) depuis.focus({ preventScroll: true });
    }, reecrit);
  }

  async function fermerInhumation() {
    // Même ordre qu'à la vitrine : la fenêtre se ferme, la voix se tait, les
    // dessins se DÉ-ÉCRIVENT, et la lumière ne tombe qu'ensuite — ils vivent
    // au-dessus du canevas de la torche.
    visionneuse.fermer();
    viderVoix();
    const effacement = tombes.sortir();
    if (effacement) await attendre(effacement);
    if (!encoreIci('retour')) return;
    await torche.fadeOut(INHUM.torche.fadeMs);
    if (!encoreIci('retour')) return;
    // Tout est noir : le voile reprend le relais du canevas, comme au « 2 ».
    poserNuit(1);
    demonterInhumation();
    if (!versUnLieu()) {
      await attendre(allerNuit(0, INHUM.retourMs));
      if (!encoreIci('retour')) return;
    }
    placeRendue();
  }

  /* ── Entrer, arriver, revenir ───────────────────────────────────────────── */

  const indexDe = lieu => Number(Object.keys(LIEUX).find(cle => LIEUX[cle] === lieu));

  function placePosee() {
    const index = indexDe(place);
    placeGeste = null;
    placeOuverte = true;
    // L'ordre compte : la scène apprend qu'on est ARRIVÉ (elle rend la flèche)
    // avant d'apprendre que le premier plan s'est libéré.
    onPart(index, 'arrivee');
    notifyForeground();
    poursuivre();
  }

  function placeRendue() {
    placeGeste = null;
    placeOuverte = false;
    place = null;
    reculP = fermeP = voileP = zoomP = 0;
    renderPorte();
    stage.classList.remove('porte-en-jeu');
    // LE RELAIS : un autre lieu est demandé. On est dans le noir, la salle
    // n'a pas reparu — on y reste, et l'on ouvre le suivant depuis lui.
    if (versUnLieu()) { poursuivre(); return; }
    poserNuit(0);
    stage.classList.remove('hors-salle');
    setCalloutsInert(false);
    onPart(null, 'arrivee');
    notifyForeground();
    poursuivre();
  }

  /** Un décodage a échoué (fichier manquant, mémoire) : on rend la salle
      plutôt que de laisser le visiteur devant un écran qui ne vient pas. */
  function placeAbandonnee() {
    placeGeste = null;
    placeOuverte = false;
    place = null;
    poserNuit(0);
    boites.demonter();
    tombes.demonter();
    stage.classList.remove('hors-salle', 'porte-en-jeu', 'vitrine-en-jeu', 'inhumation-en-jeu');
    setCalloutsInert(false);
    onPart(null, 'arrivee');
    notifyForeground();
  }

  /**
   * ⚠️ LES DEUX BATTANTS NE SE CHARGENT QU'À LA FIN DE L'INTRODUCTION. Ce sont
   * 7 Mo à eux deux : posés dans le gabarit, ils téléchargeraient EN MÊME TEMPS
   * que la photographie d'ouverture — que la scène attend pour lever son rideau
   * noir. Le « 1 » n'est de toute façon pas cliquable avant la fin de l'intro.
   *
   * COÛT MESURÉ : une image de 67 ms, ~300 ms après la fin de l'intro, quand
   * plus rien ne se joue à l'écran que la dérive de la caméra. Les décoder l'un
   * APRÈS l'autre ne change rien (mesuré aussi, même trou) — c'est le prix de
   * deux images de 6,5 mégapixels, pas celui du parallèle. Le vrai levier
   * serait de les exporter en WebP : 7 Mo deviendraient ~0,5 Mo, et il n'y
   * aurait que ces deux chemins à changer.
   */
  function chargerPorte() {
    if (portePret) return portePret;
    porteGauche.src = PORTE.gauche;
    porteDroite.src = PORTE.droite;
    portePret = Promise.all([porteGauche.decode(), porteDroite.decode()])
      .then(() => true)
      .catch(erreur => {
        if (!disposed) console.warn('[chp5] Les battants de la porte n\'ont pas pu etre charges.', erreur);
        return false;
      });
    return portePret;
  }

  /**
   * ⚠️ LES DEUX PRISES DE LA VITRINE NE SE CHARGENT QU'AU CLIC, et surtout pas
   * à la fin de l'intro comme les battants : ce sont deux images de 21
   * mégapixels, ~1 s de décodage CHACUNE (mesuré). Les précharger mettrait la
   * photographie des réserves à genoux pour un lieu où l'on n'ira peut-être
   * jamais. C'est la MISE EN SCÈNE qui paie l'attente : l'extinction est déjà
   * là, et le noir ne se lève que lorsque les deux images sont prêtes — sur
   * une liaison lente, il dure simplement plus longtemps.
   */
  function chargerVitrine() {
    if (vitrinePret) return vitrinePret;
    vitrinePlein.src = RESTIT.plein;
    vitrineVide.src = RESTIT.vide;
    vitrinePret = Promise.all([vitrinePlein.decode(), vitrineVide.decode()])
      .then(() => true)
      .catch(erreur => {
        if (!disposed) console.warn('[chp5] Les deux prises de la vitrine n\'ont pas pu etre chargees.', erreur);
        return false;
      });
    return vitrinePret;
  }

  /* ── ALLER À UN LIEU — la demande de la carte ──────────────────────────────
     `vise` : le lieu demandé et pas encore atteint — un rang, `null` pour la
     photographie, `undefined` quand rien n'est demandé. La DERNIÈRE demande
     gagne, et elle n'interrompt rien : elle attend la fin du geste en cours
     (introduction, passage), qui appelle `poursuivre()`. C'est la leçon de
     l'ambiance, et du chapitre 3 avant elle : une intention qu'on reprend, pas
     une suite d'ordres qui arriveraient dans le désordre. */
  let vise;
  const versUnLieu = () => typeof vise === 'number';

  function allerA(index) {
    if (disposed || leaving) return;
    if (index !== null && !LIEUX[index]) {
      console.warn('[chp5] Aller au sous-chapitre ' + (index + 1) + ' : il n\'a pas de lieu.');
      return;
    }
    vise = index;
    poursuivre();
  }

  function poursuivre() {
    if (vise === undefined || disposed || leaving) return;
    if (!introFinished || placeGeste) return;          // la fin du geste reprendra
    const ici = placeOuverte ? indexDe(place) : null;
    if (vise === ici) { vise = undefined; return; }    // on y est
    if (placeOuverte) { closePart(); return; }         // d'abord quitter celui-ci
    const cible = vise;
    vise = undefined;
    openPart(cible);
  }

  /** LE RELAIS DEPUIS LA PORTE : on va ailleurs, le noir tombe sur le panneau.
      Rouvrir les battants sur la salle pour l'éteindre aussitôt serait un
      aller-retour qu'on n'a pas demandé. */
  async function quitterPorte() {
    placeGeste = 'relais';
    await attendre(allerNuit(1, PORTE.noirMs));
    if (disposed || leaving || place !== 'porte' || placeGeste !== 'relais') return;
    poserNuit(1);                // la dernière image du fondu a pu manquer
    placeRendue();
  }

  function openPart(index) {
    if (disposed || leaving || !introFinished) return;
    const lieu = LIEUX[index];
    if (!lieu) {
      console.warn(`[chp5] Sous-chapitre ${index + 1} : aucune mise en scene, rien ne s'ouvre.`);
      return;
    }
    if (placeGeste || placeOuverte) return;

    // Le lieu est déclaré AVANT d'arrêter l'audio : sans cela, stopAudio
    // annoncerait un premier plan libre — la flèche reparaîtrait le temps
    // d'une image, au milieu du clic qui l'emmène.
    place = lieu;
    placeGeste = 'attente';
    stopAudio();                 // un témoignage ne nous suit pas ailleurs
    closeRevealed();
    setCalloutsInert(true);
    stage.classList.add('hors-salle');
    onPart(index, 'depart');     // le sous-titre cède la place, tout de suite
    notifyForeground();          // la flèche — et la boussole — s'effacent ici,
                                 // et la bande-son de la photographie avec elles
    // Celle du lieu se charge pendant le passage : elle montera à l'arrivée.
    ambiance.precharger(lieu);

    if (lieu === 'vitrine') { ouvrirVitrine(); return; }
    if (lieu === 'inhumation') { ouvrirInhumation(); return; }

    // ⚠️ VENU DU NOIR — l'arrivée directe, ou le relais d'un autre lieu —, on
    // ne recule pas depuis une salle qu'on ne voit pas. La porte est posée
    // FERMÉE sous le noir, le noir se lève sur elle, et l'on reprend le geste
    // là où les battants se rejoignent : la pose, puis le gros plan.
    const depuisLeNoir = nuitP >= 0.999;
    chargerPorte().then(async pret => {
      // On a pu partir, ou renoncer, pendant le décodage.
      if (disposed || leaving || placeGeste !== 'attente') return;
      if (!pret) { placeAbandonnee(); return; }
      stage.classList.add('porte-en-jeu');
      let deja = 0;
      if (depuisLeNoir) {
        reculP = fermeP = voileP = 1;
        zoomP = 0;
        renderPorte();
        await attendre(allerNuit(0, PORTE.leveMs));
        if (disposed || leaving || place !== 'porte' || placeGeste !== 'attente') return;
        deja = PORTE.fermeAt + PORTE.fermeMs;
      }
      placeGeste = 'aller';
      placeT0 = performance.now() - deja;
      // Sous « mouvement réduit » la boucle ne tourne pas : on pose l'arrivée.
      if (reduceMotion) {
        reculP = fermeP = voileP = zoomP = 1;
        renderPorte();
        placePosee();
      }
    });
  }

  function closePart() {
    if (!placeOuverte || placeGeste) return;
    placeOuverte = false;
    placeGeste = 'retour';
    placeT0 = performance.now();
    // Le sous-titre revient pendant le chemin — ou, si l'on file vers un autre
    // lieu, c'est le SIEN qui vient : on ne réécrit pas celui de la
    // photographie pour l'effacer à l'arrivée.
    onPart(versUnLieu() ? vise : null, 'depart');
    notifyForeground();

    if (place === 'porte' && versUnLieu()) { quitterPorte(); return; }

    if (place === 'vitrine') {
      if (reduceMotion) { demonterVitrine(); placeRendue(); return; }
      fermerVitrine();
      return;
    }
    if (place === 'inhumation') {
      if (reduceMotion) { demonterInhumation(); placeRendue(); return; }
      fermerInhumation();
      return;
    }
    if (reduceMotion) placeRendue();
  }


  /**
   * ⚠️ LA SALLE CESSE DE VIVRE DÈS QU'ON NE LA VOIT PLUS. Derrière un voile
   * opaque — le fond de la porte, ou le noir de l'extinction — plus rien n'est
   * visible : continuer d'écrire un flou plein écran (qui se REPEINT, lui) et
   * de remesurer cinq cartels invisibles ne serait que du travail perdu, sur
   * les images précisément où le visiteur regarde ailleurs.
   */
  const salleCachee = () =>
    (place !== null && !placeGeste)   // un lieu est posé : on est ailleurs
    || torche !== null                // un lieu éclairé est monté, et il est opaque
    || voileP >= 0.999                // le fond de la porte a tout recouvert
    || nuitP >= 0.999;                // l'extinction est complète

  function frame(t) {
    if (!loopRunning) return;

    if (!salleCachee()) {
      updateFocus(t);
      updateCamera(t);
      updateCalloutMotion(t);
      // Toutes les écritures CSS sont terminées avant la phase de mesure.
      measureCallouts();
      updateLeaders(t);
    }

    if (placeGeste) updateNuit(t);
    if (place === 'inhumation' && torche) updatePanorama();
    if (place === 'porte' && (placeGeste === 'aller' || placeGeste === 'retour')) updatePorte(t);

    animationFrame = nextFrame(frame);
  }

  function startLoop() {
    if (disposed || leaving || reduceMotion || loopRunning || document.hidden) return;
    loopRunning = true;
    animationFrame = nextFrame(frame);
  }

  function stopLoop() {
    if (!loopRunning) return;
    loopRunning = false;
    cancelFrame(animationFrame);
  }

  function prepareIntroDrawing() {
    root.querySelectorAll('.leader-reveal').forEach(reveal => {
      reveal.style.strokeDasharray = '1 1';
      reveal.style.strokeDashoffset = '1';
      reveal.style.opacity = '0';
    });

    root.querySelectorAll('.circle-trace circle').forEach(circle => {
      circle.style.strokeDasharray = '100';
      circle.style.strokeDashoffset = '100';
    });
  }

  function burstLines() {
    root.querySelectorAll('.leader-reveal').forEach(reveal => {
      const length = Math.max(1, reveal.getTotalLength());
      reveal.style.opacity = '1';
      reveal.style.strokeDasharray = `${length} ${length}`;
      reveal.style.strokeDashoffset = `${length}`;

      reveal.animate(
        [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
        {
          duration: INTRO.lineMs,
          easing: 'cubic-bezier(.12,.72,.18,1)',
          fill: 'forwards'
        }
      );
    });

    root.querySelectorAll('.leader-start').forEach((dot, index) => {
      dot.animate(
        [
          { opacity: 0, transform: 'scale(.1)' },
          { opacity: 0.95, transform: 'scale(1.8)', offset: 0.55 },
          { opacity: 1, transform: 'scale(1)' }
        ],
        {
          duration: 420,
          delay: index * 18,
          easing: 'cubic-bezier(.16,.84,.26,1)',
          fill: 'forwards'
        }
      );
    });
  }

  function drawCircles() {
    root.querySelectorAll('.circle-trace circle').forEach(circle => {
      circle.animate(
        [{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }],
        {
          duration: INTRO.circleMs,
          easing: 'cubic-bezier(.18,.82,.22,1)',
          fill: 'forwards'
        }
      );
    });
  }

  function setCalloutsInert(inert) {
    for (const callout of callouts) callout.element.inert = inert;
  }

  function finishIntro() {
    stage.classList.remove('intro-running');
    introFinished = true;
    // Les masques ne servent qu'à dessiner les traits à l'arrivée. Les garder
    // sur cinq courbes mobiles oblige Chrome à repeindre de grandes surfaces
    // masquées à chaque image (~19 i/s). Une fois le tracé fini, le même dessin
    // se rend directement, sans masque ni mise à jour de chemins invisibles.
    for (const callout of callouts) {
      callout.line.removeAttribute('mask');
      callout.reveal = null;
    }
    const masks = leaders.querySelector('defs');
    masks?.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    masks?.remove();
    setCalloutsInert(false);
    // Les deux battants se chargent MAINTENANT, et pas au montage : voir
    // chargerPorte. À partir d'ici le « 1 » est cliquable.
    chargerPorte();
    // L'ambiance de la photographie se charge pendant la fin du long silence,
    // pas pendant l'introduction, qui a la photographie à télécharger. Arrivé
    // directement dans un lieu, on ne l'entendra pas de sitôt : elle attendra.
    if (arriveeDirecte === null) ambiance.precharger('ouverture');
    // ⚠️ L'ARRIVÉE DIRECTE NE REND PAS LA FLÈCHE ICI : on n'est pas devant la
    // photographie, on part vers un lieu. Elle reviendra à l'arrivée
    // (`onPart(…, 'arrivee')`), comme après tout passage.
    if (arriveeDirecte === null) onIntroComplete();
    poursuivre();
  }

  function startIntro() {
    focusBlur = 1.15;
    focusFrom = 1.15;
    focusTo = 0.68;
    focusMode = 'steady';
    huntAmplitude = 0;
    focusStart = performance.now();
    focusDuration = 1850;
    focusHoldUntil = focusStart + 3000;

    setCalloutsInert(true);

    // Sous « mouvement réduit », ou quand on entre directement dans un lieu
    // (derrière le noir, l'introduction ne se verrait pas), la photographie
    // est POSÉE dans son état final.
    if (reduceMotion || arriveeDirecte !== null) {
      root.querySelectorAll('.leader-reveal').forEach(reveal => {
        reveal.style.opacity = '1';
        reveal.style.strokeDasharray = 'none';
        reveal.style.strokeDashoffset = '0';
      });

      root.querySelectorAll('.circle-trace circle').forEach(circle => {
        circle.style.strokeDashoffset = '0';
      });

      stage.classList.add('intro-symbols');
      introBlack.style.opacity = '0';
      finishIntro();
      measureCallouts();
      updateLeaders(performance.now());
      return;
    }

    prepareIntroDrawing();
    introStartedAt = performance.now();
    nextFrame(() => stage.classList.add('intro-fade'));

    schedule(burstLines, INTRO.linesAt);
    schedule(drawCircles, INTRO.circlesAt);
    schedule(() => stage.classList.add('intro-symbols'), INTRO.symbolsAt);
    schedule(finishIntro, INTRO.endAt);
  }


  function setupIntro() { nextFrame(startIntro); }

  function closeRevealed(except = null) {
    for (const callout of callouts) {
      if (callout.element !== except) callout.element.classList.remove('revealed');
    }
  }

  function setupCalloutInteractions() {
    root.querySelectorAll('.nav-link').forEach(link => {
      on(link, 'click', event => {
        event.preventDefault();
        const callout = link.closest('.nav-callout');

        // ⚠️ AU DOIGT, LE PREMIER APPUI NE FAIT QUE MONTRER L'INTITULÉ. Il n'y
        // a pas de survol sur un écran tactile : entrer dès le premier appui,
        // ce serait faire entrer dans un sous-chapitre qu'on n'a pas pu lire.
        // Le second appui, lui, ouvre.
        if (coarsePointer.matches && !callout.classList.contains('revealed')) {
          closeRevealed(callout);
          callout.classList.add('revealed');
          return;
        }

        // `data-part` est la marque des sous-chapitres réellement mis en
        // scène ; les autres n'ont rien à ouvrir et le disent par leur
        // `aria-disabled` (cf. chp5-dom.js).
        if (link.dataset.part !== undefined) openPart(Number(link.dataset.part));
      });
    });

    root.querySelectorAll('.audio-callout .circle-button').forEach(button => {
      on(button, 'click', () => {
        if (!coarsePointer.matches) return;
        const callout = button.closest('.audio-callout');
        closeRevealed(callout);
        callout.classList.add('revealed');
      });
    });

    on(stage, 'pointerdown', event => {
      if (!coarsePointer.matches) return;
      if (!event.target.closest('.callout')) closeRevealed();
    });
  }

  function setupPointerTracking() {
    on(stage, 'pointermove', event => {
      pointerPxX = event.clientX;
      pointerPxY = event.clientY;
      pointerNX = (pointerPxX / vw - 0.5) * 2;
      pointerNY = (pointerPxY / vh - 0.5) * 2;
    }, { passive: true });

    on(stage, 'pointerleave', () => {
      pointerNX = 0;
      pointerNY = 0;
    });
  }

  function refreshLayout() {
    resize();
    measureCallouts();
    updateLeaders(performance.now());
    // La porte est posée en PIXELS : un redimensionnement — une bascule plein
    // écran, une rotation — la redessine telle qu'elle est, à l'avancement où
    // elle en est, sans rejouer le geste et sans le figer.
    if (placeGeste || placeOuverte) renderPorte();
    // Les boîtes se replacent aussi : leur géométrie se déduit de la bande
    // libre entre le bord de la fenêtre et le crâne, qui change de format en
    // format (cf. `disposer` dans chp5-boites.js).
    boites.resize();
    tombes.resize();
    // Le panorama se reproportionne à la fenêtre — sans rejouer le glissement.
    if (place === 'inhumation' && torche) poserPanorama();
    visionneuse.resize();
    // « Passer » est à la taille des flèches, qui suit la fenêtre.
    if (passer.classList.contains('passer--visible')) dessinerPasser();
    // ⚠️ ET LA TORCHE REPEINT DANS LE MÊME TOUR. Écrire canvas.width EFFACE le
    // canevas : un canevas-masque qui attend la boucle laisse la page à nu le
    // temps d'une image (l'exposé complet est en tête de TorchSystem.resize).
    torche?.resize();
  }

  // LA COULEUR DU FOND — un choix d'auteur, donc dans la config et nulle part
  // ailleurs : c'est elle qu'on voit de part et d'autre de la porte, et c'est
  // dans elle que la salle disparaît.
  porteVoile.style.background = PORTE.fond;

  resize();
  setupPointerTracking();
  setupHoverStates();
  setupAudio();
  setupCalloutInteractions();
  on(passer, 'click', () => basculer());
  on(plancheCroix, 'click', () => fermerPlanche());
  on(document, 'keydown', evenement => {
    if (evenement.key === 'Escape' && planche) { evenement.preventDefault(); fermerPlanche(); }
  });
  measureCallouts();
  updateLeaders(performance.now());
  setCalloutsInert(true);
  // L'arrivée directe : le noir est posé AVANT la levée du rideau — on ne doit
  // pas voir la photographie, même une image. Le lieu demandé s'ouvrira à la
  // fin de l'introduction (posée, donc immédiate), depuis ce noir.
  if (arriveeDirecte !== null) {
    poserNuit(1);
    allerA(arriveeDirecte);
  }
  onReady();
  setupIntro();
  // LE LONG SILENCE DE L'ENTRÉE — compté d'ici, la levée du rideau. Une
  // minuterie du moteur : partir avant la défait (cancelWork).
  schedule(() => {
    silenceFini = true;
    accorderAmbiance();
  }, CONFIG.ambiance.silenceMs);

  on(document, 'visibilitychange', () => {
    if (document.hidden) stopLoop();
    else startLoop();
  });

  startLoop();

  return {
    resize: refreshLayout,
    closePart,
    allerA,
    leave() {
      if (leavePromise) return leavePromise;
      leaving = true;
      vise = undefined;
      const duration = reduceMotion ? 0 : CONFIG.exitMs;
      // La bande-son s'éteint au rythme du noir — pour TOUTE destination,
      // flèche comme carte : on ne l'emporte pas dans la scène d'après.
      ambiance.eteindre(duration);
      setCalloutsInert(true);
      cancelWork();
      // Les boîtes ont leurs propres minuteries : `cancelWork` ne les voit pas.
      // Une écriture laissée en cours continuerait derrière le fondu de sortie.
      // Et la fenêtre se referme : une vidéo qu'on laisserait jouer derrière le
      // noir suivrait le visiteur dans la scène d'après.
      visionneuse.fermer();
      boites.demonter();
      tombes.demonter();
      stopAudio();
      // La voix de l'inhumation se tait avec le fondu : elle ne suit pas.
      fermerPlanche(false);
      viderVoix();
      const fade = getElement('fade');
      fade.style.transition = 'opacity ' + duration + 'ms ease';
      fade.style.opacity = '1';
      // Cette seule minuterie doit survivre à cancelWork pour dénouer exit().
      leavePromise = new Promise(resolve => {
        const timer = setTimeout(() => { finishLeave = null; resolve(); }, duration);
        finishLeave = () => { clearTimeout(timer); resolve(); };
      });
      return leavePromise;
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      cancelWork();
      stopAudio();
      // ⚠️ SANS CECI, CHAQUE VISITE DE LA VITRINE LAISSERAIT DERRIÈRE ELLE une
      // boucle requestAnimationFrame perpétuelle et deux écouteurs de pointeur
      // sur `document` (voir TorchSystem.destroy).
      torche?.destroy();
      torche = null;
      viderVoix();
      // Après `leave()` elle est déjà éteinte ; sans lui (entrée avortée,
      // erreur), elle s'arrête ici — sur quelques millisecondes, pas un clic.
      // Les fichiers décodés sont rendus avec elle.
      ambiance.destroy();
      boites.destroy();
      tombes.destroy();
      visionneuse.destroy();
      root.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
      finishLeave?.();
      finishLeave = null;
    },
  };
}
