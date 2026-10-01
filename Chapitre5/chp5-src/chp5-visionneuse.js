import { CONFIG } from './chp5-config.js';
/* Le choix de la source vidéo passe par le site, jamais en direct : sur un
   téléphone c'est la variante allégée de `mobile/` qui doit partir, avec son
   repli sur l'original si elle manque (cf. « Vidéos : allégées sur mobile »). */
import { setVideoSrc } from '../../src/utils/media.js';

/**
 * LA FENÊTRE DES PIÈCES — vitrine du chapitre V
 * ═══════════════════════════════════════════════════════════════════════════
 * Une petite boîte s'ouvre : un RECTANGLE BLANC se trace au milieu de l'écran,
 * et c'est seulement dans ce cadre déjà dessiné que la pièce apparaît. C'est
 * le geste des documents de la phrénologie (`DocumentOverlay`) et du lecteur
 * du chapitre 1 (`MediaPlayer`) — d'abord le trait, ensuite ce qu'il contient.
 * Le cartel (le titre seul, sans code de dossier) paraît dessous, la croix en
 * haut à droite.
 *
 * ⚠️ LE CADRE SE TRACE EN PIXELS RÉELS, SANS `pathLength` NI
 * `non-scaling-stroke`. C'est l'avertissement de `DocumentOverlay` : combinés,
 * les deux faussent la longueur de tirets, et le trait n'arrive pas à se
 * refermer (ou se referme d'un coup). On pose donc un viewBox égal à la taille
 * du cadre et un `stroke-dasharray` égal à son périmètre, recalculés à chaque
 * mise en place.
 *
 * ⚠️ UNE PRISE DE SON SE JOUE COMME AU CHAPITRE 1 : un cercle tracé avec son
 * triangle de lecture, et la sinusoïde vivante lue sur un `AnalyserNode`
 * (mêmes couleurs, même épaisseur : `CONFIG.PLAYER`, la source unique du
 * lecteur du site). Le contexte audio est CELUI DU SITE (`AudioManager`) —
 * jamais un second — et s'il manque, le son se joue quand même : seule la
 * courbe reste éteinte. Un agrément visuel ne coûte jamais la lecture.
 *
 * ⚠️ POURQUOI PAS `MediaPlayer` LUI-MÊME ? Il écrit dans `#media-player`, qui
 * vit dans `#app` : vu de `#chapitre5-root` (contexte d'empilement à z 500),
 * il est ENTERRÉ — la raison même qui a valu à la torche de la vitrine son
 * propre canevas. On reprend son dessin, pas son élément.
 *
 * ⚠️ TROIS SORTIES : la croix, le clic hors du cadre, Échap. Le focus revient
 * à la boîte qu'on a ouverte.
 *
 * ⚠️ UN `<video>`/`<audio>` NON LIBÉRÉ RETIENT TOUT SON ARBRE (règle d'août
 * 2026) : la pièce est VIDÉE à chaque fermeture — source retirée, `load()`
 * rappelé, nœuds du graphe audio débranchés.
 */
export function creerVisionneuse({ conteneur, audioManager = null, reduceMotion = false, onEtat }) {
  // La fenêtre est COMMUNE à la vitrine et à l'inhumation : elle a sa propre
  // section dans la config (⑩), et ne dépend d'aucun des deux lieux.
  const F = CONFIG.fenetre;
  const DOSSIER = F.pieces;
  const TEXTES = CONFIG.textes;
  const P = window.CONFIG.PLAYER;

  const controller = new AbortController();
  const timers = new Set();
  let disposed = false;
  let ouverte = null;       // la pièce affichée, ou null
  let genreOuvert = null;   // son genre : c'est lui qui dit si elle a un son
  let appelante = null;     // la boîte qu'on a cliquée — le focus lui revient
  let son = null;           // la prise de son en cours : élément, graphe, courbe
  let tracant = false;      // le rectangle est en train de se tracer

  const on = (cible, type, handler, options) =>
    cible.addEventListener(type, handler, { ...options, signal: controller.signal });

  function planifier(fn, delai) {
    const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, delai);
    timers.add(id);
    return id;
  }
  function annulerMinuteries() {
    timers.forEach(clearTimeout);
    timers.clear();
    tracant = false;
  }

  /** Le genre se LIT de l'extension — il ne s'écrit nulle part ailleurs. Une
      carte, elle, se reconnaît à sa clé : elle porte une URL, pas un fichier. */
  function genre(item) {
    if (item.carte) return 'carte';
    const piece = item.piece;
    const extension = piece.slice(piece.lastIndexOf('.') + 1).toLowerCase();
    if (extension === 'mp4' || extension === 'webm') return 'video';
    if (extension === 'mp3' || extension === 'm4a' || extension === 'wav') return 'son';
    if (extension === 'pdf') return 'texte';
    console.warn('[chp5] Piece « ' + piece + ' » : extension inconnue, elle sera montree comme un texte.');
    return 'texte';
  }

  /* ── LE GABARIT ──────────────────────────────────────────────────────── */

  conteneur.innerHTML = `
    <div class="doc-voile" id="chp5-docVoile"></div>
    <div class="doc-scene" id="chp5-docScene">
      <figure class="doc-cadre" id="chp5-docCadre">
        <svg class="doc-trait" id="chp5-docTrait" aria-hidden="true"><rect x=".5" y=".5"></rect></svg>
        <div class="doc-piece" id="chp5-docPiece"></div>
      </figure>
      <figcaption class="doc-cartel" id="chp5-docCartel">
        <span class="doc-titre" id="chp5-docTitre"></span>
        <a class="doc-repli" id="chp5-docRepli" target="_blank" rel="noopener" hidden>Ouvrir le document dans un nouvel onglet</a>
      </figcaption>
    </div>
    <button class="doc-croix" id="chp5-docCroix" type="button" aria-label="${TEXTES.fermerDocument}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <line x1="6" y1="6" x2="18" y2="18"></line>
        <line x1="18" y1="6" x2="6" y2="18"></line>
      </svg>
    </button>`;

  const ref = id => conteneur.querySelector('#chp5-' + id);
  const voile = ref('docVoile');
  const scene = ref('docScene');
  const cadre = ref('docCadre');
  const trait = ref('docTrait');
  const rect = trait.querySelector('rect');
  const piece = ref('docPiece');
  const titre = ref('docTitre');
  const repli = ref('docRepli');
  const croix = ref('docCroix');

  conteneur.style.setProperty('--doc-voile', String(F.voile));
  conteneur.style.setProperty('--doc-ouvre', F.ouvreMs + 'ms');
  conteneur.style.setProperty('--doc-ferme', F.fermeMs + 'ms');
  conteneur.style.setProperty('--doc-revele', Math.round(F.traceMs * F.revele) + 'ms');
  conteneur.style.setProperty('--doc-trait', P.stroke);
  conteneur.style.setProperty('--doc-bouton', P.btn_color);
  conteneur.style.setProperty('--doc-bouton-survol', P.btn_color_hover);

  /* ── LA PLACE DU CADRE ───────────────────────────────────────────────────
     Chaque genre a SA boîte, parce qu'on n'y fait pas la même chose :
      · une vidéo garde son format, bornée par `largeur` et `hauteur` — c'est
        la contrainte la plus SERRÉE qui décide ;
      · un texte se LIT : il prend la largeur (`largeurTexte`) et presque
        toute la hauteur, et défile dans le lecteur du navigateur. Borné au
        format A4, il ne faisait que 440 px de large en 16/9, et la loi ne se
        lisait qu'en plissant les yeux ;
      · une prise de son n'a rien à montrer que sa courbe : un bandeau
        (`largeurSon`, `rapportSon`), comme au chapitre 1. */
  function mesures(genrePiece, media) {
    const vw = conteneur.clientWidth;
    const vh = conteneur.clientHeight;
    if (genrePiece === 'texte') {
      return { w: vw * F.largeurTexte / 100, h: vh * F.hauteurTexte / 100 };
    }
    if (genrePiece === 'carte') {
      return { w: vw * F.largeurCarte / 100, h: vh * F.hauteurCarte / 100 };
    }
    if (genrePiece === 'son') {
      const w = vw * F.largeurSon / 100;
      return { w, h: w / F.rapportSon };
    }
    const vwv = media?.videoWidth;
    const vhv = media?.videoHeight;
    const rapport = vwv && vhv ? vhv / vwv : 9 / 16;
    let w = vw * F.largeur / 100;
    let h = w * rapport;
    const plafond = vh * F.hauteur / 100;
    if (h > plafond) { h = plafond; w = h / rapport; }
    return { w, h };
  }

  /** Pose le cadre et (re)trace le rectangle — animé à l'ouverture, net au
      redimensionnement ou quand une vidéo annonce son vrai format. */
  function poser(genrePiece, media, anime) {
    const mesure = mesures(genrePiece, media);
    const w = Math.round(mesure.w);
    const h = Math.round(mesure.h);
    if (w < 2 || h < 2) return;
    cadre.style.width = w + 'px';
    cadre.style.height = h + 'px';

    trait.setAttribute('viewBox', `0 0 ${w} ${h}`);
    rect.setAttribute('width', w - 1);
    rect.setAttribute('height', h - 1);
    const perimetre = 2 * (w + h);
    rect.style.strokeDasharray = String(perimetre);
    // ⚠️ UN TRACÉ EN COURS NE SE REPOSE PAS. Une vidéo déjà en cache annonce
    // son format (`loadedmetadata`) quelques millisecondes après le clic : la
    // reposer « net » coupait le trait au départ, et le rectangle paraissait
    // d'un bloc — tout le geste perdu. On ajuste la longueur, on laisse filer.
    if (!anime && tracant) {
      if (genrePiece === 'son') dimensionnerCourbe();
      return;
    }
    rect.style.transition = 'none';
    if (!anime || reduceMotion) {
      rect.style.strokeDashoffset = '0';
    } else {
      rect.style.strokeDashoffset = String(perimetre);
      tracant = true;
      planifier(() => { tracant = false; }, F.traceMs + 40);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (disposed || !ouverte) return;
        rect.style.transition = `stroke-dashoffset ${F.traceMs}ms cubic-bezier(0.4,0,0.2,1)`;
        rect.style.strokeDashoffset = '0';
      }));
    }
    if (genrePiece === 'son') dimensionnerCourbe();
  }

  /* ── LA PRISE DE SON — le lecteur du chapitre 1 ──────────────────────── */

  function monterSon(item, source) {
    const plaque = document.createElement('div');
    plaque.className = 'doc-son';

    // Le bouton : un cercle qui se TRACE, puis son triangle (ou ses deux barres).
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'doc-son-bouton';
    bouton.setAttribute('aria-label', TEXTES.lireOuPause + ' « ' + item.titre + ' »');
    bouton.innerHTML = `
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="doc-son-cercle" cx="50" cy="50" r="46"></circle>
        <polygon class="doc-son-lire" points="41,33 41,67 69,50"></polygon>
        <g class="doc-son-pause"><rect x="37" y="33" width="9" height="34"></rect><rect x="54" y="33" width="9" height="34"></rect></g>
      </svg>`;

    const courbe = document.createElement('canvas');
    courbe.className = 'doc-son-courbe';

    // Une ligne d'avancement, à peine visible, qu'on peut cliquer : deux
    // minutes de parole demandent qu'on puisse y revenir.
    const avance = document.createElement('div');
    avance.className = 'doc-son-avance';
    avance.innerHTML = '<span></span>';

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = source;

    plaque.append(bouton, courbe, avance);
    piece.append(plaque);

    son = { audio, source: null, analyser: null, raf: 0, courbe };

    // Le graphe d'analyse, SUR LE CONTEXTE DU SITE. ⚠️ createMediaElementSource
    // DÉTOURNE le son de l'élément vers le graphe : sans le brancher sur
    // `destination`, plus rien ne sort.
    const ac = audioManager?.getAudioContext?.() ?? null;
    if (ac) {
      try {
        son.source = ac.createMediaElementSource(audio);
        son.analyser = ac.createAnalyser();
        son.analyser.fftSize = 2048;
        son.source.connect(son.analyser);
        son.analyser.connect(ac.destination);
      } catch (erreur) {
        console.warn('[chp5] Analyse audio indisponible — le son se joue sans sa courbe.', erreur);
        son.source = son.analyser = null;
      }
    }

    const joue = enCours => plaque.classList.toggle('doc-son--joue', enCours);
    on(bouton, 'click', () => { if (audio.paused) lancer(); else audio.pause(); });
    on(audio, 'play', () => { joue(true); tracerCourbe(); });
    on(audio, 'pause', () => { joue(false); eteindreCourbe(); });
    // ⚠️ À LA FIN, LA FENÊTRE SE REFERME D'ELLE-MÊME : il n'y a plus rien à
    // voir, et l'on rend la vitrine — qui s'efface alors d'un pas.
    on(audio, 'ended', () => { joue(false); eteindreCourbe(); fermer(); });
    on(audio, 'timeupdate', () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        avance.firstElementChild.style.transform = `scaleX(${(audio.currentTime / audio.duration).toFixed(4)})`;
      }
    });
    on(avance, 'click', evenement => {
      if (!Number.isFinite(audio.duration)) return;
      const r = avance.getBoundingClientRect();
      audio.currentTime = Math.max(0, Math.min(1, (evenement.clientX - r.left) / r.width)) * audio.duration;
    });
    return audio;
  }

  function lancer() {
    if (!son) return;
    // Un contexte suspendu rendrait la lecture MUETTE une fois le son détourné
    // vers le graphe : on le réveille d'abord.
    son.analyser?.context.resume?.().catch(() => {});
    son.audio.play().catch(() => {});
  }

  function dimensionnerCourbe() {
    if (!son) return;
    const r = son.courbe.getBoundingClientRect();
    son.courbe.width = Math.max(2, Math.round(r.width));
    son.courbe.height = Math.max(2, Math.round(r.height));
  }

  /** La sinusoïde du chapitre 1, trait pour trait (cf. MediaPlayer._drawWaveform). */
  function tracerCourbe() {
    if (!son?.analyser || son.raf) return;
    const courant = son;
    const ctx = courant.courbe.getContext('2d');
    const donnees = new Uint8Array(courant.analyser.frequencyBinCount);
    const image = () => {
      if (son !== courant) return;
      courant.raf = requestAnimationFrame(image);
      courant.analyser.getByteTimeDomainData(donnees);
      const { width: w, height: h } = courant.courbe;
      ctx.clearRect(0, 0, w, h);
      ctx.beginPath();
      ctx.strokeStyle = P.wave_color;
      ctx.lineWidth = P.wave_width;
      const pas = w / donnees.length;
      donnees.forEach((v, i) => {
        const x = i * pas;
        const y = ((v / 128) - 1) * (h * 0.42) + h / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    image();
  }

  function eteindreCourbe() {
    if (!son) return;
    if (son.raf) cancelAnimationFrame(son.raf);
    son.raf = 0;
    son.courbe.getContext('2d').clearRect(0, 0, son.courbe.width, son.courbe.height);
  }

  /* ── MONTER ET DÉMONTER LA PIÈCE ─────────────────────────────────────── */

  function monterPiece(item) {
    const genrePiece = genre(item);
    piece.dataset.genre = genrePiece;

    if (genrePiece === 'carte') {
      // LA CARTE MENTALE — le cadre intégré du chapitre 4 (chp4-portal.js),
      // mêmes attributs. ⚠️ Son droit d'encadrement (`frame-ancestors`) se
      // règle dans l'AUTRE dépôt, soliman-map-v3 : un cadre vide ici, c'est
      // là-bas qu'il faut regarder.
      const cadreCarte = document.createElement('iframe');
      cadreCarte.className = 'doc-media';
      cadreCarte.src = item.carte;
      cadreCarte.title = item.titre;
      cadreCarte.referrerPolicy = 'no-referrer-when-downgrade';
      cadreCarte.allow = 'fullscreen';
      piece.appendChild(cadreCarte);
      repli.href = item.carte;
      repli.textContent = TEXTES.ouvrirCarte;
      repli.hidden = false;
      return { genre: genrePiece, media: null };
    }

    const source = DOSSIER + item.piece;

    if (genrePiece === 'video') {
      const video = document.createElement('video');
      video.className = 'doc-media';
      // ⚠️ PAS `video.src = source` : ce serait envoyer le master 1080p à un
      // téléphone. Les cinq films ont leur variante dans chp5-medias/mobile/.
      setVideoSrc(video, source);
      // ⚠️ L'AFFICHE N'EST PAS UNE COQUETTERIE. Quatre des cinq films s'ouvrent
      // sur un long fondu depuis le noir (luminance 16/255 encore à 3 s,
      // mesuré) : sans elle, la fenêtre montrait un rectangle noir et une barre
      // de lecture. Elle porte le MÊME nom que la vidéo, en .jpg : une vidéo
      // ajoutée sans la sienne se dénonce par une 404 au banc d'essai.
      video.poster = source.replace(/\.[^.]+$/, '.jpg');
      video.controls = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.preload = 'metadata';
      video.setAttribute('aria-label', item.titre);
      piece.appendChild(video);
      // Le cadre prend le format VRAI de la vidéo dès qu'il est connu — sans
      // retracer le trait : il est déjà dessiné, on l'ajuste.
      on(video, 'loadedmetadata', () => { if (ouverte === item) poser('video', video, false); });
      // Le film fini, la fenêtre se referme (cf. la prise de son).
      on(video, 'ended', () => { if (ouverte === item) fermer(); });
      // ⚠️ Un film ne démarre pas d'office : on l'ouvre, on voit son affiche,
      // puis on le lance.
      return { genre: genrePiece, media: video };
    }

    if (genrePiece === 'son') {
      // Une prise de son, elle, se lance comme au chapitre 1 : il n'y a rien
      // d'autre à regarder qu'elle.
      return { genre: genrePiece, media: monterSon(item, source) };
    }

    // ⚠️ UN TEXTE PASSE PAR LE LECTEUR PDF DU NAVIGATEUR. Une loi et un appel
    // se lisent, se cherchent et se zooment — ce qu'une image ne permet plus.
    const cadreTexte = document.createElement('iframe');
    cadreTexte.className = 'doc-media';
    // Sans barre ni vignettes : à cette largeur, le lecteur de Chrome ouvrait
    // son panneau de pages (un tiers du cadre) et affichait le NOM DE FICHIER
    // Word du document. La page seule, calée sur la largeur, se lit.
    cadreTexte.src = source + '#toolbar=0&navpanes=0&view=FitH';
    cadreTexte.title = item.titre;
    piece.appendChild(cadreTexte);
    // Le repli des navigateurs qui refusent un PDF en ligne — DANS LE CARTEL,
    // jamais sur la page : en bandeau, il masquait les dernières lignes.
    repli.href = source;
    repli.textContent = TEXTES.ouvrirDocument;
    repli.hidden = false;
    return { genre: genrePiece, media: null };
  }

  function demonterPiece() {
    if (son) {
      eteindreCourbe();
      son.audio.pause();
      son.audio.removeAttribute('src');
      son.audio.load();
      // ⚠️ `analyser = null` NE SUFFIT PAS (cf. MediaPlayer) : un nœud resté
      // branché sur le contexte du site y survit, avec son élément.
      try { son.source?.disconnect(); } catch { /* déjà débranché */ }
      try { son.analyser?.disconnect(); } catch { /* déjà débranché */ }
      son = null;
    }
    const media = piece.querySelector('video');
    if (media) {
      media.pause();
      media.removeAttribute('src');
      media.load();
    }
    piece.replaceChildren();
    piece.removeAttribute('data-genre');
    repli.hidden = true;
    repli.removeAttribute('href');
  }

  /* ── OUVRIR, FERMER ──────────────────────────────────────────────────── */

  function ouvrir(item, depuis = null) {
    if (disposed || !item) return;
    annulerMinuteries();
    if (ouverte) demonterPiece();

    ouverte = item;
    appelante = depuis;
    titre.textContent = item.titre;
    const monte = monterPiece(item);
    genreOuvert = monte.genre;

    conteneur.classList.add('doc--en-jeu');
    conteneur.inert = false;
    // Le cadre doit exister (visible, dimensionné) AVANT qu'on le trace.
    poser(monte.genre, monte.media, true);
    requestAnimationFrame(() => {
      if (!disposed && ouverte === item) conteneur.classList.add('doc--ouvert');
    });
    if (monte.genre === 'son') {
      // La lecture part quand la plaque paraît dans le cadre tracé.
      planifier(() => { if (ouverte === item) lancer(); }, reduceMotion ? 0 : F.traceMs * F.revele);
    }
    croix.focus({ preventScroll: true });
    onEtat?.(true);
  }

  function fermer() {
    if (!ouverte) return;
    ouverte = null;
    genreOuvert = null;
    son?.audio.pause();
    conteneur.classList.remove('doc--ouvert');
    conteneur.inert = true;
    onEtat?.(false);
    // Le focus revient à la boîte : sans cela il tombe sur `body` et l'on
    // perd sa place dans l'inventaire.
    if (appelante?.isConnected && !appelante.disabled) appelante.focus({ preventScroll: true });
    appelante = null;
    // On démonte APRÈS le fondu : couper le média à l'instant du clic ferait
    // clignoter un cadre vide pendant que la fenêtre s'en va.
    planifier(() => {
      demonterPiece();
      conteneur.classList.remove('doc--en-jeu');
    }, reduceMotion ? 0 : F.fermeMs);
  }

  on(croix, 'click', fermer);
  on(voile, 'click', fermer);
  on(scene, 'click', evenement => { if (evenement.target === scene) fermer(); });
  on(document, 'keydown', evenement => {
    if (evenement.key === 'Escape' && ouverte) { evenement.preventDefault(); fermer(); }
  });

  conteneur.inert = true;

  return {
    ouvrir,
    fermer,
    estOuverte: () => ouverte !== null,
    /** Une pièce qui PARLE est ouverte (prise de son, film) : l'ambiance du
        lieu s'efface devant elle. Un texte ou la carte se lisent dessous. */
    estSonore: () => genreOuvert === 'son' || genreOuvert === 'video',
    resize() {
      if (!ouverte) return;
      poser(genre(ouverte), piece.querySelector('video'), false);
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      annulerMinuteries();
      controller.abort();
      demonterPiece();
      ouverte = null;
      genreOuvert = null;
      conteneur.replaceChildren();
    },
  };
}
