/** Recette du chapitre V. Lancer le serveur, puis node tools/bench/chapter5.mjs. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BENCH_URL || 'http://127.0.0.1:8791/';
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BENCH_CHANNEL || 'chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const errors = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
fs.mkdirSync('.chrome-test', { recursive: true });

async function prepare(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    // ⚠️ LA CARTE MENTALE EST UN AUTRE SITE, encadré : ce qu'elle dit en
    // console lui appartient (aujourd'hui, un avertissement sur son en-tête
    // CSP « report-only », à régler dans soliman-map-v3). On le SIGNALE sans
    // faire échouer la campagne — la règle déjà suivie pour les requêtes
    // tierces. Tout ce qui vient de notre origine, en revanche, compte.
    const origine = message.location()?.url || '';
    if (/soliman-map.netlify.app/.test(origine) || /report-only policy/i.test(message.text())) {
      console.log('  (tiers, carte mentale) ' + message.text());
      return;
    }
    errors.push(message.text());
  });
  page.on('response', response => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
  await page.goto(BASE);
  await page.evaluate(async () => {
    const { bus } = await import('/src/core/EventBus.js');
    window.testBus = bus;
    window.sceneName = null;
    bus.on('scene:entered', ({ name }) => { window.sceneName = name; });
    document.getElementById('start-screen').remove();
    document.body.classList.add('experience-started');
    document.dispatchEvent(new Event('fullscreenchange'));
    // Les temps du tronc commun sont raccourcis ; le chapitre garde ses durées.
    const c = window.CONFIG.COLLABORATION;
    c.timing.bg_fade_in = c.timing.pause_before_torch = 0;
    c.torch.grow_duration = 80;
    c.arrow.appear_at = c.arrow.draw_duration = 0;
    c.circles.appear_at = c.circles.appear_at_return = 0;
    c.circles.stagger = 0;
    bus.emit('navigate', { to: 'collaboration' });
  });
  await page.waitForFunction(() => window.sceneName === 'collaboration');
  await sleep(2600);
  return { context, page };
}

async function enterFromCircle(page) {
  // Vrai clic sur le cinquième cercle, y compris l'extinction de la torche.
  await page.locator('#roman-circles [role="button"]').nth(4).click();
  await page.waitForFunction(() => window.sceneName === 'chapitre5');
  await page.waitForFunction(() => document.querySelector('#chp5-stage') &&
    !document.querySelector('#chp5-stage').classList.contains('intro-running'));
  await sleep(2400);
}

async function returnFromArrow(page) {
  await page.locator('#arrow-chp5').click();
  await page.waitForFunction(() => window.sceneName === 'collaboration');
  await sleep(2400);
  assert.equal(await page.locator('#chapitre5-root, #chp5-css-opening, body.chp5-active').count(), 0);
}

/**
 * LE PASSAGE SE JOUE DANS LE NOIR — mesuré à l'instant exact, pas deviné.
 * On guette, dans la page, le moment où le décor du lieu se monte (`classe`),
 * et l'on note le temps écoulé depuis le départ et l'opacité du noir à cet
 * instant. ⚠️ L'ancienne version dormait 700 ms puis regardait : sous charge,
 * le sommeil durait plus que l'extinction et l'assertion échouait sans
 * qu'aucune régression n'existe (deux fois en septembre 2026).
 */
async function guetterPassage(page, classe) {
  await page.evaluate(classe => {
    const stage = document.querySelector('#chp5-stage');
    const nuit = document.querySelector('#chp5-nuit');
    window.passage = { depart: 0, monte: 0, nuit: 0 };
    const observateur = new MutationObserver(() => {
      if (!window.passage.depart && stage.classList.contains('hors-salle')) window.passage.depart = performance.now();
      if (!window.passage.monte && stage.classList.contains(classe)) {
        window.passage.monte = performance.now();
        window.passage.nuit = Number(getComputedStyle(nuit).opacity);
        observateur.disconnect();
      }
    });
    observateur.observe(stage, { attributes: true, attributeFilter: ['class'] });
  }, classe);
}

async function verifierPassage(page, noirMs, lieu) {
  const { depart, monte, nuit } = await page.evaluate(() => window.passage);
  assert.ok(monte - depart >= noirMs - 100,
    `${lieu} : le décor s'est monté après ${Math.round(monte - depart)} ms, avant la fin de l'extinction (${noirMs} ms)`);
  assert.ok(nuit > 0.95, `${lieu} : le décor s'est monté sous un noir incomplet (${nuit.toFixed(2)})`);
}

async function clickMoving(page, selector) {
  // Le brouillon anime les repères en continu : cliquer leur centre réel,
  // sans attendre une immobilité qui ne fait pas partie de cette scène.
  const target = page.locator(selector);
  let box = await target.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(450);
  box = await target.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

try {
  const { context, page } = await prepare();
  await enterFromCircle(page);
  assert.match(await page.title(), /Chapitre V/);
  assert.match(await page.locator('#chapitre-subtitle').innerText(), /Le devenir du corps/i);
  // Les trois sous-chapitres sont ouverts : tous portent data-part, aucun
  // n'est plus « à venir ».
  assert.equal(await page.locator('#chapitre5-root .nav-link[aria-disabled="true"]').count(), 0);
  assert.equal(await page.locator('#chapitre5-root .nav-link[data-part]').count(), 3);
  assert.equal(await page.locator('#chapitre5-root a[href]').count(), 0);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('soliman.journey.v1')).visited.chapitre5), true);
  for (const selector of ['#site-title', '#chapitre-subtitle', '#fs-btn', '#compass-map', '#arrow-chp5']) {
    assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).zIndex), '600', selector);
  }
  await page.screenshot({ path: '.chrome-test/chapter5-desktop.png' });
  console.log('OK : ouverture depuis V et interface commune.');

  /* ── LA PORTE — sous-chapitre 1 ─────────────────────────────────────────
     On ne change pas de scène : on recule, les battants se referment, la
     caméra pousse sur le panneau. Au clavier, comme à la souris. */
  await page.locator('#chp5-nav-1 .nav-link').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#chp5-stage').classList.contains('porte-en-jeu'));
  assert.equal(await page.evaluate(() => window.sceneName), 'chapitre5');
  // La flèche et la boussole s'effacent ensemble, dès le clic.
  await sleep(700);
  for (const selector of ['#arrow-chp5', '#compass-map']) {
    assert.ok(Number(await page.locator(selector).evaluate(el => getComputedStyle(el).opacity)) < 0.05, selector);
  }
  // ⚠️ LE SOUS-TITRE CÈDE SA PLACE, IL NE SE DOUBLE PAS : jamais les deux
  // textes ensemble, et le niveau 3 reste vide.
  await page.waitForFunction(
    () => /réserves du Musée de l/i.test(document.getElementById('chapitre-subtitle').textContent)
      && document.getElementById('chapitre-subtitle').classList.contains('visible'),
    null, { timeout: 20000 });
  assert.equal(await page.locator('#chapitre-part-title').innerText(), '');
  assert.equal(await page.locator('#chp5-porteVoile').evaluate(el => getComputedStyle(el).backgroundColor),
    'rgb(255, 255, 255)');

  // ⚠️ ATTENDRE LA FIN DU GROS PLAN, et pas seulement le sous-titre : celui-ci
  // cède sa place dès le clic, bien avant que la caméra ait fini de pousser.
  await page.waitForFunction(
    () => document.getElementById('chp5-porteCadre').getBoundingClientRect().width > innerWidth,
    null, { timeout: 20000 });
  await sleep(900);

  // ⚠️ LE PANNEAU NE DOIT PAS PASSER SOUS LA COLONNE DE TITRES : il est presque
  // blanc, les titres sont dorés. C'est ce que borne CONFIG.porte.panneauHauteur.
  const cadrage = await page.evaluate(() => {
    const P = { x: 996, y: 577, w: 863, h: 611, W: 2208, H: 2968 };
    const c = document.getElementById('chp5-porteCadre').getBoundingClientRect();
    const bas = ['site-title', 'chapitre-subtitle', 'chapitre-part-title', 'compass-map']
      .map(id => document.getElementById(id).getBoundingClientRect().bottom);
    return {
      haut: c.top + P.y / P.H * c.height,
      largeur: P.w / P.W * c.width,
      titres: Math.max(...bas),
      vw: innerWidth,
    };
  });
  assert.ok(cadrage.haut > cadrage.titres,
    `panneau à ${cadrage.haut} px, titres jusqu'à ${cadrage.titres} px`);
  assert.ok(cadrage.largeur > cadrage.vw * 0.5, 'le panneau doit tenir le cadre');
  await page.screenshot({ path: '.chrome-test/chapter5-porte.png' });

  // La flèche revient — et elle ramène à la PHOTOGRAPHIE, pas hors du chapitre.
  assert.equal(await page.locator('#arrow-chp5').evaluate(el => el.style.opacity), '1');
  assert.match(await page.locator('#arrow-chp5').getAttribute('aria-label'), /photographie/i);
  await page.locator('#arrow-chp5').click();
  await page.waitForFunction(() => !document.querySelector('#chp5-stage').classList.contains('porte-en-jeu'),
    null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => window.sceneName), 'chapitre5');
  assert.equal(await page.locator('#chapitre5-root .callout[inert]').count(), 0);
  await page.waitForFunction(
    () => /devenir du corps/i.test(document.getElementById('chapitre-subtitle').textContent),
    null, { timeout: 20000 });
  // La flèche se re-dessine (2,1 s de tracé) avant de pouvoir quitter à nouveau.
  await sleep(2600);
  assert.match(await page.locator('#arrow-chp5').getAttribute('aria-label'), /espace collaboratif/i);
  console.log('OK : la porte du sous-chapitre 1, et le retour à la photographie.');

  /* ── LA VITRINE — sous-chapitre 2 ───────────────────────────────────────
     On éteint, on rallume ailleurs : une torche fixe ouvre sur la boîte, et
     la main qui s'en approche la vide. */
  await guetterPassage(page, 'vitrine-en-jeu');
  await page.locator('#chp5-nav-2 .nav-link').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#chp5-stage').classList.contains('vitrine-en-jeu'),
    null, { timeout: 40000 });
  // Le noir tombe AVANT que le décor paraisse : sans quoi on verrait le
  // changement de lieu à vue.
  await verifierPassage(page, 1400, 'vitrine');
  await page.waitForFunction(
    () => /Restituer les restes/i.test(document.getElementById('chapitre-subtitle').textContent)
      && document.getElementById('chapitre-subtitle').classList.contains('visible'),
    null, { timeout: 20000 });
  // La torche est FIXE et centrale : son canevas couvre la fenêtre.
  assert.equal(await page.locator('#chp5-vitrineTorche').evaluate(el => el.width - innerWidth), 0);
  await sleep(3600);   // l'allumage (torche.growMs) + une marge
  await page.screenshot({ path: '.chrome-test/chapter5-vitrine.png' });
  assert.equal(await page.locator('#arrow-chp5').evaluate(el => el.style.opacity), '1');

  // LE CRÂNE EST ENTIER TANT QU'ON N'A RIEN LU — la prise pleine est à 100 %,
  // et la main n'y fait plus rien : l'ancien jeu (le crâne qui disparaissait
  // sous le curseur) a été remplacé par celui des pièces consultées.
  const plein = () => page.locator('#chp5-vitrinePlein').evaluate(el => Number(getComputedStyle(el).opacity));
  assert.ok(await plein() > 0.99, 'à l’arrivée, le crâne est entier');
  const centre = await page.evaluate(() => [innerWidth / 2, innerHeight / 2]);
  await page.mouse.move(centre[0], centre[1], { steps: 20 });
  await sleep(1200);
  assert.ok(await plein() > 0.99, 'la main sur le crâne ne le vide plus');

  /* ── LES BOÎTES — l'inventaire, de part et d'autre du crâne ─────────────
     Deux grandes boîtes s'écrivent à l'arrivée ; cliquer l'une l'ouvre sur
     les petites qu'elle contient, ET ELLE LE RESTE. */
  const boites = () => page.evaluate(() => {
    const racine = document.querySelector('#chp5-boites');
    const vus = selecteur => [...racine.querySelectorAll(selecteur)]
      .filter(el => !el.classList.contains('boite--absente'));
    return {
      grandes: vus('.boite--grande').length,
      petites: vus('.boite--petite').length,
      pretes: racine.querySelectorAll('.boite--grande.boite--prete:not([disabled])').length,
      inert: racine.inert,
      visibilite: getComputedStyle(racine).visibility,
      // Les deux grandes doivent tenir dans la fenêtre ET rester au large du
      // crâne : c'est la bande libre que le module calcule (cf. `disposer`).
      cadres: [...racine.querySelectorAll('.boite--grande')].map(el => {
        const r = el.getBoundingClientRect();
        return { gauche: r.left, droite: r.right };
      }),
    };
  });

  let inventaire = await boites();
  assert.equal(inventaire.grandes, 2, 'deux grandes boîtes à l\'arrivée');
  assert.equal(inventaire.petites, 0, 'aucune petite avant qu\'on ouvre');
  assert.equal(inventaire.pretes, 2, 'les deux grandes sont écrites, donc cliquables');
  const garde = await page.evaluate(() => {
    const photo = 3200 / 2248;
    const largeurRendue = Math.min(innerWidth, innerHeight * photo);
    return { crane: 0.21 * largeurRendue, vw: innerWidth };
  });
  for (const cadre of inventaire.cadres) {
    assert.ok(cadre.gauche > 0 && cadre.droite < garde.vw, 'une grande boîte déborde de la fenêtre');
    const versLeCentre = cadre.gauche > garde.vw / 2
      ? cadre.gauche - (garde.vw / 2 + garde.crane)
      : (garde.vw / 2 - garde.crane) - cadre.droite;
    assert.ok(versLeCentre > 0, 'une grande boîte mord sur le crâne');
  }

  // ⚠️ ATTEIGNABLES AU CLAVIER : ce sont de vrais boutons, et c'est pour cela
  // qu'ils vivent HORS de la couche `.vitrine`, qui est aria-hidden.
  await page.locator('#chp5-boites .boite--grande').first().focus();
  assert.match(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), /gauche/i);
  await page.keyboard.press('Enter');
  await sleep(3400);
  inventaire = await boites();
  assert.equal(inventaire.grandes, 1, 'la boîte ouverte a cédé la place');
  assert.equal(inventaire.petites, 8, 'huit petites boîtes à gauche (3 · 1 · 4)');

  // ON N'EN REVIENT PAS : re-cliquer ne referme rien, et le bouton s'est retiré.
  assert.equal(await page.locator('#chp5-boites .boite--grande[disabled]').count(), 1);
  assert.equal(await page.locator('#chp5-boites .boite--grande[aria-expanded="true"]').count(), 1);
  await page.screenshot({ path: '.chrome-test/chapter5-boites.png' });

  /* ── LES PIÈCES — ce que les petites boîtes ouvrent ─────────────────────
     Une ligne de boîtes = un dossier : D1 sur la ligne de deux, D2 sur celle
     d'une, D3 sur celle de quatre. Chaque boîte porte SA pièce, l'annonce au
     survol, et l'ouvre au milieu de l'écran. */
  const fenetre = () => page.evaluate(() => {
    const doc = document.querySelector('#chp5-doc');
    const media = doc.querySelector('.doc-media');
    return {
      ouverte: doc.classList.contains('doc--ouvert'),
      visibilite: getComputedStyle(doc).visibility,
      genre: doc.querySelector('.doc-piece')?.dataset.genre ?? null,
      balise: media?.tagName ?? null,
      titre: doc.querySelector('.doc-titre').textContent,
      // Tout le texte VISIBLE de la fenêtre : le code du dossier n'y paraît pas.
      texte: doc.querySelector('.doc-cartel').innerText,
    };
  });
  const legende = () => page.evaluate(() => ({
    visible: document.querySelector('#chp5-legende').classList.contains('legende--visible'),
    texte: document.querySelector('#chp5-legende span').textContent,
  }));

  // Les sept boîtes de gauche portent bien les trois dossiers, dans l'ordre.
  // (Les deux petites de DROITE sont déjà dans le document, mais cachées : on
  // ne lit que celles qu'on voit.)
  const dossiers = await page.evaluate(() => [...document.querySelectorAll('#chp5-boites .boite--petite:not(.boite--absente)')]
    .map(el => el.dataset.dossier));
  assert.deepEqual(dossiers, ['D1', 'D1', 'D1', 'D2', 'D3', 'D3', 'D3', 'D3'],
    'une ligne de boîtes = un dossier');

  // SURVOL : le nom de la pièce s'écrit en bas.
  const premiere = page.locator('#chp5-boites .boite--petite').first();
  const cadrePetite = await premiere.boundingBox();
  await page.mouse.move(cadrePetite.x + cadrePetite.width / 2, cadrePetite.y + cadrePetite.height / 2);
  await sleep(800);
  let vu = await legende();
  assert.ok(vu.visible, 'le nom de la pièce doit paraître au survol');
  assert.match(vu.texte, /loi de restitution/i);

  // CLIC : la fenêtre s'ouvre au milieu, avec la bonne pièce et son cartel.
  await page.mouse.click(cadrePetite.x + cadrePetite.width / 2, cadrePetite.y + cadrePetite.height / 2);
  await sleep(1700);
  let vitre = await fenetre();
  assert.ok(vitre.ouverte && vitre.visibilite === 'visible', 'la fenêtre doit s’ouvrir');
  assert.equal(vitre.genre, 'video');
  assert.equal(vitre.balise, 'VIDEO');
  assert.match(vitre.titre, /loi de restitution/i);
  // ⚠️ LE CODE DU DOSSIER NE S'AFFICHE PAS — ni dans la fenêtre, ni en bas.
  assert.doesNotMatch(vitre.texte, /\b[DC]\d\b/, 'un code de dossier paraît dans la fenêtre');
  assert.doesNotMatch(vu.texte, /\b[DC]\d\b/, 'un code de dossier paraît en bas');
  // ⚠️ UNE PIÈCE OUVERTE EST UN MÉDIA AU PREMIER PLAN : la flèche et la
  // boussole s'effacent, comme devant un témoignage (cf. `occupe`).
  for (const selecteur of ['#arrow-chp5', '#compass-map']) {
    assert.ok(Number(await page.locator(selecteur).evaluate(el => getComputedStyle(el).opacity)) < 0.05, selecteur);
  }
  // Le cadre reste dans la fenêtre et garde le format de la pièce.
  const cadre = await page.evaluate(() => {
    const r = document.querySelector('#chp5-docCadre').getBoundingClientRect();
    return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight };
  });
  assert.ok(cadre.w <= cadre.vw && cadre.h <= cadre.vh, 'le cadre déborde de la fenêtre');
  assert.ok(Math.abs(cadre.w / cadre.h - 16 / 9) < 0.06, 'une vidéo garde son 16/9');
  await page.screenshot({ path: '.chrome-test/chapter5-piece.png' });

  // TROIS SORTIES, et on n'enferme personne : Échap, la croix, le clic dehors.
  await page.keyboard.press('Escape');
  await sleep(700);
  assert.equal((await fenetre()).ouverte, false, 'Échap doit fermer');

  await page.locator('#chp5-boites .boite--petite').nth(7).click();   // le texte (PDF UNESCO)
  await sleep(1600);
  vitre = await fenetre();
  assert.equal(vitre.genre, 'texte');
  assert.equal(vitre.balise, 'IFRAME');
  await page.locator('#chp5-docCroix').click();
  await sleep(700);
  assert.equal((await fenetre()).ouverte, false, 'la croix doit fermer');

  // ⚠️ AUCUN MÉDIA NE SURVIT À LA FERMETURE : un <video>/<audio> non libéré
  // retient tout son arbre (règle d'août 2026). La pièce est VIDÉE, pas rangée.
  await sleep(700);
  assert.equal(await page.locator('#chp5-doc .doc-media').count(), 0,
    'la pièce doit être démontée après la fermeture');
  assert.equal(await page.locator('#chp5-doc').evaluate(el => getComputedStyle(el).visibility), 'hidden');

  // LA CARTE MENTALE — troisième boîte de la ligne D1, cadre intégré.
  await page.locator('#chp5-boites .boite--petite').nth(2).click();
  await sleep(1600);
  vitre = await fenetre();
  assert.equal(vitre.genre, 'carte');
  assert.match(await page.locator('#chp5-doc iframe').getAttribute('src'), /soliman-map\.netlify\.app\/.*b_restit/);
  await page.screenshot({ path: '.chrome-test/chapter5-carte.png' });
  await page.keyboard.press('Escape');
  await sleep(700);

  // UNE VIDÉO QUI S'ACHÈVE REFERME SA FENÊTRE d'elle-même.
  await page.locator('#chp5-boites .boite--petite').nth(3).click();   // D2
  await sleep(1600);
  await page.locator('#chp5-doc video').evaluate(async video => {
    if (!Number.isFinite(video.duration)) await new Promise(r => video.addEventListener('loadedmetadata', r, { once: true }));
    video.muted = true;
    video.currentTime = Math.max(0, video.duration - 0.4);
    await video.play();
  });
  await page.waitForFunction(() => !document.querySelector('#chp5-doc').classList.contains('doc--ouvert'),
    null, { timeout: 8000 });

  // LES BOÎTES LUES GARDENT UNE TEINTE, et le crâne s'efface d'autant : quatre
  // pièces vues sur dix (vidéo D1, texte UNESCO, carte, vidéo D2).
  assert.equal(await page.locator('#chp5-boites .boite--petite.boite--vue').count(), 4,
    'chaque pièce consultée garde sa teinte');
  await sleep(3000);   // restitution.effacementMs + une marge
  const presence = await plein();
  assert.ok(Math.abs(presence - 0.6) < 0.02, `le crâne doit être à 60 % (il est à ${presence.toFixed(3)})`);
  console.log('OK : les pièces — nom au survol, fenêtre au centre, trois sorties, carte, fin de lecture, teinte et effacement.');

  // ── LA SORTIE DU LIEU : les boîtes S'EFFACENT avant que la lumière tombe ──
  // Sans ce geste elles restaient blanches et pleines au-dessus d'une
  // photographie déjà noire, jusqu'à ce que le voile les avale d'un bloc.
  const depart = Date.now();
  await page.locator('#arrow-chp5').click();
  let effacees = null;
  let voileArrive = null;
  for (let i = 0; i < 24 && (effacees === null || voileArrive === null); i++) {
    const releve = await page.evaluate(() => ({
      boites: [...document.querySelectorAll('#chp5-boites .boite')]
        .filter(el => !el.classList.contains('boite--absente')).length,
      voile: Number(document.querySelector('#chp5-nuit').style.opacity || 0),
    }));
    if (effacees === null && releve.boites === 0) effacees = Date.now() - depart;
    if (voileArrive === null && releve.voile > 0.02) voileArrive = Date.now() - depart;
    await sleep(120);
  }
  assert.ok(effacees !== null, 'les boîtes doivent s’effacer en partant');
  assert.ok(voileArrive === null || effacees <= voileArrive,
    `les boîtes doivent partir AVANT le noir (boîtes ${effacees} ms, voile ${voileArrive} ms)`);
  console.log(`OK : la sortie du lieu — boîtes effacées à ${effacees} ms, avant le noir.`);

  // Plus rien ne doit rester à l'écran ni dans l'ordre de tabulation dès qu'on
  // quitte le lieu — la couche est rendue `inert` et invisible.
  await page.waitForFunction(() => !document.querySelector('#chp5-stage').classList.contains('hors-salle'),
    null, { timeout: 25000 });
  await sleep(600);
  inventaire = await boites();
  assert.equal(inventaire.visibilite, 'hidden', 'les boîtes survivent à la sortie du lieu');
  assert.equal(inventaire.inert, true, 'les boîtes restent tabulables hors du lieu');
  assert.equal(inventaire.grandes + inventaire.petites, 0);

  // ET L'INVENTAIRE SE REFERME : on revient dans la vitrine, les deux grandes
  // boîtes sont de nouveau là. Sortir du sous-chapitre, c'est éteindre le
  // lieu — on ne rallume pas sur des boîtes déjà éventrées.
  await page.waitForFunction(
    () => /devenir du corps/i.test(document.getElementById('chapitre-subtitle').textContent),
    null, { timeout: 20000 });
  await sleep(2600);
  await page.locator('#chp5-nav-2 .nav-link').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#chp5-stage').classList.contains('vitrine-en-jeu'),
    null, { timeout: 40000 });
  await sleep(5200);
  inventaire = await boites();
  assert.equal(inventaire.grandes, 2, 'on retrouve les deux grandes boîtes en revenant');
  assert.equal(inventaire.petites, 0, 'aucune petite ne survit à la sortie du lieu');
  assert.equal(inventaire.pretes, 2, 'les deux sont de nouveau cliquables');
  const presenceRetour = await plein();
  assert.ok(Math.abs(presenceRetour - 0.6) < 0.02,
    `ce qu'on a lu ne s'oublie pas en sortant (crâne à ${presenceRetour.toFixed(3)})`);
  console.log('OK : les boîtes de la vitrine — écriture, éclatement, et l\'inventaire qui se referme.');

  await page.locator('#arrow-chp5').click();
  await page.waitForFunction(() => !document.querySelector('#chp5-stage').classList.contains('hors-salle'),
    null, { timeout: 25000 });
  // La torche ne survit pas au lieu : ni boucle de rendu, ni écouteurs.
  assert.equal(await page.locator('#chp5-stage').evaluate(el => el.classList.contains('vitrine-en-jeu')), false);
  assert.equal(await page.locator('#chp5-nuit').evaluate(el => el.style.opacity), '0');
  await page.waitForFunction(
    () => /devenir du corps/i.test(document.getElementById('chapitre-subtitle').textContent),
    null, { timeout: 20000 });
  await sleep(2600);
  console.log('OK : la vitrine du sous-chapitre 2, la boîte qui se vide, et le retour.');

  /* ── L'INHUMATION — sous-chapitre 3 ─────────────────────────────────────
     L'entrée du chapitre 1 : noir, torche fixe sur les crânes, une voix et
     « Passer », SANS flèche ni boussole ; puis la photographie bascule et
     l'interface revient. Au clavier, et l'on passe la voix. */
  await guetterPassage(page, 'inhumation-en-jeu');
  await page.locator('#chp5-nav-3 .nav-link').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#chp5-stage').classList.contains('inhumation-en-jeu'),
    null, { timeout: 40000 });
  await verifierPassage(page, 1400, 'inhumation');
  await page.waitForFunction(
    () => /Inhumer la dépouille/i.test(document.getElementById('chapitre-subtitle').textContent)
      && document.getElementById('chapitre-subtitle').classList.contains('visible'),
    null, { timeout: 20000 });
  assert.equal(await page.locator('#chp5-inhumationTorche').evaluate(el => el.width - innerWidth), 0);

  // « Passer » paraît avec la voix — et PENDANT la voix, ni flèche ni boussole.
  await page.waitForFunction(() => document.querySelector('#chp5-passer').classList.contains('passer--visible'),
    null, { timeout: 20000 });
  for (const selector of ['#arrow-chp5', '#compass-map']) {
    assert.ok(Number(await page.locator(selector).evaluate(el => getComputedStyle(el).opacity)) < 0.05,
      selector + ' doit rester effacé pendant la voix');
  }
  // Entré au clavier, on y reste : le focus attend sur « Passer ».
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'chp5-passer');
  await sleep(1200);   // le cadre se trace, le mot paraît
  await page.screenshot({ path: '.chrome-test/chapter5-inhumation-voix.png' });
  assert.equal(await page.locator('#chp5-stage').evaluate(el => el.classList.contains('inhumation-bascule')), false,
    'la voix joue encore : pas de bascule');

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#chp5-stage').classList.contains('inhumation-bascule'));
  // La flèche revient une fois la photographie basculée (l'interface paraît).
  await page.waitForFunction(() => document.getElementById('arrow-chp5').style.opacity === '1',
    null, { timeout: 8000 });
  assert.match(await page.locator('#arrow-chp5').getAttribute('aria-label'), /photographie/i);
  assert.equal(await page.locator('#chp5-passer').evaluate(el => el.hidden), true, '« Passer » est parti');
  assert.ok(Number(await page.locator('#chp5-inhumationApres').evaluate(el => getComputedStyle(el).opacity)) > 0.99);
  await sleep(900);
  await page.screenshot({ path: '.chrome-test/chapter5-inhumation.png' });

  /* ── LES TOMBES ET LE DRAPEAU — une rangée devant le buste, dans l'ombre ── */
  assert.ok(Math.abs(Number(await page.locator('#chp5-inhumation .inhumation-ombre')
    .evaluate(el => getComputedStyle(el).opacity)) - 0.42) < 0.02, 'la vitrine au buste tombe dans l’obscurité');
  // OUVERTE D'EMBLÉE : cinq dessins écrits, rien à éclater.
  await page.waitForFunction(() => document.querySelectorAll('#chp5-tombes .boite--petite.boite--prete').length === 5,
    null, { timeout: 10000 });
  assert.equal(await page.locator('#chp5-tombes .boite--grande').count(), 0, 'plus de grande tombe à ouvrir');
  assert.deepEqual(await page.locator('#chp5-tombes .boite--petite').evaluateAll(els => els.map(el => el.dataset.dossier)),
    ['A', 'B', 'Alicia', 'C', 'D']);
  // UNE RANGÉE, le drapeau au milieu de l'écran.
  const rangee = await page.locator('#chp5-tombes .boite--petite').evaluateAll(els => els.map(el => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }));
  assert.ok(rangee.every(c => Math.abs(c.y - rangee[0].y) < 2), 'les cinq sont sur une même ligne');
  assert.ok(rangee.every((c, i) => !i || c.x > rangee[i - 1].x), 'de gauche à droite, dans l’ordre A, B, drapeau, C, D');
  assert.ok(Math.abs(rangee[2].x - await page.evaluate(() => innerWidth / 2)) < 2, 'le drapeau est au milieu');
  // LE PANORAMA : la vitrine au buste COUVRE la fenêtre (pas de bande noire),
  // et la main la fait glisser.
  const cadreApres = () => page.locator('#chp5-inhumationCadreApres').evaluate(el => {
    const r = el.getBoundingClientRect();
    return { gauche: r.left, droite: r.right, haut: r.top, bas: r.bottom, vw: innerWidth, vh: innerHeight };
  });
  await page.mouse.move(720, 450);
  await sleep(1800);
  const auCentre = await cadreApres();
  assert.ok(auCentre.gauche <= 0 && auCentre.droite >= auCentre.vw && auCentre.haut <= 0 && auCentre.bas >= auCentre.vh,
    'la vitrine au buste couvre la fenêtre, sans bande noire');
  await page.mouse.move(1430, 890, { steps: 10 });
  await sleep(2200);
  const enBas = await cadreApres();
  assert.ok(enBas.gauche < auCentre.gauche - 5 && enBas.haut < auCentre.haut - 5, 'la main à droite et en bas fait voir la droite et le bas');
  assert.ok(enBas.droite >= enBas.vw - 1 && enBas.bas >= enBas.vh - 1, 'même au bout du glissement, aucun bord ne paraît');

  // Le drapeau garde son TITRE.
  await page.locator('#chp5-tombes .boite--petite').nth(2).hover();
  await page.waitForFunction(() => /Inhumer symboliquement/.test(document.querySelector('#chp5-legende').textContent)
    && document.querySelector('#chp5-legende').classList.contains('legende--visible'));
  await page.screenshot({ path: '.chrome-test/chapter5-inhumation-tombes.png' });

  // LE DRAPEAU : la rangée se dé-écrit, la planche monte PLEIN ÉCRAN avec sa
  // croix, la voix d'Alicia se joue (sans fenêtre, sans sinusoïde) et son
  // crédit s'écrit en bas tant qu'elle parle.
  await page.evaluate(() => {
    const jouer = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      if (/inhumation-alicia-2/.test(this.src)) window.voixDrapeau = this;
      return jouer.apply(this, args);
    };
  });
  await page.locator('#chp5-tombes .boite--petite').nth(2).click();
  await page.waitForFunction(() => document.querySelector('#chp5-stage').classList.contains('inhumation-inhume'));
  assert.equal(await page.locator('#chp5-doc').evaluate(el => el.classList.contains('doc--en-jeu')), false,
    'le drapeau n’ouvre pas la fenêtre');
  await page.waitForFunction(() => window.voixDrapeau && !window.voixDrapeau.paused, null, { timeout: 8000 });
  await page.waitForFunction(() => !document.querySelector('#chp5-tombes .boite:not(.boite--absente)'),
    null, { timeout: 8000 });
  await page.waitForFunction(() => document.querySelector('#chp5-plancheCredit').classList.contains('planche-credit--visible'));
  assert.match(await page.locator('#chp5-plancheCredit').innerText(), /A\., étudiante/);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'chp5-plancheCroix');
  assert.ok(Number(await page.locator('#arrow-chp5').evaluate(el => getComputedStyle(el).opacity)) < 0.05,
    'la flèche s’efface devant la planche');
  await sleep(2600);
  // Plein écran : ni obscurité ni torche sur la planche.
  assert.ok(Number(await page.locator('#chp5-inhumation .inhumation-ombre').evaluate(el => getComputedStyle(el).opacity)) < 0.05);
  assert.ok(Number(await page.locator('#chp5-inhumationTorche').evaluate(el => getComputedStyle(el).opacity)) < 0.05);
  await page.screenshot({ path: '.chrome-test/chapter5-inhumation-planche.png' });

  // Échap : la voix se tait (vidée), la planche redescend, la rangée revient.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#chp5-stage').classList.contains('inhumation-inhume'));
  assert.equal(await page.evaluate(() => window.voixDrapeau.paused && !window.voixDrapeau.getAttribute('src')), true,
    'la voix du drapeau est vidée à la fermeture');
  await page.evaluate(() => { delete window.voixDrapeau; });
  await page.waitForFunction(() => document.querySelectorAll('#chp5-tombes .boite--petite.boite--prete:not(.boite--absente)').length === 5,
    null, { timeout: 10000 });
  await sleep(600);

  // Une tombe ordinaire ne fait pas monter la planche, et garde le voile commun.
  await page.locator('#chp5-tombes .boite--petite').first().click();
  await page.waitForFunction(() => document.querySelector('#chp5-doc').classList.contains('doc--ouvert'));
  assert.equal(await page.locator('#chp5-stage').evaluate(el => el.classList.contains('inhumation-inhume')), false);
  await page.keyboard.press('Escape');
  await sleep(600);

  await page.locator('#arrow-chp5').click();
  await page.waitForFunction(() => !document.querySelector('#chp5-stage').classList.contains('hors-salle'),
    null, { timeout: 25000 });
  assert.equal(await page.locator('#chp5-stage').evaluate(el => el.classList.contains('inhumation-en-jeu')), false);
  assert.equal(await page.locator('#chp5-nuit').evaluate(el => el.style.opacity), '0');
  assert.equal(await page.locator('#chp5-tombes .boite:not(.boite--absente)').count(), 0, 'les tombes se sont effacées');
  await page.waitForFunction(
    () => /devenir du corps/i.test(document.getElementById('chapitre-subtitle').textContent),
    null, { timeout: 20000 });
  await sleep(2600);
  console.log('OK : l\'inhumation du sous-chapitre 3 — noir, voix sans interface, « Passer », bascule, retour.');
  await clickMoving(page, '#chp5-audio-1 button');
  await page.waitForFunction(() => !document.querySelector('#chp5-audio1').paused);
  await page.waitForFunction(() => document.querySelector('#chp5-audio-1 button').getAttribute('aria-pressed') === 'true');
  assert.equal(await page.locator('#arrow-chp5').evaluate(el => el.style.opacity), '0');
  // Pause imposée par le navigateur / verrou d'orientation, puis reprise au clic.
  await page.locator('#chp5-audio1').evaluate(audio => audio.pause());
  await page.waitForFunction(() => document.querySelector('#chp5-audio-1 button').getAttribute('aria-pressed') === 'false');
  await clickMoving(page, '#chp5-audio-1 button');
  await page.waitForFunction(() => !document.querySelector('#chp5-audio1').paused);
  await clickMoving(page, '#chp5-audio-2 button');
  await page.waitForFunction(() => document.querySelector('#chp5-audio1').paused && !document.querySelector('#chp5-audio2').paused);
  await clickMoving(page, '#chp5-audio-2 button');
  await page.waitForFunction(() => [...document.querySelectorAll('#chapitre5-root audio')].every(audio => audio.paused));
  await sleep(800);
  console.log('OK : lecture et pause des deux témoignages.');

  // Le plein écran appartient au site et reste utilisable au-dessus du chapitre.
  await page.locator('#fs-btn').click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  await page.locator('#fs-btn').click();
  await page.waitForFunction(() => !document.fullscreenElement);
  console.log('OK : entrée et sortie du plein écran.');
  await page.setViewportSize({ width: 1280, height: 720 });
  await sleep(await page.evaluate(() => window.CONFIG.MAP.draw_duration + 200));
  assert.equal(await page.locator('#chp5-stage').evaluate(el => el.clientWidth), 1280);

  // Le point V doit être allumé et la carte doit pouvoir ramener à collaboration.
  await page.locator('#compass-map').click();
  const current = page.getByRole('button', { name: 'Aller à : V · Le devenir du corps de Soliman al-Halabi', exact: true });
  await current.waitFor();
  assert.equal(await current.locator('circle').last().getAttribute('fill'), 'rgba(255,205,95,0.16)');
  await sleep(1800);
  await page.screenshot({ path: '.chrome-test/chapter5-map.png' });
  await page.getByRole('button', { name: 'Aller à : Espace collaboratif', exact: true }).click();
  await page.waitForFunction(() => window.sceneName === 'collaboration');
  await sleep(2400);
  await page.locator('#compass-map').click();
  await page.getByRole('button', { name: 'Aller à : V · Le devenir du corps de Soliman al-Halabi', exact: true }).click();
  await page.waitForFunction(() => window.sceneName === 'chapitre5');
  await page.waitForFunction(() => !document.querySelector('#chp5-stage').classList.contains('intro-running'));
  await sleep(2400);
  await returnFromArrow(page);

  // Une troisième visite doit remonter ses cinq repères et ses deux audios.
  await enterFromCircle(page);
  assert.equal(await page.locator('#chapitre5-root .callout').count(), 5);
  assert.equal(await page.locator('#chapitre5-root audio').count(), 2);
  await clickMoving(page, '#chp5-audio-1 button');
  await page.waitForFunction(() => !document.querySelector('#chp5-audio1').paused);
  await page.evaluate(() => {
    window.oldChapterAudio = [...document.querySelectorAll('#chapitre5-root audio')];
    window.testBus.emit('navigate', { to: 'collaboration' });
  });
  await page.waitForFunction(() => window.sceneName === 'collaboration');
  assert.equal(await page.evaluate(() => window.oldChapterAudio.every(audio =>
    audio.paused && !audio.isConnected && !audio.getAttribute('src'))), true);
  await page.evaluate(() => { delete window.oldChapterAudio; });
  await context.close();
  console.log('OK : cercle V, titres, audio exclusif, plein écran, carte, trois visites et nettoyage.');

  /* ── L'AMBIANCE SONORE ─────────────────────────────────────────────────
     On ÉCOUTE vraiment : une sonde (AnalyserNode) est branchée sur tout ce
     qui rejoint la destination du contexte audio. Dans le chapitre, seule
     l'ambiance y passe (les témoignages, la voix et le film sont des
     éléments média hors Web Audio) — on évite donc d'ouvrir une prise de
     son pendant qu'on mesure. Les durées sont raccourcies, et l'ambiance de
     la photographie remplacée par une boucle de 8 s pour voir la couture.
     ⚠️ UNE VRAIE DÉCOUPE, PAS DES OCTETS TRONQUÉS : l'ambiance est lue en
     flux par un <audio>, qui croit la durée annoncée par l'en-tête du
     fichier — tronqué, il annoncerait encore 69 s. La boucle courte
     (tools/bench/fixtures/ambiance-courte.mp3) se refait par :
       ffmpeg -ss 9 -i Chapitre5/chp5-medias/ambiance-ouverture.mp3 -t 8 -c:a copy ambiance-courte.mp3
       (de 9 à 17 s : un passage SANS les coupures d’un dixième de seconde
       que le morceau a ailleurs, qui feraient croire à un trou de couture) */
  const ecoute = await prepare();
  const filetFrontiere = [];
  ecoute.page.on('console', message => {
    if (/encore en lecture/.test(message.text())) filetFrontiere.push(message.text());
  });
  const boucleCourte = fs.readFileSync('tools/bench/fixtures/ambiance-courte.mp3');
  await ecoute.page.route('**/ambiance-ouverture.mp3',
    route => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: boucleCourte }));
  await ecoute.page.evaluate(async () => {
    const { CONFIG } = await import('/Chapitre5/chp5-src/chp5-config.js');
    Object.assign(CONFIG.ambiance, { silenceMs: 3000, premiereEntreeMs: 600, entreeMs: 500, sortieMs: 400, croiseMs: 1500 });
    const relier = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (cible, ...reste) {
      const rendu = relier.call(this, cible, ...reste);
      if (cible instanceof AudioDestinationNode) {
        if (!window.sonde || window.sonde.context !== this.context) {
          window.sonde = this.context.createAnalyser();
          window.sonde.fftSize = 2048;
        }
        relier.call(this, window.sonde);
      }
      return rendu;
    };
    // Les lecteurs <audio> de l'ambiance, et l'instant (horloge audio) où
    // chacun part : deux par piste, qui se relaient à chaque couture.
    window.passes = [];
    window.lecteursAmbiance = new Set();
    const lire = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      if (/ambiance-/.test(this.src)) {
        window.passes.push(window.sonde?.context.currentTime ?? 0);
        window.lecteursAmbiance.add(this);
      }
      return lire.apply(this, args);
    };
    window.ambianceQuiJoue = () => [...window.lecteursAmbiance].filter(el => !el.paused).length;
    // Les niveaux (RMS) sur `ms`, datés à l'horloge audio : [[t, rms], …].
    window.serie = ms => new Promise(resolve => {
      const donnees = new Float32Array(2048);
      const releves = [];
      const fin = performance.now() + ms;
      const mesurer = () => {
        if (window.sonde) {
          window.sonde.getFloatTimeDomainData(donnees);
          const rms = Math.sqrt(donnees.reduce((s, v) => s + v * v, 0) / donnees.length);
          releves.push([window.sonde.context.currentTime, rms]);
        } else releves.push([0, 0]);
        if (performance.now() < fin) setTimeout(mesurer, 40);
        else resolve(releves);
      };
      mesurer();
    });
    // Le niveau le plus FORT et le plus FAIBLE sur `ms`.
    window.niveaux = async ms => {
      const rms = (await window.serie(ms)).map(([, r]) => r);
      return { haut: Math.max(...rms), bas: Math.min(...rms) };
    };
  });
  const ambianceVoulue = () => ecoute.page.evaluate(() => document.querySelector('#chapitre5-root')?.dataset.ambiance);
  const attendreAmbiance = (nom, timeout = 15000) => ecoute.page.waitForFunction(
    nom => document.querySelector('#chapitre5-root')?.dataset.ambiance === nom, nom, { timeout });
  const niveaux = ms => ecoute.page.evaluate(ms => window.niveaux(ms), ms);
  const SILENCE = 0.002, AUDIBLE = 0.004;

  // LE LONG SILENCE DE L'ENTRÉE : la photographie s'installe sans un son.
  await ecoute.page.locator('#roman-circles [role="button"]').nth(4).click();
  await ecoute.page.waitForFunction(() => window.sceneName === 'chapitre5');
  assert.equal(await ambianceVoulue(), '', 'rien ne joue pendant le long silence');
  assert.ok((await niveaux(1500)).haut < SILENCE, 'le long silence est un silence');
  await attendreAmbiance('ouverture');
  await sleep(900);
  assert.ok((await niveaux(800)).haut > AUDIBLE, 'l’ambiance de la photographie doit s’entendre');

  // LA BOUCLE SE REFERME SANS TROU : la piste (tronquée à ~8 s) repart en
  // chevauchant sa fin. On ne juge que la COUTURE (le chevauchement) : le
  // fichier a ses propres coupures d'un dixième de seconde, qui sont sa
  // rythmique et non un défaut.
  const passesAvant = await ecoute.page.evaluate(() => window.passes.length);
  const releves = await ecoute.page.evaluate(() => window.serie(9500));
  const passes = await ecoute.page.evaluate(() => window.passes);
  assert.ok(passes.length > passesAvant, 'la boucle doit relancer une passe');
  const couture = passes[passesAvant];
  const pendantCouture = releves.filter(([t]) => t > couture + 0.05 && t < couture + 1.45).map(([, r]) => r);
  assert.ok(pendantCouture.length > 10, 'la couture n’a pas été écoutée');
  assert.ok(Math.min(...pendantCouture) > SILENCE / 4,
    'un trou à la couture de la boucle (' + Math.min(...pendantCouture).toFixed(4) + ')');

  // UN TÉMOIGNAGE QU'ON ÉCOUTE l'éteint ; en pause, elle revient.
  await ecoute.page.waitForFunction(() => !document.querySelector('#chp5-stage').classList.contains('intro-running'));
  await clickMoving(ecoute.page, '#chp5-audio-1 button');
  await ecoute.page.waitForFunction(() => !document.querySelector('#chp5-audio1').paused);
  assert.equal(await ambianceVoulue(), '');
  await sleep(600);
  assert.ok((await niveaux(500)).haut < SILENCE, 'l’ambiance doit se taire sous un témoignage');
  await clickMoving(ecoute.page, '#chp5-audio-1 button');
  await attendreAmbiance('ouverture');
  await sleep(700);
  assert.ok((await niveaux(600)).haut > AUDIBLE, 'l’ambiance doit revenir après le témoignage');

  // LECTURE ET PAUSE EN RAFALE : la dernière intention gagne, et rien ne se
  // double (une piste = ses passes, au plus deux pendant une couture).
  await ecoute.page.evaluate(async () => {
    for (let i = 0; i < 4; i++) {
      document.querySelector('#chp5-audio-1 button').click();
      await new Promise(r => setTimeout(r, 120));
    }
  });
  await ecoute.page.waitForFunction(() => document.querySelector('#chp5-audio1').paused);
  await attendreAmbiance('ouverture');
  await sleep(1200);
  const quiJouent = await ecoute.page.evaluate(() => window.ambianceQuiJoue());
  assert.ok(quiJouent >= 1 && quiJouent <= 2, 'lecteurs d’ambiance en lecture après une rafale : ' + quiJouent);

  // LA PORTE : silence pendant le passage, sa bande-son à l'arrivée.
  await ecoute.page.locator('#chp5-nav-1 .nav-link').focus();
  await ecoute.page.keyboard.press('Enter');
  assert.equal(await ambianceVoulue(), '', 'la photographie se tait dès le clic');
  await attendreAmbiance('porte', 25000);
  assert.equal(await ecoute.page.evaluate(() => document.getElementById('arrow-chp5').style.opacity), '1',
    'la bande-son du lieu monte avec l’arrivée, pas avant');
  await sleep(700);
  assert.ok((await niveaux(1000)).haut > AUDIBLE, 'l’ambiance de la porte doit s’entendre');
  await ecoute.page.locator('#arrow-chp5').click();
  await attendreAmbiance('', 3000);
  await attendreAmbiance('ouverture', 25000);
  await sleep(2600);

  // LA VITRINE : sa bande-son ; un TEXTE se lit dessous, elle reste.
  await ecoute.page.locator('#chp5-nav-2 .nav-link').focus();
  await ecoute.page.keyboard.press('Enter');
  await attendreAmbiance('vitrine', 25000);
  await sleep(700);
  assert.ok((await niveaux(1000)).haut > AUDIBLE, 'l’ambiance de la vitrine doit s’entendre');
  await ecoute.page.waitForFunction(() => document.querySelectorAll('#chp5-boites .boite--grande.boite--prete').length === 2,
    null, { timeout: 15000 });
  await ecoute.page.locator('#chp5-boites .boite--grande').first().focus();
  await ecoute.page.keyboard.press('Enter');
  await ecoute.page.waitForFunction(() => document.querySelectorAll('#chp5-boites .boite--petite.boite--prete').length >= 8,
    null, { timeout: 15000 });
  await ecoute.page.locator('#chp5-boites .boite--petite').nth(7).click();   // le texte (PDF UNESCO)
  await ecoute.page.waitForFunction(() => document.querySelector('#chp5-doc').classList.contains('doc--ouvert'));
  await sleep(500);
  assert.equal(await ambianceVoulue(), 'vitrine', 'un texte se lit sous l’ambiance');
  await ecoute.page.keyboard.press('Escape');
  await ecoute.page.locator('#chp5-boites .boite--petite').first().click();  // un film : elle se tait
  await attendreAmbiance('');
  await ecoute.page.keyboard.press('Escape');
  await attendreAmbiance('vitrine');
  await sleep(600);
  await ecoute.page.locator('#arrow-chp5').click();
  await attendreAmbiance('', 3000);
  await attendreAmbiance('ouverture', 25000);
  await sleep(2600);

  // VERS UN SOUS-CHAPITRE : elle s'éteint au clic, et la voix d'Alicia se
  // joue dans le silence ; la bande-son du « 3 » ne monte qu'à l'arrivée.
  await ecoute.page.locator('#chp5-nav-3 .nav-link').focus();
  await ecoute.page.keyboard.press('Enter');
  assert.equal(await ambianceVoulue(), '');
  await ecoute.page.waitForFunction(() => document.querySelector('#chp5-passer').classList.contains('passer--visible'),
    null, { timeout: 30000 });
  assert.equal(await ambianceVoulue(), '', 'pas d’ambiance sous la voix d’Alicia');
  assert.ok((await niveaux(500)).haut < SILENCE, 'la voix d’Alicia se joue dans le silence');
  await ecoute.page.keyboard.press('Enter');
  await attendreAmbiance('inhumation');
  await sleep(900);
  assert.ok((await niveaux(1200)).haut > AUDIBLE / 2, 'l’ambiance du « 3 » doit s’entendre');

  // UNE PIÈCE QUI PARLE (le film D) l'éteint ; refermée, elle revient.
  await ecoute.page.waitForFunction(() => document.querySelectorAll('#chp5-tombes .boite--petite.boite--prete').length === 5,
    null, { timeout: 10000 });
  await ecoute.page.locator('#chp5-tombes .boite--petite').nth(4).click();
  await attendreAmbiance('');
  await ecoute.page.keyboard.press('Escape');
  await attendreAmbiance('inhumation');
  // LA PLANCHE aussi.
  await ecoute.page.locator('#chp5-tombes .boite--petite').nth(2).click();
  await attendreAmbiance('');
  await ecoute.page.keyboard.press('Escape');
  await attendreAmbiance('inhumation');

  // LE RETOUR : silence pendant le chemin, la photographie à l'arrivée.
  await ecoute.page.waitForFunction(() => document.getElementById('arrow-chp5').style.opacity === '1',
    null, { timeout: 8000 });
  await ecoute.page.locator('#arrow-chp5').click();
  await attendreAmbiance('', 3000);          // la flèche relaie son clic après son effet
  assert.equal(await ecoute.page.locator('#chp5-stage').evaluate(el => el.classList.contains('hors-salle')), true,
    'le silence tombe pendant le chemin du retour, pas après');
  await attendreAmbiance('ouverture', 25000);

  // LE DÉPART PAR LA CARTE (n'importe quelle destination) : tous les lecteurs
  // du chapitre sont arrêtés ET VIDÉS avant la frontière — dont le filet ne
  // doit en trouver aucun en lecture (il le dirait en console).
  await sleep(800);
  await ecoute.page.evaluate(() => window.testBus.emit('navigate', { to: 'collaboration' }));
  await ecoute.page.waitForFunction(() => window.sceneName === 'collaboration');
  await sleep(400);
  assert.equal(await ecoute.page.evaluate(() =>
    [...window.lecteursAmbiance].every(el => el.paused && !el.getAttribute('src'))), true,
    'un lecteur d’ambiance survit au départ du chapitre');
  assert.deepEqual(filetFrontiere, [], 'le filet de frontière a trouvé une ambiance encore en lecture');
  await ecoute.context.close();
  console.log('OK : l\'ambiance sonore — long silence, boucle sans couture, témoignage, rafale, porte, vitrine (texte dessous, film qui l’éteint), voix, pièce, planche, retour, départ.');

  /* ── LA CARTE : LES SOUS-CHAPITRES, ET LES TITRES EN PARTANT ─────────────
     Chaque sous-chapitre est un point (`chp5-porte`…). Depuis une autre scène
     on y entre DIRECTEMENT — ni introduction ni photographie, le rideau se
     lève sur le noir ; d'un sous-chapitre à l'autre, on passe PAR LE NOIR,
     sans que la salle reparaisse. Et en quittant une scène par la carte, le
     titre qu'on quitte ne se réécrit pas s'il va changer, le sous-titre
     jamais — et le titre d'arrivée finit ENTIER. Le journal est tenu à chaque
     image : un défaut d'une image s'y voit. */
  const carte = await prepare();
  await carte.page.evaluate(async () => {
    // Par Journey lui-même : il garde sa mémoire en cache après la première
    // visite, un localStorage écrit maintenant ne serait pas relu.
    const Journey = await import('/src/systems/Journey.js');
    ['vitrine', 'chapitre5', 'chp5-porte', 'chp5-vitrine', 'chp5-inhumation'].forEach(Journey.visit);
    const op = el => el ? +getComputedStyle(el).opacity : -1;
    window.journal = [];
    const tick = () => {
      const titre = document.getElementById('site-title');
      const sous = document.getElementById('chapitre-subtitle');
      const stage = document.getElementById('chp5-stage');
      window.journal.push({
        t: performance.now(),
        titre: titre.textContent.replace(/ /g, ' '),
        vus: [...titre.querySelectorAll('.char')].filter(s => op(s) > 0.5).length,
        total: titre.querySelectorAll('.char').length,
        sous: op(sous) > 0.5 ? sous.textContent : '',
        nuit: op(document.getElementById('chp5-nuit')),
        rideau: !!document.getElementById('chp5-boot'),
        stage: stage?.className ?? '',
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const ouvrirCarte = async () => {
    await carte.page.waitForFunction(() => {
      const el = document.getElementById('compass-map');
      return el?.classList.contains('visible') && el.style.opacity === '1' && el.style.pointerEvents !== 'none';
    }, null, { timeout: 40000 });
    await sleep(await carte.page.evaluate(() => window.CONFIG.MAP.draw_duration + 200));
    await carte.page.locator('#compass-map').click();
    // Le cadre ne se trace qu'une fois les titres partis.
    await carte.page.waitForSelector('#compass-map .cm-node');
  };
  const allerA = async libelle => {
    const t0 = await carte.page.evaluate(() => performance.now());
    await carte.page.getByRole('button', { name: 'Aller à : ' + libelle, exact: true }).click();
    return t0;
  };
  const journal = t0 => carte.page.evaluate(t0 => window.journal.filter(e => e.t >= t0), t0);
  const flecheRevenue = () => carte.page.waitForFunction(() =>
    document.getElementById('arrow-chp5')?.style.opacity === '1', null, { timeout: 40000 });
  const pointAllume = () => carte.page.evaluate(() => [...document.querySelectorAll('.cm-node')]
    .find(g => g.querySelector('circle:last-child').getAttribute('fill') !== 'none')?.dataset.id);
  const CHP5_TITRES = await carte.page.evaluate(async () =>
    (await import('/Chapitre5/chp5-src/chp5-config.js')).CONFIG.cartels.sousChapitres.map(s => s.titre));
  const sousTitresVus = j => j.map(e => e.sous).filter((v, i, a) => v && v !== a[i - 1]);

  // 1. Espace collaboratif → la vitrine du « 2 », directement.
  await ouvrirCarte();
  let t0 = await allerA('Restituer les restes osseux de Soliman al-Halabi ?');
  await carte.page.waitForFunction(() => window.sceneName === 'chapitre5');
  await carte.page.waitForFunction(() => document.querySelector('#chp5-stage')?.classList.contains('vitrine-en-jeu'),
    null, { timeout: 30000 });
  await flecheRevenue();
  let j = await journal(t0);
  const leve = j.filter(e => e.stage && !e.rideau);
  assert.equal(leve.some(e => /intro-fade/.test(e.stage)), false, 'l’introduction s’est jouée pour une arrivée directe');
  assert.equal(Math.min(...leve.filter(e => !/vitrine-en-jeu/.test(e.stage)).map(e => e.nuit)), 1,
    'la photographie s’est vue avant la vitrine');
  assert.deepEqual(sousTitresVus(j), [CHP5_TITRES[1]], 'le sous-titre du lieu ne s’écrit pas directement');
  assert.equal(await carte.page.locator('#arrow-chp5').getAttribute('aria-label'),
    await carte.page.evaluate(async () => (await import('/Chapitre5/chp5-src/chp5-config.js')).CONFIG.textes.retourPhotographie));
  await ouvrirCarte();
  assert.equal(await pointAllume(), 'chp5-vitrine');

  // 2. La vitrine → la porte : par le noir, la salle ne reparaît pas.
  t0 = await allerA('Dans les réserves du Musée de l’Homme');
  await carte.page.waitForFunction(() => document.querySelector('#chp5-stage').classList.contains('porte-en-jeu'),
    null, { timeout: 30000 });
  await flecheRevenue();
  j = await journal(t0);
  assert.equal(j.every(e => /hors-salle/.test(e.stage)), true, 'la salle a reparu entre deux sous-chapitres');
  const passage = j.slice(j.findIndex(e => !/vitrine-en-jeu/.test(e.stage)));
  assert.equal(passage[0].nuit, 1, 'le noir ne relie pas la vitrine à la porte');
  // (la carte ouverte éclipse le sous-titre de la vitrine : seul celui de la
  // porte doit paraître — jamais celui de la photographie entre les deux)
  assert.deepEqual(sousTitresVus(j), [CHP5_TITRES[0]], 'le sous-titre de la photographie s’est glissé dans le relais');
  assert.equal(await carte.page.evaluate(() => JSON.parse(localStorage.getItem('soliman.journey.v1')).visited['chp5-porte']), true);

  // 3. La porte → la photographie (le point V).
  await ouvrirCarte();
  assert.equal(await pointAllume(), 'chp5-porte');
  t0 = await allerA('V · Le devenir du corps de Soliman al-Halabi');
  await carte.page.waitForFunction(() => !document.querySelector('#chp5-stage').classList.contains('hors-salle'),
    null, { timeout: 30000 });
  await flecheRevenue();
  await sleep(1800);
  j = await journal(t0);
  assert.equal(j[j.length - 1].sous, await carte.page.evaluate(async () =>
    (await import('/Chapitre5/chp5-src/chp5-config.js')).CONFIG.subtitle));

  // 4. Le chapitre → l'accueil : « Espace collaboratif » ne se réécrit pas
  //    (le titre change), le sous-titre non plus ; le titre du site finit entier.
  await ouvrirCarte();
  await sleep(1200);
  t0 = await allerA('Accueil');
  await carte.page.waitForFunction(() => window.sceneName === 'vitrine', null, { timeout: 30000 });
  await sleep(4000);
  j = await journal(t0);
  const quitte = j.filter(e => e.titre === 'Espace collaboratif');
  const plusBas = Math.min(...quitte.map(e => e.vus));
  const creux = quitte.findIndex(e => e.vus === plusBas);
  assert.equal(Math.max(...quitte.slice(creux).map(e => e.vus)), plusBas, 'le titre qu’on quitte s’est réécrit');
  assert.equal(quitte.slice(creux).some(e => e.sous), false, 'le sous-titre qu’on quitte s’est réécrit');
  const fin = j[j.length - 1];
  assert.equal(fin.vus, fin.total, `le titre d’arrivée n’est pas entier (${fin.vus}/${fin.total})`);
  await carte.context.close();
  console.log('OK : la carte — arrivée directe dans un sous-chapitre, relais par le noir, retour à la photographie, titres qui ne se réécrivent pas en partant.');

  const mobile = await prepare({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  // LA VOIX DE L'INHUMATION, TRONQUÉE À ~2 s : on vérifie qu'à la FIN de la
  // voix la photographie bascule d'elle-même, sans attendre ses 69 secondes.
  const voixCourte = fs.readFileSync('Chapitre5/chp5-medias/inhumation-alicia-1.mp3').subarray(0, 26000);
  await mobile.page.route('**/inhumation-alicia-1.mp3',
    route => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: voixCourte }));
  await enterFromCircle(mobile.page);
  await mobile.page.screenshot({ path: '.chrome-test/chapter5-mobile.png' });
  assert.equal(await mobile.page.locator('#chapitre5-root .callout[inert]').count(), 0);
  await mobile.page.locator('#chp5-nav-1 .nav-link').dispatchEvent('click');
  assert.equal(await mobile.page.locator('#chp5-nav-1').evaluate(el => el.classList.contains('revealed')), true);
  // ⚠️ AU DOIGT, LE PREMIER APPUI NE FAIT QUE RÉVÉLER L'INTITULÉ : sans survol,
  // entrer dès le premier appui ferait entrer dans un sous-chapitre qu'on n'a
  // pas pu lire. C'est le second qui ouvre.
  assert.equal(await mobile.page.locator('#chp5-stage').evaluate(el => el.classList.contains('porte-en-jeu')), false);
  await mobile.page.locator('#chp5-nav-1 .nav-link').dispatchEvent('click');
  await mobile.page.waitForFunction(
    () => /réserves du Musée de l/i.test(document.getElementById('chapitre-subtitle').textContent),
    null, { timeout: 15000 });
  await sleep(600);
  await mobile.page.screenshot({ path: '.chrome-test/chapter5-porte-mobile.png' });
  await mobile.page.locator('#arrow-chp5').click();
  await mobile.page.waitForFunction(() => !document.querySelector('#chp5-stage').classList.contains('hors-salle'),
    null, { timeout: 15000 });
  await sleep(2600);

  // ⚠️ LA VITRINE SOUS « MOUVEMENT RÉDUIT » : la boucle de rendu ne tourne pas.
  // Ni le noir de passage, ni les boîtes, ni l'effacement du crâne ne peuvent
  // en dépendre — tout se POSE au lieu de se jouer.
  await mobile.page.locator('#chp5-nav-2 .nav-link').dispatchEvent('click');
  await mobile.page.locator('#chp5-nav-2 .nav-link').dispatchEvent('click');
  await mobile.page.waitForFunction(() => document.querySelector('#chp5-stage').classList.contains('vitrine-en-jeu'),
    null, { timeout: 40000 });
  await sleep(1200);
  // Une grande boîte s'ouvre d'un coup, une petite ouvre sa pièce au doigt, et
  // en la refermant le crâne perd sa part — sans fondu, puisqu'il n'y en a pas.
  await mobile.page.locator('#chp5-boites .boite--grande').first().dispatchEvent('click');
  await sleep(200);
  assert.equal(await mobile.page.locator('#chp5-boites .boite--petite:not(.boite--absente)').count(), 8,
    'mouvement réduit : l’inventaire s’ouvre quand même');
  await mobile.page.locator('#chp5-boites .boite--petite').first().dispatchEvent('click');
  await sleep(300);
  assert.ok(await mobile.page.locator('#chp5-doc').evaluate(el => el.classList.contains('doc--en-jeu')),
    'mouvement réduit : la pièce s’ouvre au doigt');
  await mobile.page.locator('#chp5-docCroix').dispatchEvent('click');
  await sleep(200);
  const presenceReduite = await mobile.page.locator('#chp5-vitrinePlein').evaluate(el => Number(getComputedStyle(el).opacity));
  assert.ok(Math.abs(presenceReduite - 0.9) < 0.02,
    `mouvement réduit : le crâne perd sa part d'un coup (il est à ${presenceReduite.toFixed(3)})`);
  await mobile.page.screenshot({ path: '.chrome-test/chapter5-vitrine-mobile.png' });
  await mobile.page.locator('#arrow-chp5').click();
  await mobile.page.waitForFunction(() => !document.querySelector('#chp5-stage').classList.contains('hors-salle'),
    null, { timeout: 25000 });
  await sleep(2600);

  // L'INHUMATION AU DOIGT, EN MOUVEMENT RÉDUIT, ET LA VOIX QU'ON LAISSE FINIR.
  await mobile.page.locator('#chp5-nav-3 .nav-link').dispatchEvent('click');
  await mobile.page.locator('#chp5-nav-3 .nav-link').dispatchEvent('click');
  await mobile.page.waitForFunction(() => document.querySelector('#chp5-stage').classList.contains('inhumation-en-jeu'),
    null, { timeout: 40000 });
  await mobile.page.waitForFunction(() => document.querySelector('#chp5-stage').classList.contains('inhumation-bascule'),
    null, { timeout: 20000 });
  await mobile.page.waitForFunction(() => document.getElementById('arrow-chp5').style.opacity === '1',
    null, { timeout: 8000 });
  // En mouvement réduit, la rangée est POSÉE, et le drapeau ouvre sa voix
  // (et la planche) quand même.
  await mobile.page.waitForFunction(() => document.querySelectorAll('#chp5-tombes .boite--petite.boite--prete').length === 5);
  await mobile.page.locator('#chp5-tombes .boite--petite').nth(2).dispatchEvent('click');
  await mobile.page.waitForFunction(() => document.querySelector('#chp5-stage').classList.contains('inhumation-inhume'));
  await mobile.page.locator('#chp5-plancheCroix').dispatchEvent('click');
  await mobile.page.waitForFunction(() => !document.querySelector('#chp5-stage').classList.contains('inhumation-inhume'));
  await mobile.page.screenshot({ path: '.chrome-test/chapter5-inhumation-mobile.png' });
  await mobile.page.locator('#arrow-chp5').click();
  await mobile.page.waitForFunction(() => !document.querySelector('#chp5-stage').classList.contains('hors-salle'),
    null, { timeout: 25000 });
  await sleep(2600);
  await returnFromArrow(mobile.page);
  await mobile.context.close();
  console.log('OK : paysage tactile, porte au doigt, vitrine et inhumation en mouvement réduit.');
  assert.deepEqual(errors, [], 'Erreurs navigateur / ressources');
} finally {
  await browser.close();
}
