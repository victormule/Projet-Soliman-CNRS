/**
 * Journey.js — mémoire du parcours, pour la carte.
 * ─────────────────────────────────────────────────────────────────────────────
 * RESPONSABILITÉ UNIQUE : savoir OÙ le visiteur est déjà allé. La carte ne
 * dessine un point (et la route qui y mène) que si l'endroit a été atteint.
 *
 * ⚠️ DEUX MÉMOIRES, JAMAIS RECOPIÉES L'UNE DANS L'AUTRE.
 *
 *   · les SCÈNES (vitrine, phrénologie, collaboration, chapitres) → ici,
 *     sous la clé `soliman.journey.v1` ;
 *   · les SOUS-PARTIES DU CHAPITRE 2 → chp2-progress.js, tel quel. Ce module
 *     existe déjà, il est persisté, éprouvé, et c'est LUI qui décide du
 *     déverrouillage des crânes. En recopier l'état ici créerait une seconde
 *     vérité qui divergerait au premier oubli. On le LIT.
 *
 * Corollaire heureux : la carte ne peut pas ouvrir une porte que le chapitre
 * garde fermée. `computeUnlocked` renvoie toujours un préfixe de l'ordre des
 * crânes, donc « visité » est toujours inclus dans « déverrouillé » — un point
 * qui s'affiche est forcément un point où l'on pouvait aller.
 *
 * PERSISTANCE : localStorage, sous try/catch (navigation privée, quotas,
 * stockage désactivé). En cas d'échec, un cache mémoire garde l'expérience
 * cohérente le temps de la session. Même mécanique que chp2-progress.
 *
 * Remise à zéro pour une démo :  window.__solimanResetJourney()
 * (celle du chapitre 2 reste séparée : window.__chp2ResetProgress())
 */

import { getProgress } from '../../Chapitre2/chp2-src/chp2-progress.js';

const STORAGE_KEY = 'soliman.journey.v1';

/** Cache mémoire de secours si localStorage est indisponible. */
let _memoire = null;

/** True si une écriture a déjà échoué (évite de répéter l'avertissement). */
let _casse = false;

/* ── Lecture / écriture bas niveau ──────────────────────────────────────── */

function _lire() {
  if (_memoire) return _memoire;
  try {
    const brut = window.localStorage.getItem(STORAGE_KEY);
    if (!brut) return { visited: {} };
    const parsed = JSON.parse(brut);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.visited !== 'object') {
      return { visited: {} };
    }
    return { visited: { ...parsed.visited } };
  } catch {
    _memoire = { visited: {} };
    return _memoire;
  }
}

function _ecrire(etat) {
  _memoire = { visited: { ...etat.visited } };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(_memoire));
  } catch {
    if (!_casse) {
      _casse = true;
      console.warn('[Journey] localStorage indisponible — parcours gardé en mémoire pour la session.');
    }
  }
}

/* ── API ────────────────────────────────────────────────────────────────── */

/**
 * Marque un lieu comme atteint. Idempotent.
 * @param {string} id  identifiant de nœud ('vitrine', 'chapitre2'…)
 * @returns {boolean} true si c'est une DÉCOUVERTE (première visite)
 */
export function visit(id) {
  if (!id) return false;
  const etat = _lire();
  if (etat.visited[id]) return false;
  etat.visited[id] = true;
  _ecrire(etat);
  return true;
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isVisited(id) {
  if (!id) return false;
  // Les trois sous-parties du chapitre 2 : leur vérité vit ailleurs.
  const crane = CHP2_NODES[id];
  if (crane) {
    try { return !!getProgress().visited[crane]; } catch { return false; }
  }
  return !!_lire().visited[id];
}

/** Correspondance nœud de carte → crâne du chapitre 2 (cf. chp2-opening SKULLS). */
const CHP2_NODES = {
  'chp2-136': '136',
  'chp2-137': '137',
  'chp2-138': '138',
};

/** Remise à zéro du parcours (outil de démonstration). */
export function reset() {
  _memoire = { visited: {} };
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignoré */ }
}

try { window.__solimanResetJourney = reset; } catch { /* ignoré */ }
