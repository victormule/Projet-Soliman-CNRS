/* =====================================================================
   Chapitre 2 — « L'héritage colonial du musée »
   chp2-config.js — Paramètres du chapitre (aucune logique moteur)

   Source unique de vérité pour tout ce qui se règle sans toucher au code
   du chapitre 2 : sous-titre, titres de sous-parties, lumières « bougie »
   de l'opening, ambiance de l'installation « Invisibilisation », timings.

   Consommé par : src/scenes/Chapitre2Scene.js (import aliasé CHP2),
   chp2-src/chp2-opening.js (light) et chp2-src/chp2-invisibilisation.js
   (invisibilisation). Même convention que Chapitre3/chp3-src/chp3-config.js.
   ===================================================================== */

export const CONFIG = {

  // Sous-titre (tier 2) affiché sous « Espace collaboratif » dès l'entrée.
  subtitle: 'L’héritage colonial du musée',

  // Titres de sous-partie (tier 3) — affichés en plus du sous-titre quand on
  // entre dans une sous-partie, masqués quand on en sort. Clés = identifiants
  // internes utilisés par Chapitre2Scene / les modules chp2.
  parts: {
    invisibilisation:    '',
    'peine-demesuree': '',
    cartel:            '',
  },

  // Timings de l'intégration SPA.
  //   skip_btn_delay : délai avant apparition du bouton « Passer » (ms).
  timing: {
    skip_btn_delay: 2000,
  },

  // ── Lumières « bougie » de l'opening (travelling avec les crânes) ──────
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
  invisibilisation: {
    fluteVol:    0.30,
    fluteFadeMs: 1500,
    exitFadeMs:  2500,
  },

};
