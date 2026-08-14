#!/usr/bin/env node
/**
 * compress-videos.mjs — allège les vidéos SANS toucher aux originaux.
 * ─────────────────────────────────────────────────────────────────────────────
 *   node tools/compress-videos.mjs            # encode dans _compressed/
 *   node tools/compress-videos.mjs --crf 26   # plus léger, un peu moins fin
 *   node tools/compress-videos.mjs --dry      # liste seulement, n'encode rien
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * Le dépôt porte ~281 Mo de .mp4 (17 fichiers, le plus lourd à 23,5 Mo), sans
 * aucune passe de compression. C'est le premier poste de coût d'hébergement et
 * le premier facteur d'attente réelle pour le public — loin devant tout ce qui
 * touche au code.
 *
 * POURQUOI IL N'ÉCRASE RIEN
 *
 * Le résultat va dans `_compressed/`, jamais sur les masters. Un ré-encodage
 * est irréversible et son réglage est un choix ARTISTIQUE : le grain d'une
 * archive, un fondu au noir, un visage en basse lumière ne survivent pas tous
 * au même CRF. Regardez les fichiers produits avant de remplacer quoi que ce
 * soit — surtout ceux du chapitre 1 et de « Violence et trace », les plus
 * sombres.
 *
 * PRÉ-REQUIS : un vrai ffmpeg dans le PATH (celui fourni par Playwright ne
 * contient que VP8 — ni H.264 ni AAC). https://ffmpeg.org/download.html
 *
 * RÉGLAGES
 *   --crf N     qualité H.264 (défaut 24). 18 = quasi sans perte / très lourd,
 *               23-26 = plage recommandée, 28+ = artefacts visibles.
 *   --preset P  effort d'encodage (défaut 'slow'). Plus lent = plus petit.
 *   --audio K   débit AAC en kb/s (défaut 128).
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run  = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = path.join(ROOT, '_compressed');

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const CRF    = flag('crf', '24');
const PRESET = flag('preset', 'slow');
const ABR    = flag('audio', '128');
const DRY    = argv.includes('--dry');

const SKIP = new Set(['node_modules', '.git', '_compressed']);

function findVideos(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findVideos(p, out);
    else if (/\.mp4$/i.test(e.name)) out.push(p);
  }
  return out;
}

const mb = (n) => (n / 1048576).toFixed(1);

async function main() {
  if (!DRY) {
    try {
      await run('ffmpeg', ['-version']);
    } catch {
      console.error('ffmpeg introuvable dans le PATH.');
      console.error("Celui livré avec Playwright ne convient pas : il n'a ni H.264 ni AAC.");
      console.error('Installer ffmpeg : https://ffmpeg.org/download.html');
      process.exit(1);
    }
  }

  const files = findVideos(ROOT).sort();
  if (!files.length) { console.log('Aucun .mp4 trouvé.'); return; }

  const totalBefore = files.reduce((s, f) => s + fs.statSync(f).size, 0);
  console.log(files.length + ' vidéos, ' + mb(totalBefore) + ' Mo au total');
  console.log('CRF ' + CRF + ' · preset ' + PRESET + ' · audio ' + ABR + 'k'
              + (DRY ? '   [simulation]' : '') + '\n');

  let totalAfter = 0;
  for (const src of files) {
    const rel  = path.relative(ROOT, src);
    const dest = path.join(OUT, rel);
    const before = fs.statSync(src).size;

    if (DRY) { console.log('  ' + mb(before).padStart(6) + ' Mo   ' + rel); continue; }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    process.stdout.write('  ' + rel + ' … ');
    try {
      await run('ffmpeg', [
        '-y', '-i', src,
        '-c:v', 'libx264', '-crf', CRF, '-preset', PRESET,
        '-pix_fmt', 'yuv420p',
        // +faststart : l'index passe en tête du fichier, la lecture démarre
        // sans attendre le téléchargement complet. Indispensable en ligne.
        '-movflags', '+faststart',
        '-c:a', 'aac', '-b:a', ABR + 'k',
        dest,
      ], { maxBuffer: 1 << 26 });
      const after = fs.statSync(dest).size;
      totalAfter += after;
      const gain = (100 * (1 - after / before)).toFixed(0);
      console.log(mb(before) + ' → ' + mb(after) + ' Mo  (−' + gain + ' %)');
    } catch (e) {
      console.log('ÉCHEC — ' + String(e.message).split('\n')[0]);
      totalAfter += before;
    }
  }

  if (!DRY) {
    console.log('\nTotal : ' + mb(totalBefore) + ' → ' + mb(totalAfter) + ' Mo'
                + '  (−' + (100 * (1 - totalAfter / totalBefore)).toFixed(0) + ' %)');
    console.log('Résultats dans _compressed/ — REGARDEZ-LES avant de remplacer les masters.');
  }
}

main();
