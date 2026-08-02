/* Muzyka w tle + "piosenki" profilowe graczy - port logiki audio z Match Browser.dc.html.
   W źródle istniały DWIE definicje togglePlayerSong/_playProfileSong - starsza (YouTube oEmbed
   -> iTunes preview / SoundCloud widget / iframe monochrome.tf) i nowsza, która ją nadpisuje
   (JS: druga metoda o tej samej nazwie w klasie wygrywa). Efektywnie działał wyłącznie ten
   drugi, prostszy wariant: URL piosenki gracza trafia wprost do `new Audio(url)`, więc
   działają bezpośrednie linki do plików audio (.mp3/.m4a) oraz wgrane pliki (blob: URL) -
   link do YouTube zapisywał się, ale nie odtwarzał. Poniżej DOSZŁA obsługa YouTube - przez
   oficjalny, wbudowany odtwarzacz YouTube (<iframe src="youtube.com/embed/...">), nie przez
   pobieranie/ekstrakcję dźwięku - to jedyny zgodny z zasadami YouTube sposób odtwarzania stamtąd
   w naszej stronie. Bezpośrednie linki audio nadal grają przez zwykły <audio> jak dotychczas. */

/** Wyciąga 11-znakowe ID filmu z linku youtube.com/watch, youtu.be, youtube.com/embed lub /shorts - null, jeśli to nie YouTube. */
function ytVideoId(url) {
  const m = String(url || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/** Domyślnie muzyka gra automatycznie na 50% głośności (dopóki użytkownik nie wyciszy jej ręcznie - wtedy ta decyzja jest pamiętana). */
function loadMuted() { try { return localStorage.getItem("wcMuted") === "1"; } catch (e) { return false; } }
function loadVolume() { try { const v = parseFloat(localStorage.getItem("wcVol")); return isFinite(v) ? v : 0.5; } catch (e) { return 0.5; } }

function toggleMute(app) {
  const muted = !app.state.muted;
  try { localStorage.setItem("wcMuted", muted ? "1" : "0"); } catch (e) {}
  const el = app.audioRef.current;
  if (el) {
    if (muted) { el.pause(); }
    else { el.volume = app.state.volume; const pr = el.play(); if (pr && pr.catch) pr.catch(() => {}); }
  }
  app.setState({ muted }, () => applySongVolume(app));
}
function setVolume(app, v) {
  v = Math.max(0, Math.min(1, v));
  try { localStorage.setItem("wcVol", String(v)); } catch (e) {}
  const el = app.audioRef.current; if (el) el.volume = v;
  const patch = { volume: v };
  if (v > 0 && app.state.muted) {
    patch.muted = false;
    try { localStorage.setItem("wcMuted", "0"); } catch (e) {}
    if (el) { const pr = el.play(); if (pr && pr.catch) pr.catch(() => {}); }
  }
  app.setState(patch, () => applySongVolume(app));
}
function saveAudioPos(app) {
  const el = app.audioRef.current;
  if (el) { try { localStorage.setItem("wcAudioPos", String(el.currentTime || 0)); } catch (e) {} }
}

/**
 * Odtwarza muzykę w tle automatycznie po wejściu na stronę. Przeglądarki (w przeciwieństwie do
 * Electrona) blokują autoplay ze dźwiękiem bez wcześniejszej interakcji użytkownika ze stroną -
 * gdy się nie uda, i tak zostaje naprawione przy pierwszej interakcji (patrz ensureBgAudioPlaying
 * poniżej, wywoływane z App.js na pointerdown/keydown na całym oknie).
 */
function playBgAudio(app, el) {
  el.volume = app.state.volume;
  const pr = el.play();
  if (pr && pr.catch) pr.catch(() => {});
}

/**
 * Wywoływane przy PIERWSZEJ interakcji użytkownika ze stroną (patrz App.js componentDidMount -
 * nasłuch na całym oknie, nie na samym przycisku, bo różne elementy mogą się w międzyczasie
 * odmontować). Jeśli muzyka w tle powinna grać (niewyciszona w stanie apki), a z powodu polityki
 * autoplay przeglądarki nie gra - naprawiamy to teraz, bo w odpowiedzi na gest użytkownika
 * przeglądarki zawsze na to pozwalają, niezależnie od tego, czy wcześniejsza próba odtworzenia
 * się powiodła, czy w ogóle się zdążyła wykonać.
 */
/**
 * Analizator widma (AnalyserNode) podpięty do muzyki w tle - SynthwaveBackground.js czyta go co
 * klatkę (readBgAudioLevels), żeby tło "pulsowało" w rytm piosenki. Tworzony leniwie, WYŁĄCZNIE
 * z ensureBgAudioPlaying (gwarantowany gest użytkownika - kliknięcie/klawisz), nigdy z
 * playBgAudio przy starcie strony: nowo utworzony AudioContext w przeglądarce (nie w Electronie)
 * startuje "suspended" bez wcześniejszej interakcji, a raz podpięty przez createMediaElementSource
 * element <audio> gra WYŁĄCZNIE przez ten graf - podpięcie go przed jakąkolwiek interakcją
 * ryzykowałoby całkowitą ciszę (nawet gdy niewyciszony) aż do resume(), czyli realny regres
 * względem obecnego, już działającego auto-odtwarzania. fftSize=64 to celowo niska rozdzielczość -
 * to ma dawać ogólny "puls", nie dokładną wizualizację słupkową (ta jest w Ustawieniach).
 */
function setupBgAnalyser(app) {
  if (app._bgAnalyser || !app.audioRef.current) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaElementSource(app.audioRef.current);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    app._bgAudioCtx = ctx;
    app._bgAnalyser = analyser;
    app._bgFreqData = new Uint8Array(analyser.frequencyBinCount);
  } catch (e) { console.warn("setupBgAnalyser: nie udało się podpiąć analizatora widma", e); }
}

/** {level, bass} znormalizowane 0..1 z ostatniej klatki widma muzyki w tle - {0,0} dopóki analizator jeszcze nie gotowy (przed pierwszą interakcją - patrz setupBgAnalyser). */
function readBgAudioLevels(app) {
  if (!app._bgAnalyser) return { level: 0, bass: 0 };
  app._bgAnalyser.getByteFrequencyData(app._bgFreqData);
  const data = app._bgFreqData;
  let sum = 0, bassSum = 0;
  const bassBins = Math.max(1, Math.floor(data.length * 0.2));
  for (let i = 0; i < data.length; i++) { sum += data[i]; if (i < bassBins) bassSum += data[i]; }
  return { level: sum / data.length / 255, bass: bassSum / bassBins / 255 };
}

function ensureBgAudioPlaying(app) {
  const el = app.audioRef.current;
  if (!el) return;
  // Analizator podpinamy ZAWSZE przy pierwszej interakcji, niezależnie od aktualnego stanu
  // wyciszenia - inaczej wcześniej zapisane "wyciszone" (localStorage z poprzedniej sesji)
  // trwale blokowałoby reaktywne tło, nawet gdyby użytkownik później odciszył muzykę ręcznie.
  setupBgAnalyser(app);
  if (app._bgAudioCtx && app._bgAudioCtx.state === "suspended") app._bgAudioCtx.resume().catch(() => {});
  if (app.state.muted) return;
  el.muted = false;
  if (el.paused) { el.volume = app.state.volume; el.play().catch(() => {}); }
}

function playerSongs(app) {
  if (!app._songs) { try { app._songs = JSON.parse(localStorage.getItem("wcPlayerSongs_v4") || "{}") || {}; } catch (e) { app._songs = {}; } }
  return app._songs;
}
/** Preferuje URL zapisany w Arkuszu (Players.songUrl - widoczny wszędzie), spada do starego localStorage tej przeglądarki tylko gdy Arkusz jeszcze nic nie ma dla tego gracza. */
function getSong(app, nick) {
  const pl = findPlayerRecordByNick(app, nick);
  if (pl && pl.songUrl) return pl.songUrl;
  return playerSongs(app)[window.LOLData.norm(nick)] || "";
}
function setSong(app, nick, url) {
  const s = playerSongs(app); const k = window.LOLData.norm(nick);
  if (url) s[k] = url; else delete s[k];
  try { localStorage.setItem("wcPlayerSongs_v4", JSON.stringify(s)); } catch (e) {}
  app._songs = s;
  const afterSave = () => { if (url) _playProfileSong(app, nick); else _stopProfileSong(app); };
  const pl = findPlayerRecordByNick(app, nick);
  if (pl && pl.puuid && typeof window.api !== "undefined") {
    window.api.store.updatePlayerField(pl.puuid, "songUrl", url || "").then(() => app.reload().then(afterSave));
  } else {
    app.forceUpdate();
    afterSave();
  }
}
function assignedSong(app, nick) {
  const stored = getSong(app, nick);
  return stored ? { u: stored, n: "Piosenka" } : null;
}

function _resumeBg(app) {
  try { const bg = app.audioRef.current; if (bg && app._bgWasPlaying && !app.state.muted) { bg.play().catch(() => {}); } } catch (e) {}
  app._bgWasPlaying = false;
}

/** Stosuje AKTUALNĄ głośność/wyciszenie apki (app.state.volume/muted - to samo, co suwak i przycisk wyciszenia muzyki w tle) do piosenki profilowej, jaka akurat gra - bezpośredni plik audio LUB odtwarzacz YouTube. Wywoływane zarówno przy starcie piosenki, jak i przy każdej zmianie głośności/wyciszenia z App.js, żeby piosenka zawsze była zsynchronizowana z resztą apki, a nie miała własnej, oddzielnej głośności. */
function applySongVolume(app) {
  const vol = app.state.muted ? 0 : (app.state.volume || 0);
  if (app._songEl) app._songEl.volume = vol;
  const yt = app._songYtEl;
  if (yt && yt.contentWindow) {
    try {
      yt.contentWindow.postMessage(JSON.stringify({ event: "command", func: app.state.muted ? "mute" : "unMute", args: [] }), "*");
      yt.contentWindow.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [Math.round((app.state.volume || 0) * 100)] }), "*");
    } catch (e) {}
  }
}
function _stopProfileSong(app, keepBg) {
  if (app._songEl) { app._songEl.pause(); app._songEl = null; }
  app._songYtEl = null;
  if (app.state.songPlaying || app.state.songYoutubeId) app.setState({ songPlaying: null, songYoutubeId: null });
  if (!keepBg) _resumeBg(app);
}
function _playProfileSong(app, nick) {
  const song = assignedSong(app, nick); if (!song) return;
  if (app._songNick === nick && (app.state.songPlaying === nick || app.state.songYoutubeId)) return;
  _stopProfileSong(app, true);
  app._songNick = nick;
  try { const bg = app.audioRef.current; if (bg) { app._bgWasPlaying = !bg.paused; bg.pause(); } } catch (e) {}
  const ytId = ytVideoId(song.u);
  if (ytId) {
    // Oficjalny odtwarzacz YouTube w <iframe> - patrz renderYoutubeSongPlayer niżej. Głośność dopinana przez applySongVolume po jego załadowaniu (onLoad).
    app.setState({ songPlaying: nick, songYoutubeId: ytId });
    return;
  }
  const a = new Audio(song.u);
  a.loop = true;
  app._songEl = a;
  applySongVolume(app);
  a.onerror = () => { app.toast("Nie udało się odtworzyć — użyj linku do YouTube albo bezpośredniego linku do pliku audio (.mp3/.m4a)", true); app.setState({ songPlaying: null }); _resumeBg(app); };
  const pr = a.play(); if (pr && pr.catch) pr.catch(() => app.toast("Kliknij ♪ Piosenka, aby odtworzyć", true));
  app.setState({ songPlaying: nick, songYoutubeId: null });
}
function togglePlayerSong(app, nick) {
  if (app._songNick === nick && app.state.songPlaying === nick) { _stopProfileSong(app); return; }
  _playProfileSong(app, nick);
}
function autoPlaySong(app, id) {
  try {
    const pl = app.state.agg.players[id] || Object.values(app.state.agg.players).find((x) => x.nick === id || x.puuid === id);
    const nick = pl ? (pl.nick || pl.summoner) : id;
    if (!nick || !getSong(app, nick)) return;
    _playProfileSong(app, nick);
  } catch (e) {}
}

function renderSongEditorModal(app) {
  const t = app.theme();
  const nick = app.state.songEdit;
  const close = () => app.setState({ songEdit: null });
  const val = app.state.songDraft || "";
  const save = () => { setSong(app, nick, (app.state.songDraft || "").trim()); app.setState({ songEdit: null }); app.toast((app.state.songDraft || "").trim() ? "Zapisano piosenkę" : "Usunięto piosenkę"); };
  return h("div", { onClick: close, style: { position: "fixed", inset: 0, zIndex: 60, background: "rgba(6,8,18,.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "lolFade .2s ease" } },
    h("div", { onClick: (e) => e.stopPropagation(), style: { width: "100%", maxWidth: 460, background: t.panel, border: "1px solid rgba(90,200,255,.3)", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.6), 0 0 30px rgba(90,200,255,.15)", animation: "lolPop .22s ease" } },
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid " + t.line } },
        h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 19 } }, "Piosenka — " + nick),
        h("button", { onClick: close, style: { width: 32, height: 32, borderRadius: 9, border: "1px solid " + t.line2, background: "rgba(0,0,0,.25)", color: t.text, cursor: "pointer", fontSize: 16 } }, "✕")),
      h("div", { style: { padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 } },
        h("div", null,
          h("div", { style: monoLabel(t) }, "Link do YouTube lub bezpośredni link do pliku audio (mp3 / m4a)"),
          h("input", { autoFocus: true, value: val, onChange: (e) => app.setState({ songDraft: e.target.value }), onKeyDown: (e) => { if (e.key === "Enter") save(); }, placeholder: "https://youtube.com/watch?v=… lub https://.../piosenka.mp3", style: { width: "100%", background: t.panel2, color: t.text, border: "1px solid " + t.line2, borderRadius: 9, padding: "9px 11px", fontSize: 13.5, fontFamily: t.disp, outline: "none" } })),
        h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
          h("span", { style: { fontSize: 12, color: t.faint } }, "lub"),
          h("label", { style: { cursor: "pointer", padding: "8px 13px", borderRadius: 9, border: "1px solid " + t.line2, background: "transparent", color: t.mut, fontWeight: 700, fontSize: 12.5, fontFamily: t.disp } }, "Wgraj plik z dysku",
            h("input", { type: "file", accept: "audio/*", onChange: (e) => { const f = e.target.files && e.target.files[0]; if (f) app.setState({ songDraft: URL.createObjectURL(f), songLocalName: f.name }); }, style: { display: "none" } })),
          app.state.songLocalName ? h("span", { style: { fontSize: 12, color: t.accent, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 } }, app.state.songLocalName) : null),
        h("div", { style: { fontSize: 11.5, color: t.faint, lineHeight: 1.5 } }, "Wgrany plik działa do przeładowania aplikacji — dla trwałego zapisu użyj linku do pliku audio.")),
      h("div", { style: { display: "flex", gap: 10, padding: "16px 22px", borderTop: "1px solid " + t.line } },
        h("button", { onClick: save, style: { flex: 1, cursor: "pointer", padding: "12px", borderRadius: 11, border: "none", background: t.accent, color: "#08120D", boxShadow: "0 0 16px " + t.accent + "66", fontWeight: 800, fontSize: 14, fontFamily: t.disp } }, "Zapisz"),
        getSong(app, nick) ? h("button", { onClick: () => { setSong(app, nick, ""); app.setState({ songEdit: null, songDraft: "", songLocalName: null }); app.toast("Usunięto piosenkę"); }, style: { cursor: "pointer", padding: "12px 16px", borderRadius: 11, border: "1px solid rgba(255,120,140,.4)", background: "rgba(255,90,120,.1)", color: "#ff9aae", fontWeight: 700, fontSize: 14, fontFamily: t.disp } }, "Usuń") : null,
        h("button", { onClick: close, style: { cursor: "pointer", padding: "12px 18px", borderRadius: 11, border: "1px solid " + t.line2, background: "transparent", color: t.mut, fontWeight: 700, fontSize: 14, fontFamily: t.disp } }, "Anuluj"))));
}

/** Pływający, oficjalny odtwarzacz YouTube (iframe) dla piosenki profilowej - renderowany z App.js obok innych nakładek, dopóki app.state.songYoutubeId jest ustawione (patrz _playProfileSong powyżej). loop=1&playlist={id} to oficjalna sztuczka YouTube na zapętlenie pojedynczego filmu. */
function renderYoutubeSongPlayer(app) {
  if (!app.state.songYoutubeId) return null;
  const t = app.theme();
  const id = app.state.songYoutubeId;
  const src = "https://www.youtube.com/embed/" + id + "?autoplay=1&loop=1&playlist=" + id + "&enablejsapi=1";
  // enablejsapi=1 + ref na <iframe> pozwala sterować głośnością tego konkretnego odtwarzacza przez postMessage (patrz applySongVolume) - bez tego link do YouTube grałby zawsze na swojej domyślnej głośności, niezależnie od suwaka/wyciszenia w apce.
  return h("div", { style: { position: "fixed", right: 16, bottom: 16, zIndex: 70, width: 300, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(90,200,255,.4)", boxShadow: "0 14px 40px rgba(0,0,0,.6), 0 0 22px rgba(90,200,255,.25)", background: "#000" } },
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "rgba(8,10,22,.92)" } },
      h("span", { style: { fontSize: 11.5, color: t.mut, fontWeight: 700, fontFamily: t.disp } }, "♪ Piosenka profilowa"),
      h("button", { onClick: () => _stopProfileSong(app), title: "Zatrzymaj", style: { cursor: "pointer", border: "none", background: "transparent", color: t.mut, fontSize: 14, lineHeight: 1 } }, "✕")),
    h("iframe", { key: id, src, width: "300", height: "169", frameBorder: "0", allow: "autoplay; encrypted-media", title: "Piosenka profilowa (YouTube)", style: { display: "block" }, ref: (el) => { app._songYtEl = el; }, onLoad: () => setTimeout(() => applySongVolume(app), 400) }));
}

window.BrowserViews.songEditor = renderSongEditorModal;
