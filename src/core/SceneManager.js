/**
 * SceneManager.js — v2
 *
 * PRINCIPE ULTRA-SIMPLE :
 *   await currentScene.exit()   → noir garanti
 *   await nextScene.enter()     → visible garanti
 *
 * Le SceneManager ne connaît ni l'audio, ni la torche, ni le DOM.
 * Il orchestre seulement les appels enter/exit.
 * La logique de transition (fade fond, torche, UI) est dans chaque scène.
 */

export class SceneManager {
  constructor() {
    this.scenes          = new Map();
    this.currentScene    = null;
    this.isTransitioning = false;
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

    console.log(`[SceneManager] Start → ${name}`);
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

    console.log(`[SceneManager] ${from} → ${name}`);

    try {
      // ── ÉTAPE 1 : Exit → noir garanti ──────────────
      if (this.currentScene) {
        await this.currentScene.exit({ to: name, ...params });
        console.log(`[SceneManager] ${from} → NOIR ✓`);
      }

      // ── ÉTAPE 2 : Enter → visible garanti ──────────
      this.currentScene = next;
      await next.enter({ from, ...params });
      console.log(`[SceneManager] ${name} → VISIBLE ✓`);

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
