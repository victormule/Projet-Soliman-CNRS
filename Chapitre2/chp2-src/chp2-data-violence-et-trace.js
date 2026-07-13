/**
 * Données du cartel et des diapositives.
 * Source unique de vérité : modifier ici se reflète dans le DOM généré.
 *
 * @typedef {Object} Entry
 * @property {string}   title     Titre de l'objet (peut contenir un retour à la ligne souple via \n)
 * @property {string}   source    Provenance (collection, don…)
 * @property {string}   ref       Numéro de référence (formaté avec espaces fines si besoin)
 * @property {number}   tilt      Inclinaison décorative en "demi-degrés" (multiplié par 0.3deg en CSS)
 * @property {boolean} [leftAlign] Si vrai, titre aligné à gauche (cas du dernier item, plus long)
 *
 * @typedef {Object} Slide
 * @property {'left'|'right'} dir   Côté d'apparition
 * @property {'video'|'audio'} type Type de média
 * @property {string} src           Source du média
 * @property {string} thumb         Image miniature (toujours visible au repos)
 * @property {string} caption       Légende sous la diapo
 * @property {number} tilt          Inclinaison en degrés
 * @property {string} top           Position verticale en % (CSS)
 */

/** @type {Entry[]} */
export const entries = [];

/** @type {Slide[]} */
export const slides = [
    {
        dir: "left",
        type: "video",
        src: "Chapitre2/chp2-medias/l-abribus.mp4",
        thumb: "Chapitre2/chp2-images/l-abribus.webp",
        caption: "L'Abribus",
        tilt: -8,
        top: "13%",
    },
    {
        dir: "left",
        type: "video",
        src: "Chapitre2/chp2-medias/les-corps-de-la-guerre.mp4",
        thumb: "Chapitre2/chp2-images/les-corps-de-la-guerre.webp",
        caption: "Les corps de la guerre",
        tilt: -4,
        top: "53%",
    },
    {
        dir: "right",
        type: "audio",
        src: "Chapitre2/chp2-medias/temoignage-guillaume-auxence.mp3",
        thumb: "Chapitre2/chp2-images/temoignage-guillaume.webp",
        caption: "Témoignage A. et G. lycéens",
        tilt: 6,
        top: "31%",
    },
];
