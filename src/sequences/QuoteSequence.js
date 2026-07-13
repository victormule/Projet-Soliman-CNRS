/**
 * QuoteSequence.js
 * -----------------------------------------------------------------------------
 * Séquence autonome de citation typée pour les chapitres.
 *
 * INTENTION
 * -----------------------------------------------------------------------------
 * Ce module est conçu comme un espace narratif autonome :
 * - la scène appelle simplement la séquence,
 * - tout le comportement du texte vit ici,
 * - on peut retravailler librement la sensation du typing sans toucher
 *   à Chapitre1Scene.js.
 *
 * OBJECTIFS
 * -----------------------------------------------------------------------------
 * - Typing sensible, organique, non mécanique
 * - Bloc texte centré et noble
 * - Justification gauche / droite
 * - Responsive réel selon la taille de fenêtre
 * - Marges proportionnelles pour ne jamais sortir du cadre
 * - Skip propre
 * - Intégration stable avec le fondu final du chapitre
 *
 * CONTRAT AVEC Chapitre1Scene
 * -----------------------------------------------------------------------------
 * La scène appelle :
 *
 *   await runSkippableQuoteSequence({...})
 *
 * Puis récupère la main quand :
 * - la quote est terminée naturellement,
 * - ou qu'elle a été skippée.
 *
 * IMPORTANT
 * -----------------------------------------------------------------------------
 * Le conteneur #chapter-quote reste celui contrôlé par la scène pour les fades
 * finaux. Ici, on ne pilote que son contenu interne.
 */

export async function runSkippableQuoteSequence({
  transition, // conservé pour compatibilité avec l'appel actuel
  text,
  charDelay = 54,
  skipDelay = 2000,
  afterTypingDelay = 2800,
  showSkipButton,
  hideSkipButton,
  wait,
  isStillValid = () => true,
}) {
  if (typeof text !== 'string') {
    throw new Error('runSkippableQuoteSequence: "text" doit être une chaîne.');
  }
  if (typeof showSkipButton !== 'function') {
    throw new Error('runSkippableQuoteSequence: "showSkipButton" manquant.');
  }
  if (typeof hideSkipButton !== 'function') {
    throw new Error('runSkippableQuoteSequence: "hideSkipButton" manquant.');
  }
  if (typeof wait !== 'function') {
    throw new Error('runSkippableQuoteSequence: "wait" manquant.');
  }

  const rootEl = document.getElementById('chapter-quote');
  if (!rootEl) {
    throw new Error('runSkippableQuoteSequence: #chapter-quote introuvable.');
  }

  /**
   * CONFIG CRÉATIVE
   * ---------------------------------------------------------------------------
   * Toute la direction artistique du texte est centralisée ici.
   * C'est cet objet qu'on peut faire évoluer ensuite pour affiner :
   * - rythme,
   * - respiration,
   * - largeur,
   * - placement,
   * - densité,
   * - présence.
   */
  const CFG = {
    // ── Typing / tempo ────────────────────────────────────────────
    baseDelay: charDelay,
    introHold: 220,

    // Respirations de ponctuation
    commaPause: 75,
    semicolonPause: 125,
    colonPause: 150,
    dashPause: 170,
    sentencePause: 245,
    lineBreakPause: 170,
    paragraphPause: 560,

    // Organicité
    humanizeRatio: 0.22,
    softWordRelease: 12,
    longWordPause: 18,
    emphasisPause: 50,

    // Séquence
    skipDelay,
    afterTypingDelay,

    // ── Layout responsive proportionnel ───────────────────────────
    // Largeur de colonne pilotée par la largeur de fenêtre, puis bornée
    columnRatio: 0.68,
    columnMinPx: 260,
    columnMaxPx: 920,

    // Marges proportionnelles et bornées
    paddingXRatio: 0.25,
    paddingYRatio: 0.10,
    paddingXMinPx: 25,
    paddingXMaxPx: 1000,
    paddingYMinPx: 10,
    paddingYMaxPx: 200,

    // Typographie responsive pilotée par min(vW, vH)
    fontScale: 2.75,
    fontMinPx: 12,
    fontMaxPx: 52,

    // Rendu typo
    lineHeight: 1.84,
    letterSpacingEm: 0.008,
    textColor: 'rgba(239, 232, 220, 0.96)',
    cursorColor: 'rgba(239, 232, 220, 0.82)',
    shadow:
      '0 0 30px rgba(255,255,255,0.035), 0 0 14px rgba(0,0,0,0.18), 0 6px 18px rgba(0,0,0,0.32)',

    // Curseur
    cursorChar: '▍',

    // Classe de visibilité utilisée par le CSS global de la scène
    visibleClass: 'visible',
  };

  let settled = false;
  let cleaned = false;
  let resizeBound = false;
  let runToken = Symbol('quote-sequence');

  injectSharedStylesOnce();

  const refs = buildQuoteDOM(rootEl, CFG);
  applyLayout(rootEl, refs, CFG);

  const onResize = () => {
    if (cleaned) return;
    applyLayout(rootEl, refs, CFG);
  };

  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', onResize, { passive: true });
  resizeBound = true;

  rootEl.classList.add(CFG.visibleClass);

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    runToken = Symbol('quote-sequence-cleaned');

    if (resizeBound) {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      resizeBound = false;
    }
  };

  const assertActive = (token) => {
    if (token !== runToken) {
      throw new Error('quote_sequence_interrupted');
    }
    if (!isStillValid()) {
      throw new Error('quote_sequence_invalidated');
    }
  };

  const waitChecked = async (ms, token) => {
    if (ms <= 0) return;
    await wait(ms);
    assertActive(token);
  };

  const token = runToken;

  const typingPromise = playExpressiveTyping({
    text,
    refs,
    cfg: CFG,
    waitChecked,
    assertActive,
    token,
  }).catch((err) => {
    if (
      err?.message === 'quote_sequence_interrupted' ||
      err?.message === 'quote_sequence_invalidated'
    ) {
      return { interrupted: true };
    }
    throw err;
  });

  // Le bouton skip n'apparaît qu'après un certain délai pour laisser respirer
  // l'entrée de la citation.
  await wait(CFG.skipDelay);

  if (!isStillValid()) {
    hideSkipButton(true);
    cleanup();
    return { skipped: false };
  }

  let resolveSkip = null;
  const skipPromise = new Promise(resolve => {
    resolveSkip = () => resolve({ skipped: true });
  });

  let resolveNatural = null;
  const naturalPromise = new Promise(resolve => {
    resolveNatural = () => resolve({ skipped: false });
  });

  showSkipButton(() => {
    if (settled || !isStillValid()) return;

    settled = true;
    runToken = Symbol('quote-sequence-skipped');

    // En cas de skip, on force l'affichage du texte complet.
    // Le chapitre pourra ensuite faire son fondu sur un état final propre.
    refs.body.textContent = text;
    refs.cursor.style.opacity = '1';

    hideSkipButton(true);
    cleanup();

    resolveSkip?.();
    resolveSkip = null;
    resolveNatural = null;
  });

  typingPromise.then(async () => {
    if (settled || !isStillValid()) return;

    hideSkipButton(true);
    await wait(CFG.afterTypingDelay);

    if (settled || !isStillValid()) return;

    settled = true;
    cleanup();

    resolveNatural?.();
    resolveNatural = null;
    resolveSkip = null;
  });

  return Promise.race([naturalPromise, skipPromise]);
}

/* ============================================================================
 * DOM / LAYOUT
 * ========================================================================== */

/**
 * Construit le DOM interne de la quote.
 *
 * Structure :
 * - stage  : surface centrée sur toute la zone disponible
 * - column : colonne de lecture bornée
 * - text   : bloc typographique principal
 * - body   : texte progressif
 * - cursor : curseur clignotant
 */
function buildQuoteDOM(rootEl, cfg) {
  rootEl.innerHTML = `
    <div class="quote-seq-stage" aria-live="polite">
      <div class="quote-seq-column">
        <div class="quote-seq-text">
          <span class="quote-seq-body"></span><span class="quote-seq-cursor">${cfg.cursorChar}</span>
        </div>
      </div>
    </div>
  `;

  const stage = rootEl.querySelector('.quote-seq-stage');
  const column = rootEl.querySelector('.quote-seq-column');
  const text = rootEl.querySelector('.quote-seq-text');
  const body = rootEl.querySelector('.quote-seq-body');
  const cursor = rootEl.querySelector('.quote-seq-cursor');

  if (!stage || !column || !text || !body || !cursor) {
    throw new Error('runSkippableQuoteSequence: DOM interne invalide.');
  }

  return { stage, column, text, body, cursor };
}

/**
 * Applique une mise en page réellement proportionnelle à la fenêtre.
 *
 * Principes :
 * - taille de police basée sur min(vW, vH) pour une vraie stabilité responsive
 * - largeur de colonne basée sur vW, puis bornée
 * - marges proportionnelles horizontalement et verticalement
 * - centrage réel du bloc dans la surface
 * - protection contre débordement
 */
function applyLayout(rootEl, refs, cfg) {
  const vW = Math.max(window.innerWidth, 320);
  const vH = Math.max(window.innerHeight, 320);
  const vMin = Math.min(vW, vH);

  const fontPx = clamp(
    Math.round(vMin * cfg.fontScale / 100),
    cfg.fontMinPx,
    cfg.fontMaxPx
  );

  const columnPx = clamp(
    Math.round(vW * cfg.columnRatio),
    cfg.columnMinPx,
    cfg.columnMaxPx
  );

  const padX = clamp(
    Math.round(vW * cfg.paddingXRatio),
    cfg.paddingXMinPx,
    cfg.paddingXMaxPx
  );

  const padY = clamp(
    Math.round(vH * cfg.paddingYRatio),
    cfg.paddingYMinPx,
    cfg.paddingYMaxPx
  );

  rootEl.style.display = 'flex';
  rootEl.style.alignItems = 'center';
  rootEl.style.justifyContent = 'center';
  rootEl.style.boxSizing = 'border-box';
  rootEl.style.width = '100%';
  rootEl.style.height = '100%';
  rootEl.style.padding = `${padY}px ${padX}px`;

  refs.stage.style.width = '100%';
  refs.stage.style.height = '100%';
  refs.stage.style.display = 'flex';
  refs.stage.style.alignItems = 'center';
  refs.stage.style.justifyContent = 'center';

  refs.column.style.width = `${columnPx}px`;
  refs.column.style.maxWidth = '100%';

  refs.text.style.width = '100%';
  refs.text.style.position = 'relative';
  refs.text.style.color = cfg.textColor;
  refs.text.style.fontFamily = `'Cormorant Garamond', Georgia, serif`;
  refs.text.style.fontSize = `${fontPx}px`;
  refs.text.style.lineHeight = String(cfg.lineHeight);
  refs.text.style.letterSpacing = `${cfg.letterSpacingEm}em`;
  refs.text.style.fontWeight = '300';
  refs.text.style.textAlign = 'justify';
  refs.text.style.textJustify = 'inter-word';
  refs.text.style.whiteSpace = 'pre-wrap';
  refs.text.style.textWrap = 'pretty';
  refs.text.style.hyphens = 'auto';
  refs.text.style.wordBreak = 'normal';
  refs.text.style.overflowWrap = 'break-word';
  refs.text.style.textShadow = cfg.shadow;
  refs.text.style.webkitFontSmoothing = 'antialiased';
  refs.text.style.MozOsxFontSmoothing = 'grayscale';

  refs.body.style.display = 'inline';

  refs.cursor.style.display = 'inline-block';
  refs.cursor.style.width = '0.55ch';
  refs.cursor.style.marginLeft = '0.02em';
  refs.cursor.style.verticalAlign = 'baseline';
  refs.cursor.style.color = cfg.cursorColor;
  refs.cursor.style.animation = 'quoteSeqBlink 1.35s steps(1) infinite';
  refs.cursor.style.opacity = '1';
}

/* ============================================================================
 * TYPING EXPRESSIF
 * ========================================================================== */

/**
 * Lance le typing principal.
 *
 * Philosophie :
 * - présence douce au départ,
 * - rythme vivant,
 * - pauses sur la ponctuation,
 * - fins de phrase plus graves,
 * - paragraphes plus contemplatifs.
 */
async function playExpressiveTyping({
  text,
  refs,
  cfg,
  waitChecked,
  assertActive,
  token,
}) {
  if (cfg.introHold > 0) {
    await waitChecked(cfg.introHold, token);
  }

  let output = '';
  let currentWord = '';

  for (let i = 0; i < text.length; i++) {
    assertActive(token);

    const ch = text[i];
    const prev = i > 0 ? text[i - 1] : '';
    const next = i < text.length - 1 ? text[i + 1] : '';

    output += ch;
    refs.body.textContent = output;

    if (/\S/.test(ch) && ch !== '\n') {
      currentWord += ch;
    } else {
      currentWord = '';
    }

    const delay = getExpressiveDelay({
      ch,
      prev,
      next,
      currentWord,
      cfg,
    });

    await waitChecked(delay, token);
  }

  refs.cursor.style.opacity = '1';
}

/**
 * Calcule le délai expressif d'un caractère.
 *
 * Effets recherchés :
 * - éviter l'effet robotique,
 * - faire sentir les articulations du langage,
 * - créer un léger souffle émotionnel.
 */
function getExpressiveDelay({ ch, prev, next, currentWord, cfg }) {
  let delay = cfg.baseDelay;

  // Variation organique légère
  const variance = delay * cfg.humanizeRatio;
  delay += randomBetween(-variance, variance);

  // Ponctuation
  if (ch === ',') delay += cfg.commaPause;
  else if (ch === ';') delay += cfg.semicolonPause;
  else if (ch === ':') delay += cfg.colonPause;
  else if (ch === '—') delay += cfg.dashPause;
  else if (ch === '.' || ch === '!' || ch === '?') delay += cfg.sentencePause;

  // Retours de ligne / paragraphes
  if (ch === '\n' && prev === '\n') {
    delay += cfg.paragraphPause;
  } else if (ch === '\n') {
    delay += cfg.lineBreakPause;
  }

  // Légère détente en fin de mot
  if (ch === ' ' && currentWord.length > 0) {
    delay += cfg.softWordRelease;
    if (currentWord.length >= 8) delay += cfg.longWordPause;
  }

  // Accents d'expression sur certains signes
  if (ch === '«' || ch === '»' || ch === '(' || ch === ')') {
    delay += cfg.emphasisPause;
  }

  // Reprise après ponctuation forte
  if (
    ch === ' ' &&
    prev &&
    (prev === '.' || prev === '!' || prev === '?' || prev === ':') &&
    next &&
    /[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸ]/.test(next)
  ) {
    delay += 65;
  }

  return Math.max(10, Math.round(delay));
}

/* ============================================================================
 * STYLES PARTAGÉS
 * ========================================================================== */

function injectSharedStylesOnce() {
  if (document.getElementById('quote-seq-shared-style')) return;

  const style = document.createElement('style');
  style.id = 'quote-seq-shared-style';
  style.textContent = `
    @keyframes quoteSeqBlink {
      0%, 46% { opacity: 1; }
      47%, 100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

/* ============================================================================
 * UTILS
 * ========================================================================== */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}
