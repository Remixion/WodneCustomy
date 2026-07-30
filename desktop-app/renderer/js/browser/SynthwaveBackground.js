/* Animowane synthwave tło (słońce + siatka w perspektywie) - 1:1 port drawBg/sizeBg/noise z Match Browser.dc.html, jako samodzielny komponent React zamiast metod na głównej klasie. */
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
    const ctx = b.ctx, w = b.w, h = b.h;
    const horizon = h * 0.40;
    ctx.setTransform(b.dpr, 0, 0, b.dpr, 0, 0);
    ctx.fillStyle = "#070510"; ctx.fillRect(0, 0, w, h);
    const T = 9, prog = (t % T) / T;
    const zoom = Math.pow(3.4, prog);
    const edge = Math.min(prog, 1 - prog);
    const fade = Math.min(1, edge / 0.12);
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#070510"); sky.addColorStop(.55, "#12103e"); sky.addColorStop(1, "#2a2470");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon);
    for (let i = 0; i < 60; i++) { const sx = (this.noise(i, 7) * .5 + .5) * w, sy = (this.noise(i, 3) * .5 + .5) * horizon * .8; const a = .18 + .35 * Math.abs(Math.sin(t * 1.5 + i)); ctx.fillStyle = "rgba(150,190,255," + a.toFixed(2) + ")"; ctx.fillRect(sx, sy, 1.3, 1.3); }
    const cx = w * 0.5, cy = horizon, rad = Math.min(w * 0.14, horizon * 0.72);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rad, Math.PI, 2 * Math.PI); ctx.closePath(); ctx.clip();
    const sun = ctx.createLinearGradient(0, cy - rad, 0, cy);
    sun.addColorStop(0, "#7df9ff"); sun.addColorStop(.5, "#38bdf8"); sun.addColorStop(1, "#2563eb");
    ctx.fillStyle = sun; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad);
    ctx.fillStyle = "#070510";
    for (let i = 0; i < 7; i++) { const by = cy - rad * 0.5 + i * (rad * 0.5 / 7) + (i * 1.2); ctx.fillRect(cx - rad, by, rad * 2, 2 + i * 1.3); }
    ctx.restore();
    ctx.globalCompositeOperation = "lighter";
    const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * 2);
    gg.addColorStop(0, "rgba(80,190,255,.3)"); gg.addColorStop(1, "rgba(80,190,255,0)");
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, rad * 2, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    const sea = ctx.createLinearGradient(0, horizon, 0, h);
    sea.addColorStop(0, "#0a1a55"); sea.addColorStop(.5, "#06103a"); sea.addColorStop(1, "#04081c");
    ctx.fillStyle = sea; ctx.fillRect(0, horizon, w, h - horizon);
    ctx.globalCompositeOperation = "lighter";
    const hg = ctx.createLinearGradient(0, horizon - 8, 0, horizon + 8);
    hg.addColorStop(0, "rgba(80,190,255,0)"); hg.addColorStop(.5, "rgba(120,240,255,.55)"); hg.addColorStop(1, "rgba(80,190,255,0)");
    ctx.fillStyle = hg; ctx.fillRect(0, horizon - 8, w, 16);
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(90,200,255,.45)"; ctx.shadowColor = "rgba(90,200,255,.7)"; ctx.shadowBlur = 6;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(cx, horizon); ctx.scale(zoom, zoom); ctx.translate(-cx, -horizon);
    const rows = 26;
    for (let i = 0; i < rows; i++) {
      const p = i / rows, y = horizon + Math.pow(p, 1.9) * (h - horizon), amp = 1 + p * p * 12;
      ctx.lineWidth = 0.6 + p * 1.6; ctx.globalAlpha = (0.2 + p * 0.5) * fade;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) { const yv = y + Math.sin(x * 0.02 + t * (0.6 + p) + i) * amp * 0.6; x === 0 ? ctx.moveTo(x, yv) : ctx.lineTo(x, yv); }
      ctx.stroke();
    }
    const cols = 26;
    for (let i = -cols; i <= cols; i++) {
      const fx = cx + (i / cols) * w * 1.3;
      ctx.globalAlpha = (0.10 + 0.22 * (1 - Math.abs(i) / cols)) * fade; ctx.lineWidth = 0.6 + (1 - Math.abs(i) / cols) * 1.2;
      ctx.beginPath(); ctx.moveTo(cx, horizon); ctx.lineTo(fx, h); ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 70; i++) {
      const p = i / 70, y = horizon + Math.pow(p, 1.8) * (h - horizon), spread = 4 + p * (w * 0.18);
      const off = Math.sin(i * 1.9 + t * (1 + p * 2)) * spread, a = (1 - Math.abs(off) / (spread + 1)) * (0.18 + p * 0.4);
      if (a > 0) { ctx.fillStyle = "rgba(120,235,255," + a.toFixed(3) + ")"; ctx.fillRect(cx + off, y, 2 + p * 4, 1.3 + p * 2); }
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
