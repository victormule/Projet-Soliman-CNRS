/**
 * RÉGLAGES DU CHAPITRE V — « Le devenir du corps de Soliman al-Halabi »
 * ═══════════════════════════════════════════════════════════════════════════
 * Données pures, sans effet de bord : la scène l'importe STATIQUEMENT (elle
 * en a besoin avant le moteur, pour le sous-titre et la photographie), le
 * moteur, le gabarit et les modules le lisent au montage.
 *
 * ⚠️ LA RÈGLE DU SITE (audit de juillet 2026) : un réglage est LU, et lu d'un
 * seul endroit. Aucun repli dans le code ni dans la feuille ne double un
 * chiffre d'ici — une clé qui manque doit se VOIR. Et un réglage qui n'agit
 * pas n'a rien à faire ici.
 *
 * LE PLAN — dans l'ordre où l'on vit le chapitre :
 *   ①  LES DOSSIERS ............ où sont les fichiers
 *   ②  LE CHAPITRE ............. sous-titre, sortie, textes de l'interface
 *   ③  LA PHOTOGRAPHIE ......... l'image, le mur, la caméra, la mise au point
 *   ④  L'INTRODUCTION .......... la chronologie de l'arrivée
 *   ⑤  LES CARTELS ............. deux témoignages, trois sous-chapitres
 *   ⑥  LA PORTE ................ sous-chapitre 1 · « Dans les réserves… »
 *   ⑦  LA VITRINE .............. sous-chapitre 2 · « Restituer… »
 *   ⑧  L'INHUMATION ............ sous-chapitre 3 · « Inhumer… »
 *   ⑨  LE GESTE DES DESSINS .... écrire, ouvrir, s'envoler (vitrine ET inhumation)
 *   ⑩  LA FENÊTRE DES PIÈCES ... ce qu'une boîte ou une tombe ouvre
 *   ⑪  L'AMBIANCE SONORE ....... une bande-son par lieu, et ses silences
 *
 * CE QUI N'EST PAS ICI, ET POURQUOI :
 *  · les FRÉQUENCES des mouvements de la caméra et des cartels (les sinus du
 *    moteur) : elles sont la signature du geste, pas un réglage — seules
 *    leurs INTENSITÉS sont ici (③, ⑤) ;
 *  · les couleurs et la typographie : dans la feuille (chp5-opening.css),
 *    qui les partage avec le reste du site ;
 *  · la géométrie des dessins : dans les SVG eux-mêmes (chp5-images/).
 */

/* ═══════════════════════════════════════════════════════════════════════════
   ①  LES DOSSIERS
   ═══════════════════════════════════════════════════════════════════════════
   Un seul endroit pour les chemins : tout ce qui suit s'y réfère.
   ⚠️ Noms de fichiers : JAMAIS d'espaces, d'accents ni d'apostrophes (casse
   silencieuse possible selon l'hébergeur). Les fichiers déposés en vrac à
   la racine de Chapitre5/ doivent être renommés et rangés ici. */
const IMAGES = 'Chapitre5/chp5-images/';
const MEDIAS = 'Chapitre5/chp5-medias/';

export const CONFIG = {

  /* ═════════════════════════════════════════════════════════════════════════
     ②  LE CHAPITRE — ce qu'on lit en entrant, et comment on en sort
     ═════════════════════════════════════════════════════════════════════════ */

  /** Le niveau 2 de la colonne de titres, sous « Espace collaboratif ». Il
      CÈDE SA PLACE à l'intitulé d'un sous-chapitre quand on y entre (voir
      ⑤ `sousChapitres`), il ne se double pas. */
  subtitle: 'Le devenir du corps de Soliman al-Halabi',

  /** Le fondu au noir de la sortie du chapitre, pour toute destination. */
  exitMs: 1100,

  /** LES TEXTES DE L'INTERFACE — tout ce que le chapitre écrit ou fait dire
      au lecteur d'écran, hors des titres éditoriaux (qui sont avec ce qu'ils
      nomment : cartels ⑤, pièces ⑦ ⑧). Les phrases se composent dans le
      code (« Lire « titre » », « Ouvrir le sous-chapitre 2 : titre ») : ne
      mettre ici que le mot. */
  textes: {
    chapitre: 'Chapitre V',
    temoignage: 'Témoignage',
    sousChapitre: 'Sous-chapitre',
    aVenir: 'À venir',
    ouvrirSousChapitre: 'Ouvrir le sous-chapitre',
    lire: 'Lire',
    mettreEnPause: 'Mettre en pause',
    lireOuPause: 'Lire ou mettre en pause',
    /** Le nom de la flèche quand elle ramène à la photographie, et ce que le
        lecteur d'écran annonce au retour. */
    retourPhotographie: 'Revenir à la photographie des réserves',
    annonceRetour: 'Retour à la photographie des réserves.',
    passer: 'Passer',
    passerNom: 'Passer le témoignage',
    /** Le lien de secours sous une pièce que le navigateur refuserait
        d'afficher en ligne. */
    ouvrirCarte: 'Ouvrir la carte dans un nouvel onglet',
    ouvrirDocument: 'Ouvrir le document dans un nouvel onglet',
    /** Le nom des deux croix : celle d'une pièce, celle de la planche. */
    fermerDocument: 'Fermer le document',
    fermerPlanche: 'Fermer la planche',
  },

  /* ═════════════════════════════════════════════════════════════════════════
     ③  LA PHOTOGRAPHIE — les réserves du Musée de l'Homme
     ═════════════════════════════════════════════════════════════════════════
     Une photographie animée : la caméra respire et suit la main, la mise au
     point cherche. Elle est posée en `cover` ; ce qui s'y accroche (les
     ancres des cartels, le mur) est donc en PIXELS DE L'IMAGE, projetés à
     chaque redimensionnement — jamais en pourcentage d'écran. */
  image: {
    src: IMAGES + 'chp5-opening.jpg',
    width: 1800,
    height: 962,
    /** Le point de l'image que le cadrage garde en vue quand la fenêtre
        rogne (le squelette), en fraction de l'image. */
    focalX: 1115 / 1800,
    focalY: 425 / 962,

    /* ⚠️ LE MUR — bord gauche du dormant de la fenêtre, en x de l'IMAGE.
       C'est lui qui arrête les cartels de gauche : au-delà commence le jour,
       et aucun texte clair n'y tient. Le moteur le PROJETTE à chaque
       redimensionnement et le publie en `--chp5-mur` (voir resize()), parce
       que sa place à l'écran ne suit pas la largeur de la fenêtre mais son
       RAPPORT : mesuré à 48,6 % de l'écran en 16/9, 43,5 % en 3/2, 36,7 % en
       4/3. C'est ce qui obligeait les trois cercles à se tenir très à gauche —
       calés sur le pire cadrage, ils l'étaient pour tous les autres. */
    murX: 880,
  },

  /** LA CAMÉRA. Les fréquences de sa dérive sont dans le moteur (c'est la
      signature du geste) ; ici, ses intensités.
      · `zoom`      — l'échelle d'arrivée (1 = l'image juste couvrante). Le
                      moteur y ajoute un peu sur les formats étroits, pour
                      recentrer le squelette.
      · `derive`    — l'ampleur de la respiration au repos (1 = telle que
                      composée, 0 = une caméra immobile).
      · `parallaxe` — de combien de pixels la main la déplace, bord à bord.
      · `suivi`     — la vitesse à laquelle elle rejoint la main (par image,
                      0…1 : plus bas, plus lent et plus ample). */
  camera: {
    zoom: 1.075,
    derive: 1,
    parallaxe: { x: 12.5, y: 9 },
    suivi: 0.055,
  },

  /** LA MISE AU POINT — un flou qui cherche, en pixels. Bornes de sa
      respiration (`min`, `max`), et ce que la main agitée y ajoute (`main`).
      ⚠️ Le recul de la porte (⑥ `flou`) s'ajoute HORS de ces bornes : elles
      disent comment l'objectif respire, pas jusqu'où on peut s'éloigner. */
  miseAuPoint: { min: 0.08, max: 1.75, main: 0.10 },

  /* ═════════════════════════════════════════════════════════════════════════
     ④  L'INTRODUCTION — noir, puis la photographie, les traits, les cercles
     ═════════════════════════════════════════════════════════════════════════
     En ms depuis le lever du rideau. La photographie monte en fondu
     (`fadeMs`) pendant que la caméra s'approche (`cameraMs`) ; les traits
     d'appel jaillissent du squelette (`linesAt`, `lineMs`), les cercles se
     dessinent (`circlesAt`, `circleMs`), les chiffres paraissent
     (`symbolsAt`) ; à `endAt`, tout est cliquable. */
  intro: {
    fadeMs: 2250,
    cameraMs: 2850,
    linesAt: 4050,
    lineMs: 980,
    circlesAt: 4780,
    circleMs: 610,
    symbolsAt: 5150,
    endAt: 5550,
  },

  /* ═════════════════════════════════════════════════════════════════════════
     ⑤  LES CARTELS — deux témoignages à droite, trois sous-chapitres à gauche
     ═════════════════════════════════════════════════════════════════════════
     Chaque cartel est relié à un point du SQUELETTE par un trait d'appel.
     Le gabarit (chp5-dom.js) les fabrique d'ici : ajouter un témoignage ou
     un sous-chapitre, c'est ajouter une entrée.

     ⚠️ `ancre` EST UN POINT DE L'IMAGE (1800 × 962), ET DOIT TOMBER SUR UN
     OS. Une ancre posée à quelques pixels du bord d'un os tombe dans le vide,
     et le trait semble naître de la fenêtre (c'est arrivé : le second
     témoignage partait de 20 px à droite des côtes). Après tout recadrage ou
     remplacement de la photographie, revérifier les cinq ancres EN ZOOMANT.

     `profondeur` et `phase` règlent le mouvement propre de chaque cartel :
     la profondeur multiplie la parallaxe (un cartel « proche » bouge plus),
     la phase décale sa dérive pour qu'aucun ne respire à l'unisson.

     ⚠️ L'ORDRE DE TABULATION SUIT LE SQUELETTE, DE HAUT EN BAS : le gabarit
     trie les cinq cartels par `ancre.y`, témoignages et sous-chapitres mêlés.
     La place À L'ÉCRAN, elle, est dans la feuille (`#chp5-audio-1`…,
     `#chp5-nav-1`…) — pour les cartels de gauche, accrochée au mur. */
  cartels: {
    /** Ce que la main fait aux cartels : `parallaxe`, de combien elle les
        déplace (multiplié par leur profondeur) ; `repousse`, comment ils
        s'écartent du pointeur qui s'approche — jusqu'à `rayon` px, d'au
        plus `x` et `y` px. */
    parallaxe: { x: 11.5, y: 8.5 },
    repousse: { rayon: 340, x: 7.5, y: 5.5 },

    /** LES TÉMOIGNAGES — une voix qu'on écoute sans quitter la photographie.
        Un seul à la fois ; en écouter un éclipse la flèche et la boussole.
        `duree` est affichée avant le chargement (les <audio> sont en
        `preload="none"`) : la tenir d'accord avec le fichier. */
    temoignages: [
      {
        src: MEDIAS + 'temoignage-lyceenne-que-faire-soliman.mp3',
        titre: 'Que faire de Soliman al-Halabi ?',
        credit: 'C., lycéenne',
        duree: '01:50',
        ancre: { x: 1108, y: 151 },
        profondeur: 1.12,
        phase: 0.4,
      },
      {
        src: MEDIAS + 'temoignage-etudiant-vie-defunts.mp3',
        titre: 'La vie des défunts',
        credit: 'V., étudiant',
        duree: '00:41',
        /* La main droite, et non les côtes : à (1170, 327) l'ancre tombait
           à vingt pixels à droite de l'os. */
        ancre: { x: 1136, y: 484 },
        profondeur: 1.18,
        phase: 4.1,
      },
    ],

    /** LES SOUS-CHAPITRES — un chiffre qui devient une flèche au survol.
        `lieu` dit quelle mise en scène le chiffre ouvre (⑥ 'porte',
        ⑦ 'vitrine', ⑧ 'inhumation'). ⚠️ UN SOUS-CHAPITRE SANS `lieu` EST
        « À VENIR » : son cartel porte `aria-disabled`, son curseur ne promet
        rien, et le mot `textes.aVenir` s'ajoute à son surtitre. C'est la
        seule chose à écrire pour en fermer un — ou, le jour venu, l'ouvrir.
        `titre` est aussi ce qui REMPLACE le sous-titre ② quand on y entre. */
    sousChapitres: [
      {
        titre: 'Dans les réserves du Musée de l’Homme',
        lieu: 'porte',
        ancre: { x: 1052, y: 239 },
        profondeur: 1.28,
        phase: 1.7,
      },
      {
        titre: 'Restituer les restes osseux de Soliman al-Halabi ?',
        lieu: 'vitrine',
        ancre: { x: 1057, y: 461 },
        profondeur: 0.92,
        phase: 2.9,
      },
      {
        titre: 'Inhumer la dépouille de Soliman al-Halabi ?',
        lieu: 'inhumation',
        ancre: { x: 1092, y: 617 },
        profondeur: 1.38,
        phase: 5.3,
      },
    ],
  },

  /* ═════════════════════════════════════════════════════════════════════════
     ⑥  LA PORTE — sous-chapitre 1, « Dans les réserves du Musée de l'Homme »
     ═════════════════════════════════════════════════════════════════════════
     Cliquer le « 1 » ne change pas de scène : on RECULE. La photographie des
     réserves s'éloigne et se trouble, les deux battants entrent par les côtés
     et se rejoignent, la salle disparaît derrière eux — puis, une seconde plus
     tard, la caméra pousse sur le panneau « Anthropologie biologique ».

     ⚠️ LES DEUX BATTANTS SONT LES DEUX MOITIÉS D'UNE MÊME PHOTOGRAPHIE
     (2208 × 2968), coupée sur `joint` : le gauche est le morceau x 0…860, le
     droit le morceau x 861…2207. Chacun est posé dans SA part du cadre, et
     les deux refont l'image entière au pixel près — c'est ce qui permet de ne
     les animer qu'en translation, sans jamais avoir à accorder deux cadrages.
     `joint` dit donc deux choses : où les battants se rejoignent, et de
     combien chacun doit s'effacer pour quitter l'écran.

     ⚠️ CE SONT DES JPEG, ET ILS NE PEUVENT PLUS SE SUPERPOSER. Ils étaient
     naguère deux PNG du canevas ENTIER, à transparence complémentaire : 6,5 Mo
     à eux deux pour une photographie de porte. Recadrés, ils n'ont plus besoin
     de transparence — donc plus besoin de PNG : 0,38 Mo, à 48 dB de PSNR.
     Les masters restent à côté (.png). Pour les refabriquer :
       ffmpeg -i chpt-5-P1-gauche.png -vf "crop=861:2968:0:0"   -q:v 2 -pix_fmt yuvj444p chpt-5-P1-gauche.jpg
       ffmpeg -i chpt-5-P1-droite.png -vf "crop=1347:2968:861:0" -q:v 2 -pix_fmt yuvj444p chpt-5-P1-droite.jpg
     (4:4:4 et non 4:2:0 : le panneau porte du texte ROUGE sur fond clair, que
     le sous-échantillonnage de chrominance baverait — et on le regarde de
     près, en gros plan, à sa résolution native.)

     ⚠️ Les coordonnées de `panneau` sont en PIXELS DE L'IMAGE, comme `murX` :
     le moteur les projette dans la fenêtre à chaque redimensionnement. Un
     pourcentage d'écran serait faux au premier changement de format.
     Après tout ré-export des battants, les remesurer (le panneau est le seul
     grand aplat clair et bleuté de la porte). */
  porte: {
    gauche: IMAGES + 'chpt-5-P1-gauche.jpg',
    droite: IMAGES + 'chpt-5-P1-droite.jpg',
    width: 2208,
    height: 2968,
    joint: 861,
    panneau: { x: 996, y: 577, width: 863, height: 611 },

    /** La porte posée : hauteur en % de la fenêtre — la lumière tombe à
        gauche et à droite, l'image étant en portrait. `largeurMax` ne sert
        qu'aux écrans étroits, où c'est la largeur qui arrête la porte. */
    hauteur: 98,
    largeurMax: 96,

    /** LA COULEUR DE PART ET D'AUTRE — et, avant cela, celle dans laquelle la
        salle disparaît pendant que les battants se referment : le voile va de
        transparent à cette couleur, exactement à la vitesse des battants.
        ⚠️ Elle décide aussi de la couleur des TITRES au-dessus (cf. la classe
        `porte-en-jeu` dans style.css) : dorés sur blanc, ils ne se lisent
        plus. Changer l'une sans l'autre rend la colonne illisible. */
    fond: '#ffffff',

    /** Le panneau en gros plan : sa place à l'arrivée, en % de la fenêtre.
        La plus PETITE des deux contraintes gagne — le panneau est montré
        ENTIER, jamais rogné : c'est un document administratif, et ce qu'il dit
        en petit (« Exposition de restes humains ») fait partie de ce qu'on
        vient lire.

        ⚠️ CE N'EST PAS UN CHIFFRE LIBRE : LA COLONNE DE TITRES PASSE DEVANT.
        Le panneau est presque blanc et les titres sont dorés — ils y
        deviennent illisibles. Le panneau étant centré, sa hauteur décide de
        l'endroit où tombe son bord supérieur : mesuré, le bloc haut-gauche
        (titre, sous-titre, intitulé du sous-chapitre, boussole) descend
        jusqu'à 12 % de la fenêtre, d'où 70 % — le panneau s'arrête dessous,
        sur le gris sombre de la porte. Monter ce chiffre, c'est jeter les
        titres en plein sur le panneau, aux trois formats.
        Bénéfice second : à 70 % le panneau est affiché à peu près à sa
        résolution native (863 px de large) et reste NET ; à 90 % il était
        agrandi d'un tiers et visiblement mou. */
    panneauLargeur: 86,
    panneauHauteur: 70,

    /** Le recul : échelle de la photographie quand on s'en éloigne (1 = en
        place), et le flou qui vient avec, en pixels. */
    recul: 0.80,
    flou: 2.4,

    /** Chronologie de l'aller, en ms depuis le clic sur le « 1 ». */
    reculMs: 1500,
    fermeAt: 220,
    fermeMs: 1700,
    poseMs: 1000,     // le temps où l'on voit la porte entière, avant le zoom
    zoomMs: 2400,

    /** Chronologie du retour, en ms depuis le clic sur la flèche. */
    retourZoomMs: 1100,
    ouvreAt: 780,
    ouvreMs: 1400,

    /** PAR LA CARTE, LES LIEUX SE REJOIGNENT PAR LE NOIR. Arrivé d'un autre
        lieu (ou d'une autre scène), on ne voit pas la salle reculer : la porte
        est déjà FERMÉE, et le noir se lève sur elle (`leveMs`) ; la pose et le
        gros plan suivent. Parti vers un autre lieu, les battants ne se
        rouvrent pas sur la salle : le noir tombe sur le panneau (`noirMs`). */
    leveMs: 1400,
    noirMs: 1400,
  },

  /* ═════════════════════════════════════════════════════════════════════════
     ⑦  LA VITRINE — sous-chapitre 2, « Restituer les restes osseux »
     ═════════════════════════════════════════════════════════════════════════
     Cliquer le « 2 » éteint la lumière. On rallume ailleurs : une torche fixe
     au centre, comme à la phrénologie, ouvre sur la boîte où le crâne attend
     « objet à l'étude ». Deux boîtes d'archive s'écrivent de part et d'autre ;
     elles s'ouvrent sur les pièces qu'elles contiennent, et chaque pièce
     consultée efface un peu plus le crâne — c'est la même photographie, prise
     deux fois, l'une pleine et l'autre vide (voir `effacementMs`).

     ⚠️ LES DEUX PRISES DOIVENT ÊTRE RIGOUREUSEMENT SUPERPOSABLES : le fondu
     ne vaut que par leur cadrage commun. Après tout remplacement, vérifier que
     la boîte ne bouge pas d'un pixel entre les deux.

     ⚠️ ELLES NE SE CHARGENT QU'AU CLIC, et c'est la mise en scène elle-même
     qui le permet : l'extinction couvre le temps qu'il faut. Le noir ne se
     lève que lorsque les deux images sont décodées — sur une liaison lente,
     il dure simplement plus longtemps.

     ⚠️ JPEG, ET RAMENÉES À 3200 px DE LARGE. Les masters font 5500 × 3864 :
     27 Mo à eux deux, ~1 s de décodage chacune, et 85 Mo de texture pièce —
     pour une image qu'aucun écran ne montre à plus de 4000 px. Réduites, elles
     pèsent 0,55 Mo et gardent 46,6 et 48,0 dB de PSNR (Y). Les masters restent
     à côté (.png). Pour les refabriquer :
       ffmpeg -i chpt-5-P2-plein.png -vf "scale=3200:-2:flags=lanczos" -q:v 3 chpt-5-P2-plein.jpg
       ffmpeg -i chpt-5-P2-vide.png  -vf "scale=3200:-2:flags=lanczos" -q:v 3 chpt-5-P2-vide.jpg */
  restitution: {
    plein: IMAGES + 'chpt-5-P2-plein.jpg',
    vide:  IMAGES + 'chpt-5-P2-vide.jpg',

    /** LA PHOTOGRAPHIE, EN PIXELS. Elle est posée en `contain` : le moteur a
        besoin de son rapport pour savoir où tombent ses bords — c'est de là
        que part la garde autour du crâne (voir `boites.garde`). */
    photo: { width: 3200, height: 2248 },

    /* ── LE PASSAGE ────────────────────────────────────────────────────── */

    /** L'extinction, puis le retrait du noir sous la torche encore éteinte
        (l'écran reste noir : c'est le canevas de la torche qui prend le
        relais du voile, sans qu'on voie la passation). */
    noirMs: 1400,
    leveMs:  400,

    /** La torche : FIXE et centrale, comme à la phrénologie. `size` est une
        fraction de min(largeur, hauteur) — la seule grandeur qui survive à un
        redimensionnement. */
    torche: { size: 0.72, growMs: 3000, fadeMs: 1200 },

    /** Le retour : les boîtes se dé-écrivent (⑨ `sortieMs`), la torche
        s'éteint (torche.fadeMs), puis le noir se retire sur la photographie
        des réserves. */
    retourMs: 1400,

    /* ── LE CRÂNE QUI S'EFFACE ─────────────────────────────────────────── */

    /** LE CRÂNE S'EFFACE À MESURE QU'ON CONSULTE LES PIÈCES.
        La prise PLEINE est à 100 % en arrivant ; chaque pièce ouverte pour la
        première fois (une petite boîte) lui retire sa part, et quand toutes
        ont été vues elle est à 0 % : il ne reste que la boîte vide. Le pas se
        joue en fondu, sur cette durée, AU MOMENT OÙ L'ON REFERME la pièce —
        c'est-à-dire quand on regarde de nouveau la vitrine : fait derrière le
        voile de la fenêtre, on ne l'aurait pas vu.
        ⚠️ Ce jeu REMPLACE celui de la main qui s'approchait (le crâne
        disparaissait sous le curseur) : les deux ensemble se contrediraient,
        la main vidant la boîte qu'aucune pièce n'aurait encore effacée. */
    effacementMs: 2600,

    /* ── LES BOÎTES — de part et d'autre du crâne ──────────────────────────
       Deux grandes boîtes d'archive se dessinent à l'arrivée dans la vitrine,
       une de chaque côté. Cliquer l'une l'ouvre : elle se dé-dessine, une onde
       part de son centre et les petites boîtes qu'elle contenait s'élancent
       vers leur place en s'écrivant à leur tour. ON N'EN REVIENT PAS : une
       boîte ouverte le reste — c'est un geste d'inventaire, pas un tiroir.
       (La VITESSE de ce geste est au ⑨ ; ici, la composition et la place.)

       ⚠️ LA COMPOSITION EST DANS `cotes`, ET ELLE SEULE. Chaque côté dit sa
       grande boîte et ses rangs de petites, de haut en bas ; la géométrie
       (colonnes, lignes, tailles) se déduit de ces listes. Ajouter une boîte à
       un rang, ou un rang entier, ne demande rien d'autre.

       ⚠️ LES DESSINS SONT MÉLANGÉS À DESSEIN. Neuf fichiers pour douze places :
       les neuf premières petites places prennent les neuf dessins, chacun une
       fois ; la dixième (la carte mentale) et les deux grandes en reprennent,
       mais JAMAIS DU MÊME CÔTÉ que leur jumeau. AUCUNE GRANDE BOÎTE NE SE
       CONTIENT ELLE-MÊME (`boite4882` s'ouvre à gauche et ne reparaît qu'à
       droite, `boite9554` l'inverse) : se voir sortir de soi se lirait comme
       une panne, pas comme un geste. */
    boites: {
      dossier: IMAGES,

      /* LES TITRES SONT CEUX DES PIÈCES ELLES-MÊMES, relus sur les documents et
         non devinés d'après les noms de fichiers : la loi de 2023 porte son
         intitulé Légifrance, le film D3 « naturalisation » le titre de son
         propre carton, et le texte UNESCO de 1978 est un APPEL de son
         directeur général (Amadou-Mahtar M'Bow), pas une recommandation.

         ⚠️ UNE LIGNE DE BOÎTES = UN DOSSIER. La composition n'est pas
         arbitraire : à gauche, la ligne de TROIS porte les deux pièces du
         dossier D1 et la carte mentale, celle d'UNE la pièce unique de D2,
         celle de QUATRE les quatre pièces de D3 ; à droite, les deux prises C1
         et C2. Ajouter une pièce à un dossier demande donc d'ajouter une boîte
         à SA ligne — sans quoi la pièce n'a nulle part où se ranger. Le code
         (D1…C2) est un repère de rangement : il ne s'affiche nulle part.

         ⚠️ LE TYPE NE S'ÉCRIT PAS, IL SE LIT DE L'EXTENSION (.mp4 → on
         regarde, .mp3 → on écoute, .pdf → on lit) — ou de la clé `carte`,
         qui porte une URL au lieu d'un fichier. Le doubler d'une clé
         `type` serait un second endroit à tenir d'accord avec le fichier.
         Les fichiers `piece` sont cherchés dans ⑩ `fenetre.pieces`. */
      cotes: [
        {
          nom: 'gauche',
          grande: 'boite4882.svg',
          etiquette: 'Ouvrir la boîte d’archives de gauche',
          rangs: [
            [
              { dessin: 'boite20007.svg', code: 'D1', piece: 'd1-loi-restitution-2023.mp4',
                titre: 'Autour de la loi de restitution de 2023' },
              { dessin: 'boite22945.svg', code: 'D1', piece: 'd1-loi-2023-restes-humains.pdf',
                titre: 'Loi du 26 décembre 2023 relative à la restitution de restes humains' },
              /* LA CARTE MENTALE — la même que la bulle « carte » du chapitre 4,
                 cadrée ici sur la section de la restitution. Une URL et non un
                 fichier : c'est `carte` qui le dit, et la fenêtre l'ouvre en
                 cadre intégré. ⚠️ Le droit d'encadrement vit dans l'AUTRE
                 dépôt (soliman-map-v3, `frame-ancestors`) : si le cadre reste
                 vide, c'est là qu'il faut regarder — cf. `map` du chapitre 4.
                 Le dessin (boite20011) est déjà l'une des deux petites de
                 droite : il n'y en a que neuf pour dix places, et c'est le seul
                 qui ne reparaisse pas du même côté. */
              { dessin: 'boite20011.svg', code: 'D1',
                carte: 'https://soliman-map.netlify.app/#tr=circuit&focus=section:b_restit&view=0.056,0.002,1',
                titre: 'Carte mentale — la restitution' },
            ],
            [
              { dessin: 'boite9492.svg', code: 'D2', piece: 'd2-image-du-syrien-fanatique.mp4',
                titre: 'Déconstruire l’image du Syrien fanatique' },
            ],
            [
              { dessin: 'boite22943.svg', code: 'D3', piece: 'd3-noeud-de-douleur.mp4',
                titre: 'Un nœud de douleur' },
              { dessin: 'boite9496.svg', code: 'D3', piece: 'd3-naturalisation.mp4',
                titre: 'La naturalisation française du corps de Soliman al-Halabi' },
              { dessin: 'boite22946.svg', code: 'D3', piece: 'd3-reparation-postcoloniale.mp4',
                titre: 'Réparation post-coloniale' },
              { dessin: 'boite9554.svg', code: 'D3', piece: 'd3-unesco-1978.pdf',
                titre: 'Pour le retour à ceux qui l’ont créé d’un patrimoine culturel irremplaçable' },
            ],
          ],
        },
        {
          nom: 'droite',
          grande: 'boite9554.svg',
          etiquette: 'Ouvrir la boîte d’archives de droite',
          rangs: [
            [
              /* Les deux prises de son ne portent pas de titre à l'écran mais
                 la MENTION de leur témoin, comme les témoignages de la
                 photographie (⑤ `credit` : « C., lycéenne »). Leurs titres de
                 travail : « Rendre Soliman à ses racines » (C1) et « Ses
                 racines » (C2). */
              { dessin: 'boite4882.svg', code: 'C1', piece: 'c1-rendre-soliman-a-ses-racines.mp3',
                titre: 'Témoignage C., lycéenne' },
              { dessin: 'boite20011.svg', code: 'C2', piece: 'c2-ses-racines.mp3',
                titre: 'Témoignage C., lycéenne' },
            ],
          ],
        },
      ],

      /* ── LA PLACE ────────────────────────────────────────────────────────
         ⚠️ RIEN ICI N'EST UN `left: …%`, ET C'EST LA MÊME LEÇON QUE LE MUR :
         la photographie est en `contain`, ses bords ne tombent donc pas à une
         place fixe de l'écran. Le moteur calcule la BANDE LIBRE de chaque
         côté — du bord de la fenêtre (`marge`) au crâne (`garde`) — et y
         centre le groupe. Sur un écran étroit la bande se resserre : les
         boîtes rapetissent plutôt que de mordre sur le crâne ou de sortir du
         cadre. Un jeu de pourcentages calé sur le 16/9 débordait en 4/3. */

      /** Le centre vertical des deux groupes, en % de la hauteur de fenêtre.
          La photographie étant centrée à toute taille, ce chiffre suit son
          milieu quel que soit le format — c'est la seule place qui n'ait pas
          besoin d'être calculée. */
      y: 49,

      /** La garde autour du crâne : demi-largeur réservée au centre, en
          fraction de la LARGEUR RENDUE DE LA PHOTOGRAPHIE (et non de la
          fenêtre — le crâne appartient à l'image, pas à l'écran). Mesuré : le
          crâne occupe 33 % à 69 % de l'image, d'où 0,21 qui laisse un peu
          d'air. */
      garde: 0.21,

      /** Le bord de la fenêtre, en fraction de sa largeur. */
      marge: 0.02,

      /** Tailles, en fraction du plus petit côté de la fenêtre : la LARGEUR
          d'une boîte (sa hauteur suit le dessin, tous n'ont pas le même
          format). Elles rapetissent ensemble quand la bande libre l'exige. */
      taille: 0.21,
      taillePetite: 0.098,

      /** L'écart entre deux colonnes et entre deux lignes, en largeurs de
          petite boîte (1 = elles se touchent). */
      ecart: 1.2,
      interligne: 1.3,

      /** L'épaisseur du trait, en pixels d'écran : elle ne suit PAS l'échelle
          du dessin, sinon les petites boîtes tomberaient à un demi-pixel et
          disparaîtraient. C'est le même parti que les traits d'appel des
          cartels (`vector-effect: non-scaling-stroke`). */
      trait: 1.75,
      traitPetite: 1.25,

      /** L'ARRIVÉE — les deux grandes boîtes s'écrivent pendant que la
          torche s'ouvre. `dessinAt` se compte depuis le lever du noir,
          `decalage` sépare la gauche de la droite — les voir se tracer à
          l'unisson donnerait une machine, pas une main. */
      dessinAt: 1150,
      decalage: 320,
    },
  },

  /* ═════════════════════════════════════════════════════════════════════════
     ⑧  L'INHUMATION — sous-chapitre 3, « Inhumer la dépouille »
     ═════════════════════════════════════════════════════════════════════════
     L'entrée du chapitre 1, rejouée ici. Cliquer le « 3 » éteint la lumière ;
     une torche fixe se rallume sur la vitrine des crânes, SANS flèche ni
     boussole : on ne fait qu'écouter. Quelques secondes plus tard, la voix
     d'Alicia, et un bouton « Passer ». À la fin de la voix (ou au « Passer »),
     la photographie BASCULE sur la vitrine au buste — la nouvelle monte en
     dézoomant pendant que l'ancienne s'éloigne et s'efface, la lumière
     s'élargit — et l'interface revient.

     PUIS, SUR LA VITRINE AU BUSTE, plongée dans une certaine obscurité
     (`obscurite`), une RANGÉE s'écrit devant le buste : quatre tombes et,
     au milieu, un DRAPEAU (voir `tombes`). Chaque tombe ouvre sa pièce dans
     la fenêtre habituelle. Le drapeau, lui, fait disparaître la rangée : la
     planche « L'inhumation symbolique » (`fond`) monte PLEIN ÉCRAN, avec une
     croix pour la refermer, et la seconde voix d'Alicia commence — son
     crédit en bas tant qu'elle parle. La voix finie, tout revient.

     ⚠️ `apres` NE FAIT QUE 794 × 612 px : en plein écran elle est agrandie
     d'un facteur ~1,8 et se voit molle. Une prise plus grande la remplacerait
     sans rien changer d'autre (même nom de fichier) — sauf `photo`, si son
     format change.

     ⚠️ `fond` VIENT D'UN BMP DE 112 Mo (7288 × 5111), ramené à 3200 px en
     JPEG : 0,64 Mo, 46,2 dB de PSNR (Y). Le master est HORS du dépôt
     (`../originaux-chapitre5/`) — il dépasse à lui seul la limite de GitHub.
       ffmpeg -i Inhumation.bmp -vf "scale=3200:-2:flags=lanczos" -q:v 3 chpt-5-P3-inhumation.jpg */
  inhumation: {
    avant: IMAGES + 'chpt-5-P3-cranes.jpg',
    apres: IMAGES + 'chpt-5-P3-vitrine.jpg',
    fond:  IMAGES + 'chpt-5-P3-inhumation.jpg',
    voix:  MEDIAS + 'inhumation-alicia-1.mp3',

    /** LA VITRINE AU BUSTE, EN PIXELS : c'est d'elle que les tombes mesurent
        leur taille. (Le panorama, lui, lit les proportions de chaque image
        sur l'image décodée : rien à tenir d'accord ici.) */
    photo: { width: 794, height: 612 },

    /** LE PANORAMA — la vitrine au buste et la planche DÉBORDENT l'écran,
        sans bande noire, et la main s'y promène : elle à droite, on voit la
        droite de l'image ; elle en bas, le bas. Toute l'image reste
        atteignable (le texte du bas de la planche compris).
          · `debord` — de combien l'image dépasse, au moins, l'écran qu'elle
            couvre (1 = juste couvrante : on ne se promène alors que dans ce
            que la couverture rogne). ⚠️ La vitrine au buste ne fait que
            794 px : chaque point de plus l'agrandit, et la floute d'autant.
          · `suivi` — la douceur avec laquelle elle rejoint la main (par
            image, 0…1 : plus bas, plus lent et plus ample).
        La vitrine des crânes (`avant`), pendant la première voix, reste
        entière et immobile. */
    panorama: { debord: 1.06, suivi: 0.045 },

    /* ── LE PASSAGE ET LA PREMIÈRE VOIX ────────────────────────────────── */

    /** L'extinction, puis le retrait du noir sous la torche encore éteinte —
        la même passation que pour la vitrine. */
    noirMs: 1400,
    leveMs:  400,

    /** La torche : fixe et centrale. `size` pendant la voix, `apres` une fois
        la photographie basculée (elle s'élargit pendant la bascule, comme la
        lumière du chapitre 1 quand l'interface arrive). Fractions de
        min(largeur, hauteur). */
    torche: { size: 0.48, apres: 0.9, growMs: 3000, fadeMs: 1200 },

    /** Le silence avant la voix, compté depuis la torche OUVERTE. */
    voixApresMs: 2000,
    /** Le « Passer » paraît ce temps-là après le début de la voix. */
    passerApresMs: 800,

    /** La bascule d'une photographie à l'autre (et l'élargissement de la
        torche, qui l'accompagne). */
    basculeMs: 2000,

    /* ── LA VITRINE AU BUSTE ───────────────────────────────────────────── */

    /** L'OBSCURITÉ où tombe la vitrine au buste pendant la bascule : un voile
        noir sur la photographie, SOUS la torche (0 = rien, 1 = noir). C'est
        ce qui détache les tombes et le drapeau, blancs, de l'image. La
        planche, elle, s'en DÉFAIT en montant (et de la torche) : on la lit. */
    obscurite: 0.42,

    /** La planche monte sur cette durée quand on ouvre le drapeau — et
        l'obscurité et la torche se retirent à la même vitesse —, et redescend
        sur la même. */
    fondMs: 2400,

    /** Le retour : les tombes se dé-écrivent, la torche s'éteint
        (torche.fadeMs), puis le noir se retire sur la photographie des
        réserves. */
    retourMs: 1400,

    /* ── LES TOMBES ET LE DRAPEAU — le même geste que les boîtes du « 2 » ───
       Même moteur (chp5-boites.js), autre composition : ils s'écrivent à la
       plume dorée et sèchent en blanc. La VITESSE du geste est celle de la
       vitrine (⑨) : ici, seulement la place et le moment.

       ⚠️ UNE RANGÉE OUVERTE D'EMBLÉE. Le côté ne déclare pas de `grande` :
       il n'y a rien à éclater, les cinq dessins s'écrivent dès l'arrivée,
       depuis le MILIEU de la rangée (le drapeau d'abord) vers ses deux bouts.
       (La tombe et le drapeau ont été deux grandes qui s'alternaient ;
       l'auteur a choisi d'ouvrir directement sur les tombes.)

       ⚠️ LA RANGÉE EST DEVANT LE BUSTE, CENTRÉE SUR LA FENÊTRE : chaque
       dessin a sa `place` au repère `'centre'` (le milieu de l'écran), son
       écart `x` en largeurs de tombe, sa hauteur `y` en % de la fenêtre.
       Bornes vérifiées : entre la flèche (bas-gauche) et le plein écran
       (bas-droite), et AU-DESSUS du titre de survol (en bas, à 3,5 %) — plus
       bas, la rangée passerait sous le nom de la pièce qu'on survole.

       ⚠️ LE DRAPEAU EST DANS LA RANGÉE, MAIS IL N'OUVRE PAS LA FENÊTRE. Il
       garde son dessin et son titre, et trois clés lui sont propres :
        · `salut: 'flotter'` — il se DÉPLOIE depuis sa hampe en s'écrivant ;
        · `planche: true` — au clic, les cinq dessins se dé-écrivent, la
          planche (`inhumation.fond`) monte plein écran avec une croix, et
          sa voix (`piece`, dans ⑩ `fenetre.pieces`) se joue sans
          sinusoïde ; finie ou coupée, la planche redescend et la rangée se
          réécrit ;
        · `credit` — ce qui s'écrit en bas pendant que la voix parle.
       Les lettres A à D sont les repères de l'auteur ; comme D1…C2, elles ne
       s'affichent nulle part. */
    tombes: {
      dossier: IMAGES,
      cotes: [
        {
          nom: 'centre',
          rangs: [
            [
              { dessin: 'tombe1.svg', code: 'A', piece: 'a-antigone-creon-cocteau-brecht.mp3',
                titre: 'Antigone et Créon — d’après Cocteau et Brecht',
                place: { cote: 'centre', x: -2.9, y: 75 } },
              { dessin: 'tombe2.svg', code: 'B', piece: 'b-que-faire-du-corps.mp3',
                titre: 'Que faire du corps de Soliman al-Halabi ? — G. et M., lycéens',
                place: { cote: 'centre', x: -1.45, y: 75 } },
              { dessin: 'drapeau1.svg', code: 'Alicia', piece: 'inhumation-alicia-2.mp3',
                titre: 'Inhumer symboliquement le corps de Soliman al-Halabi au musée ?',
                salut: 'flotter', planche: true, credit: 'A., étudiante',
                place: { cote: 'centre', x: 0, y: 75 } },
              { dessin: 'tombe3.svg', code: 'C', piece: 'c-antigone-bauchau.mp3',
                titre: 'Monologue d’Antigone — Henry Bauchau, par L., citoyenne',
                place: { cote: 'centre', x: 1.45, y: 75 } },
              { dessin: 'tombe4.svg', code: 'D', piece: 'd-un-tombeau-pour-soliman.mp4',
                titre: 'Un tombeau pour Soliman al-Halabi — Marie-Jeanne',
                place: { cote: 'centre', x: 2.9, y: 75 } },
            ],
          ],
        },
      ],

      /** Le centre de la rangée : c'est de là que l'écriture part. */
      y: 75,
      /** La taille d'une tombe (en fraction du plus petit côté), bornée par la
          bande libre du bord de la fenêtre (`marge`) au buste (`garde`) —
          elle rapetisse sur un écran étroit plutôt que de sortir du cadre. */
      garde: 0.33,
      marge: 0.03,
      taillePetite: 0.13,
      traitPetite: 1.3,

      /** L'ARRIVÉE — depuis la fin de la bascule : la flèche vient de
          revenir. */
      dessinAt: 350,
    },
  },

  /* ═════════════════════════════════════════════════════════════════════════
     ⑨  LE GESTE DES DESSINS — commun à la vitrine et à l'inhumation
     ═════════════════════════════════════════════════════════════════════════
     Les boîtes d'archive (⑦) et la tombe et le drapeau (⑧) s'écrivent,
     s'ouvrent, s'envolent et s'effacent à la MÊME vitesse : c'est un seul
     geste, et une tombe doit s'ouvrir comme une boîte s'ouvre. Changer un
     chiffre ici change donc les deux lieux — c'est voulu. (Le MOMENT où
     chaque lieu commence, lui, est dans sa composition : `dessinAt`,
     `decalage`.) */
  geste: {
    /* ── L'ÉCRITURE ──────────────────────────────────────────────────────
       La plume est DORÉE, l'encre sèche en blanc. Du plus grand tracé au
       plus petit : la silhouette d'abord, le détail dessus. */
    dessinMs: 1600,
    encreMs: 420,
    sechageMs: 900,

    /* ── L'ÉCLATEMENT ────────────────────────────────────────────────────
       Au clic : la grande se tend, se dé-dessine à rebours et se referme sur
       elle-même ; une onde part de son centre ; chaque petite s'élance quand
       l'onde la touche, et s'écrit en chemin. (Le REPLI de l'alternance, à
       l'inhumation, joue ces mêmes durées à rebours.) */
    tensionMs: 130,
    retraitMs: 560,
    ondeAt: 300,
    ondeMs: 940,

    /** ⚠️ `volAt` DOIT TOMBER AVANT LA FIN DU RETRAIT. Les petites sortent de
        DESSOUS la grande pendant qu'elle se referme : réglé plus tard, on
        voyait la grande disparaître, puis un temps mort de trois dixièmes de
        seconde sur un écran vide, puis les petites arriver — trois gestes au
        lieu d'un. Ici la grande est encore à mi-chemin (130 + 560) quand la
        première s'élance (130 + 240). */
    volAt: 240,
    volEtalement: 380,
    volMs: 1180,
    petiteDessinMs: 880,

    /* ── LA SORTIE ───────────────────────────────────────────────────────
       On quitte le sous-chapitre : les dessins s'EFFACENT comme ils se sont
       écrits, à rebours et des plus lointains aux plus proches du centre,
       AVANT que la torche ne s'éteigne. Sans ce geste ils restaient blancs
       et pleins pendant que la photographie tombait dans le noir derrière
       eux — un décor qu'on emporte, pas un lieu qu'on quitte.
       ⚠️ ET L'INVENTAIRE SE REFERME : on retrouve les grandes en revenant.
       C'est la sortie qui les rend, pas un oubli. */
    sortieMs: 560,
    sortieEtalement: 300,
  },

  /* ═════════════════════════════════════════════════════════════════════════
     ⑩  LA FENÊTRE DES PIÈCES — ce qu'une boîte ou une tombe ouvre
     ═════════════════════════════════════════════════════════════════════════
     Au milieu de l'écran, un rectangle BLANC se trace, et la pièce n'apparaît
     que dedans ; son titre dessous, une croix en haut à droite. C'est la
     fenêtre du chapitre 3 et le geste des documents de la phrénologie, au
     vocabulaire de celui-ci. La même pour la vitrine et pour l'inhumation. */
  fenetre: {
    /** Le dossier des PIÈCES — vidéos, prises de son et textes. (Les
        dessins, eux, sont dans le `dossier` de chaque composition.) */
    pieces: MEDIAS,

    /** Le noir qui passe sur le lieu pendant qu'on regarde : la torche et la
        photographie restent derrière, on ne les efface pas. */
    voile: 0.88,

    /* ── LA TAILLE DU CADRE, PAR GENRE — en % de la fenêtre ────────────── */

    /** UNE VIDÉO : ce que le cadre ne dépassera pas. Elle garde SON format
        — c'est la plus serrée des deux bornes qui décide. */
    largeur: 74,
    hauteur: 76,

    /** UN TEXTE se lit : il prend la largeur, et presque toute la hauteur
        (il défile dans le lecteur du navigateur). ⚠️ Borné au format A4,
        il ne faisait que 440 px de large en 16/9 : la loi ne se lisait pas. */
    largeurTexte: 62,
    /* ⚠️ PAS PLUS HAUT : LA COLONNE DE TITRES PASSE DEVANT. Le cadre étant
       centré, sa hauteur décide de son bord supérieur ; le bloc haut-gauche
       descend jusqu'à 12 % de la fenêtre (mesuré pour la porte), et un
       titre doré sur une page blanche ne se lit plus. À 80 %, le cadre
       passait sous le sous-titre. */
    hauteurTexte: 68,

    /** LA CARTE MENTALE : grande, comme la pop-up du chapitre 4, mais
        bornée en hauteur pour rester SOUS la colonne de titres (même règle
        que les textes). */
    largeurCarte: 88,
    hauteurCarte: 70,

    /** UNE PRISE DE SON : un bandeau, comme le lecteur du chapitre 1 — le
        bouton à gauche, la sinusoïde à droite. Largeur en %, et rapport
        largeur / hauteur. */
    largeurSon: 50,
    rapportSon: 4.2,

    /* ── LA CADENCE ────────────────────────────────────────────────────── */
    ouvreMs: 620,
    fermeMs: 420,
    /** Le trait blanc du cadre ; la pièce paraît quand il a fait `revele` de
        son tour (0,7 : les sept dixièmes, comme les documents de la
        phrénologie). Une prise de son se lance à ce même instant. */
    traceMs: 900,
    revele: 0.7,
  },

  /* ═════════════════════════════════════════════════════════════════════════
     ⑪  L'AMBIANCE SONORE — une bande-son par lieu, et ses silences
     ═════════════════════════════════════════════════════════════════════════
     La photographie a la sienne, chaque sous-chapitre la sienne. À l'entrée
     du chapitre, un LONG SILENCE, puis celle de la photographie monte. Tout
     ce qui passe au premier plan en parlant l'éteint jusqu'au silence, et
     elle revient quand il se retire, là où on l'avait laissée :
       · un témoignage qu'on écoute (un témoignage en pause ne compte plus) ;
       · une pièce qui a un son — prise de son ou film (un texte, la carte
         mentale : on lit, l'ambiance reste) ;
       · la voix d'Alicia à l'entrée du « 3 », et la planche du drapeau ;
       · tout PASSAGE d'un lieu à l'autre : la bande-son du lieu qu'on quitte
         s'éteint au clic, celle du lieu suivant ne monte qu'à l'ARRIVÉE.
     Quitter le chapitre l'éteint au rythme du fondu au noir (② `exitMs`).
     Moteur : chp5-ambiance.js — c'est le moteur du chapitre qui lui dit, à
     chaque changement de premier plan, ce qu'on doit entendre.

     ⚠️ LES CLÉS DE `pistes` SONT LES NOMS DES LIEUX (⑤ `sousChapitres[].lieu`)
     — plus `ouverture`, la photographie. Un lieu sans piste se joue en
     silence, en le disant en console. */
  ambiance: {
    /** `volume` — le gain de chaque piste (1 = le fichier tel quel ; au-delà,
        on l'amplifie). Les quatre fichiers ne sont pas mixés au même niveau
        (de −20 à −33 dB en moyenne) : ces gains les ramènent ensemble autour
        de −30 dB, le niveau des boucles du site (musée, espace
        collaboratif, chapitre 2). Celle du « 3 » est la plus douce — d'où 1,4. */
    pistes: {
      ouverture:  { src: MEDIAS + 'ambiance-ouverture.mp3',  volume: 0.25 },
      porte:      { src: MEDIAS + 'ambiance-porte.mp3',      volume: 0.5 },
      vitrine:    { src: MEDIAS + 'ambiance-vitrine.mp3',    volume: 0.45 },
      inhumation: { src: MEDIAS + 'ambiance-inhumation.mp3', volume: 1.4 },
    },

    /** LE LONG SILENCE de l'entrée, compté depuis la levée du rideau
        (l'introduction dure ~5,5 s : la photographie s'installe d'abord
        sans un son). Puis le premier fondu, plus lent que les autres. */
    silenceMs: 9000,
    premiereEntreeMs: 9000,

    /** Les fondus ordinaires : la bande-son qui revient (un témoignage
        fini, une pièce refermée, l'arrivée dans un lieu) et celle qui
        s'éteint (on ouvre un média, on part vers un lieu). La sortie est
        plus courte : une voix ne doit pas commencer sous la musique. */
    entreeMs: 4500,
    sortieMs: 1200,

    /** Les fichiers ne bouclent pas d'eux-mêmes (ils commencent sur un
        souffle et finissent en fondu) : chaque tour CHEVAUCHE le précédent
        de ce temps-là, l'un montant pendant que l'autre s'éteint. */
    croiseMs: 3000,
  },
};
