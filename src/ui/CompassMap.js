/**
 * CompassMap.js — la boussole du coin haut-gauche, et la carte qu'elle déplie.
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE C'EST
 *   Repliée : une boussole, de la taille d'une flèche, alignée sur la colonne
 *   des titres. Elle se dessine comme tout le reste de l'interface (un tracé
 *   qui court), dore au survol, et tourne sur elle-même en rétrécissant au clic.
 *   Dépliée : une carte du site où ne figure QUE ce qu'on a déjà parcouru — un
 *   point n'apparaît, et la route qui y mène ne se trace, qu'une fois l'endroit
 *   atteint. Le point où l'on se trouve s'illumine. Cliquer un point déjà visité
 *   y conduit directement.
 *
 * ⚠️ LA BOUSSOLE NE PARAÎT QUE QUAND UNE FLÈCHE PARAÎT, et en même temps qu'elle.
 * C'est la règle posée par l'auteur : tant qu'aucune flèche n'invite à partir,
 * on ne propose pas de raccourci. Techniquement, elle ne s'abonne pas aux scènes
 * — elle écoute les deux signaux qu'ArrowBase émet pour TOUTES les flèches du
 * site (voir ArrowBase.show/hide). Un seul point d'accroche, neuf flèches.
 *
 * ⚠️ LE PIÈGE DU `transform` EN ATTRIBUT — celui du chapitre 4, mot pour mot.
 * Le tracé de la boussole, exporté d'Illustrator, porte `transform="translate(…)"
 * en ATTRIBUT. Une animation CSS écrit la PROPRIÉTÉ `transform`, qui supplante
 * l'attribut : le tracé perdrait son décalage et bondirait hors du cadre dès la
 * première rotation. On emballe donc le tracé dans un <g> qui porte la rotation,
 * pendant que le tracé garde son attribut. Ne jamais animer le tracé lui-même.
 *
 * ⚠️ AUCUN CANVAS ICI, ET C'EST VOLONTAIRE. Le site a trois canvas qui servent
 * de masque, et l'invariant qui les gouverne (repeindre au redimensionnement,
 * cf. TorchSystem.resize) existe parce qu'un canvas effacé ne se voit pas. Du
 * SVG n'a pas ce défaut : on n'en rouvre pas la porte pour une boussole.
 *
 * OÙ SE RÈGLE QUOI
 *   config.js → MAP : l'interrupteur (`active`), la réserve à l'ordinateur,
 *   les libellés d'infobulle, les cadences, la mise en place.
 *   ICI : la GÉOMÉTRIE — c'est un dessin, pas un réglage. Elle est transcrite
 *   de map.svg (viewBox 295×295), dont une copie est versionnée dans
 *   images/carte-source.svg.
 */

import { bus } from '../core/EventBus.js';
import { applyGoldenHover } from '../utils/helpers.js';
import { makeActivatable, markDecorative } from '../utils/a11y.js';
import { isVisited } from '../systems/Journey.js';

/* ═══════════════════════════════════════════════════════════════════════════
   GÉOMÉTRIE — transcrite de map.svg (viewBox 0 0 295 295)
   ───────────────────────────────────────────────────────────────────────────
   Les rayons encodent la hiérarchie, comme dans le dessin : 13 pour le tronc
   commun, 11 pour les chapitres, 9 pour les sous-parties.

   `to` = la scène où mène le point. `null` = destination pas encore ouverte
   (le Carnet de recherche, le cercle V) : elle ne peut donc jamais être
   visitée, donc jamais dessinée — aucun cas particulier à écrire.
   `part` = sous-partie à ouvrir en arrivant (chapitre 2 seulement).
═══════════════════════════════════════════════════════════════════════════ */

const VB       = 287;              // le dessin est carré à 0,02 près
const VB_BOX   = '0 0 287 286.98'; // le viewBox exact de l'export
const CADRE_RX = 8.61;             // rayon des coins, tel qu'exporté

/* Le point du DESSIN qui vient se poser sur le centre de la boussole : le coin
   libre, en haut à gauche, avant la vitrine. C'est lui qui accroche la carte à
   la boussole (voir _buildPanel) — la seule coordonnée du fichier qui ne vienne
   pas de l'export. */
const ANCRE = { x: 48, y: 45 };

const NODES = [
  { id: 'vitrine',       x:  99.34, y:  45,     r: 13,   to: 'vitrine'       },
  { id: 'phrenologie',   x:  99.34, y: 101,     r: 13,   to: 'phrenologie'   },
  { id: 'carnet',        x:  47.34, y: 156,     r: 13,   to: null            },
  { id: 'collaboration', x: 150.34, y: 156,     r: 13,   to: 'collaboration' },
  { id: 'chapitre1',     x: 201.36, y:  61.46,  r: 10.98, to: 'chapitre1'    },
  { id: 'chapitre2',     x: 201.38, y: 107.44,  r: 10.98, to: 'chapitre2'    },
  { id: 'chapitre3',     x: 201.38, y: 156.44,  r: 10.98, to: 'chapitre3'    },
  { id: 'chapitre4',     x: 201.38, y: 205.44,  r: 10.98, to: 'chapitre4'    },
  { id: 'cercle5',       x: 201.38, y: 251.44,  r: 10.98, to: null           },
  { id: 'chp2-136',      x: 239.29, y:  80.13,  r:  9.13, to: 'chapitre2', part: 'invisibilisation' },
  { id: 'chp2-137',      x: 239.14, y: 107.28,  r:  9.13, to: 'chapitre2', part: 'peine-demesuree'  },
  { id: 'chp2-138',      x: 239.14, y: 134.28,  r:  9.13, to: 'chapitre2', part: 'cartel'           },
];

/* Une route se trace quand son point d'ARRIVÉE (`node`) est visité.
   ─────────────────────────────────────────────────────────────────────────────
   ⚠️ TOUTES SONT ÉCRITES DU TRONC VERS LE POINT, et c'est ce qui compte : le
   trait se dessine dans le sens de son `d`. L'export les donne dans les deux
   sens et applique un translate(-28,-17.02) sur les courbes ; celles-là ont été
   retournées et le décalage résorbé dans les coordonnées, pour que le tracé
   parte toujours de là d'où l'on vient.

   ⚠️ Le tronc vertical qui descend de la phrénologie appartient à la route de
   l'espace collaboratif : c'est la seule des deux branches du T qui soit
   atteignable (le Carnet de recherche n'existe pas encore). */
const ROUTES = [
  { node: 'phrenologie',   d: 'M99.34,58 V88'                                                       },
  { node: 'collaboration', d: 'M99.34,114 V156 H137.34'                                             },
  { node: 'carnet',        d: 'M99.34,156 H60.34'                                                   },
  { node: 'chapitre1',     d: 'M150.34,143.39 V69.6 A8.62,8.62 0 0 1 158.96,60.98 H190.4'           },
  { node: 'chapitre2',     d: 'M150.34,142.98 V118.8 A11.82,11.82 0 0 1 162.16,106.98 H190.4'       },
  { node: 'chapitre3',     d: 'M163.34,156 H190.34'                                                 },
  { node: 'chapitre4',     d: 'M150.34,168.98 V193.18 A11.82,11.82 0 0 0 162.16,204.98 H190.4'      },
  { node: 'cercle5',       d: 'M150.34,168.98 V242.38 A8.62,8.62 0 0 0 158.96,250.98 H190.34'       },
  { node: 'chp2-136',      d: 'M201.34,96.44 V88.28 A8.31,8.31 0 0 1 209.64,79.98 H230.16'          },
  { node: 'chp2-137',      d: 'M212.34,107 H230.34'                                                 },
  { node: 'chp2-138',      d: 'M201.34,118.42 V126.7 A8.31,8.31 0 0 0 209.64,135 H230'              },
];

/* Ordre de dessin : on suit le parcours, du premier écran vers les feuilles. */
const ORDRE = NODES.map((n) => n.id);

/* ═══════════════════════════════════════════════════════════════════════════
   LA BOUSSOLE — transcrite de BoussoleMap.svg (export Illustrator)
   ───────────────────────────────────────────────────────────────────────────
   Ce n'est plus UN tracé mais une figure : l'étoile à huit branches, les
   quatre chevrons des points cardinaux, les arcs du limbe, la croisée
   centrale. Chaque forme se dessine à son tour (stroke-dashoffset), dans
   l'ordre de cette liste — c'est cet ordre qui fait courir le tracé.

   `w` = largeur de trait, `c` = bouts arrondis, `tr` = le translate que
   l'export porte EN ATTRIBUT sur certains arcs (voir l'avertissement en tête :
   on ne l'écrase jamais par une animation, la rotation vit sur le <g>).

   ⚠️ L'export contient six <path> réduits à un seul « M » — des points sans
   longueur, invisibles. Ils ne sont pas repris : avec pathLength="1" ils
   n'auraient rien dessiné tout en consommant un temps de la cadence.

   ⚠️ `pathLength` s'applique ici à des <polygon>, <polyline> et <line>, pas
   seulement à des <path> : c'est du SVG 2, bien rendu par les navigateurs
   visés, et c'est ce qui permet de faire courir le tracé sans mesurer
   quoi que ce soit (cf. la leçon getPointAtLength du chapitre 4).
═══════════════════════════════════════════════════════════════════════════ */

const BOUSSOLE_VB = '0 0 99.58 99.58';
const BOUSSOLE_TR = 'translate(-33.75 -32.75)';

const BOUSSOLE = [
  /* L'étoile */
  { t: 'polygon',  p: '49.75 3.33 60.25 38.25 96.17 49.75 60.25 60.25 49.75 96.17 38.25 60.25 3.33 49.75 38.25 38.25 49.75 3.33', w: 2 },
  /* Les quatre chevrons */
  { t: 'polyline', p: '41.7 71.04 23.13 76.55 28.68 57.37', w: 2 },
  { t: 'polyline', p: '70.85 57.15 76.55 76.37 57.17 70.77', w: 2 },
  { t: 'polyline', p: '57.34 28.59 76.37 22.95 70.95 41.68', w: 2 },
  { t: 'polyline', p: '28.39 41.49 22.95 23.13 41.47 28.48', w: 2 },
  /* Le limbe : neuf arcs et le cercle presque fermé */
  { t: 'path', d: 'M61.24,57.19c.59-.52,1.2-1,1.83-1.49a32.74,32.74,0,0,1,13.08-6', w: 1.5, c: 1, tr: 1 },
  { t: 'path', d: 'M50.22,78.17c.1-.84.23-1.67.38-2.49a32.89,32.89,0,0,1,6.1-13.61c.43-.57.88-1.12,1.34-1.66', w: 1.5, tr: 1 },
  { t: 'path', d: 'M58.41,104c-.6-.67-1.17-1.36-1.71-2.08a32.8,32.8,0,0,1-6-12.93', w: 1.5, c: 1, tr: 1 },
  { t: 'path', d: 'M79,114.76a32.88,32.88,0,0,1-16.38-6.83', w: 1.5, c: 1, tr: 1 },
  { t: 'path', d: 'M104.14,107.34a32.88,32.88,0,0,1-16.47,7.33', w: 1.5, c: 1, tr: 1 },
  { t: 'path', d: 'M115.67,86.67a32.84,32.84,0,0,1-7,16', w: 1.5, c: 1, tr: 1 },
  { t: 'path', d: 'M110.32,63.48a33.08,33.08,0,0,1,5.08,12.2q.21,1.13.36,2.28', w: 1.5, c: 1, tr: 1 },
  { t: 'path', d: 'M90.19,49.79a32.63,32.63,0,0,1,12.53,5.75', w: 1.5, c: 1, tr: 1 },
  { t: 'path', d: 'M87.45,37.22a45,45,0,1,1-7.09-.14', w: 1.5, c: 1, tr: 1 },
  /* La croisée centrale */
  { t: 'line', a: [38.25, 38.25, 60.25, 60.25], w: 1, c: 1 },
  { t: 'line', a: [60.25, 38.25, 38.25, 60.25], w: 1, c: 1 },
  { t: 'line', a: [49.25, 96.25, 49.25, 49.25], w: 1, c: 1 },
  { t: 'line', a: [49.25,  3.25, 49.25, 49.25], w: 1, c: 1 },
  { t: 'line', a: [96.25, 49.25, 49.25, 49.25], w: 1, c: 1 },
  { t: 'line', a: [ 3.25, 50.25, 49.25, 49.25], w: 1, c: 1 },
];

const NS = 'http://www.w3.org/2000/svg';

/* Couleurs — celles des flèches, pour que la boussole appartienne à la même
   famille. Le doré du survol vient de helpers.applyGoldenHover. */
const TRAIT      = 'rgba(255,255,255,0.75)';
const TRAIT_MAT  = 'rgba(255,255,255,0.42)';   // routes : plus discrètes que les points
const OR         = 'rgba(255,214,120,0.98)';
const OR_HALO    = 'drop-shadow(0 0 6px rgba(255,200,80,0.85)) drop-shadow(0 0 16px rgba(255,170,30,0.55))';

export class CompassMap {
  /**
   * @param {Object} config       window.CONFIG
   * @param {Function} refSizeFn  taille de référence (celle des flèches)
   */
  constructor(config, refSizeFn) {
    this.config     = config;
    this.refSizeFn  = refSizeFn;
    this.C          = config.MAP;
    this.el         = null;
    this.open       = false;
    this.visible    = false;
    this.drawing    = false;
    this.current    = null;
    this._onJump    = null;
    this._timers    = [];
    this._onKey     = null;
    this._nodeEls   = new Map();
    this._survole   = false;
  }

  /* ── Cycle de vie ─────────────────────────────────────────────────────── */

  /** Le point où le visiteur se trouve (illuminé sur la carte). */
  setCurrent(id) {
    this.current = id;
    if (this.open) this._paintCurrent();
  }

  /** @param {Function} fn  (to, part) => void */
  setOnJump(fn) { this._onJump = fn; }

  /**
   * La carte se referme, POSÉMENT. Appelée par app.js à chaque demande de
   * navigation : on quitte un lieu, la carte se replie — et on lui laisse le
   * temps de le faire. Elle se redessinera pliée avec la flèche suivante.
   *
   * ⚠️ CE REPLI ÉTAIT INSTANTANÉ, et c'était le seul geste brutal de l'objet :
   * au moment précis où la scène commence sa sortie écrite, la carte
   * disparaissait d'un coup. Elle se retire maintenant comme elle est venue,
   * à rebours (voir _fold). Les sorties de scène durent au minimum une
   * seconde : le repli a toujours le temps de se jouer entièrement.
   */
  reset() {
    if (this.open) this._fold();
  }

  /**
   * ÉCLIPSE — s'effacer sans être démontée, le temps d'un média.
   * Même mot, même sens que dans ArrowBase : la boussole suit la flèche.
   *
   * ⚠️ ELLE NE REPARAÎT PAS TOUTE SEULE. `visible` reste vrai : un show()
   * déclenché pendant l'éclipse (la flèche d'une sous-partie qui finit de se
   * dessiner alors qu'on a DÉJÀ ouvert un média) ne la ramène pas à l'écran.
   * C'est ce qui traite le cas « média lancé vite », exactement comme la règle
   * CSS !important qui protège la flèche du chapitre 2.
   */
  eclipse(masquee, ms = 400) {
    if (!this.el) return;
    this._eclipsee = !!masquee;

    if (masquee) {
      if (this.open) this._fold();
      this.el.style.transition = `opacity ${ms}ms ease`;
      this.el.style.opacity = '0';
      this.el.style.pointerEvents = 'none';
      const foc = document.activeElement;
      if (foc && this.el.contains(foc)) foc.blur();
      return;
    }

    if (!this.visible) return;               // la flèche est partie entre-temps
    this.el.style.transition = `opacity ${ms}ms ease`;
    this.el.style.opacity = '1';
    this.el.style.pointerEvents = '';
  }

  /** Dessine la boussole. Appelée quand une flèche paraît. */
  show() {
    // Déjà à l'écran : une nouvelle flèche ne redessine pas la boussole, mais
    // elle change de LIEU — la carte se referme (on entre dans une sous-partie,
    // un média s'ouvre…). Sans cela, un panneau déplié pouvait survivre à un
    // changement d'arrière-plan et flotter au-dessus d'une autre scène.
    if (this._eclipsee) return;              // un média est au premier plan
    if (this.visible) { this.reset(); return; }

    this._clearTimers();       // aucune minuterie d'un cycle précédent ne survit
    this.visible = true;
    this._ensureEl();
    this._layout();

    this.el.innerHTML = '<div class="cm-compass"></div><div class="cm-tip" aria-hidden="true"></div>';
    this.el.querySelector('.cm-compass').appendChild(this._dessinerBoussole());

    this.drawing = true;
    this._addTimer(() => { this.drawing = false; }, this.C.draw_duration);

    this.el.style.transition = 'opacity 1.0s ease';
    this.el.style.opacity = '1';
    this.el.style.pointerEvents = '';
    this.el.classList.add('visible');

    this._attachCompass();
  }

  /**
   * Construit la figure et la met en marche : chaque forme se dessine à son
   * tour, dans l'ordre de BOUSSOLE. La dernière finit à `draw_duration`.
   */
  _dessinerBoussole() {
    const S   = this._size();
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', BOUSSOLE_VB);
    svg.setAttribute('width', S);
    svg.setAttribute('height', S);
    svg.setAttribute('overflow', 'visible');

    // La rotation vit sur ce <g>, JAMAIS sur les tracés : plusieurs d'entre eux
    // portent leur translate en ATTRIBUT (voir l'en-tête du fichier).
    const tour = document.createElementNS(NS, 'g');
    tour.setAttribute('class', 'cm-turn');

    // Le trait court d'une forme à l'autre : chacune met la MOITIÉ du temps
    // total, l'autre moitié étant répartie en retards. La figure se compose
    // ainsi sous l'œil au lieu d'apparaître d'un bloc.
    const duree = this.C.draw_duration * 0.5;
    const pas   = (this.C.draw_duration - duree) / Math.max(1, BOUSSOLE.length - 1);

    BOUSSOLE.forEach((f, i) => {
      const n = document.createElementNS(NS, f.t);
      if (f.t === 'line') {
        n.setAttribute('x1', f.a[0]); n.setAttribute('y1', f.a[1]);
        n.setAttribute('x2', f.a[2]); n.setAttribute('y2', f.a[3]);
      } else if (f.d) {
        n.setAttribute('d', f.d);
      } else {
        n.setAttribute('points', f.p);
      }
      n.setAttribute('class', 'cm-rose');
      n.setAttribute('fill', 'none');
      n.setAttribute('stroke', TRAIT);
      n.setAttribute('stroke-width', f.w);
      n.setAttribute('stroke-linejoin', 'round');
      if (f.c)  n.setAttribute('stroke-linecap', 'round');
      if (f.tr) n.setAttribute('transform', BOUSSOLE_TR);
      n.setAttribute('pathLength', 1);
      n.setAttribute('stroke-dasharray', 1);
      n.setAttribute('stroke-dashoffset', 1);
      n.style.transition = `stroke-dashoffset ${duree}ms cubic-bezier(0.4,0,0.2,1) ${Math.round(i * pas)}ms`;
      tour.appendChild(n);
    });

    svg.appendChild(tour);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      tour.querySelectorAll('.cm-rose').forEach(n => n.setAttribute('stroke-dashoffset', '0'));
    }));
    return svg;
  }

  /**
   * Efface la boussole. Si la carte est ouverte, elle se replie D'ABORD, et le
   * fondu de la boussole ne part qu'ensuite : on ne fait pas disparaître un
   * panneau entier d'un coup d'opacité. Les deux gestes se chevauchent
   * légèrement — c'est un seul mouvement, pas une file d'attente.
   */
  hide() {
    // Un vrai départ l'emporte sur une éclipse : la flèche s'en va pour de bon,
    // il ne doit rester aucun état qui empêche la prochaine apparition.
    this._eclipsee = false;
    if (!this.visible) return;
    this.visible = false;
    if (!this.el) return;

    const attendre = this.open ? this._fold() : 0;
    const ms = this.config.ARROW.hide_duration;

    this._addTimer(() => {
      if (this.visible || !this.el) return;
      this.el.style.transition = `opacity ${ms}ms ease`;
      this.el.style.opacity = '0';
      this.el.classList.remove('visible');

      // Même précaution que dans ArrowBase.hide() : ne pas laisser le focus
      // échoué sur un élément qu'on masque (voir l'avertissement là-bas).
      const foc = document.activeElement;
      if (foc && this.el.contains(foc)) foc.blur();
      this.el.setAttribute('aria-hidden', 'true');

      this._addTimer(() => {
        if (this.visible || !this.el) return;
        this.el.innerHTML = '';
        this._nodeEls.clear();
      }, ms + 20);
    }, Math.round(attendre * 0.55));
  }

  resize() {
    if (!this.visible || !this.el) return;
    const S = this._size();

    /* ⚠️ LA PLACE SE REFAIT TOUJOURS, LE DESSIN NON. Les deux ne dépendent pas
       de la même chose : la place est un POUR CENT du viewport, la taille est
       BORNÉE (ARROW.size_min / size_max). Sur un écran large, où la taille est
       déjà saturée, élargir la fenêtre ne changeait donc rien du tout — la
       garde ci-dessous sortait avant le replacement, et la boussole restait
       sur place pendant que les titres, eux, suivaient leur % en CSS. */
    this._layout();

    if (S === this._lastSize) return;      // même garde qu'ArrowBase
    const etaitOuverte = this.open;
    this._lastSize = S;
    this.visible = false;
    if (this.el) { this.el.innerHTML = ''; this._nodeEls.clear(); }
    this.open = false;
    this.show();
    if (etaitOuverte) this._unfold(true);
  }

  destroy() {
    this._clearTimers();
    if (this._onKey) window.removeEventListener('keydown', this._onKey, true);
    this._onKey = null;
    this.el?.remove();
    this.el = null;
    this._nodeEls.clear();
  }

  /* ── Mise en place ────────────────────────────────────────────────────── */

  _size() {
    return this.refSizeFn();
  }

  _ensureEl() {
    if (this.el && this.el.isConnected) return;
    this.el = document.getElementById('compass-map');
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'compass-map';
      document.getElementById('app')?.appendChild(this.el);
    }
    this.el.removeAttribute('aria-hidden');
  }

  /**
   * LA BOUSSOLE OUVRE LA COLONNE HAUT-GAUCHE, à gauche du titre et du
   * sous-titre. Sa place se lit directement dans la config, en pour cent du
   * viewport : `MAP.gauche_pct` et `MAP.haut_pct` donnent son coin haut-gauche.
   *
   * ⚠️ DEUX RÉGLAGES ET RIEN DE DÉDUIT, C'EST VOULU. La hauteur se calculait
   * naguère depuis la façon dont les titres s'empilent (3,2 % puis 2,6 em) pour
   * centrer la boussole sur leur bloc. C'était juste sur le papier et faux à
   * l'œil : sur les scènes SANS sous-titre — la vitrine, la phrénologie — le
   * bloc reste réservé sur deux lignes et la boussole se posait visiblement
   * plus bas que le titre unique. Un réglage direct se voit et se corrige ;
   * une déduction, non.
   *
   * La place ne dépend d'AUCUN titre réellement affiché : la boussole ne bouge
   * donc jamais d'une scène à l'autre. La carte, elle, s'ancre sur la boussole.
   */
  _layout() {
    const vW = Math.max(this.config.MIN_SIZE.width,  window.innerWidth);
    const vH = Math.max(this.config.MIN_SIZE.height, window.innerHeight);
    const S  = this._size();
    this._lastSize = S;

    Object.assign(this.el.style, {
      left:  Math.round(vW * this.C.gauche_pct / 100) + 'px',
      top:   Math.round(vH * this.C.haut_pct   / 100) + 'px',
      width: S + 'px', height: S + 'px',
    });
  }

  /* ── La boussole : survol, clic ───────────────────────────────────────── */

  _attachCompass() {
    const svg = this.el.querySelector('.cm-compass svg');
    if (!svg) return;

    svg.style.transformOrigin = 'center';
    this._poser(false);

    /* ⚠️ LE SURVOL VAUT AUSSI CARTE OUVERTE. Il était neutralisé (`if (this.open)
       return`), si bien que la petite boussole du coin — le seul moyen de
       refermer la carte à la souris — ne disait plus rien du tout : ni
       grossissement, ni dorure. Un bouton qui ne réagit pas ne se lit pas
       comme un bouton. Elle est donc BLANCHE au repos, dorée et légèrement
       grossie au survol, dans les deux états. */
    this.el.onpointerenter = () => { this._survole = true;  this._survoler(true); };
    this.el.onpointerleave = () => { this._survole = false; this._survoler(false); };

    this.el.onclick = (e) => {
      // Un clic sur un point de la carte ne doit pas replier la carte.
      if (e.target.closest('.cm-node')) return;
      if (this.drawing) return;
      this.open ? this._fold() : this._unfold();
    };

    makeActivatable(this.el, {
      label: this.open ? 'Fermer la carte du parcours' : 'Ouvrir la carte du parcours',
    });
  }

  /** Le survol : dorure + léger grossissement, à la cadence d'un survol. */
  _survoler(dessus) {
    const svg = this.el?.querySelector('.cm-compass svg');
    if (svg) svg.style.transition = 'transform .35s cubic-bezier(0.34,1.56,0.64,1)';
    this._poser(dessus);
    this._dorer(dessus);
  }

  /**
   * Pose la transformation de la boussole : sa place et sa taille découlent de
   * DEUX états seulement — carte ouverte ou non, survolée ou non. Les écrire
   * ici, en un seul endroit, évite les combinaisons contradictoires (ouvrir
   * pendant un survol, replier sans que le curseur ait bougé…).
   */
  _poser(survol) {
    const svg = this.el?.querySelector('.cm-compass svg');
    if (!svg) return;
    const S    = this._size();
    const dx   = this.open ? Math.round(S * (this.C.compass_dx ?? 0)) : 0;
    const dy   = this.open ? Math.round(S * (this.C.compass_dy ?? 0)) : 0;
    const base = this.open ? this.C.compass_open : 1;
    const k    = survol ? base * (this.C.compass_hover ?? 1.18) : base;
    svg.style.transform = `translate(${dx}px, ${dy}px) scale(${k})`;
  }

  /** Dore ou éteint la rose des vents — toutes ses formes. */
  _dorer(oui) {
    const traits = [...(this.el?.querySelectorAll('.cm-rose') ?? [])];
    if (!traits.length) return;
    if (oui) { applyGoldenHover(traits, []); return; }
    traits.forEach((n) => { n.style.stroke = ''; n.style.filter = ''; });
  }

  /* ── Dépliage / repliage ──────────────────────────────────────────────── */

  _unfold(instantane = false) {
    if (this.open) return;
    this.open = true;

    /* LA CARTE PREND LA PLACE DES TITRES. Elle se déplie exactement dans le
       coin où ils s'écrivent : ils s'effacent, et reviennent au repli.
       La carte ne les connaît pas — elle annonce son état, app.js fait le
       rapprochement. Même patron que 'place:media' pour la flèche. */
    bus.emit('carte:ouverte', { ouvert: true });

    const svg  = this.el.querySelector('.cm-compass svg');
    const tour = this.el.querySelector('.cm-turn');
    const S    = this._size();
    const k    = (this.C.panel_scale * S) / VB;

    // La rotation vit sur le <g>, JAMAIS sur le tracé : celui-ci porte son
    // translate en attribut (voir l'en-tête).
    if (tour) {
      tour.style.transformOrigin = '50% 50%';
      tour.style.transition = instantane ? 'none'
        : `transform ${this.C.fold_duration}ms cubic-bezier(0.4,0,0.2,1)`;
      tour.style.transform = `rotate(${this.C.fold_turn}deg)`;
    }
    // La boussole ne fait pas que rétrécir : elle GLISSE vers le coin
    // haut-gauche du cadre pendant qu'elle tourne, et s'y pose comme le fleuron
    // d'une carte ancienne. Place, taille et survol sortent tous de _poser() :
    // une seule propriété animée, une seule cadence, rien à resynchroniser.
    if (svg) {
      svg.style.transition = instantane ? 'none'
        : `transform ${this.C.fold_duration}ms cubic-bezier(0.4,0,0.2,1)`;
    }
    this._poser(this._survole);

    this._buildPanel(k, S, instantane);
    makeActivatable(this.el, { label: 'Fermer la carte du parcours' });

    this._onKey = (e) => {
      if (e.key !== 'Escape' || !this.open) return;
      e.stopPropagation();          // la carte se ferme AVANT tout autre Échap
      this._fold();
    };
    window.addEventListener('keydown', this._onKey, true);
  }

  /**
   * LE REPLI — la carte se retire comme elle est venue, à rebours.
   *
   * Les points s'effacent d'abord, du plus lointain au plus proche (l'ordre du
   * parcours, remonté), puis les routes, puis le cadre : le dessin se DÉ-trace.
   * Pendant ce temps la boussole revient sur elle-même et reprend sa taille.
   * Un simple fondu d'opacité aurait suffi à faire disparaître le panneau —
   * mais faire disparaître n'est pas refermer.
   *
   * @param {boolean} [instantane] sans animation (redimensionnement, démontage)
   * @returns {number} la durée du geste, en ms — hide() s'en sert pour
   *          enchaîner son propre fondu au bon moment.
   */
  _fold(instantane = false) {
    if (!this.open) return 0;
    this.open = false;

    // La place est rendue : le titre et le sous-titre reparaissent, à la
    // cadence du repli (ils ne sont plus recouverts dès que le dé-tracé
    // commence — inutile de les faire attendre la fin du geste).
    bus.emit('carte:ouverte', { ouvert: false });

    if (this._onKey) { window.removeEventListener('keydown', this._onKey, true); this._onKey = null; }
    this._hideTip();

    const svg  = this.el?.querySelector('.cm-compass svg');
    const tour = this.el?.querySelector('.cm-turn');
    if (tour) {
      tour.style.transition = instantane ? 'none'
        : `transform ${this.C.fold_duration}ms cubic-bezier(0.4,0,0.2,1)`;
      tour.style.transform = 'rotate(0deg)';
    }
    if (svg) {
      svg.style.transition = instantane ? 'none'
        : `transform ${this.C.fold_duration}ms cubic-bezier(0.4,0,0.2,1)`;
    }
    this._poser(this._survole);
    // Repliée, elle redevient blanche — sauf si le curseur est encore dessus
    // (c'est le cas juste après un clic de fermeture : le survol reprend ses
    // droits sans qu'aucun pointerenter ne vienne le rappeler).
    this._dorer(!!this._survole);

    const panel = this.el?.querySelector('.cm-panel');
    const parts = this._panelParts;
    this._panelParts = null;
    this._nodeEls.clear();
    if (this.el) makeActivatable(this.el, { label: 'Ouvrir la carte du parcours' });

    if (!panel) return instantane ? 0 : this.C.fold_duration;
    if (instantane) { panel.remove(); return 0; }

    const dur = this.C.fold_out;
    const pas = this.C.fold_stagger;

    /* Le dé-tracé : chaque forme rembobine son propre trait. On remonte
       l'ordre du parcours — les feuilles d'abord, la vitrine en dernier. */
    let rang = 0;
    const effacer = (el) => {
      el.style.transition = `stroke-dashoffset ${dur}ms cubic-bezier(0.4,0,0.2,1) ${rang * pas}ms`;
      el.setAttribute('stroke-dashoffset', '1');
      rang++;
    };
    const aRebours = (liste) => [...liste].sort(
      (a, b) => ORDRE.indexOf(b.node) - ORDRE.indexOf(a.node));

    if (parts) {
      aRebours(parts.points).forEach((p) => effacer(p.el));
      aRebours(parts.routes).forEach((r) => effacer(r.el));
      // Les points s'illuminent par un `fill` : il doit partir avec eux.
      parts.points.forEach((p) => {
        p.el.style.transition += `, fill ${dur}ms ease, filter ${dur}ms ease`;
        p.el.setAttribute('fill', 'none');
        p.el.style.filter = '';
      });
      effacer(parts.cadre);          // le cadre se referme en dernier
    }

    const total = rang * pas + dur;
    // Le panneau ne s'efface pas : il est déjà dé-tracé quand on le retire.
    this._addTimer(() => panel.remove(), total + 60);
    return total;
  }

  /* ── La carte ─────────────────────────────────────────────────────────── */

  _buildPanel(k, S, instantane) {
    const cote = Math.round(this.C.panel_scale * S);

    const panel = document.createElement('div');
    panel.className = 'cm-panel';
    // On place la carte de sorte que le point ANCRE de son dessin — le coin
    // libre, en haut à gauche — tombe sur le CENTRE de la boussole. La
    // boussole devient ainsi l'ornement de la carte sans avoir bougé d'un pixel.
    panel.style.left  = Math.round(S / 2 - ANCRE.x * k) + 'px';
    panel.style.top   = Math.round(S / 2 - ANCRE.y * k) + 'px';
    panel.style.width  = cote + 'px';
    panel.style.height = cote + 'px';

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', VB_BOX);
    svg.setAttribute('width', cote);
    svg.setAttribute('height', cote);
    svg.setAttribute('overflow', 'visible');
    markDecorative(svg);

    /* Cadre. Son fond se règle dans config.js (MAP.fond_opacite) : à 5 % la
       scène reste pleinement visible sous la carte, qui n'est plus un panneau
       posé dessus mais un calque. La lisibilité des traits ne tient alors plus
       au fond mais à l'ombre portée (style.css → .cm-panel svg). */
    const opacite = this.C.fond_opacite;
    if (opacite == null) console.warn('[CompassMap] MAP.fond_opacite absent : fond transparent.');
    const cadre = document.createElementNS(NS, 'rect');
    Object.entries({
      x: 1, y: 1, width: VB - 2, height: VB - 2.02, rx: CADRE_RX,
      fill: `rgba(8,7,6,${opacite ?? 0})`, stroke: TRAIT_MAT, 'stroke-width': 1.6,
      pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': instantane ? 0 : 1,
    }).forEach(([k2, v]) => cadre.setAttribute(k2, v));
    svg.appendChild(cadre);

    /* Routes — uniquement celles dont le point d'arrivée est visité */
    const routes = [];
    ROUTES.forEach((r) => {
      if (!isVisited(r.node)) return;
      const p = document.createElementNS(NS, 'path');
      Object.entries({
        d: r.d, fill: 'none', stroke: TRAIT_MAT, 'stroke-width': 1.6,
        'stroke-linecap': 'round',
        pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': instantane ? 0 : 1,
      }).forEach(([k2, v]) => p.setAttribute(k2, v));
      svg.appendChild(p);
      routes.push({ el: p, node: r.node });
    });

    /* Points — uniquement les visités */
    const points = [];
    NODES.forEach((n) => {
      if (!isVisited(n.id)) return;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'cm-node');
      g.dataset.id = n.id;

      const halo = document.createElementNS(NS, 'circle');
      Object.entries({ cx: n.x, cy: n.y, r: n.r, fill: 'rgba(0,0,0,0.01)' })
        .forEach(([k2, v]) => halo.setAttribute(k2, v));

      const c = document.createElementNS(NS, 'circle');
      Object.entries({
        cx: n.x, cy: n.y, r: n.r, fill: 'none', stroke: TRAIT, 'stroke-width': 2,
        pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': instantane ? 0 : 1,
      }).forEach(([k2, v]) => c.setAttribute(k2, v));

      g.appendChild(halo);
      g.appendChild(c);
      svg.appendChild(g);
      points.push({ el: g, cercle: c, node: n });
      this._nodeEls.set(n.id, { g, c, n });
      this._wireNode(g, c, n, panel);
    });

    panel.appendChild(svg);
    this.el.appendChild(panel);

    // Gardées pour le repli : c'est le même dessin qu'on rembobine (voir _fold).
    this._panelParts = {
      cadre,
      routes,
      points: points.map((p) => ({ el: p.cercle, node: p.node.id })),
    };

    if (!instantane) this._drawPanel(cadre, routes, points);
    this._paintCurrent();
  }

  /** Le dessin court : le cadre, puis les routes et les points, dans l'ordre
      du parcours — la carte se raconte comme on l'a vécue. */
  _drawPanel(cadre, routes, points) {
    cadre.style.transition = `stroke-dashoffset ${this.C.panel_frame}ms cubic-bezier(0.4,0,0.2,1)`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      cadre.setAttribute('stroke-dashoffset', '0');
    }));

    const rang = (id) => Math.max(0, ORDRE.indexOf(id));
    const tard = (el, i, dur) => {
      el.style.transition = `stroke-dashoffset ${dur}ms cubic-bezier(0.4,0,0.2,1) ${
        this.C.panel_frame * 0.6 + i * this.C.panel_stagger}ms`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.setAttribute('stroke-dashoffset', '0');
      }));
    };

    routes.forEach((r) => tard(r.el, rang(r.node), this.C.panel_route));
    points.forEach((p) => tard(p.cercle, rang(p.node.id), this.C.panel_route));
  }

  /**
   * Illumine le point courant, ÉTEINT LES AUTRES.
   *
   * ⚠️ ÉCRIT LE MÊME CANAL QUE LE SURVOL, et c'est tout le correctif. Cette
   * méthode posait `setAttribute('stroke', …)` quand applyGoldenHover écrit
   * `style.stroke` : un style en ligne bat toujours un attribut, si bien que
   * remettre l'attribut à blanc ne rendait RIEN — les points survolés
   * restaient dorés pour de bon, et la carte finissait toute allumée. On
   * repasse donc par le style, et `''` rend la main à l'attribut d'origine
   * (TRAIT), posé une fois à la construction. C'est le même piège que celui
   * du curseur documenté dans CLAUDE.md.
   */
  _paintCurrent() {
    this._nodeEls.forEach(({ c }, id) => {
      const ici = id === this.current;
      c.style.stroke = ici ? OR : '';
      c.style.filter = ici ? OR_HALO : '';
      c.setAttribute('fill', ici ? 'rgba(255,205,95,0.16)' : 'none');
    });
  }

  /* ── Un point : survol, infobulle, clic ───────────────────────────────── */

  _wireNode(g, c, n, panel) {
    const libelle = this.C.labels?.[n.id];
    if (!libelle) console.warn(`[CompassMap] MAP.labels.${n.id} absent : point sans nom.`);

    const ici = () => n.id === this.current;

    g.addEventListener('pointerenter', () => {
      if (!ici()) { applyGoldenHover([c], []); }
      c.setAttribute('r', n.r * 1.18);
      this._showTip(libelle, panel);
    });
    g.addEventListener('pointerleave', () => {
      c.setAttribute('r', n.r);
      this._paintCurrent();
      this._hideTip();
    });

    g.addEventListener('click', (e) => {
      e.stopPropagation();                 // ne pas replier la carte
      if (ici()) { this._fold(); return; } // on y est déjà : la carte se referme
      if (!n.to) return;                   // destination pas encore ouverte
      this._fold();
      this._onJump?.(n.to, n.part ?? null);
    });

    makeActivatable(g, { label: libelle ? `Aller à : ${libelle}` : 'Point du parcours' });
  }

  _showTip(texte, panel) {
    const tip = this.el?.querySelector('.cm-tip');
    if (!tip || !texte) return;

    const f = this.config.FONTS?.title;
    if (f) {
      const vW = Math.max(this.config.MIN_SIZE.width, window.innerWidth);
      tip.style.fontFamily    = f.family;
      tip.style.fontSize      = Math.max(9, Math.min(13, Math.round(vW * 0.62 / 100))) + 'px';
      tip.style.letterSpacing = '0.14em';
    }
    tip.textContent = texte;

    /* Position : SOUS la carte, CENTRÉE sur elle et large comme elle. Une
       légende de planche, exactement — elle ne bouge pas d'un point à l'autre,
       seul le mot change, et un nom long passe à la ligne au lieu de dépasser
       le bord droit du cadre (« III · La Galerie des Batailles » débordait de
       près de la moitié de la largeur).
       ─────────────────────────────────────────────────────────────────
       Trois placements écartés, et il vaut mieux dire pourquoi.
       · « à côté du point » : pour les deux colonnes de droite (chapitres et
         sous-parties), le texte recouvrait le dessin qu'il commente.
       · « à gauche quand le point est à droite » : lisible, mais l'infobulle
         SAUTAIT d'un bord à l'autre au fil du survol — et pour les points les
         plus à droite elle sortait de l'écran.
       · « en colonne à droite du cadre » : ne débordait pas, mais poussait la
         lecture hors de la carte et déplaçait le regard verticalement à chaque
         survol. Sous le cadre, l'œil revient toujours au même endroit.
       (Le point survolé ne sert donc plus au placement : la légende est fixe.
        C'est ce qui a permis de retirer `n` et `k` de la signature.) */
    const cote = parseFloat(panel.style.width);

    tip.style.right = 'auto';
    tip.style.left  = Math.round(parseFloat(panel.style.left)) + 'px';
    tip.style.top   = Math.round(parseFloat(panel.style.top) + cote + 14) + 'px';
    tip.style.width = Math.round(cote) + 'px';

    tip.style.transition = `opacity ${this.C.tooltip_fade}ms ease, transform ${this.C.tooltip_fade}ms cubic-bezier(0.25,0.46,0.45,0.94)`;
    requestAnimationFrame(() => tip.classList.add('visible'));
  }

  _hideTip() {
    this.el?.querySelector('.cm-tip')?.classList.remove('visible');
  }

  /* ── Minuteries nettoyables ───────────────────────────────────────────── */

  /** Purge les minuteries en vol (repli différé, effacement du DOM, fin de
      dessin). Sans cela, une minuterie née avant un changement de scène venait
      agir sur le cycle suivant. */
  _clearTimers() {
    this._timers.forEach(clearTimeout);
    this._timers = [];
  }

  _addTimer(fn, ms) {
    const id = setTimeout(() => {
      this._timers = this._timers.filter((t) => t !== id);
      fn();
    }, ms);
    this._timers.push(id);
    return id;
  }
}
