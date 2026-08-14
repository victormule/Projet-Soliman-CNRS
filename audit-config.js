#!/usr/bin/env node
/**
 * audit-config.js — le garde-fou des réglages.
 * ─────────────────────────────────────────────────────────────────────────────
 *   node audit-config.js
 *
 * CE QU'IL CHERCHE (la règle posée dans CLAUDE.md) :
 *
 *   1. CLÉS MORTES   — une clé de config que personne ne lit. Un réglage qui
 *                      n'agit pas n'a rien à faire dans la config : on croit le
 *                      régler, il ne fait rien. L'audit de juillet 2026 en avait
 *                      retiré une quinzaine (dont trois tailles de torche).
 *
 *   2. REVENANTS     — du code qui lit une clé ABSENTE de la config. Le repli
 *                      silencieux (`?? 0.82`) gagne alors sans le dire, et le
 *                      vrai réglage semble ne servir à rien.
 *
 * ⚠️ LE PIÈGE DES ALIAS LOCAUX — et pourquoi cet outil cherche par NOM.
 *
 * Le code lit la config sous des noms courts :
 *     const C = this.config.COLLABORATION.circles;   …puis C.gap_vh
 * Chercher « COLLABORATION.gap_vh » dans les sources ne prouve donc RIEN : une
 * clé peut sembler morte tout en tenant une scène entière. C'est ainsi que la
 * copie CONFIG.COLLAB a failli être supprimée avec ses six lecteurs vivants —
 * les cercles romains, donc l'accès aux chapitres.
 *
 * On cherche donc `.gap_vh` (le NOM seul), jamais le chemin complet.
 *
 * CONSÉQUENCE ASSUMÉE : un nom porté par plusieurs sections (`size_min`,
 * `family`…) est considéré comme lu dès qu'UN lecteur existe quelque part.
 * L'outil est délibérément PRUDENT : il préfère taire un doute que suggérer une
 * suppression dangereuse. Il ouvre une enquête, il ne tranche pas.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = __dirname;

/* ── Sources à fouiller ───────────────────────────────────────────────────── */

const SKIP_DIRS = new Set(['node_modules', '.git']);
const CODE_EXT  = new Set(['.js', '.css', '.html']);

function collectFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectFiles(p, out);
    } else if (CODE_EXT.has(path.extname(entry.name))) {
      out.push(p);
    }
  }
  return out;
}

/* ── Chargement de config.js (script classique → window.CONFIG) ───────────── */

function loadTransversalConfig() {
  const src = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'config.js' });
  return sandbox.window.CONFIG || null;
}

/* ── Parcours des clés ────────────────────────────────────────────────────── */

/**
 * @returns {Array<{path:string, name:string, type:string}>} feuilles de l'objet
 */
function walkKeys(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? prefix + '.' + k : k;
    const isPlainObject = v && typeof v === 'object' && !Array.isArray(v)
                          && typeof v !== 'function';
    out.push({ path: full, name: k, type: Array.isArray(v) ? 'array' : typeof v });
    if (isPlainObject) walkKeys(v, full, out);
  }
  return out;
}

/* ── Recherche des lecteurs ───────────────────────────────────────────────── */

/**
 * Index des sources. config.js est mis à part : on l'exclut des lecteurs
 * « extérieurs » (sinon chaque DÉFINITION compterait comme une lecture), mais
 * on le garde pour détecter ses références INTERNES — `sideColPx()` appelle
 * `this.docBtnWidthPx()` sans que personne d'autre ne le fasse.
 */
function buildReaderIndex(files) {
  const blobs = [];
  let selfText = '';
  for (const f of files) {
    const base = path.basename(f);
    if (base === 'audit-config.js') continue;
    const text = fs.readFileSync(f, 'utf8');
    if (base === 'config.js' && path.dirname(f) === ROOT) { selfText = text; continue; }
    blobs.push({ file: path.relative(ROOT, f), text });
  }
  return { blobs, selfText };
}

function readersOf(name, blobs, selfText) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 1. Accès par nom : `.nom` (direct ou via alias local), `['nom']`,
  //    ou destructuration `const { nom } = …`.
  const direct = new RegExp(
    `\\.${esc}\\b|\\[\\s*['"\`]${esc}['"\`]\\s*\\]|\\{[^}\\n]*\\b${esc}\\b[^{\\n]*\\}\\s*=`, '');

  // 2. ACCÈS DYNAMIQUE. Certaines clés ne sont jamais écrites en dur dans le
  //    code : leur nom voyage comme DONNÉE (DOCS.actions = ['doc-1', …], puis
  //    DOCUMENTS[key]). Si le nom apparaît comme chaîne littérale quelque part,
  //    on le tient pour potentiellement lu — prudence assumée.
  const asString = new RegExp(`['"\`]${esc}['"\`]`, '');

  const hits = [];
  for (const b of blobs) {
    if (direct.test(b.text) || asString.test(b.text)) hits.push(b.file);
  }

  // 3. RÉFÉRENCE INTERNE à config.js (`this.nom(...)` entre deux helpers).
  if (hits.length === 0 && selfText) {
    if (new RegExp(`this\\.${esc}\\b`, '').test(selfText)) hits.push('config.js (interne)');
  }
  return hits;
}

/* ── Rapport ──────────────────────────────────────────────────────────────── */

function main() {
  const CONFIG = loadTransversalConfig();
  if (!CONFIG) {
    console.error('audit-config : window.CONFIG introuvable après évaluation de config.js.');
    process.exit(2);
  }

  const files = collectFiles(ROOT);
  const { blobs, selfText } = buildReaderIndex(files);
  const keys  = walkKeys(CONFIG);

  const dead = [];
  for (const k of keys) {
    const hits = readersOf(k.name, blobs, selfText);
    if (hits.length === 0) dead.push(k);
  }

  console.log('audit-config — ' + keys.length + ' clés dans config.js, '
              + blobs.length + ' fichiers fouillés\n');

  if (dead.length === 0) {
    console.log('✔ Aucune clé morte : chaque réglage a au moins un lecteur.');
  } else {
    console.log('⚠ ' + dead.length + ' clé(s) SANS AUCUN LECTEUR — à vérifier une par une :\n');
    for (const k of dead) {
      console.log('   ' + k.path + '   (' + k.type + ')');
    }
    console.log('\n  Avant de supprimer : relire la note sur les alias locaux en tête');
    console.log('  de ce fichier. Une clé peut être lue sous un nom court. Cherchez');
    console.log('  le NOM dans les sources, pas le chemin.');
  }

  // Un rapport n'est pas un échec de build : l'outil informe, il ne bloque pas.
  process.exit(0);
}

main();
