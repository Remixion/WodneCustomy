/* Porównanie dwóch graczy (#compare) - port renderCompare z Match Browser.dc.html. */

function playerSelect(app, side, value) {
  const t = app.theme();
  const players = Object.values(app.state.agg.players).sort((a, b) => (a.nick || "").localeCompare(b.nick || ""));
  return h("select", {
    value: value || "", onChange: (e) => app.setState(side === "a" ? { cmpA: e.target.value || null } : { cmpB: e.target.value || null }),
    style: { background: t.panel, border: "1px solid " + t.line2, color: t.text, borderRadius: 9, padding: "9px 14px", fontSize: 14, fontWeight: 700, fontFamily: t.disp, outline: "none", minWidth: 180 }
  },
    h("option", { value: "" }, "— wybierz gracza —"),
    players.map((p) => h("option", { key: p.key, value: p.key }, p.nick || p.summoner)));
}

function cmpBar(t, label, va, vb, higherBetter, fmt) {
  const max = Math.max(va, vb, 0.0001);
  const pa = (va / max) * 50, pb = (vb / max) * 50;
  const aWins = higherBetter ? va >= vb : va <= vb;
  const bWins = higherBetter ? vb >= va : vb <= va;
  return h("div", { key: label, style: { marginBottom: 14 } },
    h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12.5, color: t.mut, marginBottom: 6 } },
      h("span", { style: { fontWeight: 700, color: aWins && va !== vb ? t.accent : t.mut } }, fmt(va)),
      h("span", { style: { color: t.faint, textTransform: "uppercase", letterSpacing: .6, fontSize: 11 } }, label),
      h("span", { style: { fontWeight: 700, color: bWins && va !== vb ? t.accent : t.mut } }, fmt(vb))),
    h("div", { style: { display: "flex", gap: 3, height: 8 } },
      h("div", { style: { flex: 1, display: "flex", justifyContent: "flex-end" } }, h("div", { style: { width: pa + "%", minWidth: va > 0 ? 3 : 0, height: "100%", background: aWins && va !== vb ? t.blue : "rgba(76,134,255,.35)", borderRadius: "20px 4px 4px 20px" } })),
      h("div", { style: { flex: 1 } }, h("div", { style: { width: pb + "%", minWidth: vb > 0 ? 3 : 0, height: "100%", background: bWins && va !== vb ? t.red : "rgba(255,93,108,.35)", borderRadius: "4px 20px 20px 4px" } }))));
}

function duoRecord(app, pa, pb) {
  const t = app.theme();
  const duo = (app.state.agg.duos || []).find((d) => (d.a.key === pa.key && d.b.key === pb.key) || (d.a.key === pb.key && d.b.key === pa.key));
  if (!duo) return h("div", { style: { fontSize: 13, color: t.faint, textAlign: "center", padding: "18px 0" } }, "Ci gracze nigdy nie grali w jednej drużynie.");
  return h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 26, padding: "10px 0" } },
    bigStat(t, duo.games, "wspólne gry"),
    bigStat(t, duo.wins + "W " + (duo.games - duo.wins) + "L", "bilans"),
    bigStat(t, Math.round(duo.winrate * 100) + "%", "winrate razem", duo.winrate >= .5 ? t.accent : t.red));
}

function versusRecord(app, pa, pb) {
  const t = app.theme();
  const v = (app.state.agg.versus || []).find((x) => (x.a.key === pa.key && x.b.key === pb.key) || (x.a.key === pb.key && x.b.key === pa.key));
  if (!v) return h("div", { style: { fontSize: 13, color: t.faint, textAlign: "center", padding: "18px 0" } }, "Ci gracze nigdy nie grali przeciwko sobie.");
  const paIsA = v.a.key === pa.key;
  const paWins = paIsA ? v.aWins : v.bWins, pbWins = paIsA ? v.bWins : v.aWins;
  const paWinrate = v.games ? paWins / v.games : 0;
  return h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 26, padding: "10px 0" } },
    bigStat(t, v.games, "mecze przeciwko sobie"),
    bigStat(t, paWins + "W " + pbWins + "L", "bilans " + (pa.nick || pa.summoner)),
    bigStat(t, Math.round(paWinrate * 100) + "%", "winrate vs " + (pb.nick || pb.summoner), paWinrate >= .5 ? t.accent : t.red));
}

function renderCompareView(app) {
  const t = app.theme();
  const players = app.state.agg.players;
  const pa = app.state.cmpA && players[app.state.cmpA];
  const pb = app.state.cmpB && players[app.state.cmpB];
  const rows = pa && pb ? [
    ["KDA", pa.kda, pb.kda, true, (v) => v.toFixed(2)],
    ["Zabójstwa/mecz", pa.avg.k, pb.avg.k, true, (v) => v.toFixed(1)],
    ["Śmierci/mecz", pa.avg.d, pb.avg.d, false, (v) => v.toFixed(1)],
    ["Asysty/mecz", pa.avg.a, pb.avg.a, true, (v) => v.toFixed(1)],
    ["Winrate", pa.winrate * 100, pb.winrate * 100, true, (v) => Math.round(v) + "%"],
    ["CS/min", pa.avg.csPerMin, pb.avg.csPerMin, true, (v) => v.toFixed(1)],
    ["Gold/min", pa.avg.goldPerMin, pb.avg.goldPerMin, true, (v) => Math.round(v)],
    ["DMG w championów", pa.avg.dmgChamp, pb.avg.dmgChamp, true, (v) => fmtK(v)],
    ["Obrażenia otrzymane", pa.avg.dmgTaken, pb.avg.dmgTaken, true, (v) => fmtK(v)],
    ["Vision score", pa.avg.vision, pb.avg.vision, true, (v) => v.toFixed(1)]
  ] : [];
  return h("div", { style: { padding: "34px 40px 60px", maxWidth: 860, margin: "0 auto", animation: "lolFade .35s ease" } },
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 28 } },
      h("div", { style: { textAlign: "center" } }, pa ? profileImg(app, pa, 64) : null, h("div", { style: { marginTop: 10 } }, playerSelect(app, "a", app.state.cmpA))),
      h("div", { style: { fontFamily: t.disp, fontWeight: 800, fontSize: 20, color: t.faint } }, "VS"),
      h("div", { style: { textAlign: "center" } }, pb ? profileImg(app, pb, 64) : null, h("div", { style: { marginTop: 10 } }, playerSelect(app, "b", app.state.cmpB)))),
    !pa || !pb ? app.empty("Wybierz dwóch graczy, aby zobaczyć porównanie.") :
      h("div", null,
        h("div", { style: { background: t.panel, border: "1px solid " + t.line, borderRadius: 16, padding: "20px 24px", marginBottom: 20 } }, rows.map(([label, va, vb, hb, fmt]) => cmpBar(t, label, va || 0, vb || 0, hb, fmt))),
        h("div", { style: { marginBottom: 20 } },
          h("h2", { style: sectionH(t) }, "Wspólne mecze"),
          h("div", { style: { background: t.panel, border: "1px solid " + t.line, borderRadius: 16 } }, duoRecord(app, pa, pb))),
        h("div", null,
          h("h2", { style: sectionH(t) }, "Mecze przeciwko"),
          h("div", { style: { background: t.panel, border: "1px solid " + t.line, borderRadius: 16 } }, versusRecord(app, pa, pb))))
  );
}

window.BrowserViews.compare = renderCompareView;
