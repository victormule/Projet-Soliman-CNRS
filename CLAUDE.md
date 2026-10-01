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

## La page d'attente vit dans un AUTRE dépôt

**`index.html` EST le site.** Il n'y a plus ici de page « Site en
construction » : elle a été extraite dans un dépôt séparé,
**https://github.com/victormule/Projet-Soliman-CNRS-beta**, qui est branché
sur `soliman-al-halabi.fr` le temps des travaux.

⚠️ **CE DÉPÔT-CI N'EST DONC PLUS DÉPLOYÉ**, et c'est la protection : tant que
Netlify pointe sur le dépôt beta, rien du site n'est en ligne. Avant, `publish
= "."` servait la racine entière derrière la page d'attente — les quatre
chapitres et 375 Mo de vidéos étaient publiquement téléchargeables, et
l'expérience n'était protégée que par un `noindex`. La séparation a fermé ça.

⚠️ **CE DÉPÔT EST DÉPLOYÉ SUR UNE ADRESSE DE TRAVAIL** —
`soliman-al-halabi-beta.netlify.app` — pour qu'on puisse se relire sur un vrai
appareil. Elle est PUBLIQUE : Netlify ne protège rien par défaut. Ce qui la
tient hors des moteurs est un seul en-tête, `X-Robots-Tag: noindex, nofollow`
sur `/*` dans `netlify.toml`. **Il n'empêche pas d'y accéder, seulement d'y
être indexé** : pour la rendre vraiment privée il faut la protection par mot
de passe de Netlify (offre payante), à activer au tableau de bord.

**LE JOUR DE L'OUVERTURE — trois gestes, dans cet ordre :**

1. Rebrancher le site Netlify du domaine sur CE dépôt.
2. **Retirer le `X-Robots-Tag` de `netlify.toml`.** L'oublier, c'est ouvrir le
   site en le laissant invisible des moteurs — la panne la plus silencieuse
   qui soit, et elle ne se voit sur aucun écran.
3. Écrire un `robots.txt` et un `sitemap.xml` : ils sont partis avec la page
   d'attente, et sans eux le site s'ouvre sans rien dire aux moteurs.
   ⚠️ Le référencement du projet vit aujourd'hui dans le dépôt beta (résumé,
   JSON-LD, texte « À propos ») — c'est de là qu'il faut le reprendre, la SPA
   ne montrant RIEN à un robot qui n'exécute pas de JavaScript.

`netlify.toml` est resté ici : il est la configuration de déploiement du
SITE, il précède la page d'attente et resservira tel quel. ⚠️ Sa CSP est
absente à dessein — celle du dépôt beta est stricte parce que cette page-là ne
charge rien ; le site, lui, est riche en médias et en JS inline, et une CSP
devinée y casserait des chapitres.

⚠️ **Le banc d'essai vise la racine** (`tools/bench/regression.mjs`, `BASE`).
C'est le geste qu'on oubliait quand la racine servait la page d'attente.

## Carte du site

```
Écran d'accueil (clic → plein écran + déblocage audio)
  └─ vitrine ─(scroll)─ phrenologie ─(scroll)─ collaboration
                            │
                            └─(barre « Carnet de Recherche »)─ carnet
                               (fond noir, le carnet hypotheses.org dans
                                un grand rectangle tracé ; ← phrénologie)
                                                 │  (5 cercles romains, I–V ouverts)
              ┌────────────────────┬─────────────┴──────┬────────────────────┐
         chapitre1            chapitre2           chapitre3           chapitre4
         (crâne interactif,   (travelling crânes  (Galerie des        (page blanche,
          9 hotspots médias)   + 3 sous-parties)   Batailles, Kléber)  fissure + 5 bulles)
```
Le cercle V ouvre le chapitre 5 : « Le devenir du corps de Soliman al-Halabi »
(photographie animée, deux témoignages, trois sous-chapitres). Les trois sont
ouverts, et chacun a son geste : le **« 1 »** fait RECULER — la salle s'éloigne,
les deux battants se referment sur du blanc, la caméra pousse sur le panneau
« Anthropologie biologique » ; le **« 2 »** ÉTEINT LA LUMIÈRE et la rallume
ailleurs — une torche fixe ouvre sur la boîte où le crâne attend, et deux
boîtes d'archive s'écrivent de part et d'autre, qui s'ouvrent sur les pièces
qu'elles contiennent ; chaque pièce consultée efface un peu plus le crâne ; le
**« 3 »** rejoue l'entrée du CHAPITRE 1 — noir, torche fixe sur une vitrine de
crânes, une voix et « Passer », sans flèche ni boussole, puis la photographie
bascule sur la vitrine au buste et l'interface revient ; dans l'ombre, une
rangée s'écrit devant le buste — quatre tombes et, au milieu, un drapeau.
Chaque tombe ouvre sa pièce ; le drapeau efface la rangée et fait monter,
plein écran, la planche « L'inhumation symbolique » avec une seconde voix.

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
  scenes/                 Une classe par scène (contrat Scene : enter/exit) —
                          dont CarnetScene (le carnet de recherche)
  utils/                  helpers.js (SVG, libellés, releaseMediaElements),
                          a11y.js (clavier + annonces), media.js (variantes
                          mobiles), cursor, viewport…
fonts/                    Polices LOCALES + fonts.css (GÉNÉRÉ) + LICENCES.txt
audit-config.js           Garde-fou : clés de config sans lecteur
package.json              OUTILLAGE SEUL (le site n'a aucune dépendance)
tools/
  bench/serve.mjs         Serveur statique (gère les Range → mp4)
  bench/regression.mjs    Non-régression : fluidité, fuites, clavier, console
  bench/chapter5.mjs      Recette du chapitre 5 (bench:chapter5)
  bench/fixtures/         Ce que la recette substitue aux vrais fichiers
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
Chapitre5/
  chp5-src/               chp5-config.js · chp5-opening.js (moteur : caméra,
                          mise au point, traits d'appel, PORTE du sous-chapitre 1,
                          INHUMATION du 3)
                          chp5-dom.js (template DOM — il FABRIQUE les cinq
                          cartels depuis la config ; leurs ancres, titres et
                          lieux sont dans chp5-config.js → `cartels`)
                          chp5-boites.js (l'inventaire de la VITRINE : les deux
                          grandes boîtes qui s'écrivent et éclatent en petites
                          — et, même geste, la rangée de tombes du 3)
                          chp5-visionneuse.js (la FENÊTRE : ce qu'une petite
                          boîte ouvre — vidéo, prise de son ou texte)
                          chp5-ambiance.js (les BANDES-SON : une par lieu,
                          fondus et boucle sans couture)
  chp5-style/ chp5-images/ chp5-medias/
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

Le chapitre 5 suit ce contrat avec `startChapitre5({ root, onReady,
onIntroComplete, onListen, onPart })` et `stopChapitre5()`. Ses callbacks
relient le moteur à la scène sans écouteurs window supplémentaires. `exit()`
attend `leaveChapitre5()` pour le fondu au noir, quelle que soit la
destination ; `closeChapitre5Part()` referme le sous-chapitre ouvert et rend la
photographie — c'est la SCÈNE qui le demande, parce que la flèche lui appartient
et qu'elle seule sait si l'on remonte d'un cran ou si l'on s'en va.
Les chargements CSS/image/module sont interrompables ; les minuteries,
animations et deux pistes audio sont libérées à chaque sortie. Le brouillon
a été rangé comme les autres chapitres (`Chapitre5/chp5-src`, `chp5-style`,
`chp5-images`, `chp5-medias`) et l'entrée est le cercle V du site : il n'y a
plus de page HTML autonome de chapitre.
Les masques SVG des traits sont bornés à leurs courbes pendant l'introduction,
puis retirés à sa fin : les garder sur cinq chemins mobiles faisait tomber
le chapitre à ~19 i/s. Le dessin et le mouvement restent identiques.

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
| **Carnet de recherche** : l'adresse, le libellé du lien de secours, la place du cadre (`largeur`, `haut`, `bas_marge`), les cadences du tracé et de la flèche ; le titre de niveau 1 est `TITLE.carnet` | `config.js` → `CARNET` |
| Fondu de disparition des flèches (toutes, chapitres compris) | `config.js` → `ARROW.hide_duration` |
| Taille des libellés de boutons : les documents s'unifient sur leur libellé le plus long (`FONTS.doc_btns`) et se coupent en 2 lignes ; « À Propos » se calibre SEUL, TOUJOURS sur 1 ligne (`DOCS.about_size_max`) ; la largeur du bouton (`DOCS.width_max`) reste le vrai plafond | `config.js` |
| Torche de la phrénologie : `PHRENOLOGIE.torch.mode` = `'follow'` (suit le curseur, `size`) ou `'fixed'` (fixe au centre, large, `size_fixed`) | `config.js` |
| Voile derrière un document ouvert : `DOCS.overlay.veil_opacity` (0 = image nue, 1 = noir) et `veil_hides_torch` (la torche s'efface pour qu'on voie l'image ailleurs que dans son halo) | `config.js` |
| **Carte du parcours** : l'interrupteur `MAP.active`, la réserve à l'ordinateur, les libellés des points (sous-chapitres du 5 compris : `chp5-porte`…), les cadences | `config.js` → `MAP` |
| Chapitre 5 — **par la carte, d'un lieu à l'autre** : le noir qui tombe sur la porte quand on la quitte pour un autre sous-chapitre, et celui qui se lève sur elle quand on y arrive | `chp5-config.js` → `porte.noirMs` / `porte.leveMs` |
| Chapitre 1 : sous-titre, lumière, timings, **hotspots (zones+médias)** | `Chapitre1/chp1-config.js` |
| Chapitre 2 : sous-titre, bougies, ambiance invisibilisation, **torche du journal (« Peine démesurée »)** | `Chapitre2/chp2-src/chp2-config.js` |
| Chapitre 3 : **sous-titre**, textes, travelling, cercles, **rayons/bokeh**, tableau, quiz | `Chapitre3/chp3-src/chp3-config.js` |
| Chapitre 4 : sous-titre, mise en page (photo/dessin), palette, **chronologie du dessin**, vie du dessin, **libellés + sons des bulles**, carte | `Chapitre4/chp4-src/chp4-config.js` |
| Chapitre 5 — **tout le chapitre**, en onze sections numérotées ① à ⑪ dans l'ordre où on le vit (le plan est en tête du fichier) : dossiers, sous-titre et **textes de l'interface** (`textes`), photographie (dont **le mur**, `image.murX`), **intensités de la caméra et de la mise au point** (`camera`, `miseAuPoint`), chronologie de l'intro, **cartels**, porte, vitrine, inhumation, geste des dessins, fenêtre des pièces, ambiance sonore | `Chapitre5/chp5-src/chp5-config.js` |
| **Les bandes-son du chapitre 5** : un fichier et un gain par lieu (`pistes`, clés = noms des lieux + `ouverture`), le long silence de l'entrée, les fondus, le chevauchement de la boucle | `chp5-config.js` → `ambiance` |
| **Les cartels** : titre, crédit et durée des témoignages ; titre des sous-chapitres et **le lieu que chacun ouvre** (sans `lieu` = « À venir ») ; leurs **ancres sur le squelette**, profondeur et phase ; ce que la main leur fait | `chp5-config.js` → `cartels` |
| **L'inventaire de la vitrine** : quels dessins, combien par rang, la place et le moment de l'arrivée | `chp5-config.js` → `restitution.boites` (la COMPOSITION est dans `cotes`) |
| **Les pièces** : quelle boîte ouvre quoi, leur code (D1…C2) et leur titre — un rang de boîtes = un dossier | `chp5-config.js` → `restitution.boites.cotes[].rangs` |
| **La rangée de l'inhumation** (quatre tombes et le drapeau) : pièces A–D et voix d'Alicia, titres, places, taille, et ce que le drapeau a de propre (`salut`, `planche`, `credit`) | `chp5-config.js` → `inhumation.tombes` |
| **Le geste des dessins** (écrire, s'ouvrir, s'envoler, s'effacer) — COMMUN à la vitrine et à l'inhumation | `chp5-config.js` → `geste` |
| **La fenêtre** des pièces : dossier des médias, voile, taille du cadre par genre, cadences — COMMUNE aux deux lieux | `chp5-config.js` → `fenetre` |

Aucun chapitre n'a plus de réglage dans `config.js` (la section `CHAPITRE3`,
qui ne portait que le sous-titre, l'a rejoint chez lui). Chaque scène de
chapitre importe la config de son chapitre **statiquement** — des données pures,
sans effet de bord : c'est ce qui la rend lisible AVANT l'`import()` du moteur,
au moment où le sous-titre paraît. Seul le MOTEUR est en import dynamique.
Il n'y a plus de registre `window.CONFIG.CHAPITRE1` : ses seuls lecteurs étaient
les alias torche supprimés.

## Le carnet de recherche (octobre 2026)

Scène `carnet` (`src/scenes/CarnetScene.js`), ouverte par le bouton « Carnet de
Recherche » de la barre de la phrénologie et par le point `carnet` de la carte.
Fond noir (la torche du site, à rayon nul) ; un grand rectangle blanc se TRACE
et le carnet (`CARNET.url`, hypotheses.org) paraît dedans aux sept dixièmes du
trait — le geste des documents de la phrénologie, en pleine largeur. Titre de
niveau 1 « Carnet de recherche » (ligne `carnet` de `LIEUX`, `TITLE.carnet`),
musée gardé comme dans le tronc commun, flèche bas-gauche vers la phrénologie
(`ArrowCarnet` — son PROPRE élément : partager `#arrow-collaboration` ferait
s'effacer les deux scènes l'une l'autre). Sortie : le site s'efface, le cadre
se dé-trace, puis le DOM est démonté (iframe vidée d'abord).

⚠️ **POURQUOI PAS `DocumentOverlay`.** Ses deux colonnes (légende, boutons)
mangeraient la largeur qu'on vient chercher, et son clic-n'importe-où REFERME —
or ici le carnet EST la scène. On reprend l'idiome (`.doc-ov-rect`, tracé en
pixels réels), pas l'objet.

⚠️ **`sandbox` SANS `allow-top-navigation`** : un lien du carnet en
`target="_top"` ferait quitter l'expérience entière (plein écran, son,
parcours). Il est bloqué ; les liens ordinaires naviguent dans le cadre.

⚠️ **OPENEDITION FILTRE LES ROBOTS (Anubis).** Le banc d'essai headless reçoit
« Votre accès a été refusé » DANS le cadre — c'est le banc qui est refusé, pas
l'incrustation : en navigateur visible le carnet s'affiche, sandbox compris
(vérifié). Ne pas « corriger » la scène pour ça. Le site ne pose aujourd'hui
ni `X-Frame-Options` ni `frame-ancestors` ; si le cadre devient un jour vide,
c'est chez lui que ça se décide, et le lien « Ouvrir le carnet dans un nouvel
onglet » (bande du bas, entre flèche et plein écran) reste le filet.

Sur la carte, le carnet part de la PHRÉNOLOGIE, devenue un carrefour (le
cercle le plus grand du dessin) : carnet à gauche, espace collaboratif à
droite, chacun par son propre trait.

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
s'éclipse avec la flèche — et `carte:presence` `{presente}` — la boussole se
dessine ou s'efface, les titres glissent en conséquence. Tous deux sont
raccordés dans `app.js` : le composant qui émet ignore celui qui écoute.

⚠️ **Un signal ne convient PAS quand il faut une réponse.** L'effacement des
titres à l'ouverture de la carte est passé par un signal (`carte:ouverte`), puis
par une PORTE (`compass.setEclipseTitres`) : la carte doit savoir combien de
temps le geste demande pour ne tracer qu'ensuite. Un `bus.emit` ne rend rien.

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
défait par `destroy()`. DEUX installations l'empruntent aujourd'hui : la
vitrine du chapitre 5 (torche fixe et centrale, `restitution.torche`, créée à
l'entrée du lieu et DÉTRUITE au retour — la laisser vivre repeindrait un
canevas plein écran pour toute la visite du chapitre), et « Une peine
démesurée » (chapitre 2) :
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

**LA CARTE PREND LA PLACE DES TITRES — CHACUN SON TOUR.** Dépliée, elle occupe
exactement le coin où ils s'écrivent. Les deux dessins ne doivent JAMAIS se
chevaucher, dans un sens comme dans l'autre :

```
ouverture :  titres effacés  ──▶  puis le cadre se trace
repli     :  cadre dé-tracé  ──▶  puis les titres reviennent
```

⚠️ **CE N'EST PAS UN SIGNAL DU BUS, ET C'EST VOULU.** Un signal se lance et
s'oublie ; ici la carte a besoin d'une RÉPONSE — combien de temps le geste
demande — pour savoir quand tracer. D'où une porte, `compass.setEclipseTitres()`,
branchée dans `app.js` sur `Title.eclipse`, **qui rend la durée de son geste**.
C'est l'idiome déjà employé par `DocumentOverlay.close()` et `CompassMap._fold()`
— qui joue un geste dit ce qu'il lui faut. Mesuré : titre effacé à 402 ms, premier
trait du cadre à 736 ms ; au repli, dernier trait à 398 ms, titre de retour à
810 ms. Zéro image de chevauchement dans les deux sens.

⚠️ Le `_buildPanel` différé teste `this.open` : on peut recliquer pendant
l'attente, et construire un panneau dans une carte déjà refermée le laisserait
orphelin à l'écran, hors de portée du repli.

⚠️ **`Title.resetEclipse()` est appelé à la FRONTIÈRE, et c'est la garantie.**
Le retour des titres passe par une minuterie, et une minuterie peut être annulée
(changement de scène pendant un repli, boussole démontée) : sans cette remise à
plat, un titre resterait éclipsé pour toute la scène suivante — panne
silencieuse et durable. Dans le noir, on ne joue rien, on rend l'état neuf.

⚠️ **`set()` COMPLÈTE UN TITRE INCOMPLET** (octobre 2026). Il était idempotent
au sens strict : « déjà posé » le faisait sortir sans rien faire. Or un retour
de carte coupé par la frontière (resetEclipse annule ses minuteries) laissait
des caractères à `opacity: 0`, et le titre de la scène suivante restait **à
moitié écrit** — le défaut « le titre ne s'écrit pas entièrement ». Même titre :
`set()` écrit désormais les seuls caractères qui manquent ; un titre entier ne
bouge pas. Et TOUS les gestes caractère par caractère (écriture, éclipse,
retour) passent par une minuterie suivie (`_geste()` / `_plusTard`) : chacun
défait le précédent — l'écriture en cours ne rallume plus de lettres sous une
carte qu'on vient de déplier.

⚠️ **UN DÉPART PAR LA CARTE NE RÉÉCRIT PAS CE QU'ON QUITTE** (`Title.partir`).
La carte se replie pendant que la scène commence sa sortie ; son repli rendait
les titres du lieu QU'ON QUITTE — réécrits en hâte, puis remplacés à la
frontière. `app.js` dit donc à Title, au saut, quel titre de niveau 1 la
destination déclare (sa ligne dans `LIEUX`) : il ne revient que s'il est le
même ; le sous-titre et l'intitulé ne reviennent JAMAIS — la scène qui arrive
écrit les siens. La consigne est levée par `resetEclipse()` à la frontière.
Elle n'est posée que si le départ a lieu (`scene.leaving`) : une scène peut le
refuser (la phrénologie avant l'ouverture de sa navigation), et les titres
resteraient éclipsés sans frontière pour les rendre. Le saut est appelé AVANT
le repli (`_onJump` puis `_fold`) : c'est le départ lui-même qui replie la
carte, en effaçant la flèche.

Une éclipse plutôt qu'un effacement parce qu'on peut entrer dans une scène carte
ouverte : le sous-titre s'écrit alors normalement dessous et paraît à la
fermeture (`set()` n'écrit tout simplement pas ses caractères tant que l'éclipse
dure — ils naissent à `opacity: 0`, c'est `eclipse(false)` qui les posera).

**LA COLONNE SE REFERME QUAND LA BOUSSOLE N'EST PAS LÀ.** Les titres occupent sa
place tant qu'elle n'est pas dessinée — début de scène (elle ne paraît qu'avec
la flèche), média au premier plan, carte désactivée — et **glissent** vers la
droite quand elle se dessine. Deux places, `--col-titres` et `--col-titres-seul`,
une transition CSS sur `left` (`MAP.titres_glisse`) : le JS ne fait que nommer la
place visée (`Title.decaler`), le CSS interpole. Ici un simple signal de bus
suffit (`carte:presence`) : personne n'attend de réponse.

⚠️ **On n'anime pas `transform` pour ce glissement.** Les niveaux 2 et 3 s'en
servent déjà pour leurs propres gestes (l'entrée qui monte, la sortie écrite du
chapitre 1 qui remonte de 6 px) : un style en ligne écraserait l'autre.

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
| `MAP.gauche_pct` / `MAP.haut_pct` | le coin haut-gauche de la BOUSSOLE (la carte s'ancre sur elle) — et, quand elle n'est pas dessinée, la place que prennent les titres (`--col-titres-seul`) |
| `MAP.titres_gauche_pct` | le bord gauche des TITRES à côté d'elle, publié en `--col-titres` par `poserColonne` |
| `MAP.titres_glisse` | la cadence du glissement de l'un à l'autre |

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
Les trois sous-chapitres du chapitre 5 (`chp5-porte`, `chp5-vitrine`,
`chp5-inhumation`) n'ont, eux, pas d'autre mémoire : Journey les retient, sur le
signal `journey:place` que la scène émet à l'ARRIVÉE dans un lieu (`app.js` :
`Journey.visit` + point courant). `visit()` REFUSE les identifiants du
chapitre 2 — le signal les transporte aussi, et les écrire ici serait la
seconde vérité qu'on s'interdit.
Remise à zéro : `window.__solimanResetJourney()`.

⚠️ **La géométrie n'est pas un réglage.** Les coordonnées des points et le tracé
des routes vivent dans `CompassMap.js`, transcrits de `images/carte-source.svg`
(viewBox **287 × 294,99** — ⚠️ le dessin n'est pas carré : le panneau, son cadre et la légende lisent largeur
et hauteur séparément) ; la rose des vents vient de `images/boussole-source.svg`
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
`Scene.jumpWithin({ part })`. Deux scènes ont plusieurs lieux : le chapitre 2
(son ouverture et ses trois installations) et le chapitre 5 (la photographie et
ses trois sous-chapitres) — chacune les montre comme quatre points.
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

⚠️ **UNE SCÈNE SIGNE SON DÉPART — `Scene.leaveTo` ne le fait pas pour elle.**
`CollaborationScene` lit `params.from` pour savoir qu'on REVIENT d'un chapitre
et refaire paraître ses cercles en 1,5 s au lieu de 5,4. Les chapitres 1 à 4
joignent `from: 'chapitreN'` à leur `navigate` ; le chapitre 5, qui s'en
remettait au `leaveTo` de base, ne joignait rien — la branche l'attendait sans
personne pour l'écrire, et l'on rentrait de ce chapitre-là, et de lui seul, en
patientant quatre secondes de plus, sans un mot en console. Il redéfinit
maintenant `leaveTo` pour signer (un `from` passé explicitement garde la main).
**Toute scène nouvelle doit le faire aussi** : le défaut ne se voit pas, il
s'attend.

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
−74 %. Six de plus depuis septembre 2026 : les films des pièces de la vitrine
et le film de la tombe D (chapitre 5), que la fenêtre charge par `setVideoSrc` — jamais par
`video.src` direct, sans quoi un téléphone recevrait le master 1080p. Vérifié au navigateur : ordinateur → master 1920×1080, téléphone →
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

⚠️ **Seul le .mp4 est décliné.** Les .mp3 pèsent 32 Mo à eux tous et une voix
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

## Le chapitre 5 : la composition suit l'IMAGE, pas la fenêtre

Le chapitre 5 est une photographie animée (caméra qui respire, mise au point
qui cherche) sur laquelle cinq cartels sont posés : deux témoignages à droite,
trois sous-chapitres numérotés à gauche. Chaque cartel est relié à un point du
SQUELETTE par un trait d'appel en pointillés. Toute la subtilité tient là : les
cartels sont placés dans la FENÊTRE, les ancres dans l'IMAGE — et
`object-fit: cover` fait glisser l'une par rapport à l'autre.

**1. LES ANCRES SONT DES POINTS DE L'IMAGE, ET DOIVENT TOMBER SUR UN OS.**
`cartels.*.ancre` (chp5-config.js, posées par le gabarit en `data-anchor-x/y`) sont des coordonnées de `chp5-opening.jpg`
(1800 × 962), projetées à chaque image par `sourcePointToViewport()`. Elles
tiennent donc au corps quel que soit le cadrage. ⚠️ Mais une ancre posée à
QUELQUES PIXELS du bord d'un os tombe dans le vide : le second témoignage
partait de (1170, 327) — vingt pixels à droite des côtes — et son trait
semblait naître de la fenêtre, pas du squelette. Il part maintenant de la main
droite (1136, 484). **Après tout recadrage ou remplacement de la
photographie, revérifier les cinq ancres à l'œil, en zoomant.**

**2. LE MUR — pourquoi les cercles ne se placent PAS en pourcentage.**
Les trois cartels de gauche portent un texte clair, qui doit s'arrêter avant le
jour de la fenêtre. Or le bord gauche du dormant ne tombe pas à une place fixe
de l'écran : elle suit le RAPPORT de la fenêtre, pas sa largeur —
**48,6 % en 16/9, 43,5 % en 3/2, 36,7 % en 4/3, 25 % en carré**. Aucune série
de `left: …%` ne peut dire ça : calée sur le 4/3, elle tenait les trois cercles
très loin du corps sur TOUS les autres écrans (c'était le défaut visible) ;
calée sur le 16/9, elle jetait le libellé en plein jour sur un 4/3.

Le moteur projette donc ce bord (`CONFIG.image.murX`, en x d'image) une fois
par redimensionnement et le publie en **`--chp5-mur`** ; la feuille y accroche
le bord DROIT des trois cartels (`.nav-callout { right: calc(100% -
var(--chp5-mur) + retrait) }`). Il ne reste alors qu'un réglage par cartel, sa
`width` — c'est elle, et elle seule, qui décale les trois cercles les uns par
rapport aux autres, comme le voulait déjà la composition d'origine (ses trois
boîtes finissaient toutes à 37 %).

⚠️ **Publié depuis `resize()`, avec la caméra de BASE.** C'est une valeur de
MISE EN PAGE : la republier à chaque image ferait relayouter à 60 i/s, et la
dérive au repos ferait respirer les cartels ; l'approche de l'intro les
déplacerait pendant qu'ils se dessinent. La dérive (±6 px) est absorbée par le
retrait de la feuille. Sous « mouvement réduit » la caméra est l'identité — la
projection du mur doit l'être aussi, sinon il ment.

⚠️ **En PORTRAIT le mur ne veut plus rien dire** : la fenêtre déborde du cadre
(12,5 % de l'écran en 0,69, hors champ sur un téléphone), il n'y a plus de pan
de mur où poser un texte. Les deux media queries basses reprennent donc la main
en `left` — et remettent `right: auto`, sans quoi les deux se contrediraient.

**3. LE CHIFFRE DEVIENT UNE FLÈCHE AU SURVOL**, et le curseur dit la vérité.
Un sous-chapitre À VENIR porte `aria-disabled="true"` et `cursor: default` ;
le geste de survol, lui, se joue en entier — le chiffre s'efface, la flèche
vers la droite prend sa place. C'est la CONFIG qui en décide : un
sous-chapitre qui déclare un `lieu` (`cartels.sousChapitres[].lieu`) reçoit
un `data-part` — cliquable, `cursor: pointer` ; sans `lieu`, le gabarit
lui met `aria-disabled` et ajoute « À venir » à son surtitre. Les trois
ont un lieu depuis septembre 2026. Un lieu que le moteur ne sait pas jouer est
dénoncé en console au montage.

⚠️ **L'ORDRE DES CARTELS SUIT LE SQUELETTE.** Le gabarit les trie par
`ancre.y`, témoignages et sous-chapitres mêlés : c'est l'ordre de tabulation
ET le rang qui décale la dérive de chacun dans le moteur. Il reproduit l'ordre
qui était écrit à la main (a1, n1, n2, a2, n3) — déplacer une ancre peut donc
changer l'ordre de tabulation, et c'est voulu.

⚠️ **`animation-fill-mode: backwards`, et non `both`, sur l'apparition des
symboles.** Une animation qui remplit vers l'AVANT garde la main sur `opacity`
et `transform` pour toujours — elles battent toute déclaration ordinaire. Avec
`both`, le chiffre ne pouvait donc ni rapetisser ni pivoter en cédant la place
(seul `visibility`, que les keyframes ne touchent pas, passait encore) : la
moitié du geste manquait, sans une erreur nulle part. `backwards` rend
l'élément à ses règles de base en finissant — lesquelles décrivent exactement
son état d'arrivée, donc rien ne bouge au repos.

**4. Pas d'événement window : des CALLBACKS.** Le chapitre 5 ne parle pas à sa
scène par `CustomEvent` mais par les quatre fonctions que `startChapitre5()`
reçoit (`onReady`, `onIntroComplete`, `onListen`, `onPart`) — c'est pourquoi il
n'apparaît pas dans la table des événements window plus haut. `onListen` est le
déclencheur « média au premier plan » du chapitre : un témoignage qu'on écoute
— ou un sous-chapitre en train de s'ouvrir — éclipse la flèche, et la boussole
avec elle.

⚠️ **`onPart(index, etat)` PARLE DEUX FOIS, ET C'EST NÉCESSAIRE.** `'depart'`
dit où l'on VA, dès le clic : c'est là que le sous-titre cède sa place, parce
que c'est en le lisant qu'on comprend où l'on est emmené. `'arrivee'` dit qu'on
y EST : c'est là seulement que la flèche revient. Un signal unique aurait forcé
l'un des deux à mentir — un sous-titre qui n'arrive qu'au bout de cinq
secondes, ou une flèche qui reparaît au milieu du passage.

**5. Les masques SVG ne servent qu'à l'introduction.** Ils sont bornés à
l'enveloppe de leur courbe pendant le tracé, puis RETIRÉS à la fin : les garder
sur cinq chemins mobiles faisait tomber le chapitre à ~19 i/s. Le dessin et le
mouvement sont identiques sans eux.

**6. LA PORTE — le sous-chapitre 1 est un LIEU SUPERPOSÉ, pas une scène.**
Cliquer le « 1 » ne navigue pas : on RECULE. La photographie s'éloigne
(`porte.recul`) et se trouble, les deux battants entrent par les côtés et se
rejoignent, le noir prend la salle, puis — une seconde plus tard — la caméra
pousse sur le panneau « Anthropologie biologique ». La flèche ramène alors à la
photographie ; il faut un SECOND retour pour quitter le chapitre.

⚠️ **LES DEUX BATTANTS SONT LES DEUX MORCEAUX D'UNE MÊME PHOTOGRAPHIE**
(2208 × 2968), coupée sur `porte.joint` : le gauche est x 0…860, le droit
861…2207. Chacun est posé dans SA part du cadre (39 % / 61 %, écrites par
`renderPorte`), et les deux refont l'image au pixel près — c'est ce qui permet
de ne les animer qu'en TRANSLATION, sans jamais accorder deux cadrages.
`joint` dit donc deux choses : où ils se rejoignent, et de combien chacun doit
s'effacer pour quitter l'écran.

⚠️ **CE SONT DES JPEG DEPUIS QU'ILS SONT RECADRÉS.** C'étaient deux PNG du
canevas ENTIER à transparence complémentaire, superposés dans la même boîte :
6,5 Mo à eux deux pour une photographie de porte. Recadrés, ils n'ont plus
besoin de transparence — donc plus de PNG : **0,38 Mo, 48 dB de PSNR**, et un
décodage qui passe de 318 ms à 29 et 39 ms. Les masters restent à côté (.png),
et les commandes ffmpeg qui refabriquent les JPEG sont écrites dans
`chp5-config.js`. ⚠️ En **4:4:4**, pas en 4:2:0 : le panneau porte du texte
ROUGE sur fond clair, que le sous-échantillonnage de chrominance baverait — et
on le regarde en gros plan, à sa résolution native.

⚠️ **LE FOND EST CLAIR (`porte.fond`), ET C'EST LUI QU'ON VOIT DE PART ET
D'AUTRE.** La salle ne s'éteint pas en se refermant : elle BLANCHIT, à la
vitesse exacte des battants, et la porte se pose sur du blanc. Trois choses en
dépendent, qu'il faut regarder ensemble avant de changer cette couleur :
 · les TITRES la traversent (haut-gauche) — dorés, ils tiennent sur le blanc
   comme de l'or sur une carte, mais tout juste ; un fond plus clair encore,
   ou des titres plus pâles, et la colonne devient illisible ;
 · la FLÈCHE et la BOUSSOLE, blanches, ne paraissent QU'À LA FIN du gros plan,
   c'est-à-dire sur le gris sombre de la porte — jamais sur le blanc. C'est ce
   qui permet de ne rien changer à leur couleur ; avancer leur retour les
   ferait disparaître ;
 · le bouton PLEIN ÉCRAN (bas-droite) est blanc lui aussi et tombe, lui, dans
   la bande claire pendant la fermeture : il s'y devine à peine. C'est le seul
   endroit du geste où l'interface paie le fond clair.

⚠️ **QUATRE AVANCEMENTS, ET RIEN D'AUTRE** (`reculP`, `fermeP`, `voileP`,
`zoomP`) : tout l'écran s'en déduit dans `renderPorte()`, appelé par la boucle.
Ce ne sont pas des animations posées une fois, et c'est voulu — une bascule
plein écran ou une rotation en cours de geste doit pouvoir REDESSINER l'instant
présent sans le rejouer ni le figer (`refreshLayout` le fait).

⚠️ **LE GROS PLAN EST UNE ANCRE QUI GLISSE, PAS UN `transform-origin`.** Le
panneau doit arriver AU CENTRE : il faut grossir et recadrer en même temps. Le
point du cadre tenu au centre passe du milieu de la porte au milieu du panneau
pendant que l'échelle monte, et une seule formule — `T = centre − ancre ×
échelle` — écrit les deux gestes. Un `transform-origin` posé sur le panneau
l'aurait fait grossir SUR PLACE, donc déborder d'un seul côté.

⚠️ **`porte.panneauHauteur` N'EST PAS UN CHIFFRE LIBRE : la colonne de titres
passe devant.** Le panneau est presque blanc, les titres sont dorés. Le panneau
étant centré, sa hauteur décide de son bord supérieur : mesuré, le bloc
haut-gauche (titre, sous-titre, intitulé du sous-chapitre, boussole) descend
jusqu'à 12 % de la fenêtre, d'où **70 %** — le panneau s'arrête dessous, sur le
gris sombre de la porte. Monter ce chiffre, c'est jeter les titres en plein sur
le panneau, aux trois formats. Bénéfice second : à 70 % le panneau est affiché
à peu près à sa résolution native (863 px) et reste NET ; à 90 % il était
agrandi d'un tiers et visiblement mou.

⚠️ **LE NIVEAU 3 DOIT ÊTRE REMONTÉ EN z 600** (`body.chp5-active
#chapitre-part-title`, style.css). Sans cela `Title.showPart()` pose bien son
texte et sa classe, l'élément a bien une boîte — et il reste ENTERRÉ sous
`#chapitre5-root` (z 500). Le défaut ne se voit nulle part ailleurs qu'à
l'écran : ni console, ni mesure de classe. Toute scène qui se met à écrire le
niveau 3 doit s'ajouter à cette liste.

⚠️ **LES BATTANTS NE SE CHARGENT QU'À LA FIN DE L'INTRODUCTION**
(`chargerPorte`, appelé depuis `finishIntro`) : posés dans le gabarit, ils
téléchargeraient EN MÊME TEMPS que la photographie d'ouverture — que la scène
attend pour lever son rideau noir. Le « 1 » n'est de toute façon pas cliquable
avant. Ce préchargement coûtait une image entière du temps des PNG (67 ms,
mesuré) ; en JPEG recadré il tient dans 68 ms de décodage pour les DEUX.

⚠️ **AU DOIGT, LE PREMIER APPUI NE FAIT QUE RÉVÉLER L'INTITULÉ.** Il n'y a pas
de survol sur un écran tactile : entrer dès le premier appui, ce serait faire
entrer dans un sous-chapitre qu'on n'a pas pu lire. C'est le second qui ouvre.

⚠️ **UN SEUL CALCUL DE PREMIER PLAN.** `onListen` dit « quelque chose passe
devant » — un témoignage qu'on écoute OU la porte en mouvement — et le moteur
n'en fait qu'UNE réponse (`occupe()`). Deux sources indépendantes donneraient à
la flèche deux ordres contraires. `onPart(index|null)` dit ensuite OÙ l'on est ;
il est émis AVANT la libération du premier plan, sinon la flèche reviendrait en
annonçant encore la sortie du chapitre.

⚠️ **LA FLÈCHE A DEUX DESTINATIONS, ET UN SEUL CÂBLAGE.** `ArrowBase.show()`
reconstruit le tracé et rejoue son dessin de 1,4 s : rebrancher son `onclick` à
chaque changement de lieu la ferait re-dessiner au milieu du chapitre, sans
raison visible. Elle appelle toujours `_onArrow()`, qui lit l'endroit où l'on
se trouve ; seul son nom accessible change. En revanche, au RETOUR elle est
re-`show()`ée et non simplement dé-éclipsée : c'est elle qu'on vient de
cliquer, et l'effet de clic a dissous son tracé (`_rippleClick` laisse le SVG à
opacité nulle) — une éclipse seule rendrait un cadre vide et cliquable.

⚠️ **LA SALLE CESSE DE VIVRE DÈS QU'ON NE LA VOIT PLUS** (`salleCachee`).
Derrière un voile opaque — le fond de la porte, le noir de l'extinction, ou la
vitrine montée — plus rien n'est visible : continuer d'écrire un flou plein
écran (qui se REPEINT, lui) et de remesurer cinq cartels invisibles ne serait
que du travail perdu, précisément sur les images où le visiteur regarde
ailleurs.

**7. LA VITRINE — le sous-chapitre 2 éteint la lumière et la rallume ailleurs.**
Cliquer le « 2 » ne fait pas reculer, il fait NOIR : le voile `#chp5-nuit`
monte, les deux prises se chargent derrière lui, le décor se monte, le noir se
retire — sans que rien change à l'écran, car le canevas de la torche a pris le
relais — puis la torche s'ouvre sur la boîte. Le retour rejoue l'inverse.

⚠️ **CE N'EST PAS UNE CHRONOLOGIE, CE SONT DES ÉTAPES QUI S'ATTENDENT.** La
porte se déduit du temps écoulé (quatre avancements) ; la vitrine, non — elle
attend un DÉCODAGE, et sur une liaison lente un TÉLÉCHARGEMENT. La mise en
scène paie l'attente d'elle-même : le noir est déjà là, il ne se lève que
lorsque les deux prises sont prêtes. C'est pourquoi elles ne sont pas
préchargées à la fin de l'intro, à la différence des battants : on ne met pas
la photographie des réserves à genoux pour un lieu où l'on n'ira peut-être
jamais.

⚠️ **JPEG, RAMENÉES À 3200 px.** Les masters font 5500 × 3864 : **27 Mo** à eux
deux, ~1 s de décodage chacune et 85 Mo de texture pièce, pour une image
qu'aucun écran ne montre à plus de 4000 px. Réduites : **0,55 Mo**, 46,6 et
48,0 dB de PSNR (Y), 70 et 87 ms de décodage. Les masters restent à côté
(.png) et les commandes ffmpeg sont dans `chp5-config.js`.

⚠️ **`contain`, PAS `cover`.** La photographie est en 1,42 et la fenêtre
presque toujours plus large : la rogner verticalement mangeait le haut de la
boîte et le sol. On la montre ENTIÈRE, et le noir tombe à gauche et à droite
(sur un écran plus étroit qu'elle, il tomberait en haut et en bas). C'est aussi
ce qui garde le crâne au centre de la fenêtre, là où la torche est fixée.

⚠️ **LE CRÂNE S'EFFACE À MESURE QU'ON CONSULTE LES PIÈCES** (`poserPresence`).
La prise PLEINE est AU-DESSUS de la vide ; son opacité vaut `1 − vues / total`
— 100 % tant qu'on n'a rien ouvert, 0 % quand toutes les pièces de
l'inventaire ont été vues (le total se lit de la composition : une pièce
ajoutée compte aussitôt). Seules les PETITES boîtes comptent : ouvrir une
grande ne fait que déplier l'inventaire.
 · **Le pas se joue à la FERMETURE de la pièce**, en fondu
   (`restitution.effacementMs`) : sous le voile de la fenêtre on ne l'aurait
   pas vu. On rend la vitrine, et le crâne recule d'un pas.
 · **À l'arrivée il est POSÉ, pas joué** : on revient dans un lieu où l'on a
   déjà lu, le crâne y est déjà à demi parti — il ne doit pas s'effacer de
   nouveau sous la torche qui s'ouvre.
 · **Ce qu'on a lu ne s'oublie pas en sortant** : le registre `vues` du module
   des boîtes survit à la sortie du lieu (quand `ouverts` est vidé), le temps
   de la visite du chapitre. On retrouve les deux grandes boîtes fermées ET un
   crâne à demi parti, et les boîtes déjà lues gardent leur teinte.
 · ⚠️ **Ce jeu a REMPLACÉ celui de la main** (le crâne disparaissait sous le
   curseur, `proche`/`loin`/`suivi`, supprimés avec leur code). Les deux
   ensemble se contrediraient : la main aurait vidé une boîte qu'aucune pièce
   n'avait encore effacée.

⚠️ **LA PRISE PLEINE NE DESCEND JAMAIS TOUT À FAIT À ZÉRO** (`PLANCHER_PLEIN`,
deux millièmes). À opacité nulle, le compositeur abandonne sa texture et doit
la reconstruire au moindre changement : mesuré du temps des masters
(21 mégapixels, ~85 Mo de texture), des images de 50 et 166 ms, disparues avec
ce plancher. Deux millièmes de la DIFFÉRENCE entre les deux prises, c'est moins
d'un niveau sur 255 — rien à l'œil : le crâne est parti.

⚠️ **LES DEUX PRISES DOIVENT ÊTRE RIGOUREUSEMENT SUPERPOSABLES.** Le fondu ne
vaut que par leur cadrage commun : c'est la même photographie, prise deux fois,
l'une pleine et l'autre vide. Après tout remplacement, vérifier que la boîte ne
bouge pas d'un pixel entre les deux.

⚠️ **LA TORCHE EST CELLE DU SITE, ET ELLE MEURT AVEC LE LIEU.** `TorchSystem`
sur un canevas à nous (celui du tronc commun est enterré sous le root, z 500),
fixe et centrale comme à la phrénologie. Créée à l'entrée, DÉTRUITE au retour :
laissée en vie, elle repeindrait un canevas plein écran soixante fois par
seconde pour toute la visite du chapitre, y compris devant la photographie.
Son `resize()` est appelé depuis `refreshLayout` — un canevas-masque qu'on
redimensionne sans le repeindre dans le même tour laisse la page à nu.

**LA CONFIG DU CHAPITRE — onze sections, dans l'ordre du chapitre** (refonte
de septembre 2026). ① dossiers · ② le chapitre (sous-titre, sortie, TOUS les
textes de l'interface) · ③ la photographie (image, mur, intensités de la
caméra et de la mise au point) · ④ l'introduction · ⑤ les cartels · ⑥ la
porte · ⑦ la vitrine · ⑧ l'inhumation · ⑨ le geste des dessins · ⑩ la
fenêtre des pièces · ⑪ l'ambiance sonore (octobre 2026). Ce qui est COMMUN à deux lieux (⑨, ⑩) a sa propre
section : le geste et la fenêtre vivaient dans `restitution.boites`, et
l'inhumation les y empruntait. ⚠️ **Ce qui n'y est PAS, à dessein** : les
FRÉQUENCES des mouvements (les sinus du moteur — la signature du geste ; seules
leurs intensités sont réglables), les couleurs et la typographie (dans la
feuille, partagées avec le site), la géométrie des dessins (dans les SVG).
La refonte a été vérifiée valeur par valeur contre l'ancienne config : aucun
chiffre n'a changé, rien ne bouge à l'écran.

**7 bis. L'INVENTAIRE — deux boîtes d'archive qui s'ouvrent sur ce qu'elles
contiennent.** De part et d'autre du crâne, deux grandes boîtes dessinées à
l'encre s'écrivent à l'arrivée dans la vitrine. Au survol elles passent à l'or
et grossissent ; au clic, la boîte se dé-écrit et se referme sur elle-même,
une onde dorée part de son centre, et les petites boîtes qu'elle contenait
s'élancent vers leur place en s'écrivant en chemin — sept à gauche (2 · 1 · 4),
deux à droite. Moteur : `Chapitre5/chp5-src/chp5-boites.js`. (La ligne D1 en
compte TROIS depuis l'ajout de la carte mentale : 3 · 1 · 4 à gauche.)

⚠️ **ON N'EN REVIENT PAS — MAIS LA SORTIE REFERME TOUT.** Dans le lieu, une
boîte ouverte ne se referme pas : aucun second clic ne la reconstitue, et son
bouton se retire (`disabled`, `aria-expanded="true"`). En REVANCHE, quitter le
sous-chapitre éteint la vitrine, et l'on y revient devant les deux grandes
boîtes intactes (`ouverts.clear()` dans `demonter`). Les deux règles ne se
contredisent pas : la première dit qu'on ne défait pas un geste, la seconde
qu'on ne rallume pas un lieu sur des boîtes déjà éventrées — sans quoi la mise
en scène de l'arrivée ne se jouerait qu'une fois dans toute la visite.

⚠️ **LA SORTIE EST UN GESTE, PAS UNE COUPURE** (`boites.sortir()`, appelé par
`fermerVitrine` AVANT `torche.fadeOut`). Les boîtes se dé-écrivent, des plus
LOINTAINES du centre aux plus proches, et la lumière ne tombe qu'ensuite.
L'ordre n'est pas négociable : elles vivent AU-DESSUS du canevas de la torche.
Éteindre d'abord, c'était les laisser blanches et pleines sur une photographie
déjà noire, jusqu'à ce que le voile d'extinction les avale d'un bloc — on
emportait le décor au lieu de quitter le lieu.

**CHAQUE PETITE BOÎTE OUVRE UNE PIÈCE.** Au survol (et au focus clavier), son
titre s'écrit en bas de l'écran ; au clic, un RECTANGLE BLANC se trace au
milieu, et la pièce n'apparaît que DEDANS, aux sept dixièmes du trait — le
geste des documents de la phrénologie (`DocumentOverlay`) et du lecteur du
chapitre 1 : d'abord le cadre, ensuite ce qu'il contient. Moteur :
`chp5-visionneuse.js`.

⚠️ **LE CODE DU DOSSIER (D1, C2…) NE S'AFFICHE NULLE PART** — ni sous la pièce,
ni en bas de l'écran, ni dans le nom accessible des boîtes. C'est un repère de
rangement, pas un titre ; il reste en `data-dossier`, que le banc d'essai lit
pour vérifier qu'un rang de boîtes porte bien son dossier.

⚠️ **LE RECTANGLE SE TRACE EN PIXELS RÉELS**, viewBox égal à la taille du cadre
et tirets égaux à son périmètre — JAMAIS `pathLength` avec
`non-scaling-stroke` (l'avertissement de `DocumentOverlay`, qui s'appliquait
à la première version). Et **un tracé en cours ne se repose pas** : une vidéo
en cache annonce son format quelques millisecondes après le clic, et la reposer
« net » coupait le trait au départ — le rectangle paraissait d'un bloc, sans
qu'aucun test ne le voie. Seul le film image par image l'a montré.

⚠️ **UN RANG DE BOÎTES = UN DOSSIER, ET LA COMPOSITION EN DÉPEND.** À gauche,
le rang de TROIS porte les deux pièces de D1 et la carte mentale, celui d'UNE la pièce de D2, celui
de QUATRE les quatre de D3 ; à droite, les deux prises C1 et C2. Ce n'est pas
une coïncidence : le dessin des rangs a été fait pour ces dossiers-là. Ajouter
une pièce à un dossier demande donc d'ajouter une boîte à SON rang — sinon la
pièce n'a nulle part où se ranger, et rien ne le dira.

⚠️ **LE TYPE D'UNE PIÈCE SE LIT DE SON EXTENSION** (`.mp4` → on regarde, `.mp3`
→ on écoute, `.pdf` → on lit). Une clé `type` dans la config serait un second
endroit à tenir d'accord avec le fichier, et c'est toujours le second qui ment.

⚠️ **POURQUOI PAS `MediaPlayer` ?** Parce qu'il écrit dans `#media-player`, qui
vit dans `#app` : vu de `#chapitre5-root` (contexte d'empilement à z 500), il
est ENTERRÉ. C'est mot pour mot ce qui a valu à la torche de la vitrine son
propre canevas et au titre de survol sa `.legende`. On ne réutilise pas un DOM
qu'on ne peut pas voir ; on reprend l'idiome, pas l'élément.

⚠️ **UNE VIDÉO GARDE LA BARRE DU NAVIGATEUR** — ce sont des entretiens d'une à
trois minutes, on doit pouvoir s'y déplacer — **et ne démarre pas d'office** :
on voit son affiche, puis on la lance.

⚠️ **UNE PRISE DE SON SE JOUE COMME AU CHAPITRE 1** : un cercle tracé avec son
triangle, la SINUSOÏDE vivante lue sur un `AnalyserNode`, mêmes couleurs et
même trait (`CONFIG.PLAYER`, la source unique du lecteur du site), et elle se
lance d'elle-même quand la plaque paraît. Seul ajout : une ligne d'avancement à
peine visible, cliquable — deux minutes de parole demandent qu'on puisse y
revenir. Le graphe est bâti sur le contexte de L'`AudioManager` du site —
jamais un second —, que `Chapitre5Scene` transmet désormais au moteur
(`startChapitre5({ audio })`). S'il manque, le son se joue quand même, sans
courbe. ⚠️ À la fermeture, source ET analyseur sont `disconnect()`és :
`analyser = null` ne suffit pas (cf. `MediaPlayer`), un nœud resté branché
sur le contexte du site y survit avec son élément.

⚠️ **LES DEUX TEXTES PASSENT PAR LE LECTEUR PDF DU NAVIGATEUR** (`<iframe>`,
`#toolbar=0&navpanes=0&view=FitH` — sans quoi Chrome ouvrait son panneau de
vignettes sur un tiers du cadre et affichait le nom de fichier Word).
Aucun rastériseur n'était disponible pour en faire des images, et on ne le
VOUDRAIT pas : une loi et une recommandation se lisent, se cherchent et se
zooment. Un lien « ouvrir dans un nouvel onglet » sous le cadre couvre les
navigateurs qui refuseraient de l'afficher en ligne. ⚠️ Le serveur d'essai a dû
apprendre le type `application/pdf` (`tools/bench/serve.mjs`) : sans lui le
navigateur TÉLÉCHARGE le fichier et le cadre reste vide, sans une erreur nulle
part.

⚠️ **LA PIÈCE EST VIDÉE À CHAQUE FERMETURE**, pas rangée : source retirée,
`load()` rappelé, nœud jeté. Un `<video>`/`<audio>` dont la sélection de
ressource a commencé retient son arbre entier (règle d'août 2026) — une visite
qui ouvre les neuf pièces laisserait autrement neuf médias vivants derrière
elle.

⚠️ **UNE VIDÉO OU UNE PRISE DE SON QUI S'ACHÈVE REFERME SA FENÊTRE** — il n'y a
plus rien à voir, et c'est en rendant la vitrine que le crâne recule d'un pas.

⚠️ **LA CARTE MENTALE EST UNE PIÈCE COMME LES AUTRES**, portée par la clé
`carte` (une URL, cadrée sur `section:b_restit`) au lieu de `piece`. C'est le
cadre intégré du chapitre 4 (mêmes attributs que `chp4-portal.js`), et son
droit d'encadrement se règle dans l'AUTRE dépôt (`frame-ancestors` de
soliman-map-v3, qui liste déjà `*.netlify.app`, `localhost` et
`127.0.0.1`). ⚠️ La carte écrit en console un avertissement qui lui appartient
(`upgrade-insecure-requests` dans une CSP « report-only », que le navigateur
ignore) : le banc d'essai le SIGNALE sans échouer. À corriger là-bas.

⚠️ **TROIS SORTIES, ET LE FOCUS REVIENT À LA BOÎTE.** La croix (haut-droite),
le clic hors du cadre, la touche Échap. En fermant au clavier, le focus retourne
sur la boîte qu'on a cliquée : sans cela il tombe sur `body` et la tabulation
suivante repart du haut du document — on perd sa place dans l'inventaire.
(⚠️ Le moteur doit transmettre la boîte à la fenêtre : `ouvrirPiece: (item,
depuis) => …`. Un `item => …` seul la perdait en route, sans erreur ni test
pour le voir — c'est arrivé.)

⚠️ **UNE PIÈCE OUVERTE EST UN MÉDIA AU PREMIER PLAN.** `occupe()` le dit en
interrogeant la fenêtre elle-même, et non ses `<video>` une à une : la flèche et
la boussole s'effacent comme devant un témoignage. C'est le calcul UNIQUE du
chapitre — deux sources donneraient à la flèche deux ordres contraires.

⚠️ **CHAQUE GENRE A SA BOÎTE.** Une vidéo garde SON format, bornée par
`fenetre.largeur` / `hauteur` (la plus serrée décide). Un texte se LIT : il
prend la largeur (`largeurTexte`) — borné au format A4 il ne faisait que
440 px en 16/9, et la loi ne se lisait pas. Une prise de son est un bandeau
(`largeurSon`, `rapportSon`). ⚠️ `hauteurTexte` n'est pas libre : le cadre
étant centré, le monter le fait passer sous la colonne de titres (dorés,
illisibles sur une page blanche) — même règle que `porte.panneauHauteur`.

⚠️ **LE TITRE DE SURVOL NE S'ÉTEINT PAS ENTRE DEUX BOÎTES.** Les boîtes sont
séparées par un jour : aller de l'une à l'autre, c'est sortir de la première
avant d'entrer dans la seconde, et le titre repartait en fondu pour revenir
aussitôt — un battement à chaque déplacement. Le retrait est donc différé d'un
souffle (`CONGE_LEGENDE`), que l'entrée suivante annule. Même filet qu'au
chapitre 1.

⚠️ **LES DESSINS SONT INLINÉS, PAS POSÉS EN `<img>`.** Une image est opaque :
on n'atteint ni ses tracés ni leur `stroke`. Or c'est TOUT ce que ce lieu
demande. D'où un `fetch` + inlining, une fois par visite, **derrière
l'extinction** — avec le décodage des deux photographies, là où l'attente est
déjà payée par la mise en scène.

⚠️ **UN TRACÉ CLASSÉ EST UN TRAIT, UN TRACÉ SANS CLASSE EST UN APLAT.** C'est
la seule chose qui distingue les deux dans les neuf exports (`cls-1` ou `st0`
selon la version d'Illustrator). ⚠️ Les tombes ont une SECONDE classe, `cls-2`
(le croissant et l'étoile, pleins) : elle est déclarée APLAT
(`CLASSES_APLAT`), et le drapeau n'a aucune classe — tout aplat. Pendant l'écriture, TOUT devient un trait :
on suit le contour d'un aplat à la plume, et l'encre le remplit derrière. Un
export qui arriverait avec une autre classe est **dénoncé en console**.

⚠️ **L'ÉCRITURE VA DU PLUS GRAND TRACÉ AU PLUS PETIT**, et non dans l'ordre du
fichier (celui d'Illustrator ne dit rien) ni du bas vers le haut (on ne voyait
alors, pendant quatre dixièmes de seconde, que les trois miettes d'encre du
pied de la boîte). Par la surface, le dessin se fait comme une main le ferait :
le cadre, le champ blanc, le numéro, les taches.

⚠️ **RIEN N'EST UN `left: …%` — C'EST LA LEÇON DU MUR, ENCORE.** La
photographie est en `contain` : ses bords suivent le RAPPORT de la fenêtre. Le
module mesure donc la BANDE LIBRE de chaque côté — du bord de la fenêtre
(`marge`) au crâne (`garde`, en fraction de la largeur RENDUE de la
photographie) — et y centre le groupe. Quand la bande se resserre (un 4/3, un
téléphone), les boîtes RAPETISSENT ensemble plutôt que de mordre sur le crâne
ou de sortir du cadre. Vérifié à cinq formats, du 16/9 au portrait.

⚠️ **LE TRAIT NE SUIT PAS L'ÉCHELLE DU DESSIN** (`vector-effect:
non-scaling-stroke`, `--boite-trait` en pixels d'écran). Les tracés font 2
unités dans une vue de ~200 : une petite boîte les rendrait à un demi-pixel, et
son dessin s'effacerait. Même parti que les traits d'appel des cartels.

⚠️ **LA COUCHE DES BOÎTES EST HORS DE `.vitrine`, ET C'EST NÉCESSAIRE.** Celle
du décor est `aria-hidden` et `pointer-events: none` — deux photographies et un
canevas, rien à toucher — quand les deux grandes boîtes sont de VRAIS boutons,
cliquables et atteignables au clavier. Elles vivent donc à côté, en z 32 :
au-DESSUS du canevas de la torche (z 30, qui les noierait — elles sont à la
périphérie) et SOUS le voile d'extinction (z 35, qui doit les couvrir quand on
s'en va).

⚠️ **LE TEMPS MORT EST LE DÉFAUT À NE PAS REFAIRE.** `boites.volAt` doit tomber
AVANT la fin du retrait : les petites sortent de DESSOUS la grande pendant
qu'elle se referme. Réglé plus tard, on voyait la grande disparaître, puis trois
dixièmes de seconde d'écran vide, puis les petites arriver — trois gestes au
lieu d'un. Et l'opacité du retrait TIENT pendant que l'échelle tombe (0,92 à
mi-course) : sans cela le geste n'est plus qu'un fondu, et l'on ne voit pas la
boîte se refermer.

⚠️ **LA MESURE DES 469 TRACÉS SE FAIT DERRIÈRE LE NOIR.** Les ordonner demande
autant d'appels à `getBBox` — une image de 84 ms, mesurée, au moment précis où
la torche s'ouvre. Faite au montage (`construire`), elle tombe avec le décodage
des photographies, où elle ne se voit pas. Coût final : 60 i/s pendant
l'écriture, 56 i/s pendant l'éclatement, **zéro animation vivante au repos**
(`poser()` rend chaque dessin à sa feuille de style).

**7 ter. L'INHUMATION — le sous-chapitre 3 rejoue l'entrée du chapitre 1.**
Cliquer le « 3 » éteint la lumière, comme le « 2 ». On rallume sur la vitrine
des crânes (`inhumation.avant`), torche fixe et serrée, et l'on n'y fait
qu'ÉCOUTER : quelques secondes de silence (`voixApresMs`), puis la voix
d'Alicia et, un souffle après, « Passer ». La voix finie — ou passée —, la
photographie BASCULE sur la vitrine au buste (`inhumation.apres`) : la
nouvelle monte en dézoomant (1,12 → 1), l'ancienne s'éloigne en s'effaçant
(→ 1,10), la torche s'élargit (`torche.apres`). C'est le geste de
`Chapitre1Scene._transitionIntroToBase`, à l'identique. Alors seulement la
flèche revient, la boussole avec elle. Moteur : `chp5-opening.js` (bloc
« L'INHUMATION »), sur la même mécanique que la vitrine.

⚠️ **PAS DE FLÈCHE NI DE BOUSSOLE PENDANT LA VOIX — ET AUCUN CODE NE LES
CACHE.** C'est `occupe()` qui le fait : tant que `placeGeste` court (attente,
aller, bascule), le premier plan est occupé et la scène tient la flèche
éclipsée. Le lieu n'est POSÉ (`placePosee`) qu'au bout de la bascule. Ne pas
« optimiser » en posant le lieu dès que la voix commence : l'interface
reviendrait par-dessus elle.

⚠️ **« PASSER » EST REDIT ICI, PAS EMPRUNTÉ.** `#skip-btn` vit dans `#app`,
donc enterré sous `#chapitre5-root` (z 500) — la même raison qui a donné à la
vitrine son canevas de torche et sa `.legende`. Même dessin (cadre tracé en
pixels réels, mot qui paraît ensuite, or et grossissement au survol), même
taille (celle des flèches, `taillePasser`). C'est un vrai `<button>` ; entré
au clavier, le focus l'attend (le cartel du « 3 », devenu `inert`, l'a lâché
sur `body`).

⚠️ **LA VOIX EST UN `new Audio()` DU MOTEUR, VIDÉE À CHAQUE FIN** — passée,
finie, retour, départ du chapitre (`viderVoix` : pause, source retirée,
`load()`). Elle est coupée NET au « Passer », comme au chapitre 1
(`stopPhrenoSound`). Si elle ne se lit pas (fichier manquant, décodage), on
bascule directement, en le disant en console : la voix n'est pas une
condition pour arriver.

⚠️ **UNE SEULE TORCHE À LA FOIS, PAR UN SEUL CHEMIN** (`creerTorche`). La
vitrine et l'inhumation ont chacune leur canevas, dans leur couche, mais la
même variable `torche` : elles ne coexistent jamais, et `salleCachee`,
`refreshLayout` et `destroy` n'ont ainsi qu'un objet à connaître.

⚠️ **`inhumation.apres` FAIT 794 × 612 px** (une image extraite d'un film) :
en plein écran elle est agrandie ~1,8 fois et se voit molle. Une prise plus
grande la remplace sans rien changer d'autre.

**7 quater. LA RANGÉE — quatre tombes et un drapeau, sur la vitrine au
buste.** La bascule faite, l'image tombe dans une certaine OBSCURITÉ (un voile
noir sous la torche, `inhumation.obscurite`), et une rangée s'écrit devant le
buste, à la plume dorée : tombe, tombe, DRAPEAU, tombe, tombe. C'est le module
des boîtes (`chp5-boites.js`), avec une autre composition (`inhumation.tombes`)
et LES MÊMES CADENCES (`geste`, commun aux deux lieux).
 · **Ouverte d'emblée** : le côté ne déclare pas de `grande` — rien à
   éclater, les cinq dessins s'écrivent dès l'arrivée, depuis le MILIEU (le
   drapeau d'abord) vers les deux bouts.
 · **Les quatre tombes** (A, B, C, D) ouvrent chacune leur pièce dans la
   fenêtre habituelle — trois prises de son, un film.
 · **Le drapeau n'ouvre pas la fenêtre.** Il garde son dessin et son titre
   (« Inhumer symboliquement le corps de Soliman al-Halabi au musée ? ») et
   déclare `planche: true` : au clic, les CINQ dessins se dé-écrivent (le
   geste de sortie du lieu), la planche `inhumation.fond` monte PLEIN ÉCRAN
   — l'obscurité et la torche se retirent à sa vitesse, on la LIT —, une croix
   paraît en haut à droite, et la seconde voix d'Alicia se joue, sans
   sinusoïde : c'est la planche qu'on regarde. Son `credit` (« A.,
   étudiante ») s'écrit en bas, sur une étiquette sombre, TANT QU'ELLE PARLE.
   Voix finie, croix ou Échap : la planche redescend, la voix est VIDÉE, et
   la rangée se réécrit (`tombes.monter()`) ; le focus revient au drapeau une
   fois réécrit. `salut: 'flotter'` : il se déploie depuis sa hampe en
   s'écrivant.

⚠️ **LE PANORAMA — ICI, `cover` ET NON `contain`, ET C'EST VOULU.** À
l'inverse de la vitrine du « 2 », la vitrine au buste et la planche
DÉBORDENT l'écran : aucune bande noire. Chacune vit dans un CADRE à ses
proportions (`.inhumation-cadre`), qui couvre la fenêtre et la dépasse encore
de `inhumation.panorama.debord` ; la main le fait glisser — elle à droite, on
voit la droite de l'image ; elle en bas, le bas —, lissé à chaque image
(`panorama.suivi`), et l'image revient au centre quand la main s'en va.
 · ⚠️ **La portée est TOUT le débord, pas un degré fixe** : une amplitude fixe
   laisserait hors d'atteinte ce que la couverture rogne (le texte du bas de
   la planche en 16/10, le début de ses lignes en 4/3).
 · ⚠️ **Le glissement vit sur le CADRE, les gestes sur l'IMAGE** (bascule,
   montée de la planche) : deux `transform` sur le même élément s'écraseraient.
 · Le moteur lit les proportions sur l'image DÉCODÉE (`naturalWidth`) : rien à
   tenir d'accord dans la config si une image est remplacée.
 · Sous « mouvement réduit », la boucle ne tourne pas : image couvrante, au
   centre, immobile. Au repos, plus rien ne s'écrit (seuil d'arrivée).
 · ⚠️ La vitrine au buste ne fait que 794 px : couvrante et débordante, elle
   est agrandie davantage — et plus floue. Une prise plus grande la sauverait.
 · La vitrine des crânes (`avant`), pendant la première voix, reste entière et
   immobile.

⚠️ **LA PLANCHE EST UN PREMIER PLAN** (`occupe()` la compte) : la flèche et
la boussole s'effacent devant elle, comme devant une pièce. Le moteur la
tient seul (`ouvrirPlanche` / `fermerPlanche`) — la fenêtre n'en sait rien —,
et la referme d'autorité (`fermerPlanche(false)`, sans réécrire la rangée)
quand on quitte le lieu ou le chapitre. ⚠️ Les transitions de la planche, de
l'obscurité et de la torche sont sur leurs règles de BASE : posées sur
`.inhumation-inhume` seule, elles disparaîtraient avec la classe et tout
reviendrait d'un coup. ⚠️ **Sur la planche claire, les titres dorés du coin
haut-gauche se lisent mal** (ils passent sur la photographie des côtes) : même
problème que le panneau de la porte, non traité ici.

⚠️ **LA RANGÉE EST PLACÉE, PAS CALCULÉE EN GRILLE.** Chaque dessin a sa
`place` au repère `'centre'` (le milieu de la fenêtre), un écart `x` en
largeurs de tombe et une hauteur `y` en %. Bornes vérifiées en 16/10 et en
4/3 : entre la flèche (bas-gauche) et le plein écran (bas-droite), au-dessus du
titre de survol (bas, 3,5 %). ⚠️ Un rang de pièces PLACÉES n'entre pas dans le
calcul de taille (il réduisait toute la composition à mesure qu'on rapprochait
les tombes du centre : des tombes de 28 px en 4/3), et une pièce placée ne lit
ni `ecart` ni `interligne` — la composition de l'inhumation ne les déclare
donc pas.

⚠️ **LE MODULE NE LIT PLUS LA CONFIG, ON LUI DONNE CE QU'IL DISPOSE**
(`composition`, `cadences`, `photo`). Les deux instances — vitrine et
inhumation — vivent dans deux couches (`#chp5-boites`, `#chp5-tombes`) et
gardent chacune ce qu'on y a ouvert (la teinte bronze des pièces lues).

⚠️ **LE SALUT** (`salut`, facultatif, PAR PIÈCE) se joue dans `dessiner`,
avec l'écriture : un geste de compositeur (une transformation), qui s'achève —
rien ne vit au repos. ⚠️ Une tombe a eu une LUEUR en fin d'écriture (un
cercle doré qui pulsait) : **retirée à la demande de l'auteur**, ne pas la
remettre.

⚠️ **CE QUI A ÉTÉ ESSAYÉ, ET RETIRÉ** (septembre 2026) — pour ne pas y revenir
sans le vouloir : une GRANDE tombe qui s'ouvrait sur les quatre autres, et un
drapeau qui, levé, faisait monter la planche et partir la voix hors de toute
fenêtre ; les deux S'ALTERNAIENT (ouvrir l'un reformait l'autre, les tombes
rentrant dans la grande). L'auteur a choisi d'ouvrir directement sur les
tombes : l'alternance, le repli, la grande collée au bord et le titre de
survol des grandes ont été retirés du module avec leur code. Puis le drapeau a
ouvert sa voix DANS LA FENÊTRE, la planche montant derrière sous un voile
allégé (un `voile` par pièce, et la pièce transmise à `onEtat`) : remplacé
par la planche plein écran, et ces deux mécanismes retirés avec lui.

**8. LE SOUS-TITRE CÈDE SA PLACE, IL NE SE DOUBLE PAS.** Entrer dans un
sous-chapitre n'ajoute pas une troisième ligne sous « Espace collaboratif » :
« Le devenir du corps… » s'efface et « Dans les réserves… » vient à SA place,
sur la même ligne. Le niveau 3 de `Title` reste donc inutilisé au chapitre 5.

⚠️ **EN DEUX TEMPS, ET C'EST OBLIGATOIRE** (`_relayerSousTitre`). `Title._poser`
écrit le nouveau texte IMMÉDIATEMENT puis pose la classe : appelé pendant que
l'ancien s'efface, il ferait muter les mots au milieu de leur propre
disparition. On laisse donc jouer la sortie CSS (1,1 s de fondu après 0,3 s de
retard) avant de poser le suivant — le relais tient largement dans la durée
d'un passage.

⚠️ **SI UNE SCÈNE SE MET UN JOUR À ÉCRIRE LE NIVEAU 3, il faudra l'ajouter à la
liste des éléments remontés en z 600** (style.css, `body.chpX-active`). Le
défaut ne se verrait NULLE PART ailleurs qu'à l'écran : `showPart()` pose bien
son texte et sa classe, l'élément a bien une boîte — il est simplement enterré
sous le chapitre (z 15 contre 500).

**9. L'AMBIANCE SONORE — une bande-son par lieu** (octobre 2026). La
photographie a la sienne (`ambiance-ouverture.mp3`), chaque sous-chapitre la
sienne (`ambiance-porte`, `-vitrine`, `-inhumation`), dans `chp5-medias/`.
À l'entrée, un LONG SILENCE (`ambiance.silenceMs`, compté depuis la levée du
rideau), puis la photographie monte en un fondu lent (`premiereEntreeMs`).
Tout ce qui PARLE au premier plan l'éteint jusqu'au silence, et elle revient
quand il se retire — LÀ OÙ ON L'AVAIT LAISSÉE, pas au début du morceau.
Moteur : `chp5-ambiance.js` ; réglages : `chp5-config.js` → `ambiance` (⑪).

⚠️ **ELLE SUIT LE PREMIER PLAN, DEPUIS LE MÊME APPEL.** `notifyForeground()`
— qui éclipse la flèche et la boussole — appelle aussi `accorderAmbiance()`,
qui RECALCULE de l'état ce qu'on doit entendre (`ambianceVoulue()`) et le dit
au module (`ambiance.vouloir(nom | null)`). Il n'y a donc aucun second
déclencheur à tenir d'accord : tout ce qui fait partir la flèche passe déjà
par là (témoignage, pièce, planche, voix d'Alicia, passage d'un lieu à
l'autre). `vouloir()` est IDEMPOTENT — on peut le rappeler à chaque
événement, la dernière intention gagne. C'est la leçon du chapitre 3
(`ambDesired`) : une piste pilotée par ordres successifs (« allume »,
« éteins ») finit par les recevoir dans le désordre. Ne pas ajouter d'appel
direct ailleurs.
 · **Ce qui l'éteint** : un témoignage qui JOUE (en pause, elle revient) ;
   une pièce qui a un son — prise de son ou film, même à l'arrêt sur son
   affiche (`visionneuse.estSonore()`) ; la voix d'Alicia (le « 3 » n'est
   posé qu'après elle) ; la planche du drapeau ; tout passage (`placeGeste`).
 · ⚠️ **Ce qui NE l'éteint PAS** : un texte (PDF) ou la carte mentale. Ils
   occupent le premier plan — la flèche s'efface — mais on les LIT : c'est
   pourquoi `ambianceVoulue()` n'est pas `occupe()`.
 · **Vers un sous-chapitre** : la photographie se tait AU CLIC, la bande-son
   du lieu ne monte qu'à l'ARRIVÉE (`placePosee`), avec la flèche. Au retour,
   l'inverse. Celle du lieu se charge pendant le passage (`precharger`).
 · **Quitter le chapitre** — flèche, carte, n'importe quelle destination :
   `leave()` l'éteint au rythme du fondu au noir (`exitMs`), `destroy()`
   arrête et vide ses lecteurs.

⚠️ **LUE EN FLUX, PAS DÉCODÉE — C'EST UNE MESURE.** La première version
décodait chaque fichier (`decodeAudioData`) pour boucler à l'échantillon
près : 69 s de stéréo font 26 Mo de PCM, et leur arrivée coûtait des images de
**180 à 270 ms**, mesurées au banc pendant que la caméra respire (le banc de
non-régression est tombé à 40 i/s). Chaque piste est donc lue par DEUX
`<audio>` qui se relaient, branchés dans le graphe du site
(`createMediaElementSource`) : rien à décoder, quelques centaines de Ko en
mémoire — ce qui compte aussi sur un téléphone. Ne pas revenir aux tampons
décodés pour « gagner en précision » : une couture de trois secondes n'a pas
besoin de l'échantillon.

⚠️ **LES FONDUS SONT DES `GainNode`, JAMAIS `element.volume`** : Safari sur
iPhone IGNORE `volume` — un fondu y serait une coupure sèche. Le contexte
est celui de l'`AudioManager`, transmis par `startChapitre5({ audio })` ;
sans lui, le chapitre se joue muet en le disant en console.

⚠️ **CE NE SONT PAS DES PISTES DE L'AUDIOMANAGER.** `enforceSilence` ne les
connaît pas : ce sont `leave()` et `destroy()` qui en répondent —
`destroy()` est appelé dans le `finally` de `exit()` comme dans l'échec
d'entrée. ⚠️ Après `leave()`, `destroy()` arrête les lecteurs SUR-LE-CHAMP
(leur gain est déjà à zéro) : la frontière vient juste après, et son filet
(qui met en pause tout `<audio>` encore en lecture) le DÉNONCERAIT en
console. Chaque lecteur est VIDÉ à l'arrêt (source retirée, `load()`), comme
toute pièce du chapitre.

⚠️ **LES FICHIERS NE BOUCLENT PAS D'EUX-MÊMES** : ils commencent sur un
souffle (0,8 s de silence en tête pour la photographie) et finissent en
fondu. Bouclés par `loop = true`, on entendrait un creux à chaque tour. Les
deux lecteurs se relaient donc en se CHEVAUCHANT (`croiseMs`) : l'un repart
du début en montant pendant que l'autre s'éteint sur sa fin. Une minuterie
déclenche la couture ; ⚠️ et si le lecteur actif arrive AU BOUT sans qu'elle
ait eu lieu (minuterie retardée dans un onglet caché, durée mal annoncée par
l'en-tête du fichier), sa fin déclenche la couture sur-le-champ
(`onended`) — sans ce filet la piste se tairait pour de bon. ⚠️ Le fichier de
la photographie a ses PROPRES coupures d'un dixième de seconde (5,3 s,
6,8 s, 8,4 s…) : c'est sa rythmique, pas un défaut de boucle.

⚠️ **LES GAINS ÉGALISENT DES FICHIERS QUI NE SONT PAS MIXÉS ENSEMBLE** (de
−20 à −33 dB en moyenne) autour de −30 dB, le niveau des boucles du site.
Celle du « 3 » est la plus douce, d'où un gain de 1,4 (au-delà de 1 : on
amplifie, sa crête reste à −6,6 dB). Remplacer un fichier, c'est revoir son
gain.

⚠️ **LE TÉMOIN `data-ambiance`** sur `#chapitre5-root` dit l'intention
courante (`ouverture`, `porte`…, ou vide pour le silence). Le banc d'essai le
lit, et il ÉCOUTE vraiment : une sonde branchée sur la destination du
contexte mesure le niveau (silence de l'entrée, extinction sous un
témoignage, couture de boucle, départ par la carte). ⚠️ La couture se teste
sur une VRAIE découpe de 8 s (`tools/bench/fixtures/ambiance-courte.mp3`,
la commande pour la refaire est dans le banc) — pas sur des octets tronqués :
un `<audio>` croit la durée de l'en-tête, et un fichier coupé annoncerait
encore 69 s.

**10. LA CARTE — chaque sous-chapitre est un point** (octobre 2026). Sous le
point V, trois points : `chp5-porte`, `chp5-vitrine`, `chp5-inhumation`,
nommés par leur LIEU (`cartels.sousChapitres[].lieu`), et c'est le nom du lieu
qui voyage (`part: 'vitrine'`), pas le rang du cartel — réordonner les cartels
ne doit pas déplacer la carte. Libellés : `config.js` → `MAP.labels`.
 · **Depuis une autre scène** — `enter({ part })` : on entre DIRECTEMENT dans
   le lieu. Ni introduction ni photographie : le noir (`#chp5-nuit`) est posé
   AVANT la levée du rideau, l'introduction est posée dans son état final
   (comme sous « mouvement réduit »), et le lieu s'ouvre depuis ce noir. Le
   sous-titre du lieu s'écrit d'emblée ; la flèche ne paraît qu'à l'arrivée
   (`onIntroComplete` n'est pas appelé). Jouer cinq secondes d'intro pour la
   quitter aussitôt, c'était le défaut des bougies du chapitre 2.
 · **Depuis le chapitre** — `jumpWithin({ part })` → `goToChapitre5Part(rang
   | null)`. ⚠️ **UNE INTENTION, PAS UN ORDRE** (`vise` dans le moteur) : elle
   n'interrompt aucun geste, c'est la fin du geste (lieu posé, salle rendue,
   fin d'intro) qui la reprend (`poursuivre()`). La dernière demande gagne.
 · ⚠️ **D'UN SOUS-CHAPITRE À L'AUTRE, ON PASSE PAR LE NOIR**, jamais par la
   photographie : la vitrine et l'inhumation s'éteignent comme au retour mais
   le noir RESTE ; la porte ne se rouvre pas sur la salle, le noir tombe sur
   son panneau (`porte.noirMs`). Et la porte, ouverte DEPUIS le noir, est posée
   fermée dessous et le noir se lève sur elle (`porte.leveMs`) — on ne voit
   pas reculer une salle qu'on ne voit pas. Le sous-titre va droit de l'un à
   l'autre : `closePart` annonce la DESTINATION, et la scène ne relaie pas un
   texte par lui-même (`_relayerSousTitre`).
 · Le point courant et la mémoire suivent l'ARRIVÉE (`journey:place`, émis par
   `_setPart(…, 'arrivee')`). ⚠️ Un lieu qui n'a pas pu s'ouvrir rend la
   photographie avec une arrivée `null` après un départ vers lui : la scène se
   recale alors (sous-titre, nom de la flèche) — sinon la flèche croirait
   ramener d'un sous-chapitre où l'on n'est pas, et ne ferait plus rien.
 · ⚠️ `ArrowBase.show()` remet le nom d'origine de la flèche : la scène le
   repose après chaque `show()` (`_nommerFleche`).

## Test de non-régression (après toute modification)

**D'abord l'automate** — il couvre en trois minutes ce que l'œil ne peut pas
compter (fluidité, fuites, tabulation, console) :

```bash
node tools/bench/serve.mjs &                 # laisser tourner
npm run bench -- --self-test                 # sort en erreur si régression
npm run audit:config                         # clés de config sans lecteur
npm run bench:chapter5                       # V, audio, plein écran, carte, tactile
```

Il vérifie : 60 i/s sur chaque scène, aucun arbre détaché supplémentaire entre
la 1ʳᵉ et la 3ᵉ visite de chaque chapitre, focus au chargement sur le bouton de
démarrage, Entrée qui démarre, console vide. Les requêtes TIERCES en échec
(Google Fonts, qui négocie ses fichiers selon l'agent) sont signalées sans
faire échouer la campagne.

**Ensuite l'œil** — l'automate ne voit pas si c'est BEAU.
Parcours sur serveur local, console ouverte (zéro erreur attendue) :
1. Accueil (Playfair/Inter) → vitrine → phrénologie (documents + loupe).
2. Collaboration : 5 cercles (I-V ouvrent un chapitre), survols, titres.
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
7. **Chapitre 5** : noir → la photographie monte, la caméra s'approche, les
   cinq traits jaillissent du squelette, les cercles se dessinent. Survoler
   chaque chiffre : il DOIT devenir une flèche vers la droite, et l'intitulé
   du sous-chapitre paraître **sans jamais mordre sur le jour de la fenêtre**.
   ⚠️ **Vérifier à trois formats au moins — 16/9, 3/2 et 4/3 —** : c'est le
   rapport de la fenêtre, pas sa largeur, qui déplace le mur (cf. « Le
   chapitre 5 »). Écouter les deux témoignages : la flèche de retour et la
   boussole s'éclipsent ensemble, un second clic coupe, l'autre témoignage
   prend la main. Vérifier enfin que les cinq points d'ancrage sont bien SUR
   un os, en zoomant.
   Puis **le « 1 »** : la salle s'éloigne, se trouble et BLANCHIT, les deux
   battants entrent par les côtés et se rejoignent au centre (on doit voir la
   porte presque entière, du blanc à gauche et à droite), une seconde de pose,
   puis la caméra pousse sur « Anthropologie biologique ». Aux trois formats,
   le panneau doit rester ENTIER et s'arrêter SOUS les titres — qui sont dorés,
   donc illisibles sur lui. Vérifier au passage que le sous-titre a bien CÉDÉ
   sa place (« Dans les réserves… » à l'endroit même où était « Le devenir du
   corps… », jamais les deux ensemble). La flèche revient et ramène à la
   photographie ; un second retour quitte le chapitre.
   Puis **le « 2 »** : tout s'éteint, et la lumière revient ailleurs — une
   torche fixe ouvre sur la boîte où le crâne attend, étiquetée « objet à
   l'étude », photographie ENTIÈRE avec du noir à gauche et à droite.
   Le crâne est ENTIER (la souris n'y fait rien). Vérifier que le passage est
   bien NOIR de bout en bout (jamais de décor qui change à vue), et qu'au
   retour la photographie revient sans à-coup.
   Puis **l'inventaire** : pendant que la torche s'ouvre, une boîte d'archive
   S'ÉCRIT de chaque côté du crâne — à la plume dorée d'abord, du plus grand
   trait au plus petit, l'encre séchant en blanc derrière. Les survoler : or et
   grossissement. En cliquer une : elle doit se REFERMER SUR ELLE-MÊME (on la
   voit rapetisser, pas seulement s'effacer), une onde dorée part de son
   centre, et les petites s'élancent AVANT qu'elle ait disparu — jamais
   d'écran vide entre les deux gestes. Sept à gauche (2 · 1 · 4), deux à
   droite. Re-cliquer ne referme rien. ⚠️ **Aux trois formats**, vérifier
   qu'aucune boîte ne mord sur le crâne ni ne sort du cadre : sur un écran
   étroit elles doivent RAPETISSER, pas se chevaucher.
   Puis **les pièces** : survoler chaque petite boîte — son titre (et lui
   seul, jamais « D1 » ou « C2 ») s'écrit en bas de l'écran. En cliquer une :
   un rectangle BLANC se trace d'abord, VIDE, et la pièce n'y paraît qu'une
   fois le trait presque refermé ; le titre dessous, la croix en haut à
   droite. Une vidéo s'ouvre sur son affiche ; un texte prend la largeur et
   reste SOUS la colonne de titres ; une prise de son se lance seule, avec le
   cercle et la sinusoïde vivante du chapitre 1. Vérifier que la
   flèche et la boussole S'EFFACENT pendant ce temps, que la vidéo ne démarre
   pas toute seule, et que les deux textes (loi de 2023, UNESCO 1978) se
   LISENT bien dans le cadre. Les trois sorties doivent fonctionner : la
   croix, Échap, et le clic hors du cadre.
   **Le crâne s'efface** : à chaque pièce REFERMÉE, il recule d'un pas en
   fondu, et la boîte ouverte prend la teinte bronze des pièces lues (plus
   sombre que l'or du survol : les deux ne doivent pas se confondre). Une
   vidéo ou une prise de son allée jusqu'au bout referme d'elle-même sa
   fenêtre. Les deux prises de son affichent « Témoignage C., lycéenne ». La
   troisième boîte de la ligne D1 ouvre la **carte mentale** (quelques
   secondes de chargement : c'est une application). Toutes les pièces vues,
   le crâne a disparu : il ne reste que la boîte vide.
   Enfin **la sortie** : cliquer la flèche de retour. Les boîtes doivent se
   DÉ-ÉCRIRE, des plus lointaines aux plus proches du centre, et le noir ne
   tomber qu'ensuite — à aucun moment on ne doit voir des boîtes blanches et
   intactes sur une photographie déjà éteinte. Rouvrir le « 2 » : on retrouve
   les DEUX grandes boîtes, et tout se rejoue — mais le crâne reste à demi
   parti, et les pièces lues gardent leur teinte.
   Puis **le « 3 »** : noir, puis la vitrine des crânes sous une torche fixe
   et serrée. ⚠️ **Ni flèche ni boussole** tant que la voix n'a pas fini.
   Quelques secondes de silence, la voix d'Alicia, et « Passer » en bas au
   centre (cadre qui se trace, or au survol). Le laisser aller une fois
   jusqu'au bout, et le cliquer une autre fois : dans les deux cas la vitrine
   au buste monte en dézoomant pendant que les crânes s'éloignent, la lumière
   s'élargit, PUIS la flèche revient. Puis l'image s'ASSOMBRIT, et une RANGÉE
   s'écrit devant le buste à la plume dorée — quatre tombes et, au milieu, le
   drapeau, qui s'écrit le premier et se déploie depuis sa hampe ; aucune
   lueur ne pulse à la fin. Chaque titre s'écrit en bas au survol. Ouvrir une
   tombe : sa pièce dans la fenêtre habituelle. Ouvrir le drapeau : les cinq
   dessins se dé-écrivent, la planche « L'inhumation symbolique » monte PLEIN
   ÉCRAN et lisible, une croix en haut à droite, la voix d'Alicia SANS
   sinusoïde, et « A., étudiante » en bas tant qu'elle parle ; la flèche et
   la boussole s'effacent. À la croix, à Échap ou à la fin de la voix : la
   planche redescend et la rangée se réécrit. La vitrine au buste et la
   planche n'ont AUCUNE bande noire : promener la souris aux quatre coins
   doit faire glisser l'image, doucement, jusqu'à ses bords (le texte du bas
   de la planche doit se lire). Aux trois formats, la rangée doit tenir entre
   la flèche et le plein écran, au-dessus du titre de survol. La flèche ramène
   à la photographie ; les dessins se dé-écrivent d'abord, et l'on ne doit
   plus rien entendre.
   Enfin **l'ambiance sonore**, au casque : en entrant, un long silence
   (~9 s), puis la bande-son de la photographie monte lentement. Lancer un
   témoignage la fait taire ; le mettre en pause la ramène, là où elle en
   était. Cliquer un chiffre : elle se tait au clic, et celle du lieu ne monte
   qu'avec le retour de la flèche — jamais deux bandes-son ensemble, jamais
   de musique sous la voix d'Alicia, sous un film ou une prise de son, ni sous
   la planche ; un TEXTE, lui, se lit avec elle. Laisser tourner une minute
   au moins sur la photographie : la boucle doit repartir sans creux ni
   « clic ». Quitter par la carte au milieu d'un fondu : elle doit s'éteindre
   avec le noir, et l'espace collaboratif arriver avec sa seule musique.
   Enfin **la carte** : depuis l'espace collaboratif, cliquer un des trois
   points sous le V — on doit arriver dans le lieu SANS voir la photographie
   ni l'introduction, sous le bon sous-titre. De là, sauter vers un autre
   sous-chapitre : le passage reste NOIR, la salle ne reparaît pas, et le
   sous-titre va droit de l'un à l'autre. Puis quitter par la carte vers une
   scène qui change de titre (l'accueil) : « Espace collaboratif » ne doit PAS
   se réécrire avant de partir, et le titre d'arrivée doit finir ENTIER.
8. **Chaque chapitre : entrer/sortir ×2** (le pattern factory doit rejouer
   à l'identique, sans fuite d'état ni son résiduel).
9. **Curseur, à la souris** : natif partout (flèche de l'OS), main sur tout
   ce qui est cliquable (boutons documents, cercles romains, flèches,
   hotspots du chapitre 1, bulles du chapitre 4, pop-up de la carte…), à
   AUCUN moment le halo doré dessiné ne doit apparaître. Console vide.
10. **Clavier, sans toucher la souris** : au chargement le focus est sur
    « Cliquez pour commencer » ; Entrée démarre. Puis Tab parcourt flèche,
    boutons documents, barre de navigation, plein écran — chacun avec un halo
    doré VISIBLE, et Entrée/Espace l'active. Aucun focus ne doit se perdre sur
    un élément invisible.

## Notes de déploiement

- **LES PIÈCES DU CHAPITRE 5 ONT ÉTÉ RÉ-ENCODÉES, ET LEURS ORIGINAUX SONT HORS
  DU DÉPÔT.** Elles étaient arrivées en vrac à la racine de `Chapitre5/`, avec
  espaces, accents et apostrophes dans les noms, et pesaient **525 Mo** — dont
  deux vidéos au-delà de la limite de GitHub (178 et 123 Mo : le `push`
  aurait échoué). Rangées dans `chp5-medias/`, en minuscules et tirets
  (`d1-…`, `d2-…`, `d3-…`, `c1-…`, `c2-…`), elles pèsent **128 Mo** :
  vidéos en H.264 CRF 22 preset slow (la norme d'un master ici), sauf
  `d3-naturalisation.mp4`, déjà sous 1,3 Mb/s, simplement remuxée ; prises de
  son passées de WAV à MP3 VBR ~190 kb/s comme les autres sons du site ; PDF
  copiés tels quels. **Les originaux ne sont pas perdus** : ils ont été
  déplacés, pas supprimés, dans `../originaux-chapitre5/` — à côté du dépôt,
  donc hors de git. À archiver ailleurs par l'auteur.
- **Chaque vidéo de pièce a son AFFICHE**, même nom en `.jpg` (1280 px,
  20–130 Ko). Quatre des cinq films s'ouvrent sur un long fondu au noir. Les
  instants retenus sont les plus parlants de chaque film — l'article L115-6,
  la gravure de l'assassinat de Kléber, le carton-titre, le collage aux fils
  rouges, « POUR la restitution » — et **JAMAIS un plan de la classe** : les
  visages y sont floutés image par image, et une affiche ne doit pas parier
  sur la qualité de ce floutage. Pour en refaire une :
  `ffmpeg -ss <t> -i d1-….mp4 -frames:v 1 -vf "scale=1280:-2:flags=lanczos" -q:v 3 d1-….jpg`
  (t = 20,9 · 23,5 · 10,7 · 8,0 · 16,8 s, dans l'ordre D1, D2, naturalisation,
  nœud, réparation).
- **Le sous-chapitre 3 a été rangé à son arrivée** : les trois fichiers déposés
  à la racine de `Chapitre5/` avec des espaces dans le nom (`cranes-MH.JPG`,
  `vitrine MH.jpg`, `Alicia 1.mp3`) sont devenus
  `chp5-images/chpt-5-P3-cranes.jpg`, `chpt-5-P3-vitrine.jpg` et
  `chp5-medias/inhumation-alicia-1.mp3` — simplement déplacés, pas
  ré-encodés (0,29 + 0,28 + 0,86 Mo : rien à gagner).
  Le second lot (la tombe et le drapeau) aussi : les trois prises A, B, C et
  la seconde voix d'Alicia, déplacées telles quelles (`a-antigone-creon-…`,
  `b-que-faire-du-corps`, `c-antigone-bauchau`, `inhumation-alicia-2`) ;
  le film D, lui, **faisait 222 Mo** (1080p à 18 Mb/s — le push aurait
  échoué) : ré-encodé en H.264 CRF 22 preset slow, 43 Mo, audio copié, avec
  son affiche (t = 62 s, le tombeau peint dans l'herbe) et sa variante
  mobile. La planche `Inhumation.bmp` (112 Mo) est devenue
  `chpt-5-P3-inhumation.jpg` (0,64 Mo, 46,2 dB). Les deux masters sont dans
  `../originaux-chapitre5/`, avec les autres.
- **Les quatre bandes-son du chapitre 5** sont arrivées à la racine de
  `Chapitre5/` (`Opening-sound-ambiance.mp3`, `P1-…`, `P2-…`, `P3-…`) et ont
  été déplacées telles quelles dans `chp5-medias/`, nommées par le lieu
  qu'elles accompagnent : `ambiance-ouverture`, `-porte`, `-vitrine`,
  `-inhumation` (4,5 Mo à elles quatre — rien à gagner à les ré-encoder).
- **Les images du chapitre 5 ont leurs masters ET leurs JPEG servis.** Les
  quatre `.png` d'origine (battants de la porte, vitrine pleine et vide) pèsent
  34 Mo ; ce que le visiteur télécharge, ce sont les `.jpg` — 0,93 Mo, soit
  −97 %, à 46–48 dB de PSNR. S'y ajoutent deux masters que rien ne référence
  (`chpt-5-P1.png`, la porte entière, et `chpt-5-P2-gauche.png`) : **50 Mo de
  PNG dorment donc dans le dépôt** pour 0,93 Mo servis. Ils ne coûtent rien au
  visiteur — rien ne les demande — mais tout au dépôt et au déploiement. Les
  sortir de là est une décision d'auteur : ce sont les originaux.
- Poids : ~380 Mo, dont 281 Mo de masters mp4 + 74 Mo de variantes mobiles
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
