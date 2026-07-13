/* =====================================================================
   Chapitre 3 — chp3-grain.js
   Grain argentique optionnel : bruit SVG (feTurbulence) posé en fond de
   #chp3-grain et « secoué » à ~11 fps pour l'aspect pellicule.

   Extrait de chp3-openning.js (Phase 2, découpage du monolithe).
   Activation pilotée par CONFIG.grain + prefers-reduced-motion (l'appelant
   décide) ; le moteur fournit isActive() pour stopper la boucle dès qu'il
   est démonté, et appelle stop() dans son propre stop().
   ===================================================================== */

import { $ } from './chp3-utils.js';

/**
 * Démarre le grain sur #chp3-grain.
 * @param {() => boolean} isActive  true tant que le moteur est monté.
 * @returns {{ stop: () => void }}
 */
export function startGrain(isActive) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>
        <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>
        <feColorMatrix type='saturate' values='0'/></filter>
        <rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`;
    const g = $('chp3-grain');
    let timer = null;
    g.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    g.style.backgroundSize  = '160px 160px';
    (function jit() {
        if (!isActive()) return;
        g.style.backgroundPosition = `${(Math.random()*20)|0}px ${(Math.random()*20)|0}px`;
        timer = setTimeout(jit, 90);   // ~11 fps
    })();
    return {
        stop() { if (timer) { clearTimeout(timer); timer = null; } },
    };
}
