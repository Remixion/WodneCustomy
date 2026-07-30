/* Lista meczów + karta meczu + panele drużyn (tabela/karty/macierz) - port renderMatches/matchCard/teamPanel/matrixPanel/scoreRow/scoreCol z Match Browser.dc.html. teamPanel/matrixPanel/scoreRow/scoreCol są też używane przez MatchDetailView.js (stąd globalne funkcje, nie metody klasy). */

function matchMatches(m, q) {
  if (String(m.gid || "").toLowerCase().includes(q)) return true;
  if (String(m.id || "").toLowerCase().includes(q)) return true;
  try {
    const d = new Date(m.date);
    const iso = d.toISOString().slice(0, 10);
    const pl = d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
    const long = d.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
    if ((iso + " " + pl + " " + long).toLowerCase().includes(q)) return true;
  } catch (e) {}
  const players = m.teams.blue.players.concat(m.teams.red.players);
  return players.some((p) => (String(p.nick || "") + " " + String(p.summoner || "") + " " + String(p.champName || "")).toLowerCase().includes(q));
}

function centerCard(el) {
  if (!el) return;
  setTimeout(() => {
    const navH = 64;
    const elRect = el.getBoundingClientRect();
    const target = window.scrollY + elRect.top - Math.max(navH + 16, (window.innerHeight - elRect.height) / 2);
    window.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, 460);
}

function layoutButton(app) {
  const t = app.theme();
  return h("button", { onClick: (e) => { e.stopPropagation(); app.setState((s) => ({ statLayout: s.statLayout === "rows" ? "cols" : s.statLayout === "cols" ? "matrix" : "rows" })); }, style: { cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: "1px solid " + t.line2, background: t.panel2, color: t.text, fontWeight: 700, fontSize: 12.5, fontFamily: t.disp } },
    h("span", { style: { fontSize: 15 } }, app.state.statLayout === "rows" ? "▦" : app.state.statLayout === "cols" ? "▤" : "⊞"),
    app.state.statLayout === "rows" ? "Układ: tabela" : app.state.statLayout === "cols" ? "Układ: karty" : "Układ: macierz");
}

function matchCard(app, m, open) {
  const t = app.theme();
  const win = m.winner === "BLUE" ? m.teams.blue : m.teams.red;
  const winSide = m.winner === "BLUE" ? "blue" : "red";
  const winCol = winSide === "blue" ? t.blue : t.red;
  const clipRest = winSide === "red" ? "polygon(100% 0,100% 100%,40% 100%,54% 0)" : "polygon(0 0,0 100%,60% 100%,46% 0)";
  const clipFull = winSide === "red" ? "polygon(100% 0,100% 100%,-24% 100%,-10% 0)" : "polygon(0 0,0 100%,124% 100%,110% 0)";
  const teamRow = (side) => {
    const tm = m.teams[side]; const col = side === "blue" ? t.blue : t.red; const won = tm.win;
    const k = tm.players.reduce((s, p) => s + p.k, 0), d = tm.players.reduce((s, p) => s + p.d, 0), a = tm.players.reduce((s, p) => s + p.a, 0);
    return h("div", { style: { display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 8, justifyContent: side === "red" ? "flex-end" : "flex-start" } },
        won ? h("span", { style: { fontFamily: t.disp, fontWeight: 800, fontSize: 10.5, padding: "2px 8px", borderRadius: 6, background: col, color: "#08120D", whiteSpace: "nowrap" } }, "WYGRANA") : null,
        h("span", { style: { fontFamily: t.disp, fontWeight: 800, fontSize: 12, color: won ? "#fff" : t.faint } }, side === "blue" ? "BLUE" : "RED"),
        h("span", { style: { fontFamily: t.mono, fontSize: 13, color: won ? t.text : t.faint } }, k + " / " + d + " / " + a)),
      h("div", { style: { display: "flex", gap: 5, minWidth: 0 } }, tm.players.map((p, i) =>
        h("div", { key: i, title: playerName(p) + " · " + p.champName, onClick: (e) => { e.stopPropagation(); app.setState({ playerModal: { m, p, side } }); }, style: { cursor: "pointer", flex: 1, minWidth: 0, position: "relative" } },
          champSplashTile(app, p.champKey, p.champName, "100%", 168, 9),
          h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "16px 5px 5px", fontSize: 11, fontWeight: 700, color: "#fff", textAlign: "center", background: "linear-gradient(to top,rgba(0,0,0,.9),transparent)", borderRadius: "0 0 9px 9px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "none" } }, playerName(p)))
      ))
    );
  };
  const objIcon = (label, blue, red) => h("div", { style: { display: "flex", alignItems: "center", gap: 6, fontFamily: t.mono, fontSize: 12.5 } },
    h("span", { style: { color: t.blue, fontWeight: 700 } }, blue),
    h("span", { style: { color: t.faint, fontSize: 10, textTransform: "uppercase", letterSpacing: .5 } }, label),
    h("span", { style: { color: t.red, fontWeight: 700 } }, red));
  return h("div", {
    key: m.id,
    onClick: (ev) => { const el = ev.currentTarget; const willOpen = app.state.expanded !== m.id; app.setState((s) => ({ expanded: s.expanded === m.id ? null : m.id })); if (willOpen) centerCard(el.parentElement || el); },
    style: { cursor: "pointer", position: "relative", overflow: "hidden", background: t.panel, border: "1px solid " + (open ? t.line2 : t.line), borderRadius: 16, padding: "18px 22px", boxShadow: open ? "0 0 0 1px rgba(90,200,255,.35), 0 12px 40px rgba(20,90,160,.28)" : "0 0 0 1px rgba(90,200,255,.05), 0 8px 24px rgba(0,0,0,.3)", transition: "border-color .2s, transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s", display: "flex", flexDirection: "column", gap: 15 },
    onMouseEnter: (e) => { const ov = e.currentTarget.firstChild; if (ov) { ov.style.willChange = "clip-path"; ov.style.clipPath = clipFull; } e.currentTarget.style.borderColor = winCol + "77"; e.currentTarget.style.boxShadow = "0 14px 40px -18px rgba(0,0,0,.7)"; if (!open) e.currentTarget.style.transform = "translateY(-3px)"; },
    onMouseLeave: (e) => { const ov = e.currentTarget.firstChild; if (ov) { ov.style.clipPath = open ? clipFull : clipRest; setTimeout(() => { if (ov) ov.style.willChange = "auto"; }, 500); } e.currentTarget.style.borderColor = open ? t.line2 : t.line; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }
  },
    h("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(" + (winSide === "red" ? "225deg" : "135deg") + "," + winCol + "44," + winCol + "18)", clipPath: open ? clipFull : clipRest, transition: "clip-path .45s cubic-bezier(.22,1,.36,1)", pointerEvents: "none" } }),
    h("div", { style: { position: "relative", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" } },
      m._noObjectives ? null : h("div", { style: { display: "flex", gap: 16 } }, objIcon("wieże", m.teams.blue.obj.tower, m.teams.red.obj.tower), objIcon("smoki", m.teams.blue.obj.dragon, m.teams.red.obj.dragon), objIcon("barony", m.teams.blue.obj.baron, m.teams.red.obj.baron)),
      h("div", { style: { flex: 1 } }),
      h("span", { style: { color: open ? t.accent : t.faint, fontSize: 13, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none", display: "inline-block" } }, "▾")
    ),
    h("div", { style: { position: "relative", display: "flex", alignItems: "stretch", gap: 14 } },
      teamRow("blue"),
      h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 6px", gap: 8, flex: "0 0 auto", minWidth: 78 } },
        h("span", { style: { fontFamily: t.disp, fontWeight: 700, color: t.faint, fontSize: 13 } }, "VS"),
        h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3 } },
          h("span", { style: { fontFamily: t.mono, color: t.text, fontSize: 12.5, fontWeight: 700 } }, fmtTime(m.durationSec)),
          h("span", { style: { fontFamily: t.mono, color: t.mut, fontSize: 11 } }, fmtDate(m.date)),
          m.gid ? h("span", { style: { fontFamily: t.mono, color: t.mut, fontSize: 11 } }, "GID " + m.gid) : null)),
      teamRow("red")
    )
  );
}

function teamPanel(app, m, side) {
  const t = app.theme();
  const tm = m.teams[side]; const col = side === "blue" ? t.blue : t.red;
  const kills = tm.players.reduce((s, p) => s + p.k, 0);
  const deaths = tm.players.reduce((s, p) => s + p.d, 0);
  const assists = tm.players.reduce((s, p) => s + p.a, 0);
  const gold = tm.players.reduce((s, p) => s + p.gold, 0);
  const maxDmg = Math.max.apply(null, tm.players.map((p) => p.dmgChamp).concat([0]));
  const objs = [["Barony", tm.obj.baron], ["Smoki", tm.obj.dragon], ["Herald", tm.obj.herald], ["Wieże", tm.obj.tower], ["Inhib", tm.obj.inhib]];
  return h("div", { style: { background: t.panel, border: "1px solid " + t.line, borderRadius: 16, overflow: "hidden" } },
    h("div", { style: { display: "flex", alignItems: "center", gap: 16, padding: "16px 22px", background: side === "blue" ? "rgba(76,134,255,.06)" : "rgba(255,93,108,.06)", flexWrap: "wrap" } },
      h("span", { style: { fontFamily: t.disp, fontWeight: 800, fontSize: 16, color: col } }, side === "blue" ? "BLUE TEAM" : "RED TEAM"),
      h("span", { style: { padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 800, fontFamily: t.disp, background: tm.win ? "rgba(61,220,151,.16)" : "rgba(255,255,255,.06)", color: tm.win ? t.accent : t.faint } }, tm.win ? "WIN" : "LOSS"),
      h("span", { style: { fontFamily: t.mono, fontSize: 14, color: t.text } }, kills + " / " + deaths + " / " + assists),
      h("span", { style: { fontFamily: t.mono, fontSize: 13, color: "#E8B84B" } }, fmtK(gold) + " gold"),
      h("div", { style: { flex: 1 } }),
      m._noObjectives ? null : h("div", { style: { display: "flex", gap: 12 } }, objs.map(([l, v]) => h("div", { key: l, style: { textAlign: "center" } },
        h("div", { style: { fontFamily: t.mono, fontWeight: 700, fontSize: 15, color: v ? t.text : t.faint } }, v),
        h("div", { style: { fontSize: 9.5, color: t.faint, textTransform: "uppercase", letterSpacing: .5 } }, l)))),
      m._noObjectives ? null : h("div", { style: { display: "flex", alignItems: "center", gap: 6, marginLeft: 8 } },
        h("span", { style: { fontSize: 10, color: t.faint, textTransform: "uppercase", letterSpacing: .5 } }, "Bany"),
        m.bans[side].map((b, i) => b > 0 ? h("div", { key: i, style: { position: "relative" } }, champImg(app, (app.state.statics.champById[b] || [])[0], (app.state.statics.champById[b] || ["", "?"])[1], 22, 5)) : h("div", { key: i, style: { width: 22, height: 22, borderRadius: 5, background: "rgba(255,255,255,.03)", boxShadow: "inset 0 0 0 1px " + t.line } })))
    ),
    app.state.statLayout === "cols"
      ? h("div", { className: "lolscroll", style: { display: "flex", gap: 10, padding: "14px 22px", overflowX: "auto" } }, tm.players.map((p, i) => scoreCol(app, m, p, side, maxDmg, i)))
      : h("div", { className: "lolscroll", style: { overflowX: "auto" } },
        h("div", { style: { display: "grid", gridTemplateColumns: "minmax(210px,1.6fr) 92px 74px repeat(3, minmax(70px,1fr)) minmax(120px,150px)", minWidth: 720, gap: 0, padding: "8px 22px", borderBottom: "1px solid " + t.line, fontSize: 10.5, color: t.faint, textTransform: "uppercase", letterSpacing: .8, fontWeight: 700 } },
          h("div", null, "Gracz"), h("div", { style: { textAlign: "center" } }, "KDA"), h("div", { style: { textAlign: "center" } }, "CS"), h("div", { style: { textAlign: "center" } }, "Gold"), h("div", { style: { textAlign: "center" } }, "DMG"), h("div", { style: { textAlign: "center" } }, "Vis"), h("div", { style: { textAlign: "right" } }, "Itemy")),
        tm.players.map((p, i) => scoreRow(app, m, p, side, maxDmg, i))
      )
  );
}

function scoreCol(app, m, p, side, maxDmg, i) {
  const t = app.theme();
  const ra = app.state.agg.roleAverages[p.role];
  const kda = kdaRatio(p);
  const csPerMin = p.cs / (m.durationSec / 60 || 1);
  const rows = [
    ["KDA", p.k + "/" + p.d + "/" + p.a, (p.d === 0 ? "PERF" : kda.toFixed(2)), kda >= (ra ? avgKda(ra) : 0)],
    ["CS", String(p.cs), csPerMin.toFixed(1) + "/m", null],
    ["Gold", fmtK(p.gold), null, null],
    ["DMG", fmtK(p.dmgChamp), null, null],
    ["Vision", String(p.vision || 0), (p.wardsPlaced || 0) + "/" + (p.wardsKilled || 0), null]
  ];
  return h("div", { key: i, onClick: () => app.setState({ playerModal: { m, p, side } }), style: { flex: "1 1 0", minWidth: 148, background: t.panel2, borderRadius: 12, border: "1px solid " + t.line, overflow: "hidden", cursor: "pointer", transition: "border-color .15s" }, onMouseEnter: (e) => e.currentTarget.style.borderColor = t.line2, onMouseLeave: (e) => e.currentTarget.style.borderColor = t.line },
    h("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid " + t.line } },
      h("div", { style: { position: "relative" } }, champImg(app, p.champKey, p.champName, 36, 9),
        h("span", { style: { position: "absolute", bottom: -3, right: -3, background: t.elev, color: t.text, fontFamily: t.mono, fontSize: 9.5, fontWeight: 700, padding: "1px 4px", borderRadius: 5, boxShadow: "0 0 0 1px " + t.line } }, p.level)),
      h("div", { style: { minWidth: 0, flex: 1 } },
        h("div", { style: { fontWeight: 700, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, playerName(p)),
        h("div", { style: { fontSize: 10.5, color: t.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, roleTag(p.role) + " · " + p.champName)),
      h("div", { style: { display: "flex", gap: 3, alignItems: "center", flex: "0 0 auto" } }, spellImg(app, p.spell1, 15), spellImg(app, p.spell2, 15), runeImg(app, p.keystone, 17))),
    h("div", { style: { padding: "6px 12px" } }, rows.map(([label, val, sub, good]) =>
      h("div", { key: label, style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid " + t.line } },
        h("span", { style: { fontSize: 10.5, color: t.faint, textTransform: "uppercase", letterSpacing: .6, fontWeight: 700 } }, label),
        h("span", { style: { display: "flex", alignItems: "baseline", gap: 6, fontFamily: t.mono } },
          sub ? h("span", { style: { fontSize: 10, color: good === true ? t.accent : t.faint } }, sub) : null,
          h("span", { style: { fontSize: 13, color: good === true ? t.accent : t.text } }, val))))),
    h("div", { style: { display: "flex", gap: 3, flexWrap: "wrap", padding: "8px 12px 12px" } }, (p.items && p.items.length ? p.items : [0, 0, 0, 0, 0, 0, 0]).map((it, k) => h("div", { key: k }, itemImg(app, it, 22))))
  );
}

function scoreRow(app, m, p, side, maxDmg, i) {
  const t = app.theme();
  const ra = app.state.agg.roleAverages[p.role];
  const kda = kdaRatio(p);
  const dmgPct = maxDmg ? (p.dmgChamp / maxDmg) * 100 : 0;
  const csPerMin = p.cs / (m.durationSec / 60 || 1);
  return h("div", { key: i, onClick: () => app.setState({ playerModal: { m, p, side } }), style: { display: "grid", gridTemplateColumns: "minmax(210px,1.6fr) 92px 74px repeat(3, minmax(70px,1fr)) minmax(120px,150px)", minWidth: 720, gap: 0, padding: "11px 22px", alignItems: "center", cursor: "pointer", borderBottom: i < 4 ? "1px solid " + t.line : "none", transition: "background .12s" }, onMouseEnter: (e) => e.currentTarget.style.background = "rgba(255,255,255,.025)", onMouseLeave: (e) => e.currentTarget.style.background = "transparent" },
    h("div", { style: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 } },
      h("div", { style: { position: "relative" } }, champImg(app, p.champKey, p.champName, 40, 10),
        h("span", { style: { position: "absolute", bottom: -3, right: -3, background: t.elev, color: t.text, fontFamily: t.mono, fontSize: 10, fontWeight: 700, padding: "1px 4px", borderRadius: 5, boxShadow: "0 0 0 1px " + t.line } }, p.level)),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 3 } }, spellImg(app, p.spell1, 17), spellImg(app, p.spell2, 17)),
      runeImg(app, p.keystone, 19),
      h("div", { style: { minWidth: 0 } },
        h("div", { style: { fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, playerName(p)),
        h("div", { style: { fontSize: 11, color: t.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, roleTag(p.role) + " · " + p.champName))
    ),
    h("div", { style: { textAlign: "center" } },
      h("div", { style: { fontFamily: t.mono, fontSize: 13.5 } }, p.k + "/" + p.d + "/" + p.a),
      h("div", { style: { fontSize: 11, color: kda >= (ra ? avgKda(ra) : 0) ? t.accent : t.faint, fontFamily: t.mono, marginTop: 1 } }, (p.d === 0 ? "PERF" : kda.toFixed(2)))),
    h("div", { style: { textAlign: "center", fontFamily: t.mono } },
      h("div", { style: { fontSize: 13 } }, p.cs),
      h("div", { style: { fontSize: 10.5, color: t.faint } }, csPerMin.toFixed(1) + "/m")),
    h("div", { style: { textAlign: "center", fontFamily: t.mono, fontSize: 13, color: "#E8B84B" } }, fmtK(p.gold)),
    h("div", { style: { textAlign: "center", fontFamily: t.mono } },
      h("div", { style: { fontSize: 13 } }, fmtK(p.dmgChamp)),
      h("div", { style: { height: 4, borderRadius: 3, background: "rgba(255,255,255,.06)", marginTop: 4, overflow: "hidden" } }, h("div", { style: { height: "100%", width: dmgPct + "%", background: side === "blue" ? t.blue : t.red, borderRadius: 3 } }))),
    h("div", { style: { textAlign: "center", fontFamily: t.mono } },
      h("div", { style: { fontSize: 13, color: t.text } }, p.vision || 0),
      h("div", { style: { fontSize: 10.5, color: t.faint } }, (p.wardsPlaced || 0) + "/" + (p.wardsKilled || 0))),
    h("div", { style: { display: "flex", gap: 3, justifyContent: "flex-end" } }, (p.items && p.items.length ? p.items : [0, 0, 0, 0, 0, 0, 0]).map((it, k) => h("div", { key: k }, itemImg(app, it, 24))))
  );
}

function matrixPanel(app, m) {
  const t = app.theme();
  const blue = m.teams.blue.players, red = m.teams.red.players;
  const all = blue.concat(red);
  const teamKills = { blue: Math.max(1, blue.reduce((s, p) => s + p.k, 0)), red: Math.max(1, red.reduce((s, p) => s + p.k, 0)) };
  const mins = (m.durationSec || 1) / 60;
  const cols = "repeat(5, minmax(78px,1fr)) 96px repeat(5, minmax(78px,1fr))";
  const maxOf = (f) => Math.max.apply(null, all.map(f).concat([0.0001]));
  const maxDmg = maxOf((p) => p.dmgChamp), maxTaken = maxOf((p) => p.dmgTaken), maxGold = maxOf((p) => p.gold);
  const maxObj = maxOf((p) => p.dmgObjectives || 0), maxHeal = maxOf((p) => p.healed || 0), maxMit = maxOf((p) => p.selfMitigated || 0);
  const barCol = (side) => side === "blue" ? t.blue : t.accent;

  const kp = (p, side) => Math.round(((p.k + p.a) / teamKills[side]) * 100) + "%";
  const rows = [
    { key: "KDA", side: (p) => (p.d === 0 ? "PERF" : ((p.k + p.a) / p.d).toFixed(2)) },
    { key: "DMG DEALT", side: (p) => fmtK(p.dmgChamp), bar: (p) => p.dmgChamp / maxDmg },
    { key: "DMG/MIN", side: (p) => fmtK(p.dmgChamp / mins) },
    { key: "DMG TAKEN", side: (p) => fmtK(p.dmgTaken), bar: (p) => p.dmgTaken / maxTaken, faint: true },
    { key: "SELF MITIGATED", side: (p) => fmtK(p.selfMitigated), bar: (p) => (p.selfMitigated || 0) / maxMit, faint: true },
    { key: "HEALING", side: (p) => fmtK(p.healed), bar: (p) => (p.healed || 0) / maxHeal, faint: true },
    { key: "OBJ DMG", side: (p) => fmtK(p.dmgObjectives || 0), bar: (p) => (p.dmgObjectives || 0) / maxObj, faint: true },
    { key: "GOLD", side: (p) => fmtK(p.gold), bar: (p) => p.gold / maxGold, faint: true },
    { key: "GOLD/MIN", side: (p) => Math.round(p.gold / mins) },
    { key: "CS", side: (p) => String(p.cs) },
    { key: "CS/MIN", side: (p) => (p.cs / mins).toFixed(1) },
    { key: "VISION", side: (p) => String(p.vision || 0) },
    { key: "WARDS", side: (p) => (p.wardsPlaced || 0) + " / " + (p.wardsKilled || 0) },
    { key: "CTRL WARDS", side: (p) => String(p.controlWards || 0) },
    { key: "MULTIKILL", side: (p) => { const mk = p.pentas ? "PENTA" : p.quadras ? "QUADRA" : p.triples ? "TRIPLE" : p.doubles ? "DOUBLE" : (p.largestMulti > 1 ? p.largestMulti + "x" : "—"); return mk; } },
    { key: "BEST SPREE", side: (p) => String(p.largestSpree || 0) },
    { key: "KILL PART.", side: (p, s) => kp(p, s) }
  ];

  const header = (p, side) => h("div", { key: side + p.puuid + p.champId, onClick: () => app.setState({ playerModal: { m, p, side } }), style: { cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 4px 12px", minWidth: 0 } },
    h("div", { style: { position: "relative" } }, champImg(app, p.champKey, p.champName, 44, 11),
      h("span", { style: { position: "absolute", bottom: -3, right: -3, background: t.elev, color: t.text, fontFamily: t.mono, fontSize: 9.5, fontWeight: 700, padding: "1px 4px", borderRadius: 5, boxShadow: "0 0 0 1px " + t.line } }, p.level)),
    h("div", { style: { display: "flex", gap: 3, alignItems: "center" } }, spellImg(app, p.spell1, 16), spellImg(app, p.spell2, 16), runeImg(app, p.keystone, 18)),
    h("div", { style: { fontSize: 11.5, fontWeight: 700, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" } }, playerName(p)),
    h("div", { style: { fontFamily: t.mono, fontSize: 11, color: t.text } }, p.k + "/" + p.d + "/" + p.a));

  const itemCell = (p, side) => h("div", { key: "it" + side + p.champId, style: { display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center", padding: "8px 4px" } }, (p.items && p.items.length ? p.items : [0, 0, 0, 0, 0, 0, 0]).slice(0, 7).map((it, k) => h("div", { key: k }, itemImg(app, it, 20))));

  const valCell = (p, side, r) => {
    const v = r.side(p, side);
    const barPct = r.bar ? Math.max(3, r.bar(p) * 100) : 0;
    return h("div", { key: r.key + side + p.champId, style: { display: "flex", flexDirection: "column", alignItems: "center", gap: r.bar ? 5 : 0, padding: "7px 6px" } },
      h("span", { style: { fontFamily: t.mono, fontSize: 12.5, color: r.faint ? t.mut : t.text } }, v),
      r.bar ? h("div", { style: { width: "82%", height: 3, borderRadius: 3, background: "rgba(255,255,255,.07)", overflow: "hidden" } }, h("div", { style: { height: "100%", width: barPct + "%", background: barCol(side), borderRadius: 3, marginLeft: side === "red" ? "auto" : 0 } })) : null);
  };

  const label = (txt) => h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: t.faint, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 } }, txt);

  const rowBlock = (content, i, isHeader) => h("div", { key: i, style: { display: "grid", gridTemplateColumns: cols, alignItems: "center", borderBottom: "1px solid " + t.line, background: (!isHeader && i % 2) ? "rgba(255,255,255,.015)" : "transparent" } }, content);

  return h("div", { style: { background: t.panel, border: "1px solid " + t.line, borderRadius: 16, overflow: "hidden" } },
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 96px 1fr", alignItems: "center", padding: "12px 22px", borderBottom: "1px solid " + t.line } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
        h("span", { style: { fontFamily: t.disp, fontWeight: 800, fontSize: 15, color: t.blue } }, "BLUE"),
        h("span", { style: { padding: "2px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 800, fontFamily: t.disp, background: m.teams.blue.win ? "rgba(61,220,151,.16)" : "rgba(255,255,255,.06)", color: m.teams.blue.win ? t.accent : t.faint } }, m.teams.blue.win ? "WYGRANA" : "PORAŻKA")),
      h("div", null),
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" } },
        h("span", { style: { padding: "2px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 800, fontFamily: t.disp, background: m.teams.red.win ? "rgba(61,220,151,.16)" : "rgba(255,255,255,.06)", color: m.teams.red.win ? t.accent : t.faint } }, m.teams.red.win ? "WYGRANA" : "PORAŻKA"),
        h("span", { style: { fontFamily: t.disp, fontWeight: 800, fontSize: 15, color: t.red } }, "RED"))),
    h("div", { className: "lolscroll", style: { overflowX: "auto" } },
      h("div", { style: { minWidth: 900 } },
        rowBlock([].concat(blue.map((p) => header(p, "blue")), [label("PLAYER")], red.map((p) => header(p, "red"))), "h", true),
        rowBlock([].concat(blue.map((p) => itemCell(p, "blue")), [label("ITEMS")], red.map((p) => itemCell(p, "red"))), "items", false),
        rows.map((r, ri) => rowBlock([].concat(blue.map((p) => valCell(p, "blue", r)), [label(r.key)], red.map((p) => valCell(p, "red", r))), ri, false))
      ))
  );
}

function renderMatchesView(app) {
  const t = app.theme();
  const q = (app.state.search || "").trim().toLowerCase();
  let matches = app.state.matches.slice().sort((a, b) => (b.gid || 0) - (a.gid || 0));
  if (q) matches = matches.filter((m) => matchMatches(m, q));
  return h("div", { style: { padding: "34px 40px 60px", maxWidth: 1180, margin: "0 auto", animation: "lolFade .35s ease" } },
    h("div", { style: { position: "relative", marginBottom: 22 } },
      h("span", { style: { position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: t.faint, fontSize: 15, pointerEvents: "none" } }, "⌕"),
      h("input", { value: app.state.search, onChange: (e) => app.setState({ search: e.target.value }), placeholder: "Szukaj: nick, postać, GID, ID gry, data (np. Kosior, Ashe, 42, 2026-07)", spellCheck: false, style: { width: "100%", background: t.panel, border: "1px solid " + t.line2, borderRadius: 12, padding: "13px 42px 13px 42px", color: t.text, fontSize: 14, fontFamily: t.disp, outline: "none" } }),
      app.state.search ? h("button", { onClick: () => app.setState({ search: "" }), style: { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", cursor: "pointer", border: "none", background: "transparent", color: t.faint, fontSize: 15 } }, "✕") : null),
    matches.length === 0 ? app.empty("Brak meczów dla „" + app.state.search + "”") :
      h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } }, matches.map((m) => {
        const open = app.state.expanded === m.id;
        return h("div", { key: m.id, className: "lol-card-wrap", style: { display: "flex", flexDirection: "column" } },
          matchCard(app, m, open),
          open ? h("div", { key: "exp", style: { marginTop: 12, animation: "lolFade .3s cubic-bezier(.22,1,.36,1)" } },
            h("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 10, gap: 8 } }, matchActionsButton(app, m), layoutButton(app)),
            app.state.statLayout === "matrix"
              ? matrixPanel(app, m)
              : h(React.Fragment, null,
                teamPanel(app, m, "blue"),
                h("div", { style: { height: 12 } }),
                teamPanel(app, m, "red"))
          ) : null
        );
      }))
  );
}

window.BrowserViews.matches = renderMatchesView;
