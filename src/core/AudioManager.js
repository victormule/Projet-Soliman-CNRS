/**
 * AudioManager.js
 * Gestion centralisée de tous les sons du site.
 *
 * CORRECTIONS vs version initiale :
 * - hardMuseeMute() ajouté (transition page3→2 avec texte)
 * - getAudioContext() exposé (nécessaire pour MediaPlayer waveform)
 * - stopSanzaLoop / stopSilenceLoop / stopCollabLoop : capture src avant reset
 *   pour éviter que setTimeout referenceune valeur déjà nullifiée
 */

export class AudioManager {
  constructor(config) {
    this.config = config;
    this.ctx = null;

    this.tracks = {
      musee:   { src: null, gain: null },
      phreno:  { src: null, gain: null },
      sanza:   { src: null, gain: null },
      silence: { src: null, gain: null },
      collab:  { src: null, gain: null },
    };
  }

  /* ─────────────────────────────────────────── Contexte WebAudio ── */

  getContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  /**
   * Alias explicite utilisé par MediaPlayer pour créer un MediaElementSource
   * (analyse waveform audio).
   */
  getAudioContext() {
    return this.getContext();
  }

  async loadBuffer(url) {
    const ctx = this.getContext();
    try {
      const response    = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return await ctx.decodeAudioData(arrayBuffer);
    } catch(e) {
      console.error('[AudioManager] Load failed:', url, e);
      return null;
    }
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

  stopPhrenoSound() {
    const { src } = this.tracks.phreno;
    if (src) {
      try { src.onended = null; src.stop(); } catch(e) {}
      this.tracks.phreno = { src: null, gain: null };
    }
    this.fadeMusee(this.config.AUDIO.musee_vol, this.config.AUDIO.musee_fade);
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
    const buf = await this.loadBuffer('Collaboration/Chapitre1/Silence.mp3');
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
    const ms  = fadeDurationMs ?? this.config.AUDIO.collab_fade_out;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + ms / 1000);
    this.tracks.collab = { src: null, gain: null };
    setTimeout(() => { try { src.stop(); } catch(e) {} }, ms + 50);
  }

  /* ───────────────────────────────────────────────── Utilitaire ── */

  stopAll() {
    this.stopPhrenoSound();
    this.stopSanzaLoop();
    this.stopSilenceLoop();
    this.stopCollabLoop();
  }
}
