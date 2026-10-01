/**
 * CarnetScene.js — le carnet de recherche.
 * -----------------------------------------------------------------------------
 * On y entre par la barre de navigation de la phrénologie (« Carnet de
 * Recherche »), ou par la carte. Fond noir ; un grand rectangle blanc se TRACE
 * au milieu, et le carnet (hypotheses.org) paraît dedans, aux sept dixièmes du
 * trait. C'est le geste des documents de la phrénologie (DocumentOverlay) —
 * d'abord le cadre, ensuite ce qu'il contient — mais en pleine largeur : on
 * ne regarde pas une pièce, on lit un site.
 *
 * POURQUOI PAS DocumentOverlay LUI-MÊME. Il est taillé pour la phrénologie :
 * une colonne de légende à gauche, une gouttière à droite pour les boutons
 * documents, et un clic n'importe où qui REFERME. Ici il n'y a rien à
 * refermer — le carnet EST la scène — et les deux colonnes mangeraient la
 * largeur qu'on vient chercher. On reprend l'idiome (rectangle tracé en pixels
 * réels, `.doc-ov-rect`), pas l'objet.
 *
 * EMPILEMENT : #carnet-root en z 7, comme #doc-overlay — sous la flèche (10),
 * les titres et le plein écran (15), la boussole (16). Rien à remonter.
 *
 * Réglages : config.js → CARNET.
 */

import { Scene }       from '../core/Scene.js';
import { bus }         from '../core/EventBus.js';
import { ArrowCarnet } from '../ui/ArrowCarnet.js';

const ROOT_ID = 'carnet-root';

export class CarnetScene extends Scene {
  constructor(systems) {
    super('carnet');
    this.audio = systems.audio;
    this.torch = systems.torch;

    this._arrow = new ArrowCarnet(window.CONFIG);

    this.root  = null;
    this.frame = null;
    /** Le rectangle : 'attente' (pas encore tracé), 'en-cours', 'pose'. */
    this._trait = 'attente';
    this._perim = 0;
  }

  /** La flèche de cette scène — un départ l'efface et la rend inaccessible. */
  arrows() { return [this._arrow]; }

  async enter(params = {}) {
    await super.enter(params);
    const C  = window.CONFIG.CARNET;
    const t0 = Date.now();
    this._navigationActive = false;

    try {
      /* La torche reste éteinte : le noir de la scène, c'est elle à rayon nul.
         On ne la recentre pas — elle n'a rien à éclairer ici. */
      this.torch.cancelGrow();
      this.torch.cancelFade();
      this.torch.setRadius(0);

      /* Le musée : la scène est une sœur de l'espace collaboratif sous la
         phrénologie, elle garde l'ambiance du tronc commun (déclarée dans
         LIEUX). Arrivé d'un chapitre par la carte, la boucle a été coupée à
         la frontière : on la relance, comme la phrénologie. */
      if (!this.audio.tracks.musee.src) {
        // Pas attendu : le son est un agrément, jamais une condition d'entrée.
        this.audio.startMuseeLoop().catch(() => {});
      } else {
        this.audio.fadeMusee(window.CONFIG.AUDIO.musee_vol, 800);
      }

      this._monter(C);
      this._poser();

      await this._waitUntil(t0, C.cadre.trace_at);
      this._tracer(C.cadre.trace_ms);

      await this._waitUntil(t0, C.arrow.appear_at);
      this._arrow.show(() => {
        if (this._navigationActive) this.leaveTo('phrenologie');
      });

      await this.pause(C.arrow.draw_duration);
      this._navigationActive = true;
      this.announceEntered();
    } catch {
      // Entrée interrompue (départ par la carte) : exit() défait le reste.
    }
  }

  async exit(params = {}) {
    this._navigationActive = false;
    await super.exit(params);
    this._arrow.hide();

    /* LA SORTIE EST UN GESTE : le carnet s'efface et le cadre se DÉ-TRACE,
       comme il est venu. On attend la fin avant de démonter : le noir est
       alors garanti — il n'y a plus rien d'autre à l'écran. */
    const ms = window.CONFIG.CARNET.cadre.sortie_ms;
    if (this.root) {
      this.root.classList.remove('in');
      this._detracer(ms);
      await this._rawWait(ms + 60);
    }
    this._demonter();

    bus.emit('scene:exited', { name: 'carnet' });
  }

  onResize() {
    this._arrow.resize();
    this._poser();
  }

  /* ── Le DOM ─────────────────────────────────────────────────────────── */

  _monter(C) {
    this._demonter();
    const app = document.getElementById('app');
    if (!app) return;

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="carnet-cadre">
        <svg class="doc-ov-frame-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect class="doc-ov-rect" x="0.5" y="0.5"/>
        </svg>
      </div>
      <a class="carnet-lien" target="_blank" rel="noopener noreferrer" data-clickable="true"></a>`;

    const lien = root.querySelector('.carnet-lien');
    lien.href        = C.url;
    lien.textContent = C.lien;

    /* L'incrustation. Chargée TOUT DE SUITE, derrière le trait : quand le
       rectangle se referme, le site a eu une seconde et demie pour arriver.

       ⚠️ `sandbox` SANS `allow-top-navigation` : un lien du carnet qui
       viserait la fenêtre entière (`target="_top"`) ferait QUITTER
       l'expérience — plein écran, son, parcours, tout. Il est bloqué ; les
       liens ordinaires naviguent dans le cadre, et ceux qui ouvrent un onglet
       l'ouvrent (allow-popups). */
    const iframe = document.createElement('iframe');
    iframe.className = 'carnet-site';
    iframe.src = C.url;
    iframe.title = C.titre;
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.setAttribute('allow', 'fullscreen');
    iframe.setAttribute('sandbox',
      'allow-scripts allow-same-origin allow-forms allow-popups ' +
      'allow-popups-to-escape-sandbox allow-presentation');
    root.querySelector('.carnet-cadre').appendChild(iframe);

    app.appendChild(root);
    this.root  = root;
    this.frame = root.querySelector('.carnet-cadre');
  }

  _demonter() {
    // Vider la source avant de retirer : le site distant cesse tout de suite
    // (vidéos, minuteries), sans attendre que le ramasse-miettes s'en charge.
    const iframe = this.root?.querySelector('iframe');
    if (iframe) iframe.src = 'about:blank';
    this.root?.remove();
    this.root = this.frame = null;
    this._trait = 'attente';
  }

  /* ── La place ───────────────────────────────────────────────────────── */

  /**
   * Pose le cadre et le lien aux dimensions du viewport. Rappelé au
   * redimensionnement : le trait suit la nouvelle taille dans l'état où il
   * est (à venir, ou posé) — sauf pendant son tracé, qu'on ne repose pas
   * (cf. chp5-visionneuse : le reposer « net » coupait le trait au départ).
   */
  _poser() {
    if (!this.frame) return;
    const C  = window.CONFIG.CARNET.cadre;
    const M  = window.CONFIG.MIN_SIZE;
    const vW = Math.max(M.width,  window.innerWidth);
    const vH = Math.max(M.height, window.innerHeight);

    // La bande du bas : celle de la flèche (bas-gauche) et du plein écran
    // (bas-droite), mêmes marge et taille que les leurs.
    const sz     = this._arrow._getSizePx();
    const marge  = Math.round(Math.min(vW, vH) * 0.05);
    const bas    = marge + sz + C.bas_marge;

    const w   = Math.round(vW * C.largeur);
    const top = Math.round(vH * C.haut);
    const h   = Math.max(80, vH - top - bas);

    Object.assign(this.frame.style, {
      left:   Math.round((vW - w) / 2) + 'px',
      top:    top + 'px',
      width:  w + 'px',
      height: h + 'px',
    });

    // Le lien, centré dans la bande, à la hauteur du centre de la flèche.
    const lien = this.root.querySelector('.carnet-lien');
    lien.style.bottom = Math.round(marge + sz / 2) + 'px';

    const svg  = this.frame.querySelector('svg');
    const rect = this.frame.querySelector('rect');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    rect.setAttribute('width',  Math.max(1, w - 1));
    rect.setAttribute('height', Math.max(1, h - 1));
    this._perim = 2 * (w + h);
    if (this._trait === 'en-cours') return;
    rect.style.transition       = 'none';
    rect.style.strokeDasharray  = String(this._perim);
    rect.style.strokeDashoffset = this._trait === 'pose' ? '0' : String(this._perim);
  }

  /** Le trait court, puis le carnet paraît dedans aux 7/10. */
  _tracer(ms) {
    const rect = this.frame?.querySelector('rect');
    if (!rect) return;
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduit) {
      this._trait = 'pose';
      rect.style.strokeDashoffset = '0';
      this.root.classList.add('in');
      return;
    }

    this._trait = 'en-cours';
    rect.style.strokeDasharray  = String(this._perim);
    rect.style.strokeDashoffset = String(this._perim);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      rect.style.transition       = `stroke-dashoffset ${ms}ms cubic-bezier(0.4,0,0.2,1)`;
      rect.style.strokeDashoffset = '0';
    }));
    this.addTimer(() => this.root?.classList.add('in'), ms * 0.7);
    this.addTimer(() => { this._trait = 'pose'; }, ms + 60);
  }

  /** Le trait se rembobine (sortie). */
  _detracer(ms) {
    const rect = this.frame?.querySelector('rect');
    if (!rect || !this._perim) return;
    rect.style.transition       = `stroke-dashoffset ${ms}ms cubic-bezier(0.4,0,0.2,1)`;
    rect.style.strokeDashoffset = String(this._perim);
  }
}
