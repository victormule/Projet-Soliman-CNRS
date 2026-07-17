/**
 * TorchSystem.js
 *
 */

import { O, osc } from '../utils/oscillators.js';

export class TorchSystem {
  constructor(config) {
    this.config = config;
    this.canvas = document.getElementById('overlay-canvas');
    this.ctx    = this.canvas.getContext('2d');

    this.mouseX = 0;
    this.mouseY = 0;
    this.torchX = 0;
    this.torchY = 0;
    // TOUT est fraction de min(W,H) : le rayon en pixels se recalcule à chaque
    // frame et à chaque resize. _baseFrac = la torche telle qu'elle est ;
    // _targetFrac = celle qu'elle rejoint (posée par setTarget, animée par grow).
    this.torchBaseRadius = 0;
    this._baseFrac       = 0;
    this._targetFrac     = 0;
    this.centered        = false;
    this.growAnimId      = null;

    this._fadeAnimId = null;  // ← Séparé de growAnimId pour éviter collision

    /**
     * Gel du rendu. Quand un overlay PLEIN ÉCRAN et OPAQUE recouvre la scène
     * (documents / « À Propos »), la torche est invisible : inutile de repeindre
     * 6 dégradés radiaux plein écran à chaque frame. On libère ainsi tout le
     * budget de frame pour l'animation de l'overlay. Le dernier cadre reste tel
     * quel sur le canvas (masqué par le fond de l'overlay), et le suivi de la
     * souris reprend naturellement à la reprise.
     */
    this._paused = false;

    this.initCanvas();
    this.initMouse();
    this.startRenderLoop();
  }

  /** Gèle le rendu de la torche (overlay opaque ouvert). Idempotent. */
  pause()  { this._paused = true; }

  /** Reprend le rendu de la torche (overlay fermé). Idempotent. */
  resume() { this._paused = false; }

  /* ─────────────────────────────────────── Canvas ── */

  _vW() { return Math.max(this.config.MIN_SIZE.width,  window.innerWidth);  }
  _vH() { return Math.max(this.config.MIN_SIZE.height, window.innerHeight); }

  initCanvas() {
    this.canvas.width  = this._vW();
    this.canvas.height = this._vH();
  }

  /* ─────────────────────────────────────── Souris ── */

  initMouse() {
    const track = e => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    };
    // pointermove : suivi continu ; pointerdown : cible immédiate au 1ᵉʳ contact.
    document.addEventListener('pointermove', track, { passive: true });
    document.addEventListener('pointerdown', track, { passive: true });
  }

  /* ─────────────────────────────── Cible torche ── */

  /**
   * La taille que la torche doit rejoindre, en fraction de min(W,H).
   * Usage scènes : torch.setTarget(CONFIG.VITRINE.torch.size), puis grow().
   *
   * C'est le SEUL chemin. Il exista jadis un updateTarget(page) qui devinait la
   * taille depuis un numéro de page et des alias CONFIG.TORCH.taille_* : il
   * écrivait un `torchTargetRadius` que grow() n'a jamais lu, depuis un
   * `currentPage` que personne n'écrivait. Trois réglages de config pour zéro
   * effet. Supprimé (audit de juillet 2026) — ne pas réintroduire de « cible »
   * en pixels : la fraction est la seule chose qui survive à un resize.
   */
  setTarget(fraction) {
    this._targetFrac = Math.max(0, fraction);
  }

  /**
   * Définit le rayon instantanément (sans animation).
   * Annule toute animation en cours.
   */
  /**
   * Définit le rayon instantanément (toujours 0 depuis les scènes — reset avant grow).
   * Conserve _targetFrac inchangé.
   */
  setRadius(r) {
    this.cancelGrow();
    this.cancelFade();
    const minDim = Math.min(this._vW(), this._vH());
    this._baseFrac = minDim > 0 ? r / minDim : 0;
    this.torchBaseRadius = r;
  }

  /**
   * Fige la torche AU CENTRE de l'écran (true), ou la rend au curseur (false).
   * Ne touche QUE le suivi : la TAILLE reste pilotée par setTarget()/grow().
   *
   * @param {boolean} on
   */
  setCentered(on) {
    this.centered = !!on;
  }

  /* ─────────────────────────── Méthodes d'animation ── */

  /**
   * Annule immédiatement toute animation grow en cours.
   */
  cancelGrow() {
    if (this.growAnimId) {
      cancelAnimationFrame(this.growAnimId);
      this.growAnimId = null;
    }
  }

  /**
   * Annule toute animation fadeOut en cours.
   */
  cancelFade() {
    if (this._fadeAnimId) {
      cancelAnimationFrame(this._fadeAnimId);
      this._fadeAnimId = null;
    }
  }

  /**
   * Allume la torche : anime _baseFrac → _targetFrac (posé par setTarget).
   * Travaille en fractions — le rayon en pixels suit min(W,H) à chaque frame.
   *
   * ⚠️ Cette méthode prenait naguère un premier argument « target » que les
   * appelants calculaient soigneusement… et qu'elle ignorait (il s'appelait
   * `targetIgnored` dans sa propre signature). C'est ce qui rendait muet le
   * réglage d'atténuation de la torche pendant les médias. Supprimé : la cible
   * se pose par setTarget(), et par là seulement.
   *
   * @param {number} durationMs
   */
  grow(durationMs) {
    this.cancelGrow();
    this.cancelFade();

    const startFrac = this._baseFrac;
    const endFrac   = this._targetFrac;
    const t0        = performance.now();

    const step = (now) => {
      const p = Math.min((now - t0) / Math.max(1, durationMs), 1);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      this._baseFrac = startFrac + (endFrac - startFrac) * e;
      // torchBaseRadius = valeur pixel courante (recalculée à chaque frame)
      this.torchBaseRadius = Math.min(this._vW(), this._vH()) * this._baseFrac;
      if (p < 1) {
        this.growAnimId = requestAnimationFrame(step);
      } else {
        this._baseFrac = endFrac;
        this.torchBaseRadius = Math.min(this._vW(), this._vH()) * this._baseFrac;
        this.growAnimId = null;
      }
    };
    this.growAnimId = requestAnimationFrame(step);
  }

  /**
   * Éteint la torche proprement.
   * @param {number} durationMs
   * @returns {Promise} Résout quand torchBaseRadius === 0
   */
  fadeOut(durationMs) {
    this.cancelGrow();
    this.cancelFade();

    const startFrac = this._baseFrac;
    const startT    = performance.now();

    return new Promise(resolve => {
      const step = (now) => {
        const p = Math.min((now - startT) / Math.max(1, durationMs), 1);
        const e = 1 - Math.pow(1 - p, 2); // ease-out quadratique
        this._baseFrac = startFrac * (1 - e);
        this.torchBaseRadius = Math.min(this._vW(), this._vH()) * this._baseFrac;

        if (p < 1) {
          this._fadeAnimId = requestAnimationFrame(step);
        } else {
          this._baseFrac = 0;
          this.torchBaseRadius = 0;
          this._fadeAnimId = null;
          resolve();
        }
      };
      this._fadeAnimId = requestAnimationFrame(step);
    });
  }

  /* ─────────────────────────────────────── Rendu ── */

  safeGrad(x0, y0, r0, x1, y1, r1) {
    if ([x0, y0, r0, x1, y1, r1].some(v => !isFinite(v) || isNaN(v))) return null;
    return this.ctx.createRadialGradient(
      x0, y0, Math.max(0, r0),
      x1, y1, Math.max(0.001, r1)
    );
  }

  render(t) {
    // Rendu gelé : la torche est cachée sous un overlay opaque. On saute tout le
    // travail (clear + 6 dégradés plein écran). Le callback rAF reste vivant mais
    // ne coûte rien → reprise instantanée à resume().
    if (this._paused) return;

    const W = this.canvas.width;
    const H = this.canvas.height;

    if (this.centered) {
      this.torchX = W / 2;
      this.torchY = H / 2;
    } else {
      this.torchX += (this.mouseX - this.torchX) * this.config.TORCH.lag;
      this.torchY += (this.mouseY - this.torchY) * this.config.TORCH.lag;
    }

    const active    = this.torchBaseRadius > 5;
    const cx        = this.torchX + (active ? osc(O.dx, t) : 0);
    const cy        = this.torchY + (active ? osc(O.dy, t) : 0);
    const intensity = 1 + osc(O.b1,t) + osc(O.b2,t) + osc(O.f1,t) + osc(O.f2,t) + osc(O.f3,t) + osc(O.f4,t);
    const r         = Math.max(0, this.torchBaseRadius * Math.max(0.72, intensity));
    const wp        = osc(O.w, t);

    this.ctx.clearRect(0, 0, W, H);
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, W, H);
    if (r < 1) return;

    this.ctx.globalCompositeOperation = 'destination-out';

    const g1 = this.safeGrad(cx, cy, 0, cx, cy, r * 3.4);
    if (g1) {
      g1.addColorStop(0,    'rgba(0,0,0,0.28)');
      g1.addColorStop(0.22, 'rgba(0,0,0,0.16)');
      g1.addColorStop(0.55, 'rgba(0,0,0,0.07)');
      g1.addColorStop(0.82, 'rgba(0,0,0,0.02)');
      g1.addColorStop(1,    'rgba(0,0,0,0)');
      this.ctx.beginPath(); this.ctx.arc(cx, cy, r * 3.4, 0, Math.PI * 2);
      this.ctx.fillStyle = g1; this.ctx.fill();
    }

    const g2 = this.safeGrad(cx, cy, 0, cx, cy, r * 2.0);
    if (g2) {
      g2.addColorStop(0,    'rgba(0,0,0,0.44)');
      g2.addColorStop(0.35, 'rgba(0,0,0,0.28)');
      g2.addColorStop(0.68, 'rgba(0,0,0,0.10)');
      g2.addColorStop(1,    'rgba(0,0,0,0)');
      this.ctx.beginPath(); this.ctx.arc(cx, cy, r * 2.0, 0, Math.PI * 2);
      this.ctx.fillStyle = g2; this.ctx.fill();
    }

    const g3 = this.safeGrad(cx, cy, 0, cx, cy, r);
    if (g3) {
      g3.addColorStop(0,    'rgba(0,0,0,0.78)');
      g3.addColorStop(0.28, 'rgba(0,0,0,0.68)');
      g3.addColorStop(0.58, 'rgba(0,0,0,0.42)');
      g3.addColorStop(0.82, 'rgba(0,0,0,0.16)');
      g3.addColorStop(1,    'rgba(0,0,0,0)');
      this.ctx.beginPath(); this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.fillStyle = g3; this.ctx.fill();
    }

    const rC = Math.max(1, r * (0.28 + Math.abs(osc(O.f1, t)) * 0.15));
    const gC = this.safeGrad(cx, cy, 0, cx, cy, rC);
    if (gC) {
      gC.addColorStop(0, 'rgba(0,0,0,0.18)');
      gC.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.beginPath(); this.ctx.arc(cx, cy, rC, 0, Math.PI * 2);
      this.ctx.fillStyle = gC; this.ctx.fill();
    }

    this.ctx.globalCompositeOperation = 'source-over';

    const wR = Math.max(1, r * 0.62 * Math.max(0.55, intensity));
    const wA = 0.048 + Math.abs(wp) * 0.028;
    const gW = this.safeGrad(cx, cy, 0, cx, cy, wR);
    if (gW) {
      const gb = Math.floor(Math.max(0, Math.min(255, 185 + wp * 14)));
      gW.addColorStop(0,    `rgba(255,${gb},70,${(wA * 1.5).toFixed(3)})`);
      gW.addColorStop(0.45, `rgba(255,170,55,${wA.toFixed(3)})`);
      gW.addColorStop(1,    'rgba(255,130,20,0)');
      this.ctx.beginPath(); this.ctx.arc(cx, cy, wR, 0, Math.PI * 2);
      this.ctx.fillStyle = gW; this.ctx.fill();
    }

    const vIn  = Math.max(0, r * 1.05);
    const vOut = Math.max(vIn + 1, Math.sqrt(W * W + H * H) * 0.72);
    const gV   = this.safeGrad(cx, cy, vIn, cx, cy, vOut);
    if (gV) {
      gV.addColorStop(0,   'rgba(0,0,0,0)');
      gV.addColorStop(0.2, 'rgba(0,0,0,0.18)');
      gV.addColorStop(0.6, 'rgba(0,0,0,0.55)');
      gV.addColorStop(1,   'rgba(0,0,0,0.92)');
      this.ctx.fillStyle = gV;
      this.ctx.fillRect(0, 0, W, H);
    }
  }

  startRenderLoop() {
    const loop = (t) => { this.render(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  /* ─────────────────────────────────────── Resize ── */

  resize() {
    this.canvas.width  = this._vW();
    this.canvas.height = this._vH();
    // La fraction est la source de vérité ; le rayon en pixels en découle.
    // (_targetFrac n'a rien à recalculer : c'est déjà une fraction.)
    this.torchBaseRadius = Math.min(this._vW(), this._vH()) * this._baseFrac;
  }
}
