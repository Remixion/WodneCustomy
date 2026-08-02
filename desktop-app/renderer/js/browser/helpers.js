/* Wspólne drobne pomoce dla widoków Przeglądarki meczy - port drobnych funkcji z Match Browser.dc.html. */
const h = React.createElement;

/** Rejestr widoków (np. window.BrowserViews.matches = fn) - musi istnieć PRZED jakimkolwiek plikiem widoku, stąd inicjalizacja w tym, najwcześniej ładowanym pliku, nie w App.js (który ładuje się na końcu). */
window.BrowserViews = window.BrowserViews || {};

function theme(accent) {
  const neon = "#5ac8ff";
  return {
    accent: accent || "#3DDC97", neon, glow: "0 0 16px rgba(90,200,255,.35)",
    bg: "#0A0B0E", panel: "#0d1120", panelSolid: "#0d1120", panel2: "#121830", elev: "#141a2c",
    line: "rgba(120,180,255,.12)", line2: "rgba(120,180,255,.22)",
    text: "#EDEFF4", mut: "#93a6c4", faint: "#5c6b86",
    blue: "#4C86FF", red: "#FF5D6C", win: "#3DDC97", loss: "#FF5D6C",
    mono: '"JetBrains Mono", monospace', disp: '"Space Grotesk", sans-serif'
  };
}

function monoLabel(t) {
  return { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: t.faint, marginBottom: 8 };
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (n === 1) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function kdaRatio(p) { return (p.k + p.a) / Math.max(1, p.d); }
function avgKda(ra) { return (ra.k + ra.a) / Math.max(0.1, ra.d); }
function avgKda2(ra) { return ((ra.k || 0) + (ra.a || 0)) / Math.max(0.1, ra.d || 0.1); }
function fmtK(n) { n = n || 0; return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(Math.round(n)); }
function fmtTime(s) { s = s || 0; const m = Math.floor(s / 60), r = s % 60; return m + ":" + String(r).padStart(2, "0"); }
function fmtDate(d, long) {
  try { const dt = new Date(d); return dt.toLocaleDateString("pl-PL", long ? { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", year: "2-digit" }); } catch (e) { return String(d); }
}
function roleTag(r) { return ({ TOP: "Top", JNG: "Jungla", MID: "Mid", BOT: "ADC", SUP: "Support" })[r] || r; }
function backBtn(t) { return { cursor: "pointer", background: "transparent", border: "1px solid " + t.line2, color: t.mut, padding: "7px 13px", borderRadius: 9, fontSize: 13, fontWeight: 600 }; }
function sectionH(t) { return { fontFamily: t.disp, fontWeight: 800, fontSize: 19, margin: "0 0 12px", letterSpacing: -.3, color: "#eaf4ff", textShadow: "0 0 18px rgba(90,200,255,.55)" }; }
function bigStat(t, val, label, col) {
  return h("div", { style: { textAlign: "center" } },
    h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 26, color: col || t.text, fontVariantNumeric: "tabular-nums", textShadow: (col && col !== t.text) ? "0 0 14px " + col + "66" : "0 0 14px rgba(90,200,255,.3)" } }, val),
    h("div", { style: { fontSize: 11, color: t.faint, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 } }, label));
}

/** Znajduje zagregowanego gracza (agg.players, patrz browserData.js) po nicku/summonerze - używane przez Audio.js (piosenka) i MonsterEditor.js (stworek), żeby dojść do puuid/songUrl/monsterConfig zapisanych w Arkuszu (zakładka Players). */
function findPlayerRecordByNick(app, nick) {
  if (!app.state.agg) return null;
  const players = app.state.agg.players;
  const k = window.LOLData.norm(nick);
  return players[k] || Object.values(players).find((p) => (p.nick || p.summoner) === nick) || null;
}
