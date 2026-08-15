/**
 * Blackout.js — le passage au noir, écrit UNE fois.
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE C'EST : la MÉCANIQUE d'un voile noir (couvrir, découvrir), pas un
 * élément. On lui passe le voile à piloter.
 *
 * ⚠️ POURQUOI PAS UN VOILE UNIQUE, PARTAGÉ PAR TOUT LE SITE ?
 * Parce que les voiles du site ne sont pas interchangeables DE PLACE, et que
 * cette place est voulue. Celui du chapitre 2 (#chp2-fade) vit DANS
 * #chapitre2-root : vu depuis #app il vaut donc 500, soit SOUS les titres
 * (remontés à 600 par body.chp2-active). C'est ce qui laisse « Espace
 * collaboratif » et le sous-titre du chapitre lisibles pendant que le chapitre
 * fond au noir. Un voile unique au sommet de la pile les recouvrirait — ce
 * serait un changement de mise en scène, pas une simplification.
 * Ce qui doit être unique, c'est la MÉCANIQUE. C'est elle qui avait divergé.
 *
 * ⚠️ LE PIÈGE QUE CE MODULE EXISTE POUR SUPPRIMER — mesuré, pas supposé.
 * Trois blocs quasi identiques posaient ce voile dans chp2-opening.js. Deux
 * coupaient la transition avant de monter au noir, le troisième non :
 *
 *     el.style.transition = 'opacity 3s ease';   // ← la transition est DÉJÀ posée
 *     el.classList.add('out');                   // → la montée au noir s'anime sur 3 s
 *     void el.offsetWidth;
 *     el.classList.remove('out');                // → et on l'annule aussitôt
 *
 * L'opacité ne bougeait pas d'un iota : le voile du retour d'« Invisibilisation »
 * ne s'est jamais joué. Relevé au banc : 0,00 pendant tout le retour, quand la
 * même mesure donnait 36 % sur « Peine démesurée ». Le correctif tient en un
 * mot — couvrir SANS transition, et ne poser la durée que pour découvrir.
 *
 * ⚠️ ET LE `void offsetWidth` N'EST PAS UN PORTE-BONHEUR. Il force le calcul du
 * style, donc il COMMET l'opacité courante comme « style d'avant » du prochain
 * changement. Sans lui, poser 1 puis 0 dans la même tâche ne produit aucune
 * transition : le navigateur ne voit qu'un état final. C'est la seule raison
 * de sa présence, et il doit rester entre les deux écritures.
 *
 * ⚠️ NETTOYAGE OBLIGATOIRE À LA FIN DE reveal(). Un style EN LIGNE bat toute
 * règle de feuille non `!important`. Si l'on laissait `opacity:0` en ligne, la
 * classe `.out` de chp2-opening.css (`#chp2-fade.out { opacity: 1 }`) — encore
 * utilisée ailleurs — deviendrait silencieusement inopérante : le voile ne
 * monterait plus jamais. reveal() rend donc l'élément à sa feuille.
 *
 * USAGE
 *     import * as Blackout from '../../src/core/Blackout.js';
 *
 *     await Blackout.cover(el, 1200);   // fondu au noir en 1,2 s
 *     await Blackout.cover(el);         // au noir SEC (et commis)
 *     await Blackout.reveal(el, 2500);  // le noir se retire en 2,5 s
 */

/** Résout après ms (+ une marge : la transition doit être finie, pas « presque »). */
function _after(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms + 20));
}

/**
 * Amène le voile à l'opacité pleine.
 *
 * @param {?Element} el   le voile (position:fixed/absolute, plein cadre, noir)
 * @param {number} [ms]   durée du fondu au noir ; 0 = instantané
 * @returns {Promise<void>} résolue quand l'écran est effectivement couvert
 */
export function cover(el, ms = 0) {
  if (!el) return Promise.resolve();

  if (ms <= 0) {
    el.style.transition = 'none';
    el.style.opacity    = '1';
    void el.offsetWidth;          // commit — voir l'en-tête
    return Promise.resolve();
  }

  // On part d'un zéro COMMIS, sinon un voile déjà à 1 ne fondrait pas.
  el.style.transition = 'none';
  el.style.opacity    = '0';
  void el.offsetWidth;
  el.style.transition = `opacity ${ms}ms ease`;
  el.style.opacity    = '1';
  return _after(ms);
}

/**
 * Retire le voile.
 *
 * @param {?Element} el
 * @param {number} [ms]   durée du fondu ; 0 = retrait instantané
 * @returns {Promise<void>} résolue quand le voile est parti ET rendu à sa feuille
 */
export function reveal(el, ms = 0) {
  if (!el) return Promise.resolve();

  if (ms <= 0) {
    el.style.transition = 'none';
    el.style.opacity    = '0';
    void el.offsetWidth;
    _release(el);
    return Promise.resolve();
  }

  el.style.transition = `opacity ${ms}ms ease`;
  el.style.opacity    = '0';
  return _after(ms).then(() => _release(el));
}

/** Rend l'élément à sa feuille de style (cf. l'avertissement en tête). */
function _release(el) {
  el.style.transition = '';
  el.style.opacity    = '';
}
