/* Profil gracza (URL #player/:id) - port renderPlayer/formSection z Match Browser.dc.html. Awatar-stworek i piosenka profilowa to osobny etap (MonsterEditor.js) - tu na razie prosty placeholder z inicjałem. */

function overallAvg(app) {
  const roles = Object.values(app.state.agg.roleAverages);
  const n = roles.reduce((s, r) => s + r.n, 0) || 1;
  const out = {};
  const fields = ["k", "d", "a", "gold", "cs", "dmgChamp", "dmgTaken", "vision", "wardsPlaced", "wardsKilled", "controlWards", "selfMitigated", "healed", "dmgObjectives", "level", "csPerMin", "goldPerMin", "kda"];
  fields.forEach((f) => { out[f] = roles.reduce((s, r) => s + (r[f] || 0) * r.n, 0) / n; });
  return out;
}

function playerAvatar(app, nick, size) {
  return h("div", { onClick: () => openMonsterEditor(app, nick), title: "Kliknij, aby edytować stworka", style: { cursor: "pointer", width: size, height: Math.round(size * 4 / 3), borderRadius: 12, overflow: "hidden", flex: "0 0 auto", background: "#0d0b16", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)", position: "relative" } },
    monsterInline(app, nick),
    h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center", fontSize: 9.5, fontWeight: 800, letterSpacing: .5, color: "#fff", padding: "10px 2px 3px", background: "linear-gradient(to top,rgba(5,4,10,.9),transparent)" } }, "✎ EDYTUJ"));
}

function formSection(app, pl) {
  const t = app.theme();
  const s = pl.streaks || { form: [], current: 0, longestWin: 0, longestLoss: 0 };
  const cur = s.current > 0 ? s.current + " W z rzędu" : s.current < 0 ? Math.abs(s.current) + " L z rzędu" : "—";
  const curCol = s.current > 0 ? t.accent : s.current < 0 ? t.red : t.faint;
  const histAll = pl.matches.slice().sort((a, b) => (a.gid || 0) - (b.gid || 0));
  const WIN = 20;
  const total = histAll.length;
  const maxStart = Math.max(0, total - WIN);
  const start = Math.min(app.state.kdaStart == null ? maxStart : app.state.kdaStart, maxStart);
  const hist = histAll.slice(start, start + WIN);
  const maxK = Math.max.apply(null, hist.map((m) => kdaRatio(m)).concat([1]));
  return h("div", { style: { display: "grid", gridTemplateColumns: "minmax(260px,.85fr) minmax(0,1.6fr)", gap: 24, marginBottom: 28, alignItems: "start" } },
    h("div", null,
      h("h2", { style: sectionH(t) }, "Forma i serie"),
      h("div", { style: { background: t.panel, border: "1px solid " + t.line, borderRadius: 13, padding: "16px 18px" } },
        h("div", { style: { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 16 } }, s.form.length ? s.form.slice(-10).map((w, i) => h("div", { key: i, title: w ? "Wygrana" : "Przegrana", style: { width: 22, height: 22, borderRadius: 6, background: w ? t.accent : "rgba(255,93,108,.85)", color: "#08120D", fontFamily: t.disp, fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" } }, w ? "W" : "L")) : h("span", { style: { color: t.faint, fontSize: 13 } }, "brak gier")),
        h("div", { style: { display: "flex", gap: 22 } },
          h("div", null, h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 18, color: curCol } }, cur), h("div", { style: { fontSize: 10.5, color: t.faint, textTransform: "uppercase", letterSpacing: .8, marginTop: 2 } }, "Aktualnie")),
          h("div", null, h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 18, color: t.accent } }, s.longestWin), h("div", { style: { fontSize: 10.5, color: t.faint, textTransform: "uppercase", letterSpacing: .8, marginTop: 2 } }, "Naj. seria W")),
          h("div", null, h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 18, color: t.red } }, s.longestLoss), h("div", { style: { fontSize: 10.5, color: t.faint, textTransform: "uppercase", letterSpacing: .8, marginTop: 2 } }, "Naj. seria L")))
      ),
      (() => {
        const sd = { blue: { g: 0, w: 0 }, red: { g: 0, w: 0 } };
        (pl.matches || []).forEach((mm) => { const s2 = mm.side === "red" ? "red" : "blue"; sd[s2].g++; if (mm.win) sd[s2].w++; });
        const cell = (side, col, lbl) => { const d = sd[side]; const wr = d.g ? d.w / d.g : 0; return h("div", { key: side, style: { flex: 1, background: t.panel, border: "1px solid " + t.line, borderLeft: "3px solid " + col, borderRadius: 12, padding: "12px 14px" } },
          h("div", { style: { fontSize: 11, color: t.faint, textTransform: "uppercase", letterSpacing: .8, fontWeight: 700, marginBottom: 6 } }, lbl),
          h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 22, color: d.g ? (wr >= .5 ? t.accent : t.red) : t.faint } }, d.g ? Math.round(wr * 100) + "%" : "—"),
          h("div", { style: { fontSize: 11.5, color: t.mut, fontFamily: t.mono, marginTop: 2 } }, d.w + "W " + (d.g - d.w) + "L · " + d.g + "g")); };
        return h("div", { style: { display: "flex", gap: 10, marginTop: 12 } }, cell("blue", t.blue, "Blue side"), cell("red", t.red, "Red side"));
      })()
    ),
    h("div", null,
      h("h2", { style: sectionH(t) }, "KDA w czasie"),
      h("div", { style: { background: t.panel, border: "1px solid " + t.line, borderRadius: 13, padding: "16px 18px" } },
        h("div", { style: { display: "flex", alignItems: "flex-end", gap: 8, height: 118 } }, hist.map((m, i) => {
          const r = kdaRatio(m); const hgt = Math.max(6, (r / maxK) * 96);
          return h("div", { key: start + i, onClick: () => app.nav("match", m.matchId), title: m.champName + " · " + m.k + "/" + m.d + "/" + m.a + " · " + (m.win ? "Wygrana" : "Przegrana"), style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", minWidth: 0 } },
            h("span", { style: { fontFamily: t.mono, fontSize: 10, color: t.mut } }, m.d === 0 ? "∞" : r.toFixed(1)),
            h("div", { style: { width: "100%", maxWidth: 34, height: hgt, borderRadius: "5px 5px 2px 2px", background: m.win ? "linear-gradient(180deg," + t.accent + "," + t.accent + "88)" : "linear-gradient(180deg," + t.red + "," + t.red + "88)", animation: "lolBar .5s ease", transformOrigin: "bottom" } }),
            champImg(app, m.champKey, m.champName, 20, 5));
        })),
        total > WIN ? h("input", { type: "range", min: 0, max: maxStart, value: start, onChange: (e) => app.setState({ kdaStart: +e.target.value }), style: { width: "100%", marginTop: 12, accentColor: t.accent, cursor: "pointer" } }) : null,
        h("div", { style: { fontSize: 11, color: t.faint, marginTop: 10, textAlign: "center" } }, total > WIN ? ("Gry " + (start + 1) + "–" + (start + hist.length) + " z " + total + " · przesuń suwak · klik = mecz") : "Słupek = KDA gry · zielony wygrana, czerwony przegrana · klik = mecz")
      )
    )
  );
}

function renderPlayerView(app, id) {
  const t = app.theme();
  const players = app.state.agg.players;
  const pl = players[id] || Object.values(players).find((x) => x.nick === id || x.puuid === id) || Object.values(players)[0];
  if (!pl) return app.empty("Nie znaleziono gracza");
  const ra = overallAvg(app);
  const av = pl.avg;
  const statRows = [
    ["KDA", pl.kda, avgKda2(ra), true, (v) => v.toFixed(2)],
    ["Zabójstwa / mecz", av.k, ra.k, true, (v) => v.toFixed(1)],
    ["Śmierci / mecz", av.d, ra.d, false, (v) => v.toFixed(1)],
    ["Asysty / mecz", av.a, ra.a, true, (v) => v.toFixed(1)],
    ["CS / min", av.csPerMin, ra.csPerMin, true, (v) => v.toFixed(1)],
    ["Gold / min", av.goldPerMin, ra.goldPerMin, true, (v) => Math.round(v)],
    ["DMG w championów", av.dmgChamp, ra.dmgChamp, true, (v) => fmtK(v)],
    ["Obrażenia otrzymane", av.dmgTaken, ra.dmgTaken, true, (v) => fmtK(v)],
    ["Vision score", av.vision, ra.vision, true, (v) => v.toFixed(1)],
    ["Wardy / mecz", av.wardsPlaced, ra.wardsPlaced, true, (v) => v.toFixed(1)]
  ];
  return h("div", { style: { padding: "30px 40px 60px", maxWidth: 1180, margin: "0 auto", animation: "lolFade .35s ease" } },
    h("button", { onClick: () => app.nav("profiles"), style: backBtn(t) }, "← Profile"),
    h("div", { style: { display: "flex", alignItems: "center", gap: 22, margin: "16px 0 28px", flexWrap: "wrap" } },
      playerAvatar(app, pl.nick || pl.summoner, 84),
      h("div", null,
        h("h1", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 32, margin: 0, letterSpacing: -.8 } }, pl.nick || pl.summoner),
        h("div", { style: { color: t.mut, fontSize: 14, marginTop: 4 } }, pl.summoner + (pl.tag ? " #" + pl.tag : ""))
      ),
      h("div", { style: { flex: 1 } }),
      /* Edycja piosenki profilowej tylko na desktopie - na GitHub Pages każdy odwiedzający ma
         własny, osobny localStorage, więc ustawienie piosenki tam i tak nigdy nie trafi do nikogo
         innego (w tym do "prawdziwej" apki) - lepiej nie pokazywać przycisku, który sugerowałby
         inaczej. Sama automatyczna odtwarzanie już zapisanej piosenki działa bez zmian wszędzie. */
      typeof window.api === "undefined" ? null : h("button", { onClick: () => app.setState({ songEdit: pl.nick || pl.summoner, songDraft: getSong(app, pl.nick || pl.summoner) || "" }), title: "Edytuj piosenkę profilową", style: { cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "9px 15px", borderRadius: 10, border: "1px solid rgba(90,200,255,.4)", background: app.state.songPlaying === (pl.nick || pl.summoner) ? "rgba(90,200,255,.2)" : "rgba(90,200,255,.1)", color: "#dff3ff", fontWeight: 700, fontSize: 13, fontFamily: t.disp, marginRight: 16 } }, "♪ Piosenka"),
      h("div", { style: { display: "flex", gap: 26 } },
        bigStat(t, pl.games, "gier"),
        bigStat(t, Math.round(pl.winrate * 100) + "%", "winrate", pl.winrate >= .5 ? t.accent : t.red),
        bigStat(t, pl.kda.toFixed(2), "KDA", t.accent))
    ),
    formSection(app, pl),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 } },
      h("div", { style: { gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, marginBottom: 2 } },
        h("h2", { style: sectionH(t) }, "Statystyki vs średnia"),
        h("span", { style: { fontSize: 12.5, color: t.mut, fontWeight: 600 } }, "— pionowa kreska = średnia wszystkich graczy")),
      statRows.map(([label, val, avg, hb, fmt]) => h("div", { key: label, style: { background: t.panel, border: "1px solid " + t.line, borderRadius: 13, padding: "14px 16px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 } },
          h("span", { style: { fontSize: 12.5, color: t.mut, fontWeight: 600 } }, label),
          h("span", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 18, fontVariantNumeric: "tabular-nums" } }, fmt(val || 0))),
        avgBar(app, val || 0, avg || 0, hb)))
    ),
    h("div", { style: { display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", gap: 24, alignItems: "start" } },
      h("div", null,
        h("h2", { style: sectionH(t) }, "Winrate wg roli"),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 22 } }, (() => {
          const roles = [["TOP", "Top"], ["JNG", "Jungla"], ["MID", "Mid"], ["BOT", "ADC"], ["SUP", "Support"]];
          const agg = {};
          (pl.matches || []).forEach((mm) => { const r = mm.role || "?"; (agg[r] = agg[r] || { g: 0, w: 0 }); agg[r].g++; if (mm.win) agg[r].w++; });
          const rows = roles.filter(([r]) => agg[r]);
          if (!rows.length) return [h("div", { key: "e", style: { fontSize: 12, color: t.faint } }, "Brak danych")];
          return rows.map(([r, lbl]) => { const a = agg[r]; const wr = a.w / a.g; return h("div", { key: r, style: { display: "flex", alignItems: "center", gap: 10, background: t.panel, border: "1px solid " + t.line, borderRadius: 10, padding: "8px 12px" } },
            h("span", { style: { width: 60, fontWeight: 700, fontSize: 12.5, color: t.mut } }, lbl),
            h("div", { style: { flex: 1, height: 8, background: "rgba(255,255,255,.05)", borderRadius: 20, overflow: "hidden" } }, h("div", { style: { height: "100%", width: (wr * 100) + "%", background: wr >= .5 ? t.accent : t.red, borderRadius: 20 } })),
            h("span", { style: { fontFamily: t.mono, fontSize: 12.5, minWidth: 74, textAlign: "right", color: wr >= .5 ? t.accent : t.red } }, Math.round(wr * 100) + "% · " + a.w + "W " + (a.g - a.w) + "L")); });
        })()),
        h("h2", { style: sectionH(t) }, "Championi"),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, pl.topChamps.filter((c) => c.champId > 0 && c.champName && c.champName !== String(c.champId)).map((c) => h("div", { key: c.champId, style: { display: "flex", alignItems: "center", gap: 12, background: t.panel, border: "1px solid " + t.line, borderRadius: 12, padding: "10px 12px" } },
          champImg(app, c.champKey, c.champName, 38, 9),
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontWeight: 700, fontSize: 13.5 } }, c.champName),
            h("div", { style: { fontSize: 11.5, color: t.faint, fontFamily: t.mono } }, c.games + "g · " + c.wins + "W " + (c.games - c.wins) + "L")),
          h("div", { style: { textAlign: "right", fontFamily: t.mono } },
            h("div", { style: { fontSize: 13, color: t.accent } }, ((c.k + c.a) / Math.max(1, c.d)).toFixed(2)),
            h("div", { style: { fontSize: 11, color: t.faint } }, c.k + "/" + c.d + "/" + c.a)))))
      ),
      h("div", null,
        h("h2", { style: sectionH(t) }, "Historia meczów"),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, pl.matches.slice().sort((a, b) => (b.gid || 0) - (a.gid || 0)).map((mm, i) => h("div", { key: i, onClick: () => app.nav("match", mm.matchId), style: { display: "flex", alignItems: "center", gap: 12, background: t.panel, border: "1px solid " + t.line, borderLeft: "3px solid " + (mm.win ? t.accent : t.red), borderRadius: 12, padding: "10px 14px", cursor: "pointer" }, onMouseEnter: (e) => e.currentTarget.style.background = t.panel2, onMouseLeave: (e) => e.currentTarget.style.background = t.panel },
          champImg(app, mm.champKey, mm.champName, 36, 9),
          h("div", { style: { width: 44 } }, h("span", { style: { fontWeight: 800, fontSize: 12, fontFamily: t.disp, color: mm.win ? t.accent : t.red } }, mm.win ? "WIN" : "LOSS")),
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontWeight: 600, fontSize: 13 } }, mm.champName),
            h("div", { style: { fontSize: 11, color: t.faint, fontFamily: t.mono } }, roleTag(mm.role) + " · " + fmtDate(mm.date))),
          h("div", { style: { textAlign: "right", fontFamily: t.mono } },
            h("div", { style: { fontSize: 13 } }, mm.k + "/" + mm.d + "/" + mm.a),
            h("div", { style: { fontSize: 11, color: t.mut } }, fmtK(mm.dmgChamp) + " dmg")))))
      )
    )
  );
}

window.BrowserViews.player = renderPlayerView;
