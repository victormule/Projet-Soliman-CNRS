/**
 * chp2-opening.js — Logique du travelling panoramique.
 *
 * ADAPTATION SPA (v2) — intégration dans Soliman-1.0 :
 *   - Les getElementById() utilisent des IDs préfixés "chp2-" pour éviter
 *     toute collision avec le DOM du projet principal.
 *   - La navigation externe (window.location.href) est remplacée par un
 *     CustomEvent 'chp2:navigate-back' capté par Chapitre2Scene.js.
 *   - Le bloc BFCache (pageshow/reload) est retiré : sans navigation réelle,
 *     il n'a pas de sens dans un contexte SPA.
 *   - Le chemin audio est absolu depuis la racine serveur.
 *   - Le LightSystem est monté sur #chp2-shake (au lieu de #shake).
 *   - Deux exports publics : startChapitre2() / stopChapitre2()
 *     appelés par Chapitre2Scene.enter() / exit().
 *
 * PATTERN FACTORY (Phase 2) : aucun effet de bord au chargement du module.
 * Tout le setup (refs DOM, listeners, boucles rAF, LightSystem) vit dans
 * init(), appelé par startChapitre2() contre le DOM fraîchement injecté ;
 * stopChapitre2() défait tout et réarme init(). Le module est importé UNE
 * fois (plus de cache-bust ?v=Date.now()) et se ré-initialise à chaque visite.
 */

"use strict";

import { markVisited, computeUnlocked } from './chp2-progress.js';
import { CONFIG } from './chp2-config.js';
import * as Blackout from '../../src/core/Blackout.js';

/* =============================================================================
   OSCILLATEURS
============================================================================= */
var O = {
  dx:   { freq: 0.23,  amp: 1,     phase: 0.0  },
  dy:   { freq: 0.17,  amp: 1,     phase: 1.1  },
  b1:   { freq: 0.41,  amp: 0.045, phase: 0.3  },
  b2:   { freq: 0.67,  amp: 0.028, phase: 2.1  },
  f1:   { freq: 2.1,   amp: 0.018, phase: 0.7  },
  f2:   { freq: 3.3,   amp: 0.012, phase: 1.5  },
  f3:   { freq: 5.7,   amp: 0.007, phase: 0.9  },
  f4:   { freq: 7.9,   amp: 0.004, phase: 2.8  },
  w:    { freq: 1.1,   amp: 1,     phase: 0.4  },
  shx1: { freq: 0.18,  amp: 1,     phase: 0.6  },
  shx2: { freq: 0.42,  amp: 1,     phase: 1.9  },
  shx3: { freq: 0.75,  amp: 1,     phase: 0.2  },
  shy1: { freq: 0.16,  amp: 1,     phase: 2.4  },
  shy2: { freq: 0.38,  amp: 1,     phase: 0.8  },
  shy3: { freq: 0.68,  amp: 1,     phase: 3.1  }
};

function osc(o, t) {
  return Math.sin(t * 0.001 * o.freq * Math.PI * 2 + o.phase) * o.amp;
}

/* =============================================================================
   LIGHT SYSTEM — multi-lumières « bougie » sur un seul canvas
   ─────────────────────────────────────────────────────────────────────────────
   v3 (multi) : au lieu d'une lumière figée au centre, le système gère N lumières
   indépendantes, chacune attachée à un crâne. Chaque frame :
     1. on remplit le canvas en noir ;
     2. pour chaque lumière ALLUMÉE, on perce un « trou » (destination-out) qui
        révèle le panorama de base au point du crâne ;
     3. pour chaque lumière allumée, on ajoute un halo chaud (source-over).
   Le noir de base tient lieu de vignette : aucun gradient plein-canvas par
   lumière (qui re-noircirait les pools voisins). Chaque lumière porte son propre
   rayon/opacité animables et un déphasage de scintillement.

   POSITIONNEMENT : le canvas est posé sur #chp2-shake (130 %, décalé -15 %/-15 %)
   et NE subit PAS le translateX du travelling. Chaque lumière fournit donc un
   `getCenter()` renvoyant la position VIEWPORT live de son crâne (currentX inclus),
   que l'on convertit en coordonnées canvas via `_viewportToCanvas()`.
============================================================================= */
function LightSystem(mountId) {
  this.mount   = document.getElementById(mountId) || document.body;
  this.canvas  = null;
  this.ctx     = null;
  this.raf     = null;
  this.visible = false;
  this.lights  = [];          // { id, getCenter, frac, opacity, phaseMs }
  this._anims  = {};          // id -> rafId (tween par lumière)
  var self = this;
  this._resizeBound = function() { self.resize(); };
  this._ensureCanvas();
  this.resize();
  window.addEventListener('resize', this._resizeBound, { passive: true });
  this._startLoop();
}

LightSystem.prototype._ensureCanvas = function() {
  if (this.canvas) return;
  var c = document.createElement('canvas');
  c.style.cssText = [
    'position:absolute',
    'top:-15%',
    'left:-15%',
    'width:130%',
    'height:130%',
    'z-index:2',
    'pointer-events:none',
    'opacity:0',
    'display:none',
    'transition:opacity 220ms ease'
  ].join(';');
  this.mount.appendChild(c);
  this.canvas = c;
  this.ctx = c.getContext('2d');
};

LightSystem.prototype._vW  = function() { return Math.max(320, window.innerWidth); };
LightSystem.prototype._vH  = function() { return Math.max(240, window.innerHeight); };
LightSystem.prototype._min = function() {
  return Math.min(window.innerWidth, window.innerHeight);
};

LightSystem.prototype.resize = function() {
  if (!this.canvas) return;
  var w = this._vW() * 1.3;
  var h = this._vH() * 1.3;
  this.canvas.width        = w;
  this.canvas.style.width  = w + 'px';
  this.canvas.height       = h;
  this.canvas.style.height = h + 'px';
  // ⚠️ Écrire canvas.width vient d'EFFACER ce canvas — et ce canvas EST le noir
  // du chapitre. Le repeindre ICI, dans le même tour, n'est pas une précaution :
  // c'est ce qui rend sûr le saut de rendu de _startLoop (plus bas), lequel
  // refuse de repeindre tant qu'une sous-partie couvre l'écran.
  //
  // Sans cette ligne, un redimensionnement pendant une sous-partie — bascule
  // plein écran (le bouton reste cliquable), rotation, ou simplement la barre
  // d'URL du téléphone qui se rétracte — laissait le canvas VIDE jusqu'au
  // retour. Mesuré au banc : le panorama restait à nu 1,4 s pendant que la
  // sous-partie s'effaçait, puis le noir retombait d'un bloc à 2,16 s. C'était
  // le « saut d'affichage de l'image de l'opening avant que le fond noir
  // s'allume ». Invariant partagé par les trois canvas-masques du site :
  // l'exposé complet est dans src/systems/TorchSystem.js → resize().
  this._render(performance.now());
};

LightSystem.prototype.show = function() {
  this.visible = true;
  this.canvas.style.display = 'block';
  this.canvas.style.opacity = '1';
};

/* ── Gestion des lumières ─────────────────────────────────────────────────── */

LightSystem.prototype.addLight = function(cfg) {
  this.lights.push({
    id:        cfg.id,
    getCenter: cfg.getCenter,         // () => { x, y } en coords viewport
    frac:      0,                     // rayon courant (fraction de min(vp))
    opacity:   0,
    phaseMs:   cfg.phaseMs || 0       // déphasage du scintillement
  });
};

LightSystem.prototype._find = function(id) {
  for (var i = 0; i < this.lights.length; i++) {
    if (this.lights[i].id === id) return this.lights[i];
  }
  return null;
};

LightSystem.prototype.setLight = function(id, frac, op) {
  var L = this._find(id);
  if (!L) return;
  if (this._anims[id]) { cancelAnimationFrame(this._anims[id]); delete this._anims[id]; }
  L.frac    = Math.max(0, frac);
  L.opacity = Math.max(0, Math.min(1, op === undefined ? 1 : op));
};

/**
 * Anime une lumière (rayon + opacité) en cosinus, retourne une Promise.
 */
LightSystem.prototype.animateLight = function(id, targetFrac, ms, targetOp) {
  var self = this;
  var L = this._find(id);
  if (!L) return Promise.resolve();
  targetOp   = (targetOp === undefined) ? 1 : targetOp;
  targetFrac = Math.max(0, targetFrac);
  if (this._anims[id]) cancelAnimationFrame(this._anims[id]);
  var startFrac = L.frac;
  var startOp   = L.opacity;
  var t0 = performance.now();
  return new Promise(function(resolve) {
    function step(now) {
      var p = Math.min((now - t0) / Math.max(1, ms), 1);
      var e = 0.5 - 0.5 * Math.cos(p * Math.PI);
      L.frac    = startFrac + (targetFrac - startFrac) * e;
      L.opacity = startOp   + (targetOp   - startOp)   * e;
      if (p < 1) {
        self._anims[id] = requestAnimationFrame(step);
      } else {
        delete self._anims[id];
        L.frac    = targetFrac;
        L.opacity = targetOp;
        resolve();
      }
    }
    self._anims[id] = requestAnimationFrame(step);
  });
};

/** Anime TOUTES les lumières vers le même état (ex. extinction de sortie). */
LightSystem.prototype.animateAll = function(targetFrac, ms, targetOp) {
  var self = this;
  return Promise.all(this.lights.map(function(L) {
    return self.animateLight(L.id, targetFrac, ms, targetOp);
  }));
};

LightSystem.prototype.destroy = function() {
  if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
  var self = this;
  Object.keys(this._anims).forEach(function(id) {
    cancelAnimationFrame(self._anims[id]);
  });
  this._anims = {};
  window.removeEventListener('resize', this._resizeBound);
  if (this.canvas && this.canvas.parentNode) {
    this.canvas.parentNode.removeChild(this.canvas);
  }
  this.canvas = null;
  this.ctx    = null;
  this.lights = [];
  // `mount` pointe sur #chp2-shake, DANS le DOM du chapitre : le garder
  // retiendrait tout l'arbre démonté. destroy() est terminal.
  this.mount  = null;
};

/* ── Conversion viewport → pixels canvas ──────────────────────────────────
   Le canvas mesure 130 % du mount et est décalé de -15 %. Un point viewport
   (vx, vy) tombe donc à ((vx + 0.15·mountW)·scaleX, (vy + 0.15·mountH)·scaleY)
   dans le repère pixel du canvas. Cohérent avec l'ancien centrage (vx=mountW/2
   → canvasX = canvas.width/2).
──────────────────────────────────────────────────────────────────────────── */
LightSystem.prototype._viewportToCanvas = function(vx, vy) {
  var mountW = this.mount.clientWidth  || this._vW();
  var mountH = this.mount.clientHeight || this._vH();
  var sx = this.canvas.width  / (1.3 * mountW);
  var sy = this.canvas.height / (1.3 * mountH);
  return {
    x: (vx + 0.15 * mountW) * sx,
    y: (vy + 0.15 * mountH) * sy
  };
};

LightSystem.prototype._safeGrad = function(x0, y0, r0, x1, y1, r1) {
  if ([x0, y0, r0, x1, y1, r1].some(function(v) { return !isFinite(v) || isNaN(v); })) return null;
  return this.ctx.createRadialGradient(x0, y0, Math.max(0, r0), x1, y1, Math.max(0.001, r1));
};

/** Perce le « trou » de lumière (révèle le panorama) pour une lumière. */
LightSystem.prototype._punch = function(cx, cy, r) {
  var ctx = this.ctx;

  var g1 = this._safeGrad(cx, cy, 0, cx, cy, r * 3.9);
  if (g1) {
    g1.addColorStop(0,    'rgba(0,0,0,0.38)');
    g1.addColorStop(0.22, 'rgba(0,0,0,0.24)');
    g1.addColorStop(0.55, 'rgba(0,0,0,0.12)');
    g1.addColorStop(0.82, 'rgba(0,0,0,0.04)');
    g1.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(cx, cy, r * 3.9, 0, Math.PI * 2);
    ctx.fillStyle = g1; ctx.fill();
  }

  var g2 = this._safeGrad(cx, cy, 0, cx, cy, r * 2.25);
  if (g2) {
    g2.addColorStop(0,    'rgba(0,0,0,0.58)');
    g2.addColorStop(0.35, 'rgba(0,0,0,0.38)');
    g2.addColorStop(0.68, 'rgba(0,0,0,0.16)');
    g2.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(cx, cy, r * 2.25, 0, Math.PI * 2);
    ctx.fillStyle = g2; ctx.fill();
  }

  var g3 = this._safeGrad(cx, cy, 0, cx, cy, r * 1.03);
  if (g3) {
    g3.addColorStop(0,    'rgba(0,0,0,0.88)');
    g3.addColorStop(0.28, 'rgba(0,0,0,0.76)');
    g3.addColorStop(0.58, 'rgba(0,0,0,0.52)');
    g3.addColorStop(0.82, 'rgba(0,0,0,0.22)');
    g3.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.03, 0, Math.PI * 2);
    ctx.fillStyle = g3; ctx.fill();
  }
};

/** Halo chaud de flamme (source-over) pour une lumière. */
LightSystem.prototype._glow = function(cx, cy, r, wp) {
  var ctx = this.ctx;
  var wR = Math.max(1, r * 0.62 * 1.0);
  var wA = 0.048 + Math.abs(wp) * 0.028;
  var gW = this._safeGrad(cx, cy, 0, cx, cy, wR);
  if (gW) {
    var gb = Math.floor(Math.max(0, Math.min(255, 185 + wp * 14)));
    gW.addColorStop(0,    'rgba(255,' + gb + ',70,' + (wA * 1.5).toFixed(3) + ')');
    gW.addColorStop(0.45, 'rgba(255,170,55,' + wA.toFixed(3) + ')');
    gW.addColorStop(1,    'rgba(255,130,20,0)');
    ctx.beginPath(); ctx.arc(cx, cy, wR, 0, Math.PI * 2);
    ctx.fillStyle = gW; ctx.fill();
  }
};

LightSystem.prototype._render = function(t) {
  if (!this.ctx || !this.canvas) return;
  var ctx = this.ctx;
  var W = this.canvas.width, H = this.canvas.height;
  var minVp = this._min();

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Lumières actives à dessiner ce frame
  var draws = [];
  for (var i = 0; i < this.lights.length; i++) {
    var L = this.lights[i];
    if (L.opacity <= 0.001 || L.frac <= 0.0001) continue;
    var c = L.getCenter ? L.getCenter() : null;
    if (!c || !isFinite(c.x) || !isFinite(c.y)) continue;

    var lt = t + L.phaseMs;
    var flickerScale = Math.min(1, L.frac / 0.12);
    var intensity = 1
      + (osc(O.b1, lt) + osc(O.b2, lt)) * flickerScale
      + (osc(O.f1, lt) + osc(O.f2, lt) + osc(O.f3, lt) + osc(O.f4, lt)) * flickerScale;

    var pos = this._viewportToCanvas(c.x, c.y);
    var cx = pos.x + osc(O.dx, lt) * 0.38;
    var cy = pos.y + osc(O.dy, lt) * 0.30;
    var r  = Math.max(0, minVp * L.frac * Math.max(0.74, intensity));

    draws.push({ cx: cx, cy: cy, r: r, op: L.opacity, wp: osc(O.w, lt) });
  }

  if (draws.length === 0) return;

  // 1) Trous (révélation du panorama) — union de tous les trous.
  ctx.globalCompositeOperation = 'destination-out';
  for (var d = 0; d < draws.length; d++) {
    ctx.globalAlpha = draws[d].op;
    this._punch(draws[d].cx, draws[d].cy, draws[d].r);
  }

  // 2) Halos chauds.
  ctx.globalCompositeOperation = 'source-over';
  for (var g = 0; g < draws.length; g++) {
    ctx.globalAlpha = draws[g].op;
    this._glow(draws[g].cx, draws[g].cy, draws[g].r, draws[g].wp);
  }

  ctx.globalAlpha = 1;
};

/* Une lumière est-elle en train de s'animer ou d'être visible ? Sert à décider
   si le canvas doit encore être repeint (cf. _startLoop). */
LightSystem.prototype._hasActiveLight = function() {
  for (var id in this._anims) { if (this._anims.hasOwnProperty(id)) return true; }
  for (var i = 0; i < this.lights.length; i++) {
    var L = this.lights[i];
    if (L.opacity > 0.001 && L.frac > 0.0001) return true;
  }
  return false;
};

LightSystem.prototype._startLoop = function() {
  if (this.raf) return;
  var self = this;
  var loop = function(t) {
    if (!self.raf) return; // stoppé par destroy()
    self.raf = requestAnimationFrame(loop);
    // Économie mobile : quand une sous-partie couvre le travelling (overlay
    // opaque) ET qu'aucune lumière n'est active, le canvas est déjà tout noir →
    // inutile de le repeindre (130 % du viewport) 60×/s. On continue tant qu'une
    // lumière s'anime, pour que le fondu de sortie reste visible ; on ne saute
    // qu'une fois toutes les lumières éteintes. (`_subOpen` : état module.)
    //
    // ⚠️ CE SAUT N'EST SÛR QUE PARCE QUE resize() REPEINT LUI-MÊME. Le canvas
    // garde son dernier cadre — sauf si on le redimensionne, ce qui l'efface.
    // Sans le repaint synchrone posé dans resize(), un canvas effacé pendant une
    // sous-partie ne serait jamais restauré, et le panorama apparaîtrait nu au
    // retour. Les deux lignes se tiennent : ne pas en retirer une seule.
    if (_subOpen && !self._hasActiveLight()) return;
    self._render(t);
  };
  self.raf = requestAnimationFrame(loop);
};

/* =============================================================================
   RÉFÉRENCES DOM
   ─────────────────────────────────────────────────────────────────────────────
   IDs préfixés "chp2-" pour éviter toute collision avec le projet principal.
============================================================================= */
// Refs résolues dans init() : le DOM du chapitre est réinjecté à chaque entrée,
// des refs capturées au chargement du module seraient périmées à la 2ᵉ visite.
var imgEl   = null;
var bar     = null;
// curseur géré par le projet principal — pas de #chp2-cursor dans le DOM intégré
var cursor  = null;
// Référence au curseur custom global (#cursor) : l'opening pilote directement
// son état .hotspot au survol d'un crâne. Aucun conflit avec app.js car tout le
// travelling est en pointer-events:none (aucune frontière DOM survolée ici).
var hotCursor = null;
// État de survol d'un crâne. setSkullHot est DÉCLENCHÉ SUR TRANSITION : il ne
// modifie #cursor.hotspot que lorsqu'on entre/sort réellement d'un crâne. Ainsi,
// quand le curseur n'est PAS sur un crâne (sur la flèche d'opening, par ex.),
// l'appel répété setSkullHot(false) est un no-op et ne retire pas le hotspot
// qu'app.js vient de poser sur la flèche / le bouton plein écran.
var _skullHot = false;
function setSkullHot(on) {
  on = !!on;
  if (on === _skullHot) return;
  _skullHot = on;
  if (hotCursor) hotCursor.classList.toggle('hotspot', on);
}
// Curseur SYSTÈME (souris, hors tactile) : les cartels sont en pointer-events:none
// (détection au clic/survol faite « à la main » par box fractionnaire, cf.
// updateHover), donc aucun :hover CSS ne peut jamais s'y déclencher. On pose
// donc une classe sur #chapitre2-root — la propriété `cursor` s'hérite à tous
// les descendants — plutôt qu'un style en ligne, pour rester dans l'idiome du
// site (classList, jamais .style.cursor). setSkullHot pilote le curseur DESSINÉ
// (tactile) ; setHandCursor pilote le curseur NATIF (souris) : les deux mêmes
// déclencheurs, deux publics différents.
var chp2Root = null;
var _handCursor = false;
function setHandCursor(on) {
  on = !!on;
  if (on === _handCursor) return;
  _handCursor = on;
  if (chp2Root) chp2Root.classList.toggle('chp2-cursor-pointer', on);
}
var legend  = null;
var legNum  = null;
var legLab  = null;
var shakeEl = null;
var fadeEl  = null;

/* =============================================================================
   CARTELS — zones de clic fractionnaires
   ─────────────────────────────────────────────────────────────────────────────
   `box` sert DEUX fois : c'est lui qui centre la lumière (getCenter(), plus
   bas — le centre du pool est le centre du box) ET la zone de survol/clic
   (updateHover). Les crânes servaient autrefois de cible ; ce sont maintenant
   les CARTELS (cartel-13x.png) — le box a donc été redescendu et resserré sur
   leur propre empreinte, mesurée sur le canal alpha de chaque PNG (centroïde
   des pixels opaques, cf. script d'audit ponctuel — pas de repère à l'oeil).
   Les crânes, eux, sortent du pool (rayon LIGHT.craneFinalFrac inchangé) : ils
   retombent dans la pénombre sans qu'il ait fallu réduire la lumière elle-même.
   ⚠️ 137 et 138 sont VISUELLEMENT proches (la photo les place presque l'un sur
   l'autre) : leurs empreintes réelles se chevauchent légèrement. Les box ont
   été coupées à leur frontière pour rester DISJOINTES — updateHover() retient
   toujours le premier crâne touché dans l'ordre du tableau, un chevauchement
   aurait rendu une partie de 138 injoignable au survol.
============================================================================= */
var SKULLS = [
  {
    id:     "136",
    box:    { x0: 0.138, y0: 0.696, x1: 0.390, y1: 0.882 },
    num:    "136",
    label:  "Taire le passé",
    url:    null,
    action: "invisibilisation",
    active: false,
    el:     null   // résolu dans init() : chp2-ov-<id>
  },
  {
    id:     "137",
    box:    { x0: 0.484, y0: 0.658, x1: 0.748, y1: 0.896 },
    num:    "137",
    label:  "Une peine démesurée",
    url:    null,
    action: "peine-demesuree",
    active: false,
    el:     null
  },
  {
    id:     "138",
    box:    { x0: 0.762, y0: 0.569, x1: 1.0, y1: 0.737 },
    num:    "138",
    label:  "La violence et ses traces",
    url:    null,
    action: "cartel",
    active: false,
    el:     null
  }
];

/* =============================================================================
   ÉTAT TRAVELLING
============================================================================= */
// Interactivité globale : true une fois l'ignition initiale terminée. Le gating
// fin (quel crâne réagit) est porté par SKULLS[i].active (cf. progression).
var interactive  = false;
var hoveredSkull = null;
var lastClientX = 0, lastClientY = 0;
var lastMt = 0, lastMx2 = 0, lastMy2 = 0;
var velocity = 0;
var shakeMul = 1;
var vpH = 0;
var vpW = 0, imgW = 0, maxTx = 0, targetX = 0, currentX = 0, ratio = 0, started = false;

var SHAKE = {
  amplitudeX: 2.2,
  amplitudeY: 1.6,
  rotation:   0.08,
  velocityRef: 1800,
  boost:       1.2,
  maxBoost:    2.2,
  smoothing:   0.035
};

/* ── Paramètres lumière (configurables via chp2-config.js → CONFIG.light) ──
   craneFinalFrac : rayon d'un pool par crâne (fraction de min(viewport)).
   igniteMs/Delay : durée/temporisation de l'allumage initial.
   staggerMs      : décalage d'allumage entre crânes (cascade).
   returnMs       : durée de rallumage au retour d'une sous-partie.
──────────────────────────────────────────────────────────────────────────── */
var LIGHT = Object.assign({
  craneFinalFrac: 0.20,
  igniteMs:       5000,
  igniteDelay:    2600,
  staggerMs:      260,
  returnMs:       3000
}, (CONFIG && CONFIG.light) || {});

// Ordre de déblocage linéaire des crânes (136 → 137 → 138).
var SKULL_ORDER = SKULLS.map(function(s) { return s.id; });

var IGNITE = {
  duration:    LIGHT.igniteMs,
  finalRadius: LIGHT.craneFinalFrac,
  delay:       LIGHT.igniteDelay
};

/* =============================================================================
   RAF handles pour nettoyage lors de stopChapitre2()
============================================================================= */
var _travelRaf = null;
var _shakeRaf  = null;
var _resizeObs = null;
var _clickHandler    = null;
var _mousemoveHandler = null;
var _touchmoveHandler = null;
var _igniteTimers = [];   // setTimeouts de la séquence d'allumage — vidés au stop

/* =============================================================================
   MESURE & TRANSLATION
============================================================================= */
function measure() {
  if (!imgEl) return;
  vpW  = document.documentElement.clientWidth;
  vpH  = document.documentElement.clientHeight;
  imgW = imgEl.getBoundingClientRect().width;
  maxTx = Math.min(0, vpW - imgW);
  targetX = currentX = ratio * maxTx;
  applyTx(currentX);
}

function applyTx(tx) {
  if (!imgEl) return;
  tx = Math.max(maxTx, Math.min(0, tx));
  var r = Math.round(tx);
  var transform = "translateX(" + r + "px)";
  imgEl.style.transform = transform;
  for (var i = 0; i < SKULLS.length; i++) {
    if (SKULLS[i].el) SKULLS[i].el.style.transform = transform;
  }
  var pct = maxTx !== 0 ? r / maxTx : 0;
  pct = Math.max(0, Math.min(1, pct));
  if (bar) bar.style.width = (pct * 100) + "%";
  updateHover();
}

/* =============================================================================
   HOVER DETECTION
============================================================================= */
function updateHover() {
  if (document.body.classList.contains('cartel-open') || document.body.classList.contains('invisibilisation-open') || document.body.classList.contains('peine-demesuree-open')) {
    if (hoveredSkull) hoveredSkull.el && hoveredSkull.el.classList.remove("visible");
    hoveredSkull = null;
    if (legend) legend.classList.remove("visible");
    if (cursor) cursor.classList.remove("clickable");
    // NE PAS toucher à #cursor.hotspot ici : pendant une sous-partie, le
    // curseur appartient à app.js (flèche, plein écran) et au survol direct
    // des diapos. Le travelLoop tournant à ~60fps, un setSkullHot(false) ici
    // retirerait le hotspot à chaque frame et neutraliserait ces survols.
    // Le hotspot du dernier crâne survolé est nettoyé UNE fois à l'entrée de
    // la sous-partie (open*Overlay).
    // setHandCursor, lui, N'EST LU NULLE PART AILLEURS : aucun survol de
    // sous-partie n'y touche, donc le retirer ici à chaque frame ne peut rien
    // neutraliser. Il évite qu'un curseur « main » posé juste avant l'ouverture
    // ne s'hérite, via #chapitre2-root, sur la sous-partie qui vient de couvrir
    // l'écran.
    setHandCursor(false);
    return;
  }
  if (!interactive) {
    if (hoveredSkull) hoveredSkull.el && hoveredSkull.el.classList.remove("visible");
    hoveredSkull = null;
    if (legend) legend.classList.remove("visible");
    if (cursor) cursor.classList.remove("clickable");
    setSkullHot(false);
    setHandCursor(false);
    return;
  }
  if (vpH === 0 || imgW === 0) return;

  var imgX = lastClientX - currentX;
  var imgY = lastClientY;
  var fx = imgX / imgW;
  var fy = imgY / vpH;

  var hit = null;
  for (var i = 0; i < SKULLS.length; i++) {
    // Seuls les crânes DÉVERROUILLÉS (éclairés) sont survolables / cliquables.
    if (!SKULLS[i].active) continue;
    var b = SKULLS[i].box;
    if (fx >= b.x0 && fx <= b.x1 && fy >= b.y0 && fy <= b.y1) {
      hit = SKULLS[i];
      break;
    }
  }

  if (hit !== hoveredSkull) {
    if (hoveredSkull) hoveredSkull.el && hoveredSkull.el.classList.remove("visible");
    hoveredSkull = hit;
    if (hit) {
      hit.el && hit.el.classList.add("visible");
      if (legNum) legNum.textContent = hit.num;
      if (legLab) legLab.textContent = hit.label;
      if (legend) legend.classList.add("visible");
    } else {
      if (legend) legend.classList.remove("visible");
    }
    if (cursor) cursor.classList.toggle("clickable", !!(hit && (hit.url || hit.action)));
    setSkullHot(!!(hit && (hit.url || hit.action)));
    setHandCursor(!!(hit && (hit.url || hit.action)));
  }
}

/* =============================================================================
   MOUVEMENT (souris + touch)
============================================================================= */
function onMove(clientX, clientY) {
  if (!started) {
    started = true;
    if (cursor) cursor.classList.add("visible");
  }
  if (clientY !== null) {
    var now = performance.now();
    if (lastMt > 0) {
      var dt = Math.max(1, now - lastMt);
      var dx = clientX - lastMx2;
      var dy = clientY - lastMy2;
      var v  = Math.sqrt(dx * dx + dy * dy) / dt * 1000;
      velocity = velocity * 0.7 + v * 0.3;
    }
    lastMt = now; lastMx2 = clientX; lastMy2 = clientY;
  }
  lastClientX = clientX;
  lastClientY = clientY !== null ? clientY : lastClientY;
  ratio   = Math.max(0, Math.min(1, clientX / vpW));
  targetX = ratio * maxTx;
  if (clientY !== null && cursor) {
    cursor.style.left = clientX + "px";
    cursor.style.top  = clientY + "px";
  }
}

// Handlers créés et attachés dans init() — voir la section INIT plus bas.

/* =============================================================================
   SUSPENSION — l'opening s'arrête VRAIMENT pendant une sous-partie
   ─────────────────────────────────────────────────────────────────────────────
   TROIS RÈGLES, et elles se tiennent. Elles remplacent une vigilance qui avait
   déjà échoué deux fois.

   I.  ON NE SE SUSPEND NI NE SE REPREND HORS DU NOIR.
       suspend() n'est appelé qu'une fois l'écran couvert, resume() tant qu'il
       l'est encore. Avant, le gel tombait à l'instant du clic : le panorama,
       encore en train de glisser vers le crâne, s'arrêtait NET — et le voile
       ne devenait opaque qu'une demi-seconde plus tard. Mesuré : arrêt à
       -181 px alors que le glissé courait à ~1000 px/s, voile à 14 % seulement
       120 ms après. C'était le « saut d'affichage » vu à chaque entrée.

   II. UNE PLACE SUSPENDUE N'ÉCOUTE PLUS RIEN : ON DÉTACHE, ON NE TESTE PAS UN
       DRAPEAU. C'est la règle qui compte le plus ici. Les deux boucles étaient
       gardées par `if (!_subOpen)` — mais `onMove`, lui, ne l'était pas et
       continuait d'écrire `targetX` et `velocity`. Au retour, la boucle
       repartait et RATTRAPAIT tout : 517 px avalés à 2 480 px/s, mesurés.
       Un écouteur détaché ne peut pas oublier de consulter un drapeau.

   III. ON REPREND SUR LE PRÉSENT, ON NE REJOUE PAS LE MANQUÉ.
       resume() ramène la cible sur la position réelle (targetX = currentX) et
       remet la vélocité à zéro. Le panorama reste donc là où le visiteur l'a
       laissé ; son prochain vrai mouvement de souris le fait paner normalement.
       (On ne le recale PAS sur le pointeur : pendant la suspension on ne sait
       plus où il est — les écouteurs sont détachés — et prétendre le savoir,
       c'est réintroduire un saut.)

   GAIN DE PERFORMANCE, au passage. Les gardes `if (!_subOpen)` laissaient les
   `requestAnimationFrame` se reprogrammer : deux chaînes tournaient à 60 i/s
   pour ne rien faire pendant toute la sous-partie. Elles sont maintenant
   réellement annulées.
============================================================================= */

/** true entre suspend() et resume() : l'opening est gelé, écouteurs détachés. */
var _suspended = false;

function startLoops() {
  if (_travelRaf === null) {
    (function travelLoop() {
      var d = targetX - currentX;
      currentX = Math.abs(d) < 0.05 ? targetX : currentX + d * 0.08;
      applyTx(currentX);
      _travelRaf = requestAnimationFrame(travelLoop);
    })();
  }

  if (_shakeRaf === null) {
    (function shakeLoop() {
      var t = performance.now();
      velocity *= 0.92;
      var target = 1 + Math.min(SHAKE.boost, velocity / SHAKE.velocityRef * SHAKE.boost);
      target = Math.min(SHAKE.maxBoost, target);
      shakeMul += (target - shakeMul) * SHAKE.smoothing;

      var sx = (Math.sin(t * 0.001 * O.shx1.freq * Math.PI * 2 + O.shx1.phase)
              + Math.sin(t * 0.001 * O.shx2.freq * Math.PI * 2 + O.shx2.phase) * 0.5
              + Math.sin(t * 0.001 * O.shx3.freq * Math.PI * 2 + O.shx3.phase) * 0.25) / 1.75;
      var sy = (Math.sin(t * 0.001 * O.shy1.freq * Math.PI * 2 + O.shy1.phase)
              + Math.sin(t * 0.001 * O.shy2.freq * Math.PI * 2 + O.shy2.phase) * 0.5
              + Math.sin(t * 0.001 * O.shy3.freq * Math.PI * 2 + O.shy3.phase) * 0.25) / 1.75;
      var rot = sx * SHAKE.rotation * shakeMul;

      if (shakeEl) {
        shakeEl.style.transform =
          "translate(" + (sx * SHAKE.amplitudeX * shakeMul).toFixed(2) + "px,"
                       + (sy * SHAKE.amplitudeY * shakeMul).toFixed(2) + "px) "
          + "rotate(" + rot.toFixed(3) + "deg)";
      }
      _shakeRaf = requestAnimationFrame(shakeLoop);
    })();
  }
}

function stopLoops() {
  if (_travelRaf !== null) { cancelAnimationFrame(_travelRaf); _travelRaf = null; }
  if (_shakeRaf  !== null) { cancelAnimationFrame(_shakeRaf);  _shakeRaf  = null; }
}

/**
 * Gèle l'opening. À N'APPELER QUE SOUS LE NOIR (règle I). Idempotent : les
 * sous-parties émettent parfois `:closed` ET `:return`, les deux passent ici.
 */
function suspend() {
  if (_suspended || !_active) return;
  _suspended = true;
  if (_mousemoveHandler) window.removeEventListener("mousemove", _mousemoveHandler);
  if (_touchmoveHandler) window.removeEventListener("touchmove", _touchmoveHandler);
  stopLoops();
}

/**
 * Reprend l'opening. À N'APPELER QUE SOUS LE NOIR (règle I) : la
 * resynchronisation ci-dessous est un saut, il ne doit pas se voir. Idempotent.
 */
function resume() {
  if (!_suspended || !_active) return;
  _suspended = false;

  // Règle III — on repart de l'état réel, sans rattrapage.
  targetX  = currentX;
  velocity = 0;
  shakeMul = 1;

  if (_mousemoveHandler) window.addEventListener("mousemove", _mousemoveHandler);
  if (_touchmoveHandler) window.addEventListener("touchmove", _touchmoveHandler, { passive: false });
  startLoops();
}

/* =============================================================================
   CLIC — invisibilisation | cartel | peine-demesuree | navigation retour
   ─────────────────────────────────────────────────────────────────────────────
   La navigation externe (window.location.href) est remplacée par un
   CustomEvent 'chp2:navigate-back' capté par Chapitre2Scene.js.
============================================================================= */
var navigating = false;

// _clickHandler, mesure initiale et boucles rAF : posés dans init().

/* =============================================================================
   LIGHT SYSTEM — instancié dans init(), monté sur chp2-shake
   ─────────────────────────────────────────────────────────────────────────────
   Une lumière par crâne. Chaque lumière fournit un getCenter() qui renvoie la
   position VIEWPORT live de son crâne (translateX du travelling = currentX
   inclus) ; le LightSystem la convertit en coordonnées canvas. La lumière reste
   ainsi collée au crâne pendant tout le panoramique.
============================================================================= */
var light = null;

/* =============================================================================
   PROGRESSION — éclairage + interactivité conditionnés par les sous-parties vues
   ─────────────────────────────────────────────────────────────────────────────
   Source de vérité : chp2-progress (localStorage). On dérive la liste des crânes
   déverrouillés et on (r)allume leurs pools tout en activant leur hover/clic ;
   les crânes verrouillés restent éteints et inertes.

   Appelée :
     - à l'allumage initial (ignite) avec une cascade (stagger) ;
     - au retour de chaque sous-partie (rallumage progressif), où un crâne
       nouvellement débloqué s'allume pour la première fois.

   Les lumières déverrouillées sont systématiquement (re)parties de 0 → final :
   au démarrage c'est l'allumage ; au retour c'est le « rallumage progressif »
   cohérent avec l'esthétique d'origine.
   @param {Object}  opts
   @param {number}  [opts.ms]       Durée d'animation d'allumage.
   @param {boolean} [opts.stagger]  Décalage en cascade entre crânes.
============================================================================= */
function applyProgressLighting(opts) {
  opts = opts || {};
  var ms      = opts.ms || LIGHT.igniteMs;
  var stagger = !!opts.stagger;

  var unlocked = computeUnlocked(SKULL_ORDER);
  var unlockedSet = {};
  unlocked.forEach(function(id) { unlockedSet[id] = true; });

  light.show();

  SKULLS.forEach(function(s, i) {
    if (unlockedSet[s.id]) {
      s.active = true;
      light.setLight(s.id, 0, 0);
      var delay = stagger ? i * LIGHT.staggerMs : 0;
      (function(id) {
        _igniteTimers.push(setTimeout(function() {
          if (!_active) return;
          light.animateLight(id, LIGHT.craneFinalFrac, ms, 1);
        }, delay));
      })(s.id);
    } else {
      s.active = false;
      light.setLight(s.id, 0, 0);   // garantit l'extinction des crânes verrouillés
    }
  });
}

/* =============================================================================
   AUDIO — centralisé dans AudioManager (piste 'chp2' / fredonnement)
   ─────────────────────────────────────────────────────────────────────────────
   Chapitre2Scene injecte le gestionnaire audio partagé via setAudioManager().
   Plus aucun élément Audio local au module : une seule piste centralisée, donc
   pas de dédoublement ni de son résiduel entre les (ré)entrées dans le chapitre.
   `audio` est une fine façade qui mappe l'API historique du module vers les
   méthodes du gestionnaire ; chaque appel est protégé par le flag _active afin
   qu'une instance périmée (cache-bust) ne puisse plus piloter le son partagé.
============================================================================= */
var _audio  = null;   // AudioManager injecté
var _active = false;  // true entre startChapitre2() et stopChapitre2()

var audio = {
  fadeIn: function(targetVol, ms) { if (_active && _audio) _audio.startChp2Loop(ms); },
  fadeOut:function(ms)            { if (_audio) _audio.stopChp2Loop(ms); },
  duck:   function(ms)            { if (_active && _audio) _audio.duckChp2(ms); },
  unduck: function(ms)            { if (_active && _audio) _audio.unduckChp2(ms); },
  stop:   function()              { if (_audio) _audio.stopChp2Loop(200); }
};

/* =============================================================================
   PONT FLÈCHE OPENING ↔ Chapitre2Scene
   ─────────────────────────────────────────────────────────────────────────────
   Chapitre2Scene injecte ses callbacks via setArrowCallbacks().
   - _arrowShow() : afficher la flèche retour vers Collaboration
   - _arrowHide() : masquer la flèche (quand on entre dans une sous-partie)
   La flèche s'affiche après que l'ignition initiale soit terminée (interactive).
============================================================================= */
var _arrowShow = null;
var _arrowHide = null;
var _arrowShownOnce = false;

/* Source de vérité unique : true dès qu'une sous-partie est ouverte (ou en
   cours d'ouverture), false dès qu'on revient à l'opening. Empêche par
   construction qu'un timer différé (ignition / retour) ne (re)dessine la
   flèche opening par-dessus une sous-partie. */
var _subOpen = false;

/* Afficheur gardé de la flèche opening : ne dessine QUE si l'opening est
   actif ET qu'aucune sous-partie n'est ouverte. Évalué au moment de l'appel
   (y compris depuis un setTimeout), ce qui neutralise toute course au clic. */
function showOpeningArrow() {
  if (!_active || _subOpen) return;
  if (_arrowShow) _arrowShow();
}

/* =============================================================================
   IGNITION
============================================================================= */
/* =============================================================================
   IGNITION
   ─────────────────────────────────────────────────────────────────────────────
   Allume, après une temporisation, les pools des crânes DÉVERROUILLÉS (cascade),
   puis active l'interactivité, puis fait apparaître la flèche opening.
   La première visite n'allume que le crâne 136 ; les visites suivantes
   restaurent l'état mémorisé (cf. chp2-progress / localStorage).
============================================================================= */
function ignite() {
  light.show();
  _igniteTimers.push(setTimeout(function() {
    if (!_active) return;
    applyProgressLighting({ ms: IGNITE.duration, stagger: true });
    audio.fadeIn(0.72, IGNITE.duration);
    _igniteTimers.push(setTimeout(function() {
      if (!_active) return;
      interactive = true;
      // Afficher la flèche opening ~600ms après le début de l'allumage
      _igniteTimers.push(setTimeout(function() {
        if (!_active || _subOpen) return;
        if (_arrowShow && !_arrowShownOnce) {
          _arrowShownOnce = true;
          showOpeningArrow();
        }
      }, 600));
    }, 800));
  }, IGNITE.delay));
}

var _ignited = false;
function safeIgnite() {
  if (_ignited) return;
  _ignited = true;
  // L'image est maintenant chargée (ou en échec/timeout) : on remesure pour
  // disposer d'une largeur d'image fiable AVANT d'allumer — les lumières sont
  // centrées sur les crânes via imgW, et le hover en dépend aussi.
  measure();

  // SPA — anti-flash : le canvas d'obscurité naît `display:none; opacity:0`.
  // Tant qu'il n'est pas affiché, le travelling est visible EN PLEINE LUMIÈRE.
  // On l'affiche donc TOUT DE SUITE : sans lumière allumée, _render() se contente
  // de remplir le canvas en noir → la nuit est posée avant toute peinture utile.
  // 300 ms couvrent le fondu d'apparition du canvas (transition opacity 220 ms),
  // après quoi on signale à Chapitre2Scene qu'elle peut lever son rideau.
  light.show();
  _igniteTimers.push(setTimeout(function() {
    if (!_active) return;
    try { window.dispatchEvent(new CustomEvent('chp2:opening-ready')); } catch (_) {}
  }, 300));

  ignite();
}

/* =============================================================================
   RESIZE — ResizeObserver créé dans init()
============================================================================= */

/* =============================================================================
   PONT TRAVELLING ⇄ CARTEL
============================================================================= */
var cartelModulePromise = null;

function loadCartelModule() {
  if (!cartelModulePromise) {
    cartelModulePromise = import('./chp2-violence-et-trace.js');
  }
  return cartelModulePromise;
}

function openPeineDemesureeOverlay() {
  if (document.body.classList.contains('peine-demesuree-open')) return;
  _subOpen = true;
  setSkullHot(false);
  setHandCursor(false);
  if (legend) legend.classList.remove("visible");
  if (hoveredSkull && hoveredSkull.el) hoveredSkull.el.classList.remove("visible");
  if (_arrowHide) _arrowHide();
  audio.duck(800);
  document.body.classList.add('peine-demesuree-open');

  // Ici, le NOIR n'est pas un voile : c'est l'extinction des bougies elle-même.
  // Quand animateAll résout, le canvas d'obscurité est plein — donc opaque.
  light.animateAll(0, 2000, 0).then(function() {
    // RÈGLE I — l'écran est couvert (canvas noir plein) : gel invisible.
    suspend();

    var root = document.getElementById('peine-demesuree-root');
    if (!root) return;
    root.style.opacity = '0';
    root.style.transition = 'opacity 3s ease';
    root.classList.add('is-open');

    loadPeineDemesureeModule().then(function(mod) {
      mod.openPeineDemesuree();
      markVisited('137');   // « Une peine démesurée » vue → débloque le crâne 138
      requestAnimationFrame(function() { root.style.opacity = '1'; });
    }).catch(function(err) {
      console.error('[Peine] Échec chargement :', err);
      document.body.classList.remove('peine-demesuree-open');
      _subOpen = false;
      resume();
      audio.unduck(400);
      applyProgressLighting({ ms: 800 });
    });
  });
}

function openCartelOverlay() {
  _subOpen = true;
  setSkullHot(false);
  setHandCursor(false);
  if (legend) legend.classList.remove("visible");
  if (hoveredSkull && hoveredSkull.el) hoveredSkull.el.classList.remove("visible");
  if (_arrowHide) _arrowHide();
  audio.duck(800);
  // Comme « Peine démesurée » : le noir, ici, c'est l'extinction des bougies.
  light.animateAll(0, 2000, 0).then(function() {
    // RÈGLE I — l'écran est couvert (canvas noir plein) : gel invisible.
    suspend();

    loadCartelModule().then(function(mod) {
      var ok = mod.openCartel();
      if (ok) {
        markVisited('138');   // « La violence et ses traces » vue (dernier crâne)
      } else {
        _subOpen = false;
        resume();
        applyProgressLighting({ ms: 800 });
        audio.unduck(400);
      }
    }).catch(function(err) {
      console.error('[Cartel] Échec chargement :', err);
      _subOpen = false;
      resume();
      applyProgressLighting({ ms: 800 });
      audio.unduck(400);
    });
  });
}

/* Il y avait ici un _onCartelClosed(), à l'écoute de 'cartel:closed'.
   ÉVÉNEMENT JAMAIS ÉMIS : chp2-violence-et-trace.js n'a qu'un seul chemin de
   sortie terminal (closeCartel avec skipOutro), et il émet TOUJOURS
   'cartel:return'. Le gestionnaire était donc mort, et il divergeait de son
   frère — il rappelait la flèche immédiatement là où _onCartelReturn la
   diffère de 2,8 s. Retiré avec ses deux écoutes (ici et dans
   Chapitre2Scene.PARTS). Si un jour le cartel doit se fermer SANS mise en
   scène, c'est un 'cartel:return' qu'il émettra, comme ses sœurs. */

function _onCartelReturn() {
  if (!_active) return;
  _subOpen = false;
  document.body.classList.remove('cartel-open');
  setTimeout(showOpeningArrow, 2800);

  // RÈGLE I — on couvre AVANT de reprendre. Le canvas d'obscurité est déjà
  // plein (bougies éteintes à l'entrée), le voile n'est qu'une ceinture ; mais
  // c'est lui qui porte le fondu de retour, alors on l'utilise pour les deux.
  if (fadeEl) fadeEl.style.zIndex = '10001';
  Blackout.cover(fadeEl);         // sec, et COMMIS — sans quoi le reveal n'anime rien
  resume();                       // resynchronisation : invisible, sous le noir
  applyProgressLighting({ ms: LIGHT.returnMs });
  audio.fadeIn(0.72, LIGHT.returnMs);
  Blackout.reveal(fadeEl, 2500).then(function() {
    if (fadeEl) fadeEl.style.zIndex = '';
  });
}
// (attaché dans init())

/* =============================================================================
   PONT TRAVELLING ⇄ INVISIBILISATION (lazy)
============================================================================= */
var invisibilisationModulePromise = null;

function loadInvisibilisationModule() {
  if (!invisibilisationModulePromise) {
    invisibilisationModulePromise = import('./chp2-invisibilisation.js');
  }
  return invisibilisationModulePromise;
}

var peineDemesureeModulePromise = null;

function loadPeineDemesureeModule() {
  if (!peineDemesureeModulePromise) {
    peineDemesureeModulePromise = import('./chp2-peine-demesuree.js');
  }
  return peineDemesureeModulePromise;
}

function openInvisibilisationOverlay() {
  if (document.body.classList.contains('invisibilisation-open')) return;
  _subOpen = true;
  setSkullHot(false);
  setHandCursor(false);
  if (legend) legend.classList.remove("visible");
  if (hoveredSkull && hoveredSkull.el) hoveredSkull.el.classList.remove("visible");
  if (_arrowHide) _arrowHide();
  document.body.classList.add('invisibilisation-open');

  // 1) Clic 136 : extinction progressive des bougies + coupure du son chp2 +
  //    fondu au noir par-dessus le travelling (fadeEl au-dessus de l'overlay).
  if (fadeEl) fadeEl.style.zIndex = '10001';
  var couvert = Blackout.cover(fadeEl, 1200);
  light.animateAll(0, 1200, 0);
  audio.fadeOut(1200);

  // 2) Une fois au noir, monter l'installation DERRIÈRE le voile (elle démarre
  //    elle-même sur fond noir, sans barre de chargement), puis retirer le voile
  //    sans transition : le noir de l'overlay prend le relais à l'identique, et
  //    l'installation gère son propre allumage progressif (révélation du loader).
  couvert.then(function() {
    if (!_active || !document.body.classList.contains('invisibilisation-open')) return;

    // RÈGLE I — l'écran est couvert : on peut geler l'opening sans que ça se
    // voie. Geler dès le clic arrêtait le panorama en plein glissé, à découvert.
    suspend();

    return loadInvisibilisationModule().then(function(mod) {
      var ok = mod.openInvisibilisation();
      if (ok) markVisited('136');   // « Invisibilisation » vue → débloque le crâne 137
      requestAnimationFrame(function() {
        Blackout.reveal(fadeEl);
        if (fadeEl) fadeEl.style.zIndex = '';
      });
    });
  }).catch(function(err) {
    console.error('[Invisibilisation] Échec chargement :', err);
    // Retour à l'opening : l'ordre compte, on reprend AVANT de découvrir.
    // (_subOpen restait naguère à true ici : l'opening serait resté gelé pour
    //  le reste de la visite après un échec de chargement.)
    document.body.classList.remove('invisibilisation-open');
    _subOpen = false;
    resume();
    applyProgressLighting({ ms: 800 });
    audio.fadeIn(0.72, 800);
    Blackout.reveal(fadeEl, 400).then(function() {
      if (fadeEl) fadeEl.style.zIndex = '';
    });
  });
}

function _onInvisibilisationClosed() {
  if (!_active) return;
  _subOpen = false;
  resume();                       // idempotent — _onInvisibilisationReturn suit
  document.body.classList.remove('invisibilisation-open');
  audio.unduck(1200);
  // La flèche opening réapparaît via 'invisibilisation:return' (après rallumage
  // progressif de la bougie), pour rester cohérent avec peine/cartel.
  var root = document.getElementById('invisibilisation-root');
  if (root) {
    root.classList.remove('no-loader');
    root.style.opacity    = '';
    root.style.transition = '';
  }
}
// (attaché dans init())

/**
 * ⚠️ CE RETOUR N'A PAS DE VOILE, ET C'EST DÉLIBÉRÉ.
 *
 * Il y en avait un — quinze lignes qui posaient #chp2-fade au noir puis le
 * faisaient fondre sur 3 s. Il NE S'EST JAMAIS JOUÉ : la transition était
 * armée AVANT la montée au noir, si bien que la montée s'animait elle-même
 * puis se trouvait annulée dans la même tâche. Relevé au banc, opacité du
 * voile pendant tout ce retour : 0,00 — quand la même mesure donnait 36 % sur
 * « Peine démesurée », dont le code coupe bien la transition d'abord.
 *
 * Le bloc est retiré plutôt que réparé : le réparer AJOUTERAIT à l'écran un
 * fondu que personne n'a jamais vu, donc changerait la mise en scène. Ce n'est
 * pas un arbitrage de refactorisation, c'est un choix d'auteur — à faire
 * sciemment, en le regardant, pas en corrigeant un bug.
 *
 * Ce qui couvre ici, c'est le canvas d'obscurité : les bougies ont été
 * éteintes à l'entrée, il est donc plein noir. C'est sous lui que resume()
 * resynchronise, et c'est le rallumage progressif qui fait le retour.
 */
function _onInvisibilisationReturn() {
  if (!_active) return;
  _subOpen = false;
  resume();                       // sous le canvas noir — idempotent
  document.body.classList.remove('invisibilisation-open');
  setTimeout(showOpeningArrow, 2800);
  applyProgressLighting({ ms: LIGHT.returnMs });
  audio.fadeIn(0.72, LIGHT.returnMs);
}
// (attaché dans init())

function _onPeineClosed() {
  if (!_active) return;
  _subOpen = false;
  resume();                       // idempotent — _onPeineReturn suit
  document.body.classList.remove('peine-demesuree-open');
  // Flèche opening réaffichée via 'peineDemesuree:return' (après rallumage).
}
// (attaché dans init())

function _onPeineReturn() {
  if (!_active) return;
  _subOpen = false;
  document.body.classList.remove('peine-demesuree-open');
  if (_arrowShow) setTimeout(showOpeningArrow, 2800);

  // RÈGLE I — couvrir, reprendre, découvrir. Voir _onCartelReturn.
  if (fadeEl) fadeEl.style.zIndex = '10001';
  Blackout.cover(fadeEl);
  resume();
  applyProgressLighting({ ms: LIGHT.returnMs });
  audio.fadeIn(0.72, LIGHT.returnMs);
  Blackout.reveal(fadeEl, 2500).then(function() {
    if (fadeEl) fadeEl.style.zIndex = '';
  });
}
// (attaché dans init())

/* =============================================================================
   SRT + AUDIO
============================================================================= */
function parseSRT(raw) {
  var cues = [];
  var blocks = raw.trim().split(/\n\s*\n/);
  var timeRe = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/;
  for (var i = 0; i < blocks.length; i++) {
    var lines = blocks[i].trim().split(/\n/);
    if (lines.length < 2) continue;
    var timeLine = -1;
    for (var j = 0; j < lines.length; j++) {
      if (lines[j].indexOf('-->') !== -1) { timeLine = j; break; }
    }
    if (timeLine === -1) continue;
    var m = lines[timeLine].match(timeRe);
    if (!m) continue;
    var toMs = function(h, min, s, ms) {
      return (parseInt(h,10)*3600 + parseInt(min,10)*60 + parseInt(s,10))*1000 + parseInt(ms,10);
    };
    var start = toMs(m[1], m[2], m[3], m[4]);
    var end   = toMs(m[5], m[6], m[7], m[8]);
    var text  = lines.slice(timeLine + 1).join('\n').trim();
    if (text) cues.push({ start: start, end: end, text: text });
  }
  return cues.sort(function(a,b) { return a.start - b.start; });
}

/* =============================================================================
   INIT — pattern factory, exécuté à CHAQUE entrée dans le chapitre
   ─────────────────────────────────────────────────────────────────────────────
   Le module n'a AUCUN effet de bord au chargement : tout ce qui touche le DOM
   (refs, listeners, boucles rAF, LightSystem, ResizeObserver) est posé ici,
   contre le DOM fraîchement réinjecté par Chapitre2Scene. stopChapitre2()
   défait tout. Remplace l'ancien setup top-level + cache-bust d'import().
============================================================================= */
var _inited = false;

function init() {
  if (_inited) return;
  _inited = true;

  /* ── Références DOM ── */
  imgEl     = document.getElementById("chp2-img");
  bar       = document.getElementById("chp2-bar");
  hotCursor = document.getElementById('cursor');
  chp2Root  = document.getElementById('chapitre2-root');
  legend    = document.getElementById("chp2-legend");
  legNum    = document.getElementById("chp2-leg-num");
  legLab    = document.getElementById("chp2-leg-label");
  shakeEl   = document.getElementById("chp2-shake");
  fadeEl    = document.getElementById("chp2-fade");
  SKULLS.forEach(function(s) { s.el = document.getElementById("chp2-ov-" + s.id); });

  /* ── Reset de l'état (ré-entrée propre sans réévaluation du module) ── */
  interactive = false; hoveredSkull = null;
  _suspended = false;   // sinon startLoops() serait sans effet à la 2ᵉ visite
  lastClientX = 0; lastClientY = 0; lastMt = 0; lastMx2 = 0; lastMy2 = 0;
  velocity = 0; shakeMul = 1;
  vpH = 0; vpW = 0; imgW = 0; maxTx = 0; targetX = 0; currentX = 0; ratio = 0;
  started = false; _skullHot = false; _handCursor = false; navigating = false;

  /* ── Mouvement (souris + touch) ── */
  _mousemoveHandler = function(e) { onMove(e.clientX, e.clientY); };
  window.addEventListener("mousemove", _mousemoveHandler);

  _touchmoveHandler = function(e) {
    // Une sous-partie ouverte gère elle-même le tactile : peine-demesuree
    // DÉFILE (overflow-y:auto), cartel/invisibilisation ont leurs propres gestes.
    // L'opening ne doit alors NI paner NI preventDefault — sinon le défilement du
    // doigt dans la sous-partie est bloqué. (peine-demesuree était oublié ici.)
    if (document.body.classList.contains('cartel-open')
     || document.body.classList.contains('invisibilisation-open')
     || document.body.classList.contains('peine-demesuree-open')) return;
    e.preventDefault();
    // On transmet AUSSI clientY : le survol des crânes au GLISSÉ du doigt en
    // dépend (fy = clientY / vpH dans updateHover). Sans lui, le doigt restait
    // « en haut » (fy = 0) et aucun crâne ne s'allumait pendant le glissé.
    var t = e.touches[0];
    onMove(t.clientX, t.clientY);
  };
  window.addEventListener("touchmove", _touchmoveHandler, { passive: false });

  /* ── Clic — invisibilisation | cartel | peine-demesuree | navigation ── */
  _clickHandler = function(e) {
    if (document.body.classList.contains('cartel-open') || document.body.classList.contains('invisibilisation-open')) return;
    if (navigating) return;
    if (!hoveredSkull) return;

    if (hoveredSkull.action === "invisibilisation") {
      openInvisibilisationOverlay();
      return;
    }

    if (hoveredSkull.action === "cartel") {
      openCartelOverlay();
      return;
    }

    if (hoveredSkull.action === "peine-demesuree") {
      openPeineDemesureeOverlay();
      return;
    }

    /* Navigation externe → remplacée par signal vers Chapitre2Scene */
    if (!hoveredSkull.url) return;
    navigating = true;

    if (legend) legend.classList.remove("visible");
    if (cursor) cursor.classList.remove("visible");
    if (hoveredSkull.el) hoveredSkull.el.classList.remove("visible");

    light.animateAll(0, 1600, 0);

    setTimeout(function() { if (fadeEl) fadeEl.classList.add("out"); }, 200);
    setTimeout(function() {
      window.dispatchEvent(new CustomEvent('chp2:navigate-back'));
    }, 2000);
  };
  window.addEventListener("click", _clickHandler);

  /* ── Mesure initiale + boucles d'animation ── */
  measure();

  startLoops();

  /* ── LightSystem (une lumière par crâne) ── */
  light = new LightSystem("chp2-shake");
  SKULLS.forEach(function(s, i) {
    light.addLight({
      id:      s.id,
      phaseMs: i * 733,   // déphasage du scintillement pour éviter le synchronisme
      getCenter: (function(skull) {
        return function() {
          var cxImg = ((skull.box.x0 + skull.box.x1) / 2) * imgW;
          var cyImg = ((skull.box.y0 + skull.box.y1) / 2) * vpH;
          return { x: currentX + cxImg, y: cyImg };
        };
      })(s)
    });
  });

  /* ── Resize ── */
  _resizeObs = new ResizeObserver(function() {
    measure();
    light.resize();
  });
  _resizeObs.observe(document.documentElement);

  /* ── Événements des sous-parties ── */
  window.addEventListener('cartel:return',          _onCartelReturn);
  window.addEventListener('invisibilisation:closed',  _onInvisibilisationClosed);
  window.addEventListener('invisibilisation:return',  _onInvisibilisationReturn);
  window.addEventListener('peine-demesuree:closed', _onPeineClosed);
  window.addEventListener('peineDemesuree:return',  _onPeineReturn);
}

/* =============================================================================
   EXPORTS PUBLICS — appelés par Chapitre2Scene.js
   ─────────────────────────────────────────────────────────────────────────────
   startChapitre2() : init() (factory) puis ignition dès que l'image est prête.
   stopChapitre2()  : fade audio, stoppe les boucles, détruit le LightSystem.
============================================================================= */

/**
 * Chapitre2Scene injecte ses callbacks pour contrôler la flèche opening.
 * @param {Function} showFn  — affiche la flèche avec animation ArrowBase
 * @param {Function} hideFn  — masque la flèche avec animation
 */
export function setArrowCallbacks(showFn, hideFn) {
  _arrowShow = showFn;
  _arrowHide = hideFn;
}

/**
 * Injection du gestionnaire audio partagé (AudioManager).
 * Toute l'ambiance du chapitre 2 transite désormais par lui (piste 'chp2').
 */
export function setAudioManager(mgr) {
  _audio = mgr;
}

/**
 * Sortie cinématographique opening → Espace collaboratif.
 * Déclenchée par le clic sur la flèche opening (Chapitre2Scene).
 * Éteint progressivement la bougie + le son, fond au noir, puis signale
 * 'chp2:navigate-back' à Chapitre2Scene qui effectue la navigation réelle.
 * Idempotente via le verrou `navigating`.
 */
export function leaveToCollaboration() {
  if (navigating) return;
  navigating = true;

  if (_arrowHide) _arrowHide();
  if (legend) legend.classList.remove('visible');
  if (cursor) cursor.classList.remove('visible');
  if (hoveredSkull && hoveredSkull.el) hoveredSkull.el.classList.remove('visible');

  // Extinction progressive de toutes les lumières + fondu sonore
  light.animateAll(0, 1600, 0);
  audio.fadeOut(1600);

  // Fondu au noir, puis signal de navigation
  setTimeout(function() { if (fadeEl) fadeEl.classList.add('out'); }, 200);
  setTimeout(function() {
    window.dispatchEvent(new CustomEvent('chp2:navigate-back'));
  }, 2000);
}

/**
 * @param {Object} [opts]
 * @param {string} [opts.part]  ouvrir DIRECTEMENT une sous-partie déjà visitée
 *   ('invisibilisation' | 'peine-demesuree' | 'cartel'), sans allumer les
 *   bougies. Employé par la carte du parcours.
 *
 *   ⚠️ POURQUOI LES BOUGIES NE S'ALLUMENT PAS. Chaque ouverture de sous-partie
 *   COMMENCE par les éteindre (light.animateAll(0, …)). Rejouer l'entrée
 *   complète coûterait 2,6 s d'attente + 5 s d'allumage, pour souffler les
 *   bougies 2 s plus tard : douze secondes pour arriver là où l'on a demandé
 *   d'aller tout de suite. On saute donc l'ignition — et le code d'ouverture
 *   fonctionne INCHANGÉ, puisqu'éteindre un noir est un non-événement. Ce qui
 *   est préservé, c'est la mise en scène de la DESTINATION : la sous-partie
 *   joue la sienne intégralement.
 */
export function startChapitre2(opts) {
  init();
  if (!imgEl) {
    console.error('[Chapitre2] #chp2-img introuvable');
    return;
  }
  _active = true;

  var direct = opts && opts.part;
  var lancer = direct
    ? function () {
        if (!_active) return;
        // measure() d'abord : les lumières et les zones dérivent de imgW.
        measure();
        light.show();
        // Le rideau se lève sur un noir plein — c'est ce que la scène attend
        // pour émettre son signal de disponibilité.
        window.dispatchEvent(new CustomEvent('chp2:opening-ready'));
        interactive = true;
        openPart(opts.part);
      }
    : safeIgnite;

  if (imgEl.complete && imgEl.naturalWidth > 0) {
    lancer();
  } else {
    imgEl.addEventListener("load",  lancer, { once: true });
    imgEl.addEventListener("error", lancer, { once: true });
    var _igniteTimeout = setTimeout(lancer, 10000);
    imgEl.addEventListener("load", function() { clearTimeout(_igniteTimeout); }, { once: true });
  }
}

/**
 * Ouvre une sous-partie sans passer par le clic sur un crâne.
 *
 * GARDE : on n'ouvre que ce qui est DÉVERROUILLÉ, exactement comme le survol.
 * En pratique la carte ne propose que du déjà-visité, et « visité » est
 * toujours inclus dans « déverrouillé » (computeUnlocked renvoie un préfixe) —
 * mais la garde reste : ce point d'entrée est public, il ne doit pas pouvoir
 * contourner la progression des crânes.
 *
 * @param {string} part  'invisibilisation' | 'peine-demesuree' | 'cartel'
 * @returns {boolean} true si l'ouverture a été lancée
 */
export function openPart(part) {
  if (!_active || navigating || _subOpen) return false;

  var skull = null;
  for (var i = 0; i < SKULLS.length; i++) {
    if (SKULLS[i].action === part) { skull = SKULLS[i]; break; }
  }
  if (!skull) { console.warn('[Chapitre2] openPart : sous-partie inconnue « ' + part + ' »'); return false; }

  if (computeUnlocked(SKULL_ORDER).indexOf(skull.id) === -1) {
    console.warn('[Chapitre2] openPart : le crâne ' + skull.id + ' n’est pas déverrouillé.');
    return false;
  }

  if (part === 'invisibilisation')    { openInvisibilisationOverlay(); return true; }
  if (part === 'peine-demesuree')     { openPeineDemesureeOverlay();   return true; }
  if (part === 'cartel')              { openCartelOverlay();           return true; }
  return false;
}

export function stopChapitre2() {
  /* 0. Désactivation : neutralise tout callback asynchrone encore en vol,
        et réarme init() pour la prochaine entrée (pattern factory). */
  _active = false;
  _inited = false;

  /* 0bis. Reset des états pour permettre une ré-entrée propre */
  _arrowShow = null;
  _arrowHide = null;
  _arrowShownOnce = false;
  _subOpen = false;
  _ignited = false;
  setSkullHot(false);
  setHandCursor(false);
  navigating = false;
  interactive = false;
  _suspended = false;
  SKULLS.forEach(function(s) { s.active = false; });

  /* 1. Stopper l'audio centralisé (piste chp2 / fredonnement) */
  audio.stop();

  /* 2. Purger les timers de la séquence d'allumage */
  _igniteTimers.forEach(function(id) { clearTimeout(id); });
  _igniteTimers = [];

  /* 3. Stopper les boucles RAF */
  if (_travelRaf) { cancelAnimationFrame(_travelRaf); _travelRaf = null; }
  if (_shakeRaf)  { cancelAnimationFrame(_shakeRaf);  _shakeRaf  = null; }

  /* 4. Détruire le LightSystem (canvas + RAF internes) */
  if (light) light.destroy();
  light = null;

  /* 5. Déconnecter TOUS les listeners window (mouvement + events sous-parties) */
  if (_mousemoveHandler)  window.removeEventListener("mousemove", _mousemoveHandler);
  if (_touchmoveHandler)  window.removeEventListener("touchmove", _touchmoveHandler);
  if (_clickHandler)      window.removeEventListener("click",     _clickHandler);
  window.removeEventListener('cartel:return',          _onCartelReturn);
  window.removeEventListener('invisibilisation:closed',  _onInvisibilisationClosed);
  window.removeEventListener('invisibilisation:return',  _onInvisibilisationReturn);
  window.removeEventListener('peine-demesuree:closed', _onPeineClosed);
  window.removeEventListener('peineDemesuree:return',  _onPeineReturn);

  /* 6. Déconnecter le ResizeObserver */
  if (_resizeObs) { _resizeObs.disconnect(); _resizeObs = null; }

  /* 7. Fermer proprement les sous-modules si ouverts */
  ['cartel-open', 'invisibilisation-open', 'peine-demesuree-open'].forEach(function(cls) {
    document.body.classList.remove(cls);
  });

  /* 8. LÂCHER LES RÉFÉRENCES DOM.
     ─────────────────────────────────────────────────────────────────────────
     Ce module est importé UNE FOIS et vit autant que la page (pattern factory,
     sans cache-bust). Entre la sortie et une éventuelle ré-entrée, ces
     variables pointeraient sinon sur des nœuds d'un #chapitre2-root démonté —
     et rien ne garantit qu'il y AURA une ré-entrée pour les réassigner.

     ⚠️ CE N'EST PAS CE QUI CAUSAIT LA FUITE DU CHAPITRE. Mesuré : nuller ces
     variables ne change RIEN au nombre d'arbres détachés retenus. Le vrai
     coupable était le moteur média du navigateur, qui retient un <video>/
     <audio> non libéré — et avec lui tout son arbre. La correction vit dans
     Chapitre2Scene._removeDOM() (voir releaseMediaElements dans helpers.js).
     Ce bloc-ci est de l'hygiène, pas un correctif : ne pas lui prêter un
     pouvoir qu'il n'a pas. */
  imgEl = bar = cursor = hotCursor = chp2Root = null;
  legend = legNum = legLab = null;
  shakeEl = fadeEl = null;
  SKULLS.forEach(function(s) { s.el = null; });
  hoveredSkull = null;
}
