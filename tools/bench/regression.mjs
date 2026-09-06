#!/usr/bin/env node
/**
 * regression.mjs — banc d'essai de non-régression.
 * ─────────────────────────────────────────────────────────────────────────────
 *   node tools/bench/serve.mjs &            # dans un autre terminal
 *   node tools/bench/regression.mjs
 *
 * Il automatise ce que la recette manuelle de CLAUDE.md demande à l'œil, et
 * SORT EN ERREUR si l'un des seuils est franchi.
 *
 * CE QU'IL MESURE
 *   1. Erreurs console et requêtes en échec sur tout le parcours.
 *   2. Images par seconde et saccades, scène par scène.
 *   3. FUITES : entrer/sortir de chaque chapitre trois fois, et vérifier que
 *      le nombre d'arbres DOM détachés RETENUS ne croît pas.
 *   4. Accessibilité : focus au chargement, démarrage au clavier, contrôles
 *      nommés et atteignables.
 *
 * ⚠️ SUR LE CHOIX DE L'INSTRUMENT DE FUITE — à ne pas refaire de travers.
 *
 * On lit `DOM.getDetachedDomNodes` (CDP), PAS le compteur `Nodes` de
 * `Performance.getMetrics`. Ce dernier est COLLANT : il monte quand une fuite
 * apparaît mais ne redescend JAMAIS quand la référence est relâchée. Vérifié
 * sur une fuite témoin : 500 nœuds retenus puis libérés → `Nodes` restait à
 * 2257 alors que `getDetachedDomNodes` retombait correctement à 0.
 *
 * S'y fier a coûté un faux diagnostic pendant l'audit (on a d'abord accusé des
 * références DOM de module, alors que le vrai coupable était un <video> non
 * libéré). Toute reprise de ce banc doit VALIDER son instrument sur une fuite
 * témoin avant d'en tirer une conclusion — c'est ce que fait --self-test.
 */

import { chromium } from 'playwright';

/* Le banc vise la RACINE : `index.html` est le site.
   BENCH_URL reste prioritaire pour viser une autre adresse à la volée. */
const BASE = process.env.BENCH_URL || 'http://127.0.0.1:8791/';

/* ⚠️ L'ORIGINE est distincte de la PAGE, et doit le rester.
   Le tri « à nous / aux tiers » (estTiers, plus bas) compare le début de
   chaque URL. Tant que BASE vaut la racine les deux se confondent — mais si
   BENCH_URL désigne un jour une PAGE (…/quelquechose.html), comparer à elle
   classerait tous les assets du site (…/style.css, …/images/…) comme TIERS,
   et les tiers sont signalés SANS faire échouer la campagne : un vrai 404 du
   site passerait donc en silence, ce qui est exactement le mode de panne que
   ce banc existe pour empêcher. D'où l'origine, dérivée et non recopiée. */
const ORIGINE = new URL(BASE).origin + '/';
const SELF_TEST = process.argv.includes('--self-test');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Marqueurs : « la scène est réellement à l'écran ». */
const MARK = {
  phrenologie:   "!!document.querySelector('#doc-btns svg')",
  collaboration: "!!document.querySelector('#roman-circles svg')",
  chapitre2:     "!!document.getElementById('chapitre2-root')",
  chapitre3:     "!!document.getElementById('chapitre3-root')",
  chapitre4:     "!!document.getElementById('chapitre4-root')",
};

/* Seuils. Généreux à dessein : on traque les régressions FRANCHES, pas le
   bruit de mesure d'une machine chargée. */
const SEUILS = {
  fpsMin:        45,   // moyenne par scène
  jankMax:       12,   // images > 33 ms sur la fenêtre de mesure
  fuitesMax:      0,   // arbres détachés SUPPLÉMENTAIRES après 3 aller-retours
  erreursMax:     0,
};

const echecs = [];
const note   = (ok, texte) => {
  console.log((ok ? '  ok   ' : '  ÉCHEC ') + texte);
  if (!ok) echecs.push(texte);
};

async function main() {
  // ⚠️ `channel: 'chromium'` — SANS LUI, RIEN NE VEUT DIRE GRAND-CHOSE.
  // Le headless historique rend en logiciel (SwiftShader) : le site y tombe à
  // ~15 i/s alors qu'il en tient 60 sur un GPU intégré de 2016. On mesurerait
  // la lenteur du banc d'essai, pas celle du site.
  const browser = await chromium.launch({
    headless: true,
    channel: 'chromium',
    args: ['--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist',
           '--enable-gpu-rasterization'],
  });
  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cdp  = await ctx.newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('HeapProfiler.enable');

  /* On sépare ce dont le site RÉPOND de ce qui appartient à des tiers.
     Google Fonts négocie ses fichiers selon l'agent utilisateur et sert parfois
     une URL morte au navigateur du banc : c'est une fragilité réelle du recours
     à un CDN externe, mais ce n'est pas une régression du code. On la SIGNALE
     sans faire échouer la campagne. */
  const estTiers = (url) => !url.startsWith(ORIGINE);
  const erreurs = [], requetes = [], tiers = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text().slice(0, 200);
    // Un 404 de ressource porte l'URL dans l'événement 'response', pas ici.
    if (/Failed to load resource/i.test(t)) return;
    erreurs.push(t);
  });
  page.on('pageerror', (e) => erreurs.push('PAGEERROR: ' + String(e.message || e).slice(0, 200)));
  page.on('response', (r) => {
    if (r.status() < 400) return;
    (estTiers(r.url()) ? tiers : requetes).push(r.status() + ' ' + r.url());
  });

  /* ── Instrument de fuite, et sa validation ─────────────────────────────── */
  const arbresDetaches = async () => {
    for (let i = 0; i < 4; i++) { await cdp.send('HeapProfiler.collectGarbage'); await sleep(250); }
    await cdp.send('DOM.getDocument', { depth: -1 });
    const r = await cdp.send('DOM.getDetachedDomNodes');
    return (r.detachedNodes || []).length;
  };

  await page.goto(BASE, { waitUntil: 'load' });

  if (SELF_TEST) {
    console.log('\n── Validation de l’instrument (fuite témoin) ──');
    const avant = await arbresDetaches();
    await page.evaluate(() => {
      window.__temoin = [];
      for (let i = 0; i < 3; i++) {
        const d = document.createElement('div');
        d.innerHTML = '<p>a</p><p>b</p>';
        document.body.appendChild(d);
        window.__temoin.push(d);
        d.remove();
      }
    });
    const pendant = await arbresDetaches();
    await page.evaluate(() => { window.__temoin = null; });
    const apres = await arbresDetaches();
    note(pendant > avant, `fuite témoin détectée (${avant} → ${pendant})`);
    note(apres === avant, `fuite témoin libérée (${pendant} → ${apres})`);
  }

  /* ── 1. Accessibilité au chargement ────────────────────────────────────── */
  console.log('\n── Accessibilité ──');
  const focusInitial = await page.evaluate(() => document.activeElement?.id || '(aucun)');
  note(focusInitial === 'ss-start', `focus au chargement sur le bouton de démarrage (${focusInitial})`);

  const meta = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length,
    desc: !!document.querySelector('meta[name=description]'),
    og: document.querySelectorAll('meta[property^="og:"]').length,
  }));
  note(meta.h1 === 1, `un seul <h1> (${meta.h1})`);
  note(meta.desc, 'meta description présente');
  note(meta.og >= 4, `balises Open Graph (${meta.og})`);

  await page.keyboard.press('Enter');
  await sleep(1500);
  const demarre = await page.evaluate(() => document.body.classList.contains('experience-started'));
  note(demarre, 'la touche Entrée démarre l’expérience');

  await page.evaluate(() => import('/src/core/EventBus.js').then((m) => { window.__bus = m.bus; }));
  await sleep(5000);


  const aller = async (scene) => {
    await page.evaluate((s) => window.__bus.emit('navigate', { to: s }), scene);
    for (let i = 0; i < 80; i++) {
      await sleep(500);
      if (await page.evaluate((e) => eval(e), MARK[scene])) return true;
    }
    return false;
  };

  /* ── 2. Images par seconde ─────────────────────────────────────────────── */
  const mesureFps = async (label, ms = 4000) => {
    await page.evaluate(() => {
      window.__f = [];
      let last = performance.now();
      const tick = (t) => { window.__f.push(t - last); last = t; window.__raf = requestAnimationFrame(tick); };
      window.__raf = requestAnimationFrame(tick);
    });
    await sleep(ms);
    const r = await page.evaluate(() => {
      cancelAnimationFrame(window.__raf);
      const f = (window.__f || []).slice(2);
      if (!f.length) return { fps: 0, jank: 999 };
      return {
        fps: +(1000 / (f.reduce((a, b) => a + b, 0) / f.length)).toFixed(1),
        jank: f.filter((d) => d > 33).length,
      };
    });
    note(r.fps >= SEUILS.fpsMin && r.jank <= SEUILS.jankMax,
         `${label} : ${r.fps} i/s, ${r.jank} saccade(s)`);
  };

  console.log('\n── Fluidité ──');
  await mesureFps('vitrine');
  await aller('phrenologie'); await sleep(2000); await mesureFps('phrénologie');
  await aller('collaboration'); await sleep(2000); await mesureFps('collaboration');

  /* ── 3. Fuites : trois aller-retours par chapitre ──────────────────────── */
  /* CE QUI EST MESURÉ : la CROISSANCE entre la 1ʳᵉ et la 3ᵉ visite — pas
     l'écart à un état de départ. Entrer dans un chapitre laisse légitimement
     UN arbre détaché unique (le SVG d'une flèche remplacé par hide()) ; ce
     n'est pas une fuite tant qu'il ne se répète pas. Une fuite, c'est ce qui
     s'accumule SANS PLAFOND — c'était le cas du chapitre 2 avant correction :
     +1 arbre (~900 nœuds) à chaque visite, indéfiniment. */
  console.log('\n── Fuites mémoire (3 aller-retours par chapitre) ──');
  for (const chap of ['chapitre2', 'chapitre3', 'chapitre4']) {
    let apresPremiere = null;
    let atteint = true;
    for (let v = 0; v < 3; v++) {
      if (!(await aller(chap))) { note(false, `${chap} : scène non atteinte`); atteint = false; break; }
      await sleep(5000);
      if (v === 0) await mesureFps(chap, 4000);
      await aller('collaboration');
      await sleep(3500);
      if (v === 0) apresPremiere = await arbresDetaches();
    }
    if (!atteint) continue;
    const apresTroisieme = await arbresDetaches();
    const croissance = apresTroisieme - apresPremiere;
    note(croissance <= SEUILS.fuitesMax,
         `${chap} : ${croissance} arbre(s) détaché(s) de plus entre la 1ʳᵉ et la 3ᵉ visite`);
  }

  /* ── 3bis. LE FOCUS NE DOIT JAMAIS RESTER PIÉGÉ SUR UNE FLÈCHE MASQUÉE ───
     Les flèches portent tabindex="0" : un CLIC SOURIS leur donne le focus — et
     c'est ce même clic qui déclenche la navigation, donc leur hide(). On posait
     ainsi aria-hidden sur l'élément FOCALISÉ (refusé par le navigateur, qui le
     dit en console) et le focus restait ÉCHOUÉ sur un fantôme vidé et invisible :
     la tabulation suivante repartait de nulle part.

     ⚠️ CE TEST DOIT CLIQUER POUR DE BON. Une première version cliquait trop tôt,
     pendant les 2 100 ms où ArrowBase bloque son propre clic (`drawing`) : il ne
     se passait rien, et le test passait sans rien prouver. On attend donc que la
     flèche soit dessinée, ET on vérifie que la scène a bien changé avant de
     regarder où est le focus. Placé ICI, en fin de parcours : plus haut, il
     aurait navigué avant la mesure de fluidité de la vitrine. */
  console.log('\n── Focus ──');
  {
    await aller('collaboration');
    await sleep(4000);                       // dessin de la flèche (~2,1 s) + marge
    const fleche = await page.$('#arrow-collaboration');
    if (!fleche) {
      note(false, 'flèche de l’espace collaboratif introuvable');
    } else {
      await fleche.click();
      let change = false;
      for (let i = 0; i < 40; i++) {
        await sleep(500);
        if (await page.evaluate((e) => eval(e), MARK.phrenologie)) { change = true; break; }
      }
      const f = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body || el === document.documentElement) {
          return { piege: false, quoi: '(document)' };
        }
        const masque = el.getAttribute('aria-hidden') === 'true'
                    || el.getAttribute('tabindex') === '-1'
                    || getComputedStyle(el).opacity === '0';
        return { piege: masque, quoi: (el.id || el.tagName) + (masque ? ' [MASQUÉ]' : '') };
      });
      note(change, 'le clic sur la flèche change bien de scène (sinon le test ne prouve rien)');
      note(!f.piege, `le focus n’est pas piégé sur un élément masqué (${f.quoi})`);
    }
  }

  /* ── 4. Console propre ─────────────────────────────────────────────────── */
  console.log('\n── Console ──');
  note(erreurs.length <= SEUILS.erreursMax, `${erreurs.length} erreur(s) console`);
  [...new Set(erreurs)].slice(0, 8).forEach((e) => console.log('        ! ' + e));
  // Les requêtes annulées par une sortie de scène sont normales : on ne compte
  // que les vrais codes d'erreur HTTP.
  note(requetes.length === 0, `${requetes.length} requête(s) du site en échec HTTP`);
  [...new Set(requetes)].slice(0, 8).forEach((e) => console.log('        x ' + e));
  if (tiers.length) {
    console.log(`  note  ${tiers.length} requête(s) TIERCE(S) en échec — signalé, non bloquant :`);
    [...new Set(tiers)].slice(0, 5).forEach((e) => console.log('        ~ ' + e));
    console.log('        (les polices viennent de Google Fonts : dépendance externe,');
    console.log('         à héberger localement le jour où l’on voudra s’en affranchir.)');
  }

  await browser.close();

  console.log('\n' + (echecs.length === 0
    ? '✔ Aucune régression détectée.'
    : '✘ ' + echecs.length + ' régression(s) :\n' + echecs.map((e) => '   - ' + e).join('\n')));
  process.exit(echecs.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error('BANC EN ERREUR :', e); process.exit(2); });
