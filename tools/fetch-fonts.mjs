#!/usr/bin/env node
/**
 * fetch-fonts.mjs — rapatrie les polices Google en local, une fois pour toutes.
 * ─────────────────────────────────────────────────────────────────────────────
 *   node tools/fetch-fonts.mjs
 *
 * POURQUOI
 *
 * Le site chargeait ses six familles depuis fonts.googleapis.com. Deux
 * problèmes, l'un technique et l'autre juridique :
 *
 *   · DISPONIBILITÉ — Google négocie ses fichiers selon l'agent utilisateur.
 *     Le banc d'essai a reçu une URL .woff2 en 404 : sur ce navigateur-là, la
 *     typographie du site tombait en fonte système, sans prévenir.
 *
 *   · RGPD — l'appel à fonts.gstatic.com transmet l'adresse IP du visiteur à
 *     un tiers hors UE, sans consentement. Plusieurs décisions européennes
 *     l'ont sanctionné. Pour un site porté par le CNRS, ce n'est pas un détail.
 *
 * Les licences le permettent : OFL pour Cinzel, Cormorant Garamond, Inter,
 * Old Standard TT et Playfair Display ; Apache 2.0 pour Roboto Condensed.
 * Toutes autorisent l'hébergement local. Le script écrit les licences à côté
 * des fichiers.
 *
 * CE QU'IL FAIT
 *   1. demande à Google la CSS avec un agent moderne (→ woff2, le plus léger) ;
 *   2. ne garde que les sous-ensembles latin et latin-ext (le site est en
 *      français : cyrillique et vietnamien sont du poids mort) ;
 *   3. télécharge chaque fichier dans fonts/ ;
 *   4. écrit fonts/fonts.css avec des chemins locaux.
 *
 * À RELANCER seulement si l'on ajoute une famille ou une graisse — le résultat
 * est versionné, le site n'appelle plus Google au chargement.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT  = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = path.join(ROOT, 'fonts');

/* L'agent d'un Chrome récent : c'est lui qui décide du format servi. Avec un
   agent inconnu, Google renvoie du TTF (trois à cinq fois plus lourd). */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
         + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/* Les familles du site : UNION de ce que demandaient index.html ET les deux
   @import de style.css (qui réclamaient en plus Cormorant Garamond 300 et
   Playfair Display italique 300). Oublier ces graisses-là ferait tomber
   silencieusement les textes concernés sur une approximation. */
const FAMILIES = [
  'Cinzel:wght@400;600',
  'Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400',
  'Inter:wght@300;400;500;600',
  'Old+Standard+TT:ital,wght@0,400;0,700;1,400',
  'Playfair+Display:ital,wght@0,400;0,700;1,400;1,700',
  'Roboto+Condensed:wght@300;400;700',
];

/* Le site est en français : ces deux sous-ensembles suffisent. Garder les
   autres alourdirait le dépôt sans qu'aucun caractère ne s'affiche jamais. */
const SUBSETS = new Set(['latin', 'latin-ext']);

const LICENCES = `Polices embarquées — origines et licences
========================================

Cinzel                 SIL Open Font License 1.1   https://fonts.google.com/specimen/Cinzel
Cormorant Garamond     SIL Open Font License 1.1   https://fonts.google.com/specimen/Cormorant+Garamond
Inter                  SIL Open Font License 1.1   https://fonts.google.com/specimen/Inter
Old Standard TT        SIL Open Font License 1.1   https://fonts.google.com/specimen/Old+Standard+TT
Playfair Display       SIL Open Font License 1.1   https://fonts.google.com/specimen/Playfair+Display
Roboto Condensed       Apache License 2.0          https://fonts.google.com/specimen/Roboto+Condensed

Ces licences autorisent l'hébergement local et la redistribution, y compris
dans un projet non commercial ou institutionnel, à condition de ne pas vendre
les fontes seules et de conserver la mention de licence — c'est l'objet de ce
fichier.

Regénérer : node tools/fetch-fonts.mjs
`;

async function main() {
  fs.mkdirSync(FONTS, { recursive: true });

  const url = 'https://fonts.googleapis.com/css2?'
            + FAMILIES.map((f) => 'family=' + f).join('&')
            + '&display=swap';

  process.stdout.write('CSS Google… ');
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('CSS ' + res.status);
  let css = await res.text();
  console.log('ok (' + Math.round(css.length / 1024) + ' Ko)');

  /* Google précède chaque @font-face d'un commentaire nommant le sous-ensemble
     (/* latin *​/). C'est notre seul moyen de filtrer : on découpe dessus. */
  const blocs = css.split(/\/\*\s*([a-z0-9-]+)\s*\*\//i);
  const gardes = [];
  for (let i = 1; i < blocs.length; i += 2) {
    const sousEnsemble = blocs[i];
    const corps = blocs[i + 1] || '';
    if (SUBSETS.has(sousEnsemble)) gardes.push({ sousEnsemble, corps });
  }
  if (!gardes.length) throw new Error('aucun sous-ensemble latin trouvé — format de la CSS changé ?');

  /* PREMIÈRE PASSE — qui sert quoi.
     Google renvoie parfois une FONTE VARIABLE : un seul fichier couvre toutes
     les graisses demandées, et plusieurs @font-face pointent dessus. Le
     nommer « -400 » serait mensonger (il sert aussi le 600). On repère donc
     les URLs partagées pour les nommer « -var ». Les familles statiques, elles,
     gardent leur graisse dans le nom : là, elle est vraie. */
  const infos = new Map();   // url → { famille, style, sousEnsemble, poids:Set }
  for (const { sousEnsemble, corps } of gardes) {
    const famille = /font-family:\s*'([^']+)'/.exec(corps)?.[1] ?? 'font';
    const style   = /font-style:\s*(\w+)/.exec(corps)?.[1] ?? 'normal';
    const poids   = /font-weight:\s*(\d+)/.exec(corps)?.[1] ?? '400';
    for (const m of corps.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g)) {
      const e = infos.get(m[1]) ?? { famille, style, sousEnsemble, poids: new Set() };
      e.poids.add(poids);
      infos.set(m[1], e);
    }
  }

  let sortie = '';
  const vus = new Map();
  let telecharges = 0, octets = 0;

  for (const { sousEnsemble, corps } of gardes) {
    let bloc = corps;
    const urls = [...corps.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g)].map((m) => m[1]);

    for (const u of urls) {
      let nom = vus.get(u);
      if (!nom) {
        const e = infos.get(u);
        const base = e.famille.toLowerCase().replace(/\s+/g, '-')
                   + '-' + (e.poids.size > 1 ? 'var' : [...e.poids][0])
                   + (e.style === 'italic' ? '-italic' : '')
                   + '-' + e.sousEnsemble;
        nom = base + '.woff2';
        let n = 2;
        while ([...vus.values()].includes(nom)) nom = base + '-' + (n++) + '.woff2';

        const r = await fetch(u, { headers: { 'User-Agent': UA } });
        if (!r.ok) { console.log('  ÉCHEC ' + r.status + '  ' + nom); continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        fs.writeFileSync(path.join(FONTS, nom), buf);
        vus.set(u, nom);
        telecharges++; octets += buf.length;
        console.log('  ' + nom.padEnd(46) + (buf.length / 1024).toFixed(1) + ' Ko'
                    + (e.poids.size > 1 ? '   (variable : ' + [...e.poids].sort().join(', ') + ')' : ''));
      }
      bloc = bloc.split(u).join(nom);
    }
    sortie += '/* ' + sousEnsemble + ' */' + bloc;
  }

  const entete = `/* ═══════════════════════════════════════════════════════════════
   POLICES LOCALES — ne plus jamais appeler fonts.googleapis.com.
   ───────────────────────────────────────────────────────────────
   Fichier GÉNÉRÉ par tools/fetch-fonts.mjs : ne pas l'éditer à la
   main, il serait écrasé. Pour ajouter une famille ou une graisse,
   modifier FAMILIES dans le script et le relancer.

   Sous-ensembles conservés : latin et latin-ext (le site est en
   français). Licences et origines : fonts/LICENCES.txt
   ═══════════════════════════════════════════════════════════════ */

`;
  fs.writeFileSync(path.join(FONTS, 'fonts.css'), entete + sortie.trim() + '\n', 'utf8');
  fs.writeFileSync(path.join(FONTS, 'LICENCES.txt'), LICENCES, 'utf8');

  console.log('\n' + telecharges + ' fichiers, ' + (octets / 1024).toFixed(0) + ' Ko au total');
  console.log('→ fonts/fonts.css   (à lier depuis index.html, à la place de Google)');
}

main().catch((e) => { console.error('ÉCHEC :', e.message); process.exit(1); });
