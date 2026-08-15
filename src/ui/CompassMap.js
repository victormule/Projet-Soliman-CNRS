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

const VB = 295;

const NODES = [
  { id: 'vitrine',       x: 102, y:  47,   r: 13, to: 'vitrine'       },
  { id: 'phrenologie',   x: 102, y: 103,   r: 13, to: 'phrenologie'   },
  { id: 'carnet',        x:  50, y: 158,   r: 13, to: null            },
  { id: 'collaboration', x: 153, y: 158,   r: 13, to: 'collaboration' },
  { id: 'chapitre1',     x: 204, y:  63,   r: 11, to: 'chapitre1'     },
  { id: 'chapitre2',     x: 204, y: 109,   r: 11, to: 'chapitre2'     },
  { id: 'chapitre3',     x: 204, y: 158,   r: 11, to: 'chapitre3'     },
  { id: 'chapitre4',     x: 204, y: 207,   r: 11, to: 'chapitre4'     },
  { id: 'cercle5',       x: 204, y: 253,   r: 11, to: null            },
  { id: 'chp2-136',      x: 242, y:  82,   r:  9, to: 'chapitre2', part: 'invisibilisation'  },
  { id: 'chp2-137',      x: 242, y: 109,   r:  9, to: 'chapitre2', part: 'peine-demesuree' },
  { id: 'chp2-138',      x: 242, y: 136,   r:  9, to: 'chapitre2', part: 'cartel'          },
];

/* Une route se trace quand son point d'ARRIVÉE (`node`) est visité. Le tronc
   vertical qui descend de la phrénologie appartient à la route de l'espace
   collaboratif : c'est la seule des deux branches du T qui soit atteignable. */
const ROUTES = [
  { node: 'phrenologie',   d: 'M102,60 V90'                                              },
  { node: 'collaboration', d: 'M102,116 V158 H140'                                       },
  { node: 'carnet',        d: 'M102,158 H63'                                             },
  { node: 'chapitre1',     d: 'M153,145 V71.62 A8.62,8.62 0 0 1 161.62,63 H193'          },
  { node: 'chapitre2',     d: 'M153,145 V120.82 A11.82,11.82 0 0 1 164.82,109 H193'      },
  { node: 'chapitre3',     d: 'M166,158 H193'                                            },
  { node: 'chapitre4',     d: 'M153,171 V195.18 A11.82,11.82 0 0 0 164.86,207 H193'      },
  { node: 'cercle5',       d: 'M153,171 V244.38 A8.62,8.62 0 0 0 161.66,253 H193'        },
  { node: 'chp2-136',      d: 'M204,98.47 V90.3 A8.31,8.31 0 0 1 212.3,82 H232.8'        },
  { node: 'chp2-137',      d: 'M215,109 H233'                                            },
  { node: 'chp2-138',      d: 'M204,120.42 V128.7 A8.3,8.3 0 0 0 212.34,137 H232.8'      },
];

/* Ordre de dessin : on suit le parcours, du premier écran vers les feuilles. */
const ORDRE = NODES.map((n) => n.id);

/* Tracé de la boussole — export Illustrator (images/boussole-source.svg),
   viewBox 93 × 93.17, tracés OUVERTS (fill:none) : il se dessine donc au
   stroke-dashoffset comme les flèches. Son `transform` reste un ATTRIBUT
   (voir l'avertissement en tête de fichier). */
const BOUSSOLE_VB = '0 0 93 93.17';
const BOUSSOLE_TR = 'translate(-36.96 -35.84)';
const BOUSSOLE_D = 'M38,37a3.18,3.18,0,0,1,.71-.17M84.21,37A15.84,15.84,0,0,1,85,38.87c.8,3,1.56,6,2.32,9a.86.86,0,0,0,.81.77,32.09,32.09,0,0,1,10.08,3c1.25.61,2.46,1.31,3.66,2a1.37,1.37,0,0,1,.66,1.75,1.32,1.32,0,0,1-1.46.92,2.67,2.67,0,0,1-1.14-.46,31.69,31.69,0,0,0-8.12-3.53c-1.1-.31-2.22-.51-3.51-.8L91.55,64.2c.37-.17.64-.28.9-.41L106.76,57c.74-.36,1.48-.57,2.13.11s.4,1.35.06,2.06c-1.14,2.38-2.26,4.77-3.39,7.16l-3.8,8,12.58,3.27a2.23,2.23,0,0,0,0-.46c-.62-2.16-1.1-4.37-1.9-6.46a55.67,55.67,0,0,0-2.64-5.23,1.47,1.47,0,0,1,1-2.31,1.61,1.61,0,0,1,1.57,1,34.32,34.32,0,0,1,4.67,11.65c.18.89.11,2,.65,2.59s1.69.56,2.58.79l2.53.65c-.48-2.61-.78-5-1.38-7.31A39.37,39.37,0,0,0,93.76,44.63c-.83-.23-1.68-.41-2.48-.7a1.26,1.26,0,0,1-.83-1.58,1.28,1.28,0,0,1,1.39-1.11,3.58,3.58,0,0,1,.8.1,41.71,41.71,0,0,1,15.23,6.81,41.27,41.27,0,0,1,16.27,23.31c.79,3,1.16,6,1.75,9.2.87.42,2.29.22,3.07,1.4v1.07c-.78,1.21-2.26,1-3.32,1.53-1.15,22.35-19.43,39.51-40.15,40.23L84.26,128H82.48l-1.23-3.12C59.93,124,42,106.19,41.08,84.72L38,83.49V81.71l3.16-1.25c.07-.83.13-1.75.24-2.66a25.27,25.27,0,0,1,.39-2.73c3.56-16.71,13.51-27.69,29.7-33a25.67,25.67,0,0,1,2.84-.72,1.44,1.44,0,0,1,1.76,1,1.41,1.41,0,0,1-1,1.76,7.26,7.26,0,0,1-.94.27,39.32,39.32,0,0,0-29.6,31.83c-.2,1.18-.29,2.37-.44,3.67,1.69-.43,3.19-.79,4.66-1.22a1.1,1.1,0,0,0,.56-.75,34,34,0,0,1,8-17.64,1.29,1.29,0,0,0,.28-1.48,1.87,1.87,0,0,1,.3-1.59,1.68,1.68,0,0,1,1.5-.3,1.33,1.33,0,0,0,1.63-.33,33.65,33.65,0,0,1,17.41-7.9,1,1,0,0,0,1-.88c.73-3,1.5-5.92,2.3-8.86A16.83,16.83,0,0,1,82.53,37m3.65,84.74c19.65-1,35.64-17.89,36.35-36.35-1.57.41-3.12.78-4.65,1.22-.21.07-.41.45-.48.72-.4,1.73-.67,3.5-1.17,5.2a33.25,33.25,0,0,1-6.89,12.52c-.32.37-.61.68-.28,1.24a1.36,1.36,0,0,1-.21,1.79,1.45,1.45,0,0,1-1.81.19.87.87,0,0,0-1.09.18c-1.36,1.06-2.69,2.16-4.13,3.09a34,34,0,0,1-13.73,5.08,1,1,0,0,0-.7.5C87,118.63,86.59,120.16,86.18,121.75ZM44.24,85.41c.24,8.09,4.18,19.28,13.85,27.36a38.68,38.68,0,0,0,22.5,9.06c-.44-1.69-.8-3.22-1.24-4.72-.06-.21-.44-.42-.71-.48-1.73-.41-3.5-.67-5.19-1.17a33.48,33.48,0,0,1-12.53-6.88c-.32-.28-.59-.65-1.14-.34a1.47,1.47,0,0,1-1.89-.15,1.63,1.63,0,0,1-.21-1.9,1.13,1.13,0,0,0-.13-.91c-.49-.7-1.09-1.33-1.61-2a34.58,34.58,0,0,1-6.6-15.92,1.1,1.1,0,0,0-.56-.74C47.31,86.16,45.81,85.81,44.24,85.41Zm39.19-5c.3-.28.52-.47.72-.67,2-2,4-4.08,6.12-6.08a1.32,1.32,0,0,0,.38-1.47q-3.5-13.36-7-26.73c-.06-.23-.15-.44-.27-.79Zm-2.21,2.12-.69-.74c-2-2-4-4-6-6a1.49,1.49,0,0,0-1.68-.48C67,76.9,61.14,78.41,55.27,79.94l-9.69,2.51,0,.1Zm39.94.19,0-.08H85.54c.28.3.47.52.67.72,2,2,4.05,4,6,6.05a1.44,1.44,0,0,0,1.62.42c5.9-1.55,11.81-3.07,17.71-4.61Zm-37.82,2C81,87,78.81,89.26,76.58,91.42a1.48,1.48,0,0,0-.45,1.69c1.73,6.55,3.42,13.12,5.12,19.68l2,7.61.11,0ZM75.19,101l-12.07,5.7a31.24,31.24,0,0,0,15.35,7ZM114.42,87.5l-12.67,3.28c1.92,4.06,3.79,8,5.72,12.07A31.31,31.31,0,0,0,114.42,87.5Zm-62.11,0a31.4,31.4,0,0,0,7,15.34L65,90.78ZM91.56,101l-3.28,12.67a31.41,31.41,0,0,0,15.34-7ZM65,74.41,59.34,62.46C56.23,65.34,52,74.78,52.52,77.65ZM78.47,51.54a31.46,31.46,0,0,0-15.32,7l12,5.69ZM73.16,72l1.28-5L62.67,61.51ZM98.9,73.67c1.91-4.06,3.79-8,5.36-11.35L94.12,72.43ZM67.85,91.53l-5.36,11.35L72.62,92.76Zm35.79,11.94L93.53,93.35l-1.22,4.77Z';

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
  }

  /* ── Cycle de vie ─────────────────────────────────────────────────────── */

  /** Le point où le visiteur se trouve (illuminé sur la carte). */
  setCurrent(id) {
    this.current = id;
    if (this.open) this._paintCurrent();
  }

  /** @param {Function} fn  (to, part) => void */
  setOnJump(fn) { this._onJump = fn; }

  /** Dessine la boussole. Appelée quand une flèche paraît. */
  show() {
    if (this.visible) return;
    this.visible = true;
    this._ensureEl();
    this._layout();

    const S = this._size();
    this.el.innerHTML = `
      <div class="cm-compass">
        <svg viewBox="${BOUSSOLE_VB}" width="${S}" height="${S}" overflow="visible">
          <g class="cm-turn">
            <path class="cm-rose" d="${BOUSSOLE_D}" transform="${BOUSSOLE_TR}"
                  fill="none" stroke="${TRAIT}" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"
                  pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
          </g>
        </svg>
      </div>
      <div class="cm-tip" aria-hidden="true"></div>`;

    const rose = this.el.querySelector('.cm-rose');
    // pathLength="1" : le tracé se dessine en unités normalisées, sans avoir à
    // mesurer sa longueur réelle (getTotalLength est linéaire, et ce tracé est
    // long — cf. la leçon du chapitre 4 sur getPointAtLength).
    rose.style.transition = `stroke-dashoffset ${this.C.draw_duration}ms cubic-bezier(0.4,0,0.2,1)`;

    this.drawing = true;
    this._addTimer(() => { this.drawing = false; }, this.C.draw_duration);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      rose.setAttribute('stroke-dashoffset', '0');
    }));

    this.el.style.transition = 'opacity 1.0s ease';
    this.el.style.opacity = '1';
    this.el.classList.add('visible');

    this._attachCompass();
  }

  /** Efface la boussole (et referme la carte si elle est ouverte). */
  hide() {
    if (!this.visible) return;
    this.visible = false;
    if (this.open) this._fold(true);

    const ms = this.config.ARROW.hide_duration;
    if (!this.el) return;
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
  }

  resize() {
    if (!this.visible || !this.el) return;
    const S = this._size();
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
    this._timers.forEach(clearTimeout);
    this._timers = [];
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
   * Position : colonne des TITRES (et non celle de la flèche), parce que la
   * boussole s'empile visuellement sous eux — un décalage de quelques pixels
   * entre trois éléments alignés verticalement se lit comme une erreur.
   * Hauteur : sous les trois niveaux de titre, dont la place est RÉSERVÉE
   * qu'ils soient affichés ou non. La boussole ne bouge donc jamais d'une
   * scène à l'autre, comme demandé.
   */
  _layout() {
    const vW = Math.max(this.config.MIN_SIZE.width,  window.innerWidth);
    const vH = Math.max(this.config.MIN_SIZE.height, window.innerHeight);
    const S  = this._size();
    this._lastSize = S;

    // Police du sous-titre : c'est l'unité dans laquelle les titres s'empilent
    // (style.css : top: calc(3.2% + 2.6em) et + 5.0em, en em de CETTE police).
    const f  = this.config.FONTS?.subtitle;
    const sf = f ? Math.max(f.size_min, Math.min(f.size_max, Math.round(vW * f.size_vw / 100))) : 11;

    const top  = Math.round(vH * 0.032 + sf * this.C.sous_titres_em);
    const left = Math.round(vW * this.C.left_pct / 100);

    Object.assign(this.el.style, {
      left: left + 'px', top: top + 'px',
      width: S + 'px', height: S + 'px',
    });
  }

  /* ── La boussole : survol, clic ───────────────────────────────────────── */

  _attachCompass() {
    const svg  = this.el.querySelector('.cm-compass svg');
    const rose = this.el.querySelector('.cm-rose');
    if (!svg || !rose) return;

    svg.style.transition = 'transform .35s cubic-bezier(0.34,1.56,0.64,1)';
    svg.style.transformOrigin = 'center';

    const dedans = () => {
      if (this.open) return;
      svg.style.transform = 'scale(1.18)';
      applyGoldenHover([rose], []);
    };
    const dehors = () => {
      if (this.open) return;
      svg.style.transform = 'scale(1)';
      rose.style.stroke = TRAIT;
      rose.style.filter = '';
    };
    this.el.onpointerenter = dedans;
    this.el.onpointerleave = dehors;

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

  /* ── Dépliage / repliage ──────────────────────────────────────────────── */

  _unfold(instantane = false) {
    if (this.open) return;
    this.open = true;

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
    if (svg) {
      svg.style.transition = instantane ? 'none'
        : `transform ${this.C.fold_duration}ms cubic-bezier(0.4,0,0.2,1)`;
      svg.style.transform = `scale(${this.C.compass_open})`;
    }

    this._buildPanel(k, S, instantane);
    makeActivatable(this.el, { label: 'Fermer la carte du parcours' });

    this._onKey = (e) => {
      if (e.key !== 'Escape' || !this.open) return;
      e.stopPropagation();          // la carte se ferme AVANT tout autre Échap
      this._fold();
    };
    window.addEventListener('keydown', this._onKey, true);
  }

  _fold(instantane = false) {
    if (!this.open) return;
    this.open = false;

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
      svg.style.transform = 'scale(1)';
    }

    const panel = this.el?.querySelector('.cm-panel');
    if (panel) {
      if (instantane) { panel.remove(); }
      else {
        panel.style.transition = `opacity ${this.C.fold_duration}ms ease`;
        panel.style.opacity = '0';
        this._addTimer(() => panel.remove(), this.C.fold_duration + 40);
      }
    }
    this._nodeEls.clear();
    if (this.el) makeActivatable(this.el, { label: 'Ouvrir la carte du parcours' });
  }

  /* ── La carte ─────────────────────────────────────────────────────────── */

  _buildPanel(k, S, instantane) {
    const cote = Math.round(this.C.panel_scale * S);

    const panel = document.createElement('div');
    panel.className = 'cm-panel';
    // On place la carte de sorte que le point (50,47) de son dessin — le coin
    // libre, en haut à gauche — tombe sur le CENTRE de la boussole. La
    // boussole devient ainsi l'ornement de la carte sans avoir bougé d'un pixel.
    panel.style.left  = Math.round(S / 2 - 50 * k) + 'px';
    panel.style.top   = Math.round(S / 2 - 47 * k) + 'px';
    panel.style.width  = cote + 'px';
    panel.style.height = cote + 'px';

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${VB} ${VB}`);
    svg.setAttribute('width', cote);
    svg.setAttribute('height', cote);
    svg.setAttribute('overflow', 'visible');
    markDecorative(svg);

    /* Cadre */
    const cadre = document.createElementNS(NS, 'rect');
    Object.entries({
      x: 1, y: 1, width: VB - 2, height: VB - 2, rx: 21,
      fill: 'rgba(8,7,6,0.82)', stroke: TRAIT_MAT, 'stroke-width': 1.6,
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
      this._wireNode(g, c, n, k, panel);
    });

    panel.appendChild(svg);
    this.el.appendChild(panel);

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

  /** Illumine le point courant, éteint les autres. */
  _paintCurrent() {
    this._nodeEls.forEach(({ c, n }, id) => {
      const ici = id === this.current;
      c.setAttribute('stroke', ici ? OR : TRAIT);
      c.setAttribute('fill', ici ? 'rgba(255,205,95,0.16)' : 'none');
      c.style.filter = ici ? OR_HALO : '';
    });
  }

  /* ── Un point : survol, infobulle, clic ───────────────────────────────── */

  _wireNode(g, c, n, k, panel) {
    const libelle = this.C.labels?.[n.id];
    if (!libelle) console.warn(`[CompassMap] MAP.labels.${n.id} absent : point sans nom.`);

    const ici = () => n.id === this.current;

    g.addEventListener('pointerenter', () => {
      if (!ici()) { applyGoldenHover([c], []); }
      c.setAttribute('r', n.r * 1.18);
      this._showTip(libelle, n, k, panel);
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

  _showTip(texte, n, k, panel) {
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

    /* Position : TOUJOURS à droite de la carte, à la hauteur du point.
       ─────────────────────────────────────────────────────────────────
       Deux essais écartés, et il vaut mieux dire pourquoi.
       · « à côté du point » : pour les deux colonnes de droite (chapitres et
         sous-parties), le texte recouvrait le dessin qu'il commente.
       · « à gauche quand le point est à droite » : lisible, mais l'infobulle
         SAUTAIT d'un bord à l'autre au fil du survol — et pour les points les
         plus à droite elle sortait de l'écran (le calcul du décalage prenait
         la largeur de la carte au lieu de celle du conteneur, qui vaut la
         taille de la boussole).
       En colonne fixe, elle se lit comme une légende : elle ne bouge que
       verticalement, ne recouvre rien, et ne peut pas déborder. */
    const py   = parseFloat(panel.style.top) + n.y * k;
    const cote = parseFloat(panel.style.width);

    tip.style.right = 'auto';
    tip.style.top   = Math.round(py) + 'px';
    tip.style.left  = Math.round(parseFloat(panel.style.left) + cote + 12) + 'px';

    tip.style.transition = `opacity ${this.C.tooltip_fade}ms ease, transform ${this.C.tooltip_fade}ms cubic-bezier(0.25,0.46,0.45,0.94)`;
    requestAnimationFrame(() => tip.classList.add('visible'));
  }

  _hideTip() {
    this.el?.querySelector('.cm-tip')?.classList.remove('visible');
  }

  /* ── Minuteries nettoyables ───────────────────────────────────────────── */

  _addTimer(fn, ms) {
    const id = setTimeout(() => {
      this._timers = this._timers.filter((t) => t !== id);
      fn();
    }, ms);
    this._timers.push(id);
    return id;
  }
}
