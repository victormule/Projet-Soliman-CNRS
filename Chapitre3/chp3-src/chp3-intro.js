/* =====================================================================
   Chapitre 3 — chp3-intro.js
   Question d'introduction (quiz oui/non + camemberts statistiques +
   camembert « Qui est-il ? » + témoignage en machine à écrire), jouée
   AVANT le travelling. Code moteur déplacé verbatim depuis
   chp3-openning.js (Phase 2, découpage du monolithe) ; seul changement :
   launchLoop() → onDone() (callback injecté).

   createIntro({ container, reduceMotion, _on, onDone }) →
     { show, isActive }
   - container : élément #chp3-container (le quiz s'y monte)
   - _on       : helper listeners trackés du moteur (nettoyés à son stop)
   - onDone    : appelé en fin d'épilogue → le moteur lance le travelling
   - show()    : joue toute la séquence (émet 'chp3:intro-ready' au montage)
   - isActive(): true pendant le quiz (garde du skip() moteur)
   ===================================================================== */

import { CONFIG } from './chp3-config.js';
import { easeOutCubic } from './chp3-utils.js';

export function createIntro({ container, reduceMotion, _on, onDone }) {
    const rvWait = ms => new Promise(r => setTimeout(r, ms));
    let introActive = false;   // true pendant la question d'intro (cf. iqShow)

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
        onDone();   // launchLoop() du moteur, injecté via createIntro
        setTimeout(() => iqEl.overlay.classList.add('hidden'), reduceMotion ? 0 : T.fadeOut);
    }


    return { show: iqShow, isActive: () => introActive };
}
