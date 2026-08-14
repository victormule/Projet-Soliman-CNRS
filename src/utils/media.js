/**
 * media.js — servir une vidéo allégée aux téléphones et tablettes.
 * ─────────────────────────────────────────────────────────────────────────────
 * LE PROBLÈME
 *
 * Le site porte ~281 Mo de .mp4, encodés pour un grand écran. Sur un téléphone
 * en 4G, une seule de ces vidéos (jusqu'à 23 Mo) suffit à faire attendre —
 * pour un rendu que l'écran ne peut de toute façon pas montrer.
 *
 * LA RÈGLE
 *
 *   ordinateur           → le fichier d'origine, intact ;
 *   téléphone, tablette  → la variante allégée, si elle existe.
 *
 * La variante vit dans un sous-dossier `mobile/` À CÔTÉ de l'originale :
 *
 *   Chapitre2/chp2-medias/Voyeur.mp4
 *   Chapitre2/chp2-medias/mobile/Voyeur.mp4     ← même nom, dossier en plus
 *
 * Ce choix garde les deux versions côte à côte : on voit d'un coup d'œil ce
 * qui a été décliné et ce qui ne l'a pas encore été. Les variantes se
 * fabriquent par `npm run videos` (tools/compress-videos.mjs).
 *
 * ⚠️ LE REPLI EST ESSENTIEL, PAS DÉCORATIF.
 *
 * Les variantes mobiles peuvent ne pas exister — c'est même l'état du dépôt
 * tant que la passe de compression n'a pas été lancée et validée à l'œil. Sans
 * repli, un téléphone n'obtiendrait alors RIEN : écran noir au lieu d'une
 * vidéo. `setVideoSrc()` écoute donc l'erreur de chargement et rebascule UNE
 * fois sur l'original. Le site fonctionne ainsi identiquement avant et après la
 * compression ; seule la légèreté change.
 *
 * ⚠️ NE PAS APPLIQUER AUX SONS. Les .mp3 du site pèsent 28 Mo à eux tous, et
 * une voix comprimée deux fois s'entend. Seul le .mp4 est décliné.
 */

/** Mémoïsé : la nature de l'appareil ne change pas en cours de visite. */
let _petitAppareil = null;

/**
 * Vrai sur téléphone et tablette — ou si l'utilisateur a demandé au navigateur
 * d'économiser les données.
 *
 * On s'aligne sur `body.is-touch`, posé une fois par app.js : une seule
 * définition de « appareil tactile » pour tout le site, pas deux qui dérivent.
 * Le repli sur matchMedia sert aux modules chargés avant elle.
 *
 * @returns {boolean}
 */
export function prefersLightMedia() {
  if (_petitAppareil !== null) return _petitAppareil;
  const tactile = document.body?.classList.contains('is-touch')
               ?? (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
  const economie = navigator.connection?.saveData === true;
  _petitAppareil = !!(tactile || economie);
  return _petitAppareil;
}

/**
 * Chemin de la variante allégée d'une vidéo, ou `null` s'il n'y a pas lieu
 * d'en chercher une (ordinateur, ou fichier qui n'est pas un .mp4).
 *
 * @param {string} src
 * @returns {?string}
 */
export function lightVideoSrc(src) {
  if (typeof src !== 'string' || !/\.mp4(\?.*)?$/i.test(src)) return null;
  if (!prefersLightMedia()) return null;
  const i = src.lastIndexOf('/');
  return i < 0 ? 'mobile/' + src
               : src.slice(0, i) + '/mobile/' + src.slice(i + 1);
}

/**
 * Pose la source d'un <video> : la variante allégée sur petit appareil, sinon
 * l'original — avec repli automatique si la variante manque.
 *
 * @param {HTMLMediaElement} el
 * @param {string} src  chemin de l'ORIGINAL, tel qu'écrit dans la config
 * @returns {string} le chemin réellement posé (utile pour comparer ensuite)
 */
export function setVideoSrc(el, src) {
  if (!el) return src;
  const light = lightVideoSrc(src);
  if (!light) { el.src = src; return src; }

  // Un seul repli par élément : sans ce garde, une erreur sur l'ORIGINAL
  // relancerait le même chargement en boucle.
  if (el.dataset.mediaFallbackArmed !== '1') {
    el.dataset.mediaFallbackArmed = '1';
    el.addEventListener('error', () => {
      if (el.dataset.mediaFellBack === '1') return;
      el.dataset.mediaFellBack = '1';
      console.warn('[media] variante allégée absente, retour à l’original :', src);
      el.src = src;
      el.load();
    });
  }
  el.src = light;
  return light;
}

/**
 * Comme `setVideoSrc`, mais ne touche à rien si la source voulue est déjà en
 * place. Le chapitre 3 réutilise le même <video> d'un hotspot à l'autre et
 * testait `v.src.endsWith(cfg.video)` : cette comparaison doit porter sur le
 * chemin RÉELLEMENT posé, sinon elle échoue à chaque fois sur petit appareil
 * et relance un chargement complet à chaque frame de survol.
 *
 * @param {HTMLMediaElement} el
 * @param {string} src
 * @returns {boolean} true si la source a été (re)posée
 */
export function ensureVideoSrc(el, src) {
  if (!el) return false;
  const voulu = lightVideoSrc(src) ?? src;
  if (el.src && el.src.endsWith(voulu)) return false;
  setVideoSrc(el, src);
  return true;
}
