/* Muzyka w tle + "piosenki" profilowe graczy - port logiki audio z Match Browser.dc.html.
   W źródle istniały DWIE definicje togglePlayerSong/_playProfileSong - starsza (YouTube oEmbed
   -> iTunes preview / SoundCloud widget / iframe monochrome.tf) i nowsza, która ją nadpisuje
   (JS: druga metoda o tej samej nazwie w klasie wygrywa). Efektywnie działał wyłącznie ten
   drugi, prostszy wariant: URL piosenki gracza trafia wprost do `new Audio(url)`, więc
   działają bezpośrednie linki do plików audio (.mp3/.m4a) oraz wgrane pliki (blob: URL) -
   link do YouTube/SoundCloud zapisze się, ale nie odtworzy (błąd audio). Port poniżej
   odtwarza dokładnie to zachowanie, bez martwego kodu (resolveAndPlayYT/playSoundcloud/
   playMonochrome nigdy nie były wywoływane w finalnej wersji komponentu). */

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
  app.setState({ muted });
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
  app.setState(patch);
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
function ensureBgAudioPlaying(app) {
  const el = app.audioRef.current;
  if (!el || app.state.muted) return;
  el.muted = false;
  if (el.paused) { el.volume = app.state.volume; el.play().catch(() => {}); }
}

function playerSongs(app) {
  if (!app._songs) { try { app._songs = JSON.parse(localStorage.getItem("wcPlayerSongs_v4") || "{}") || {}; } catch (e) { app._songs = {}; } }
  return app._songs;
}
function getSong(app, nick) { return playerSongs(app)[window.LOLData.norm(nick)] || ""; }
function setSong(app, nick, url) {
  const s = playerSongs(app); const k = window.LOLData.norm(nick);
  if (url) s[k] = url; else delete s[k];
  try { localStorage.setItem("wcPlayerSongs_v4", JSON.stringify(s)); } catch (e) {}
  app._songs = s;
  app.forceUpdate();
}
function assignedSong(app, nick) {
  const stored = playerSongs(app)[window.LOLData.norm(nick)];
  return stored ? { u: stored, n: "Piosenka" } : null;
}

function _resumeBg(app) {
  try { const bg = app.audioRef.current; if (bg && app._bgWasPlaying && !app.state.muted) { bg.play().catch(() => {}); } } catch (e) {}
  app._bgWasPlaying = false;
}
function _stopProfileSong(app, keepBg) {
  if (app._songEl) { app._songEl.pause(); app._songEl = null; }
  if (app.state.songPlaying) app.setState({ songPlaying: null });
  if (!keepBg) _resumeBg(app);
}
function _playProfileSong(app, nick) {
  const song = assignedSong(app, nick); if (!song) return;
  if (app._songNick === nick && app.state.songPlaying === nick) return;
  _stopProfileSong(app, true);
  app._songNick = nick;
  try { const bg = app.audioRef.current; if (bg) { app._bgWasPlaying = !bg.paused; bg.pause(); } } catch (e) {}
  const a = new Audio(song.u);
  a.loop = true;
  a.volume = app.state.muted ? 0 : Math.max(0.3, app.state.volume || 0.5);
  a.onerror = () => { app.toast("Nie udało się odtworzyć — użyj bezpośredniego linku do pliku audio (.mp3/.m4a)", true); app.setState({ songPlaying: null }); _resumeBg(app); };
  const pr = a.play(); if (pr && pr.catch) pr.catch(() => app.toast("Kliknij ♪ Piosenka, aby odtworzyć", true));
  app._songEl = a;
  app.setState({ songPlaying: nick });
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
          h("div", { style: monoLabel(t) }, "Bezpośredni link do pliku audio (mp3 / m4a)"),
          h("input", { autoFocus: true, value: val, onChange: (e) => app.setState({ songDraft: e.target.value }), onKeyDown: (e) => { if (e.key === "Enter") save(); }, placeholder: "https://.../piosenka.mp3", style: { width: "100%", background: t.panel2, color: t.text, border: "1px solid " + t.line2, borderRadius: 9, padding: "9px 11px", fontSize: 13.5, fontFamily: t.disp, outline: "none" } })),
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

window.BrowserViews.songEditor = renderSongEditorModal;
