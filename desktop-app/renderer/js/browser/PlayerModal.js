/* Modal jednego gracza w jednym meczu (klik na gracza w liście/szczegółach meczu) - port renderPlayerModal z Match Browser.dc.html. Porównanie "vs średnia" liczone per champion (agg.champions[champId].avg), nie per rola - inne niż profil gracza. */

function renderPlayerModal(app) {
  const t = app.theme();
  const { m, p, side } = app.state.playerModal;
  const close = () => app.setState({ playerModal: null });
  const ra = (app.state.agg.champions[p.champId] && app.state.agg.champions[p.champId].avg) || {};
  const mins = (m.durationSec || 1) / 60;
  const kda = kdaRatio(p);
  const csPerMin = p.cs / mins;
  const goldPerMin = p.gold / mins;
  const rows = [
    ["Zabójstwa", p.k, ra.k, true, (v) => v],
    ["Śmierci", p.d, ra.d, false, (v) => v],
    ["Asysty", p.a, ra.a, true, (v) => v],
    ["KDA", kda, avgKda2(ra), true, (v) => (p.d === 0 ? "PERF" : v.toFixed(2))],
    ["CS", p.cs, ra.cs, true, (v) => v],
    ["CS / min", csPerMin, ra.csPerMin, true, (v) => v.toFixed(1)],
    ["Złoto", p.gold, ra.gold, true, (v) => fmtK(v)],
    ["Gold / min", goldPerMin, ra.goldPerMin, true, (v) => Math.round(v)],
    ["Obrażenia w championów", p.dmgChamp, ra.dmgChamp, true, (v) => fmtK(v)],
    ["Obrażenia otrzymane", p.dmgTaken, ra.dmgTaken, true, (v) => fmtK(v)],
    ["Obrażenia w cele", p.dmgObjectives, ra.dmgObjectives, true, (v) => fmtK(v)],
    ["Obrażenia zablokowane", p.selfMitigated, ra.selfMitigated, true, (v) => fmtK(v)],
    ["Leczenie", p.healed, ra.healed, true, (v) => fmtK(v)],
    ["Vision score", p.vision, ra.vision, true, (v) => v],
    ["Wardy postawione", p.wardsPlaced, ra.wardsPlaced, true, (v) => v],
    ["Wardy zniszczone", p.wardsKilled, ra.wardsKilled, true, (v) => v],
    ["Control wardy", p.controlWards, ra.controlWards, true, (v) => v],
    ["Poziom", p.level, ra.level, true, (v) => v]
  ];
  const multi = [];
  if (p.pentas) multi.push(["Pentakille", p.pentas]);
  if (p.quadras) multi.push(["Quadrakille", p.quadras]);
  if (p.triples) multi.push(["Triplekille", p.triples]);
  if (p.doubles) multi.push(["Doublekille", p.doubles]);
  multi.push(["Naj. seria", p.largestSpree]);
  multi.push(["Naj. multikill", p.largestMulti]);
  const badges = [];
  if (p.firstBlood) badges.push("First Blood");
  if (p.firstTower) badges.push("First Tower");

  return h("div", { onClick: close, style: { position: "fixed", inset: 0, zIndex: 55, background: "rgba(8,9,12,.78)", backdropFilter: "blur(5px)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "42px 20px", animation: "lolFade .2s ease" }, className: "lolscroll" },
    h("div", { onClick: (e) => e.stopPropagation(), style: { width: "100%", maxWidth: 620, background: t.panel, border: "1px solid " + t.line2, borderRadius: 20, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.6)", animation: "lolPop .22s ease" } },
      h("div", { style: { position: "relative", padding: "22px 24px", background: side === "blue" ? "linear-gradient(135deg,rgba(76,134,255,.16),rgba(76,134,255,.02))" : "linear-gradient(135deg,rgba(255,93,108,.16),rgba(255,93,108,.02))", borderBottom: "1px solid " + t.line } },
        h("button", { onClick: close, style: { position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 9, border: "1px solid " + t.line2, background: "rgba(0,0,0,.25)", color: t.text, cursor: "pointer", fontSize: 16, lineHeight: 1 } }, "✕"),
        h("div", { style: { display: "flex", alignItems: "center", gap: 15 } },
          h("div", { style: { position: "relative" } }, champImg(app, p.champKey, p.champName, 62, 14),
            h("span", { style: { position: "absolute", bottom: -4, right: -4, background: t.elev, color: t.text, fontFamily: t.mono, fontSize: 11, fontWeight: 700, padding: "1px 5px", borderRadius: 6, boxShadow: "0 0 0 1px " + t.line } }, p.level)),
          h("div", { style: { minWidth: 0 } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" } },
              h("span", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 21, letterSpacing: -.4 } }, playerName(p)),
              h("span", { style: { padding: "2px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 800, fontFamily: t.disp, background: p.win ? "rgba(61,220,151,.16)" : "rgba(255,255,255,.06)", color: p.win ? t.accent : t.faint } }, p.win ? "WYGRANA" : "PRZEGRANA")),
            h("div", { style: { fontSize: 13, color: t.mut, marginTop: 3 } }, roleTag(p.role) + " · " + p.champName + " · " + p.summoner)),
          h("div", { style: { flex: 1 } }),
          h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 } },
            h("div", { style: { display: "flex", gap: 5, marginTop: 44 } }, spellImg(app, p.spell1, 26), spellImg(app, p.spell2, 26), runeImg(app, p.keystone, 28)),
            h("div", { style: { fontFamily: t.mono, fontSize: 18, fontWeight: 700 } }, p.k + "/" + p.d + "/" + p.a))
        ),
        h("div", { style: { display: "flex", gap: 5, marginTop: 16 } }, (p.items && p.items.length ? p.items : [0, 0, 0, 0, 0, 0, 0]).map((it, k) => h("div", { key: k }, itemImg(app, it, 34)))),
        badges.length ? h("div", { style: { display: "flex", gap: 6, marginTop: 12 } }, badges.map((b) => h("span", { key: b, style: { padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(232,184,75,.14)", color: "#E8B84B" } }, "★ " + b))) : null
      ),
      h("div", { style: { padding: "18px 24px" } },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 } },
          h("h3", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 14, margin: 0, letterSpacing: -.2 } }, "Statystyki w tym meczu"),
          h("span", { style: { fontSize: 11, color: t.faint } }, "kreska = średnia dla " + p.champName)),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 22px" } }, rows.map(([label, val, avg, hb, fmt]) =>
          h("div", { key: label },
            h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 } },
              h("span", { style: { fontSize: 12, color: t.mut, fontWeight: 600 } }, label),
              h("span", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 15, fontVariantNumeric: "tabular-nums" } }, fmt(val || 0))),
            avgBar(app, val || 0, avg || 0, hb))
        )),
        h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18, paddingTop: 16, borderTop: "1px solid " + t.line } }, multi.map(([l, v]) =>
          h("div", { key: l, style: { flex: "1 1 auto", minWidth: 82, background: t.panel2, borderRadius: 11, padding: "10px 12px", textAlign: "center" } },
            h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 18, color: v ? t.text : t.faint } }, v),
            h("div", { style: { fontSize: 10, color: t.faint, textTransform: "uppercase", letterSpacing: .6, marginTop: 2 } }, l)))
        ),
        h("div", { style: { display: "flex", gap: 10, marginTop: 18 } },
          h("button", { onClick: () => { close(); app.nav("player", p.puuid || p.nick); }, style: { flex: 1, cursor: "pointer", padding: "12px", borderRadius: 11, border: "none", background: t.accent, color: "#08120D", boxShadow: "0 0 16px " + t.accent + "66", fontWeight: 800, fontSize: 14, fontFamily: t.disp } }, "Pełny profil gracza →"),
          h("button", { onClick: close, style: { cursor: "pointer", padding: "12px 20px", borderRadius: 11, border: "1px solid " + t.line2, background: "transparent", color: t.mut, fontWeight: 700, fontSize: 14, fontFamily: t.disp } }, "Zamknij"))
      )
    )
  );
}

window.BrowserViews.playerModal = renderPlayerModal;
