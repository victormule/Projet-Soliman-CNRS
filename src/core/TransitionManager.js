/**
 * TransitionManager.js
 * Gestion des transitions visuelles : voile noir, swap titre, citation tapée.
 *
 * CORRECTIONS vs version initiale :
 *
 * 1. swapSiteTitle() ajouté.
 *    PROBLÈME ORIGINAL : absent, le titre ne changeait jamais quand on entrait
 *    dans l'espace collaboratif. Fidèle à swapSiteTitle() de main.js.
 *
 * 2. typeQuote() : annulation par token robustifiée.
 *    Le token est vérifié AVANT chaque await (pas après), pour stopper le typing
 *    dès le prochain caractère sans attendre la fin du délai en cours.
 *    hideQuote() incrémente le token ET retire .visible, identique à main.js.
 *
 * 3. transitionChapitre1ToCollabWithQuote() : séquence complète fidèle à main.js.
 *    PROBLÈME ORIGINAL : la séquence était trop simplifiée (fade in → typing → wait
 *    fixe → fade out). Il manquait : cacher l'UI page3, démarrer Silence.mp3,
 *    bouton Skip interruptible, showPage2UIReturn, grow torch, stop Silence.
 *    FIX : la séquence complète est dans Chapitre1Scene.transitionOutWithQuote()
 *    car elle dépend de l'état interne de la scène. TransitionManager expose
 *    seulement les primitives (fadeVeil, typeQuote, hideQuote, swapSiteTitle).
 */

export class TransitionManager {
  constructor(config) {
    this.config = config;
    this.veil    = document.getElementById('veil');
    this.quoteEl = document.getElementById('chapter-quote');
    this.quoteTypingToken = 0;
  }

  /* ─────────────────────────────────────────────────── Voile ── */

  async fadeVeil(opacity, durationMs) {
    return new Promise(resolve => {
      this.veil.style.transition = `opacity ${durationMs}ms ease`;
      this.veil.style.opacity    = String(opacity);
      setTimeout(resolve, durationMs + 20);
    });
  }

  /* ─────────────────────────────────────────── Swap titre ── */

  /**
   * Swap cinématographique du titre haut-gauche.
   * toCollab=true  → "Espace collaboratif" (entrée pages 2/3)
   * toCollab=false → CONFIG.TITLE.texte     (retour pages 0/1)
   * Fidèle à swapSiteTitle() de main.js.
   */
  swapSiteTitle(toCollab) {
    const el = document.getElementById('site-title');
    if (!el) return;

    // 1. Fade out vers le haut
    el.classList.add('fading-out');

    setTimeout(() => {
      el.classList.remove('fading-out');
      this._applyTitleFont(el);

      if (toCollab) {
        const text = 'Espace collaboratif';
        let html = '';
        text.split('').forEach((ch, i) => {
          html += `<span class="char" data-i="${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`;
        });
        el.innerHTML = html;
        el.querySelectorAll('.char').forEach((s, i) => {
          setTimeout(() => {
            s.style.opacity   = '1';
            s.style.transform = 'translateY(0)';
          }, i * this.config.TIMING.title_char_delay + Math.random() * 20);
        });
      } else {
        let html = '';
        let charIdx = 0;
        this.config.TITLE.texte.forEach(part => {
          if (part === '—') {
            html += `<span class="sep">—</span>`;
          } else {
            part.split('').forEach(ch => {
              html += `<span class="char" data-i="${charIdx}">${ch === ' ' ? '&nbsp;' : ch}</span>`;
              charIdx++;
            });
          }
        });
        el.innerHTML = html;
        el.querySelectorAll('.char').forEach((s, i) => {
          setTimeout(() => {
            s.style.opacity   = '1';
            s.style.transform = 'translateY(0)';
          }, i * this.config.TIMING.title_char_delay + Math.random() * 20);
        });
        el.querySelectorAll('.sep').forEach((s, i) => {
          setTimeout(() => { s.style.opacity = '0.6'; }, (i + 1) * 340);
        });
      }
    }, this.config.TITLE_SWAP_MS);
  }

  /**
   * Recalcule la taille du titre au resize — appelé depuis onResize() des scènes.
   * Ne touche qu'à fontSize pour ne pas casser la couleur (qui varie selon collab/normal).
   */
  resizeTitle() {
    const el = document.getElementById('site-title');
    if (!el || !el.innerHTML) return;
    const f = this.config.FONTS?.title;
    if (!f) return;
    const vW = Math.max(this.config.MIN_SIZE.width, window.innerWidth);
    const sz = Math.max(f.size_min, Math.min(f.size_max, Math.round(vW * f.size_vw / 100)));
    el.style.fontSize = sz + 'px';
  }

  _applyTitleFont(el) {
    const f = this.config.FONTS?.title;
    if (!f) return;
    const vW = Math.max(this.config.MIN_SIZE.width, window.innerWidth);
    const sz = Math.max(f.size_min, Math.min(f.size_max, Math.round(vW * f.size_vw / 100)));
    el.style.fontFamily    = f.family;
    el.style.fontSize      = sz + 'px';
    el.style.fontWeight    = f.weight;
    el.style.letterSpacing = f.spacing;
    el.style.fontStyle     = f.style;
    el.style.color         = f.color;
  }

  /* ─────────────────────────────────────── Citation tapée ── */

  /**
   * Affiche et tape une citation caractère par caractère.
   * Retourne une Promise qui se résout quand le typing est terminé.
   * Peut être interrompue par hideQuote() (qui incrémente le token).
   */
  async typeQuote(fullText, charDelay = 52) {
    if (!this.quoteEl) return;

    const token = ++this.quoteTypingToken;
    const text  = String(fullText || '').trim();

    this.quoteEl.innerHTML = this._buildQuoteShell();
    this.quoteEl.classList.add('visible');

    const bodyEl = this.quoteEl.querySelector('.quote-body');
    const cursor = this.quoteEl.querySelector('.cursor');
    if (!bodyEl) return;

    let out = '';
    for (let i = 0; i < text.length; i++) {
      // Vérification AVANT l'await — stoppe dès le prochain caractère
      if (token !== this.quoteTypingToken) return;

      const ch = text[i];
      out += (ch === '\n') ? '<br>' : this._escapeHtml(ch);
      bodyEl.innerHTML = out;

      let pause = charDelay;
      if (ch === ' ')  pause *= 0.45;
      else if (ch === ',') pause *= 3.2;
      else if (ch === ';' || ch === ':') pause *= 4.8;
      else if (ch === '…') pause *= 6.5;
      else if (ch === '.' || ch === '!') pause *= 7.2;
      else if (ch === '?') pause *= 9.5;
      else if (ch === '\n') pause *= 10.5;
      else if ("àâäéèêëîïôöùûüÿç'\"-".includes(ch)) pause *= 1.15;

      if (/[A-ZÉÈÀÂÎÔÙÇ]/.test(ch) && i > 0) pause *= 1.35;

      const next = text[i + 1] || '';
      if ((ch === '.' || ch === '?' || ch === '!') && next === '\n') pause *= 1.35;

      if (Math.random() < 0.08 && /[a-zàâäéèêëîïôöùûüÿç]/i.test(ch)) {
        pause += 40 + Math.random() * 120;
      }

      await this._wait(Math.round(pause));
    }

    if (cursor && token === this.quoteTypingToken) {
      cursor.style.animation = 'quoteBlink 1.25s steps(1) infinite';
    }
  }

  /**
   * Cache la citation et annule le typing en cours.
   * durationMs : délai avant nettoyage du DOM.
   */
  hideQuote(durationMs = 1200) {
    this.quoteTypingToken++; // Annule tout typing en vol
    if (!this.quoteEl) return;
    this.quoteEl.classList.remove('visible');
    setTimeout(() => {
      if (!this.quoteEl.classList.contains('visible')) {
        this.quoteEl.innerHTML = '';
      }
    }, durationMs + 80);
  }

  /* ─────────────────────────────────────────── Helpers ── */

  _buildQuoteShell() {
    return `
      <div class="quote-inner">
        <span class="quote-body"></span><span class="cursor">|</span>
      </div>`;
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
