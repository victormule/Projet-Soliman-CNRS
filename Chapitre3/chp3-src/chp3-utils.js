/* =====================================================================
   Chapitre 3 — chp3-utils.js
   Utilitaires PURS du moteur (aucun état, aucun effet de bord au
   chargement) : accès DOM raccourci, clamp/easings/amortissement,
   et chargement responsive des visuels de tableau (srcset natif).

   Extrait de chp3-openning.js (Phase 2, découpage du monolithe).
   ===================================================================== */

import { CONFIG } from './chp3-config.js';

export const $      = id => document.getElementById(id);
export const clamp  = (v,a,b) => v<a?a:(v>b?b:v);
export const smooth = t => { t=clamp(t,0,1); return t*t*(3-2*t); };
export const easeInOutQuad = t => t<0.5 ? 2*t*t : -1+(4-2*t)*t;
export const easeInOutSine = t => -(Math.cos(Math.PI*clamp(t,0,1))-1)/2;
export const easeOutCubic  = t => 1-Math.pow(1-t,3);
// Amortissement indépendant du framerate : rapproche `a` de `b`.
export const damp = (a,b,lambda,dt) => a + (b-a)*(1-Math.exp(-lambda*dt));

// Charge une variante allégée sur petit écran / faible DPR via `srcset`
// natif : aucune logique de media-query à maintenir, le navigateur choisit
// seul le candidat (et réévalue de lui-même au resize/zoom, sans listener).
// `small` doit faire exactement la moitié de la largeur de `full` (convention
// du projet, cf. fichiers *-800.*) ; `sizes` approxime la largeur affichée
// du cadre (T.matVw = fraction de la largeur de fenêtre) — une légère
// sur-estimation est volontaire et sans risque (jamais plus flou que nécessaire).
export const RV_SIZES = (CONFIG.tableau.matVw * 100) + 'vw';
export function setResponsiveSrc(el, full, small) {
    if (small) { el.sizes = RV_SIZES; el.srcset = `${small} 800w, ${full} 1600w`; }
    else       { el.removeAttribute('sizes'); el.removeAttribute('srcset'); }
    el.src = full;   // repli (UA sans support srcset) + valeur par défaut si `small` absent
}
