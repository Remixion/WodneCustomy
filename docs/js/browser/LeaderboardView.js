/* Ranking (Gracze/Championi/Mapa/Duo) - port renderLeaderboard/renderPlayerBoard/renderChampBoard/renderMapBoard/renderDuos z Match Browser.dc.html. Duo było w oryginale zbudowane, ale nigdzie nie podpięte w nawigacji - tu dopięte jako 4. zakładka. */

function exportRanking(app) {
  const sk = app.state.sortKey;
  let players = Object.values(app.state.agg.players);
  const getV = (p) => sk === "kda" ? p.kda : sk === "winrate" ? p.winrate : sk === "games" ? p.games : (p.avg[sk] || 0);
  players = players.slice().sort((a, b) => getV(b) - getV(a));
  const head = ["rank", "nick", "summoner", "gry", "winrate", "kda", "k/mecz", "d/mecz", "a/mecz", "csPerMin", "goldPerMin", "dmgChamp", "vision"];
  const rows = players.map((p, i) => [i + 1, p.nick, p.summoner, p.games, (p.winrate * 100).toFixed(0) + "%", p.kda.toFixed(2), p.avg.k.toFixed(1), p.avg.d.toFixed(1), p.avg.a.toFixed(1), p.avg.csPerMin.toFixed(1), Math.round(p.avg.goldPerMin), Math.round(p.avg.dmgChamp), p.avg.vision.toFixed(1)]);
  const csv = [head].concat(rows).map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
  try {
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ranking_" + sk + ".csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    app.toast("Wyeksportowano ranking (" + players.length + " graczy)");
  } catch (e) { app.toast("Błąd eksportu", true); }
}

function renderPlayerBoard(app) {
  const t = app.theme();
  const sorts = [["kda", "KDA"], ["k", "Zabójstwa"], ["csPerMin", "CS/min"], ["goldPerMin", "Gold/min"], ["dmgChamp", "DMG"], ["vision", "Vision"], ["winrate", "Winrate"], ["games", "Gry"]];
  let players = Object.values(app.state.agg.players);
  const sk = app.state.sortKey || "kda";
  const getV = (p) => sk === "kda" ? p.kda : sk === "winrate" ? p.winrate : sk === "games" ? p.games : (p.avg[sk] || 0);
  players = players.slice().sort((a, b) => getV(b) - getV(a));
  const fmtVal = (p) => { const v = getV(p); if (sk === "winrate") return Math.round(v * 100) + "%"; if (sk === "games") return v; if (sk === "kda" || sk === "csPerMin") return v.toFixed(2); if (sk === "goldPerMin") return Math.round(v); if (sk === "dmgChamp") return fmtK(v); if (sk === "vision") return v.toFixed(1); return v.toFixed(1); };
  const maxV = Math.max.apply(null, players.map(getV).concat([0.0001]));
  return h("div", null,
    h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22, alignItems: "center" } }, sorts.map(([k, l]) => chip(t, l, sk === k, () => app.setState({ sortKey: k }))),
      h("div", { key: "sp", style: { flex: 1, minWidth: 20 } }),
      h("button", { key: "exp", onClick: () => exportRanking(app), style: { cursor: "pointer", padding: "8px 14px", borderRadius: 999, border: "1px solid " + t.line2, background: "transparent", color: t.text, fontWeight: 700, fontSize: 13, fontFamily: t.disp } }, "↓ Eksport CSV")),
    h("div", { style: { background: t.panel, border: "1px solid " + t.line, borderRadius: 16, overflow: "hidden" } },
      players.map((p, i) => h("div", { key: p.key, onClick: () => app.nav("player", p.puuid || p.nick), style: { display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 90px 90px minmax(160px,220px)", gap: 12, alignItems: "center", padding: "13px 20px", cursor: "pointer", borderBottom: i < players.length - 1 ? "1px solid " + t.line : "none", background: i < 3 ? "rgba(61,220,151,.03)" : "transparent" }, onMouseEnter: (e) => e.currentTarget.style.background = "rgba(255,255,255,.03)", onMouseLeave: (e) => e.currentTarget.style.background = i < 3 ? "rgba(61,220,151,.03)" : "transparent" },
        h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 17, color: i === 0 ? "#E8B84B" : i < 3 ? t.accent : t.faint, textAlign: "center" } }, i + 1),
        h("div", { style: { display: "flex", alignItems: "center", gap: 11, minWidth: 0 } }, profileImg(app, p, 36),
          h("div", { style: { minWidth: 0 } },
            h("div", { style: { fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, p.nick || p.summoner),
            h("div", { style: { fontSize: 11.5, color: t.faint } }, p.summoner))),
        h("div", { style: { textAlign: "center", fontFamily: t.mono, fontSize: 13, color: t.mut } }, p.games + "g"),
        h("div", { style: { textAlign: "center", fontFamily: t.mono, fontSize: 13, color: p.winrate >= .5 ? t.accent : t.red } }, Math.round(p.winrate * 100) + "%"),
        h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
          h("div", { style: { flex: 1, height: 8, background: "rgba(255,255,255,.05)", borderRadius: 20, overflow: "hidden" } }, h("div", { style: { height: "100%", width: (getV(p) / maxV * 100) + "%", background: "linear-gradient(90deg," + t.accent + "88," + t.accent + ")", borderRadius: 20, animation: "lolBar .5s ease", transformOrigin: "left" } })),
          h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 15, minWidth: 58, textAlign: "right", fontVariantNumeric: "tabular-nums" } }, fmtVal(p)))
      ))
    )
  );
}

function renderChampBoard(app) {
  const t = app.theme();
  const sorts = [["games", "Gry"], ["winrate", "Winrate"], ["kda", "KDA"], ["dmgChamp", "Avg DMG"], ["gold", "Avg Gold"], ["cs", "Avg CS"], ["bans", "Bany"]];
  const sk = app.state.champSort || "games";
  let champs = Object.values(app.state.agg.champions).filter((c) => c.games > 0 && c.champId && c.champName && c.champName !== String(c.champId));
  const getV = (c) => sk === "games" ? c.games : sk === "winrate" ? c.winrate : sk === "kda" ? c.kda : sk === "bans" ? (c.bans || 0) : sk === "dmgChamp" ? c.dmgChamp / c.games : sk === "gold" ? c.gold / c.games : sk === "cs" ? c.cs / c.games : 0;
  champs = champs.slice().sort((a, b) => getV(b) - getV(a));
  const maxV = Math.max.apply(null, champs.map(getV).concat([0.0001]));
  const fmtVal = (c) => { const v = getV(c); if (sk === "winrate") return Math.round(v * 100) + "%"; if (sk === "kda") return v.toFixed(2); if (sk === "games" || sk === "bans") return v; if (sk === "cs") return Math.round(v); return fmtK(v); };
  return h("div", null,
    h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22, alignItems: "center" } }, sorts.map(([k, l]) => chip(t, l, sk === k, () => app.setState({ champSort: k })))),
    h("div", { style: { background: t.panel, border: "1px solid " + t.line, borderRadius: 16, overflow: "hidden" } },
      champs.map((c, i) => h("div", { key: c.champId, style: { display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 90px 90px minmax(160px,220px)", gap: 12, alignItems: "center", padding: "12px 20px", borderBottom: i < champs.length - 1 ? "1px solid " + t.line : "none", background: i < 3 ? "rgba(61,220,151,.03)" : "transparent" } },
        h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 17, color: i === 0 ? "#E8B84B" : i < 3 ? t.accent : t.faint, textAlign: "center" } }, i + 1),
        h("div", { style: { display: "flex", alignItems: "center", gap: 11, minWidth: 0 } }, champImg(app, c.champKey, c.champName, 36, 9),
          h("div", { style: { minWidth: 0 } },
            h("div", { style: { fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, c.champName || ("#" + c.champId)),
            h("div", { style: { fontSize: 11.5, color: t.faint, fontFamily: t.mono } }, "KDA " + c.kda.toFixed(2)))),
        h("div", { style: { textAlign: "center", fontFamily: t.mono, fontSize: 13, color: t.mut } }, c.games + "g"),
        h("div", { style: { textAlign: "center", fontFamily: t.mono, fontSize: 13, color: c.winrate >= .5 ? t.accent : t.red } }, Math.round(c.winrate * 100) + "%"),
        h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
          h("div", { style: { flex: 1, height: 8, background: "rgba(255,255,255,.05)", borderRadius: 20, overflow: "hidden" } }, h("div", { style: { height: "100%", width: (getV(c) / maxV * 100) + "%", background: "linear-gradient(90deg," + t.accent + "88," + t.accent + ")", borderRadius: 20, animation: "lolBar .5s ease", transformOrigin: "left" } })),
          h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 15, minWidth: 58, textAlign: "right", fontVariantNumeric: "tabular-nums" } }, fmtVal(c)))
      ))
    )
  );
}

function renderMapBoard(app) {
  const t = app.theme();
  const ms = app.state.matches;
  if (!ms.length) return h("div", { style: { padding: 40, textAlign: "center", color: t.mut } }, "Brak meczów z danymi o celach (smoki, barony, wieże).");
  let blueW = 0, redW = 0;
  ms.forEach((m) => { if (m.winner === "BLUE") blueW++; else redW++; });
  const objs = [["dragon", "Więcej smoków"], ["baron", "Więcej baronów"], ["tower", "Więcej wież"], ["herald", "Więcej heraldów"], ["grubs", "Więcej grubów"], ["inhib", "Więcej inhibitorów"]];
  const objStat = objs.map(([key, lbl]) => {
    let decided = 0, wonWithLead = 0;
    ms.forEach((m) => { const b = m.teams.blue.obj[key] || 0, r = m.teams.red.obj[key] || 0; if (b === r) return; decided++; const leadSide = b > r ? "BLUE" : "RED"; if (m.winner === leadSide) wonWithLead++; });
    return { lbl, decided, wr: decided ? wonWithLead / decided : 0 };
  }).filter((o) => o.decided > 0).sort((a, b) => b.wr - a.wr);
  const dragBuckets = {};
  ms.forEach((m) => { const win = m.winner === "BLUE" ? m.teams.blue : m.teams.red; const d = win.obj.dragon || 0; (dragBuckets[d] = dragBuckets[d] || 0); dragBuckets[d]++; });
  const avg = (key) => (ms.reduce((s, m) => s + (m.teams.blue.obj[key] || 0) + (m.teams.red.obj[key] || 0), 0) / ms.length);
  const avgDur = ms.reduce((s, m) => s + (m.durationSec || 0), 0) / ms.length;

  const card = (title, body) => h("div", { style: { background: t.panel, border: "1px solid " + t.line, borderRadius: 16, padding: "18px 20px" } },
    h("div", { style: { fontFamily: t.disp, fontWeight: 800, fontSize: 15, marginBottom: 14, color: "#eaf4ff", textShadow: "0 0 14px rgba(90,200,255,.4)" } }, title), body);
  const bar2 = (la, va, ca, lb, vb, cb) => { const tot = (va + vb) || 1; return h("div", null,
    h("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 6, fontFamily: t.mono, fontSize: 13 } },
      h("span", { style: { color: ca, fontWeight: 700 } }, la + " " + Math.round(va / tot * 100) + "%"),
      h("span", { style: { color: cb, fontWeight: 700 } }, Math.round(vb / tot * 100) + "% " + lb)),
    h("div", { style: { display: "flex", gap: 3, height: 12 } },
      h("div", { style: { flex: va || .01, background: ca, borderRadius: "20px 4px 4px 20px" } }),
      h("div", { style: { flex: vb || .01, background: cb, borderRadius: "4px 20px 20px 4px" } }))); };
  const row = (lbl, wr, sub) => h("div", { key: lbl, style: { display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid " + t.line } },
    h("span", { style: { width: 150, fontSize: 13, color: t.text, fontWeight: 600 } }, lbl),
    h("div", { style: { flex: 1, height: 8, background: "rgba(255,255,255,.05)", borderRadius: 20, overflow: "hidden" } }, h("div", { style: { height: "100%", width: (wr * 100) + "%", background: wr >= .5 ? t.accent : t.red, borderRadius: 20 } })),
    h("span", { style: { width: 96, textAlign: "right", fontFamily: t.mono, fontSize: 12.5, color: wr >= .5 ? t.accent : t.red } }, Math.round(wr * 100) + "% " + sub));

  return h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 } },
    card("Winrate strony (" + ms.length + " gier)", bar2("Blue", blueW, t.blue, "Red", redW, t.red)),
    card("Średnie na mecz", h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 } },
      [["Smoki", avg("dragon").toFixed(1)], ["Barony", avg("baron").toFixed(1)], ["Wieże", avg("tower").toFixed(1)], ["Herald", avg("herald").toFixed(1)], ["Gruby", avg("grubs").toFixed(1)], ["Czas", fmtTime(Math.round(avgDur))]].map(([l, v]) =>
        h("div", { key: l, style: { textAlign: "center", padding: "8px 4px" } }, h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 22 } }, v), h("div", { style: { fontSize: 10.5, color: t.faint, textTransform: "uppercase", letterSpacing: .8, marginTop: 2 } }, l))))),
    h("div", { style: { gridColumn: "1 / -1" } }, card("Winrate drużyny z przewagą w celu", h("div", null, objStat.map((o) => row(o.lbl, o.wr, "(" + o.decided + "g)"))))),
    h("div", { style: { gridColumn: "1 / -1" } }, card("Ile smoków miała drużyna wygrywająca", h("div", { style: { display: "flex", gap: 8, alignItems: "flex-end", height: 130 } }, (() => {
      const max = Math.max.apply(null, Object.values(dragBuckets).concat([1]));
      return [0, 1, 2, 3, 4].map((d) => { const c = dragBuckets[d] || 0; return h("div", { key: d, style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 } },
        h("span", { style: { fontFamily: t.mono, fontSize: 12, color: t.mut } }, c),
        h("div", { style: { width: "70%", height: (c / max * 96) + "px", minHeight: 3, background: "linear-gradient(180deg," + t.accent + "," + t.accent + "88)", borderRadius: "5px 5px 2px 2px" } }),
        h("span", { style: { fontSize: 12, color: t.faint, fontWeight: 700 } }, d + " 🐲")); });
    })()))));
}

function renderDuosBoard(app) {
  const t = app.theme();
  const duos = (app.state.agg.duos || []).slice(0, 40);
  return duos.length === 0 ? app.empty("Brak duo — potrzeba więcej wspólnych meczów") :
    h("div", { style: { background: t.panel, border: "1px solid " + t.line, borderRadius: 16, overflow: "hidden" } },
      h("div", { style: { display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 90px minmax(140px,220px)", gap: 12, padding: "11px 20px", borderBottom: "1px solid " + t.line, fontSize: 10.5, color: t.faint, textTransform: "uppercase", letterSpacing: .8, fontWeight: 700 } },
        h("div", null, "Duo"), h("div", { style: { textAlign: "center" } }, "Wspólne gry"), h("div", { style: { textAlign: "center" } }, "W-L"), h("div", { style: { textAlign: "right" } }, "Winrate")),
      duos.map((d, i) => h("div", { key: i, style: { display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 90px minmax(140px,220px)", gap: 12, alignItems: "center", padding: "12px 20px", borderBottom: i < duos.length - 1 ? "1px solid " + t.line : "none" } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 } },
          h("div", { onClick: () => app.nav("player", d.a.puuid || d.a.nick), style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer" } }, profileImg(app, d.a, 30), h("span", { style: { fontWeight: 700, fontSize: 13.5 } }, d.a.nick)),
          h("span", { style: { color: t.faint, fontWeight: 700 } }, "+"),
          h("div", { onClick: () => app.nav("player", d.b.puuid || d.b.nick), style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer" } }, profileImg(app, d.b, 30), h("span", { style: { fontWeight: 700, fontSize: 13.5 } }, d.b.nick))),
        h("div", { style: { textAlign: "center", fontFamily: t.mono, fontSize: 14 } }, d.games),
        h("div", { style: { textAlign: "center", fontFamily: t.mono, fontSize: 13, color: t.mut } }, d.wins + "W " + (d.games - d.wins) + "L"),
        h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
          h("div", { style: { flex: 1, height: 8, background: "rgba(255,255,255,.05)", borderRadius: 20, overflow: "hidden" } }, h("div", { style: { height: "100%", width: (d.winrate * 100) + "%", background: d.winrate >= .5 ? t.accent : t.red, borderRadius: 20 } })),
          h("span", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 15, minWidth: 44, textAlign: "right", color: d.winrate >= .5 ? t.accent : t.red } }, Math.round(d.winrate * 100) + "%"))
      )));
}

function renderLeaderboardView(app) {
  const t = app.theme();
  const mode = app.state.lbMode || "players";
  const toggle = h("div", { style: { display: "flex", gap: 8, marginBottom: 18 } }, [["players", "Gracze"], ["champs", "Championi"], ["map", "Mapa"], ["duos", "Duo"]].map(([k, lbl]) =>
    h("button", { key: k, onClick: () => app.setState({ lbMode: k }), style: { cursor: "pointer", padding: "8px 20px", borderRadius: 9, border: "1px solid " + (mode === k ? "rgba(90,200,255,.55)" : t.line2), background: mode === k ? "rgba(90,200,255,.16)" : "transparent", color: mode === k ? "#dff3ff" : t.mut, fontWeight: 700, fontSize: 13.5, fontFamily: t.disp, textShadow: mode === k ? "0 0 8px rgba(90,200,255,.5)" : "none" } }, lbl)));
  return h("div", { style: { padding: "34px 40px 60px", maxWidth: 1080, margin: "0 auto", animation: "lolFade .35s ease" } },
    toggle,
    mode === "champs" ? renderChampBoard(app) : mode === "map" ? renderMapBoard(app) : mode === "duos" ? renderDuosBoard(app) : renderPlayerBoard(app));
}

window.BrowserViews.leaderboard = renderLeaderboardView;
