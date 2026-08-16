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

    /**
     * UN DÉPART EST-IL ENGAGÉ ? Posé par beginLeave(), rendu à false par
     * enter(). Voir beginLeave() pour ce que cela garantit.
     */
    this._leaving = false;

    /**
     * Le verrou d'interaction. Les scènes le lèvent quand leur mise en place
     * est finie et le referment en partant ; il vivait recopié dans chacune,
     * il vit maintenant ici, avec beginLeave() qui le referme.
     */
    this._navigationActive = false;
  }

  /* ── Cycle de vie ─────────────────────────────────── */

  async enter(params = {}) {
    this.isActive   = true;
    this._leaving   = false;
    this._abortCtrl = new AbortController();
  }

  async exit(params = {}) {
    this.isActive = false;
    this._abortCtrl?.abort();
    this._cleanup();
  }

  /* ── Interruption d'une ENTRÉE en cours ───────────────────────────────
     Une chorégraphie d'entrée dure longtemps (17 s pour la vitrine) : on peut
     très bien demander à partir pendant qu'elle se joue. Le SceneManager
     interrompt alors la scène AVANT de la faire sortir, et attend que son
     enter() se dénoue — on ne démonte pas une scène qui est encore en train
     de se monter.

     C'est un simple avortement du signal : toutes les attentes de la scène
     (wait/pause/_waitUntil) rejettent, et le `catch` qui enveloppe chaque
     enter() les absorbe. exit() ré-avortera, sans effet — l'opération est
     idempotente. */
  interrupt() { this._abortCtrl?.abort(); }

  /* ── Annonce d'arrivée ────────────────────────────────────────────────
     UNE SCÈNE QU'ON A QUITTÉE N'ANNONCE PAS SON ARRIVÉE. Le signal ne sert
     pas qu'à l'affichage : il écrit le titre de l'onglet, l'annonce au lecteur
     d'écran, la mémoire du parcours (Journey) et le point courant de la carte.
     Émis par une entrée interrompue, il allumait sur la carte un lieu où l'on
     n'était plus, et disait au visiteur non-voyant qu'il venait d'arriver dans
     une scène déjà quittée. La garde est ici, en un seul endroit, plutôt que
     répétée dans les sept scènes. */
  announceEntered() {
    if (!this.isActive) return;
    bus.emit('scene:entered', { name: this.name });
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
    if (!this.beginLeave()) return;
    bus.emit('navigate', { to, ...params });
  }

  /* ── Le départ s'engage : l'interface s'efface ─────────────────────────
     UN DÉPART, UN SEUL — ET LA FLÈCHE PART AVEC.

     Une sortie ÉCRITE dure : la bougie du chapitre 2 s'éteint et sa citation
     se tape (une vingtaine de secondes), la fumée de l'« À Propos » passe, le
     chapitre 4 fond au noir. Pendant tout ce temps la scène est encore là — et
     ses flèches l'étaient aussi, visibles ET cliquables. Un second clic
     rejouait alors la sortie par-dessus la première ; par la carte, on pouvait
     demander une destination pendant qu'on partait déjà vers une autre.

     beginLeave() ferme les deux portes d'un coup : le verrou de navigation, et
     les flèches, qui s'effacent par hide() — donc en emmenant la boussole avec
     elles (ArrowBase émet 'nav-arrow:hidden'). Le second appel rend false : la
     scène sait ainsi qu'un départ court déjà et n'en rejoue pas la mise en
     scène.

     @returns {boolean} false si un départ est DÉJÀ engagé. */
  beginLeave() {
    if (this._leaving) return false;
    this._leaving          = true;
    this._navigationActive = false;
    this.arrows().forEach(a => a?.hide?.());
    return true;
  }

  /** Un départ est-il déjà engagé ? À tester avant de (re)montrer une flèche. */
  get leaving() { return this._leaving; }

  /**
   * TOUTES les flèches de la scène — celles qu'un départ doit effacer.
   * Redéfini par chaque scène qui en possède ; la liste doit être complète,
   * sans quoi la flèche oubliée reste cliquable pendant toute la sortie.
   * @returns {Array<{hide?: function}>}
   */
  arrows() { return []; }

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
      /* ⚠️ UN SIGNAL DÉJÀ AVORTÉ N'ÉMETTRA PLUS JAMAIS 'abort'.
         Sans ce test, l'écouteur posé plus bas ne servait à rien et l'attente
         se résolvait NORMALEMENT : une entrée de scène interrompue continuait
         donc de se jouer, plusieurs secondes après qu'on l'a quittée.

         Mesuré sur la vitrine : quitter à 900 ms laissait son enter() reprendre
         à 2159 ms et appeler torch.grow() — en plein milieu du torch.fadeOut()
         de son propre exit(). grow() annule le fondu, dont la promesse était
         alors perdue (corrigé aussi, cf. TorchSystem.cancelFade) : exit()
         attendait pour toujours, isTransitioning restait vrai, et PLUS AUCUNE
         navigation ne passait. La scène annonçait même son arrivée à 7115 ms,
         alors qu'on était ailleurs depuis longtemps. */
      if (signal?.aborted) { reject(new Error('scene_aborted')); return; }

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