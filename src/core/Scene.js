/**
 * Scene.js — Classe de base v2.1 (Refactorisée)
 */
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

  /* ── Mécaniques Temporelles Centralisées ─────────── */

  /**
   * Attend ms millisecondes. Rejette si la scène est quittée.
   */
  wait(ms, signal = this._abortCtrl?.signal) {
    return new Promise((resolve, reject) => {
      const id = setTimeout(() => {
        this._timers = this._timers.filter(t => t !== id);
        resolve();
      }, ms);
      this._timers.push(id);

      signal?.addEventListener('abort', () => {
        clearTimeout(id);
        this._timers = this._timers.filter(t => t !== id);
        reject(new Error('scene_aborted'));
      }, { once: true });
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