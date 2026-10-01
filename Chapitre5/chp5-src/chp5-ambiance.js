/**
 * L'AMBIANCE SONORE DU CHAPITRE V — une bande-son par lieu.
 * ═══════════════════════════════════════════════════════════════════════════
 * La photographie des réserves a la sienne, et chacun des trois
 * sous-chapitres la sienne. Ce module ne DÉCIDE rien : le moteur lui dit, à
 * chaque changement de premier plan, quelle bande-son on doit entendre
 * (`vouloir(nom)`, ou `vouloir(null)` pour le silence), et il s'y rend en
 * fondu — la précédente s'éteint pendant que la suivante monte.
 *
 *   creerAmbiance({ audioManager, reglages, temoin })
 *     → { vouloir, precharger, eteindre, destroy }
 *
 * ⚠️ UNE INTENTION, PAS UNE SUITE D'ORDRES. `vouloir()` est idempotent : on
 * peut le rappeler à chaque événement, il ne fait que ce qui manque. C'est la
 * leçon de l'ambiance du chapitre 3 (`ambDesired`) : une piste qu'on allume et
 * qu'on éteint par ordres successifs finit toujours par recevoir les deux dans
 * le mauvais ordre — un témoignage lancé pendant un fondu, un lieu quitté
 * pendant un chargement. Ici la dernière intention gagne, toujours.
 *
 * ⚠️ LUE EN FLUX, PAS DÉCODÉE — ET C'EST UNE MESURE, PAS UN GOÛT. La première
 * version décodait chaque fichier (`decodeAudioData`) pour boucler à
 * l'échantillon près : 69 s de stéréo, ce sont 26 Mo de PCM, et leur arrivée
 * sur le fil principal coûtait des images de 180 à 270 ms — mesurées, pendant
 * que la caméra de la photographie respire. Chaque piste est donc lue par
 * DEUX éléments `<audio>` qui se relaient, branchés dans le graphe du site
 * (`createMediaElementSource`) : rien à décoder d'avance, quelques centaines
 * de Ko en mémoire au lieu de dizaines de Mo — ce qui compte aussi sur un
 * téléphone.
 *
 * ⚠️ LES FONDUS SONT DES `GainNode`, JAMAIS `element.volume` : Safari sur
 * iPhone IGNORE `volume`, un fondu y serait une coupure sèche. Le contexte est
 * celui de l'AudioManager — jamais un second.
 *
 * ⚠️ LES FICHIERS NE BOUCLENT PAS D'EUX-MÊMES. Ils commencent sur un souffle
 * et finissent en fondu : bouclés tels quels (`loop = true`), on entendrait un
 * creux à chaque tour. Les deux lecteurs se relaient donc en se CHEVAUCHANT
 * (`croiseMs`) : l'un repart du début en montant pendant que l'autre s'éteint
 * sur sa fin. Une minuterie déclenche la couture ; en retard (onglet en
 * arrière-plan), le lecteur sortant va simplement jusqu'au bout de son
 * fichier, qui finit déjà en fondu.
 *
 * ⚠️ UNE BANDE-SON QU'ON A QUITTÉE REPREND OÙ ON L'A LAISSÉE. Écouter un
 * témoignage puis revenir à la photographie ne la fait pas recommencer : on
 * retrouve la salle, pas le début du morceau.
 *
 * ⚠️ CHAQUE `<audio>` EST VIDÉ À L'ARRÊT (source retirée, `load()`), comme
 * toute pièce du chapitre : un élément dont la sélection de ressource a
 * commencé reste vivant (règle d'août 2026). Le filet de frontière de
 * l'AudioManager les verrait encore jouer ; il n'a pas à le faire.
 *
 * ⚠️ LE SON EST UN AGRÉMENT. Sans contexte audio (navigateur durci, mode
 * Lockdown) ou si un fichier manque, le chapitre se joue muet, en le disant
 * en console. Rien n'attend jamais ce module.
 */

/** Durée plancher d'un fondu, garde-fou technique et non réglage : un gain
    qui passe d'un coup de sa valeur à zéro s'entend comme un « clic ». */
const ANTI_CLIC_MS = 30;

export function creerAmbiance({ audioManager, reglages, temoin = null }) {
  const A = reglages;
  const ctx = audioManager?.getContext?.() ?? null;
  if (!ctx) console.warn('[chp5] Pas de contexte audio : le chapitre se joue sans ambiance.');

  /** nom → piste préparée d'avance (`precharger`), pas encore jouée. */
  const reserve = new Map();
  /** nom → position (s) où reprendre une bande-son quittée. */
  const positions = new Map();
  /** Les bandes-son qui s'éteignent : on peut encore les rappeler. */
  const sortantes = new Set();

  let voulue = null;      // la DERNIÈRE intention : la seule qui compte
  let courante = null;    // la piste qui monte ou qui joue
  let fermee = false;     // `eteindre()` : plus rien ne se rallume
  let detruite = false;
  if (temoin) temoin.dataset.ambiance = '';   // on entre dans le silence

  /* ── LES FONDUS ───────────────────────────────────────────────────────── */

  function fondre(param, cible, ms) {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(cible, t + Math.max(ms, ANTI_CLIC_MS) / 1000);
  }

  /* ── UNE PISTE : deux lecteurs qui se relaient ────────────────────────── */

  function creerPiste(nom) {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    const piste = { nom, gain, lecteurs: [], actif: 0, minuteries: new Set(), arretee: false, signale: false };
    piste.lecteurs = [0, 1].map(rang => {
      const el = new Audio();
      // Le second lecteur ne sert qu'à la première couture, une minute plus
      // tard : il n'a pas à télécharger en même temps que le premier.
      el.preload = rang === 0 ? 'auto' : 'none';
      el.src = A.pistes[nom].src;
      const enveloppe = ctx.createGain();
      enveloppe.gain.value = 0;
      const source = ctx.createMediaElementSource(el);
      source.connect(enveloppe);
      enveloppe.connect(gain);
      el.onerror = () => {
        if (piste.arretee || piste.signale) return;
        piste.signale = true;    // une fois par piste, pas une fois par tour
        console.warn('[chp5] Ambiance « ' + nom + ' » illisible : ce lieu se jouera sans elle.', el.error);
      };
      const lecteur = { el, source, enveloppe };
      // ⚠️ LE FILET DE LA BOUCLE : un lecteur encore ACTIF qui arrive au bout,
      // c'est que la couture n'a pas eu lieu — minuterie retardée (onglet en
      // arrière-plan), durée mal annoncée par le fichier. Sans ceci, la piste
      // se tairait pour de bon ; on relaie sur-le-champ.
      el.onended = () => {
        if (!piste.arretee && !detruite && piste.lecteurs[piste.actif] === lecteur) relayer(piste, lecteur);
      };
      return lecteur;
    });
    return piste;
  }

  function plusTard(piste, fn, ms) {
    const id = setTimeout(() => { piste.minuteries.delete(id); if (!piste.arretee && !detruite) fn(); }, ms);
    piste.minuteries.add(id);
  }

  /**
   * Fait jouer un lecteur depuis `offset`. `croisee` : il MONTE sur le
   * chevauchement (c'est une couture) — sinon il part plein, et c'est le gain
   * de la piste qui fait le fondu d'entrée.
   */
  function jouer(piste, lecteur, offset, croisee) {
    const { el, enveloppe } = lecteur;
    if (!el.getAttribute('src')) el.src = A.pistes[piste.nom].src;
    el.preload = 'auto';
    try { el.currentTime = offset; } catch { /* pas encore de métadonnées : on part du début */ }
    el.play().then(() => {
      if (piste.arretee || detruite) { el.pause(); return; }
      const t = ctx.currentTime;
      enveloppe.gain.cancelScheduledValues(t);
      enveloppe.gain.setValueAtTime(croisee ? 0 : 1, t);
      if (croisee) enveloppe.gain.linearRampToValueAtTime(1, t + A.croiseMs / 1000);
      programmerCouture(piste, lecteur);
    }, erreur => {
      if (erreur?.name === 'AbortError' || piste.arretee || piste.signale) return;
      piste.signale = true;
      console.warn('[chp5] Ambiance « ' + piste.nom + ' » : lecture refusée.', erreur);
    });
  }

  /** La couture se programme `croiseMs` avant la fin du lecteur actif. */
  function programmerCouture(piste, lecteur) {
    const { el } = lecteur;
    if (!Number.isFinite(el.duration)) return;   // le filet (`onended`) relaiera
    const croise = Math.min(A.croiseMs / 1000, el.duration / 3);
    const reste = el.duration - el.currentTime - croise;
    plusTard(piste, () => {
      if (piste.lecteurs[piste.actif] === lecteur) relayer(piste, lecteur);
    }, Math.max(0, reste * 1000));
  }

  /** La couture : le sortant s'éteint sur sa fin, l'autre repart du début en
      montant. */
  function relayer(piste, sortant) {
    piste.actif = 1 - piste.actif;
    const entrant = piste.lecteurs[piste.actif];
    fondre(sortant.enveloppe.gain, 0, A.croiseMs);
    plusTard(piste, () => { if (piste.lecteurs[piste.actif] !== sortant) sortant.el.pause(); }, A.croiseMs + 200);
    jouer(piste, entrant, 0, true);
  }

  /** Où en est la piste dans son morceau (s), pour y revenir plus tard. */
  function position(piste) {
    const el = piste.lecteurs[piste.actif].el;
    return Number.isFinite(el.currentTime) ? el.currentTime : 0;
  }

  /** Arrêt définitif : lecteurs VIDÉS, nœuds débranchés. */
  function arreter(piste) {
    piste.arretee = true;
    piste.minuteries.forEach(clearTimeout);
    piste.minuteries.clear();
    for (const { el, source, enveloppe } of piste.lecteurs) {
      el.onerror = null;
      el.onended = null;
      el.pause();
      el.removeAttribute('src');
      el.load();
      try { source.disconnect(); enveloppe.disconnect(); } catch { /* déjà débranchés */ }
    }
    try { piste.gain.disconnect(); } catch { /* déjà débranché */ }
  }

  /* ── ALLUMER, ÉTEINDRE ────────────────────────────────────────────────── */

  function demarrer(nom, entreeMs) {
    const piste = reserve.get(nom) ?? creerPiste(nom);
    reserve.delete(nom);
    courante = piste;
    // Reprise là où on l'avait laissée — sauf trop près de la fin, où le
    // lecteur ne jouerait que le temps de sa couture.
    let offset = positions.get(nom) ?? 0;
    const duree = piste.lecteurs[0].el.duration;
    if (Number.isFinite(duree) && duree - offset < 2 * A.croiseMs / 1000) offset = 0;
    jouer(piste, piste.lecteurs[piste.actif], offset, false);
    fondre(piste.gain.gain, A.pistes[nom].volume, entreeMs);
  }

  /** La piste s'éteint en fondu, puis s'arrête — sauf si on la rappelle avant. */
  function relacher(piste, ms) {
    sortantes.add(piste);
    fondre(piste.gain.gain, 0, ms);
    clearTimeout(piste.arret);
    piste.arret = setTimeout(() => {
      sortantes.delete(piste);
      positions.set(piste.nom, position(piste));
      arreter(piste);
    }, Math.max(ms, ANTI_CLIC_MS) + 60);
  }

  /**
   * LA SEULE ENTRÉE DU MOTEUR : ce qu'on doit entendre maintenant.
   * `nom` — une clé de `pistes`, ou `null` pour le silence.
   * `entreeMs` — la durée du fondu si la piste monte (celui de la première
   * ouverture est plus long que les retours).
   */
  function vouloir(nom, entreeMs = A.entreeMs) {
    if (detruite || fermee) return;
    if (nom && !A.pistes[nom]) {
      console.warn('[chp5] Ambiance inconnue « ' + nom + ' » : silence.');
      nom = null;
    }
    if (temoin) temoin.dataset.ambiance = nom ?? '';
    if (nom === voulue) return;
    voulue = nom;
    if (!ctx) return;

    if (courante && courante.nom !== nom) {
      relacher(courante, A.sortieMs);
      courante = null;
    }
    if (!nom || courante) return;

    // Elle s'éteignait encore : on la rappelle, sans couture.
    const rappel = [...sortantes].find(piste => piste.nom === nom);
    if (rappel) {
      sortantes.delete(rappel);
      clearTimeout(rappel.arret);
      courante = rappel;
      fondre(rappel.gain.gain, A.pistes[nom].volume, entreeMs);
      return;
    }
    demarrer(nom, entreeMs);
  }

  /** Préparer d'avance (le premier lecteur commence à télécharger), derrière
      un geste qui laisse le temps — la fin de l'introduction, un passage. */
  function precharger(nom) {
    if (!ctx || detruite || fermee || !A.pistes[nom] || reserve.has(nom)) return;
    if (courante?.nom === nom || [...sortantes].some(piste => piste.nom === nom)) return;
    reserve.set(nom, creerPiste(nom));
  }

  /** La sortie du chapitre : tout s'éteint en `ms`, et plus rien ne revient. */
  function eteindre(ms) {
    if (detruite || fermee) return;
    fermee = true;
    voulue = null;
    if (temoin) temoin.dataset.ambiance = '';
    if (!ctx) return;
    // Celle qui joue ET celles qui s'éteignaient déjà : toutes au rythme du
    // fondu de sortie, pas au leur.
    const pistes = [...sortantes];
    if (courante) pistes.push(courante);
    courante = null;
    for (const piste of pistes) relacher(piste, ms);
  }

  function destroy() {
    if (detruite) return;
    detruite = true;
    if (temoin) delete temoin.dataset.ambiance;
    if (!ctx) return;
    // Après `eteindre()`, le fondu de sortie a eu la durée du noir : tout est
    // à zéro, on arrête SUR-LE-CHAMP — avant la frontière, dont le filet
    // dénoncerait sinon des `<audio>` encore en lecture. Sans lui (entrée
    // avortée, erreur), un dernier fondu de quelques millisecondes : une
    // piste interrompue d'autorité ne se coupe pas sur un clic.
    const pistes = [...sortantes, ...reserve.values()];
    if (courante) pistes.push(courante);
    for (const piste of pistes) {
      clearTimeout(piste.arret);
      if (fermee) { arreter(piste); continue; }
      fondre(piste.gain.gain, 0, ANTI_CLIC_MS);
      piste.minuteries.forEach(clearTimeout);
      piste.minuteries.clear();
      setTimeout(() => arreter(piste), ANTI_CLIC_MS + 20);
    }
    sortantes.clear();
    reserve.clear();
    courante = null;
    positions.clear();
  }

  return { vouloir, precharger, eteindre, destroy };
}
