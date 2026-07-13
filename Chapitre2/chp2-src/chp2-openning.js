/**
 * chp2-openning.js — Logique du travelling panoramique.
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

LightSystem.prototype._startLoop = function() {
  if (this.raf) return;
  var self = this;
  var loop = function(t) {
    if (!self.raf) return; // stoppé par destroy()
    self.raf = requestAnimationFrame(loop);
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
// Référence au curseur custom global (#cursor) : l'openning pilote directement
// son état .hotspot au survol d'un crâne. Aucun conflit avec app.js car tout le
// travelling est en pointer-events:none (aucune frontière DOM survolée ici).
var hotCursor = null;
// État de survol d'un crâne. setSkullHot est DÉCLENCHÉ SUR TRANSITION : il ne
// modifie #cursor.hotspot que lorsqu'on entre/sort réellement d'un crâne. Ainsi,
// quand le curseur n'est PAS sur un crâne (sur la flèche d'openning, par ex.),
// l'appel répété setSkullHot(false) est un no-op et ne retire pas le hotspot
// qu'app.js vient de poser sur la flèche / le bouton plein écran.
var _skullHot = false;
function setSkullHot(on) {
  on = !!on;
  if (on === _skullHot) return;
  _skullHot = on;
  if (hotCursor) hotCursor.classList.toggle('hotspot', on);
}
var legend  = null;
var legNum  = null;
var legLab  = null;
var shakeEl = null;
var fadeEl  = null;

/* =============================================================================
   CRÂNES — zones de clic fractionnaires
============================================================================= */
var SKULLS = [
  {
    id:     "136",
    box:    { x0: 0.12, y0: 0.220, x1: 0.300, y1: 0.700 },
    num:    "136",
    label:  "Taire le passé",
    url:    null,
    action: "invibilisation",
    active: false,
    el:     null   // résolu dans init() : chp2-ov-<id>
  },
  {
    id:     "137",
    box:    { x0: 0.550, y0: 0.180, x1: 0.740, y1: 0.730 },
    num:    "137",
    label:  "Une peine démesurée",
    url:    null,
    action: "peine-demesuree",
    active: false,
    el:     null
  },
  {
    id:     "138",
    box:    { x0: 0.80, y0: 0.170, x1: 1.0, y1: 0.640 },
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
  if (document.body.classList.contains('cartel-open') || document.body.classList.contains('invibilisation-open') || document.body.classList.contains('peine-demesuree-open')) {
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
    return;
  }
  if (!interactive) {
    if (hoveredSkull) hoveredSkull.el && hoveredSkull.el.classList.remove("visible");
    hoveredSkull = null;
    if (legend) legend.classList.remove("visible");
    if (cursor) cursor.classList.remove("clickable");
    setSkullHot(false);
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
   CLIC — invibilisation | cartel | peine-demesuree | navigation retour
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
   PONT FLÈCHE OPENNING ↔ Chapitre2Scene
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
   cours d'ouverture), false dès qu'on revient à l'openning. Empêche par
   construction qu'un timer différé (ignition / retour) ne (re)dessine la
   flèche openning par-dessus une sous-partie. */
var _subOpen = false;

/* Afficheur gardé de la flèche openning : ne dessine QUE si l'openning est
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
   puis active l'interactivité, puis fait apparaître la flèche openning.
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
      // Afficher la flèche openning ~600ms après le début de l'allumage
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
  if (legend) legend.classList.remove("visible");
  if (hoveredSkull && hoveredSkull.el) hoveredSkull.el.classList.remove("visible");
  if (_arrowHide) _arrowHide();
  audio.duck(800);
  document.body.classList.add('peine-demesuree-open');

  light.animateAll(0, 2000, 0).then(function() {
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
      audio.unduck(400);
      applyProgressLighting({ ms: 800 });
    });
  });
}

function openCartelOverlay() {
  _subOpen = true;
  setSkullHot(false);
  if (legend) legend.classList.remove("visible");
  if (hoveredSkull && hoveredSkull.el) hoveredSkull.el.classList.remove("visible");
  if (_arrowHide) _arrowHide();
  audio.duck(800);
  light.animateAll(0, 2000, 0).then(function() {
    loadCartelModule().then(function(mod) {
      var ok = mod.openCartel();
      if (ok) {
        markVisited('138');   // « La violence et ses traces » vue (dernier crâne)
      } else {
        applyProgressLighting({ ms: 800 });
        audio.unduck(400);
      }
    }).catch(function(err) {
      console.error('[Cartel] Échec chargement :', err);
      applyProgressLighting({ ms: 800 });
      audio.unduck(400);
    });
  });
}

function _onCartelClosed() {
  if (!_active) return;
  _subOpen = false;
  document.body.classList.remove('cartel-open');
  showOpeningArrow();
}
// (attaché dans init())

function _onCartelReturn() {
  if (!_active) return;
  _subOpen = false;
  document.body.classList.remove('cartel-open');
  setTimeout(showOpeningArrow, 2800);
  if (fadeEl) {
    fadeEl.style.zIndex     = '10001';
    fadeEl.style.transition = 'opacity 0s';
    fadeEl.classList.add('out');
    void fadeEl.offsetWidth;
    fadeEl.style.transition = 'opacity 2.5s ease';
    fadeEl.classList.remove('out');
  }
  applyProgressLighting({ ms: LIGHT.returnMs });
  audio.fadeIn(0.72, LIGHT.returnMs);
  setTimeout(function() {
    if (fadeEl) { fadeEl.style.zIndex = ''; fadeEl.style.transition = ''; }
  }, 2600);
}
// (attaché dans init())

/* =============================================================================
   PONT TRAVELLING ⇄ INVIBILISATION (lazy)
============================================================================= */
var invibilisationModulePromise = null;

function loadInvibilisationModule() {
  if (!invibilisationModulePromise) {
    invibilisationModulePromise = import('./chp2-invibilisation.js');
  }
  return invibilisationModulePromise;
}

var peineDemesureeModulePromise = null;

function loadPeineDemesureeModule() {
  if (!peineDemesureeModulePromise) {
    peineDemesureeModulePromise = import('./chp2-peine-demesuree.js');
  }
  return peineDemesureeModulePromise;
}

function openInvibilisationOverlay() {
  if (document.body.classList.contains('invibilisation-open')) return;
  _subOpen = true;
  setSkullHot(false);
  if (legend) legend.classList.remove("visible");
  if (hoveredSkull && hoveredSkull.el) hoveredSkull.el.classList.remove("visible");
  if (_arrowHide) _arrowHide();
  document.body.classList.add('invibilisation-open');

  // 1) Clic 136 : extinction progressive des bougies + coupure du son chp2 +
  //    fondu au noir par-dessus le travelling (fadeEl au-dessus de l'overlay).
  if (fadeEl) {
    fadeEl.style.zIndex     = '10001';
    fadeEl.style.transition = 'opacity 1200ms ease';
    fadeEl.classList.add('out');
  }
  light.animateAll(0, 1200, 0);
  audio.fadeOut(1200);

  // 2) Une fois au noir, monter l'installation DERRIÈRE le voile (elle démarre
  //    elle-même sur fond noir, sans barre de chargement), puis retirer le voile
  //    sans transition : le noir de l'overlay prend le relais à l'identique, et
  //    l'installation gère son propre allumage progressif (révélation du loader).
  setTimeout(function() {
    if (!_active || !document.body.classList.contains('invibilisation-open')) return;
    loadInvibilisationModule().then(function(mod) {
      var ok = mod.openInvibilisation();
      if (ok) markVisited('136');   // « Invisibilisation » vue → débloque le crâne 137
      requestAnimationFrame(function() {
        if (fadeEl) {
          fadeEl.classList.remove('out');
          fadeEl.style.transition = '';
          fadeEl.style.zIndex     = '';
        }
      });
    }).catch(function(err) {
      console.error('[Invibilisation] Échec chargement :', err);
      document.body.classList.remove('invibilisation-open');
      if (fadeEl) {
        fadeEl.classList.remove('out');
        fadeEl.style.transition = '';
        fadeEl.style.zIndex     = '';
      }
      applyProgressLighting({ ms: 800 });
      audio.fadeIn(0.72, 800);
    });
  }, 1200);
}

function _onInvibilisationClosed() {
  if (!_active) return;
  _subOpen = false;
  document.body.classList.remove('invibilisation-open');
  audio.unduck(1200);
  // La flèche openning réapparaît via 'invibilisation:return' (après rallumage
  // progressif de la bougie), pour rester cohérent avec peine/cartel.
  var root = document.getElementById('invibilisation-root');
  if (root) {
    root.classList.remove('no-loader');
    root.style.opacity    = '';
    root.style.transition = '';
  }
}
// (attaché dans init())

function _onInvibilisationReturn() {
  if (!_active) return;
  _subOpen = false;
  document.body.classList.remove('invibilisation-open');
  setTimeout(showOpeningArrow, 2800);
  applyProgressLighting({ ms: LIGHT.returnMs });
  audio.fadeIn(0.72, LIGHT.returnMs);
  if (fadeEl) {
    fadeEl.style.zIndex = '10001';
    fadeEl.style.transition = 'opacity 3s ease';
    fadeEl.classList.add('out');
    void fadeEl.offsetWidth;
    fadeEl.classList.remove('out');
    setTimeout(function() {
      fadeEl.style.zIndex = '';
      fadeEl.style.transition = '';
    }, 3100);
  }
}
// (attaché dans init())

function _onPeineClosed() {
  if (!_active) return;
  _subOpen = false;
  document.body.classList.remove('peine-demesuree-open');
  // Flèche openning réaffichée via 'peineDemesuree:return' (après rallumage).
}
// (attaché dans init())

function _onPeineReturn() {
  if (!_active) return;
  _subOpen = false;
  document.body.classList.remove('peine-demesuree-open');
  if (_arrowShow) setTimeout(showOpeningArrow, 2800);
  if (fadeEl) {
    fadeEl.style.zIndex     = '10001';
    fadeEl.style.transition = 'opacity 0s';
    fadeEl.classList.add('out');
    void fadeEl.offsetWidth;
    fadeEl.style.transition = 'opacity 2.5s ease';
    fadeEl.classList.remove('out');
  }
  applyProgressLighting({ ms: LIGHT.returnMs });
  audio.fadeIn(0.72, LIGHT.returnMs);
  setTimeout(function() {
    if (fadeEl) { fadeEl.style.zIndex = ''; fadeEl.style.transition = ''; }
  }, 2600);
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
  legend    = document.getElementById("chp2-legend");
  legNum    = document.getElementById("chp2-leg-num");
  legLab    = document.getElementById("chp2-leg-label");
  shakeEl   = document.getElementById("chp2-shake");
  fadeEl    = document.getElementById("chp2-fade");
  SKULLS.forEach(function(s) { s.el = document.getElementById("chp2-ov-" + s.id); });

  /* ── Reset de l'état (ré-entrée propre sans réévaluation du module) ── */
  interactive = false; hoveredSkull = null;
  lastClientX = 0; lastClientY = 0; lastMt = 0; lastMx2 = 0; lastMy2 = 0;
  velocity = 0; shakeMul = 1;
  vpH = 0; vpW = 0; imgW = 0; maxTx = 0; targetX = 0; currentX = 0; ratio = 0;
  started = false; _skullHot = false; navigating = false;

  /* ── Mouvement (souris + touch) ── */
  _mousemoveHandler = function(e) { onMove(e.clientX, e.clientY); };
  window.addEventListener("mousemove", _mousemoveHandler);

  _touchmoveHandler = function(e) {
    if (document.body.classList.contains('cartel-open') || document.body.classList.contains('invibilisation-open')) return;
    e.preventDefault();
    onMove(e.touches[0].clientX, null);
  };
  window.addEventListener("touchmove", _touchmoveHandler, { passive: false });

  /* ── Clic — invibilisation | cartel | peine-demesuree | navigation ── */
  _clickHandler = function(e) {
    if (document.body.classList.contains('cartel-open') || document.body.classList.contains('invibilisation-open')) return;
    if (navigating) return;
    if (!hoveredSkull) return;

    if (hoveredSkull.action === "invibilisation") {
      openInvibilisationOverlay();
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

  // Boucle de travelling (interpolation douce)
  (function travelLoop() {
    var d = targetX - currentX;
    currentX = Math.abs(d) < 0.05 ? targetX : currentX + d * 0.08;
    applyTx(currentX);
    _travelRaf = requestAnimationFrame(travelLoop);
  })();

  // Boucle de tremblement organique
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
  window.addEventListener('cartel:closed',          _onCartelClosed);
  window.addEventListener('cartel:return',          _onCartelReturn);
  window.addEventListener('invibilisation:closed',  _onInvibilisationClosed);
  window.addEventListener('invibilisation:return',  _onInvibilisationReturn);
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
 * Chapitre2Scene injecte ses callbacks pour contrôler la flèche openning.
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
 * Sortie cinématographique openning → Espace collaboratif.
 * Déclenchée par le clic sur la flèche openning (Chapitre2Scene).
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

export function startChapitre2() {
  init();
  if (!imgEl) {
    console.error('[Chapitre2] #chp2-img introuvable');
    return;
  }
  _active = true;
  if (imgEl.complete && imgEl.naturalWidth > 0) {
    safeIgnite();
  } else {
    imgEl.addEventListener("load",  safeIgnite, { once: true });
    imgEl.addEventListener("error", safeIgnite, { once: true });
    var _igniteTimeout = setTimeout(safeIgnite, 10000);
    imgEl.addEventListener("load", function() { clearTimeout(_igniteTimeout); }, { once: true });
  }
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
  navigating = false;
  interactive = false;
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

  /* 5. Déconnecter TOUS les listeners window (mouvement + events sous-parties) */
  if (_mousemoveHandler)  window.removeEventListener("mousemove", _mousemoveHandler);
  if (_touchmoveHandler)  window.removeEventListener("touchmove", _touchmoveHandler);
  if (_clickHandler)      window.removeEventListener("click",     _clickHandler);
  window.removeEventListener('cartel:closed',          _onCartelClosed);
  window.removeEventListener('cartel:return',          _onCartelReturn);
  window.removeEventListener('invibilisation:closed',  _onInvibilisationClosed);
  window.removeEventListener('invibilisation:return',  _onInvibilisationReturn);
  window.removeEventListener('peine-demesuree:closed', _onPeineClosed);
  window.removeEventListener('peineDemesuree:return',  _onPeineReturn);

  /* 6. Déconnecter le ResizeObserver */
  if (_resizeObs) { _resizeObs.disconnect(); _resizeObs = null; }

  /* 7. Fermer proprement les sous-modules si ouverts */
  ['cartel-open', 'invibilisation-open', 'peine-demesuree-open'].forEach(function(cls) {
    document.body.classList.remove(cls);
  });
}
