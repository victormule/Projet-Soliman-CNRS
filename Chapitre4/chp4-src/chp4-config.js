/**
 * chp4-config.js — RÉGLAGES DU CHAPITRE 4 (source unique)
 * ─────────────────────────────────────────────────────────────────────────────
 * « Une histoire complexe » — la page blanche, le crâne, la fracture et les cinq
 * bulles qui en sortent.
 *
 * RÈGLE DU PROJET (audit de juillet 2026, cf. CLAUDE.md) : tout ce qui est ici
 * est LU, et lu d'un seul endroit. Aucun repli dans le JS ou le CSS ne double un
 * chiffre de ce fichier. Si une clé disparaît, le moteur le DIT en console — il
 * ne fait pas semblant. Un réglage qui n'agit pas n'a rien à faire ici.
 *
 * DONNÉES PURES, AUCUN EFFET DE BORD : ce module est importé STATIQUEMENT par
 * Chapitre4Scene (elle a besoin du sous-titre AVANT de charger le moteur, pour
 * meubler le chargement). Seul chp4-opening.js — le moteur — est en import()
 * dynamique, comme aux chapitres 2 et 3.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CHRONOLOGIE DU DESSIN (ms depuis le lever du rideau)
 *
 *      0 ─── noir. Le rideau vient de se lever, la scène retient son souffle.
 *    400 ─┬─ LA LUMIÈRE MONTE : le noir devient page blanche (dawn).
 *   2200 ─┴─ page nue.
 *   2200 ─┬─ LE CRÂNE paraît, en fondu, et se pose (léger recadrage).
 *   3600 ─┘
 *   3400 ─┬─ LA FRACTURE se propage depuis sa pointe haute.
 *   6000 ─┘
 *   5900 ─── LES BULLES, une par une (queue → contour → remplissage → mot).
 *  ≈11900 ── tout est dessiné : la flèche de sortie paraît, le dessin respire,
 *            les bulles deviennent cliquables.
 *
 * Chaque durée ci-dessous est un maillon de cette chaîne : allonger `dawn.hold`
 * décale tout le reste d'autant (les instants sont RELATIFS, enchaînés).
 * ═════════════════════════════════════════════════════════════════════════════
 */

export const CONFIG = {

  /* ══════════════════════════════════════════════════════════════════
     IDENTITÉ — ce que le site affiche autour du chapitre
     ══════════════════════════════════════════════════════════════════ */

  /* Sous-titre (tier 2), sous « Espace collaboratif », en haut à gauche.
     ⚠️ PROVISOIRE — à remplacer par le titre définitif du chapitre. */
  subtitle: 'Une histoire complexe',

  /* Chemins des deux pièces du chapitre, DEPUIS LA RACINE DU SITE.
     Déclarés ici parce qu'ils ont deux lecteurs : la scène (qui pose la photo
     dans le DOM et attend son décodage avant de lever le rideau) et le moteur
     (qui va chercher l'œuvre). Deux lecteurs, une seule écriture. */
  assets: {
    photo:   'Chapitre4/chp4-images/LeCrane.jpg',
    artwork: 'Chapitre4/chp4-images/chapitre4.svg',
  },

  /* ══════════════════════════════════════════════════════════════════
     MISE EN PAGE — le crâne à gauche, le dessin à droite
     ──────────────────────────────────────────────────────────────────
     Les deux se CHEVAUCHENT : le dessin commence AVANT que la photo ne
     finisse (`overlap_pct`). Le dégradé de la photo passe donc sous la
     marge gauche du dessin — c'est ce recouvrement qui fait fondre la
     photographie dans le papier au lieu de la couper net.

     LA RÉPARTITION SUIT LA FORME DE LA FENÊTRE. Sur un écran large, la
     photo tient la moitié gauche et le dessin est à l'aise. Sur une
     fenêtre resserrée, la même répartition étranglerait le dessin (il
     s'ajuste à la largeur disponible et laisse alors d'immenses vides en
     haut et en bas). La photo lui cède donc du terrain à mesure que la
     fenêtre se referme — interpolation continue entre les deux jeux de
     valeurs ci-dessous, recalculée à chaque redimensionnement.
     ══════════════════════════════════════════════════════════════════ */

  layout: {
    /* Les deux régimes, et les proportions d'écran où ils s'appliquent.
       Entre les deux, tout est interpolé ; au-delà, tout est borné. */
    wide_aspect:      1.70,   // 16:9 et plus large → régime « large »
    photo_wide_pct:     52,   // largeur de la bande photo, en régime large
    narrow_aspect:    1.05,   // presque carré → régime « resserré »
    photo_narrow_pct:   36,   // la photo se retire pour laisser voir le dessin

    overlap_pct:         6,   // de combien le dessin mord sur la photo
    inset_pct:           4,   // marge du dessin (% de la HAUTEUR d'écran)

    /* Cadrage de la photo dans sa bande (object-position CSS).
       La photo est un 3:2 paysage, la bande est presque carrée : on ne voit
       qu'environ 60 % de sa largeur. Ces deux valeurs choisissent LAQUELLE. */
    photo_focus_x:    54,     // %  0 = bord gauche, 100 = bord droit
    photo_focus_y:    48,     // %  0 = haut,        100 = bas
    /* Sur-cadrage. Il a un SECOND rôle, essentiel : il donne à l'image du
       mou sous le cadre, pour que la parallaxe puisse la déplacer sans
       jamais découvrir le vide au bord. Ne pas descendre sous ~1.04. */
    photo_scale:    1.07,

    /* Le dégradé qui noie la photo dans la page.
       Trois arrêts, en % de la largeur de la bande photo : jusqu'à `veil_from`
       la photo est intacte, à `veil_full` il ne reste que du papier. */
    veil_from:        24,
    veil_mid:         50,
    veil_full:        84,
  },

  /* ══════════════════════════════════════════════════════════════════
     LA PROFONDEUR DE LA PAGE
     ──────────────────────────────────────────────────────────────────
     Un aplat blanc est plat, et le reste quoi qu'on dessine dessus. Ces
     deux voiles très faibles donnent au papier une matière et une lumière :
     on ne les remarque pas, on les ressent. Mettre les deux à 0 rend
     l'aplat nu — et l'écran redevient un écran.
     ══════════════════════════════════════════════════════════════════ */

  depth: {
    vignette:        0.13,   // assombrissement des bords (0 = aucun)
    vignette_start:    46,   // % du rayon où l'ombre commence
    grain:          0.045,   // grain du papier (0 = lisse)
    grain_size:       190,   // px — taille de la tuile de bruit
  },

  /* ══════════════════════════════════════════════════════════════════
     PALETTE — encre sur papier
     ──────────────────────────────────────────────────────────────────
     Le chapitre 4 est le SEUL écran clair du site. Ces couleurs sont
     reprises telles quelles par le CSS (variables --chp4-*), par les
     remplissages du dessin ET par la flèche de sortie (qui, en blanc,
     serait invisible ici).
     ══════════════════════════════════════════════════════════════════ */

  palette: {
    paper:      '#f7f5f1',   // le papier — fond de page ET remplissage du masque
    ink:        '#14110e',   // l'encre — fissure, nuages pleins, contours
    grey:       '#6b6b6b',   // le nuage « pluralité » (gris de l'original)
    label_light:'#f7f5f1',   // lettres sur nuage sombre
    label_dark: '#14110e',   // lettres sur nuage évidé
    accent:     '#b0842a',   // or sombre — progression de lecture, survol
    accent_soft:'rgba(176,132,42,0.16)',
  },

  /* ══════════════════════════════════════════════════════════════════
     TYPOGRAPHIE DES BULLES
     ──────────────────────────────────────────────────────────────────
     L'export Illustrator compose en « EdgesRegular », police absente du
     projet : les libellés sont donc RE-COMPOSÉS ici, en Roboto Condensed
     (déjà chargée par index.html). Les tailles reprennent celles de
     l'original (48 px, 36 px pour la pluralité) dans le repère de l'œuvre.
     ⚠️ L'orthographe est celle du DESSIN (sans accents sur PLURALITE et
     DIGNITE, comme tracé). Les accents s'ajoutent ici sans autre effet.
     ══════════════════════════════════════════════════════════════════ */

  type: {
    family:      "'Roboto Condensed', 'Arial Narrow', sans-serif",
    weight:      700,
    line_height: 1.12,        // × la taille de police
    tracking:    '0.015em',
    /* Si un libellé dépasse cette fraction de la largeur de sa bulle, sa
       taille est réduite jusqu'à tenir (mesure réelle, pas estimation). */
    max_width_ratio: 0.74,
    /* Cadence d'écriture : une lettre toutes les `letter_step` ms. */
    letter_step: 34,
    letter_fade: 260,
  },

  /* ══════════════════════════════════════════════════════════════════
     CHRONOLOGIE — le dessin se fait
     ══════════════════════════════════════════════════════════════════ */

  /* 1. La lumière se rallume : le noir devient page blanche. */
  dawn: {
    hold:      700,   // noir tenu avant que la lumière ne monte
    duration: 2400,   // montée du noir au papier — lente, on entre quelque part
    /* La lumière monte du CENTRE : un halo blanc s'ouvre avant que le fond
       ne blanchisse tout à fait — l'ampoule au-dessus de la feuille. */
    bloom_from: 18,   // % — rayon de départ du halo
    bloom_to:  140,   // % — rayon final (dépasse l'écran)
  },

  /* 2. Le crâne paraît. */
  photo: {
    delay:     200,   // après la fin du dawn
    duration: 1900,
    settle:   0.035,  // sur-échelle initiale qui se résorbe (0 = aucune)
  },

  /* 3. La fracture se propage — LE MOMENT DU CHAPITRE.
        Elle part du CŒUR de l'étoile et gagne ses trois extrémités à la fois,
        lentement, en tremblant : ce n'est pas un trait qu'on dessine, c'est un
        os qui cède. Voir `propagate()` dans chp4-draw.js. */
  fissure: {
    delay:    1200,   // après le DÉBUT du fondu photo
    duration: 5200,   // long : on doit avoir le temps de la sentir venir

    /* Le point de rupture et la portée du disque ne sont PAS ici : ce sont des
       propriétés mesurées de l'œuvre, pas des réglages (chp4-manifest.js →
       FISSURE). On ne garde ici que la petite marge de sécurité appliquée à
       la portée déclarée. */
    reach_margin: 1.02,

    /* Douceur du front qui avance (fraction du rayon) : 0 = coupure nette,
       0.2 = l'encre se devine avant de se poser. */
    softness: 0.11,

    /* L'AVANCÉE EST IRRÉGULIÈRE. Une fêlure ne progresse pas à vitesse
       constante : elle bute, puis cède. Fraction du rayon dont le front peut
       prendre de l'avance ou du retard. 0 = avancée lisse.
       ⚠️ À GARDER TRÈS BAS : au-delà de ~0.03, on ne lit plus une hésitation,
       on lit une animation qui saute. */
    stutter:  0.018,

    /* LE TREMBLEMENT de la rupture : au premier instant, toute la page
       encaisse le choc — le dessin ET la photographie, qui prend la moitié —
       puis se rassoit. C'est ce qu'on ressent.
       Amplitude en PIXELS d'écran, deux fréquences (Hz) battant l'une contre
       l'autre pour éviter le ronronnement, et une enveloppe qui éteint tout
       bien avant la fin de la propagation : le choc est un instant, la fêlure
       est un processus. 0 = aucun tremblement. */
    tremor_amp:  4.5,
    tremor_hz_a:   11,
    tremor_hz_b: 17.5,
    tremor_ms:   1400,
  },

  /* 4. Les bulles, une par une. */
  bubbles_timing: {
    /* Ordre d'apparition — le tour du dessin, la carte pour finir. */
    sequence:   ['mots', 'pluralite', 'miroir', 'dignite', 'carte'],
    start_after: -400,  // après la fin de la fissure (négatif = chevauche)
    gap:         1050,  // d'un DÉBUT de bulle au suivant
    tail_step:    165,  // entre deux petites bulles de la queue
    tail_pop:     360,  // durée d'apparition d'une petite bulle
    trace:       1250,  // tracé du contour du nuage
    fill:         480,  // remplissage du nuage (après le tracé)
    label_delay:  140,  // après le début du remplissage
    inset_fade:  1100,  // apparition de l'image encastrée (bulle « carte »)
  },

  /* 5. Une fois tout dessiné. */
  outro: {
    arrow_delay: 600,   // avant que la flèche de sortie ne paraisse
    live_delay:  200,   // avant que le dessin ne se mette à respirer
  },

  /* ══════════════════════════════════════════════════════════════════
     6. LA SORTIE — le chapitre se défait avant de s'éteindre
     ──────────────────────────────────────────────────────────────────
     L'entrée est une lumière qui monte sur une page qui se dessine ; la
     sortie en est l'exact reflet. Les bulles s'effacent dans l'ordre
     inverse de leur venue, la fracture se REFERME sur son cœur — même
     mécanique qu'à l'aller, jouée à l'envers —, puis la lumière tombe et
     rend le noir que le site attend entre deux scènes.

     ⚠️ Le clic sur la flèche consomme déjà ~400 ms (sa dissolution dorée)
     avant que cette séquence ne commence. En tenir compte avant de
     l'allonger.
     ══════════════════════════════════════════════════════════════════ */

  exit: {
    bubble_fade:     460,   // effacement d'une bulle
    bubble_stagger:  100,   // entre deux bulles (ordre inverse du dessin)
    fissure_delay:   240,   // après le départ des bulles
    fissure_close:  1150,   // la fracture se referme sur son cœur
    photo_fade:      900,   // le crâne se retire
    dusk_delay:      360,   // après le début de la fermeture
    dusk:            950,   // la lumière tombe : papier → noir
  },

  /* ══════════════════════════════════════════════════════════════════
     LA VIE DU DESSIN — après le tracé, rien ne se fige
     ══════════════════════════════════════════════════════════════════ */

  live: {
    /* Respiration : chaque bulle dérive sur sa propre période, jamais en
       phase avec ses voisines (le moteur décale chacune). */
    breath_min:  7.5,   // s — période la plus courte
    breath_max: 11.5,   // s — la plus longue
    breath_amp:  0.45,  // % d'échelle (0.45 = ±0.45 %)
    breath_shift: 3.2,  // unités de l'œuvre — amplitude de la dérive

    /* La fracture frémit : opacité qui respire très lentement. */
    fissure_period: 14,     // s
    fissure_amp:    0.055,  // 0 = fixe

    /* Parallaxe au pointeur : le dessin et la photo glissent en sens
       inverse — quelques pixels suffisent à donner de la profondeur.
       0 désactive complètement (et le moteur ne pose alors aucune boucle). */
    parallax_art:   9,      // px, amplitude maximale
    parallax_photo: 5,      // px, sens inverse
    parallax_ease:  0.06,   // 0→1 : inertie du suivi (bas = plus paresseux)
  },

  /* ══════════════════════════════════════════════════════════════════
     SURVOL & ÉCOUTE
     ══════════════════════════════════════════════════════════════════ */

  hover: {
    scale:      1.035,
    lift:       -4,     // unités de l'œuvre — la bulle monte un peu
    duration:   380,
    /* Onde dans la queue : les petites bulles se réveillent l'une après
       l'autre, de la fissure vers le nuage. */
    tail_ripple: 90,    // ms entre deux petites bulles
    /* Glyphe d'invite (▶ pour un son, ↗ pour la carte) au bas de la bulle. */
    glyph_size: 34,     // unités de l'œuvre
    glyph_gap:  14,     // sous le bord bas de la bulle
  },

  /* ══════════════════════════════════════════════════════════════════
     L'ÉCOUTE
     ──────────────────────────────────────────────────────────────────
     UN SEUL SIGNE, et il est porté par la bulle elle-même : son POURTOUR
     s'allume et se referme à mesure que le son avance, en respirant au
     rythme de la voix. Rien à l'intérieur — le mot reste seul.
     (Il y avait ici des lignes ondulantes façon oscilloscope : elles
     disaient « lecteur audio » quand tout le reste dit « dessin ». Elles
     ont été retirées ; ne pas les remettre.)
     ══════════════════════════════════════════════════════════════════ */

  listen: {
    /* Les autres bulles s'effacent pendant l'écoute (1 = elles restent). */
    dim_others:  0.22,
    dim_duration: 620,
    /* La bulle écoutée grandit un peu plus qu'au survol. */
    scale:       1.055,

    /* Le pourtour de progression : c'est LUI, le témoin de lecture. */
    progress_width: 3.2,    // unités de l'œuvre — épaisseur au repos
    /* Épaisseur et éclat suivent la voix : au plus fort, le trait vaut
       `progress_width × (1 + progress_swell)`. 0 = trait constant. */
    progress_swell: 0.85,
    /* Halo autour du trait, en unités de l'œuvre : de `glow_min` dans les
       silences à `glow_max` sur les crêtes. C'est ce battement qu'on voit
       respirer. */
    glow_min:       2,
    glow_max:      11,
    /* Amplitude PLANCHER (fraction) : ce qui bat encore dans un silence de
       la bande. Sans lui, une voix qui reprend son souffle fige le trait et
       la bulle a l'air en panne. */
    idle:         0.26,
    /* Repli si l'analyse Web Audio échoue : le trait respire quand même, sur
       une amplitude simulée. Jamais de bulle inerte pendant la lecture. */
    fallback_amp: 0.45,

    /* Fondus de la lecture. */
    fade_in:    320,
    fade_out:   520,
    volume:     1.0,
  },

  /* ══════════════════════════════════════════════════════════════════
     CONTENU DES BULLES
     ──────────────────────────────────────────────────────────────────
     `id` fait la jonction avec chp4-manifest.js (qui dit OÙ est la bulle).
     Ici on dit CE QU'ELLE PORTE.
       lines  : le libellé, ligne à ligne, tel qu'il est tracé
       size   : taille de police dans le repère de l'œuvre
       nudge  : décalage [x, y] par rapport au centre de la bulle — les
                nuages ne sont pas symétriques, le mot doit tomber juste
       media  : le son que la bulle ouvre (chemin depuis la racine du site)
       action : 'audio' (défaut) ou 'map' (ouvre la carte en pop-up)
     ══════════════════════════════════════════════════════════════════ */

  bubbles: {
    mots: {
      lines: ['des', 'MOTS'],
      size:  48,
      nudge: [0, -4],
      media: 'Chapitre4/chp4-medias/les_mots.mp3',
    },
    pluralite: {
      lines: ['La PLURALITE', 'DES ACTEURS'],
      size:  36,
      nudge: [-12, 4],
      media: 'Chapitre4/chp4-medias/pluralite.mp3',
    },
    miroir: {
      lines: ['Un', 'MIROIR'],
      size:  48,
      nudge: [0, -6],
      media: 'Chapitre4/chp4-medias/un_miroir.mp3',
    },
    dignite: {
      lines: ['LA', 'DIGNITE'],
      size:  48,
      nudge: [0, -14],
      media: 'Chapitre4/chp4-medias/la_dignite.mp3',
    },
    carte: {
      /* Bulle-image : pas de libellé, la capture d'écran encastrée tient lieu
         de mot. Elle ouvre la carte interactive. */
      lines:  [],
      action: 'map',
    },
  },

  /* ══════════════════════════════════════════════════════════════════
     LA CARTE — pop-up interne
     ──────────────────────────────────────────────────────────────────
     ⚠️ soliman-map.netlify.app répond aujourd'hui « X-Frame-Options:
     SAMEORIGIN » : tant que cet en-tête est là, AUCUN navigateur n'affichera
     la carte dans notre cadre — il montrera un cadre vide. Pour l'autoriser,
     déposer à la racine du site de la carte un fichier `_headers` :

         /*
           X-Frame-Options: ALLOWALL
           Content-Security-Policy: frame-ancestors 'self' https://<notre-domaine>

     (ou l'équivalent dans netlify.toml). En attendant, `fallback_after` fait
     paraître une invite « ouvrir dans un nouvel onglet » sous le cadre : la
     carte reste atteignable, jamais d'impasse.
     ══════════════════════════════════════════════════════════════════ */

  map: {
    url: 'https://soliman-map.netlify.app/#tr=circuit&ax=regard&focus=section:b_integ&view=0.325,0.068,0.692',
    title: 'La carte du regard',
    /* Taille du panneau, en % du viewport. */
    width_pct:  92,
    height_pct: 88,
    open_duration:  520,
    close_duration: 380,
    /* Délai (ms) avant d'afficher l'invite « ouvrir dans un nouvel onglet ».
       0 = jamais. Garde-fou tant que l'en-tête ci-dessus n'est pas corrigé. */
    fallback_after: 2600,
  },
};

export default CONFIG;
