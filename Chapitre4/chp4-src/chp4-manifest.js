/**
 * chp4-manifest.js — CARTE DE L'ŒUVRE (données pures, aucun effet de bord)
 * ─────────────────────────────────────────────────────────────────────────────
 * `chp4-images/chapitre4.svg` est un export Illustrator : 21 <path> anonymes,
 * un <image> encastré, quatre <text> dans une police absente du projet.
 * Ce fichier dit CE QUE CHAQUE TRACÉ EST — il ne règle rien (les réglages sont
 * dans chp4-config.js), il nomme.
 *
 * POURQUOI PAR INDICE, ET PAS PAR SÉLECTEUR ?
 * L'export ne porte aucun identifiant sémantique : les classes (cls-1, cls-2…)
 * ne décrivent que des remplissages, et douze tracés n'ont aucune classe. Le
 * seul repère stable est donc l'ordre du document. C'est fragile SI l'œuvre est
 * ré-exportée — d'où `verify()` : chaque tracé déclare le centre de sa boîte
 * englobante, et le moteur COMPARE au montage. Un ré-export qui réordonne les
 * tracés n'affiche pas n'importe quoi en silence : il se DÉNONCE en console
 * (règle de CLAUDE.md — un repli ne doit jamais faire semblant).
 *
 * ANATOMIE DU DESSIN (viewBox 1187 × 1079) :
 *
 *        ┌─────────────────────────────────────────────┐
 *        │   ☁ des MOTS            ☁ La PLURALITÉ      │   ← bulles hautes
 *        │        ˙ ˙ ˙ ·        · ˙ ˙                 │
 *        │              ╲   FISSURE   ╱                │
 *        │  ☁ LA DIGNITÉ ╲    ╱╲     ╱  ☁ Un MIROIR    │   ← bulles médianes
 *        │        · ˙     ╲  ╱  ╲   ╱     ˙ ·          │
 *        │                 ╲╱    ╲ ╱                   │
 *        │                  · ˙                        │
 *        │              ☁ [ la carte ]                 │   ← bulle-image
 *        └─────────────────────────────────────────────┘
 *
 * Chaque bulle est un NUAGE (`shape`) précédé d'une QUEUE (`tail`) de petites
 * bulles. La queue est listée dans l'ordre du DESSIN — de la plus petite (celle
 * qui touche la fissure) à la plus grande (celle qui touche le nuage) : la
 * pensée part de la fracture et enfle jusqu'au mot.
 *
 * TROIS TONS, hérités des remplissages de l'export :
 *   'ink'   → nuage noir plein, lettres blanches      (des MOTS · Un MIROIR)
 *   'grey'  → nuage gris plein, lettres blanches      (La PLURALITÉ DES ACTEURS)
 *   'paper' → nuage évidé (contour seul), lettres noires  (LA DIGNITÉ · la carte)
 * Les tracés 'paper' sont des ANNEAUX : un contour extérieur et un contour
 * intérieur dans le même <path>, le second tracé en sens inverse — c'est ce qui
 * creuse le trou. Ne jamais toucher à leur `fill-rule` : l'export l'a laissé au
 * défaut, et y toucher boucherait l'anneau.
 */

import { bboxInUserSpace } from './chp4-draw.js';

/* Le repère de l'œuvre est celui de son viewBox — 0 0 1140 1079 à ce jour.
   Il n'est PAS recopié ici en constante : le seul lecteur qui en a besoin
   (le cache de la fracture, dans chp4-draw.js) lit `svg.viewBox.baseVal`,
   c'est-à-dire la valeur vivante. Un chiffre recopié serait un second lieu
   de vérité, et il a déjà failli mentir : l'œuvre est passée de 1187 à 1140
   de large lors d'un ré-export, sans que personne n'ait à le dire au code. */

/**
 * Tracés structurels (hors bulles).
 *   whiteMask : plan blanc PLEIN CADRE percé d'un trou. Posé juste après
 *               l'<image> encastrée, il ne laisse voir d'elle que le trou —
 *               c'est lui qui découpe la capture d'écran à la forme de la
 *               bulle du bas. Blanc sur page blanche : invisible par ailleurs.
 *               Il reste OPAQUE en permanence (cf. chp4-opening : on ne fait
 *               apparaître que l'<image> dessous, jamais le masque, sinon le
 *               fondu laisserait voir la capture hors de son trou).
 *   fissure   : la fracture, un seul contour fermé qui se ramifie en étoile.
 */
export const NODES = {
  whiteMask: 0,
  fissure:   1,
};

/**
 * LA FRACTURE, MESURÉE — deux valeurs qui vont ensemble.
 *
 *   heart : la JONCTION des trois branches, en coordonnées de l'œuvre. C'est
 *           le point de rupture : la propagation s'y ancre et gagne les trois
 *           extrémités à la fois.
 *   reach : la distance du cœur au point le plus éloigné du tracé. Elle donne
 *           à la propagation sa portée exacte — trop courte, des morceaux de
 *           fracture resteraient cachés pour toujours ; trop longue, le disque
 *           aurait fini de tout révéler bien avant la fin du temps qu'on lui
 *           donne, et la dernière seconde ne montrerait plus rien.
 *
 * ⚠️ POURQUOI UNE CONSTANTE ET NON UNE MESURE AU MONTAGE ? Parce que mesurer
 * coûte une SECONDE ET DEMIE. La façon naturelle de le faire — échantillonner
 * le tracé avec `getPointAtLength()` — est en temps linéaire dans la longueur
 * du tracé À CHAQUE APPEL : 240 points sur les onze mille caractères de la
 * fissure prenaient 1762 ms au banc d'essai, page gelée (120 points : 696 ms ;
 * 32 points, déjà imprécis : 190 ms). La boîte englobante, elle, est immédiate
 * mais surestime de 30 % — la fracture se serait révélée en entier au tiers du
 * temps. C'est donc une propriété de l'ŒUVRE, mesurée une fois, écrite ici.
 *
 * POUR LA RE-MESURER après un ré-export, dans la console, chapitre ouvert :
 *
 *     const p = document.querySelector('.chp4-fissure'), o = {x:545, y:635};
 *     const svg = p.ownerSVGElement, m = svg.getScreenCTM().inverse()
 *                 .multiply(p.getScreenCTM()), pt = svg.createSVGPoint();
 *     let max = 0, L = p.getTotalLength();
 *     for (let i = 0; i <= 240; i++) {
 *       const q = p.getPointAtLength(i / 240 * L);
 *       pt.x = q.x; pt.y = q.y; const r = pt.matrixTransform(m);
 *       max = Math.max(max, Math.hypot(r.x - o.x, r.y - o.y));
 *     }
 *     console.log(Math.round(max));
 *
 * `verify()` surveille la cohérence des deux valeurs à chaque montage — pour
 * rien s'il n'y a pas de ré-export, et bruyamment le jour où il y en a un.
 */
export const FISSURE = {
  heart: { x: 498, y: 635 },
  reach: 566,
};

/**
 * Les cinq bulles, dans l'ordre du document (pas celui du dessin animé, qui se
 * règle dans chp4-config → sequence).
 *
 * @property {string}   id     clé de jonction avec chp4-config.bubbles
 * @property {number}   shape  indice du <path> du nuage
 * @property {number[]} tail   indices des petites bulles, de la fissure au nuage
 * @property {string}   tone   'ink' | 'grey' | 'paper'
 * @property {number[]} center centre attendu de la boîte du nuage — sert à
 *                             `verify()`, jamais à la mise en page (le moteur
 *                             mesure le DOM réel, qui seul fait foi)
 * @property {boolean} [inset] la bulle encadre l'<image> encastrée
 */
export const BUBBLES = [
  { id: 'mots',      shape: 14, tail: [15, 11, 13, 12], tone: 'ink',   center: [196, 223] },
  { id: 'pluralite', shape: 19, tail: [18, 17, 16],     tone: 'grey',  center: [697, 301] },
  { id: 'miroir',    shape: 10, tail: [7, 9, 8],        tone: 'ink',   center: [916, 527] },
  { id: 'dignite',   shape:  4, tail: [6, 5],           tone: 'paper', center: [150, 574] },
  { id: 'carte',     shape: 20, tail: [3, 2],           tone: 'paper', center: [540, 911], inset: true },
];

/** Nombre de <path> attendus dans l'export — première sentinelle de `verify()`. */
export const EXPECTED_PATH_COUNT = 21;

/**
 * Centres attendus des petites bulles de queue (mêmes unités que `center`).
 * Séparés des bulles pour garder la liste ci-dessus lisible.
 */
const TAIL_CENTERS = {
  15: [386, 359], 11: [367, 351], 13: [342, 339], 12: [310, 316],
  18: [530, 463], 17: [553, 450], 16: [582, 428],
   7: [799, 694],  9: [818, 674],  8: [840, 640],
   6: [211, 735],  5: [201, 695],
   3: [504, 719],  2: [491, 761],
};

/** Centres attendus des tracés structurels. */
const NODE_CENTERS = { 0: [570, 540], 1: [538, 515] };

/**
 * Tolérance de la vérification, en unités de l'œuvre.
 * Généreuse à dessein : les centres ci-dessus sont dérivés des POINTS D'ANCRAGE
 * des courbes, quand `getBBox()` tient compte de leur bombé — l'écart légitime
 * atteint quelques unités. 45 laisse passer ce bruit et arrête net un ré-export
 * qui aurait réordonné les tracés (les voisins les plus proches sont à plus de
 * 100 unités l'un de l'autre).
 */
const TOLERANCE = 45;

/**
 * Confronte l'œuvre chargée à ce manifeste et ALERTE en console si elle a bougé.
 * N'interrompt jamais le chapitre : mieux vaut un dessin approximatif signalé
 * qu'un écran noir. Le moteur affiche l'alerte, puis continue.
 *
 * @param {SVGElement} svg  la racine <svg> injectée dans le document
 * @returns {{ok: boolean, problems: string[]}}
 */
export function verify(svg) {
  const problems = [];
  const paths = svg.querySelectorAll('path');

  if (paths.length !== EXPECTED_PATH_COUNT) {
    problems.push(
      `${paths.length} tracés au lieu de ${EXPECTED_PATH_COUNT} : l'œuvre a été ré-exportée. ` +
      `Les indices de chp4-manifest.js doivent être refaits.`
    );
    return { ok: false, problems };
  }

  const centerOf = (el) => {
    const b = bboxInUserSpace(svg, el);
    return [b.x + b.width / 2, b.y + b.height / 2];
  };

  const check = (index, expected, label) => {
    const el = paths[index];
    if (!el) { problems.push(`${label} : tracé n°${index} absent.`); return; }
    const [cx, cy] = centerOf(el);
    const d = Math.hypot(cx - expected[0], cy - expected[1]);
    if (d > TOLERANCE) {
      problems.push(
        `${label} : tracé n°${index} centré en (${Math.round(cx)}, ${Math.round(cy)}) ` +
        `au lieu de (${expected[0]}, ${expected[1]}) — écart ${Math.round(d)}.`
      );
    }
  };

  Object.entries(NODE_CENTERS).forEach(([i, c]) =>
    check(Number(i), c, i === '0' ? 'Masque blanc' : 'Fissure'));

  BUBBLES.forEach((b) => {
    check(b.shape, b.center, `Bulle « ${b.id} »`);
    b.tail.forEach((i) => {
      if (TAIL_CENTERS[i]) check(i, TAIL_CENTERS[i], `Queue de « ${b.id} »`);
    });
  });

  /* La portée de la fracture est une constante mesurée (voir FISSURE). On ne
     la re-mesure pas — ce serait une seconde et demie de page gelée — mais on
     la CONFRONTE à la boîte englobante du tracé, qui, elle, est immédiate.
     La boîte majore forcément la vraie portée : `reach` doit tenir dessous,
     sans être absurdement bas. Hors de cette fourchette, l'œuvre a changé. */
  const frac = paths[NODES.fissure];
  if (frac) {
    const b = bboxInUserSpace(svg, frac);
    const corners = [[b.x, b.y], [b.x + b.width, b.y],
                     [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]];
    const bound = Math.max(...corners.map(([x, y]) =>
      Math.hypot(x - FISSURE.heart.x, y - FISSURE.heart.y)));
    if (FISSURE.reach > bound || FISSURE.reach < bound * 0.45) {
      problems.push(
        `Fracture : portée déclarée ${FISSURE.reach}, incohérente avec le tracé ` +
        `(sa boîte englobante plafonne à ${Math.round(bound)} depuis le cœur). ` +
        `Re-mesurer FISSURE.reach — la marche à suivre est en tête de ce fichier.`
      );
    }
  }

  return { ok: problems.length === 0, problems };
}
