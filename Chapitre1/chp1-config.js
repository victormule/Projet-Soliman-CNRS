/* =====================================================================
   Chapitre 1 — « Les interprétations du geste de Soliman al-Halabi »
   chp1-config.js — Paramètres du chapitre (aucune logique moteur)

   Source unique de vérité du chapitre 1 : sous-titre, lumière fixe
   (Chapter1LightSystem), timings, hotspots (zones + médias), citation.
   Même convention que chp2-config.js / chp3-config.js.

   Consommé par :
   - src/scenes/Chapitre1Scene.js (import direct, alias CHP1) ;
   - TorchSystem / MediaPlayer (composants PARTAGÉS) via le registre
     window.CONFIG.CHAPITRE1, renseigné par src/app.js au démarrage —
     config.js étant un script classique, il ne peut pas importer ce module.
   ===================================================================== */

export const CONFIG = {
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
    { img: 'himg-1', label: 'Langage',       l: 61, t: 40, w: 28, h: 35, media: 'Chapitre1/chp1-medias/S1.mp3'        },
    { img: 'himg-2', label: '33',            l: 12, t: 41, w: 29, h: 37, media: 'Chapitre1/chp1-medias/C2.mp3'        },
    { img: 'himg-3', label: 'Éventualité',   l: 46, t:  0, w: 22, h: 22, media: 'Chapitre1/chp1-medias/S2.mp3'        },
    { img: 'himg-4', label: 'Individualité', l: 46, t: 22, w: 19, h: 26, media: 'Chapitre1/chp1-medias/Emprise.mp4'   },
    { img: 'himg-5', label: 'Pesanteur',     l: 67, t: 18, w: 13, h: 22, media: 'Chapitre1/chp1-medias/Theatre.mp4'  },
    { img: 'himg-6', label: '27',            l: 21, t:  5, w: 32, h: 23, media: 'Chapitre1/chp1-medias/Defenseur.mp4'},
    { img: 'himg-7', label: 'Temps',         l: 72, t:  6, w: 20, h: 17, media: 'Chapitre1/chp1-medias/Silence.mp4'  },
    { img: 'himg-8', label: '25',            l: 19, t: 23, w: 11, h: 20, media: 'Chapitre1/chp1-medias/Klaxon.mp3'   },
    { img: 'himg-9', label: 'Nez',           l: 38, t: 62, w: 22, h: 22, media: 'Chapitre1/chp1-medias/S3.mp3'       },
  ],
};

/* Alias plats requis par TorchSystem.updateTarget() et MediaPlayer, qui
   lisent CONFIG.CHAPITRE1.torch_phren / torch_interactive / torch_media_dim.
   ⚠️ Le chapitre ne définit PAS de bloc torch (seulement light) : ces alias
   valent undefined et les consommateurs retombent sur leurs défauts (?? x) —
   comportement historique conservé à l'identique. */
CONFIG.torch_phren       = CONFIG.torch?.size_phren;
CONFIG.torch_interactive = CONFIG.torch?.size_interactive;
CONFIG.torch_media_dim   = CONFIG.torch?.size_media_dim;
