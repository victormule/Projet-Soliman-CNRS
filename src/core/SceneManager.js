/**
 * SceneManager.js — v2
 *
 * PRINCIPE ULTRA-SIMPLE :
 *   await currentScene.exit()   → noir garanti
 *   await onBoundary()          → silence garanti  (contenu posé par app.js)
 *   await nextScene.enter()     → visible garanti
 *
 * Le SceneManager ne connaît ni l'audio, ni la torche, ni le DOM.
 * Il orchestre les appels enter/exit et ménage entre les deux un RENDEZ-VOUS
 * DANS LE NOIR (onBoundary) dont il ignore le contenu.
 * La logique de transition (fade fond, torche, UI) est dans chaque scène.
 */

export class SceneManager {
  constructor() {
    this.scenes          = new Map();
    this.currentScene    = null;
    this.isTransitioning = false;

    /**
     * LA FRONTIÈRE. Appelée DANS LE NOIR, entre exit() et enter() : le seul
     * instant où plus aucune scène n'est à l'écran. app.js y garantit le
     * SILENCE, comme les scènes garantissent le noir — voir
     * AudioManager.enforceSilence.
     *
     * Le manager ne sait toujours rien de l'audio : il ne connaît que ce
     * rendez-vous et le nom des deux scènes.
     *
     * @type {?function({from: ?string, to: string}): (void|Promise<void>)}
     */
    this.onBoundary = null;
  }

  /** Le rendez-vous de frontière, sans laisser une panne casser la navigation. */
  async _boundary(from, to) {
    if (!this.onBoundary) return;
    try { await this.onBoundary({ from, to }); }
    catch (e) { console.error('[SceneManager] Frontière :', e); }
  }

  register(scene) {
    this.scenes.set(scene.name, scene);
  }

  /**
   * Démarrer à une scène sans exit préalable.
   * Utilisé au lancement de l'expérience.
   */
  async startAt(name, params = {}) {
    const scene = this.scenes.get(name);
    if (!scene) {
      console.error(`[SceneManager] Scene inconnue : ${name}`);
      return;
    }

    await this._boundary(null, name);
    this.currentScene = scene;
    await scene.enter(params);
  }

  /**
   * Transition vers une nouvelle scène.
   *
   * 1. exit()  de la scène courante → noir garanti
   * 2. enter() de la nouvelle scène → visible garanti
   *
   * Si une transition est déjà en cours, l'appel est ignoré.
   * (Pas de file d'attente — simplicité avant tout.)
   */
  async go(name, params = {}) {
    if (this.isTransitioning) {
      console.warn(`[SceneManager] Transition en cours, ignoré : ${name}`);
      return;
    }

    if (this.currentScene?.name === name) {
      console.warn(`[SceneManager] Déjà sur : ${name}`);
      return;
    }

    const next = this.scenes.get(name);
    if (!next) {
      console.error(`[SceneManager] Scene inconnue : ${name}`);
      return;
    }

    this.isTransitioning = true;
    const from = this.currentScene?.name ?? null;

    try {
      // ── ÉTAPE 1 : Exit → noir garanti ──────────────
      if (this.currentScene) {
        await this.currentScene.exit({ to: name, ...params });
      }

      // ── ÉTAPE 1bis : la frontière → silence garanti ─
      // L'écran est noir, la scène précédente a fini de se raconter : c'est
      // ici, et seulement ici, qu'on coupe ce qui traînerait encore.
      await this._boundary(from, name);

      // ── ÉTAPE 2 : Enter → visible garanti ──────────
      this.currentScene = next;
      await next.enter({ from, ...params });

    } catch (e) {
      console.error('[SceneManager] Erreur transition :', e);
    } finally {
      this.isTransitioning = false;
    }
  }

  onResize() {
    this.currentScene?.onResize?.();
  }
}
