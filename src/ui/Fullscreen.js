/**
 * Fullscreen.js
 * Bouton fullscreen avec icône expand/collapse
 */

export class Fullscreen {
  constructor(config, arrowSizeFn) {
    this.config = config;
    this.arrowSizeFn = arrowSizeFn;
    this.el = document.getElementById('fs-btn');
    
    this.init();
  }

  /**
   * Initialise le bouton
   */
  init() {
    // Events fullscreen
    this.el.addEventListener('click', () => {
      if (this.isFullscreen()) {
        this.exit();
      } else {
        this.enter();
      }
    });

    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'msfullscreenchange']
      .forEach(ev => document.addEventListener(ev, () => {
        document.body.classList.toggle('is-fullscreen', this.isFullscreen());
        this.rebuild();
      }));

    this.rebuild();
    window.addEventListener('resize', () => this.rebuild());
  }

  /**
   * Entre en fullscreen
   */
  enter() {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || 
               el.mozRequestFullScreen || el.msRequestFullscreen;
    if (fn) fn.call(el);
  }

  /**
   * Sort du fullscreen
   */
  exit() {
    const fn = document.exitFullscreen || document.webkitExitFullscreen ||
               document.mozCancelFullScreen || document.msExitFullscreen;
    if (fn) fn.call(document);
  }

  /**
   * Check si fullscreen
   */
  isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement ||
              document.mozFullScreenElement || document.msFullscreenElement);
  }

  /**
   * Reconstruit le SVG
   */
  rebuild() {
    const sz = this.arrowSizeFn();
    const expanded = this.isFullscreen();
    const stroke = 'rgba(255,255,255,0.75)';
    const strokeGlow = 'drop-shadow(0 0 7px rgba(255,210,80,0.80)) drop-shadow(0 0 20px rgba(255,170,30,0.50))';

    const swRect = '0.41';
    const swIcon = '0.48';
    const perim = 4 * 22;

    const iconExpand = `
      <polyline points="15,3 21,3 21,9" fill="none" stroke="${stroke}" stroke-width="${swIcon}" stroke-linecap="round" stroke-linejoin="round" style="transition:stroke .3s,filter .3s;"/>
      <polyline points="9,21 3,21 3,15" fill="none" stroke="${stroke}" stroke-width="${swIcon}" stroke-linecap="round" stroke-linejoin="round" style="transition:stroke .3s,filter .3s;"/>
      <line x1="21" y1="3" x2="14" y2="10" stroke="${stroke}" stroke-width="${swIcon}" stroke-linecap="round" style="transition:stroke .3s,filter .3s;"/>
      <line x1="3" y1="21" x2="10" y2="14" stroke="${stroke}" stroke-width="${swIcon}" stroke-linecap="round" style="transition:stroke .3s,filter .3s;"/>`;

    const iconCollapse = `
      <polyline points="4,14 10,14 10,20" fill="none" stroke="${stroke}" stroke-width="${swIcon}" stroke-linecap="round" stroke-linejoin="round" style="transition:stroke .3s,filter .3s;"/>
      <polyline points="20,10 14,10 14,4" fill="none" stroke="${stroke}" stroke-width="${swIcon}" stroke-linecap="round" stroke-linejoin="round" style="transition:stroke .3s,filter .3s;"/>
      <line x1="10" y1="14" x2="3" y2="21" stroke="${stroke}" stroke-width="${swIcon}" stroke-linecap="round" style="transition:stroke .3s,filter .3s;"/>
      <line x1="14" y1="10" x2="21" y2="3" stroke="${stroke}" stroke-width="${swIcon}" stroke-linecap="round" style="transition:stroke .3s,filter .3s;"/>`;

    this.el.innerHTML = `
      <svg width="${sz}" height="${sz}" viewBox="0 0 24 24" overflow="visible"
           style="display:block;transition:transform .35s cubic-bezier(0.34,1.56,0.64,1);transform-origin:center;">
        <rect x="1" y="1" width="22" height="22" rx="1.5"
          fill="none" stroke="${stroke}" stroke-width="${swRect}"
          stroke-dasharray="${perim}" stroke-dashoffset="0"
          style="transition:stroke .3s,filter .3s;"/>
        ${expanded ? iconCollapse : iconExpand}
      </svg>`;

    const svgEl = this.el.querySelector('svg');
    const strokes = this.el.querySelectorAll('[stroke]');

    this.el.onpointerenter = () => {
      svgEl.style.transform = 'scale(1.22)';
      strokes.forEach(el => {
        el.style.stroke = 'rgba(255,230,130,0.95)';
        el.style.filter = strokeGlow;
      });
    };

    this.el.onpointerleave = () => {
      svgEl.style.transform = 'scale(1)';
      strokes.forEach(el => {
        el.style.stroke = stroke;
        el.style.filter = '';
      });
    };
  }
}
