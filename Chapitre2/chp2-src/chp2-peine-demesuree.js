/**
 * chp2-peine-demesuree.js
 * ─────────────────────────────────────────────────────────────
 * Module ESM — Installation "Une peine démesurée".
 * Modèle : chp2-invisibilisation.js (même pattern mount/destroy).
 *
 * API publique
 *   openPeineDemesuree()   → monte l'overlay, lance la séquence.
 *   closePeineDemesuree()  → fade-out, démonte, dispatche l'event.
 *   isPeineDemesureeOpen()
 *
 * Chemins assets (relatifs à index.html) :
 *   chp2-fonts/...
 *   chp2-images/fondjournal.webp
 *   chp2-images/TitreBg2.webp
 *   chp2-medias/Demesure.mp4
 *   chp2-medias/ame-noire.mp4
 *   chp2-medias/Au-tribunal.mp4
 *   chp2-medias/temoignage-guillaume.mp3
 *   chp2-medias/temoignage-guillaume.vtt
 */

'use strict';

import { mediaMap } from './chp2-data-peine-demesuree.js';

/* ─────────────────────────────────────────────────────────────
   ÉTAT DU MODULE
───────────────────────────────────────────────────────────── */
let _mounted = null;

export function isPeineDemesureeOpen() { return _mounted !== null; }

/** Helper viseur : focalisation (#cursor.aim-hot) au survol d'un mot-clef. */
function setAimHot(on) {
    const c = document.getElementById('cursor');
    if (c) c.classList.toggle('aim-hot', !!on);
}

export function openPeineDemesuree() {
    if (_mounted) return false;
    const root = document.getElementById('peine-demesuree-root');
    if (!root) {
        console.error('[PeineDemesuree] #peine-demesuree-root introuvable.');
        return false;
    }
    root.classList.add('is-open');
    // Curseur : viseur noir minimaliste sur toute la sous-partie.
    document.body.classList.add('peine-aim');
    _mounted = mount(root);
    return true;
}

export function closePeineDemesuree() {
    if (!_mounted) return false;
    _mounted.destroy();
    _mounted = null;
    const root = document.getElementById('peine-demesuree-root');
    if (root) {
        root.classList.remove('is-open');
        root.style.opacity = '';
        root.style.transition = '';
    }
    // Curseur : retour au point doré standard.
    document.body.classList.remove('peine-aim');
    setAimHot(false);
    window.dispatchEvent(new CustomEvent('peine-demesuree:closed'));
    return true;
}

/* ─────────────────────────────────────────────────────────────
   MOUNT — tout le code original tourne ici, scopé par-mount.
───────────────────────────────────────────────────────────── */
function mount(root) {

    /* Snapshot du markup PRISTINE (avant toute mutation). Restauré au
       destroy() afin que chaque ré-ouverture reparte d'un DOM neuf et rejoue
       l'animation d'entrée intégralement, exactement comme la première fois. */
    const _pristineHTML = root.innerHTML;

    /* ── helpers scoping DOM ── */
    const $  = (id)  => root.querySelector('#' + id);
    const $q = (sel) => root.querySelector(sel);
    const $$ = (sel) => Array.from(root.querySelectorAll(sel));

    /* ── registres cleanup ── */
    const _listeners = [];
    const _timeouts  = [];
    let   _aborted   = false;

    function on(target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        _listeners.push({ target, type, fn, opts });
    }

    function wait(ms) {
        return new Promise(resolve => {
            const id = setTimeout(resolve, ms);
            _timeouts.push(id);
        });
    }

    /* ─────────────────────────────────────────────────────────
       MISE À L'ÉCHELLE — --pd-u sur le root (pas sur :root)
    ───────────────────────────────────────────────────────── */
    function updateScale() {
        const vp = $q('.viewport');
        if (!vp) return;
        root.style.setProperty('--pd-u', (vp.clientWidth / 1300) + 'px');
    }
    on(window, 'resize', updateScale, { passive: true });
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => { if (!_aborted) updateScale(); });
    }

    /* ─────────────────────────────────────────────────────────
       TITRE — préparation lettre par lettre
    ───────────────────────────────────────────────────────── */
    const TRADUCTIONS = {
        en:'Humanity', es:'La Humanidad', de:'Die Menschheit',
        it:"L'Umanita", pt:'A Humanidade', ar:'الإنسانية',
        zh:'人道报', ja:'リュマニテ', ru:'Юманите',
        nl:'De Mensheid', pl:'Ludzkość',
    };

    function spanLettres(container, text) {
        container.textContent = '';
        for (const ch of text) {
            const s = document.createElement('span');
            s.className = 'lettre';
            s.textContent = ch === ' ' ? '\u00A0' : ch;
            container.appendChild(s);
        }
    }

    function prepareTitre() {
        const el = $('grand-titre');
        if (!el) return;
        const text = el.dataset.original || el.textContent.trim();
        el.dataset.original = text;
        spanLettres(el, text);
        root.style.setProperty('--pd-titre-scale', '1');
    }

    function ajusterTitre(isFr) {
        if (isFr) { root.style.setProperty('--pd-titre-scale', '1'); return; }
        const el = $('grand-titre');
        const container = el?.parentElement;
        if (!el || !container) return;
        let scale = 1;
        root.style.setProperty('--pd-titre-scale', scale);
        const maxW = container.clientWidth;
        let guard = 200;
        while (el.scrollWidth > maxW && scale > 0.4 && guard-- > 0) {
            scale = Math.round((scale - 0.005) * 1000) / 1000;
            root.style.setProperty('--pd-titre-scale', scale);
        }
    }

    /* Observer <html lang> pour Google Translate */
    let lastLang = 'fr';
    async function mettreAJourTitre(lang) {
        const el = $('grand-titre');
        if (!el || _aborted) return;
        const base = (lang || '').split('-')[0].toLowerCase();
        if (base === lastLang) return;
        lastLang = base;
        const original = el.dataset.original || "l'Humanité";
        const text = base === 'fr' ? original : (TRADUCTIONS[base] || original);
        spanLettres(el, text);
        ajusterTitre(base === 'fr');
        const ordre = shuffle($$('#grand-titre .lettre'));
        for (const l of ordre) {
            if (_aborted) return;
            await wait(40 + Math.random() * 100);
            l.classList.add('is-printed');
        }
    }
    const langObs = new MutationObserver(muts => {
        muts.forEach(m => { if (m.attributeName === 'lang') mettreAJourTitre(document.documentElement.lang); });
    });
    langObs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

    /* ─────────────────────────────────────────────────────────
       HELPERS ANIMATION
    ───────────────────────────────────────────────────────── */
    function shuffle(arr) {
        return arr.map(v => ({ v, r: Math.random() })).sort((a,b) => a.r - b.r).map(o => o.v);
    }

    async function animerTitre() {
        const ordre = shuffle($$('#grand-titre .lettre'));
        for (const l of ordre) {
            if (_aborted) return;
            await wait(60 + Math.random() * 140);
            l.classList.add('is-printed');
        }
    }

    function animBorder(el, prop, dur) {
        return new Promise(resolve => {
            const t0 = performance.now();
            function tick(now) {
                if (_aborted) { resolve(); return; }
                const p = Math.min((now - t0) / dur, 1);
                if (prop === 'top')    el.style.borderTopColor    = `rgba(190,190,190,${p})`;
                else                   el.style.borderBottomColor = `rgba(202,202,202,${p})`;
                if (p < 1) requestAnimationFrame(tick); else resolve();
            }
            requestAnimationFrame(tick);
        });
    }
    function animBorderDark(el, dur) {
        return new Promise(resolve => {
            const t0 = performance.now();
            function tick(now) {
                if (_aborted) { resolve(); return; }
                const p = Math.min((now - t0) / dur, 1);
                el.style.borderTopColor = `rgba(17,17,17,${p})`;
                if (p < 1) requestAnimationFrame(tick); else resolve();
            }
            requestAnimationFrame(tick);
        });
    }

    async function animerMetaRow() {
        const mr = $('meta-row');
        if (!mr) return;
        mr.style.opacity = '1';
        mr.style.borderTopColor    = 'transparent';
        mr.style.borderBottomColor = 'transparent';
        await wait(100);
        await animBorder(mr, 'top', 700);
        await wait(200);
        $('meta-gauche')?.classList.add('is-visible'); await wait(120);
        $('meta-centre')?.classList.add('is-visible'); await wait(120);
        $('meta-droite')?.classList.add('is-visible'); await wait(300);
        await animBorder(mr, 'bottom', 600);
    }

    async function animerGrille() {
        const g = $('grille');
        if (!g) return;
        g.style.opacity = '1';
        g.style.borderTopColor = 'transparent';
        await animBorderDark(g, 800);
        await wait(150);
        for (let i = 0; i <= 4; i++) {
            if (_aborted) return;
            $('col-' + i)?.classList.add('is-visible');
            await wait(180);
        }
    }

    /* ─────────────────────────────────────────────────────────
       SÉQUENCE PRINCIPALE
    ───────────────────────────────────────────────────────── */
    async function lancerSequence() {
        if (document.fonts?.ready) await document.fonts.ready;
        if (_aborted) return;
        prepareTitre();
        updateScale();

        await wait(300);  $('main-wrap')?.classList.add('is-visible');
        await wait(800);  $('pd-veil')?.classList.add('lifted');
        await wait(400);
        const tb = $('titre-bloc');
        if (tb) { tb.style.opacity = '1'; tb.style.transition = 'opacity 0.01s'; }
        await animerTitre();
        await wait(350);  await animerMetaRow();
        await wait(300);  await animerGrille();
        await wait(500);  $('article-main')?.classList.add('is-visible');
        // Sous-partie prête → Chapitre2Scene dessine la flèche de retour harmonisée
        window.dispatchEvent(new CustomEvent('chp2:peine-ready'));
        await wait(600);  lancerTyping();
    }

    /* ─────────────────────────────────────────────────────────
       MACHINE À ÉCRIRE
    ───────────────────────────────────────────────────────── */
    function lancerTyping() {
        const tpl    = $('article-content-template');
        const target = $('article-body');
        if (!tpl || !target) return;
        const nodes = Array.from(tpl.content.childNodes);

        async function typeNodes(list, container) {
            for (const node of list) {
                if (_aborted) return;
                if (node.nodeType === Node.TEXT_NODE) {
                    for (const ch of node.textContent) {
                        if (_aborted) return;
                        await wait(0.3);
                        container.appendChild(document.createTextNode(ch));
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const el = document.createElement(node.tagName.toLowerCase());
                    for (const attr of node.attributes) el.setAttribute(attr.name, attr.value);
                    container.appendChild(el);
                    await typeNodes(Array.from(node.childNodes), el);
                }
            }
        }
        typeNodes(nodes, target);
    }

    /* ─────────────────────────────────────────────────────────
       LÉGENDE EN MARGE GAUCHE
    ───────────────────────────────────────────────────────── */
    function trouverMotClef(el, container) {
        let node = el;
        while (node && node !== container) {
            if (node.classList?.contains('mot-clef')) return node;
            node = node.parentElement;
        }
        return null;
    }

    const margeTitre  = $('marge-titre');
    const articleBody = $('article-body');
    let   motActif    = null;

    function positionnerLegende(mot) {
        if (!margeTitre) return;
        const parent = margeTitre.parentElement;
        if (!parent) return;
        const parentRect = parent.getBoundingClientRect();
        const rect       = mot.getBoundingClientRect();
        const offsetTop  = rect.top - parentRect.top;
        const u          = parseFloat(getComputedStyle(root).getPropertyValue('--pd-u')) || 1;
        const offsetY    = parseFloat(getComputedStyle(root).getPropertyValue('--pd-legende-offset-y')) || 2;
        const coeff      = offsetTop / u + offsetY;
        margeTitre.style.top = `calc(${coeff} * var(--pd-u))`;
    }

    if (margeTitre && articleBody) {
        on(articleBody, 'mouseover', e => {
            const mot = trouverMotClef(e.target, articleBody);
            if (!mot) return;
            motActif = mot;
            margeTitre.innerHTML =
                `<span class="legende-categorie">${mot.dataset.categorie || ''}</span>` +
                `<span class="legende-citation">${mot.dataset.titre || ''}</span>`;
            positionnerLegende(mot);
            margeTitre.classList.add('visible');
            setAimHot(true);
        });

        on(articleBody, 'mouseout', e => {
            const mot = trouverMotClef(e.target, articleBody);
            if (!mot || mot.contains(e.relatedTarget)) return;
            motActif = null;
            margeTitre.classList.remove('visible');
            setAimHot(false);
        });

        /* Résistance Google Translate */
        const gtObs = new MutationObserver(muts => {
            muts.forEach(mut => {
                mut.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    const pm = trouverMotClef(node, articleBody);
                    if (pm && !node.dataset.key) {
                        node.dataset.key       = pm.dataset.key       || '';
                        node.dataset.categorie = pm.dataset.categorie || '';
                        node.dataset.titre     = pm.dataset.titre     || '';
                    }
                    node.querySelectorAll?.('.mot-clef').forEach(m => {
                        if (m.dataset.key) return;
                        let anc = m.parentElement;
                        while (anc && anc !== articleBody) {
                            if (anc.dataset?.key) {
                                m.dataset.key       = anc.dataset.key;
                                m.dataset.categorie = anc.dataset.categorie || m.dataset.categorie;
                                m.dataset.titre     = anc.dataset.titre     || m.dataset.titre;
                                break;
                            }
                            anc = anc.parentElement;
                        }
                    });
                });
            });
        });
        gtObs.observe(articleBody, { childList: true, subtree: true });
        _listeners.push({
            target: { addEventListener() {}, removeEventListener() { gtObs.disconnect(); } },
            type: '__gt__', fn: null,
        });

        on(window, 'resize', () => {
            if (motActif && margeTitre.classList.contains('visible'))
                requestAnimationFrame(() => positionnerLegende(motActif));
        }, { passive: true });
    }

    /* ─────────────────────────────────────────────────────────
       OUVERTURE MÉDIA EN RIDEAU
       (mediaMap : données éditoriales — voir chp2-data-peine-demesuree.js)
    ───────────────────────────────────────────────────────── */

    const articleColumn    = $('article-column');
    const wrap             = $('main-wrap');
    const curtains         = $$('.curtain');
    const videoLayer       = $('article-video-layer');
    const video            = $('article-video');
    const closeMediaBtn    = $('video-close');
    const audio            = $('article-audio');
    const audioToggle      = $('audio-toggle');
    const audioBar         = $('audio-bar');
    const audioProgress    = $q('.audio-progress');
    const videoPanel       = $('media-panel-video');
    const audioPanel       = $('media-panel-audio');
    const articleStage     = $('article-stage');
    const margeDroite      = $('marge-droite');
    const curtainLineLeft  = $q('.curtain-line--left');
    const curtainLineRight = $q('.curtain-line--right');

    const mediaOK = articleColumn && articleBody && wrap && videoLayer
                 && video && closeMediaBtn && curtains.length > 0;

    let isAnimating        = false;
    let isVideoOpen        = false;
    let _returning         = false;   // verrou : sortie en cours (anti double-déclenchement)
    let lastFocused        = null;
    let isScrubbingAudio   = false;
    let trackRAF           = null;
    let isTracking         = false;
    let trackingEntry      = true;

    /* ---- Fond papier ---- */
    function syncPaper() {
        if (!wrap || !curtains.length) return;
        const wr = wrap.getBoundingClientRect();
        const ws = getComputedStyle(wrap);
        curtains.forEach(c => {
            const cr = c.getBoundingClientRect();
            c.style.setProperty('--paper-bg-image',    ws.backgroundImage);
            c.style.setProperty('--paper-bg-repeat',   ws.backgroundRepeat);
            c.style.setProperty('--paper-bg-size',     ws.backgroundSize);
            c.style.setProperty('--paper-bg-position', ws.backgroundPosition);
            c.style.setProperty('--paper-box-width',   wr.width  + 'px');
            c.style.setProperty('--paper-box-height',  wr.height + 'px');
            c.style.setProperty('--paper-offset-left', -(cr.left - wr.left) + 'px');
            c.style.setProperty('--paper-offset-top',  -(cr.top  - wr.top)  + 'px');
        });
    }
    on(window, 'resize', syncPaper, { passive: true });
    if (document.fonts?.ready) document.fonts.ready.then(() => { if (!_aborted) syncPaper(); });

    /* ---- Tracking légendes ---- */
    function getPdU() { return parseFloat(getComputedStyle(root).getPropertyValue('--pd-u')) || 1; }

    function trackLeftLegend() {
        if (!margeTitre || !curtainLineLeft || !articleColumn) return;
        const lr  = curtainLineLeft.getBoundingClientRect();
        const cr  = articleColumn.getBoundingClientRect();
        const u   = getPdU();
        const ll  = parseFloat(getComputedStyle(root).getPropertyValue('--pd-legende-left'))  * u;
        const lw  = parseFloat(getComputedStyle(root).getPropertyValue('--pd-legende-width')) * u;
        const gap = -(ll + lw);
        margeTitre.style.left = (lr.left - cr.left - gap - lw) + 'px';
        if (trackingEntry === true) {
            margeTitre.classList.toggle('visible', lr.right > cr.left);
        } else if (trackingEntry === false) {
            margeTitre.classList.add('visible');
        }
        if (margeDroite && (margeDroite.classList.contains('line-visible') || margeDroite.classList.contains('animating')))
            trackRightLegend();
        if (isTracking) trackRAF = requestAnimationFrame(trackLeftLegend);
    }

    function trackRightLegend() {
        if (!margeDroite || !curtainLineRight || !articleColumn) return;
        const lr  = curtainLineRight.getBoundingClientRect();
        const cr  = articleColumn.getBoundingClientRect();
        const u   = getPdU();
        margeDroite.style.left = (lr.right - cr.left + 14 * u) + 'px';
    }

    function repositionRight() {
        if (!margeDroite || !articleStage || !articleColumn || !isVideoOpen) return;
        const sr  = articleStage.getBoundingClientRect();
        const cr  = articleColumn.getBoundingClientRect();
        const u   = getPdU();
        margeDroite.style.left = (sr.right - cr.left + 14 * u) + 'px';
    }

    on(window, 'resize', () => { if (isVideoOpen) { repositionRight(); } }, { passive: true });

    function startTracking(entry) {
        if (isTracking) return;
        trackingEntry = entry;
        isTracking = true;
        trackRAF = requestAnimationFrame(trackLeftLegend);
    }
    function stopTracking() {
        isTracking = false;
        if (trackRAF) { cancelAnimationFrame(trackRAF); trackRAF = null; }
    }

    /* ---- Rideau ---- */
    async function ouvrirRideau() {
        articleColumn.classList.remove('is-curtains-closed');
        await wait(560);
        articleColumn.classList.remove('is-transitioning');
    }

    /* ---- Ouvrir média ---- */
    async function ouvrirMedia(media, trigger) {
        if (isAnimating || isVideoOpen || !mediaOK) return;
        isAnimating = true;
        lastFocused = trigger || null;
        syncPaper();

        /* Légende droite */
        if (margeDroite) {
            margeDroite.classList.remove('visible','hiding','hidden','line-visible','animating');
            if (media.legende) {
                const l = media.legende;
                margeDroite.innerHTML =
                    `<span class="legende-droite-nom">${l.nom}</span>`+
                    `<span class="legende-droite-corps">${l.role}</span>`+
                    `<span class="legende-droite-filet"></span>`+
                    `<span class="legende-droite-projet">${l.projet}</span>`+
                    `<span class="legende-droite-corps">${l.soustitre}</span>`+
                    `<span class="legende-droite-citation">${l.citation}</span>`+
                    `<span class="legende-droite-copyright">${l.copyright}</span>`;
            } else {
                margeDroite.innerHTML = '';
            }
            trackRightLegend();
        }
        margeTitre?.classList.remove('hiding');
        startTracking(true);

        articleColumn.classList.add('is-transitioning','is-curtains-closed');
        await wait(280);

        if (margeDroite && media.legende) margeDroite.classList.add('line-visible');
        await wait(160);
        if (margeDroite && media.legende) margeDroite.classList.add('animating');
        await wait(350);
        await wait(280);
        stopTracking();

        articleColumn.classList.add('is-video-open');
        videoLayer.setAttribute('aria-hidden','false');

        if (videoPanel) videoPanel.style.display = 'none';
        if (audioPanel) audioPanel.style.display = 'none';

        if (media.type === 'video' && videoPanel) {
            videoPanel.style.display = 'flex';
            video.src = media.src;
            video.currentTime = 0;
            video.play().catch(() => {});
        }
        if (media.type === 'audio' && audioPanel) {
            audioPanel.style.display = 'flex';
            audio.src = media.src;
            audio.currentTime = 0;
            audio.play().catch(() => {});
            if (audioToggle) audioToggle.textContent = 'Pause';
        }

        await wait(40);
        startTracking(false);
        await ouvrirRideau();
        stopTracking();
        repositionRight();

        articleColumn.classList.add('is-video-ui-visible');
        isVideoOpen = true;
        isAnimating = false;
    }

    /* ---- Fermer média ---- */
    async function fermerVideo() {
        if (isAnimating || !isVideoOpen || !mediaOK) return;
        isAnimating = true;

        articleColumn.classList.remove('is-video-ui-visible');
        margeTitre?.classList.remove('visible');
        margeTitre?.classList.add('hiding');
        margeDroite?.classList.remove('animating');
        margeDroite?.classList.add('hiding');

        await wait(320);
        margeDroite?.classList.remove('hiding','line-visible');
        margeDroite?.classList.add('hidden');

        await wait(100);
        startTracking(true);
        articleColumn.classList.add('is-transitioning','is-curtains-closed');
        await wait(560);
        stopTracking();

        if (margeTitre) { margeTitre.classList.remove('hiding','visible'); margeTitre.style.left = ''; }
        if (margeDroite) {
            margeDroite.classList.remove('hidden','hiding','visible','line-visible','animating');
            margeDroite.style.left = '';
            margeDroite.innerHTML = '';
        }

        try { video.pause(); video.removeAttribute('src'); video.load(); } catch (_) {}
        try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch (_) {}
        if (audioBar)    audioBar.style.width   = '0%';
        if (audioToggle) audioToggle.textContent = 'Lecture';
        const sub = $('audio-subtitles');
        if (sub) { sub.classList.remove('is-visible'); sub.textContent = ''; }

        articleColumn.classList.remove('is-video-open');
        videoLayer.setAttribute('aria-hidden','true');
        await wait(40);
        startTracking(null);
        await ouvrirRideau();
        stopTracking();

        isVideoOpen = false;
        isAnimating = false;
        lastFocused?.focus({ preventScroll: true });
    }

    /* ── Événements ── */
    if (mediaOK) {
        if (audioToggle && audio) {
            on(audioToggle, 'click', () => {
                if (audio.paused) {
                    audio.play().catch(() => {});
                    audioToggle.textContent = 'Pause';
                } else {
                    audio.pause();
                    audioToggle.textContent = 'Lecture';
                }
            });
        }

        if (audio) {
            on(audio, 'timeupdate', () => {
                if (!isScrubbingAudio && audioBar && audio.duration)
                    audioBar.style.width = (audio.currentTime / audio.duration * 100) + '%';
            });

            on(audio, 'play', () => {
                const track = audio.textTracks[0];
                if (!track) return;
                track.mode = 'showing';
                const sub = $('audio-subtitles');
                if (!sub) return;
                track.oncuechange = () => {
                    const cue = track.activeCues[0];
                    if (cue?.text) {
                        sub.textContent = cue.text;
                        requestAnimationFrame(() => sub.classList.add('is-visible'));
                    } else {
                        sub.classList.remove('is-visible');
                        setTimeout(() => { if (!track.activeCues.length) sub.textContent = ''; }, 220);
                    }
                };
            });

            on(audio, 'ended', () => { if (isVideoOpen) fermerVideo(); });
        }

        if (audioProgress && audio) {
            function setAudioTime(clientX) {
                if (!audio.duration) return;
                const r = audioProgress.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
                audio.currentTime = ratio * audio.duration;
                if (audioBar) audioBar.style.width = (ratio * 100) + '%';
            }
            on(audioProgress, 'pointerdown', e => {
                if (!audio.duration) return;
                isScrubbingAudio = true;
                setAudioTime(e.clientX);
                try { audioProgress.setPointerCapture(e.pointerId); } catch (_) {}
            });
            on(audioProgress, 'pointermove', e => { if (isScrubbingAudio) setAudioTime(e.clientX); });
            const stopScrub = e => {
                if (!isScrubbingAudio) return;
                isScrubbingAudio = false;
                try { audioProgress.releasePointerCapture(e.pointerId); } catch (_) {}
            };
            on(audioProgress, 'pointerup',     stopScrub);
            on(audioProgress, 'pointercancel', stopScrub);
            on(audioProgress, 'click', e => {
                if (!audio.duration) return;
                const r = audioProgress.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
                audio.currentTime = ratio * audio.duration;
                if (audioBar) audioBar.style.width = (ratio * 100) + '%';
            });
        }

        if (video) on(video, 'ended', () => { if (isVideoOpen) fermerVideo(); });

        on(closeMediaBtn, 'click', fermerVideo);

        on(document, 'keydown', e => {
            if (e.key === 'Escape' && isVideoOpen) { e.preventDefault(); fermerVideo(); }
        });

        on(articleBody, 'click', e => {
            const mot = trouverMotClef(e.target, articleBody);
            if (!mot) return;
            const media = mediaMap[mot.dataset.key] || null;
            if (!media) return;
            e.preventDefault();
            ouvrirMedia(media, mot);
        });
    }

    /* ── Retour vers l'opening ──
       La flèche est gérée par Chapitre2Scene (ArrowChp2Part 'peine-demesuree').
       Le module écoute l'event global émis au clic de cette flèche.
       Si un média joue, on le FERME proprement (animation retour au texte) AVANT
       de quitter, puis on lance le fondu de sortie (la page s'éteint au noir). */
    on(window, 'chp2:request-return', () => { requestReturn(); });

    /* ── Échap global ──
       - média ouvert  : Échap referme le média (un cran en arrière) — cf. handler
         dédié plus haut ;
       - sinon         : Échap quitte la sous-partie (même séquence que la flèche). */
    on(document, 'keydown', e => {
        if (e.key === 'Escape' && !isVideoOpen) {
            requestReturn();
        }
    });

    /* Attend la fin d'une animation média éventuellement en cours (open/close),
       avec un plafond de sécurité. Résout aussi en cas d'abort. */
    function waitIdle(maxMs = 3000) {
        return new Promise(resolve => {
            const t0 = Date.now();
            (function check() {
                if (_aborted || !isAnimating || Date.now() - t0 > maxMs) { resolve(); return; }
                const id = setTimeout(check, 50);
                _timeouts.push(id);
            })();
        });
    }

    /* Séquence de sortie complète, idempotente (verrou _returning) :
       1) laisser finir une animation média en cours ;
       2) si un média est ouvert, le refermer proprement (retour au texte animé) ;
       3) lancer le fondu de sortie (extinction au noir) → quitte vers l'opening. */
    async function requestReturn() {
        if (_aborted || _returning) return;
        _returning = true;

        await waitIdle();
        if (_aborted) return;

        if (isVideoOpen) {
            try { await fermerVideo(); } catch (_) {}
            await waitIdle();                 // par sûreté, attendre la fin du repli
            if (_aborted) return;
        }

        _lancerRetourOpening();
    }

    /* ── Séquence retour vers Opening (fondu au noir → ferme → signale) ──
       Durcie : baseline d'opacité committée (reflow) pour un fondu fiable dès la
       1ʳᵉ fois, écouteur transitionend filtré sur (root + opacity) afin qu'une
       transition d'un élément enfant qui remonte ne déclenche pas une fermeture
       prématurée, et filet de sécurité par timeout. */
    function _lancerRetourOpening() {
        if (_aborted) return;

        // Baseline déterministe : opacité 1 figée sans transition + reflow.
        root.style.transition = 'none';
        root.style.opacity    = '1';
        void root.offsetWidth;

        let _done = false;
        function finish() {
            if (_done) return;
            _done = true;
            root.removeEventListener('transitionend', onEnd);
            closePeineDemesuree();
            /* Signaler à opening.js qu'il faut rallumer + son */
            window.dispatchEvent(new CustomEvent('peineDemesuree:return'));
        }
        function onEnd(e) {
            if (e.target === root && e.propertyName === 'opacity') finish();
        }
        root.addEventListener('transitionend', onEnd);
        const safety = setTimeout(finish, 1300);   // filet si transitionend ne vient pas
        _timeouts.push(safety);

        // Lancer le fondu au noir à la frame suivante (baseline committée).
        requestAnimationFrame(() => {
            root.style.transition = 'opacity 1s ease';
            root.style.opacity    = '0';
        });
    }

    /* ─────────────────────────────────────────────────────────
       DÉMARRAGE
    ───────────────────────────────────────────────────────── */
    lancerSequence();

    /* ─────────────────────────────────────────────────────────
       DESTROY
    ───────────────────────────────────────────────────────── */
    function destroy() {
        _aborted = true;
        stopTracking();
        // Curseur : filet — couper le mode viseur quel que soit le chemin de sortie.
        document.body.classList.remove('peine-aim');
        setAimHot(false);
        _timeouts.forEach(id => clearTimeout(id));
        _listeners.forEach(({ target, type, fn, opts }) => {
            try { target.removeEventListener(type, fn, opts); } catch (_) {}
        });
        langObs.disconnect();
        /* Stoppe les médias AVANT de restaurer le markup (sinon lecture
           fantôme d'un <video>/<audio> détaché). */
        try { video?.pause(); video?.removeAttribute('src'); video?.load(); } catch (_) {}
        try { audio?.pause(); audio?.removeAttribute('src'); audio?.load(); } catch (_) {}

        /* Restauration intégrale du markup pristine : toutes les classes de
           révélation (is-visible, lifted, is-printed…), les styles inline
           animés (bordures, opacités) et le texte tapé sont remis à zéro d'un
           seul coup → la ré-ouverture rejoue l'animation comme la 1ʳᵉ fois. */
        root.innerHTML = _pristineHTML;
    }

    return { destroy };
}
