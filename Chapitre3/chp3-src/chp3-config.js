/* =====================================================================
   Kléber — Galerie des Batailles · Versailles
   chp3-config.js — Paramètres de l'expérience (aucune logique moteur)

   Source unique de vérité pour tout ce qui se règle sans toucher au code :
   textes, timings, géométrie des chapitres, lumière, atmosphère, sons.
   Les chemins d'assets pointent vers Chapitre3/chp3-images/ (visuels) et
   Chapitre3/chp3-medias/ (vidéos + sons). Chargé AVANT chp3-main.js (cf. index.html).

   `CONFIG` est déclaré en portée globale de script : il reste accessible
   depuis chp3-main.js dès lors que ce fichier est chargé en premier.
   ===================================================================== */

export const CONFIG = {

    // ── TEXTES ─────────────────────────────────────────────────────
    // Sous-titre (tier 2) affiché sous « Espace collaboratif » dès l'entrée dans
    // le chapitre, et masqué au retour. Rendu par Chapitre3Scene via
    // #chapitre-subtitle. Il vivait dans config.js (section CHAPITRE3) : ramené
    // ici à l'audit de juillet 2026, comme le sous-titre des chapitres 1 et 2.
    // Chapitre3Scene importe ce fichier STATIQUEMENT — c'est ce qui le rend
    // lisible avant l'import() du moteur, au moment où le sous-titre paraît.
    subtitle : 'Le Général Jean-Baptiste Kléber',
    haut : 'Galerie des Batailles · Versailles',
    bas  : 'Jean-Baptiste Kléber · 1753 – 1800',

    // ── TRAVELLING D'ENTRÉE ────────────────────────────────────────
    zoomDepart  : 1.35,   // facteur de gros plan initial (× zoom de repos)
    dureeTravel : 14,     // secondes de montée caméra
    dureeFondu  : 7,      // secondes de fondu d'apparition de l'image

    // ── CAMÉRA / DYNAMISME ─────────────────────────────────────────
    overscan    : 1.06,   // marge de débord pour la parallaxe (1 = aucune)
    respiration : 0.010,  // amplitude du micro-zoom de repos (effet "respiration")
    respVitesse : 0.50,   // rad/s du micro-zoom (période ≈ 12,5 s)
    parallaxe   : { x:24, y:14, lambda:5 }, // débord max (px écran) + amortissement

    // ── NAVIGATION (modèle à inertie, unités px/s) ─────────────────
    vitesseBord : 650,    // vitesse de balayage quand le curseur frôle un bord
    zoneBord    : 0.20,   // hauteur des zones de bord (fraction de l'écran)
    molette     : 3.0,    // gain d'impulsion molette
    clavier     : 520,    // impulsion flèches ↑/↓
    friction    : 3.2,    // décroissance de l'inertie (1/s)

    // ── CERCLES / CHAPITRES ────────────────────────────────────────
    //  x,y = position en % de l'image · r = rayon (px image) · appAt = % du
    //  travelling où le tracé démarre · href = destination (null = aperçu)
    dureeTracé  : 1.4,
    hoverScale  : 1.30,
    hoverLambda : 18,     // réactivité de l'agrandissement au survol
    dureeEntree : 1.0,    // secondes de la transition « entrer »
    // Expressivité (douce, sensible) :
    cercleIdle  : { respScale:0.018, respVitesse:1.2, opacMin:0.78 }, // souffle + frémissement de repos
    cercleProx  : { rayon:200, grossir:0.14 },                        // sensibilité « magnétique » au curseur
    ping        : { actif:true, idle:0.22, periode:6.5, duree:2.6, ampli:0.9, opac:0.16 }, // onde discrète
  cercles: [
        { x:80, y:73, r:55, appAt:14, num:'4', label:'////////', href:null,
          reveal:{ image:'Chapitre3/chp3-images/theatre-papier.webp', imageSmall:'Chapitre3/chp3-images/theatre-papier-800.webp',
                   theme:{ src:'Chapitre3/chp3-medias/theatre.mp3' },   // fond sonore du tableau, atténué pendant les vidéos des hotspots
                   titre:'MORT DE KLÉBER N°49, 1892-1901',
                   credit:'DELHALT Alfred (imprimeur)',
                   // Zones interactives POSÉES sur la photo (survol → image ; clic → vidéo).
                   // x,y,w,h en % de l'image theatre-papier (coin haut-gauche + dimensions).
                   // ⚠️ Calées sur les calques transparents fournis (mêmes coordonnées) :
                   // à ajuster ici si l'alignement diffère à l'écran.
                   theatre:[
                       { id:'arcade',  label:'Voir le mur d’arcade', caption:'Jeu d’équilibre',
                         overlay:'Chapitre3/chp3-images/theatre-papier-arcade.webp',  overlaySmall:'Chapitre3/chp3-images/theatre-papier-arcade-800.webp',
                         video:'Chapitre3/chp3-medias/equilibre.mp4', x:7.44,  y:33.76, w:26.25, h:50.77 },
                       { id:'palmier', label:'Voir le palmier', caption:'Le palmier',
                         overlay:'Chapitre3/chp3-images/theatre-papier-palmier.webp', overlaySmall:'Chapitre3/chp3-images/theatre-papier-palmier-800.webp',
                         video:'Chapitre3/chp3-medias/palmier.mp4', x:46.25, y:56.58, w:15.88, h:36.24 },
                       { id:'plante',  label:'Voir la plante', caption:'Efflorescence historique',
                         overlay:'Chapitre3/chp3-images/theatre-papier-plante.webp', overlaySmall:'Chapitre3/chp3-images/theatre-papier-plante-800.webp',
                         video:'Chapitre3/chp3-medias/Efflorescence.mp4', x:67.81, y:38.03, w:16.19, h:21.54 },
                   ] } },
        { x:22, y:60, r:45, appAt:34, num:'3', label:'////////', href:null,
          reveal:{ volume:0.9, start:1, theme:{ src:'Chapitre3/chp3-medias/victoire.mp3' }, gallery:[
              { video:'Chapitre3/chp3-medias/a_la_une.mp4',  titre:'',        credit:'' },
              { image:'Chapitre3/chp3-images/centenaire.webp', titre:'Portrait de Kléber — Centenaire de 1789' },
              { video:'Chapitre3/chp3-medias/sepulture.mp4', titre:'',          credit:'' },
          ] } },
        { x:85, y:43, r:50, appAt:62, num:'2', label:'////////', href:null,
          reveal:{ video:'Chapitre3/chp3-medias/hero_cache.mp4', volume:0.9,
                   titre:'',
                   credit:'' } },
        { x:18, y:24, r:60, appAt:82, num:'1', label:'////////', href:null,
          reveal:{ image:'Chapitre3/chp3-images/Hinzelin.webp', sound:'Chapitre3/chp3-medias/Kleber.mp3', volume:0.85,
                   titre:'Kléber un enfant d’Alsace, 1916',
                   credit:'témoignage audio : L, lycéenne' } },
    ],

    // ── LUMIÈRE (clair-obscur) ─────────────────────────────────────
    lumiere: {
        centreX   : 50,    // position de repos du halo (% écran)
        centreY   : 46,
        rayon     : 65,    // taille du halo (vmax)
        chaleur   : 0.11,  // intensité de la lueur chaude au centre
        bords     : 0.97,  // noirceur des bords
        oscAmpl   : 3.2,   // amplitude de l'oscillation autonome (% écran)
        oscVitesse: 0.10,  // vitesse de dérive
        flamme    : 0.05,  // micro-respiration du rayon (effet flamme)
        suivreSouris: 6,   // attraction du halo vers le pointeur (% écran)
    },

    // ── ATMOSPHÈRE : bokeh + rayons de lumière ─────────────────────
    bokeh: {
        nombre:95, tailleMax:15, partGros:0.22, vitesse:0.55,
        balance:26, scintille:0.45, apparition:7, delai:1.5,
    },
    rayons: {
        actif:true, nombre:7, evasement:26, intensite:0.10,
        angle:106,            // 90 = verticaux · >90 = obliques penchés vers la GAUCHE
                              // (source perçue à DROITE, lumière de fenêtres hautes-droites)
        ecartSource:0.30,     // étalement des origines en haut (× largeur). ↓ = sommet plus resserré
        decalSource:0.20,     // décalage horizontal de la source (× largeur). + = vers la DROITE
        desordre:12,          // désordre d'orientation des rayons, en degrés (0 = éventail régulier)
        suiviSouris:0.30,     // suivi du pointeur par les rayons : 0 = fixes, 1 = autant que le halo
        flou:46,              // ↑ flou = rayons plus diffus / réalistes, moins « nets »
        balance:1.6,          // amplitude d'oscillation de CHAQUE rayon, en degrés
        vitesseBalance:0.10,  // vitesse de cette oscillation
        derive:0.03,          // vitesse de la dérive d'ensemble du faisceau
        amplitudeDerive:0.03, // amplitude de cette dérive, en rad
        apparition:9, delai:2.5,
    },
    grain:false,

    // ── SÉQUENCE « TABLEAU » (déclenchée par un cercle `reveal`) ────
    //  Tout le timing/look de la révélation se règle ici.
    tableau: {
        zoomLeger  : 0.07,   // gain de zoom (léger) pendant l'assombrissement
        voile      : 0.62,   // opacité MAX du voile (< 1 → le buste reste visible)
        dureeDim   : 1000,   // ms : zoom + assombrissement
        dureeSortie: 850,    // ms : retour au buste à la fermeture
        dureeTracé : 1500,   // ms : tracé du cadre lumineux (le « stylet »)
        matVw      : 0.92,   // largeur max du cadre (fraction de la fenêtre)
        matVh      : 0.85,   // hauteur max du cadre (fraction de la fenêtre)
        ratioDefaut: 0.78,   // ratio L/H de repli si la photo est introuvable
        // Fondu-voile (transition ouverture/fermeture des vidéos imbriquées) :
        fonduDuree : 700,    // ms : durée d'UN mouvement de fondu (assombrissement OU dévoilement)
        fonduPause : 200,    // ms : voile plein noir, pendant l'échange photo ↔ vidéo (swap invisible)
        // Balayage de suggestion (indice d'interactivité, cf. thHint*) : survol
        // simulé de chaque hotspot, l'un après l'autre de gauche à droite,
        // répété périodiquement tant que le tableau est ouvert et inactif.
        // Fondu dédié, plus rapide que celui du survol réel (.th-overlay-img
        // utilise .6s ; cf. transitionRapide et --th-suggestion-duree).
        suggestion: {
            delaiMin        : 3500,  // ms : attente mini avant un passage périodique (hors kickoff initial)
            delaiJitter     : 2500,  // ms : aléa ajouté → prochain passage entre 3,5 et 6 s
            tenue           : 500,   // ms : affichage plein de chaque élément
            decalage        : 210,   // ms : décalage de DÉPART entre deux hotspots consécutifs — pas une
                                     // attente de fin : chevauchement volontaire pour un fondu continu,
                                     // homogène, plutôt que des blocs allumés/éteints séparés
            transitionRapide: 440,   // ms : durée du fondu (entrée et sortie) pendant le balayage
        },
    },

    // ── SON AMBIANT ────────────────────────────────────────────────
    ambiance: {
        src         : 'Chapitre3/chp3-medias/Kleber-intro.m4a',  // format compressé (AAC) — voir spec d'encodage
        fallback    : 'Chapitre3/chp3-medias/Kleber-intro.mp3',  // repli si le .m4a est absent (rien ne casse)
        volume      : 0.22,    // volume de croisière (0–1)
        fadeIn      : 8500,    // ms : montée depuis le début du travelling
        loopFadeOut : 1800,    // ms : fondu sortant en fin de boucle
        loopFadeIn  : 2200,    // ms : fondu entrant en début de boucle suivante
        mediaFadeOut: 3000,    // ms : extinction à l'ouverture d'un média
        mediaFadeIn : 2500,    // ms : réapparition à la fermeture
    },

    // ── THÈME DE TABLEAU ─────────────────────────────────────────────
    // Fond sonore atmosphérique propre à CERTAINS cercles (cf. reveal.theme
    // dans CONFIG.cercles), indépendant à la fois de l'ambiance de page
    // (ambAudio) et du son propre au média affiché (rvMedia : vidéo de la
    // galerie, vidéo d'un hotspot théâtre…) — canal dédié, jamais réutilisé,
    // pour ne jamais écraser l'un par l'autre.
    theme: {
        volumeDefaut: 0.55,   // utilisé si reveal.theme ne précise pas son propre volume
        fadeIn      : 900,    // ms : montée à l'ouverture du tableau
        fadeOut     : 700,    // ms : extinction à la fermeture du tableau
        duckDuree   : 400,    // ms : fondu de coupure / de reprise pendant qu'un média concurrent joue
    },

    // ── QUESTION D'INTRODUCTION ──────────────────────────────────────
    // Séquence cinématographique jouée avant le travelling, entre le clic
    // sur « Entrer » et le lancement de loop() (cf. iqShow). Purement
    // additive : aucune donnée persistée, rejouée à chaque chargement.
    intro: {
        title   : 'Résultat du sondage collaboratif',
        question: '"Savez-vous qui était Jean-Baptiste Kléber\u00A0?"',
        // ⚠️ Les pourcentages « Universitaire » totalisent 110 % (77+33), pas 100 —
        // je les affiche tels quels dans le texte (fidèle à la donnée fournie) mais
        // je normalise le TRACÉ du camembert (≈70/30) pour qu'il reste géométriquement
        // correct. À corriger ici si l'un des deux chiffres est une coquille.
        stats: [
            { label:'Lycéens',   non:100, oui:0,  count:85, ages:'15–19 ans' },
            { label:'Étudiants', non:77,  oui:33, count:20, ages:'19–24 ans', detail:'ESAA' },
            { label:'Adultes',   non:39,  oui:61, count:68, ages:'65–80 ans', detail:'Université de tous les âges' },
        ],

        question2: '"Qui est-il\u00A0?"',
        question2Subtitle: 'Réponse des adultes',
        // ⚠️ Ces 5 catégories ne totalisent que 60 % (39+9+6+3+3), pas 100.
        // Comme pour « Universitaire » plus haut : le TEXTE affiché reste fidèle
        // aux valeurs fournies, mais le TRACÉ est normalisé sur l'intégralité du
        // cercle (chaque part = sa proportion RELATIVE aux 5 autres, pas sa valeur
        // brute) — pas de segment « autres » qui laisserait le camembert incomplet.
        identity: {
            segments: [
                { label:'Général ou soldat de Napoléon / de l’Empire', pct:39 },
                { label:'Général français',                            pct:9  },
                { label:'Général de la Révolution',                    pct:6  },
                { label:'Général alsacien',                            pct:3  },
                { label:'La victime d’un musulman',                    pct:3  },
            ],
        },

        quote      : 'Je n’avais pas de connaissance de ce personnage. Il est le général français qui a été tourné en héros napoléonien après son meurtre par Soliman al-Halabi',
        quoteCredit: 'A., étudiant',

        // ══ MISE EN PAGE ═════════════════════════════════════════════
        // Source unique de vérité pour TOUTE la géométrie du sondage.
        // Chaque nombre ci-dessous est une valeur de RÉFÉRENCE (échelle 1) ;
        // iqEnsureDOM la pose en variable CSS, et un facteur global unique
        // (--iq-scale, calculé par iqFit) les multiplie TOUS ensemble pour que
        // le bloc tienne toujours dans la fenêtre à proportions constantes.
        //  • `px de référence` sauf paddingV/H (vh/vw : marges d'écran fixes).
        //  • Desktop : tout est mis à l'échelle pour ne jamais déborder.
        //  • Sous scale.mobileBreakpoint : reflow + défilement vertical.
        layout: {
            // ══════════════════════════════════════════════════════════
            //  Toutes les valeurs ci-dessous sont des NOMBRES DE BASE, en
            //  « px de référence » (échelle 1). À l'affichage, un unique
            //  facteur --iq-scale (calculé par iqFit pour que le bloc tienne
            //  TOUJOURS dans la fenêtre) les multiplie tous ENSEMBLE : les
            //  proportions restent donc constantes à toute taille d'écran.
            //  → Pour changer une proportion : édite juste le nombre ici.
            //  → Pour changer un ESPACEMENT : voir `gaps` plus bas.
            // ══════════════════════════════════════════════════════════

            // — Cadre général —
            maxWidth: 920,   // largeur max du bloc de contenu (base)
            paddingV: 3,     // vh : marge haut / bas de l'écran (indépendant de l'échelle)
            paddingH: 5,     // vw : marge gauche / droite

            // — Comportement de mise à l'échelle —
            scale: {
                max             : 1.55, // agrandissement max (grands écrans)
                min             : 0.50, // réduction max avant bascule mobile
                fitSafety       : 0.985,// marge anti-scrollbar (desktop) : 0.9–1
                mobileBreakpoint: 620,  // px : sous cette largeur → reflow + défilement vertical
                // ── MODE 2 COLONNES (cf. .iq-overlay.iq-wide, iqFit) ────────────
                // Seul critère de bascule : la PROPORTION de la fenêtre.
                // On passe en 2 colonnes dès que  largeur / hauteur ≥ wideRatio.
                //   • 1.3  → un écran « classique » plein écran (16:9 ≈ 1.78,
                //            16:10 ≈ 1.60) bascule ; un portrait/carré reste empilé.
                //   • ↑ la valeur = plus exigeant (bascule seulement si TRÈS large).
                //   • ↓ la valeur = bascule plus tôt.
                // L'échelle (iqFit) garantit ensuite l'absence de scrollbar, quel
                // que soit l'agencement retenu.
                wideRatio       : 1.3,
                // Agrandissement max SPÉCIFIQUE au mode 2 colonnes : l'agencement
                // horizontal étant plus compact en hauteur, on l'autorise à grossir
                // davantage pour « remplir » l'écran large sans jamais déborder
                // (iqFit reste borné par la largeur ET la hauteur utiles).
                wideMax         : 2.2,
            },

            // — ESPACEMENTS (tous mis à l'échelle):
            gaps: {
                titleToQuestion      : 8,   // titre  → question
                questionToChoices    : 26,  // question → boutons Oui/Non
                choicesToCharts      : 26,  // boutons  → 3 camemberts
                chartsToIdentity     : 26,  // 3 camemberts → « Qui est-il ? »
                identityToContinue   : 30,  // bloc identité → bouton Continuer
                // internes au bloc « Qui est-il ? »
                identityQToBody      : 8,  // « Qui est-il ? » → (camembert + légende)
                identityChartToLegend: 40,  // camembert → légende détaillée
                identityLegendRowGap : 7,   // entre deux lignes de la légende détaillée
                // internes aux camemberts Oui/Non
                chartRowGap          : 56,  // écart HORIZONTAL entre les 3 camemberts
                chartStackGap        : 8,  // svg → libellé → sous-titre → effectifs → légende
                chartLegendLineGap   : 3,   // ligne « Non » → ligne « Oui »
                chartMetaLineGap     : 2,   // ligne « N réponses » → ligne « Âge : … »
                // mode 2 colonnes (grand écran) — cf. iqFit / .iq-overlay.iq-wide
                columnsGap           : 64,  // écart HORIZONTAL entre les 2 colonnes
            },
            // — Titre du sondage —
            title: { size: 11, tracking: 0.28 },   // tracking en em

            // — Question principale —
            question: { size: 27 },

            // — Boutons —
            button        : { width: 168, height: 50, gap: 26, labelSize: 13 },
            buttonContinue: { width: 200, height: 50 },

            // — Camemberts Oui / Non (les 3 premiers) —
            chart: {
                size     : 118,  // taille affichée du svg
                radius   : 42,   // géométrie interne (viewBox 104 ; n'affecte PAS la taille affichée)
                ringWidth: 12,   // épaisseur de l'anneau, en unités SVG (suit la taille du svg)
                gapPct   : 3,    // % du cercle : écart angulaire à chaque frontière
                labelSize : 15,   // libellé (« Lycéens »…)
                detailSize: 11,   // sous-titre optionnel (« (ESAA) »…)
                metaSize  : 9.5,  // lignes effectifs / âge
                legendSize: 11,   // « Non x% / Oui x% »
            },

            // — Camembert « Qui est-il ? » —
            identity: {
                questionSize: 24, // taille de « Qui est-il ? »
                subtitleSize: 13, // sous-titre optionnel (« (Réponse des adultes) »)
                size        : 158,// taille affichée du svg
                legendSize  : 11.5,
            },

            // — MODE 2 COLONNES (grand écran) : réglages DÉDIÉS ────────────────
            // N'affectent QUE l'agencement large (.iq-overlay.iq-wide). En mode
            // empilé, tout retombe sur les valeurs de base ci-dessus (chaque champ
            // wide est posé en variable CSS *-wide, avec repli sur la base).
            // Agencement : 2 colonnes, headers alignés en HAUT (« Qui est-il ? » sur
            // la même ligne que la 1ʳᵉ question) ; colonne droite empilée
            // titre → diagramme → légende. Chorégraphie : le groupe de gauche démarre
            // CENTRÉ puis glisse à gauche avant « Qui est-il ? » (cf. timing.identitySlide).
            wide: {
                chartSize    : 132, // petits camemberts oui/non (base 118) — un peu plus grands
                identitySize : 216, // GRAND camembert « Qui est-il ? » (base 158) — nettement plus gros
                columnsGap   : 72,  // écart horizontal entre les 2 groupes (base gaps.columnsGap 64)
                titleToBand  : 42,  // titre du sondage → bande des diagrammes (aéré, harmonieux)
                bandToContinue: 46, // bande des diagrammes → bouton Continuer
            },

            // — Témoignage final (machine à écrire) —
            quote: { labelSize: 12, textSize: 23, creditSize: 12, maxWidthCh: 62 },
        },
        timing: {
            questionIn      : 900,   // ms : fondu/montée de la question
            toChoices       : 500,   // ms : pause avant le tracé des boutons oui/non
            btnDraw         : 600,   // ms : tracé SVG de chaque bouton (CSS)
            btnStagger      : 150,   // ms : décalage entre les deux boutons
            toCharts        : 450,   // ms : pause après le clic, avant le 1er camembert
            chartFadeBg     : 300,   // ms : fondu du cercle de fond (avant le tracé des arcs)
            chartDraw       : 900,   // ms : tracé total de CHAQUE camembert (non + oui)
            chartStagger    : 400,   // ms : décalage entre les 3 camemberts
            toIdentity      : 1000,   // ms : pause après le 3ᵉ camembert, avant « Qui est-il ? »
            // Mode large : glissement du groupe de gauche (centré → colonne de gauche),
            // déclenché juste avant « Qui est-il ? ». Doit rester proche de la durée
            // CSS du transform (--iq-slide-dur) : on aligne les deux sur cette valeur.
            identitySlide   : 750,   // ms
            // Temps d'arrêt DÉLIBÉRÉ : la question reste seule à l'écran un instant
            // (comme suspendue), pour que le visiteur se la pose vraiment à lui-même,
            // avant que le camembert ne commence à se dessiner en dessous.
            toIdentityBody  : 1100,  // ms
            identityDraw    : 1400,  // ms : tracé total du camembert à 5(+1) catégories
            toContinue      : 550,   // ms : pause avant le tracé du bouton Continuer
            btnContinueDraw : 650,
            // — Séquence finale (clic sur Continuer → travelling) —
            contentFadeOut  : 700,   // ms : tout le quiz s'efface (écran noir nu ensuite)
            toEpilogueQuote : 500,   // ms : pause sur l'écran nu avant la machine à écrire
            typeSpeed       : 26,    // ms par caractère
            epilogueHold    : 3200,  // ms : tenue du témoignage une fois entièrement affiché
            epilogueFadeOut : 700,   // ms : fondu de sortie du témoignage (retour à l'écran nu)
            toTravelling    : 500,   // ms : pause sur l'écran nu avant le fondu final
            fadeOut         : 900,   // ms : fondu de sortie de tout l'écran vers le travelling
        },
    },
};
