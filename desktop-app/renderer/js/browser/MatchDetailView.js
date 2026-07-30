/* Widok pojedynczego meczu (URL #match/:id) - port renderMatch z Match Browser.dc.html. Współdzieli teamPanel z MatchesView.js. */

function renderMatchDetailView(app, id) {
  const t = app.theme();
  const m = app.state.matches.find((x) => x.id === id) || app.state.matches[0];
  if (!m) return app.empty("Nie znaleziono meczu");
  const winSide = m.winner === "BLUE" ? "blue" : "red";
  return h("div", { style: { padding: "30px 40px 60px", maxWidth: 1260, margin: "0 auto", animation: "lolFade .35s ease" } },
    h("button", { onClick: () => app.nav("matches"), style: backBtn(t) }, "← Wszystkie mecze"),
    h("div", { style: { display: "flex", alignItems: "center", gap: 18, margin: "16px 0 26px", flexWrap: "wrap" } },
      h("div", null,
        h("h1", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 26, margin: 0, letterSpacing: -.5 } }, (winSide === "blue" ? "Zwycięstwo Blue" : "Zwycięstwo Red")),
        h("div", { style: { color: t.mut, fontSize: 13.5, marginTop: 5, fontFamily: t.mono } }, fmtDate(m.date, true) + " · " + fmtTime(m.durationSec) + " · patch " + m.patch)
      ),
      h("div", { style: { flex: 1 } }),
      m.notesImg ? h("a", { href: m.notesImg, target: "_blank", rel: "noreferrer", style: { fontSize: 12.5, color: t.mut, border: "1px solid " + t.line, padding: "7px 12px", borderRadius: 9 } }, "↗ screenshot z gry") : null,
      matchActionsButton(app, m)
    ),
    teamPanel(app, m, "blue"),
    h("div", { style: { height: 16 } }),
    teamPanel(app, m, "red")
  );
}

window.BrowserViews.match = renderMatchDetailView;
