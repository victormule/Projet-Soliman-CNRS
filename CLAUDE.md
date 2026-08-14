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
                                                 │  (5 cercles romains, IV ouverts)
              ┌────────────────────┬─────────────┴──────┬────────────────────┐
         chapitre1            chapitre2           chapitre3           chapitre4
         (crâne interactif,   (travelling crânes  (Galerie des        (page blanche,
          9 hotspots médias)   + 3 sous-parties)   Batailles, Kléber)  fissure + 5 bulles)
```
Le cercle V n'a pas encore de chapitre (`COLLABORATION.circles.actions` → `null`).

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
Chapitre4/
  chp4-src/               chp4-config.js · chp4-opening.js (moteur : chorégraphie
                          du dessin + vie du dessin) · chp4-manifest.js (carte de
                          l'œuvre : quel tracé est quoi) · chp4-draw.js (primitives
                          + registre Motion) · chp4-bubbles.js (bulles, écoute)
                          chp4-portal.js (pop-up carte)
  chp4-style/ chp4-images/ chp4-medias/
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

**La règle (audit de juillet 2026)** : un réglage de `config.js` est LU, et lu
d'un seul endroit. **Aucun repli** dans le code ou le CSS ne doit doubler un
chiffre de la config : un repli ne se voit pas, gagne quand la clé manque et
perd toujours quand elle est là — on le règle donc pour rien. Le voile des
documents a vécu avec TROIS valeurs (config `0.80`, JS `?? 0.82`, CSS
`var(…, 0.82)`) dont une seule agissait. Si une clé manque, le code doit le
DIRE (`console.warn`), pas faire semblant ; un garde-fou technique inévitable
se nomme et s'annonce comme tel (cf. `VEIL_GUARD` dans `DocumentOverlay.js`).

Corollaire : un réglage qui n'agit pas n'a rien à faire dans `config.js`.
L'audit en a retiré une quinzaine — dont trois tailles de torche et une
atténuation de torche qu'aucun code ne lisait (`TORCH.taille_phren` disait
`0.22` quand la phrénologie tournait à `0.34`). Garde-fou : `audit-config.js`
(clés mortes, revenants, alias locaux).

⚠️ **Le piège des alias locaux** : le code lit la config sous des noms courts
(`const C = this.config.COLLABORATION.circles`). Chercher `COLLABORATION.gap_vh`
dans le code ne prouve donc RIEN — une clé peut sembler morte tout en tenant une
scène entière. C'est ainsi que la copie `CONFIG.COLLAB` a failli être supprimée
avec ses six lecteurs vivants (les cercles romains, donc l'accès aux chapitres).
Toujours chercher par NOM DE CLÉ, jamais par chemin.

| Quoi | Fichier |
|---|---|
| Transversal : polices, flèches, player, volumes, torche, écrans du tronc | `config.js` |
| Fondu de disparition des flèches (toutes, chapitres compris) | `config.js` → `ARROW.hide_duration` |
| Taille des libellés de boutons : les documents s'unifient sur leur libellé le plus long (`FONTS.doc_btns`) et se coupent en 2 lignes ; « À Propos » se calibre SEUL, TOUJOURS sur 1 ligne (`DOCS.about_size_max`) ; la largeur du bouton (`DOCS.width_max`) reste le vrai plafond | `config.js` |
| Torche de la phrénologie : `PHRENOLOGIE.torch.mode` = `'follow'` (suit le curseur, `size`) ou `'fixed'` (fixe au centre, large, `size_fixed`) | `config.js` |
| Voile derrière un document ouvert : `DOCS.overlay.veil_opacity` (0 = image nue, 1 = noir) et `veil_hides_torch` (la torche s'efface pour qu'on voie l'image ailleurs que dans son halo) | `config.js` |
| Chapitre 1 : sous-titre, lumière, timings, **hotspots (zones+médias)** | `Chapitre1/chp1-config.js` |
| Chapitre 2 : sous-titre, bougies, ambiance invisibilisation | `Chapitre2/chp2-src/chp2-config.js` |
| Chapitre 3 : **sous-titre**, textes, travelling, cercles, **rayons/bokeh**, tableau, quiz | `Chapitre3/chp3-src/chp3-config.js` |
| Chapitre 4 : sous-titre, mise en page (photo/dessin), palette, **chronologie du dessin**, vie du dessin, **libellés + sons des bulles**, carte | `Chapitre4/chp4-src/chp4-config.js` |

Aucun chapitre n'a plus de réglage dans `config.js` (la section `CHAPITRE3`,
qui ne portait que le sous-titre, l'a rejoint chez lui). Chaque scène de
chapitre importe la config de son chapitre **statiquement** — des données pures,
sans effet de bord : c'est ce qui la rend lisible AVANT l'`import()` du moteur,
au moment où le sous-titre paraît. Seul le MOTEUR est en import dynamique.
Il n'y a plus de registre `window.CONFIG.CHAPITRE1` : ses seuls lecteurs étaient
les alias torche supprimés.

## Où se modifient les TEXTES éditoriaux

- Article « Le meurtrier de Kléber » (l'Humanité 1907) : `Chapitre2/chp2-src/chp2-dom.js`
  (⚠️ deux occurrences : bloc de réserve + `<template>`)
- Légendes/crédits des médias de « Peine démesurée » : `chp2-data-peine-demesuree.js`
- Diapos de « La violence et ses traces » : `chp2-data-violence-et-trace.js`
- Quiz d'intro chapitre 3 (question, stats, témoignage) : `chp3-config.js` (section `intro`)
- Libellés des bulles du chapitre 4 (« des MOTS », « LA DIGNITE »…) et sons
  associés : `chp4-config.js` (section `bubbles`) — l'orthographe est celle du
  DESSIN, sans accents sur PLURALITE et DIGNITE ; les ajouter ne demande que de
  les écrire ici (les `<text>` de l'export ne sont pas utilisés)
- Citation de sortie du chapitre 2 : `Chapitre2Scene.js` (`_outroQuoteText`)
- Texte « À Propos » (scène phrénologie) : `config.js` (`DOCUMENTS.about`) —
  `hook` = accroche calligraphiée (segments `style:'gold'` / `underline`),
  `paragraphs` = corps (`*…*` met un passage en relief). Le `?` final de
  l'accroche n'est pas écrit mais APPOSÉ (silence, chute, écrasement, rebond,
  secousse verticale — voir `T.q_*` et `abStamp`) : le geste part du DERNIER
  caractère s'il vaut `?`, donc il suit le texte sans réglage.
  Quand le texte ne tient pas à l'écran (`.is-scroll` — téléphone à
  l'horizontale), les paragraphes 2..n ne pleuvent plus sur la frise cumulée
  mais **à mesure qu'on les atteint** (IntersectionObserver, cadence locale).
  ⚠️ Corollaire : `.ab-settled` tombe alors dès le 1ᵉʳ paragraphe posé — il ne
  peut donc plus désarmer le corps entier (`.ab-pdone` le fait par paragraphe)
  ni éteindre les battements à venir (d'où le `:not(.ab-live)`). Moteur :
  `src/ui/AboutReveal.js` (cadences : `T` pour l'écriture, `OUT` pour la fumée
  de sortie), styles dans `style.css` (section « À PROPOS »).
  ⚠️ La fumée de sortie (UN canvas, lettres redessinées aux positions mesurées
  en recopiant les vignettes d'un ATLAS de glyphes pré-peint — jamais
  d'animation DOM, jamais de `fillText` en vol) précède TOUTE sortie de
  l'« À Propos » posé : fermeture (clic/Escape), ouverture d'un document
  par-dessus (`DocumentOverlay.open` diffère `_openNow`), navigation
  flèche/navbar (`PhrenologieScene._leaveTo` diffère le `navigate`).
  `smokeOut()` est rejouable (rappelé, il rend le temps restant) et ne part
  que d'un texte POSÉ — texte en cours d'écriture et documents gardent le
  fondu ordinaire. Fermeture « À Propos » : ~2,2 s au lieu de 0,7.
  L'autopsie des TROIS mécaniques abandonnées (animations CSS par lettre,
  fragments Web Animations, `fillText` par glyphe sous transformation) est
  dans le bloc STRATÉGIE de `smokeOut` : ne pas y revenir.
  ⚠️ Le point de perf non évident, expliqué dans `buildGlyphAtlas` : sous une
  rotation, le cache de glyphes du navigateur ne sert plus — chaque `fillText`
  re-rasterise son contour. D'où l'atlas (couleur cuite dans la vignette →
  zéro changement d'état de contexte en vol).

## Événements window (pont scène ↔ modules)

| Événement | Émis par | Écouté par |
|---|---|---|
| `chp2:opening-ready` / `chp3:intro-ready` / `chp4:page-ready` | module | scène (lève le rideau noir) |
| `chp2:navigate-back` / `chp3:navigate-back` / `chp4:navigate-back` | module | scène (navigation réelle) |
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
  avant tout le graphe ESM. En revanche il n'enregistre plus aucune config de
  chapitre dans `window.CONFIG` : chaque scène importe la sienne directement.

## La torche : un seul chemin (audit de juillet 2026)

`setTarget(fraction)` pose la taille, `grow(durationMs)` l'anime, `setCentered()`
dit « fixe » ou « suit ». **C'est tout.** Ne pas réintroduire de « cible » en
pixels : seule la fraction survit à un redimensionnement.

Ce qui a été supprimé, et pourquoi il ne faut pas le refaire :
- `updateTarget(page)` devinait la taille depuis un numéro de page et des alias
  `CONFIG.TORCH.taille_*`. Il écrivait un `torchTargetRadius` que `grow()` **n'a
  jamais lu** (son paramètre s'appelait `targetIgnored`), depuis un `currentPage`
  que **personne n'écrivait** — deux de ses trois branches étaient donc
  inatteignables. Trois réglages pour zéro effet.
- `centerTorch()`/`uncenterTorch()` rappelaient `updateTarget()` et écrasaient
  la taille qu'une scène venait de poser. Utiliser `setCentered()`.
- **La torche ne baisse pas pendant un média**, et ne l'a jamais fait :
  `MediaPlayer` passait `torcheAvant × PLAYER.torch_dim` à `grow()`, qui l'ignore.
  Réglage retiré plutôt que réparé — décision assumée. Le rétablir demanderait
  un vrai paramètre de cible dans `grow()`, et **changerait ce qu'on voit**.

## Le chapitre 4 : quatre pièges, tous documentés dans le code

Le chapitre 4 anime un export Illustrator (`chp4-images/chapitre4.svg`) inliné
dans la page. Quatre choses s'y comportent autrement que partout ailleurs.

**1. L'attribut `transform` d'un tracé ne survit pas à une animation CSS.**
Les 21 tracés de l'export portent tous `transform="translate(-731 0)"` en
ATTRIBUT. Une animation Web Animations (ou une transition CSS) écrit la
PROPRIÉTÉ `transform`, qui supplante l'attribut : le tracé perd son translate
et bondit de 731 unités. Corrigé en emballant chaque élément animé dans un
`<g>` qui, lui, porte la transformation (`.chp4-dot`, `.chp4-bubble`,
`.chp4-breath`). **Ne jamais animer un `transform` directement sur un tracé
venu de l'export.** Symptôme : des bulles qui filent hors du cadre à droite.

**2. L'écran est coupé en deux, et l'interface avec.** Moitié gauche : la photo
du crâne sur tissu SOMBRE. Moitié droite : le papier. Donc titre, sous-titre et
flèche de retour (bas-gauche) restent BLANCS/OR comme partout, tandis que le
seul bouton plein écran (bas-droite, sur le papier) passe à l'encre sombre.
Tout retourner d'un bloc rend la moitié de l'interface illisible — essayé.
Voir `style.css` § CHAPITRE 4, et l'en-tête d'`ArrowChapitre4.js`.

**3. Le manifeste repère les tracés PAR INDICE, et se dénonce.** L'export ne
porte aucun identifiant sémantique : `chp4-manifest.js` nomme chaque tracé par
sa position dans le document. Si l'œuvre est ré-exportée, les indices peuvent
glisser — d'où `verify()`, qui compare au montage le centre de chaque tracé à
celui qu'il annonce et hurle en console. **Après tout ré-export de
chapitre4.svg, lancer le chapitre et lire la console avant toute chose.**

**4. La pop-up de la carte dépend d'un réglage dans UN AUTRE DÉPÔT.**
`soliman-map.netlify.app` (dépôt `victormule/soliman-map-v3`) répondait
`X-Frame-Options: SAMEORIGIN` : le navigateur refusait d'afficher la carte dans
notre cadre, quoi que fasse notre code. Corrigé dans son `netlify.toml` — en-tête
retiré, et `frame-ancestors` élargi aux origines Netlify et au localhost. **Si
la pop-up redevient un jour un cadre vide, c'est là qu'il faut regarder**, pas
ici. `map.fallback_after` garde par sécurité un lien « ouvrir dans un nouvel
onglet » sous le cadre.

**5. Deux pièges de PERFORMANCE, découverts au banc d'essai — la mise en scène
était juste, elle était injouable.** Symptôme commun et déroutant : l'animation
tressautait *davantage quand on bougeait la souris* (le curseur du site, une
silhouette masquée sous deux ombres portées, se repeint à chaque `pointermove`
et disputait le temps qui restait).

  · **Révéler la fissure par un `mask`** re-pixellisait ses onze mille
    caractères À CHAQUE FRAME : 33 ms par frame souris en main, 67 frames
    perdues sur 127 — la moitié des images. Remplacé par un CACHE couleur
    papier posé par-dessus : le tracé n'est peint qu'une fois, seule une forme
    triviale s'anime. Retour à 60 im/s. Même règle pour le tremblement, passé
    d'un groupe DANS le SVG à une transformation CSS sur l'élément `<svg>`
    (le compositeur la joue sans rien re-pixelliser).
  · **`getPointAtLength()` est en temps linéaire À CHAQUE APPEL.** Mesurer la
    portée de la fissure par échantillonnage coûtait 1,7 s de page gelée. La
    valeur est désormais une constante mesurée une fois (`FISSURE` dans le
    manifeste), surveillée par `verify()`.

  Corollaire général : sur cette page, **rien de plein écran ne doit être en
  `mix-blend-mode`** (le grain du papier y a renoncé) et rien d'animé ne doit
  toucher un tracé complexe. Le banc d'essai tient en trente lignes de
  Playwright — le refaire avant d'accuser la machine.

Deux notes de composition : les libellés sont RE-COMPOSÉS en Roboto Condensed
(la police de l'export, « Edges », n'est pas dans le projet ; ses `<text>` sont
jetés au chargement), et la fissure s'ouvre depuis le CŒUR de l'étoile vers ses
trois branches à la fois — une plume qui suivrait son contour fermé descendrait
une branche pour remonter par l'autre côté (cf. `propagate()` dans
`chp4-draw.js`).

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
6. **Chapitre 4** : lever de lumière (noir → page blanche, jamais de flash),
   crâne, fissure, 5 bulles dessinées ; survol (invite ▶ / ↗), écoute d'une
   bulle (ondes + pourtour de progression), les 3 sorties d'écoute (re-clic,
   clic dehors, Échap), bascule directe d'une bulle à l'autre, pop-up carte,
   sortie. Vérifier que le bouton plein écran (bas-droite, sur le papier) est
   bien SOMBRE et la flèche (bas-gauche, sur la photo) bien BLANCHE.
7. **Chaque chapitre : entrer/sortir ×2** (le pattern factory doit rejouer
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
