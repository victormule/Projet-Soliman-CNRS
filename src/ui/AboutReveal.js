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
 *      dur. Les mots-clefs (style 'gold' dans la config) s'écrivent en blanc,
 *      s'embrasent, puis se déposent en doré. Le passage `underline: true` se
 *      souligne une fois écrit. La cadence ménage des temps d'arrêt :
 *      virgules, entrée et sortie des mots-clefs.
 *
 *   2. LE CORPS — l'accroche remonte en haut de la zone et le reste du texte
 *      se matérialise lettre par lettre dans un ordre aléatoire (décodage
 *      d'archive), en linéale (Inter). Les passages *entre astérisques* sont
 *      mis en relief et s'éclairent doucement une fois le texte posé.
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
   ⚠️ La variante italic 700 de Playfair est chargée par index.html. */
const HOOK_FONT = '"Playfair Display", Georgia, serif';

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
  under_lag:   300,   // le soulignement part après le dernier mot souligné
  underline:   950,   // tracé du soulignement        (= CSS .ab-underline)
  breath:      950,   // respiration après l'accroche, avant la remontée
  body_lag:    550,   // la pluie de lettres démarre PENDANT la remontée
  body_spread: 4200,  // étalement total de la pluie de lettres
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
    this.svg   = null;   // accroche calligraphiée
    this.body  = null;   // corps du texte

    this._timers    = [];
    this._raf       = null;
    this._bodySpans = null;
    this._kwTexts   = [];     // <text> des mots-clefs (survol après pose)
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

    const stack = document.createElement('div');
    stack.className = 'ab-stack';
    host.appendChild(stack);
    this.stack = stack;

    // Le corps est construit d'abord : il participe à la mesure « tenir sans
    // ascenseur » (_fit) même s'il reste invisible pendant la phase 1.
    this._buildBody();

    // Les glyphes doivent être mesurés avec les VRAIES polices : on attend
    // leur chargement avant de composer les lignes (sinon les largeurs de
    // secours faussent la justification).
    try {
      await Promise.all([
        document.fonts.load(`400 32px ${HOOK_FONT}`),
        document.fonts.load(`italic 700 32px ${HOOK_FONT}`),
        document.fonts.load('300 16px Inter'),
        document.fonts.load('500 16px Inter'),
      ]);
    } catch { /* métriques de secours : la composition reste correcte */ }
    if (!this.host) return;                    // détruit pendant l'attente

    this._buildHook();
    this._fit(false);

    // Fast-forward demandé pendant le chargement des polices : on saute
    // directement à l'état final (les animations sont écrasées par .ab-skip).
    if (this._skipped) { this._markKwSet(); return; }

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

    // Pluie de lettres resserrée : le corps se pose en ~0,8 s.
    if (this.body && this._bodySpans) {
      const n = Math.max(1, this._bodySpans.length);
      this._bodySpans.forEach((s, i) => {
        s.style.animationDelay = Math.round(i * 700 / n) + 'ms';
      });
      this.body.classList.add('ab-live');
    }
    this._addTimer(() => this._setDone(), 1100);
  }

  /** Démonte timers et références. Le DOM est purgé par DocumentOverlay. */
  destroy() {
    this._clearTimers();
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    this.host = this.stack = this.svg = this.body = null;
    this._bodySpans = null;
    this._kwTexts   = [];
  }

  /* ── Corps du texte (phase 2) ──────────────────────────────────────────── */

  /**
   * Construit les paragraphes, découpe chaque lettre dans un <span> et tire
   * l'ordre d'apparition au hasard (Fisher-Yates). Les passages *…* sont
   * enveloppés dans <em class="ab-em"> (relief + survol).
   * L'animation ne part qu'à la pose de la classe .ab-live (phase 2).
   */
  _buildBody() {
    const body = document.createElement('div');
    body.className = 'ab-body';
    const spans = [];

    (this.data.paragraphs ?? []).forEach(txt => {
      const p = document.createElement('p');
      String(txt).split('*').forEach((part, i) => {
        if (!part) return;
        let holder = p;
        if (i % 2) {                            // segment *en relief*
          holder = document.createElement('em');
          holder.className = 'ab-em';
          p.appendChild(holder);
        }
        for (const ch of part) {
          const s = document.createElement('span');
          s.textContent = ch;
          holder.appendChild(s);
          spans.push(s);
        }
      });
      body.appendChild(p);
    });

    const order = spans.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const step = T.body_spread / Math.max(1, order.length);
    order.forEach((s, i) => {
      s.style.animationDelay = Math.round(i * step) + 'ms';
    });

    this._bodySpans = order;
    this.stack.appendChild(body);
    this.body = body;
  }

  /* ── Accroche calligraphiée (phase 1) ──────────────────────────────────── */

  /**
   * Aplatit les segments de la config en un flux de caractères portant leur
   * style. `kw` identifie chaque mot-clef (un id par segment 'gold') pour
   * grouper son embrasement ; `u` marque les caractères à souligner.
   */
  _hookChars() {
    const chars = [];
    (this.data.hook ?? []).forEach((seg, idx) => {
      const gold = seg.style === 'gold';
      for (const ch of String(seg.t ?? '')) {
        chars.push({ ch, gold, kw: gold ? idx + 1 : 0, u: !!seg.underline });
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

  /** Groupe les caractères consécutifs d'un mot par style (base / mot-clef). */
  _wordRuns(word) {
    const runs = [];
    word.forEach(c => {
      const key = c.gold ? 'kw' + c.kw : 'base';
      const last = runs[runs.length - 1];
      if (last && last.key === key) last.chars.push(c);
      else runs.push({ key, gold: c.gold, kw: c.kw, chars: [c] });
    });
    return runs;
  }

  _font(gold, size) {
    return (gold ? `italic 700 ${size}px ` : `400 ${size}px `) + HOOK_FONT;
  }

  /** Largeur cumulée des `i` premières lettres d'un run (crénage préservé). */
  _prefix(run, i, size) {
    this._ctx.font = this._font(run.gold, size);
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

    this._ctx.font = this._font(false, size);
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

    let d = T.lead_in;         // curseur temporel (délai de la prochaine lettre)
    let endMax = 0;            // fin de la dernière animation de l'accroche
    let prevKw = 0;            // mot-clef en cours (0 = aucun)
    let maxY = 0;
    const underByLine = new Map();   // li → { x1, x2, y, d }
    const kwRecs      = new Map();   // kwId → { texts, tspans, delays, end }

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
        const key = run.gold ? 'kw' + run.kw : 'base';
        if (lineTexts[key]) return lineTexts[key];
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('class', run.gold ? 'ab-t ab-t--kw' : 'ab-t ab-t--base');
        svg.appendChild(t);
        lineTexts[key] = t;
        if (run.gold) {
          const rec = kwRecs.get(run.kw)
                   ?? { texts: [], tspans: [], delays: [], end: 0 };
          rec.texts.push(t);
          kwRecs.set(run.kw, rec);
        }
        return t;
      };

      let x = 0;
      L.words.forEach(word => {
        word.runs.forEach(run => {
          // Temps d'arrêt à l'entrée / à la sortie d'un mot-clef.
          if (run.kw !== prevKw) {
            if (prevKw) d += T.kw_after;
            if (run.kw) d += T.kw_before;
            prevKw = run.kw;
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
                const u = underByLine.get(li)
                       ?? { x1: Infinity, x2: -Infinity, y: baseY, d: 0 };
                u.x1 = Math.min(u.x1, cx);
                u.x2 = Math.max(u.x2, cx + cw);
                u.d  = Math.max(u.d, d);
                underByLine.set(li, u);
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

    // ── Post-passe mots-clefs : encrage blanc, puis embrasement groupé ──
    kwRecs.forEach(rec => {
      const goldAt = rec.end + T.gold_lag;
      rec.tspans.forEach((ts, i) => {
        const d0 = rec.delays[i];
        ts.style.animationDelay = `${d0}ms, ${d0 + T.fill_lag}ms, ${goldAt}ms`;
      });
      rec.texts.forEach(t => { t.style.animationDelay = `${goldAt - 120}ms`; });
      endMax = Math.max(endMax, goldAt + T.gold);
      // Une fois déposé en doré, le mot devient sensible au survol (halo).
      this._addTimer(() => rec.texts.forEach(t => t.classList.add('is-set')),
                     goldAt + T.gold + 100);
      this._kwTexts.push(...rec.texts);
    });

    // ── Soulignement(s) : tracés une fois le passage écrit ──
    underByLine.forEach(u => {
      const lineEl = document.createElementNS(NS, 'line');
      const y   = u.y + size * 0.34;
      const len = Math.max(1, u.x2 - u.x1);
      lineEl.setAttribute('class', 'ab-underline');
      lineEl.setAttribute('x1', u.x1.toFixed(2));
      lineEl.setAttribute('x2', u.x2.toFixed(2));
      lineEl.setAttribute('y1', y.toFixed(2));
      lineEl.setAttribute('y2', y.toFixed(2));
      lineEl.style.strokeDasharray  = String(Math.ceil(len));
      lineEl.style.strokeDashoffset = String(Math.ceil(len));
      const at = u.d + T.draw + T.under_lag;
      lineEl.style.animationDelay = `${at}ms`;
      svg.appendChild(lineEl);
      endMax = Math.max(endMax, at + T.underline);
      maxY   = Math.max(maxY, y + size * 0.2);
    });

    svg.setAttribute('viewBox', `0 0 ${SVG_W} ${Math.ceil(maxY)}`);
    this.stack.insertBefore(svg, this.body);
    this.svg = svg;
    this._phase2At = endMax + T.breath;
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

    let px = Math.max(minPx, Math.min(maxPx, Math.round(window.innerHeight * 0.023)));
    this.body.style.fontSize = px + 'px';
    while (stack.offsetHeight > zoneH && px > minPx) {
      px -= 1;
      this.body.style.fontSize = px + 'px';
    }
    host.classList.toggle('is-scroll', stack.offsetHeight > zoneH + 1);

    // Centrage de l'accroche tant que la remontée n'a pas eu lieu.
    if (!this._phase2 && this.svg) {
      const hookH = this.svg.getBoundingClientRect().height;
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
    this._addTimer(() => {
      this.body?.classList.add('ab-live');
      this._addTimer(() => this._setDone(),
                     T.body_spread + T.body_char + T.settle);
    }, T.body_lag);
  }

  /** Texte posé : relief des passages *…* et survols actifs. */
  _setDone() {
    this._done = true;
    this.host?.classList.add('ab-done');
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
