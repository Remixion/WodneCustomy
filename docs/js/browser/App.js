/* Główny komponent "Przeglądarki meczy" na GitHub Pages - to samo co desktop-app/renderer/js/browser/App.js,
   ale strona jest tylko do odczytu: dane wchodzą jednym zapytaniem GET do Apps Script (fetchData() z
   common.js) zamiast przez window.api IPC, więc init()/reload() grupują tu płaskie matches/matchPlayers
   z Arkusza w kształt, jakiego oczekuje LOLData.buildMatchesFromStore (dokładnie to co window.api.store.listMatches()
   zwraca w apce desktopowej). Brak "Import / Zarządzanie" w pasku - ta strona nie ma admin narzędzi.
   window.BrowserViews (rejestr widoków) jest inicjalizowany w helpers.js - ten plik ładuje się PIERWSZY. */

/** Grupuje płaską listę MatchPlayers (jak zwraca doGet w Code.gs) po matchId - odpowiednik [{match, players}] z window.api.store.listMatches(). */
function groupMatchPlayers(matches, matchPlayers) {
  const byId = {};
  (matchPlayers || []).forEach((mp) => { (byId[mp.matchId] = byId[mp.matchId] || []).push(mp); });
  return (matches || []).map((match) => ({ match, players: byId[match.matchId] || [] }));
}

/**
 * Czeka aż przeglądarka wczyta czcionki (Space Grotesk/JetBrains Mono) zanim pokażemy właściwy
 * layout - na GitHub Pages, gdzie fonty ładują się z sieci (a nie z lokalnego cache Electrona jak
 * na desktopie), pierwsze wejście na stronę potrafiło "rozjechać" sztywne siatki (np. Losowanie)
 * fallbackowym fontem, który po doładowaniu Google Fonts nagle zmieniał metryki i przesuwał layout.
 * Limit czasu, żeby nigdy nie zawiesić ładowania, gdyby fonty się nie doczekały.
 */
function waitForFonts() {
  if (!document.fonts || !document.fonts.ready) return Promise.resolve();
  return Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))]);
}

class BrowserApp extends React.Component {
  state = {
    ready: false, err: null, matches: [], agg: null, statics: null,
    route: { view: "matches" }, toast: null,
    sortKey: "kda", roleFilter: "ALL", cmpA: null, cmpB: null,
    statLayout: "rows", search: "",
    muted: loadMuted(), volume: loadVolume(),
    generatedAt: null
  };

  audioRef = React.createRef();

  componentDidMount() {
    this._onHash = () => this.readHash();
    window.addEventListener("hashchange", this._onHash);
    this.init();
  }
  componentWillUnmount() {
    window.removeEventListener("hashchange", this._onHash);
    saveAudioPos(this);
  }

  theme() { return theme(); }

  async init() {
    const L = window.LOLData;
    let statics = null;
    try { statics = await L.loadStatic(); } catch (e) { statics = { version: "15.24.1", champById: L.CHAMP_STATIC, champByName: {}, itemName: {}, spellById: {}, runeById: {} }; }
    try {
      const data = await fetchData();
      const stored = groupMatchPlayers(data.matches, data.matchPlayers);
      const playersByPuuid = buildPlayersByPuuid(data.players);
      const matches = L.buildMatchesFromStore(stored, playersByPuuid, statics, null);
      const agg = L.aggregate(matches);
      await waitForFonts();
      this.setState({ ready: true, statics, matches, agg, playersByPuuid, generatedAt: data.generatedAt }, () => this.readHash());
    } catch (e) {
      await waitForFonts();
      this.setState({ ready: true, err: String(e && e.message || e), statics, matches: [], agg: L.aggregate([]) });
    }
  }

  async reload() {
    const L = window.LOLData;
    const data = await fetchData();
    const stored = groupMatchPlayers(data.matches, data.matchPlayers);
    const playersByPuuid = buildPlayersByPuuid(data.players);
    const matches = L.buildMatchesFromStore(stored, playersByPuuid, this.state.statics, null);
    const agg = L.aggregate(matches);
    this.setState({ matches, agg, playersByPuuid, generatedAt: data.generatedAt });
  }

  readHash() {
    const hsh = (window.location.hash || "").replace(/^#/, "");
    if (!hsh) return;
    const [view, id] = hsh.split("/");
    if (["matches", "match", "player", "leaderboard", "champions", "compare", "profiles", "draft"].includes(view)) {
      this.setState({ route: { view, id: id ? decodeURIComponent(id) : undefined } });
    }
  }
  nav(view, id) {
    const route = { view, id };
    this.setState({ route });
    try { window.location.hash = view + (id ? "/" + encodeURIComponent(id) : ""); } catch (e) {}
    if (view === "player") autoPlaySong(this, id);
    else _stopProfileSong(this);
  }
  toast(msg, err) { this.setState({ toast: { msg, err } }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: null }), 3200); }

  renderApp() {
    if (!this.state.ready) return this.renderLoading();
    return h("div", { className: "lolscroll", style: { display: "flex", flexDirection: "column", minHeight: "100vh", background: "transparent", position: "relative" } },
      h(SynthwaveBackground, null),
      h("audio", { ref: this.audioRef, src: "assets/neon-waterfall.mp3", loop: true, preload: "auto", onTimeUpdate: () => { if (!this._savedT || Date.now() - this._savedT > 4000) { this._savedT = Date.now(); saveAudioPos(this); } }, onLoadedMetadata: (e) => { try { const p = parseFloat(localStorage.getItem("wcAudioPos") || "0"); if (p && p < e.target.duration) e.target.currentTime = p; } catch (er) {} if (!this.state.muted) { e.target.volume = this.state.volume; const pr = e.target.play(); if (pr && pr.catch) pr.catch(() => {}); } }, style: { display: "none" } }),
      this.renderSidebar(),
      h("main", { className: "lolscroll", style: { flex: 1, minWidth: 0, position: "relative", zIndex: 1 } }, this.renderView()),
      this.state.playerModal && window.BrowserViews.playerModal ? window.BrowserViews.playerModal(this) : null,
      this.state.monsterEdit && window.BrowserViews.monsterEditor ? window.BrowserViews.monsterEditor(this) : null,
      this.state.songEdit && window.BrowserViews.songEditor ? window.BrowserViews.songEditor(this) : null,
      this.state.toast ? this.renderToast() : null
    );
  }

  renderLoading() {
    const t = this.theme();
    return h("div", { style: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, background: t.bg } },
      h("div", { style: { width: 46, height: 46, borderRadius: "50%", border: "3px solid rgba(255,255,255,.1)", borderTopColor: t.accent, animation: "lolSpin .9s linear infinite" } }),
      h("div", { style: { color: t.mut, fontFamily: t.disp, letterSpacing: 2, textTransform: "uppercase", fontSize: 12 } }, "Wczytywanie danych z Google Sheets")
    );
  }

  renderSidebar() {
    const t = this.theme();
    const items = [["matches", "Mecze", "M"], ["profiles", "Profile", "G"], ["leaderboard", "Ranking", "R"], ["compare", "Porównaj", "P"], ["draft", "Losowanie", "L"]];
    const active = this.state.route.view;
    const neon = "#5ac8ff";
    const NavBtn = ([view, label]) => {
      const on = active === view || (view === "matches" && active === "match") || (view === "leaderboard" && active === "player");
      return h("button", {
        key: view, onClick: () => this.nav(view),
        style: { position: "relative", cursor: "pointer", padding: "9px 15px", borderRadius: 10, border: "1px solid " + (on ? "rgba(90,200,255,.5)" : "transparent"), background: on ? "rgba(90,200,255,.12)" : "transparent", color: on ? "#dff3ff" : t.mut, fontWeight: 700, fontSize: 14, fontFamily: t.disp, letterSpacing: .2, transition: "all .15s", textShadow: on ? "0 0 10px rgba(90,200,255,.6)" : "none" },
        onMouseEnter: (e) => { if (!on) { e.currentTarget.style.color = "#cfe6f5"; e.currentTarget.style.background = "rgba(255,255,255,.04)"; } },
        onMouseLeave: (e) => { if (!on) { e.currentTarget.style.color = t.mut; e.currentTarget.style.background = "transparent"; } }
      },
        label,
        on ? h("span", { style: { position: "absolute", left: 12, right: 12, bottom: -1, height: 2, borderRadius: 2, background: neon, boxShadow: "0 0 8px " + neon } }) : null);
    };
    return h("header", { style: { position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", gap: 18, padding: "12px 26px", borderBottom: "1px solid rgba(90,200,255,.18)", background: "rgba(8,10,22,.72)", backdropFilter: "blur(16px)", boxShadow: "0 8px 30px rgba(0,0,0,.35)" } },
      h("div", { onClick: () => this.nav("matches"), style: { display: "flex", alignItems: "center", gap: 11, cursor: "pointer", flex: "0 0 auto" } },
        h("div", { style: { width: 34, height: 34, borderRadius: 9, overflow: "hidden", flex: "0 0 auto", boxShadow: "0 0 18px rgba(90,200,255,.5)" } }, h("img", { src: "logo.jpg", alt: "Customy", style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } })),
        h("div", null,
          h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 16, lineHeight: 1 } }, "Wodne Customy"),
          h("div", { style: { fontSize: 10, color: neon, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 3 } }, "Złość, rozpacz i agonia"))
      ),
      h("nav", { style: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" } }, items.map(NavBtn)),
      h("div", { style: { flex: 1 } }),
      this.state.generatedAt ? h("span", { title: "Ostatnia aktualizacja danych z Arkusza", style: { fontSize: 11, color: t.faint, fontFamily: t.mono, whiteSpace: "nowrap" } }, formatDate(this.state.generatedAt)) : null,
      h("button", { onClick: () => this.reload(), title: "Odśwież dane z Arkusza", style: { cursor: "pointer", width: 34, height: 34, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9, border: "1px solid " + t.line2, background: "transparent", color: t.mut, fontSize: 15 } }, "↻"),
      h("div", { style: { display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" } },
        h("button", { onClick: () => toggleMute(this), title: this.state.muted ? "Włącz muzykę" : "Wycisz muzykę", style: { cursor: "pointer", width: 34, height: 34, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9, border: "1px solid " + (this.state.muted ? t.line2 : "rgba(90,200,255,.5)"), background: this.state.muted ? "transparent" : "rgba(90,200,255,.14)", color: this.state.muted ? t.mut : "#dff3ff", fontSize: 15, boxShadow: this.state.muted ? "none" : "0 0 12px rgba(90,200,255,.35)" } }, this.state.muted ? "🔇" : "🔊"),
        h("input", { type: "range", min: 0, max: 1, step: 0.01, value: this.state.muted ? 0 : this.state.volume, onChange: (e) => setVolume(this, parseFloat(e.target.value)), title: "Głośność", style: { width: 70, accentColor: "#5ac8ff", cursor: "pointer" } }))
    );
  }

  renderView() {
    const v = this.state.route.view;
    const registry = window.BrowserViews;
    if (this.state.err) return this.empty("Błąd wczytywania danych: " + this.state.err);
    if (v === "match" && registry.match) return registry.match(this, this.state.route.id);
    if (v === "player" && registry.player) return registry.player(this, this.state.route.id);
    if (v === "leaderboard" && registry.leaderboard) return registry.leaderboard(this);
    if (v === "compare" && registry.compare) return registry.compare(this);
    if (v === "profiles" && registry.profiles) return registry.profiles(this);
    if (v === "draft" && registry.draft) return registry.draft(this);
    if (registry.matches) return registry.matches(this);
    return this.empty("Ten widok jest jeszcze w budowie.");
  }

  renderToast() {
    const t = this.theme(); const tt = this.state.toast;
    return h("div", { style: { position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", zIndex: 60, background: t.elev, border: "1px solid " + (tt.err ? t.red : t.accent), color: t.text, padding: "13px 22px", borderRadius: 12, fontWeight: 700, fontSize: 14, boxShadow: "0 12px 40px rgba(0,0,0,.5)", animation: "lolPop .2s ease" } }, (tt.err ? "⚠ " : "✓ ") + tt.msg);
  }

  empty(msg) {
    const t = this.theme();
    return h("div", { style: { padding: 80, textAlign: "center", color: t.mut } }, msg);
  }

  render() { return this.renderApp(); }
}

ReactDOM.createRoot(document.getElementById("root")).render(h(BrowserApp));
