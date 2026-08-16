/**
 * Title.js — LA COLONNE DE TITRES, EN HAUT À GAUCHE.
 * ─────────────────────────────────────────────────────────────────────────────
 * TROIS NIVEAUX, UN SEUL PROPRIÉTAIRE.
 *
 *   #site-title          « Abounaddara — CNRS — 2026 »  ou  « Espace collaboratif »
 *   #chapitre-subtitle   le sous-titre du chapitre          (tier 2)
 *   #chapitre-part-title le titre de la sous-partie         (tier 3)
 *
 * ⚠️ LE NIVEAU 1 NE SE DEVINE PLUS, IL SE DÉCLARE. Il était naguère basculé
 * par CollaborationScene : « si je viens d'un chapitre, je ne reswape pas »
 * à l'entrée, « si je vais au musée, je rétablis » à la sortie. Deux devinettes
 * sur la scène d'à-côté — exactement le défaut qui avait déjà valu au son sa
 * table AMBIANCE. Elles étaient vraies tant qu'on ne pouvait aller à un
 * chapitre QUE par l'espace collaboratif. La carte du parcours a ouvert
 * d'autres routes, et le défaut est apparu tel quel : aller de la phrénologie
 * DIRECTEMENT au chapitre 2, c'est ne jamais passer par CollaborationScene —
 * le chapitre s'affichait donc sous « Abounaddara — CNRS — 2026 ». Et dans
 * l'autre sens, revenir d'un chapitre à la vitrine gardait « Espace
 * collaboratif » au-dessus du musée.
 *
 * Désormais chaque scène DÉCLARE son titre dans la table LIEUX d'app.js, et
 * c'est la FRONTIÈRE — le noir entre exit() et enter() — qui l'applique. Une
 * bascule ne se voit donc jamais : elle a lieu là où il n'y a rien à voir.
 * (C'est ce qui a permis de retirer le fondu-vers-le-haut `fading-out` et son
 * réglage TITLE_SWAP_MS : 620 ms d'attente avant un geste que personne ne
 * regardait.)
 *
 * Les niveaux 2 et 3, eux, appartiennent à la scène qui les pose — mais la
 * frontière les REMET À ZÉRO, systématiquement : un sous-titre de chapitre ne
 * peut plus survivre au chapitre qui l'a écrit, quel que soit le chemin pris.
 */

export class Title {
  constructor(config) {
    this.config  = config;
    this.el      = document.getElementById('site-title');
    this.subEl   = document.getElementById('chapitre-subtitle');
    this.partEl  = document.getElementById('chapitre-part-title');

    /** Titre de niveau 1 actuellement posé ('site' | 'collab' | null). */
    this._pose = null;
  }

  /* ═══════════════════════════════════════════════ NIVEAU 1 — le site ══ */

  /**
   * Pose le titre de niveau 1. IDEMPOTENT : redemander celui qui est déjà là
   * ne rejoue pas son écriture (sans quoi le titre se retaperait à chaque
   * passage d'une scène du musée à une autre).
   *
   * @param {'site'|'collab'} genre
   */
  set(genre) {
    if (!this.el) return;
    if (this._pose === genre) return;

    // La toute PREMIÈRE apparition prend son souffle (TIMING.title_start) :
    // c'est l'ouverture du site. Les bascules suivantes se font dans le noir,
    // il n'y a plus rien à faire attendre.
    const depart = this._pose === null ? this.config.TIMING.title_start : 0;
    this._pose   = genre;

    this._applyFont(this.el, this.config.FONTS?.title);
    this.el.innerHTML = this._html(genre);
    this._ecrire(depart);
  }

  /** Le balisage du titre : des <span> par caractère, des <span.sep> par tiret. */
  _html(genre) {
    const mots = genre === 'collab'
      ? [this.config.TITLE.collab]
      : this.config.TITLE.texte;

    let html = '', i = 0;
    mots.forEach(part => {
      if (part === '—') { html += '<span class="sep">—</span>'; return; }
      for (const ch of part) {
        html += `<span class="char" data-i="${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`;
        i++;
      }
    });
    return html;
  }

  /** L'écriture caractère par caractère, cadencée par TIMING. */
  _ecrire(depart) {
    const T = this.config.TIMING;
    this.el.querySelectorAll('.char').forEach((s, i) => {
      setTimeout(() => {
        s.style.opacity   = '1';
        s.style.transform = 'translateY(0)';
      }, depart + i * T.title_char_delay + Math.random() * 20);
    });
    this.el.querySelectorAll('.sep').forEach((s, i) => {
      setTimeout(() => { s.style.opacity = '0.6'; }, depart + (i + 1) * 340);
    });
  }

  /* ══════════════════════════════════════ NIVEAUX 2 & 3 — le chapitre ══ */

  /**
   * Sous-titre de chapitre (niveau 2).
   * @param {string} texte
   * @param {number} [delai]  temporisation avant l'apparition, pour ne pas
   *                          chevaucher le fondu d'entrée de la scène. Le
   *                          chapitre 1 passe 0 : il écrit derrière un voile
   *                          encore opaque, qui s'ouvrira ensuite.
   */
  showSubtitle(texte, delai = 400) {
    this._poser(this.subEl, texte, delai);
  }

  /** @param {boolean} immediat true → coupe net, false → laisse jouer la sortie CSS. */
  hideSubtitle(immediat = true) { this._retirer(this.subEl, immediat); }

  /** Titre de sous-partie (niveau 3). Deux frames d'attente : le DOM de la
   *  sous-partie vient d'être posé, la transition CSS doit avoir de quoi partir. */
  showPart(texte) {
    if (!this.partEl || !texte) return;
    this.partEl.innerHTML = texte;
    this._applyFont(this.partEl, this.config.FONTS?.subtitle);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.partEl.classList.add('visible');
    }));
  }

  hidePart(immediat = false) { this._retirer(this.partEl, immediat); }

  /**
   * REMISE À ZÉRO DES NIVEAUX 2 ET 3 — appelée à la frontière, dans le noir.
   *
   * Chaque chapitre retire déjà les siens en sortant ; ceci est la GARANTIE,
   * au même titre que le silence : ce qui n'est pas redéclaré par la scène qui
   * arrive n'est pas à l'écran. Une scène qui oublierait ne peut plus laisser
   * son sous-titre à la suivante.
   */
  clearChapter() {
    [this.subEl, this.partEl].forEach(el => {
      if (!el) return;
      el.style.transition = 'none';
      el.classList.remove('visible');
      el.innerHTML = '';
      /* ⚠️ ON EFFACE AUSSI LES STYLES EN LIGNE. La sortie écrite du chapitre 1
         estompe son sous-titre en posant `opacity:0` et `transform` À LA MAIN
         (un geste qui lui appartient : il remonte, quand le geste ordinaire
         descend). Elle les nettoie 900 ms plus tard — mais si l'on a quitté la
         scène entre-temps, ce nettoyage n'a jamais lieu et l'`opacity:0` reste
         sur l'élément PARTAGÉ. Le sous-titre du chapitre suivant recevrait bien
         sa classe .visible, et resterait pourtant invisible : un style en ligne
         bat toujours une feuille. */
      el.style.opacity   = '';
      el.style.transform = '';
      requestAnimationFrame(() => { el.style.transition = ''; });
    });
  }

  /* ═════════════════════════════════════════════════════════ Communs ══ */

  _poser(el, texte, delai) {
    if (!el || !texte) return;
    el.innerHTML = texte;
    this._applyFont(el, this.config.FONTS?.subtitle);
    if (delai > 0) setTimeout(() => el.classList.add('visible'), delai);
    else el.classList.add('visible');
  }

  _retirer(el, immediat) {
    if (!el) return;
    if (immediat) {
      el.style.transition = 'none';
      el.classList.remove('visible');
      requestAnimationFrame(() => { el.style.transition = ''; });
    } else {
      el.classList.remove('visible');   // laisse jouer la transition CSS de sortie
    }
  }

  /** Applique une fonte de CONFIG.FONTS à un élément, taille comprise. */
  _applyFont(el, f) {
    if (!el || !f) return;
    el.style.fontFamily    = f.family;
    el.style.fontSize      = this._taille(f) + 'px';
    el.style.fontWeight    = f.weight;
    el.style.letterSpacing = f.spacing;
    el.style.fontStyle     = f.style;
    if (f.color) el.style.color = f.color;
  }

  _taille(f) {
    const vW = Math.max(this.config.MIN_SIZE.width, window.innerWidth);
    return Math.max(f.size_min, Math.min(f.size_max, Math.round(vW * f.size_vw / 100)));
  }

  /**
   * Recalcule les tailles au redimensionnement. UN SEUL appelant est
   * nécessaire — app.js, au resize global : les trois niveaux appartiennent à
   * ce composant, plus aux scènes. (Chaque scène en portait sa propre copie,
   * et aucune ne traitait tout à fait les mêmes éléments.)
   *
   * On ne touche QUE la taille : la couleur du niveau 1 et la visibilité des
   * niveaux 2 et 3 appartiennent à l'état courant, pas au redimensionnement.
   */
  resize() {
    const ft = this.config.FONTS?.title;
    if (ft && this.el?.innerHTML) this.el.style.fontSize = this._taille(ft) + 'px';

    const fs = this.config.FONTS?.subtitle;
    if (!fs) return;
    [this.subEl, this.partEl].forEach(el => {
      if (el?.innerHTML) el.style.fontSize = this._taille(fs) + 'px';
    });
  }
}
