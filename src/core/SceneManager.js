/**
 * SceneManager.js — v2
 *
 * PRINCIPE ULTRA-SIMPLE :
 *   await unwind()              → l'entrée en cours est dénouée
 *   await currentScene.exit()   → noir garanti
 *   await onBoundary()          → silence garanti  (contenu posé par app.js)
 *   await nextScene.enter()     → visible garanti
 *
 * LES QUATRE ÉTAPES SONT DES ÉTAPES, PAS DES SOUHAITS. Chacune est attendue,
 * et aucune ne peut faire échouer les suivantes : une sortie qui plante ne
 * doit pas empêcher d'arriver quelque part, une entrée qui traîne ne doit pas
 * geler la navigation pour toujours.
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
     * L'ENTRÉE EN VOL. Une chorégraphie d'entrée dure longtemps (17 s pour la
     * vitrine), et rien n'interdit de demander à partir pendant qu'elle se
     * joue — la carte du parcours le permet, l'automate le fait.
     *
     * On retient donc la promesse de l'enter() courant pour pouvoir attendre
     * qu'elle se dénoue AVANT d'appeler exit(). Sans cela, les deux se
     * chevauchaient : la scène se démontait pendant qu'elle finissait de se
     * monter, et chacune écrivait par-dessus l'autre.
     * @type {?Promise<void>}
     */
    this._entering = null;

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

  /**
   * Délai au-delà duquel on cesse d'attendre qu'une entrée interrompue se
   * dénoue. Toutes les attentes de scène rejettent aussitôt l'avortement ; ne
   * restent que les rares awaits qui ne passent pas par Scene (le fondu d'un
   * fond, le décodage d'un mp3 au tout premier lancement). Ce plafond est un
   * filet : dépassé, on part quand même — mieux vaut une transition un peu
   * abrupte qu'une navigation qui ne répond plus.
   */
  static get UNWIND_MS() { return 4000; }

  /** Le rendez-vous de frontière, sans laisser une panne casser la navigation. */
  async _boundary(from, to) {
    if (!this.onBoundary) return;
    try { await this.onBoundary({ from, to }); }
    catch (e) { console.error('[SceneManager] Frontière :', e); }
  }

  /**
   * Lance enter() et retient sa promesse le temps qu'elle vive.
   * Une entrée qui échoue est signalée, jamais avalée en silence — mais elle
   * ne doit pas non plus faire tomber la navigation.
   */
  async _enter(scene, params) {
    const p = (async () => {
      try { await scene.enter(params); }
      catch (e) { console.error(`[SceneManager] Entrée « ${scene.name} » :`, e); }
    })();
    this._entering = p;
    try { await p; }
    finally { if (this._entering === p) this._entering = null; }
  }

  /**
   * Interrompt l'entrée en cours et attend qu'elle se dénoue.
   * On ne démonte pas une scène qui est encore en train de se monter.
   */
  async _unwind(scene) {
    if (!this._entering) return;
    scene?.interrupt?.();
    const attente = this._entering;
    const trop = new Promise(r => setTimeout(r, SceneManager.UNWIND_MS));
    const fini = await Promise.race([attente.then(() => true), trop.then(() => false)]);
    if (!fini) {
      console.warn(`[SceneManager] L'entrée de « ${scene?.name} » ne s'est pas dénouée ` +
                   `en ${SceneManager.UNWIND_MS} ms : on part sans l'attendre.`);
    }
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
    await this._enter(scene, params);
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
      // ── ÉTAPE 0 : dénouer l'entrée en cours ────────
      // On peut partir avant que la scène ait fini d'arriver. On l'interrompt
      // et on attend qu'elle se dénoue : sinon les deux se chevauchent, et la
      // moitié d'entrée qui restait à jouer écrivait par-dessus la sortie.
      await this._unwind(this.currentScene);

      // ── ÉTAPE 1 : Exit → noir garanti ──────────────
      // ⚠️ ISOLÉE DANS SON PROPRE try. Une sortie qui échoue ne doit pas
      // empêcher d'ARRIVER : sinon la moindre erreur de nettoyage laissait le
      // visiteur nulle part, sur un écran noir, sans plus aucune issue.
      if (this.currentScene) {
        try { await this.currentScene.exit({ to: name, ...params }); }
        catch (e) { console.error(`[SceneManager] Sortie « ${from} » :`, e); }
      }

      // ── ÉTAPE 1bis : la frontière → silence garanti ─
      // L'écran est noir, la scène précédente a fini de se raconter : c'est
      // ici, et seulement ici, qu'on coupe ce qui traînerait encore.
      await this._boundary(from, name);

      // ── ÉTAPE 2 : Enter → visible garanti ──────────
      this.currentScene = next;
      await this._enter(next, { from, ...params });

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
