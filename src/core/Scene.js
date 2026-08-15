/**
 * Scene.js — Classe de base v2.1 (Refactorisée)
 */
import { bus } from './EventBus.js';

export class Scene {
  constructor(name) {
    this.name        = name;
    this.isActive    = false;
    this._timers     = [];
    this._listeners  = [];
    this._abortCtrl  = null;
  }

  /* ── Cycle de vie ─────────────────────────────────── */

  async enter(params = {}) {
    this.isActive   = true;
    this._abortCtrl = new AbortController();
  }

  async exit(params = {}) {
    this.isActive = false;
    this._abortCtrl?.abort();
    this._cleanup();
  }

  /* ── Départ ───────────────────────────────────────
     UN SEUL CHEMIN POUR QUITTER UNE SCÈNE, quelle que soit la destination.

     Les scènes qui ont une sortie ÉCRITE (la bougie qui s'éteint et la
     citation du chapitre 2, la fumée de l'« À Propos » en phrénologie, le
     fondu du chapitre 4) la redéfinissent — et la jouent AVANT de naviguer,
     vers la destination demandée. La flèche de retour n'est plus qu'un cas
     particulier : leaveTo('collaboration').

     C'est ce qui permet à la carte de sauter plus loin sans réécrire une
     seule mise en scène : elle appelle leaveTo(cible) et se tait.

     @param {string} to        scène de destination (clé SceneManager)
     @param {Object} [params]  transmis à enter() de la destination
                               (ex. { part: 'invisibilisation' }) */
  leaveTo(to, params = {}) {
    bus.emit('navigate', { to, ...params });
  }

  /* ── Déplacement SANS quitter la scène ────────────────
     Certaines scènes contiennent plusieurs LIEUX : les trois sous-parties du
     chapitre 2 en sont, et la carte les montre comme des points à part entière.
     Y sauter n'est pas une navigation — la scène ne change pas, il n'y a donc
     ni exit(), ni noir, ni enter().

     Sans ce chemin, la carte était MUETTE à l'intérieur du chapitre 2 : le saut
     passait par `leaveTo`, que app.js refuse quand la destination est la scène
     courante. Aller de « Taire le passé » à l'ouverture du chapitre — un clic
     parfaitement légitime, et le premier qu'on essaie — ne faisait rien du tout.

     @param {Object} params  ex. { part: 'peine-demesuree' }, ou { part: null }
                             pour revenir au lieu principal de la scène.
     @returns {Promise<boolean>|boolean} false si la scène n'a qu'un seul lieu */
  jumpWithin(params = {}) { return false; }

  /* ── Mécaniques Temporelles Centralisées ─────────── */

  /**
   * Attend ms millisecondes. Rejette si la scène est quittée.
   */
  wait(ms, signal = this._abortCtrl?.signal) {
    return new Promise((resolve, reject) => {
      // ⚠️ L'écouteur 'abort' doit être RETIRÉ quand la minuterie se résout
      // normalement. Sans cela, chaque wait() en laissait un sur le signal de
      // la scène : une chorégraphie longue (chapitre 1, phrénologie) en
      // empilait des centaines, tous vivants jusqu'à la sortie de scène.
      // `{ once: true }` ne suffit pas — il ne libère QUE si l'abort survient.
      const onAbort = () => {
        clearTimeout(id);
        this._timers = this._timers.filter(t => t !== id);
        reject(new Error('scene_aborted'));
      };

      const id = setTimeout(() => {
        this._timers = this._timers.filter(t => t !== id);
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      this._timers.push(id);

      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  /**
   * Version silencieuse de wait().
   */
  async pause(ms) {
    try {
      await this.wait(ms);
    } catch {
      throw new Error('scene_interrupted');
    }
  }

  /**
   * Enregistre un timer nettoyable.
   */
  addTimer(fn, delayMs) {
    const id = setTimeout(() => {
      this._timers = this._timers.filter(t => t !== id);
      fn();
    }, delayMs);
    this._timers.push(id);
    return id;
  }

  /**
   * Planifie une fonction à un instant absolu (t0 + targetMs).
   */
  _scheduleAt(t0, targetMs, fn) {
    const remaining = Math.max(0, targetMs - (Date.now() - t0));
    return this.addTimer(fn, remaining);
  }

  /**
   * Attend jusqu'à un instant absolu (t0 + targetMs).
   */
  async _waitUntil(t0, targetMs) {
    const remaining = targetMs - (Date.now() - t0);
    if (remaining > 0) {
      await this.pause(remaining);
    }
  }

  _rawWait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* ── Listeners ───────────────────────────────────── */

  on(el, type, handler, options) {
    el.addEventListener(type, handler, options);
    this._listeners.push({ el, type, handler, options });
  }

  /* ── Nettoyage ───────────────────────────────────── */

  _cleanup() {
    this._timers.forEach(id => clearTimeout(id));
    this._timers = [];
    this._listeners.forEach(({ el, type, handler, options }) => {
      el.removeEventListener(type, handler, options);
    });
    this._listeners = [];
  }
}