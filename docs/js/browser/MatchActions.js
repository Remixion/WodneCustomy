/* Menu akcji administracyjnych "⋯" per mecz (Notatki/Edytuj/Scoreboard/Wyślij do Sheets/Usuń lokalnie/Usuń z Sheets) -
   dawniej tylko w toolbarze pod kartą meczu w starym index.html (teraz import.html). Wywołania IPC bez zmian
   (window.api.store, window.api.sync), tylko przeniesione tutaj, żeby były dostępne bezpośrednio z listy
   meczów i widoku szczegółów, bez przechodzenia do osobnej strony administracyjnej. */

function closeMatchActions(app) { app.setState({ matchMenuOpen: null }); }

function matchActionsPanel(app, m) {
  const t = app.theme();
  const close = () => closeMatchActions(app);
  const saveNote = async () => {
    await window.api.store.updateMatchField(m.id, "notes", app.state.matchNoteDraft || "");
    await app.reload();
    app.toast("Zapisano notatkę");
    close();
  };
  const push = async () => {
    const result = await window.api.sync.pushMatch(m.id);
    app.toast(result.ok ? "Wysłano do Sheets" : "Błąd wysyłki: " + result.error, !result.ok);
  };
  const deleteLocal = async () => {
    if (!confirm("Usunąć mecz " + m.id + " z lokalnego magazynu? (nie usuwa danych z arkusza)")) return;
    await window.api.store.deleteMatch(m.id);
    await app.reload();
    app.toast("Usunięto lokalnie");
    close();
    if (app.state.route.view === "match" && app.state.route.id === m.id) app.nav("matches");
  };
  const deleteSheets = async () => {
    if (!confirm("Usunąć mecz " + m.id + " z Arkusza Google? (dane lokalne zostaną)")) return;
    const result = await window.api.sync.deleteMatch(m.id);
    app.toast(result.ok ? "Usunięto z Sheets" : "Błąd usuwania: " + result.error, !result.ok);
    close();
  };
  const item = (label, onClick, danger) => h("button", { key: label, onClick, style: { display: "block", width: "100%", textAlign: "left", cursor: "pointer", padding: "9px 14px", borderRadius: 8, border: "none", background: "transparent", color: danger ? "#ff9aae" : t.text, fontWeight: 600, fontSize: 13, fontFamily: t.disp }, onMouseEnter: (e) => e.currentTarget.style.background = "rgba(255,255,255,.06)", onMouseLeave: (e) => e.currentTarget.style.background = "transparent" }, label);
  const linkItem = (label, href) => h("a", { key: label, href, style: { display: "block", width: "100%", textAlign: "left", cursor: "pointer", padding: "9px 14px", borderRadius: 8, color: t.text, fontWeight: 600, fontSize: 13, fontFamily: t.disp, textDecoration: "none" }, onMouseEnter: (e) => e.currentTarget.style.background = "rgba(255,255,255,.06)", onMouseLeave: (e) => e.currentTarget.style.background = "transparent" }, label);

  return h("div", { onClick: (e) => e.stopPropagation(), style: { position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20, width: 260, background: t.elev, border: "1px solid " + t.line2, borderRadius: 13, boxShadow: "0 20px 60px rgba(0,0,0,.5)", padding: "10px", animation: "lolPop .18s ease" } },
    h("div", { style: { padding: "2px 8px 8px" } },
      h("div", { style: monoLabel(t) }, "Notatki"),
      h("textarea", { value: app.state.matchNoteDraft != null ? app.state.matchNoteDraft : (m.notes || ""), onChange: (e) => app.setState({ matchNoteDraft: e.target.value }), rows: 2, style: { width: "100%", resize: "vertical", background: t.panel2, color: t.text, border: "1px solid " + t.line2, borderRadius: 8, padding: "7px 9px", fontSize: 12.5, fontFamily: t.disp, outline: "none" } }),
      h("button", { onClick: saveNote, style: { marginTop: 6, cursor: "pointer", padding: "6px 12px", borderRadius: 8, border: "none", background: t.accent, color: "#08120D", fontWeight: 800, fontSize: 12, fontFamily: t.disp } }, "Zapisz notatkę")),
    h("div", { style: { height: 1, background: t.line, margin: "4px 0" } }),
    linkItem("Edytuj (pełny edytor)", "match.html?matchId=" + encodeURIComponent(m.id)),
    linkItem("Scoreboard (pełna strona)", "scoreboard.html?matchId=" + encodeURIComponent(m.id)),
    item("Wyślij do Sheets", push),
    h("div", { style: { height: 1, background: t.line, margin: "4px 0" } }),
    item("Usuń lokalnie", deleteLocal, true),
    item("Usuń z Sheets", deleteSheets, true));
}

function matchActionsButton(app, m) {
  /* Strona GitHub Pages jest tylko do odczytu (brak window.api - to most Electron IPC,
     dostępny wyłącznie w apce desktopowej) - na GH Pages ten przycisk się nie renderuje. */
  if (typeof window.api === "undefined") return null;
  const t = app.theme();
  const open = app.state.matchMenuOpen === m.id;
  const toggle = (e) => {
    e.stopPropagation();
    app.setState({ matchMenuOpen: open ? null : m.id, matchNoteDraft: m.notes || "" });
  };
  return h("div", { style: { position: "relative" } },
    h("button", { onClick: toggle, title: "Akcje administracyjne", style: { cursor: "pointer", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9, border: "1px solid " + (open ? t.line2 : "transparent"), background: open ? t.panel2 : "transparent", color: t.mut, fontSize: 17, fontWeight: 700 } }, "⋯"),
    open ? matchActionsPanel(app, m) : null);
}
