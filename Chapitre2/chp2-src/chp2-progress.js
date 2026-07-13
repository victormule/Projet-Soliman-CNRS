/**
 * chp2-progress.js — Persistance de la progression des crânes du chapitre 2.
 * ─────────────────────────────────────────────────────────────────────────────
 * RESPONSABILITÉ UNIQUE : mémoriser quelles sous-parties ont été « visitées »
 * (overlay ouvert avec succès) et en dériver la liste des crânes déverrouillés.
 *
 * MODÈLE DE DÉBLOCAGE (linéaire, auto-cohérent) :
 *   - le 1ᵉʳ crâne de l'ordre est toujours déverrouillé ;
 *   - le crâne d'indice i est déverrouillé SSI son prédécesseur (i-1) a été visité.
 *
 *   Visité ∅            → [136]
 *   Visité {136}        → [136, 137]
 *   Visité {136,137}    → [136, 137, 138]
 *
 * Comme on ne peut visiter un crâne que s'il est déverrouillé, et qu'il n'est
 * déverrouillé que si le précédent est visité, la progression reste strictement
 * linéaire : ce calcul est donc « self-healing » même si le storage est partiel
 * ou incohérent.
 *
 * PERSISTANCE : localStorage, encapsulé dans un try/catch (navigation privée,
 * quotas, storage désactivé). En cas d'échec, on retombe sur un cache mémoire
 * pour que l'expérience reste cohérente le temps de la session.
 *
 * Le module est SANS ÉTAT propre au chapitre (hors cache de secours) : il peut
 * être importé une seule fois et partagé entre les ré-évaluations cache-bustées
 * du module openning.
 */

"use strict";

const STORAGE_KEY = 'soliman.chp2.progress.v1';

/** Cache mémoire de secours si localStorage est indisponible. */
let _memoryFallback = null;

/** True si une écriture localStorage a déjà échoué (évite de spammer la console). */
let _storageBroken = false;

/* ── Lecture / écriture bas niveau ──────────────────────────────────────── */

function _readRaw() {
  if (_memoryFallback) return _memoryFallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { visited: {} };
    const parsed = JSON.parse(raw);
    // Garde-fou contre un storage corrompu / d'une ancienne version.
    if (!parsed || typeof parsed !== 'object' || typeof parsed.visited !== 'object') {
      return { visited: {} };
    }
    return { visited: { ...parsed.visited } };
  } catch (e) {
    // JSON invalide ou accès refusé : on repart d'un état vierge en mémoire.
    _memoryFallback = { visited: {} };
    return _memoryFallback;
  }
}

function _writeRaw(state) {
  // On garde toujours une copie mémoire à jour (source de vérité de la session).
  _memoryFallback = { visited: { ...state.visited } };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(_memoryFallback));
  } catch (e) {
    if (!_storageBroken) {
      _storageBroken = true;
      console.warn('[chp2-progress] localStorage indisponible — progression gardée en mémoire pour la session.');
    }
  }
}

/* ── API publique ───────────────────────────────────────────────────────── */

/**
 * @returns {{ visited: Object<string, boolean> }} Copie défensive de l'état.
 */
export function getProgress() {
  return _readRaw();
}

/**
 * Marque une sous-partie comme visitée (idempotent).
 * @param {string} skullId  Identifiant du crâne ('136', '137', '138').
 * @returns {boolean} true si l'état a changé (première visite), false sinon.
 */
export function markVisited(skullId) {
  if (!skullId) return false;
  const state = _readRaw();
  if (state.visited[skullId]) return false;
  state.visited[skullId] = true;
  _writeRaw(state);
  return true;
}

/**
 * Déduit la liste ordonnée des crânes déverrouillés.
 * @param {string[]} order  Ordre de progression, ex. ['136','137','138'].
 * @returns {string[]} Sous-ensemble préfixe de `order`.
 */
export function computeUnlocked(order) {
  if (!Array.isArray(order) || order.length === 0) return [];
  const visited = getProgress().visited;
  const unlocked = [order[0]];
  for (let i = 1; i < order.length; i++) {
    if (visited[order[i - 1]]) unlocked.push(order[i]);
    else break;
  }
  return unlocked;
}

/**
 * Réinitialise la progression (outil de développement / démo).
 * Exposé sur window pour pouvoir relancer l'expérience « première visite ».
 */
export function resetProgress() {
  _memoryFallback = { visited: {} };
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (e) { /* ignoré */ }
}

// Pratique pour tester en console : window.__chp2ResetProgress()
try { window.__chp2ResetProgress = resetProgress; } catch (e) { /* ignoré */ }
