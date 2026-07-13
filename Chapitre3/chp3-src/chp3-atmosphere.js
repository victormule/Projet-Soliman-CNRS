/* =====================================================================
   Chapitre 3 — chp3-atmosphere.js
   Atmosphère de la galerie : bokeh (poussières lumineuses) + rayons de
   lumière volumétriques, dessinés en composite additif sur #chp3-dust.
   Code moteur déplacé verbatim depuis chp3-openning.js (Phase 2).

   createAtmosphere({ lightState, reduceMotion, lightDevice, mobileLite })
     → { initDust, resizeDust, drawDust }
   - lightState : objet MUTABLE partagé avec le moteur (position/rayon du
     halo, mis à jour par updateLight à chaque frame) — lu ici pour ancrer
     rayons et éclairage des poussières.
   - Le gating (mobileLite → rien, reduceMotion → une frame statique) reste
     porté par le wrapper drawAtmo() du moteur, inchangé.
   Réglages : CONFIG.bokeh et CONFIG.rayons (chp3-config.js).
   ===================================================================== */

import { CONFIG } from './chp3-config.js';
import { $, smooth } from './chp3-utils.js';

export function createAtmosphere({ lightState, reduceMotion, lightDevice, mobileLite }) {
    let dustCv = null, dctx = null, motes = [], beams = [], dustStart = null;
    let bokehSprite = null;   // dégradé radial pré-rendu une seule fois (cf. initDust)

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


    return { initDust, resizeDust, drawDust };
}
