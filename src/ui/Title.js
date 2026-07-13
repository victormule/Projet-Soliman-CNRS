/**
 * Title.js
 * Titre du site avec animation caractère par caractère
 */

export class Title {
  constructor(config) {
    this.config = config;
    this.el = document.getElementById('site-title');
  }

  /**
   * Applique la font du titre
   */
  applyFont() {
    const f = this.config.FONTS?.title;
    if (!f) return;
    
    const vW = Math.max(this.config.MIN_SIZE.width, window.innerWidth);
    const fontSize = Math.max(f.size_min, Math.min(f.size_max, Math.round(vW * f.size_vw / 100)));
    
    this.el.style.fontFamily = f.family;
    this.el.style.fontSize = fontSize + 'px';
    this.el.style.fontWeight = f.weight;
    this.el.style.letterSpacing = f.spacing;
    this.el.style.fontStyle = f.style;
    this.el.style.color = f.color;
  }

  /**
   * Recalcule et applique la taille de police au resize fenêtre.
   * Appelé depuis onResize() de chaque scène via systems.title.resize()
   */
  resize() {
    if (!this.el || !this.el.innerHTML) return;
    const f = this.config.FONTS?.title;
    if (!f) return;
    const vW = Math.max(this.config.MIN_SIZE.width, window.innerWidth);
    const sz = Math.max(f.size_min, Math.min(f.size_max, Math.round(vW * f.size_vw / 100)));
    this.el.style.fontSize = sz + 'px';
  }

  /**
   * Révèle le titre avec animation
   */
  reveal() {
    this.applyFont();
    
    let html = '';
    let charIdx = 0;
    
    this.config.TITLE.texte.forEach(part => {
      if (part === '—') {
        html += `<span class="sep">—</span>`;
      } else {
        part.split('').forEach(ch => {
          html += `<span class="char" data-i="${charIdx}">${ch === ' ' ? '&nbsp;' : ch}</span>`;
          charIdx++;
        });
      }
    });
    
    this.el.innerHTML = html;
    
    this.el.querySelectorAll('.char').forEach((s, i) => {
      setTimeout(() => {
        s.style.opacity = '1';
        s.style.transform = 'translateY(0)';
      }, this.config.TIMING.title_start + i * this.config.TIMING.title_char_delay + Math.random() * 20);
    });
    
    this.el.querySelectorAll('.sep').forEach((s, i) => {
      setTimeout(() => {
        s.style.opacity = '0.6';
      }, this.config.TIMING.title_start + (i + 1) * 340);
    });
  }
}
