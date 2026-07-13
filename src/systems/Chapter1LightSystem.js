import { O, osc } from '../utils/oscillators.js';

export class Chapter1LightSystem {
  constructor(config, mountId = 'app') {
    this.config = config;
    this.mount = document.getElementById(mountId) || document.body;
    this.canvas = null;
    this.ctx = null;
    this.raf = null;
    this.animRaf = null;

    this.visible = false;
    this.opacity = 0;
    this.radius = 0;
    this._radiusFrac = 0;
    this._resizeBound = () => this.resize();

    this._ensureCanvas();
    this.resize();
    window.addEventListener('resize', this._resizeBound, { passive: true });
    this._startLoop();
  }

  _ensureCanvas() {
    if (this.canvas) return;
    const canvas = document.createElement('canvas');
    canvas.id = 'chapter1-fixed-light';
    canvas.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:2',
      'pointer-events:none',
      'opacity:0',
      'display:none',
      'transition:opacity 220ms ease'
    ].join(';');
    this.mount.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  _vW() { return Math.max(this.config.MIN_SIZE?.width ?? 600, window.innerWidth); }
  _vH() { return Math.max(this.config.MIN_SIZE?.height ?? 450, window.innerHeight); }
  _minDim() { return Math.min(this._vW(), this._vH()); }

  resize() {
    if (!this.canvas) return;
    const w = this._vW();
    const h = this._vH();
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    if (this._radiusFrac > 0) this.radius = this._minDim() * this._radiusFrac;
  }

  show() {
    this.visible = true;
    if (!this.canvas) return;
    // Garantit que le canvas est aux bonnes dimensions au moment de l'affichage.
    // Sans cet appel, si show() est appelé avant le premier resize() post-layout,
    // le canvas conserve ses dimensions par défaut (300×150) et le gradient
    // est rendu sur une surface tronquée — les paramètres de config sont ignorés.
    this.resize();
    this.canvas.style.display = 'block';
    this.canvas.style.opacity = '1';
  }

  hide(immediate = false) {
    this.visible = false;
    if (!this.canvas) return;
    if (immediate) {
      this.radius = 0;
      this.opacity = 0;
      this._radiusFrac = 0;
      this.canvas.style.opacity = '0';
      this.canvas.style.display = 'none';
      this._clear();
      return;
    }
    this.canvas.style.opacity = '0';
    setTimeout(() => {
      if (!this.visible && this.canvas) this.canvas.style.display = 'none';
    }, 260);
  }

  set(radiusPx, opacity = 1) {
    this.radius = Math.max(0, radiusPx);
    this.opacity = Math.max(0, Math.min(1, opacity));
    this._radiusFrac = this._minDim() > 0 ? this.radius / this._minDim() : 0;
  }

  setFraction(radiusFrac, opacity = 1) {
    this._radiusFrac = Math.max(0, radiusFrac);
    this.radius = this._minDim() * this._radiusFrac;
    this.opacity = Math.max(0, Math.min(1, opacity));
  }

  animateTo(targetRadiusPx, durationMs, targetOpacity = 1) {
    const targetFrac = this._minDim() > 0 ? targetRadiusPx / this._minDim() : 0;
    return this.animateToFraction(targetFrac, durationMs, targetOpacity);
  }

  animateToFraction(targetRadiusFrac, durationMs, targetOpacity = 1) {
    if (this.animRaf) cancelAnimationFrame(this.animRaf);

    const startFrac = this._radiusFrac;
    const startOpacity = this.opacity;
    const targetFrac = Math.max(0, targetRadiusFrac);
    const t0 = performance.now();

    return new Promise(resolve => {
      const step = (now) => {
        const p = Math.min((now - t0) / Math.max(1, durationMs), 1);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        this._radiusFrac = startFrac + (targetFrac - startFrac) * e;
        this.radius = this._minDim() * this._radiusFrac;
        this.opacity = startOpacity + (targetOpacity - startOpacity) * e;

        if (p < 1) {
          this.animRaf = requestAnimationFrame(step);
        } else {
          this.animRaf = null;
          this._radiusFrac = targetFrac;
          this.radius = this._minDim() * this._radiusFrac;
          this.opacity = targetOpacity;
          if (targetOpacity <= 0.001 || targetFrac <= 0.0001) this.hide(true);
          resolve();
        }
      };
      this.animRaf = requestAnimationFrame(step);
    });
  }

  _clear() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  _safeGrad(x0, y0, r0, x1, y1, r1) {
    if (!this.ctx) return null;
    if ([x0, y0, r0, x1, y1, r1].some(v => !isFinite(v) || Number.isNaN(v))) return null;
    return this.ctx.createRadialGradient(x0, y0, Math.max(0, r0), x1, y1, Math.max(0.001, r1));
  }

  _render(t = performance.now()) {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const active = this.visible && this.opacity > 0.001 && this.radius > 1;
    const cx = W / 2 + (active ? osc(O.dx, t) * 0.38 : 0);
    const cy = H / 2 + (active ? osc(O.dy, t) * 0.30 : 0);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    if (!active) return;

    const intensity = 1 + osc(O.b1, t) + osc(O.b2, t) + osc(O.f1, t) + osc(O.f2, t) + osc(O.f3, t) + osc(O.f4, t);
    const r = Math.max(0, this.radius * Math.max(0.74, intensity));
    const wp = osc(O.w, t);

    ctx.globalAlpha = this.opacity;
    ctx.globalCompositeOperation = 'destination-out';

    const g1 = this._safeGrad(cx, cy, 0, cx, cy, r * 3.9);
    if (g1) {
      g1.addColorStop(0, 'rgba(0,0,0,0.28)');
      g1.addColorStop(0.22, 'rgba(0,0,0,0.16)');
      g1.addColorStop(0.55, 'rgba(0,0,0,0.07)');
      g1.addColorStop(0.82, 'rgba(0,0,0,0.02)');
      g1.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, r * 3.9, 0, Math.PI * 2);
      ctx.fillStyle = g1;
      ctx.fill();
    }

    const g2 = this._safeGrad(cx, cy, 0, cx, cy, r * 2.25);
    if (g2) {
      g2.addColorStop(0, 'rgba(0,0,0,0.44)');
      g2.addColorStop(0.35, 'rgba(0,0,0,0.28)');
      g2.addColorStop(0.68, 'rgba(0,0,0,0.10)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2.25, 0, Math.PI * 2);
      ctx.fillStyle = g2;
      ctx.fill();
    }

    const g3 = this._safeGrad(cx, cy, 0, cx, cy, r * 1.03);
    if (g3) {
      g3.addColorStop(0, 'rgba(0,0,0,0.78)');
      g3.addColorStop(0.28, 'rgba(0,0,0,0.68)');
      g3.addColorStop(0.58, 'rgba(0,0,0,0.42)');
      g3.addColorStop(0.82, 'rgba(0,0,0,0.16)');
      g3.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.03, 0, Math.PI * 2);
      ctx.fillStyle = g3;
      ctx.fill();
    }

    const rC = Math.max(1, r * (0.28 + Math.abs(osc(O.f1, t)) * 0.15));
    const gC = this._safeGrad(cx, cy, 0, cx, cy, rC);
    if (gC) {
      gC.addColorStop(0, 'rgba(0,0,0,0.18)');
      gC.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, rC, 0, Math.PI * 2);
      ctx.fillStyle = gC;
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';

    const wR = Math.max(1, r * 0.62 * Math.max(0.55, intensity));
    const wA = 0.048 + Math.abs(wp) * 0.028;
    const gW = this._safeGrad(cx, cy, 0, cx, cy, wR);
    if (gW) {
      const gb = Math.floor(Math.max(0, Math.min(255, 185 + wp * 14)));
      gW.addColorStop(0, `rgba(255,${gb},70,${(wA * 1.5).toFixed(3)})`);
      gW.addColorStop(0.45, `rgba(255,170,55,${wA.toFixed(3)})`);
      gW.addColorStop(1, 'rgba(255,130,20,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, wR, 0, Math.PI * 2);
      ctx.fillStyle = gW;
      ctx.fill();
    }

    const vIn = Math.max(0, r * 1.05);
    const vOut = Math.max(vIn + 1, Math.sqrt(W * W + H * H) * 0.74);
    const gV = this._safeGrad(cx, cy, vIn, cx, cy, vOut);
    if (gV) {
      gV.addColorStop(0, 'rgba(0,0,0,0)');
      gV.addColorStop(0.2, 'rgba(0,0,0,0.18)');
      gV.addColorStop(0.6, 'rgba(0,0,0,0.55)');
      gV.addColorStop(1, 'rgba(0,0,0,0.92)');
      ctx.fillStyle = gV;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.globalAlpha = 1;
  }

  _startLoop() {
    if (this.raf) return;
    const loop = (t) => {
      this.raf = requestAnimationFrame(loop);
      this._render(t);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    window.removeEventListener('resize', this._resizeBound);
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.animRaf) cancelAnimationFrame(this.animRaf);
    this.raf = null;
    this.animRaf = null;
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
  }
}
