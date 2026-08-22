/* Animowane synthwave tło (słońce + siatka w perspektywie) - 1:1 port drawBg/sizeBg/noise z Match Browser.dc.html, jako samodzielny komponent React zamiast metod na głównej klasie.
   Kolorystyka jest parametryzowana (props.palette) - domyślnie niebieska (jak w oryginale), ale
   na profilu gracza App.js podaje paletę wyprowadzoną z motywu jego stworka (patrz
   backgroundPaletteForRoute w MonsterEditor.js), żeby tło dopasowało się do bestii tego gracza. */

const SYNTHBG_DEFAULT_PALETTE = {
  skyTop: "#070510", skyMid: "#12103e", skyBottom: "#2a2470",
  sunTop: "#7df9ff", sunMid: "#38bdf8", sunBottom: "#2563eb",
  glow: "#50beff",
  seaTop: "#0a1a55", seaMid: "#06103a", seaBottom: "#04081c",
  grid: "#5ac8ff", star: "#96beff", particle: "#78ebff", horizonGlow: "#78f0ff"
};

/** "#rrggbb" -> "r,g,b" (do budowania rgba(...) ze zmiennym kanałem alfa) - przy nieprawidłowym wejściu wraca do domyślnego niebieskiego akcentu. */
function synthbgHexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  return m ? (parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16)) : "90,200,255";
}

class SynthwaveBackground extends React.Component {
  constructor(props) {
    super(props);
    this.cvRef = React.createRef();
  }

  componentDidMount() {
    const setup = () => {
      const cv = this.cvRef.current;
      if (!cv) { requestAnimationFrame(setup); return; }
      this.bg = { cv, ctx: cv.getContext("2d"), dpr: Math.min(2, window.devicePixelRatio || 1), w: 0, h: 0 };
      this._onResize = () => this.sizeBg();
      window.addEventListener("resize", this._onResize);
      this.sizeBg();
      this._t0 = performance.now();
      const loop = (now) => { this.drawBg((now - this._t0) / 1000); this._raf = requestAnimationFrame(loop); };
      this._raf = requestAnimationFrame(loop);
    };
    setup();
  }

  componentWillUnmount() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener("resize", this._onResize);
  }

  sizeBg() {
    const b = this.bg; if (!b) return;
    b.w = window.innerWidth; b.h = window.innerHeight;
    b.cv.width = b.w * b.dpr; b.cv.height = b.h * b.dpr;
    b.ctx.setTransform(b.dpr, 0, 0, b.dpr, 0, 0);
  }

  noise(x, y) { return Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1; }

  drawBg(t) {
    const b = this.bg; if (!b || !b.w) return;
    // Egzekwowanie "profil z przypisaną piosenką = pod żadnym pozorem nie gra główny motyw" na
    // KAŻDEJ klatce (nie tylko w konkretnych miejscach jak onLoadedMetadata/ensureBgAudioPlaying,
    // które mogą się rozminąć w czasie z nawigacją) - samonaprawiający się bezpiecznik: nawet
    // gdyby coś inne zdążyło uruchomić motyw, w ciągu jednej klatki (~16ms) zostaje zapauzowany.
    if (this.props.audioApp) {
      const bgEl = this.props.audioApp.audioRef && this.props.audioApp.audioRef.current;
      if (bgEl && !bgEl.paused && typeof currentProfileHasSong === "function" && currentProfileHasSong(this.props.audioApp)) bgEl.pause();
    }
    const pal = Object.assign({}, SYNTHBG_DEFAULT_PALETTE, this.props.palette || {});
    const glowRgb = synthbgHexToRgb(pal.glow), gridRgb = synthbgHexToRgb(pal.grid);
    const starRgb = synthbgHexToRgb(pal.star), particleRgb = synthbgHexToRgb(pal.particle);
    const horizonGlowRgb = synthbgHexToRgb(pal.horizonGlow);
    // Tło "pulsuje" w rytm muzyki w tle - patrz readBgAudioLevels w Audio.js. {level:0,bass:0}
    // (czyli brak efektu) dopóki analizator nie jest jeszcze podpięty (przed pierwszą interakcją
    // ze stroną - patrz komentarz przy setupBgAnalyser), więc siatka nigdy nie wygląda "zepsuta"
    // w tym okresie, tylko statycznie jak wcześniej. Surowe wartości z FFT skaczą klatka po
    // klatce nawet z wygładzaniem samego analizatora (smoothingTimeConstant) - tu dodatkowo
    // "ease'ujemy" je do płynnego pulsu (wykładnicza średnia krocząca), zamiast szarpać rozmiarem
    // słońca/siatki bezpośrednio surowym sygnałem.
    const rawLevels = (this.props.audioApp && typeof readBgAudioLevels === "function") ? readBgAudioLevels(this.props.audioApp) : { level: 0, bass: 0 };
    if (this._smoothLevel == null) { this._smoothLevel = 0; this._smoothBass = 0; }
    this._smoothLevel += (rawLevels.level - this._smoothLevel) * 0.06;
    this._smoothBass += (rawLevels.bass - this._smoothBass) * 0.06;
    const levels = { level: this._smoothLevel, bass: this._smoothBass };
    const ctx = b.ctx, w = b.w, h = b.h;
    const horizon = h * 0.40;
    ctx.setTransform(b.dpr, 0, 0, b.dpr, 0, 0);
    ctx.fillStyle = pal.skyTop; ctx.fillRect(0, 0, w, h);
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, pal.skyTop); sky.addColorStop(.55, pal.skyMid); sky.addColorStop(1, pal.skyBottom);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon);
    for (let i = 0; i < 60; i++) { const sx = (this.noise(i, 7) * .5 + .5) * w, sy = (this.noise(i, 3) * .5 + .5) * horizon * .8; const a = .18 + .35 * Math.abs(Math.sin(t * 1.5 + i)); ctx.fillStyle = "rgba(" + starRgb + "," + a.toFixed(2) + ")"; ctx.fillRect(sx, sy, 1.3, 1.3); }
    const cx = w * 0.5, cy = horizon, rad = Math.min(w * 0.14, horizon * 0.72) * (1 + levels.bass * 0.07);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rad, Math.PI, 2 * Math.PI); ctx.closePath(); ctx.clip();
    const sun = ctx.createLinearGradient(0, cy - rad, 0, cy);
    sun.addColorStop(0, pal.sunTop); sun.addColorStop(.5, pal.sunMid); sun.addColorStop(1, pal.sunBottom);
    ctx.fillStyle = sun; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad);
    ctx.fillStyle = pal.skyTop;
    for (let i = 0; i < 7; i++) { const by = cy - rad * 0.5 + i * (rad * 0.5 / 7) + (i * 1.2); ctx.fillRect(cx - rad, by, rad * 2, 2 + i * 1.3); }
    ctx.restore();
    ctx.globalCompositeOperation = "lighter";
    const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * 2);
    gg.addColorStop(0, "rgba(" + glowRgb + "," + Math.min(0.95, 0.3 + levels.level * 0.7).toFixed(2) + ")"); gg.addColorStop(1, "rgba(" + glowRgb + ",0)");
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, rad * 2, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    const sea = ctx.createLinearGradient(0, horizon, 0, h);
    sea.addColorStop(0, pal.seaTop); sea.addColorStop(.5, pal.seaMid); sea.addColorStop(1, pal.seaBottom);
    ctx.fillStyle = sea; ctx.fillRect(0, horizon, w, h - horizon);
    ctx.globalCompositeOperation = "lighter";
    const hg = ctx.createLinearGradient(0, horizon - 8, 0, horizon + 8);
    hg.addColorStop(0, "rgba(" + glowRgb + ",0)"); hg.addColorStop(.5, "rgba(" + horizonGlowRgb + "," + Math.min(1, 0.55 + levels.level * 0.5).toFixed(2) + ")"); hg.addColorStop(1, "rgba(" + glowRgb + ",0)");
    ctx.fillStyle = hg; ctx.fillRect(0, horizon - 8, w, 16);
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(" + gridRgb + ",.45)";
    // Poświatę siatki dawniej dawał ctx.shadowBlur (promień zależny od basu, więc zmieniający się
    // co klatkę) - canvas shadowBlur jest dramatycznie wolniejszy na Firefoksie niż na Chrome
    // (brak tych samych skrótów przyspieszających co w Chromium, a zmienny promień uniemożliwia
    // jakiekolwiek cache'owanie) i przy ~80 stroke() na klatkę to była główna przyczyna lagów.
    // Zamiennik: ta sama ścieżka odrysowana dwa razy - raz szeroko i blado (poświata), raz
    // normalnie (ostra kreska) - wizualnie zbliżony efekt, zero shadowBlur, dużo taniej wszędzie.
    const glowAlphaMul = Math.min(1, 0.35 + levels.bass * 0.65);
    ctx.save();
    const T = 13;
    const rows = 26;
    const gridPulse = 1 + levels.bass * 1.3;
    for (let i = 0; i < rows; i++) {
      // Dawniej cała siatka zoomowała się wspólnie i co T sekund twardo wracała do startu (stąd
      // przygaszanie, żeby zamaskować skok). Teraz każdy rząd ma własną, przesuniętą w fazie
      // "głębokość" p (0..1), płynnie zawijaną modulo - rząd zawija się osobno, tuż przy
      // horyzoncie, gdzie i tak jest najcieńszy i najbledszy (p≈0), więc zawinięcie jest
      // niezauważalne - żadnego globalnego przeskoku ani przygaszania całej siatki.
      const p = ((i / rows) + (t / T)) % 1;
      const y = horizon + Math.pow(p, 1.9) * (h - horizon), amp = 1 + p * p * 12;
      const lw = 0.6 + p * 1.6, alpha = Math.min(1, (0.2 + p * 0.5) * gridPulse);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) { const yv = y + Math.sin(x * 0.02 + t * (0.6 + p) + i) * amp * 0.6; x === 0 ? ctx.moveTo(x, yv) : ctx.lineTo(x, yv); }
      ctx.lineWidth = lw * 3; ctx.globalAlpha = alpha * glowAlphaMul * 0.35; ctx.stroke();
      ctx.lineWidth = lw; ctx.globalAlpha = alpha; ctx.stroke();
    }
    const cols = 26;
    for (let i = -cols; i <= cols; i++) {
      const fx = cx + (i / cols) * w * 1.3;
      // Boczne linie zbiegające do słońca nie "jeżdżą" w głąb jak rzędy - stoją w miejscu, tylko
      // subtelnie pulsują jasnością (czysto kosmetyczne, funkcja sinus - z natury bez przeskoków).
      const alpha = Math.min(1, ((0.10 + 0.22 * (1 - Math.abs(i) / cols)) + Math.sin(t * 0.4 + i * 0.3) * 0.04) * gridPulse);
      const lw = 0.6 + (1 - Math.abs(i) / cols) * 1.2;
      ctx.beginPath(); ctx.moveTo(cx, horizon); ctx.lineTo(fx, h);
      ctx.lineWidth = lw * 3; ctx.globalAlpha = alpha * glowAlphaMul * 0.35; ctx.stroke();
      ctx.lineWidth = lw; ctx.globalAlpha = alpha; ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 70; i++) {
      const p = i / 70, y = horizon + Math.pow(p, 1.8) * (h - horizon), spread = 4 + p * (w * 0.18);
      const off = Math.sin(i * 1.9 + t * (1 + p * 2)) * spread, a = (1 - Math.abs(off) / (spread + 1)) * (0.18 + p * 0.4);
      if (a > 0) { ctx.fillStyle = "rgba(" + particleRgb + "," + a.toFixed(3) + ")"; ctx.fillRect(cx + off, y, 2 + p * 4, 1.3 + p * 2); }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  render() {
    return React.createElement("canvas", {
      ref: this.cvRef,
      style: { position: "fixed", inset: 0, width: "100vw", height: "100vh", zIndex: 0, pointerEvents: "none" }
    });
  }
}
