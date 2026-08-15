/**
 * AudioManager.js
 * Gestion centralisée de tous les sons du site.
 *
 * ⚠️ LE NOIR EST AUSSI UN SILENCE (audit de sortie de scène, août 2026).
 * Voir `enforceSilence()`, tout en bas : c'est la seule garantie qui vaille,
 * et elle est appelée d'un seul endroit (app.js, à la frontière entre deux
 * scènes). Le reste de ce fichier ne fait que jouer des sons.
 */

/* ─────────────────────────────────────────────────────────────────────────────
   REGISTRE DES <audio>/<video> — pourquoi ce crochet sur le prototype
   ─────────────────────────────────────────────────────────────────────────────
   L'AudioManager ne connaît QUE ses six pistes Web Audio. Les chapitres, eux,
   fabriquent leurs propres éléments média : `new Audio()` dans l'ambiance du
   chapitre 3, dans les bulles du 4, dans « Invisibilisation »… Beaucoup ne sont
   même pas dans le document — impossible de les retrouver par une requête DOM.

   La seule façon de garantir le silence SANS demander à chaque module de s'en
   souvenir, c'est de noter au passage tout élément qui commence à jouer. D'où
   ce crochet, posé UNE fois, qui n'ajoute rien d'autre qu'une référence FAIBLE.

   ⚠️ WeakRef, et pas l'élément : un `<video>` retenu retient tout son arbre —
   c'est la fuite documentée dans CLAUDE.md (releaseMediaElements). Un registre
   qui garderait des références fortes recréerait exactement ce qu'on a corrigé.
───────────────────────────────────────────────────────────────────────────── */

const _MEDIA = [];

(function installerRegistreMedia() {
  const proto = window.HTMLMediaElement?.prototype;
  if (!proto || proto.__solimanRegistre || typeof WeakRef !== 'function') return;
  proto.__solimanRegistre = true;
  const jouer = proto.play;
  proto.play = function (...args) {
    try { _MEDIA.push(new WeakRef(this)); } catch { /* sans registre, tant pis */ }
    return jouer.apply(this, args);
  };
})();

export class AudioManager {
  constructor(config) {
    this.config = config;
    this.ctx = null;

    /**
     * LE SON EST UN AGRÉMENT, PAS UNE DÉPENDANCE DE RENDU.
     *
     * Web Audio peut être absent ou refusé : mode Lockdown de Safari,
     * navigateur durci, extension de confidentialité, politique d'entreprise.
     * Quand c'était le cas, `new AudioContext()` levait, l'exception remontait
     * à travers `PhrenologieScene.enter()` (qui `await` startMuseeLoop) et la
     * scène ne s'affichait JAMAIS : ni fond, ni boutons documents, ni flèche.
     * Un écran mort pour une panne de son.
     *
     * Désormais l'indisponibilité est un ÉTAT, pas une exception : getContext()
     * retourne null, chaque méthode sort en silence, et le site se joue muet.
     */
    this._unavailable = false;

    /**
     * Cache de décodage : url → Promise<AudioBuffer>. Sans lui, chaque entrée
     * de scène refaisait fetch + decodeAudioData du même mp3 (plusieurs Mo à
     * décoder, à chaque aller-retour). On mémoïse la PROMESSE, pas le buffer :
     * deux appels concurrents partagent alors le même décodage.
     */
    this._buffers = new Map();

    this.tracks = {
      musee:   { src: null, gain: null },
      phreno:  { src: null, gain: null },
      sanza:   { src: null, gain: null },
      silence: { src: null, gain: null },
      collab:  { src: null, gain: null },
      chp2:    { src: null, gain: null },
    };
  }

  /* ─────────────────────────────────────────── Contexte WebAudio ── */

  /**
   * Le contexte audio, ou `null` s'il est indisponible.
   * NE LÈVE JAMAIS — voir la note de `_unavailable` dans le constructeur.
   * @returns {?AudioContext}
   */
  getContext() {
    if (this._unavailable) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) {
        this._unavailable = true;
        console.warn('[AudioManager] Web Audio indisponible — le site se joue muet.');
        return null;
      }
      try {
        this.ctx = new Ctor();
      } catch (e) {
        this._unavailable = true;
        console.warn('[AudioManager] AudioContext refusé — le site se joue muet.', e);
        return null;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /**
   * Alias explicite utilisé par MediaPlayer pour créer un MediaElementSource
   * (analyse waveform audio). Peut retourner null — l'appelant doit le gérer.
   */
  getAudioContext() {
    return this.getContext();
  }

  /**
   * Charge et décode un son, une seule fois par URL (voir `_buffers`).
   * @returns {Promise<?AudioBuffer>} null si indisponible ou en échec
   */
  loadBuffer(url) {
    const ctx = this.getContext();
    if (!ctx) return Promise.resolve(null);

    const hit = this._buffers.get(url);
    if (hit) return hit;

    const p = (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const arrayBuffer = await response.arrayBuffer();
        return await ctx.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.error('[AudioManager] Load failed:', url, e);
        // Un échec ne se met pas en cache : une coupure réseau passagère ne
        // doit pas condamner le son pour toute la session.
        this._buffers.delete(url);
        return null;
      }
    })();

    this._buffers.set(url, p);
    return p;
  }

  /* ──────────────────────────────────────────────── MuseeLoop ── */

  async startMuseeLoop() {
    const ctx = this.getContext();
    const buf = await this.loadBuffer('sons/MuseeLoop.mp3');
    if (!buf) return;

    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.loop   = true;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(
      this.config.AUDIO.musee_vol,
      ctx.currentTime + this.config.AUDIO.fadeDuration / 1000
    );
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    this.tracks.musee = { src, gain };
  }

  fadeMusee(toVolume, durationMs) {
    const { gain } = this.tracks.musee;
    if (!gain) return;
    const ctx = this.getContext();
    if (!ctx) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(toVolume, ctx.currentTime + durationMs / 1000);
  }

  /**
   * Coupe le gain musée à 0 instantanément (sans fade).
   * Utilisé juste avant la transition page3→2 avec texte tapé,
   * pour être certain que le musée ne déborde pas sur la séquence.
   * Fidèle à main.js : museeGain.gain.setValueAtTime(0, ac.currentTime)
   */
  hardMuseeMute() {
    const { gain } = this.tracks.musee;
    if (!gain) return;
    const ctx = this.getContext();
    if (!ctx) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
  }

  /* ──────────────────────────────────────── S-phrenologie ── */

  async playPhrenoSound() {
    const ctx = this.getContext();
    const A   = this.config.AUDIO;
    const buf = await this.loadBuffer('sons/S-phrenologie.mp3');
    if (!buf) return null;

    this.fadeMusee(0, A.musee_fade);

    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.loop   = false;
    const dur  = buf.duration;

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + A.phren_fade_in / 1000);
    const fadeOutStart = Math.max(A.phren_fade_in / 1000, dur - A.phren_fade_out / 1000);
    gain.gain.setValueAtTime(1.0, ctx.currentTime + fadeOutStart);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);

    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    src.onended = () => {
      if (this.tracks.phreno.src === src) {
        this.tracks.phreno = { src: null, gain: null };
      }
    };

    this.tracks.phreno = { src, gain };
    return src;
  }

  /**
   * ⚠️ NE RÉTABLIT PAS L'AMBIANCE MUSÉE, et c'est le correctif de fond.
   * Cette méthode le faisait (`fadeMusee(musee_vol, …)`), ce qui revenait à
   * décider, depuis l'AudioManager, de ce qu'on entendrait APRÈS — alors que
   * son unique appelant est le chapitre 1, où le musée n'a rien à faire. Les
   * deux seuls appels du chapitre s'écrivaient donc « stopPhrenoSound() ;
   * fadeMusee(0, …) » : couper, puis défaire le rétablissement qu'on venait
   * de provoquer. Chaque scène déclare désormais son ambiance (app.js →
   * AMBIANCE) ; personne d'autre n'a à la deviner.
   */
  stopPhrenoSound() {
    const { src } = this.tracks.phreno;
    if (src) {
      try { src.onended = null; src.stop(); } catch(e) {}
      this.tracks.phreno = { src: null, gain: null };
    }
  }

  /* ──────────────────────────────────────────── SanzaLoop ── */

  async startSanzaLoop() {
    if (this.tracks.sanza.src) return;
    const ctx = this.getContext();
    const buf = await this.loadBuffer('sons/buste.mp3');
    if (!buf) return;

    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.loop   = true;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(
      this.config.AUDIO.sanza_vol,
      ctx.currentTime + this.config.AUDIO.sanza_fade_in / 1000
    );
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    src.onended = () => {
      if (this.tracks.sanza.src === src) this.tracks.sanza = { src: null, gain: null };
    };
    this.tracks.sanza = { src, gain };
  }

  stopSanzaLoop(fadeDurationMs) {
    const { src, gain } = this.tracks.sanza;
    if (!gain) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const ms  = fadeDurationMs ?? this.config.AUDIO.sanza_fade_out;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + ms / 1000);
    // Capture src AVANT reset pour que le setTimeout puisse encore l'arrêter
    this.tracks.sanza = { src: null, gain: null };
    setTimeout(() => { try { src.stop(); } catch(e) {} }, ms + 50);
  }

  /* ─────────────────────────────────────────── SilenceLoop ── */

  async startSilenceLoop() {
    if (this.tracks.silence.src) return;
    const ctx = this.getContext();
    const buf = await this.loadBuffer('Chapitre1/chp1-medias/Silence.mp3');
    if (!buf) return;

    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.loop   = true;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(
      this.config.AUDIO.silence_vol,
      ctx.currentTime + this.config.AUDIO.silence_fade_in / 1000
    );
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    src.onended = () => {
      if (this.tracks.silence.src === src) this.tracks.silence = { src: null, gain: null };
    };
    this.tracks.silence = { src, gain };
  }

  stopSilenceLoop(fadeDurationMs) {
    const { src, gain } = this.tracks.silence;
    if (!gain) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const ms  = fadeDurationMs ?? this.config.AUDIO.silence_fade_out;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + ms / 1000);
    this.tracks.silence = { src: null, gain: null };
    setTimeout(() => { try { src.stop(); } catch(e) {} }, ms + 50);
  }

  /* ──────────────────────────────────────────── CollabLoop ── */

  async startCollabLoop() {
    if (this.tracks.collab.src) return;
    const ctx = this.getContext();
    const buf = await this.loadBuffer('sons/collaboration.mp3');
    if (!buf) return;

    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.loop   = true;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(
      this.config.AUDIO.collab_vol,
      ctx.currentTime + this.config.AUDIO.collab_fade_in / 1000
    );
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    src.onended = () => {
      if (this.tracks.collab.src === src) this.tracks.collab = { src: null, gain: null };
    };
    this.tracks.collab = { src, gain };
  }

  stopCollabLoop(fadeDurationMs) {
    const { src, gain } = this.tracks.collab;
    if (!gain) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const ms  = fadeDurationMs ?? this.config.AUDIO.collab_fade_out;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + ms / 1000);
    this.tracks.collab = { src: null, gain: null };
    setTimeout(() => { try { src.stop(); } catch(e) {} }, ms + 50);
  }

  /* ───────────────────────────────────── Chapitre 2 (fredonnement) ── */

  /**
   * Boucle d'ambiance du chapitre 2 (fredonnement-son.mp3).
   * Idempotente : si la piste joue déjà, ne fait rien → aucun dédoublement
   * possible, même si plusieurs instances du module opening tentent de la
   * démarrer (cache-bust).
   * @param {number} [fadeInMs] durée du fondu d'entrée (défaut config)
   */
  async startChp2Loop(fadeInMs) {
    const vol = this.config.AUDIO.chp2_vol ?? 0.72;
    const ms  = fadeInMs ?? this.config.AUDIO.chp2_fade_in ?? 5000;

    // Déjà en cours (typiquement atténuée pendant une sous-partie) :
    // on se contente de remonter le volume → idempotent, zéro dédoublement.
    if (this.tracks.chp2.src) { this.fadeChp2(vol, ms); return; }

    const ctx = this.getContext();
    const buf = await this.loadBuffer('Chapitre2/chp2-medias/fredonnement-son.mp3');
    if (!buf) return;
    // Garde anti-course : une autre invocation a pu démarrer la piste pendant le await.
    if (this.tracks.chp2.src) { this.fadeChp2(vol, ms); return; }

    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.loop   = true;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + ms / 1000);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    src.onended = () => {
      if (this.tracks.chp2.src === src) this.tracks.chp2 = { src: null, gain: null };
    };
    this.tracks.chp2 = { src, gain };
  }

  /**
   * Rampe le volume de la piste chp2 vers `toVolume` (sans arrêter la source).
   * Sert au duck (entrée sous-partie) / unduck (retour opening).
   */
  fadeChp2(toVolume, durationMs) {
    const { gain } = this.tracks.chp2;
    if (!gain) return;
    const ctx = this.getContext();
    if (!ctx) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(toVolume, ctx.currentTime + durationMs / 1000);
  }

  /** Atténue la piste chp2 à 0 (entrée d'une sous-partie). */
  duckChp2(durationMs = 800) {
    this.fadeChp2(0, durationMs);
  }

  /** Ramène la piste chp2 à son volume nominal (retour vers l'opening). */
  unduckChp2(durationMs = 1200) {
    this.fadeChp2(this.config.AUDIO.chp2_vol ?? 0.72, durationMs);
  }

  /** Fondu de sortie puis arrêt définitif de la piste chp2. Idempotent. */
  stopChp2Loop(fadeDurationMs) {
    const { src, gain } = this.tracks.chp2;
    if (!gain) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const ms  = fadeDurationMs ?? this.config.AUDIO.chp2_fade_out ?? 1600;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + ms / 1000);
    this.tracks.chp2 = { src: null, gain: null };
    setTimeout(() => { try { src.stop(); } catch(e) {} }, ms + 50);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     LE SILENCE DE FRONTIÈRE
     ───────────────────────────────────────────────────────────────────────
     LE PROBLÈME. Chaque scène coupait les sons qu'elle croyait avoir posés,
     et supposait où elle allait. PhrenologieScene.exit() ne touchait pas au
     musée : elle savait que la scène suivante le baisserait. Vrai tant qu'on
     n'allait qu'à la vitrine ou à l'espace collaboratif ; faux le jour où la
     CARTE a permis d'aller de la phrénologie au chapitre 3. Mesuré au banc
     (probe-audio) : le musée jouait à plein volume par-dessus le chapitre 3
     ET le chapitre 4, et la voix d'introduction du chapitre 1 débordait sur
     le chapitre 2. Cinq chemins testés, cinq fuites.

     LA RÈGLE. Une scène ne décide plus de ce qu'on entendra ailleurs : elle
     DÉCLARE ce qu'on entend chez elle (app.js → AMBIANCE), et la frontière
     coupe tout le reste. C'est le pendant sonore du noir garanti : entre deux
     scènes, l'écran est noir ET le silence est fait.

     LA CONTINUITÉ N'EST PAS PERDUE. Le musée est déclaré par la vitrine, la
     phrénologie ET l'espace collaboratif (qui l'atténue à zéro en entrant et
     le rétablit en partant) : il traverse donc le tronc commun sans coupure,
     exactement comme avant. Aucun chapitre ne le déclare : il s'arrête net
     quand on entre dans un chapitre, quel que soit le chemin emprunté.
  ═══════════════════════════════════════════════════════════════════════ */

  /** Fondu de sortie de frontière : assez court pour être inaudible dans le
      noir, assez long pour qu'aucune piste ne se coupe sur un « clic ». */
  static get FRONTIERE_MS() { return 260; }

  /**
   * Arrête une piste centrale par son nom. Générique : les six pistes ont la
   * même forme ({src, gain}), il n'y avait aucune raison d'avoir six stopXxx
   * presque identiques pour ce besoin-ci.
   * @returns {boolean} true si une piste jouait réellement
   */
  _stopTrack(nom, ms = AudioManager.FRONTIERE_MS) {
    const piste = this.tracks[nom];
    if (!piste || !piste.src) return false;

    const { src, gain } = piste;
    this.tracks[nom] = { src: null, gain: null };

    const ctx = this.getContext();
    if (ctx && gain) {
      try {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + ms / 1000);
      } catch { /* contexte fermé : la source est arrêtée juste après */ }
    }
    setTimeout(() => { try { src.onended = null; src.stop(); } catch { /* déjà finie */ } }, ms + 50);
    return true;
  }

  /**
   * Coupe toutes les pistes centrales SAUF celles nommées.
   * @param {string|string[]} garder
   * @returns {string[]} les pistes réellement coupées
   */
  keepOnly(garder = [], ms = AudioManager.FRONTIERE_MS) {
    const gardees = new Set([].concat(garder).filter(Boolean));
    const coupees = [];
    for (const nom of Object.keys(this.tracks)) {
      if (gardees.has(nom)) continue;
      if (this._stopTrack(nom, ms)) coupees.push(nom);
    }
    return coupees;
  }

  /**
   * Met en pause tout <audio>/<video> encore en lecture (voir le registre en
   * tête de fichier). Les modules de chapitre restent responsables de leurs
   * médias — ceci est un filet, pas une dispense : d'où l'avertissement.
   * @returns {string[]} noms de fichiers des médias trouvés en lecture
   */
  silenceMedia() {
    const fautifs = [];
    const vivants = [];
    for (const ref of _MEDIA) {
      const el = ref.deref();
      if (!el) continue;                       // ramassé par le GC : rien à faire
      vivants.push(ref);
      if (el.paused || el.ended) continue;
      try { el.pause(); } catch { /* élément déjà démonté */ }
      fautifs.push((el.currentSrc || el.src || '?').split('/').pop());
    }
    _MEDIA.length = 0;
    _MEDIA.push(...vivants);
    return fautifs;
  }

  /**
   * LA GARANTIE. Appelée par app.js dans le noir, entre exit() et enter().
   * @param {string[]} garder  pistes que la scène qui ARRIVE conserve
   */
  enforceSilence(garder = []) {
    this.keepOnly(garder);
    const fautifs = this.silenceMedia();
    if (fautifs.length) {
      console.warn(
        '[AudioManager] Média(s) encore en lecture au changement de scène, ' +
        'coupé(s) ici par sécurité : ' + fautifs.join(', ') +
        '. Le module qui les a ouverts devrait les arrêter lui-même.'
      );
    }
  }

  /* ───────────────────────────────────────────────── Utilitaire ── */

  stopAll() {
    this.keepOnly([]);
    this.silenceMedia();
  }
}
