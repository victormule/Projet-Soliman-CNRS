/* =====================================================================
   Kléber — Galerie des Batailles · Versailles
   chp3-main.js — Moteur de l'expérience (caméra, chapitres, révélations,
   théâtre de papier, triptyque, atmosphère, audio, question d'intro)

   Dépend de `CONFIG` défini dans chp3-config.js (import ESM).
   Pattern factory : le module est importé UNE fois par Chapitre3Scene
   (sans cache-bust) ; startChapitre3() → boot() monte le moteur contre le
   DOM injecté par la scène, stopChapitre3() le démonte et réarme le boot.
   ===================================================================== */

import { CONFIG } from './chp3-config.js';
import { $, clamp, smooth, easeInOutQuad, easeInOutSine, easeOutCubic,
         damp, setResponsiveSrc } from './chp3-utils.js';

/* ── Pont scène : injecté par Chapitre3Scene (src/scenes/Chapitre3Scene.js) ──
   PATTERN FACTORY (Phase 2) : aucun effet de bord au chargement du module.
   Le moteur (ex-IIFE) vit dans boot(), appelé par startChapitre3() contre le
   DOM fraîchement injecté par la scène ; tout l'état du moteur étant dans les
   closures de boot()/init(), chaque entrée repart d'un état neuf. Le pont
   _ctx est posé en fin d'init() ; les _pending* absorbent les appels reçus
   avant que le moteur soit prêt (setAudioManager/setArrowCallbacks/start). */
let _ctx = null, _pendingAudio = null, _pendingArrows = null, _pendingStart = false;
let _booted  = false;  // réarmé par stopChapitre3() → re-boot à la prochaine entrée
let _bootGen = 0;      // jeton de génération : neutralise un init() différé
                       // (attente du load image) qui arriverait APRÈS un stop.

export function startChapitre3() {
    _pendingStart = true;
    if (!_booted) { _booted = true; boot(); }   // init() flushe _pendingStart → start
    else _ctx?.start?.();
}
export function stopChapitre3() {
    const c = _ctx;
    _ctx = null; _booted = false; _bootGen++;
    _pendingStart = false; _pendingAudio = null; _pendingArrows = null;
    c?.stop?.();
}
export function setAudioManager(m)     { _pendingAudio = m; _ctx?.setAudioManager?.(m); }
export function setArrowCallbacks(s, h){ _pendingArrows = { s, h }; _ctx?.setArrowCallbacks?.(s, h); }
export function leaveToCollaboration() { return _ctx?.leaveToCollaboration?.(); }

function boot() {
    const _myGen = _bootGen;

    // ===================================================================
    //  CONFIG — déplacée dans chp3-src/chp3-config.js (portée globale).
    //  Le moteur ci-dessous consomme la constante globale `CONFIG`.
    // ===================================================================

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hoverDevice  = window.matchMedia('(hover:hover) and (pointer:fine)').matches;

    // Appareil « léger » (mobile/tactile ou peu de ressources) → on allège l'atmosphère
    // (moins de particules, flou des rayons réduit, canvas en résolution moindre).
    // Indices de performance, pas des gates de fonctionnalité : aucun effet n'est
    // supprimé, seulement dimensionné. Le rendu reste visuellement quasi identique.
    const coarsePointer = window.matchMedia('(pointer:coarse)').matches;
    const lowPowerHint  = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
    const lightDevice   = coarsePointer || lowPowerHint;

    // « Mobile » au sens TACTILE : on COUPE entièrement l'atmosphère canvas
    // (faisceaux + particules) et on allège les repaints. Basé sur coarsePointer
    // SEUL (et non lightDevice) afin de ne JAMAIS toucher un desktop à pointeur fin,
    // même peu puissant → le rendu desktop reste strictement identique.
    const mobileLite    = coarsePointer;

    // ── Utilitaires : extraits dans chp3-utils.js (imports en tête) ────

    // État partagé du halo (écrit par updateLight, lu par la poussière).
    const lightState = { px:0, py:0, rpx:1, litR:1, followX:0, followY:0 };

    const container = $('chp3-container'), scene = $('chp3-scene'), img = $('chp3-img');
    const hotspots  = $('chp3-hotspots'),  veil  = $('chp3-veil'), hint = $('chp3-hint');

    $('chp3-eyebrow').textContent = CONFIG.haut;
    hint.textContent         = CONFIG.bas;

    if (img.complete && img.naturalHeight !== 0) init();
    else { img.addEventListener('load', init, {once:true}); img.addEventListener('error', init, {once:true}); }

    // ===================================================================
    //  MOTEUR
    // ===================================================================
    function init() {
        // Un stop est survenu entre boot() et le load de l'image : cette
        // génération est périmée, ne pas monter un moteur zombie.
        if (_myGen !== _bootGen) return;
        const DUR_TRAVEL = CONFIG.dureeTravel * 1000;
        const DUR_FADE   = CONFIG.dureeFondu  * 1000;
        const DUR_DRAW   = CONFIG.dureeTracé  * 1000;
        const DUR_ENTER  = CONFIG.dureeEntree * 1000;

        // SPA : les variables clair-obscur (--warm/--edge/--lx/--ly/--lr) sont
        // posées sur #chapitre3-root (et non documentElement) pour rester scopées
        // au chapitre et laisser l'inline JS primer sur les valeurs par défaut du CSS.
        const root = document.getElementById('chapitre3-root') || document.documentElement;
        const L = CONFIG.lumiere;
        root.style.setProperty('--warm', L.chaleur);
        root.style.setProperty('--edge', L.bords);

        // ── État caméra / navigation ──────────────────────────────────
        let phase = 'initial';                 // initial → mouse → enter
        let introActive = false;               // true pendant la question d'intro (cf. iqShow, plus bas)
        let posY = 0, velY = 0;                // défilement vertical + inertie (px, px/s)
        let zoomCam = 1;
        let pxCur = 0, pyCur = 0, pxTar = 0, pyTar = 0;   // parallaxe (px écran)
        let pointerNX = 0, pointerNY = 0, pointerInside = false;
        let pointerX = 0, pointerY = 0;      // position écran brute (proximité des cercles)
        let lastOx = 0, lastOy = 0;          // derniers offsets appliqués à la scène
        let nowT = 0;                        // temps courant (s), partagé avec applyScene (drift mobile)
        let edgeVel = 0;
        let dragging = false, dragFromY = 0, dragFromPos = 0, lastDragY = 0, lastDragT = 0;
        let startTime = null, lastT = null;
        let skipRequested = false, titleShown = false, atmoDrawn = false;
        let lastLightPush = -1, lightPushed = false;

        /* ── Pont scène (SPA) : état & helpers d'intégration ─────────────── */
        let _active = true;                 // vrai tant que le module est monté
        let _wantLaunch = false, _launched = false, _navigating = false;
        let _loopRaf = null, _grainTimer = null;
        let _arrowShow = null, _arrowHide = null, _audioMgr = null, _doLaunch = null;
        const _tracked = [];
        const _on = (t, ev, fn, opts) => { t.addEventListener(ev, fn, opts); _tracked.push([t, ev, fn, opts]); };
        const _removeTracked = () => { _tracked.forEach(([t, ev, fn, opts]) => { try { t.removeEventListener(ev, fn, opts); } catch (_) {} }); _tracked.length = 0; };
        let enterStart = null, enterFromZoom = 1, chosenHref = null;

        // ── État de la séquence « tableau » ───────────────────────────
        let revealStage = 'idle';            // 'dimIn' | 'holding' | 'closing'
        let revealStart = null, revealFromZoom = 1, revealCfg = null;

        // État atmosphère (déclaré tôt : initDust/resizeDust sont appelés avant le bloc de rendu).
        let dustCv = null, dctx = null, motes = [], beams = [], dustStart = null;
        let bokehSprite = null;   // dégradé radial pré-rendu une seule fois (cf. initDust)

        // ── Géométrie (modèle COVER, vrai responsive) ─────────────────
        // L'image est en width:100% ; on calcule le facteur qui la fait
        // couvrir entièrement la fenêtre, quel que soit le ratio d'écran.
        let imgCW = 0, imgCH = 0, coverScale = 1, baseZoom = 1;

        function measure() {
            imgCW = img.clientWidth;
            imgCH = img.clientHeight;
            coverScale = imgCH > 0 ? Math.max(1, window.innerHeight / imgCH) : 1;
            baseZoom   = coverScale * CONFIG.overscan;
        }
        const winH = () => window.innerHeight;
        const dispH = z => imgCH * z;
        const scrollMin = z => Math.min(0, winH() - dispH(z));   // limite basse (négatif)
        const overscanX = z => imgCW * (z - 1) / 2;              // débord horizontal exploitable

        // ── Construction des hotspots depuis la CONFIG ────────────────
        const NS = 'http://www.w3.org/2000/svg';
        const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag);
            for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

        const circles = CONFIG.cercles.map((def, i) => {
            const r = def.r, circ = 2 * Math.PI * r, onRight = def.x > 50, sgn = onRight ? -1 : 1;
            const g    = mk('g', { class:'hotspot-group', tabindex:'0', role:'link',
                                   'aria-label':`Chapitre ${def.num} — ${def.label}`, opacity:'0' });
            const hit  = mk('circle', { class:'circle-hit',  r:r + 14 });
            const fill = mk('circle', { class:'circle-fill', r });
            const ping = mk('circle', { class:'circle-ping', r });
            const ring = mk('circle', { class:'circle-ring', r });
            const lx1 = sgn * (r + 6), lx2 = sgn * (r + 18), leaderLen = Math.abs(lx2 - lx1);
            const leader = mk('line', { class:'circle-leader', x1:lx1, y1:0, x2:lx2, y2:0 });
            const num  = mk('text',   { class:'circle-number' });
            const lbl  = mk('text',   { class:'circle-label',
                                        'text-anchor': onRight ? 'end' : 'start',
                                        x: onRight ? -(r + 22) : (r + 22), y:0 });
            num.textContent = def.num; num.style.fontSize = Math.max(11, r * 0.62) + 'px';
            lbl.textContent = def.label;
            ring.style.strokeDasharray = circ; ring.style.strokeDashoffset = circ;
            leader.style.strokeDasharray = leaderLen; leader.style.strokeDashoffset = leaderLen;
            g.append(hit, fill, ping, ring, leader, num, lbl);   // onde sous l'anneau
            hotspots.append(g);

            const c = { def, g, ring, ping, leader, num, lbl, circ, leaderLen,
                        appearAt: def.appAt / 100,
                        phase: Math.random() * Math.PI * 2, pingPhase: Math.random() * CONFIG.ping.periode,
                        started:false, startedAt:null, done:false, visible:false,
                        hovered:false, activated:false, scaleBase:1, scale:1, px:0, py:0 };

            const enter = () => { if (!c.visible) return;
                c.hovered = true; c.ring.style.stroke = 'var(--gilt-bright)'; setLit(c, true); };
            const leave = () => { c.hovered = false; c.ring.style.stroke = 'var(--ivory-soft)'; setLit(c, false); };
            g.addEventListener('pointerenter', enter);
            g.addEventListener('pointerleave', leave);
            g.addEventListener('focus', enter);
            g.addEventListener('blur',  leave);
            g.addEventListener('click', () => activate(c));
            g.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(c); } });
            return c;
        });

        // Révélation du label : trace la ligne d'amorce + tracking-in du texte.
        const setLit = (c, on) => {
            c.g.classList.toggle('lit', on);
            c.leader.style.strokeDashoffset = on ? '0' : c.leaderLen;
        };

        function setSvgPositions() {
            hotspots.style.height = imgCH + 'px';     // 1 unité SVG = 1 px image
            circles.forEach(c => { c.px = c.def.x/100 * imgCW; c.py = c.def.y/100 * imgCH; });
        }

        function activate(c) {
            if (!c.visible || phase === 'enter' || phase === 'reveal') return;

            // Chapitre porteur d'un « tableau » → séquence cinématographique dédiée.
            if (c.def.reveal) { startReveal(c); return; }

            chosenHref = c.def.href;
            c.ring.style.filter = 'url(#chp3-glow-click)'; c.num.style.filter = 'url(#chp3-glow-click)';
            c.activated = true;
            circles.forEach(o => { if (o !== c) o.g.style.opacity = '0'; });
            pxTar = pyTar = 0;
            phase = 'enter'; enterStart = null; enterFromZoom = zoomCam;
        }

        function resetAfterEnter() {
            phase = 'mouse'; enterStart = null; chosenHref = null;
            veil.style.opacity = '0'; zoomCam = baseZoom; velY = 0;
            circles.forEach(c => { c.g.style.opacity = '1'; c.hovered = false; c.activated = false;
                c.ring.style.filter = 'url(#chp3-glow)'; c.num.style.filter = 'url(#chp3-glow)';
                c.ring.style.stroke = 'var(--ivory-soft)'; setLit(c, false); });
        }

        // ===============================================================
        //  SÉQUENCE « TABLEAU »
        //  clair-obscur léger → cadre tracé au stylet de lumière → portrait → son
        // ===============================================================
        const T = CONFIG.tableau;
        let rvBuilt = false, rvMedia = null, rvImgPromise = null, rvMeta = null, rvMode = 'image';
        let rvKind = 'single';                              // 'single' | 'gallery'
        // ── État du triptyque (gallery) — focus CONTINU piloté au mouvement ──
        let glBuilt = false, glStarted = false, glDrawn = false;
        let glImageIndex = 0, glActive = -1;
        let glFocusF = 0, glTargetF = 0, glSlot = 300, glSheenTimer = null;
        let glItems = [], glCards = [], glMetas = [];
        const glEl = {};
        let rvFrameShown = false, rvVolRamp = null, rvSheenTimer = null, rvDrawn = false;
        const rvEl = {};                                   // références DOM (construites à la volée)
        const rvWait = ms => new Promise(r => setTimeout(r, ms));

        // — Construction paresseuse de l'overlay (une seule fois) —
        function rvEnsureDOM() {
            if (rvBuilt) return;
            const NSV = 'http://www.w3.org/2000/svg';

            const stage = document.createElement('div'); stage.className = 'reveal-stage';
            const frame = document.createElement('div'); frame.className = 'reveal-frame';

            const svg = document.createElementNS(NSV, 'svg');
            svg.setAttribute('class', 'reveal-svg');
            svg.innerHTML = `
              <defs>
                <filter id="chp3-frameGlow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2"  result="a"/>
                  <feGaussianBlur in="SourceGraphic" stdDeviation="7"  result="b"/>
                  <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="c"/>
                  <feMerge><feMergeNode in="c"/><feMergeNode in="b"/>
                          <feMergeNode in="a"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="chp3-cometGlow" x="-300%" y="-300%" width="700%" height="700%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="g"/>
                  <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <path   class="reveal-trace"></path>
              <path   class="reveal-bloom"></path>
              <circle class="reveal-comet" r="3.4"></circle>`;

            const win   = document.createElement('div'); win.className = 'reveal-window';
            const photo = document.createElement('img'); photo.className = 'reveal-photo';
            photo.alt = 'Portrait'; photo.decoding = 'async'; photo.draggable = false;
            const video = document.createElement('video'); video.className = 'reveal-video';
            video.playsInline = true; video.setAttribute('playsinline', '');
            video.preload = 'metadata'; video.style.display = 'none';
            const sheen = document.createElement('div'); sheen.className = 'reveal-sheen';
            win.append(photo, video, sheen);

            const caption = document.createElement('figcaption'); caption.className = 'reveal-caption';
            caption.innerHTML = `
                <div class="cap-slot cap-main show"><div class="t"></div><div class="c"></div></div>
                <div class="cap-slot cap-hover"><div class="t"></div></div>
                <div class="cap-slot cap-hint"><div class="c">Cliquer hors de la vidéo pour fermer</div></div>`;
            frame.append(svg, win);                 // le cadre ne contient que la photo
            stage.append(frame, caption);           // … le cartel vit SOUS le cadre (flux colonne)

            const close = document.createElement('button');
            close.className = 'reveal-close'; close.type = 'button';
            close.setAttribute('aria-label', 'Fermer le portrait');
            close.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
                 <line x1="6" y1="6" x2="18" y2="18"></line>
                 <line x1="18" y1="6" x2="6" y2="18"></line></svg>`;

            container.append(stage, close);

            // Fermeture : croix, clic sur le fond, Échap (géré ailleurs).
            close.addEventListener('click', requestCloseReveal);
            stage.addEventListener('click', e => {
                if (e.target !== stage) return;
                // Théâtre de papier : le fond ne ferme JAMAIS le tableau — seule la croix
                // le peut. Un clic sur le fond referme uniquement une vidéo en cours.
                if (revealCfg && revealCfg.theatre) { if (thPlaying || thTransitioning) thCloseVideo(); return; }
                requestCloseReveal();
            });
            frame.addEventListener('click', e => {
                e.stopPropagation();
                // Clic sur le passe-partout (hors vidéo) → sort de la vidéo, reste dans le tableau.
                if (thPlaying || thTransitioning) thCloseVideo();
            });

            Object.assign(rvEl, {
                stage, frame, svg, win, photo, video, sheen, close, caption,
                capMain:  caption.querySelector('.cap-main'),
                capHover: caption.querySelector('.cap-hover'),
                capHint:  caption.querySelector('.cap-hint'),
                capT:      caption.querySelector('.cap-main .t'),
                capC:      caption.querySelector('.cap-main .c'),
                capHoverT: caption.querySelector('.cap-hover .t'),
                trace: svg.querySelector('.reveal-trace'),
                bloom: svg.querySelector('.reveal-bloom'),
                comet: svg.querySelector('.reveal-comet'),
            });
            rvBuilt = true;
        }

        // ===============================================================
        //  THÉÂTRE DE PAPIER — hotspots imbriqués dans le reveal simple
        //  (cercle 4 : plante / palmier / arcade), pilotés entièrement par
        //  CONFIG.cercles[].reveal.theatre.
        //
        //  Interaction :
        //   - survol      → image + nom de l'élément en fondu doux
        //   - clic        → un voile se dissout vers l'encre du site (même
        //                    langage que la pénombre du tableau), masque
        //                    l'échange photo/vidéo, puis se dévoile sur la
        //                    vidéo ; le même geste, inversé, ramène à la photo
        //   - clic sur la vidéo    → pause / reprise
        //   - clic hors de la vidéo → ferme la vidéo, retour à la photo
        //                             (reste dans le tableau, ne ferme pas le cercle)
        //   - croix                → seule à pouvoir fermer le tableau ;
        //                             désactivée (disabled natif) tant qu'une
        //                             vidéo joue ou qu'une transition est en cours
        //
        //  Cartel : 3 variantes empilées dans une même cellule de grille
        //  (cap-main / cap-hover / cap-hint, cf. CSS .cap-slot) — la hauteur du
        //  cartel est donc fixe, un changement de texte ne peut jamais décaler
        //  le cadre.
        //
        //  Balayage de suggestion (thHint*) : indice périodique d'interactivité,
        //  cf. section dédiée plus bas.
        // ===============================================================
        let thBuilt = false, thPlaying = null, thTransitioning = false, thHovering = false,
            thSeq = 0, thVolRAF = null, thHintTimer = null, thHintSeq = 0;
        const thEl = { hits: [] };

        function thEnsureDOM() {
            if (thBuilt) return;
            const T = CONFIG.tableau;
            const layer = document.createElement('div'); layer.className = 'th-layer';

            const video = document.createElement('video'); video.className = 'th-video';
            video.playsInline = true; video.setAttribute('playsinline', '');
            video.preload = 'none';

            const veil = document.createElement('div'); veil.className = 'th-veil';
            veil.style.setProperty('--th-fondu-duree', T.fonduDuree + 'ms');
            layer.style.setProperty('--th-suggestion-duree', T.suggestion.transitionRapide + 'ms');

            layer.append(video, veil);
            rvEl.win.appendChild(layer);

            video.addEventListener('ended', () => thCloseVideo());
            // Robustesse : un média introuvable/corrompu ne doit jamais bloquer l'UI.
            video.addEventListener('error', () => thCloseVideo());
            // Clic sur la vidéo : pause/reprise — ne doit pas se propager (sinon on
            // sortirait de la vidéo, cf. le clic « frame » qui referme, plus haut).
            video.addEventListener('click', e => {
                e.stopPropagation();
                if (thTransitioning || !thPlaying) return;
                if (video.paused) video.play().catch(() => {}); else video.pause();
            });

            Object.assign(thEl, { layer, video, veil, hits: [] });
            thBuilt = true;
        }

        // Fondu de volume générique (indépendant de rvVolumeTo, dédié à la vidéo théâtre).
        function thFadeVolume(el, target, dur) {
            if (thVolRAF) cancelAnimationFrame(thVolRAF);
            const from = el.volume; let t0 = null;
            const step = now => {
                if (t0 === null) t0 = now;
                const k = Math.min((now - t0) / dur, 1);
                el.volume = clamp(from + (target - from) * k, 0, 1);
                if (k < 1) thVolRAF = requestAnimationFrame(step);
                else thVolRAF = null;
            };
            thVolRAF = requestAnimationFrame(step);
        }

        // Active ou désactive les hotspots via l'attribut natif `disabled` (bloque
        // souris, tactile et clavier — plus robuste qu'un simple pointer-events CSS).
        function thSetHitsEnabled(enabled) {
            thEl.hits.forEach(h => { h.hit.disabled = !enabled; });
        }

        function thClearHits() {
            thEl.hits.forEach(h => { h.hit.remove(); h.img.remove(); });
            thEl.hits = [];
        }

        /**
         * Bascule la variante du cartel affichée. Les trois variantes sont
         * toujours présentes dans le DOM, superposées (cf. CSS .cap-slot) : le
         * cartel garde une hauteur fixe, un changement de texte ne peut donc
         * jamais décaler le cadre.
         * @param {'main'|'hover'|'hint'} active
         */
        function thShowCaption(active) {
            rvEl.capMain.classList.toggle('show',  active === 'main');
            rvEl.capHover.classList.toggle('show', active === 'hover');
            rvEl.capHint.classList.toggle('show',  active === 'hint');
        }

        // Un mouvement de voile (assombrissement OU dévoilement), résolu quand
        // le CSS a fini (ou immédiatement si l'utilisateur préfère moins de mouvement).
        function thVeilMove(dark) {
            const T = CONFIG.tableau;
            return new Promise(resolve => {
                thEl.veil.classList.toggle('dark', dark);
                setTimeout(resolve, reduceMotion ? 0 : T.fonduDuree);
            });
        }

        // ── Balayage de suggestion ──────────────────────────────────────
        // Indice d'interactivité : rejoue, tant que le tableau est ouvert et
        // inactif, un survol simulé de chaque hotspot, dans l'ordre gauche →
        // droite. Réutilise la classe `on` du survol réel (même mécanisme
        // d'affichage), avec un fondu dédié plus rapide (`hint-fast`, cf. CSS).
        // N'affecte jamais le cartel.
        //
        // Les hotspots sont décalés au DÉPART (thHintPulse reçoit un délai
        // initial croissant) mais animés en parallèle, sans attendre qu'un
        // élément ait fini sa propre transition avant de lancer le suivant :
        // le résultat est un fondu continu et homogène plutôt que des blocs
        // allumés/éteints séparés par des pauses.
        //
        // Le survol réel a toujours priorité : thHintCancel() interrompt net
        // toute suggestion en cours dès qu'une interaction véritable démarre,
        // pour ne jamais superposer deux animations sur une même image.
        function thHintCancel() {
            clearTimeout(thHintTimer); thHintTimer = null;
            ++thHintSeq;                                  // invalide toute suggestion en vol
            thEl.hits.forEach(h => h.img.classList.remove('on', 'hint-fast'));
        }

        // Programme le PROCHAIN passage périodique (délai aléatoire). N'est
        // jamais utilisée pour le tout premier passage — cf. thHintKickoff.
        function thHintSchedule() {
            clearTimeout(thHintTimer);
            if (reduceMotion || !thEl.hintOrder || !thEl.hintOrder.length) return;
            const S = CONFIG.tableau.suggestion;
            thHintTimer = setTimeout(thHintSweep, S.delaiMin + Math.random() * S.delaiJitter);
        }

        // Déclenche le tout premier passage sans attendre le délai périodique —
        // appelée une fois par rvBeginFrame, à l'apparition de l'image. Les
        // passages suivants reprennent ensuite le rythme aléatoire habituel
        // (thHintSweep reprogramme lui-même via thHintSchedule à la fin).
        function thHintKickoff() {
            clearTimeout(thHintTimer);
            thHintSweep();
        }

        // Cycle complet d'un hotspot : attend son décalage de départ, s'allume,
        // tient, s'éteint. `seq` est revérifié à chaque reprise d'exécution afin
        // qu'une annulation en cours de route (thHintCancel) stoppe net, même
        // en plein fondu.
        async function thHintPulse(h, seq, startDelay) {
            const S = CONFIG.tableau.suggestion;
            if (startDelay > 0) {
                await rvWait(startDelay);
                if (seq !== thHintSeq) return;
            }
            h.img.classList.add('hint-fast', 'on');
            await rvWait(S.tenue);
            if (seq !== thHintSeq) { h.img.classList.remove('hint-fast'); return; }

            h.img.classList.remove('on');
            await rvWait(S.transitionRapide);            // laisse le fondu de sortie se terminer
            if (seq !== thHintSeq) return;
            h.img.classList.remove('hint-fast');
        }

        async function thHintSweep() {
            const seq = ++thHintSeq;
            if (!thEl.hintOrder || !thEl.hintOrder.length) return;

            // Jamais pendant une vidéo, une transition de voile, ou un survol
            // réel : on reprogramme sans animer plutôt que de forcer ce passage.
            if (phase !== 'reveal' || revealStage !== 'holding' || thPlaying || thTransitioning || thHovering) {
                thHintSchedule();
                return;
            }

            const S = CONFIG.tableau.suggestion;
            await Promise.all(thEl.hintOrder.map((h, i) => thHintPulse(h, seq, i * S.decalage)));
            if (seq !== thHintSeq) return;
            thHintSchedule();                             // reprogramme le prochain passage périodique
        }

        // Reconstruit (ou masque) la couche de hotspots pour le reveal en cours.
        // Appelé à CHAQUE ouverture d'un reveal « simple » — cfg vaut null pour
        // les cercles sans théâtre imbriqué (rien ne s'affiche alors).
        function thSetup(cfg) {
            thEnsureDOM();
            thCloseVideo(true);               // jamais de vidéo/voile/suggestion résiduels
            thClearHits();
            rvEl.capHoverT.textContent = '';  // pas de nom de survol qui « fuiterait » d'un autre tableau
            thShowCaption('main');
            thEl.layer.style.display = cfg ? '' : 'none';
            thEl.hintOrder = [];
            if (!cfg) return;

            cfg.forEach(item => {
                const img = document.createElement('img');
                img.className = 'th-overlay-img'; img.alt = '';
                // eager (pas lazy) : dans un conteneur invisible, le lazy-loading
                // différerait le fetch et le premier survol fondrait vers une image
                // pas encore décodée. thSetup n'étant appelé qu'à l'ouverture du
                // tableau concerné, rien n'est chargé prématurément pour autant.
                img.decoding = 'async'; img.loading = 'eager'; img.draggable = false;
                setResponsiveSrc(img, item.overlay, item.overlaySmall);

                const hit = document.createElement('button');
                hit.type = 'button'; hit.className = 'th-hit';
                hit.setAttribute('aria-label', item.label || item.id);
                Object.assign(hit.style, {
                    left: item.x + '%', top: item.y + '%',
                    width: item.w + '%', height: item.h + '%',
                });

                const enter = () => {
                    thHintCancel();                          // le survol réel prime toujours sur la suggestion
                    if (thPlaying || thTransitioning) return;
                    thHovering = true;
                    img.classList.add('on');
                    rvEl.capHoverT.textContent = item.caption || '';
                    thShowCaption('hover');
                };
                const leave = () => {
                    thHovering = false;
                    img.classList.remove('on');
                    if (!thPlaying && !thTransitioning) { thShowCaption('main'); thHintSchedule(); }
                };
                hit.addEventListener('mouseenter', enter);
                hit.addEventListener('mouseleave', leave);
                hit.addEventListener('focus', enter);
                hit.addEventListener('blur', leave);
                hit.addEventListener('click', e => { e.stopPropagation(); thPlayVideo(item); });

                thEl.layer.append(img, hit);
                thEl.hits.push({ hit, img, enter, leave, cfg: item });
            });

            // Ordre gauche → droite explicite (indépendant de l'ordre du tableau
            // CONFIG) : trié sur la position réelle, pas sur l'ordre de déclaration.
            // Le premier passage n'est PAS programmé ici : il est déclenché par
            // thHintKickoff, appelé par rvBeginFrame à l'apparition de l'image.
            thEl.hintOrder = [...thEl.hits].sort((a, b) => a.cfg.x - b.cfg.x);
        }

        // Clic sur une zone : bénit immédiatement la vidéo (geste utilisateur,
        // indispensable pour le son sur Safari/iOS), puis lance la séquence de voile.
        function thPlayVideo(item) {
            if (thPlaying === item.id || thTransitioning) return;
            const v = thEl.video;

            if (!v.src.endsWith(item.video)) { v.src = item.video; v.load(); }
            v.muted = true; v.volume = 0;
            const bless = v.play();
            if (bless && bless.catch) bless.catch(() => {});   // échec silencieux : on retentera après le voile

            thTransitioning = true;
            thHintCancel();                   // nettoie aussi les suggestions .on/.hint-fast en cours
            themeDuck(true);                  // la vidéo du hotspot va jouer son propre son : on efface le thème
            thSetHitsEnabled(false);
            rvEl.close.disabled = true;
            thShowCaption('hint');            // la consigne apparaît dès le clic, en même temps que l'assombrissement

            thRunOpenSequence(item, ++thSeq, v);
        }

        async function thRunOpenSequence(item, seq, v) {
            const T = CONFIG.tableau;
            await thVeilMove(true);                     // voile : assombrissement
            if (seq !== thSeq) return;                   // une autre séquence a pris le relais

            // Voile opaque : on arme la VRAIE lecture, invisible pour le spectateur.
            v.classList.add('on');
            thPlaying = item.id;

            try { v.currentTime = 0; } catch (_) {}
            v.muted = false; v.volume = 0;
            const p = v.play();
            if (p && p.then) {
                p.then(() => thFadeVolume(v, 1, 450))
                 .catch(() => { v.muted = true; v.play().catch(() => {}); });   // son refusé → au moins l'image
            } else thFadeVolume(v, 1, 450);

            await rvWait(T.fonduPause);                  // un instant, voile plein noir (swap invisible)
            if (seq !== thSeq) return;

            await thVeilMove(false);                     // voile : dévoilement sur la vidéo
            if (seq !== thSeq) return;
            thTransitioning = false;                      // la croix reste verrouillée : une vidéo joue
        }

        // Retour à la photo du théâtre : appelé par le clic hors-vidéo, la fin
        // naturelle de la vidéo, une erreur média, ou la fermeture du tableau
        // entier (instant=true → sans voile, nettoyage immédiat et complet).
        function thCloseVideo(instant) {
            if (!thBuilt) return;
            ++thSeq;                                      // annule toute séquence en cours
            if (thVolRAF) { cancelAnimationFrame(thVolRAF); thVolRAF = null; }
            const v = thEl.video;

            if (instant) {
                try { v.pause(); } catch (_) {}
                v.classList.remove('on');
                thEl.veil.classList.remove('dark');
                thHintCancel();                // nettoie aussi les suggestions .on/.hint-fast en cours
                // NB : on ne touche PAS au thème ici. thCloseVideo(true) est un
                // nettoyage de bas niveau appelé dans DEUX contextes opposés —
                // retour à la photo (thème à restituer) ET fermeture totale du
                // tableau (thème à couper, via themeStop). Restituer le thème ici
                // le rallumerait à contretemps dans le second cas (bug : thème
                // résiduel sur la page d'accueil). Le pilotage du thème est laissé
                // à l'appelant, seul à connaître l'intention (cf. thPlayVideo /
                // thRunCloseSequence pour le duck, requestCloseReveal pour l'arrêt).
                thSetHitsEnabled(true); rvEl.close.disabled = false;
                thShowCaption('main');
                thPlaying = null; thTransitioning = false; thHovering = false;
                try { v.currentTime = 0; } catch (_) {}
                v.removeAttribute('src'); v.load();
                return;
            }

            if (!thPlaying && !thTransitioning) return;    // rien à fermer
            thTransitioning = true;
            thRunCloseSequence(thSeq, v);
        }

        async function thRunCloseSequence(seq, v) {
            thShowCaption('main');                        // le cartel revient en même temps que l'assombrissement
            await thVeilMove(true);                       // voile : assombrissement (masque l'arrêt vidéo)
            if (seq !== thSeq) return;

            try { v.pause(); } catch (_) {}
            v.classList.remove('on');
            try { v.currentTime = 0; } catch (_) {}
            thPlaying = null;
            themeDuck(false);                             // la vidéo du hotspot s'est arrêtée : on restitue le thème

            await thVeilMove(false);                      // voile : dévoilement sur la photo
            if (seq !== thSeq) return;

            // Un hotspot resté survolé (souris immobile) redevient réactif : on
            // relance son survol si besoin, sinon le nom réapparaîtrait seulement
            // au prochain mouvement de souris. Réservé aux pointeurs fins : sur
            // tactile, :hover est « collant » (dernier élément touché) et
            // afficherait à tort le cartel de survol après la fermeture.
            thSetHitsEnabled(true);
            if (hoverDevice) thEl.hits.forEach(h => { if (h.hit.matches(':hover')) h.enter(); });
            rvEl.close.disabled = false;                   // la croix redevient active
            thTransitioning = false;
            thHintSchedule();                               // reprend le balayage d'indice, tableau à nouveau calme
        }

        // — Déclenchement (DANS le geste de clic → débloque l'audio mobile/Safari) —
        function startReveal(c) {
            rvEnsureDOM();
            if (_arrowHide) _arrowHide();
            revealCfg  = c.def.reveal;
            chosenHref = null;
            circles.forEach(o => { o.g.style.opacity = '0'; o.hovered = false; setLit(o, false); });
            $('chp3-titleblock').classList.remove('show'); hint.classList.remove('show');
            pxTar = pyTar = 0;

            rvFrameShown = false; rvDrawn = false;
            rvKind = revealCfg.gallery ? 'gallery' : 'single';

            if (rvKind === 'gallery') {
                glEnsureDOM();
                glPrime(revealCfg);            // précharge + « bénit » les vidéos (dans le geste)
            } else {
                rvMeta = null;
                rvMode = revealCfg.video ? 'video' : 'image';
                rvEl.capT.textContent = revealCfg.titre  || '';
                rvEl.capC.textContent = revealCfg.credit || '';
                rvEl.capC.style.display = revealCfg.credit ? '' : 'none';
                rvPreloadMedia(revealCfg);     // précharge → on lira le ratio réel
                rvUnlockMedia(revealCfg);      // amorce le média DANS le geste utilisateur
            }

            // SON : extinction de l'ambiance principale (via la machine à états),
            // puis démarrage du thème de scène propre au cercle (silence si non défini).
            ambSetDesired('off');
            themePlay(revealCfg.theme);

            revealFromZoom = zoomCam; revealStart = null;
            revealStage = 'dimIn'; phase = 'reveal';
        }

        // Précharge le média et résout son ratio réel (largeur/hauteur).
        function rvPreloadMedia(cfg) {
            rvImgPromise = new Promise(res => {
                if (cfg.video) {
                    const v = rvEl.video;
                    if (!v.src.endsWith(cfg.video)) { v.src = cfg.video; v.load(); }   // une seule fois
                    const ready = () => res({ ar:(v.videoWidth / v.videoHeight) || T.ratioDefaut, ok:v.videoWidth > 0 });
                    if (v.readyState >= 1 && v.videoWidth > 0) { ready(); return; }     // métadonnées déjà là (réouverture)
                    v.onloadedmetadata = ready;
                    v.onerror          = () => res({ ar:T.ratioDefaut, ok:false });
                } else {
                    const im = new Image();
                    im.onload  = () => res({ ar:(im.naturalWidth / im.naturalHeight) || T.ratioDefaut, ok:true });
                    im.onerror = () => res({ ar:T.ratioDefaut, ok:false });
                    im.src = cfg.image;
                }
            });
        }

        // Amorce le média (lecture « bénie » par le geste → son autorisé ensuite).
        function rvUnlockMedia(cfg) {
            try {
                if (cfg.video) {
                    rvMedia = rvEl.video;
                    if (!rvMedia.src.endsWith(cfg.video)) rvMedia.src = cfg.video;
                } else if (cfg.sound) {
                    rvMedia = new Audio(cfg.sound);
                    rvMedia.preload = 'auto';
                } else {
                    rvMedia = null;        // image sans son : aucun média audio à amorcer
                    return;
                }
                rvMedia.volume = 0;
                // Média terminé → on referme et on revient au buste.
                rvMedia.onended = () => {
                    if (phase === 'reveal' && revealStage === 'holding') requestCloseReveal();
                };
                const wasMuted = rvMedia.muted;
                rvMedia.muted = true;                       // « bénir » sans bruit parasite
                const p = rvMedia.play();
                if (p && p.then) p.then(() => { rvMedia.pause(); rvMedia.currentTime = 0; rvMedia.muted = wasMuted; })
                                  .catch(() => { rvMedia.muted = wasMuted; });
            } catch (_) { rvMedia = null; }
        }

        // — Pilotage par la boucle : assombrir, maintenir vivant, sortir —
        function stepReveal(ts, t, dt) {
            pxCur = damp(pxCur, 0, 8, dt); pyCur = damp(pyCur, 0, 8, dt);

            if (revealStage === 'dimIn') {
                if (revealStart === null) revealStart = ts;
                const e = easeInOutQuad(Math.min((ts - revealStart) / T.dureeDim, 1));
                zoomCam = revealFromZoom * (1 + T.zoomLeger * e);
                veil.style.opacity = (T.voile * e).toFixed(3);
                applyScene(); drawAtmo(t);
                if (e >= 1 && !rvFrameShown) {
                    rvFrameShown = true; revealStage = 'holding';
                    if (rvKind === 'gallery') glBegin(); else rvBeginFrame();
                }
                return;
            }
            if (revealStage === 'holding') {
                const breath = reduceMotion ? 0 : 0.006 * Math.sin(t * 0.5);   // le buste « respire » sous le voile
                zoomCam = revealFromZoom * (1 + T.zoomLeger) * (1 + breath);
                veil.style.opacity = T.voile.toFixed(3);
                applyScene(); drawAtmo(t);
                if (rvKind === 'gallery') glTick(dt);     // focus continu (scrub souris / tactile)
                return;
            }
            if (revealStage === 'closing') {
                if (revealStart === null) revealStart = ts;
                const e = easeInOutQuad(Math.min((ts - revealStart) / T.dureeSortie, 1));
                const from = revealFromZoom * (1 + T.zoomLeger);
                zoomCam = from + (baseZoom - from) * e;
                veil.style.opacity = (T.voile * (1 - e)).toFixed(3);
                applyScene(); drawAtmo(t);
                if (e >= 1) rvFinishClose();
                return;
            }
        }

        // — Étape 2 : tracer le cadre, sertir le média, lancer le son, montrer la croix —
        async function rvBeginFrame() {
            const meta = await Promise.race([
                rvImgPromise,
                new Promise(r => setTimeout(() => r({ ar:T.ratioDefaut, ok:false }), 2200)),
            ]);
            rvMeta = meta;
            rvLayout(meta.ar);
            rvEl.stage.classList.add('show');

            await rvDrawTrace();        // le stylet de lumière trace le rectangle
            rvDrawn = true;
            rvBloomFlash();             // éclat de complétion

            // Sélection du média visible (photo ↔ vidéo).
            if (rvMode === 'video') {
                rvEl.photo.style.display = 'none';
                rvEl.video.style.display = '';
                rvEl.win.classList.toggle('empty', !meta.ok);
            } else {
                rvEl.video.style.display = 'none';
                rvEl.photo.style.display = '';
                if (meta.ok) { rvEl.win.classList.remove('empty'); setResponsiveSrc(rvEl.photo, revealCfg.image, revealCfg.imageSmall); }
                else         { rvEl.win.classList.add('empty');    rvEl.photo.removeAttribute('src'); rvEl.photo.removeAttribute('srcset'); }
            }
            thSetup(revealCfg.theatre || null);   // hotspots imbriqués (cercle « théâtre de papier » uniquement)

            await rvWait(40);
            if (revealStage !== 'holding') return;            // fermé entre-temps
            rvEl.win.classList.add('show');                   // le média se matérialise
            if (revealCfg.theatre) thHintKickoff();           // premier balayage, sans attendre le délai périodique
            rvTriggerSheen();                                 // reflet d'ouverture
            if (rvMode === 'image') rvScheduleSheen();        // reflets sporadiques (photo fixe seulement)

            rvPlayMedia();                                    // son (et lecture vidéo) en fondu d'entrée
            await rvWait(360);
            if (revealStage !== 'holding') return;
            rvEl.caption.classList.add('show');               // le cartel se grave
            await rvWait(220);
            if (revealStage === 'holding') rvEl.close.classList.add('show');
        }

        // Reflet qui parcourt la photo (ré-armable).
        function rvTriggerSheen() {
            if (reduceMotion) return;
            rvEl.sheen.classList.remove('sweep'); void rvEl.sheen.offsetWidth; rvEl.sheen.classList.add('sweep');
        }
        // Rejoue le reflet sporadiquement tant que le portrait est ouvert.
        function rvScheduleSheen() {
            clearTimeout(rvSheenTimer);
            if (reduceMotion) return;
            const delay = 7000 + Math.random() * 9000;        // 7–16 s
            rvSheenTimer = setTimeout(() => {
                if (phase === 'reveal' && revealStage === 'holding') { rvTriggerSheen(); rvScheduleSheen(); }
            }, delay);
        }

        // Cadre centré, contraint à la fenêtre, au ratio RÉEL de la photo.
        // La hauteur disponible déduit la place réellement occupée par le cartel
        // → tout (cadre + légende) tient toujours, à toute taille de fenêtre.
        function rvLayout(ar) {
            // Largeur du cartel d'abord, pour mesurer sa hauteur réelle (avec retour à la ligne).
            const capMaxW = Math.min(innerWidth * 0.92, 640);
            rvEl.caption.style.maxWidth = capMaxW + 'px';
            // Mesure INCONDITIONNELLE : depuis que le cartel empile ses 3 variantes
            // en grille, il occupe toujours la hauteur de la plus haute (même titre
            // vide, cap-hint a du texte) — l'ancien `capT.textContent ? … : 0`
            // sous-estimerait le budget vertical et laisserait le cadre déborder.
            const capH = rvEl.caption.offsetHeight;

            const gap   = clamp(innerHeight * 0.024, 14, 26);
            const padV  = Math.max(innerHeight * 0.045, 16);          // marge haut + bas (par côté)
            const availH = innerHeight - 2 * padV - gap - capH;       // budget vertical du cadre
            const availW = innerWidth  * T.matVw;

            const maxH = Math.min(innerHeight * T.matVh, Math.max(availH, 80));
            let w = Math.min(availW, innerWidth * T.matVw), h = w / ar;
            if (h > maxH) { h = maxH; w = h * ar; }
            if (w > availW) { w = availW; h = w / ar; }               // re-borne en largeur
            w = Math.round(w); h = Math.round(h);

            rvEl.frame.style.width  = w + 'px';
            rvEl.frame.style.height = h + 'px';

            const sw    = Math.max(2.4, Math.min(w, h) * 0.006);   // épaisseur du trait lumineux
            const mat   = Math.max(10,  Math.min(w, h) * 0.035);   // passe-partout
            const inset = sw / 2 + 0.5;

            rvEl.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

            // Chemin : départ haut-centre, sens horaire, fermeture au centre (tracé symétrique).
            const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset, cx = w / 2;
            const d  = `M ${cx} ${y0} H ${x1} V ${y1} H ${x0} V ${y0} Z`;
            rvEl.trace.setAttribute('d', d);  rvEl.trace.setAttribute('stroke-width', sw.toFixed(2));
            rvEl.bloom.setAttribute('d', d);  rvEl.bloom.setAttribute('stroke-width', (sw * 1.6).toFixed(2));

            const L = 2 * ((x1 - x0) + (y1 - y0));
            rvEl._perim = L; rvEl._geo = { x0, y0, x1, y1, cx };
            rvEl.trace.style.strokeDasharray  = L;
            rvEl.trace.style.strokeDashoffset = rvDrawn ? 0 : L;   // au resize : on garde le cadre tracé
            rvEl.comet.style.opacity = '0';

            const inner = sw + mat;            // fenêtre photo sertie par le passe-partout
            Object.assign(rvEl.win.style, {
                left: inner + 'px', top: inner + 'px',
                width:  (w - 2 * inner) + 'px',
                height: (h - 2 * inner) + 'px',
            });
        }

        // Relayout à la volée si la fenêtre change pendant l'ouverture.
        function rvOnResize() {
            if (phase !== 'reveal') return;
            if (rvKind === 'gallery') { if (glStarted) glLayout(); return; }
            if (rvMeta && (revealStage === 'holding' || revealStage === 'dimIn'))
                rvLayout(rvMeta.ar);
        }

        // ===============================================================
        //  MODE « TRIPTYQUE » (gallery)
        //  Cadres lumineux tracés au stylet (les 3 EN MÊME TEMPS) · médias
        //  sertis à l'intérieur · focus CONTINU piloté au mouvement de souris
        //  (ou toucher gauche/droite) · une seule vidéo sonore à la fois.
        // ===============================================================
        const GL = { scaleFall:0.28, minScale:0.50, dampFocus:8, dead:0.34, sheenMin:7000, sheenSpan:9000 };

        function glEnsureDefs() {
            if (document.getElementById('chp3-glFrameGlow')) return;
            const NSV = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(NSV, 'svg');
            svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
            svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
            svg.innerHTML = `<defs>
                <filter id="chp3-glFrameGlow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2"  result="a"/>
                  <feGaussianBlur in="SourceGraphic" stdDeviation="7"  result="b"/>
                  <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="c"/>
                  <feMerge><feMergeNode in="c"/><feMergeNode in="b"/>
                          <feMergeNode in="a"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="chp3-glCometGlow" x="-300%" y="-300%" width="700%" height="700%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="g"/>
                  <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter></defs>`;
            container.appendChild(svg);
        }

        function glEnsureDOM() {
            if (glBuilt) return;
            glEnsureDefs();
            const stage = document.createElement('div'); stage.className = 'gallery-stage';
            const track = document.createElement('div'); track.className = 'gallery-track';
            const caption = document.createElement('figcaption'); caption.className = 'gallery-caption';
            caption.innerHTML = `<div class="t"></div><div class="c"></div>`;
            stage.append(track, caption);
            container.append(stage);

            // Clic sur le fond (hors carte) → fermeture
            stage.addEventListener('click', e => { if (e.target === stage || e.target === track) requestCloseReveal(); });

            // ── Navigation ──────────────────────────────────────────────
            // Souris (pointeur fin) : la position horizontale fait défiler en continu.
            stage.addEventListener('pointermove', e => {
                if (!glStarted || e.pointerType === 'touch') return;
                glScrubToX(e.clientX);
            });
            // Tactile : toucher gauche/droite de l'écran → un cran ; un glissé fait défiler.
            let tStartX = 0, tStartY = 0, tMoved = false, tDown = false;
            stage.addEventListener('pointerdown', e => {
                if (e.pointerType !== 'touch') return;
                tDown = true; tMoved = false; tStartX = e.clientX; tStartY = e.clientY;
            });
            stage.addEventListener('pointermove', e => {
                if (!tDown || e.pointerType !== 'touch') return;
                if (Math.abs(e.clientX - tStartX) > 30 && Math.abs(e.clientX - tStartX) > Math.abs(e.clientY - tStartY)) {
                    tMoved = true; glScrubToX(e.clientX);
                }
            });
            const tEnd = e => {
                if (!tDown || e.pointerType !== 'touch') return; tDown = false;
                if (tMoved) { glTargetF = Math.round(glFocusF); return; }
                const z = e.clientX / innerWidth;
                if (z < 0.40)      glGoTo(Math.round(glFocusF) - 1);
                else if (z > 0.60) glGoTo(Math.round(glFocusF) + 1);
                else               glTapCenter();
            };
            stage.addEventListener('pointerup', tEnd);
            stage.addEventListener('pointercancel', () => { tDown = false; });

            Object.assign(glEl, { stage, track, caption,
                capT: caption.querySelector('.t'), capC: caption.querySelector('.c') });
            glBuilt = true;
        }

        // Mappe une position X écran → cible de focus continue [0 .. N-1],
        // AVEC DÉTENTES : chaque carte a un plateau stable ; on ne glisse que
        // dans la bande de transition entre deux cartes (stable + cinématographique).
        function glScrubToX(clientX) {
            const N = glItems.length; if (N <= 1) return;
            const nx  = clamp((clientX / innerWidth - 0.12) / 0.76, 0, 1);
            const raw = nx * (N - 1);
            glTargetF = glDetent(raw);
        }
        function glDetent(raw) {
            const N = glItems.length;
            const c = Math.round(raw);
            const d = raw - c, ad = Math.abs(d), s = Math.sign(d);
            const span = 0.5 - GL.dead;
            let out = 0;
            if (ad > GL.dead) out = s * easeInOutSine((ad - GL.dead) / span) * 0.5;
            return clamp(c + out, 0, N - 1);
        }
        function glGoTo(i) { glTargetF = clamp(i, 0, glItems.length - 1); }
        function glTapCenter() {
            const c = glCards[glActive];
            if (c && c.isVideo) { if (c.media.paused) glPlay(c.media); else { try { c.media.pause(); } catch (_) {} } }
        }

        // Précharge tous les documents + bénit les vidéos dans le geste de clic.
        function glPrime(cfg) {
            glItems = cfg.gallery.slice();
            const N = glItems.length;
            glImageIndex = glItems.findIndex(it => it.image); if (glImageIndex < 0) glImageIndex = 0;
            glFocusF = glTargetF = clamp(cfg.start ?? Math.floor(N / 2), 0, N - 1);
            glActive = -1; glDrawn = false; glStarted = false;

            glEl.track.innerHTML = '';
            glCards = []; glMetas = new Array(N).fill(null);
            const NSV = 'http://www.w3.org/2000/svg';

            glItems.forEach((it, i) => {
                const card  = document.createElement('div'); card.className = 'gallery-card';
                const svg   = document.createElementNS(NSV, 'svg');    svg.setAttribute('class', 'gl-svg');
                const trace = document.createElementNS(NSV, 'path');   trace.setAttribute('class', 'gl-trace');
                const comet = document.createElementNS(NSV, 'circle'); comet.setAttribute('class', 'gl-comet'); comet.setAttribute('r', '3.2');
                svg.append(trace, comet);
                const win   = document.createElement('div'); win.className = 'gl-window';
                const veilc = document.createElement('div'); veilc.className = 'veilcard';
                const sweep = document.createElement('div'); sweep.className = 'sweep-el';
                let media;
                if (it.video) {
                    card.classList.add('is-video');
                    media = document.createElement('video');
                    media.className = 'm'; media.playsInline = true; media.setAttribute('playsinline', '');
                    media.preload = 'metadata'; media.src = it.video;
                    media.onended = () => { if (phase === 'reveal' && revealStage === 'holding' && glActive === i) glGoTo(glImageIndex); };
                    const badge = document.createElement('div'); badge.className = 'play-badge';
                    win.append(media, veilc, sweep); card.append(svg, win, badge);
                } else {
                    media = document.createElement('img');
                    media.className = 'm'; media.decoding = 'async'; media.draggable = false; media.src = it.image;
                    win.append(media, veilc, sweep); card.append(svg, win);
                }
                card.addEventListener('click', e => {
                    e.stopPropagation();
                    if (i === glActive) { if (it.video) glTapCenter(); }
                    else glGoTo(i);
                });
                glMetaPromise(it, media, i);
                glEl.track.append(card);
                glCards.push({ card, svg, trace, comet, win, veilc, sweep, media, item: it, isVideo: !!it.video });

                if (it.video) {                                   // bénir → autorise le son
                    try { const wasM = media.muted; media.muted = true;
                        const p = media.play();
                        if (p && p.then) p.then(() => { media.pause(); media.currentTime = 0; media.muted = wasM; }).catch(() => { media.muted = wasM; });
                    } catch (_) {}
                }
            });
        }

        function glMetaPromise(it, media, i) {
            const fb = CONFIG.tableau.ratioDefaut;
            const set = (ar, ok) => { glMetas[i] = { ar: ar || fb, ok }; if (glStarted) glLayout(); };
            if (it.video) {
                if (media.readyState >= 1 && media.videoWidth > 0) return set(media.videoWidth / media.videoHeight, true);
                media.addEventListener('loadedmetadata', () => set(media.videoWidth / media.videoHeight, true), { once: true });
                media.addEventListener('error', () => set(fb, false), { once: true });
            } else {
                if (media.complete && media.naturalWidth) return set(media.naturalWidth / media.naturalHeight, true);
                media.addEventListener('load',  () => set(media.naturalWidth / media.naturalHeight, true), { once: true });
                media.addEventListener('error', () => set(fb, false), { once: true });
            }
        }

        async function glBegin() {
            glStarted = true;
            await rvWait(120);

            const it0 = glItems[Math.round(glFocusF)] || {};
            glEl.capT.textContent = it0.titre || '';
            glEl.capC.textContent = it0.credit || '';

            glLayout();
            glEl.stage.classList.add('show');

            await glDrawTraces();               // les 3 rectangles se dessinent EN MÊME TEMPS
            glDrawn = true;
            if (revealStage !== 'holding') return;

            glCards.forEach(c => { c.win.classList.add('show'); glSweepCard(c); });   // médias + reflet

            await rvWait(260);
            if (revealStage !== 'holding') return;
            glEl.caption.classList.add('show');
            rvEl.close.classList.add('show');

            // Active le document de départ sans refaire fondre le cartel (déjà posé).
            glActive = Math.round(glFocusF);
            const c0 = glCards[glActive];
            if (c0 && c0.isVideo) { rvMedia = c0.media; glPlay(c0.media); } else { rvMedia = null; themeDuck(false); }
            glScheduleSheen();                  // reflet sporadique sur l'image
        }

        // Tailles des cartes + écart du coverflow.
        // Desktop : accrochage à HAUTEUR COMMUNE (équilibre la vidéo verticale).
        // Mobile  : chaque carte cadrée plein dans la boîte (focus large).
        function glLayout() {
            if (!glCards.length) return;
            const fb = CONFIG.tableau.ratioDefaut;
            const ars = glCards.map((c, i) => (glMetas[i] && glMetas[i].ar) || fb);

            const capMaxW = Math.min(innerWidth * 0.92, 680);
            glEl.caption.style.maxWidth = capMaxW + 'px';
            // Hauteur RÉSERVÉE = le plus grand cartel parmi tous les documents.
            // → les cartes ne se redimensionnent plus quand le texte change (zéro saccade).
            glEl.caption.style.height = 'auto';
            const savedT = glEl.capT.textContent, savedC = glEl.capC.textContent;
            let capH = 0;
            for (const it of glItems) {
                glEl.capT.textContent = it.titre || '';
                glEl.capC.textContent = it.credit || '';
                capH = Math.max(capH, glEl.caption.offsetHeight);
            }
            glEl.capT.textContent = savedT; glEl.capC.textContent = savedC;
            glEl.caption.style.height = capH + 'px';
            const gap   = clamp(innerHeight * 0.022, 12, 24);
            const padV  = Math.max(innerHeight * 0.045, 16);
            const availH = innerHeight - 2 * padV - gap - capH;
            const boxH = Math.min(innerHeight * 0.74, Math.max(availH, 120));  // part de hauteur d'écran allouée aux médias (↑ = plus grands)
            const wide = innerWidth >= 760;
            const capW = innerWidth * (wide ? 0.64 : 0.86);   // part de largeur d'écran pour les médias (desktop ↑ = plus grands)
            const maxAR = Math.max(...ars, 0.1);
            const commonH = Math.max(120, Math.min(boxH, capW / maxAR));   // hauteur commune (desktop)

            const sizeOf = (ar) => {
                if (wide) return { w: commonH * ar, h: commonH };
                let w = capW, h = w / ar;
                if (h > boxH) { h = boxH; w = h * ar; }
                return { w, h };
            };

            let maxCardW = 0, maxCardH = 0;
            glCards.forEach((c, i) => {
                const s = sizeOf(ars[i]);
                const mw = Math.round(s.w), mh = Math.round(s.h);
                const sw  = Math.max(2.2, Math.min(mw, mh) * 0.006);
                const mat = Math.max(8,   Math.min(mw, mh) * 0.028);
                const inner = Math.round(sw + mat);
                const W = mw + 2 * inner, H = mh + 2 * inner;
                c.w = W; c.h = H;
                c.card.style.width = W + 'px'; c.card.style.height = H + 'px';

                const ins = sw / 2 + 0.5;
                const x0 = ins, y0 = ins, x1 = W - ins, y1 = H - ins, cx = W / 2;
                const d = `M ${cx} ${y0} H ${x1} V ${y1} H ${x0} V ${y0} Z`;
                c.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
                c.trace.setAttribute('d', d); c.trace.setAttribute('stroke-width', sw.toFixed(2));
                const L = 2 * ((x1 - x0) + (y1 - y0));
                c._perim = L; c._geo = { x0, y0, x1, y1, cx };
                c.trace.style.strokeDasharray = L;
                c.trace.style.strokeDashoffset = glDrawn ? 0 : L;
                c.comet.style.opacity = '0';

                Object.assign(c.win.style, { left: inner + 'px', top: inner + 'px',
                    width: mw + 'px', height: mh + 'px' });

                maxCardW = Math.max(maxCardW, W); maxCardH = Math.max(maxCardH, H);
            });
            glEl.track.style.height = maxCardH + 'px';

            glSlot = clamp(innerWidth * 0.30, Math.min(maxCardW * 0.60, innerWidth * 0.42), 620);
            glApplyF(glFocusF);
        }

        // Positionne/échelonne les cartes selon un focus CONTINU (float).
        function glApplyF(f) {
            for (let i = 0; i < glCards.length; i++) {
                const c = glCards[i];
                const off = i - f, a = Math.abs(off);
                const scale = Math.max(GL.minScale, 1 - GL.scaleFall * a);
                const x = off * glSlot;
                c.card.style.transform = `translate(-50%, -50%) translateX(${x.toFixed(1)}px) scale(${scale.toFixed(3)})`;
                c.card.style.zIndex = 100 - Math.round(a * 10);
                c.veilc.style.opacity = clamp(a * 0.55, 0, 0.72).toFixed(3);
                c.trace.style.opacity = clamp(1 - a * 0.5, 0.32, 1).toFixed(3);
                c.card.classList.toggle('focused', a < 0.5);
            }
        }

        // Boucle de focus continu (chaque frame en phase 'holding').
        function glTick(dt) {
            if (!glStarted || !glCards.length) return;
            glFocusF = damp(glFocusF, glTargetF, GL.dampFocus, dt);
            if (Math.abs(glFocusF - glTargetF) < 0.001) glFocusF = glTargetF;
            glApplyF(glFocusF);
            const near = Math.round(glFocusF);
            if (near !== glActive && Math.abs(glFocusF - near) < 0.35) glActivate(near);
        }

        // Focalise le document i : son (1 seule vidéo), cartel, reflet.
        function glActivate(i) {
            i = clamp(i, 0, glItems.length - 1);
            if (i === glActive) return;
            glPauseExcept(i);
            glActive = i;
            glUpdateCaption();
            const c = glCards[i];
            if (c) {
                glSweepCard(c);
                if (c.isVideo) { rvMedia = c.media; glPlay(c.media); }
                else { rvMedia = null; themeDuck(false); }
            }
        }

        function glUpdateCaption() {
            const it = glItems[glActive] || {};
            glEl.caption.classList.remove('show');
            clearTimeout(glEl._capTimer);
            glEl._capTimer = setTimeout(() => {
                glEl.capT.textContent = it.titre || '';
                glEl.capC.textContent = it.credit || '';
                if (revealStage === 'holding') glEl.caption.classList.add('show');
            }, 160);
        }

        function glPlay(v) {
            themeDuck(true);       // une vidéo du triptyque va jouer son propre son : on efface le thème
            try {
                v.muted = false; v.volume = 0;
                const target = clamp(revealCfg.volume ?? 0.9, 0, 1);
                const start = () => rvVolumeTo(target, 800);
                const p = v.play();
                if (p && p.then) p.then(start).catch(() => { v.muted = true; v.play().catch(() => {}); });
                else start();
            } catch (_) {}
        }

        function glPauseExcept(keep) {
            glCards.forEach((c, i) => { if (c.isVideo && i !== keep) { try { c.media.pause(); c.media.muted = true; } catch (_) {} } });
        }

        function glSweepCard(c) {
            if (reduceMotion || !c) return;
            c.sweep.classList.remove('go'); void c.sweep.offsetWidth; c.sweep.classList.add('go');
        }
        function glScheduleSheen() {
            clearTimeout(glSheenTimer);
            if (reduceMotion) return;
            const delay = GL.sheenMin + Math.random() * GL.sheenSpan;
            glSheenTimer = setTimeout(() => {
                if (phase === 'reveal' && revealStage === 'holding') {
                    const c = glCards[glImageIndex]; if (c) glSweepCard(c);   // reflet récurrent sur l'image
                    glScheduleSheen();
                }
            }, delay);
        }

        // Dessine les trois rectangles EN MÊME TEMPS (stylet + comète).
        function glDrawTraces() {
            return new Promise(resolve => {
                if (reduceMotion) { glCards.forEach(c => { c.trace.style.strokeDashoffset = 0; }); resolve(); return; }
                const dur = CONFIG.tableau.dureeTracé;
                glCards.forEach(c => { c.comet.style.opacity = '1'; });
                let t0 = null;
                const tick = now => {
                    if (revealStage !== 'holding') { resolve(); return; }
                    if (t0 === null) t0 = now;
                    const k = Math.min((now - t0) / dur, 1), e = easeInOutSine(k);
                    for (const c of glCards) {
                        if (!c._perim) continue;
                        c.trace.style.strokeDashoffset = (c._perim * (1 - e)).toFixed(2);
                        const [px, py] = glPointAt(c, e);
                        c.comet.setAttribute('cx', px.toFixed(1)); c.comet.setAttribute('cy', py.toFixed(1));
                        c.comet.style.opacity = (k > 0.92 ? (1 - (k - 0.92) / 0.08) : 1).toFixed(3);
                    }
                    if (k < 1) requestAnimationFrame(tick);
                    else { glCards.forEach(c => { c.comet.style.opacity = '0'; }); resolve(); }
                };
                requestAnimationFrame(tick);
            });
        }
        function glPointAt(c, p) {
            const { x0, y0, x1, y1, cx } = c._geo;
            const top2 = x1 - cx, side = y1 - y0, bottom = x1 - x0;
            let s = p * (2 * ((x1 - x0) + (y1 - y0)));
            if (s <= top2)   return [cx + s, y0];   s -= top2;
            if (s <= side)   return [x1, y0 + s];   s -= side;
            if (s <= bottom) return [x1 - s, y1];   s -= bottom;
            if (s <= side)   return [x0, y1 - s];   s -= side;
            return [x0 + s, y0];
        }

        function glTeardown() {
            clearTimeout(glEl._capTimer); clearTimeout(glSheenTimer);
            glEl.stage.classList.remove('show');
            glEl.caption.classList.remove('show');
            glCards.forEach(c => {
                if (c.isVideo) { try { c.media.pause(); c.media.currentTime = 0; c.media.muted = true; } catch (_) {} }
                c.win.classList.remove('show'); c.sweep.classList.remove('go');
            });
            glStarted = false; glDrawn = false; glActive = -1;
        }


        // Position de la comète sur le périmètre (départ haut-centre, horaire) pour p∈[0,1].
        function rvPointAt(p) {
            const { x0, y0, x1, y1, cx } = rvEl._geo;
            const top2 = x1 - cx, side = y1 - y0, bottom = x1 - x0;
            let s = p * (2 * ((x1 - x0) + (y1 - y0)));
            if (s <= top2)   return [cx + s, y0];   s -= top2;
            if (s <= side)   return [x1, y0 + s];   s -= side;
            if (s <= bottom) return [x1 - s, y1];   s -= bottom;
            if (s <= side)   return [x0, y1 - s];   s -= side;
            return [x0 + s, y0];
        }

        function rvDrawTrace() {
            return new Promise(resolve => {
                if (reduceMotion) { rvEl.trace.style.strokeDashoffset = 0; resolve(); return; }
                const L = rvEl._perim, dur = T.dureeTracé;
                rvEl.comet.style.opacity = '1';
                let t0 = null;
                const tick = now => {
                    if (revealStage !== 'holding') { resolve(); return; }   // annulé
                    if (t0 === null) t0 = now;
                    const k = Math.min((now - t0) / dur, 1), e = easeInOutSine(k);
                    rvEl.trace.style.strokeDashoffset = (L * (1 - e)).toFixed(2);
                    const [px, py] = rvPointAt(e);
                    rvEl.comet.setAttribute('cx', px.toFixed(1));
                    rvEl.comet.setAttribute('cy', py.toFixed(1));
                    rvEl.comet.style.opacity = (k > 0.92 ? (1 - (k - 0.92) / 0.08) : 1).toFixed(3);
                    if (k < 1) requestAnimationFrame(tick);
                    else { rvEl.comet.style.opacity = '0'; resolve(); }
                };
                requestAnimationFrame(tick);
            });
        }

        function rvBloomFlash() {
            if (reduceMotion || !rvEl.bloom.animate) return;
            rvEl.bloom.animate(
                [{ opacity:0 }, { opacity:0.55, offset:0.25 }, { opacity:0 }],
                { duration:520, easing:'cubic-bezier(.2,.7,.2,1)' });
        }

        function rvPlayMedia() {
            if (!rvMedia) return;
            try {
                rvMedia.currentTime = 0; rvMedia.volume = 0; rvMedia.muted = false;
                const target = clamp(revealCfg.volume ?? 0.85, 0, 1);
                const start = () => rvVolumeTo(target, 1200);
                const p = rvMedia.play();
                if (p && p.then) p.then(start).catch(() => {
                    // Son refusé : on tente au moins la lecture (vidéo) en sourdine.
                    if (rvMode === 'video') { rvMedia.muted = true; rvMedia.play().catch(() => {}); }
                }); else start();
            } catch (_) {}
        }

        function rvVolumeTo(target, dur) {
            if (!rvMedia) return;
            if (rvVolRamp) cancelAnimationFrame(rvVolRamp);
            const from = rvMedia.volume; let t0 = null;
            const step = now => {
                if (t0 === null) t0 = now;
                const k = Math.min((now - t0) / dur, 1);
                rvMedia.volume = clamp(from + (target - from) * k, 0, 1);
                if (k < 1) rvVolRamp = requestAnimationFrame(step);
                else { rvVolRamp = null; if (target === 0) { try { rvMedia.pause(); } catch (_) {} } }
            };
            rvVolRamp = requestAnimationFrame(step);
        }

        // — Fermeture (croix / fond / Échap) : son en fondu, retour au buste —
        function requestCloseReveal() {
            if (phase !== 'reveal' || revealStage === 'closing' || revealStage === 'dimIn') return;
            thCloseVideo(true);                 // coupe net une éventuelle vidéo théâtre en cours
            clearTimeout(rvSheenTimer);
            rvEl.close.classList.remove('show');
            // overlay mono-média
            rvEl.caption.classList.remove('show');
            rvEl.win.classList.remove('show');
            rvEl.stage.classList.remove('show');
            // overlay triptyque
            if (glBuilt) {
                glEl.stage.classList.remove('show');
                glEl.caption.classList.remove('show');
            }
            rvVolumeTo(0, 600);                 // fond sonore du média actif (audio OU vidéo)
            themeStop();                        // fondu de sortie du thème de scène
            revealStart = null; revealStage = 'closing';
        }

        function rvFinishClose() {
            revealStage = 'idle'; phase = 'mouse';
            velY = 0; zoomCam = baseZoom; veil.style.opacity = '0';
            clearTimeout(rvSheenTimer); rvDrawn = false;
            // Remise à zéro de l'overlay pour une réouverture propre.
            rvEl.win.classList.remove('show', 'empty');
            rvEl.caption.classList.remove('show');
            rvEl.sheen.classList.remove('sweep');
            if (rvEl._perim != null) rvEl.trace.style.strokeDashoffset = rvEl._perim;
            rvEl.comet.style.opacity = '0';
            try { if (rvMedia) { rvMedia.pause(); rvMedia.currentTime = 0; } } catch (_) {}
            themeStop(true);
            thCloseVideo(true);
            if (glBuilt) glTeardown();
            rvKind = 'single'; rvMedia = null;
            // Retour du buste, des cercles et du libellé.
            circles.forEach(c => { c.g.style.opacity = '1'; c.hovered = false; c.activated = false;
                c.ring.style.filter = 'url(#chp3-glow)'; c.num.style.filter = 'url(#chp3-glow)';
                c.ring.style.stroke = 'var(--ivory-soft)'; setLit(c, false); });
            $('chp3-titleblock').classList.add('show'); hint.classList.add('show');
            // SON : reprise de l'ambiance principale via la machine à états
            // (idempotente — ne dépend plus de ambAudio.paused, cf. bug historique).
            ambSetDesired('on');
            if (_arrowShow) _arrowShow();
        }

        const revealTitle = () => { if (!titleShown) { titleShown = true;
            $('chp3-titleblock').classList.add('show'); hint.classList.add('show'); } };

        // ── Caméra : image ET hotspots partagent la même transform ────
        function applyScene() {
            // Le défilement logique (posY) est borné sur baseZoom (stable) ; l'AFFICHAGE
            // est borné sur le zoom courant pour ne jamais révéler de bord, même pendant
            // le gros plan d'intro ou la respiration de repos.
            const lo = scrollMin(zoomCam);
            // MOBILE : léger flottement de caméra autonome, en translate PUR (même opération
            // que le scroll, prouvée fluide). Borné par les clamp ci-dessous → aucun bord
            // révélé. Le halo restant fixe, la scène qui dérive dessous fait « vivre » la
            // lumière sans repeindre le moindre dégradé. Phase 'mouse' uniquement (pas
            // pendant l'intro / la révélation). Desktop : driftX/driftY restent à 0.
            let driftX = 0, driftY = 0;
            if (mobileLite && phase === 'mouse') {
                const TAU = Math.PI * 2, f = 0.045;            // période ≈ 22 s
                driftX = 6 * Math.sin(TAU * f * nowT);                       // balancement horizontal ±6 px
                driftY = 3 * (Math.sin(TAU * f * 0.73 * nowT + 1.0) - 1) / 2; // bob vertical -3..0 px (jamais vers le haut → pas de clamp au sommet)
            }
            const oy = clamp(posY + pyCur + driftY, lo, 0);
            const ox = clamp(pxCur + driftX, -overscanX(zoomCam) * 0.85, overscanX(zoomCam) * 0.85);
            lastOx = ox; lastOy = oy;        // réutilisés pour la proximité des cercles
            const t  = `translate(${ox.toFixed(2)}px, ${oy.toFixed(2)}px) scale(${zoomCam.toFixed(4)})`;
            scene.style.transform = t;
            hotspots.style.transform = t;
        }

        function updateCircles(ts, t, easedProgress, dt) {
            const z = zoomCam, cx = innerWidth / 2;
            const proxOn = !reduceMotion && (phase === 'mouse') && pointerInside && !dragging;
            const CI = CONFIG.cercleIdle, CP = CONFIG.cercleProx, PG = CONFIG.ping;

            for (const c of circles) {
                // — Tracé d'apparition —
                if (!c.started && easedProgress >= c.appearAt) {
                    c.started = true; c.startedAt = ts; c.g.setAttribute('opacity', '1');
                }
                if (c.started && !c.done) {
                    const k = Math.min((ts - c.startedAt) / DUR_DRAW, 1);
                    c.ring.style.strokeDashoffset = c.circ * (1 - easeOutCubic(k));
                    if (k > 0.60) c.num.style.opacity = Math.min((k - 0.60) / 0.40, 1);
                    if (k >= 1) { c.done = true; c.visible = true;
                        c.ring.style.strokeDashoffset = '0'; c.num.style.opacity = '1'; }
                }

                // — Proximité au curseur (sensibilité « magnétique ») —
                let prox = 0;
                if (proxOn && c.visible) {
                    const sx = cx + (c.px - cx) * z + lastOx;     // position écran du cercle
                    const sy = c.py * z + lastOy;
                    prox = smooth(1 - Math.hypot(sx - pointerX, sy - pointerY) / CP.rayon);
                }
                const calm = reduceMotion || mobileLite || c.hovered || c.activated;

                // — Échelle : clic > survol > proximité, amortie + souffle de repos —
                const target = c.activated ? CONFIG.hoverScale * 1.12
                             : c.hovered   ? CONFIG.hoverScale
                             : 1 + prox * CP.grossir;
                c.scaleBase = damp(c.scaleBase, target, calm ? CONFIG.hoverLambda : 6, dt);
                const breath = calm ? 0 : CI.respScale * Math.sin(t * CI.respVitesse + c.phase);
                c.scale = c.scaleBase * (1 + breath);

                // — Anneau : clair près du curseur, frémissement léger au loin —
                if (c.visible) {
                    const base    = calm && !reduceMotion ? 1 : CI.opacMin + (1 - CI.opacMin) * prox;
                    const shimmer = calm ? 0 : (1 - prox) * 0.10 * Math.sin(t * 1.6 + c.phase);
                    const so = clamp(base + shimmer, 0, 1).toFixed(3);
                    // Mobile : on n'écrit que si la valeur change → aucune invalidation SVG inutile.
                    if (!mobileLite || so !== c._so) { c.ring.style.strokeOpacity = so; c._so = so; }
                }

                // — Onde concentrique (« instrument ») : discrète, fleurit près du curseur —
                if (PG.actif && !reduceMotion && !mobileLite && c.visible) {
                    const S = clamp(PG.idle + prox * (1 - PG.idle), 0, 1);
                    const p = ((t + c.pingPhase) % PG.periode) / PG.duree;
                    if (p < 1) {
                        c.ping.setAttribute('r', (c.def.r * (1 + PG.ampli * easeOutCubic(p))).toFixed(1));
                        c.ping.style.opacity = (PG.opac * S * (1 - p)).toFixed(3);
                    } else c.ping.style.opacity = '0';
                }

                const tf = `translate(${c.px.toFixed(1)},${c.py.toFixed(1)}) scale(${c.scale.toFixed(4)})`;
                // Mobile : pendant un scroll l'échelle est constante → tf inchangé → zéro
                // mutation du <svg> hotspots (seul son conteneur se translate, en GPU).
                if (!mobileLite || tf !== c._tf) { c.g.setAttribute('transform', tf); c._tf = tf; }
            }
        }

        // ── Halo de lumière : oscillation autonome + suivi du pointeur ─
        function updateLight(ts) {
            const t = ts / 1000;
            let x = L.centreX, y = L.centreY, rayon = L.rayon;
            let fx = 0, fy = 0;                          // composante « suivi pointeur » isolée
            if (!reduceMotion && !mobileLite) {
                const f = L.oscVitesse, TAU = Math.PI * 2;
                x += L.oscAmpl        * (Math.sin(TAU*f*t)*0.7        + Math.sin(TAU*f*2.3*t + 1.1)*0.3);
                y += L.oscAmpl * 0.65 * (Math.cos(TAU*f*0.8*t + 0.5)*0.7 + Math.sin(TAU*f*1.9*t)*0.3);
                rayon *= 1 + L.flamme * (Math.sin(TAU*0.5*t)*0.6 + Math.sin(TAU*1.7*t + 0.5)*0.4);
                if (pointerInside) {                       // la lumière se penche vers vous
                    fx = pointerNX * L.suivreSouris;
                    fy = pointerNY * L.suivreSouris * 0.7;
                    x += fx; y += fy;
                }
            }
            if (mobileLite) {
                // MOBILE : halo FIGÉ. On écrit les variables CSS UNE seule fois → les deux
                // dégradés radiaux plein écran ne sont plus jamais repeints au repos.
                if (!lightPushed) {
                    root.style.setProperty('--lx', x.toFixed(2) + '%');
                    root.style.setProperty('--ly', y.toFixed(2) + '%');
                    root.style.setProperty('--lr', rayon.toFixed(2) + 'vmax');
                    lightPushed = true;
                }
            // Dégradés plein écran coûteux → poussée CSS throttlée (~30 fps) sur desktop.
            } else if (reduceMotion || ts - lastLightPush >= 33) {
                root.style.setProperty('--lx', x.toFixed(2) + '%');
                root.style.setProperty('--ly', y.toFixed(2) + '%');
                root.style.setProperty('--lr', rayon.toFixed(2) + 'vmax');
                lastLightPush = ts;
            }
            // Référentiel pixel pour la poussière (chaque frame, peu coûteux).
            const vmax = Math.max(innerWidth, innerHeight);
            lightState.px   = x/100 * innerWidth;
            lightState.py   = y/100 * innerHeight;
            lightState.followX = fx/100 * innerWidth;    // suivi pointeur seul (px) → atténué par les rayons
            lightState.followY = fy/100 * innerHeight;
            lightState.rpx  = (rayon/100) * vmax * 0.60;
            lightState.litR = (rayon/100) * vmax * 0.95;
        }

        // ── Boucle unique ─────────────────────────────────────────────
        function loop(ts) {
            if (!_active) return;
            if (startTime === null) { startTime = ts; lastT = ts; ambStart(); }
            const dt = Math.min((ts - lastT) / 1000, 0.05);
            lastT = ts;
            const t = ts / 1000;
            nowT = t;

            updateLight(ts);
            if (phase === 'reveal') { stepReveal(ts, t, dt); (_loopRaf = requestAnimationFrame(loop)); return; }

            if (phase === 'enter') {
                if (enterStart === null) enterStart = ts;
                const e = easeInOutQuad(Math.min((ts - enterStart) / DUR_ENTER, 1));
                zoomCam = enterFromZoom * (1 + 0.18 * e);
                veil.style.opacity = e;
                pxCur = damp(pxCur, 0, 8, dt); pyCur = damp(pyCur, 0, 8, dt);
                updateCircles(ts, t, 1, dt);
                applyScene();
                drawAtmo(t);
                if (e >= 1) {
                    if (chosenHref) { chosenHref = null; }   // SPA : pas de navigation dure
                    resetAfterEnter();      // pas de href : on rejoue (utile en aperçu)
                }
                (_loopRaf = requestAnimationFrame(loop)); return;
            }

            if (phase === 'initial') {
                if (skipRequested && (ts - startTime) < DUR_TRAVEL * 0.9)
                    startTime = ts - DUR_TRAVEL * 0.9;             // saut doux vers la fin
                const progress = Math.min((ts - startTime) / DUR_TRAVEL, 1);
                const eased    = easeInOutQuad(progress);
                const startZoom = baseZoom * CONFIG.zoomDepart;

                zoomCam = startZoom + (baseZoom - startZoom) * eased;
                posY    = (winH() - imgCH * startZoom) * (1 - eased);
                img.style.opacity = Math.min((ts - startTime) / DUR_FADE, 1);

                if (eased > 0.10) revealTitle();
                updateCircles(ts, t, eased, dt);
                applyScene();
                drawAtmo(t);

                if (progress >= 1) {
                    phase = 'mouse'; posY = 0; velY = 0; zoomCam = baseZoom;
                    img.style.opacity = '1'; hint.classList.add('show');
                    circles.forEach(c => { if (!c.started) {
                        c.started = true; c.startedAt = ts; c.g.setAttribute('opacity', '1'); } });
                }
                (_loopRaf = requestAnimationFrame(loop)); return;
            }

            // ── phase 'mouse' ─────────────────────────────────────────
            if (!dragging) {
                if (hoverDevice && pointerInside && Math.abs(edgeVel) > 1) velY = edgeVel;  // balayage des bords
                posY += velY * dt;
                velY *= Math.exp(-CONFIG.friction * dt);
                const lo = scrollMin(baseZoom);
                if (posY < lo) { posY = lo; velY = 0; }
                if (posY > 0)  { posY = 0;  velY = 0; }
            }
            // Respiration de repos : la caméra n'est jamais parfaitement figée.
            zoomCam = baseZoom * (1 + ((reduceMotion || mobileLite) ? 0 : CONFIG.respiration * Math.sin(t * CONFIG.respVitesse)));
            if (!reduceMotion) {
                pxCur = damp(pxCur, pxTar, CONFIG.parallaxe.lambda, dt);
                pyCur = damp(pyCur, pyTar, CONFIG.parallaxe.lambda, dt);
            }
            updateCircles(ts, t, 1, dt);
            applyScene();
            drawAtmo(t);
            (_loopRaf = requestAnimationFrame(loop));
        }

        function drawAtmo(t) {
            if (mobileLite) return;   // mobile : aucune atmosphère (faisceaux + particules coupés)
            if (reduceMotion) { if (!atmoDrawn) { drawDust(true, t); atmoDrawn = true; } return; }
            drawDust(false, t);
        }

        // ── Entrées (Pointer Events : souris + tactile + stylet) ──────
        const skip = () => { if (phase === 'initial' && !introActive) skipRequested = true; };

        container.addEventListener('pointermove', e => {
            pointerInside = true;
            pointerX = e.clientX; pointerY = e.clientY;
            pointerNX = clamp((e.clientX / innerWidth)  * 2 - 1, -1, 1);
            pointerNY = clamp((e.clientY / innerHeight) * 2 - 1, -1, 1);

            if (dragging) {                                   // glissé → défilement
                const lo = scrollMin(baseZoom);
                posY = clamp(dragFromPos + (e.clientY - dragFromY), lo, 0);
                const now = e.timeStamp || performance.now(), dtm = now - lastDragT;
                if (dtm > 0) velY = (e.clientY - lastDragY) / dtm * 1000;   // px/s pour l'inertie
                lastDragY = e.clientY; lastDragT = now;
            } else if (phase === 'mouse') {                   // parallaxe (hors glissé)
                pxTar = -pointerNX * CONFIG.parallaxe.x;
                pyTar = -pointerNY * CONFIG.parallaxe.y;
                if (hoverDevice) {                            // balayage auto près des bords
                    const z = winH() * CONFIG.zoneBord; const y = e.clientY;
                    edgeVel = y < z ? ((z - y) / z) * CONFIG.vitesseBord
                            : y > winH() - z ? -((y - (winH() - z)) / z) * CONFIG.vitesseBord : 0;
                }
            }
        });

        container.addEventListener('pointerleave', () => {
            pointerInside = false; edgeVel = 0; pxTar = 0; pyTar = 0;
        });

        container.addEventListener('pointerdown', e => {
            if (phase === 'initial') { if (startTime !== null) skip(); return; }           // tap = passer l'intro (pas le clic de lancement)
            if (phase !== 'mouse') return;
            if (e.target.closest('.hotspot-group')) return;        // laisser le hotspot gérer
            dragging = true; edgeVel = 0; velY = 0;
            dragFromY = lastDragY = e.clientY; dragFromPos = posY;
            lastDragT = e.timeStamp || performance.now();
            try { container.setPointerCapture(e.pointerId); } catch (_) {}
        });

        const endDrag = () => { if (!dragging) return; dragging = false;
            if (!hoverDevice) { pointerInside = false; pxTar = 0; pyTar = 0; } };  // tactile : tout revient au centre
        container.addEventListener('pointerup', endDrag);
        container.addEventListener('pointercancel', endDrag);

        container.addEventListener('wheel', e => {
            if (phase !== 'mouse') return;
            velY += -e.deltaY * CONFIG.molette;                 // impulsion (inertie)
        }, { passive: true });

        _on(document, 'keydown', e => {
            if (e.key === 'Escape') {
                // thTransitioning couvre la fenêtre où la vidéo s'ouvre mais où
                // thPlaying est encore null : sans ce garde, Échap pendant le fondu
                // fermerait TOUT le tableau (la croix, elle, est déjà désactivée).
                if (phase === 'reveal') { if (thPlaying || thTransitioning) thCloseVideo(); else requestCloseReveal(); }
                else skip();
                return;
            }
            if (phase === 'reveal') {            // navigation du triptyque au clavier
                if (rvKind === 'gallery' && revealStage === 'holding') {
                    if (e.key === 'ArrowLeft')  { e.preventDefault(); glGoTo(Math.round(glTargetF) - 1); }
                    if (e.key === 'ArrowRight') { e.preventDefault(); glGoTo(Math.round(glTargetF) + 1); }
                }
                return;
            }
            if (phase !== 'mouse') return;
            if (e.key === 'ArrowDown') velY += -CONFIG.clavier;
            if (e.key === 'ArrowUp')   velY +=  CONFIG.clavier;
        });

        let resizeRAF = null;
        _on(window, 'resize', () => {               // recalcul throttlé
            if (resizeRAF) return;
            resizeRAF = requestAnimationFrame(() => { resizeRAF = null;
                measure(); setSvgPositions(); resizeDust();
                posY = clamp(posY, scrollMin(baseZoom), 0);
                if (reduceMotion) atmoDrawn = false;   // redessiner la poussière statique à la nouvelle taille
                rvOnResize();                          // garder cadre + cartel adaptés à la fenêtre
            });
        });

        // ===============================================================
        //  QUESTION D'INTRODUCTION — jouée avant le travelling (cf.
        //  CONFIG.intro). Le clic sur « Entrer » affiche cet écran plutôt que
        //  de lancer directement loop() ; son bouton Continuer appelle
        //  launchLoop() une fois la séquence terminée (cf. plus bas).
        //  Aucune donnée persistée : rejouée à chaque chargement.
        // ===============================================================
        const IQ = CONFIG.intro;
        let iqBuilt = false;
        // Mémorise le dernier agencement retenu par iqFit (empilé/large), pour
        // appliquer une petite hystérésis et éviter un battement de classe
        // lorsque la fenêtre est redimensionnée pile à la frontière des deux
        // agencements (cf. iqFit).
        let iqWideState = false;
        // Phase de la chorégraphie (mode large uniquement) : tant qu'elle est à
        // false, le groupe de gauche (question + Oui/Non + 3 camemberts) est
        // recentré horizontalement par transform ; elle passe à true juste avant
        // la révélation de « Qui est-il ? », déclenchant le glissement vers la
        // gauche. Sans effet en mode empilé (transform ignoré sur display:contents).
        let iqIdentityShown = false;
        const iqEl = {};

        function iqEnsureDOM() {
            if (iqBuilt) return;
            const T = IQ.timing;

            const overlay = document.createElement('div');
            overlay.className = 'iq-overlay hidden';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', 'Question d’introduction');
            overlay.style.setProperty('--iq-question-dur',      T.questionIn      + 'ms');
            overlay.style.setProperty('--iq-btn-dur',           T.btnDraw         + 'ms');
            overlay.style.setProperty('--iq-btn-continue-dur',  T.btnContinueDraw + 'ms');
            overlay.style.setProperty('--iq-chart-fade-dur',    T.chartFadeBg     + 'ms');
            overlay.style.setProperty('--iq-fadeout-dur',       T.fadeOut         + 'ms');
            overlay.style.setProperty('--iq-epilogue-fade-dur', T.epilogueFadeOut + 'ms');

            // Mise en page : chaque valeur de IQ.layout devient une variable CSS —
            // rien n'est codé en dur dans les règles .iq-* ci-dessous (cf. CONFIG.intro.layout).
            const L = IQ.layout, G = L.gaps;
            const set = (name, val) => overlay.style.setProperty(name, String(val));

            set('--iq-max-width', L.maxWidth);
            set('--iq-pad-v',     L.paddingV + 'vh');
            set('--iq-pad-h',     L.paddingH + 'vw');

            // Espacements verticaux entre sections (nombres de base → * --u)
            set('--iq-gap-title-q',        G.titleToQuestion);
            set('--iq-gap-q-choices',      G.questionToChoices);
            set('--iq-gap-choices-charts', G.choicesToCharts);
            set('--iq-gap-charts-id',      G.chartsToIdentity);
            set('--iq-gap-id-continue',    G.identityToContinue);
            set('--iq-gap-columns',        G.columnsGap);   // mode 2 colonnes (grand écran)

            // Titre + question
            set('--iq-title-size',    L.title.size);
            set('--iq-title-tracking',L.title.tracking + 'em');
            set('--iq-question-size', L.question.size);

            // Boutons
            set('--iq-btn-w',          L.button.width);
            set('--iq-btn-h',          L.button.height);
            set('--iq-btn-gap',        L.button.gap);
            set('--iq-btn-label-size', L.button.labelSize);
            set('--iq-btn-continue-w', L.buttonContinue.width);
            set('--iq-btn-continue-h', L.buttonContinue.height);

            // Camemberts oui/non
            set('--iq-ring-w',           L.chart.ringWidth);   // unités SVG (pas de --u)
            set('--iq-chart-size',       L.chart.size);
            set('--iq-chart-row-gap',    G.chartRowGap);
            set('--iq-chart-stack-gap',  G.chartStackGap);
            set('--iq-chart-label-size', L.chart.labelSize);
            set('--iq-chart-detail-size',L.chart.detailSize);
            set('--iq-chart-meta-size',  L.chart.metaSize);
            set('--iq-chart-meta-line-gap',  G.chartMetaLineGap);
            set('--iq-chart-legend-size',    L.chart.legendSize);
            set('--iq-chart-legend-line-gap',G.chartLegendLineGap);

            // Camembert « Qui est-il ? »
            set('--iq-id-question-size', L.identity.questionSize);
            set('--iq-id-subtitle-size', L.identity.subtitleSize);
            set('--iq-id-size',          L.identity.size);
            set('--iq-id-body-gap',      G.identityChartToLegend);
            set('--iq-id-stack-gap',     G.identityQToBody);
            set('--iq-id-legend-size',   L.identity.legendSize);
            set('--iq-id-legend-row-gap',G.identityLegendRowGap);

            // Témoignage
            set('--iq-quote-label-size',  L.quote.labelSize);
            set('--iq-quote-text-size',   L.quote.textSize);
            set('--iq-quote-credit-size', L.quote.creditSize);
            set('--iq-quote-maxw',        L.quote.maxWidthCh);

            // Mode 2 colonnes (grand écran) — variables DÉDIÉES, lues uniquement
            // par les règles .iq-overlay.iq-wide (cf. CSS). Optionnelles : si
            // L.wide est absent, on n'en pose aucune et le CSS retombe sur la base.
            if (L.wide) {
                const W = L.wide;
                if (W.chartSize      != null) set('--iq-chart-size-wide', W.chartSize);
                if (W.identitySize   != null) set('--iq-id-size-wide',    W.identitySize);
                if (W.columnsGap     != null) set('--iq-gap-columns-wide',W.columnsGap);
                if (W.titleToBand    != null) set('--iq-gap-title-band-wide', W.titleToBand);
                if (W.bandToContinue != null) set('--iq-gap-band-continue-wide', W.bandToContinue);
            }
            // Durée du glissement (mode large) : la transition CSS sur transform doit
            // durer autant que l'attente JS (cf. iqRevealIdentityLayout), d'où une
            // source unique = timing.identitySlide. NB : on écrit sur la variable
            // LOCALE `overlay` (iqEl.overlay n'est renseigné qu'en fin de fonction).
            if (IQ.timing && IQ.timing.identitySlide != null) {
                overlay.style.setProperty('--iq-slide-dur', IQ.timing.identitySlide + 'ms');
            }

            // Recalcule l'échelle sur redimensionnement (rAF-throttlé) et une fois
            // les polices chargées (leur métrique change la hauteur mesurée).
            let _iqFitRAF = 0;
            _on(window, 'resize', () => {
                cancelAnimationFrame(_iqFitRAF);
                _iqFitRAF = requestAnimationFrame(iqFit);
            });
            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(() => { if (introActive) iqFit(); });
            }
            // Un clic n'importe où dans le quiz ne doit jamais fuiter vers le
            // canevas principal (cf. garde introActive sur skip(), plus haut :
            // ceci est une protection supplémentaire, à la même place que les
            // stopPropagation déjà en usage ailleurs sur le site).
            overlay.addEventListener('click', e => e.stopPropagation());

            // Lueur blanche des boutons : même recette que #frameGlow (cadre du
            // tableau), mais définie ICI plutôt que réutilisée, car #frameGlow
            // n'existe qu'une fois un premier tableau ouvert (construit par
            // rvEnsureDOM) — le quiz, lui, joue AVANT tout tableau.
            const glowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            glowSvg.setAttribute('aria-hidden', 'true');
            glowSvg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
            glowSvg.innerHTML = `<defs><filter id="chp3-iqGlow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="a"/>
                <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="a"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter></defs>`;
            container.appendChild(glowSvg);

            const content = document.createElement('div');
            content.className = 'iq-content';

            const title = document.createElement('p');
            title.className = 'iq-title';
            title.textContent = IQ.title;

            const question = document.createElement('p');
            question.className = 'iq-question';
            question.textContent = IQ.question;

            const choices = document.createElement('div');
            choices.className = 'iq-choices';
            const btnOui = iqMakeButton('oui', 'Oui', IQ.layout.button.width, IQ.layout.button.height);
            const btnNon = iqMakeButton('non', 'Non', IQ.layout.button.width, IQ.layout.button.height);
            choices.append(btnOui, btnNon);

            const stats = document.createElement('div');
            stats.className = 'iq-stats';
            const charts = IQ.stats.map(iqMakeChart);
            charts.forEach(c => stats.appendChild(c.el));

            const identity = iqMakeIdentityChart(IQ.identity, IQ.question2, IQ.question2Subtitle);

            // Colonnes gauche/droite : neutres par défaut (`display:contents`,
            // cf. CSS) — n'ont d'effet visuel qu'en mode large (.iq-overlay.iq-wide,
            // décidé par iqFit). En agencement empilé, ce sont exactement les
            // mêmes enfants flex directs de .iq-content qu'avant ce changement.
            const colLeft = document.createElement('div');
            colLeft.className = 'iq-col-left';
            colLeft.append(question, choices, stats);

            const colRight = document.createElement('div');
            colRight.className = 'iq-col-right';
            colRight.append(identity.el);

            const columns = document.createElement('div');
            columns.className = 'iq-columns';
            columns.append(colLeft, colRight);

            const quote = document.createElement('div');
            quote.className = 'iq-quote';
            quote.innerHTML = `
                <p class="iq-quote-label">Témoignage</p>
                <p class="iq-quote-text">« <span class="iq-quote-typed"></span> »</p>
                <span class="iq-quote-credit">${IQ.quoteCredit}</span>`;

            const btnContinue = iqMakeButton(null, 'Continuer', IQ.layout.buttonContinue.width, IQ.layout.buttonContinue.height);
            btnContinue.classList.add('iq-btn-continue');

            content.append(title, columns, quote, btnContinue);
            overlay.appendChild(content);
            container.appendChild(overlay);

            Object.assign(iqEl, {
                overlay, content, title, question, choices, btnOui, btnNon, stats, charts,
                identity,
                columns, colLeft, colRight,   // mode large : chorégraphie du glissement
                quote, quoteTyped: quote.querySelector('.iq-quote-typed'),
                quoteText: quote.querySelector('.iq-quote-text'),
                quoteCredit: quote.querySelector('.iq-quote-credit'),
                btnContinue,
            });
            iqBuilt = true;
        }

        // Bouton oui/non/continuer : gabarit SVG partagé (rectangle à angles
        // légèrement adoucis — pas une pilule, pour coller au reste du site,
        // cf. le cadre du tableau lui-même). pathLength normalisé à 100 →
        // dasharray/dashoffset en pourcentages directs, indépendamment de la
        // taille réelle affichée.
        function iqMakeButton(choice, label, width, height) {
            const w = width, h = height, r = 3;
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'iq-btn';
            if (choice) b.dataset.choice = choice;
            b.setAttribute('aria-label', label);
            b.innerHTML = `
                <svg class="iq-btn-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
                    <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="${r}"
                          pathLength="100" class="iq-btn-outline"/>
                </svg>
                <span class="iq-btn-label">${label}</span>`;
            return b;
        }


        // Calcule position (décalage de départ) et longueur RÉELLEMENT tracée de
        // chaque segment d'un anneau à N parts, avec un écart angulaire (gapPct)
        // à CHAQUE frontière — cœur géométrique commun à tous les camemberts du
        // quiz (oui/non ET « Qui est-il ? ») : aucune duplication de ce calcul
        // entre les deux usages, seules construction SVG et couleurs diffèrent.
        // `pcts` doit sommer à ~100 (le camembert « Qui est-il ? » ajoute lui-même
        // un segment « autres réponses » pour compléter le cercle, cf. plus bas).
        function iqComputeArcs(pcts, gapPct) {
            // Garde-fou : si un segment est plus petit (ou à peine plus grand) que
            // l'écart configuré, il disparaîtrait ENTIÈREMENT (longueur nulle) —
            // déjà rencontré avec les catégories à 3% du camembert « Qui est-il ? ».
            // L'écart effectif ne consomme donc jamais plus de 70% du plus petit
            // segment non-nul, quelle que soit la valeur demandée en CONFIG.
            const smallest = Math.min(...pcts.filter(p => p > 0));
            const effectiveGap = Number.isFinite(smallest) ? Math.min(gapPct, smallest * 0.7) : gapPct;
            let cursor = 0;
            return pcts.map(pct => {
                const start = cursor + effectiveGap / 2;
                const len = Math.max(0, pct - effectiveGap);
                cursor += pct;
                return { start, len };
            });
        }

        // Un camembert en anneau (cercle de rayon R, stroke-width W). Plutôt
        // qu'une ligne de séparation (peu lisible avec le glow), un léger écart
        // angulaire sépare les deux parts (cf. iqComputeArcs) — même principe
        // que les anneaux d'activité watchOS. pathLength normalisé à 100 → tout
        // s'exprime en pourcentages directs. Les pourcentages fournis ne
        // totalisant pas toujours 100 (cf. note CONFIG.intro.stats), le TRACÉ
        // est normalisé indépendamment du texte affiché.
        function iqMakeChart(stat) {
            const R = IQ.layout.chart.radius, GAP = IQ.layout.chart.gapPct;
            const total = (stat.non + stat.oui) || 1;      // garde-fou : jamais de division par zéro
            const nonRender = stat.non / total * 100;
            const ouiRender = stat.oui / total * 100;
            const [nonArc, ouiArc] = iqComputeArcs([nonRender, ouiRender], GAP);
            // Légende empilée, une information par ligne : libellé, sous-titre
            // optionnel (« (ESAA) »), effectifs, âge, puis Non/Oui (cf. .iq-chart-*).
            const respLabel = `${stat.count} réponse${stat.count > 1 ? 's' : ''}`;
            const ageLabel  = stat.ages ? `Âge\u00A0: ${stat.ages}` : '';
            const ariaBits  = [respLabel, stat.ages].filter(Boolean).join(', ');
            const el = document.createElement('div');
            el.className = 'iq-chart';
            el.innerHTML = `
                <svg class="iq-chart-svg" viewBox="0 0 104 104" role="img"
                     aria-label="${stat.label}${stat.detail ? ` (${stat.detail})` : ''} : ${stat.non}\u00A0% ont répondu non, ${stat.oui}\u00A0% oui
                                  (${ariaBits}).">
                    <circle class="iq-chart-bg"  cx="52" cy="52" r="${R}" pathLength="100"/>
                    <circle class="iq-chart-non" cx="52" cy="52" r="${R}" pathLength="100"
                            stroke-dasharray="0 100" stroke-dashoffset="${-nonArc.start}"
                            transform="rotate(-90 52 52)"/>
                    <circle class="iq-chart-oui" cx="52" cy="52" r="${R}" pathLength="100"
                            stroke-dasharray="0 100" stroke-dashoffset="${-ouiArc.start}"
                            transform="rotate(-90 52 52)"/>
                </svg>
                <div class="iq-chart-label"></div>
                ${stat.detail ? `<div class="iq-chart-detail">(${stat.detail})</div>` : ''}
                <div class="iq-chart-meta">
                    <div class="iq-chart-meta-line">${respLabel}</div>
                    ${ageLabel ? `<div class="iq-chart-meta-line">${ageLabel}</div>` : ''}
                </div>
                <div class="iq-chart-legend">
                    <span class="non">Non ${stat.non}%</span><span class="oui">Oui ${stat.oui}%</span>
                </div>`;
            el.querySelector('.iq-chart-label').textContent = stat.label;
            return {
                el, nonLen: nonArc.len, ouiLen: ouiArc.len,
                nonCircle: el.querySelector('.iq-chart-non'),
                ouiCircle: el.querySelector('.iq-chart-oui'),
                legNon: el.querySelector('.iq-chart-legend .non'),
                legOui: el.querySelector('.iq-chart-legend .oui'),
            };
        }

        // Anime la longueur visible d'un arc de 0 à `pct` (rAF + easeOutCubic —
        // même technique que rvDrawTrace/glDrawTrace : le dasharray d'un arc ne
        // s'interpole pas de façon fiable via une transition CSS, contrairement
        // à un simple dashoffset ; on le recalcule donc nous-mêmes à chaque frame).
        function iqDrawArc(circleEl, pct, dur) {
            return new Promise(resolve => {
                if (reduceMotion || pct <= 0 || dur <= 0) {
                    circleEl.style.strokeDasharray = `${pct} ${100 - pct}`;
                    resolve(); return;
                }
                const t0 = performance.now();
                const step = now => {
                    const k = easeOutCubic(Math.min((now - t0) / dur, 1));
                    const len = pct * k;
                    circleEl.style.strokeDasharray = `${len.toFixed(2)} ${(100 - len).toFixed(2)}`;
                    if (k < 1) requestAnimationFrame(step); else resolve();
                };
                requestAnimationFrame(step);
            });
        }

        // Révèle un camembert : conteneur (label + piste de fond) en fondu, puis
        // tracé de l'arc « non » suivi de l'arc « oui » — un seul balayage continu,
        // dont la vitesse angulaire reste constante (durée proportionnelle à la part
        // de chaque arc dans le tracé).
        async function iqRevealChart(chart) {
            const T = IQ.timing;
            chart.el.classList.add('show');
            await rvWait(T.chartFadeBg);
            const total = (chart.nonLen + chart.ouiLen) || 1;
            await iqDrawArc(chart.nonCircle, chart.nonLen, T.chartDraw * (chart.nonLen / total));
            await iqDrawArc(chart.ouiCircle, chart.ouiLen, T.chartDraw * (chart.ouiLen / total));
        }

        // Attribue la couleur dorée au segment correspondant à LA RÉPONSE DE
        // L'UTILISATEUR (identique sur les 3 anneaux), l'autre restant neutre —
        // et met à jour la légende en conséquence.
        function iqApplyChoiceColors(choice) {
            iqEl.charts.forEach(chart => {
                const chosenCircle = choice === 'oui' ? chart.ouiCircle : chart.nonCircle;
                const otherCircle  = choice === 'oui' ? chart.nonCircle : chart.ouiCircle;
                chosenCircle.classList.add('iq-chart-seg-chosen');
                otherCircle.classList.add('iq-chart-seg-other');
                const chosenLeg = choice === 'oui' ? chart.legOui : chart.legNon;
                const otherLeg  = choice === 'oui' ? chart.legNon : chart.legOui;
                chosenLeg.classList.add('iq-leg-chosen');
                otherLeg.classList.add('iq-leg-other');
            });
        }

        // Palette du camembert « Qui est-il ? », dans l'ordre décroissant des
        // catégories fournies (du plus affirmé, or vif, au plus discret).
        const IQ_IDENTITY_PALETTE = ['var(--gilt-bright)', 'var(--gilt)', 'var(--ivory)',
                                      'var(--ivory-faint)', 'rgba(243,238,228,.5)'];

        // Camembert à N catégories nommées, TRACÉ sur l'intégralité du cercle
        // (cf. note CONFIG.intro.identity : les valeurs fournies ne totalisent que
        // 60 % — chaque part est donc rendue proportionnellement aux 5 autres,
        // pas selon sa valeur brute ; la légende, elle, affiche les valeurs exactes).
        // Réutilise iqComputeArcs — même moteur géométrique que les camemberts
        // oui/non — avec des couleurs FIXES (pas de logique de choix utilisateur ici).
        function iqMakeIdentityChart(data, questionText, subtitleText) {
            const R = IQ.layout.chart.radius, GAP = IQ.layout.chart.gapPct;
            const rawTotal = data.segments.reduce((s, x) => s + x.pct, 0) || 1;
            const renderPct = data.segments.map(s => s.pct / rawTotal * 100);
            const arcs = iqComputeArcs(renderPct, GAP);
            const colors = IQ_IDENTITY_PALETTE.slice(0, data.segments.length);
            // Sous-titre optionnel (ex. « Réponse des adultes ») : omis du DOM s'il
            // n'est pas fourni, pour ne pas laisser un <p> vide consommer un gap.
            const subtitleHTML = subtitleText ? `<p class="iq-identity-subtitle">(${subtitleText})</p>` : '';

            const el = document.createElement('div');
            el.className = 'iq-identity';
            el.innerHTML = `
                <p class="iq-identity-q"></p>
                ${subtitleHTML}
                <div class="iq-identity-body">
                    <svg class="iq-identity-svg" viewBox="0 0 104 104" role="img"
                         aria-label="${questionText}${subtitleText ? ` (${subtitleText})` : ''} ${data.segments.map(s => `${s.label} : ${s.pct}%`).join(', ')}.">
                        <circle class="iq-chart-bg" cx="52" cy="52" r="${R}" pathLength="100"/>
                        ${data.segments.map((s, i) => `
                            <circle class="iq-id-seg" cx="52" cy="52" r="${R}" pathLength="100"
                                    style="stroke:${colors[i]};stroke-width:var(--iq-ring-w,12);fill:none;filter:url(#chp3-iqGlow);"
                                    stroke-dasharray="0 100" stroke-dashoffset="${-arcs[i].start}"
                                    transform="rotate(-90 52 52)"/>`).join('')}
                    </svg>
                    <div class="iq-identity-legend">
                        ${data.segments.map((s, i) => `
                            <div class="iq-identity-row">
                                <span class="iq-identity-swatch" style="background:${colors[i]};color:${colors[i]};"></span>
                                <span class="iq-identity-pct">${s.pct}%</span>
                                <span>${s.label}</span>
                            </div>`).join('')}
                    </div>
                </div>`;
            el.querySelector('.iq-identity-q').textContent = questionText;
            return {
                el, arcs, segCircles: el.querySelectorAll('.iq-id-seg'),
                q: el.querySelector('.iq-identity-q'),
                subtitle: el.querySelector('.iq-identity-subtitle'),   // null si absent
                body: el.querySelector('.iq-identity-body'),
            };
        }

        // Révèle le camembert « Qui est-il ? » : conteneur en fondu, puis tracé
        // séquentiel de chaque catégorie (ordre décroissant fourni), le segment
        // « autres » complétant le cercle en dernier — durée de chaque tronçon
        // proportionnelle à sa part, même principe que iqRevealChart.
        // Révèle « Qui est-il ? » en deux temps bien distincts : la question
        // apparaît seule (fondu + montée, même traitement que la question
        // d'ouverture) et TIENT un instant — le temps d'arrêt voulu, pour que
        // le visiteur se pose vraiment la question — avant que le corps
        // (camembert + légende) ne se dévoile et commence son tracé séquentiel.
        async function iqRevealIdentityChart(identity) {
            const T = IQ.timing;
            identity.q.classList.add('show');
            if (identity.subtitle) identity.subtitle.classList.add('show');
            await rvWait(reduceMotion ? 0 : T.toIdentityBody);

            identity.body.classList.add('show');
            await rvWait(T.chartFadeBg);
            const total = identity.arcs.reduce((s, a) => s + a.len, 0) || 1;
            for (let i = 0; i < identity.segCircles.length; i++) {
                await iqDrawArc(identity.segCircles[i], identity.arcs[i].len,
                                 T.identityDraw * (identity.arcs[i].len / total));
            }
        }

        // Tracé d'un bouton (CSS : simple dashoffset 100→0, cf. .iq-btn-outline).
        function iqDrawButton(btnEl, dur) {
            return new Promise(resolve => {
                btnEl.classList.add('drawn');
                if (reduceMotion) resolve(); else setTimeout(resolve, dur);
            });
        }

        // Machine à écrire, caractère par caractère (curseur clignotant en CSS).
        function iqTypewriter(el, text, speed) {
            return new Promise(resolve => {
                el.parentElement.classList.add('typing');
                if (reduceMotion || speed <= 0) {
                    el.textContent = text; el.parentElement.classList.remove('typing'); resolve(); return;
                }
                let i = 0;
                const step = () => {
                    i++; el.textContent = text.slice(0, i);
                    if (i < text.length) setTimeout(step, speed);
                    else { el.parentElement.classList.remove('typing'); resolve(); }
                };
                step();
            });
        }

        function iqAwaitChoice() {
            return new Promise(resolve => {
                const onClick = e => {
                    iqEl.btnOui.removeEventListener('click', onClick);
                    iqEl.btnNon.removeEventListener('click', onClick);
                    resolve(e.currentTarget.dataset.choice);
                };
                iqEl.btnOui.addEventListener('click', onClick);
                iqEl.btnNon.addEventListener('click', onClick);
            });
        }

        // Décide de l'agencement (empilé vs 2 colonnes, cf. .iq-overlay.iq-wide)
        // à partir du SEUL critère retenu : la proportion de la fenêtre.
        //   → 2 colonnes dès que  largeur / hauteur ≥ CONFIG…scale.wideRatio.
        // Une hystérésis symétrique (±3 %) autour du seuil empêche le clignotement
        // de la mise en page quand on redimensionne pile à la frontière : une fois
        // en 2 colonnes on y reste jusqu'à un ratio nettement plus bas, et
        // inversement. Seul effet de bord : (re)positionner `.iq-wide` sur
        // `overlay` et mettre à jour `iqWideState` (mémoire pour l'hystérésis).
        // NB : le ratio se calcule sur la fenêtre (innerWidth/innerHeight), pas sur
        // l'aire utile après padding — les paddings sont en vw/vh (proportionnels),
        // donc le ratio utile est ~identique, et inner*/ est plus simple et stable.
        function iqChooseLayout() {
            const overlay = iqEl.overlay;
            const ratio = window.innerWidth / window.innerHeight;
            const threshold = IQ.layout.scale.wideRatio;
            const HYSTERESIS = 0.03;                    // ±3 % autour du seuil
            const wide = iqWideState
                ? (ratio >= threshold * (1 - HYSTERESIS))   // déjà large : n'en sort qu'en dessous de la marge basse
                : (ratio >= threshold * (1 + HYSTERESIS));  // déjà empilé : ne bascule qu'au-dessus de la marge haute
            iqWideState = wide;
            overlay.classList.toggle('iq-wide', wide);
        }

        // Orchestration complète de la séquence. Remplace l'appel direct à
        // launchLoop() sur le clic « Entrer » (cf. section Démarrage, plus bas) ;
        // c'est ELLE qui appelle launchLoop() une fois le bouton Continuer cliqué.
        // ── MISE À L'ÉCHELLE : le bloc entier tient TOUJOURS dans la fenêtre,
        //    à proportions constantes (desktop). Sous scale.mobileBreakpoint, on
        //    bascule en mode téléphone : reflow + défilement vertical autorisé.
        //    Méthode : mesurer la taille NATURELLE (à --iq-scale = 1), puis
        //    appliquer un facteur unique = min(ajust. largeur, ajust. hauteur),
        //    borné par [scale.min, scale.max]. Les deux axes étant mis à l'échelle
        //    ensemble, l'approximation linéaire est fidèle ; une passe corrective
        //    garantit l'absence de débordement même si le texte se ré-enroule.
        //    L'agencement (empilé/2 colonnes) est décidé juste avant par
        //    iqChooseLayout, cf. ci-dessus.
        function iqFit() {
            if (!iqBuilt) return;
            const overlay = iqEl.overlay, content = iqEl.content;
            if (overlay.classList.contains('hidden')) return;   // masqué : rien à mesurer
            const S = IQ.layout.scale;

            const mobile = window.innerWidth < S.mobileBreakpoint;
            overlay.classList.toggle('iq-mobile', mobile);

            // Aire utile = fenêtre moins les marges de sécurité (padding vw/vh).
            const cs = getComputedStyle(overlay);
            const availW = overlay.clientWidth  - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
            const availH = overlay.clientHeight - parseFloat(cs.paddingTop)  - parseFloat(cs.paddingBottom);
            if (availW <= 0 || availH <= 0) return;

            // Mesure toujours à échelle 1 (référence) avant tout calcul.
            overlay.style.setProperty('--iq-scale', '1');

            // Agencement : empilé sur mobile, sinon décidé par le ratio de la
            // fenêtre (cf. iqChooseLayout). Toujours choisi AVANT la mesure
            // naturelle ci-dessous, pour que natW/natH reflètent l'agencement final.
            if (mobile) {
                overlay.classList.remove('iq-wide');
                iqWideState = false;
            } else {
                iqChooseLayout();
            }

            // Taille naturelle de l'agencement FINALEMENT retenu ci-dessus.
            const natW = content.scrollWidth, natH = content.scrollHeight;
            if (!natW || !natH) return;

            // Téléphone : on n'ajuste que sur la largeur (le vertical défile).
            // Mode large : agrandissement autorisé jusqu'à scale.wideMax (plus haut
            // que scale.max) pour mieux remplir l'écran, toujours borné par la
            // fenêtre (donc jamais de scrollbar).
            const maxScale = (iqWideState && S.wideMax) ? S.wideMax : S.max;
            let scale = mobile ? (availW / natW) : Math.min(availW / natW, availH / natH);
            scale = Math.max(S.min, Math.min(scale * S.fitSafety, maxScale));
            overlay.style.setProperty('--iq-scale', scale.toFixed(4));

            // Passe corrective (desktop) : si un débordement subsiste, on resserre.
            if (!mobile && (content.scrollHeight > availH + 0.5 || content.scrollWidth > availW + 0.5)) {
                const corr = Math.min(availH / content.scrollHeight, availW / content.scrollWidth);
                scale = Math.max(S.min, scale * corr * 0.997);
                overlay.style.setProperty('--iq-scale', scale.toFixed(4));
            }

            // Chorégraphie (mode large) : recentre le groupe de gauche tant que
            // « Qui est-il ? » n'est pas révélé. Fait EN DERNIER, car le décalage
            // dépend des largeurs finales rendues (donc de l'échelle définitive).
            iqPositionLeftGroup();
        }

        // Recentre horizontalement le groupe de gauche pendant l'intro (mode large),
        // ou le remet à sa place de colonne une fois « Qui est-il ? » révélé.
        // Démonstration du décalage : le conteneur .iq-columns centre le couple
        // [gauche | gap | droite] (justify-content:center). Le centre naturel de la
        // colonne gauche est donc à  centreViewport − (gap + largeurDroite)/2. Pour
        // l'amener au centre du viewport, on la translate de  +(gap + largeurDroite)/2.
        // Mesuré en pixels rendus (offsetWidth/columnGap incluent déjà --u), donc
        // recalculé correctement à chaque resize. Sans transition ici : le glissement
        // animé est piloté séparément par la classe .iq-anim-slide (cf. iqRevealIdentityLayout).
        function iqPositionLeftGroup() {
            const left = iqEl.colLeft;
            if (!left) return;
            if (iqWideState && !iqIdentityShown) {
                const gap = parseFloat(getComputedStyle(iqEl.columns).columnGap) || 0;
                const deltaX = (iqEl.colRight.offsetWidth + gap) / 2;
                left.style.transform = `translateX(${deltaX.toFixed(1)}px)`;
            } else {
                left.style.transform = 'translateX(0px)';
            }
        }

        // Déclenche le passage intro → 2 colonnes : le groupe de gauche glisse de
        // sa position centrée vers sa colonne de gauche (transform animé, GPU),
        // sans reflow ni changement d'échelle (la colonne droite occupait déjà sa
        // place, invisible). Résout quand le glissement est terminé.
        async function iqRevealIdentityLayout() {
            if (!iqWideState) { iqIdentityShown = true; return; } // empilé : rien à glisser
            const overlay = iqEl.overlay, left = iqEl.colLeft;
            const dur = (IQ.timing && IQ.timing.identitySlide) || 700;
            if (reduceMotion) {                       // accessibilité : bascule instantanée
                iqIdentityShown = true;
                iqPositionLeftGroup();
                return;
            }
            overlay.classList.add('iq-anim-slide');   // active la transition CSS sur transform
            void left.offsetWidth;                    // commit de l'état courant avant d'animer
            iqIdentityShown = true;
            iqPositionLeftGroup();                    // transform → translateX(0) : glisse
            await rvWait(dur);
            overlay.classList.remove('iq-anim-slide');
        }

        async function iqShow() {
            iqEnsureDOM();
            introActive = true;
            iqIdentityShown = false;                  // chorégraphie : on repart en phase « intro »
            iqEl.overlay.classList.remove('iq-anim-slide');
            const T = IQ.timing;
            iqEl.overlay.classList.remove('hidden');
            iqFit();   // calcule --iq-scale + recentre le groupe de gauche (mode large)

            // SPA : l'overlay du questionnaire est monté, visible et OPAQUE
            // (fond var(--ink)) — il masque donc entièrement le travelling.
            // On signale à Chapitre3Scene qu'elle peut lever son rideau noir.
            // Émis à CHAQUE iqShow() ; la scène n'écoute qu'une fois (once).
            try { window.dispatchEvent(new CustomEvent('chp3:intro-ready')); } catch (_) {}

            await rvWait(reduceMotion ? 0 : 250);           // un souffle sur l'écran noir avant la question
            iqEl.title.classList.add('show');
            iqEl.question.classList.add('show');
            await rvWait(T.questionIn + T.toChoices);

            const btnOuiP = iqDrawButton(iqEl.btnOui, T.btnDraw);
            await rvWait(reduceMotion ? 0 : T.btnStagger);
            const btnNonP = iqDrawButton(iqEl.btnNon, T.btnDraw);
            await Promise.all([btnOuiP, btnNonP]);

            const choice = await iqAwaitChoice();
            iqEl.btnOui.disabled = true; iqEl.btnNon.disabled = true;
            (choice === 'oui' ? iqEl.btnOui : iqEl.btnNon).classList.add('selected');
            iqApplyChoiceColors(choice);

            await rvWait(T.toCharts);
            for (let i = 0; i < iqEl.charts.length; i++) {
                if (i > 0) await rvWait(T.chartStagger);
                await iqRevealChart(iqEl.charts[i]);
            }

            await rvWait(T.toIdentity);
            await iqRevealIdentityLayout();          // mode large : glisse le groupe de gauche
            await iqRevealIdentityChart(iqEl.identity);

            await rvWait(T.toContinue);
            iqEl.btnContinue.classList.add('show');
            await iqDrawButton(iqEl.btnContinue, T.btnContinueDraw);

            await new Promise(resolve => iqEl.btnContinue.addEventListener('click', resolve, { once: true }));

            await iqRunEpilogue();
        }

        // Séquence finale, déclenchée par le clic sur Continuer : le quiz entier
        // s'efface (écran noir nu), PUIS le témoignage apparaît seul en machine à
        // écrire, tient quelques secondes, s'efface à son tour — et SEULEMENT
        // ALORS le travelling démarre. introActive ne retombe qu'à la toute fin :
        // aucune fenêtre, même dans cette séquence à tiroirs, où skip() pourrait
        // mal interpréter la phase (cf. garde sur introActive, plus haut).
        async function iqRunEpilogue() {
            const T = IQ.timing;

            // 1) Tout le quiz s'efface d'un coup (pas seulement le bouton) → écran noir nu.
            iqEl.content.style.transition = `opacity ${reduceMotion ? 0 : T.contentFadeOut}ms ease`;
            iqEl.content.style.opacity = '0';
            await rvWait(reduceMotion ? 0 : T.contentFadeOut);

            // 2) On masque tout sauf la citation, réinitialisée à l'état vierge
            //    (elle n'a jamais été montrée jusqu'ici : c'est son premier passage).
            [iqEl.title, iqEl.question, iqEl.choices, iqEl.stats, iqEl.identity.el, iqEl.btnContinue]
                .forEach(el => { el.style.display = 'none'; });
            iqEl.quote.classList.remove('show');
            iqEl.quoteCredit.classList.remove('show');
            iqEl.quoteTyped.textContent = '';

            // 3) Le contenu (désormais réduit à la citation) refait surface, seul sur l'écran noir.
            //    display remis AVANT le fondu (et sur un temps distinct, cf. rvWait) : partir
            //    directement de display:none vers opacity:1 ne s'animerait pas.
            // ⚠️ Bug corrigé ici : `style.display = ''` ne supprime qu'une éventuelle
            // surcharge INLINE — il ne neutralise PAS la règle CSS de classe
            // `.iq-quote{ display:none }` (cf. plus haut), qui continue de s'appliquer
            // telle quelle. Le témoignage restait donc invisible en permanence.
            // Il faut une valeur explicite qui l'emporte réellement sur la classe.
            iqEl.quote.style.display = 'block';
            iqEl.content.style.opacity = '1';
            await rvWait(T.toEpilogueQuote);
            iqEl.quote.classList.add('show');
            await iqTypewriter(iqEl.quoteTyped, IQ.quote, reduceMotion ? 0 : T.typeSpeed);
            iqEl.quoteCredit.classList.add('show');

            // 4) Tenue, puis extinction de la citation seule (retour à l'écran nu).
            await rvWait(T.epilogueHold);
            iqEl.quote.classList.remove('show');
            await rvWait(reduceMotion ? 0 : T.epilogueFadeOut);

            // 5) Un dernier souffle sur le noir, puis fondu général → lancement du travelling
            //    (même geste que l'ancien clic direct sur « Entrer »).
            await rvWait(T.toTravelling);
            iqEl.overlay.style.pointerEvents = 'none';
            iqEl.overlay.style.opacity = '0';
            introActive = false;
            launchLoop();
            setTimeout(() => iqEl.overlay.classList.add('hidden'), reduceMotion ? 0 : T.fadeOut);
        }

        // ── Démarrage ─────────────────────────────────────────────────
        measure(); setSvgPositions(); initDust();

        if (reduceMotion) {
            phase = 'mouse'; posY = 0; velY = 0; zoomCam = baseZoom;
            img.style.opacity = '1'; revealTitle();
            circles.forEach(c => { c.started = c.done = c.visible = true;
                c.ring.style.strokeDashoffset = '0'; c.num.style.opacity = '1';
                c.g.setAttribute('opacity', '1'); });
        } else {
            zoomCam = baseZoom * CONFIG.zoomDepart;
            posY = winH() - imgCH * zoomCam;
        }
        applyScene();

        // Lance la question d'introduction dès l'écran d'entrée cliqué (ou
        // immédiatement s'il est absent) ; c'est ELLE qui lance ensuite loop().
        function launchLoop() { if (_arrowShow) _arrowShow(); (_loopRaf = requestAnimationFrame(loop)); }
        // Lancement piloté par Chapitre3Scene → startChapitre3().
        // init() n'est plus qu'un SETUP : il ne lance plus l'intro tout seul.
        _doLaunch = () => { if (_launched) return; _launched = true; iqShow(); };

        if (CONFIG.grain && !reduceMotion) initGrain(); else $('chp3-grain').style.display = 'none';

        // ===============================================================
        //  SON AMBIANT — paramètres dans CONFIG.ambiance (ci-dessus)
        // ===============================================================
        const AMBIANCE = CONFIG.ambiance;

        // — Objet audio ambiant (null si reduceMotion) —
        const ambAudio = reduceMotion ? null : (() => {
            const a = new Audio();
            a.loop = false; a.volume = 0;
            // Sur mobile on ne précharge pas tout d'office ; la lecture (déclenchée au
            // clic d'entrée) suffit à streamer le fichier compressé (~1 Mo).
            a.preload = lightDevice ? 'metadata' : 'auto';
            a.src = AMBIANCE.src;
            // Filet de sécurité : si le format compressé est introuvable, on retombe
            // sur le WAV original. Aucune régression possible.
            a.addEventListener('error', () => {
                if (AMBIANCE.fallback && !a.src.endsWith(AMBIANCE.fallback)) {
                    a.src = AMBIANCE.fallback;
                    a.load();
                }
            }, { once: true });
            return a;
        })();
        // ── AMBIANCE (musique principale) ────────────────────────────────
        // Machine à états explicite. `ambDesired` = ce que le son DOIT faire
        // ('on' sur la page d'accueil, 'off' pendant qu'un reveal est ouvert) ;
        // il est la SEULE source de vérité. Toute la logique (reprise, boucle,
        // fondus) s'y réfère, jamais à l'état instantané `ambAudio.paused` —
        // qui, lu au milieu d'une transition async, ment (bug historique : la
        // musique ne revenait pas après fermeture de la branche 3, la re-boucle
        // async faisant croire à tort que le son jouait encore).
        let ambRamp = null, ambLoopTarget = AMBIANCE.volume, ambStarted = false;
        let ambDesired = 'off';   // 'on' | 'off' — intention courante

        function ambVolTo(target, dur, onDone) {
            if (!ambAudio) return;
            if (ambRamp) cancelAnimationFrame(ambRamp);
            const from = ambAudio.volume; let t0 = null;
            const step = now => {
                if (t0 === null) t0 = now;
                const k = Math.min((now - t0) / Math.max(dur, 1), 1);
                ambAudio.volume = clamp(from + (target - from) * k, 0, 1);
                if (k < 1) { ambRamp = requestAnimationFrame(step); }
                else       { ambRamp = null; if (onDone) onDone(); }
            };
            ambRamp = requestAnimationFrame(step);
        }

        // Boucle manuelle avec fondu enchaîné. Le handler est (ré)armé à CHAQUE
        // début de lecture — jamais consommé une seule fois pour toujours — et
        // vérifie `ambDesired` avant de reboucler : si un reveal s'est ouvert
        // entre-temps, on ne relance rien (la reprise se fera via ambSetDesired).
        function ambArmLoop() {
            if (!ambAudio) return;
            ambAudio.ontimeupdate = () => {
                if (!ambAudio.duration || ambAudio.duration - ambAudio.currentTime > AMBIANCE.loopFadeOut / 1000) return;
                ambAudio.ontimeupdate = null;                 // désarme : une seule bascule par fin de piste
                if (ambDesired !== 'on') return;              // reveal ouvert entre-temps → on laisse mourir la piste
                ambVolTo(0, AMBIANCE.loopFadeOut, () => {
                    if (ambDesired !== 'on') { try { ambAudio.pause(); } catch (_) {} return; }
                    ambAudio.currentTime = 0;
                    ambAudio.play().then(() => {
                        ambArmLoop();                          // ré-arme pour la boucle SUIVANTE
                        ambVolTo(ambLoopTarget, AMBIANCE.loopFadeIn);
                    }).catch(() => {});
                });
            };
        }

        function ambStart() {
            if (!ambAudio || ambStarted) return;
            ambStarted = true; ambDesired = 'on'; ambLoopTarget = AMBIANCE.volume;
            ambAudio.play().then(() => {
                ambArmLoop();
                ambVolTo(AMBIANCE.volume, AMBIANCE.fadeIn);
            }).catch(() => { ambStarted = false; });
        }

        // Point d'entrée UNIQUE pour piloter l'ambiance depuis l'extérieur.
        // Idempotent : appeler ambSetDesired('on') alors qu'elle joue déjà ne
        // relance rien d'anormal ; l'appeler après une coupure la fait repartir
        // proprement (lecture + ré-armement de la boucle), sans jamais dépendre
        // de .paused.
        function ambSetDesired(state) {
            if (!ambAudio || !ambStarted) return;             // avant le tout premier ambStart : rien à piloter
            ambDesired = state;
            if (state === 'off') {
                ambLoopTarget = 0;
                ambVolTo(0, AMBIANCE.mediaFadeOut, () => {
                    if (ambDesired === 'off') { try { ambAudio.pause(); } catch (_) {} }
                });
            } else {
                ambLoopTarget = AMBIANCE.volume;
                const resume = () => { ambArmLoop(); ambVolTo(AMBIANCE.volume, AMBIANCE.mediaFadeIn); };
                // On relance TOUJOURS play() : s'il joue déjà, la promesse résout
                // immédiatement sans effet de bord ; s'il est en pause, il repart.
                ambAudio.play().then(resume).catch(() => {});
            }
        }

        // Le son démarre dès la première frame de la boucle (voir loop() → ambStart()).

        // ===============================================================
        //  THÈME DE TABLEAU — son atmosphérique propre à un cercle (cf.
        //  CONFIG.theme et reveal.theme dans CONFIG.cercles). Canal audio
        //  dédié (`themeAudio`), distinct de rvMedia (son propre au média
        //  affiché) et d'ambAudio (ambiance de la page d'accueil) : aucun des
        //  trois ne peut jamais en écraser un autre.
        //
        //  Cycle de vie :
        //   - themePlay(cfg)  : appelé par startReveal — fondu d'entrée sur le
        //     thème du cercle ouvert (ou silence si ce cercle n'en définit pas)
        //   - themeDuck(bool) : appelé quand un média concurrent démarre/s'arrête
        //     (vidéo de la galerie, vidéo d'un hotspot théâtre) — coupe complètement
        //     le thème le temps de cette lecture (fondu à 0 + pause), puis le reprend
        //   - themeStop()     : fondu de sortie — appelé par requestCloseReveal
        // ===============================================================
        const THEME = CONFIG.theme;
        let themeAudio = null, themeTarget = 0;

        // Fondu de volume générique, réservé à ce module (cf. note sur la
        // duplication ambVolTo / rvVolumeTo / thFadeVolume en fin de fichier).
        // Un WeakMap retient la rampe en cours par élément : un nouvel appel
        // sur le même élément annule proprement le précédent, sans variable
        // de rampe dédiée à gérer par l'appelant.
        const themeRamps = new WeakMap();
        function themeFadeVolume(el, target, dur, onDone) {
            if (!el) return;
            const prev = themeRamps.get(el);
            if (prev) cancelAnimationFrame(prev);
            const from = el.volume; let t0 = null;
            const step = now => {
                if (t0 === null) t0 = now;
                const k = Math.min((now - t0) / Math.max(dur, 1), 1);
                el.volume = clamp(from + (target - from) * k, 0, 1);
                if (k < 1) { themeRamps.set(el, requestAnimationFrame(step)); }
                else       { themeRamps.delete(el); if (onDone) onDone(); }
            };
            themeRamps.set(el, requestAnimationFrame(step));
        }

        function themeEnsure() {
            if (themeAudio || reduceMotion) return;
            themeAudio = new Audio();
            themeAudio.loop = true; themeAudio.preload = 'auto'; themeAudio.volume = 0;
        }

        // Lance (ou éteint, si cfg est absent) le thème du cercle qui vient de
        // s'ouvrir. Toujours appelé — y compris pour les cercles sans thème —
        // afin de couper proprement un thème hérité d'un cercle précédent.
        function themePlay(cfg) {
            themeStop(true);
            if (!cfg || !cfg.src || reduceMotion) return;
            themeEnsure();
            if (!themeAudio) return;
            themeTarget = clamp(cfg.volume ?? THEME.volumeDefaut, 0, 1);
            if (!themeAudio.src.endsWith(cfg.src)) themeAudio.src = cfg.src;
            themeAudio.currentTime = 0; themeAudio.volume = 0;
            themeAudio.play().catch(() => {});      // échec silencieux : jamais de son est acceptable
            themeFadeVolume(themeAudio, themeTarget, THEME.fadeIn);
        }

        // down=true : un média concurrent démarre son propre son → coupure
        // complète et réelle du thème (fondu à 0 puis pause, pas une simple
        // atténuation : il ne doit plus être audible pendant la lecture).
        // down=false : ce média s'arrête → reprise de la lecture, fondu vers
        // le volume nominal.
        function themeDuck(down) {
            if (!themeAudio) return;
            if (down) {
                themeFadeVolume(themeAudio, 0, THEME.duckDuree, () => { try { themeAudio.pause(); } catch (_) {} });
            } else {
                if (themeAudio.paused) themeAudio.play().catch(() => {});
                themeFadeVolume(themeAudio, themeTarget, THEME.duckDuree);
            }
        }

        // instant=true : coupe net (repli de sécurité, cf. rvFinishClose) ;
        // sinon fondu de sortie (cf. requestCloseReveal).
        function themeStop(instant) {
            if (!themeAudio) return;
            if (instant) {
                const r = themeRamps.get(themeAudio);        // annule toute rampe en vol : sinon elle
                if (r) { cancelAnimationFrame(r); themeRamps.delete(themeAudio); }  // réécrirait le volume après coup
                try { themeAudio.pause(); } catch (_) {} themeAudio.volume = 0; return;
            }
            themeFadeVolume(themeAudio, 0, THEME.fadeOut, () => { try { themeAudio.pause(); } catch (_) {} });
        }

        // ===============================================================
        //  ATMOSPHÈRE : bokeh + rayons (additif sous le noir de la torche)
        // ===============================================================
        function resizeDust() {
            if (!dctx) return;
            // Canvas plein écran redessiné chaque frame : la résolution de rendu est
            // souvent LE goulot mobile. On plafonne le DPR plus bas sur appareil léger.
            const dpr = Math.min(window.devicePixelRatio || 1, lightDevice ? 1.5 : 2);
            dustCv.width  = innerWidth  * dpr;
            dustCv.height = innerHeight * dpr;
            dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function initDust() {
            // MOBILE : on supprime entièrement l'atmosphère (faisceaux + particules).
            // C'est le poste de calcul le plus lourd (canvas plein écran effacé/redessiné
            // chaque frame + flou des rayons). On ne crée rien et on retire le canvas de
            // la composition. dctx reste null → resizeDust/drawDust deviennent inertes.
            if (mobileLite) { const c = $('chp3-dust'); if (c) c.style.display = 'none'; return; }
            dustCv = $('chp3-dust'); dctx = dustCv.getContext('2d'); resizeDust();

            // Sprite de bokeh pré-rendu UNE seule fois : on remplace 95 createRadialGradient
            // par frame par un simple drawImage mis à l'échelle (visuellement identique,
            // bien moins coûteux). L'alpha global module l'intensité par particule.
            const SPR = 64;
            bokehSprite = document.createElement('canvas');
            bokehSprite.width = bokehSprite.height = SPR;
            const bg = bokehSprite.getContext('2d');
            const bgr = bg.createRadialGradient(SPR/2, SPR/2, 0, SPR/2, SPR/2, SPR/2);
            bgr.addColorStop(0,    'rgba(255,244,214,1)');
            bgr.addColorStop(0.45, 'rgba(255,232,190,0.5)');
            bgr.addColorStop(1,    'rgba(255,232,190,0)');
            bg.fillStyle = bgr;
            bg.fillRect(0, 0, SPR, SPR);

            const B = CONFIG.bokeh;
            const n = reduceMotion ? Math.min(B.nombre, 34)
                    : lightDevice  ? Math.min(B.nombre, 50)
                    : B.nombre;
            motes = Array.from({ length:n }, () => {
                const big = Math.random() < B.partGros;
                const r   = big ? 5 + Math.random()*(B.tailleMax-5) : 0.6 + Math.random()*2.4;
                const a   = big ? 0.10 + Math.random()*0.14 : 0.26 + Math.random()*0.34;
                return { x:Math.random()*innerWidth, y:Math.random()*innerHeight, r, a, big,
                         vy:-(0.18 + Math.random()*B.vitesse),
                         sx:B.balance*(0.4 + Math.random()*0.6),
                         sp:Math.random()*Math.PI*2, ss:0.15 + Math.random()*0.4,
                         tw:Math.random()*Math.PI*2, ts:0.5 + Math.random()*1.7 };
            });

            const R = CONFIG.rayons;
            beams = R.actif ? Array.from({ length:R.nombre }, (_, i) => ({
                frac: R.nombre > 1 ? (i/(R.nombre-1) - 0.5) : 0,
                a:   R.intensite * (0.7 + Math.random()*0.6),
                w:    0.014 + Math.random()*0.046,                     // largeur variée : fins ↔ larges
                lenF: 0.75 + Math.random()*0.65,                       // longueur variée (× longueur de base)
                aoff: (Math.random()-0.5) * R.desordre * Math.PI/180,  // décalage d'orientation aléatoire (figé)
                ph:  Math.random()*Math.PI*2,
                sw:  R.vitesseBalance * (0.6 + Math.random()*0.8),       // vitesse d'oscillation (variée par rayon)
                amp: (0.4 + Math.random()*0.6) * R.balance * Math.PI/180, // amplitude d'oscillation : 40–100 % de `balance`
            })) : [];
            // Le rendu est piloté par la boucle principale (drawDust).
        }

        function drawRays(stat, t, fade) {
            if (!beams.length || fade <= 0.001) return;
            const W = innerWidth, H = innerHeight;
            const R     = CONFIG.rayons;
            // Ancre des rayons : ne suit le pointeur qu'à hauteur de R.suiviSouris (0 = fixe,
            // 1 = autant que le halo) → mouvement bien plus subtil que le halo lui-même.
            const lx = lightState.px - lightState.followX * (1 - R.suiviSouris);
            const ly = lightState.py - lightState.followY * (1 - R.suiviSouris);
            const oy = ly - H*0.85;
            const aMain = R.angle * Math.PI/180;
            const evas  = R.evasement * Math.PI/180;
            const drift = stat ? 0 : Math.sin(t * R.derive) * R.amplitudeDerive;
            // ctx.filter blur est coûteux et croît avec le rayon : on le réduit sur mobile.
            const blurPx = lightDevice ? Math.min(R.flou, 5) : R.flou;
            dctx.filter = `blur(${blurPx}px)`;
            for (const b of beams) {
                const sway = stat ? 0 : Math.sin(t*b.sw + b.ph) * b.amp;
                // Évasement INVERSÉ (− frac) : les rayons s'OUVRENT vers le bas au lieu de
                // se rejoindre. decalSource décale la source, ecartSource règle son étalement.
                const ang  = aMain - b.frac*evas + b.aoff + sway + drift;
                const ox   = lx + R.decalSource*W + b.frac * W * R.ecartSource;
                const dx = Math.cos(ang), dy = Math.sin(ang), px = -dy, py = dx;
                const len = H*1.9*b.lenF, wT = W*b.w*0.35, wB = W*b.w;
                const tx = ox + dx*len, ty = oy + dy*len;
                const g = dctx.createLinearGradient(ox, oy, tx, ty);
                g.addColorStop(0,    'rgba(255,226,174,0)');
                g.addColorStop(0.42, `rgba(255,226,174,${(b.a*fade).toFixed(3)})`);
                g.addColorStop(1,    'rgba(255,226,174,0)');
                dctx.fillStyle = g;
                dctx.beginPath();
                dctx.moveTo(ox+px*wT, oy+py*wT); dctx.lineTo(ox-px*wT, oy-py*wT);
                dctx.lineTo(tx-px*wB, ty-py*wB); dctx.lineTo(tx+px*wB, ty+py*wB);
                dctx.closePath(); dctx.fill();
            }
            dctx.filter = 'none';
        }

        function drawBokeh(stat, t, fade) {
            const lx = lightState.px, ly = lightState.py, lr = lightState.litR || 1;
            const sc = CONFIG.bokeh.scintille;
            for (const m of motes) {
                if (!stat) {
                    m.y += m.vy;
                    if (m.y < -m.r - 20) { m.y = innerHeight + m.r + 20; m.x = Math.random()*innerWidth; }
                }
                const x = m.x + Math.sin(t*m.ss + m.sp) * m.sx, y = m.y;
                let lit = 1 - Math.hypot(x - lx, y - ly) / lr;
                if (lit <= 0) continue;
                lit = lit*lit*(3 - 2*lit);
                const tw = (1 - sc) + sc * Math.sin(t*m.ts + m.tw);
                const a  = m.a * tw * lit * fade;
                if (a <= 0.003) continue;
                // drawImage du sprite (composite 'lighter' déjà actif) ; globalAlpha
                // module l'intensité → résultat équivalent à l'ancien dégradé par frame.
                dctx.globalAlpha = a;
                dctx.drawImage(bokehSprite, x - m.r, y - m.r, m.r * 2, m.r * 2);
            }
            dctx.globalAlpha = 1;
        }

        function drawDust(stat, t) {
            if (!dctx) return;
            if (dustStart === null) dustStart = t;
            const age = stat ? 1e9 : (t - dustStart);
            const env = (delai, duree) => smooth((age - delai) / Math.max(duree, 0.001));
            const fadeR = stat ? 1 : env(CONFIG.rayons.delai, CONFIG.rayons.apparition);
            const fadeB = stat ? 1 : env(CONFIG.bokeh.delai,  CONFIG.bokeh.apparition);

            dctx.clearRect(0, 0, innerWidth, innerHeight);
            dctx.globalCompositeOperation = 'lighter';
            drawRays(stat, t, fadeR);
            drawBokeh(stat, t, fadeB);
            dctx.globalCompositeOperation = 'source-over';
        }

        // ── GRAIN ARGENTIQUE (optionnel) ──────────────────────────────
        function initGrain() {
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>
                <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>
                <feColorMatrix type='saturate' values='0'/></filter>
                <rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`;
            const g = $('chp3-grain');
            g.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
            g.style.backgroundSize  = '160px 160px';
            (function jit() {
                if (!_active) return;
                g.style.backgroundPosition = `${(Math.random()*20)|0}px ${(Math.random()*20)|0}px`;
                _grainTimer = setTimeout(jit, 90);   // ~11 fps
            })();
        }

        /* ── Sortie cinématographique → Espace collaboratif ─────────────────
           Masque la flèche, coupe l'audio du chapitre, fond au noir via
           #chp3-fade, puis signale 'chp3:navigate-back' (capté par la scène,
           qui exécute la navigation réelle). Idempotent via _navigating. */
        function _leaveToCollaboration() {
            if (_navigating) return;
            _navigating = true;
            if (_arrowHide) _arrowHide();
            try { ambSetDesired('off'); } catch (_) {}
            try { if (ambAudio) ambAudio.pause(); } catch (_) {}
            try { themeStop(true); } catch (_) {}
            const fade = $('chp3-fade');
            if (fade) { fade.style.transition = 'opacity 1200ms ease'; fade.style.opacity = '1'; }
            setTimeout(() => window.dispatchEvent(new CustomEvent('chp3:navigate-back')), 1300);
        }

        /* ── Pont exposé à la scène ─────────────────────────────────────── */
        _ctx = {
            start: () => { _wantLaunch = true; if (_doLaunch) _doLaunch(); },
            stop: () => {
                _active = false;
                try { if (_loopRaf) cancelAnimationFrame(_loopRaf); } catch (_) {}
                try { if (_grainTimer) clearTimeout(_grainTimer); } catch (_) {}
                try { if (typeof ambRamp !== 'undefined' && ambRamp) cancelAnimationFrame(ambRamp); } catch (_) {}
                try { if (ambAudio) { ambAudio.ontimeupdate = null; ambAudio.pause(); } } catch (_) {}
                try { if (typeof themeAudio !== 'undefined' && themeAudio) themeAudio.pause(); } catch (_) {}
                try { if (typeof rvMedia !== 'undefined' && rvMedia) rvMedia.pause(); } catch (_) {}
                _removeTracked();
            },
            setAudioManager:  (m) => { _audioMgr = m; },
            setArrowCallbacks:(sh, hh) => { _arrowShow = sh; _arrowHide = hh; },
            leaveToCollaboration: () => _leaveToCollaboration(),
        };
        if (_pendingAudio)  _ctx.setAudioManager(_pendingAudio);
        if (_pendingArrows) _ctx.setArrowCallbacks(_pendingArrows.s, _pendingArrows.h);
        if (_pendingStart)  _ctx.start();
    }
}
