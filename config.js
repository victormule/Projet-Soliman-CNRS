/* ╔══════════════════════════════════════════════════════════════════╗
   ║                                                                  ║
   ║                     C O N F I G U R A T I O N                    ║ 
   ║                                                                  ║
   ╚══════════════════════════════════════════════════════════════════╝ */

window.CONFIG = {


/* ══════════════════════════════════════════════════════════════════
   VITRINE
   ──────────────────────────────────────────────────────────────────
   CHRONOLOGIE (depuis enter()) :

   ══════════════════════════════════════════════════════════════════ */

  VITRINE: {

    torch: {
      size:              0.65,   // Fraction de min(W,H) — torche large et enveloppante
      grow_duration:    15000,   // Allumage très lent et progressif (ms)
      fade_out_duration: 1500,   // Extinction en sortie (ms)
    },

    arrow: {
      // Délai ABSOLU depuis le début de enter()
      // La torche est déjà bien amorcée avant que la flèche apparaisse
      appear_at:        5000,   // ms
      draw_duration:    2100,   // Durée animation SVG cercle + flèche (ms)
      hide_duration:     400,   // Fondu disparition (ms)
    },

    timing: {
      bg_fade_in:         1200,  // Révélation fond (ms)
      pause_before_torch:  400,  // Pause après fond avant torche (ms)
      exit_black_pause:    10,  // Pause noir en fin de exit (ms)
    },
  },


/* ══════════════════════════════════════════════════════════════════
   PHRENOLOGIE
   ──────────────────────────────────────────────────────────────────
   CHRONOLOGIE (depuis enter()) :

   ══════════════════════════════════════════════════════════════════ */

  PHRENOLOGIE: {

    torch: {
      size:              0.34,   // Fraction de min(W,H) — torche intime, centrée sur le sujet
      grow_duration:     3000,
      fade_out_duration: 1400,
    },

    arrow: {
      // Flèche en HAUT, centrée sur X
      // Apparaît après que la torche soit suffisamment visible
      appear_at:        5500,   // ms depuis enter()
      draw_duration:    2200,   // Durée animation SVG (ms)
      hide_duration:     400,

      // ── POSITION VERTICALE ────────────────────────────────────────────
      // Marge depuis le haut, en fraction de min(largeur, hauteur) du viewport.
      // PLUS PETIT = FLÈCHE PLUS HAUTE.   0.05 = ancienne valeur
      //   0.05 → basse   ·   0.035 → actuelle   ·   0.02 → très haute
      margin_pct:       0.035,
    },

    docs: {
      // Boutons documents — coin haut-droit
      appear_at:        6000,   // ms depuis enter() — régler ici indépendamment

      // Dimensions
      width_vw:           16,   // Largeur (% viewport width)
      height_vh:           7,   // Hauteur (% viewport height)
      width_min:         120,
      width_max:         280,
      height_min:         36,
      height_max:         90,

      // Position
      right_pct:         3.5,   // Distance bord droit (%)
      top_pct:           3.2,   // Distance haut (%)
      gap_vh:            1.8,   // Espacement entre boutons (% vh)

      // Animation
      draw_duration:     850,   // Dessin SVG de chaque bouton (ms)
      hide_duration:     600,

      // ── Réglage de l'AFFICHAGE des documents (overlay) ─────────────────
      // Ces valeurs pilotent la place occupée par les documents et le texte
      // « À Propos » dans l'overlay. Faciles à ajuster sans toucher au CSS.
      overlay: {
        doc_max_frac_h:  0.95,  // hauteur max d'un document = fraction de la zone
        doc_max_frac_w:  1.00,  // largeur max d'un document = fraction de la zone
        margin_v_vh:     18,    // marge haute ET basse de l'overlay (% vh)
        about_max_frac:  1.00,  // largeur max du texte « À Propos » (fraction zone)
        about_min_px:    12,    // taille de police mini du texte (px)
        about_max_px:    32,    // taille de police maxi du texte (px)

        // ── LOUPE (cercle de zoom, documents 1 & 2 uniquement) ────────────
        // Tailles exprimées en fraction de min(largeur, hauteur) du viewport :
        // la loupe garde ainsi une proportion cohérente sur tout écran.
        loupe_idle_frac: 0.045, // Ø du cercle indicateur hors image (frac vp)
        loupe_zoom_frac: 0.35,  // Ø de la loupe au survol d'une image (frac vp)
        loupe_zoom:      2.5,   // force du grossissement (×)
        loupe_idle_min:  30,    // garde-fous px (petit écran)
        loupe_idle_max:  60,
        loupe_zoom_min:  130,
        loupe_zoom_max:  260,

        // Décalage VERTICAL de la loupe au-dessus du doigt sur écran tactile,
        // en fraction du Ø de la loupe (0 = centrée sur le doigt, 0.9 = juste
        // au-dessus). Évite que le doigt masque la zone grossie.
        loupe_touch_offset: 0.85,
      },

      // ── Bouton « À Propos » ────────────────────────────────────────────
      // Placé AU-DESSUS de la colonne des documents, même gabarit et même
      // animation de tracé SVG, séparé par un espacement plus généreux.
      about_label:  'À Propos',
      about_gap_vh: 5.0,   // espacement sous « À Propos » (% vh), > gap_vh

      // Contenu — chaque action est une clé de CONFIG.DOCUMENTS
      labels:  ['Un jugement', 'Un catalogue de musée', 'Un court-métrage', 'Une lettre au Président de la république'],
      actions: ['doc-1', 'doc-2', 'doc-3', 'doc-4'],
    },

    navbar: {
      // Barre navigation — bas de l'écran
      appear_at:        7000,   // ms depuis enter() — régler ici indépendamment

      // Layout
      width:            0.90,   // Fraction largeur écran (plafond absolu)
      cell_width:       0.28,   // Largeur idéale d'UNE cellule (fraction vW).
                                // La barre vaut min(width·vW, N·cell_width·vW) :
                                // en passant de 3 à 2 boutons elle se resserre au
                                // lieu d'étirer démesurément chaque cellule.
      bottom:           0.05,   // Position bas (fraction hauteur)
      height:           0.08,   // Hauteur (fraction hauteur)

      // Style SVG
      stroke_color:     'rgba(255,255,255,0.80)',
      stroke_width:      0.8,
      draw_speed:        1.4,   // Vitesse dessin rectangle (s)
      sep_speed:         0.5,   // Vitesse séparateurs (s)
      sep_delay:         0.3,   // Décalage entre séparateurs (s)
      text_delay:        0.25,  // Décalage texte (s)
      text_fade:         0.4,   // Fondu texte (s)

      // Couleurs
      btn_font:          'Cinzel, serif',
      btn_color:         'rgba(255,255,255,0.85)',
      btn_color_hover:   'rgba(255,220,120,1)',
      btn_letter_spacing:'0.18em',

      // Contenu
      // « À Propos » a migré dans la colonne des boutons documents.
      labels:  ['Carnet de Recherche', 'Collaboration avec de jeunes citoyens'],
      actions: [null, 'collab'],  // 'collab' = aller Collaboration
    },

    timing: {
      bg_fade_in:         1200,
      pause_before_torch:  500,
      exit_black_pause:    10,
    },
  },


/* ══════════════════════════════════════════════════════════════════
   COLLABORATION
   ──────────────────────────────────────────────────────────────────
   CHRONOLOGIE (depuis enter()) :

   ══════════════════════════════════════════════════════════════════ */

  COLLABORATION: {

    torch: {
      size:              0.45,   // Torche large — espace ouvert
      grow_duration:     3000,
      fade_out_duration: 1500,
    },

    arrow: {
      // Flèche BAS-GAUCHE, pointe vers la gauche (retour phréno)
      appear_at:        4000,   // ms depuis enter()
      draw_duration:    2100,
      hide_duration:     400,
    },

    circles: {
      // Cercles romains I→V — apparaissent après la flèche
      appear_at:        5400,   // ms depuis enter() — arrivée normale
      appear_at_return: 1500,   // ms depuis enter() — retour depuis chapitre1 (plus rapide)

      stagger:           320,   // Décalage entre chaque cercle (ms)

      // Taille et position
      size_vh:            15,   // Diamètre (% hauteur viewport)
      gap_vh:              8,   // Espacement (% hauteur viewport)
      top_pct:            50,   // Position verticale centre (%)

      // Contenu
      labels:       ['I', 'II', 'III', 'IV', 'V'],
      hover_titles: ['Les interpétations du geste de Soliman al-Halabi', 'L’héritage colonial du musée', 'Le Général Jean-Baptiste Kléber', 'Une histoire complexe (à venir)', 'Le devenir du corps de Soliman al-Halabi (à venir)'],
      actions:      ['chapitre1', 'chapitre2', 'chapitre3', null, null],
    },

    audio: {
      fade_out: 2000,  // Fondu sortie collaboration.mp3 (ms)
    },

    timing: {
      bg_fade_in:         1200,
      pause_before_torch:  600,
      exit_black_pause:    10,
    },
  },


/* ══════════════════════════════════════════════════════════════════
   CHAPITRE 2
   ══════════════════════════════════════════════════════════════════ */

  CHAPITRE2: {
    // Sous-titre (tier 2) affiché sous « Espace collaboratif » dès l'entrée.
    subtitle: 'L\u2019héritage colonial du musée',

    // Titres de sous-partie (tier 3) — affichés en plus du sous-titre quand on
    // entre dans une sous-partie, masqués quand on en sort. Clés = identifiants
    // internes utilisés par Chapitre2Scene / les modules chp2.
    parts: {
      invibilisation:  '',
      'peine-demesuree': '',
      cartel:          '',
    },

    // ── Lumières « bougie » de l'openning (travelling avec les crânes) ──────
    // Une lumière par crâne, allumée selon la progression (voir chp2-progress).
    //   craneFinalFrac : rayon d'un pool, fraction de min(largeur, hauteur)
    //                    du viewport. Plus petit = pool plus serré sur le crâne.
    //   igniteMs       : durée d'allumage initial (ms).
    //   igniteDelay    : délai avant l'allumage initial après l'entrée (ms).
    //   staggerMs      : décalage d'allumage entre crânes (cascade) (ms).
    //   returnMs       : durée de rallumage au retour d'une sous-partie (ms).
    light: {
      craneFinalFrac: 0.25,
      igniteMs:       5000,
      igniteDelay:    2600,
      staggerMs:      260,
      returnMs:       3000,
    },

    // ── Sous-partie « Invisibilisation » (installation des yeux) ────────────
    //   fluteVol    : volume de l'ambiance flûte (0..1).
    //   fluteFadeMs : durée des fondus de la flûte (entrée/coupure/reprise).
    //   exitFadeMs  : durée d'extinction progressive à la sortie (fondu au noir).
    invibilisation: {
      fluteVol:    0.30,
      fluteFadeMs: 1500,
      exitFadeMs:  2500,
    },
  },


/* ══════════════════════════════════════════════════════════════════
   CHAPITRE 3
   ══════════════════════════════════════════════════════════════════ */

  CHAPITRE3: {
    // Sous-titre (tier 2) affiché sous « Espace collaboratif » dès l'entrée
    // dans le chapitre 3, et masqué au retour vers l'Espace collaboratif.
    // Rendu par Chapitre3Scene via #chapitre-subtitle (apparition/disparition
    // cinématographiques portées par la classe .visible en CSS).
    subtitle: 'Le Général Jean-Baptiste Kléber',
  },


/* ══════════════════════════════════════════════════════════════════
   CHAPITRE 1
   ══════════════════════════════════════════════════════════════════ */

  CHAPITRE1: {
    subtitle: 'Les interprétations du geste de Soliman al-Halabi',
    debug:    false,

    /* ── Chapter1LightSystem — lumière fixe centrée ──────────────
    ──────────────────────────────────────────────────────────── */
    light: {
      // Phase intro (chapitre1.webp) : lumière large et douce
      intro_frac:       1.2,   // Fraction min(W,H) — rayon initial
      intro_duration:   6200,   // Durée allumage depuis 0 (ms)

      // Phase interactive (chapitre1base.webp + hotspots)
      interactive_frac: 1.5,   // Fraction min(W,H) — rayon interactif
      trans_duration:   2000,   // Durée transition intro → interactif (ms)

      // Pendant lecture media : lumière réduite
      media_frac:       0.42,   // Fraction réduite pendant le player
      media_duration:    800,   // Durée du dim (ms)
    },

    timing: {
      // Délai entre l'apparition de l'image chapitre1.webp et le démarrage du son S-phrenologie.mp3
      phren_sound_delay:  6000,   // ms depuis l'ouverture du voile

      // Délai d'apparition du bouton "Passer" PENDANT S-phrenologie.mp3
      // 0 = apparaît dès le début du son, 5000 = après 5s de son
      skip_intro_delay:   3000,   // ms depuis le début du son S-phrenologie

      // Délai d'apparition du bouton "Passer" pendant le texte typing (phase outro)
      skip_btn_delay:     2000,   // ms depuis le début du typing
    },

    hotspots: [
      { img: 'himg-1', label: 'Langage',       l: 61, t: 40, w: 28, h: 35, media: 'Collaboration/Chapitre1/S1.mp3'        },
      { img: 'himg-2', label: '33',            l: 12, t: 41, w: 29, h: 37, media: 'Collaboration/Chapitre1/C2.mp3'        },
      { img: 'himg-3', label: 'Éventualité',   l: 46, t:  0, w: 22, h: 22, media: 'Collaboration/Chapitre1/S2.mp3'        },
      { img: 'himg-4', label: 'Individualité', l: 46, t: 22, w: 19, h: 26, media: 'Collaboration/Chapitre1/Emprise.mp4'   },
      { img: 'himg-5', label: 'Pesanteur',     l: 67, t: 18, w: 13, h: 22, media: 'Collaboration/Chapitre1/Theatre.mp4'  },
      { img: 'himg-6', label: '27',            l: 21, t:  5, w: 32, h: 23, media: 'Collaboration/Chapitre1/Defenseur.mp4'},
      { img: 'himg-7', label: 'Temps',         l: 72, t:  6, w: 20, h: 17, media: 'Collaboration/Chapitre1/Silence.mp4'  },
      { img: 'himg-8', label: '25',            l: 19, t: 23, w: 11, h: 20, media: 'Collaboration/Chapitre1/Klaxon.mp3'   },
      { img: 'himg-9', label: 'Nez',           l: 38, t: 62, w: 22, h: 22, media: 'Collaboration/Chapitre1/S3.mp3'       },
    ],
  },


/* ══════════════════════════════════════════════════════════════════
   DOCUMENTS — contenus affichés par DocumentOverlay (scène phrénologie)
   ──────────────────────────────────────────────────────────────────
   Chaque clé correspond à une entrée de PHRENOLOGIE.docs.actions
   (+ la clé 'about' pour le bouton « À Propos »).

   types :
     'text'   → paragraphes (aucun cadre)
     'images' → 1 ou 2 cadres tracés puis images en fondu
     'embed'  → cadre tracé puis site incrusté (iframe)

   `poster` : image de repli affichée à la place de l'iframe sur écran
              tactile (téléphone), où la navigation dans un site incrusté
              est inconfortable. Si le fichier est absent, une carte avec
              lien de consultation est affichée à la place.
   ══════════════════════════════════════════════════════════════════ */

  DOCUMENTS: {

    about: {
      type: 'text',
      paragraphs: [
        'Que faire du corps de Soliman al-Halabi, assassin présumé du général Kléber, qui demeure sans sépulture depuis sa condamnation à mort par la justice française en 1800 ?',
        'Le corps de cet écrivain public originaire d\u2019Alep a été ramené en France dans les bagages de l\u2019expédition d\u2019Égypte (1798-1801). Il a été remis au Muséum national d\u2019Histoire naturelle qui l\u2019a exposé dans ses vitrines jusque dans les années 1980.',
        'Entretemps, le corps de Soliman al-Halabi a été érigé en représentant d\u2019une nation ou une religion.',
        'En France, il a intégré les collections publiques en tant que spécimen de « Syrien fanatique ». De l\u2019autre côté de la Méditerranée, il a été élevé au rang de relique de héros national ou martyr religieux.',
        'Que faire de ce corps à l\u2019état de squelette qui se tient au travers de la commune humanité ? Telle est la question soulevée par le présent site qui est né d\u2019une recherche collaborative réunissant des chercheurs, lycéens et étudiants français. Et cela à l\u2019initiative du collectif syrien Abounaddara, avec le soutien de l\u2019Agence Nationale de la Recherche, et France-Berkeley Fund.',
      ],
    },

    'doc-1': {
      type: 'images',
      // Ordre d'affichage : gauche → droite.
      frames: [
        { src: 'images/doc-1-b.jpg', alt: 'Recueil des pièces, planche b' },
        { src: 'images/doc-1-a.jpg', alt: 'Recueil des pièces, planche a' },
      ],
      caption: 'Extrait du recueil des pièces relatives à la procédure et au jugement de Soleyman El-Hhaleby, assassin du général en chef Kléber',
      source: {
        label: 'Source — Gallica (BnF)',
        href:  'https://gallica.bnf.fr/ark:/12148/bpt6k63439128.r=recueil%20des%20pi%C3%A8ces%20relatives%20%C3%A0%20la%20proc%C3%A9dure%20et%20au%20jugement%20de%20SOLEYMAN%20EL-HHALEBY%2C%20assassin%20du%20GENERAL%20EN%20CHEF%20KLEBER%2C?rk=21459;2',
      },
    },

    'doc-2': {
      type: 'images',
      frames: [
        { src: 'images/doc-2.jpg', alt: 'Catalogue des préparations anatomiques' },
      ],
      caption: 'Extrait du « Catalogue des préparations anatomiques du cabinet d\u2019anatomie comparée du Muséum d\u2019Histoire naturelle » de Paris — squelette entré en 1806 dans le cabinet de Georges Cuvier (1769-1832).',
    },

    'doc-3': {
      type: 'embed',
      url:    'https://catalogue-lumiere.com/assassinat-de-kleber/',
      poster: 'images/doc-3-poster.jpg',   // écran tactile : image fixe
      ratio:  '16 / 9',
      caption: 'Film des frères Lumière, l\u2019assassinat de Kléber — janvier 1898',
      source: { label: 'Ouvrir le catalogue Lumière', href: 'https://catalogue-lumiere.com/assassinat-de-kleber/' },
    },

    'doc-4': {
      type: 'embed',
      url:   'https://debordements.fr/Lettre-au-President-de-la-Republique-au-sujet-du-Syrien-fanatique/',
      // Les incrustations sont affichées dans un cadre de TAILLE FIXE UNIFORME
      // (identique à doc-3), centré entre les deux colonnes : voir
      // DocumentOverlay._layoutFrames (gabarit 16/9 commun à tous les embeds).
      ratio: '16 / 9',
      caption: 'Lettre au président de la République du collectif Abounaddara au sujet du « Syrien fanatique » — octobre 2022',
      source: { label: 'Ouvrir la lettre sur Débordements', href: 'https://debordements.fr/Lettre-au-President-de-la-Republique-au-sujet-du-Syrien-fanatique/' },
    },
  },


/* ══════════════════════════════════════════════════════════════════
   AUDIO — Sons partagés
   ══════════════════════════════════════════════════════════════════ */

  AUDIO: {
    musee_vol:        1.2,
    fadeDuration:    3500,   // Fondu initial musée (ms)
    musee_fade:      2500,   // Fondu entre scènes (ms)

    phren_fade_in:   1800,
    phren_fade_out:  2200,
    phren_intro_delay: 1800,

    sanza_vol:       0.55,
    sanza_fade_in:   2000,
    sanza_fade_out:  1200,

    silence_vol:     0.75,
    silence_fade_in: 1200,
    silence_fade_out: 1800,

    collab_vol:      0.4,
    collab_fade_in:  2500,
    collab_fade_out: 2000,

    // Chapitre 2 — ambiance fredonnement (centralisée dans AudioManager)
    chp2_vol:        0.72,
    chp2_fade_in:    5000,   // = IGNITE.duration (allumage bougie)
    chp2_fade_out:   1600,
  },


/* ══════════════════════════════════════════════════════════════════
   TITRE
   ══════════════════════════════════════════════════════════════════ */

  TITLE: {
    texte:       ['Abounaddara', '—', 'CNRS', '—', '2026'],
    couleur:     'rgba(210,175,90,1)',
    char_delay:   65,
    start_delay:  800,
  },

  TITLE_SWAP_MS: 620,


/* ══════════════════════════════════════════════════════════════════
   PLAYER MÉDIA
   ══════════════════════════════════════════════════════════════════ */

  PLAYER: {
    audio_w:           0.62,
    audio_h:           0.16,
    audio_bg_opacity:  0.35,
    wave_color:        'rgba(255,255,255,0.75)',
    wave_width:         1.5,
    audio_wave_h:      0.62,
    audio_wave_gap:    0.08,

    video_ratio:              0.95,
    video_bg_opacity:         0.75,
    video_min_w:              0.30,
    video_max_w:              0.80,
    video_scale_duration_ms:   700,
    video_scale_ease_power:    3.5,
    video_seek_h:             0.12,
    video_seek_thick:          1.2,

    media_inset:       0.0005,
    video_ctrl_h:      0.14,
    stroke:            'rgba(255,255,255,0.85)',
    draw_speed:         0.9,
    fade_out_ms:        950,
    fade_out_y:          18,
    btn_color:         'rgba(255,255,255,0.82)',
    btn_color_hover:   'rgba(255,220,120,1)',
    close_size:         0.028,
    close_delay:        0.5,

    torch_dim:          0.8,
    torch_ms:           800,
  },


/* ══════════════════════════════════════════════════════════════════
   ÉCRAN DE DÉMARRAGE
   ══════════════════════════════════════════════════════════════════ */

  START_SCREEN: {
    fadeOut: 1200,
  },


/* ══════════════════════════════════════════════════════════════════
   VIEWPORT MINIMAL
   ══════════════════════════════════════════════════════════════════ */

  MIN_SIZE: {
    width:  500,
    height: 350,
  },


/* ══════════════════════════════════════════════════════════════════
   ARROW — Taille de référence globale
   ArrowBase, NavigationBar, MediaPlayer, Fullscreen l'utilisent
   pour calculer leurs dimensions de façon cohérente.
   ══════════════════════════════════════════════════════════════════ */

  ARROW: {
    size_vh:   7,    // % de min(vW, vH)
    size_min: 36,    // px
    size_max: 120,   // px
  },


/* ══════════════════════════════════════════════════════════════════
   TORCH — Paramètres de rendu communs
   ══════════════════════════════════════════════════════════════════ */

  TORCH: {
    lag:            0.068,   // Latence curseur (0.01=lent, 0.2=rapide)
    // Les tailles de torche sont désormais dans chaque section de scène :
    // VITRINE.torch.size, PHRENOLOGIE.torch.size, COLLABORATION.torch.size
    // Ces valeurs legacy sont conservées pour rétrocompatibilité uniquement.
    taille_vitrine: 0.65,    // = VITRINE.torch.size
    taille_phren:   0.22,    // = PHRENOLOGIE.torch.size
  },


/* ══════════════════════════════════════════════════════════════════
   TYPOGRAPHIE
   ══════════════════════════════════════════════════════════════════ */

  FONTS: {
    title: {
      family:  'Cinzel, serif',
      size_vw:  1.1,
      size_min: 9,
      size_max: 18,
      weight:   400,
      spacing: '0.30em',
      style:   'normal',
      color:   'rgba(210,175,90,1)',
    },
    subtitle: {
      family:  'Cinzel, serif',
      size_vw:  0.75,
      size_min: 7,
      size_max: 13,
      weight:   400,
      spacing: '0.18em',
      style:   'normal',
      color:   'rgba(210,175,90,0.78)',
    },
    doc_btns: {
      family:  'Cinzel, serif',
      size_vw:  0.80,
      size_min: 8,
      size_max: 14,
      weight:   400,
      spacing: '0.18em',
      style:   'normal',
    },
    nav_btns: {
      family:  'Cinzel, serif',
      size_vw:  1.20,
      size_min: 12,
      size_max: 26,
      weight:   300,
      spacing: '0.18em',
      style:   'normal',
    },
    roman: {
      family:  'Cinzel, serif',
      size_vw:  1.6,
      size_min: 10,
      size_max: 28,
      weight:   600,
      spacing: '0.08em',
      style:   'normal',
    },
    hover_title: {
      family:  'Playfair Display, Cormorant Garamond, Georgia, serif',
      size_vw:  2.0,
      size_min: 14,
      size_max: 36,
      weight:   300,
      spacing: '0.06em',
      style:   'italic',
      color:   'rgba(255,255,255,0.82)',
    },
  },


/* ══════════════════════════════════════════════════════════════════
   TIMING — Partagé (animations titre)
   ══════════════════════════════════════════════════════════════════ */

  TIMING: {
    title_char_delay: 65,
    title_start:     800,
  },

};


/* ══════════════════════════════════════════════════════════════════
   ALIAS — Requis par les composants UI qui lisent encore
   config.DOCS, config.NAV et config.COLLAB directement.
   ══════════════════════════════════════════════════════════════════ */

window.CONFIG.DOCS = window.CONFIG.PHRENOLOGIE.docs;
window.CONFIG.NAV  = window.CONFIG.PHRENOLOGIE.navbar;


/* ══════════════════════════════════════════════════════════════════
   LAYOUT PARTAGÉ — une seule source de vérité pour les COLONNES LATÉRALES
   ──────────────────────────────────────────────────────────────────
   Boutons documents (droite), légende de l'overlay (gauche) et gouttières de
   l'overlay doivent s'accorder. Plutôt que trois calculs indépendants (qui
   divergeaient : le bouton pouvait dépasser sa gouttière sur grand écran), tout
   le monde lit CES helpers.

   sideColPx(vW, vH) : largeur d'UNE colonne latérale, en pixels. C'est
   l'emprise réelle d'un bouton document = largeur du bouton + sa marge au bord.
   La colonne de légende (gauche) et la gouttière (droite) adoptent la MÊME
   valeur → symétrie garantie, document toujours centré, jamais de chevauchement.
   ══════════════════════════════════════════════════════════════════ */

window.CONFIG.LAYOUT = {
  // Largeur d'un bouton document (identique à DocumentButtons.getSizePx().w).
  docBtnWidthPx(vW) {
    const D = window.CONFIG.DOCS;
    const raw = vW * D.width_vw / 100;
    return Math.round(Math.max(D.width_min, Math.min(D.width_max, raw)));
  },

  // Largeur d'une colonne latérale = bouton + marge droite (son emprise totale).
  // Bornée pour rester raisonnable sur très grand écran.
  sideColPx(vW) {
    const D = window.CONFIG.DOCS;
    const btn    = this.docBtnWidthPx(vW);
    const margin = vW * (D.right_pct ?? 3.5) / 100;
    return Math.round(Math.min(340, btn + margin));
  },
};

window.CONFIG.COLLAB = {
  torch_taille:    window.CONFIG.COLLABORATION.torch.size,
  circles_delay:   window.CONFIG.COLLABORATION.circles.appear_at,
  circles_stagger: window.CONFIG.COLLABORATION.circles.stagger,
  circle_size_vh:  window.CONFIG.COLLABORATION.circles.size_vh,
  circle_gap_vh:   window.CONFIG.COLLABORATION.circles.gap_vh,
  circle_top_pct:  window.CONFIG.COLLABORATION.circles.top_pct,
  labels:          window.CONFIG.COLLABORATION.circles.labels,
  hover_titles:    window.CONFIG.COLLABORATION.circles.hover_titles,
};

/* ══════════════════════════════════════════════════════════════════
   ALIAS CHAPITRE1 — Requis par TorchSystem.updateTarget()
   qui lit CONFIG.CHAPITRE1.torch_phren et torch_interactive (plat)
   ──────────────────────────────────────────────────────────────────
   ⚠️ CHAPITRE1 ne définit PAS de bloc `torch` (seulement `light`) : sans
   optional chaining, ces trois lignes lèvent un TypeError qui INTERROMPT
   la fin de config.js. Les alias valent donc undefined — exactement comme
   avant, mais sans casser l'exécution du script.
   ══════════════════════════════════════════════════════════════════ */

window.CONFIG.CHAPITRE1.torch_phren       = window.CONFIG.CHAPITRE1.torch?.size_phren;
window.CONFIG.CHAPITRE1.torch_interactive = window.CONFIG.CHAPITRE1.torch?.size_interactive;
window.CONFIG.CHAPITRE1.torch_media_dim   = window.CONFIG.CHAPITRE1.torch?.size_media_dim;
