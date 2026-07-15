/**
 * DocumentOverlay.js
 * -----------------------------------------------------------------------------
 * Affichage des contenus de la colonne haut-droite (scène phrénologie) :
 *
 *   'about'  → mise en scène « À Propos » (AboutReveal.js) : accroche
 *              calligraphiée lettre à lettre puis corps révélé — sans
 *              ascenseur sur grand écran, défilement toléré sur tactile
 *   'doc-1'  → deux cadres tracés côte à côte, puis deux images en fondu
 *   'doc-2'  → un cadre tracé, puis une image en fondu
 *   'doc-3'  → un cadre tracé, puis un site incrusté (image fixe sur tactile)
 *   'doc-4'  → un cadre tracé, puis un site incrusté
 *
 * EMPILEMENT — z-index 7 :
 *   #veil (6) < #doc-overlay (7) < #nav-bar (8) < #doc-btns (9)
 * L'overlay capte le clic « n'importe où » pour se fermer, tout en laissant les
 * boutons et la navbar cliquables au-dessus. Cliquer ailleurs qu'un document le
 * referme ; cliquer un autre bouton bascule le contenu.
 *
 * LES CADRES ÉPOUSENT LEUR MÉDIA (comme au chapitre 3, mais sans reflet animé).
 * Le ratio n'est pas codé en dur : il est lu sur l'image (naturalWidth/Height)
 * une fois décodée, ou fourni par la config pour les incrustations. La mise en
 * page est ensuite CALCULÉE, pas devinée :
 *
 *     H = min(hauteurDispo, (largeurDispo - gaps) / Σ ratios)
 *     wᵢ = H · ratioᵢ                          (hauteurs égales, largeurs justes)
 *
 * Le rectangle est tracé sur ces dimensions exactes, en pixels réels. C'est ce
 * qui corrige le tracé erratique : auparavant le cadre était mesuré avant que
 * son image ait la moindre taille. Un ResizeObserver relance le calcul dès que
 * la zone change (resize, plein écran, rotation).
 *
 * On n'utilise ni `pathLength` ni `vector-effect:non-scaling-stroke` : combinés,
 * ils font ignorer pathLength au navigateur et le tracé se fend.
 */

import { DocumentLoupe } from './DocumentLoupe.js';
import { AboutReveal }   from './AboutReveal.js';

const OVERLAY_ID = 'doc-overlay';

/* Durées (ms) — accordées au langage visuel du site. */
const T = {
  fadeOut:     520,
  frameDraw:   900,
  mediaFade:  1200,
  paraStagger: 260,
};

/* Bornes de la police du texte « À Propos » (px). */
const TEXT_MIN_PX = 11;
const TEXT_MAX_PX = 30;

export class DocumentOverlay {
  constructor(config) {
    this.config = config;

    /** Clé affichée, ou null. */
    this.currentKey = null;

    /** Loupe (documents images uniquement). */
    this._loupe = new DocumentLoupe(config);

    this.el    = null;   // racine
    this.inner = null;   // zone de contenu

    this._timers = [];
    this._frames   = [];   // { el, ratio } — ratio = largeur / hauteur
    this._row      = null;
    this._text     = null;
    this._textBody = null;  // corps mesurable d'un contenu 'text'
    this._about    = null;  // article « À Propos » (mise en scène AboutReveal)
    this._aboutFx  = null;  // moteur de la mise en scène « À Propos »
    this._caption  = null;  // légende (colonne gauche)
    this._ro       = null;  // ResizeObserver
    this._roRaf    = null;

    this._onKeyDown = this._onKeyDown.bind(this);
  }

  /* ── Cycle de vie ──────────────────────────────────────────────────────── */

  /** Ouvre un document. Rappeler la même clé referme (bascule). */
  open(key) {
    const data = this.config.DOCUMENTS?.[key];
    if (!data) { console.warn(`[DocumentOverlay] Contenu inconnu : ${key}`); return; }
    if (this.currentKey === key) { this.close(); return; }

    this._ensureDOM();
    this._clearTimers();
    this._disconnectObserver();

    this.currentKey = key;
    this._aboutFx?.destroy();
    this.inner.innerHTML = '';
    this._frames   = [];
    this._row      = null;
    this._text     = null;
    this._textBody = null;
    this._about    = null;
    this._aboutFx  = null;
    this._caption  = null;
    this._revealed = false;   // la révélation (tracé) rejoue à CHAQUE ouverture
    this._drawing  = false;

    this._loupe.disable();

    if (data.type === 'about')     this._buildAbout(data);
    else if (data.type === 'text') this._buildText(data);
    else                           this._buildDocument(data);

    this.el.classList.add('visible');
    document.addEventListener('keydown', this._onKeyDown);
  }

  close() {
    if (!this.el || !this.currentKey) return;

    this.currentKey = null;
    this._clearTimers();
    this._disconnectObserver();
    this._aboutFx?.destroy();
    this._aboutFx = null;
    this._loupe.disable();
    this.el.classList.remove('visible');
    document.removeEventListener('keydown', this._onKeyDown);

    // Purge différée : libère les images et interrompt toute incrustation.
    this._addTimer(() => {
      if (!this.currentKey && this.inner) {
        this.inner.innerHTML = '';
        this._frames = [];
        this._row = this._text = this._textBody = this._caption = null;
        this._about = null;
        this._blurTop = this._blurBot = null;
      }
    }, T.fadeOut + 60);
  }

  /** Recalcule la mise en page (appelé par la scène au resize). */
  resize() {
    this._applySideColumn();
    if (!this.currentKey) return;
    if (this._about)     this._aboutFx?.resize();
    else if (this._text) this._sizeText();
    else                 this._layoutFrames(false);
  }

  destroy() {
    this._clearTimers();
    this._disconnectObserver();
    this._aboutFx?.destroy();
    this._loupe.disable();
    document.removeEventListener('keydown', this._onKeyDown);
    this.currentKey = null;
    this._frames = [];
    this._row = this._text = this._textBody = this._caption = null;
    this._about = this._aboutFx = null;
    this._blurTop = this._blurBot = null;
    this.el?.remove();
    this.el = this.inner = null;
  }

  /* ── DOM racine ────────────────────────────────────────────────────────── */

  _ensureDOM() {
    if (this.el) return;
    const app = document.getElementById('app');
    if (!app) return;

    const root = document.createElement('div');
    root.id = OVERLAY_ID;
    root.innerHTML = `
      <div class="doc-ov-backdrop"></div>
      <div class="doc-ov-stage"><div class="doc-ov-inner"></div></div>`;

    // Clic n'importe où (y compris hors des documents) → fermeture.
    // Les zones qui doivent rester utilisables (texte défilable, incrustation,
    // liens) arrêtent la propagation.
    root.addEventListener('click', () => this.close());

    app.appendChild(root);
    this.el    = root;
    this.inner = root.querySelector('.doc-ov-inner');
    this._applySideColumn();
  }

  /**
   * Largeur des colonnes latérales (légende gauche + gouttière droite), posée
   * en variable CSS depuis la MÊME source que les boutons documents
   * (CONFIG.LAYOUT.sideColPx). Garantit que le document reste centré entre les
   * deux colonnes et que la gouttière couvre exactement l'emprise des boutons,
   * à toute largeur d'écran. Rappelé à chaque resize().
   */
  _applySideColumn() {
    if (!this.el) return;
    const vW  = Math.max(this.config.MIN_SIZE.width,  window.innerWidth);
    const col = this.config.LAYOUT?.sideColPx?.(vW)
             ?? Math.round(Math.min(300, vW * 0.19));
    this.el.style.setProperty('--doc-ov-side', col + 'px');

    // Marge verticale réglable en config, MAIS bornée par le bas pour ne jamais
    // chevaucher la navbar (bottom 5% + hauteur d'un bouton ≈ taille flèche) ni,
    // en haut, le titre + la flèche. On prend donc le MAX entre le réglage et
    // ces planchers → aucun chevauchement possible, quelle que soit la fenêtre.
    const vH = Math.max(this.config.MIN_SIZE.height, window.innerHeight);
    const marginVh = this.config.DOCS?.overlay?.margin_v_vh ?? 11;
    const wanted   = vH * marginVh / 100;

    // Plancher bas = emprise navbar + petite respiration.
    const arrow = this.config.ARROW ?? {};
    const sz = Math.max(arrow.size_min ?? 36,
                        Math.min(arrow.size_max ?? 120,
                                 Math.min(vW, vH) * (arrow.size_vh ?? 7) / 100));
    const navBottom = vH * 0.05 + sz + 24;         // navbar + marge
    const topFloor  = Math.max(64, vH * 0.11);     // titre + flèche

    const marginTop = Math.round(Math.max(wanted, topFloor));
    const marginBot = Math.round(Math.max(wanted, navBottom));
    this.el.style.setProperty('--doc-ov-margin-top', marginTop + 'px');
    this.el.style.setProperty('--doc-ov-margin-bot', marginBot + 'px');

    // Largeur max du texte « À Propos », réglable en config.
    const aboutFrac = this.config.DOCS?.overlay?.about_max_frac ?? 0.94;
    this.el.style.setProperty('--doc-ov-about-frac', String(aboutFrac));
  }

  _onKeyDown(e) { if (e.key === 'Escape') this.close(); }

  /* ── « À Propos » — mise en scène (AboutReveal) ────────────────────────── */

  /**
   * Monte l'expérience « À Propos » : accroche calligraphiée (tracé SVG lettre
   * à lettre, mots-clefs dorés, soulignement), puis remontée et corps révélé
   * lettre par lettre. Toute la mécanique vit dans AboutReveal ; l'overlay ne
   * fournit que le cadre (zone entre les colonnes, fermeture, resize).
   */
  _buildAbout(data) {
    const article = document.createElement('article');
    article.className = 'doc-ov-about';
    // Un clic sur le texte AVANCE la séquence (fast-forward) — il ne ferme
    // pas l'overlay. Molette et gestes de lecture restent locaux.
    article.addEventListener('click', (e) => {
      e.stopPropagation();
      this._aboutFx?.skip();
    });
    article.addEventListener('wheel', e => e.stopPropagation(), { passive: true });

    this.inner.appendChild(article);
    this._about   = article;
    this._aboutFx = new AboutReveal(this.config, data);
    this._aboutFx.mount(article)
      .catch(err => console.warn('[DocumentOverlay] À Propos :', err));
  }

  /* ── Contenus 'text' (paragraphes simples) ─────────────────────────────── */

  _buildText(data) {
    const article = document.createElement('article');
    article.className = 'doc-ov-text';
    // Le texte est défilable : un geste de lecture (molette, glissé) ne doit
    // pas refermer l'overlay.
    article.addEventListener('click', e => e.stopPropagation());
    article.addEventListener('wheel', e => e.stopPropagation(), { passive: true });

    const body = document.createElement('div');
    body.className = 'doc-ov-text-body';

    data.paragraphs.forEach(txt => {
      const p = document.createElement('p');
      p.textContent = txt;
      body.appendChild(p);
    });

    article.appendChild(body);
    this.inner.appendChild(article);
    this._text     = article;
    this._textBody = body;

    // Bandes de flou haut/bas (indice de défilement, en plus du fondu au noir).
    const blurTop = document.createElement('div');
    blurTop.className = 'doc-ov-text-blur top';
    const blurBot = document.createElement('div');
    blurBot.className = 'doc-ov-text-blur bot';
    this.inner.appendChild(blurTop);
    this.inner.appendChild(blurBot);
    this._blurTop = blurTop;
    this._blurBot = blurBot;

    // Fondus haut/bas indexés sur la position de défilement.
    article.addEventListener('scroll', () => this._updateTextFade(), { passive: true });

    this._sizeText();
    requestAnimationFrame(() => {
      Array.from(body.children).forEach((p, i) => {
        this._addTimer(() => p.classList.add('in'), 120 + i * T.paraStagger);
      });
    });

    this._observe(article);
  }

  /**
   * Fixe une taille de police proportionnelle au viewport (bornée par la
   * config). Le texte est CENTRÉ ; s'il dépasse la hauteur, il DÉFILE (overflow
   * géré en CSS) — plus d'ajustement dichotomique, plus de risque de chevauchement
   * avec l'UI. Rappelé au resize.
   */
  _sizeText() {
    const el = this._text;
    if (!el) return;
    const ov  = this.config.DOCS?.overlay ?? {};
    const min = ov.about_min_px ?? TEXT_MIN_PX;
    const max = ov.about_max_px ?? TEXT_MAX_PX;
    const px  = Math.min(max, Math.max(min, Math.round(window.innerHeight * 0.026)));
    el.style.fontSize   = px + 'px';
    el.style.lineHeight = px < 15 ? '1.6' : '1.75';

    // Débordement → mode défilement (sinon justify-content:center couperait le
    // haut, inatteignable au scroll). Centré tant que ça tient, ancré en haut
    // dès que ça dépasse.
    requestAnimationFrame(() => {
      if (!this._text) return;
      const scrolls = this._text.scrollHeight > this._text.clientHeight + 1;
      this._text.classList.toggle('is-scroll', scrolls);
      this._updateTextFade();
    });
  }

  /**
   * Ajuste les zones de fondu haut/bas (--fade-top / --fade-bot) selon la
   * position de défilement : le fondu du haut n'apparaît que s'il reste du texte
   * au-dessus, celui du bas que s'il en reste en dessous. Le fondu évoque ainsi
   * la présence de contenu qui continue, sans jamais masquer inutilement.
   */
  _updateTextFade() {
    const el = this._text;
    if (!el) return;
    const FADE = 68;                       // hauteur du dégradé (px) — fondu accentué
    const max  = el.scrollHeight - el.clientHeight;
    if (max <= 1) {                        // rien à défiler → aucun fondu
      el.style.setProperty('--fade-top', '0px');
      el.style.setProperty('--fade-bot', '0px');
      if (this._blurTop) this._blurTop.style.opacity = '0';
      if (this._blurBot) this._blurBot.style.opacity = '0';
      return;
    }
    const top = Math.min(FADE, el.scrollTop);
    const bot = Math.min(FADE, max - el.scrollTop);
    el.style.setProperty('--fade-top', top.toFixed(1) + 'px');
    el.style.setProperty('--fade-bot', bot.toFixed(1) + 'px');

    // Les bandes de flou suivent le fondu : opacité proportionnelle (0 → 1).
    if (this._blurTop) this._blurTop.style.opacity = (top / FADE).toFixed(2);
    if (this._blurBot) this._blurBot.style.opacity = (bot / FADE).toFixed(2);
  }

  /* ── Documents ─────────────────────────────────────────────────────────── */

  _buildDocument(data) {
    const isEmbed = data.type === 'embed';

    // ── Colonne gauche : légende alignée à droite (miroir de la colonne des
    //    boutons à droite). Le document est ainsi recentré entre les deux. ──
    const caption = document.createElement('figcaption');
    caption.className = 'doc-ov-caption';
    caption.innerHTML = `<span class="doc-ov-cap-text">${data.caption}</span>`;

    if (data.source?.href) {
      const a = document.createElement('a');
      a.className = 'doc-ov-source';
      a.href   = data.source.href;
      a.target = '_blank';
      a.rel    = 'noopener noreferrer';
      a.textContent = data.source.label ?? 'Source';
      a.dataset.clickable = 'true';           // curseur « hotspot » (cursor.js)
      a.addEventListener('click', e => e.stopPropagation());
      caption.appendChild(a);
    }
    this._caption = caption;

    // ── Colonne centrale : les cadres ──
    const row = document.createElement('div');
    row.className = 'doc-ov-row' + (isEmbed ? ' is-embed' : '');
    this._row = row;

    if (isEmbed) row.appendChild(this._makeEmbedFrame(data));
    else         data.frames.forEach(f => row.appendChild(this._makeImageFrame(f)));

    // Grille : [légende gauche] [documents centre]. La colonne droite (boutons)
    // est matérialisée par le padding du stage ; on l'équilibre à gauche par la
    // légende, de même gabarit.
    this.inner.appendChild(caption);
    this.inner.appendChild(row);

    this._observe(row);
  }

  /**
   * Révèle un document une fois ses cadres dimensionnés : trace les rectangles,
   * puis fait apparaître médias et légende. Centralisé ici pour être rejoué à
   * l'IDENTIQUE à chaque (ré)ouverture — l'animation ne doit jamais être sautée,
   * y compris quand l'image est servie depuis le cache (voir _makeImageFrame).
   * @param {boolean} animate  true = tracé animé
   */
  _revealDocument(animate) {
    if (!this._frames.every(f => f.ratio)) return;
    if (this._revealed) return;          // une seule révélation par ouverture
    this._revealed = true;

    // Verrou anti-course : pendant l'animation d'entrée, le ResizeObserver ne
    // doit pas repositionner (il remettrait strokeDashoffset à 0 et couperait
    // le tracé). Levé une fois le rectangle entièrement dessiné.
    this._drawing = true;
    this._layoutFrames(animate);
    this._addTimer(() => { this._drawing = false; }, animate ? T.frameDraw + 260 : 0);

    const medias = this._row?.querySelectorAll('.doc-ov-media') ?? [];
    const revealDelay = animate ? T.frameDraw * 0.7 : 0;
    this._addTimer(() => medias.forEach(m => m.classList.add('in')), revealDelay);
    this._addTimer(() => this._caption?.classList.add('in'), revealDelay + 120);

    // Loupe : seulement pour les documents « images » (doc-1, doc-2).
    const data = this.config.DOCUMENTS?.[this.currentKey];
    if (data?.type === 'images') {
      const targets = [];
      this._row?.querySelectorAll('.doc-ov-frame').forEach(frame => {
        const img = frame.querySelector('img.doc-ov-media');
        if (img) targets.push({ frame, img });
      });
      if (targets.length) this._loupe.enable(this.el, targets);
    }
  }

  /** Cadre d'image : le ratio est lu sur l'image, puis le document est révélé. */
  _makeImageFrame(frame) {
    const el = this._makeFrameShell();
    // Le clic sur le cadre (donc sur l'image) NE ferme PAS : seul un clic
    // en dehors des documents referme.
    el.addEventListener('click', e => e.stopPropagation());

    const img = document.createElement('img');
    img.className = 'doc-ov-media';
    img.alt       = frame.alt ?? '';
    img.draggable = false;
    img.decoding  = 'async';

    const entry = this._frames[this._frames.length - 1];

    const onReady = () => {
      if (img.naturalWidth && img.naturalHeight) {
        entry.ratio = img.naturalWidth / img.naturalHeight;
      }
      entry.ratio = entry.ratio || 0.72;
      // Révèle dès que TOUS les cadres connaissent leur ratio → animation jouée
      // en une fois, cadres alignés.
      this._revealDocument(true);
    };

    const onError = () => {
      img.remove();
      entry.ratio = entry.ratio || 0.72;      // portrait par défaut
      el.appendChild(this._makeMissing('Image indisponible'));
      this._revealDocument(true);
    };

    img.addEventListener('error', onError, { once: true });

    // ⚠️ CACHE : une image déjà en cache ne redéclenche PAS 'load'. Sans ce
    // test, la 2ᵉ ouverture d'un document (ou le passage d'un bouton à l'autre)
    // n'animait plus rien. On force donc la lecture immédiate si l'image est
    // déjà complète, sinon on attend 'load'.
    img.addEventListener('load', onReady, { once: true });
    img.src = frame.src;
    if (img.complete && img.naturalWidth) {
      // Déjà en cache : déclenche la révélation au prochain tick (le cadre doit
      // d'abord être dans le DOM pour être mesurable).
      requestAnimationFrame(() => onReady());
    }

    el.appendChild(img);
    return el;
  }

  /**
   * Cadre d'incrustation. Le ratio vient de la config (`ratio: '16 / 9'`).
   * Sur écran tactile, l'incrustation cède la place à une image fixe.
   * Le lien de la légende reste le filet : il couvre aussi le cas d'un site
   * qui refuse l'incrustation (X-Frame-Options / frame-ancestors).
   */
  _makeEmbedFrame(data) {
    const el = this._makeFrameShell();
    const entry = this._frames[this._frames.length - 1];

    // Incrustation : `_layoutFrames` reconnaît ce drapeau. Par défaut la boîte
    // est la plus grande au ratio du document qui tient dans la zone (identique
    // pour tous les embeds). Les fractions width_frac/height_frac de la config
    // (par document, sinon globales DOCS.overlay.embed_*) forcent une taille.
    entry.embed = true;
    entry.ratio = this._parseRatio(data.ratio) ?? (16 / 9);
    entry.wFrac = (typeof data.width_frac  === 'number') ? data.width_frac  : null;
    entry.hFrac = (typeof data.height_frac === 'number') ? data.height_frac : null;

    const coarse = window.matchMedia?.('(pointer: coarse)').matches;

    if (coarse) {
      if (data.poster) {
        const img = document.createElement('img');
        img.className = 'doc-ov-media';
        img.alt = data.caption ?? '';
        img.draggable = false;
        const done = () => this._revealDocument(true);
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', () => {
          img.remove();
          el.appendChild(this._makeEmbedFallback(data));
          this._revealDocument(true);
        }, { once: true });
        img.src = data.poster;
        if (img.complete && img.naturalWidth) requestAnimationFrame(done);
        el.appendChild(img);
      } else {
        el.appendChild(this._makeEmbedFallback(data));
        requestAnimationFrame(() => this._revealDocument(true));
      }
      el.addEventListener('click', e => e.stopPropagation());
      return el;
    }

    const ov = this.config.DOCS?.overlay ?? {};

    const iframe = document.createElement('iframe');
    iframe.className = 'doc-ov-media doc-ov-embed';

    // ── DÉFILEMENT INITIAL (embed_hash) ───────────────────────────────────
    // VRAI défilement : on ajoute une ancre (#nom) à l'URL. Le navigateur
    // défile de lui-même jusqu'à cet élément au chargement — le haut de la page
    // reste accessible (on peut remonter). C'est la SEULE façon de « descendre »
    // dans un site d'un autre domaine (un défilement en pixels par script est
    // interdit par le navigateur). Ne marche que si le site possède l'ancre.
    const rawHash = (typeof data.embed_hash === 'string' && data.embed_hash) ? data.embed_hash
                  : (typeof ov.embed_hash   === 'string' && ov.embed_hash)   ? ov.embed_hash
                  : '';
    const hash = rawHash && !rawHash.startsWith('#') ? '#' + rawHash : rawHash;
    iframe.src            = data.url + hash;
    iframe.loading        = 'lazy';
    iframe.referrerPolicy = 'no-referrer';
    iframe.setAttribute('allow', 'fullscreen; autoplay');
    iframe.setAttribute('title', data.caption ?? 'Document');

    // ── ROGNAGE DU HAUT (embed_offset_top) — option distincte ─────────────
    // Alternative pour un site SANS ancre : on décale l'iframe vers le haut et
    // le cadre (overflow:hidden) masque ce qui dépasse. ⚠️ Cache réellement le
    // haut (non récupérable). Laisser à 0 si l'on utilise embed_hash.
    const offset = (typeof data.embed_offset_top === 'number') ? data.embed_offset_top
                 : (typeof ov.embed_offset_top   === 'number') ? ov.embed_offset_top
                 : 0;
    if (offset > 0) {
      iframe.style.position = 'absolute';
      iframe.style.top      = (-offset) + 'px';
      iframe.style.left     = '0';
      iframe.style.width    = '100%';
      iframe.style.height   = `calc(100% + ${offset}px)`;
    }

    // L'incrustation garde ses propres interactions (molette pour défiler,
    // clics internes) ET un clic dessus ne referme pas l'overlay.
    el.addEventListener('click', e => e.stopPropagation());
    el.addEventListener('wheel', e => e.stopPropagation(), { passive: true });

    el.appendChild(iframe);
    // Le cadre a des dimensions dès le layout (indépendant du chargement du
    // site distant) : on révèle tout de suite, l'iframe se peint ensuite.
    requestAnimationFrame(() => this._revealDocument(true));
    return el;
  }

  _parseRatio(str) {
    if (!str) return null;
    const m = String(str).split('/');
    if (m.length !== 2) return null;
    const w = parseFloat(m[0]), h = parseFloat(m[1]);
    return (w > 0 && h > 0) ? w / h : null;
  }

  _makeMissing(text) {
    const box = document.createElement('div');
    box.className = 'doc-ov-missing doc-ov-media in';
    box.textContent = text;
    return box;
  }

  _makeEmbedFallback(data) {
    const box = document.createElement('div');
    box.className = 'doc-ov-missing doc-ov-media in';
    const a = document.createElement('a');
    a.href   = data.source?.href ?? data.url;
    a.target = '_blank';
    a.rel    = 'noopener noreferrer';
    a.textContent = data.source?.label ?? 'Consulter le document';
    a.dataset.clickable = 'true';
    a.addEventListener('click', e => e.stopPropagation());
    box.appendChild(a);
    return box;
  }

  /* ── Cadre : coquille, mise en page, tracé ─────────────────────────────── */

  _makeFrameShell() {
    const el = document.createElement('div');
    el.className = 'doc-ov-frame';
    el.innerHTML = `
      <svg class="doc-ov-frame-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect class="doc-ov-rect" x="0.5" y="0.5"/>
      </svg>`;
    this._frames.push({ el, ratio: null, embed: false });
    return el;
  }

  /**
   * Calcule et applique les dimensions des cadres, puis (re)trace les rectangles.
   * Hauteur commune, largeurs proportionnelles aux ratios : deux planches de
   * formats voisins s'alignent, et l'ensemble reste toujours dans la zone.
   * @param {boolean} animate true = tracé animé (première apparition)
   */
  _layoutFrames(animate) {
    const row = this._row;
    if (!row || !this._frames.length) return;
    if (!this._frames.every(f => f.ratio)) return;

    // Proportion réglable en config : le document n'occupe qu'une fraction de
    // la zone disponible (respiration autour). Défauts : 0.90 en hauteur, 1.0
    // en largeur.
    const ov = this.config.DOCS?.overlay ?? {};
    const fracH = ov.doc_max_frac_h ?? 0.90;
    const fracW = ov.doc_max_frac_w ?? 1.00;

    const availW = row.clientWidth  * fracW;
    const availH = row.clientHeight * fracH;
    if (availW < 8 || availH < 8) return;

    // ── Incrustation, centrée. Par défaut : la plus grande boîte au ratio du
    //    document qui tient dans la zone (deux embeds ont alors la même taille).
    //    Les fractions de config forcent une taille : per-document d'abord
    //    (width_frac/height_frac), sinon global (overlay.embed_width/height_frac).
    //    Fournir les DEUX = boîte explicite (ratio ignoré) ; une seule = l'autre
    //    suit le ratio ; aucune = auto. ──
    if (this._frames.length === 1 && this._frames[0].embed) {
      const f     = this._frames[0];
      const ratio = f.ratio || (16 / 9);
      const clamp01 = v => Math.max(0.05, Math.min(1, v));
      const wF = f.wFrac ?? ov.embed_width_frac  ?? null;
      const hF = f.hFrac ?? ov.embed_height_frac ?? null;

      let w, h;
      if (wF != null && hF != null) {
        // Les deux fournis : boîte explicite (ratio ignoré).
        w = availW * clamp01(wF);
        h = availH * clamp01(hF);
      } else if (wF != null) {
        // Largeur imposée, hauteur au ratio (bornée par la zone).
        w = availW * clamp01(wF); h = w / ratio;
        if (h > availH) { h = availH; w = h * ratio; }
      } else if (hF != null) {
        // Hauteur imposée, largeur au ratio (bornée par la zone).
        h = availH * clamp01(hF); w = h * ratio;
        if (w > availW) { w = availW; h = w / ratio; }
      } else {
        // Auto : plus grande boîte au ratio qui tient dans la zone.
        w = availW; h = w / ratio;
        if (h > availH) { h = availH; w = h * ratio; }
      }
      w = Math.round(w); h = Math.round(h);
      f.el.style.width  = w + 'px';
      f.el.style.height = h + 'px';
      this._drawRect(f.el, w, h, animate, 0);
      this._syncCaptionBottom(row.clientHeight, h);
      return;
    }

    const gap    = parseFloat(getComputedStyle(row).gap) || 0;
    const gaps   = gap * (this._frames.length - 1);
    const sumR   = this._frames.reduce((s, f) => s + f.ratio, 0);

    // Hauteur commune : bornée par la hauteur ET par la largeur disponibles.
    const H = Math.max(40, Math.min(availH, (availW - gaps) / sumR));

    this._frames.forEach((f, i) => {
      const w = Math.round(H * f.ratio);
      const h = Math.round(H);
      f.el.style.width  = w + 'px';
      f.el.style.height = h + 'px';
      this._drawRect(f.el, w, h, animate, i * 160);
    });
    this._syncCaptionBottom(row.clientHeight, Math.round(H));
  }

  /**
   * Aligne le BAS de la légende sur le BAS du rectangle du document. Le document
   * est centré verticalement dans la row (pleine hauteur de la zone), donc son
   * bas se situe à (hauteurZone + hauteurDoc) / 2 depuis le haut. On pose cet
   * écart depuis le bas (--doc-ov-cap-bottom) et la légende s'y cale.
   * @param {number} zoneH  hauteur de la zone (row.clientHeight)
   * @param {number} docH   hauteur du cadre document
   */
  _syncCaptionBottom(zoneH, docH) {
    if (!this.el) return;
    const bottomGap = Math.max(0, Math.round((zoneH - docH) / 2));
    this.el.style.setProperty('--doc-ov-cap-bottom', bottomGap + 'px');
  }

  /**
   * Trace (ou repositionne) le rectangle. Périmètre en pixels réels : le tracé
   * est exact à toute taille, sans pathLength ni non-scaling-stroke.
   */
  _drawRect(el, w, h, animate, delay = 0) {
    const rect = el.querySelector('.doc-ov-rect');
    const svg  = el.querySelector('.doc-ov-frame-svg');
    if (!rect || !svg || w < 2 || h < 2) return;

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    rect.setAttribute('width',  Math.max(1, w - 1));
    rect.setAttribute('height', Math.max(1, h - 1));

    const perim = 2 * (w + h);
    rect.style.strokeDasharray = String(perim);

    if (!animate) {
      rect.style.transition       = 'none';
      rect.style.strokeDashoffset = '0';
      return;
    }

    rect.style.transition       = 'none';
    rect.style.strokeDashoffset = String(perim);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      rect.style.transition       = `stroke-dashoffset ${T.frameDraw}ms cubic-bezier(0.4,0,0.2,1) ${delay}ms`;
      rect.style.strokeDashoffset = '0';
    }));
  }

  /* ── Observation de la zone ────────────────────────────────────────────── */

  /**
   * Relance la mise en page quand la zone utile change RÉELLEMENT (resize,
   * plein écran, rotation). Throttlé par rAF.
   *
   * ⚠️ Un ResizeObserver émet TOUJOURS une notification à l'observation. Sans
   * garde, cette première notification appelait _layoutFrames(false), qui pose
   * strokeDashoffset=0 → le rectangle apparaissait déjà tracé et l'animation
   * d'apparition était perdue. On ignore donc la première notification, et on
   * ne réagit ensuite qu'à un vrai changement de dimensions.
   */
  _observe(target) {
    if (!target || typeof ResizeObserver === 'undefined') return;
    this._roPrimed = false;
    this._roLast   = { w: 0, h: 0 };
    this._ro = new ResizeObserver(entries => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      // 1ʳᵉ notification (installation) : on mémorise et on laisse l'animation
      // initiale jouer sans interférence.
      if (!this._roPrimed) {
        this._roPrimed = true;
        this._roLast = { w: Math.round(cr.width), h: Math.round(cr.height) };
        return;
      }
      // Ignorer le bruit sous-pixel : ne réagir qu'à un changement net.
      if (Math.abs(cr.width  - this._roLast.w) < 2 &&
          Math.abs(cr.height - this._roLast.h) < 2) return;
      this._roLast = { w: Math.round(cr.width), h: Math.round(cr.height) };

      if (this._roRaf) cancelAnimationFrame(this._roRaf);
      this._roRaf = requestAnimationFrame(() => {
        this._roRaf = null;
        if (!this.currentKey || this._drawing) return;   // pas pendant le tracé
        if (this._text) this._sizeText();
        else            this._layoutFrames(false);       // repositionne sans rejouer le tracé
      });
    });
    this._ro.observe(target);
  }

  _disconnectObserver() {
    if (this._roRaf) { cancelAnimationFrame(this._roRaf); this._roRaf = null; }
    this._ro?.disconnect();
    this._ro = null;
  }

  /* ── Timers ────────────────────────────────────────────────────────────── */

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
