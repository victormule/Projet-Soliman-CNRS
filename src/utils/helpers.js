/**
 * helpers.js
 * Fonctions utilitaires pour l'UI, SVG, animations
 */

/* ── GESTION UI GÉNÉRIQUE ────────────────────────────────────────── */

export function showUI(el, duration = 1000) {
  const element = typeof el === 'string' ? document.getElementById(el) : el;
  if (!element) return;
  
  element.style.transition = `opacity ${duration}ms ease`;
  element.style.opacity = '1';
  element.classList.add('visible');
}

export function hideUI(el, duration = 400, onComplete = null) {
  const element = typeof el === 'string' ? document.getElementById(el) : el;
  if (!element) return;
  
  element.style.transition = `opacity ${duration}ms ease`;
  element.style.opacity = '0';
  element.classList.remove('visible');
  
  if (onComplete) {
    setTimeout(onComplete, duration + 20);
  }
}

export function clearUIContent(el, delay = 0) {
  const element = typeof el === 'string' ? document.getElementById(el) : el;
  if (!element) return;
  
  if (delay > 0) {
    setTimeout(() => { element.innerHTML = ''; }, delay);
  } else {
    element.innerHTML = '';
  }
}

/* ── LIBÉRATION DES ÉLÉMENTS MÉDIA ────────────────────────────────────────
   À APPELER AVANT DE RETIRER LE DOM D'UN CHAPITRE. Sans cela, le chapitre
   entier reste vivant en mémoire après sa sortie.

   POURQUOI (mesuré, pas supposé) : un <video>/<audio> qui a commencé sa
   « resource selection » est retenu par le moteur média du navigateur — et un
   nœud retenu retient TOUT son arbre, ancêtres compris. Retirer
   #chapitre2-root du document ne suffit donc pas : ses trois éléments média
   (#voyeur-video, #article-video, #article-audio, ce dernier avec un <track
   default> qui part en chargement immédiat) le maintiennent détaché-mais-vivant.

   Bissection qui l'établit — même DOM injecté puis retiré, deux cycles :
     DOM complet          → +1 arbre détaché par cycle
     sans <img>           → +1   (ce ne sont pas les images)
     sans <svg>           → +1   (ni les filtres SVG)
     sans <template>      → +1   (ni le gabarit de l'article)
     sans <video>/<audio> → +0   ← la fuite disparaît

   `load()` après avoir vidé la source est l'étape qui compte : elle AVORTE
   l'algorithme de sélection de ressource. Sans elle, vider `src` ne libère rien.
──────────────────────────────────────────────────────────────────────────── */

/**
 * Coupe et libère tous les <video>/<audio> contenus dans `root` (inclus).
 * Idempotent, et sans effet si `root` est nul.
 * @param {?Element} root
 */
export function releaseMediaElements(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;

  const medias = [...root.querySelectorAll('video, audio')];
  if (root.matches?.('video, audio')) medias.push(root);

  medias.forEach(el => {
    try {
      el.pause();
      // Les <source> relancent la sélection de ressource au load() : on les
      // retire. Les <track>, eux, sont seulement DÉSARMÉS (src vidé) plutôt que
      // retirés — les retirer en ferait des arbres détachés à leur tour, alors
      // qu'ils disparaissent naturellement avec le média qui les contient.
      el.querySelectorAll('source').forEach(n => n.remove());
      el.querySelectorAll('track').forEach(t => {
        t.removeAttribute('src');
        try { if (t.track) t.track.mode = 'disabled'; } catch (e) { /* sans objet */ }
      });
      el.removeAttribute('src');
      try { el.srcObject = null; } catch (e) { /* non supporté : sans objet */ }
      el.load();                    // avorte la sélection de ressource
    } catch (e) {
      // Un média déjà démonté peut lever : ce n'est pas une raison d'interrompre
      // le nettoyage des suivants.
    }
  });
}

/* ── CRÉATION SVG ────────────────────────────────────────────────── */

export function createSVG(width, height, viewBox = null) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  if (viewBox) svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('overflow', 'visible');
  return svg;
}

export function createSVGElement(type, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', type);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
  return el;
}

export function createCircle(cx, cy, r, style = {}) {
  return createSVGElement('circle', {
    cx, cy, r,
    fill: style.fill || 'none',
    stroke: style.stroke || 'rgba(255,255,255,0.75)',
    'stroke-width': style.strokeWidth || '1.2',
    ...style
  });
}

export function createRect(x, y, width, height, style = {}) {
  return createSVGElement('rect', {
    x, y, width, height,
    fill: style.fill || 'none',
    stroke: style.stroke || 'rgba(255,255,255,0.75)',
    'stroke-width': style.strokeWidth || '0.8',
    ...style
  });
}

export function createPath(d, style = {}) {
  return createSVGElement('path', {
    d,
    fill: style.fill || 'none',
    stroke: style.stroke || 'rgba(255,255,255,0.80)',
    'stroke-width': style.strokeWidth || '1.4',
    'stroke-linecap': style.linecap || 'round',
    'stroke-linejoin': style.linejoin || 'round',
    ...style
  });
}

export function createText(text, x, y, style = {}) {
  const textEl = createSVGElement('text', {
    x, y,
    fill: style.fill || 'rgba(255,255,255,0.82)',
    'font-family': style.fontFamily || 'Cinzel, serif',
    'font-size': style.fontSize || '12',
    'font-weight': style.fontWeight || '400',
    'letter-spacing': style.letterSpacing || '0.18em',
    'text-transform': style.textTransform || 'uppercase',
    'dominant-baseline': style.baseline || 'middle',
    'text-anchor': style.anchor || 'middle',
    ...style
  });
  textEl.textContent = text;
  return textEl;
}

/* ── ANIMATIONS COMMUNES ─────────────────────────────────────────── */

export function animateDraw(element, duration = 1400, delay = 0, easing = 'cubic-bezier(0.4,0,0.2,1)') {
  const length = element.getTotalLength ? element.getTotalLength() : 
                 (element.getAttribute('stroke-dasharray') || '200');
  
  element.setAttribute('stroke-dasharray', length);
  element.setAttribute('stroke-dashoffset', length);
  element.style.transition = `stroke-dashoffset ${duration}ms ${easing} ${delay}ms, stroke 0.3s, filter 0.3s`;
  
  requestAnimationFrame(() => requestAnimationFrame(() => {
    element.setAttribute('stroke-dashoffset', '0');
  }));
}

export function applyGoldenHover(strokeElements = [], fillElements = []) {
  const hoverColor = 'rgba(255,220,120,1)';
  const strokeGlow = 'drop-shadow(0 0 7px rgba(255,210,80,0.80)) drop-shadow(0 0 20px rgba(255,170,30,0.50))';
  
  strokeElements.forEach(el => {
    if (el) {
      el.style.stroke = 'rgba(255,230,130,0.95)';
      el.style.filter = strokeGlow;
    }
  });
  fillElements.forEach(el => {
    if (el) el.setAttribute('fill', hoverColor);
  });
}

export function removeGoldenHover(strokeElements = [], fillElements = [], 
                          defaultStrokeColor = 'rgba(255,255,255,0.72)',
                          defaultFillColor = 'rgba(255,255,255,0.82)') {
  strokeElements.forEach(el => {
    if (el) {
      el.style.stroke = defaultStrokeColor;
      el.style.filter = '';
    }
  });
  fillElements.forEach(el => {
    if (el) el.setAttribute('fill', defaultFillColor);
  });
}

/* ── UTILITAIRES DIVERS ──────────────────────────────────────────── */

export function applyNeighborPush(allElements, hoveredIndex, pushAmount = 1.4, direction = 'y') {
  allElements.forEach((el, i) => {
    if (i < hoveredIndex) {
      const transform = direction === 'y' 
        ? `translateY(-${pushAmount}%)` 
        : `translateX(-${pushAmount}%)`;
      el.style.transform = transform;
      el.classList.add(direction === 'y' ? 'push-up' : 'push-left');
    } else if (i > hoveredIndex) {
      const transform = direction === 'y' 
        ? `translateY(${pushAmount}%)` 
        : `translateX(${pushAmount}%)`;
      el.style.transform = transform;
      el.classList.add(direction === 'y' ? 'push-down' : 'push-right');
    }
  });
}

export function clearNeighborPush(allElements) {
  allElements.forEach(el => {
    el.style.transform = '';
    el.classList.remove('push-up', 'push-down', 'push-left', 'push-right');
  });
}

/* ── LIBELLÉS SVG SUR UNE OU DEUX LIGNES ─────────────────────────────
   Partagé par les boutons documents et la barre de navigation : un libellé
   long ne doit pas fondre jusqu'à l'illisible (ni déborder quand le plancher
   de police est atteint) — il se coupe en deux lignes. */

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
export function setLabelLines(textEl, label, maxW, cx, cy) {
  if (!textEl) return;

  // Essai sur une ligne.
  textEl.textContent = label;
  const oneLine = textEl.getComputedTextLength();
  if (oneLine <= maxW || !label.includes(' ')) {
    // Tient (ou insécable) : on laisse tel quel, l'unification fera le reste.
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
 *
 * @param {SVGTextElement[]} textElements  groupe à unifier (la plus petite gagne)
 * @param {number} maxWidth
 * @param {number} startSize  taille de départ (plafond)
 * @param {number} [minSize=6]  plancher de lisibilité
 * @returns {number} la taille commune appliquée
 */
export function unifyFontSizeMultiline(textElements, maxWidth, startSize, minSize = 6) {
  const widthOf = (txt) => {
    const spans = txt.querySelectorAll('tspan');
    if (!spans.length) return txt.getComputedTextLength();
    let m = 0;
    spans.forEach(s => { m = Math.max(m, s.getComputedTextLength()); });
    return m;
  };

  /* RECHERCHE DICHOTOMIQUE, pas décrément pas à pas.
     ─────────────────────────────────────────────────────────────────────────
     getComputedTextLength() force un recalcul de mise en page SYNCHRONE à
     chaque appel. L'ancienne boucle descendait de 0,5 px en 0,5 px : jusqu'à
     une centaine de reflows forcés par libellé, rejoués à chaque
     redimensionnement. La dichotomie sur la même grille de 0,5 px donne
     EXACTEMENT le même résultat en ~7 mesures au lieu de ~100.

     Le pas de 0,5 px est conservé tel quel : c'est lui qui décide de la taille
     finale, donc du rendu. Changer la méthode ne doit pas changer le dessin. */
  const STEP = 0.5;
  const steps = Math.max(0, Math.round((startSize - minSize) / STEP));
  const sizeAt = (k) => startSize - k * STEP;          // k=0 → startSize

  let unified = startSize;
  textElements.forEach(txt => {
    // Cas courant : ça tient déjà à la taille de départ — une seule mesure.
    txt.setAttribute('font-size', startSize + 'px');
    if (widthOf(txt) <= maxWidth) return;

    // Sinon : plus petit k tel que sizeAt(k) tienne (la largeur décroît avec k).
    let lo = 0, hi = steps;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      txt.setAttribute('font-size', sizeAt(mid) + 'px');
      if (widthOf(txt) <= maxWidth) hi = mid;
      else                          lo = mid + 1;
    }
    const fs = sizeAt(lo);                              // = minSize si rien ne tient
    txt.setAttribute('font-size', fs + 'px');
    if (fs < unified) unified = fs;
  });

  textElements.forEach(txt => {
    txt.setAttribute('font-size', unified + 'px');
    // Repositionner les deux lignes autour du centre à la taille finale.
    const spans = txt.querySelectorAll('tspan');
    if (spans.length === 2) {
      const cy = parseFloat(txt.getAttribute('data-cy') ?? txt.getAttribute('y')) || 0;
      const lh = unified * 1.18;
      spans[0].setAttribute('y', cy - lh / 2);
      spans[1].setAttribute('y', cy + lh / 2);
    }
  });
  return unified;
}
