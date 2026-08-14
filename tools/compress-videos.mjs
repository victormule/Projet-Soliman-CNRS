#!/usr/bin/env node
/**
 * compress-videos.mjs — fabrique les variantes MOBILES des vidéos.
 * ─────────────────────────────────────────────────────────────────────────────
 *   node tools/compress-videos.mjs --dry     # inventaire, n'encode rien
 *   node tools/compress-videos.mjs           # encode ce qui manque
 *   node tools/compress-videos.mjs --force   # ré-encode même l'existant
 *   node tools/compress-videos.mjs --crf 30 --width 960
 *
 * CE QU'IL PRODUIT, ET OÙ
 *
 * À côté de chaque vidéo, un dossier `mobile/` portant le MÊME nom de fichier :
 *
 *   Chapitre2/chp2-medias/Voyeur.mp4            ← l'original, JAMAIS touché
 *   Chapitre2/chp2-medias/mobile/Voyeur.mp4     ← la variante allégée
 *
 * C'est exactement le chemin que `src/utils/media.js` va chercher sur
 * téléphone et tablette. Les deux versions restent côte à côte : on voit d'un
 * coup d'œil ce qui a été décliné et ce qui ne l'a pas encore été.
 *
 * L'ORDINATEUR GARDE L'ORIGINAL. Ce script ne réencode jamais par-dessus les
 * masters : il n'écrit que dans `mobile/`. Une passe ratée ne coûte donc qu'un
 * `rm -rf` des dossiers `mobile/`.
 *
 * RÉGLAGES PAR DÉFAUT — pensés pour un écran de téléphone, pas pour l'archive :
 *   largeur max 1280 px (au-delà, un téléphone ne montre rien de plus) ;
 *   CRF 28 (contre ~20 pour un master) ; AAC 96 kb/s ; +faststart, pour que la
 *   lecture démarre sans attendre le fichier entier.
 *
 * ⚠️ REGARDEZ LE RÉSULTAT. Le CRF est un arbitrage visuel, pas un réglage
 * technique. Les plans sombres — chapitre 1, « Violence et trace » — sont les
 * premiers à montrer des aplats de compression. Si l'un d'eux souffre,
 * réencodez-le seul avec un CRF plus bas.
 *
 * PRÉ-REQUIS : un vrai ffmpeg dans le PATH. Celui fourni par Playwright ne
 * convient pas (ni H.264 ni AAC). https://ffmpeg.org/download.html
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run  = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const flag = (nom, dflt) => {
  const i = argv.indexOf('--' + nom);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const CRF    = flag('crf', '28');
const WIDTH  = flag('width', '1280');
const PRESET = flag('preset', 'slow');
const ABR    = flag('audio', '96');
const DRY    = argv.includes('--dry');
const FORCE  = argv.includes('--force');

const IGNORE = new Set(['node_modules', '.git', '_compressed', 'mobile']);

/** Toutes les vidéos originales (jamais celles déjà dans un dossier mobile/). */
function trouverVideos(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) trouverVideos(p, out);
    else if (/\.mp4$/i.test(e.name)) out.push(p);
  }
  return out;
}

const destinationMobile = (src) =>
  path.join(path.dirname(src), 'mobile', path.basename(src));

const mo = (n) => (n / 1048576).toFixed(1);

async function main() {
  if (!DRY) {
    try { await run('ffmpeg', ['-version']); }
    catch {
      console.error('ffmpeg introuvable dans le PATH.');
      console.error('Celui livré avec Playwright ne convient pas : ni H.264 ni AAC.');
      console.error('Installer ffmpeg : https://ffmpeg.org/download.html');
      process.exit(1);
    }
  }

  const videos = trouverVideos(ROOT).sort();
  if (!videos.length) { console.log('Aucune vidéo trouvée.'); return; }

  const total = videos.reduce((s, f) => s + fs.statSync(f).size, 0);
  console.log(videos.length + ' vidéos originales, ' + mo(total) + ' Mo');
  console.log('Variantes mobiles : largeur ≤ ' + WIDTH + ' px · CRF ' + CRF
              + ' · audio ' + ABR + 'k' + (DRY ? '   [inventaire seul]' : '') + '\n');

  let faits = 0, sautes = 0, avant = 0, apres = 0;

  for (const src of videos) {
    const rel  = path.relative(ROOT, src);
    const dest = destinationMobile(src);
    const tailleAvant = fs.statSync(src).size;

    if (fs.existsSync(dest) && !FORCE) {
      const t = fs.statSync(dest).size;
      console.log('  = ' + rel.padEnd(52) + mo(tailleAvant) + ' → ' + mo(t) + ' Mo   (déjà fait)');
      sautes++; avant += tailleAvant; apres += t;
      continue;
    }

    if (DRY) {
      console.log('  · ' + rel.padEnd(52) + mo(tailleAvant) + ' Mo  → ' + path.relative(ROOT, dest));
      avant += tailleAvant;
      continue;
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    process.stdout.write('  → ' + rel.padEnd(52));
    try {
      await run('ffmpeg', [
        '-y', '-i', src,
        // scale : on réduit SEULEMENT si la vidéo est plus large que la cible
        // (-2 garde le ratio et force une hauteur paire, exigée par H.264).
        '-vf', `scale='min(${WIDTH},iw)':-2`,
        '-c:v', 'libx264', '-crf', CRF, '-preset', PRESET,
        '-profile:v', 'main', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-c:a', 'aac', '-b:a', ABR + 'k', '-ac', '2',
        dest,
      ], { maxBuffer: 1 << 26 });
      const t = fs.statSync(dest).size;
      faits++; avant += tailleAvant; apres += t;
      console.log(mo(tailleAvant) + ' → ' + mo(t) + ' Mo   (−'
                  + (100 * (1 - t / tailleAvant)).toFixed(0) + ' %)');
    } catch (e) {
      console.log('ÉCHEC — ' + String(e.message).split('\n')[0]);
      try { fs.unlinkSync(dest); } catch {}   // pas de fichier tronqué qui traîne
    }
  }

  console.log('');
  if (DRY) {
    console.log('Inventaire : ' + videos.length + ' vidéos, ' + mo(avant) + ' Mo à décliner.');
    console.log('Relancer sans --dry pour encoder.');
  } else {
    console.log(faits + ' encodée(s), ' + sautes + ' déjà présente(s).');
    if (apres) console.log('Mobile : ' + mo(avant) + ' → ' + mo(apres) + ' Mo  (−'
                           + (100 * (1 - apres / avant)).toFixed(0) + ' %)');
    console.log('\nLes originaux sont intacts. REGARDEZ les variantes avant de publier :');
    console.log('les plans sombres (chapitre 1, « Violence et trace ») sont les plus exposés.');
  }
}

main().catch((e) => { console.error('ÉCHEC :', e.message); process.exit(1); });
