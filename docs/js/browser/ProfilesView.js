/* Siatka profili graczy (#profiles) - port renderProfiles z Match Browser.dc.html. */

function profileCard(app, p) {
  const t = app.theme();
  const top3 = p.topChamps.filter((c) => c.champId > 0 && c.champName && c.champName !== String(c.champId)).slice(0, 3);
  return h("div", {
    key: p.key, onClick: () => app.nav("player", p.puuid || p.nick),
    style: { background: t.panel, border: "1px solid " + t.line, borderRadius: 16, padding: "18px 20px", cursor: "pointer", transition: "all .15s" },
    onMouseEnter: (e) => { e.currentTarget.style.background = t.panel2; e.currentTarget.style.borderColor = t.line2; },
    onMouseLeave: (e) => { e.currentTarget.style.background = t.panel; e.currentTarget.style.borderColor = t.line; }
  },
    h("div", { style: { display: "flex", alignItems: "center", gap: 13 } },
      profileImg(app, p, 52),
      h("div", { style: { minWidth: 0, flex: 1 } },
        h("div", { style: { fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, p.nick || p.summoner),
        h("div", { style: { fontSize: 11.5, color: t.faint, marginTop: 2 } }, roleTag(p.mainRole) + " · " + p.games + " " + plural(p.games, "gra", "gry", "gier"))),
      h("div", { style: { textAlign: "right" } },
        h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 18, color: p.winrate >= .5 ? t.accent : t.red } }, Math.round(p.winrate * 100) + "%"),
        h("div", { style: { fontSize: 10.5, color: t.faint } }, "winrate"))),
    h("div", { style: { display: "flex", gap: 18, margin: "16px 0 14px", paddingTop: 14, borderTop: "1px solid " + t.line } },
      bigStat(t, p.kda.toFixed(2), "KDA", t.accent),
      bigStat(t, Math.round(p.avg.csPerMin || 0) === 0 ? (p.avg.csPerMin || 0).toFixed(1) : (p.avg.csPerMin || 0).toFixed(1), "CS/min"),
      bigStat(t, fmtK(p.avg.dmgChamp || 0), "DMG")),
    top3.length ? h("div", { style: { display: "flex", gap: 8 } }, top3.map((c) => h("div", { key: c.champId, title: c.champName + " · " + c.games + "g", style: { display: "flex", alignItems: "center", gap: 6 } }, champImg(app, c.champKey, c.champName, 26, 7), h("span", { style: { fontSize: 11, color: t.faint, fontFamily: t.mono } }, c.games)))) : null
  );
}

function renderProfilesView(app) {
  const t = app.theme();
  const q = (app.state.profileSearch || "").trim().toLowerCase();
  let players = Object.values(app.state.agg.players);
  if (q) players = players.filter((p) => (p.nick || "").toLowerCase().includes(q) || (p.summoner || "").toLowerCase().includes(q));
  players = players.sort((a, b) => b.games - a.games || (a.nick || "").localeCompare(b.nick || ""));
  return h("div", { style: { padding: "34px 40px 60px", maxWidth: 1180, margin: "0 auto", animation: "lolFade .35s ease" } },
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 14, marginBottom: 22, flexWrap: "wrap" } },
      h("input", { value: app.state.profileSearch || "", onChange: (e) => app.setState({ profileSearch: e.target.value }), placeholder: "Szukaj gracza…", style: { background: t.panel, border: "1px solid " + t.line2, color: t.text, borderRadius: 9, padding: "9px 14px", fontSize: 13.5, width: 220, outline: "none" } })),
    players.length === 0 ? app.empty("Brak graczy") :
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 } }, players.map((p) => profileCard(app, p)))
  );
}

window.BrowserViews.profiles = renderProfilesView;
