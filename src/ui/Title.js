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

    /** La colonne est-elle éclipsée (carte du parcours dépliée) ? */
    this._eclipsee = false;
    /** Jeton d'éclipse — voir eclipse(). */
    this._jetonEclipse = 0;
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

    /* ÉCRIRE SOUS UNE CARTE OUVERTE. On peut entrer dans une scène pendant que
       la carte est dépliée : le nouveau titre s'écrirait alors par-dessus elle.
       Les caractères naissent effacés (style.css : .char et .sep à opacity 0) —
       il suffit donc de ne pas lancer l'écriture. C'est eclipse(false) qui les
       posera, un à un, quand la carte se refermera. */
    if (this._eclipsee) return;
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

  /* ══════════════════════════════════════════ S'effacer, sans partir ══ */

  /**
   * LA CARTE PREND LA PLACE DES TITRES. Dépliée, elle occupe exactement le coin
   * où ils s'écrivent : ils s'en vont le temps qu'elle est ouverte, et
   * reviennent quand elle se referme.
   *
   * ⚠️ CE N'EST PAS UN FONDU, C'EST UN GESTE ÉCRIT. Le titre du site est fait
   * de caractères qui s'écrivent un à un ; le faire disparaître d'un bloc
   * d'opacité serait le seul endroit du site où sa typographie ne compterait
   * plus. Les caractères refluent donc du DERNIER vers le premier, devant la
   * carte qui se déplie depuis la gauche, et reviennent du premier au dernier,
   * comme ils s'écrivent. Cadences : TIMING.titre_eclipse_* et titre_retour_*.
   *
   * ⚠️ C'EST UNE ÉCLIPSE, PAS UN EFFACEMENT — le même mot et la même idée que
   * ArrowBase.eclipse() : le contenu reste en place. Vider les titres ici
   * obligerait la carte à savoir les réécrire, donc à connaître la scène
   * courante ; et un titre de niveau 2 posé PENDANT que la carte est ouverte
   * (on peut entrer dans une scène ainsi) serait perdu. Avec une éclipse, il
   * s'écrit normalement dessous et paraît à la fermeture.
   *
   * @param {boolean} masquee
   * @returns {number} la DURÉE du geste, en ms. La carte s'en sert pour ne
   *   construire son dessin qu'une fois la place libre — voir CompassMap.
   *   C'est l'idiome déjà employé par DocumentOverlay.close() et
   *   CompassMap._fold() : celui qui joue un geste dit combien il lui faut.
   */
  eclipse(masquee) {
    this._eclipsee = !!masquee;
    const jeton = ++this._jetonEclipse;
    const T = this.config.TIMING;

    if (masquee) {
      /* LA CARTE CHASSE LE TITRE. Les caractères s'en vont un à un, du DERNIER
         vers le premier, chacun soulevé de quelques pixels : la carte se déplie
         depuis la gauche, le titre reflue devant elle. Les niveaux 2 et 3,
         blocs d'un seul tenant, partent ensemble et sans attendre — c'est ce
         décalage entre les deux gestes qui fait une sortie plutôt qu'un fondu. */
      this._sousTitres((el) => {
        el.style.transition = `opacity ${T.titre_eclipse_ms}ms ease, ` +
                              `transform ${T.titre_eclipse_ms}ms cubic-bezier(0.55,0,0.45,1)`;
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(-6px)';
      });
      this._chars().reverse().forEach((s, i) => {
        s.style.transition = `opacity ${T.titre_eclipse_ms}ms ease, ` +
                             `transform ${T.titre_eclipse_ms}ms cubic-bezier(0.55,0,0.45,1)`;
        setTimeout(() => {
          if (jeton !== this._jetonEclipse) return;
          s.style.opacity   = '0';
          s.style.transform = 'translateY(-8px)';
        }, i * T.titre_eclipse_pas);
      });
      // Le dernier caractère part au bout de (n-1) pas, et son geste dure
      // titre_eclipse_ms : voilà quand la place est vraiment libre.
      return this._duree(T.titre_eclipse_ms, T.titre_eclipse_pas);
    }

    /* LE TITRE REVIENT COMME IL S'ÉCRIT — du premier caractère au dernier :
       c'est la même main qui repose ce qu'elle avait retiré. Les sous-titres
       suivent, une fois le titre lancé. */
    this._chars().forEach((s, i) => {
      const sep = s.classList.contains('sep');
      s.style.transition = `opacity ${T.titre_retour_ms}ms ease, ` +
                           `transform ${T.titre_retour_ms}ms cubic-bezier(0.16,1,0.3,1)`;
      setTimeout(() => {
        if (jeton !== this._jetonEclipse) return;
        // Les tirets ne montent pas à 1 : ils vivent en retrait (cf. _ecrire).
        s.style.opacity   = sep ? '0.6' : '1';
        s.style.transform = 'translateY(0)';
      }, i * T.titre_retour_pas);
    });

    setTimeout(() => {
      if (jeton !== this._jetonEclipse) return;
      this._sousTitres((el) => {
        el.style.transition = `opacity ${T.titre_retour_ms}ms ease, ` +
                              `transform ${T.titre_retour_ms}ms cubic-bezier(0.16,1,0.3,1)`;
        el.style.opacity    = '';
        el.style.transform  = '';
      });
    }, T.titre_retour_pas * 3);

    /* ⚠️ LES STYLES EN LIGNE DES SOUS-TITRES NE DOIVENT PAS SURVIVRE AU GESTE.
       Le sous-titre a sa propre transition (1,1 s, après 0,3 s d'attente) : la
       laisser remplacée changerait, pour tout le reste de la scène, la façon
       dont il s'en va. On la rend à la feuille une fois le geste fini — et le
       jeton garantit qu'une éclipse plus récente ne se fasse pas défaire par le
       nettoyage d'une plus ancienne. Les caractères du titre, eux, GARDENT leur
       opacité en ligne : c'est ainsi qu'ils sont écrits (voir _ecrire). */
    const total = this._duree(T.titre_retour_ms, T.titre_retour_pas);
    setTimeout(() => {
      if (jeton !== this._jetonEclipse) return;
      this._sousTitres((el) => { el.style.transition = ''; });
    }, total + 40);

    return total;
  }

  /** Durée d'un geste échelonné : le dernier caractère part au bout de (n-1) pas. */
  _duree(ms, pas) {
    return ms + Math.max(0, this._chars().length - 1) * pas;
  }

  /**
   * REMISE À PLAT DE L'ÉCLIPSE — instantanée, sans geste.
   *
   * Appelée à la frontière, dans le noir. C'est la GARANTIE qui rend le
   * séquencement de la carte sans danger : celui-ci fait revenir les titres par
   * une minuterie, et une minuterie peut être annulée (changement de scène
   * pendant un repli, boussole démontée…). Sans cette remise à plat, un titre
   * pourrait rester éclipsé pour toute la scène suivante — panne silencieuse et
   * durable. Ici, on ne joue rien : on rend l'état neuf.
   */
  resetEclipse() {
    this._eclipsee = false;
    this._jetonEclipse++;                     // périme tout geste en vol
    [this.el, this.subEl, this.partEl].forEach(el => {
      if (el) el.style.transition = '';
    });
    this._sousTitres((el) => { el.style.opacity = ''; el.style.transform = ''; });
  }

  /* ═══════════════════════════════ La place laissée par la boussole ══ */

  /**
   * LA COLONNE SE REFERME QUAND LA BOUSSOLE N'EST PAS LÀ.
   *
   * Les titres s'écrivent à droite de la boussole ; tant qu'elle n'est pas
   * dessinée — au tout début d'une scène, pendant un média, quand la carte est
   * désactivée — cette place reste vide et la colonne paraît décrochée du bord.
   * Les titres viennent donc l'occuper, et GLISSENT vers la droite quand la
   * boussole se dessine.
   *
   * Le glissement est porté par le CSS (transition sur `left`, cadence
   * MAP.titres_glisse) : on ne fait ici que nommer la position visée. Deux
   * variables, deux places, aucune interpolation en JS.
   *
   * ⚠️ On n'anime PAS `transform` : les niveaux 2 et 3 s'en servent déjà pour
   * leurs propres gestes (l'entrée qui monte, la sortie écrite du chapitre 1
   * qui remonte de 6 px), et un style en ligne écraserait l'autre.
   *
   * @param {boolean} avecBoussole
   */
  decaler(avecBoussole) {
    document.documentElement.style.setProperty(
      '--col-titres-courant',
      avecBoussole ? 'var(--col-titres)' : 'var(--col-titres-seul)');
  }

  /** Les caractères du titre de niveau 1, dans l'ordre où il s'écrit. */
  _chars() {
    return [...(this.el?.querySelectorAll('.char, .sep') ?? [])];
  }

  /** Applique un geste aux niveaux 2 et 3, d'un seul tenant. */
  _sousTitres(fn) {
    [this.subEl, this.partEl].forEach((el) => { if (el) fn(el); });
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
