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
 *   GRAND CÔTÉ max 1280 px (au-delà, un téléphone ne montre rien de plus) ;
 *   CRF 28 (contre ~20 pour un master) ; AAC 96 kb/s ; +faststart, pour que la
 *   lecture démarre sans attendre le fichier entier.
 *
 * ⚠️ LE GRAND CÔTÉ, PAS LA LARGEUR. `sepulture.mp4` est en PORTRAIT
 * (1080×1920). Un `scale='min(1280,iw)'` — qui ne regarde que la largeur — la
 * laissait donc INTACTE : 1080 < 1280, aucune réduction, et la « variante
 * allégée » gardait 2,07 M de pixels quand les autres tombaient à 0,92 M. Deux
 * fois trop lourde, en silence. La cible est calculée ici, en JS, à partir des
 * dimensions lues par ffprobe : c'est plus lisible qu'une expression `if(gt(…))`
 * imbriquée dans le filtre, et le journal peut annoncer la résolution obtenue.
 * On ne SURDIMENSIONNE jamais : une source déjà petite est ré-encodée telle
 * quelle (seul le débit baisse).
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
const WIDTH  = flag('width', '1280');   // plafond du GRAND côté (cf. en-tête)
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

/** Dimensions de la piste vidéo, via ffprobe. */
async function dimensions(src) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', src,
  ]);
  const [w, h] = stdout.trim().split('x').map(Number);
  return { w, h };
}

/**
 * Cible : grand côté ≤ WIDTH, ratio conservé, dimensions PAIRES (H.264 l'exige
 * en 4:2:0). Jamais d'agrandissement — une source déjà petite est rendue telle
 * quelle et ne gagne que la baisse de débit.
 */
function cible({ w, h }, max) {
  const grand = Math.max(w, h);
  if (!grand || grand <= max) return { w, h, reduit: false };
  const k = max / grand;
  const pair = (n) => Math.max(2, Math.round(n * k / 2) * 2);
  return { w: pair(w), h: pair(h), reduit: true };
}

async function main() {
  try { await run('ffmpeg', ['-version']); await run('ffprobe', ['-version']); }
  catch {
    console.error('ffmpeg/ffprobe introuvable dans le PATH.');
    console.error('Celui livré avec Playwright ne convient pas : ni H.264 ni AAC.');
    console.error('Installer ffmpeg : https://ffmpeg.org/download.html');
    process.exit(1);
  }

  const videos = trouverVideos(ROOT).sort();
  if (!videos.length) { console.log('Aucune vidéo trouvée.'); return; }

  const total = videos.reduce((s, f) => s + fs.statSync(f).size, 0);
  console.log(videos.length + ' vidéos originales, ' + mo(total) + ' Mo');
  console.log('Variantes mobiles : grand côté ≤ ' + WIDTH + ' px · CRF ' + CRF
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

    const source = await dimensions(src);
    const but    = cible(source, Number(WIDTH));
    const format = but.w + '×' + but.h + (but.reduit ? '' : ' (inchangé)');

    if (DRY) {
      console.log('  · ' + rel.padEnd(52) + mo(tailleAvant) + ' Mo  '
                  + source.w + '×' + source.h + ' → ' + format);
      avant += tailleAvant;
      continue;
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    process.stdout.write('  → ' + rel.padEnd(52) + format.padEnd(16));
    try {
      await run('ffmpeg', [
        '-y', '-i', src,
        '-vf', `scale=${but.w}:${but.h}:flags=lanczos`,
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
