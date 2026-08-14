/**
 * chp4-bubbles.js — LES BULLES : construction, survol, écoute
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce module prend les tracés bruts de l'export Illustrator et en fait des objets
 * vivants : il les regroupe, y compose les mots, y greffe la lecture sonore.
 *
 * ANATOMIE D'UNE BULLE (ce que le module construit autour de chaque nuage)
 *
 *   <g .chp4-bubble>            ← état : survol / écoute (échelle)
 *     <g .chp4-breath>          ← vie permanente (respiration, dérive)
 *       <g .chp4-tail>            les petites bulles, de la fissure au nuage
 *       <path .chp4-shape>        le nuage lui-même (tracé d'origine, recoloré)
 *       <path .chp4-progress>     son pourtour, qui se remplit à l'écoute
 *       <g .chp4-label>           le mot, une ligne par <text>
 *       <g .chp4-glyph>           l'invite au survol (▶ écouter · ↗ la carte)
 *       <ellipse .chp4-hit>       la zone cliquable
 *       <g .chp4-stop>            la croix d'arrêt (par-dessus tout le reste)
 *
 * DEUX NIVEAUX DE TRANSFORMATION, ET C'EST VOULU : `.chp4-bubble` porte
 * l'échelle des états (repos → survol → écoute), `.chp4-breath` porte la vie
 * permanente. Un seul élément ne peut porter qu'un `transform` : les faire
 * cohabiter sur le même nœud, c'est que la respiration écrase le survol une
 * frame sur deux.
 *
 * LA ZONE CLIQUABLE EST UNE ELLIPSE, PAS LE NUAGE. Deux nuages sur cinq sont
 * ÉVIDÉS (contour seul) : cliquer « dedans » ne toucherait aucune matière, et
 * seul le liseré serait sensible — quelques pixels de large. L'ellipse inscrite
 * dans la boîte du nuage rend toute la bulle cliquable, ce que l'œil attend.
 * Elle est posée APRÈS le contenu (elle le couvre) mais AVANT la croix d'arrêt
 * (qui doit, elle, recevoir ses propres clics).
 */

import {
  Motion, EASE, svgEl, traceOutline, popDot,
  splitLetters, writeLetters, fitFontSize, bboxInUserSpace,
} from './chp4-draw.js';

export class BubbleLayer {
  /**
   * @param {SVGElement} svg     racine <svg> de l'œuvre, déjà injectée
   * @param {Object} cfg         chp4-config.CONFIG
   * @param {Array}  manifest    chp4-manifest.BUBBLES
   * @param {Object} deps
   * @param {Object} deps.audioManager  AudioManager du site (contexte Web Audio)
   * @param {Function} deps.onMapRequest  appelé quand la bulle-carte est cliquée
   */
  constructor(svg, cfg, manifest, deps) {
    this.svg      = svg;
    this.cfg      = cfg;
    this.manifest = manifest;
    this.audioMgr = deps.audioManager ?? null;
    this.onMap    = deps.onMapRequest ?? (() => {});

    this.motion   = new Motion();     // animations de construction et de survol
    this.bubbles  = new Map();        // id → descripteur
    this.playing  = null;             // id en cours d'écoute
    this._active  = false;            // les clics sont-ils ouverts ?
    this._sessionAbort = null;        // écoutes globales de la session d'écoute
    this._playRaf = null;
  }

  /* ══════════════════════════════════════════════════════════════════
     CONSTRUCTION
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Regroupe les tracés, compose les mots, prépare l'invisible.
   * À l'issue de `build()`, tout existe mais rien ne se voit : la chorégraphie
   * d'ouverture (chp4-opening) fera paraître chaque bulle en son temps.
   */
  build() {
    const paths = Array.from(this.svg.querySelectorAll('path'));
    const P = this.cfg.palette;

    for (const spec of this.manifest) {
      const shape = paths[spec.shape];
      if (!shape) {
        console.warn(`[chp4] Bulle « ${spec.id} » : tracé n°${spec.shape} introuvable.`);
        continue;
      }
      const content = this.cfg.bubbles[spec.id];
      if (!content) {
        console.warn(`[chp4] Bulle « ${spec.id} » : aucun contenu dans chp4-config.bubbles.`);
        continue;
      }

      /* ── Les deux enveloppes (états / vie) ─────────────────────────── */
      const outer  = svgEl('g', { class: 'chp4-bubble', 'data-bubble': spec.id,
                                  'data-tone': spec.tone });
      const breath = svgEl('g', { class: 'chp4-breath' });
      outer.appendChild(breath);
      // Posée là où était le nuage : l'ordre de peinture est préservé.
      shape.parentNode.insertBefore(outer, shape);

      /* ── La queue ──────────────────────────────────────────────────
         ⚠️ La queue de la bulle « carte » (tracés n°2 et 3) est le seul
         groupe NON CONTIGU de l'export : ses deux petites bulles vivent en
         tête de document, loin de leur nuage. Les déplacer ici les fait
         peindre plus tard qu'avant — sans conséquence, rien ne les recouvre
         à cet endroit du dessin (vérifié : aucun autre tracé ne passe par
         (531, 764) ni (555, 721)). */
      const tailG = svgEl('g', { class: 'chp4-tail' });
      breath.appendChild(tailG);

      /* ⚠️ CHAQUE PETITE BULLE EST EMBALLÉE DANS UN <g>, et ce n'est pas une
         coquetterie de structure. Les tracés de l'export portent tous un
         `transform="translate(-731 0)"` en ATTRIBUT. Or une animation Web
         Animations écrit la propriété CSS `transform`, qui SUPPLANTE l'attribut
         de même nom : la première fois qu'une petite bulle éclot (`popDot`, qui
         l'anime en `scale`), elle perd son translate et bondit de 731 unités
         vers la droite — hors du dessin, parfois hors du cadre.
         Le <g> reçoit la transformation animée, le tracé garde la sienne.
         Même raison pour l'onde de survol, qui anime aussi une échelle. */
      const dots = spec.tail.map((i) => paths[i]).filter(Boolean).map((d) => {
        d.removeAttribute('class');
        d.setAttribute('fill', spec.tone === 'grey' ? P.grey : P.ink);
        const wrap = svgEl('g', { class: 'chp4-dot' });
        wrap.style.opacity = '0';
        tailG.appendChild(wrap);
        wrap.appendChild(d);
        return wrap;
      });

      /* ── Le nuage ──────────────────────────────────────────────────
         On retire la classe d'export (cls-1/cls-2…) et on peint depuis la
         palette. ⚠️ On ne touche PAS à `fill-rule` : les nuages évidés
         tiennent leur trou de l'orientation de leurs sous-tracés, telle que
         l'export l'a posée. Y toucher les boucherait. */
      shape.removeAttribute('class');
      shape.setAttribute('class', 'chp4-shape');
      shape.setAttribute('fill', spec.tone === 'grey' ? P.grey : P.ink);
      shape.style.opacity = '0';
      breath.appendChild(shape);

      /* Géométrie mesurée sur le DOM réel — le manifeste dit où se trouvent les
         choses, il ne prétend pas les mesurer. */
      const box = bboxInUserSpace(this.svg, shape);
      const cx  = box.x + box.width  / 2;
      const cy  = box.y + box.height / 2;

      /* ── Pourtour de progression ──────────────────────────────────── */
      const progress = shape.cloneNode(false);
      progress.setAttribute('class', 'chp4-progress');
      progress.setAttribute('fill', 'none');
      progress.setAttribute('stroke', P.accent);
      progress.setAttribute('stroke-width', this.cfg.listen.progress_width);
      progress.setAttribute('stroke-linecap', 'round');
      progress.setAttribute('pointer-events', 'none');
      progress.style.opacity = '0';
      let plen = 0;
      try { plen = progress.getTotalLength(); } catch { plen = 0; }
      progress.setAttribute('stroke-dasharray', plen);
      progress.setAttribute('stroke-dashoffset', plen);
      breath.appendChild(progress);

      /* ── Le mot ───────────────────────────────────────────────────── */
      const label = this._buildLabel(spec, content, box, cx, cy);
      breath.appendChild(label.group);

      /* ── L'invite de survol ───────────────────────────────────────── */
      const glyph = this._buildGlyph(spec, content, cx, box.y + box.height);
      breath.appendChild(glyph);

      /* ── La zone cliquable ────────────────────────────────────────── */
      const hit = svgEl('ellipse', {
        class: 'chp4-hit', cx, cy,
        rx: box.width / 2 * 0.94, ry: box.height / 2 * 0.94,
        fill: 'none', 'pointer-events': 'all',
        'data-clickable': '1',
      });
      breath.appendChild(hit);

      /* ── La croix d'arrêt (au-dessus de la zone cliquable) ────────── */
      const stop = this._buildStop(spec, box);
      breath.appendChild(stop);

      this.bubbles.set(spec.id, {
        spec, content, outer, breath, tailG, dots, shape, progress, plen,
        label, glyph, hit, stop, box, cx, cy,
        audio: null, analyser: null, gain: null, drawn: false,
      });
    }

    this._wireEvents();
    return this;
  }

  /** Compose le libellé, ligne à ligne, ajusté à la largeur du nuage. */
  _buildLabel(spec, content, box, cx, cy) {
    const T = this.cfg.type;
    const P = this.cfg.palette;
    const group = svgEl('g', { class: 'chp4-label', 'pointer-events': 'none' });
    const lines = content.lines ?? [];
    if (!lines.length) return { group, spans: [] };

    const size = content.size ?? 40;
    const lh   = size * T.line_height;
    const [nx, ny] = content.nudge ?? [0, 0];
    // Bloc centré sur le centre du nuage, corrigé du décalage éditorial.
    const top  = cy + ny - ((lines.length - 1) * lh) / 2;

    const textEls = [];
    const spans   = [];
    lines.forEach((line, i) => {
      const t = svgEl('text', {
        class: 'chp4-line',
        x: cx + nx, y: top + i * lh,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-family': T.family, 'font-weight': T.weight,
        'letter-spacing': T.tracking,
        fill: spec.tone === 'paper' ? P.label_dark : P.label_light,
      });
      group.appendChild(t);
      textEls.push(t);
      spans.push(splitLetters(t, line));
    });

    /* Ajustement APRÈS insertion : `fitFontSize` mesure le rendu réel (la
       police du dessin d'origine n'existe pas ici, impossible de prédire le
       débord). Les lignes partagent la même taille — un mot dont la seconde
       ligne rétrécirait seule se lirait de travers. */
    const fitted = fitFontSize(textEls, box.width * T.max_width_ratio, size);
    if (fitted !== size) {
      const flh = fitted * T.line_height;
      const ftop = cy + ny - ((lines.length - 1) * flh) / 2;
      textEls.forEach((t, i) => t.setAttribute('y', ftop + i * flh));
    }

    return { group, spans };
  }

  /** L'invite de survol : ▶ pour un son, ↗ pour la carte. */
  _buildGlyph(spec, content, cx, bottomY) {
    const H = this.cfg.hover;
    const P = this.cfg.palette;
    const r = H.glyph_size / 2;
    const y = bottomY + H.glyph_gap + r;
    /* ⚠️ Pas d'`opacity` en ligne ici : ce glyphe est le SEUL élément du
       chapitre dont l'apparition est pilotée par une classe CSS (:is-hover).
       Une opacité en ligne l'emporterait sur la règle de survol et le glyphe
       ne se montrerait jamais. Son état de repos vit dans la feuille. */
    const g = svgEl('g', { class: 'chp4-glyph', 'pointer-events': 'none' });

    g.appendChild(svgEl('circle', {
      cx, cy: y, r, fill: 'none', stroke: P.ink,
      'stroke-width': 1.5, opacity: 0.55,
    }));

    if (content.action === 'map') {
      // Flèche « sortir vers » — ↗
      g.appendChild(svgEl('path', {
        d: `M${cx - r * 0.34},${y + r * 0.34} L${cx + r * 0.34},${y - r * 0.34}
            M${cx + r * 0.02},${y - r * 0.34} L${cx + r * 0.34},${y - r * 0.34}
            L${cx + r * 0.34},${y - r * 0.02}`,
        fill: 'none', stroke: P.ink, 'stroke-width': 1.9,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }));
    } else {
      // Triangle de lecture, légèrement décentré pour paraître centré.
      const s = r * 0.46;
      g.appendChild(svgEl('path', {
        d: `M${cx - s * 0.7},${y - s} L${cx + s}, ${y} L${cx - s * 0.7},${y + s} Z`,
        fill: P.ink,
      }));
    }
    return g;
  }

  /** La croix d'arrêt, en haut à droite du nuage — visible pendant l'écoute. */
  _buildStop(spec, box) {
    const P = this.cfg.palette;
    const r = 15;
    const x = box.x + box.width - r * 0.6;
    const y = box.y + r * 0.9;
    const g = svgEl('g', { class: 'chp4-stop', 'data-clickable': '1' });
    g.style.opacity = '0';
    g.style.pointerEvents = 'none';        // ouvert seulement pendant l'écoute

    g.appendChild(svgEl('circle', { cx: x, cy: y, r, fill: P.paper,
                                    stroke: P.ink, 'stroke-width': 1.6 }));
    g.appendChild(svgEl('path', {
      d: `M${x - r * 0.36},${y - r * 0.36} L${x + r * 0.36},${y + r * 0.36}
          M${x + r * 0.36},${y - r * 0.36} L${x - r * 0.36},${y + r * 0.36}`,
      fill: 'none', stroke: P.ink, 'stroke-width': 2, 'stroke-linecap': 'round',
    }));
    // Cible tactile confortable, invisible.
    g.appendChild(svgEl('circle', { cx: x, cy: y, r: r * 1.9,
                                    fill: 'none', 'pointer-events': 'all' }));
    return g;
  }

  /* ══════════════════════════════════════════════════════════════════
     APPARITION — appelée par la chorégraphie d'ouverture
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Fait paraître une bulle : la queue enfle depuis la fissure, le contour du
   * nuage se trace, le remplissage monte, le mot s'écrit.
   * @returns {Promise<void>} résolue quand le mot est écrit
   */
  async draw(id) {
    const b = this.bubbles.get(id);
    if (!b || b.drawn) return;
    b.drawn = true;
    const T = this.cfg.bubbles_timing;
    const P = this.cfg.palette;
    const m = this.motion;

    // La queue, une petite bulle après l'autre.
    b.dots.forEach((dot, i) => m.after(i * T.tail_step, () => popDot(dot, m, T.tail_pop)));
    await m.wait(Math.max(0, (b.dots.length - 1) * T.tail_step + T.tail_pop * 0.55));
    if (m.stopped) return;

    // Le nuage se trace, puis se remplit.
    await traceOutline(b.shape, m, {
      trace: T.trace, fill: T.fill,
      color: b.spec.tone === 'grey' ? P.grey : P.ink,
      width: 1.6,
      // Nuage évidé : le fantôme épouse exactement le contour final, le garder
      // ne doublerait rien — mais il ferait un trait de plus à animer. On le jette.
      keepTrace: false,
    });
    if (m.stopped) return;

    // Le mot s'écrit.
    if (b.label.spans?.length) {
      m.after(T.label_delay, () => {
        b.label.spans.forEach((spans, line) => {
          m.after(line * 90, () => writeLetters(spans, m, {
            step: this.cfg.type.letter_step,
            fade: this.cfg.type.letter_fade,
          }));
        });
      });
      const longest = Math.max(...b.label.spans.map((s) => s.length));
      await m.wait(T.label_delay + longest * this.cfg.type.letter_step + this.cfg.type.letter_fade);
    }
  }

  /** Ouvre les interactions. Avant cet appel, aucune bulle ne répond. */
  activate() {
    this._active = true;
    this.svg.classList.add('is-live');
  }

  /* ══════════════════════════════════════════════════════════════════
     SURVOL & CLIC
     ══════════════════════════════════════════════════════════════════ */

  _wireEvents() {
    for (const [id, b] of this.bubbles) {
      b.hit.addEventListener('pointerenter', () => this._hover(id, true));
      b.hit.addEventListener('pointerleave', () => this._hover(id, false));
      b.hit.addEventListener('click', (e) => {
        e.stopPropagation();
        this._activateBubble(id, e);
      });
      b.stop.addEventListener('click', (e) => {
        e.stopPropagation();
        this.stopPlayback();
      });
    }
  }

  _hover(id, on) {
    if (!this._active) return;
    const b = this.bubbles.get(id);
    if (!b) return;
    b.outer.classList.toggle('is-hover', on);
    if (this.playing === id) return;   // pendant l'écoute, l'état d'écoute prime

    // Onde dans la queue : les petites bulles se réveillent en chaîne.
    if (on) {
      b.dots.forEach((dot, i) => {
        this.motion.after(i * this.cfg.hover.tail_ripple, () => {
          this.motion.animate(dot, [
            { transform: 'scale(1)' },
            { transform: 'scale(1.22)', offset: 0.45 },
            { transform: 'scale(1)' },
          ], { duration: 620, easing: EASE.settle });
        });
      });
    }
  }

  /** Clic sur une bulle : écouter, ou ouvrir la carte. */
  _activateBubble(id, ev) {
    if (!this._active) return;
    const b = this.bubbles.get(id);
    if (!b) return;

    if (b.content.action === 'map') {
      this.stopPlayback();
      const rect = b.hit.getBoundingClientRect();
      this.onMap(rect, () => b.outer.classList.remove('is-active'));
      b.outer.classList.add('is-active');
      return;
    }

    if (this.playing === id) { this.stopPlayback(); return; }   // re-clic = arrêt
    this.play(id);
  }

  /* ══════════════════════════════════════════════════════════════════
     ÉCOUTE
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Construit (une fois pour toutes) la chaîne audio d'une bulle.
   *
   * ⚠️ `createMediaElementSource` ne peut être appelé QU'UNE FOIS par élément
   * <audio> : au second appel le navigateur lève une exception et le son est
   * perdu. D'où la mise en cache sur le descripteur de bulle.
   *
   * Repli assumé : si le contexte Web Audio est indisponible, on joue par
   * l'élément <audio> nu (volume au lieu d'un GainNode) et les ondes ondulent
   * sur une amplitude simulée. Une bulle qui joue sans rien montrer serait pire
   * qu'une bulle dont les ondes ne collent pas exactement à la voix.
   */
  _ensureAudio(b) {
    if (b.audio) return b.audio;

    const el = new Audio(b.content.media);
    el.preload  = 'auto';
    el.volume   = this.cfg.listen.volume;
    el.crossOrigin = 'anonymous';
    b.audio = el;

    try {
      const ctx = this.audioMgr?.getAudioContext?.();
      if (ctx) {
        const src      = ctx.createMediaElementSource(el);
        const analyser = ctx.createAnalyser();
        const gain     = ctx.createGain();
        analyser.fftSize = 1024;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        src.connect(analyser);
        analyser.connect(gain);
        gain.connect(ctx.destination);
        b.analyser = analyser;
        b.gain     = gain;
        b.ctx      = ctx;
      }
    } catch (err) {
      console.warn('[chp4] Analyse audio indisponible, lecture simple :', err?.message ?? err);
      b.analyser = null;
      b.gain     = null;
    }

    el.addEventListener('ended', () => {
      if (this.playing === b.spec.id) this.stopPlayback();
    });
    return el;
  }

  async play(id) {
    const b = this.bubbles.get(id);
    if (!b || !b.content.media) return;

    if (this.playing) this.stopPlayback({ keepSession: true });

    const L  = this.cfg.listen;
    const el = this._ensureAudio(b);
    this.playing = id;

    this.svg.classList.add('is-listening');
    b.outer.classList.add('is-active');
    b.stop.style.pointerEvents = 'auto';
    this.motion.animate(b.stop, [{ opacity: 0 }, { opacity: 1 }],
      { duration: 320, easing: EASE.soft });
    if (b.progress) {
      this.motion.animate(b.progress, [{ opacity: 0 }, { opacity: 1 }],
        { duration: L.fade_in, easing: EASE.soft });
    }

    try {
      el.currentTime = 0;
      if (b.gain && b.ctx) {
        b.gain.gain.cancelScheduledValues(b.ctx.currentTime);
        b.gain.gain.setValueAtTime(0, b.ctx.currentTime);
        b.gain.gain.linearRampToValueAtTime(L.volume, b.ctx.currentTime + L.fade_in / 1000);
      }
      await el.play();
    } catch (err) {
      console.warn(`[chp4] Lecture impossible (${b.content.media}) :`, err?.message ?? err);
      this.stopPlayback();
      return;
    }

    this._startPlayLoop(b);
    this._openSession();
  }

  /**
   * Boucle de rendu de l'écoute.
   *
   * Le pourtour du nuage FAIT TOUT : il se referme à mesure que le son avance,
   * et il respire au rythme de la voix — son épaisseur et son halo suivent
   * l'amplitude mesurée. Un seul trait, qui dit à la fois « ça joue », « c'est
   * cette bulle-là » et « on en est là ».
   *
   * ⚠️ Le halo passe par `filter` sur un TRAIT (pas sur le nuage plein) : un
   * filtre sur la surface du nuage la ferait re-rasteriser à chaque frame, ce
   * qui coûte cher sur un contour aussi découpé. Sur le trait seul, c'est
   * négligeable.
   */
  _startPlayLoop(b) {
    const L    = this.cfg.listen;
    const P    = this.cfg.palette;
    const el   = b.audio;
    const buf  = b.analyser ? new Uint8Array(b.analyser.fftSize) : null;
    let level  = 0;

    this._playRaf = this.motion.loop((elapsed) => {
      if (this.playing !== b.spec.id) return false;

      /* Progression : le pourtour du nuage se referme à mesure. */
      if (b.plen && el.duration && isFinite(el.duration)) {
        const p = Math.min(1, el.currentTime / el.duration);
        b.progress.setAttribute('stroke-dashoffset', (b.plen * (1 - p)).toFixed(1));
      }

      /* Amplitude : mesurée si l'analyse est là, simulée sinon. */
      let target;
      if (b.analyser) {
        b.analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i += 4) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        target = Math.min(1, Math.sqrt(sum / (buf.length / 4)) * 3.4);
      } else {
        const t = elapsed / 1000;
        target = L.fallback_amp *
                 (0.55 + 0.45 * Math.sin(t * 2.3) * Math.sin(t * 0.7 + 1.1));
      }
      // Lissage : sans lui le trait grésille au lieu de respirer.
      level += (target - level) * 0.16;

      const v = L.idle + level * (1 - L.idle);
      b.progress.setAttribute('stroke-width',
        (L.progress_width * (1 + L.progress_swell * v)).toFixed(2));
      b.progress.style.filter =
        `drop-shadow(0 0 ${(L.glow_min + (L.glow_max - L.glow_min) * v).toFixed(1)}px ${P.accent})`;
    });
  }

  /**
   * Écoutes globales de la session : Échap, et clic hors des bulles.
   * Posées à la frame SUIVANTE — le clic qui vient de lancer la lecture est
   * encore en train de remonter le DOM ; l'écouter tout de suite reviendrait à
   * s'arrêter soi-même.
   */
  _openSession() {
    this._closeSession();
    const ctrl = new AbortController();
    this._sessionAbort = ctrl;
    requestAnimationFrame(() => {
      if (ctrl.signal.aborted) return;
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.stopPlayback();
      }, { signal: ctrl.signal });
      window.addEventListener('pointerdown', (e) => {
        // Un clic sur une AUTRE bulle est traité par la bulle elle-même
        // (bascule d'écoute) : on ne s'en mêle pas.
        if (e.target.closest?.('.chp4-bubble, #chp4-portal')) return;
        this.stopPlayback();
      }, { signal: ctrl.signal });
    });
  }

  _closeSession() {
    this._sessionAbort?.abort();
    this._sessionAbort = null;
  }

  /**
   * Arrête l'écoute et rend la bulle au repos.
   * @param {Object} [o]
   * @param {boolean} [o.keepSession] on enchaîne sur une autre bulle : inutile
   *                  de défaire les écoutes globales pour les reposer aussitôt.
   */
  stopPlayback(o = {}) {
    const id = this.playing;
    if (!id) return;
    this.playing = null;
    const b = this.bubbles.get(id);
    const L = this.cfg.listen;
    if (!o.keepSession) this._closeSession();
    if (!b) return;

    const el = b.audio;
    if (el) {
      if (b.gain && b.ctx) {
        b.gain.gain.cancelScheduledValues(b.ctx.currentTime);
        b.gain.gain.setValueAtTime(b.gain.gain.value, b.ctx.currentTime);
        b.gain.gain.linearRampToValueAtTime(0, b.ctx.currentTime + L.fade_out / 1000);
        // La pause attend la fin du fondu, sinon le son se coupe net.
        this.motion.after(L.fade_out + 30, () => { try { el.pause(); } catch {} });
      } else {
        try { el.pause(); } catch {}
      }
    }

    this.svg.classList.remove('is-listening');
    b.outer.classList.remove('is-active');
    b.stop.style.pointerEvents = 'none';
    this.motion.animate(b.stop, [{ opacity: 1 }, { opacity: 0 }],
      { duration: 260, easing: EASE.soft });
    this.motion.animate(b.progress, [{ opacity: 1 }, { opacity: 0 }],
      { duration: L.fade_out, easing: EASE.soft })
      ?.finished.then(() => {
        // Rendu à son état de départ, prêt pour une prochaine écoute.
        b.progress.setAttribute('stroke-dashoffset', b.plen);
        b.progress.setAttribute('stroke-width', L.progress_width);
        b.progress.style.filter = '';
      }).catch(() => {});
  }

  /* ══════════════════════════════════════════════════════════════════
     DÉMONTAGE
     ══════════════════════════════════════════════════════════════════ */

  destroy() {
    this.playing = null;
    this._closeSession();
    this.motion.stop();
    for (const b of this.bubbles.values()) {
      if (b.audio) {
        try { b.audio.pause(); } catch {}
        // `src = ''` interrompt le téléchargement en cours : sans lui, un mp3
        // de 2 Mo continue d'arriver après la sortie du chapitre.
        try { b.audio.src = ''; b.audio.load(); } catch {}
      }
      try { b.gain?.disconnect(); b.analyser?.disconnect(); } catch {}
      b.audio = b.gain = b.analyser = b.ctx = null;
    }
    this.bubbles.clear();
  }
}
