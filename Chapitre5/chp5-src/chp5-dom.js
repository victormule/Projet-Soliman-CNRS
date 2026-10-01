import { CONFIG as CHP5 } from './chp5-config.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const TEXTES = CHP5.textes;

/**
 * LES CINQ CARTELS, TIRÉS DE LA CONFIG (⑤ `cartels`) — deux témoignages,
 * trois sous-chapitres. Chacun reçoit une clé courte (a1, a2 pour les
 * témoignages ; n1…n3 pour les sous-chapitres) qui nomme son trait d'appel,
 * son point d'ancrage et son masque d'écriture.
 *
 * ⚠️ TRIÉS PAR `ancre.y`, DU HAUT DU SQUELETTE VERS LE BAS, témoignages et
 * sous-chapitres mêlés. C'est l'ordre du DOCUMENT, donc celui de la
 * tabulation — et le rang de chaque cartel dans le moteur, qui décale sa
 * dérive (`callout.index`). Il reproduit exactement l'ordre qui était écrit
 * à la main (a1, n1, n2, a2, n3) : rien ne bouge à l'écran.
 */
function listeCartels() {
  const temoignages = CHP5.cartels.temoignages.map((donnees, rang) =>
    ({ genre: 'temoignage', rang, cle: 'a' + (rang + 1), donnees }));
  const sousChapitres = CHP5.cartels.sousChapitres.map((donnees, rang) =>
    ({ genre: 'sousChapitre', rang, cle: 'n' + (rang + 1), donnees }));
  return [...temoignages, ...sousChapitres].sort((a, b) => a.donnees.ancre.y - b.donnees.ancre.y);
}

/** Les traits d'appel : un chemin et un point par cartel, et le masque qui
    les écrit pendant l'introduction (retiré à sa fin — voir finishIntro). */
function traits(cartels) {
  const masques = cartels.map(c => `
      <mask id="chp5-mask-${c.cle}" maskUnits="userSpaceOnUse">
        <path id="chp5-reveal-${c.cle}" class="leader-reveal"></path>
      </mask>`).join('');
  const lignes = cartels.map(c => `
    <path id="chp5-line-${c.cle}" class="leader" mask="url(#chp5-mask-${c.cle})"></path>
    <circle id="chp5-dot-${c.cle}" class="leader-start" r="2.15"></circle>`).join('');
  return `  <svg class="leaders" id="chp5-leaders" aria-hidden="true">
    <defs>${masques}
    </defs>${lignes}
  </svg>`;
}

/** Ce que le moteur lit sur chaque cartel : l'ancre (un point de l'IMAGE),
    le trait qui lui revient, sa profondeur et sa phase. */
function ancrage(c) {
  const d = c.donnees;
  return `data-anchor-x="${d.ancre.x}"
    data-anchor-y="${d.ancre.y}"
    data-line="line-${c.cle}"
    data-dot="dot-${c.cle}"
    data-depth="${d.profondeur}"
    data-phase="${d.phase}"`;
}

/** Un cercle tracé au trait — le même pour les deux genres de cartels. */
const CERCLE = '<svg class="circle-trace" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47" pathLength="100"></circle></svg>';

function cartel(c) {
  return c.genre === 'temoignage' ? cartelTemoignage(c) : cartelSousChapitre(c);
}

/** UN TÉMOIGNAGE — un bouton lecture/pause, le titre, le crédit, la durée.
    L'<audio> lui-même est en fin de gabarit (`chp5-audio<n>`). */
function cartelTemoignage(c) {
  const d = c.donnees;
  const n = c.rang + 1;
  return `  <section
    id="chp5-audio-${n}"
    class="callout right audio-callout"
    ${ancrage(c)}>

    <div class="callout-inner">
      <button class="circle-button target"
              type="button"
              aria-pressed="false"
              aria-label="${escape(TEXTES.lire)} « ${escape(d.titre)} »"
              data-audio="audio${n}">
        ${CERCLE}
        <span class="audio-ring"></span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path class="icon-play" fill="currentColor" d="M8.4 5.6v12.8L18.8 12z"/>
          <g class="icon-pause" fill="currentColor">
            <rect x="7" y="5.8" width="3.4" height="12.4" rx=".7"/>
            <rect x="13.6" y="5.8" width="3.4" height="12.4" rx=".7"/>
          </g>
        </svg>
      </button>

      <div class="callout-copy">
        <span class="eyebrow">${escape(TEXTES.temoignage)}</span>
        <span class="title">${escape(d.titre)}</span>
        <span class="credit">${escape(d.credit)}</span>
        <div class="audio-meta">
          <span class="wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
          <span class="time">00:00 / ${escape(d.duree)}</span>
        </div>
      </div>
    </div>
  </section>`;
}

/**
 * UN SOUS-CHAPITRE — le chiffre dans son cercle, qui devient une flèche au
 * survol, et l'intitulé.
 *
 * ⚠️ L'ATTRIBUT data-part EST LA MARQUE D'UN SOUS-CHAPITRE OUVERT, et il ne
 * vient que d'un `lieu` déclaré dans la config : un cartel qui le porte est
 * cliquable (le moteur y branche l'ouverture, le curseur repasse à pointer) ;
 * un cartel sans lui garde son aria-disabled, dit « à venir » et ne promet
 * rien. Le nom accessible est écrit ici parce que l'intitulé, lui, reste
 * masqué tant qu'on ne survole pas : un bouton qui n'annoncerait que « 1 » ne
 * dirait à personne où il mène.
 */
function cartelSousChapitre(c) {
  const d = c.donnees;
  const n = c.rang + 1;
  const ouvert = Boolean(d.lieu);
  const bouton = ouvert
    ? `data-part="${c.rang}"
            aria-label="${escape(TEXTES.ouvrirSousChapitre)} ${n} : ${escape(d.titre)}"`
    : 'aria-disabled="true"';
  const surtitre = ouvert ? TEXTES.sousChapitre : TEXTES.sousChapitre + ' · ' + TEXTES.aVenir;
  return `  <section
    id="chp5-nav-${n}"
    class="callout left nav-callout"
    ${ancrage(c)}>

    <button class="nav-link" type="button" ${bouton}>
      <span class="nav-circle target" aria-hidden="true">
        ${CERCLE}
        <span class="nav-number">${n}</span>
        <svg class="nav-arrow" viewBox="0 0 24 24">
          <path class="arrow" fill="none" stroke="currentColor" stroke-width="1.35"
                stroke-linecap="round" stroke-linejoin="round"
                d="M5 12h13M13.5 7.5 18 12l-4.5 4.5"/>
        </svg>
      </span>
      <span class="nav-copy">
        <span class="eyebrow">${escape(surtitre)}</span>
        <span class="title">${escape(d.titre)}</span>
      </span>
    </button>
  </section>`;
}

/** Le DOM du chapitre, monté à chaque visite ; aucun accès au document ici. */
export function buildChapitre5DOM() {
  const cartels = listeCartels();
  return `
<div class="stage intro-running" id="chp5-stage" aria-label="${escape(TEXTES.chapitre)}">

  <div class="camera" id="chp5-camera" aria-hidden="true">
    <img class="background" id="chp5-background"
         src="${escape(CHP5.image.src)}"
         width="${CHP5.image.width}" height="${CHP5.image.height}"
         decoding="async" fetchpriority="high"
         alt=""
         draggable="false">
  </div>

${traits(cartels)}

${cartels.map(cartel).join('\n')}

  <!-- LA PORTE — sous-chapitre 1. Elle n'entre en jeu qu'au clic sur le « 1 ».
       ⚠️ LES DEUX BATTANTS N'ONT PAS DE src ICI, ET C'EST VOLONTAIRE : ce
       sont deux PNG de 7 Mo à eux deux, et les poser dans le gabarit les
       ferait télécharger EN MÊME TEMPS que la photographie d'ouverture — que
       la scène attend pour lever son rideau noir. Le moteur les charge à la
       fin de l'introduction (chargerPorte), quand plus rien ne les dispute et
       que le « 1 » n'est de toute façon pas encore cliquable. -->
  <div class="porte" id="chp5-porte" aria-hidden="true">
    <div class="porte-voile" id="chp5-porteVoile"></div>
    <div class="porte-cadre" id="chp5-porteCadre">
      <img class="porte-battant" id="chp5-porteGauche"
           alt="" decoding="async" draggable="false">
      <img class="porte-battant" id="chp5-porteDroite"
           alt="" decoding="async" draggable="false">
    </div>
  </div>

  <!-- LA VITRINE — sous-chapitre 2. Deux prises de la MÊME photographie,
       superposées : la boîte vide dessous, la boîte pleine par-dessus, qui
       s'efface d'un pas à chaque pièce consultée. Le canevas porte la torche.
       ⚠️ PAS DE src ICI NON PLUS, et pour une raison plus forte encore que
       pour la porte : ce sont deux images de 21 mégapixels (~1 s de décodage
       chacune, mesuré). Le moteur ne les charge qu'au clic, DERRIÈRE
       l'extinction — c'est la mise en scène elle-même qui couvre l'attente. -->
  <div class="vitrine" id="chp5-vitrine" aria-hidden="true">
    <img class="vitrine-vue" id="chp5-vitrineVide"
         alt="" decoding="async" draggable="false">
    <img class="vitrine-vue vitrine-plein" id="chp5-vitrinePlein"
         alt="" decoding="async" draggable="false">
    <canvas class="vitrine-torche" id="chp5-vitrineTorche" aria-hidden="true"></canvas>
  </div>

  <!-- L'INHUMATION — sous-chapitre 3. Deux photographies, l'une AVANT la
       voix (la vitrine des crânes), l'autre APRÈS (la vitrine au buste) : la
       seconde monte pendant que la première s'efface. Le canevas porte la
       torche, comme dans la vitrine du « 2 ».
       ⚠️ PAS DE src ICI : même règle que les deux autres lieux, le moteur ne
       les charge qu'au clic, derrière l'extinction.
       La vitrine au buste et la planche sont chacune dans un CADRE plus grand
       que l'écran, que la main fait glisser (le panorama, voir le moteur) :
       le glissement vit sur le cadre, les gestes de bascule et de planche sur
       l'image — deux transformations qui ne se marchent pas dessus. -->
  <div class="inhumation" id="chp5-inhumation" aria-hidden="true">
    <div class="inhumation-cadre" id="chp5-inhumationCadreApres">
      <img class="inhumation-vue inhumation-apres" id="chp5-inhumationApres"
           alt="" decoding="async" draggable="false">
    </div>
    <img class="inhumation-vue inhumation-avant" id="chp5-inhumationAvant"
         alt="" decoding="async" draggable="false">
    <div class="inhumation-cadre" id="chp5-inhumationCadreFond">
      <img class="inhumation-vue inhumation-fond" id="chp5-inhumationFond"
           alt="" decoding="async" draggable="false">
    </div>
    <div class="inhumation-ombre" aria-hidden="true"></div>
    <canvas class="inhumation-torche" id="chp5-inhumationTorche" aria-hidden="true"></canvas>
  </div>

  <!-- « PASSER » — le bouton de l'entrée du chapitre 1, redit ici pour la
       même raison que la légende : #skip-btn vit dans #app, donc ENTERRÉ sous
       la scène du chapitre (z 500). Le moteur dessine son cadre à la taille
       des flèches du site. -->
  <button class="passer" id="chp5-passer" type="button" hidden
          aria-label="${escape(TEXTES.passerNom)}"></button>

  <!-- LA PLANCHE DU DRAPEAU — sa croix (en haut à droite, le dessin de celle
       des pièces) et le crédit de la voix (en bas, tant qu'elle parle). Au
       DESSUS de la planche (dans .inhumation, z 30), SOUS l'extinction (z 35). -->
  <button class="planche-croix" id="chp5-plancheCroix" type="button" hidden
          aria-label="${escape(TEXTES.fermerPlanche)}">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <line x1="6" y1="6" x2="18" y2="18"></line>
      <line x1="18" y1="6" x2="6" y2="18"></line>
    </svg>
  </button>
  <div class="planche-credit" id="chp5-plancheCredit"><span></span></div>

  <!-- LES BOÎTES — l'inventaire, de part et d'autre du crâne.
       ⚠️ HORS DE LA VITRINE, ET C'EST NÉCESSAIRE : cette couche-là est
       aria-hidden et pointer-events:none (deux photographies et un canevas,
       rien à toucher), quand les deux grandes boîtes sont de VRAIS boutons —
       cliquables et atteignables au clavier. Elles vivent donc à côté, au
       DESSUS du canevas de la torche (qui les noierait : elles sont à la
       périphérie) et SOUS le voile d'extinction (qui doit les couvrir quand on
       s'en va). Le module chp5-boites.js remplit ce conteneur.
       ⚠️ ET AUCUN ACCENT GRAVE DANS CE FICHIER : tout le gabarit est UN SEUL
       littéral de gabarit, que le premier accent grave venu refermerait —
       « Unexpected identifier », et le site entier ne se charge plus. -->
  <div class="boites" id="chp5-boites"></div>

  <!-- LA TOMBE ET LE DRAPEAU — sous-chapitre 3. Le même module que les
       boîtes (chp5-boites.js), dans une couche à lui : les deux lieux ne
       sont jamais montés ensemble, mais chacun garde ses dessins et ce qu'on
       y a déjà ouvert. -->
  <div class="boites" id="chp5-tombes"></div>

  <!-- LE NOM DE LA PIÈCE, EN BAS — il paraît au survol d'une petite boîte.
       C'est le titre de survol du tronc commun (#hover-title), redit ici :
       celui-là vit dans #app, donc ENTERRÉ sous la scène du chapitre (z 500),
       exactement comme le canevas de la torche et le lecteur média. -->
  <div class="legende" id="chp5-legende" aria-hidden="true"><span></span></div>

  <!-- LA FENÊTRE DES PIÈCES — remplie par chp5-visionneuse.js.
       Au-dessus des boîtes, SOUS le voile d'extinction : quand on s'en va, le
       noir doit la couvrir comme il couvre tout le reste. -->
  <div class="doc" id="chp5-doc"></div>

  <!-- L'EXTINCTION. Noir plein écran, DANS le root : les titres (z 600) lui
       passent donc au-dessus, et le sous-titre peut changer pendant qu'il
       tombe — c'est là qu'on lit où l'on va. -->
  <div class="nuit" id="chp5-nuit" aria-hidden="true"></div>

  <div class="intro-black" id="chp5-introBlack" aria-hidden="true"></div>

${CHP5.cartels.temoignages.map((t, i) =>
    '  <audio id="chp5-audio' + (i + 1) + '" preload="none" src="' + escape(t.src) + '"></audio>').join('\n')}
</div>
<div id="chp5-fade" aria-hidden="true"></div>
<div id="chp5-boot" style="position:absolute;inset:0;z-index:100;background:#000;pointer-events:none" aria-hidden="true"></div>
`;
}
