/**
 * RomanCircles.js
 * Cercles romains avec animation et hover title
 */

import { applyNeighborPush, clearNeighborPush } from '../utils/helpers.js';

export class RomanCircles {
  constructor(config) {
    this.config = config;
    this.el = document.getElementById('roman-circles');
    this.titleEl = document.getElementById('hover-title');
    this.hoverTitleCurrent = null;
    this.hoverTitleLeaveTimer = null;
  }

  /**
   * Applique font du titre hover
   */
  applyHoverTitleFont() {
    const f = this.config.FONTS?.hover_title;
    if (!f) return;
    
    const vW = Math.max(this.config.MIN_SIZE.width, window.innerWidth);
    
    this.titleEl.style.fontFamily = f.family;
    this.titleEl.style.fontSize = Math.max(f.size_min, Math.min(f.size_max, Math.round(vW * f.size_vw / 100))) + 'px';
    this.titleEl.style.fontWeight = f.weight;
    this.titleEl.style.letterSpacing = f.spacing;
    this.titleEl.style.fontStyle = f.style;
    this.titleEl.style.color = f.color;
  }

  /**
   * Set hover title avec cross-fade
   */
  setHoverTitle(newText) {
    if (!newText) return;

    this.applyHoverTitleFont();

    if (!this.hoverTitleCurrent) {
      this.titleEl.innerHTML = `<span class="ht-text">${newText}</span>`;
      this.hoverTitleCurrent = newText;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.titleEl.classList.add('visible');
      }));
    } else {
      const span = this.titleEl.querySelector('.ht-text');
      if (!span) {
        this.titleEl.innerHTML = `<span class="ht-text">${newText}</span>`;
        this.hoverTitleCurrent = newText;
        return;
      }
      span.classList.add('fading');
      this.hoverTitleCurrent = newText;
      setTimeout(() => {
        span.innerHTML = newText;
        span.classList.remove('fading');
      }, 230);
    }
  }

  /**
   * Clear hover title avec délai
   */
  clearHoverTitle() {
    if (this.hoverTitleLeaveTimer !== null) {
      clearTimeout(this.hoverTitleLeaveTimer);
    }
    this.hoverTitleLeaveTimer = setTimeout(() => {
      this.titleEl.classList.remove('visible');
      this.hoverTitleCurrent = null;
      this.hoverTitleLeaveTimer = null;
    }, 30);
  }

  /**
   * Affiche les cercles avec animation
   */
  show(onClickCallbacks) {
    this.el.innerHTML = '';
    this.hoverTitleCurrent = null;
    this.hoverTitleLeaveTimer = null;

    // Les cercles se règlent dans CONFIG.COLLABORATION.circles — la source,
    // lue directement. On passait par CONFIG.COLLAB, une COPIE de sept valeurs
    // faite au chargement de config.js, qui les renommait au passage
    // (circle_size_vh pour size_vh…) : deux noms, deux vérités possibles.
    // Copie supprimée à l'audit de juillet 2026.
    const C = this.config.COLLABORATION.circles;
    const vW = Math.max(this.config.MIN_SIZE.width, window.innerWidth);
    const vH = Math.max(this.config.MIN_SIZE.height, window.innerHeight);

    const sz = Math.max(36, Math.round(vH * C.size_vh / 100));
    const gap = Math.max(8, Math.round(vH * C.gap_vh / 100));
    const topPct = C.top_pct;
    const CIRC = 201;

    const fRoman = this.config.FONTS?.roman;
    const fontSize = fRoman
      ? Math.max(fRoman.size_min, Math.min(fRoman.size_max, Math.round(vW * fRoman.size_vw / 100)))
      : Math.round(sz * 0.28);
    const fontFamily = fRoman?.family ?? 'Cinzel, serif';
    const fontWeight = fRoman?.weight ?? 400;
    const fontSpacing = fRoman?.spacing ?? '0.08em';

    // Position
    this.el.style.top = topPct + '%';
    this.el.style.transform = 'translate(-50%, -50%)';
    this.el.style.gap = gap + 'px';

    C.labels.forEach((label, i) => {
      const btn = document.createElement('div');
      btn.className = 'roman-btn';
      btn.style.width = sz + 'px';
      btn.style.height = sz + 'px';

      btn.innerHTML = `
        <svg width="${sz}" height="${sz}" viewBox="0 0 70 70" overflow="visible">
          <circle class="roman-c" cx="35" cy="35" r="32"
            fill="none" stroke="rgba(255,255,255,0.72)" stroke-width="1.0"
            stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"/>
          <text class="roman-num"
            x="35" y="36"
            font-size="${fontSize}" font-family="${fontFamily}" font-weight="${fontWeight}"
            fill="rgba(255,255,255,0.88)"
            dominant-baseline="middle" text-anchor="middle"
            letter-spacing="${fontSpacing}"
            style="opacity:0;">${label}</text>
        </svg>`;

      this.el.appendChild(btn);
    });

    this.el.classList.add('visible');

    const allBtns = Array.from(this.el.querySelectorAll('.roman-btn'));

    // Animation cascade
    allBtns.forEach((btn, i) => {
      const c = btn.querySelector('.roman-c');
      const num = btn.querySelector('.roman-num');

      setTimeout(() => {
        c.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1), stroke .3s, filter .3s';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          c.setAttribute('stroke-dashoffset', '0');
          setTimeout(() => {
            num.style.transition = 'opacity 0.7s ease, fill .25s ease';
            num.style.opacity = '1';
          }, 1000);
        }));

        // Hover
        btn.onpointerenter = () => {
          btn.classList.add('hovered');
          applyNeighborPush(allBtns, i);
          c.style.stroke = 'rgba(255,230,130,0.95)';
          c.style.filter = 'drop-shadow(0 0 8px rgba(255,210,80,0.70)) drop-shadow(0 0 20px rgba(255,160,20,0.38))';
          num.style.fill = 'rgba(255,220,120,1)';
          
          const title = C.hover_titles && C.hover_titles[i];
          this.setHoverTitle(title || null);
        };

        btn.onpointerleave = () => {
          btn.classList.remove('hovered');
          clearNeighborPush(allBtns);
          c.style.stroke = 'rgba(255,255,255,0.72)';
          c.style.filter = '';
          num.style.fill = 'rgba(255,255,255,0.88)';
          this.clearHoverTitle();
        };

        // Click
        if (onClickCallbacks && onClickCallbacks[i]) {
          btn.onclick = () => onClickCallbacks[i]();
        }

      }, i * C.stagger);
    });
  }

  /**
   * Cache
   */
  hide() {
    this.el.classList.remove('visible');
    this.titleEl.classList.remove('visible');
    
    if (this.hoverTitleLeaveTimer !== null) {
      clearTimeout(this.hoverTitleLeaveTimer);
      this.hoverTitleLeaveTimer = null;
    }
    this.hoverTitleCurrent = null;
    
    setTimeout(() => {
      this.el.innerHTML = '';
    }, 700);
  }
}
