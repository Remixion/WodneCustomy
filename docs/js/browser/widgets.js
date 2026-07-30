/* Drobne, wielokrotnie używane widżety (obrazki championów/przedmiotów/run/przywoływaczy, paski porównawcze) - port z Match Browser.dc.html, jako funkcje (app, ...) zamiast metod klasy, żeby dzielić je między widokami. `app` to instancja BrowserApp (ma state.statics). Zawsze pokazujemy art (oryginalny toggle "showArt" był ustawieniem panelu podglądu design-toola, nieobecnym w naszej apce). */

function champImg(app, champKey, champName, size, radius) {
  const t = app.theme();
  const url = window.LOLData.IMG.champ(app.state.statics.version, champKey);
  const initial = (champName || "?").slice(0, 1).toUpperCase();
  return h("div", { style: { width: size, height: size, borderRadius: radius == null ? Math.round(size * .28) : radius, position: "relative", overflow: "hidden", flex: "0 0 auto", background: "#20232C", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" } },
    h("span", { style: { fontFamily: t.disp, fontWeight: 700, color: t.faint, fontSize: size * .4 } }, initial),
    champKey ? h("img", { src: url, alt: champName, loading: "lazy", onError: (e) => { e.target.style.display = "none"; }, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } }) : null
  );
}

function champSplashTile(app, champKey, champName, w, hgt, radius) {
  const t = app.theme();
  const initial = (champName || "?").slice(0, 1).toUpperCase();
  const url = window.LOLData.IMG.champLoading(champKey);
  return h("div", { style: { width: w, height: hgt, borderRadius: radius == null ? 8 : radius, position: "relative", overflow: "hidden", flex: "0 0 auto", background: "#20232C", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" } },
    h("span", { style: { fontFamily: t.disp, fontWeight: 700, color: t.faint, fontSize: Math.min(w, hgt) * .4 } }, initial),
    champKey ? h("img", { src: url, alt: champName, loading: "lazy", decoding: "async", onError: (e) => { e.target.style.display = "none"; }, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 18%" } }) : null
  );
}

function itemImg(app, id, size) {
  const ver = app.state.statics.version;
  const url = window.LOLData.IMG.item(ver, id);
  const box = { width: size, height: size, borderRadius: 6, background: "rgba(255,255,255,.03)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)", flex: "0 0 auto", overflow: "hidden" };
  if (!id || id <= 0) return h("div", { style: box });
  return h("div", { style: box }, h("img", { src: url, loading: "lazy", onError: (e) => { e.target.style.display = "none"; }, style: { width: "100%", height: "100%", objectFit: "cover" } }));
}

function spellImg(app, id, size) {
  const st = app.state.statics; const ver = st.version;
  const info = st.spellById[id]; const key = info && info[0];
  const box = { width: size, height: size, borderRadius: 5, background: "rgba(255,255,255,.04)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)", overflow: "hidden", flex: "0 0 auto" };
  if (!key) return h("div", { style: box });
  return h("div", { style: box }, h("img", { src: window.LOLData.IMG.spell(ver, key), loading: "lazy", onError: (e) => { e.target.style.display = "none"; }, style: { width: "100%", height: "100%" } }));
}

function runeImg(app, id, size) {
  const st = app.state.statics; const info = st.runeById[id];
  const box = { width: size, height: size, borderRadius: "50%", background: "rgba(0,0,0,.4)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)", overflow: "hidden", flex: "0 0 auto" };
  if (!info || !info.icon) return h("div", { style: box });
  return h("div", { style: box }, h("img", { src: window.LOLData.IMG.rune(info.icon), title: info.name, loading: "lazy", onError: (e) => { e.target.style.display = "none"; }, style: { width: "100%", height: "100%" } }));
}

function profileImg(app, p, size) {
  const t = app.theme(); const ver = app.state.statics.version;
  return h("div", { style: { width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#20232C,#12141A)", position: "relative", overflow: "hidden", flex: "0 0 auto", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.10)", display: "flex", alignItems: "center", justifyContent: "center" } },
    h("span", { style: { fontFamily: t.disp, fontWeight: 700, color: t.accent, fontSize: size * .38 } }, (playerName(p) || "?").slice(0, 1).toUpperCase()),
    h("img", { src: window.LOLData.IMG.profile(ver, p.icon), loading: "lazy", onError: (e) => { e.target.style.display = "none"; }, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } })
  );
}

/** Odpowiednik this.name(p) z oryginału - u nas zawsze pokazujemy nick (rozwiązany z Players sheet w browserData.js), nie ma trybu "summoner"/"both" z panelu ustawień designu. */
function playerName(p) { return p.nick || p.summoner; }

function avgBar(app, value, avg, higherBetter) {
  const t = app.theme();
  const max = Math.max(value, avg, 0.0001) * 1.28;
  const vPct = Math.max(2, (value / max) * 100);
  const aPct = (avg / max) * 100;
  const good = higherBetter ? value >= avg : value <= avg;
  const col = good ? t.accent : t.mut;
  const delta = avg ? ((value - avg) / avg) * 100 : 0;
  const dSign = delta >= 0 ? "+" : "";
  return h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
    h("div", { style: { position: "relative", flex: 1, height: 6, background: "rgba(255,255,255,.06)", borderRadius: 20 } },
      h("div", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: vPct + "%", background: col, borderRadius: 20, transformOrigin: "left", animation: "lolBar .5s ease" } }),
      h("div", { title: "Średnia roli", style: { position: "absolute", left: "calc(" + aPct + "% - 1px)", top: -2, bottom: -2, width: 2, background: t.text, opacity: .85, borderRadius: 2 } })
    ),
    h("span", { style: { fontFamily: t.mono, fontSize: 11, color: good ? t.accent : t.faint, minWidth: 44, textAlign: "right" } }, dSign + delta.toFixed(0) + "%")
  );
}

function chip(t, label, active, onClick) {
  return h("button", { key: label, onClick, style: { cursor: "pointer", padding: "7px 14px", borderRadius: 999, border: "1px solid " + (active ? "rgba(90,200,255,.6)" : t.line), background: active ? "rgba(90,200,255,.16)" : "transparent", color: active ? "#dff3ff" : t.mut, fontWeight: 700, fontSize: 13, fontFamily: t.disp, letterSpacing: .2, transition: "all .15s", boxShadow: active ? "0 0 12px rgba(90,200,255,.35)" : "none", textShadow: active ? "0 0 8px rgba(90,200,255,.5)" : "none" } }, label);
}

function statTile(t, label, value, sub) {
  return h("div", { key: label, style: { background: t.panel, border: "1px solid " + t.line, borderRadius: 14, padding: "16px 18px", boxShadow: "0 0 0 1px rgba(90,200,255,.04), 0 8px 24px rgba(0,0,0,.3)" } },
    h("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: t.faint, fontWeight: 700, marginBottom: 8 } }, label),
    h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 26, letterSpacing: -.5, fontVariantNumeric: "tabular-nums" } }, value),
    sub ? h("div", { style: { fontSize: 12, color: t.mut, marginTop: 4 } }, sub) : null
  );
}
