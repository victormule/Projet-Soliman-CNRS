/**
 * cursor.js
 * Gestion du curseur custom
 */

/**
 * Sélecteurs des éléments cliquables
 */
export const CLICKABLE_SELECTORS = [
  '#nav-arrow',
  '.doc-btn',
  '.roman-btn',
  '.nav-btn-zone',
  '#fs-btn',
  '[data-clickable]',
].join(',');

/**
 * Initialise le curseur custom
 */
export function initCursor() {
  const cursorEl = document.getElementById('cursor');
  if (!cursorEl) return;

  let mouseX = 0;
  let mouseY = 0;
  let lastHitCheck = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    cursorEl.style.left = mouseX + 'px';
    cursorEl.style.top = mouseY + 'px';

    // Throttle à ~60fps
    const now = Date.now();
    if (now - lastHitCheck < 16) return;
    lastHitCheck = now;

    const hit = document.elementFromPoint(mouseX, mouseY);
    const isClickable = hit && (
      hit.matches(CLICKABLE_SELECTORS) || 
      hit.closest(CLICKABLE_SELECTORS)
    );
    const isHotspot = hit && (
      hit.matches('.hotspot-zone') || 
      hit.closest('.hotspot-zone')
    );

    cursorEl.classList.toggle('active', !!isClickable);
    cursorEl.classList.toggle('hotspot', !!isHotspot);
  });
}
