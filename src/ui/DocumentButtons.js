/**
 * DocumentButtons.js
 * Boutons documents phréno avec animation SVG
 */

import { unifyFontSize, applyGoldenHover, applyNeighborPush, clearNeighborPush } from '../utils/helpers.js';

/**
 * Pose le texte d'un label dans un <text> SVG, sur UNE ou DEUX lignes selon la
 * place. Si le libellé tient dans maxW à la taille courante, une seule ligne ;
 * sinon on le coupe en deux lignes équilibrées (au blanc le plus central) via
 * des <tspan>, verticalement centrées autour de cy.
 *
 * @param {SVGTextElement} textEl
 * @param {string} label
 * @param {number} maxW  largeur cible (px)
 * @param {number} cx    centre horizontal (x)
 * @param {number} cy    centre vertical (y)
 */
function setLabelLines(textEl, label, maxW, cx, cy) {
  if (!textEl) return;

  // Essai sur une ligne.
  textEl.textContent = label;
  const oneLine = textEl.getComputedTextLength();
  if (oneLine <= maxW || !label.includes(' ')) {
    // Tient (ou insécable) : on laisse tel quel, unifyFontSize fera le reste.
    textEl.setAttribute('data-lines', '1');
    return;
  }

  // Deux lignes : couper au blanc le plus proche du milieu (coupure équilibrée).
  const words = label.split(' ');
  let best = 1, bestDiff = Infinity;
  const total = label.length;
  let acc = 0;
  for (let i = 0; i < words.length - 1; i++) {
    acc += words[i].length + 1;
    const diff = Math.abs(acc - total / 2);
    if (diff < bestDiff) { bestDiff = diff; best = i + 1; }
  }
  const line1 = words.slice(0, best).join(' ');
  const line2 = words.slice(best).join(' ');

  const fs = parseFloat(textEl.getAttribute('font-size')) || 12;
  const lh = fs * 1.18;                       // interligne
  textEl.textContent = '';
  textEl.setAttribute('data-lines', '2');

  const t1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
  t1.setAttribute('x', cx);
  t1.setAttribute('y', cy - lh / 2);
  t1.textContent = line1;

  const t2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
  t2.setAttribute('x', cx);
  t2.setAttribute('y', cy + lh / 2);
  t2.textContent = line2;

  textEl.appendChild(t1);
  textEl.appendChild(t2);
}

/**
 * Comme unifyFontSize, mais gère les labels sur deux lignes (<tspan>). Mesure
 * la ligne la plus large de chaque label, réduit la police jusqu'à ce que toutes
 * tiennent dans maxWidth, applique la taille commune, puis repositionne les
 * tspans (l'interligne dépend de la taille finale).
 */
function unifyFontSizeMultiline(textElements, maxWidth, startSize) {
  const widthOf = (txt) => {
    const spans = txt.querySelectorAll('tspan');
    if (!spans.length) return txt.getComputedTextLength();
    let m = 0;
    spans.forEach(s => { m = Math.max(m, s.getComputedTextLength()); });
    return m;
  };

  let unified = startSize;
  textElements.forEach(txt => {
    let fs = startSize;
    txt.setAttribute('font-size', fs + 'px');
    while (widthOf(txt) > maxWidth && fs > 6) {
      fs -= 0.5;
      txt.setAttribute('font-size', fs + 'px');
    }
    if (fs < unified) unified = fs;
  });

  textElements.forEach(txt => {
    txt.setAttribute('font-size', unified + 'px');
    // Repositionner les deux lignes autour du centre à la taille finale.
    const spans = txt.querySelectorAll('tspan');
    if (spans.length === 2) {
      const cy = parseFloat(txt.getAttribute('y')) || 0;
      const lh = unified * 1.18;
      spans[0].setAttribute('y', cy - lh / 2);
      spans[1].setAttribute('y', cy + lh / 2);
    }
  });
  return unified;
}

export class DocumentButtons {
  constructor(config) {
    this.config = config;
    this.el = document.getElementById('doc-btns');
  }

  /**
   * Calcule dimensions bouton
   */
  getSizePx() {
    const vW = Math.max(this.config.MIN_SIZE.width, window.innerWidth);
    const vH = Math.max(this.config.MIN_SIZE.height, window.innerHeight);
    
    const D = this.config.DOCS;
    const wRaw = vW * D.width_vw / 100;
    const hRaw = vH * D.height_vh / 100;
    
    return {
      w: Math.round(Math.max(D.width_min, Math.min(D.width_max, wRaw))),
      h: Math.round(Math.max(D.height_min, Math.min(D.height_max, hRaw)))
    };
  }

  /**
   * Construit le DOM des boutons
   */
  /** Crée un bouton (cadre SVG + label vide, texte posé ensuite). */
  _makeButton(label, w, h, perim, fontSizeStart, f) {
    const btn = document.createElement('div');
    btn.className = 'doc-btn';
    btn.style.width = w + 'px';
    btn.style.height = h + 'px';
    btn.innerHTML = `
      <svg width="${w}" height="${h}">
        <rect class="doc-rect"
              x="1" y="1" width="${w-2}" height="${h-2}"
              stroke-dasharray="${perim}" stroke-dashoffset="${perim}"/>
        <text class="doc-label"
              x="${w/2}" y="${h/2}"
              font-size="${fontSizeStart}"
              font-family="${f?.family ?? 'Cinzel, serif'}"
              font-weight="${f?.weight ?? 400}"
              letter-spacing="${f?.spacing ?? '0.18em'}"></text>
      </svg>`;
    return btn;
  }

  buildDOM(animate) {
    const D = this.config.DOCS;
    const { w, h } = this.getSizePx();
    const perim = 2 * (w + h);
    
    const f = this.config.FONTS?.doc_btns;
    const vW = Math.max(this.config.MIN_SIZE.width, window.innerWidth);
    const vH = Math.max(this.config.MIN_SIZE.height, window.innerHeight);
    
    const fontSizeStart = f
      ? Math.max(f.size_min, Math.min(f.size_max, Math.round(vW * f.size_vw / 100)))
      : Math.min(16, Math.max(9, Math.round(h * 0.38)));
    
    const maxTextW = w * 0.76;

    // Position
    this.el.style.right = (D.right_pct ?? 3.5) + '%';
    this.el.style.top = (D.top_pct ?? 3.2) + '%';
    this.el.style.gap = Math.max(4, Math.round(vH * (D.gap_vh ?? 1.8) / 100)) + 'px';

    if (animate) {
      // Construction complète
      this.el.innerHTML = '';

      // ── Bouton « À Propos » en TÊTE de colonne ──────────────────────────
      // Même gabarit et même tracé que les documents, séparé par un espacement
      // plus généreux (about_gap_vh). Sa callback est fournie séparément à
      // show(onClickCallbacks, onAboutClick).
      if (D.about_label) {
        const aboutBtn = this._makeButton(D.about_label, w, h, perim, fontSizeStart, f);
        aboutBtn.classList.add('doc-btn--about');
        aboutBtn.style.marginBottom =
          Math.max(6, Math.round(vH * (D.about_gap_vh ?? 5) / 100)) + 'px';
        this.el.appendChild(aboutBtn);
        setLabelLines(aboutBtn.querySelector('.doc-label'), D.about_label, w * 0.82, w / 2, h / 2);
      }

      this.config.DOCS.labels.forEach((label) => {
        const btn = this._makeButton(label, w, h, perim, fontSizeStart, f);
        this.el.appendChild(btn);
        setLabelLines(btn.querySelector('.doc-label'), label, w * 0.82, w / 2, h / 2);
      });
    } else {
      // Resize seulement.
      // L'ordre DOM est : [À Propos ?] puis les documents. On reconstruit la
      // liste des labels dans CE même ordre pour ré-wrapper correctement.
      const domLabels = [];
      if (D.about_label) domLabels.push(D.about_label);
      this.config.DOCS.labels.forEach(l => domLabels.push(l));

      this.el.querySelectorAll('.doc-btn').forEach((btn, i) => {
        btn.style.width = w + 'px';
        btn.style.height = h + 'px';
        const rect = btn.querySelector('.doc-rect');
        const label = btn.querySelector('.doc-label');
        const svg = btn.querySelector('svg');
        svg.setAttribute('width', w);
        svg.setAttribute('height', h);
        rect.setAttribute('width', w - 2);
        rect.setAttribute('height', h - 2);
        rect.setAttribute('stroke-dasharray', perim);
        rect.setAttribute('stroke-dashoffset', '0');
        label.setAttribute('x', w / 2);
        label.setAttribute('y', h / 2);
        label.setAttribute('font-size', fontSizeStart + 'px');
        // Recalcule le découpage 1/2 lignes à la nouvelle largeur.
        setLabelLines(label, domLabels[i] ?? label.textContent, w * 0.82, w / 2, h / 2);
      });

      // Réajuste l'espacement sous le bouton « À Propos ».
      const aboutBtn = this.el.querySelector('.doc-btn--about');
      if (aboutBtn) {
        aboutBtn.style.marginBottom =
          Math.max(6, Math.round(vH * (D.about_gap_vh ?? 5) / 100)) + 'px';
      }
    }

    // Uniformiser la police en tenant compte des labels sur deux lignes.
    const allTexts = Array.from(this.el.querySelectorAll('.doc-label'));
    unifyFontSizeMultiline(allTexts, maxTextW, fontSizeStart);
  }

  /**
   * Attache les hovers
   */
  attachHover() {
    const allBtns = Array.from(this.el.querySelectorAll('.doc-btn'));
    allBtns.forEach((btn, i) => {
      // pointerenter/leave couvrent la souris ET le tactile : au glissé du doigt
      // sur un bouton, l'effet de survol s'active comme au passage de la souris.
      btn.onpointerenter = () => {
        btn.classList.add('hovered');
        applyNeighborPush(allBtns, i);
        applyGoldenHover(
          [btn.querySelector('.doc-rect')],
          [btn.querySelector('.doc-label')]
        );
      };
      btn.onpointerleave = () => {
        btn.classList.remove('hovered');
        clearNeighborPush(allBtns);
        const r = btn.querySelector('.doc-rect');
        const l = btn.querySelector('.doc-label');
        if (r) { r.style.stroke = 'rgba(255,255,255,0.72)'; r.style.filter = ''; }
        if (l) l.style.fill = 'rgba(255,255,255,0.82)';
      };
    });
    return allBtns;
  }

  /**
   * Affiche avec animation
   */
  show(onClickCallbacks, onAboutClick) {
    this.buildDOM(true);
    this.el.style.opacity = '';
    this.el.classList.add('visible');

    const allBtns = this.attachHover();
    const hasAbout = !!this.config.DOCS.about_label;

    // Attacher les clics.
    //  - si un bouton « À Propos » existe, il est en tête (index 0) et reçoit
    //    onAboutClick ; les documents suivent (décalés de 1).
    //  - sinon, les documents commencent à l'index 0.
    allBtns.forEach((btn, i) => {
      if (hasAbout && i === 0) {
        btn.onclick = () => onAboutClick?.();
      } else {
        const docIdx = hasAbout ? i - 1 : i;
        btn.onclick = () => onClickCallbacks?.[docIdx]?.();
      }
    });

    // Animation cascade
    allBtns.forEach((btn, i) => {
      const rect = btn.querySelector('.doc-rect');
      const label = btn.querySelector('.doc-label');
      const delayMs = i * 220;
      setTimeout(() => {
        rect.classList.remove('drawn');
        label.classList.remove('drawn');
        void rect.offsetWidth;
        rect.classList.add('drawn');
        setTimeout(() => label.classList.add('drawn'), 850);
      }, delayMs);
    });
  }

  /**
   * Redimensionne
   */
  resize() {
    this.buildDOM(false);
    this.attachHover();
  }

  /**
   * Cache
   */
  hide() {
    this.el.style.transition = 'opacity 600ms ease';
    this.el.style.opacity = '0';
    this.el.classList.remove('visible');
    
    setTimeout(() => {
      this.el.innerHTML = '';
    }, 620);
  }
}
