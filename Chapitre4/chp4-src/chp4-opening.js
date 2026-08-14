/**
 * chp4-opening.js — LE MOTEUR DU CHAPITRE 4
 * ─────────────────────────────────────────────────────────────────────────────
 * « Une histoire complexe » : la lumière se rallume sur une page blanche, le
 * crâne paraît, sa fracture se propage, et cinq bulles en sortent — une à une,
 * comme sous la main qui les dessine.
 *
 * PATTERN FACTORY (règle d'or du projet, cf. CLAUDE.md)
 * Ce module n'a AUCUN effet de bord au chargement. Il n'attrape aucune
 * référence DOM, ne pose aucun écouteur, ne lance aucune boucle avant que
 * `startChapitre4()` ne soit appelé sur le DOM fraîchement injecté par
 * Chapitre4Scene. `stopChapitre4()` défait tout et réarme le montage pour la
 * visite suivante. Import unique, sans cache-bust.
 *
 * PARTAGE DES RÔLES AVEC LA SCÈNE
 *   La scène  : injecte le CSS et le DOM (avec son rideau noir), attend le
 *               décodage de la photo, importe ce module, tient le sous-titre,
 *               la flèche de sortie et la navigation réelle.
 *   Le moteur : charge l'œuvre, la met en état, joue la chorégraphie, fait
 *               vivre le dessin et gère l'écoute et la carte.
 *
 * SIGNAUX ÉMIS (window)
 *   chp4:page-ready     tout est monté, l'écran est NOIR → la scène peut lever
 *                       son rideau sans rien dévoiler (le « dawn » prend le
 *                       relais et fait monter la lumière).
 *   chp4:navigate-back  le fondu de sortie est au noir et le son est coupé →
 *                       la scène peut naviguer.
 *
 * TOUT EST EN UNITÉS DE L'ŒUVRE. Le dessin, les mots, les ondes, la croix
 * d'arrêt : tout vit dans le viewBox 1187 × 1079 du SVG. Conséquence heureuse —
 * il n'y a RIEN à recalculer au redimensionnement, le navigateur remet la carte
 * à l'échelle tout seul. C'est pourquoi ce module n'expose pas de `resize()`.
 */

import { CONFIG }                       from './chp4-config.js';
import { NODES, BUBBLES, FISSURE, verify } from './chp4-manifest.js';
import { BubbleLayer }                  from './chp4-bubbles.js';
import { MapPortal }                    from './chp4-portal.js';
import { Motion, EASE, propagate,
         easeInOutSine, prefersReducedMotion } from './chp4-draw.js';

/* ── État du montage — remis à neuf par stopChapitre4() ─────────────────── */
let mounted     = false;
let motion      = null;   // chronologie d'ouverture + vie du dessin
let layer       = null;   // BubbleLayer
let portal      = null;   // MapPortal
let audioMgr    = null;
let arrowShow   = null;
let arrowHide   = null;
let dom         = null;   // références DOM résolues au montage
let parallaxOff = null;   // détacheur des écouteurs de parallaxe

/* ══════════════════════════════════════════════════════════════════════════
   PONTS AVEC LA SCÈNE
   ══════════════════════════════════════════════════════════════════════════ */

/** L'AudioManager du site — sert son contexte Web Audio à l'analyse des ondes. */
export function setAudioManager(mgr) { audioMgr = mgr; }

/** Callbacks d'apparition / disparition de la flèche de sortie. */
export function setArrowCallbacks(show, hide) { arrowShow = show; arrowHide = hide; }

/* ══════════════════════════════════════════════════════════════════════════
   MONTAGE
   ══════════════════════════════════════════════════════════════════════════ */

export async function startChapitre4() {
  if (mounted) return;
  mounted = true;
  motion  = new Motion();

  dom = {
    root:  document.getElementById('chapitre4-root'),
    stage: document.getElementById('chp4-stage'),
    photo: document.getElementById('chp4-photo'),
    art:   document.getElementById('chp4-art'),
    dawn:  document.getElementById('chp4-dawn'),
    bloom: document.getElementById('chp4-bloom'),
    fade:  document.getElementById('chp4-fade'),
  };
  if (!dom.root || !dom.art) {
    console.warn('[chp4] DOM du chapitre absent : montage abandonné.');
    return;
  }

  applyStyle();
  applySplit();

  const svg = await loadArtwork();
  if (!svg || motion.stopped) { signalReady(); return; }

  /* La police des libellés doit être PRÊTE avant qu'on ne mesure les mots :
     `fitFontSize` réduit la taille jusqu'à ce que la ligne tienne dans son
     nuage, et une mesure faite sur la police de repli donnerait une taille
     fausse — figée, elle, jusqu'à la fin du chapitre. */
  await waitForFont();

  /* La pop-up est greffée sur #app, PAS sur le root du chapitre : celui-ci
     plafonne à z 500, quand les titres du site sont remontés à 600 pendant les
     chapitres. Posée dans le root, la carte s'ouvrirait SOUS « Espace
     collaboratif ». (Même contrainte qu'au chapitre 2 — cf. style.css.) */
  portal = new MapPortal(CONFIG.map, document.getElementById('app') ?? dom.root);
  layer  = new BubbleLayer(svg, CONFIG, BUBBLES, {
    audioManager: audioMgr,
    onMapRequest: (rect, onClosed) => portal.open(rect, onClosed),
  }).build();

  // Tout est en place, l'écran est encore noir : la scène peut lever le rideau.
  signalReady();

  choreograph().catch((err) => {
    if (motion?.stopped) return;
    console.error('[chp4] Chorégraphie interrompue :', err);
  });
}

/**
 * Écrit dans le DOM tout ce qui ne dépend pas de la taille de la fenêtre :
 * palette, profondeur du papier, cadrage de la photo, réactions au survol.
 * Appelé une fois au montage. Ce qui dépend du viewport est dans `applySplit()`.
 */
function applyStyle() {
  const L = CONFIG.layout;
  const P = CONFIG.palette;
  const D = CONFIG.depth;
  const s = dom.root.style;

  s.setProperty('--chp4-paper',       P.paper);
  s.setProperty('--chp4-ink',         P.ink);
  s.setProperty('--chp4-grey',        P.grey);
  s.setProperty('--chp4-accent',      P.accent);
  s.setProperty('--chp4-accent-soft', P.accent_soft);

  s.setProperty('--chp4-photo-pos',   `${L.photo_focus_x}% ${L.photo_focus_y}%`);
  s.setProperty('--chp4-photo-scale', L.photo_scale);
  // Sur-échelle de départ, résorbée par revealPhoto().
  s.setProperty('--chp4-photo-settle', String(1 + CONFIG.photo.settle));
  s.setProperty('--chp4-veil-from',   L.veil_from + '%');
  s.setProperty('--chp4-veil-mid',    L.veil_mid + '%');
  s.setProperty('--chp4-veil-full',   L.veil_full + '%');

  s.setProperty('--chp4-vignette',    D.vignette);
  s.setProperty('--chp4-vignette-at', D.vignette_start + '%');
  s.setProperty('--chp4-grain',       D.grain);
  s.setProperty('--chp4-grain-size',  D.grain_size + 'px');

  s.setProperty('--chp4-hover-scale',  CONFIG.hover.scale);
  s.setProperty('--chp4-hover-lift',   CONFIG.hover.lift + 'px');
  s.setProperty('--chp4-hover-ms',     CONFIG.hover.duration + 'ms');
  s.setProperty('--chp4-listen-scale', CONFIG.listen.scale);
  s.setProperty('--chp4-dim',          CONFIG.listen.dim_others);
  s.setProperty('--chp4-dim-ms',       CONFIG.listen.dim_duration + 'ms');
}

/**
 * Répartit l'écran entre la photographie et le dessin, SELON LA FORME DE LA
 * FENÊTRE. Recalculé à chaque redimensionnement.
 *
 * POURQUOI PAS UN PARTAGE FIXE ? Parce que le dessin s'inscrit dans son viewBox
 * (1187 × 1079, presque carré) et s'ajuste au plus contraignant de ses deux
 * côtés. Sur un 16:9, la moitié droite lui va bien. Mais quand on resserre la
 * fenêtre, cette même moitié devient étroite et haute : le dessin se cale sur
 * la largeur et laisse d'immenses vides en haut et en bas — il a l'air perdu au
 * milieu de rien. La photo lui cède donc du terrain à mesure, entre les deux
 * régimes déclarés dans chp4-config → layout.
 *
 * (Le calcul est en JS et non en CSS parce que les seuils sont des RÉGLAGES :
 * une media query les figerait dans la feuille, hors de portée de la config.)
 */
function applySplit() {
  const L  = CONFIG.layout;
  const vw = Math.max(1, window.innerWidth);
  const vh = Math.max(1, window.innerHeight);

  const span = Math.max(0.001, L.wide_aspect - L.narrow_aspect);
  const t    = Math.max(0, Math.min(1, (vw / vh - L.narrow_aspect) / span));
  const photoW = L.photo_narrow_pct + (L.photo_wide_pct - L.photo_narrow_pct) * t;

  const s = dom.root.style;
  s.setProperty('--chp4-photo-w',   photoW.toFixed(2) + '%');
  s.setProperty('--chp4-art-left',  (photoW - L.overlap_pct).toFixed(2) + '%');
  // Marge du dessin en PIXELS : un pourcentage se résoudrait sur la largeur
  // pour left/right et sur la hauteur pour top/bottom — deux marges
  // différentes pour un seul réglage.
  s.setProperty('--chp4-art-inset', Math.round(vh * L.inset_pct / 100) + 'px');
}

/**
 * Charge l'œuvre, l'inline dans la page et la met en état de paraître.
 *
 * POURQUOI INLINE, ET PAS UN <img src="chapitre4.svg"> ? Parce qu'une image ne
 * s'anime pas : il faut atteindre chaque tracé, le regrouper, le recolorer, y
 * greffer des mots et des zones cliquables. Seul un SVG inline le permet.
 *
 * DEUX NETTOYAGES INDISPENSABLES À L'INLINE :
 *   · le <style> interne de l'export — une fois inline, ses règles `.cls-1 {…}`
 *     deviennent des règles du DOCUMENT et s'appliqueraient à n'importe quel
 *     élément du site portant ces classes. On le supprime, et la palette de
 *     chp4-config prend le relais.
 *   · les quatre <text> — composés en « EdgesRegular », police absente du
 *     projet : ils s'afficheraient dans une police de repli, aux positions
 *     calculées pour une AUTRE (chaque <tspan> porte un x figé, calé sur les
 *     approches d'Edges). Illisible. On les jette, chp4-bubbles les recompose.
 */
async function loadArtwork() {
  let text;
  try {
    const res = await fetch(CONFIG.assets.artwork);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (err) {
    console.error(`[chp4] Œuvre illisible (${CONFIG.assets.artwork}) :`, err?.message ?? err);
    return null;
  }

  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const src = doc.querySelector('svg');
  if (!src || doc.querySelector('parsererror')) {
    console.error('[chp4] Œuvre illisible : SVG mal formé.');
    return null;
  }

  const svg = document.importNode(src, true);
  svg.removeAttribute('id');
  svg.setAttribute('id', 'chp4-svg');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.querySelectorAll('style').forEach((n) => n.remove());
  svg.querySelectorAll('text').forEach((n) => n.remove());
  dom.art.appendChild(svg);

  // Le manifeste se confronte à l'œuvre réelle et parle s'il ne s'y retrouve pas.
  const { ok, problems } = verify(svg);
  if (!ok) {
    console.warn(
      '[chp4] L\'œuvre ne correspond plus à chp4-manifest.js — le dessin sera ' +
      'incohérent tant que les indices n\'auront pas été refaits :\n  · ' +
      problems.join('\n  · ')
    );
  }

  const paths = svg.querySelectorAll('path');
  const P = CONFIG.palette;

  /* Le plan blanc percé : il découpe la capture d'écran à la forme de la bulle
     du bas. Peint dans la couleur du PAPIER (l'export dit #fff, ce qui ferait
     un rectangle plus clair sur un papier légèrement chaud). Toujours opaque :
     ce qu'on fera paraître, c'est l'image dessous. */
  const mask = paths[NODES.whiteMask];
  if (mask) {
    mask.removeAttribute('class');
    mask.setAttribute('class', 'chp4-mask');
    mask.setAttribute('fill', P.paper);
    mask.setAttribute('pointer-events', 'none');
  }

  const fissure = paths[NODES.fissure];
  if (fissure) {
    fissure.removeAttribute('class');
    fissure.setAttribute('class', 'chp4-fissure');
    fissure.setAttribute('fill', P.ink);
    fissure.setAttribute('pointer-events', 'none');
    fissure.style.opacity = '0';
  }

  const image = svg.querySelector('image');
  if (image) {
    image.setAttribute('class', 'chp4-inset');
    image.style.opacity = '0';
  }

  return svg;
}

/** Attend que Roboto Condensed soit chargée — sans jamais bloquer longtemps. */
async function waitForFont() {
  const T = CONFIG.type;
  try {
    await Promise.race([
      document.fonts.load(`${T.weight} 48px ${T.family.split(',')[0]}`),
      new Promise((r) => motion.after(1200, r)),
    ]);
  } catch { /* API absente : on compose avec ce qu'on a */ }
}

function signalReady() {
  window.dispatchEvent(new CustomEvent('chp4:page-ready'));
}

/* ══════════════════════════════════════════════════════════════════════════
   CHORÉGRAPHIE — le dessin se fait
   ══════════════════════════════════════════════════════════════════════════ */

async function choreograph() {
  const C = CONFIG;

  /* 1. La lumière monte : le noir devient page blanche.
        `dawn.hold` couvre la levée du rideau de la scène — on ne commence pas
        à éclairer tant qu'il n'a pas fini de s'effacer. */
  await motion.wait(C.dawn.hold);
  await dawn();

  /* 2. Le crâne paraît. */
  await motion.wait(C.photo.delay);
  revealPhoto();

  /* 3. La fracture se propage — elle chevauche la fin du fondu de la photo :
        la fêlure semble naître de l'os pendant qu'il se révèle. */
  await motion.wait(C.fissure.delay);
  drawFissure();          // lancée, pas attendue — l'étape 4 se cale dessus

  /* 4. Les bulles, une par une. `start_after` se compte depuis la FIN de la
        fissure ; négatif, la première bulle mord sur la fin de la fracture —
        d'où l'attente calculée sur la durée plutôt qu'un `await` du tracé. */
  await motion.wait(Math.max(0, C.fissure.duration + C.bubbles_timing.start_after));
  await drawBubbles();

  /* 5. Le dessin est fait : il se met à vivre, la sortie s'ouvre. */
  if (motion.stopped) return;
  motion.after(C.outro.live_delay, () => breatheLife());
  motion.after(C.outro.arrow_delay, () => {
    layer?.activate();
    arrowShow?.();
  });
}

/** Le noir devient papier — un halo s'ouvre au centre, comme une lampe. */
function dawn() {
  const D = CONFIG.dawn;
  if (!dom.dawn) return Promise.resolve();

  motion.animate(dom.bloom, [
    { opacity: 0, transform: `scale(${D.bloom_from / 100})` },
    { opacity: 1, transform: `scale(${(D.bloom_from + D.bloom_to) / 200})`, offset: 0.42 },
    { opacity: 0, transform: `scale(${D.bloom_to / 100})` },
  ], { duration: D.duration, easing: EASE.settle });

  motion.animate(dom.dawn, [{ opacity: 1 }, { opacity: 0 }],
    { duration: D.duration, easing: 'cubic-bezier(0.42, 0, 0.3, 1)' });

  return motion.wait(D.duration).then(() => {
    // Retiré du flux : un calque plein écran, même transparent, reste un
    // calque que le compositeur repeint à chaque frame.
    if (dom.dawn) dom.dawn.style.display = 'none';
  });
}

/**
 * Le crâne paraît, et se pose : il entre très légèrement trop grand, puis se
 * range à sa taille. Ce dernier millimètre est ce qui distingue une photo qui
 * ARRIVE d'une photo qui était déjà là sous un calque.
 *
 * ⚠️ L'échelle passe par une VARIABLE CSS et une transition, pas par les Web
 * Animations : une propriété personnalisée n'est pas interpolable par l'API
 * (il faudrait l'enregistrer via `@property`, avec un type — pour un seul
 * mouvement, la transition CSS fait le même travail sans cérémonie). Seule
 * l'opacité, propriété standard, passe par `animate()`.
 */
function revealPhoto() {
  const Ph = CONFIG.photo;
  if (!dom.photo) return;
  motion.animate(dom.photo, [{ opacity: 0 }, { opacity: 1 }],
    { duration: Ph.duration, easing: EASE.settle });
  dom.photo.style.transitionDuration = motion.ms(Ph.duration * 1.5) + 'ms';
  requestAnimationFrame(() => {
    dom.root?.style.setProperty('--chp4-photo-settle', '1');
  });
}

/**
 * LA RUPTURE. La fracture s'ouvre depuis le cœur de l'étoile et gagne ses
 * trois extrémités à la fois, en tremblant, pendant que toute la page encaisse
 * le choc.
 *
 * Le cœur et la portée viennent du manifeste : ce sont des propriétés mesurées
 * de l'œuvre, pas des réglages (les mesurer au montage coûterait une seconde et
 * demie de page gelée — l'explication est en tête de chp4-manifest.js).
 */
function drawFissure() {
  const F = CONFIG.fissure;
  const path = dom.art.querySelector('.chp4-fissure');
  if (!path) return Promise.resolve();

  const t0 = performance.now();
  return propagate(path, motion, {
    origin:   FISSURE.heart,
    reach:    FISSURE.reach * F.reach_margin,
    duration: F.duration,
    softness: F.softness,
    stutter:  F.stutter,
    cover:    CONFIG.palette.paper,
    onTremor: (intensity) => tremor(intensity, performance.now() - t0),
  });
}

/**
 * LE TREMBLEMENT DE LA RUPTURE, porté par toute la page.
 *
 * ⚠️ IL SECOUE L'ÉLÉMENT <svg> ENTIER, ET NON LE TRACÉ. C'est le seul endroit
 * où il ne coûte rien : une transformation CSS sur un élément promu en calque
 * (`will-change: transform`) est jouée par le compositeur, sans re-pixelliser
 * quoi que ce soit. La première version faisait trembler un groupe DANS le
 * SVG : chaque frame invalidait le rendu des onze mille caractères du tracé,
 * et la propagation tombait à 30 images/seconde. Ne pas y revenir.
 *
 * Le résultat à l'écran est le même — pendant la fracture, le tracé est la
 * seule chose dessinée —, et il est même meilleur : la photographie encaisse
 * le choc elle aussi, à moitié moins fort. C'est le crâne qui se fend.
 *
 * Deux fréquences battent l'une contre l'autre pour ne jamais ronronner, et
 * l'enveloppe `tremor_ms` éteint tout bien avant la fin de la propagation :
 * le choc est un instant, la fêlure est un processus. Trembler cinq secondes
 * donnerait le mal de mer là où l'on veut un saisissement.
 */
function tremor(intensity, elapsed) {
  const F = CONFIG.fissure;
  if (!F.tremor_amp || !dom?.root) return;
  const s   = dom.root.style;
  const env = Math.max(0, 1 - elapsed / F.tremor_ms);
  if (env <= 0 || intensity <= 0) {
    s.setProperty('--chp4-jx', '0px');
    s.setProperty('--chp4-jy', '0px');
    return;
  }
  const t = performance.now() / 1000;
  const a = F.tremor_amp * intensity * env * env;
  s.setProperty('--chp4-jx',
    ((Math.sin(t * F.tremor_hz_a * 6.283) * 0.6 +
      Math.sin(t * F.tremor_hz_b * 6.283) * 0.4) * a).toFixed(2) + 'px');
  s.setProperty('--chp4-jy',
    (Math.cos(t * F.tremor_hz_b * 6.283) * a * 0.66).toFixed(2) + 'px');
}

/** Les bulles paraissent l'une après l'autre, sans attendre la précédente. */
async function drawBubbles() {
  const T = CONFIG.bubbles_timing;
  const order = T.sequence.filter((id) => layer.bubbles.has(id));

  const missing = T.sequence.filter((id) => !layer.bubbles.has(id));
  if (missing.length) {
    console.warn(`[chp4] Bulles annoncées dans bubbles_timing.sequence mais ` +
                 `introuvables : ${missing.join(', ')}.`);
  }

  const drawn = order.map((id, i) => new Promise((resolve) => {
    motion.after(i * T.gap, () => {
      const p = layer.draw(id);
      if (layer.bubbles.get(id)?.spec.inset) revealInset(id);
      p.then(resolve).catch(resolve);
    });
  }));
  await Promise.all(drawn);
}

/**
 * La capture d'écran encastrée dans la bulle du bas se révèle — une fois son
 * contour tracé, jamais avant : l'image se pose DANS une bulle déjà dessinée.
 * Le délai reprend exactement le découpage de `BubbleLayer.draw()` (queue, puis
 * tracé) — même chiffres, même source.
 */
function revealInset(id) {
  const T   = CONFIG.bubbles_timing;
  const img = dom.art.querySelector('.chp4-inset');
  const b   = layer.bubbles.get(id);
  if (!img || !b) return;
  const tail = Math.max(0, (b.dots.length - 1) * T.tail_step + T.tail_pop * 0.55);
  motion.after(tail + T.trace, () => {
    motion.animate(img, [{ opacity: 0 }, { opacity: 1 }],
      { duration: T.inset_fade, easing: EASE.soft });
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   LA VIE DU DESSIN — rien ne se fige
   ══════════════════════════════════════════════════════════════════════════ */

function breatheLife() {
  const V = CONFIG.live;

  /* Respiration : chaque bulle sur sa propre période, jamais deux en phase.
     Confiée au CSS (animation infinie) plutôt qu'à une boucle : le compositeur
     s'en charge hors du fil principal, le coût est nul même à cinq bulles. */
  let i = 0;
  for (const b of layer.bubbles.values()) {
    const n      = layer.bubbles.size;
    const period = V.breath_min + (V.breath_max - V.breath_min) * (i / Math.max(1, n - 1));
    const angle  = (i / n) * Math.PI * 2 + 0.6;
    const st     = b.breath.style;
    st.setProperty('--bx', (Math.cos(angle) * V.breath_shift).toFixed(2) + 'px');
    st.setProperty('--by', (Math.sin(angle) * V.breath_shift).toFixed(2) + 'px');
    st.setProperty('--bs', (1 + V.breath_amp / 100).toFixed(4));
    st.animationName     = 'chp4-breath';
    st.animationDuration = period.toFixed(2) + 's';
    // Décalage négatif : les bulles démarrent déjà réparties dans leur cycle,
    // au lieu de partir toutes ensemble puis de dériver.
    st.animationDelay    = (-period * (i / n)).toFixed(2) + 's';
    i++;
  }

  /* La fracture frémit : une opacité qui respire, très lentement. */
  const frac = dom.art.querySelector('.chp4-fissure');
  if (frac && V.fissure_amp > 0) {
    const period = V.fissure_period * 1000;
    motion.loop((elapsed) => {
      const t = easeInOutSine((elapsed % period) / period);
      frac.style.opacity = (1 - V.fissure_amp * Math.abs(Math.sin(t * Math.PI))).toFixed(3);
    });
  }

  startParallax();
}

/**
 * Parallaxe au pointeur : le dessin et la photo glissent en sens inverse.
 * Quelques pixels — juste de quoi que la page cesse d'être plate.
 *
 * ⚠️ CE QUI BOUGE, C'EST LE CONTENU, JAMAIS SON CADRE. Les variables écrites
 * ici sont lues par l'IMAGE (à l'intérieur de sa bande, qui reste immobile et
 * masque le débord) et par le SVG (transparent, sans bord). Déplacer les
 * conteneurs eux-mêmes — ce que faisait la première version — promenait le
 * bord de leur calque de composition à travers l'écran : à chaque mouvement
 * apparaissait un liseré clair ou gris d'un pixel là où le calque se
 * raccordait au fond. C'est le sur-cadrage de la photo (`photo_scale`) qui
 * donne à l'image le mou nécessaire pour glisser sans jamais découvrir le vide.
 *
 * Coupée au doigt (`pointer: coarse`) : sans survol, l'effet ne se déclenche
 * qu'au contact et donne une secousse au lieu d'une profondeur.
 */
function startParallax() {
  const V = CONFIG.live;
  if (!V.parallax_art && !V.parallax_photo) return;
  if (window.matchMedia?.('(pointer: coarse)').matches) return;
  if (prefersReducedMotion()) return;

  let tx = 0, ty = 0, cx = 0, cy = 0;
  const onMove = (e) => {
    tx = (e.clientX / window.innerWidth  - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  parallaxOff = () => window.removeEventListener('pointermove', onMove);

  motion.loop(() => {
    cx += (tx - cx) * V.parallax_ease;
    cy += (ty - cy) * V.parallax_ease;
    const s = dom.root.style;
    s.setProperty('--chp4-ax', (-cx * V.parallax_art).toFixed(2) + 'px');
    s.setProperty('--chp4-ay', (-cy * V.parallax_art).toFixed(2) + 'px');
    s.setProperty('--chp4-px', ( cx * V.parallax_photo).toFixed(2) + 'px');
    s.setProperty('--chp4-py', ( cy * V.parallax_photo).toFixed(2) + 'px');
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   REDIMENSIONNEMENT
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Seule la RÉPARTITION photo/dessin est à recalculer : le dessin lui-même vit
 * dans le viewBox du SVG (1187 × 1079), et le navigateur le remet à l'échelle
 * tout seul — mots, ondes de survol, zones cliquables et croix d'arrêt suivent,
 * ils sont dans les mêmes unités.
 */
export function onResize() {
  if (!mounted || !dom?.root) return;
  applySplit();
}

/* ══════════════════════════════════════════════════════════════════════════
   SORTIE
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * LA SORTIE — le chapitre se défait, puis s'éteint.
 *
 * Le reflet de l'entrée : les bulles s'effacent dans l'ordre inverse de leur
 * venue, la fracture se referme sur son cœur (la même propagation, jouée à
 * l'envers), la lumière tombe. On ne prévient la scène qu'une fois le noir
 * atteint — le site retrouve ainsi l'obscurité qu'il attend entre deux scènes,
 * sans jamais montrer de coupure blanche.
 *
 * Rejouable sans dommage : le premier appel désarme la flèche, et un second
 * ne ferait que rejouer des animations déjà à leur terme.
 */
export function leaveToCollaboration() {
  // `motion` est testé autant que `mounted` : un démontage concurrent (sortie
  // par la barre de navigation pendant la sortie par la flèche) les remet à
  // zéro tous les deux, et il ne reste alors qu'à prévenir la scène.
  if (!mounted || !motion) {
    window.dispatchEvent(new CustomEvent('chp4:navigate-back'));
    return;
  }
  const X = CONFIG.exit;

  arrowHide?.();
  layer?.stopPlayback();
  portal?.destroy();

  /* 1. Les bulles se retirent, à rebours de leur apparition. */
  const order = [...CONFIG.bubbles_timing.sequence].reverse();
  order.forEach((id, i) => {
    const b = layer?.bubbles.get(id);
    if (!b) return;
    motion.after(i * X.bubble_stagger, () => {
      // La respiration doit cesser : elle écrit le même `transform` que le
      // retrait, et les deux se disputeraient l'élément à chaque frame.
      b.breath.style.animationName = 'none';
      motion.animate(b.outer, [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.965)' },
      ], { duration: X.bubble_fade, easing: EASE.soft });
    });
  });

  /* 2. La fracture se referme sur le point de rupture. */
  const path = dom.art?.querySelector('.chp4-fissure');
  const F    = CONFIG.fissure;
  if (path) {
    motion.after(X.fissure_delay, () => {
      propagate(path, motion, {
        origin:   FISSURE.heart,
        reach:    FISSURE.reach * F.reach_margin,
        duration: X.fissure_close,
        softness: F.softness,
        stutter:  0,                    // à la fermeture, aucune hésitation
        cover:    CONFIG.palette.paper,
        reverse:  true,
      });
    });
  }

  /* 3. Le crâne se retire. */
  if (dom.photo) {
    motion.after(X.fissure_delay, () => {
      motion.animate(dom.photo, [{ opacity: 1 }, { opacity: 0 }],
        { duration: X.photo_fade, easing: EASE.soft });
    });
  }

  /* 4. La lumière tombe. */
  const blackAt = X.fissure_delay + X.dusk_delay + X.dusk;
  if (dom.fade) {
    dom.fade.style.pointerEvents = 'auto';
    motion.after(X.fissure_delay + X.dusk_delay, () => {
      motion.animate(dom.fade, [{ opacity: 0 }, { opacity: 1 }],
        { duration: X.dusk, easing: 'cubic-bezier(0.55, 0, 0.45, 1)' });
    });
  }

  motion.after(blackAt, () => {
    window.dispatchEvent(new CustomEvent('chp4:navigate-back'));
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   DÉMONTAGE
   ══════════════════════════════════════════════════════════════════════════ */

export function stopChapitre4() {
  parallaxOff?.();
  parallaxOff = null;
  portal?.destroy();
  layer?.destroy();
  motion?.stop();

  // Le SVG est retiré ici et non par la scène : c'est le moteur qui l'a chargé
  // et greffé, c'est à lui de le reprendre. La scène, elle, retire le DOM
  // qu'elle a injecté — chacun défait ce qu'il a fait.
  dom?.art?.replaceChildren();

  portal = null;
  layer  = null;
  motion = null;
  dom    = null;
  mounted = false;
}
