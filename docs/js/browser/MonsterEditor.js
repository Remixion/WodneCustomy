/* Stworki-awatary (monsters.js) - port monsterInline/monsterImg/renderMonsterEditor/open-set-save-resetMonster z Match Browser.dc.html. monsters.js jest samodzielny (offline, bez zależności od naszych danych) i skopiowany bez zmian do js/monsters.js. */

function monsterInline(app, nick, style) {
  let svg = (window.Monsters && window.Monsters.svgFor) ? window.Monsters.svgFor(nick) : "";
  svg = svg.replace('width="300" height="400"', 'width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="display:block"');
  return h("div", { dangerouslySetInnerHTML: { __html: svg }, style: Object.assign({ lineHeight: 0, width: "100%", height: "100%" }, style || {}) });
}
function monsterImg(app, nick, size) {
  const uri = (window.Monsters && window.Monsters.svgUriFor) ? window.Monsters.svgUriFor(nick) : "";
  return h("div", { style: { width: size, height: Math.round(size * 4 / 3), borderRadius: 10, overflow: "hidden", flex: "0 0 auto", background: "#0d0b16", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" } },
    uri ? h("img", { src: uri, alt: nick, loading: "lazy", decoding: "async", style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } }) : null);
}

function openMonsterEditor(app, nick) {
  const params = JSON.parse(JSON.stringify(window.Monsters.paramsFor(nick)));
  app.setState({ monsterEdit: { nick, params } });
}
function setMonsterParam(app, patch) {
  const me = app.state.monsterEdit; if (!me) return;
  app.setState({ monsterEdit: { nick: me.nick, params: Object.assign({}, me.params, patch) } });
}
function setMonsterSize(app, key, val) {
  const me = app.state.monsterEdit; if (!me) return;
  const sizes = Object.assign({}, me.params.sizes, { [key]: +val });
  app.setState({ monsterEdit: { nick: me.nick, params: Object.assign({}, me.params, { sizes }) } });
}
function saveMonster(app) {
  const me = app.state.monsterEdit; if (!me) return;
  window.Monsters.setOverride(me.nick, me.params);
  app.setState({ monsterEdit: null });
  app.toast("Zapisano stworka");
}
function resetMonster(app) {
  const me = app.state.monsterEdit; if (!me) return;
  window.Monsters.clearOverride(me.nick);
  app.setState({ monsterEdit: { nick: me.nick, params: JSON.parse(JSON.stringify(window.Monsters.paramsFor(me.nick))) } });
  app.toast("Przywrócono domyślnego stworka");
}

function renderMonsterEditorModal(app) {
  const t = app.theme();
  const me = app.state.monsterEdit; const s = me.params;
  const M = window.Monsters; const THEMES = M.THEMES; const O = M.OPTIONS;
  const close = () => app.setState({ monsterEdit: null });
  const pill = (active, onClick, label) => h("button", { key: label, onClick, style: { cursor: "pointer", padding: "6px 11px", borderRadius: 8, border: "1px solid " + (active ? t.accent : t.line2), background: active ? t.accent + "22" : "transparent", color: active ? t.text : t.mut, fontSize: 12, fontWeight: 700, fontFamily: t.disp } }, label);
  const cap = (v) => v.charAt(0).toUpperCase() + v.slice(1);
  const groups = [["body", "Ciało", O.bodies], ["head", "Głowa", O.heads], ["eyes", "Oczy", O.eyesL], ["horns", "Rogi", O.hornsL], ["legs", "Kończyny", O.legsL], ["mouth", "Usta", O.mouthsL], ["tail", "Ogon", O.tailsL]];
  const sizeDefs = [["body", "Ciało"], ["head", "Głowa"], ["eyes", "Oczy"], ["horns", "Rogi"], ["mouth", "Usta"], ["legs", "Kończyny"], ["tail", "Ogon"]];
  return h("div", { onClick: close, style: { position: "fixed", inset: 0, zIndex: 60, background: "rgba(6,5,10,.82)", backdropFilter: "blur(5px)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "40px 20px", animation: "lolFade .2s ease" }, className: "lolscroll" },
    h("div", { onClick: (e) => e.stopPropagation(), style: { width: "100%", maxWidth: 720, background: t.panel, border: "1px solid " + t.line2, borderRadius: 20, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.6)", animation: "lolPop .22s ease" } },
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid " + t.line } },
        h("div", null,
          h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 19 } }, "Stworek — " + me.nick),
          h("div", { style: { fontSize: 12, color: t.faint, marginTop: 2 } }, "Dostosuj bestię tego gracza")),
        h("button", { onClick: close, style: { width: 32, height: 32, borderRadius: 9, border: "1px solid " + t.line2, background: "rgba(0,0,0,.25)", color: t.text, cursor: "pointer", fontSize: 16 } }, "✕")),
      h("div", { style: { display: "grid", gridTemplateColumns: "240px minmax(0,1fr)", gap: 20, padding: "20px 22px" } },
        h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
          h("div", { style: { borderRadius: 14, overflow: "hidden", border: "1px solid " + t.line2, aspectRatio: "3 / 4" } },
            h("div", { dangerouslySetInnerHTML: { __html: (M.buildSVG(s) || "").replace('width="300" height="400"', 'width="100%" height="100%" style="display:block"') }, style: { width: "100%", height: "100%", lineHeight: 0 } })),
          h("div", { style: { display: "flex", gap: 8 } },
            h("button", { onClick: () => setMonsterParam(app, M.randomFor(me.nick)), style: { flex: 1, cursor: "pointer", padding: "10px", borderRadius: 10, border: "1px solid " + t.line2, background: "transparent", color: t.text, fontWeight: 700, fontSize: 12.5, fontFamily: t.disp } }, "⚄ Losuj"),
            h("button", { onClick: () => resetMonster(app), style: { flex: 1, cursor: "pointer", padding: "10px", borderRadius: 10, border: "1px solid " + t.line2, background: "transparent", color: t.mut, fontWeight: 700, fontSize: 12.5, fontFamily: t.disp } }, "↺ Domyślny"))),
        h("div", { className: "lolscroll", style: { display: "flex", flexDirection: "column", gap: 16, maxHeight: "56vh", overflowY: "auto", paddingRight: 4 } },
          h("div", null,
            h("div", { style: monoLabel(t) }, "Motyw"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7 } }, Object.keys(THEMES).map((k) => h("button", { key: k, onClick: () => setMonsterParam(app, { theme: k }), title: THEMES[k].n, style: { width: 28, height: 28, borderRadius: 7, cursor: "pointer", padding: 0, background: "linear-gradient(140deg," + THEMES[k].a + "," + THEMES[k].glow + ")", border: "2px solid " + (s.theme === k ? "#fff" : "rgba(255,255,255,.15)") } })))),
          groups.map(([key, label, list]) => h("div", { key: key },
            h("div", { style: monoLabel(t) }, label),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, list.map((v) => pill(s[key] === v, () => setMonsterParam(app, { [key]: v }), cap(v)))))),
          h("div", null,
            h("div", { style: monoLabel(t) }, "Cechy"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
              pill(s.wings, () => setMonsterParam(app, { wings: !s.wings }), "Skrzydła"),
              pill(s.spikes, () => setMonsterParam(app, { spikes: !s.spikes }), "Kolce"),
              pill(s.neck !== false, () => setMonsterParam(app, { neck: s.neck === false }), "Szyja"))),
          h("div", null,
            h("div", { style: monoLabel(t) }, "Glam"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
              pill(s.lashes, () => setMonsterParam(app, { lashes: !s.lashes }), "Rzęsy"),
              pill(s.blush, () => setMonsterParam(app, { blush: !s.blush }), "Rumieńce"),
              pill(s.bow, () => setMonsterParam(app, { bow: !s.bow }), "Kokarda"),
              pill(s.flowers, () => setMonsterParam(app, { flowers: !s.flowers }), "Kwiaty"),
              pill(s.hearts, () => setMonsterParam(app, { hearts: !s.hearts }), "Serduszka"))),
          h("div", null,
            h("div", { style: monoLabel(t) }, "Tło synthwave"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
              pill(s.sun, () => setMonsterParam(app, { sun: !s.sun }), "Słońce"),
              pill(s.grid, () => setMonsterParam(app, { grid: !s.grid }), "Siatka"),
              pill(s.scan, () => setMonsterParam(app, { scan: !s.scan }), "Scanlines"))),
          h("div", null,
            h("div", { style: monoLabel(t) }, "Backdrop"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, (M.OPTIONS.backdrops || ["none", "anime", "lol", "cyber"]).map((bd) =>
              pill((s.backdrop || "none") === bd, () => setMonsterParam(app, { backdrop: bd }), ({ none: "Brak", anime: "Anime", lol: "Runeterra", cyber: "Cyberpunk" })[bd] || bd)))),
          h("div", null,
            h("div", { style: monoLabel(t) }, "Animacje"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, [["idle", "Bujanie"], ["blink", "Mruganie"], ["mouth", "Usta"], ["leap", "Skok"], ["wings", "Skrzydła"], ["tail", "Ogon"], ["belly", "Oddech"], ["particles", "Cząstki"]].map(([ak, al]) => {
              const cur = s.anims || {}; const onA = cur[ak] !== false;
              return pill(onA, () => setMonsterParam(app, { anims: Object.assign({}, cur, { [ak]: !onA }) }), al);
            }))),
          h("div", null,
            h("div", { style: monoLabel(t) }, "Rozmiary"),
            h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, sizeDefs.map(([key, label]) => h("div", { key: key, style: { display: "flex", alignItems: "center", gap: 10 } },
              h("span", { style: { width: 66, fontSize: 12, color: t.mut, fontWeight: 600 } }, label),
              h("input", { type: "range", min: 50, max: 160, value: (s.sizes && s.sizes[key]) || 100, onChange: (e) => setMonsterSize(app, key, e.target.value), style: { flex: 1, accentColor: t.accent, cursor: "pointer" } }),
              h("span", { style: { width: 40, textAlign: "right", fontFamily: t.mono, fontSize: 11, color: t.faint } }, ((s.sizes && s.sizes[key]) || 100) + "%"))))),
          h("div", null,
            h("div", { style: monoLabel(t) }, "Cząsteczki aury · " + (s.particleCount || 0)),
            h("input", { type: "range", min: 0, max: 14, value: s.particleCount || 0, onChange: (e) => setMonsterParam(app, { particleCount: +e.target.value }), style: { width: "100%", accentColor: t.accent, cursor: "pointer" } })))),
      h("div", { style: { display: "flex", gap: 10, padding: "16px 22px", borderTop: "1px solid " + t.line } },
        h("button", { onClick: () => saveMonster(app), style: { flex: 1, cursor: "pointer", padding: "12px", borderRadius: 11, border: "none", background: t.accent, color: "#08120D", boxShadow: "0 0 16px " + t.accent + "66", fontWeight: 800, fontSize: 14, fontFamily: t.disp } }, "Zapisz stworka"),
        h("button", { onClick: close, style: { cursor: "pointer", padding: "12px 20px", borderRadius: 11, border: "1px solid " + t.line2, background: "transparent", color: t.mut, fontWeight: 700, fontSize: 14, fontFamily: t.disp } }, "Anuluj"))));
}

window.BrowserViews.monsterEditor = renderMonsterEditorModal;
