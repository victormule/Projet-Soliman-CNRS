/* =====================================================================
   Chapitre 2 — chp2-data-peine-demesuree.js
   Données éditoriales de « Une peine démesurée » (aucune logique).

   mediaMap : médias ouverts au clic sur les mots-clefs de l'article
   (data-key des <span class="mot-clef"> du template — voir chp2-dom.js).
   Chaque entrée : type ('video'|'audio'), src, et légende (crédits)
   affichée sous le média. Modèle : chp2-data-violence-et-trace.js.
   ===================================================================== */

const MEDIA_BASE = 'Chapitre2/chp2-medias/';

export const mediaMap = {
    condamne:  { type:'video', src:MEDIA_BASE+'Demesure.mp4',
        legende:{ nom:'Ambre & Flavien', role:'Lycéens',
            projet:'Les Restes Humains Patrimonialisés, héritage, éthique et politique',
            soustitre:'Dénouer les images manquantes de Soliman Al-Halabi',
            citation:'« Le Syrien fanatique »', copyright:'CNRS — Abounaddara 2025–2026' }},
    souffrance:{ type:'audio', src:MEDIA_BASE+'temoignage-guillaume.mp3' },
    bourreau:  { type:'video', src:MEDIA_BASE+'ame-noire.mp4',
        legende:{ nom:'Mathieu', role:'Lycéen',
            projet:'Les Restes Humains Patrimonialisés, héritage, éthique et politique',
            soustitre:'Dénouer les images manquantes de Soliman Al-Halabi',
            citation:'« Le Syrien fanatique »', copyright:'CNRS — Abounaddara 2025–2026' }},
    supplice:  { type:'video', src:MEDIA_BASE+'Au-tribunal.mp4',
        legende:{ nom:'Ambre & Garance', role:'Lycéennes',
            projet:'Les Restes Humains Patrimonialisés, héritage, éthique et politique',
            soustitre:'Dénouer les images manquantes de Soliman Al-Halabi',
            citation:'« Le Syrien fanatique »', copyright:'CNRS — Abounaddara 2025–2026' }},
};
