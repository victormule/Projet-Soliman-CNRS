/* =====================================================================
   Chapitre 3 — chp3-ambiance.js
   Système audio du chapitre : AMBIANCE (musique principale de la galerie,
   machine à états ambDesired + boucle manuelle à fondu enchaîné) et
   THÈME DE TABLEAU (canal dédié par cercle ouvert, duck pendant les
   médias concurrents). Code moteur déplacé verbatim depuis
   chp3-opening.js (Phase 2, découpage du monolithe).

   createChapterAudio({ reduceMotion, lightDevice }) →
     { ambStart, ambSetDesired, themePlay, themeDuck, themeStop, stop }
   stop() : coupe tout net (rampes, boucle, lectures) — appelé par le
   démontage du moteur ET par la sortie vers l'Espace collaboratif.
   ===================================================================== */

import { CONFIG } from './chp3-config.js';
import { clamp } from './chp3-utils.js';

export function createChapterAudio({ reduceMotion, lightDevice }) {
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


    // ── Arrêt global (démontage du moteur / sortie de chapitre) ────────
    function stop() {
        if (ambRamp) { try { cancelAnimationFrame(ambRamp); } catch (_) {} ambRamp = null; }
        ambDesired = 'off';
        if (ambAudio) { ambAudio.ontimeupdate = null; try { ambAudio.pause(); } catch (_) {} }
        if (themeAudio) {
            const r = themeRamps.get(themeAudio);
            if (r) { try { cancelAnimationFrame(r); } catch (_) {} themeRamps.delete(themeAudio); }
            try { themeAudio.pause(); } catch (_) {}
        }
    }

    return { ambStart, ambSetDesired, themePlay, themeDuck, themeStop, stop };
}
