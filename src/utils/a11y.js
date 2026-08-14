/**
 * a11y.js — rendre le site utilisable au clavier et au lecteur d'écran.
 * ─────────────────────────────────────────────────────────────────────────────
 * LE PROBLÈME QUE CE MODULE RÉSOUT
 *
 * Toute l'interface du site est faite de <div> et de <svg> construits en JS :
 * boutons documents, cercles romains, flèches, hotspots, bulles. Visuellement
 * c'est juste ; pour le navigateur, aucun de ces éléments n'est un contrôle.
 * Résultat mesuré avant correction : ZÉRO élément focusable sur toute la page,
 * une première tabulation qui laissait le focus sur <body>, et un écran
 * d'accueil (<div> sans rôle) où la touche Entrée ne démarrait rien —
 * l'expérience était littéralement inatteignable sans souris.
 *
 * LE PARTI PRIS
 *
 * On ne réécrit pas l'interface en <button> natifs : cela casserait la mise en
 * scène (tracés SVG animés, effets de survol dorés, positionnement au pixel).
 * On AJOUTE la sémantique manquante sur les éléments existants — rôle, ordre de
 * tabulation, nom accessible — et on fait suivre le clavier au pointeur.
 *
 * `activate()` synthétise un vrai `click()` plutôt que d'appeler un callback :
 * les composants posent déjà leur `onclick`, et un seul chemin d'activation
 * vaut mieux que deux qui peuvent diverger.
 *
 * CE QUE CE MODULE NE PRÉTEND PAS FAIRE
 *
 * Une expérience narrative immersive, sonore et chronométrée ne sera jamais
 * pleinement conforme au RGAA. L'objectif tenu ici est le socle : tout ce qui
 * est cliquable est atteignable au clavier, nommé, et signalé quand il change.
 */

/** Éléments rendus activables — pour retirer proprement les écouteurs. */
const _wired = new WeakSet();

/**
 * Rend un élément atteignable et activable au clavier.
 *
 * @param {?Element} el
 * @param {Object}  [opts]
 * @param {string}  [opts.label]    nom accessible (aria-label)
 * @param {string}  [opts.role]     rôle ARIA (défaut 'button')
 * @param {boolean} [opts.disabled] retire l'élément de l'ordre de tabulation
 */
export function makeActivatable(el, opts = {}) {
  if (!el) return;
  const { label, role = 'button', disabled = false } = opts;

  el.setAttribute('role', role);
  el.setAttribute('tabindex', disabled ? '-1' : '0');
  // Un composant masqué puis réaffiché (les flèches) doit redevenir visible
  // aux lecteurs d'écran : hide() pose aria-hidden, show() le retire ici.
  el.removeAttribute('aria-hidden');
  if (label) el.setAttribute('aria-label', label);
  if (disabled) el.setAttribute('aria-disabled', 'true');
  else          el.removeAttribute('aria-disabled');

  // Un seul câblage par élément, même si le composant se reconstruit.
  if (_wired.has(el)) return;
  _wired.add(el);

  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    if (el.getAttribute('aria-disabled') === 'true') return;
    // Espace fait défiler la page par défaut ; Entrée peut valider un formulaire.
    e.preventDefault();
    el.click();
  });
}

/**
 * Marque un élément comme purement décoratif : invisible aux lecteurs d'écran
 * et hors de l'ordre de tabulation.
 * @param {?Element} el
 */
export function markDecorative(el) {
  if (!el) return;
  el.setAttribute('aria-hidden', 'true');
  el.removeAttribute('tabindex');
}

/* ── Annonces vocales ──────────────────────────────────────────────────────
   Le site change de scène sans changer d'URL ni de titre : pour un lecteur
   d'écran, rien ne se passe. Une région live annonce donc les changements. */

let _liveEl = null;

function _live() {
  if (_liveEl && _liveEl.isConnected) return _liveEl;
  _liveEl = document.getElementById('a11y-live');
  if (!_liveEl) {
    _liveEl = document.createElement('div');
    _liveEl.id = 'a11y-live';
    _liveEl.className = 'sr-only';
    _liveEl.setAttribute('role', 'status');
    _liveEl.setAttribute('aria-live', 'polite');
    _liveEl.setAttribute('aria-atomic', 'true');
    document.body.appendChild(_liveEl);
  }
  return _liveEl;
}

/**
 * Annonce un message aux technologies d'assistance.
 * @param {string} message
 */
export function announce(message) {
  if (!message) return;
  const el = _live();
  // Vider puis réécrire au tick suivant : sans cela, deux annonces identiques
  // consécutives ne sont pas relues (le contenu n'a pas « changé »).
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = String(message); });
}
