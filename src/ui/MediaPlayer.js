/**
 * MediaPlayer.js
 * Lecteur audio/vidéo complet avec UI SVG.
 * Port fidèle de main.js.
 *
 * CORRECTIONS :
 * - _applyVideoScale() lit cx/cy/r directement depuis l'attribut SVG du cercle
 *   (pas depuis des variables locales de la build qui ne sont plus en scope)
 * - _cinematicClose() appelle _resetHoverTitleInScene() via callback injecté
 *   pour notifier Chapitre1Scene de réinitialiser son état hover title interne
 * - hover title : réapparition correcte après réduction vidéo (même logique main.js)
 */

export class MediaPlayer {
  constructor(config, arrowSizeFn, torch, audio) {
    this.config      = config;
    this.arrowSizeFn = arrowSizeFn;
    this.torch       = torch;
    this.audio       = audio;

    this.el = document.getElementById('media-player');

    this._active           = false;
    this._src              = null;
    this._playerHoverTitle = null;
    this._closeSessionId   = 0;

    // Callback injecté par Chapitre1Scene pour sync état hover title
    this._onClose = null;

    // Refs SVG/DOM pour resize
    this._mainSvg          = null;
    this._rect             = null;
    this._closeSvg         = null;
    this._closeGroup       = null;
    this._closeCirc        = null;
    this._closeCross       = null;
    this._closeHit         = null;
    this._playerAudio      = null;
    this._playerVideo      = null;
    this._waveCanvas       = null;
    this._creditEl         = null;   // crédit sous la boîte audio (sons uniquement)
    this._playHit          = null;
    this._playCircle       = null;
    this._playIcon         = null;
    this._pauseIcon        = null;
    this._videoLayout      = null;
    this._videoScaleBtn    = null;
    this._videoScaleCirc   = null;
    this._videoScaleIcon   = null;
    this._videoSeekWrap    = null;
    this._videoSeekBase    = null;
    this._videoSeekFill    = null;
    this._videoSepLine     = null;
    this._analyser         = null;
    this._waveRaf          = null;
    this._videoScaleAnimRaf = null;
    this._resizeRaf        = null;
  }

  get active() { return this._active; }

  /** Injection d'un callback appelé à la fermeture du player */
  setOnClose(fn) { this._onClose = fn; }

  _vW() { return Math.max(this.config.MIN_SIZE.width,  window.innerWidth);  }
  _vH() { return Math.max(this.config.MIN_SIZE.height, window.innerHeight); }
  _isVideo(src) { return /\.mp4$/i.test(src); }

  /* Crédit audio : écart sous la boîte (fraction de sa hauteur) et taille de
     police (px, bornée) — mêmes valeurs à la construction et au resize. */
  _creditGapFrac() { return 0.16; }
  _creditFontPx(rh) { return Math.max(12, Math.min(20, Math.round(rh * 0.17))); }

  _getAudioRect() {
    const P = this.config.PLAYER, W = this._vW(), H = this._vH();
    let rw = W * P.audio_w, rh = H * P.audio_h;
    if (rh > H * 0.24) rh = H * 0.24;
    if (rw > W * 0.82) rw = W * 0.82;
    return { rw, rh, rx: (W - rw) / 2, ry: (H - rh) / 2 };
  }

  _getVideoRect(frac) {
    const P = this.config.PLAYER, W = this._vW(), H = this._vH();
    let rw = W * frac, rh = rw * P.video_ratio;
    if (rh > H * 0.80) { rh = H * 0.80; rw = rh / P.video_ratio; }
    if (rw < W * P.video_min_w) rw = W * P.video_min_w;
    if (rw > W * P.video_max_w) rw = W * P.video_max_w;
    rh = rw * P.video_ratio;
    return { rw, rh, rx: (W - rw) / 2, ry: (H - rh) / 2 };
  }

  /* ═══════════════════════════════════════════════════════
     OPEN
  ═══════════════════════════════════════════════════════ */
  open(src, label, credit) {
    ++this._closeSessionId;
    if (this._active) this._forceClose();

    this.audio.stopSanzaLoop(this.config.AUDIO.sanza_fade_out);

    this._active = true;
    this._src    = src;
    // Crédit affiché sous la boîte sinusoïdale — n'a de sens que pour un son.
    this._credit = (!this._isVideo(src) && typeof credit === 'string' && credit.trim())
      ? credit.trim() : null;

    const P = this.config.PLAYER, W = this._vW(), H = this._vH();
    const isVid = this._isVideo(src), ns = 'http://www.w3.org/2000/svg';

    this._videoLayout = isVid
      ? { videoWidthFrac: P.video_min_w, targetWidthFrac: P.video_min_w, isExpanded: false }
      : null;

    // LA TORCHE NE BAISSE PAS pendant un média — et ne l'a jamais fait.
    // Il y avait ici un grow(torcheAvant × 0.8) censé l'atténuer : grow()
    // ignore ce premier argument (il anime _baseFrac → _targetFrac, posé par
    // setTarget). Le réglage PLAYER.torch_dim n'a donc jamais rien produit, et
    // CHAPITRE1.torch_media_dim encore moins (il dépendait de currentPage === 3,
    // jamais vrai : personne n'écrivait currentPage). Retiré plutôt que réparé —
    // décision assumée : la torche reste pleine, c'est ce que le site montre
    // depuis toujours. Seule la flèche et le bouton plein écran s'effacent.
    const arrowEl = document.getElementById('nav-arrow');
    const fsBtn   = document.getElementById('fs-btn');
    if (arrowEl) { arrowEl.style.transition = `opacity ${P.torch_ms/1000}s ease`; arrowEl.style.opacity = '0'; }
    if (fsBtn)   { fsBtn.style.transition   = `opacity ${P.torch_ms/1000}s ease`; fsBtn.style.opacity   = '0'; }

    const { rw, rh, rx, ry } = isVid
      ? this._getVideoRect(this._videoLayout.videoWidthFrac)
      : this._getAudioRect();

    const el = this.el;
    el.innerHTML = '';
    this._creditEl = null;

    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:absolute;inset:0;z-index:29;';
    el.appendChild(backdrop);

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
    svg.style.cssText = 'position:absolute;inset:0;z-index:30;pointer-events:none;';
    this._mainSvg = svg;

    const perim = 2 * (rw + rh);
    const rect  = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', rx); rect.setAttribute('y', ry);
    rect.setAttribute('width', rw); rect.setAttribute('height', rh);
    rect.setAttribute('fill', `rgba(0,0,0,${isVid ? P.video_bg_opacity : P.audio_bg_opacity})`);
    rect.setAttribute('stroke', P.stroke); rect.setAttribute('stroke-width', '1.2');
    rect.style.strokeDasharray = perim; rect.style.strokeDashoffset = perim;
    rect.style.transition = `stroke-dashoffset ${P.draw_speed}s cubic-bezier(0.4,0,0.2,1)`;
    svg.appendChild(rect); el.appendChild(svg);
    this._rect = rect;

    // ── Croix fermeture ──────────────────────────────────
    const cSz = this.arrowSizeFn(), cR = cSz / 2;
    const cMarR = Math.round(W * 0.035), cMarT = Math.round(H * 0.035);
    const closeDelay = P.draw_speed + P.close_delay;
    const cPer = Math.round(2 * Math.PI * cR), csR = cR * 0.46;
    const cx0 = cR, cy0 = cR;

    const closeSvg = document.createElementNS(ns, 'svg');
    closeSvg.setAttribute('width', cSz); closeSvg.setAttribute('height', cSz);
    closeSvg.setAttribute('overflow', 'visible');
    closeSvg.style.cssText = `position:absolute;z-index:32;pointer-events:none;right:${cMarR}px;top:${cMarT}px;width:${cSz}px;height:${cSz}px;`;
    this._closeSvg = closeSvg;

    const closeGroup = document.createElementNS(ns, 'g');
    closeGroup.style.transformOrigin = `${cx0}px ${cy0}px`;
    closeGroup.style.transition = 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)';
    this._closeGroup = closeGroup;

    const closeCirc = document.createElementNS(ns, 'circle');
    closeCirc.setAttribute('cx', cx0); closeCirc.setAttribute('cy', cy0); closeCirc.setAttribute('r', cR - 1);
    closeCirc.setAttribute('fill', 'none'); closeCirc.setAttribute('stroke', P.stroke); closeCirc.setAttribute('stroke-width', '1.2');
    closeCirc.style.strokeDasharray = cPer; closeCirc.style.strokeDashoffset = cPer;
    closeCirc.style.transition = `stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1) ${closeDelay}s, stroke 0.2s, filter 0.2s`;
    this._closeCirc = closeCirc;

    const cross = document.createElementNS(ns, 'g');
    cross.setAttribute('stroke', P.stroke); cross.setAttribute('stroke-width', '1.4'); cross.setAttribute('stroke-linecap', 'round');
    cross.style.opacity = '0'; cross.style.transition = `opacity 0.3s ease ${closeDelay + 0.55}s, stroke 0.2s, filter 0.2s`;
    const l1 = document.createElementNS(ns, 'line');
    l1.setAttribute('x1', cx0-csR); l1.setAttribute('y1', cy0-csR); l1.setAttribute('x2', cx0+csR); l1.setAttribute('y2', cy0+csR);
    const l2 = document.createElementNS(ns, 'line');
    l2.setAttribute('x1', cx0+csR); l2.setAttribute('y1', cy0-csR); l2.setAttribute('x2', cx0-csR); l2.setAttribute('y2', cy0+csR);
    cross.appendChild(l1); cross.appendChild(l2); this._closeCross = cross;
    closeGroup.appendChild(closeCirc); closeGroup.appendChild(cross);
    closeSvg.appendChild(closeGroup); el.appendChild(closeSvg);

    const closeHit = document.createElement('div');
    closeHit.dataset.clickable = '1';
    closeHit.style.cssText = `position:absolute;z-index:33;border-radius:50%;cursor:none;width:${cSz}px;height:${cSz}px;right:${cMarR}px;top:${cMarT}px;`;
    closeHit.addEventListener('click', () => this._cinematicClose());
    closeHit.addEventListener('pointerenter', () => {
      closeGroup.style.transform = 'scale(1.22)';
      closeCirc.setAttribute('stroke', P.btn_color_hover);
      closeCirc.style.filter = 'drop-shadow(0 0 7px rgba(255,210,80,0.80)) drop-shadow(0 0 20px rgba(255,170,30,0.50))';
      cross.setAttribute('stroke', P.btn_color_hover);
      cross.style.filter     = 'drop-shadow(0 0 7px rgba(255,210,80,0.80)) drop-shadow(0 0 20px rgba(255,170,30,0.50))';
    });
    closeHit.addEventListener('pointerleave', () => {
      closeGroup.style.transform = 'scale(1)';
      closeCirc.setAttribute('stroke', P.stroke); closeCirc.style.filter = '';
      cross.setAttribute('stroke', P.stroke);     cross.style.filter = '';
    });
    el.appendChild(closeHit); this._closeHit = closeHit;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      rect.style.strokeDashoffset = '0';
      closeCirc.style.strokeDashoffset = '0';
      cross.style.opacity = '1';
    }));

    if (isVid) this._buildVideoPlayer(el, src, rx, ry, rw, rh);
    else        this._buildAudioPlayer(el, src, rx, ry, rw, rh);
  }

  /* ═══════════════════════════════════════════════════════
     AUDIO PLAYER
  ═══════════════════════════════════════════════════════ */
  _buildAudioPlayer(el, src, rx, ry, rw, rh) {
    const P = this.config.PLAYER, ns = 'http://www.w3.org/2000/svg';

    const audio = new Audio(src);
    audio.preload = 'auto';
    this._playerAudio = audio;

    const btnZoneW = rh, bR = rh * 0.28;
    const bCX = rx + btnZoneW * 0.5, bCY = ry + rh * 0.5;
    const bPer = 2 * Math.PI * bR, btnDelay = P.draw_speed * 0.4;
    const waveGap = rh * P.audio_wave_gap;
    const waveX = rx + btnZoneW + waveGap;
    const waveW = rw - btnZoneW - waveGap * 2;
    const waveH = rh * P.audio_wave_h;
    const waveY = ry + (rh - waveH) / 2;

    const wc = document.createElement('canvas');
    wc.width  = Math.max(2, Math.round(waveW));
    wc.height = Math.max(2, Math.round(waveH));
    wc.style.cssText = `position:absolute;z-index:31;pointer-events:none;opacity:0;left:${waveX}px;top:${waveY}px;width:${waveW}px;height:${waveH}px;transition:opacity 0.5s ease ${P.draw_speed + 0.2}s;`;
    el.appendChild(wc); this._waveCanvas = wc;
    requestAnimationFrame(() => wc.style.opacity = '1');

    // ── Crédit sous la boîte (sons uniquement) ───────────────────────────
    // Centré sous le rectangle, il apparaît en fondu comme le reste du player.
    // La vidéo n'appelle jamais ce chemin → le crédit reste propre aux sons.
    if (this._credit) {
      const gap = Math.round(rh * this._creditGapFrac());
      const fs  = this._creditFontPx(rh);
      const credit = document.createElement('div');
      credit.className = 'media-credit';
      credit.textContent = this._credit;
      credit.style.cssText =
        `position:absolute;z-index:33;pointer-events:none;text-align:center;` +
        `left:${rx}px;top:${ry + rh + gap}px;width:${rw}px;` +
        `font-family:'Cormorant Garamond','Playfair Display',Georgia,serif;` +
        `font-style:italic;font-weight:400;font-size:${fs}px;letter-spacing:0.12em;` +
        `color:rgba(255,255,255,0.62);opacity:0;` +
        `transition:opacity 0.5s ease ${P.draw_speed + 0.3}s;`;
      el.appendChild(credit); this._creditEl = credit;
      requestAnimationFrame(() => credit.style.opacity = '1');
    }

    const bSvg = document.createElementNS(ns, 'svg');
    bSvg.setAttribute('width', '100%'); bSvg.setAttribute('height', '100%');
    bSvg.style.cssText = 'position:absolute;inset:0;z-index:33;pointer-events:none;';

    const bCirc = document.createElementNS(ns, 'circle');
    bCirc.setAttribute('cx', bCX); bCirc.setAttribute('cy', bCY); bCirc.setAttribute('r', bR);
    bCirc.setAttribute('fill', 'none'); bCirc.setAttribute('stroke', P.btn_color); bCirc.setAttribute('stroke-width', '1.0');
    bCirc.style.strokeDasharray = bPer; bCirc.style.strokeDashoffset = bPer;
    bCirc.style.transition = `stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1) ${btnDelay}s, stroke 0.2s, filter 0.2s`;
    bSvg.appendChild(bCirc); this._playCircle = bCirc;

    const ic = bR * 0.42;
    const playIcon = document.createElementNS(ns, 'polygon');
    playIcon.setAttribute('points', `${bCX-ic*0.65},${bCY-ic} ${bCX-ic*0.65},${bCY+ic} ${bCX+ic*1.1},${bCY}`);
    playIcon.setAttribute('fill', P.btn_color); playIcon.style.opacity = '0';
    playIcon.style.transition = 'opacity 0.2s ease, fill 0.2s, filter 0.2s';
    bSvg.appendChild(playIcon); this._playIcon = playIcon;

    const pauseIcon = document.createElementNS(ns, 'g');
    pauseIcon.setAttribute('fill', P.btn_color); pauseIcon.style.opacity = '0';
    pauseIcon.style.transition = 'opacity 0.2s ease, fill 0.2s, filter 0.2s';
    const prw = ic * 0.52, gap = ic * 0.34;
    const bar1 = document.createElementNS(ns, 'rect');
    bar1.setAttribute('x', bCX-gap-prw); bar1.setAttribute('y', bCY-ic); bar1.setAttribute('width', prw); bar1.setAttribute('height', ic*2);
    const bar2 = document.createElementNS(ns, 'rect');
    bar2.setAttribute('x', bCX+gap); bar2.setAttribute('y', bCY-ic); bar2.setAttribute('width', prw); bar2.setAttribute('height', ic*2);
    pauseIcon.appendChild(bar1); pauseIcon.appendChild(bar2);
    bSvg.appendChild(pauseIcon); this._pauseIcon = pauseIcon;
    el.appendChild(bSvg);

    const btnHit = document.createElement('div');
    btnHit.dataset.clickable = '1';
    btnHit.style.cssText = `position:absolute;z-index:34;border-radius:50%;cursor:none;width:${bR*3.2}px;height:${bR*3.2}px;left:${bCX-bR*1.6}px;top:${bCY-bR*1.6}px;`;
    el.appendChild(btnHit); this._playHit = btnHit;

    const setPlaying = (on) => { playIcon.style.opacity = on?'0':'1'; pauseIcon.style.opacity = on?'1':'0'; };

    btnHit.addEventListener('pointerenter', () => { bCirc.setAttribute('stroke', P.btn_color_hover); bCirc.style.filter='drop-shadow(0 0 6px rgba(255,210,80,0.8))'; playIcon.setAttribute('fill',P.btn_color_hover); pauseIcon.setAttribute('fill',P.btn_color_hover); });
    btnHit.addEventListener('pointerleave', () => { bCirc.setAttribute('stroke', P.btn_color); bCirc.style.filter=''; playIcon.setAttribute('fill',P.btn_color); pauseIcon.setAttribute('fill',P.btn_color); });
    btnHit.addEventListener('click', async () => { if(audio.paused){try{await audio.play();}catch(e){}}else{audio.pause();} });

    requestAnimationFrame(() => requestAnimationFrame(() => { bCirc.style.strokeDashoffset='0'; }));

    const ac      = this.audio.getAudioContext();
    const source  = ac.createMediaElementSource(audio);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser); analyser.connect(ac.destination);
    this._analyser = analyser;

    audio.addEventListener('play',  () => { setPlaying(true);  this._drawWaveform(wc, analyser); });
    audio.addEventListener('pause', () => { setPlaying(false); if(this._waveRaf){cancelAnimationFrame(this._waveRaf);this._waveRaf=null;} wc.getContext('2d').clearRect(0,0,wc.width,wc.height); });
    audio.addEventListener('ended', () => { setPlaying(false); if(this._waveRaf){cancelAnimationFrame(this._waveRaf);this._waveRaf=null;} wc.getContext('2d').clearRect(0,0,wc.width,wc.height); setTimeout(()=>this._cinematicClose(),400); });

    requestAnimationFrame(()=>requestAnimationFrame(async()=>{ try{await audio.play();}catch(e){} }));
  }

  _drawWaveform(canvas, analyser) {
    const P = this.config.PLAYER, ctx2 = canvas.getContext('2d');
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      this._waveRaf = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(buf);
      const cW=canvas.width, cH=canvas.height;
      ctx2.clearRect(0,0,cW,cH); ctx2.beginPath();
      ctx2.strokeStyle=P.wave_color; ctx2.lineWidth=P.wave_width;
      const step=cW/buf.length;
      buf.forEach((v,i)=>{ const x=i*step,y=((v/128)-1)*(cH*0.42)+cH/2; i===0?ctx2.moveTo(x,y):ctx2.lineTo(x,y); });
      ctx2.stroke();
    };
    draw();
  }

  /* ═══════════════════════════════════════════════════════
     VIDEO PLAYER
  ═══════════════════════════════════════════════════════ */
  _buildVideoPlayer(el, src, rx, ry, rw, rh) {
    const P=this.config.PLAYER, ns='http://www.w3.org/2000/svg';
    const W=this._vW(), H=this._vH();
    const inset=Math.max(1,Math.round(Math.min(W,H)*P.media_inset));
    const ctrlH=rh*P.video_ctrl_h, vidH=rh-ctrlH, sepY=ry+vidH;

    const video=document.createElement('video');
    video.src=src; video.preload='auto'; video.playsInline=true;
    this._playerVideo=video;
    video.style.cssText=`position:absolute;z-index:31;object-fit:contain;background:#000;opacity:0;transition:opacity 0.5s ease ${P.draw_speed+0.2}s;left:${rx+inset}px;top:${ry+inset}px;width:${Math.max(2,rw-inset*2)}px;height:${Math.max(2,vidH-inset)}px;`;
    el.appendChild(video);
    requestAnimationFrame(()=>video.style.opacity='1');

    const cSvg=document.createElementNS(ns,'svg');
    cSvg.setAttribute('width','100%'); cSvg.setAttribute('height','100%');
    cSvg.style.cssText='position:absolute;inset:0;z-index:33;pointer-events:none;';

    const sepLine=document.createElementNS(ns,'line');
    sepLine.setAttribute('x1',rx); sepLine.setAttribute('y1',sepY); sepLine.setAttribute('x2',rx+rw); sepLine.setAttribute('y2',sepY);
    sepLine.setAttribute('stroke',P.stroke); sepLine.setAttribute('stroke-width','1');
    sepLine.style.opacity='0'; sepLine.style.transition=`opacity 0.35s ease ${P.draw_speed+0.15}s`;
    cSvg.appendChild(sepLine); this._videoSepLine=sepLine;

    const btnDelay=P.draw_speed*0.5, sidePad=rw*0.03, bR=ctrlH*0.30;
    const leftCX=rx+sidePad+bR, rightCX=rx+rw-sidePad-bR;
    const bCY=ry+vidH+ctrlH*0.5, bPer=2*Math.PI*bR;

    const playCirc=document.createElementNS(ns,'circle');
    playCirc.setAttribute('cx',leftCX); playCirc.setAttribute('cy',bCY); playCirc.setAttribute('r',bR);
    playCirc.setAttribute('fill','none'); playCirc.setAttribute('stroke',P.btn_color); playCirc.setAttribute('stroke-width','1.0');
    playCirc.style.strokeDasharray=bPer; playCirc.style.strokeDashoffset=bPer;
    playCirc.style.transition=`stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1) ${btnDelay}s, stroke 0.2s, filter 0.2s`;
    cSvg.appendChild(playCirc); this._playCircle=playCirc;

    const ic=bR*0.38;
    const playIcon=document.createElementNS(ns,'polygon');
    playIcon.setAttribute('points',`${leftCX-ic*0.7},${bCY-ic} ${leftCX-ic*0.7},${bCY+ic} ${leftCX+ic*1.1},${bCY}`);
    playIcon.setAttribute('fill',P.btn_color); playIcon.style.opacity='0';
    playIcon.style.transition='opacity 0.2s ease, fill 0.2s, filter 0.2s';
    cSvg.appendChild(playIcon); this._playIcon=playIcon;

    const pauseIcon=document.createElementNS(ns,'g');
    pauseIcon.setAttribute('fill',P.btn_color); pauseIcon.style.opacity='0';
    pauseIcon.style.transition='opacity 0.2s ease, fill 0.2s, filter 0.2s';
    const prw=ic*0.52, gap2=ic*0.34;
    const vb1=document.createElementNS(ns,'rect'); vb1.setAttribute('x',leftCX-gap2-prw); vb1.setAttribute('y',bCY-ic); vb1.setAttribute('width',prw); vb1.setAttribute('height',ic*2);
    const vb2=document.createElementNS(ns,'rect'); vb2.setAttribute('x',leftCX+gap2); vb2.setAttribute('y',bCY-ic); vb2.setAttribute('width',prw); vb2.setAttribute('height',ic*2);
    pauseIcon.appendChild(vb1); pauseIcon.appendChild(vb2);
    cSvg.appendChild(pauseIcon); this._pauseIcon=pauseIcon;

    const sizeCirc=document.createElementNS(ns,'circle');
    sizeCirc.setAttribute('cx',rightCX); sizeCirc.setAttribute('cy',bCY); sizeCirc.setAttribute('r',bR);
    sizeCirc.setAttribute('fill','none'); sizeCirc.setAttribute('stroke',P.btn_color); sizeCirc.setAttribute('stroke-width','1.0');
    sizeCirc.style.strokeDasharray=bPer; sizeCirc.style.strokeDashoffset=bPer;
    sizeCirc.style.transition=`stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1) ${btnDelay}s, stroke 0.2s, filter 0.2s`;
    cSvg.appendChild(sizeCirc); this._videoScaleCirc=sizeCirc;

    const arm=bR*0.38, offBig=bR*0.52;
    const cdefs=[[-1,-1],[1,-1],[1,1],[-1,1]];
    const sizeGroup=document.createElementNS(ns,'g');
    sizeGroup.style.opacity='0'; sizeGroup.style.transition='opacity 0.15s ease';
    this._videoScaleIcon=sizeGroup;
    cdefs.forEach(([sx,sy])=>{
      const p=document.createElementNS(ns,'path');
      const px=rightCX+sx*offBig, py=bCY+sy*offBig;
      p.setAttribute('d',`M${px},${py+sy*arm} L${px},${py} L${px+sx*arm},${py}`);
      p.setAttribute('fill','none'); p.setAttribute('stroke',P.btn_color);
      p.setAttribute('stroke-width','1.5'); p.setAttribute('stroke-linecap','round'); p.setAttribute('stroke-linejoin','round');
      sizeGroup.appendChild(p);
    });
    cSvg.appendChild(sizeGroup);

    const seekX1=leftCX+bR+rw*0.05, seekX2=rightCX-bR-rw*0.05, seekY=bCY, seekWrapH=ctrlH*P.video_seek_h;
    const seekBase=document.createElementNS(ns,'line');
    seekBase.setAttribute('x1',seekX1); seekBase.setAttribute('y1',seekY); seekBase.setAttribute('x2',seekX2); seekBase.setAttribute('y2',seekY);
    seekBase.setAttribute('stroke','rgba(255,255,255,0.28)'); seekBase.setAttribute('stroke-width',P.video_seek_thick); seekBase.setAttribute('stroke-linecap','round');
    cSvg.appendChild(seekBase); this._videoSeekBase=seekBase;

    const seekFill=document.createElementNS(ns,'line');
    seekFill.setAttribute('x1',seekX1); seekFill.setAttribute('y1',seekY); seekFill.setAttribute('x2',seekX1); seekFill.setAttribute('y2',seekY);
    seekFill.setAttribute('stroke',P.stroke); seekFill.setAttribute('stroke-width',P.video_seek_thick); seekFill.setAttribute('stroke-linecap','round');
    cSvg.appendChild(seekFill); this._videoSeekFill=seekFill;
    el.appendChild(cSvg);

    const playHit=document.createElement('div');
    playHit.dataset.clickable='1';
    playHit.style.cssText=`position:absolute;z-index:34;border-radius:50%;cursor:none;width:${bR*3.2}px;height:${bR*3.2}px;left:${leftCX-bR*1.6}px;top:${bCY-bR*1.6}px;`;
    el.appendChild(playHit); this._playHit=playHit;

    const sizeHit=document.createElement('div');
    sizeHit.dataset.clickable='1';
    sizeHit.style.cssText=`position:absolute;z-index:34;border-radius:50%;cursor:none;width:${bR*3.2}px;height:${bR*3.2}px;left:${rightCX-bR*1.6}px;top:${bCY-bR*1.6}px;transition:transform 0.35s cubic-bezier(0.22,1,0.36,1);`;
    el.appendChild(sizeHit); this._videoScaleBtn=sizeHit;

    const seekWrap=document.createElement('div');
    seekWrap.dataset.clickable='1';
    seekWrap.style.cssText=`position:absolute;z-index:34;cursor:none;left:${seekX1}px;top:${seekY-seekWrapH*2.5}px;width:${seekX2-seekX1}px;height:${seekWrapH*5}px;`;
    el.appendChild(seekWrap); this._videoSeekWrap=seekWrap;

    const setPlaying=(on)=>{ playIcon.style.opacity=on?'0':'1'; pauseIcon.style.opacity=on?'1':'0'; };

    playHit.addEventListener('pointerenter',()=>{ playCirc.setAttribute('stroke',P.btn_color_hover); playCirc.style.filter='drop-shadow(0 0 6px rgba(255,210,80,0.8))'; playIcon.setAttribute('fill',P.btn_color_hover); pauseIcon.setAttribute('fill',P.btn_color_hover); });
    playHit.addEventListener('pointerleave',()=>{ playCirc.setAttribute('stroke',P.btn_color); playCirc.style.filter=''; playIcon.setAttribute('fill',P.btn_color); pauseIcon.setAttribute('fill',P.btn_color); });
    playHit.addEventListener('click',async()=>{ if(video.paused){try{await video.play();}catch(e){}}else{video.pause();} });

    sizeHit.addEventListener('pointerenter',()=>{ sizeCirc.setAttribute('stroke',P.btn_color_hover); sizeCirc.style.filter='drop-shadow(0 0 8px rgba(255,210,80,0.9))'; sizeGroup.querySelectorAll('path').forEach(p=>p.setAttribute('stroke',P.btn_color_hover)); sizeHit.style.transform='scale(1.12)'; });
    sizeHit.addEventListener('pointerleave',()=>{ sizeCirc.setAttribute('stroke',P.btn_color); sizeCirc.style.filter=''; sizeGroup.querySelectorAll('path').forEach(p=>p.setAttribute('stroke',P.btn_color)); sizeHit.style.transform='scale(1)'; });
    sizeHit.addEventListener('click',()=>{ sizeHit.animate([{transform:'scale(1)'},{transform:'scale(1.14)'},{transform:'scale(1)'}],{duration:420,easing:'cubic-bezier(0.22,1,0.36,1)'}); this._applyVideoScale(); });

    seekWrap.addEventListener('click',e=>{ const r=seekWrap.getBoundingClientRect(); const ratio=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); if(isFinite(video.duration)&&video.duration>0){video.currentTime=video.duration*ratio; this._updateVideoSeekUI();} });

    video.addEventListener('timeupdate',    ()=>this._updateVideoSeekUI());
    video.addEventListener('loadedmetadata',()=>this._updateVideoSeekUI());
    video.addEventListener('play',  ()=>setPlaying(true));
    video.addEventListener('pause', ()=>setPlaying(false));
    video.addEventListener('ended', ()=>{ setPlaying(false); this._updateVideoSeekUI(); setTimeout(()=>this._cinematicClose(),600); });

    requestAnimationFrame(()=>requestAnimationFrame(()=>{ playCirc.style.strokeDashoffset='0'; sizeCirc.style.strokeDashoffset='0'; sepLine.style.opacity='1'; playIcon.style.opacity='1'; sizeGroup.style.opacity='1'; }));
    requestAnimationFrame(()=>requestAnimationFrame(async()=>{ try{await video.play();}catch(e){} }));
  }

  /* ─── Scale vidéo ─────────────────────────────────────────────
     CORRECTION : lit cx/cy/r depuis les attributs SVG du cercle
     (pas depuis des variables locales de _buildVideoPlayer)
  ──────────────────────────────────────────────────────────── */
  _applyVideoScale() {
    if (!this._active || !this._videoLayout || !this._playerVideo) return;
    const P = this.config.PLAYER;
    if (this._videoScaleAnimRaf) { cancelAnimationFrame(this._videoScaleAnimRaf); this._videoScaleAnimRaf = null; }

    const start = this._videoLayout.videoWidthFrac ?? P.video_min_w;
    const nextExpanded = !this._videoLayout.isExpanded;
    const end = nextExpanded ? P.video_max_w : P.video_min_w;
    this._videoLayout.isExpanded = nextExpanded;
    this._videoLayout.targetWidthFrac = end;

    // Morphing coins — lecture depuis l'attribut SVG du cercle
    if (this._videoScaleIcon && this._videoScaleCirc) {
      const cx  = parseFloat(this._videoScaleCirc.getAttribute('cx'));
      const cy  = parseFloat(this._videoScaleCirc.getAttribute('cy'));
      const r   = parseFloat(this._videoScaleCirc.getAttribute('r'));
      const arm = r * 0.38, distBig = r * 0.52, distSmall = r * 0.24;
      const dist = nextExpanded ? distSmall : distBig;
      const cdefs = [[-1,-1],[1,-1],[1,1],[-1,1]];
      Array.from(this._videoScaleIcon.querySelectorAll('path')).forEach((p, i) => {
        const [sx, sy] = cdefs[i];
        const px = cx + sx * dist, py = cy + sy * dist;
        p.setAttribute('d', `M${px},${py+sy*arm} L${px},${py} L${px+sx*arm},${py}`);
      });
    }

    // CORRECTION : titre hover
    // expand → cacher ; réduction → réafficher si mémorisé
    const hoverTitleEl = document.getElementById('hover-title');
    if (nextExpanded) {
      if (hoverTitleEl) hoverTitleEl.classList.remove('visible');
    } else {
      if (this._playerHoverTitle && hoverTitleEl) {
        setTimeout(() => {
          if (this._active && this._playerHoverTitle) {
            hoverTitleEl.classList.add('visible');
          }
        }, 200);
      }
    }

    const duration = P.video_scale_duration_ms ?? 760;
    const easePow  = P.video_scale_ease_power  ?? 2.6;
    const t0 = performance.now();
    const step = (now) => {
      if (!this._active || !this._videoLayout || !this._playerVideo) { this._videoScaleAnimRaf = null; return; }
      const p = Math.min((now - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, easePow);
      this._videoLayout.videoWidthFrac = start + (end - start) * e;
      this._handleResize();
      if (p < 1) { this._videoScaleAnimRaf = requestAnimationFrame(step); }
      else { this._videoLayout.videoWidthFrac = end; this._videoScaleAnimRaf = null; this._handleResize(); }
    };
    this._videoScaleAnimRaf = requestAnimationFrame(step);
  }

  _updateVideoSeekUI() {
    if (!this._playerVideo || !this._videoSeekFill || !this._videoSeekBase) return;
    const dur = this._playerVideo.duration, cur = this._playerVideo.currentTime;
    let ratio = 0;
    if (isFinite(dur) && dur > 0) ratio = Math.max(0, Math.min(1, cur / dur));
    const x1 = parseFloat(this._videoSeekBase.getAttribute('x1'));
    const x2 = parseFloat(this._videoSeekBase.getAttribute('x2'));
    this._videoSeekFill.setAttribute('x2', x1 + (x2 - x1) * ratio);
  }

  /* ═══════════════════════════════════════════════════════
     FERMETURE CINÉMATOGRAPHIQUE
     CORRECTION : appelle this._onClose() pour notifier
     Chapitre1Scene de réinitialiser son état hover title
  ═══════════════════════════════════════════════════════ */
  _cinematicClose() {
    if (!this._active) return;
    this._active = false;

    const P = this.config.PLAYER;
    const fadeMs = P.fade_out_ms || 900, fadeY = P.fade_out_y || 18;
    const sid = ++this._closeSessionId;

    if (this._waveRaf) { cancelAnimationFrame(this._waveRaf); this._waveRaf = null; }
    if (this._playerAudio) this._playerAudio.pause();
    if (this._playerVideo) this._playerVideo.pause();

    Array.from(this.el.children).forEach(child => {
      child.style.transition = `opacity ${fadeMs/1000}s cubic-bezier(0.4,0,0.2,1), transform ${fadeMs/1000}s cubic-bezier(0.4,0,0.2,1)`;
      child.style.opacity    = '0';
      child.style.transform  = (child.style.transform || '') + ` translateY(${fadeY}px)`;
    });

    setTimeout(() => {
      if (sid !== this._closeSessionId) return;
      if (this._playerAudio) { this._playerAudio.src = ''; this._playerAudio = null; }
      if (this._playerVideo) { this._playerVideo.src = ''; this._playerVideo = null; }
      this._analyser = null; this._src = null; this._videoLayout = null;
      this._creditEl = null; this._credit = null;
      this.el.innerHTML = '';

      // (rien à rendre à la torche : elle n'a pas baissé — voir open())
      this.audio.startSanzaLoop();

      const arrowEl = document.getElementById('nav-arrow');
      const fsBtn   = document.getElementById('fs-btn');
      if (arrowEl) { arrowEl.style.transition = `opacity ${P.torch_ms/1000}s ease`; arrowEl.style.opacity = arrowEl.classList.contains('visible') ? '1' : '0'; }
      if (fsBtn)   { fsBtn.style.transition   = `opacity ${P.torch_ms/1000}s ease`; fsBtn.style.opacity   = '0.85'; }

      // CORRECTION : notifier la scène + gérer le hover title
      const prevTitle = this._playerHoverTitle;
      this._playerHoverTitle = null;

      // Appeler le callback de la scène pour sync état interne
      if (this._onClose) this._onClose(prevTitle);

      // Efface le titre si la souris n'est plus sur une zone
      const stillOnZone = document.querySelector('.hotspot-zone:hover');
      if (!stillOnZone) {
        const titleEl = document.getElementById('hover-title');
        if (titleEl) titleEl.classList.remove('visible');
      }
    }, fadeMs + 40);
  }

  _forceClose() {
    this._active = false;
    if (this._playerAudio) { this._playerAudio.src = ''; this._playerAudio = null; }
    if (this._playerVideo) { this._playerVideo.src = ''; this._playerVideo = null; }
    if (this._waveRaf) { cancelAnimationFrame(this._waveRaf); this._waveRaf = null; }
    this.el.innerHTML = '';
    this._creditEl = null; this._credit = null;
    this._playerHoverTitle = null;
    if (this._onClose) this._onClose(null);
  }

  close() { this._cinematicClose(); }

  setPlayerHoverTitle(title) { this._playerHoverTitle = title; }

  /* ═══════════════════════════════════════════════════════
     RESIZE
  ═══════════════════════════════════════════════════════ */
  resize() {
    if (!this._active || (!this._playerAudio && !this._playerVideo)) return;
    if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
    this._resizeRaf = requestAnimationFrame(() => { this._resizeRaf = null; this._handleResize(); });
  }

  _handleResize() {
    if (!this._active || (!this._playerAudio && !this._playerVideo)) return;
    const P = this.config.PLAYER, W = this._vW(), H = this._vH();
    const isVid = !!this._playerVideo;
    const { rw, rh, rx, ry } = isVid
      ? this._getVideoRect(this._videoLayout?.videoWidthFrac ?? P.video_min_w)
      : this._getAudioRect();

    if (this._rect) { const p=2*(rw+rh); this._rect.setAttribute('x',rx); this._rect.setAttribute('y',ry); this._rect.setAttribute('width',rw); this._rect.setAttribute('height',rh); this._rect.style.strokeDasharray=p; this._rect.style.strokeDashoffset='0'; this._rect.style.transition='none'; }

    const cSz=this.arrowSizeFn(), cR=cSz/2;
    const cMarR=Math.round(W*0.035), cMarT=Math.round(H*0.035);
    const csRR=cR*0.46, cx0R=cR, cy0R=cR;
    if(this._closeSvg){this._closeSvg.setAttribute('width',cSz);this._closeSvg.setAttribute('height',cSz);this._closeSvg.style.right=cMarR+'px';this._closeSvg.style.top=cMarT+'px';this._closeSvg.style.width=cSz+'px';this._closeSvg.style.height=cSz+'px';}
    if(this._closeGroup){this._closeGroup.style.transformOrigin=`${cx0R}px ${cy0R}px`;}
    if(this._closeCirc){this._closeCirc.setAttribute('cx',cx0R);this._closeCirc.setAttribute('cy',cy0R);this._closeCirc.setAttribute('r',cR-1);const p=Math.round(2*Math.PI*(cR-1));this._closeCirc.style.strokeDasharray=p;this._closeCirc.style.strokeDashoffset='0';}
    if(this._closeCross){const ls=this._closeCross.querySelectorAll('line');if(ls[0]){ls[0].setAttribute('x1',cx0R-csRR);ls[0].setAttribute('y1',cy0R-csRR);ls[0].setAttribute('x2',cx0R+csRR);ls[0].setAttribute('y2',cy0R+csRR);}if(ls[1]){ls[1].setAttribute('x1',cx0R+csRR);ls[1].setAttribute('y1',cy0R-csRR);ls[1].setAttribute('x2',cx0R-csRR);ls[1].setAttribute('y2',cy0R+csRR);}}
    if(this._closeHit){this._closeHit.style.width=cSz+'px';this._closeHit.style.height=cSz+'px';this._closeHit.style.right=cMarR+'px';this._closeHit.style.top=cMarT+'px';}

    if (isVid && this._playerVideo) {
      const inset=Math.max(1,Math.round(Math.min(W,H)*P.media_inset));
      const ctrlH=rh*P.video_ctrl_h, vidH=rh-ctrlH, sepY=ry+vidH;
      this._playerVideo.style.left=(rx+inset)+'px'; this._playerVideo.style.top=(ry+inset)+'px';
      this._playerVideo.style.width=Math.max(2,rw-inset*2)+'px'; this._playerVideo.style.height=Math.max(2,vidH-inset)+'px';
      const sidePad=rw*0.03, bR=ctrlH*0.30;
      const leftCX=rx+sidePad+bR, rightCX=rx+rw-sidePad-bR;
      const bCY=ry+vidH+ctrlH*0.5, bPer=2*Math.PI*bR;
      const ic=bR*0.38, prw2=ic*0.52, gap2=ic*0.34;
      if(this._videoSepLine){this._videoSepLine.setAttribute('x1',rx);this._videoSepLine.setAttribute('y1',sepY);this._videoSepLine.setAttribute('x2',rx+rw);this._videoSepLine.setAttribute('y2',sepY);this._videoSepLine.style.opacity='1';}
      if(this._playCircle){this._playCircle.setAttribute('cx',leftCX);this._playCircle.setAttribute('cy',bCY);this._playCircle.setAttribute('r',bR);this._playCircle.style.strokeDasharray=bPer;this._playCircle.style.strokeDashoffset='0';}
      if(this._playIcon){this._playIcon.setAttribute('points',`${leftCX-ic*0.7},${bCY-ic} ${leftCX-ic*0.7},${bCY+ic} ${leftCX+ic*1.1},${bCY}`);}
      if(this._pauseIcon){const rs=this._pauseIcon.querySelectorAll('rect');if(rs[0]){rs[0].setAttribute('x',leftCX-gap2-prw2);rs[0].setAttribute('y',bCY-ic);rs[0].setAttribute('width',prw2);rs[0].setAttribute('height',ic*2);}if(rs[1]){rs[1].setAttribute('x',leftCX+gap2);rs[1].setAttribute('y',bCY-ic);rs[1].setAttribute('width',prw2);rs[1].setAttribute('height',ic*2);}}
      if(this._playHit){this._playHit.style.width=(bR*3.2)+'px';this._playHit.style.height=(bR*3.2)+'px';this._playHit.style.left=(leftCX-bR*1.6)+'px';this._playHit.style.top=(bCY-bR*1.6)+'px';}
      if(this._videoScaleCirc){this._videoScaleCirc.setAttribute('cx',rightCX);this._videoScaleCirc.setAttribute('cy',bCY);this._videoScaleCirc.setAttribute('r',bR);this._videoScaleCirc.style.strokeDasharray=bPer;this._videoScaleCirc.style.strokeDashoffset='0';}
      if(this._videoScaleIcon){const arm=bR*0.38,dBig=bR*0.52,dSml=bR*0.24,exp=!!this._videoLayout?.isExpanded,d=exp?dSml:dBig,cd=[[-1,-1],[1,-1],[1,1],[-1,1]];Array.from(this._videoScaleIcon.querySelectorAll('path')).forEach((p,i)=>{const[sx,sy]=cd[i];const px=rightCX+sx*d,py=bCY+sy*d;p.style.transition='none';p.setAttribute('d',`M${px},${py+sy*arm} L${px},${py} L${px+sx*arm},${py}`);requestAnimationFrame(()=>{p.style.transition='d 0.35s cubic-bezier(0.4,0,0.2,1), stroke 0.2s, filter 0.2s';});});this._videoScaleIcon.style.opacity='1';}
      if(this._videoScaleBtn){this._videoScaleBtn.style.width=(bR*3.2)+'px';this._videoScaleBtn.style.height=(bR*3.2)+'px';this._videoScaleBtn.style.left=(rightCX-bR*1.6)+'px';this._videoScaleBtn.style.top=(bCY-bR*1.6)+'px';}
      const seekX1=leftCX+bR+rw*0.05,seekX2=rightCX-bR-rw*0.05,seekY=bCY,swH=ctrlH*P.video_seek_h;
      if(this._videoSeekWrap){this._videoSeekWrap.style.left=seekX1+'px';this._videoSeekWrap.style.top=(seekY-swH*2.5)+'px';this._videoSeekWrap.style.width=(seekX2-seekX1)+'px';this._videoSeekWrap.style.height=(swH*5)+'px';}
      if(this._videoSeekBase){this._videoSeekBase.setAttribute('x1',seekX1);this._videoSeekBase.setAttribute('y1',seekY);this._videoSeekBase.setAttribute('x2',seekX2);this._videoSeekBase.setAttribute('y2',seekY);this._videoSeekBase.setAttribute('stroke-width',P.video_seek_thick);}
      if(this._videoSeekFill){this._videoSeekFill.setAttribute('x1',seekX1);this._videoSeekFill.setAttribute('y1',seekY);this._videoSeekFill.setAttribute('y2',seekY);this._videoSeekFill.setAttribute('stroke-width',P.video_seek_thick);}
      this._updateVideoSeekUI();
    } else if (this._playerAudio) {
      const btnZoneW=rh,bR=rh*0.28,bCX=rx+btnZoneW*0.5,bCY=ry+rh*0.5,bPer=2*Math.PI*bR;
      const wGap=rh*P.audio_wave_gap,wX=rx+btnZoneW+wGap,wW=rw-btnZoneW-wGap*2,wH=rh*P.audio_wave_h,wY=ry+(rh-wH)/2;
      const ic=bR*0.42,prw3=ic*0.52,gap3=ic*0.34;
      if(this._waveCanvas){this._waveCanvas.width=Math.max(2,Math.round(wW));this._waveCanvas.height=Math.max(2,Math.round(wH));this._waveCanvas.style.left=wX+'px';this._waveCanvas.style.top=wY+'px';this._waveCanvas.style.width=wW+'px';this._waveCanvas.style.height=wH+'px';if(this._playerAudio.paused){this._waveCanvas.getContext('2d').clearRect(0,0,this._waveCanvas.width,this._waveCanvas.height);}}
      if(this._playCircle){this._playCircle.setAttribute('cx',bCX);this._playCircle.setAttribute('cy',bCY);this._playCircle.setAttribute('r',bR);this._playCircle.style.strokeDasharray=bPer;this._playCircle.style.strokeDashoffset='0';}
      if(this._playIcon){this._playIcon.setAttribute('points',`${bCX-ic*0.65},${bCY-ic} ${bCX-ic*0.65},${bCY+ic} ${bCX+ic*1.1},${bCY}`);}
      if(this._pauseIcon){const rs=this._pauseIcon.querySelectorAll('rect');if(rs[0]){rs[0].setAttribute('x',bCX-gap3-prw3);rs[0].setAttribute('y',bCY-ic);rs[0].setAttribute('width',prw3);rs[0].setAttribute('height',ic*2);}if(rs[1]){rs[1].setAttribute('x',bCX+gap3);rs[1].setAttribute('y',bCY-ic);rs[1].setAttribute('width',prw3);rs[1].setAttribute('height',ic*2);}}
      if(this._playHit){this._playHit.style.width=(bR*3.2)+'px';this._playHit.style.height=(bR*3.2)+'px';this._playHit.style.left=(bCX-bR*1.6)+'px';this._playHit.style.top=(bCY-bR*1.6)+'px';}
      if(this._creditEl){const gap=Math.round(rh*this._creditGapFrac());this._creditEl.style.left=rx+'px';this._creditEl.style.top=(ry+rh+gap)+'px';this._creditEl.style.width=rw+'px';this._creditEl.style.fontSize=this._creditFontPx(rh)+'px';}
    }
  }
}
