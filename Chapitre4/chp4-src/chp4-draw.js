/**
 * chp4-draw.js — PRIMITIVES DE DESSIN ANIMÉ (aucun effet de bord au chargement)
 * ─────────────────────────────────────────────────────────────────────────────
 * Le vocabulaire gestuel du chapitre : tracer un contour, propager une fracture,
 * écrire un mot. Rien ici ne connaît le chapitre 4 en particulier — ce sont des
 * outils, appelés par chp4-opening.js et chp4-bubbles.js.
 *
 * TOUT PASSE PAR `Motion`. Le pattern factory du projet exige qu'un chapitre se
 * démonte SANS RIEN LAISSER derrière lui : une animation oubliée continue de
 * tourner sur un DOM détruit, et se rappelle au souvenir du visiteur à la
 * prochaine visite (frame fantôme, son résiduel, fuite mémoire). `Motion` est le
 * registre unique : toute animation, tout minuteur, toute boucle rAF y est
 * inscrit à la naissance et supprimé d'un seul `stop()`.
 *
 * POURQUOI L'API WEB ANIMATIONS PLUTÔT QUE DES TRANSITIONS CSS ?
 * Parce qu'une transition CSS ne s'annule pas : on ne peut que la neutraliser
 * après coup (retirer la classe, forcer un reflow…). `Animation.cancel()` rend
 * l'élément à son état initial immédiatement, ce qui est exactement le contrat
 * de `stop()`. Réserve : AboutReveal a renoncé aux Web Animations pour sa fumée
 * de sortie — c'était pour des MILLIERS de fragments par frame ; ici on compte
 * quelques dizaines d'animations au total, le coût est nul.
 */

/* ── Courbes ────────────────────────────────────────────────────────────────
   Nommées, parce qu'un dessin qui se fait n'accélère pas comme une interface
   qui répond. `hand` traîne un peu au départ puis file : c'est le geste d'une
   main qui trace. `settle` arrive et se pose sans rebondir. */
export const EASE = {
  hand:   'cubic-bezier(0.62, 0.02, 0.28, 1)',
  settle: 'cubic-bezier(0.22, 0.68, 0.24, 1)',
  soft:   'cubic-bezier(0.4, 0, 0.2, 1)',
  out:    'cubic-bezier(0.16, 1, 0.3, 1)',
};

/** Interpolation d'une courbe douce, pour les boucles rAF (mêmes sensations). */
export const easeOutCubic  = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

/** `true` si le visiteur a demandé moins d'animations (réglage système). */
export const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/* ══════════════════════════════════════════════════════════════════════════
   Motion — le registre des choses en mouvement
   ══════════════════════════════════════════════════════════════════════════ */

export class Motion {
  constructor() {
    this._anims  = new Set();
    this._timers = new Set();
    this._rafs   = new Set();
    this.stopped = false;
    /* Facteur global appliqué à toutes les durées. Passé à 0.25 quand le
       visiteur demande moins d'animation : la mise en scène garde sa forme,
       elle se joue simplement quatre fois plus vite. */
    this.scale = prefersReducedMotion() ? 0.25 : 1;
  }

  /** Durée mise à l'échelle (jamais nulle : 0 casserait les easings). */
  ms(duration) {
    return Math.max(1, Math.round(duration * this.scale));
  }

  /**
   * Anime un élément et inscrit l'animation au registre.
   * @returns {Animation|null} null si le moteur est déjà arrêté.
   */
  animate(el, keyframes, options) {
    if (this.stopped || !el) return null;
    const opts = typeof options === 'number' ? { duration: options } : { ...options };
    opts.duration = this.ms(opts.duration ?? 300);
    if (opts.delay) opts.delay = this.ms(opts.delay);
    if (!opts.fill) opts.fill = 'forwards';

    const anim = el.animate(keyframes, opts);
    this._anims.add(anim);
    anim.finished
      .then(() => this._anims.delete(anim))
      .catch(() => this._anims.delete(anim));   // .cancel() rejette : normal
    return anim;
  }

  /** setTimeout inscrit au registre. Le délai suit `scale`. */
  after(delay, fn) {
    if (this.stopped) return null;
    const id = setTimeout(() => {
      this._timers.delete(id);
      if (!this.stopped) fn();
    }, this.ms(delay));
    this._timers.add(id);
    return id;
  }

  /** Promesse d'attente, annulée silencieusement par `stop()`. */
  wait(delay) {
    return new Promise((resolve) => {
      if (this.stopped) return;           // ne se résout jamais : la chaîne meurt ici
      this.after(delay, resolve);
    });
  }

  /**
   * Boucle rAF inscrite au registre.
   * @param {(t: number, dt: number) => boolean|void} fn  retourner false arrête
   *        la boucle (les animations à durée finie s'en servent pour se clore).
   */
  loop(fn) {
    if (this.stopped) return null;
    const token = { id: 0 };
    let last = performance.now();
    const start = last;
    const step = (now) => {
      if (this.stopped) return;
      const dt = now - last;
      last = now;
      if (fn(now - start, dt) === false) { this._rafs.delete(token); return; }
      token.id = requestAnimationFrame(step);
    };
    token.id = requestAnimationFrame(step);
    this._rafs.add(token);
    return token;
  }

  /**
   * Boucle à durée déterminée : appelle `fn(progress)` de 0 à 1, puis une
   * dernière fois à exactement 1 (garantie que l'état final est atteint, même
   * si la dernière frame tombe à 0.98).
   */
  tween(duration, fn, easing = easeOutCubic) {
    const total = this.ms(duration);
    return new Promise((resolve) => {
      this.loop((elapsed) => {
        const t = Math.min(1, elapsed / total);
        fn(easing(t), t);
        if (t >= 1) { resolve(); return false; }
      });
    });
  }

  /** Tout arrêter, tout rendre à son état initial. Idempotent. */
  stop() {
    this.stopped = true;
    this._anims.forEach((a) => { try { a.cancel(); } catch { /* déjà finie */ } });
    this._timers.forEach((id) => clearTimeout(id));
    this._rafs.forEach((t) => cancelAnimationFrame(t.id));
    this._anims.clear();
    this._timers.clear();
    this._rafs.clear();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Fabrique SVG
   ══════════════════════════════════════════════════════════════════════════ */

const NS = 'http://www.w3.org/2000/svg';

/** Crée un élément SVG avec ses attributs. */
export function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    el.setAttribute(k, String(v));
  }
  return el;
}

/**
 * Boîte englobante d'un élément dans le repère de l'ŒUVRE (celui du viewBox).
 *
 * `getBBox()` seul ne suffit pas : il rend la boîte AVANT les transformations
 * de l'élément, et les vingt-et-un tracés de l'export portent chacun un
 * `translate(-731 0)`. Une mesure brute les placerait tous 731 unités trop à
 * droite. On repasse donc par les matrices : écran ← élément, puis œuvre ←
 * écran. C'est la seule mesure qui reste juste quel que soit l'empilement de
 * groupes qu'on ajoute au-dessus.
 *
 * @returns {{x:number, y:number, width:number, height:number}}
 */
export function bboxInUserSpace(svg, el) {
  const b = el.getBBox();
  const rootCTM = svg.getScreenCTM();
  const elCTM   = el.getScreenCTM();
  if (!rootCTM || !elCTM) return { x: b.x, y: b.y, width: b.width, height: b.height };

  const m = rootCTM.inverse().multiply(elCTM);
  const corners = [[b.x, b.y], [b.x + b.width, b.y],
                   [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]];
  const pt = svg.createSVGPoint();
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const [x, y] of corners) {
    pt.x = x; pt.y = y;
    const p = pt.matrixTransform(m);
    minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x);
    miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y);
  }
  return { x: minx, y: miny, width: maxx - minx, height: maxy - miny };
}

/* ══════════════════════════════════════════════════════════════════════════
   Tracer un contour
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Fait TRACER un tracé rempli, comme sous une plume.
 *
 * Un <path> d'export Illustrator n'est pas une ligne : c'est une SURFACE (le
 * nuage est un aplat, son contour n'existe pas en tant que trait). On ne peut
 * donc pas l'animer directement au stroke-dashoffset. La manœuvre :
 *
 *   1. on CLONE le tracé en un fantôme sans remplissage, bordé d'un trait fin ;
 *   2. on fait courir ce trait (dashoffset) → le contour se dessine ;
 *   3. le vrai tracé, resté transparent, se remplit derrière la plume ;
 *   4. le fantôme s'efface, sa besogne faite.
 *
 * Le clone hérite du `transform` de l'original : il se superpose exactement.
 *
 * @param {SVGPathElement} path     le tracé à faire paraître (opacity 0 attendue)
 * @param {Motion} motion
 * @param {Object} o
 * @param {number} o.trace   durée du tracé du contour (ms)
 * @param {number} o.fill    durée du remplissage (ms), enchaînée
 * @param {string} o.color   couleur de la plume
 * @param {number} o.width   épaisseur de la plume (unités de l'œuvre)
 * @param {boolean} [o.keepTrace]  garder le fantôme (nuages évidés : il EST
 *                                 le dessin final, autant ne pas le jeter)
 * @returns {Promise<void>} résolue quand le remplissage est fini
 */
export async function traceOutline(path, motion, o) {
  if (!path || motion.stopped) return;

  const ghost = path.cloneNode(false);
  ghost.removeAttribute('class');
  ghost.setAttribute('fill', 'none');
  ghost.setAttribute('stroke', o.color);
  ghost.setAttribute('stroke-width', o.width);
  ghost.setAttribute('stroke-linecap', 'round');
  ghost.setAttribute('stroke-linejoin', 'round');
  ghost.setAttribute('pointer-events', 'none');
  ghost.dataset.ghost = '1';

  /* Un contour fermé de nuage fait quelques milliers d'unités ; getTotalLength
     parcourt toutes les sous-courbes, y compris les évidements. */
  let len = 0;
  try { len = ghost.getTotalLength?.() ?? 0; } catch { len = 0; }
  if (!len) {
    // Tracé illisible (navigateur exotique) : on se contente du fondu.
    motion.animate(path, [{ opacity: 0 }, { opacity: 1 }], { duration: o.trace + o.fill, easing: EASE.soft });
    return;
  }

  ghost.setAttribute('stroke-dasharray', len);
  ghost.setAttribute('stroke-dashoffset', len);
  path.parentNode.insertBefore(ghost, path);

  await motion.animate(ghost, [
    { strokeDashoffset: len },
    { strokeDashoffset: 0 },
  ], { duration: o.trace, easing: EASE.hand })?.finished.catch(() => {});

  if (motion.stopped) return;

  // Le remplissage monte derrière la plume.
  motion.animate(path, [{ opacity: 0 }, { opacity: 1 }], { duration: o.fill, easing: EASE.soft });

  if (!o.keepTrace) {
    motion.animate(ghost, [{ opacity: 1 }, { opacity: 0 }], { duration: o.fill, easing: EASE.soft })
      ?.finished.then(() => ghost.remove()).catch(() => {});
  }

  await motion.wait(o.fill);
}

/**
 * Fait « éclore » une petite bulle de queue : elle gonfle et se pose.
 * Pas de tracé au trait — à cette taille, une plume qui fait le tour se lit
 * comme un grésillement. Un gonflement bref est plus juste et plus net.
 *
 * ⚠️ `dot` doit être le <g> qui EMBALLE le tracé, jamais le tracé lui-même :
 * l'échelle animée passe par la propriété CSS `transform`, qui supplanterait
 * l'attribut `transform` de l'export (cf. chp4-bubbles.js, construction de la
 * queue). L'origine de la transformation est posée par la feuille (.chp4-dot).
 */
export function popDot(dot, motion, duration) {
  if (!dot) return;
  motion.animate(dot, [
    { opacity: 0, transform: 'scale(0.35)' },
    { opacity: 1, transform: 'scale(1.14)', offset: 0.62 },
    { opacity: 1, transform: 'scale(1)' },
  ], { duration, easing: EASE.settle });
}

/* ══════════════════════════════════════════════════════════════════════════
   Propager une fracture
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * LA FRACTURE — révèle un tracé en le faisant CROÎTRE depuis son cœur, comme
 * un os qui cède. Rejouable à l'envers pour la refermer (`reverse`).
 *
 * POURQUOI PAS UNE PLUME, comme pour les nuages ? Parce que la fissure se
 * RAMIFIE. Son contour fermé descend le long d'une branche et remonte par
 * l'autre côté : une plume qui le suivrait dessinerait un aller-retour absurde,
 * une branche à la fois. Un disque qui s'ouvre depuis la JONCTION des trois
 * branches les révèle au contraire toutes ensemble, à mesure qu'elles
 * s'éloignent du point de rupture — exactement la façon dont une fracture se
 * propage. C'est le sens de la scène : le coup part du centre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ POURQUOI UN CACHE ET NON UN MASQUE — la leçon la plus chère du chapitre.
 *
 * La première version masquait le tracé (`mask` + dégradé radial dont le rayon
 * grandissait). C'était juste, et c'était injouable : à CHAQUE frame, le
 * navigateur devait re-pixelliser le masque ET les onze mille caractères du
 * tracé de la fissure. Mesuré au banc d'essai : 16,7 ms par frame au repos
 * (déjà 7 frames perdues sur 110), et 33,3 ms dès que la souris bougeait —
 * 67 frames perdues sur 127, une chute à 30 images/seconde. D'où le
 * tressautement, et le fait, déroutant, qu'il empirait quand on bougeait la
 * souris : le curseur du site (silhouette masquée + deux ombres portées) se
 * repeint à chaque `pointermove` et disputait le peu de temps qui restait.
 *
 * Le cache inverse le problème. Le tracé est peint UNE FOIS, tel quel, et
 * n'est plus jamais touché ; par-dessus, un simple rectangle couleur papier,
 * rempli d'un dégradé radial transparent en son centre, cache tout ce que la
 * fracture n'a pas encore atteint. Seul ce rectangle est repeint à chaque
 * frame — une forme triviale au lieu d'un tracé monstrueux.
 *
 * Corollaire : le cache doit être posé JUSTE APRÈS le tracé dans l'ordre du
 * document (il ne doit cacher que lui), et il est couleur PAPIER, pas
 * transparent — ce n'est pas un masque, c'est de la peinture.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * DEUX CHOSES LA RENDENT VIVANTE, et aucune n'est décorative :
 *   · le bord du cache est DÉGRADÉ (`softness`) — l'encre se devine, pâle,
 *     juste avant de se poser. Sans lui, le front serait un cercle net et
 *     l'œil suivrait le cercle au lieu de la fissure ;
 *   · l'avancée BUTE ET CÈDE (`stutter`) — une fêlure ne progresse pas à
 *     vitesse constante. À garder très bas : au-delà, on ne lit plus une
 *     hésitation, on lit une animation qui saute.
 *
 * Le TREMBLEMENT, lui, n'est pas fait ici : il est confié à l'appelant via
 * `onTremor`, qui le passe à une transformation CSS sur l'élément <svg>
 * entier — la seule que le compositeur sache jouer sans rien re-pixelliser.
 *
 * @param {SVGPathElement} path   le tracé de la fracture
 * @param {Motion} motion
 * @param {Object} o
 * @param {{x:number,y:number}} o.origin  le point de rupture
 * @param {number} o.reach     rayon final (mesuré par farthestPointFrom)
 * @param {number} o.duration
 * @param {number} o.softness
 * @param {number} o.stutter
 * @param {string} o.cover     couleur du cache (celle du papier)
 * @param {boolean} [o.reverse] refermer au lieu d'ouvrir (sortie du chapitre)
 * @param {(intensity:number)=>void} [o.onTremor]  intensité 0→1, à chaque
 *        frame : de quoi faire encaisser le choc au reste de la page.
 */
export async function propagate(path, motion, o) {
  if (!path || motion.stopped) return;

  const svg  = path.ownerSVGElement;
  const uid  = `chp4-frac-${Math.random().toString(36).slice(2, 8)}`;
  let defs   = svg.querySelector('defs');
  if (!defs) { defs = svgEl('defs'); svg.insertBefore(defs, svg.firstChild); }

  /* Le dégradé du cache : transparent jusqu'au front, couleur papier au-delà.
     Au-delà du dernier arrêt, SVG prolonge la dernière couleur — le cache est
     donc opaque partout hors du disque, quelle que soit la taille du canevas. */
  const soft = Math.min(0.9, Math.max(0, o.softness));
  const grad = svgEl('radialGradient', {
    id: `${uid}-g`, gradientUnits: 'userSpaceOnUse',
    cx: o.origin.x, cy: o.origin.y, r: 1,
  });
  grad.appendChild(svgEl('stop', { offset: 0,        'stop-color': o.cover, 'stop-opacity': 0 }));
  grad.appendChild(svgEl('stop', { offset: 1 - soft, 'stop-color': o.cover, 'stop-opacity': 0 }));
  grad.appendChild(svgEl('stop', { offset: 1,        'stop-color': o.cover, 'stop-opacity': 1 }));
  defs.appendChild(grad);

  /* ⚠️ LE CACHE NE DOIT PAS DÉBORDER DE L'ŒUVRE. Il est peint dans le repère
     du viewBox, mais le <svg> laisse dépasser ce qui sort de ses limites : un
     rectangle « largement débordant » (la première version allait de -900 à
     2100) se répandait hors de la colonne du dessin et RECOUVRAIT LA
     PHOTOGRAPHIE de couleur papier pendant toute la propagation — le crâne
     disparaissait. On le borne donc au viewBox, à une marge près.
     Le débord restant, à gauche, tombe dans la zone où le dégradé de la photo
     est déjà du papier pur : invisible. */
  const vb = svg.viewBox?.baseVal;
  if (!vb?.width) {
    // Sans viewBox, impossible de savoir jusqu'où étendre le cache : on ne
    // devine pas (un cache trop grand recouvre la photographie, trop petit
    // laisse voir la fracture d'un coup). On le dit, et on se rabat sur un
    // simple fondu — dégradé, mais jamais faux.
    console.warn('[chp4] L\'œuvre n\'a pas de viewBox : fracture révélée en fondu.');
    grad.remove();
    path.style.opacity = '0';
    await motion.animate(path, [{ opacity: 0 }, { opacity: 1 }],
      { duration: o.duration, easing: EASE.soft })?.finished.catch(() => {});
    return;
  }
  const m = 40;
  const cover = svgEl('rect', {
    x: vb.x - m, y: vb.y - m,
    width: vb.width + m * 2, height: vb.height + m * 2,
    fill: `url(#${uid}-g)`, 'pointer-events': 'none',
  });
  path.parentNode.insertBefore(cover, path.nextSibling);
  path.style.opacity = '1';

  await motion.tween(o.duration, (eased, raw) => {
    /* L'avancée : la courbe douce, à peine contrariée par deux ondes lentes.
       Le terme (1-eased) éteint l'irrégularité vers la fin — une fracture
       hésite au départ, plus quand elle est lancée. */
    const wob = Math.sin(raw * 17.3) * 0.6 + Math.sin(raw * 7.1 + 1.7) * 0.4;
    let p = Math.max(0, Math.min(1, eased + wob * o.stutter * (1 - eased)));
    if (o.reverse) p = 1 - p;
    grad.setAttribute('r', Math.max(0.01, p * o.reach).toFixed(1));

    /* Intensité du choc, transmise à l'appelant : forte à la rupture,
       éteinte quand tout a cédé. */
    if (!o.reverse) {
      const decay = Math.pow(1 - raw, 1.7);
      o.onTremor?.(decay * (0.55 + 0.45 * Math.abs(Math.sin(raw * 9.4))));
    }
  }, easeOutCubic);

  o.onTremor?.(0);
  cover.remove();
  grad.remove();
}

/* ══════════════════════════════════════════════════════════════════════════
   Écrire un mot
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Découpe un <text> en une lettre par <tspan>, prêtes à paraître une à une.
 *
 * ⚠️ Pourquoi seulement l'OPACITÉ ? Parce qu'en SVG 1.1 un <tspan> n'accepte
 * pas `transform` : Chrome l'ignore purement et simplement. Une lettre qui
 * « monte en se posant » est donc hors de portée à ce niveau — on ne peut agir
 * que sur ce qui se peint. L'opacité échelonnée suffit largement : à 34 ms
 * d'écart, l'œil lit une main qui écrit, pas des lettres qui clignotent.
 *
 * Les <tspan> sont créés SANS x : ils s'enchaînent dans le flux, ce qui
 * préserve les approches du moteur de rendu (couper le texte en tspan
 * positionnés casserait le crénage).
 */
export function splitLetters(textEl, str) {
  const spans = [];
  textEl.textContent = '';
  for (const ch of str) {
    // L'espace insécable garde sa largeur : un <tspan> ne contenant qu'une
    // espace ordinaire serait réduit à néant par la normalisation XML.
    const span = svgEl('tspan');
    span.textContent = ch === ' ' ? ' ' : ch;
    span.style.opacity = '0';
    textEl.appendChild(span);
    spans.push(span);
  }
  return spans;
}

/** Fait paraître les lettres l'une après l'autre. */
export function writeLetters(spans, motion, { step, fade }) {
  spans.forEach((span, i) => {
    motion.animate(span, [{ opacity: 0 }, { opacity: 1 }], {
      duration: fade,
      delay:    i * step,
      easing:   EASE.soft,
    });
  });
  return (spans.length - 1) * step + fade;
}

/**
 * Réduit la police jusqu'à ce que la ligne la plus large tienne dans `maxWidth`.
 *
 * Mesure RÉELLE (`getComputedTextLength`), pas estimation : l'œuvre a été
 * composée en « Edges », le chapitre la re-compose en Roboto Condensed, et
 * personne ne peut prédire de combien la seconde déborde la première. On
 * mesure, on ajuste. Le texte doit être dans le document (opacité 0 admise) —
 * une mesure sur un élément non rendu retourne 0.
 *
 * @returns {number} la taille retenue
 */
export function fitFontSize(textEls, maxWidth, startSize, minSize = 9) {
  let size = startSize;
  for (let guard = 0; guard < 40; guard++) {
    let widest = 0;
    for (const el of textEls) {
      el.setAttribute('font-size', size);
      let w = 0;
      try { w = el.getComputedTextLength(); } catch { w = 0; }
      widest = Math.max(widest, w);
    }
    // Mesure impossible (police pas encore prête) : on garde la taille voulue.
    if (widest === 0) return size;
    if (widest <= maxWidth || size <= minSize) return size;
    size = Math.max(minSize, size * Math.min(0.97, maxWidth / widest));
  }
  return size;
}
