/**
 * Cartel musée — orchestration interactive.
 *
 * Architecture :
 *   - Stage         : génère le DOM à partir des données et orchestre les modules
 *   - MediaPlayer   : contrôle un <video>/<audio> + ses contrôles custom (overlay)
 *   - SlideViewer   : gère l'ouverture/fermeture d'une slide via une state machine
 *
 * API publique : openCartel() / closeCartel() / isCartelOpen()
 *   Le module ne s'auto-monte plus. C'est l'host (index.html) qui décide
 *   quand monter/démonter, ce qui permet de cycler intro→outro→intro proprement.
 */

import { entries, slides as slidesData } from './chp2-data-violence-et-trace.js';

/* =============================================================================
   Utilitaires
============================================================================= */

const PLAY_PAUSE_ICON_HTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path class="icon-play"  d="M8 5v14l11-7z"/>
        <path class="icon-pause" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" style="display:none"/>
    </svg>
`;

const VOLUME_ICON_HTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path class="icon-vol-on"   d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        <path class="icon-vol-mute" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" style="display:none"/>
    </svg>
`;

const FULLSCREEN_ICON_HTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path class="icon-fs-enter" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
        <path class="icon-fs-exit"  d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" style="display:none"/>
    </svg>
`;

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function forceReflow(element) {
    void element.offsetHeight;
}

/* =============================================================================
   MediaPlayer (version overlay)
============================================================================= */

class MediaPlayer {
    constructor(slideEl) {
        this.slide    = slideEl;
        this.media    = slideEl.querySelector('.slide-media');
        this.mediaBox = slideEl.querySelector('.slide-media-box');
        this.controls = slideEl.querySelector('.slide-controls-overlay');
        this.playBtn  = this.controls?.querySelector('.ctrl-play');
        this.progress = this.controls?.querySelector('.ctrl-progress');
        this.fill     = this.controls?.querySelector('.ctrl-progress-fill');
        this.timeEl   = this.controls?.querySelector('.ctrl-time');
        this.volBtn   = this.controls?.querySelector('.ctrl-volume-btn');
        this.volFill  = this.controls?.querySelector('.ctrl-volume-fill');
        this.volSlider= this.controls?.querySelector('.ctrl-volume-slider');
        this.fsBtn    = this.controls?.querySelector('.ctrl-fullscreen');

        this._sourceLoaded = false;
        this._prevVolume   = 1;

        if (this.media && this.playBtn) this._bind();
    }

    _bind() {
        this.playBtn.addEventListener('click',    this._onPlay);
        this.progress.addEventListener('click',   this._onSeek);
        this.volBtn?.addEventListener('click',    this._onMute);
        this.volSlider?.addEventListener('click', this._onVolume);
        this.fsBtn?.addEventListener('click',     this._onFullscreen);

        this.mediaBox?.addEventListener('dblclick', this._onFullscreen);

        document.addEventListener('fullscreenchange', this._syncFsIcon);

        this.media.addEventListener('play',           this._syncPlayIcon);
        this.media.addEventListener('pause',          this._syncPlayIcon);
        this.media.addEventListener('ended',          this._syncPlayIcon);
        this.media.addEventListener('timeupdate',     this._syncProgress);
        this.media.addEventListener('loadedmetadata', this._syncProgress);
        this.media.addEventListener('volumechange',   this._syncVolIcon);
        this.media.addEventListener('error',          this._onError);

        this._syncPlayIcon();
        this._syncVolIcon();
    }

    /** Détache les listeners globaux (fullscreenchange) — appelé au démontage. */
    destroy() {
        document.removeEventListener('fullscreenchange', this._syncFsIcon);
        try { this.media?.pause(); } catch {}
        try { if (this.media) this.media.removeAttribute('src'); this.media?.load(); } catch {}
    }

    loadSource() {
        if (this._sourceLoaded) return;
        const src = this.slide.dataset.src;
        if (src && this.media && !this.media.src) {
            this.media.src = src;
            this._sourceLoaded = true;
        }
    }

    async play() {
        try { await this.media?.play(); } catch { /* autoplay bloqué */ }
    }

    pause() {
        try { this.media?.pause(); } catch { /* silencieux */ }
    }

    reset() {
        this.pause();
        try { if (this.media) this.media.currentTime = 0; } catch { /* silencieux */ }
    }

    _onPlay = (e) => {
        e.stopPropagation();
        this.media.paused ? this.play() : this.pause();
    };

    _onSeek = (e) => {
        e.stopPropagation();
        if (!this.media.duration) return;
        const r = this.progress.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        this.media.currentTime = ratio * this.media.duration;
    };

    _onMute = (e) => {
        e.stopPropagation();
        if (this.media.muted || this.media.volume === 0) {
            this.media.muted  = false;
            this.media.volume = this._prevVolume || 1;
        } else {
            this._prevVolume = this.media.volume;
            this.media.muted = true;
        }
    };

    _onVolume = (e) => {
        e.stopPropagation();
        const r = this.volSlider.getBoundingClientRect();
        const v = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        this.media.volume = v;
        this.media.muted  = v === 0;
        if (v > 0) this._prevVolume = v;
    };

    _onFullscreen = (e) => {
        e?.stopPropagation();
        if (!document.fullscreenElement) {
            (this.mediaBox || this.slide).requestFullscreen?.().catch(() => {});
        } else {
            document.exitFullscreen?.().catch(() => {});
        }
    };

    _syncPlayIcon = () => {
        const play  = this.playBtn.querySelector('.icon-play');
        const pause = this.playBtn.querySelector('.icon-pause');
        if (play)  play.style.display  = this.media.paused ? '' : 'none';
        if (pause) pause.style.display = this.media.paused ? 'none' : '';
    };

    _syncProgress = () => {
        if (!this.media.duration) return;
        const pct = (this.media.currentTime / this.media.duration) * 100;
        if (this.fill)   this.fill.style.width = `${pct}%`;
        if (this.timeEl) this.timeEl.textContent =
            `${formatTime(this.media.currentTime)} / ${formatTime(this.media.duration)}`;
    };

    _syncVolIcon = () => {
        const muted = this.media.muted || this.media.volume === 0;
        const on    = this.volBtn?.querySelector('.icon-vol-on');
        const off   = this.volBtn?.querySelector('.icon-vol-mute');
        if (on)  on.style.display  = muted ? 'none' : '';
        if (off) off.style.display = muted ? '' : 'none';
        if (this.volFill)
            this.volFill.style.width = `${(muted ? 0 : this.media.volume) * 100}%`;
    };

    _syncFsIcon = () => {
        const inFs  = !!document.fullscreenElement;
        const enter = this.fsBtn?.querySelector('.icon-fs-enter');
        const exit  = this.fsBtn?.querySelector('.icon-fs-exit');
        if (enter) enter.style.display = inFs ? 'none' : '';
        if (exit)  exit.style.display  = inFs ? '' : 'none';
    };

    _onError = () => {
        if (this.timeEl) this.timeEl.textContent = '— indisponible —';
        console.warn('[MediaPlayer] Erreur source :', this.slide.dataset.src);
    };
}

/* =============================================================================
   SlideViewer
============================================================================= */

const State = Object.freeze({
    IDLE:    'idle',
    PULLING: 'pulling',
    ZOOMING: 'zooming',
    OPEN:    'open',
    CLOSING: 'closing',
});

const PULL_OFFSET_PX = 120;

class SlideViewer {
    constructor(backdropEl, playerRegistry) {
        this.backdrop  = backdropEl;
        this.players   = playerRegistry;
        this.state     = State.IDLE;
        this.openSlide = null;
        this.contexts = new WeakMap();

        // Handlers nommés pour pouvoir les retirer au destroy
        this._onBackdropClick = () => this.close();
        this._onKeydown = (e) => { if (e.key === 'Escape') this.close(); };
        // Fermeture du média via la croix de fermeture (Chapitre2Scene).
        this._onCloseCross = () => this.close();

        this._bindGlobalEvents();
    }

    _bindGlobalEvents() {
        // Le média se ferme UNIQUEMENT via la croix de fermeture (en haut à
        // droite, style chapitre 1), émise sur 'chp2:close-cross-clicked'.
        // On ne ferme plus au clic sur le fond ni à la touche Échap : la croix
        // les remplace (comme demandé).
        window.addEventListener('chp2:close-cross-clicked', this._onCloseCross);
        window.addEventListener('resize', this._onResize);
    }

    destroy() {
        window.removeEventListener('chp2:close-cross-clicked', this._onCloseCross);
        window.removeEventListener('resize', this._onResize);
        clearTimeout(this._t1);
        clearTimeout(this._t2);
        clearTimeout(this._t3);
        clearTimeout(this._t4);
    }

    _onResize = () => {
        if (this.state !== State.OPEN || !this.openSlide) return;
        this.openSlide.style.width = this._getSlideW();
    };

    get isTransitioning() {
        return this.state === State.PULLING ||
               this.state === State.ZOOMING ||
               this.state === State.CLOSING;
    }

    open(slide) {
        if (this.state !== State.IDLE) return;
        
        this.state     = State.PULLING;
        this.openSlide = slide;

          window.dispatchEvent(new CustomEvent('slideviewer:open'));

slide.classList.add('is-pinned');

forceReflow(slide);

const rect   = slide.getBoundingClientRect();
const tilt   = this._getTilt(slide);
        const isLeft = slide.dataset.dir === 'left';
        const pullPx = isLeft ? -PULL_OFFSET_PX : PULL_OFFSET_PX;

        this.contexts.set(slide, {
            parent:      slide.parentNode,
            nextSibling: slide.nextSibling,
            inlineStyle: slide.getAttribute('style') || '',
            restRect:    rect,
            tilt,
            isLeft,
        });

        const player = this.players.get(slide);
        player?.loadSource();

        // Couper les transitions CSS AVANT de déplacer la slide sous body,
        // pour éviter qu'elles s'appliquent pendant le repositionnement initial.
        slide.style.transition = 'none';
        document.body.appendChild(slide);
        slide.style.position        = 'fixed';
        slide.style.left            = `${rect.left}px`;
        slide.style.top             = `${rect.top}px`;
        slide.style.width           = this._getSlideW();
        slide.style.margin          = '0';
        slide.style.transform       = `rotate(${tilt})`;
        slide.style.transformOrigin = '50% 50%';
        forceReflow(slide);

        slide.style.transition =
            'left 0.22s cubic-bezier(0.4,0,1,1),' +
            'transform 0.22s cubic-bezier(0.4,0,1,1)';
        slide.style.left      = `${rect.left + pullPx}px`;
        slide.style.transform = `rotate(${tilt}) scale(1.08)`;
        this.backdrop.classList.add('is-active');

        this._t1 = setTimeout(() => {
            this.state = State.ZOOMING;
            slide.classList.add('is-zoomed');

            const scale =
                parseFloat(
                    getComputedStyle(document.documentElement)
                        .getPropertyValue('--slide-active-scale')
                ) || 3;

            // Poser la transition PUIS forcer un reflow pour que le navigateur
            // enregistre la position de départ (pull) avant d'appliquer les
            // nouvelles valeurs — élimine le saut.
            slide.style.transition =
                'left 0.55s cubic-bezier(0.2,0,0.2,1),' +
                'top  0.55s cubic-bezier(0.2,0,0.2,1),' +
                'transform 0.55s cubic-bezier(0.2,0,0.2,1)';
            forceReflow(slide);

            slide.style.left      = '50%';
            slide.style.top       = '50%';
            slide.style.transform = `translate(-50%, -50%) rotate(0deg) scale(${scale})`;

            // is-active ajouté APRÈS les inline-styles : le CSS .slide.is-active
            // ne contient plus de left/top/transform !important donc aucun saut.
            slide.classList.add('is-active');
            if (slide.dataset.type === 'audio') slide.classList.add('is-audio');
            slide.setAttribute('role', 'dialog');
            slide.setAttribute('aria-modal', 'true');
            slide.setAttribute('aria-label',
                slide.querySelector('.slide-caption')?.textContent ?? 'Diapositive');
            this.backdrop.setAttribute('aria-hidden', 'false');
        }, 220);

        this._t2 = setTimeout(() => {
            this.state = State.OPEN;
            player?.play();
        }, 780);
    }

    close() {
        if (this.state !== State.OPEN || !this.openSlide) return;
        const slide = this.openSlide;
        const ctx   = this.contexts.get(slide);
        if (!ctx) return;

        clearTimeout(this._t1);
        clearTimeout(this._t2);

        this.state     = State.CLOSING;
        this.openSlide = null;

        const player = this.players.get(slide);
        player?.pause();

        const freshRect = this._measureRestPosition(slide, ctx);
        const pullPx    = ctx.isLeft ? -PULL_OFFSET_PX : PULL_OFFSET_PX;
        const scale     = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue('--slide-active-scale')) || 3;

        // Strategie transform-only :
        // left/top sont fixes au centre de repos (restCX/restCY) pendant toute
        // la fermeture. Seul transform anime le deplacement, la rotation et le scale.
        // La CSS "transition: left" du .slide natif ne peut jamais se declencher.
        // Le reparentage final est donc toujours invisible.
        const restCX = freshRect.left + freshRect.width  / 2;
        const restCY = freshRect.top  + freshRect.height / 2;

        // Phase 0 : gel sans saut.
        // La slide etait a left:50% top:50% avec translate(-50%,-50%) scale(scale).
        // On repasse en coordonnees absolues tout en gardant la meme position visuelle.
        // fromDX/fromDY = decalage entre le centre viewport et restCX/restCY.
        slide.classList.remove('is-active', 'is-audio');
        slide.style.transition = 'none';
        slide.style.position   = 'fixed';
        slide.style.left       = restCX + 'px';
        slide.style.top        = restCY + 'px';
        const vpCX   = window.innerWidth  / 2;
        const vpCY   = window.innerHeight / 2;
        const fromDX = vpCX - restCX;
        const fromDY = vpCY - restCY;
        slide.style.transform  =
            'translate(-50%, -50%)' +
            ' translate(' + fromDX + 'px,' + fromDY + 'px)' +
            ' scale(' + scale + ')';
        forceReflow(slide);

        // Phase 1 (0->450ms) : dezoom + rotation + deplacement vers position pull.
        // Le deplacement pull est encode dans translate(), pas dans left.
        this.backdrop.classList.remove('is-active');
        this.backdrop.setAttribute('aria-hidden', 'true');
        slide.style.transition = 'transform 0.45s cubic-bezier(0.4,0,0.6,1)';
        slide.style.transform  =
            'translate(-50%, -50%)' +
            ' translate(' + pullPx + 'px,0px)' +
            ' rotate(' + ctx.tilt + ')' +
            ' scale(1.05)';

        // Phase 2 (450->800ms) : retour a la position de repos.
        // translate(0,0) -> la slide est pile sur restCX/restCY.
        this._t3 = setTimeout(() => {
            slide.classList.remove('is-zoomed');
            slide.style.transition = 'transform 0.35s cubic-bezier(0.4,0,0.2,1)';
            slide.style.transform  =
                'translate(-50%, -50%)' +
                ' rotate(' + ctx.tilt + ')' +
                ' scale(1)';
        }, 450);

        // Phase 3 (820ms) : reparentage invisible.
        // La slide est visuellement a freshRect. On coupe les transitions,
        // on la remet dans le parent, on restaure le style naturel.
        // Pas de changement de left/top visible => pas d'animation CSS parasite.
        this._t4 = setTimeout(() => {
            slide.style.transition = 'none';

            if (ctx.parent) {
                if (ctx.nextSibling) ctx.parent.insertBefore(slide, ctx.nextSibling);
                else ctx.parent.appendChild(slide);
            }

            const base = (ctx.inlineStyle || '').replace(/transition\s*:[^;]+;?/gi, '').trim();
            slide.setAttribute('style', (base ? base + '; ' : '') + 'transition: none !important;');
            slide.classList.remove('is-pinned', 'is-zoomed');
            slide.removeAttribute('role');
            slide.removeAttribute('aria-modal');
            slide.removeAttribute('aria-label');
            player?.reset();
            this.contexts.delete(slide);
            this.state = State.IDLE;

            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (base) slide.setAttribute('style', base);
                else slide.removeAttribute('style');
            }));

            window.dispatchEvent(new CustomEvent('slideviewer:close'));
        }, 820);
    }

    _getTilt(slide) {
        return getComputedStyle(slide).getPropertyValue('--tilt').trim() || '0deg';
    }

    _getSlideW() {
        return getComputedStyle(document.documentElement)
            .getPropertyValue('--slide-w')
            .trim();
    }

    _measureRestPosition(slide, ctx) {
        const ghost = slide.cloneNode(true);
        ghost.querySelectorAll('audio, video').forEach(el => el.remove());
        ghost.classList.remove('is-pinned', 'is-zoomed', 'is-active', 'is-audio');
        ghost.setAttribute('style', ctx.inlineStyle);
        ghost.style.visibility    = 'hidden';
        ghost.style.pointerEvents = 'none';

        if (ctx.nextSibling) ctx.parent.insertBefore(ghost, ctx.nextSibling);
        else ctx.parent.appendChild(ghost);

        const freshRect = ghost.getBoundingClientRect();
        ghost.remove();
        return freshRect;
    }
}

/* =============================================================================
   Stage (génération du DOM et Animations)
============================================================================= */

class Stage {
    constructor(stageEl, backdropEl, closeBtnEl, entries, slides, onOutroDone) {
        this.stage     = stageEl;
        this.backdrop  = backdropEl;
        this.closeBtn  = closeBtnEl;
        this.entries   = entries;
        this.slides    = slides;
        this.players   = new WeakMap();
        this.viewer    = null;
        this._timeouts = [];
        this._slideEls = [];
        this._labelEl  = null;
        this._onOutroDone = onOutroDone || (() => {});
        this._closing  = false;
        this._onCloseClick = () => this.playOutro();
    }

    /** Programme un timeout traçable pour pouvoir tout annuler au démontage. */
    _setT(fn, delay) {
        const id = setTimeout(() => {
            // nettoie l'id du registre
            const idx = this._timeouts.indexOf(id);
            if (idx >= 0) this._timeouts.splice(idx, 1);
            fn();
        }, delay);
        this._timeouts.push(id);
        return id;
    }

    init() {
        const label = this._buildLabel(this.entries);
        const deck  = this._buildSlidesDeck(this.slides);
        this.stage.append(label, deck);
        this._labelEl  = label;
        this._slideEls = Array.from(deck.querySelectorAll('.slide'));

        this._slideEls.forEach(slideEl => {
            this.players.set(slideEl, new MediaPlayer(slideEl));
        });

        this.viewer = new SlideViewer(this.backdrop, this.players);

        // Handlers stockés en propriétés pour pouvoir les retirer au destroy()
        // (sinon fuite : un listener window s'accumule à chaque cycle ouverture).
        this._onSlideOpen = () => {
            if (this.closeBtn) this.closeBtn.style.display = 'none';
            // Croix de fermeture (style chapitre 1) gérée par Chapitre2Scene.
            window.dispatchEvent(new CustomEvent('chp2:show-close-cross'));
        };
        this._onSlideClose = () => {
            // Ne pas réafficher si le cartel est en cours de fermeture (outro)
            if (this.closeBtn && !this._closing) this.closeBtn.style.display = '';
            window.dispatchEvent(new CustomEvent('chp2:hide-close-cross'));
        };
        window.addEventListener('slideviewer:open', this._onSlideOpen);
        window.addEventListener('slideviewer:close', this._onSlideClose);

        // Curseur : pulse doré standard au survol d'une diapo (vignette ou
        // diapo active). Piloté DIRECTEMENT — fiable et indépendant de la
        // délégation globale, comme pour les crânes de l'opening. Les
        // mouseenter/leave sur la diapo couvrent aussi ses contrôles internes
        // (plein écran, lecture…) puisque ce sont des enfants de la diapo.
        const _cursorEl = document.getElementById('cursor');
        this._onSlideHover   = () => { if (_cursorEl) _cursorEl.classList.add('hotspot'); };
        this._onSlideUnhover = () => { if (_cursorEl) _cursorEl.classList.remove('hotspot'); };

        this._slideEls.forEach(slideEl => {
            slideEl.addEventListener('mouseenter', this._onSlideHover);
            slideEl.addEventListener('mouseleave', this._onSlideUnhover);
            slideEl.addEventListener('click', (e) => {
                if (slideEl.classList.contains('is-active')) {
                    e.stopPropagation();
                    return;
                }
                this.viewer.open(slideEl);
            });
        });

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', this._onCloseClick);
        }

        this._playIntro(label, this._slideEls);
    }

    /**
     * Joue l'outro et appelle onOutroDone() à la fin pour que l'host démonte.
     * Idempotent : appelé deux fois, ne re-joue pas.
     */
    playOutro() {
        if (this._closing) return;
        this._closing = true;

        // Si une slide est ouverte, on la referme d'abord proprement.
        if (this.viewer && this.viewer.state === 'open') {
            this.viewer.close();
        }

        if (this.closeBtn) this.closeBtn.classList.remove('is-active');

        const U = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue('--U')) || 16;
        const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

        // 1. Slides : tombent en conservant leur tilt
        this._slideEls.forEach((slide, i) => {
            const tilt = slide.style.getPropertyValue('--tilt') || '0deg';
            slide.animate([
                { opacity: 1, transform: `rotate(${tilt}) translateY(0)` },
                { opacity: 0, transform: `rotate(${tilt}) translateY(${U * 12}px)` }
            ], {
                duration: 1000,
                delay: i * 120,
                easing,
                fill: 'forwards'
            });
        });

        // 2. Cartel : descend après un léger décalage
        this._setT(() => {
            if (!this._labelEl) return;
            const a = this._labelEl.animate([
                { opacity: 1, transform: 'translateY(0)' },
                { opacity: 0, transform: `translateY(${U * 20}px)` }
            ], {
                duration: 2500,
                easing,
                fill: 'forwards'
            });
            a.onfinish = () => {
                // Notifie l'host que l'outro est terminée — il fera le destroy.
                this._onOutroDone();
            };
        }, 600);
    }

    /**
     * Nettoyage complet : appelé par l'host après l'outro (ou en cas d'urgence).
     * Annule timeouts, détache listeners, détruit players + viewer.
     * Le DOM est retiré par l'host (qui possède #cartel-root).
     */
    destroy() {
        this._timeouts.forEach(clearTimeout);
        this._timeouts.length = 0;

        window.removeEventListener('slideviewer:open', this._onSlideOpen);
        window.removeEventListener('slideviewer:close', this._onSlideClose);

        if (this.closeBtn) {
            this.closeBtn.removeEventListener('click', this._onCloseClick);
        }

        this._slideEls.forEach(slideEl => {
            slideEl.removeEventListener('mouseenter', this._onSlideHover);
            slideEl.removeEventListener('mouseleave', this._onSlideUnhover);
            const p = this.players.get(slideEl);
            p?.destroy();
        });

        // Curseur : couper tout pulse résiduel à la fermeture du cartel.
        const _cursorEl = document.getElementById('cursor');
        if (_cursorEl) _cursorEl.classList.remove('hotspot');

        this.viewer?.destroy();
        this.viewer = null;
        this._labelEl = null;
        this._slideEls = [];
    }

    _buildLabel(entries) {
        const label = document.createElement('div');
        label.className = 'museum-label';

        return label;
    }

    _buildSlidesDeck(slides) {
        const deck = document.createElement('div');
        deck.className = 'slides-deck';
        for (const data of slides) {
            deck.append(this._buildSlide(data));
        }
        return deck;
    }

    _buildSlide(data) {
        const slide = document.createElement('div');
        slide.className = 'slide';
        slide.dataset.dir  = data.dir;
        slide.dataset.type = data.type;
        slide.dataset.src  = data.src;
        // Curseur : app.js applique le hotspot doré standard sur [data-clickable]
        // → grossissement/pulse au survol des vignettes ET de la diapo active.
        slide.dataset.clickable = '1';
        slide.style.setProperty('--tilt', `${data.tilt}deg`);
        slide.style.top = data.top;
        slide.setAttribute('role', 'button');
        slide.setAttribute('tabindex', '0');
        slide.setAttribute('aria-label', `Ouvrir : ${data.caption}`);

        slide.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                slide.click();
            }
        });

        const mediaBox = document.createElement('div');
        mediaBox.className = 'slide-media-box';

        const thumb = document.createElement('img');
        thumb.className = 'slide-thumb';
        thumb.src = data.thumb;
        thumb.alt = data.caption;
        thumb.loading = 'lazy';
        thumb.decoding = 'async';

        const mediaTag = data.type === 'video' ? 'video' : 'audio';
        const media = document.createElement(mediaTag);
        media.className = 'slide-media';
        media.preload = 'none';
        if (data.type === 'video') media.playsInline = true;

        const overlayControls = this._buildFloatingControls();

        mediaBox.append(thumb, media, overlayControls);

        const caption = document.createElement('div');
        caption.className = 'slide-caption';
        caption.textContent = data.caption;

        slide.append(mediaBox, caption);
        return slide;
    }

    _buildFloatingControls() {
        const container = document.createElement('div');
        container.className = 'slide-controls-overlay';

        const progress = document.createElement('div');
        progress.className = 'ctrl-progress';
        const fill = document.createElement('div');
        fill.className = 'ctrl-progress-fill';
        progress.append(fill);

        const row = document.createElement('div');
        row.className = 'ctrl-row';

        const playBtn = this._btn('ctrl-play', PLAY_PAUSE_ICON_HTML, 'Lecture / Pause');

        const time = document.createElement('span');
        time.className = 'ctrl-time';
        time.textContent = '0:00 / 0:00';

        const spacer = document.createElement('div');
        spacer.className = 'ctrl-spacer';

        const volWrap = document.createElement('div');
        volWrap.className = 'ctrl-volume';
        const volBtn    = this._btn('ctrl-volume-btn', VOLUME_ICON_HTML, 'Volume');
        const volSlider = document.createElement('div');
        volSlider.className = 'ctrl-volume-slider';
        const volFill = document.createElement('div');
        volFill.className = 'ctrl-volume-fill';
        volSlider.append(volFill);
        volWrap.append(volBtn, volSlider);

        const fsBtn = this._btn('ctrl-fullscreen', FULLSCREEN_ICON_HTML, 'Plein écran');

        row.append(playBtn, time, spacer, volWrap, fsBtn);
        container.append(progress, row);
        return container;
    }

    _btn(cls, html, label) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `ctrl-btn ${cls}`;
        b.title = label;
        b.setAttribute('aria-label', label);
        b.innerHTML = html;
        return b;
    }

    _playIntro(label, slides) {
        const labelDurMs   = 3000;
        const slideDurMs   = 1400;
        const slideDelayMs = 180;
        const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
        const U = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue('--U')) || 16;

        requestAnimationFrame(() => {
            label.animate([
                { opacity: '0', transform: `translateY(${U * 18}px)` },
                { opacity: '1', transform: 'translateY(0)' }
            ], {
                duration: labelDurMs,
                easing,
                fill: 'none',
            }).onfinish = () => {
                if (this._closing) return; // race condition : outro déclenchée pendant l'intro
                label.style.opacity   = '1';
                label.style.transform = 'translateY(0)';

                // Sous-partie prête → Chapitre2Scene dessine la flèche harmonisée
                this._setT(() => {
                    if (this._closing) return;
                    if (this.closeBtn) this.closeBtn.classList.add('is-active');
                    window.dispatchEvent(new CustomEvent('chp2:cartel-ready'));
                }, 500);
            };
        });

        slides.forEach((slide, i) => {
            const delay = 3000 + i * slideDelayMs;
            slide.classList.add('intro-hidden');

            this._setT(() => {
                if (this._closing) return;
                const isLeft = slide.dataset.dir === 'left';
                const cs = getComputedStyle(document.documentElement);
                const slideW = parseFloat(cs.getPropertyValue('--slide-w')) || 200;
                const slidePeek = parseFloat(cs.getPropertyValue('--slide-peek')) || 56;
                const tiltDeg = parseFloat(slide.style.getPropertyValue('--tilt')) || 0;
                const startX = isLeft ? (slideW * 0.5 + slidePeek) : -(slideW * 0.5 + slidePeek);

                slide.classList.remove('intro-hidden');
                const anim = slide.animate([
                    { opacity: '0', transform: `rotate(${tiltDeg}deg) translateX(${startX}px)` },
                    { opacity: '1', transform: `rotate(${tiltDeg}deg) translateX(0px)` }
                ], {
                    duration: slideDurMs,
                    easing,
                    fill: 'none',
                });

                anim.onfinish = () => {
                    slide.style.opacity = '';
                    slide.style.transform = '';
                    slide.style.pointerEvents = '';
                };
            }, delay);
        });
    }
}

/* =============================================================================
   API publique : mount / unmount
   -----------------------------------------------------------------------------
   L'host (index.html) appelle openCartel() au clic sur le crâne 136,
   et closeCartel() (idempotent) si besoin de forcer la fermeture.
   La fermeture normale se fait via le bouton croix → Stage joue l'outro
   → onOutroDone callback → on démonte ici.
============================================================================= */

let currentStage = null;
let _onRequestReturn = null;

/** Ouvre le cartel. No-op si déjà monté. Retourne true si l'ouverture a eu lieu. */
export function openCartel() {
    if (currentStage) return false;

    const root      = document.getElementById('cartel-root');
    const stageEl   = root?.querySelector('[data-role="stage"]');
    const backdrop  = root?.querySelector('[data-role="backdrop"]');
    const closeBtn  = root?.querySelector('[data-role="close-btn"]');

    if (!root || !stageEl || !backdrop) {
        console.error('[Cartel] Éléments racine introuvables (#cartel-root).');
        return false;
    }

    // Affiche le conteneur (il était display:none au repos).
    root.classList.add('is-open');
    document.body.classList.add('cartel-open');

    // Remplacer l'icône croix par une flèche retour bas-gauche
    if (closeBtn) {
        closeBtn.setAttribute('aria-label', 'Retour');
        closeBtn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="15 18 9 12 15 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
    }

    currentStage = new Stage(stageEl, backdrop, closeBtn, entries, slidesData, () => {
        // L'outro est terminée : on démonte.
        closeCartel({ skipOutro: true });
    });
    currentStage.init();

    // Retour déclenché par la flèche harmonisée (Chapitre2Scene) via event global.
    _onRequestReturn = () => closeCartel();
    window.addEventListener('chp2:request-return', _onRequestReturn);

    return true;
}

/**
 * Ferme le cartel.
 * Par défaut : joue l'outro puis démonte.
 * skipOutro=true : démonte immédiatement (utilisé par le callback de fin d'outro).
 */
export function closeCartel({ skipOutro = false } = {}) {
    if (!currentStage) return false;

    if (!skipOutro) {
        currentStage.playOutro();
        return true;
    }

    // Démontage effectif
    if (_onRequestReturn) {
        window.removeEventListener('chp2:request-return', _onRequestReturn);
        _onRequestReturn = null;
    }
    currentStage.destroy();
    currentStage = null;

    const root = document.getElementById('cartel-root');
    if (root) {
        // Vide le DOM généré : la prochaine ouverture repart de zéro.
        const stageEl = root.querySelector('[data-role="stage"]');
        if (stageEl) stageEl.replaceChildren();
        root.classList.remove('is-open');
    }
    document.body.classList.remove('cartel-open');

    // Notifie l'host avec l'event retour animé (fondu noir → rallumage opening)
    window.dispatchEvent(new CustomEvent('cartel:return'));
    return true;
}

export function isCartelOpen() {
    return currentStage !== null;
}


