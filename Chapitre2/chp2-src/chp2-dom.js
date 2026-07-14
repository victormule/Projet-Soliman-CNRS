/* =====================================================================
   Chapitre 2 — chp2-dom.js
   Template DOM complet du chapitre (travelling + cartel + invisibilisation
   + peine démesurée + rideau de chargement), extrait de Chapitre2Scene.
   CONTENU ÉDITORIAL : l'article de journal « Le meurtrier de Kléber »
   (l'Humanité, 9 janvier 1907) se modifie ICI (deux occurrences : le bloc
   de réserve aria-hidden et le <template id="article-content-template">).
   @param {string} assetPath  Préfixe des assets depuis la racine serveur
                              (en pratique : 'Chapitre2/').
   ===================================================================== */

export function buildChapitre2DOM(assetPath) {
  return /* html */`
      <!-- TRAVELLING -->
      <div id="chp2-scene">
        <div id="chp2-shake">
          <img id="chp2-img" src="${assetPath}chp2-images/vue-general.webp" alt="Vue" draggable="false">
          <img class="chp2-overlay" id="chp2-ov-136" src="${assetPath}chp2-images/crane-136.png" alt="" draggable="false">
          <img class="chp2-overlay" id="chp2-ov-137" src="${assetPath}chp2-images/crane-137.png" alt="" draggable="false">
          <img class="chp2-overlay" id="chp2-ov-138" src="${assetPath}chp2-images/crane-138.png" alt="" draggable="false">
        </div>
      </div>
      <div id="chp2-legend">
        <span class="chp2-num"   id="chp2-leg-num"></span>
        <span class="chp2-label" id="chp2-leg-label"></span>
      </div>
      <div id="chp2-bar"></div>
      <div id="chp2-fade"></div>

      <!-- CARTEL -->
      <div id="cartel-root" aria-hidden="true">
        <main class="stage-frame">
          <div class="display-stage" data-role="stage"></div>
        </main>
        <div class="backdrop" data-role="backdrop" aria-hidden="true"></div>
        <p class="close-hint" role="status" aria-live="polite">Cliquer en dehors ou Échap pour refermer</p>
      </div>

      <!-- INVISIBILISATION -->
      <div id="invisibilisation-root" aria-hidden="true">
        <div class="sr-only">
          <h1>Eyes — Installation web interactive autour d'yeux de verre anciens</h1>
        </div>
        <div id="loader"><div id="loader-track"><div id="loader-fill"></div></div></div>
        <div id="srt-subtitles"></div>
        <main id="scene">
          <div id="gw1" class="globe-wrap"><div class="globe-scale">
            <img id="g1n" class="layer globe-normal" src="${assetPath}chp2-images/EyesGlobe.webp"        srcset="${assetPath}chp2-images/EyesGlobe-800.webp 800w, ${assetPath}chp2-images/EyesGlobe-1200.webp 1200w, ${assetPath}chp2-images/EyesGlobe.webp 1920w"        sizes="100vw" width="1920" height="1342" alt="" decoding="async">
            <img id="g1p" class="layer globe-play"   src="${assetPath}chp2-images/EyesGlobePlay.webp"    srcset="${assetPath}chp2-images/EyesGlobePlay-800.webp 800w, ${assetPath}chp2-images/EyesGlobePlay-1200.webp 1200w, ${assetPath}chp2-images/EyesGlobePlay.webp 1920w"    sizes="100vw" width="1920" height="1342" alt="" decoding="async" fetchpriority="low">
          </div></div>
          <div id="gw2" class="globe-wrap"><div class="globe-scale">
            <img id="g2n" class="layer globe-normal" src="${assetPath}chp2-images/EyesGlobe2.webp"       srcset="${assetPath}chp2-images/EyesGlobe2-800.webp 800w, ${assetPath}chp2-images/EyesGlobe2-1200.webp 1200w, ${assetPath}chp2-images/EyesGlobe2.webp 1920w"       sizes="100vw" width="1920" height="1342" alt="" decoding="async">
            <img id="g2p" class="layer globe-play"   src="${assetPath}chp2-images/EyesGlobePlay2.webp"   srcset="${assetPath}chp2-images/EyesGlobePlay2-800.webp 800w, ${assetPath}chp2-images/EyesGlobePlay2-1200.webp 1200w, ${assetPath}chp2-images/EyesGlobePlay2.webp 1920w"   sizes="100vw" width="1920" height="1342" alt="" decoding="async" fetchpriority="low">
          </div></div>
          <div id="gw3" class="globe-wrap"><div class="globe-scale">
            <img id="g3n" class="layer globe-normal" src="${assetPath}chp2-images/EyesGlobe3.webp"       srcset="${assetPath}chp2-images/EyesGlobe3-800.webp 800w, ${assetPath}chp2-images/EyesGlobe3-1200.webp 1200w, ${assetPath}chp2-images/EyesGlobe3.webp 1920w"       sizes="100vw" width="1920" height="1342" alt="" decoding="async">
            <img id="g3p" class="layer globe-play"   src="${assetPath}chp2-images/EyesGlobePlay3.webp"   srcset="${assetPath}chp2-images/EyesGlobePlay3-800.webp 800w, ${assetPath}chp2-images/EyesGlobePlay3-1200.webp 1200w, ${assetPath}chp2-images/EyesGlobePlay3.webp 1920w"   sizes="100vw" width="1920" height="1342" alt="" decoding="async" fetchpriority="low">
          </div></div>
          <div id="gw4" class="globe-wrap"><div class="globe-scale">
            <img id="g4n" class="layer globe-normal" src="${assetPath}chp2-images/EyesGlobe4.webp"       srcset="${assetPath}chp2-images/EyesGlobe4-800.webp 800w, ${assetPath}chp2-images/EyesGlobe4-1200.webp 1200w, ${assetPath}chp2-images/EyesGlobe4.webp 1920w"       sizes="100vw" width="1920" height="1342" alt="" decoding="async">
            <img id="g4p" class="layer globe-play"   src="${assetPath}chp2-images/EyesGlobePlay4.webp"   srcset="${assetPath}chp2-images/EyesGlobePlay4-800.webp 800w, ${assetPath}chp2-images/EyesGlobePlay4-1200.webp 1200w, ${assetPath}chp2-images/EyesGlobePlay4.webp 1920w"   sizes="100vw" width="1920" height="1342" alt="" decoding="async" fetchpriority="low">
          </div></div>
          <img id="r1"  class="layer" src="${assetPath}chp2-images/EyesReflet.webp"     srcset="${assetPath}chp2-images/EyesReflet-800.webp 800w, ${assetPath}chp2-images/EyesReflet-1200.webp 1200w, ${assetPath}chp2-images/EyesReflet.webp 1920w"     sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="r2"  class="layer" src="${assetPath}chp2-images/EyesReflet2.webp"    srcset="${assetPath}chp2-images/EyesReflet2-800.webp 800w, ${assetPath}chp2-images/EyesReflet2-1200.webp 1200w, ${assetPath}chp2-images/EyesReflet2.webp 1920w"    sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="r3"  class="layer" src="${assetPath}chp2-images/EyesReflet3.webp"    srcset="${assetPath}chp2-images/EyesReflet3-800.webp 800w, ${assetPath}chp2-images/EyesReflet3-1200.webp 1200w, ${assetPath}chp2-images/EyesReflet3.webp 1920w"    sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="r4"  class="layer" src="${assetPath}chp2-images/EyesReflet4.webp"    srcset="${assetPath}chp2-images/EyesReflet4-800.webp 800w, ${assetPath}chp2-images/EyesReflet4-1200.webp 1200w, ${assetPath}chp2-images/EyesReflet4.webp 1920w"    sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="gf1" class="layer" src="${assetPath}chp2-images/EyesGlobeFixe.webp"  srcset="${assetPath}chp2-images/EyesGlobeFixe-800.webp 800w, ${assetPath}chp2-images/EyesGlobeFixe-1200.webp 1200w, ${assetPath}chp2-images/EyesGlobeFixe.webp 1920w"  sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="gf2" class="layer" src="${assetPath}chp2-images/EyesGlobeFixe2.webp" srcset="${assetPath}chp2-images/EyesGlobeFixe2-800.webp 800w, ${assetPath}chp2-images/EyesGlobeFixe2-1200.webp 1200w, ${assetPath}chp2-images/EyesGlobeFixe2.webp 1920w" sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="gf3" class="layer" src="${assetPath}chp2-images/EyesGlobeFixe3.webp" srcset="${assetPath}chp2-images/EyesGlobeFixe3-800.webp 800w, ${assetPath}chp2-images/EyesGlobeFixe3-1200.webp 1200w, ${assetPath}chp2-images/EyesGlobeFixe3.webp 1920w" sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="gf4" class="layer" src="${assetPath}chp2-images/EyesGlobeFixe4.webp" srcset="${assetPath}chp2-images/EyesGlobeFixe4-800.webp 800w, ${assetPath}chp2-images/EyesGlobeFixe4-1200.webp 1200w, ${assetPath}chp2-images/EyesGlobeFixe4.webp 1920w" sizes="100vw" width="1920" height="1342" alt="" decoding="async">
          <img id="sk"  class="layer" src="${assetPath}chp2-images/EyesSkin.webp"        srcset="${assetPath}chp2-images/EyesSkin-800.webp 800w, ${assetPath}chp2-images/EyesSkin-1200.webp 1200w, ${assetPath}chp2-images/EyesSkin.webp 1920w"        sizes="100vw" width="1920" height="1342" alt="" decoding="async" fetchpriority="high">
        </main>
        <img id="sk-play1"       src="${assetPath}chp2-images/EyesSkinPlay1Cut.webp"       srcset="${assetPath}chp2-images/EyesSkinPlay1Cut-800.webp 800w, ${assetPath}chp2-images/EyesSkinPlay1Cut-1200.webp 1200w, ${assetPath}chp2-images/EyesSkinPlay1Cut.webp 1920w"            sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <img id="sk-play2"       src="${assetPath}chp2-images/EyesSkinPlay2Cut.webp"       srcset="${assetPath}chp2-images/EyesSkinPlay2Cut-800.webp 800w, ${assetPath}chp2-images/EyesSkinPlay2Cut-1200.webp 1200w, ${assetPath}chp2-images/EyesSkinPlay2Cut.webp 1920w"            sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <img id="sk-play3"       src="${assetPath}chp2-images/EyesSkinPlay3Cut.webp"       srcset="${assetPath}chp2-images/EyesSkinPlay3Cut-800.webp 800w, ${assetPath}chp2-images/EyesSkinPlay3Cut-1200.webp 1200w, ${assetPath}chp2-images/EyesSkinPlay3Cut.webp 1920w"            sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <img id="sk-play4"       src="${assetPath}chp2-images/EyesSkinPlay4Cut.webp"       srcset="${assetPath}chp2-images/EyesSkinPlay4Cut-800.webp 800w, ${assetPath}chp2-images/EyesSkinPlay4Cut-1200.webp 1200w, ${assetPath}chp2-images/EyesSkinPlay4Cut.webp 1920w"            sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <img id="sk-play-final1" src="${assetPath}chp2-images/EyesSkinPlay1CutFinal.webp" srcset="${assetPath}chp2-images/EyesSkinPlay1CutFinal-800.webp 800w, ${assetPath}chp2-images/EyesSkinPlay1CutFinal-1200.webp 1200w, ${assetPath}chp2-images/EyesSkinPlay1CutFinal.webp 1920w" sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <img id="sk-play-final2" src="${assetPath}chp2-images/EyesSkinPlay2CutFinal.webp" srcset="${assetPath}chp2-images/EyesSkinPlay2CutFinal-800.webp 800w, ${assetPath}chp2-images/EyesSkinPlay2CutFinal-1200.webp 1200w, ${assetPath}chp2-images/EyesSkinPlay2CutFinal.webp 1920w" sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <img id="sk-play-final3" src="${assetPath}chp2-images/EyesSkinPlay3CutFinal.webp" srcset="${assetPath}chp2-images/EyesSkinPlay3CutFinal-800.webp 800w, ${assetPath}chp2-images/EyesSkinPlay3CutFinal-1200.webp 1200w, ${assetPath}chp2-images/EyesSkinPlay3CutFinal.webp 1920w" sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <img id="sk-play-final4" src="${assetPath}chp2-images/EyesSkinPlay4CutFinal.webp" srcset="${assetPath}chp2-images/EyesSkinPlay4CutFinal-800.webp 800w, ${assetPath}chp2-images/EyesSkinPlay4CutFinal-1200.webp 1200w, ${assetPath}chp2-images/EyesSkinPlay4CutFinal.webp 1920w" sizes="100vw" width="1064" height="792" alt="" decoding="async" fetchpriority="low">
        <button id="btn-close" aria-label="Fermer">
          <svg viewBox="0 0 18 18" fill="none">
            <line x1="2" y1="2" x2="16" y2="16"/>
            <line x1="16" y1="2" x2="2" y2="16"/>
          </svg>
        </button>
        <div id="caption-wrap" aria-label="Légende">
          <aside id="caption" aria-label="Légende">
            <span class="caption-title">Échelle de Martin-Schultz</span>
            <p>Échelle colorimétrique en 16&nbsp;tons utilisée en anthropologie physique pour déterminer approximativement la couleur des yeux.</p>
          </aside>
        </div>
        <div id="video-overlay">
          <video id="voyeur-video" preload="none" playsinline></video>
        </div>
        <div id="text-overlay" role="dialog" aria-modal="true" aria-labelledby="text-quote">
          <div class="text-content">
            <span class="text-label">Témoignage</span>
            <p id="text-quote" class="text-quote">« ça m'a beaucoup questionnée sur la manière dont on construit les récits historiques&nbsp;: qui décide de ce que l'on montre, de ce que l'on cache, et pourquoi&nbsp;? »</p>
          </div>
        </div>
      </div>

      <!-- PEINE DÉMESURÉE -->
      <div id="peine-demesuree-root" aria-hidden="true">
        <svg class="svg-filters" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="rough" x="-8%" y="-8%" width="116%" height="116%">
              <feTurbulence type="fractalNoise" baseFrequency="0.065" numOctaves="4" seed="3" result="noise"/>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
            </filter>
          </defs>
        </svg>
        <div id="cinematic-veil"></div>
        <div class="viewport">
          <div class="wrap" id="main-wrap">
            <div class="titre-bloc" id="titre-bloc">
              <h1 aria-label="L'Humanité">
                <span class="grand-titre" translate="no" id="grand-titre" data-original="l'Humanité">l'Humanité</span>
              </h1>
            </div>
            <div class="meta-row" id="meta-row">
              <div class="meta-gauche" id="meta-gauche">QUATRIEME ANNEE. — N° 997.</div>
              <div class="meta-centre" id="meta-centre">JOURNAL SOCIALISTE QUOTIDIEN</div>
              <div class="meta-droite" id="meta-droite">MERCREDI 9 JANVIER 1907.</div>
            </div>
            <div class="grille draw-border-top" id="grille">
              <div class="col col-prix" id="col-0"><div class="prix-haut"><span class="chiffre-5">5</span><span class="lettre-c">C.</span></div><div class="prix-bas">Le Numéro</div></div>
              <div class="col col-redac" id="col-1">
                <div class="redac-titre">RÉDACTION, ADMINISTRATION &amp; ANNONCES</div>
                <div class="redac-adresse">110, Rue Richelieu, Paris</div>
                <div class="redac-disclaimer">Tout ce qui concerne l'Administration du journal doit être adressé à l'Administrateur.</div>
                <div class="redac-tel">TÉLÉPHONE : 102-69</div>
              </div>
              <div class="col col-directeur" id="col-2"><div class="dir-label">Directeur Politique :</div><div class="dir-nom">JEAN JAURÈS</div></div>
              <div class="col col-abos" id="col-3">
                <div class="abos-entete"><span>ABONNEMENTS</span><span class="col-paris">Paris &amp; Dép.</span><span class="col-etr">Étranger</span></div>
                <div class="abos-ligne"><span class="abos-nom"><span class="abos-mot">Un Mois</span><span class="abos-points">............................................</span></span><span class="px-paris">1 fr. 50</span><span class="px-etr">»&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; »</span></div>
                <div class="abos-ligne"><span class="abos-nom"><span class="abos-mot">Trois Mois</span><span class="abos-points">...........................................</span></span><span class="px-paris">4 fr. 50</span><span class="px-etr">9 fr. &nbsp;&nbsp;&nbsp;»</span></div>
                <div class="abos-ligne"><span class="abos-nom"><span class="abos-mot">Six Mois</span><span class="abos-points">...............................................</span></span><span class="px-paris">9 fr.&nbsp;&nbsp; »</span><span class="px-etr">16 fr. 50</span></div>
                <div class="abos-ligne"><span class="abos-nom"><span class="abos-mot">Un An</span><span class="abos-points">..................................................</span></span><span class="px-paris">18 fr.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span class="px-etr">31 fr.&nbsp;&nbsp;&nbsp; »</span></div>
                <div class="abos-pied">Les Abonnements sont reçus SANS FRAIS dans tous les bureaux de Poste.</div>
              </div>
              <div class="col col-prix" id="col-4"><div class="prix-haut"><span class="chiffre-5">5</span><span class="lettre-c">C.</span></div><div class="prix-bas">Le Numéro</div></div>
            </div>
            <div class="article-main" id="article-main">
              <div class="article-inner">
                <h1 class="article-title"><br>Le meurtrier de Kléber</h1><br>
                <div class="article-column" id="article-column">
                  <div id="marge-titre"></div>
                  <div id="marge-droite"></div>
                  <button class="video-close" id="video-close" type="button" aria-label="Fermer la vidéo">Fermer</button>
                  <div class="article-stage" id="article-stage">
                    <div class="article-text-layer" id="article-text-layer">
                      <div class="article-body-wrap">
                        <div class="article-body article-body-reserve" aria-hidden="true">
                          <p>On vient d'exposer dans les galeries du pavillon d'anatomie comparée, au Muséum, un squelette qui n'y figure d'ailleurs qu'à titre de pièce anatomique, mais qui a son histoire.</p>
                          <p>Ce squelette est celui de Souleiman el Aleby, le meurtrier de Kléber.</p>
                          <p>Souleiman el Aleby n'était point un meurtrier vulgaire. Il avait été <span class="mot-clef" data-key="condamne" data-categorie="Démesure" data-titre="« Condamné par le conseil de guerre »">condamné par le conseil de guerre</span> du Caire à avoir la main droite brûlée, à être empalé et exposé aux oiseaux de proie, simplement.</p>
                          <p>Il subit sa peine le 25 prairial an VIII. Il étendit sur le bûcher la main qui avait frappé le général français, et la laissa griller sans proférer une plainte, sans qu'un muscle de son visage trahît <span class="mot-clef" data-key="souffrance" data-categorie="Témoignage Guillaume" data-titre="« Horrible souffrance »">l'horrible souffrance</span> qu'il endurait. Mais <span class="mot-clef" data-key="bourreau" data-categorie="L'âme noire" data-titre="« le bourreau »">le bourreau</span> qui attisait le brasier ayant laissé tomber son tisonnier rouge sur le bras du condamné, Souleiman el Aleby protesta avec violence&nbsp;:</p>
                          <p>— <span class="mot-clef" data-key="supplice" data-categorie="Au tribunal" data-titre="« Ce supplice, cria-t-il, n'est pas dans mon jugement. »">Ce supplice, cria-t-il, n'est pas dans mon jugement.</span></p>
                          <p>Et ce fut la seule révolte du musulman, qui subit jusqu'au bout sa peine avec le même stoïcisme.</p>
                        </div>
                        <div class="article-body article-body-typing" id="article-body"></div>
                      </div>
                    </div>
                    <div class="article-video-layer" id="article-video-layer" aria-hidden="true">
                      <div class="video-panel" id="media-panel-video">
                        <video id="article-video" controls playsinline preload="metadata"></video>
                      </div>
                      <div class="video-panel" id="media-panel-audio" style="display:none;">
                        <div class="audio-stage">
                          <button class="audio-toggle" id="audio-toggle">Lecture</button>
                          <div class="audio-progress"><div class="audio-bar" id="audio-bar"></div></div>
                          <audio id="article-audio" preload="metadata">
                            <track id="audio-track" kind="subtitles" src="${assetPath}chp2-medias/temoignage-guillaume.vtt" srclang="fr" default>
                          </audio>
                          <div class="audio-subtitles" id="audio-subtitles"></div>
                        </div>
                      </div>
                    </div>
                    <div class="curtain curtain--left"      aria-hidden="true"></div>
                    <div class="curtain curtain--right"     aria-hidden="true"></div>
                    <div class="curtain-line curtain-line--left"  aria-hidden="true"></div>
                    <div class="curtain-line curtain-line--right" aria-hidden="true"></div>
                  </div>
                </div><br>
                <template id="article-content-template" translate="no">
                  <p>On vient d'exposer dans les galeries du pavillon d'anatomie comparée, au Muséum, un squelette qui n'y figure d'ailleurs qu'à titre de pièce anatomique, mais qui a son histoire.</p>
                  <p>Ce squelette est celui de Souleiman el Aleby, le meurtrier de Kléber.</p>
                  <p>Souleiman el Aleby n'était point un meurtrier vulgaire. Il avait été <span class="mot-clef" data-key="condamne" data-categorie="Démesure" data-titre="« Condamné par le conseil de guerre »">condamné par le conseil de guerre</span> du Caire à avoir la main droite brûlée, à être empalé et exposé aux oiseaux de proie, simplement.</p>
                  <p>Il subit sa peine le 25 prairial an VIII. Il étendit sur le bûcher la main qui avait frappé le général français, et la laissa griller sans proférer une plainte, sans qu'un muscle de son visage trahît <span class="mot-clef" data-key="souffrance" data-categorie="Témoignage Guillaume" data-titre="« Horrible souffrance »">l'horrible souffrance</span> qu'il endurait. Mais <span class="mot-clef" data-key="bourreau" data-categorie="L'âme noire" data-titre="« le bourreau »">le bourreau</span> qui attisait le brasier ayant laissé tomber son tisonnier rouge sur le bras du condamné, Souleiman el Aleby protesta avec violence&nbsp;:</p>
                  <p>— <span class="mot-clef" data-key="supplice" data-categorie="Au tribunal" data-titre="« Ce supplice, cria-t-il, n'est pas dans mon jugement. »">Ce supplice, cria-t-il, n'est pas dans mon jugement.</span></p>
                  <p>Et ce fut la seule révolte du musulman, qui subit jusqu'au bout sa peine avec le même stoïcisme.</p>
                </template>
              </div>
              <div class="article-footer-meta">
                <div class="article-footer-left">Article extrait du journal l'Humanité N°5 de 1907</div>
                <div class="article-footer-right">ABOUNADDARA - CNRS - 2026</div>
              </div>
            </div>
          </div>
        </div>
        <!-- Flèche retour gérée par Chapitre2Scene (ArrowChp2Part 'peine-demesuree') -->
      </div>

      <!-- RIDEAU DE CHARGEMENT — garantie « noir quoi qu'il arrive ».
           Styles 100% INLINE : indépendant des 4 feuilles du chapitre (qui
           peuvent arriver tard) et de l'état du LightSystem (dont le canvas
           d'obscurité naît display:none → le travelling serait visible en
           pleine lumière). Levé sur 'chp2:opening-ready'. -->
      <div id="chp2-boot" style="position:absolute;inset:0;z-index:2147483000;background:#000;opacity:1;pointer-events:none;"></div>`;
}
