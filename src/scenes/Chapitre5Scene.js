import { Scene }               from '../core/Scene.js';
import { bus }                 from '../core/EventBus.js';
import { ArrowChp5 }           from '../ui/ArrowChapitre5.js';
// La CONFIG du chapitre (données pures, aucun effet de bord) est importée
// STATIQUEMENT — comme aux chapitres 2, 3 et 4. La scène en a besoin AVANT le
// moteur : pour le sous-titre, affiché pendant le chargement, et pour le chemin
// de la photographie, qu'elle doit poser puis attendre. Le MOTEUR, lui, reste
// en import() dynamique (pattern factory).
import { CONFIG as CHP5 }      from '../../Chapitre5/chp5-src/chp5-config.js';
import { buildChapitre5DOM }   from '../../Chapitre5/chp5-src/chp5-dom.js';
import { releaseMediaElements } from '../utils/helpers.js';
import { announce }             from '../utils/a11y.js';

/**
 * Chapitre5Scene — intégration SPA du chapitre 5
 * (« Le devenir du corps de Soliman al-Halabi »)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NAVIGATION :
 *  ┌─────────────────────────────────────────────────────────────────────────┐
 *  │  CollaborationScene ──[cercle V]──► Chapitre5Scene                       │
 *  │    · l'extinction de torche + le fondu au noir + l'arrêt de              │
 *  │      collaboration.mp3 sont déjà assurés par CollaborationScene.exit()   │
 *  │      (générique pour toute destination chapitre).                        │
 *  │    · enter() ouvre le chapitre : noir → la photographie monte en fondu,  │
 *  │      la caméra s'approche, les traits jaillissent du squelette, les      │
 *  │      cercles se dessinent.                                              │
 *  │  Intro finie ──[flèche ←]──► leaveTo('collaboration')                    │
 *  │                                                                          │
 *  │  Intro finie ──[cercle « 1 »]──► LA PORTE (sous-chapitre 1)               │
 *  │    · on ne change pas de scène : on RECULE. Le moteur éloigne la          │
 *  │      photographie, referme les deux battants, puis pousse sur le          │
 *  │      panneau « Anthropologie biologique ».                                │
 *  │  Intro finie ──[cercle « 2 »]──► LA VITRINE (sous-chapitre 2)             │
 *  │    · on éteint la lumière, et l'on rallume ailleurs : une torche fixe     │
 *  │      ouvre sur la boîte où le crâne attend, entre deux boîtes d'archive.  │
 *  │  Intro finie ──[cercle « 3 »]──► L'INHUMATION (sous-chapitre 3)           │
 *  │    · l'entrée du chapitre 1 : noir, torche fixe sur les crânes, une voix  │
 *  │      (et « Passer ») SANS flèche ni boussole ; puis la photographie       │
 *  │      bascule, et la flèche revient.                                       │
 *  │  Un lieu posé ──[flèche ←]──► closeChapitre5Part() ──► la photographie    │
 *  │                                                                          │
 *  │  LA CARTE (boussole) — chaque sous-chapitre est un point (`chp5-porte`,  │
 *  │  `chp5-vitrine`, `chp5-inhumation`, nommés par leur LIEU) :               │
 *  │    · depuis une autre scène → enter({ part: 'vitrine' }) : on entre      │
 *  │      DIRECTEMENT dans le lieu, sans introduction, depuis le noir ;       │
 *  │    · depuis ce chapitre → jumpWithin({ part }) → goToChapitre5Part() :   │
 *  │      d'un lieu à l'autre, on passe PAR LE NOIR, pas par la photographie. │
 *  └─────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ LE SOUS-TITRE CÈDE SA PLACE, IL NE SE DOUBLE PAS. Entrer dans un
 * sous-chapitre n'ajoute pas une troisième ligne sous « Espace collaboratif » :
 * « Le devenir du corps… » s'efface et « Dans les réserves… » vient à sa
 * place, sur la même ligne. Le NIVEAU 3 de Title reste donc inutilisé ici —
 * et s'il devait servir un jour, il faudrait le remonter en z 600 dans
 * style.css (il vit à z 15, sous le chapitre : posé, mesurable, invisible).
 *
 * ⚠️ LA FLÈCHE A DEUX DESTINATIONS, ET UN SEUL CÂBLAGE. `show()` reconstruit
 * le tracé et rejoue son dessin de 1,4 s : rebrancher son `onclick` à chaque
 * changement de lieu ferait donc RE-DESSINER la flèche au milieu du chapitre,
 * sans raison visible. Elle appelle toujours `_onArrow()`, qui lit l'endroit
 * où l'on se trouve — seul son nom accessible change.
 *
 * ⚠️ LA SORTIE ÉCRITE VIT DANS exit(), PAS DANS UN leaveTo() REDÉFINI.
 * Le chapitre 4 joue son fondu AVANT de naviguer (le moteur émet ensuite
 * 'chp4:navigate-back') ; ici le fondu est court (CHP5.exitMs) et le
 * SceneManager attend déjà `exit()` avant toute entrée. `leaveChapitre5()`
 * rend une promesse, `exit()` l'attend : le voile tombe pour TOUTE
 * destination — flèche de retour comme saut par la carte — sans qu'aucune
 * cible ne soit écrite en dur nulle part.
 *
 * AUDIO : le chapitre a SES ambiances — une bande-son pour la photographie,
 * une par sous-chapitre (chp5-config.js → `ambiance`, moteur
 * chp5-ambiance.js). Elles vivent DANS le moteur, sur le contexte audio du
 * site qu'on lui transmet, et meurent avec lui : `leaveChapitre5()` les
 * éteint au rythme du noir, `stopChapitre5()` les arrête. Aucune n'est une
 * piste de l'AudioManager — la table LIEUX (app.js) déclare donc le chapitre
 * muet, et le son du musée s'arrête à la frontière, quel que soit le chemin.
 * ⚠️ Un témoignage qu'on écoute est un MÉDIA AU PREMIER PLAN : la flèche
 * s'éclipse (et la boussole avec elle, qui ne paraît qu'avec une flèche), puis
 * revient telle quelle. `eclipse`, jamais `hide` — voir ArrowBase.eclipse.
 *
 * DOM : injecté dans #chapitre5-root (position:fixed, z 500), IDs préfixés
 * chp5-*. PATTERN FACTORY : le module n'a aucun effet de bord au chargement ;
 * startChapitre5() monte le moteur contre le DOM réinjecté, stopChapitre5() le
 * démonte. Import unique, sans cache-bust.
 */

const MODULE_PATH = '../../Chapitre5/';   // depuis src/scenes/ (import())
const CSS_LINK_ID = 'chp5-css-opening';
const CSS_HREF    = 'Chapitre5/chp5-style/chp5-opening.css';

/** Garde réseau : ne pas laisser un téléchargement bloquer toute la scène. */
const LOAD_TIMEOUT_MS = 12000;

/** Le temps que le sous-titre met à s'effacer avant que le suivant s'écrive —
    la sortie CSS de #chapitre-subtitle dure 1,1 s, après 0,3 s de retard. */
const SOUS_TITRE_RELAIS_MS = 1500;


export class Chapitre5Scene extends Scene {
  /**
   * @param {Object} systems
   * @param {Object} systems.bgMgr       BackgroundManager
   * @param {Object} systems.transition  TransitionManager
   * @param {Object} systems.title       Title (colonne de titres)
   */
  constructor(systems) {
    super('chapitre5');

    this.bgMgr      = systems.bgMgr;
    this.transition = systems.transition;
    this.title      = systems.title;
    /** L'AudioManager du site : la fenêtre des pièces y prend son contexte
        pour tracer la sinusoïde du chapitre 1 (un seul AudioContext pour tout
        le site, jamais un second). */
    this.audio      = systems.audio;

    /** Flèche de retour → Espace collaboratif. */
    this._arrow = new ArrowChp5(window.CONFIG);

    /** DOM conteneur du chapitre 5. */
    this._container = null;

    /** Module chp5-opening chargé dynamiquement. */
    this._module = null;

    /** Sous-chapitre ouvert (rang dans CHP5.cartels.sousChapitres), ou null : on est devant
        la photographie. C'est ce que la flèche de retour lit pour savoir où
        elle ramène. */
    this._part = null;

    /** Vrai quand la flèche doit être (re)DESSINÉE à la prochaine arrivée, et
        non simplement dé-éclipsée : elle n'a jamais paru (on est entré
        directement dans un lieu), ou elle a été cliquée pour revenir — son
        tracé s'est alors dissous dans l'effet de clic. */
    this._flecheAMontrer = true;

    /** Le texte du sous-titre posé — pour ne pas relayer un texte par
        lui-même (voir _relayerSousTitre). */
    this._sousTitre = null;
    /** Jeton du relais de sous-titre : un relais plus récent périme l'ancien. */
    this._relais = 0;
  }

  /* ── Cycle de vie ──────────────────────────────────────────────────────── */

  /** La flèche de cette scène — un départ l'efface et la rend inaccessible.
      Voir Scene.beginLeave(). */
  arrows() { return [this._arrow]; }

  async enter(params = {}) {
    await super.enter(params);
    const signal = this._abortCtrl.signal;
    this._part = null;
    this._flecheAMontrer = true;

    /* L'ARRIVÉE DIRECTE : la carte peut faire entrer dans un sous-chapitre
       depuis une autre scène (`params.part`, le NOM du lieu). Le moteur ouvre
       alors le lieu depuis le noir, sans jouer l'introduction. */
    const direct = this._rangDuLieu(params.part);

    try {
      // Contexte chapitre 5 : remontée z des titres et du bouton plein écran
      // au-dessus du root (z 500), et de la boussole avec eux.
      document.body.classList.add('chp5-active');

      this.bgMgr.blackout();
      await this.transition.fadeVeil(0, 0);

      // Niveau 2 : sous-titre du chapitre sous « Espace collaboratif »
      // (le niveau 1 est déclaré dans la table LIEUX d'app.js).
      // Entré directement dans un lieu, c'est SON titre qui s'écrit : le
      // départ (`onPart(…, 'depart')`) le retrouvera déjà posé et n'y
      // touchera pas.
      const sousTitre = direct !== null ? CHP5.cartels.sousChapitres[direct].titre : CHP5.subtitle;
      this._sousTitre = sousTitre ?? null;
      if (sousTitre) this.title.showSubtitle(sousTitre);
      else console.warn('[chp5] chp5-config.subtitle absent : aucun sous-titre affiché.');

      // ── ORDRE D'ENTRÉE (noir garanti, zéro flash) ──────────────────────
      // 1. CSS AVANT le DOM : sans la feuille, le cartel des témoignages
      //    s'afficherait en clair, à nu, le temps que le <link> arrive.
      // 2. DOM injecté AVEC son rideau noir (#chp5-boot, styles en ligne).
      // 3. Attente du DÉCODAGE de la photographie : le moteur la révèle en
      //    fondu, elle ne doit pas apparaître par bandes.
      // 4. Module chargé, moteur monté → onReady lève le rideau.
      await this._injectCSS(signal);
      this._injectDOM(signal);
      await this._awaitEntry(this._container.querySelector('#chp5-background').decode(), signal);

      const module = await this._awaitEntry(
        import(`${MODULE_PATH}chp5-src/chp5-opening.js`), signal);
      this._checkEntry(signal);
      this._module = module;

      module.startChapitre5({
        root: this._container,
        audio: this.audio,
        onReady: () => {
          this._raiseBootCurtain();
          // Le site change de scène sans changer d'URL : sans ce signal, ni le
          // lecteur d'écran ni le titre de l'onglet n'apprennent l'arrivée — et
          // la carte ne sait pas où allumer son point.
          this.announceEntered();
        },
        onIntroComplete: () => this._showArrow(),
        // « Quelque chose passe devant » : un témoignage qu'on écoute, ou la
        // porte en mouvement. Le moteur n'en fait qu'UNE réponse — la flèche
        // ne peut pas recevoir deux ordres contraires.
        onListen: ouvert => {
          if (this.isActive && !this.leaving) this._arrow.eclipse(ouvert, 400);
        },
        onPart: (index, etat) => this._setPart(index, etat),
        sousChapitre: direct,
      });

    } catch (error) {
      if (signal.aborted || error?.message === 'scene_aborted') return;
      console.error('[Chapitre5Scene] Entrée impossible :', error);
      this._module?.stopChapitre5();
      // Secours : ne jamais rester bloqué derrière le rideau noir, et garder
      // le retour accessible même si une ressource manque.
      this._raiseBootCurtain();
      this._showArrow();
    }
  }

  async exit(params = {}) {
    // Un départ, un seul : le verrou et l'effacement de la flèche d'abord.
    // (leaveTo() l'a déjà appelé ; ce second appel rend false, sans effet.)
    this.beginLeave();

    // Le voile #chp5-fade vit DANS #chapitre5-root (z 500) alors que le
    // sous-titre est remonté à z 600 : sans ceci il flotterait au-dessus du
    // noir puis disparaîtrait sèchement. On l'estompe en parallèle du fondu.
    this.title.hideSubtitle(false);

    await super.exit(params);

    try {
      // ⚠️ Le SceneManager attend ce fondu pour TOUTE destination (carte
      // comprise) : c'est ici, et nulle part ailleurs, que le chapitre 5
      // écrit sa sortie.
      if (this._module) await this._module.leaveChapitre5();
    } finally {
      this._module?.stopChapitre5();
      this._module = null;
      this._removeDOM();
      this._removeCSS();
      this._part = null;
      this._sousTitre = null;
      document.body.classList.remove('chp5-active');
      this.title.hideSubtitle();
      this.bgMgr.blackout();
      await this.transition.fadeVeil(0, 0);
    }
  }

  onResize() {
    this._arrow.resize?.();
    // Le moteur replace la caméra, remesure les cartels et redessine les
    // traits : leurs ancres sont des points de l'IMAGE, pas de la fenêtre.
    this._module?.onResize?.();
  }

  /* ── Flèche de retour ──────────────────────────────────────────────────── */

  _showArrow() {
    // Un moteur peut finir son intro alors qu'on s'en va déjà : sans cette
    // garde, une flèche se redessinerait sur une scène en fuite.
    if (!this.isActive || this.leaving) return;
    this._flecheAMontrer = false;
    this._arrow.show(() => this._onArrow());
    this._nommerFleche();
  }

  /**
   * LA FLÈCHE REMONTE D'UN CRAN, ELLE NE QUITTE PAS TOUJOURS LE CHAPITRE.
   * Dans un sous-chapitre elle ramène à la photographie ; devant la
   * photographie, elle sort — et alors seulement par leaveTo() : UN SEUL
   * CHEMIN, verrou de navigation et effacement des flèches compris.
   */
  _onArrow() {
    if (this._part !== null) {
      // ⚠️ SON TRACÉ VIENT DE SE DISSOUDRE. L'effet de clic (ArrowBase.
      // _rippleClick) laisse le SVG à opacité nulle : au retour il faudra la
      // RE-MONTRER, pas seulement lever son éclipse — sans quoi on rendrait au
      // visiteur un cadre vide et cliquable.
      this._flecheAMontrer = true;
      this._module?.closeChapitre5Part();
      return;
    }
    this.leaveTo('collaboration');
  }

  /**
   * LE SOUS-TITRE CHANGE DE TEXTE, IL NE SE DOUBLE PAS.
   *
   * ⚠️ EN DEUX TEMPS, ET C'EST OBLIGATOIRE. `Title._poser` écrit le nouveau
   * texte IMMÉDIATEMENT puis pose la classe : appelé pendant que l'ancien
   * s'efface, il ferait muter les mots au milieu de leur propre disparition.
   * On laisse donc jouer la sortie CSS (1,1 s de fondu + 0,3 s de retard,
   * cf. #chapitre-subtitle) avant de poser le suivant. Le geste tient
   * largement dans la durée d'un passage — 5,3 s pour la porte, 4,8 s pour la
   * vitrine.
   */
  _relayerSousTitre(texte) {
    // Le même texte ne se relaie pas par lui-même : il ne s'effacerait que pour
    // revenir (arrivée directe, relais d'un lieu à l'autre par la carte).
    if (texte === this._sousTitre) return;
    this._sousTitre = texte;
    const jeton = ++this._relais;
    this.title.hideSubtitle(false);
    this.addTimer(() => {
      if (jeton !== this._relais) return;     // un relais plus récent a la main
      if (this.isActive && !this.leaving) this.title.showSubtitle(texte, 0);
    }, SOUS_TITRE_RELAIS_MS);
  }

  /**
   * OÙ L'ON VA (`depart`), PUIS OÙ L'ON EST (`arrivee`).
   *
   * Deux temps, parce que les deux choses ne se disent pas au même moment : le
   * sous-titre doit changer DÈS LE CLIC — c'est en le lisant qu'on comprend où
   * l'on est emmené — alors que la flèche ne revient qu'une fois le lieu posé.
   * Un seul signal aurait forcé l'un des deux à mentir.
   */
  _setPart(index, etat) {
    if (!this.isActive || this.leaving) return;

    if (etat === 'depart') {
      // Le relais d'un lieu à l'autre annonce sa destination deux fois — en
      // quittant le premier, puis en ouvrant le second : une suffit.
      if (index === this._part) return;
      this._annoncerLieu(index);
      return;
    }

    // ARRIVÉE. Un lieu qui n'a pas pu s'ouvrir (décodage en échec) rend la
    // photographie : on n'est pas où le départ l'avait dit — le sous-titre et
    // la flèche doivent le savoir, sinon la flèche croirait encore ramener
    // d'un sous-chapitre qui n'existe pas, et ne ferait plus rien.
    if (index !== this._part) this._annoncerLieu(index);

    // La carte allume le point du lieu (et le retient), puis la flèche
    // revient : DESSINÉE si elle n'a jamais paru ou si c'est elle qu'on a
    // cliquée (son tracé s'est dissous), simplement dé-éclipsée sinon.
    bus.emit('journey:place', { id: this._noeud(index) });
    if (this._flecheAMontrer) this._showArrow();
    else this._arrow.eclipse(false, 400);
  }

  /** On va vers ce lieu (null = la photographie) : sous-titre, nom de la
      flèche, annonce. */
  _annoncerLieu(index) {
    this._part = index;
    const texte = index === null ? CHP5.subtitle : CHP5.cartels.sousChapitres[index]?.titre;
    if (texte) this._relayerSousTitre(texte);
    else console.warn(`[chp5] Sous-chapitre ${index + 1} : aucun titre dans chp5-config (cartels.sousChapitres).`);
    this._nommerFleche();
    // Le passage dure cinq secondes et ne dit rien à qui ne le voit pas :
    // le bouton annonçait où il menait, le départ doit l'annoncer aussi.
    announce(index === null ? CHP5.textes.annonceRetour : texte);
  }

  /** Ce que dit la flèche quand elle ne quitte plus le chapitre mais le lieu
      — un texte de la config (`textes.retourPhotographie`). ⚠️ À reposer après
      chaque show() : ArrowBase y remet son nom d'origine. */
  _nommerFleche() {
    this._arrow.el.setAttribute('aria-label',
      this._part === null ? this._arrow.label : CHP5.textes.retourPhotographie);
  }

  /* ── La carte : les sous-chapitres sont des LIEUX de la scène ─────────────
     Chaque sous-chapitre a son point sur la carte, nommé par son lieu
     (`chp5-porte`…) : c'est le NOM du lieu qui voyage (`part: 'vitrine'`), pas
     le rang du cartel — réordonner les cartels ne doit pas déplacer la carte.
  ─────────────────────────────────────────────────────────────────────────── */

  /** Le rang du sous-chapitre qui ouvre ce lieu, ou null (aucun, inconnu). */
  _rangDuLieu(lieu) {
    if (lieu == null) return null;
    const rang = CHP5.cartels.sousChapitres.findIndex(s => s.lieu === lieu);
    if (rang < 0) {
      console.warn(`[chp5] La carte demande le lieu « ${lieu} », qu'aucun sous-chapitre n'ouvre.`);
      return null;
    }
    return rang;
  }

  /** Le point de la carte d'un lieu du chapitre (null = la photographie). */
  _noeud(index) {
    const lieu = index === null ? null : CHP5.cartels.sousChapitres[index]?.lieu;
    return lieu ? `chp5-${lieu}` : 'chapitre5';
  }

  /**
   * SAUTER D'UN LIEU À L'AUTRE SANS QUITTER LE CHAPITRE — un point de la carte
   * qui est un sous-chapitre (ou la photographie, `part: null`). Le moteur
   * retient la demande et la joue à la fin du geste en cours ; d'un lieu à
   * l'autre, il passe par le noir (voir goToChapitre5Part).
   */
  jumpWithin({ part = null } = {}) {
    if (!this.isActive || this.leaving || !this._module) return false;
    const rang = part === null ? null : this._rangDuLieu(part);
    if (part !== null && rang === null) return false;
    this._module.goToChapitre5Part(rang);
    return true;
  }

  /**
   * ⚠️ ON SIGNE SON DÉPART. Les chapitres 1 à 4 joignent `from: 'chapitreN'` à
   * leur `navigate` ; le chapitre 5 s'en remettait au `leaveTo` de base, qui
   * ne transmet que ce qu'on lui donne. `CollaborationScene` teste pourtant
   * `params.from === 'chapitre5'` pour faire reparaître ses cercles en 1,5 s
   * au lieu de 5,4 : sans cette signature la branche existait sans personne
   * pour l'écrire, et l'on rentrait de ce chapitre-là — et de lui seul — en
   * attendant quatre secondes de plus, sans un mot en console.
   * Un `from` explicitement passé garde la main : c'est l'ordre des quatre
   * autres chapitres.
   */
  leaveTo(to, params = {}) {
    super.leaveTo(to, { from: 'chapitre5', ...params });
  }

  /* ── DOM ─────────────────────────────────────────────────────────────────
     Le moteur ne crée aucun nœud : il se monte CONTRE ce DOM-ci, dont les
     références sont résolues au démarrage, jamais au chargement du module.
     La composition elle-même (les cinq cartels, leurs ancres sur le squelette)
     vit dans chp5-dom.js — un seul endroit, éditorial.
  ─────────────────────────────────────────────────────────────────────────── */

  _injectDOM(signal) {
    this._checkEntry(signal);
    if (this._container) return;
    const app = document.getElementById('app');
    if (!app) throw new Error('chp5_no_app');

    const root = document.createElement('div');
    root.id = 'chapitre5-root';
    // Le rideau protège aussi la navigation au clavier : tant qu'il est là,
    // rien de ce qu'il cache ne doit pouvoir prendre le focus.
    root.inert = true;
    root.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:500',
      'overflow:hidden', 'background:#000',
    ].join(';');
    root.innerHTML = buildChapitre5DOM();

    app.appendChild(root);
    this._container = root;
  }

  _removeDOM() {
    if (!this._container) return;
    // Libération des médias avant retrait — même raison qu'aux chapitres 2, 3
    // et 4 (voir releaseMediaElements) : les deux témoignages vivent ici, et un
    // <audio> non libéré retiendrait tout l'arbre détaché, indéfiniment.
    releaseMediaElements(this._container);
    this._container.remove();
    this._container = null;
  }

  /** Le rideau noir tombe : dessous, le moteur a déjà tout mis en état. */
  _raiseBootCurtain() {
    if (!this._container) return;
    this._container.inert = false;
    this._container.querySelector('#chp5-boot')?.remove();
  }

  /* ── Feuille de style ──────────────────────────────────────────────────── */

  async _injectCSS(signal) {
    this._removeCSS();
    const link = document.createElement('link');
    link.id   = CSS_LINK_ID;
    link.rel  = 'stylesheet';
    link.href = CSS_HREF;
    const ready = new Promise((resolve, reject) => {
      link.onload  = resolve;
      link.onerror = () => reject(new Error('chp5_css_missing'));
    });
    document.head.appendChild(link);
    try { await this._awaitEntry(ready, signal); }
    finally { link.onload = link.onerror = null; }
  }

  _removeCSS() {
    document.getElementById(CSS_LINK_ID)?.remove();
  }

  /* ── Chargements interrompables ────────────────────────────────────────── */

  _checkEntry(signal) {
    if (signal.aborted) throw new Error('scene_aborted');
  }

  /**
   * Une entrée abandonnée ne remonte jamais son DOM : chaque attente rejette
   * dès l'avortement du signal, et un délai de garde empêche un téléchargement
   * en souffrance de retenir la scène pour toujours.
   */
  _awaitEntry(promise, signal) {
    this._checkEntry(signal);
    return new Promise((resolve, reject) => {
      const finish = (fn, value) => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        fn(value);
      };
      const abort = () => finish(reject, new Error('scene_aborted'));
      const timer = setTimeout(() => finish(reject, new Error('chp5_load_timeout')), LOAD_TIMEOUT_MS);
      signal.addEventListener('abort', abort, { once: true });
      promise.then(value => finish(resolve, value), error => finish(reject, error));
    });
  }
}
