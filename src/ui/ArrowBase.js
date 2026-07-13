/**
 * ArrowBase.js — v2
 *
 * CORRECTIONS :
 * 1. Scale SVG au hover — le SVG grossit de 1.22x avec une transition
 *    cubic-bezier élastique. Le container reste immobile (position stable),
 *    seul le SVG interne scale depuis son centre.
 *
 * 2. data-arrow="true" sur l'élément racine — permet au curseur dans app.js
 *    de détecter le survol via [data-arrow] et de passer en état hotspot.
 *
 * 3. Le curseur "hotspot" (gros + brillant) s'active automatiquement
 *    dès que la souris entre sur n'importe quelle flèche.
 */

import { applyGoldenHover } from '../utils/helpers.js';

export class ArrowBase {

  constructor(config, domId, svgPath) {
    this.config  = config;
    this.domId   = domId;
    this.svgPath = svgPath;
    this.drawing = false;
    this.el      = this._createElement();
  }

  /* ── Création élément DOM ───────────────────────────── */

  _createElement() {
    let el = document.getElementById(this.domId);
    if (!el) {
      el = document.createElement('div');
      el.id = this.domId;
      // data-arrow → détecté par app.js pour le curseur hotspot
      el.dataset.arrow = 'true';
      el.style.cssText = [
        'position:absolute',
        'z-index:10',
        'opacity:0',
        'pointer-events:auto',
        'cursor:none',
      ].join(';');
      document.getElementById('app')?.appendChild(el);
    }
    return el;
  }

  /* ── Taille SVG ─────────────────────────────────────── */

  _getSizePx() {
    const vW = Math.max(this.config.MIN_SIZE.width,  window.innerWidth);
    const vH = Math.max(this.config.MIN_SIZE.height, window.innerHeight);
    const A  = this.config.ARROW;
    return Math.round(Math.max(A.size_min, Math.min(A.size_max, Math.min(vW, vH) * A.size_vh / 100)));
  }

  /* ── Position — surchargée dans chaque sous-classe ──── */

  _applyPosition(sz) {}

  /* ── show() ─────────────────────────────────────────── */

  show(onClick) {
    const sz   = this._getSizePx();
    const CIRC = 201;
    const PLEN = 60;

    this._applyPosition(sz);

    this.el.innerHTML = `
      <svg width="${sz}" height="${sz}" viewBox="0 0 70 70" overflow="visible"
        style="display:block;transition:transform .35s cubic-bezier(0.34,1.56,0.64,1);transform-origin:center;">
        <circle class="arrow-c" cx="35" cy="35" r="32"
          fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="1.2"
          stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"
          style="transition:stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1), stroke .3s, filter .3s;"/>
        <path class="arrow-p" d="${this.svgPath}"
          fill="none" stroke="rgba(255,255,255,0.80)" stroke-width="1.4"
          stroke-linecap="round" stroke-linejoin="round"
          stroke-dasharray="${PLEN}" stroke-dashoffset="${PLEN}"
          style="transition:stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1) 1.3s, stroke .3s, filter .3s;"/>
      </svg>`;

    this.el.style.transition = 'opacity 1.0s ease';
    this.el.style.opacity    = '1';
    this.el.classList.add('visible');

    const svg = this.el.querySelector('svg');
    const c   = this.el.querySelector('.arrow-c');
    const p   = this.el.querySelector('.arrow-p');

    // Bloquer le clic pendant le dessin
    this.drawing = true;
    setTimeout(() => { this.drawing = false; }, 2100);

    // Déclencher l'animation de dessin
    requestAnimationFrame(() => requestAnimationFrame(() => {
      c.setAttribute('stroke-dashoffset', '0');
      p.setAttribute('stroke-dashoffset', '0');
    }));

    this._attachHover(svg, c, p);

    if (onClick) {
      this.el.onclick = () => {
        if (!this.drawing) this._rippleClick(svg, c, p, onClick);
      };
    }
  }

  /* ── Effet dissolution lumineuse au clic ────────────── */

  _rippleClick(svg, c, p, callback) {
    this.drawing = true;

    const sz     = parseInt(svg.getAttribute('width')) || 70;
    const DIM    = sz * 3;           // canvas plus grand que le SVG pour les arcs qui débordent
    const CX     = DIM / 2;
    const CY     = DIM / 2;
    const BASE_R = 32 * (sz / 70);  // rayon du cercle, en px canvas
    const TOTAL  = 800;             // durée totale ms
    const TAU    = Math.PI * 2;

    // Canvas temporaire positionné par-dessus le SVG
    const cvs = document.createElement('canvas');
    cvs.width  = DIM;
    cvs.height = DIM;
    cvs.style.cssText = [
      'position:absolute',
      `width:${DIM}px`,
      `height:${DIM}px`,
      `left:${(sz - DIM) / 2}px`,
      `top:${(sz - DIM) / 2}px`,
      'pointer-events:none',
      'z-index:20',
    ].join(';');
    this.el.appendChild(cvs);
    const ctx = cvs.getContext('2d');

    // Arcs — fragments du cercle qui s'écartent en tournant
    const NUM_ARCS = 8;
    const arcs = Array.from({length: NUM_ARCS}, (_, i) => ({
      angle: (TAU / NUM_ARCS) * i,
      drift: (Math.random() - .5) * .5,
      len:   .16 + Math.random() * .18,
      delay: Math.random() * .1,
    }));

    // Étincelles — points lumineux qui partent en étoile
    const NUM_SPARKS = 14;
    const sparks = Array.from({length: NUM_SPARKS}, (_, i) => ({
      angle: (TAU / NUM_SPARKS) * i + Math.random() * .35,
      speed: .55 + Math.random() * .7,
      life:  .45 + Math.random() * .4,
      size:  1.4 + Math.random() * 2.4,
      delay: .04 + Math.random() * .18,
    }));

    const easeOut  = t => 1 - Math.pow(1 - t, 3);
    const easeOut2 = t => 1 - Math.pow(1 - t, 2);

    const t0 = performance.now();
    let raf;

    const frame = (now) => {
      const t = Math.min((now - t0) / TOTAL, 1);
      ctx.clearRect(0, 0, DIM, DIM);

      // Arcs lumineux qui se dilatent et tournent
      arcs.forEach(a => {
        const lt = Math.max(0, (t - a.delay) / (1 - a.delay));
        if (lt <= 0) return;
        const radius = BASE_R * (1 + easeOut(lt) * 1.05);
        const alpha  = lt < .3 ? lt / .3 : easeOut2(1 - (lt - .3) / .7);
        if (alpha <= 0.01) return;
        const startA = a.angle + a.drift * easeOut(lt);
        const arcLen = TAU * a.len * (lt < .18 ? lt / .18 : (lt > .72 ? easeOut2((1 - lt) / .28) : 1));
        ctx.save();
        ctx.strokeStyle = `rgba(255,${Math.floor(195 + 60 * (1 - lt))},${Math.floor(65 + 80 * (1 - lt))},${alpha * .88})`;
        ctx.lineWidth   = (2.8 - lt * 1.4) * (sz / 70);
        ctx.lineCap     = 'round';
        ctx.shadowColor = `rgba(255,185,40,${alpha * .55})`;
        ctx.shadowBlur  = 18 * (sz / 70);
        ctx.beginPath();
        ctx.arc(CX, CY, radius, startA, startA + arcLen);
        ctx.stroke();
        ctx.restore();
      });

      // Étincelles
      sparks.forEach(sp => {
        const lt = Math.max(0, (t - sp.delay) / sp.life);
        if (lt <= 0 || lt > 1) return;
        const dist  = easeOut(lt) * BASE_R * 2.2 * sp.speed;
        const alpha = lt < .25 ? lt / .25 : easeOut2(1 - (lt - .25) / .75);
        const x = CX + Math.cos(sp.angle) * dist;
        const y = CY + Math.sin(sp.angle) * dist;
        ctx.save();
        ctx.fillStyle   = `rgba(255,${Math.floor(215 + 40 * (1 - lt))},${Math.floor(80 + 120 * (1 - lt))},${alpha * .92})`;
        ctx.shadowColor = `rgba(255,195,50,${alpha * .5})`;
        ctx.shadowBlur  = 10 * (sz / 70);
        ctx.beginPath();
        ctx.arc(x, y, sp.size * (sz / 70) * (1 - lt * .55), 0, TAU);
        ctx.fill();
        ctx.restore();
      });

      // Halo central qui pulse puis s'éteint
      const halo = t < .12 ? easeOut(t / .12) : easeOut2(1 - (t - .12) / .88);
      if (halo > .01) {
        const gr = ctx.createRadialGradient(CX, CY, 0, CX, CY, BASE_R * .75);
        gr.addColorStop(0,   `rgba(255,230,130,${halo * .5})`);
        gr.addColorStop(.5,  `rgba(255,175,35,${halo * .18})`);
        gr.addColorStop(1,   'rgba(255,110,0,0)');
        ctx.save();
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(CX, CY, BASE_R * .75, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      // SVG : couleur et disparition progressive
      const svgAlpha = t < .2 ? 1 : easeOut2(1 - (t - .2) / .8);
      svg.style.opacity = svgAlpha;
      const warm = Math.floor(195 + 60 * Math.min(t * 6, 1));
      c.style.stroke = `rgba(255,${warm},60,${svgAlpha * .9})`;
      p.style.stroke  = `rgba(255,${warm},70,${svgAlpha * .9})`;
      if (t < .35) {
        const gStr = `drop-shadow(0 0 ${(1 - t / .35) * 14}px rgba(255,200,55,${.7 * (1 - t / .35)}))`;
        c.style.filter = gStr;
        p.style.filter  = gStr;
      } else {
        c.style.filter = '';
        p.style.filter  = '';
      }

      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, DIM, DIM);
        cvs.remove();
      }
    };

    raf = requestAnimationFrame(frame);

    // Callback déclenché à mi-animation — la scène peut commencer à transitionner
    setTimeout(() => callback(), 400);
  }

  /* ── hide() ─────────────────────────────────────────── */

  hide() {
    this.el.style.transition = 'opacity 400ms ease';
    this.el.style.opacity    = '0';
    this.el.classList.remove('visible');
    setTimeout(() => {
      this.el.innerHTML = '';
      this.el.onclick   = null;
    }, 420);
  }

  /* ── resize() ───────────────────────────────────────── */

  resize() {
    if (!this.el.classList.contains('visible')) return;

    const sz   = this._getSizePx();
    const CIRC = 201;
    const PLEN = 60;

    this._applyPosition(sz);

    this.el.innerHTML = `
      <svg width="${sz}" height="${sz}" viewBox="0 0 70 70" overflow="visible"
        style="display:block;transition:transform .35s cubic-bezier(0.34,1.56,0.64,1);transform-origin:center;">
        <circle class="arrow-c" cx="35" cy="35" r="32"
          fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="1.2"
          stroke-dasharray="${CIRC}" stroke-dashoffset="0"
          style="transition:stroke .3s, filter .3s;"/>
        <path class="arrow-p" d="${this.svgPath}"
          fill="none" stroke="rgba(255,255,255,0.80)" stroke-width="1.4"
          stroke-linecap="round" stroke-linejoin="round"
          stroke-dasharray="${PLEN}" stroke-dashoffset="0"
          style="transition:stroke .3s, filter .3s;"/>
      </svg>`;

    const svg = this.el.querySelector('svg');
    const c   = this.el.querySelector('.arrow-c');
    const p   = this.el.querySelector('.arrow-p');
    this._attachHover(svg, c, p);
  }

  /* ── Hover : scale SVG + couleur dorée ──────────────── */

  _attachHover(svg, c, p) {
    const glow = 'drop-shadow(0 0 7px rgba(255,210,80,0.80)) drop-shadow(0 0 20px rgba(255,170,30,0.50))';

    this.el.onpointerenter = () => {
      // SVG grossit
      svg.style.transform = 'scale(1.22)';
      // Couleur et filtre dorés
      applyGoldenHover([c, p], []);
    };

    this.el.onpointerleave = () => {
      // SVG revient à taille normale
      svg.style.transform = 'scale(1)';
      // Couleurs d'origine
      c.style.stroke = 'rgba(255,255,255,0.75)';
      c.style.filter = '';
      p.style.stroke = 'rgba(255,255,255,0.80)';
      p.style.filter = '';
    };
  }
}
