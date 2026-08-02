/* Strona Ustawienia - reskin starego settings.html/settings.js pod ten sam system designu co Przeglądarka
   meczy (theme()/SynthwaveBackground z helpers.js/widgets.js, ta sama czcionka i paleta). To osobna strona
   (nie widok w hash-routingu index.html) - tak jak import.html/players.html, config/admin zostaje poza SPA. */

/** Ta sama domyślna głośność 50% i ten sam klucz localStorage co muzyka w tle w Audio.js (js/browser/Audio.js) - settings.html nie ładuje tego pliku (niepotrzebny tu reszty jego logiki), stąd mała, samodzielna kopia tej jednej funkcji. */
function loadSettingsVolume() { try { const v = parseFloat(localStorage.getItem("wcVol")); return isFinite(v) ? v : 0.5; } catch (e) { return 0.5; } }

class SettingsApp extends React.Component {
  state = {
    loaded: false,
    appsScriptUrl: "", sharedSecret: "", autoSync: false,
    dataDir: "", customLockfilePath: "",
    discordClientId: "", discordBotToken: "", discordGuildId: "",
    roflFolderPath: "", legacyJsonFolderPath: "",
    testResult: null, discordConnectResult: null, discordBotResult: null,
    toast: null,
    audioPlaying: false, audioVolume: loadSettingsVolume(), audioCurrent: 0, audioDuration: 0
  };

  audioTrackRef = React.createRef();
  vizCanvasRef = React.createRef();

  async componentDidMount() {
    const cfg = await window.api.config.get();
    this.setState({
      loaded: true,
      appsScriptUrl: cfg.appsScriptUrl || "", sharedSecret: cfg.sharedSecret || "", autoSync: !!cfg.autoSync,
      dataDir: cfg.dataDir || "", customLockfilePath: cfg.customLockfilePath || "",
      discordClientId: cfg.discordClientId || "", discordBotToken: cfg.discordBotToken || "", discordGuildId: cfg.discordGuildId || "",
      roflFolderPath: cfg.roflFolderPath || "", legacyJsonFolderPath: cfg.legacyJsonFolderPath || ""
    });
  }

  componentWillUnmount() {
    this._playing = false;
    if (this._vizRaf) cancelAnimationFrame(this._vizRaf);
    if (this._audioCtx) { try { this._audioCtx.close(); } catch (e) {} }
  }

  /** Web Audio (AnalyserNode) do wizualizacji słupków częstotliwości - tworzony raz, leniwie, przy pierwszym odtworzeniu (przeglądarki wymagają gestu użytkownika do AudioContext). createMediaElementSource można wywołać na danym <audio> tylko raz. */
  setupAudioGraph() {
    if (this._analyser) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this._audioCtx = new AudioCtx();
    const source = this._audioCtx.createMediaElementSource(this.audioTrackRef.current);
    this._analyser = this._audioCtx.createAnalyser();
    this._analyser.fftSize = 128;
    source.connect(this._analyser);
    this._analyser.connect(this._audioCtx.destination);
    this._freqData = new Uint8Array(this._analyser.frequencyBinCount);
  }

  toggleTrackPlay() {
    const el = this.audioTrackRef.current; if (!el) return;
    if (this.state.audioPlaying) {
      el.pause();
      this._playing = false;
      this.setState({ audioPlaying: false });
      if (this._vizRaf) cancelAnimationFrame(this._vizRaf);
      return;
    }
    this.setupAudioGraph();
    if (this._audioCtx.state === "suspended") this._audioCtx.resume();
    el.volume = this.state.audioVolume;
    const pr = el.play();
    (pr && pr.then ? pr : Promise.resolve()).then(() => {
      this._playing = true;
      this.setState({ audioPlaying: true });
      this.drawViz();
    }).catch(() => this.toast("Nie udało się odtworzyć", true));
  }

  /**
   * Rysuje słupki widma - czyste canvas API bez setState (setState idzie tylko z ontimeupdate
   * <audio>, dużo rzadziej niż 60fps). Kontynuacja pętli sprawdza this._playing (zwykłe pole
   * instancji), NIE this.state.audioPlaying - React batchuje setState nawet w mikrotaskach
   * (promise .then), więc odczyt stanu tuż po jego ustawieniu w tym samym ticku widziałby wciąż
   * starą wartość i pętla rAF obrywałaby się po jednej klatce.
   */
  drawViz() {
    const cv = this.vizCanvasRef.current;
    if (!cv || !this._analyser) return;
    const ctx = cv.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 300, hgt = cv.clientHeight || 64;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    this._analyser.getByteFrequencyData(this._freqData);
    const t = this.theme();
    const n = this._freqData.length;
    const barW = w / n;
    for (let i = 0; i < n; i++) {
      const v = this._freqData[i] / 255;
      const barH = Math.max(2, v * hgt);
      ctx.globalAlpha = 0.35 + v * 0.65;
      ctx.fillStyle = t.accent;
      ctx.fillRect(i * barW, hgt - barH, Math.max(1, barW - 2), barH);
    }
    ctx.globalAlpha = 1;
    if (this._playing) this._vizRaf = requestAnimationFrame(() => this.drawViz());
  }

  seekTrack(e) {
    const el = this.audioTrackRef.current; if (!el || !this.state.audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = frac * this.state.audioDuration;
  }

  setTrackVolume(v) {
    this.setState({ audioVolume: v });
    const el = this.audioTrackRef.current; if (el) el.volume = v;
    try { localStorage.setItem("wcVol", String(v)); } catch (e) {}
  }

  theme() { return theme(); }
  toast(msg, err) { this.setState({ toast: { msg, err } }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: null }), 3200); }
  set(field, value) { this.setState({ [field]: value }); }

  async save() {
    const s = this.state;
    await window.api.config.set({
      appsScriptUrl: s.appsScriptUrl.trim(), sharedSecret: s.sharedSecret.trim(), autoSync: s.autoSync,
      dataDir: s.dataDir.trim(), customLockfilePath: s.customLockfilePath.trim(),
      discordClientId: s.discordClientId.trim(), discordBotToken: s.discordBotToken.trim(), discordGuildId: s.discordGuildId.trim(),
      roflFolderPath: s.roflFolderPath.trim(), legacyJsonFolderPath: s.legacyJsonFolderPath.trim()
    });
    this.toast("Zapisano ustawienia");
  }

  async testConnection() {
    this.setState({ testResult: "Testowanie…" });
    const result = await window.api.sync.testConnection();
    this.setState({ testResult: result.ok ? `Połączono. Mecze: ${result.data.matches.length}, Gracze: ${result.data.players.length}` : `Błąd: ${result.error}` });
    this.toast(result.ok ? "Połączenie OK" : "Błąd połączenia", !result.ok);
  }

  async detectRoflFolder() {
    const detected = await window.api.rofl.detectDefaultFolder();
    if (detected) { this.setState({ roflFolderPath: detected }); this.toast("Wykryto folder Replays"); }
    else this.toast("Nie udało się wykryć folderu Replays", true);
  }

  async detectLegacyJsonFolder() {
    const detected = await window.api.legacyJson.detectDefaultFolder();
    if (detected) { this.setState({ legacyJsonFolderPath: detected }); this.toast("Wykryto folder ze starymi plikami JSON"); }
    else this.toast("Nie udało się wykryć folderu ze starymi plikami JSON", true);
  }

  async discordConnect() {
    this.setState({ discordConnectResult: "Łączenie z Discordem…" });
    const result = await window.api.discord.connect();
    this.setState({ discordConnectResult: result.ok ? `Zapisano avatar Discorda (${result.discordUser.username}) dla gracza puuid ${result.puuid.slice(0, 8)}...` : `Błąd: ${result.error}` });
    this.toast(result.ok ? "Discord połączony" : "Błąd Discord", !result.ok);
  }

  async discordBotSync() {
    this.setState({ discordBotResult: "Pobieranie członków serwera i dopasowywanie graczy…" });
    const result = await window.api.discord.syncGuildAvatars();
    this.setState({
      discordBotResult: result.ok
        ? `Znaleziono ${result.membersFound} członków serwera, dopasowano ${result.matchedCount} graczy.` + (result.unmatched.length ? ` Bez dopasowania: ${result.unmatched.join(", ")}` : "")
        : `Błąd: ${result.error}`
    });
    this.toast(result.ok ? `Dopasowano ${result.matchedCount}/${result.membersFound}` : "Błąd synchronizacji Discord", !result.ok);
  }

  input(field, opts) {
    const t = this.theme(); opts = opts || {};
    return h("input", {
      type: opts.type || "text", value: this.state[field], placeholder: opts.placeholder || "",
      onChange: (e) => this.set(field, e.target.value),
      style: { width: "100%", background: t.panel2, color: t.text, border: "1px solid " + t.line2, borderRadius: 9, padding: "9px 12px", fontSize: 13.5, fontFamily: t.disp, outline: "none" }
    });
  }

  field(label, field, opts) {
    const t = this.theme();
    return h("div", { key: field, style: { marginBottom: 12 } },
      h("div", { style: monoLabel(t) }, label),
      this.input(field, opts));
  }

  actionBtn(label, onClick, primary) {
    const t = this.theme();
    return h("button", { onClick, style: { cursor: "pointer", padding: "9px 16px", borderRadius: 10, border: primary ? "none" : "1px solid " + t.line2, background: primary ? t.accent : "transparent", color: primary ? "#08120D" : t.text, fontWeight: 800, fontSize: 13, fontFamily: t.disp, boxShadow: primary ? "0 0 14px " + t.accent + "55" : "none" } }, label);
  }

  card(title, desc, children) {
    const t = this.theme();
    return h("div", { style: { background: t.panel, border: "1px solid " + t.line, borderRadius: 16, padding: "20px 22px", marginBottom: 18 } },
      h("h2", { style: sectionH(t) }, title),
      desc ? h("p", { style: { fontSize: 12.5, color: t.mut, lineHeight: 1.55, margin: "0 0 14px" } }, desc) : null,
      children);
  }

  resultText(text, isErr) {
    const t = this.theme();
    return text ? h("div", { style: { fontSize: 12, color: isErr ? t.red : t.mut, marginTop: 8 } }, text) : null;
  }

  renderHeader() {
    const t = this.theme();
    const neon = "#5ac8ff";
    const items = [["index.html", "Mecze"], ["import.html", "Import / Zarządzanie"], ["players.html", "Gracze"], ["index.html#leaderboard", "Ranking"], ["index.html#draft", "Losowanie"], ["settings.html", "Ustawienia"]];
    return h("header", { style: { position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", gap: 18, padding: "12px 26px", borderBottom: "1px solid rgba(90,200,255,.18)", background: "rgba(8,10,22,.72)", backdropFilter: "blur(16px)", boxShadow: "0 8px 30px rgba(0,0,0,.35)" } },
      h("a", { href: "index.html", style: { display: "flex", alignItems: "center", gap: 11, flex: "0 0 auto" } },
        h("div", { style: { width: 34, height: 34, borderRadius: 9, overflow: "hidden", flex: "0 0 auto", boxShadow: "0 0 18px rgba(90,200,255,.5)" } }, h("img", { src: "logo.jpg", alt: "Customy", style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } })),
        h("div", null,
          h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 16, lineHeight: 1, color: t.text } }, "Wodne Customy"),
          h("div", { style: { fontSize: 10, color: neon, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 3 } }, "Złość, rozpacz i agonia"))),
      h("nav", { style: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" } }, items.map(([href, label]) => {
        const on = href === "settings.html";
        return h("a", { key: href, href, style: { position: "relative", padding: "9px 15px", borderRadius: 10, border: "1px solid " + (on ? "rgba(90,200,255,.5)" : "transparent"), background: on ? "rgba(90,200,255,.12)" : "transparent", color: on ? "#dff3ff" : t.mut, fontWeight: 700, fontSize: 14, fontFamily: t.disp, letterSpacing: .2, textShadow: on ? "0 0 10px rgba(90,200,255,.6)" : "none" } }, label);
      })),
      h("div", { style: { flex: 1 } }),
      this.actionBtn("💾 Zapisz ustawienia", () => this.save(), true));
  }

  renderSoundtrackCard() {
    const t = this.theme();
    const cur = Math.floor(this.state.audioCurrent), dur = Math.floor(this.state.audioDuration);
    const pct = this.state.audioDuration ? (this.state.audioCurrent / this.state.audioDuration) * 100 : 0;
    return this.card("Ścieżka dźwiękowa", "Główny motyw muzyczny apki (ten sam, co gra w tle w Przeglądarce meczy) - podgląd z wizualizacją widma.", h("div", null,
      h("audio", {
        ref: this.audioTrackRef, src: "assets/neon-waterfall.mp3", loop: true, preload: "metadata",
        onLoadedMetadata: (e) => this.setState({ audioDuration: e.target.duration || 0 }),
        onTimeUpdate: (e) => this.setState({ audioCurrent: e.target.currentTime || 0 }),
        onEnded: () => { this._playing = false; this.setState({ audioPlaying: false }); },
        style: { display: "none" }
      }),
      h("div", { style: { display: "flex", alignItems: "center", gap: 14, marginBottom: 12 } },
        h("button", { onClick: () => this.toggleTrackPlay(), title: this.state.audioPlaying ? "Pauza" : "Odtwórz", style: { cursor: "pointer", width: 44, height: 44, flex: "0 0 auto", borderRadius: "50%", border: "none", background: t.accent, color: "#08120D", fontSize: 17, boxShadow: "0 0 16px " + t.accent + "66" } }, this.state.audioPlaying ? "❙❙" : "▶"),
        h("div", { style: { flex: 1, minWidth: 0 } },
          h("div", { style: { fontWeight: 700, fontSize: 13.5, marginBottom: 6 } }, "Neon Waterfall"),
          h("div", { onClick: (e) => this.seekTrack(e), style: { height: 8, borderRadius: 20, background: "rgba(255,255,255,.08)", cursor: "pointer", overflow: "hidden" } },
            h("div", { style: { height: "100%", width: pct + "%", background: t.accent, borderRadius: 20 } }))),
        h("div", { style: { fontFamily: t.mono, fontSize: 11.5, color: t.faint, flex: "0 0 auto", minWidth: 76, textAlign: "right" } }, fmtTime(cur) + " / " + fmtTime(dur))),
      h("canvas", { ref: this.vizCanvasRef, style: { width: "100%", height: 64, display: "block", borderRadius: 10, background: "rgba(0,0,0,.25)" } }),
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 12 } },
        h("span", { style: { fontSize: 12, color: t.mut } }, "🔊"),
        h("input", { type: "range", min: 0, max: 1, step: 0.01, value: this.state.audioVolume, onChange: (e) => this.setTrackVolume(parseFloat(e.target.value)), style: { flex: 1, accentColor: t.accent, cursor: "pointer" } }))));
  }

  renderApp() {
    const t = this.theme();
    if (!this.state.loaded) {
      return h("div", { style: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, background: t.bg } },
        h("div", { style: { width: 46, height: 46, borderRadius: "50%", border: "3px solid rgba(255,255,255,.1)", borderTopColor: t.accent, animation: "lolSpin .9s linear infinite" } }),
        h("div", { style: { color: t.mut, fontFamily: t.disp, letterSpacing: 2, textTransform: "uppercase", fontSize: 12 } }, "Wczytywanie ustawień"));
    }
    return h("div", { className: "lolscroll", style: { display: "flex", flexDirection: "column", minHeight: "100vh", background: "transparent", position: "relative" } },
      h(SynthwaveBackground, null),
      this.renderHeader(),
      h("main", { className: "lolscroll", style: { flex: 1, minWidth: 0, position: "relative", zIndex: 1, padding: "34px 40px 60px", maxWidth: 820, margin: "0 auto", width: "100%", boxSizing: "border-box", animation: "lolFade .35s ease" } },
        this.renderSoundtrackCard(),

        this.card("Google Apps Script", "Adres wdrożonej aplikacji internetowej i sekret, przez które desktop synchronizuje się z Arkuszem Google.", h("div", null,
          this.field("Adres URL wdrożonej aplikacji internetowej (.../exec)", "appsScriptUrl"),
          this.field("Sekret (SHARED_SECRET ustawiony w Apps Script)", "sharedSecret"),
          h("label", { style: { display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 13, color: t.text, margin: "4px 0 14px" } },
            h("input", { type: "checkbox", checked: this.state.autoSync, onChange: (e) => this.set("autoSync", e.target.checked), style: { accentColor: t.accent, width: 16, height: 16, cursor: "pointer" } }),
            "Automatycznie wysyłaj dane do Google Sheets zaraz po zakończeniu gry"),
          this.actionBtn("Testuj połączenie", () => this.testConnection()),
          this.resultText(this.state.testResult))),

        this.card("Discord (opcjonalnie)", "Drugie źródło awatarów - dla siebie samego. Wymaga uruchomionego i zalogowanego desktopowego klienta Discord oraz zalogowanego klienta League of Legends na tym komputerze; avatar zostanie zapisany dla aktualnie zalogowanego gracza League.", h("div", null,
          this.field("Discord Client ID (z discord.com/developers/applications)", "discordClientId"),
          this.actionBtn("Połącz z Discordem i zapisz mój avatar", () => this.discordConnect()),
          this.resultText(this.state.discordConnectResult))),

        this.card("Discord — bot serwera (opcjonalnie)", "Awatary dla wszystkich naraz. Wymaga dodania bota do serwera i wypełnienia pola discordNick (nazwa użytkownika lub nick na serwerze) w zakładce Gracze dla każdego gracza. Nie wymaga uruchomionego Discorda ani League u pozostałych graczy - działa z jednego komputera dla całej drużyny naraz.", h("div", null,
          this.field("Token bota Discord", "discordBotToken", { type: "password" }),
          this.field("ID serwera Discord (Guild ID)", "discordGuildId"),
          this.actionBtn("Pobierz avatary wszystkich graczy (bot)", () => this.discordBotSync()),
          this.resultText(this.state.discordBotResult))),

        this.card("Lokalizacja danych i klienta League", null, h("div", null,
          this.field("Folder zapisu danych lokalnych (JSON)", "dataDir"),
          this.field("Własna ścieżka do pliku lockfile klienta League (opcjonalnie)", "customLockfilePath", { placeholder: "np. D:/Riot Games/League of Legends/lockfile" }))),

        this.card("Folder z plikami .rofl", "Po ustawieniu tej ścieżki, w Imporcie / Zarządzaniu pojawi się lista wszystkich plików .rofl z tego folderu - podgląd danych każdego meczu i wybór, które zaimportować.", h("div", null,
          this.field("Ścieżka do folderu Replays klienta League", "roflFolderPath", { placeholder: "np. C:\\Users\\Ty\\Documents\\League of Legends\\Replays" }),
          this.actionBtn("Wykryj automatycznie", () => this.detectRoflFolder()))),

        this.card("Folder ze starymi plikami JSON meczów", "Po ustawieniu tej ścieżki, w Imporcie / Zarządzaniu pojawi się lista wszystkich plików .json z tego folderu. W przeciwieństwie do importu .rofl / z historii klienta, te pliki zawierają już pełne statystyki, więc import działa nawet bez uruchomionego klienta League.", h("div", null,
          this.field("Ścieżka do folderu ze starymi plikami JSON", "legacyJsonFolderPath", { placeholder: "np. C:\\Users\\Ty\\Desktop\\Custom Json" }),
          this.actionBtn("Wykryj automatycznie", () => this.detectLegacyJsonFolder()))),

        h("div", { style: { display: "flex", justifyContent: "flex-end" } }, this.actionBtn("💾 Zapisz ustawienia", () => this.save(), true))
      ),
      this.state.toast ? h("div", { style: { position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", zIndex: 60, background: t.elev, border: "1px solid " + (this.state.toast.err ? t.red : t.accent), color: t.text, padding: "13px 22px", borderRadius: 12, fontWeight: 700, fontSize: 14, boxShadow: "0 12px 40px rgba(0,0,0,.5)", animation: "lolPop .2s ease" } }, (this.state.toast.err ? "⚠ " : "✓ ") + this.state.toast.msg) : null);
  }

  render() { return this.renderApp(); }
}

ReactDOM.createRoot(document.getElementById("root")).render(h(SettingsApp));
