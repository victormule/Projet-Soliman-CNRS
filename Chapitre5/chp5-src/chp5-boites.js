/**
 * LES BOÎTES DE LA VITRINE — sous-chapitre 2 du chapitre V
 * (ET LES TOMBES DE L'INHUMATION, sous-chapitre 3 : même geste, autre
 * composition — voir « DEUX LIEUX, UN GESTE » plus bas)
 * ═══════════════════════════════════════════════════════════════════════════
 * Deux grandes boîtes d'archive se dessinent de part et d'autre du crâne.
 * Cliquer l'une l'ouvre : elle se dé-dessine et se referme sur elle-même, une
 * onde part de son centre, et les petites boîtes qu'elle contenait s'élancent
 * vers leur place en s'écrivant en chemin. ON N'EN REVIENT PAS — une boîte
 * ouverte le reste : c'est un inventaire qu'on déplie, pas un tiroir.
 *
 * ⚠️ AUCUN EFFET DE BORD AU CHARGEMENT. Comme tout module de chapitre : les
 * références, les écouteurs, les minuteries et les animations naissent dans
 * `creerBoites()` et meurent dans `destroy()`. Le fichier lui-même ne lit
 * rien du document.
 *
 * ⚠️ LES DESSINS SONT INLINÉS, PAS POSÉS EN `<img>`. Un `<img src="…svg">`
 * est une image opaque : on n'atteint ni ses tracés ni leur `stroke`. Or
 * c'est tout ce que ce lieu demande — écrire chaque trait l'un après l'autre,
 * et changer sa couleur au survol. D'où le `fetch` + l'inlining, une fois par
 * visite, DERRIÈRE L'EXTINCTION (voir `precharger`).
 *
 * ⚠️ LA CONVENTION DES EXPORTS : un tracé qui porte une CLASSE (`cls-1` ou
 * `st0`, selon la version d'Illustrator) est un TRAIT (fill:none + stroke) ;
 * un tracé sans classe est un APLAT (les numéros calligraphiés, les taches
 * d'encre). C'est la seule chose qui distingue les deux dans ces neuf
 * fichiers, et le module le dit en console si un export arrive avec une
 * classe qu'il ne connaît pas. Écrire un aplat revient à suivre son CONTOUR à
 * la plume, puis à le remplir derrière — à l'œil, une main qui écrit puis encre.
 *
 * ── CE QUE ÇA COÛTE, MESURÉ (1440 × 900, chromium, souris en mouvement) ──
 * L'écriture des deux grandes boîtes, par-dessus le canevas plein écran de la
 * torche : 60 i/s, aucune image perdue. L'éclatement, où l'on crée jusqu'à
 * deux cents animations d'un coup pour le dessin le plus fourni (boite9496,
 * 172 tracés) : 56 i/s, une image à 50 ms sur les 2,5 s du geste. Au repos,
 * une fois tout écrit : 60 i/s et ZÉRO animation vivante — c'est ce que
 * garantit `poser()`, qui rend chaque dessin à sa feuille de style.
 * ⚠️ La seule image longue de l'arrivée (99 ms) N'EST PAS D'ICI : ce sont les
 * deux photographies de 3200 px qui montent au GPU quand le noir se lève. La
 * sonde décalée de 950 ms le montre — 60 i/s, zéro saccade.
 *
 * ── DEUX LIEUX, UN GESTE ──────────────────────────────────────────────────
 * Le module ne lit plus la config lui-même : on lui DONNE ce qu'il dispose.
 *  · `composition` — les dessins, les pièces, la place (`cotes`, `y`,
 *    `garde`…) et le moment de l'arrivée (`dessinAt`, `decalage`) : ce qui
 *    appartient à un lieu. La vitrine passe `restitution.boites`,
 *    l'inhumation `inhumation.tombes`.
 *  · `cadences` — la vitesse du GESTE (écrire, se tendre, s'envoler,
 *    s'effacer) : la même partout (`CONFIG.geste`), pour qu'une tombe
 *    s'écrive comme une boîte s'écrit.
 *  · `photo` — le format de la photographie posée en `contain` dessous : la
 *    bande libre se mesure depuis ses bords.
 *
 * ── UN CÔTÉ SANS GRANDE ───────────────────────────────────────────────────
 * Un côté qui ne déclare pas de `grande` est OUVERT D'EMBLÉE : ses pièces
 * s'écrivent dès l'arrivée, du centre du groupe vers le dehors, sans rien
 * qu'on ait à ouvrir. C'est l'inhumation — quatre tombes et un drapeau en
 * rangée ; la vitrine, elle, garde ses deux grandes boîtes à éclater.
 *
 * (La tombe et le drapeau ont été, un temps, deux grandes qui s'ALTERNAIENT,
 * l'une se reformant quand on ouvrait l'autre. L'auteur a choisi d'ouvrir
 * directement sur les tombes : ce geste et son code ont été retirés.)
 */
export function creerBoites({ conteneur, legende, composition, cadences, photo,
  reduceMotion = false, ouvrirPiece }) {
  const B = composition;
  const T = cadences;

  /** Les classes d'export connues — cf. l'avertissement en tête. Les tombes
      ajoutent une seconde classe, `cls-2` : le croissant et l'étoile, pleins
      (`fill` + `stroke` dans l'export) — des APLATS, donc. */
  const CLASSES_TRAIT = new Set(['cls-1', 'st0']);
  const CLASSES_APLAT = new Set(['cls-2']);

  const controller = new AbortController();
  const timers = new Set();
  const groupes = [];
  /** Les côtés déjà éclatés. ILS LE RESTENT : on ne referme pas une boîte. */
  const ouverts = new Set();
  /**
   * LES PIÈCES DÉJÀ CONSULTÉES — leur boîte prend une teinte (`boite--vue`),
   * et la vitrine s'efface d'autant (cf. `progres`).
   * ⚠️ CE REGISTRE SURVIT À LA SORTIE DU LIEU, à la différence de `ouverts` :
   * quitter la vitrine referme l'inventaire, mais n'efface pas ce qu'on a lu.
   * Revenir, c'est retrouver les deux grandes boîtes fermées ET un crâne déjà
   * à demi parti. Il vit le temps de la visite du chapitre (le module meurt
   * avec lui).
   */
  const vues = new Set();
  const cleDe = item => item.piece || item.carte;

  let disposed = false;
  let monte = false;
  let pret = null;

  const on = (cible, type, handler) =>
    cible.addEventListener(type, handler, { signal: controller.signal });

  function planifier(fn, delai) {
    const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, delai);
    timers.add(id);
    return id;
  }
  function annulerMinuteries() {
    timers.forEach(clearTimeout);
    timers.clear();
  }

  /* ── CHARGEMENT ──────────────────────────────────────────────────────── */

  async function lire(nom) {
    const reponse = await fetch(B.dossier + nom, { signal: controller.signal });
    if (!reponse.ok) throw new Error(nom + ' : HTTP ' + reponse.status);
    const doc = new DOMParser().parseFromString(await reponse.text(), 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg || doc.querySelector('parsererror')) throw new Error(nom + ' : SVG illisible');
    return svg;
  }

  /**
   * Un dessin prêt à être écrit : les feuilles de style de l'export sont
   * retirées (elles imposent un trait NOIR, invisible ici), les identifiants
   * aussi — onze dessins inlinés partageraient sinon le même `Calque_1`.
   *
   * ⚠️ `pathLength="100"` PLUTÔT QUE `getTotalLength()`. Il y a 469 tracés en
   * tout : les mesurer coûterait un parcours de géométrie par tracé, pour un
   * gain nul ici — l'écriture est mise en scène par un décalage de départ, pas
   * par la longueur. C'est l'idiome déjà employé par les cercles des cartels.
   */
  function preparer(source, nom) {
    const svg = document.importNode(source, true);
    svg.querySelectorAll('style, defs').forEach(noeud => noeud.remove());
    svg.removeAttribute('id');
    svg.removeAttribute('data-name');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('class', 'boite-art');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    for (const chemin of svg.querySelectorAll('path')) {
      const classe = chemin.getAttribute('class');
      if (classe && !CLASSES_TRAIT.has(classe) && !CLASSES_APLAT.has(classe)) {
        console.warn('[chp5] ' + nom + ' : classe inconnue « ' + classe + ' » — le trace sera pris pour un aplat.');
      }
      chemin.setAttribute('class', CLASSES_TRAIT.has(classe) ? 'bt' : 'bf');
      chemin.setAttribute('pathLength', '100');
    }

    const boite = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    const rapport = boite.length === 4 && boite[2] > 0 ? boite[3] / boite[2] : 1;
    return { svg, rapport };
  }

  function precharger() {
    if (pret) return pret;
    pret = (async () => {
      const noms = new Set();
      for (const cote of B.cotes) {
        if (cote.grande) noms.add(cote.grande);
        for (const rang of cote.rangs) for (const item of rang) noms.add(item.dessin);
      }
      const sources = new Map();
      await Promise.all([...noms].map(async nom => sources.set(nom, await lire(nom))));
      if (disposed) return false;
      construire(sources);
      return true;
    })().catch(erreur => {
      // Les boîtes sont un ORNEMENT : le lieu se joue sans elles plutôt que
      // de laisser le visiteur devant un écran qui ne vient pas.
      if (!disposed && erreur.name !== 'AbortError') {
        console.warn('[chp5] Les dessins (' + conteneur.id + ') n ont pas pu etre charges — le lieu se joue sans eux.', erreur);
      }
      return false;
    });
    return pret;
  }

  /* ── MONTAGE ─────────────────────────────────────────────────────────── */

  /**
   * ⚠️ LES PETITES BOÎTES SONT DES BOUTONS, ELLES AUSSI. Chacune ouvre UNE
   * pièce — c'est ce qu'elles sont venues montrer — et rien de cliquable sur
   * ce site ne doit rester hors du clavier. Leur nom accessible est le titre
   * de la pièce, parce qu'un bouton qui n'annoncerait « boîte » ne dirait à
   * personne ce qu'il ouvre.
   */
  function creerSlot(sources, item, grande) {
    const { svg, rapport } = preparer(sources.get(item.dessin), item.dessin);
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'boite ' + (grande ? 'boite--grande' : 'boite--petite') + ' boite--absente';
    element.style.setProperty('--boite-trait', (grande ? B.trait : B.traitPetite) + 'px');

    const vol = document.createElement('span');
    vol.className = 'boite-vol';
    vol.appendChild(svg);
    element.appendChild(vol);

    return {
      element, vol, art: svg, rapport, grande, item,
      chemins: null, animations: new Set(),
      cx: 0, cy: 0, w: 0, h: 0,
    };
  }

  /* ── LE NOM DE LA PIÈCE, EN BAS ──────────────────────────────────────────
     Le titre de survol du tronc commun, redit dans le chapitre : il s'écrit
     sous la vitrine quand on approche une petite boîte, et s'en va quand on
     s'en éloigne. Il ne paraît QUE si la boîte est posée — une boîte encore
     en vol n'est pas encore une pièce. */

  let survolee = null;
  let congeLegende = null;

  /**
   * ⚠️ LE TITRE NE S'ÉTEINT PAS ENTRE DEUX BOÎTES. Les boîtes sont séparées
   * par un jour : aller de l'une à l'autre, c'est SORTIR de la première avant
   * d'ENTRER dans la seconde, et le titre repartait donc en fondu pour
   * revenir aussitôt — un battement à chaque déplacement. On diffère donc le
   * retrait d'un souffle, que l'entrée suivante annule. C'est le même filet
   * que le titre de survol du chapitre 1.
   */
  const CONGE_LEGENDE = 90;

  function direLaPiece(slot) {
    if (!legende || !slot?.item?.titre) return;
    if (congeLegende !== null) { clearTimeout(congeLegende); timers.delete(congeLegende); congeLegende = null; }
    survolee = slot;
    legende.querySelector('span').textContent = slot.item.titre;
    legende.classList.add('legende--visible');
  }

  function taireLaPiece(slot = null) {
    if (!legende) return;
    // Seul celui qui a posé le titre peut demander à le retirer.
    if (slot && survolee !== slot) return;
    survolee = null;
    if (!slot) {                       // un départ net (sortie du lieu) : tout de suite
      if (congeLegende !== null) { clearTimeout(congeLegende); timers.delete(congeLegende); congeLegende = null; }
      legende.classList.remove('legende--visible');
      return;
    }
    congeLegende = planifier(() => {
      congeLegende = null;
      if (!survolee) legende.classList.remove('legende--visible');
    }, CONGE_LEGENDE);
  }

  function construire(sources) {
    for (const [index, conf] of B.cotes.entries()) {
      const racine = document.createElement('div');
      racine.className = 'boite-groupe';

      const petites = [];
      for (const rang of conf.rangs) {
        for (const item of rang) {
          const slot = creerSlot(sources, item, false);
          // Le nom accessible est le TITRE seul : le code du dossier (D1, C2…)
          // est un repère de rangement, pas un nom — il ne s'affiche nulle part
          // et ne se lit pas. Il reste en `data-dossier`, pour qui range.
          slot.element.setAttribute('aria-label', item.titre);
          slot.element.dataset.dossier = item.code;
          on(slot.element, 'click', () => ouvrir(slot));
          on(slot.element, 'pointerenter', () => { if (posee(slot)) direLaPiece(slot); });
          on(slot.element, 'pointerleave', () => taireLaPiece(slot));
          // Au clavier, le focus dit la même chose que le survol : sans cela on
          // ouvrirait une pièce dont le nom ne se serait affiché pour personne.
          on(slot.element, 'focus', () => { if (posee(slot)) direLaPiece(slot); });
          on(slot.element, 'blur', () => taireLaPiece(slot));
          racine.appendChild(slot.element);
          petites.push(slot);
        }
      }

      // La grande APRÈS les petites : pendant l'éclatement elle se dé-écrit
      // au-dessus d'elles, et la petite du rang central naît juste sous elle.
      // Un côté SANS grande est ouvert d'emblée (voir l'en-tête) : ni bouton à
      // éclater, ni onde.
      let grande = null;
      let onde = null;
      if (conf.grande) {
        grande = creerSlot(sources, { dessin: conf.grande }, true);
        grande.element.setAttribute('aria-label', conf.etiquette);
        grande.element.setAttribute('aria-expanded', 'false');
        racine.appendChild(grande.element);
        onde = document.createElement('span');
        onde.className = 'boite-onde';
        racine.appendChild(onde);
      }

      const groupe = { index, conf, racine, grande, petites, onde, cx: 0, cy: 0, geste: false };
      if (grande) on(grande.element, 'click', () => eclater(groupe));
      conteneur.appendChild(racine);
      groupes.push(groupe);
    }

    // ⚠️ ON MESURE ICI, ET PAS AU PREMIER TRACÉ. Ordonner les 469 tracés
    // demande autant d'appels à `getBBox`, c'est-à-dire un parcours de
    // géométrie par tracé : mesuré, une image de 84 ms — au moment précis où
    // la torche s'ouvre et où le visiteur regarde. Fait ici, le coût tombe
    // derrière l'extinction, avec le décodage des deux photographies, où il ne
    // se voit pas. (`disposer` d'abord : un dessin sans boîte n'a pas de
    // géométrie à rendre.)
    disposer();
    for (const groupe of groupes) {
      if (groupe.grande) ordonner(groupe.grande);
      groupe.petites.forEach(ordonner);
    }
  }

  /* ── LA PLACE ────────────────────────────────────────────────────────────
     ⚠️ TOUT SE DÉDUIT DE LA BANDE LIBRE, RIEN N'EST UN POURCENTAGE D'ÉCRAN.
     La photographie est posée en `contain` : ses bords suivent le RAPPORT de
     la fenêtre, pas sa largeur (c'est la leçon du mur, au sous-chapitre 1).
     On mesure donc, de chaque côté, ce qui sépare le bord de la fenêtre du
     crâne, et l'on y centre le groupe. Quand la bande se resserre — un 4/3,
     un téléphone — les boîtes RAPETISSENT ensemble plutôt que de mordre sur
     le crâne ou de sortir du cadre. Un jeu de `left: …%` calé sur le 16/9
     débordait en 4/3, et ne pouvait pas ne pas déborder. */
  function disposer() {
    const vw = conteneur.clientWidth;
    const vh = conteneur.clientHeight;
    if (!vw || !vh || !groupes.length) return;

    const cote = Math.min(vw, vh);
    const photoW = Math.min(vw, vh * (photo.width / photo.height));
    const bordInterieur = B.marge * vw;
    const bordCrane = vw / 2 - B.garde * photoW;
    const bande = Math.max(0, bordCrane - bordInterieur);

    // La demi-largeur du rang le plus large, en largeurs de petite boîte.
    // ⚠️ UN RANG DE PIÈCES PLACÉES (voir plus bas) NE COMPTE PAS : ses pièces
    // ont été posées exprès, hors de la bande s'il le faut — les faire entrer
    // dans le calcul réduirait TOUTE la composition à mesure qu'on les
    // rapproche du centre (mesuré : des tombes de 28 px en 4/3).
    let demi = 0.5;
    for (const groupe of groupes) {
      for (const rang of groupe.conf.rangs) {
        if (rang.some(item => item.place)) continue;
        demi = Math.max(demi, (rang.length - 1) / 2 * B.ecart + 0.5);
      }
    }

    const ideal = B.taillePetite * cote;
    const u = Math.min(ideal, bande / (2 * demi));
    const echelle = ideal > 0 ? u / ideal : 1;

    const cy = B.y / 100 * vh;
    const cxGauche = (bordInterieur + bordCrane) / 2;
    // Trois repères horizontaux : le centre de chaque bande, et le milieu
    // de la fenêtre (`'centre'`) — celui de la rangée de l'inhumation.
    const cxDe = nom => nom === 'centre' ? vw / 2 : nom === 'droite' ? vw - cxGauche : cxGauche;

    for (const groupe of groupes) {
      const cx = cxDe(groupe.conf.nom);
      groupe.cx = cx;
      groupe.cy = cy;
      if (groupe.grande) placer(groupe.grande, cx, cy, B.taille * cote * echelle);

      const lignes = groupe.conf.rangs.length;
      let rang = 0;
      for (const [r, noms] of groupe.conf.rangs.entries()) {
        for (let c = 0; c < noms.length; c++) {
          // UNE PLACE DÉCLARÉE : son repère (`'gauche'`, `'droite'` — le
          // centre d'une bande — ou `'centre'`, le milieu de la fenêtre), son
          // écart à ce repère en largeurs de petite (positif = vers le milieu ;
          // au centre, positif = vers la droite), et sa hauteur en % de la
          // fenêtre. Toujours un repère calculé, jamais un `left: …%` : c'est
          // la leçon du mur.
          const place = noms[c].place;
          if (place) {
            const versLeMilieu = place.cote === 'droite' ? -1 : 1;
            placer(groupe.petites[rang++], cxDe(place.cote) + versLeMilieu * place.x * u, place.y / 100 * vh, u);
            continue;
          }
          // (La grille du rang ne se calcule que pour une pièce SANS place :
          // une rangée entièrement placée n'a besoin ni d'`ecart` ni
          // d'`interligne`, et sa composition n'a pas à les déclarer.)
          const x = cx + (c - (noms.length - 1) / 2) * B.ecart * u;
          const y = cy + (r - (lignes - 1) / 2) * B.interligne * u;
          placer(groupe.petites[rang++], x, y, u);
        }
      }
    }
  }

  function placer(slot, x, y, largeur) {
    slot.cx = x;
    slot.cy = y;
    slot.w = largeur;
    slot.h = largeur * slot.rapport;
    const style = slot.element.style;
    style.width = largeur.toFixed(1) + 'px';
    style.height = slot.h.toFixed(1) + 'px';
    style.left = (x - largeur / 2).toFixed(1) + 'px';
    style.top = (y - slot.h / 2).toFixed(1) + 'px';
  }

  /* ── L'ÉCRITURE ──────────────────────────────────────────────────────────
     ⚠️ DU PLUS GRAND TRACÉ AU PLUS PETIT, ET NON DANS L'ORDRE DU FICHIER.
     L'ordre d'un export Illustrator ne dit rien ; écrire du bas vers le haut,
     lui, commençait par les miettes d'encre du pied de la boîte — quatre
     dixièmes de seconde où l'on ne voyait que trois points. Par la surface,
     le dessin se fait comme une main le ferait : le cadre, puis le champ
     blanc, puis le numéro, puis les taches. La silhouette est là tout de
     suite, et le détail arrive dessus.
     La mesure ne se fait qu'une fois par dessin, et elle est gardée. */

  function ordonner(slot) {
    if (slot.chemins) return slot.chemins;
    const liste = [...slot.art.querySelectorAll('path')].map(chemin => {
      let aire = 0;
      let y = 0;
      // Une géométrie indisponible passe en dernier plutôt que de faire
      // échouer l'écriture entière.
      try {
        const boite = chemin.getBBox();
        aire = boite.width * boite.height;
        y = boite.y + boite.height / 2;
      } catch { /* ignoré à dessein */ }
      return { chemin, aire, y };
    });
    liste.sort((a, b) => (b.aire - a.aire) || (b.y - a.y));
    slot.chemins = liste.map(o => o.chemin);
    return slot.chemins;
  }

  const suivre = (slot, animation) => { slot.animations.add(animation); return animation; };

  function relacher(slot) {
    slot.animations.forEach(animation => animation.cancel());
    slot.animations.clear();
  }

  /**
   * @param {object} slot
   * @param {number} duree le geste entier, décalage des tracés compris
   * @param {number} sens  1 : on écrit · -1 : on efface, à rebours
   * @returns {number} ce que le geste demande, en ms
   */
  function ecrire(slot, duree, sens = 1) {
    const chemins = ordonner(slot);
    const total = chemins.length;
    if (!total) return 0;

    slot.art.classList.add('trace');
    const trait = duree * 0.34;                 // ce que dure UN tracé
    const etalement = Math.max(0, duree - trait);
    const depart = sens > 0 ? 100 : 0;
    const arrivee = sens > 0 ? 0 : 100;

    chemins.forEach((chemin, i) => {
      const t = total > 1 ? i / (total - 1) : 0;
      const retard = (sens > 0 ? t : 1 - t) * etalement;
      suivre(slot, chemin.animate(
        [{ strokeDashoffset: depart }, { strokeDashoffset: arrivee }],
        { duration: trait, delay: retard, easing: 'cubic-bezier(.34,.05,.28,1)', fill: 'both' }));

      // L'ENCRE SUIT LA PLUME : l'aplat se remplit derrière le contour qu'on
      // vient de suivre. Seuls les aplats la reçoivent — une poignée par
      // dessin, là où les traits se comptent par centaines.
      if (chemin.getAttribute('class') === 'bf') {
        suivre(slot, chemin.animate(
          [{ fillOpacity: sens > 0 ? 0 : 1 }, { fillOpacity: sens > 0 ? 1 : 0 }],
          { duration: T.encreMs, delay: retard + trait * (sens > 0 ? 0.45 : 0), easing: 'ease-out', fill: 'both' }));
      }
    });

    return duree + T.encreMs;
  }

  /** Le geste est fini : on rend le dessin à sa feuille de style et l'on
      libère les animations — un dessin posé ne doit plus rien coûter. */
  function poser(slot) {
    relacher(slot);
    slot.art.classList.remove('trace', 'plume');
  }

  /** La teinte des pièces déjà lues. Posée à l'ouverture, et REPOSÉE à chaque
      construction de l'inventaire (une même pièce ne revient pas toujours dans
      la même boîte : la pièce se souvient, pas l'élément). */
  function marquerVue(slot) {
    const vue = !slot.grande && vues.has(cleDe(slot.item));
    slot.element.classList.toggle('boite--vue', vue);
  }

  const montrer = slot => slot.element.classList.remove('boite--absente');
  const cacher = slot => slot.element.classList.add('boite--absente');
  /** Une boîte POSÉE : écrite jusqu'au bout, donc bonne à ouvrir. */
  const posee = slot => slot.element.classList.contains('boite--prete');

  /** Une petite boîte s'ouvre sur sa pièce. C'est la fenêtre qui la montre —
      le module ne sait rien d'elle, il nomme une pièce et se tait. */
  function ouvrir(slot) {
    if (disposed || !posee(slot) || !(slot.item?.piece || slot.item?.carte)) return;
    vues.add(cleDe(slot.item));
    marquerVue(slot);
    // La boîte se donne AVEC la pièce : c'est à elle que le focus reviendra
    // quand la fenêtre se refermera.
    ouvrirPiece?.(slot.item, slot.element);
  }

  function dessiner(slot, duree) {
    montrer(slot);
    slot.art.classList.add('plume');          // la plume est dorée…
    const fin = ecrire(slot, duree);
    saluer(slot, duree);
    planifier(() => {
      poser(slot);                            // …et l'encre sèche en blanc
      slot.element.classList.add('boite--prete');
    }, fin);
    return fin;
  }

  /* ── L'ÉCLATEMENT ────────────────────────────────────────────────────── */

  function eclater(groupe) {
    if (disposed || groupe.geste || ouverts.has(groupe.index)) return;
    // Une boîte qu'on est en train d'écrire ne s'ouvre pas : `boite--prete`
    // est posée à la fin du tracé, et c'est elle qui rend le bouton cliquable.
    if (!groupe.grande.element.classList.contains('boite--prete')) return;

    groupe.geste = true;
    ouverts.add(groupe.index);
    marquerOuvert(groupe, true);

    if (reduceMotion) { poserOuvert(groupe); groupe.geste = false; return; }

    // 1 · LA TENSION — le trait se tend et passe à l'or, l'espace d'un souffle.
    groupe.grande.art.classList.add('plume');
    suivre(groupe.grande, groupe.grande.vol.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.09)' }],
      { duration: T.tensionMs, easing: 'ease-out', fill: 'forwards' }));

    // 2 · LE RETRAIT — elle se dé-écrit à rebours et se referme sur son centre.
    // ⚠️ L'OPACITÉ TIENT PENDANT QUE L'ÉCHELLE TOMBE (l'image à 45 %), sans quoi
    // le geste ne se lit pas : une boîte qui fond en même temps qu'elle rétrécit
    // n'est plus qu'un fondu, et l'on ne voit pas qu'elle se referme.
    planifier(() => {
      ecrire(groupe.grande, T.retraitMs, -1);
      suivre(groupe.grande, groupe.grande.vol.animate([
        { transform: 'scale(1.09)', opacity: 1 },
        { transform: 'scale(.70)', opacity: .92, offset: .45 },
        { transform: 'scale(.14)', opacity: 0 },
      ], { duration: T.retraitMs, easing: 'cubic-bezier(.5,.02,.72,.28)', fill: 'forwards' }));
    }, T.tensionMs);

    planifier(() => { cacher(groupe.grande); poser(groupe.grande); }, T.tensionMs + T.retraitMs);

    // 3 · L'ONDE — elle part du centre juste avant que les petites s'élancent.
    planifier(() => onde(groupe), T.ondeAt);

    // 4 · LE VOL — chaque petite boîte s'élance quand l'onde la touche.
    const portees = groupe.petites.map(slot => Math.hypot(slot.cx - groupe.cx, slot.cy - groupe.cy));
    const plusLoin = Math.max(...portees, 1);
    let dernier = 0;
    groupe.petites.forEach((slot, i) => {
      const retard = T.tensionMs + T.volAt + (portees[i] / plusLoin) * T.volEtalement;
      dernier = Math.max(dernier, retard);
      planifier(() => envoler(slot, groupe, i), retard);
    });
    planifier(() => { groupe.geste = false; }, dernier + Math.max(T.volMs, T.petiteDessinMs + T.encreMs));
  }

  function envoler(slot, groupe, rang) {
    const dx = groupe.cx - slot.cx;
    const dy = groupe.cy - slot.cy;
    // Elle naît à la taille qu'elle avait DANS la grande boîte, et pivote d'un
    // rien en s'ouvrant — une pile qu'on renverse, pas une grille qui se peuple.
    const depart = Math.min(0.62, Math.max(0.28, (groupe.grande.w * 0.24) / Math.max(1, slot.w)));
    const pivot = (rang % 2 ? 1 : -1) * (5 + (rang * 7) % 9);

    montrer(slot);
    slot.art.classList.add('plume');
    suivre(slot, slot.vol.animate([
      { transform: 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px) scale(' + depart.toFixed(3) + ') rotate(' + pivot + 'deg)', opacity: 0.35 },
      { transform: 'translate(' + (dx * 0.16).toFixed(1) + 'px, ' + (dy * 0.16).toFixed(1) + 'px) scale(.98) rotate(' + (pivot * 0.1).toFixed(2) + 'deg)', opacity: 1, offset: 0.74 },
      { transform: 'translate(0px, 0px) scale(1) rotate(0deg)', opacity: 1 },
    ], { duration: T.volMs, easing: 'cubic-bezier(.16,.84,.26,1)', fill: 'both' }));

    // Elle s'écrit EN CHEMIN : le tracé finit à peu près quand elle se pose.
    ecrire(slot, T.petiteDessinMs);
    planifier(() => {
      poser(slot);
      // ⚠️ `poser` ne relâche que les animations de TRACÉ ; le vol vit sur
      // l'enveloppe, et il faut l'annuler aussi — un `fill: both` laissé en
      // place garderait la main sur `transform` pour toujours (c'est la leçon
      // du `backwards` des symboles de l'introduction).
      slot.vol.getAnimations().forEach(animation => animation.cancel());
      slot.element.classList.add('boite--prete');
    }, Math.max(T.volMs, T.petiteDessinMs + T.encreMs));
  }

  /** L'onde : un seul élément, une seule transformation — le compositeur la
      joue sans repeindre quoi que ce soit. Sa taille de repos est sa PORTÉE,
      de sorte que l'échelle n'ait qu'à monter jusqu'à 1. */
  function onde(groupe) {
    const portee = Math.max(...groupe.petites.map(
      slot => Math.hypot(slot.cx - groupe.cx, slot.cy - groupe.cy) + slot.w), 1) * 2;
    const style = groupe.onde.style;
    style.width = portee.toFixed(0) + 'px';
    style.height = portee.toFixed(0) + 'px';
    style.left = (groupe.cx - portee / 2).toFixed(1) + 'px';
    style.top = (groupe.cy - portee / 2).toFixed(1) + 'px';
    groupe.onde.classList.add('boite-onde--en-jeu');

    const animation = groupe.onde.animate([
      { transform: 'scale(.05)', opacity: 0 },
      { transform: 'scale(.34)', opacity: 0.9, offset: 0.2 },
      { transform: 'scale(1)', opacity: 0 },
    ], { duration: T.ondeMs, easing: 'cubic-bezier(.18,.72,.28,1)' });
    animation.finished
      .then(() => groupe.onde.classList.remove('boite-onde--en-jeu'))
      .catch(() => { /* annulée : la classe tombe avec le démontage */ });
  }

  /* ── LE SALUT — ce qu'un dessin fait pendant qu'il s'écrit ──────────────
     Facultatif, déclaré par la PIÈCE (`salut`) — seul le drapeau en a un.
      · 'flotter' — un drapeau : il se DÉPLOIE pendant qu'on l'écrit, depuis
        sa hampe (l'étoffe part repliée contre elle et claque deux fois avant
        de se poser). Une seule transformation, jouée par le compositeur.
     ⚠️ Rien ne vit au repos : le geste s'achève et se relâche.
     (Une tombe a eu une LUEUR à la fin de son écriture — l'onde des boîtes,
     plus lente. Retirée à la demande de l'auteur : ne pas la remettre.) */
  function saluer(slot, duree) {
    const { salut } = slot.item;
    const vol = slot.vol;
    if (salut === 'flotter') {
      vol.style.transformOrigin = '27% 97%';          // le pied de la hampe
      const animation = vol.animate([
        { transform: 'scaleX(.18) skewY(9deg)', opacity: 0 },
        { transform: 'scaleX(.62) skewY(-6deg)', opacity: 1, offset: 0.3 },
        { transform: 'scaleX(1.07) skewY(4deg)', offset: 0.55 },
        { transform: 'scaleX(.97) skewY(-2deg)', offset: 0.75 },
        { transform: 'scaleX(1.01) skewY(.6deg)', offset: 0.9 },
        { transform: 'scaleX(1) skewY(0deg)', opacity: 1 },
      ], { duration: duree + T.encreMs, easing: 'cubic-bezier(.3,.6,.3,1)' });
      animation.finished.then(() => { vol.style.transformOrigin = ''; }).catch(() => {});
    }
  }

  /* ── ÉTATS ───────────────────────────────────────────────────────────── */

  function marquerOuvert(groupe, ouvert) {
    if (!groupe.grande) return;
    const bouton = groupe.grande.element;
    bouton.disabled = ouvert;
    bouton.setAttribute('aria-expanded', String(ouvert));
    bouton.setAttribute('aria-label',
      ouvert ? groupe.conf.etiquette + ' — déjà ouverte' : groupe.conf.etiquette);
  }

  /** Les deux états posés, sans le moindre geste — ce que l'on rend sous
      « mouvement réduit », et ce vers quoi l'éclatement aboutit. */
  function poserOuvert(groupe) {
    if (groupe.grande) cacher(groupe.grande);
    for (const slot of groupe.petites) {
      montrer(slot);
      poser(slot);
      slot.element.classList.add('boite--prete');
    }
  }

  function poserFerme(groupe) {
    montrer(groupe.grande);
    poser(groupe.grande);
    groupe.grande.element.classList.add('boite--prete');
  }

  /** Tous les dessins d'un côté : sa grande, s'il en a une, et ses petites. */
  const dessinsDe = groupe => groupe.grande ? [groupe.grande, ...groupe.petites] : groupe.petites;

  function reinitialiser(groupe) {
    groupe.geste = false;
    groupe.onde?.classList.remove('boite-onde--en-jeu');
    groupe.onde?.getAnimations().forEach(animation => animation.cancel());
    for (const slot of dessinsDe(groupe)) {
      relacher(slot);
      slot.vol.getAnimations().forEach(animation => animation.cancel());
      slot.vol.style.transformOrigin = '';
      slot.art.classList.remove('trace', 'plume');
      slot.element.classList.remove('boite--prete');
      cacher(slot);
    }
    marquerOuvert(groupe, ouverts.has(groupe.index));
    groupe.petites.forEach(marquerVue);
  }

  /**
   * On entre dans le lieu. Les boîtes présentes S'ÉCRIVENT — les deux grandes
   * à la première visite, ou les petites déjà libérées si l'on revient : le
   * lieu se rejoue toujours de la même façon, et une boîte ouverte le reste.
   */
  function monter() {
    if (disposed || !groupes.length) return;
    monte = true;
    conteneur.classList.add('boites--en-jeu');
    conteneur.inert = false;
    annulerMinuteries();
    groupes.forEach(reinitialiser);
    disposer();

    groupes.forEach((groupe, i) => {
      // Un côté sans grande est ouvert d'emblée : ses pièces s'écrivent.
      const ouvert = !groupe.grande || ouverts.has(groupe.index);
      // Sous « mouvement réduit », rien ne s'écrit : on POSE. Écrire en une
      // milliseconde reviendrait à créer 469 animations pour un geste que
      // personne ne doit voir.
      if (reduceMotion) {
        if (ouvert) poserOuvert(groupe);
        else poserFerme(groupe);
        return;
      }
      // `decalage` sépare les côtés ; un lieu à un seul côté ne le lit pas.
      const retard = B.dessinAt + (i ? i * B.decalage : 0);
      if (!ouvert) {
        planifier(() => dessiner(groupe.grande, T.dessinMs), retard);
        return;
      }
      // Les petites d'un côté ouvert s'écrivent du centre vers le dehors —
      // dans l'ordre même où l'onde les avait touchées, ou, pour une rangée
      // ouverte d'emblée, depuis son milieu (le drapeau d'abord).
      const portees = groupe.petites.map(slot => Math.hypot(slot.cx - groupe.cx, slot.cy - groupe.cy));
      const plusLoin = Math.max(...portees, 1);
      groupe.petites.forEach((slot, j) => {
        planifier(() => dessiner(slot, T.petiteDessinMs),
          retard + (portees[j] / plusLoin) * T.volEtalement);
      });
    });
  }

  /**
   * ON S'EN VA — ET LES BOÎTES S'EFFACENT, elles ne s'évanouissent pas.
   * Elles se dé-écrivent comme elles se sont écrites, à rebours, des plus
   * LOINTAINES du centre aux plus proches ; la scène ne coupe la lumière
   * qu'ensuite, d'où la durée rendue.
   *
   * ⚠️ SANS CE GESTE, LA SORTIE ÉTAIT FAUSSE. Les boîtes vivent AU-DESSUS du
   * canevas de la torche : pendant que celle-ci s'éteignait et que la
   * photographie tombait dans le noir, elles restaient blanches et pleines,
   * intactes sur du vide, jusqu'à ce que le voile d'extinction les avale d'un
   * bloc. On emportait le décor au lieu de quitter le lieu.
   */
  function sortir() {
    if (!monte || !groupes.length) return 0;
    taireLaPiece();
    annulerMinuteries();

    const presentes = groupe => dessinsDe(groupe)
      .filter(slot => !slot.element.classList.contains('boite--absente'));

    if (reduceMotion) {
      for (const groupe of groupes) presentes(groupe).forEach(cacher);
      return 0;
    }

    let fin = 0;
    for (const groupe of groupes) {
      const slots = presentes(groupe);
      if (!slots.length) continue;
      const portees = slots.map(slot => Math.hypot(slot.cx - groupe.cx, slot.cy - groupe.cy));
      const plusLoin = Math.max(...portees, 1);
      slots.forEach((slot, i) => {
        // Plus rien ne s'ouvre pendant qu'on s'en va : une pièce demandée au
        // milieu du départ s'afficherait sur une vitrine déjà éteinte.
        slot.element.classList.remove('boite--prete');
        const retard = (1 - portees[i] / plusLoin) * T.sortieEtalement;
        planifier(() => ecrire(slot, T.sortieMs, -1), retard);
        planifier(() => { cacher(slot); poser(slot); }, retard + T.sortieMs + T.encreMs);
        fin = Math.max(fin, retard + T.sortieMs + T.encreMs);
      });
    }
    return fin;
  }

  /**
   * On quitte le lieu. Tout s'arrête — ET L'INVENTAIRE SE REFERME : on
   * retrouve les deux grandes boîtes en revenant.
   *
   * ⚠️ C'est un choix, pas un oubli. « On ne revient pas en arrière » vaut
   * DANS le lieu : une boîte ouverte ne se referme pas d'un second clic. Mais
   * sortir du sous-chapitre, c'est éteindre la vitrine — et l'on ne rallume
   * pas sur des boîtes déjà éventrées, sans quoi la mise en scène de l'arrivée
   * ne se jouerait qu'une fois dans toute la visite.
   */
  function demonter() {
    if (!monte) return;
    monte = false;
    annulerMinuteries();
    taireLaPiece();
    ouverts.clear();
    groupes.forEach(reinitialiser);
    conteneur.classList.remove('boites--en-jeu');
    conteneur.inert = true;
  }

  // LE SÉCHAGE EST UN RÉGLAGE, ET IL N'A QU'UN LECTEUR : la feuille de style
  // l'attend en `--boite-sechage`. Le doubler d'une valeur par défaut en CSS
  // serait un repli invisible — il gagnerait le jour où la clé manque, et ne
  // servirait jamais autrement.
  conteneur.style.setProperty('--boite-sechage', T.sechageMs + 'ms');
  conteneur.inert = true;

  /** Combien de pièces ont été vues, sur combien : c'est ce que la vitrine
      retire de la prise pleine. Le total se lit de la composition — une pièce
      ajoutée à `cotes` compte aussitôt. */
  const TOTAL = B.cotes.flatMap(cote => cote.rangs.flat()).filter(item => item.piece || item.carte).length;
  const progres = () => ({ vues: vues.size, total: TOTAL });

  return {
    precharger,
    monter,
    demonter,
    sortir,
    progres,
    resize() { if (monte) disposer(); },
    destroy() {
      if (disposed) return;
      disposed = true;
      annulerMinuteries();
      controller.abort();
      conteneur.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
      conteneur.replaceChildren();
      groupes.length = 0;
    },
  };
}
