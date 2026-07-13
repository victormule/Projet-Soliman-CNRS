/**
 * EventBus.js
 *
 * Canal de communication découplé entre scènes et systèmes.
 * Remplace les callbacks injectés (setNavigateTo, setOnClose, etc.)
 *
 * ÉVÉNEMENTS DÉFINIS :
 *
 *   'navigate'        { to: string }          Demande de changement de scène
 *   'player:open'     { src, label }           Ouvrir le lecteur media
 *   'player:close'    {}                       Lecteur fermé
 *   'hotspot:enter'   { label, title }         Survol hotspot chapitre1
 *   'hotspot:leave'   {}                       Sortie hotspot
 *   'scene:entered'   { name }                 Scène active et visible
 *   'scene:exited'    { name }                 Scène noire et silencieuse
 *   'title:swap'      { toCollab: boolean }    Swap titre haut-gauche
 *
 * USAGE :
 *
 *   import { bus } from './EventBus.js';
 *
 *   // S'abonner
 *   const unsub = bus.on('navigate', ({ to }) => manager.go(to));
 *
 *   // Émettre
 *   bus.emit('navigate', { to: 'phrenologie' });
 *
 *   // Se désabonner
 *   unsub();
 */

class EventBus {
  constructor() {
    this._listeners = {};
  }

  /**
   * S'abonner à un événement.
   * @returns {function} Fonction de désabonnement
   */
  on(event, handler) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(handler);

    // Retourne un unsubscribe
    return () => this.off(event, handler);
  }

  /**
   * Se désabonner d'un événement.
   */
  off(event, handler) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(h => h !== handler);
  }

  /**
   * Émettre un événement.
   */
  emit(event, data = {}) {
    if (!this._listeners[event]) return;
    // Copie du tableau pour éviter les mutations pendant l'itération
    [...this._listeners[event]].forEach(h => {
      try {
        h(data);
      } catch (e) {
        console.error(`[EventBus] Erreur dans handler '${event}':`, e);
      }
    });
  }

  /**
   * S'abonner une seule fois.
   */
  once(event, handler) {
    const unsub = this.on(event, (data) => {
      unsub();
      handler(data);
    });
    return unsub;
  }
}

// Instance singleton
export const bus = new EventBus();
