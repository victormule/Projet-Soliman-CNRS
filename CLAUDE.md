# Soliman al-Halabi — CNRS / Abounaddara

Site-expérience narratif (SPA JavaScript vanilla, modules ES natifs).
**Aucun build, aucune dépendance** : servir le dossier tel quel suffit.

```bash
# Lancement local (les modules ES interdisent file://)
npx serve .        # ou tout autre serveur statique, puis ouvrir l'URL
```

Dépôt : https://github.com/victormule/Projet-Soliman-CNRS

---

## Carte du site

```
Écran d'accueil (clic → plein écran + déblocage audio)
  └─ vitrine ─(scroll)─ phrenologie ─(scroll)─ collaboration
                                                 │  (3 cercles romains)
                        ┌────────────────────────┼────────────────────┐
                   chapitre1                chapitre2             chapitre3
                   (crâne interactif,       (travelling crânes    (Galerie des
                    9 hotspots médias)       + 3 sous-parties)     Batailles, Kléber)
```

Toutes les navigations passent par `bus.emit('navigate', { to })` →
`SceneManager.go()` : `exit()` de la scène courante (noir garanti) puis
`enter()` de la suivante.

## Arborescence

```
config.js                 Config TRANSVERSALE (script classique → window.CONFIG) :
                          scènes du tronc commun, FONTS, ARROW, PLAYER, AUDIO…
index.html / style.css    Coquille + styles du tronc commun
src/
  app.js                  RACINE DE COMPOSITION : systèmes, UI, scènes, bus
  core/                   Scene (classe de base), SceneManager, EventBus,
                          TransitionManager
  systems/                AudioManager, TorchSystem, BackgroundManager,
                          Chapter1LightSystem, OrientationLock, TouchHover
  ui/                     Flèches (ArrowBase + variantes), MediaPlayer,
                          DocumentOverlay/Loupe, AboutReveal (mise en scène
                          « À Propos »), NavigationBar, Title…
  scenes/                 Une classe par scène (contrat Scene : enter/exit)
Chapitre1/
  chp1-config.js          Config du chapitre (source unique)
  chp1-images/ chp1-medias/
Chapitre2/
  chp2-src/               chp2-config.js · chp2-opening.js (moteur travelling)
                          chp2-invisibilisation.js · chp2-peine-demesuree.js
                          chp2-violence-et-trace.js · chp2-progress.js
                          chp2-dom.js (template DOM) · chp2-data-*.js (éditorial)
  chp2-style/ chp2-images/ chp2-medias/ chp2-fonts/
Chapitre3/
  chp3-src/               chp3-config.js · chp3-opening.js (moteur caméra/tableau)
                          chp3-intro.js (quiz) · chp3-ambiance.js (audio)
                          chp3-atmosphere.js (bokeh+rayons) · chp3-grain.js
                          chp3-utils.js
  chp3-style/ chp3-images/ chp3-medias/
images/ sons/             Assets du tronc commun (vitrine, phrénologie,
                          collaboration, documents)
```

## Le pattern « factory » des chapitres (règle d'or)

Les modules chapitres n'ont **aucun effet de bord au chargement**. Le cycle :

1. La scène (`Chapitre2Scene`/`Chapitre3Scene`) injecte le CSS (`<link>`
   attendus), le DOM (avec rideau noir `#chpX-boot`), attend le décodage de
   l'image maîtresse, puis fait un `import()` **unique, sans cache-bust**.
2. Elle transmet l'AudioManager et les callbacks de flèche, s'abonne au
   signal `chpX:*-ready`, puis appelle `startChapitreX()` → le module monte
   son moteur **contre le DOM fraîchement injecté** (refs DOM résolues à ce
   moment-là, jamais au chargement du module).
3. En sortie, `stopChapitreX()` démonte tout (rAF, listeners trackés,
   audio, canvas) et réarme le montage pour la visite suivante.

**Si tu ajoutes du code dans un module chapitre** : toute ref DOM, tout
listener, toute boucle doit être créée dans `init()`/`mount()` et défaite
dans `stop()`/`destroy()`. Jamais au niveau module.

Le chapitre 1 fait exception : pas de module pont, `Chapitre1Scene` EST le
moteur (elle respecte le contrat `Scene`, dont le nettoyage automatique des
timers/listeners posés via `this.on`/`this.addTimer`).

## Où se règle quoi (sans toucher au code)

| Quoi | Fichier |
|---|---|
| Transversal : polices, flèches, player, volumes, torche, écrans du tronc | `config.js` |
| Chapitre 1 : sous-titre, lumière, timings, **hotspots (zones+médias)** | `Chapitre1/chp1-config.js` |
| Chapitre 2 : sous-titre, bougies, ambiance invisibilisation | `Chapitre2/chp2-src/chp2-config.js` |
| Chapitre 3 : textes, travelling, cercles, **rayons/bokeh**, tableau, quiz | `Chapitre3/chp3-src/chp3-config.js` |

## Où se modifient les TEXTES éditoriaux

- Article « Le meurtrier de Kléber » (l'Humanité 1907) : `Chapitre2/chp2-src/chp2-dom.js`
  (⚠️ deux occurrences : bloc de réserve + `<template>`)
- Légendes/crédits des médias de « Peine démesurée » : `chp2-data-peine-demesuree.js`
- Diapos de « La violence et ses traces » : `chp2-data-violence-et-trace.js`
- Quiz d'intro chapitre 3 (question, stats, témoignage) : `chp3-config.js` (section `intro`)
- Citation de sortie du chapitre 2 : `Chapitre2Scene.js` (`_outroQuoteText`)
- Texte « À Propos » (scène phrénologie) : `config.js` (`DOCUMENTS.about`) —
  `hook` = accroche calligraphiée (segments `style:'gold'` / `underline`),
  `paragraphs` = corps (`*…*` met un passage en relief). Moteur :
  `src/ui/AboutReveal.js` (cadences dans la constante `T`), styles dans
  `style.css` (section « À PROPOS »).

## Événements window (pont scène ↔ modules)

| Événement | Émis par | Écouté par |
|---|---|---|
| `chp2:opening-ready` / `chp3:intro-ready` | module | scène (lève le rideau noir) |
| `chp2:navigate-back` / `chp3:navigate-back` | module | scène (navigation réelle) |
| `chp2:<part>-ready`, `<part>:return/:closed` | sous-parties chp2 | scène (flèches) |
| `chp2:request-return` | scène (clic flèche) | sous-partie ouverte |
| `chp2:show/hide-close-cross`, `chp2:close-cross-clicked` | sous-parties ↔ scène | croix média partagée |

## Progression du chapitre 2

Déblocage séquentiel des crânes 136 → 137 → 138 (voir `chp2-progress.js`).
Persisté en localStorage sous la clé `soliman.chp2.progress.v1`.
Rejouer l'expérience « première visite » :
`localStorage.removeItem('soliman.chp2.progress.v1')` puis recharger.

## Décisions d'architecture (Phase 2, juillet 2026)

- **La séquence « tableau » du chapitre 3 reste dans chp3-opening.js** : elle
  écrit l'état caméra (`zoomCam`, `phase`) et pilote `applyScene`/`drawAtmo`
  à chaque frame — c'est la chorégraphie caméra elle-même. L'extraire =
  contexte artificiel à ~10 entrées sans gain de cohésion (commit 9c9a5ff).
- **Les hotspots du chapitre 1 restent dans Chapitre1Scene** : tissés avec la
  lumière, la flèche, le player et les titres de survol ; leurs DONNÉES sont
  dans chp1-config.js. Même logique : la cohésion prime sur la taille.
- **`pointerup` n'endort pas les yeux à la souris** (chp2-invisibilisation) :
  à la souris, pointerup précède `click` ; endormir l'œil ferait ignorer le
  clic (bug historique corrigé, commit 99ac01d). Ne pas « simplifier ».
- config.js reste un **script classique** (pas un module) : il doit exister
  avant tout le graphe ESM. C'est app.js qui enregistre chp1-config dans
  `window.CONFIG.CHAPITRE1` pour les systèmes partagés (TorchSystem,
  MediaPlayer).

## Test manuel de non-régression (après toute modification)

Parcours sur serveur local, console ouverte (zéro erreur attendue) :
1. Accueil (Playfair/Inter) → vitrine → phrénologie (documents + loupe).
2. Collaboration : 3 cercles, survols, titres.
3. **Chapitre 1** : intro sonore (+skip), 9 survols du crâne, 2-3 médias,
   sortie (citation typée).
4. **Chapitre 2** : bougies, les 3 sous-parties (Invisibilisation : vidéo +
   audio sous-titré + texte ; Peine démesurée : mots-clefs → médias ;
   Violence : diapos), retours (rallumage), sortie.
5. **Chapitre 3** : quiz complet → travelling → 1 tableau + théâtre de papier
   (hotspots vidéo) → triptyque → sortie.
6. **Chaque chapitre : entrer/sortir ×2** (le pattern factory doit rejouer
   à l'identique, sans fuite d'état ni son résiduel).

## Notes de déploiement

- Poids : ~300 Mo, dont ~280 Mo de mp4 (limite GitHub : 100 Mo/fichier — le
  plus gros fait ~23 Mo, OK). Compression vidéo envisageable (CRF 23-26).
- Polices : Google Fonts (Cinzel, Playfair Display, Inter, Cormorant
  Garamond, Old Standard TT, Roboto Condensed) — chargement non bloquant
  depuis index.html. Les fontes locales du chapitre 2 sont dans chp2-fonts/.
- Favicon : placeholder `data:,` dans index.html (remplacer par un vrai
  fichier le moment venu).
- Noms de fichiers : **jamais d'espaces, d'accents ni d'apostrophes** dans
  les assets (casse silencieuse possible selon l'hébergeur).
