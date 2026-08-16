# Soliman al-Halabi — CNRS / Abounaddara

Site-expérience narratif (SPA JavaScript vanilla, modules ES natifs).
**Aucun build, aucune dépendance** : servir le dossier tel quel suffit.

```bash
# Lancement local (les modules ES interdisent file://)
node tools/bench/serve.mjs      # → http://127.0.0.1:8791/
# ou npx serve . , ou tout autre serveur statique

# Outillage (facultatif, jamais en production)
npm install                     # playwright, pour le banc d'essai seulement
npm run bench -- --self-test    # non-régression : fluidité, fuites, clavier
npm run audit:config            # clés de config sans lecteur
npm run videos:dry              # inventaire des vidéos à compresser
```

⚠️ `package.json` n'existe QUE pour cet outillage. **Rien dans `src/`,
`Chapitre*/` ou `index.html` n'importe quoi que ce soit d'une dépendance**, et
rien ne doit commencer à le faire : le site se sert tel quel, comme depuis
toujours.

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
                          TransitionManager, Blackout (mécanique du voile noir)
  systems/                AudioManager, TorchSystem, BackgroundManager,
                          Chapter1LightSystem, OrientationLock, TouchHover,
                          Journey (mémoire du parcours, pour la carte)
  ui/                     Flèches (ArrowBase + variantes), MediaPlayer,
                          DocumentOverlay/Loupe, AboutReveal (mise en scène
                          « À Propos »), NavigationBar, Title,
                          CompassMap (boussole + carte du parcours)…
  scenes/                 Une classe par scène (contrat Scene : enter/exit)
  utils/                  helpers.js (SVG, libellés, releaseMediaElements),
                          a11y.js (clavier + annonces), media.js (variantes
                          mobiles), cursor, viewport…
fonts/                    Polices LOCALES + fonts.css (GÉNÉRÉ) + LICENCES.txt
audit-config.js           Garde-fou : clés de config sans lecteur
package.json              OUTILLAGE SEUL (le site n'a aucune dépendance)
tools/
  bench/serve.mjs         Serveur statique (gère les Range → mp4)
  bench/regression.mjs    Non-régression : fluidité, fuites, clavier, console
  compress-videos.mjs     Fabrique les variantes mobiles (→ */mobile/)
  fetch-fonts.mjs         Rapatrie les polices Google en local
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
| **Carte du parcours** : l'interrupteur `MAP.active`, la réserve à l'ordinateur, les libellés des points, les cadences | `config.js` → `MAP` |
| Chapitre 1 : sous-titre, lumière, timings, **hotspots (zones+médias)** | `Chapitre1/chp1-config.js` |
| Chapitre 2 : sous-titre, bougies, ambiance invisibilisation, **torche du journal (« Peine démesurée »)** | `Chapitre2/chp2-src/chp2-config.js` |
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
| `chp2:media` `{ouvert}` | sous-parties chp2 | scène (efface flèche + boussole) |
| `chp4:listen` `{ouvert}` | chp4-bubbles | scène (efface flèche + boussole) |

À cela s'ajoutent deux signaux du bus interne (`src/core/EventBus.js`, et non
`window`) : `place:media` `{ouvert}` — un média passe devant, la boussole
s'éclipse avec la flèche — et `carte:ouverte` `{ouvert}` — la carte se déplie,
les titres lui laissent la place. Tous deux sont raccordés dans `app.js` : le
composant qui émet ignore celui qui écoute.

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

**Un chapitre qui veut la même lumière prend le même système, pas un autre.**
`new TorchSystem(config, canvas)` accepte un canvas au choix, et l'instance se
défait par `destroy()`. C'est ce que fait « Une peine démesurée » (chapitre 2) :
torche FIXE au centre, grande, la page bien éclairée et seuls les bords plus
sombres — réglée dans `chp2-config.js` → `peine.torch`.
⚠️ Ce qu'on ne pouvait PAS réutiliser, c'est le canvas : `#overlay-canvas` vit
dans `#app` à z 1, et `#chapitre2-root` est un contexte d'empilement à z 500 —
vu de là, il est enterré. D'où le canvas propre à l'installation (`.pd-torche`,
`position: fixed` car le journal DÉFILE sous lui).
⚠️ **L'interface passe au-dessus sans qu'on ait rien à déclarer** : ce canvas
est confiné dans `#chapitre2-root` (plafonné à 500 vu de `#app`) quand la
flèche de retour est à z 9999 et la boussole, les titres et le plein écran à
z 600. C'est structurel, pas un réglage.
⚠️ Une instance de chapitre NON détruite laisserait à chaque visite une boucle
`requestAnimationFrame` perpétuelle et deux écouteurs de pointeur sur
`document`. `destroy()` est appelé dans le `destroy()` du module.

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

## La carte du parcours (boussole, haut-gauche)

Une boussole de la taille d'une flèche, qui **ouvre la colonne haut-gauche** :
elle se pose à GAUCHE du titre et du sous-titre, qui se décalent d'autant, et
se centre verticalement sur eux. Elle se déplie en une carte du site où ne
figure **que ce qu'on a déjà parcouru** : un point n'apparaît, et la route qui y
mène ne se trace, qu'une fois l'endroit atteint. Le point courant s'illumine ;
cliquer un point déjà visité y conduit.

**LA CARTE PREND LA PLACE DES TITRES.** Dépliée, elle occupe exactement le coin
où ils s'écrivent : ils s'ÉCLIPSENT (`Title.eclipse`) et reviennent au repli. La
carte ne les connaît pas : elle émet `carte:ouverte`, `app.js` fait le
rapprochement — même patron que `place:media` pour la flèche. Une éclipse plutôt
qu'un effacement parce qu'on peut entrer dans une scène carte ouverte : le
sous-titre s'écrit alors normalement dessous et paraît à la fermeture (`set()`
n'écrit tout simplement pas ses caractères tant que l'éclipse dure — ils naissent
à `opacity: 0`, c'est `eclipse(false)` qui les posera).

⚠️ **CE N'EST PAS UN FONDU, C'EST UN GESTE ÉCRIT.** Le titre du site est fait de
caractères qui s'écrivent un à un ; le faire disparaître d'un bloc d'opacité
serait le seul endroit du site où sa typographie ne compterait plus. Les
caractères refluent du DERNIER vers le premier — devant la carte, qui se déplie
depuis la gauche — et reviennent du premier au dernier, comme ils s'écrivent.
Cadences : `TIMING.titre_eclipse_ms` / `_pas` et `titre_retour_ms` / `_pas`
(`_pas` à 0 = tous ensemble). Les niveaux 2 et 3, blocs d'un seul tenant,
partent d'un souffle : c'est ce décalage entre les deux gestes qui fait une
sortie plutôt qu'un fondu.

**TROIS RÉGLAGES DE PLACE, TROIS EFFETS, INDÉPENDANTS** — tous en % du viewport,
donc stables au redimensionnement :

| Clé | Ce qu'elle déplace |
|---|---|
| `MAP.gauche_pct` / `MAP.haut_pct` | le coin haut-gauche de la BOUSSOLE (la carte s'ancre sur elle) |
| `MAP.titres_gauche_pct` | le bord gauche des TITRES, publié en `--col-titres` par `poserColonne` |

⚠️ **Les titres se règlent à part, et c'est voulu** : ajuster la boussole ne doit
pas les entraîner. À garder au-delà de la boussole, sinon ils se chevauchent —
rien ne l'empêche automatiquement.

⚠️ **La hauteur de la boussole ne se DÉDUIT plus des titres.** Elle se calculait
depuis la façon dont ils s'empilent (3,2 % puis 2,6 em) pour se centrer sur leur
bloc. Juste sur le papier, faux à l'œil : sur les scènes SANS sous-titre — la
vitrine, la phrénologie — le bloc reste réservé sur deux lignes et la boussole
se posait visiblement plus bas que le titre unique. Un réglage direct se voit et
se corrige ; une déduction, non.

⚠️ **`CompassMap.resize()` REPLACE toujours, ne redessine que si la taille a
changé.** Les deux ne dépendent pas de la même chose : la place est un % du
viewport, la taille est BORNÉE (`ARROW.size_min/size_max`). Sur un écran large
où la taille est déjà saturée, élargir la fenêtre ne changeait rien du tout — la
garde anti-re-render sortait avant le replacement, et la boussole restait sur
place pendant que les titres, eux, suivaient leur % en CSS.

**Un seul interrupteur** : `CONFIG.MAP.active`. À `false`, l'objet n'est jamais
construit — pas de DOM, pas d'écouteur, pas de coût. `MAP.ordinateur_seulement`
la réserve à l'ordinateur (elle demande de la place et du survol).

**Elle paraît avec une flèche, et seulement là.** `ArrowBase.show()/hide()`
émettent `nav-arrow:shown` / `:hidden` — un seul point d'accroche pour les neuf
flèches du site, y compris celles que les moteurs de chapitre pilotent par
callback. ⚠️ `CloseCross` hérite d'`ArrowBase` : il passe `false` au dernier
argument du constructeur, sinon la boussole surgirait au-dessus d'un média.

**Deux mémoires, jamais recopiées.** `src/systems/Journey.js` retient les
SCÈNES (`soliman.journey.v1`) ; les trois sous-parties du chapitre 2 restent
gouvernées par `chp2-progress.js`, que Journey **lit**. Corollaire : la carte ne
peut pas ouvrir une porte que le chapitre garde fermée — `computeUnlocked`
renvoie un préfixe, donc « visité » est toujours inclus dans « déverrouillé ».
Remise à zéro : `window.__solimanResetJourney()`.

⚠️ **La géométrie n'est pas un réglage.** Les coordonnées des points et le tracé
des routes vivent dans `CompassMap.js`, transcrits de `images/carte-source.svg`
(viewBox 287) ; la rose des vents vient de `images/boussole-source.svg`
(viewBox 99,58). `config.js` ne porte que ce qu'un éditeur veut changer.
**Après tout ré-export, relancer la transcription** : les routes de l'export
sont écrites dans les deux sens et portent un `translate` en attribut ; ici
elles sont TOUTES retournées vers le point d'arrivée et le décalage résorbé
dans les coordonnées, parce qu'un trait se dessine dans le sens de son `d` —
il doit partir de là d'où l'on vient. Seule coordonnée qui ne vienne pas de
l'export : `ANCRE`, le point du dessin qui se pose sur le centre de la boussole.

⚠️ **La légende du chapitre 4 porte un fond, et c'est le seul endroit du site.**
Mesuré sous son bandeau, à trois formats : le fond y va de 25/255 à 222/255
**sur la même ligne** — elle tombe pile sur la lisière entre la photographie et
le papier. Aucune couleur de texte ne tient des deux côtés (le blanc à halo noir
fait une tache sur le papier, l'encre à halo clair disparaît sur le tissu). Elle
a donc son propre appui : une étiquette couleur papier. Partout ailleurs le
fond est franchement sombre et l'ombre portée suffit.

⚠️ **Le `transform` de la boussole est un ATTRIBUT** (export Illustrator) : la
rotation au clic vit sur un `<g>` qui l'enveloppe, jamais sur le tracé. C'est le
piège n°1 du chapitre 4, à l'identique.

⚠️ **Aucun canvas ici.** Le SVG n'a pas le défaut qui a valu l'invariant des
canvas-masques (ci-dessous) : on ne rouvre pas cette porte pour une boussole.

**Le saut passe par `Scene.leaveTo(to, params)`** — voir ci-dessous — SAUF quand
la destination est un autre lieu de la scène courante : là, c'est
`Scene.jumpWithin({ part })`. Le chapitre 2 est la seule scène à plusieurs lieux
(son ouverture et ses trois installations) et il les montre comme quatre points.
Sans ce second chemin la carte était **muette à l'intérieur du chapitre 2** :
`app.js` refuse `leaveTo` quand la destination est la scène courante, si bien
qu'aller de « Taire le passé » à l'ouverture — le premier clic qu'on essaie — ne
faisait rien. `jumpWithin` demande le retour ÉCRIT de l'installation ouverte
(le même que la flèche), l'attend, puis ouvre la destination : on ne ferme
jamais une installation d'autorité.

⚠️ **La boussole ne traverse jamais une transition dépliée.** `compass.reset()`
est appelé sur `navigate`, et `show()` referme une carte restée ouverte. Elle se
redessine pliée avec la flèche suivante.

**LE REPLI EST UN GESTE, PAS UNE DISPARITION.** La carte se DÉ-TRACE : les points
s'effacent à rebours du parcours (les plus lointains d'abord), puis les routes,
puis le cadre, pendant que la boussole revient sur elle-même. `_fold()` renvoie
la durée du geste, et `hide()` s'en sert pour ne lancer son fondu qu'ensuite —
on ne fait pas disparaître un panneau entier d'un coup d'opacité au moment
précis où une scène commence sa sortie écrite. Cadences : `MAP.fold_out` et
`MAP.fold_stagger`.

⚠️ **Le fond de la carte est presque transparent** (`MAP.fond_opacite`) : ce qui
détache les traits de la scène n'est plus lui mais l'**ombre portée** posée sur
`.cm-panel svg` (style.css). Les deux se règlent ensemble — retirer l'ombre rend
la carte illisible sur fond clair, la page du chapitre 4 en particulier.

⚠️ **La boussole est BLANCHE au repos, dorée et grossie au survol — dépliée
comme repliée.** Le survol était neutralisé quand la carte était ouverte : la
petite boussole du coin, seul moyen de refermer à la souris, ne réagissait plus
du tout. Un bouton qui ne répond pas ne se lit pas comme un bouton.
`_poser(survol)` écrit place et taille à partir des deux seuls états (ouverte,
survolée) : ne pas réintroduire de transformation ailleurs.

⚠️ **Une flèche qui s'efface sans passer par `hide()` laisse la boussole seule
à l'écran.** Le chapitre 1 écrivait `this._arrow.el.style.opacity = '0'` pour
éclipser sa flèche pendant un média : aucun signal émis, donc la boussole
restait au-dessus du lecteur. D'où `ArrowBase.eclipse(masquée, ms)`, qui efface
sans démonter ET émet les mêmes signaux que `show()`/`hide()`. Toute autre façon
d'effacer une flèche recréera le défaut.

**UN MÉDIA AU PREMIER PLAN EFFACE LA FLÈCHE ET LA BOUSSOLE — partout, et AU MÊME
INSTANT.** Chaque scène a UN déclencheur, posé là où le média passe devant :
- chapitre 1 → le clic sur un hotspot ; `ArrowBase.eclipse()`, la boussole suit
  par le signal de flèche.
- chapitre 4 → `chp4:listen`. « Un média » y veut dire **une bulle qu'on
  écoute** ; elle garde ses trois sorties (croix, Échap, clic au-dehors), on
  n'enferme donc personne.
- chapitre 2 → `chp2:media`, émis par la SOUS-PARTIE. ⚠️ Surtout pas
  `chp2:show-close-cross` : la croix paraît PLUS TARD que le média (le zoom
  d'un œil commence, la croix arrive au bout de sa course), et s'y accrocher
  faisait partir la boussole après la flèche. Mesuré depuis le bon
  déclencheur : 4 ms d'écart pour « Taire le passé », 2 ms pour « La violence
  et ses traces ».

⚠️ **AU CHAPITRE 2, LA FLÈCHE S'ÉCLIPSE EN SILENCE** (`eclipse(…, { signale:
false })`), parce que la boussole est pilotée séparément par `place:media`. Si
la flèche émettait aussi, la boussole recevrait deux ordres contradictoires —
l'éclipse réversible et le `hide()` destructif — et c'est le second qui
gagnerait, par sa seule place dans la file d'événements.
(Il y avait là une règle CSS `body.invisibilisation-media #arrow-…` qui faisait
le travail pour la flèche seule ; elle a été retirée, un déclencheur ne pouvant
pas être à moitié en CSS et à moitié en JS. La classe survit : elle estompe les
titres.)

⚠️ **`CompassMap.eclipse(true)` NE LAISSE PAS `show()` la ramener.** C'est le cas
« média lancé vite » : la flèche d'une sous-partie finit de se dessiner alors
qu'on a déjà ouvert un média. Le drapeau `_eclipsee` la retient ; côté flèche,
`_mediaOuvert` de `Chapitre2Scene` l'efface aussitôt construite. Et `hide()`
lève l'éclipse : un vrai départ l'emporte toujours, sinon la boussole resterait
invisible dans la scène suivante.

⚠️ **Le point courant se peint par `style.stroke`, jamais par l'attribut.**
`_paintCurrent` posait `setAttribute('stroke', …)` quand le survol
(`applyGoldenHover`) écrit `style.stroke` : un style en ligne bat un attribut,
donc l'or du survol ne s'effaçait plus JAMAIS et la carte finissait toute
allumée. Même piège que celui du curseur, plus bas.

## La frontière : chaque scène DÉCLARE ce qui est vrai chez elle

`SceneManager.go()` garantissait le noir entre deux scènes ; il garantit
maintenant aussi le silence **et le titre**. Entre `exit()` et `enter()` il
tient un **rendez-vous dans le noir** (`onBoundary`) dont il ignore le contenu ;
`app.js` y lit **une seule table**, `LIEUX` :

```js
const LIEUX = {
  vitrine:       { sons: ['musee'],           titre: 'site'   },
  collaboration: { sons: ['musee', 'collab'], titre: 'collab' },
  chapitre2:     { sons: [],                  titre: 'collab' },
  …
};
```
→ `audio.enforceSilence(sons)`, `title.set(titre)`, `title.clearChapter()`.

**Tout ce qui n'est pas déclaré n'est pas là quand on entre.** Une scène ajoutée
sans ligne entre dans le silence, sous le titre du site, et le dit en console.

⚠️ **Pourquoi une table, et pas un réglage par scène.** Ce qu'il faut garder
dépend de la scène qui ARRIVE, pas de celle qui part : une scène ne peut donc
pas porter seule la réponse. C'était le défaut d'origine **deux fois** — chaque
`exit()` devinait sa destination pour le son, `CollaborationScene` la devinait
pour le titre (`swapSiteTitle`, supprimé). Les deux devinettes étaient justes
tant qu'on n'accédait aux chapitres QUE par l'espace collaboratif ; la carte du
parcours a ouvert d'autres routes et les deux se sont mises à mentir. Mesuré :
le musée jouait par-dessus les chapitres 3 et 4 ; « Abounaddara — CNRS — 2026 »
s'affichait au-dessus d'un chapitre (aller de la phrénologie DIRECTEMENT au
chapitre 2, c'est ne jamais passer par `CollaborationScene`), et revenir d'un
chapitre à la vitrine gardait « Espace collaboratif » au-dessus du musée.

⚠️ **Pourquoi une table, et pas un réglage par scène.** Le sens de « garder »
dépend de la scène qui ARRIVE, pas de celle qui part : une scène ne peut donc
pas porter seule la réponse. C'était exactement le défaut d'origine — chaque
`exit()` devinait sa destination. `PhrenologieScene.exit()` ne touchait pas au
musée parce qu'elle « savait » que la suivante le baisserait : vrai tant qu'on
n'allait qu'à la vitrine ou à l'espace collaboratif, **faux le jour où la carte
a permis d'aller de la phrénologie au chapitre 3**. Mesuré : le musée jouait à
plein volume par-dessus les chapitres 3 et 4, et la voix d'introduction du
chapitre 1 débordait sur le chapitre 2. Cinq chemins testés, cinq fuites.

La continuité voulue est préservée : le musée est déclaré par les trois scènes
du tronc commun (l'espace collaboratif l'atténue à zéro en entrant et le
rétablit en partant), il les traverse donc sans coupure. Aucun chapitre ne le
déclare : il s'arrête, quel que soit le chemin emprunté.

⚠️ **Une scène ajoutée sans ligne dans `LIEUX` entre dans le silence complet et
le dit en console.** C'est le bon mode de panne : on entend un manque, on ne
subit pas un débordement.

## La colonne de titres : trois niveaux, un seul propriétaire

`src/ui/Title.js` possède les trois — `#site-title`, `#chapitre-subtitle`,
`#chapitre-part-title` — et **rien d'autre n'y touche**.

| Niveau | Qui décide | Où |
|---|---|---|
| 1 · « Abounaddara — CNRS — 2026 » / « Espace collaboratif » | la table `LIEUX` | `app.js`, appliqué à la frontière |
| 2 · sous-titre du chapitre | la scène, en entrant | `CHPx.subtitle` → `title.showSubtitle()` |
| 3 · titre de sous-partie | la scène, à l'ouverture | `CHP2.parts[part]` → `title.showPart()` |

`Title.set()` est **idempotent** : redemander le titre déjà posé ne le réécrit
pas (sans quoi il se retaperait à chaque passage d'une scène du musée à une
autre). La bascule se joue à la frontière, donc **sur un écran noir** : c'est
ce qui a permis de retirer le fondu-vers-le-haut `.fading-out` et son réglage
`TITLE_SWAP_MS` — 620 ms d'attente avant un geste que personne ne regardait.

`title.clearChapter()` remet les niveaux 2 et 3 à zéro à chaque frontière. Ce
n'est pas un doublon des `exit()` de chapitre, c'est la GARANTIE : un sous-titre
ne peut plus survivre au chapitre qui l'a écrit, quel que soit le chemin pris.
⚠️ Il efface aussi les **styles en ligne** : la sortie écrite du chapitre 1
estompe son sous-titre en posant `opacity:0` à la main (son geste remonte, quand
le geste ordinaire du site descend) et ne les nettoie que 900 ms plus tard —
quitter entre-temps laissait un `opacity:0` sur l'élément PARTAGÉ, et le
sous-titre du chapitre suivant recevait sa classe `.visible` en restant
invisible. Un style en ligne bat toujours une feuille.

⚠️ **Le niveau 3 du chapitre 2 est VIDE par choix éditorial** (`chp2-config.js`
→ `parts`, trois chaînes vides). Ne pas le lire comme une panne.

Quatre scènes portaient chacune une copie mot pour mot de `_showSubtitle` /
`_hideSubtitle` / `_applySubtitleFont`, et cinq une copie du recalcul de taille
au redimensionnement — sans que deux traitent tout à fait les mêmes éléments.
Une seule mécanique reste ; `title.resize()` est appelé **une fois**, dans
`app.js`.

⚠️ **`stopPhrenoSound()` ne rétablit plus le musée.** Elle le faisait — c'était
décider, depuis l'AudioManager, de ce qu'on entendrait APRÈS. Son unique
appelant est le chapitre 1, qui écrivait donc « couper, puis défaire le
rétablissement qu'on vient de provoquer ». Ne pas le réintroduire.

⚠️ **Le registre des `<audio>`/`<video>` est un FILET, pas une dispense.**
`AudioManager` accroche `HTMLMediaElement.prototype.play` une fois et retient
des **WeakRef** — jamais l'élément (une référence forte recréerait la fuite
d'arbre détaché documentée plus bas). À la frontière, tout média encore en
lecture est mis en pause ET **dénoncé en console**, nommément. Les modules de
chapitre restent responsables de leurs médias.

## Le SceneManager : quatre étapes, et aucune ne peut geler les autres

```
await unwind()            → l'entrée en cours est dénouée
await currentScene.exit() → noir garanti
await onBoundary()        → silence + titre garantis
await nextScene.enter()   → visible garanti
```

**On ne démonte pas une scène qui est encore en train de se monter.** Une
chorégraphie d'entrée est longue (17 s pour la vitrine) et rien n'interdit de
partir pendant qu'elle se joue — la carte du parcours le permet. `go()`
interrompt donc la scène (`Scene.interrupt()`, un simple avortement du signal),
**attend que son `enter()` se dénoue**, et sort seulement ensuite.

Trois trous de contrat, chacun suffisant à lui seul pour **bloquer le site
définitivement, sans un mot en console** (mesuré : départ demandé à 900 ms de
l'entrée de la vitrine) :

1. **`Scene.wait()` ignorait un signal DÉJÀ avorté.** Un `AbortSignal` déjà
   déclenché n'émettra plus jamais `abort` : l'écouteur ne servait à rien et
   l'attente se résolvait normalement. L'entrée interrompue continuait donc de
   se jouer — la vitrine reprenait à 2159 ms et **annonçait son arrivée à
   7115 ms**, alors qu'on était au chapitre 4 depuis longtemps (titre d'onglet,
   annonce au lecteur d'écran, point de la carte : tous faux).
2. **`TorchSystem.fadeOut()` lâchait sa promesse quand on la préemptait.**
   `grow()` commence par `cancelFade()`, qui annulait le rAF **sans régler la
   promesse** que les `exit()` attendent. `exit()` n'est jamais revenu,
   `isTransitioning` est resté vrai, plus aucune navigation n'est passée.
   `cancelFade()` RÉSOUT désormais — l'appelant demande « préviens-moi quand
   cette extinction ne t'appartient plus », pas « garantis-moi le noir ».
3. **`go()` n'attendait pas l'`enter()` en vol**, si bien que sortie et entrée
   s'écrivaient l'une par-dessus l'autre.

⚠️ **Une scène qu'on a quittée n'annonce pas son arrivée** :
`Scene.announceEntered()` porte la garde, en un seul endroit plutôt que répétée
dans les sept scènes. Ne pas revenir à `bus.emit('scene:entered')` en direct.

⚠️ **L'étape `exit()` est isolée dans son propre `try`.** Une sortie qui échoue
ne doit pas empêcher d'ARRIVER : sinon la moindre erreur de nettoyage laissait
le visiteur nulle part, sur un écran noir, sans plus aucune issue.

`SceneManager.UNWIND_MS` (4 s) plafonne l'attente du dénouement : toutes les
attentes de scène rejettent aussitôt l'avortement, seuls quelques awaits hors
`Scene` restent (le fondu d'un fond, le décodage d'un mp3 au tout premier
lancement). Dépassé, on part quand même, en le disant.

## Un seul chemin pour quitter une scène : `leaveTo(to)`

**UN DÉPART, UN SEUL — ET LA FLÈCHE PART AVEC.** `Scene.beginLeave()` ouvre
TOUT départ : il ferme le verrou de navigation et efface les flèches déclarées
par `Scene.arrows()`. Appelé une seconde fois, il rend `false` — la scène sait
alors qu'un départ court déjà et ne rejoue pas sa mise en scène.

Sans lui, une sortie ÉCRITE laissait ses flèches vivantes tout du long : partir
d'une installation du chapitre 2 prend **35 s** (retour écrit, bougie,
citation), pendant lesquelles la flèche restait visible et **cliquable**. Par
la carte, on pouvait demander une destination alors qu'on partait déjà vers une
autre.

⚠️ **`arrows()` doit être COMPLET.** Le chapitre 2 en déclare cinq (la flèche de
l'ouverture, une par installation, la croix de fermeture d'un média) ; une
flèche oubliée dans cette liste, c'est le défaut qui revient — en silence.

⚠️ **`ArrowBase.hide()` rend la flèche inaccessible TOUT DE SUITE**
(`pointer-events: none`), pas à la fin du fondu. Le clic ne partait qu'avec
`onclick = null`, posé après `ARROW.hide_duration` : pendant tout le fondu la
flèche était déjà invisible et pourtant encore cliquable. `eclipse()` posait
déjà cette ligne ; `hide()`, qui est le geste DÉFINITIF, ne l'avait pas.

⚠️ **Toutes les flèches passent par `leaveTo`**, y compris celles de la vitrine,
de l'espace collaboratif (cercles romains compris) et du chapitre 1, qui
émettaient encore `bus.emit('navigate')` ou appelaient directement leur sortie
écrite. Un chemin qui contourne `leaveTo` contourne le verrou.
Corollaire : `_showArrow()` / `_showOpeningArrow()` / `_showPartArrow()` testent
`this.leaving` — un moteur de chapitre peut réémettre son signal « prêt »
pendant qu'on s'en va, et redessinerait sinon une flèche sur une scène en fuite.

Dix `bus.emit('navigate')` portaient une destination écrite en dur. Les scènes
qui ont une sortie ÉCRITE (la bougie et la citation du chapitre 2, la fumée de
l'« À Propos », le fondu du chapitre 4) la jouent maintenant AVANT de naviguer,
**vers la destination demandée**. La flèche de retour n'est plus qu'un cas
particulier : `leaveTo('collaboration')`. C'est ce qui permet à la carte de
sauter plus loin sans réécrire une seule mise en scène — elle nomme une cible
et se tait.

⚠️ **Les paramètres de navigation sont transmis** (`app.js` : `bus.on('navigate',
({to, ...params}) => manager.go(to, params))`). Ils ne l'étaient pas : tout ce
qu'une scène joignait à sa demande était jeté. C'est par là que passe
`{ part: 'invisibilisation' }`, qui fait entrer DIRECTEMENT dans une sous-partie
du chapitre 2 — sans allumer les bougies pour les souffler deux secondes plus
tard (12–15 s économisées ; mesuré à 3,8 s au lieu de ~15). Voir
`startChapitre2({ part })` et `openPart()`.

## Les transitions : trois invariants (audit de septembre 2026)

Le site avait DEUX notions de « lieu » et une seule sous contrat. Les scènes ont
`enter()`/`exit()` et un noir garanti — cette moitié n'a jamais posé de problème.
Les lieux SUPERPOSÉS (les 3 sous-parties du chapitre 2, le tableau du 3, les
bulles du 4, l'overlay documents, le lecteur média) n'avaient aucun contrat :
chacun avait inventé le sien, à coups de booléens et de `CustomEvent`. Tous les
défauts mesurés venaient de là. Trois règles remplacent la vigilance.

**1. Un canvas qui sert de MASQUE est repeint dans le même tour que son
redimensionnement.** Écrire `canvas.width` EFFACE le canvas. Trois canvas du
site portaient le noir — `LightSystem` (chp2-opening), `Chapter1LightSystem` et
le `TorchSystem` PARTAGÉ (un quatrième depuis : la torche de « Peine
démesurée », qui hérite de la règle en héritant du système) — et tous trois
s'en remettaient à une boucle de rendu
qui a le droit de ne pas venir : elle saute quand une sous-partie couvre l'écran
(chp2) ou quand `_paused` est posé (torche, sous un document ouvert). Mesuré au
chapitre 2 : une bascule plein écran pendant une sous-partie laissait le
panorama À NU 1,4 s au retour, puis le noir retombait d'un bloc. Les trois
`resize()` repeignent désormais, synchrone. **Ne pas retirer la ligne d'un seul
des trois** — le défaut est silencieux et ne se voit qu'au redimensionnement.
L'exposé complet est dans `TorchSystem.resize()`.

**2. On ne se suspend ni ne se reprend HORS DU NOIR.** Le gel de l'opening du
chapitre 2 tombait à l'instant du clic : le panorama, encore en train de glisser
vers le crâne, s'arrêtait NET, une demi-seconde avant que le voile soit opaque.
`suspend()` n'est donc appelé qu'une fois l'écran couvert (fin du fondu, ou fin
de l'extinction des bougies — le canvas plein noir EST le couvert), et
`resume()` tant qu'il l'est encore : sa resynchronisation est un saut, elle ne
doit pas se voir.

**3. Une place suspendue N'ÉCOUTE PLUS RIEN : on détache, on ne teste pas un
drapeau.** C'est la règle qui compte le plus. Les deux boucles du travelling
étaient gardées par `if (!_subOpen)` — mais `onMove`, lui, ne l'était pas et
continuait d'écrire `targetX` et `velocity` pendant toute la sous-partie. Au
retour, la boucle repartait et RATTRAPAIT tout : 517 px avalés à 2 480 px/s,
mesurés. Trois lecteurs du drapeau s'en souvenaient, deux l'avaient oublié — un
écouteur détaché, lui, ne peut pas oublier. Gain au passage : les gardes
laissaient deux chaînes de `requestAnimationFrame` se reprogrammer à 60 i/s
pour ne rien faire ; elles sont maintenant réellement annulées.

⚠️ **`Blackout` porte la MÉCANIQUE du voile, pas un voile unique.** Les voiles
du site ne sont pas interchangeables de PLACE, et cette place est voulue :
`#chp2-fade` vit dans `#chapitre2-root`, donc SOUS les titres remontés à z 600 —
c'est ce qui les garde lisibles pendant que le chapitre fond au noir. Un voile
unique au sommet de la pile les recouvrirait. Ce qui devait être unique, c'est
la mécanique : trois blocs quasi identiques la portaient, et l'un d'eux armait
la transition AVANT la montée au noir, si bien que **le voile de retour
d'« Invisibilisation » ne s'est jamais joué** (opacité relevée : 0,00 de bout en
bout). Il a été RETIRÉ plutôt que réparé — le réparer ajouterait à l'écran un
fondu que personne n'a jamais vu, ce qui est un choix d'auteur, pas une
correction. `Blackout.reveal()` rend l'élément à sa feuille de style en
partant : un `opacity` en ligne resté à 0 rendrait la classe `.out` muette.

**CE QUI RESTE À FAIRE** : le contrat n'est appliqué qu'au chapitre 2. Les
chapitres 3 et 4, l'overlay des documents et le lecteur média sont des lieux
superposés eux aussi, et gagneront le même `suspend()`/`resume()`. Le jour où
un deuxième moteur l'implémente, la paire monte dans `core/Scene.js`.

## Trois règles issues de l'audit d'août 2026

**1. Un `<video>`/`<audio>` non libéré retient TOUT son arbre.** C'était la
seule vraie fuite du site : chaque visite du chapitre 2 laissait un
`#chapitre2-root` détaché-mais-vivant (~900 nœuds), indéfiniment. Le moteur
média du navigateur retient un élément dont la « resource selection » a
commencé — et un nœud retenu retient ses ancêtres. Retirer le DOM ne suffit
donc pas. **Toute scène qui démonte un DOM contenant des médias appelle
`releaseMediaElements()` (helpers.js) AVANT `remove()`** — c'est fait dans les
`_removeDOM()` des chapitres 2, 3 et 4. La bissection qui l'établit est dans
l'en-tête de la fonction : sans `<img>` ça fuit, sans `<svg>` ça fuit, sans
`<template>` ça fuit, sans `<video>/<audio>` ça ne fuit plus.

⚠️ **Pour mesurer une fuite, lire `DOM.getDetachedDomNodes` (CDP), jamais le
compteur `Nodes` de `Performance.getMetrics`.** Ce dernier est COLLANT : il
monte quand une fuite apparaît et ne redescend JAMAIS quand la référence est
relâchée. S'y fier a coûté un faux diagnostic (on a d'abord accusé des
références DOM de module, qui n'y étaient pour rien). `npm run bench --
--self-test` valide son instrument sur une fuite témoin avant de conclure :
ne pas retirer cette étape.

**2. Le son est un agrément, jamais une dépendance de rendu.** `new
AudioContext()` peut lever (mode Lockdown, navigateur durci, extension de
confidentialité). L'exception remontait à travers `PhrenologieScene.enter()`
— qui `await` l'audio — et **la scène ne s'affichait jamais** : ni fond, ni
boutons, ni flèche, un écran mort pour une panne de son. `getContext()` ne
lève plus : il retourne `null`, chaque méthode sort en silence, le site se
joue muet. **Aucun `enter()` de scène ne doit dépendre du succès de l'audio.**
(`loadBuffer` mémoïse aussi le décodage : le même mp3 n'est plus refetché ni
redécodé à chaque aller-retour.)

**3. Tout ce qui est cliquable doit être atteignable au clavier.** L'interface
est faite de `<div>` et de `<svg>` : rien n'était focusable, et l'écran
d'accueil — un `<div>` — ne démarrait rien à la touche Entrée. On ne réécrit
PAS l'interface en `<button>` natifs (cela casserait les tracés SVG animés et
le positionnement au pixel) : `src/utils/a11y.js` AJOUTE la sémantique
manquante (`makeActivatable` pose rôle, `tabindex`, `aria-label`, et fait
suivre Entrée/Espace au clic) et `announce()` signale les changements de scène
dans une région live. Le CTA de l'accueil, lui, est un vrai `<button>`
(`#ss-start`, avec `autofocus`).

⚠️ **`el.click()` N'EXISTE PAS SUR UN ÉLÉMENT SVG.** `click()` est défini sur
`HTMLElement`, pas sur `Element` (vérifié : `Element.prototype.click ===
undefined`). Or les boutons de la barre de navigation sont des `<rect>` SVG
transparents — et c'est l'un d'eux qui mène à l'espace collaboratif. Avec
`el.click()`, la touche Entrée y était donc SANS EFFET, en silence, et toute
une partie du site restait inatteignable au clavier. `a11y.js` dispatche un
`MouseEvent` (`activate()`), qui fonctionne sur n'importe quel Element : **ne
jamais revenir à `click()`**.

⚠️ **Un élément masqué doit sortir de l'ordre de tabulation.** `ArrowBase.hide()`
pose `tabindex="-1"` + `aria-hidden` ; `makeActivatable` les retire au retour.
Et **le bouton plein écran reste hors tabulation tant que l'écran d'accueil est
là** : il vit dans `#app`, DERRIÈRE l'accueil, mais le PRÉCÈDE dans l'ordre du
document — focusable, il captait la toute première tabulation et Entrée
basculait en plein écran au lieu de lancer l'expérience.

⚠️ **Le halo de focus de l'accueil est visible DÈS LE CHARGEMENT, et doit le
rester.** `#ss-start` porte `autofocus` (c'est ce qui fait qu'Entrée démarre
sans détour) ; le navigateur traite ce focus initial comme un focus clavier et
dessine aussitôt la bague dorée. Une passe l'a ajournée au premier `keydown`
(`body.using-keyboard`) en jugeant qu'elle chargeait un écran composé au pixel
— arbitrage esthétique, **annulé** : ce halo est le seul indice qu'on peut
entrer sans la souris, et il disparaissait à l'endroit exact où le site se
présente. La classe `using-keyboard` a été retirée avec sa règle CSS (plus
aucun lecteur). Ne pas remasquer le halo.

**CE QUI RESTE À FAIRE** : les CHAPITRES et leurs sous-parties n'ont encore
AUCUN travail clavier (hotspots du chapitre 1, crânes et sous-parties du 2,
quiz et théâtre du 3, bulles du 4). Le tronc commun — accueil, vitrine,
phrénologie, documents, collaboration — est traité. Avancer chapitre par
chapitre, en vérifiant chaque fois au banc d'essai.

## Vidéos : allégées sur mobile, intactes sur ordinateur

`src/utils/media.js` choisit la source : sur téléphone et tablette
(`body.is-touch`, ou `saveData`), une variante allégée rangée dans un
sous-dossier `mobile/` À CÔTÉ de l'originale, même nom de fichier :

```
Chapitre2/chp2-medias/Voyeur.mp4            ← l'original, JAMAIS touché
Chapitre2/chp2-medias/mobile/Voyeur.mp4     ← la variante (npm run videos)
```

**Les 17 variantes EXISTENT** (passe d'août 2026, ffmpeg 9.0) : 281 → 74 Mo,
−74 %. Vérifié au navigateur : ordinateur → master 1920×1080, téléphone →
`mobile/…` en 206, aucun repli déclenché.

⚠️ **Le repli reste indispensable** — il couvre toute vidéo AJOUTÉE plus tard
sans sa variante. `setVideoSrc()` écoute l'erreur de chargement et rebascule UNE
fois sur l'original : une vidéo neuve se lit donc immédiatement sur téléphone,
en attendant la prochaine passe de compression. Ne pas le retirer sous prétexte
que les variantes sont là aujourd'hui.

⚠️ **Le plafond porte sur le GRAND CÔTÉ, pas sur la largeur.**
`Chapitre3/chp3-medias/sepulture.mp4` est en PORTRAIT (1080×1920) : un
`scale='min(1280,iw)'` la laissait INTACTE (1080 < 1280) et sa « variante
allégée » gardait 2,07 M de pixels quand les autres tombaient à 0,92 M — deux
fois trop lourde, en silence. La cible se calcule en JS depuis ffprobe
(`cible()` dans compress-videos.mjs) : elle donne 720×1280.

**Qualité mesurée** (variante ré-agrandie, comparée au master) : PSNR Y de 39,4
à 44,9 dB selon les plans, minimum par image ≥ 34,5 dB — au-dessus du seuil de
transparence visuelle. Contrôle à l'œil fait sur les plans les plus exposés
(chapitre 1, « Violence et trace »), ombres amplifiées ×6 : ni banding ni
blocking. Deux taux à ne pas mal lire : `ame-noire.mp4` tombe à −93 % parce que
son contenu est peu complexe (43,6 dB), `a_la_une.mp4` résiste à −38 % parce
qu'il est très détaillé — dans les deux cas le CRF a fait son travail.

⚠️ **Seul le .mp4 est décliné.** Les .mp3 pèsent 28 Mo à eux tous et une voix
comprimée deux fois s'entend.

⚠️ **Comparer au chemin RÉELLEMENT posé.** Le chapitre 3 réutilise le même
`<video>` d'un hotspot à l'autre en testant `v.src.endsWith(cfg.video)` : sur
petit appareil cette comparaison échouerait à chaque fois (la source posée est
celle de `mobile/`) et relancerait un chargement complet. D'où `ensureVideoSrc()`.

## Le curseur : natif partout, dessiné seulement au doigt (août 2026)

Hors appareil tactile, le site montre le curseur de l'OS et son comportement
par défaut — flèche, main sur le cliquable. Le curseur custom (`#cursor`, une
flèche SVG masquée + ses variantes `.hotspot`/`.active`/`.peine-aim`) ne
tourne plus que sur `body.is-touch` (téléphone/tablette), où il sert encore à
autre chose que décorer : suivre le doigt dans « Peine démesurée », notamment.
`body.is-touch` est posée UNE fois par `app.js`, tôt (avant le bloc curseur,
dont il conditionne l'initialisation entière — pointermove/pointerdown/
pointerover ne s'attachent même pas hors tactile).

**La règle, dans `style.css`** : `body.is-touch, body.is-touch * { cursor:
none !important; }` masque le pointeur natif — UNIQUEMENT sur tactile — pour
laisser voir le curseur dessiné. Partout ailleurs, `cursor: pointer` fait le
travail (déjà présent sur la plupart des boutons — il était simplement étouffé
par l'ancien blocage universel `* {cursor:none!important}`).

⚠️ **La paire, pas le sélecteur seul.** `body.is-touch *` ne matche QUE les
descendants de body, jamais body lui-même (l'astérisque n'inclut pas l'élément
sur lequel porte le combinateur descendant). Écrire seulement `body.is-touch *`
laisse un trou : sur un appareil hybride tactile + souris, le pointeur natif
peut resurgir si la souris survole un point de `body` hors de tout descendant.
`body.is-touch, body.is-touch *` (les deux sélecteurs) couvre les deux — le
motif est repris de `body.peine-aim` et des anciennes neutralisations par
chapitre, déjà écrites ainsi avant cet audit.

⚠️ **Un `cursor: none` dans une feuille de chapitre ne meurt pas avec le
blocage global.** `chp2/3/4-opening.css` sont injectées EN PLUS de style.css,
APRÈS lui (`<link>` posé au moment d'entrer dans le chapitre) : leurs propres
déclarations `cursor: none` (sur `#chapitre2-root`, `.chp4-hit`, la pop-up de
la carte…) auraient survécu à la neutralisation du blocage universel — la
règle du fichier suffit à quitter un CHAPITRE mais pas ce que CE chapitre
déclare lui-même. Chacune a dû être corrigée EN PLACE (`cursor: pointer` sur
le cliquable, propriété simplement retirée sur les conteneurs).

⚠️ **Un style inline bat toute règle externe non `!important`.** Cinq zones
cliquables (`MediaPlayer.js`, `ArrowBase.js`) posent `cursor:none` dans
`style.cssText` — aucune règle CSS, aussi bien ciblée soit-elle, ne les
change sans passer par `!important`. Corrigées directement dans le JS.

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
  toucher un tracé complexe. Le banc d'essai vit désormais dans le dépôt
  (`npm run bench`) — le LANCER avant d'accuser la machine, et vérifier qu'il
  tourne bien avec `channel: 'chromium'` : en headless historique le rendu est
  logiciel et le site y tombe à ~15 i/s pour rien.

Deux notes de composition : les libellés sont RE-COMPOSÉS en Roboto Condensed
(la police de l'export, « Edges », n'est pas dans le projet ; ses `<text>` sont
jetés au chargement), et la fissure s'ouvre depuis le CŒUR de l'étoile vers ses
trois branches à la fois — une plume qui suivrait son contour fermé descendrait
une branche pour remonter par l'autre côté (cf. `propagate()` dans
`chp4-draw.js`).

## Test de non-régression (après toute modification)

**D'abord l'automate** — il couvre en trois minutes ce que l'œil ne peut pas
compter (fluidité, fuites, tabulation, console) :

```bash
node tools/bench/serve.mjs &                 # laisser tourner
npm run bench -- --self-test                 # sort en erreur si régression
npm run audit:config                         # clés de config sans lecteur
```

Il vérifie : 60 i/s sur chaque scène, aucun arbre détaché supplémentaire entre
la 1ʳᵉ et la 3ᵉ visite de chaque chapitre, focus au chargement sur le bouton de
démarrage, Entrée qui démarre, console vide. Les requêtes TIERCES en échec
(Google Fonts, qui négocie ses fichiers selon l'agent) sont signalées sans
faire échouer la campagne.

**Ensuite l'œil** — l'automate ne voit pas si c'est BEAU.
Parcours sur serveur local, console ouverte (zéro erreur attendue) :
1. Accueil (Playfair/Inter) → vitrine → phrénologie (documents + loupe).
2. Collaboration : 5 cercles (I-IV ouvrent un chapitre, V à venir), survols, titres.
3. **Chapitre 1** : intro sonore (+skip), 9 survols du crâne, 2-3 médias,
   sortie (citation typée).
4. **Chapitre 2** : bougies, les 3 sous-parties (Invisibilisation : vidéo +
   audio sous-titré + texte ; Peine démesurée : mots-clefs → médias ;
   Violence : diapos), retours (rallumage), sortie.
5. **Chapitre 3** : quiz complet → travelling → 1 tableau + théâtre de papier
   (hotspots vidéo) → triptyque → sortie.
6. **Chapitre 4** : lever de lumière (noir → page blanche, jamais de flash),
   crâne, fissure (tremblante, depuis le cœur), 5 bulles dessinées ; survol
   (invite ▶ / ↗), écoute d'une bulle (le pourtour du nuage respire et se
   referme à l'avancement), les 3 sorties d'écoute (re-clic, clic dehors,
   Échap), bascule directe d'une bulle à l'autre, pop-up carte, sortie
   (bulles à rebours, fissure qui se referme, lumière qui tombe). Vérifier
   que le bouton plein écran (bas-droite, sur le papier) est bien SOMBRE et
   la flèche (bas-gauche, sur la photo) bien BLANCHE.
7. **Chaque chapitre : entrer/sortir ×2** (le pattern factory doit rejouer
   à l'identique, sans fuite d'état ni son résiduel).
8. **Curseur, à la souris** : natif partout (flèche de l'OS), main sur tout
   ce qui est cliquable (boutons documents, cercles romains, flèches,
   hotspots du chapitre 1, bulles du chapitre 4, pop-up de la carte…), à
   AUCUN moment le halo doré dessiné ne doit apparaître. Console vide.
9. **Clavier, sans toucher la souris** : au chargement le focus est sur
   « Cliquez pour commencer » ; Entrée démarre. Puis Tab parcourt flèche,
   boutons documents, barre de navigation, plein écran — chacun avec un halo
   doré VISIBLE, et Entrée/Espace l'active. Aucun focus ne doit se perdre sur
   un élément invisible.

## Notes de déploiement

- Poids : ~375 Mo, dont 281 Mo de masters mp4 + 74 Mo de variantes mobiles
  (limite GitHub : 100 Mo/fichier — le plus gros master fait ~23 Mo, OK).
  **`npm run videos` fabrique les variantes** dans `*/mobile/`, sans jamais
  toucher aux masters (voir « Vidéos : allégées sur mobile »). Elles SONT
  versionnées : c'est ce qu'un téléphone télécharge (cf. l'avertissement en tête
  de `.gitignore`). REGARDER les fichiers produits avant de publier — les plans
  sombres du chapitre 1 et de « Violence et trace » sont les plus exposés.
  Demande un vrai ffmpeg (celui de Playwright n'a ni H.264 ni AAC) : sous
  Windows, `winget install Gyan.FFmpeg`.
- Polices : **hébergées EN LOCAL** dans `fonts/` (Cinzel, Playfair Display,
  Inter, Cormorant Garamond, Old Standard TT, Roboto Condensed — 20 fichiers
  woff2, 666 Ko, sous-ensembles latin et latin-ext seulement). `fonts/fonts.css`
  est GÉNÉRÉ par `tools/fetch-fonts.mjs` : ne pas l'éditer à la main. Licences
  (OFL, Apache 2.0) dans `fonts/LICENCES.txt`. Les fontes propres au chapitre 2
  restent dans chp2-fonts/.
  ⚠️ **Plus AUCUN appel à fonts.googleapis.com** — ni dans index.html, ni par
  `@import` dans style.css (il y en avait deux, dont un inerte car placé après
  un millier de lignes). Deux raisons de ne pas y revenir : Google négocie ses
  fichiers selon l'agent et servait une URL morte à certains navigateurs, et
  l'appel transmet l'IP du visiteur à un tiers hors UE (RGPD). Vérifié : zéro
  requête externe au chargement.
- Métadonnées : titre éditorial, description, Open Graph et `theme-color` sont
  en place dans index.html. L'image de partage pointe sur
  `images/vitrineOrfila.webp` — la remplacer par un visuel dédié en 1200×630
  le moment venu.
- Favicon : le master calligraphié est `favicon.png` à la racine (1240 px,
  900 Ko — **jamais référencé directement**, bien trop lourd pour un onglet).
  Les trois déclinaisons servies sont `images/favicon-{32,48,180}.png`, rognées
  de 18 % pour que le glyphe reste lisible en petit. Les regénérer après tout
  changement du master.
- **Déclaration d'accessibilité** : reste à rédiger et à publier (obligation
  RGAA pour un site public). Le socle technique est là (voir « Trois règles
  issues de l'audit »), mais une expérience narrative sonore et chronométrée ne
  sera jamais pleinement conforme : la déclaration doit le DIRE, nommer ce qui
  ne l'est pas, et indiquer un moyen de contact. Elle demande des informations
  que le code ne contient pas (responsable, date d'audit, voie de recours).
- Noms de fichiers : **jamais d'espaces, d'accents ni d'apostrophes** dans
  les assets (casse silencieuse possible selon l'hébergeur).
