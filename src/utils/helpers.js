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

export function unifyFontSize(textElements, maxWidth, startSize) {
  let unified = startSize;
  textElements.forEach(txt => {
    let fs = startSize;
    while (txt.getComputedTextLength() > maxWidth && fs > 6) {
      fs -= 0.5;
      txt.setAttribute('font-size', fs + 'px');
    }
    if (fs < unified) unified = fs;
  });
  textElements.forEach(txt => txt.setAttribute('font-size', unified + 'px'));
  return unified;
}
