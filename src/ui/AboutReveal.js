/**
 * AboutReveal.js
 * -----------------------------------------------------------------------------
 * « À PROPOS » — mise en scène du texte fondateur du site (scène phrénologie).
 * Monté par DocumentOverlay quand le contenu est de type 'about'.
 *
 * Deux temps, comme une plaque que l'on grave puis une archive qui se révèle :
 *
 *   1. L'ACCROCHE — la question inaugurale s'écrit lettre à lettre, au tracé
 *      (stroke SVG), comme à l'encre. Le texte est JUSTIFIÉ : les lignes sont
 *      composées ICI, en JS, par mesure réelle des glyphes (canvas 2D) — le
 *      nombre de lignes s'adapte au texte et à la largeur, rien n'est codé en
 *      dur. Les mots-clefs (style 'gold') s'écrivent en blanc, s'embrasent,
 *      puis se déposent en doré — en ITALIQUE (la main, la personne) ou en
 *      ROMAIN GRAS si `engraved` (la pierre, l'institution) : la typographie
 *      distingue Soliman al-Halabi du général Kléber. Un segment `draft` est
 *      d'abord écrit sous un AUTRE mot, qui se fait raturer puis s'efface
 *      tandis que le mot juste se réécrit par-dessus (voir T.draft_*) ; le
 *      passage `underline: true` reçoit LE COUP (voir T.strike_*). La cadence
 *      ménage des temps d'arrêt : virgules, entrée et sortie des mots-clefs.
 *
 *   2. LE CORPS — l'accroche remonte en haut de la zone et le reste du texte
 *      se matérialise lettre par lettre dans un ordre aléatoire (décodage
 *      d'archive), en linéale (Inter), UN PARAGRAPHE À LA FOIS : chacun pleut
 *      à son tour, séparé du suivant par une respiration — le regard suit la
 *      lecture au lieu de recevoir la page entière d'un bloc. Les passages
 *      *entre astérisques* sont mis en relief et s'éclairent une fois posés.
 *
 * CONTRAT (règles du site) :
 *   - aucun effet de bord au chargement : tout se crée dans mount(), tout se
 *     défait dans destroy() (timers compris) ; le DOM est purgé par l'overlay ;
 *   - le CONTENU vient de CONFIG.DOCUMENTS.about (hook + paragraphs) ;
 *   - SANS ASCENSEUR sur grand écran : la taille du corps est ajustée pour que
 *     tout tienne dans la zone. Sur tactile / petit écran, le défilement est
 *     toléré (confort de lecture) ;
 *   - un clic sur le texte AVANCE la séquence (fast-forward), il ne ferme pas ;
 *   - prefers-reduced-motion : état final direct, sans chorégraphie.
 *
 * PERFORMANCE (règles tenues ici et dans le CSS associé) :
 *   - AUCUN filtre dans le SVG principal : les halos des mots-clefs sont des
 *     CLONES FLOUS superposés (_makeGlow) dont seule l'OPACITÉ est animée —
 *     le flou est calculé une fois, le reste est de la composition GPU ;
 *   - la pluie de lettres n'anime QUE l'opacité, sans text-shadow (posé en
 *     fin de séquence seulement), et les espaces ne sont pas animés ;
 *   - séquence posée → .ab-settled : toutes les animations sont remplacées
 *     par leur état final statique, la couche GPU du stack est rendue.
 *
 * Les DURÉES d'animation vivent dans style.css (section « À PROPOS ») ; ici ne
 * vivent que les DÉLAIS par lettre (posés en style inline) et la chronologie.
 */

const NS = 'http://www.w3.org/2000/svg';

/* Largeur logique du repère SVG. Tout est composé dans [0..SVG_W] puis mis à
   l'échelle par le viewBox : le redimensionnement est gratuit (les lignes
   restent justifiées à toute largeur d'écran). */
const SVG_W = 1000;

/* La réserve de tracé par glyphe (stroke-dasharray: 340) vit dans style.css
   (.ab-hook tspan). Elle doit dépasser la longueur du contour de n'importe
   quelle lettre à la taille composée (~32 unités), sinon le tracé se fend. */

/* Polices. L'accroche est composée en Playfair Display — la voix « titre » du
   site (écran d'accueil) ; le corps en Inter — la linéale déjà chargée.
   ⚠️ index.html charge Playfair en romain ET italique, 400 ET 700 : les quatre
   combinaisons utilisées ici (base 400 romain, mot-clef 700 italique, mot-clef
   `engraved` 700 romain) sont donc de vraies fontes, jamais synthétisées. */
const HOOK_FONT = '"Playfair Display", Georgia, serif';

/* Rayon des halos (clones flous), en unités logiques du viewBox — converti en
   px écran à la taille de composition. Voir _makeGlow. */
const GLOW_R = { white: 9, gold: 8, strike: 10 };

/* ── Chronologie (ms) — les délais par lettre sont CUMULÉS à la composition ──
   Régler ici le souffle général : cadences, temps d'arrêt, respirations. */
const T = {
  lead_in:     380,   // silence avant la première lettre (fondu de l'overlay)
  char:         48,   // cadence de base entre deux lettres
  word:         58,   // respiration entre deux mots
  comma:       380,   // temps d'arrêt après une virgule
  kw_before:   520,   // suspension avant un mot-clef (le geste se pose)
  kw_char:      84,   // cadence plus solennelle dans un mot-clef
  kw_after:    420,   // suspension après un mot-clef
  draw:        620,   // tracé d'une lettre           (= CSS abDraw)
  fill_lag:    430,   // l'encrage suit le tracé avec ce retard
  fill:        900,   // durée de l'encrage           (= CSS abFill*)
  gold_lag:    650,   // l'embrasement part une fois le mot entièrement encré
  gold:       1500,   // blanc → doré                 (= CSS abToGold)

  /* ── LE RATÉ (segment `draft`) — la main se corrige ──────────────────────
     Le brouillon s'écrit à la cadence ORDINAIRE (T.char) et dans la fonte de
     base : il doit avoir l'air d'être le bon mot, sinon il n'y a pas de
     correction, juste une décoration. La rature est un GESTE JETÉ (même attaque
     que la barre du coup), suivi d'une secousse et d'un temps d'arrêt.
     Elle reste néanmoins en-deçà du coup : secousse plus courte et surtout
     PAS d'éclat — l'incandescence appartient à « condamnation à mort ». Deux
     mains frappent, une seule condamne. */
  draft_lead:    420, // hésitation avant le mot que l'on va reprendre
  draft_read:    480, // le mot tient : on a le temps de le lire avant la rature
  scratch:       140, // la rature — geste jeté       (= CSS .ab-scratch)
  scratch_wave:   80, // retard de la secousse : le temps que la plume arrive
  scratch_shock: 240, // la secousse                  (= CSS abScratchShock)
  scratch_after: 520, // LE TEMPS D'ARRÊT — la main s'est arrêtée net
  erase:         460, // le brouillon s'efface        (= CSS abDraftErase)
  draft_overlap: 180, // le mot juste se réécrit PENDANT l'effacement : il
                      // émerge du brouillon qui s'en va, il ne le remplace
                      // pas après coup. Doit rester < erase.

  /* ── LE COUP (passage `underline: true`) — quatre temps ──────────────────
     1. LE SILENCE  : l'écriture s'arrête net (strike_hold). C'est LUI qui fait
        la violence, pas le trait : depuis 15 s le texte s'écrit à cadence
        métronomique, et soudain plus rien. Ne pas le raboter.
     2. LE COUP     : la barre s'abat (strike) — brève, donc portée, pas tracée.
     3. L'ONDE      : la plaque encaisse (strike_shock) et le mot blanchit
        (strike_flash), décalés de strike_wave — le temps que la barre arrive.
     4. LA RÉSONANCE: strike_after, puis la phrase REPREND. Le coup tombe au
        milieu de la phrase et la phrase continue quand même. */
  strike_hold:  520,  // silence après la dernière lettre soulignée
  strike:       130,  // la barre s'abat              (= CSS .ab-underline)
  strike_wave:   90,  // retard de l'onde : la barre est en train d'arriver
  strike_flash: 340,  // éclat blanc sur le mot       (= CSS abStrikeFlash)
  strike_shock: 280,  // secousse de la plaque        (= CSS abShock)
  strike_after: 620,  // résonance avant que la phrase reprenne

  breath:      950,   // respiration après l'accroche, avant la remontée
  body_lag:    550,   // la pluie de lettres démarre PENDANT la remontée
  body_spread: 4200,  // encre totale de la pluie, RÉPARTIE entre paragraphes
                      // (la cadence par lettre reste constante d'un bout à
                      //  l'autre : chaque paragraphe reçoit une fenêtre
                      //  proportionnelle à sa longueur)
  /* ── LE BATTEMENT — ce qui sépare deux paragraphes ───────────────────────
     Un filet doré s'ouvre du CENTRE vers ses deux extrémités, tient, puis
     s'efface pendant que le paragraphe suivant commence à pleuvoir. C'est la
     ponctuation propre au site (le filet vertical des légendes de documents,
     .doc-ov-caption::after, fait exactement ce geste) — reprise à l'horizontale.
     Il s'EFFACE : le battement est un événement dans le temps, pas un ornement.
     Le texte posé reste net. */
  body_gap:    820,   // le silence, une fois le paragraphe posé (le filet le
                      // remplit — il n'est donc jamais du temps mort)
  beat_lead:   120,   // le filet part DANS la traîne du paragraphe qui s'achève :
                      // il mène l'œil vers la suite au lieu d'attendre son tour
  beat:       1400,   // durée du battement           (= CSS abBeat)
  body_char:   640,   // fondu d'une lettre du corps  (= CSS abLetter)
  settle:      600,   // marge avant l'éclairage des passages en relief
};

export class AboutReveal {
  /**
   * @param {Object} config  window.CONFIG (bornes de police du corps, etc.)
   * @param {Object} data    CONFIG.DOCUMENTS.about ({ hook, paragraphs })
   */
  constructor(config, data) {
    this.config = config;
    this.data   = data;

    this.host  = null;   // article .doc-ov-about (fourni par l'overlay)
    this.stack = null;   // colonne accroche + corps (portée par la remontée)
    this.svg   = null;   // accroche calligraphiée (SVG principal, sans filtre)
    this.body  = null;   // corps du texte

    this._timers    = [];
    this._raf       = null;
    this._bodySpans = null;
    this._bodyEnd   = 0;      // fin de la dernière pluie (depuis .ab-live)
    this._kwTexts   = [];     // <text> des mots-clefs (survol après pose)
    this._kwGolds   = [];     // <svg> halos dorés (clones flous, un par mot-clef)
    this._hoverFns  = [];     // [el, type, fn] — listeners de survol à défaire
    this._hookWrap  = null;   // cadre positionnant SVG principal + halos
    this._blurTop   = null;   // bandes de flou haut/bas (indice de défilement)
    this._blurBot   = null;
    this._onScroll  = null;
    this._phase2At  = 0;      // instant de la remontée (depuis mount)
    this._phase2    = false;
    this._done      = false;
    this._skipped   = false;

    this._reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this._coarse  = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this._ctx     = document.createElement('canvas').getContext('2d');
  }

  /* ── Cycle de vie ──────────────────────────────────────────────────────── */

  /** Monte l'expérience dans `host` et lance la chorégraphie. */
  async mount(host) {
    this.host = host;

    // Bandes de flou haut/bas (indice de défilement) : collées aux bords de
    // la fenêtre de lecture par position:sticky, opacité pilotée par
    // _updateFade() selon la position de défilement.
    const blurTop = document.createElement('div');
    blurTop.className = 'ab-scrollblur top';
    host.appendChild(blurTop);
    this._blurTop = blurTop;

    const stack = document.createElement('div');
    stack.className = 'ab-stack';
    host.appendChild(stack);
    this.stack = stack;

    const blurBot = document.createElement('div');
    blurBot.className = 'ab-scrollblur bot';
    host.appendChild(blurBot);
    this._blurBot = blurBot;

    this._onScroll = () => this._updateFade();
    host.addEventListener('scroll', this._onScroll, { passive: true });

    // Le corps est construit d'abord : il participe à la mesure « tenir sans
    // ascenseur » (_fit) même s'il reste invisible pendant la phase 1.
    this._buildBody();

    // Les glyphes doivent être mesurés avec les VRAIES polices : on attend
    // leur chargement avant de composer les lignes (sinon les largeurs de
    // secours faussent la justification).
    try {
      await Promise.all([
        document.fonts.load(`400 32px ${HOOK_FONT}`),          // base
        document.fonts.load(`italic 700 32px ${HOOK_FONT}`),   // mot-clef (main)
        document.fonts.load(`700 32px ${HOOK_FONT}`),          // mot-clef gravé
        document.fonts.load('300 16px Inter'),
        document.fonts.load('500 16px Inter'),
      ]);
    } catch { /* métriques de secours : la composition reste correcte */ }
    if (!this.host) return;                    // détruit pendant l'attente

    this._buildHook();
    this._fit(false);

    // Fast-forward demandé pendant le chargement des polices : on saute
    // directement à l'état final (les animations sont écrasées par .ab-skip).
    // ⚠️ Le skip() a eu lieu AVANT que _buildHook ne pose ses timers (coup,
    // mots-clefs) : son _clearTimers() n'a rien pu annuler. On purge donc ici,
    // sinon la plaque tremblerait toute seule sur un texte déjà posé.
    if (this._skipped) { this._clearTimers(); this._markKwSet(); return; }

    this._start();
  }

  /**
   * Réajuste taille du corps et centrage (appelé par l'overlay au resize).
   * L'accroche n'est PAS recomposée en cours de lecture : le viewBox la met à
   * l'échelle, la justification est préservée par construction.
   */
  resize() {
    if (!this.host || !this.svg) return;
    this._fit(true);
  }

  /** Avance la séquence à son état final (clic sur le texte). */
  skip() {
    if (this._done || !this.host) return;
    this._skipped = true;
    this._clearTimers();
    this.host.classList.add('ab-skip');        // animations SVG → état final
    this._markKwSet();

    if (!this._phase2) {
      this._phase2 = true;
      this.host.classList.add('ab-phase2');
      if (this.stack) this.stack.style.transform = 'translateY(0px)';
    }

    // Pluie de lettres resserrée : le corps se pose en ~0,8 s. Les délais sont
    // réattribués dans l'ordre de _bodySpans (paragraphe après paragraphe) :
    // le fast-forward balaie le texte dans le sens de la lecture.
    if (this.body && this._bodySpans) {
      const n = Math.max(1, this._bodySpans.length);
      this._bodySpans.forEach((s, i) => {
        s.style.animationDelay = Math.round(i * 700 / n) + 'ms';
      });
      this.body.classList.add('ab-live');
    }
    // Après la dernière lettre (délai max 700 + fondu 420) : état posé.
    this._addTimer(() => this._setDone(), 1250);
  }

  /** Démonte timers, listeners et références. Le DOM est purgé par l'overlay. */
  destroy() {
    this._clearTimers();
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    if (this.host && this._onScroll) {
      this.host.removeEventListener('scroll', this._onScroll);
    }
    this._onScroll = null;
    this._hoverFns.forEach(([el, type, fn]) => el.removeEventListener(type, fn));
    this._hoverFns = [];
    this.host = this.stack = this.svg = this.body = null;
    this._hookWrap = this._blurTop = this._blurBot = null;
    this._bodySpans = null;
    this._kwTexts   = [];
    this._kwGolds   = [];
  }

  /* ── Corps du texte (phase 2) ──────────────────────────────────────────── */

  /**
   * Construit les paragraphes et découpe chaque lettre dans un <span>. Les
   * passages *…* sont enveloppés dans <em class="ab-em"> (relief + survol).
   *
   * CHAQUE PARAGRAPHE PLEUT À SON TOUR : l'ordre est tiré au hasard À
   * L'INTÉRIEUR d'un paragraphe (Fisher-Yates — le décodage d'archive), mais
   * les paragraphes se succèdent, séparés par un BATTEMENT (le filet doré, voir
   * T.beat). La fenêtre d'un paragraphe est proportionnelle à sa longueur : la
   * cadence par lettre est donc la même partout (un paragraphe court ne pleut
   * pas au ralenti).
   *
   * L'animation ne part qu'à la pose de la classe .ab-live (phase 2).
   */
  _buildBody() {
    const body = document.createElement('div');
    body.className = 'ab-body';
    const paras = [];                           // un lot de spans par <p>
    const beats = [];                           // le filet qui SUIT chaque lot
                                                // (null pour le dernier)
    const texts = this.data.paragraphs ?? [];

    texts.forEach((txt, pi) => {
      const p = document.createElement('p');
      const spans = [];
      String(txt).split('*').forEach((part, i) => {
        if (!part) return;
        let holder = p;
        if (i % 2) {                            // segment *en relief*
          holder = document.createElement('em');
          holder.className = 'ab-em';
          p.appendChild(holder);
        }
        for (const ch of part) {
          // Un espace n'a rien à révéler : texte brut, pas de span — autant
          // d'animations (et de nœuds) en moins pendant la pluie.
          if (/\s/.test(ch)) { holder.append(ch); continue; }
          const s = document.createElement('span');
          s.textContent = ch;
          holder.appendChild(s);
          spans.push(s);
        }
      });
      body.appendChild(p);
      if (!spans.length) return;    // paragraphe vide : ni lot, ni battement
      paras.push(spans);

      // Le battement PREND la marge du paragraphe qu'il suit (has-beat) au lieu
      // de s'y ajouter : l'écart entre deux paragraphes ne bouge pas d'un pixel,
      // et _fit() mesure la même hauteur qu'avant.
      if (pi < texts.length - 1) {
        p.classList.add('has-beat');
        const b = document.createElement('div');
        b.className = 'ab-beat';
        b.setAttribute('aria-hidden', 'true');   // une respiration, pas du texte
        body.appendChild(b);
        beats.push(b);
      } else {
        beats.push(null);
      }
    });

    const total = paras.reduce((n, s) => n + s.length, 0);
    const step  = T.body_spread / Math.max(1, total);   // cadence par lettre
    const all   = [];
    let at  = 0;                                // ouverture du paragraphe courant
    let end = 0;                                // délai de la toute dernière lettre

    paras.forEach((spans, i) => {
      this._shuffle(spans);
      spans.forEach((s, j) => {
        s.style.animationDelay = Math.round(at + j * step) + 'ms';
      });
      // Dernière lettre du paragraphe : c'est d'ELLE que se compte la suite —
      // le filet part dans sa traîne, et le silence ne commence qu'une fois la
      // lettre posée (+ body_char).
      const lastAt = at + Math.max(0, spans.length - 1) * step;
      end = lastAt;
      all.push(...spans);

      if (beats[i]) {
        // ⚠️ Le filet est un ::before : on ne peut pas lui poser de style inline,
        // et animation-delay ne s'hérite PAS (le poser sur le <div> ne ferait
        // rien — les trois battements partiraient ensemble à 0 ms). Une propriété
        // PERSONNALISÉE, elle, s'hérite jusqu'au pseudo-élément : c'est le seul
        // canal pour lui transmettre son instant.
        beats[i].style.setProperty('--beat-at',
          Math.round(lastAt + T.beat_lead) + 'ms');
        at = lastAt + T.body_char + T.body_gap;
      }
    });

    this._bodySpans = all;
    this._bodyEnd   = Math.round(end);
    this.stack.appendChild(body);
    this.body = body;
  }

  /** Mélange un tableau EN PLACE (Fisher-Yates). */
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ── Accroche calligraphiée (phase 1) ──────────────────────────────────── */

  /**
   * Aplatit les segments de la config en un flux de caractères portant leur
   * style. `kw` identifie chaque mot-clef (un id par segment 'gold') pour
   * grouper son embrasement ; `u` identifie de même le passage à frapper ;
   * `eng` demande le romain gras plutôt que l'italique (la pierre).
   */
  _hookChars() {
    const chars = [];
    (this.data.hook ?? []).forEach((seg, idx) => {
      const gold = seg.style === 'gold';
      for (const ch of String(seg.t ?? '')) {
        chars.push({
          ch, gold,
          kw:  gold ? idx + 1 : 0,
          u:   seg.underline ? idx + 1 : 0,
          dr:  seg.draft ? idx + 1 : 0,
          eng: gold && !!seg.engraved,
        });
      }
    });
    return chars;
  }

  /** Découpe le flux en mots (l'espace simple sépare ; les insécables restent). */
  _hookWords(chars) {
    const words = [];
    let cur = [];
    chars.forEach(c => {
      if (c.ch === ' ') { if (cur.length) { words.push(cur); cur = []; } }
      else cur.push(c);
    });
    if (cur.length) words.push(cur);
    return words;
  }

  /**
   * Groupe les caractères consécutifs d'un mot par style (base / mot-clef /
   * passage frappé). La clef sépare les runs ET, plus loin, leur donne chacun
   * son <text> : c'est ce qui permet de cloner le passage frappé SEUL pour son
   * éclat. Un mot-clef prime sur le soulignement (cas non utilisé aujourd'hui).
   */
  _wordRuns(word) {
    const runs = [];
    word.forEach(c => {
      const key = c.gold ? 'kw' + c.kw : (c.u ? 'u' + c.u : 'base');
      const last = runs[runs.length - 1];
      if (last && last.key === key) last.chars.push(c);
      else runs.push({ key, gold: c.gold, kw: c.kw, u: c.u, dr: c.dr,
                      engraved: c.eng, chars: [c] });
    });
    return runs;
  }

  /**
   * Fonte d'un run, pour la MESURE canvas.
   *
   * ⚠️ RÈGLE D'OR : elle doit correspondre EXACTEMENT à ce qui rendra le glyphe
   * — le CSS du <text> (.ab-t--kw / .ab-t--engraved / .ab-t--base) et celui du
   * clone de halo (.ab-g--*). Mesurer en italique ce qui sera rendu en romain
   * décale toute la justification. Trois endroits, un seul accord.
   */
  _font(run, size) {
    if (!run.gold) return `400 ${size}px ${HOOK_FONT}`;
    return `${run.engraved ? '' : 'italic '}700 ${size}px ${HOOK_FONT}`;
  }

  /** Nom de la fonte d'un run, pour la classe du clone de halo (.ab-g--*). */
  _fontKey(run) {
    return !run.gold ? 'base' : (run.engraved ? 'engraved' : 'hand');
  }

  /** Largeur cumulée des `i` premières lettres d'un run (crénage préservé). */
  _prefix(run, i, size) {
    this._ctx.font = this._font(run, size);
    return this._ctx.measureText(run.chars.slice(0, i).map(c => c.ch).join('')).width;
  }

  /**
   * Compose et monte l'accroche : lignes justifiées, un <tspan> par lettre
   * (position absolue calculée), délais d'animation cumulés, soulignement(s),
   * embrasement des mots-clefs. Pose this._phase2At.
   */
  _buildHook() {
    // Largeur RÉELLE du contenu : .ab-stack (width:100%) est à l'intérieur du
    // padding latéral du host → sa largeur = celle où le SVG sera rendu. On ne
    // mesure PAS host.clientWidth, qui inclurait le padding (la justification
    // serait alors calée sur une largeur trop grande).
    const zoneW = Math.max(320, this.stack?.clientWidth || this.host.clientWidth || 320);
    const effW  = Math.min(zoneW, 1040);        // même plafond que .ab-hook (CSS)

    // Taille RENDUE visée (px écran) → taille logique dans le repère [0..1000].
    const px    = Math.max(17, Math.min(34, effW * 0.031));
    const size  = SVG_W * px / effW;
    const lineH = size * 1.78;

    const words = this._hookWords(this._hookChars()).map(w => {
      const runs = this._wordRuns(w);
      runs.forEach(r => { r.w = this._prefix(r, r.chars.length, size); });
      return { runs, w: runs.reduce((s, r) => s + r.w, 0) };
    });

    this._ctx.font = this._font({ gold: false }, size);
    const spaceW = this._ctx.measureText(' ').width;

    // ── Composition des lignes (glouton) ──
    const lines = [];
    let line = [], lw = 0;
    words.forEach(word => {
      if (line.length && lw + spaceW + word.w > SVG_W) {
        lines.push({ words: line, w: lw });
        line = [word]; lw = word.w;
      } else {
        lw = line.length ? lw + spaceW + word.w : word.w;
        line.push(word);
      }
    });
    if (line.length) lines.push({ words: line, w: lw });

    // ── SVG ──
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'ab-hook');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label',
      (this.data.hook ?? []).map(s => s.t).join(''));
    // Taille de fonte en UNITÉS LOGIQUES du viewBox (1px = 1 unité en SVG) :
    // le rendu correspond ainsi exactement aux mesures canvas ci-dessus.
    svg.style.fontSize = size.toFixed(2) + 'px';

    // Brouillons (`draft`) : drId → texte d'abord écrit, puis raturé et effacé.
    const drafts = new Map();
    (this.data.hook ?? []).forEach((seg, idx) => {
      if (seg.draft) drafts.set(idx + 1, String(seg.draft));
    });

    let d = T.lead_in;         // curseur temporel (délai de la prochaine lettre)
    let endMax = 0;            // fin de la dernière animation de l'accroche
    let prevKw = 0;            // mot-clef en cours (0 = aucun)
    let prevU  = 0;            // passage frappé en cours (0 = aucun)
    let prevDr = 0;            // segment corrigé en cours (0 = aucun)
    let uLastD = 0;            // délai de la dernière lettre du passage frappé
    let strikeAt = 0;          // instant du coup (0 = pas de passage frappé)
    let draftRec = null;       // { text, x0, y0, at, scratchAt, eraseAt }
    let maxY = 0;
    const underByLine = new Map();   // li → { x1, x2, y }
    const kwRecs      = new Map();   // kwId → { texts, tspans, delays, end, font }
    const uRec = { texts: [], font: 'base' };   // <text> du passage frappé

    lines.forEach((L, li) => {
      const isLast  = li === lines.length - 1;
      // Dernière ligne : justifiée seulement si elle est déjà presque pleine
      // (règle typographique : pas d'étirement disgracieux d'une ligne courte).
      const justify = !isLast || (L.w / SVG_W) > 0.72;
      const nGaps   = L.words.length - 1;
      const extra   = (justify && nGaps > 0) ? (SVG_W - L.w) / nGaps : 0;
      const baseY   = size * 1.08 + li * lineH;
      maxY = Math.max(maxY, baseY + size * 0.55);

      const lineTexts = {};    // key → <text> (un par style et par ligne)
      const textFor = (run) => {
        if (lineTexts[run.key]) return lineTexts[run.key];
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('class', run.gold
          ? ('ab-t ab-t--kw' + (run.engraved ? ' ab-t--engraved' : ''))
          : 'ab-t ab-t--base');
        svg.appendChild(t);
        lineTexts[run.key] = t;
        if (run.gold) {
          const rec = kwRecs.get(run.kw)
                   ?? { texts: [], tspans: [], delays: [], end: 0,
                        font: this._fontKey(run) };
          rec.texts.push(t);
          kwRecs.set(run.kw, rec);
        } else if (run.u) {
          uRec.texts.push(t);
        }
        return t;
      };

      let x = 0;
      L.words.forEach(word => {
        word.runs.forEach(run => {
          // LE RATÉ — à l'ENTRÉE d'un segment corrigé, AVANT toute suspension
          // de mot-clef : la main hésite, écrit le brouillon, le rature, marque
          // l'arrêt. `d` saute par-dessus l'événement JUSQU'AU DÉBUT de
          // l'effacement seulement (+ draft_overlap) : le mot juste se réécrit
          // PENDANT que le brouillon s'en va, il n'attend pas qu'il ait disparu.
          // On ne retient ici que la GÉOMÉTRIE et les INSTANTS : le calque
          // lui-même est monté en post-passe (les mesures sont faites là-bas).
          if (run.dr !== prevDr) {
            if (run.dr && drafts.has(run.dr)) {
              const text = drafts.get(run.dr);
              const n    = [...text].length;
              const at   = d;
              // Dernière lettre du brouillon, puis son tracé, puis le temps de
              // le lire : la rature ne tombe pas sur un mot encore en train de
              // s'écrire (même règle que le coup, cf. strikeAt).
              const lastD     = at + T.draft_lead + Math.max(0, n - 1) * T.char;
              const scratchAt = lastD + T.draw + T.draft_read;
              const eraseAt   = scratchAt + T.scratch + T.scratch_after;
              draftRec = { text, x0: x, y0: baseY, at, scratchAt, eraseAt };
              d = eraseAt + T.draft_overlap;
            }
            prevDr = run.dr;
          }

          // Temps d'arrêt à l'entrée / à la sortie d'un mot-clef.
          if (run.kw !== prevKw) {
            if (prevKw) d += T.kw_after;
            if (run.kw) d += T.kw_before;
            prevKw = run.kw;
          }

          // LE COUP — à la SORTIE du passage frappé : l'écriture s'arrête, la
          // barre s'abat, la plaque encaisse, puis seulement la phrase reprend.
          // Le curseur `d` saute donc par-dessus tout l'événement : c'est ce qui
          // fait tomber le coup AU MILIEU de la phrase, sans que la suite ne
          // s'écrive par-dessus.
          if (run.u !== prevU) {
            if (prevU) {
              strikeAt = uLastD + T.draw + T.strike_hold;
              d = Math.max(d, strikeAt + T.strike + T.strike_after);
            }
            prevU = run.u;
          }

          const parent = textFor(run);
          const rec    = run.gold ? kwRecs.get(run.kw) : null;

          run.chars.forEach((c, i) => {
            const cx = x + this._prefix(run, i, size);
            const cw = this._prefix(run, i + 1, size) - this._prefix(run, i, size);

            if (!/\s/.test(c.ch)) {
              const ts = document.createElementNS(NS, 'tspan');
              ts.textContent = c.ch;
              ts.setAttribute('x', cx.toFixed(2));
              ts.setAttribute('y', baseY.toFixed(2));
              parent.appendChild(ts);

              if (rec) {
                // Le délai d'embrasement (3ᵉ animation) n'est connu qu'à la
                // fin du mot : on le posera dans la post-passe ci-dessous.
                rec.tspans.push(ts);
                rec.delays.push(d);
                rec.end = Math.max(rec.end, d + T.fill_lag + T.fill);
              } else {
                ts.style.animationDelay = `${d}ms, ${d + T.fill_lag}ms`;
              }

              if (c.u) {
                // Emprise du passage sur CETTE ligne (il peut se replier), et
                // délai de sa dernière lettre — tous confondus : le coup est
                // UN seul geste, même si le passage tient sur deux lignes.
                const u = underByLine.get(li)
                       ?? { x1: Infinity, x2: -Infinity, y: baseY };
                u.x1 = Math.min(u.x1, cx);
                u.x2 = Math.max(u.x2, cx + cw);
                underByLine.set(li, u);
                uLastD = Math.max(uLastD, d);
              }

              endMax = Math.max(endMax, d + T.fill_lag + T.fill);
              d += run.gold ? T.kw_char : T.char;
              if (c.ch === ',') d += T.comma;    // la virgule respire
            } else {
              d += T.char;                       // insécable / espace fine
            }
          });
          x += run.w;
        });
        x += spaceW + extra;
        d += T.word;
      });
    });
    if (prevKw) d += T.kw_after;
    // Passage frappé en fin de phrase : rien à reprendre après, mais le coup
    // doit tomber quand même.
    if (prevU && !strikeAt) strikeAt = uLastD + T.draw + T.strike_hold;

    // ── Post-passe mots-clefs : encrage blanc, puis embrasement groupé ──
    // (l'embrasement lui-même est porté par les CLONES FLOUS montés plus bas,
    // jamais par un filtre dans CE svg — voir _makeGlow.)
    kwRecs.forEach(rec => {
      const goldAt = rec.end + T.gold_lag;
      rec.goldAt = goldAt;
      rec.tspans.forEach((ts, i) => {
        const d0 = rec.delays[i];
        ts.style.animationDelay = `${d0}ms, ${d0 + T.fill_lag}ms, ${goldAt}ms`;
      });
      endMax = Math.max(endMax, goldAt + T.gold);
      this._kwTexts.push(...rec.texts);
    });

    // ── LE RATÉ — le brouillon, en CALQUE par-dessus la case du mot juste ──
    // La composition est celle du texte FINAL : rien n'a bougé, rien ne bougera.
    // Le brouillon s'écrit à l'emplacement exact où le mot corrigé s'écrira, et
    // c'est jouable parce qu'à cet instant RIEN de ce qui suit n'existe encore :
    // il n'y a rien à repousser. (Le mot corrigé est bien là, dans le DOM, mais
    // ses lettres sont figées à leur état initial par animation-fill-mode: both
    // — tracé nul, remplissage transparent : invisibles.)
    if (draftRec) {
      const { text, x0, y0, at, scratchAt, eraseAt } = draftRec;
      // Run synthétique : le brouillon se mesure dans la fonte de BASE, comme
      // il se rendra (règle d'or : mesurer ce que l'on rend).
      const dRun = { gold: false, engraved: false,
                     chars: [...text].map(ch => ({ ch })) };
      const dW = this._prefix(dRun, dRun.chars.length, size);

      // ⚠️ LA garantie de fiabilité. Le brouillon n'a AUCUN repère à l'écran (le
      // mot qu'il remplace n'est pas encore écrit) : son x exact n'engage rien.
      // On le cale donc pour qu'il tienne toujours dans la ligne, quelle que
      // soit la largeur d'écran — le décalage vaut au plus la différence de
      // largeur entre les deux mots, soit une fraction de signe, invisible.
      // Sans cela, un brouillon plus large que le mot corrigé déborderait dans
      // la marge dès que celui-ci tombe en fin de ligne : un bug qu'on ne voit
      // qu'à certaines tailles de fenêtre.
      const xd = Math.max(0, Math.min(x0, SVG_W - dW));

      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'ab-draft');
      g.setAttribute('aria-hidden', 'true');   // l'accroche lue est la corrigée
      g.style.animationDelay = `${eraseAt}ms`;

      const dt = document.createElementNS(NS, 'text');
      dt.setAttribute('class', 'ab-t ab-t--base');
      let dd = at + T.draft_lead;
      dRun.chars.forEach((c, i) => {
        const ts = document.createElementNS(NS, 'tspan');
        ts.textContent = c.ch;
        ts.setAttribute('x', (xd + this._prefix(dRun, i, size)).toFixed(2));
        ts.setAttribute('y', y0.toFixed(2));
        ts.style.animationDelay = `${dd}ms, ${dd + T.fill_lag}ms`;
        dt.appendChild(ts);
        dd += T.char;
      });
      g.appendChild(dt);

      // La rature : à mi-hauteur d'x (elle BARRE le mot, elle ne le souligne
      // pas), largement débordante et plus penchée que la barre du coup — le
      // geste part de plus loin et ne s'arrête pas au mot.
      const sx1 = xd - size * 0.14;
      const sx2 = xd + dW + size * 0.14;
      const sy1 = y0 - size * 0.26;
      const sy2 = sy1 + (sx2 - sx1) * 0.035;
      const sLen = Math.max(1, Math.hypot(sx2 - sx1, sy2 - sy1));
      const sc = document.createElementNS(NS, 'line');
      sc.setAttribute('class', 'ab-scratch');
      sc.setAttribute('x1', sx1.toFixed(2));
      sc.setAttribute('x2', sx2.toFixed(2));
      sc.setAttribute('y1', sy1.toFixed(2));
      sc.setAttribute('y2', sy2.toFixed(2));
      sc.style.strokeDasharray  = String(Math.ceil(sLen));
      sc.style.strokeDashoffset = String(Math.ceil(sLen));
      sc.style.animationDelay   = `${scratchAt}ms`;
      g.appendChild(sc);

      svg.appendChild(g);
      endMax = Math.max(endMax, eraseAt + T.erase);
    }

    // ── LA BARRE — un seul geste, à un seul instant (strikeAt) ──
    // Elle déborde du mot des deux côtés et penche imperceptiblement : une main
    // frappe, elle ne pose pas une règle. Toutes les lignes du passage sont
    // barrées ENSEMBLE — un coup, pas une par ligne.
    underByLine.forEach(u => {
      const lineEl = document.createElementNS(NS, 'line');
      const y    = u.y + size * 0.34;
      const over = size * 0.16;                    // débord de part et d'autre
      const x1   = u.x1 - over;
      const x2   = u.x2 + over;
      const y1   = y;
      const y2   = y + (x2 - x1) * 0.012;          // ~0,7° : le geste n'est pas droit
      const len  = Math.max(1, Math.hypot(x2 - x1, y2 - y1));  // vraie longueur
      lineEl.setAttribute('class', 'ab-underline');
      lineEl.setAttribute('x1', x1.toFixed(2));
      lineEl.setAttribute('x2', x2.toFixed(2));
      lineEl.setAttribute('y1', y1.toFixed(2));
      lineEl.setAttribute('y2', y2.toFixed(2));
      lineEl.style.strokeDasharray  = String(Math.ceil(len));
      lineEl.style.strokeDashoffset = String(Math.ceil(len));
      lineEl.style.animationDelay   = `${strikeAt}ms`;
      svg.appendChild(lineEl);
      endMax = Math.max(endMax, strikeAt + T.strike + T.strike_flash);
      maxY   = Math.max(maxY, Math.max(y1, y2) + size * 0.2);
    });

    svg.setAttribute('viewBox', `0 0 ${SVG_W} ${Math.ceil(maxY)}`);

    // ── Montage : cadre + halos des mots-clefs (clones flous superposés) ──
    // Chaque mot-clef reçoit deux couches alignées sur le SVG principal (même
    // viewBox) : blanche (l'embrasement) et dorée (la lueur déposée). Leur
    // flou est FIXE, seule l'opacité est animée → composition GPU pure, là où
    // l'ancien drop-shadow animé re-rastérisait le mot à chaque frame.
    const wrap = document.createElement('div');
    wrap.className = 'ab-hookwrap';
    wrap.appendChild(svg);

    const scale = effW / SVG_W;    // px écran par unité logique du viewBox
    kwRecs.forEach(rec => {
      const white = this._makeGlow(svg, rec, scale, 'white');
      const gold  = this._makeGlow(svg, rec, scale, 'gold');
      white.style.animationDelay = `${rec.goldAt - 120}ms`;
      gold.style.animationDelay  = `${rec.goldAt + 200}ms`;
      wrap.appendChild(white);
      wrap.appendChild(gold);
      this._kwGolds.push(gold);

      // Une fois déposé en doré, le mot devient sensible au survol : le halo
      // se renforce (opacité seule, donc compositeur — voir .is-hover en CSS).
      this._addTimer(() => {
        rec.texts.forEach(t => t.classList.add('is-set'));
        gold.classList.add('is-set');
      }, rec.goldAt + T.gold + 100);

      rec.texts.forEach(t => {
        const over = () => {
          if (t.classList.contains('is-set')) gold.classList.add('is-hover');
        };
        const out = () => gold.classList.remove('is-hover');
        t.addEventListener('pointerenter', over);
        t.addEventListener('pointerleave', out);
        this._hoverFns.push([t, 'pointerenter', over], [t, 'pointerleave', out]);
      });
    });

    // ── L'ONDE ET L'ÉCLAT ──
    // L'éclat réutilise exactement la mécanique des halos : un clone flou dont
    // seule l'opacité flambe. La secousse est un transform sur .ab-hookwrap —
    // qui n'a AUCUN transform propre : .ab-stack porte la remontée de la phase 2
    // et ne doit surtout pas être touchée ici (les deux se contrarieraient).
    // Les deux partent avec strike_wave de retard : le temps que la barre arrive.
    if (strikeAt && uRec.texts.length && !this._reduced) {
      const flash = this._makeGlow(svg, uRec, scale, 'strike');
      flash.style.animationDelay = `${strikeAt + T.strike_wave}ms`;
      wrap.appendChild(flash);

      this._addTimer(() => wrap.classList.add('is-shock'),
                     strikeAt + T.strike_wave);
      // La classe est retirée : l'animation finie, un transform résiduel
      // maintiendrait une couche GPU pour rien (cf. règles de perf du module).
      this._addTimer(() => wrap.classList.remove('is-shock'),
                     strikeAt + T.strike_wave + T.strike_shock + 40);
    }

    // La secousse du RATÉ — même mécanique, amplitude moindre et sans éclat :
    // la main rejette un mot, elle ne prononce pas une sentence. Montée ici et
    // non dans la post-passe du brouillon : c'est ici que `wrap` existe.
    if (draftRec && !this._reduced) {
      const at = draftRec.scratchAt + T.scratch_wave;
      this._addTimer(() => wrap.classList.add('is-scratch-shock'), at);
      this._addTimer(() => wrap.classList.remove('is-scratch-shock'),
                     at + T.scratch_shock + 40);
    }

    this.stack.insertBefore(wrap, this.body);
    this._hookWrap = wrap;
    this.svg = svg;
    this._phase2At = endMax + T.breath;
  }

  /**
   * Clone flou d'un passage (halo). Un <svg> superposé au principal — même
   * viewBox, même taille → alignement exact des glyphes — portant un blur CSS
   * FIXE : le navigateur calcule le flou une fois, le met en cache, et seule
   * l'opacité de la couche est ensuite animée (compositeur, coût quasi nul).
   * Sert aussi bien à l'embrasement des mots-clefs qu'à l'éclat du coup.
   * @param {SVGSVGElement} svg    SVG principal (référence de clonage)
   * @param {Object}        rec    { texts, font } — passage à faire luire
   * @param {number}        scale  px écran par unité logique (effW / SVG_W)
   * @param {'white'|'gold'|'strike'} kind  embrasement / lueur déposée / éclat
   */
  _makeGlow(svg, rec, scale, kind) {
    const g = svg.cloneNode(false);        // recopie viewBox + font-size inline
    g.setAttribute('class', `ab-hook-glow ab-hook-glow--${kind}`);
    g.removeAttribute('role');
    g.removeAttribute('aria-label');
    g.setAttribute('aria-hidden', 'true');
    rec.texts.forEach(t => {
      const c = t.cloneNode(true);
      // La classe d'origine cède la place à une classe de FONTE seule : le clone
      // ne doit hériter d'AUCUNE animation de tracé/encrage (il est une forme
      // pleine dès le départ), mais il doit être composé dans exactement la même
      // fonte que le glyphe qu'il double — sinon le halo se décale de lui.
      c.setAttribute('class', `ab-g--${rec.font}`);
      c.style.animationDelay = '';
      c.querySelectorAll('tspan').forEach(ts => { ts.style.animationDelay = ''; });
      g.appendChild(c);
    });
    // Rayon en unités logiques → px écran à la taille de composition.
    const r = Math.max(2, (GLOW_R[kind] ?? 8) * scale);
    g.style.filter = `blur(${r.toFixed(1)}px)`;
    return g;
  }

  /* ── Mise en page : tenir sans ascenseur, centrer l'accroche ───────────── */

  /**
   * 1. Ajuste la taille du corps pour que accroche + corps tiennent dans la
   *    zone (grand écran). Si même la taille plancher déborde (tactile, petit
   *    écran), la classe .is-scroll autorise le défilement en phase 2.
   * 2. Centre verticalement l'accroche (phase 1) via la translation du stack.
   * @param {boolean} isResize  true = pas de glissement animé du recentrage
   */
  _fit(isResize) {
    const host = this.host, stack = this.stack;
    if (!host || !stack) return;
    const zoneH = host.clientHeight;

    const ov    = this.config.DOCS?.overlay ?? {};
    const maxPx = ov.about_max_px ?? 30;
    const minPx = Math.max(this._coarse ? 15 : 12, ov.about_min_px ?? 12);

    // Taille visée, puis ajustement en un nombre BORNÉ de mesures : l'accroche
    // a une hauteur fixe (indépendante de la fonte du corps), la taille qui
    // tient se déduit donc proportionnellement puis se vérifie à ± 1 px —
    // au lieu de l'ancienne descente px par px (une mise en page forcée par
    // pixel d'écart, sur un DOM de ~1000 nœuds).
    const cap = Math.max(minPx, Math.min(maxPx, Math.round(window.innerHeight * 0.023)));
    let px = cap;
    this.body.style.fontSize = px + 'px';

    if (stack.offsetHeight > zoneH && px > minPx) {
      const hookH = this._hookWrap ? this._hookWrap.offsetHeight : 0;
      const bodyH = Math.max(1, stack.offsetHeight - hookH);
      px = Math.max(minPx, Math.min(cap,
        Math.floor(px * (zoneH - hookH) / bodyH)));
      this.body.style.fontSize = px + 'px';
      while (px > minPx && stack.offsetHeight > zoneH) {
        px -= 1;
        this.body.style.fontSize = px + 'px';
      }
      while (px < cap && stack.offsetHeight <= zoneH) {
        px += 1;
        this.body.style.fontSize = px + 'px';
        if (stack.offsetHeight > zoneH) {          // un cran de trop
          px -= 1;
          this.body.style.fontSize = px + 'px';
          break;
        }
      }
    }
    host.classList.toggle('is-scroll', stack.offsetHeight > zoneH + 1);
    this._updateFade();

    // Centrage de l'accroche tant que la remontée n'a pas eu lieu.
    if (!this._phase2 && this._hookWrap) {
      const hookH = this._hookWrap.getBoundingClientRect().height;
      const startY = Math.max(0, Math.round((zoneH - hookH) / 2));
      if (isResize) stack.classList.add('no-trans');
      stack.style.transform = `translateY(${startY}px)`;
      if (isResize) {
        this._raf = requestAnimationFrame(() => {
          this._raf = null;
          stack.classList.remove('no-trans');
        });
      }
    }
  }

  /* ── Chorégraphie ──────────────────────────────────────────────────────── */

  _start() {
    if (this._reduced) { this._finalize(); return; }
    this._addTimer(() => this._enterPhase2(), this._phase2At);
  }

  /** Remontée de l'accroche puis pluie de lettres du corps. */
  _enterPhase2() {
    if (this._phase2 || !this.host) return;
    this._phase2 = true;
    this.host.classList.add('ab-phase2');
    this.stack.style.transform = 'translateY(0px)';
    this._updateFade();
    // La remontée (1500 ms) déplace l'emprise mesurable du stack : on recale
    // les fondus une fois le mouvement posé.
    this._addTimer(() => this._updateFade(), 1600);
    this._addTimer(() => {
      this.body?.classList.add('ab-live');
      this._addTimer(() => this._setDone(),
                     this._bodyEnd + T.body_char + T.settle);
    }, T.body_lag);
  }

  /**
   * Texte posé : relief des passages *…*, survols actifs — et DÉSARMEMENT.
   * .ab-settled remplace toutes les animations par leur état final statique
   * (plus d'objets d'animation vivants pendant la lecture), et la couche GPU
   * réservée à la remontée du stack est rendue.
   */
  _setDone() {
    this._done = true;
    this.host?.classList.add('ab-done', 'ab-settled');
    if (this.stack) this.stack.style.willChange = 'auto';
    this._updateFade();
  }

  /** prefers-reduced-motion : état final immédiat, sans chorégraphie. */
  _finalize() {
    this._phase2 = true;
    this.host.classList.add('ab-reduced', 'ab-phase2');
    this.stack.style.transform = 'translateY(0px)';
    this.body?.classList.add('ab-live');
    this._markKwSet();
    this._setDone();
  }

  _markKwSet() {
    this._kwTexts.forEach(t => t.classList.add('is-set'));
    this._kwGolds.forEach(g => g.classList.add('is-set'));
  }

  /* ── Fondus de défilement (mask + bandes de flou) ──────────────────────── */

  /**
   * Ajuste le fondu haut/bas (--fade-top / --fade-bot, mask du host) et les
   * bandes de flou selon la position de défilement : l'indice n'apparaît que
   * du côté où il RESTE du texte. Actif seulement en phase 2 défilable —
   * mêmes seuils que les contenus 'text' de l'overlay.
   */
  _updateFade() {
    const el = this.host;
    if (!el) return;
    const FADE = 68;                       // hauteur du dégradé (px)
    const max  = el.scrollHeight - el.clientHeight;
    const on   = this._phase2 && max > 1 && el.classList.contains('is-scroll');
    const top  = on ? Math.min(FADE, el.scrollTop) : 0;
    const bot  = on ? Math.min(FADE, max - el.scrollTop) : 0;
    el.style.setProperty('--fade-top', top.toFixed(1) + 'px');
    el.style.setProperty('--fade-bot', bot.toFixed(1) + 'px');
    if (this._blurTop) this._blurTop.style.opacity = (top / FADE).toFixed(2);
    if (this._blurBot) this._blurBot.style.opacity = (bot / FADE).toFixed(2);
  }

  /* ── Timers (annulables par destroy) ───────────────────────────────────── */

  _addTimer(fn, ms) {
    const id = setTimeout(() => {
      this._timers = this._timers.filter(t => t !== id);
      fn();
    }, ms);
    this._timers.push(id);
    return id;
  }

  _clearTimers() {
    this._timers.forEach(clearTimeout);
    this._timers = [];
  }
}
