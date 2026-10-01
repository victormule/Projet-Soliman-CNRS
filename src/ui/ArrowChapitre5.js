import { ArrowBase } from './ArrowBase.js';

/** Même flèche tracée et même position que les autres retours de chapitre. */
export class ArrowChp5 extends ArrowBase {
  constructor(config) {
    super(config, 'arrow-chp5', 'M48 35 L22 35 M33 24 L22 35 L33 46',
      "Quitter le chapitre et revenir à l'espace collaboratif");
  }

  _applyPosition() {
    const vw = Math.max(this.config.MIN_SIZE.width, window.innerWidth);
    const vh = Math.max(this.config.MIN_SIZE.height, window.innerHeight);
    const margin = Math.round(Math.min(vw, vh) * 0.05);
    Object.assign(this.el.style, {
      top: '', right: '', bottom: margin + 'px', left: margin + 'px',
      transform: 'none', zIndex: '600',
    });
  }
}
