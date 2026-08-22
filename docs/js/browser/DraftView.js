/* Losowanie drużyn (#draft) - port renderDraft/casinoLever/rollTeams/rollChamps/emptyDraft/placeInSlot i innych z Match Browser.dc.html, zastępuje randomizer.html. Stworki-awatary (monsterInline) to osobny etap (MonsterEditor) - tu, tak jak w PlayerView, prosty placeholder z inicjałem wypełniający kartę slotu. */

const DRAFT_ROLES = ["TOP", "JNG", "MID", "BOT", "SUP"];
const DRAFT_ROLE_ICON = { TOP: "top", JNG: "jungle", MID: "middle", BOT: "bottom", SUP: "utility" };
const DRAFT_ROLE_LABEL = { TOP: "Top", JNG: "Jungla", MID: "Mid", BOT: "ADC", SUP: "Support" };

/* Ustawienia losowania (koło zębate w Losowaniu) - trzymane w localStorage (przeżywają
   przeładowanie, jak muted/volume w Audio.js), a nie w schemacie App.js's state = {...}, bo
   podobnie jak draftSearch/draftSort/roleBlock to stan czysto tego widoku, nigdzie indziej
   nieczytany. */
const DEFAULT_DRAFT_SETTINGS = { rerollLimit: 3, seed: "", respectRoleBlock: true, avoidPreviousRole: false, balanceByRank: false };
function loadDraftSettings() {
  try { return Object.assign({}, DEFAULT_DRAFT_SETTINGS, JSON.parse(localStorage.getItem("wcDraftSettings") || "{}")); }
  catch (e) { return Object.assign({}, DEFAULT_DRAFT_SETTINGS); }
}
function getDraftSettings(app) { return app.state.draftSettings || loadDraftSettings(); }
function saveDraftSettings(app, patch) {
  const next = Object.assign({}, getDraftSettings(app), patch);
  try { localStorage.setItem("wcDraftSettings", JSON.stringify(next)); } catch (e) {}
  if ("seed" in patch) app._draftSeedPull = 0; // zmiana ziarna zawsze zaczyna sekwencję od nowa
  app.setState({ draftSettings: next });
}

/** mulberry32 - mały, szybki, deterministyczny PRNG (nie do celów kryptograficznych, tylko powtarzalne losowanie w zabawie). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/**
 * Zwraca funkcję losującą [0,1) do użycia w TYM konkretnym pociągnięciu dźwigni. Bez
 * ustawionego ziarna - zwykłe Math.random (jak dotychczas). Z ziarnem - deterministyczna
 * funkcja zależna od (ziarno + numer pociągnięcia): to samo ziarno zawsze daje tę samą
 * SEKWENCJĘ wyników przy kolejnych pociągnięciach (przydatne np. żeby udowodnić uczciwość
 * losowania, powtarzając je na oczach graczy), ale nie zamraża wyniku na jedno pociągnięcie
 * w kółko - licznik pociągnięć resetuje się tylko przy zmianie samego ziarna.
 */
function draftRandomFn(app) {
  const seed = (getDraftSettings(app).seed || "").trim();
  if (!seed) return Math.random;
  const pull = app._draftSeedPull || 0; app._draftSeedPull = pull + 1;
  const str = seed + ":" + pull;
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return mulberry32((h ^ (h >>> 16)) >>> 0);
}
function shuffleWith(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
  return a;
}

const DRAFT_TIER_ORDER = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
const DRAFT_SUBRANK_ORDER = { IV: 0, III: 1, II: 2, I: 3 };
/** Liczbowa "siła" gracza wg rangi solo/duo (soloTier/soloRank/soloLP z Arkusza) - do balansowania drużyn. Gracz bez znanej rangi (custom/niesklasyfikowany) dostaje 0, czyli traktowany jest jako najsłabszy - lepsze to niż pominięcie go w balansowaniu. */
function draftRankScore(app, p) {
  const raw = p.puuid && app.state.playersByPuuid ? app.state.playersByPuuid[p.puuid] : null;
  if (!raw) return 0;
  const tierIdx = DRAFT_TIER_ORDER.indexOf(String(raw.soloTier || "").toUpperCase());
  if (tierIdx < 0) return 0;
  const subIdx = DRAFT_SUBRANK_ORDER[String(raw.soloRank || "").toUpperCase()] || 0;
  return tierIdx * 400 + subIdx * 100 + Math.min(99, Number(raw.soloLP) || 0);
}

/** Rola z ostatniego (najwyższy gid) odnotowanego meczu gracza - null, gdy brak historii (np. gracz dodany ręcznie). Współdzielone przez assignRolesForPool (flaga avoidPreviousRole) i wizualną odznakę w liście graczy. */
function draftLastRole(p) {
  const ms = p.matches || [];
  const last = ms.reduce((mx, m) => (!mx || (m.gid || 0) > (mx.gid || 0) ? m : mx), null);
  return last ? last.role : null;
}

/**
 * Przydziela graczy z puli do 5 ról jednej drużyny, próbując uszanować (w tej kolejności
 * ważności): role zablokowane przez gracza (roleBlock - "role, których nie gra") i unikanie
 * roli z jego ostatniego odnotowanego meczu (avoidPreviousRole), zgodnie z flagami w
 * ustawieniach. Zachłanny algorytm best-effort: gdy dla danej roli nie ma już żadnego w pełni
 * "czystego" kandydata, ogranicznik jest po kolei rozluźniany (najpierw avoidPreviousRole,
 * potem nawet roleBlock), żeby WSZYSCY gracze zawsze trafili na jakiś slot - lepsze
 * niepełne dopasowanie niż odmowa przydziału.
 */
function assignRolesForPool(app, poolPlayers, rnd) {
  const settings = getDraftSettings(app);
  const roleBlock = app.state.roleBlock || {};
  const roles = shuffleWith(DRAFT_ROLES, rnd);
  let remaining = shuffleWith(poolPlayers, rnd);
  const result = {};
  roles.forEach((role) => {
    if (!remaining.length) return; // pula wyczerpana wcześniej niż role - slot zostaje pusty, tak jak dotychczas przy niepełnych drużynach
    const eligible = (relaxAvoid, relaxBlock) => remaining.filter((p) => {
      if (!relaxBlock && settings.respectRoleBlock && (roleBlock[p.key] || {})[role]) return false;
      if (!relaxAvoid && settings.avoidPreviousRole && draftLastRole(p) === role) return false;
      return true;
    });
    let candidates = eligible(false, false);
    if (!candidates.length) candidates = eligible(true, false);
    if (!candidates.length) candidates = eligible(true, true);
    if (!candidates.length) candidates = remaining;
    const pick = candidates[Math.floor(rnd() * candidates.length)];
    result[role] = pick.key;
    remaining = remaining.filter((p) => p !== pick);
  });
  return result;
}

function emptyDraft() { return { blue: { TOP: null, JNG: null, MID: null, BOT: null, SUP: null }, red: { TOP: null, JNG: null, MID: null, BOT: null, SUP: null } }; }
function getDraftAssign(app) { return app.state.draftAssign || emptyDraft(); }
function getAllDraftPlayers(app) { return Object.assign({}, app.state.agg.players, app.state.customPlayers || {}); }
function getDraftPlayer(app, k) { return getAllDraftPlayers(app)[k]; }
function getDraftUsed(app) {
  const a = getDraftAssign(app); const used = {};
  ["blue", "red"].forEach((s) => DRAFT_ROLES.forEach((r) => { if (a[s][r]) used[a[s][r]] = s + ":" + r; }));
  return used;
}

function addCustomPlayer(app, name, opts) {
  name = (name || "").trim(); if (!name) { app.toast("Podaj nick gracza", true); return; }
  opts = opts || {};
  const key = "custom:" + window.LOLData.norm(name) + ":" + Math.random().toString(36).slice(2, 6);
  const cp = Object.assign({}, app.state.customPlayers || {});
  cp[key] = { key, nick: name, summoner: (opts.summoner || name).trim() || name, tag: "", puuid: "", icon: 0, games: 0, wins: 0, kda: 0, winrate: 0, roles: {}, champs: {}, matches: [], avg: {}, sums: {}, topChamps: [], custom: true };
  app.setState({ customPlayers: cp, newPlayer: "", newPlayerSummoner: "", addPlayerOpen: false }, () => addToNextSlot(app, key));
  app.toast("Dodano gracza: " + name);
}

function champPool(app) {
  if (app._champPool) return app._champPool;
  const cb = (app.state.statics && app.state.statics.champById) || {};
  const arr = Object.entries(cb).map(([id, a]) => ({ champId: +id, champKey: a[0], champName: a[1] })).filter((c) => c.champId > 0 && c.champKey && c.champName && c.champName !== String(c.champId));
  app._champPool = arr.length ? arr : Object.entries(window.LOLData.CHAMP_STATIC).map(([id, a]) => ({ champId: +id, champKey: a[0], champName: a[1] }));
  return app._champPool;
}
function randomChampWith(app, rnd) { const p = champPool(app); return p[Math.floor(rnd() * p.length)]; }
function randomChamp(app) { return randomChampWith(app, Math.random); }

function rerollChamp(app, side, role) {
  const fk = side + ":" + role; const dc = Object.assign({}, app.state.draftChamp || {});
  const cur = dc[fk]; if (!cur || cur.rerolls >= getDraftSettings(app).rerollLimit) return;
  const c = randomChamp(app);
  dc[fk] = { champId: c.champId, champKey: c.champKey, champName: c.champName, rerolls: cur.rerolls + 1 };
  app.setState({ draftChamp: dc });
}
function placeInSlot(app, key, side, role) {
  const a = JSON.parse(JSON.stringify(getDraftAssign(app)));
  const dc = Object.assign({}, app.state.draftChamp || {});
  ["blue", "red"].forEach((s) => DRAFT_ROLES.forEach((r) => { if (a[s][r] === key) { a[s][r] = null; delete dc[s + ":" + r]; } }));
  a[side][role] = key;
  app.setState({ draftAssign: a, draftChamp: dc });
}
function removeFromSlot(app, side, role) {
  const a = JSON.parse(JSON.stringify(getDraftAssign(app)));
  a[side][role] = null;
  const dc = Object.assign({}, app.state.draftChamp || {}); delete dc[side + ":" + role];
  app.setState({ draftAssign: a, draftChamp: dc });
}
function addToNextSlot(app, key) {
  const used = getDraftUsed(app);
  if (used[key]) { const [s, r] = used[key].split(":"); removeFromSlot(app, s, r); return; }
  const a = JSON.parse(JSON.stringify(getDraftAssign(app)));
  const dc = Object.assign({}, app.state.draftChamp || {});
  for (let r = 0; r < 5; r++) {
    for (const s of ["blue", "red"]) {
      if (!a[s][DRAFT_ROLES[r]]) { a[s][DRAFT_ROLES[r]] = key; app.setState({ draftAssign: a, draftChamp: dc }); return; }
    }
  }
  app.toast("Wszystkie sloty zajęte", true);
}
function clearDraft(app) { app.setState({ draftAssign: emptyDraft(), draftChamp: {} }); }
function roleBlockCount(app, key) { const rb = (app.state.roleBlock || {})[key]; return rb ? Object.keys(rb).filter((r) => rb[r]).length : 0; }
function toggleRoleBlock(app, key, role) {
  const rb = Object.assign({}, app.state.roleBlock || {});
  const cur = Object.assign({}, rb[key] || {});
  cur[role] = !cur[role];
  rb[key] = cur;
  app.setState({ roleBlock: rb });
}

function roleMenuOverlay(app, p) {
  const t = app.theme();
  const rb = (app.state.roleBlock || {})[p.key] || {};
  const roles = [["TOP", "Top"], ["JNG", "Jungla"], ["MID", "Mid"], ["BOT", "ADC"], ["SUP", "Support"]];
  const close = () => app.setState({ roleMenu: null });
  return h("div", { key: "rolemenu", onClick: close, style: { position: "fixed", inset: 0, zIndex: 70, background: "rgba(6,8,18,.78)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "lolFade .18s ease" } },
    h("div", { onClick: (e) => e.stopPropagation(), style: { width: "100%", maxWidth: 300, background: t.panel, border: "1px solid rgba(90,200,255,.3)", borderRadius: 16, padding: 18, boxShadow: "0 24px 70px rgba(0,0,0,.6), 0 0 30px rgba(90,200,255,.12)", animation: "lolPop .22s ease" } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 } },
        profileImg(app, p, 34),
        h("div", { style: { minWidth: 0 } },
          h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 16 } }, p.nick || p.summoner),
          h("div", { style: { fontSize: 11, color: t.faint } }, "Zaznacz role, których nie gra"))),
      roles.map(([r, lbl]) => {
        const off = !!rb[r];
        return h("button", { key: r, onClick: () => toggleRoleBlock(app, p.key, r), style: { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", cursor: "pointer", padding: "10px 12px", borderRadius: 9, border: "1px solid " + (off ? "rgba(255,90,120,.35)" : t.line), background: off ? "rgba(255,90,120,.14)" : "transparent", color: off ? "#ff9aae" : t.text, fontSize: 13.5, fontWeight: 600, fontFamily: t.disp, marginBottom: 6 } },
          h("span", null, lbl), h("span", { style: { fontSize: 13 } }, off ? "✕ nie gra" : "✓ gra"));
      }),
      h("button", { onClick: close, style: { width: "100%", marginTop: 4, cursor: "pointer", padding: "10px", borderRadius: 9, border: "none", background: t.accent, color: "#08120D", boxShadow: "0 0 16px " + t.accent + "66", fontSize: 13.5, fontWeight: 800, fontFamily: t.disp } }, "Gotowe")));
}

function addPlayerModal(app) {
  const t = app.theme();
  const close = () => app.setState({ addPlayerOpen: false });
  const nick = app.state.newPlayer || "";
  const summ = app.state.newPlayerSummoner || "";
  const submit = () => addCustomPlayer(app, nick, { summoner: summ });
  return h("div", { key: "addplayer", onClick: close, style: { position: "fixed", inset: 0, zIndex: 60, background: "rgba(6,8,18,.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "lolFade .2s ease" } },
    h("div", { onClick: (e) => e.stopPropagation(), style: { width: "100%", maxWidth: 440, background: t.panel, border: "1px solid rgba(90,200,255,.3)", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.6), 0 0 30px rgba(90,200,255,.15)", animation: "lolPop .22s ease" } },
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid " + t.line } },
        h("div", null,
          h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 19, textShadow: "0 0 14px rgba(90,200,255,.4)" } }, "Dodaj gracza"),
          h("div", { style: { fontSize: 12, color: t.faint, marginTop: 2 } }, "Gracz spoza wczytanych danych")),
        h("button", { onClick: close, style: { width: 32, height: 32, borderRadius: 9, border: "1px solid " + t.line2, background: "rgba(0,0,0,.25)", color: t.text, cursor: "pointer", fontSize: 16 } }, "✕")),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 11, padding: "20px 22px" } },
        h("div", null,
          h("div", { style: monoLabel(t) }, "Nick *"),
          h("input", { autoFocus: true, value: nick, onChange: (e) => app.setState({ newPlayer: e.target.value }), onKeyDown: (e) => { if (e.key === "Enter") submit(); }, placeholder: "np. Kosior", style: { width: "100%", background: t.panel2, color: t.text, border: "1px solid " + t.line2, borderRadius: 9, padding: "9px 11px", fontSize: 13.5, fontFamily: t.disp, outline: "none" } })),
        h("div", null,
          h("div", { style: monoLabel(t) }, "Summoner name (opcjonalnie)"),
          h("input", { value: summ, onChange: (e) => app.setState({ newPlayerSummoner: e.target.value }), onKeyDown: (e) => { if (e.key === "Enter") submit(); }, placeholder: "np. Młotopięść", style: { width: "100%", background: t.panel2, color: t.text, border: "1px solid " + t.line2, borderRadius: 9, padding: "9px 11px", fontSize: 13.5, fontFamily: t.disp, outline: "none" } }))),
      h("div", { style: { fontSize: 11.5, color: t.faint, padding: "0 22px 14px" } }, "Gracz trafi na pierwszy wolny slot."),
      h("div", { style: { display: "flex", gap: 10, padding: "16px 22px", borderTop: "1px solid " + t.line } },
        h("button", { onClick: submit, style: { flex: 1, cursor: "pointer", padding: "12px", borderRadius: 11, border: "none", background: t.accent, color: "#08120D", boxShadow: "0 0 16px " + t.accent + "66", fontWeight: 800, fontSize: 14, fontFamily: t.disp } }, "Dodaj do drużyny"),
        h("button", { onClick: close, style: { cursor: "pointer", padding: "12px 20px", borderRadius: 11, border: "1px solid " + t.line2, background: "transparent", color: t.mut, fontWeight: 700, fontSize: 14, fontFamily: t.disp } }, "Anuluj"))));
}

function draftFlagToggle(app, t, key, label, hint) {
  const settings = getDraftSettings(app);
  const on = !!settings[key];
  return h("button", {
    key, onClick: () => saveDraftSettings(app, { [key]: !on }),
    style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, width: "100%", textAlign: "left", cursor: "pointer", padding: "10px 12px", borderRadius: 9, border: "1px solid " + (on ? "rgba(90,200,255,.4)" : t.line2), background: on ? "rgba(90,200,255,.1)" : "transparent", marginBottom: 8 }
  },
    h("div", null,
      h("div", { style: { fontSize: 13.5, fontWeight: 700, color: t.text, fontFamily: t.disp } }, label),
      hint ? h("div", { style: { fontSize: 11, color: t.faint, marginTop: 2 } }, hint) : null),
    h("span", { style: { flex: "0 0 auto", fontSize: 13, fontWeight: 800, color: on ? t.accent : t.faint } }, on ? "✓" : "—"));
}

function draftSettingsModal(app) {
  const t = app.theme();
  const settings = getDraftSettings(app);
  const close = () => app.setState({ draftSettingsOpen: false });
  const inputStyle = { width: "100%", background: t.panel2, color: t.text, border: "1px solid " + t.line2, borderRadius: 9, padding: "9px 11px", fontSize: 13.5, fontFamily: t.disp, outline: "none" };
  return h("div", { key: "draftsettings", onClick: close, style: { position: "fixed", inset: 0, zIndex: 60, background: "rgba(6,8,18,.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "lolFade .2s ease" } },
    h("div", { onClick: (e) => e.stopPropagation(), style: { width: "100%", maxWidth: 440, background: t.panel, border: "1px solid rgba(90,200,255,.3)", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.6), 0 0 30px rgba(90,200,255,.15)", animation: "lolPop .22s ease" } },
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid " + t.line } },
        h("div", null,
          h("div", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 19, textShadow: "0 0 14px rgba(90,200,255,.4)" } }, "Ustawienia losowania"),
          h("div", { style: { fontSize: 12, color: t.faint, marginTop: 2 } }, "Zmiany zapisują się automatycznie")),
        h("button", { onClick: close, style: { width: 32, height: 32, borderRadius: 9, border: "1px solid " + t.line2, background: "rgba(0,0,0,.25)", color: t.text, cursor: "pointer", fontSize: 16 } }, "✕")),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 14, padding: "20px 22px" } },
        h("div", null,
          h("div", { style: monoLabel(t) }, "Liczba rerolli postaci na slot"),
          h("input", { type: "number", min: 0, max: 10, value: settings.rerollLimit, onChange: (e) => saveDraftSettings(app, { rerollLimit: Math.max(0, Math.min(10, +e.target.value || 0)) }), style: inputStyle })),
        h("div", null,
          h("div", { style: monoLabel(t) }, "Ziarno losowania (puste = zawsze inny wynik)"),
          h("div", { style: { display: "flex", gap: 8 } },
            h("input", { value: settings.seed, onChange: (e) => saveDraftSettings(app, { seed: e.target.value }), placeholder: "np. finał-turnieju-2026", style: inputStyle }),
            h("button", { onClick: () => saveDraftSettings(app, { seed: "" }), title: "Wyczyść ziarno", style: { flex: "0 0 auto", cursor: "pointer", padding: "0 14px", borderRadius: 9, border: "1px solid " + t.line2, background: "transparent", color: t.mut, fontWeight: 700, fontSize: 13, fontFamily: t.disp } }, "✕")),
          h("div", { style: { fontSize: 11, color: t.faint, marginTop: 6 } }, "To samo ziarno zawsze daje tę samą serię wyników po kolei (np. do uczciwego powtórzenia losowania na oczach graczy).")),
        h("div", null,
          h("div", { style: Object.assign({}, monoLabel(t), { marginBottom: 8 }) }, "Flagi"),
          draftFlagToggle(app, t, "respectRoleBlock", "Respektuj zablokowane role", "Nie przydzielaj graczowi roli, które oznaczył jako \"nie gra\" (⚙ na karcie gracza)."),
          draftFlagToggle(app, t, "avoidPreviousRole", "Unikaj roli z poprzedniego meczu", "Stara się nie dać graczowi tej samej roli, co w jego ostatnim odnotowanym meczu."),
          draftFlagToggle(app, t, "balanceByRank", "Balansuj drużyny wg rangi", "Przy losowaniu graczy (obie drużyny) dzieli graczy tak, by łączna ranga obu stron była możliwie równa - zamiast czysto losowo.")))));
}

function leverModes(app) {
  return {
    gold: { c1: "#ffcf4a", c2: "#e8912b", glow: "rgba(255,200,80,", sun: "linear-gradient(180deg,#fff3c4 0%,#ffcf4a 45%,#e8912b 100%)", label: "Losuje postacie", action: () => rollChamps(app) },
    blue: { c1: "#5ac8ff", c2: "#2563eb", glow: "rgba(90,200,255,", sun: "linear-gradient(180deg,#7df9ff 0%,#38bdf8 45%,#2563eb 100%)", label: "Losuje graczy (obie drużyny)", action: () => rollTeams(app, "all") },
    red: { c1: "#ff6b8b", c2: "#c81e3a", glow: "rgba(255,90,120,", sun: "linear-gradient(180deg,#ffd0da 0%,#ff6b8b 45%,#c81e3a 100%)", label: "Losuje graczy (w obrębie drużyn)", action: () => rollTeams(app, "team") }
  };
}
function casinoLever(app, pulled) {
  const mode = app.state.leverMode || "blue";
  const M = leverModes(app)[mode];
  const busy = app.state.rolling || app.state.rollingChamps;
  return h("div", { onClick: () => { if (!busy) M.action(); }, title: "Pociągnij — " + M.label, style: { position: "relative", width: 132, flex: 1, minHeight: 480, cursor: busy ? "default" : "pointer" } },
    h("div", { style: { position: "absolute", left: 6, top: 0, bottom: 0, width: 42, borderRadius: 14, background: "linear-gradient(90deg,#0a1630,#0a0f22)", boxShadow: "inset 0 0 0 1px " + M.glow + ".4), 0 0 22px " + M.glow + ".2)" } }),
    h("div", { style: { position: "absolute", left: 26, top: 12, bottom: 12, width: 2, borderRadius: 2, background: "linear-gradient(180deg," + M.c1 + "," + M.c2 + ")", boxShadow: "0 0 10px " + M.glow + ".8)", opacity: .8 } }),
    [0, 1, 2].map((i) => { const mk = ["gold", "blue", "red"][i]; const cfg = leverModes(app)[mk]; const on = mode === mk; return h("button", { key: mk, onClick: (e) => { e.stopPropagation(); app.setState({ leverMode: mk }); }, title: cfg.label, style: { position: "absolute", left: 20, top: (12 + i * 20) + "px", width: 14, height: 14, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer", background: "linear-gradient(135deg," + cfg.c1 + "," + cfg.c2 + ")", boxShadow: on ? "0 0 12px " + cfg.c1 + ", inset 0 0 0 2px #fff" : "inset 0 0 0 1px rgba(255,255,255,.25)", opacity: on ? 1 : .45, transition: "all .15s", zIndex: 3 } }); }),
    h("div", { style: { position: "absolute", left: 41, top: "calc(46% - 15px)", width: 30, height: 30, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%,#183050,#0a1424)", boxShadow: "inset 0 0 0 2px " + M.glow + ".6), 0 0 14px " + M.glow + ".4)" } }),
    h("div", { style: { position: "absolute", left: 51, top: "calc(46% - 168px)", width: 10, height: 168, borderRadius: 10, transformOrigin: "bottom center", transform: pulled ? "rotate(180deg)" : "rotate(-8deg)", transition: pulled ? "transform .3s cubic-bezier(.4,0,.6,1)" : "transform .6s cubic-bezier(.34,1.56,.64,1)", background: "linear-gradient(90deg,#dff3ff,#6f93b8 60%,#3a5170)", boxShadow: "0 0 12px " + M.glow + ".4)" } },
      h("div", { style: { position: "absolute", left: "50%", top: -32, transform: "translateX(-50%)", width: 60, height: 60, borderRadius: "50%", overflow: "hidden", background: M.sun, boxShadow: "0 0 28px " + M.glow + ".85)" } },
        [34, 42, 50].map((y) => h("div", { key: y, style: { position: "absolute", left: 0, right: 0, top: y, height: 2.5, background: "#0a1424" } })))));
}

function playRollSound(app) {
  try {
    if (!app._rollAudio) { app._rollAudio = new Audio("assets/roll-sound.mp3"); }
    const a = app._rollAudio; a.currentTime = 0; a.volume = app.state.muted ? 0.6 : Math.max(0.4, app.state.volume || 0.7);
    const pr = a.play(); if (pr && pr.catch) pr.catch(() => {});
  } catch (e) {}
}
function stopRollSound(app) { try { if (app._rollAudio) { app._rollAudio.pause(); app._rollAudio.currentTime = 0; } } catch (e) {} }

function rollChamps(app) {
  if (app.state.rolling || app.state.rollingChamps) return;
  const a = getDraftAssign(app);
  const order = [];
  ["blue", "red"].forEach((s) => DRAFT_ROLES.forEach((r) => { if (a[s][r]) order.push(s + ":" + r); }));
  if (!order.length) { app.toast("Najpierw dodaj graczy do slotów", true); return; }
  const rnd = draftRandomFn(app);
  const final = {}; order.forEach((fk) => { const c = randomChampWith(app, rnd); final[fk] = { champId: c.champId, champKey: c.champKey, champName: c.champName, rerolls: 0 }; });
  const disp = {}; order.forEach((fk) => { const c = randomChamp(app); disp[fk] = { champId: c.champId, champKey: c.champKey, champName: c.champName, rerolls: 0 }; });
  app._champRoll = { order, final, locked: {}, last: {}, flashAt: {}, t0: performance.now() };
  playRollSound(app);
  app.setState({ draftChamp: disp, rollingChamps: true }, () => { app._champRaf = requestAnimationFrame((n) => stepChampRoll(app, n)); });
}
function stepChampRoll(app, now) {
  const R = app._champRoll; if (!R) return;
  const el = now - R.t0;
  const dc = app.state.draftChamp;
  let allLocked = true;
  R.order.forEach((fk, i) => {
    const lockAt = 500 + i * 140;
    if (el >= lockAt) {
      if (!R.locked[fk]) { R.locked[fk] = true; dc[fk] = R.final[fk]; R.flashAt[fk] = now; }
    } else {
      allLocked = false;
      if (!R.last[fk] || now - R.last[fk] > 60) { const c = randomChamp(app); dc[fk] = { champId: c.champId, champKey: c.champKey, champName: c.champName, rerolls: 0 }; R.last[fk] = now; }
    }
  });
  app.forceUpdate();
  if (allLocked) { app.setState({ rollingChamps: false }); stopRollSound(app); app.toast("Rozlosowano postacie"); app._champRoll = null; return; }
  app._champRaf = requestAnimationFrame((n) => stepChampRoll(app, n));
}
function rollTeams(app, scopeArg) {
  if (app.state.rolling) return;
  const players = getAllDraftPlayers(app);
  const scope = scopeArg || app.state.rollScope || "all";
  const cur = getDraftAssign(app);
  const final = emptyDraft();
  const order = [];
  let poolKeys;
  const rnd = draftRandomFn(app);
  const settings = getDraftSettings(app);

  if (scope === "team") {
    let anyTeam = false;
    ["blue", "red"].forEach((side) => {
      const teamPlayers = DRAFT_ROLES.map((r) => cur[side][r]).filter(Boolean).map((k) => players[k]).filter(Boolean);
      if (teamPlayers.length) anyTeam = true;
      const roleMap = assignRolesForPool(app, teamPlayers, rnd);
      DRAFT_ROLES.forEach((r) => { if (roleMap[r]) { final[side][r] = roleMap[r]; order.push([side, r]); } });
    });
    if (!anyTeam) { app.toast("Najpierw przypisz graczy do drużyn", true); return; }
    poolKeys = Object.keys(getDraftUsed(app));
    if (!poolKeys.length) poolKeys = Object.keys(players);
  } else {
    const assigned = Object.keys(getDraftUsed(app));
    const pool = (assigned.length >= 2 ? assigned : Object.keys(players)).map((k) => players[k]).filter(Boolean);
    if (pool.length < 2) { app.toast("Dodaj co najmniej 2 graczy", true); return; }

    let blueTeam, redTeam;
    if (settings.balanceByRank) {
      // Zachłanne balansowanie: gracze wg malejącej rangi trafiają kolejno do drużyny, która
      // ma na razie NIŻSZĄ łączną siłę - standardowy algorytm na możliwie równe drużyny
      // (dokładniejszy niż samo naprzemienne rozdawanie po przetasowaniu).
      const ranked = pool.slice().sort((a, b) => draftRankScore(app, b) - draftRankScore(app, a));
      blueTeam = []; redTeam = [];
      let blueSum = 0, redSum = 0;
      ranked.forEach((p) => {
        const score = draftRankScore(app, p);
        if (blueTeam.length < 5 && (blueSum <= redSum || redTeam.length >= 5)) { blueTeam.push(p); blueSum += score; }
        else { redTeam.push(p); redSum += score; }
      });
    } else {
      const shuffled = shuffleWith(pool, rnd);
      blueTeam = []; redTeam = [];
      shuffled.forEach((p) => { (blueTeam.length <= redTeam.length && blueTeam.length < 5 ? blueTeam : redTeam).push(p); });
    }

    const blueRoles = assignRolesForPool(app, blueTeam, rnd);
    const redRoles = assignRolesForPool(app, redTeam, rnd);
    DRAFT_ROLES.forEach((r) => {
      if (blueRoles[r]) { final.blue[r] = blueRoles[r]; order.push(["blue", r]); }
      if (redRoles[r]) { final.red[r] = redRoles[r]; order.push(["red", r]); }
    });
    poolKeys = pool.map((p) => p.key);
  }

  const disp = emptyDraft();
  order.forEach(([s, r]) => { disp[s][r] = poolKeys[Math.floor(Math.random() * poolKeys.length)]; });
  app._roll = { final, order, poolKeys, locked: {}, last: {}, flashAt: {}, t0: performance.now() };
  playRollSound(app);
  app.setState({ draftAssign: disp, rolling: true }, () => { app._rollRaf = requestAnimationFrame((n) => stepRoll(app, n)); });
}
function stepRoll(app, now) {
  const R = app._roll; if (!R) return;
  const el = now - R.t0;
  const disp = app.state.draftAssign;
  let allLocked = true;
  R.order.forEach(([s, r], i) => {
    const fk = s + ":" + r;
    const lockAt = 800 + i * 150;
    if (el >= lockAt) {
      if (!R.locked[fk]) { R.locked[fk] = true; disp[s][r] = R.final[s][r]; R.flashAt[fk] = now; }
    } else {
      allLocked = false;
      if (!R.last[fk] || now - R.last[fk] > 65) { disp[s][r] = R.poolKeys[Math.floor(Math.random() * R.poolKeys.length)]; R.last[fk] = now; }
    }
  });
  app.forceUpdate();
  if (allLocked) { app.setState({ rolling: false }); stopRollSound(app); app.toast("Rozlosowano drużyny"); app._roll = null; return; }
  app._rollRaf = requestAnimationFrame((n) => stepRoll(app, n));
}

function draftRoleIcon(role, size) {
  return h("div", { style: { width: size, height: size, flex: "0 0 auto", position: "relative", opacity: .95 } },
    h("img", { src: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-parties/global/default/icon-position-" + DRAFT_ROLE_ICON[role] + ".png", alt: role, onError: (e) => { e.target.style.display = "none"; }, style: { width: "100%", height: "100%", objectFit: "contain", filter: "brightness(1.4)" } }));
}

function draftSlot(app, side, role) {
  const t = app.theme();
  const a = getDraftAssign(app);
  const key = a[side][role]; const p = key ? getDraftPlayer(app, key) : null;
  const col = side === "blue" ? t.blue : t.red;
  const rolling = app.state.rolling;
  const fk = side + ":" + role;
  const justLocked = (app._roll && app._roll.flashAt[fk] && (performance.now() - app._roll.flashAt[fk] < 480)) || (app._champRoll && app._champRoll.flashAt[fk] && (performance.now() - app._champRoll.flashAt[fk] < 480));
  const champ = (app.state.draftChamp || {})[fk];
  const champCycling = app.state.rollingChamps && app._champRoll && !app._champRoll.locked[fk];
  return h("div", {
    key: role,
    onDragOver: (e) => { if (rolling) return; e.preventDefault(); e.currentTarget.style.boxShadow = "inset 0 0 0 2px " + col; },
    onDragLeave: (e) => { e.currentTarget.style.boxShadow = "none"; },
    onDrop: (e) => { if (rolling) return; e.preventDefault(); e.currentTarget.style.boxShadow = "none"; const dk = e.dataTransfer.getData("text/plain"); if (dk) placeInSlot(app, dk, side, role); },
    onMouseEnter: (e) => { const x = e.currentTarget.querySelector("[data-x]"); if (x) x.style.opacity = 1; const g = e.currentTarget.querySelector("[data-slotgear]"); if (g) g.style.opacity = 1; },
    onMouseLeave: (e) => { const x = e.currentTarget.querySelector("[data-x]"); if (x) x.style.opacity = 0; const g = e.currentTarget.querySelector("[data-slotgear]"); if (g && app.state.roleMenu !== (p && p.key)) g.style.opacity = 0; },
    style: { flex: 1, minWidth: 0, position: "relative", aspectRatio: "308 / 560", display: "flex", flexDirection: "column", borderRight: role !== "SUP" ? "1px solid " + t.line : "none", transition: "box-shadow .12s", animation: justLocked ? "lolLock .48s ease" : "none" }
  },
    h("div", { style: { flex: 1, position: "relative", overflow: "hidden" } },
      p ? (champ
        ? h("img", { src: window.LOLData.IMG.champLoading(champ.champKey), alt: champ.champName, loading: "lazy", decoding: "async", onError: (e) => { e.target.style.display = "none"; }, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 22%", filter: champCycling ? "brightness(1.15) saturate(1.2)" : "none" } })
        : (rolling
          ? h("img", { src: window.Monsters ? window.Monsters.svgUriFor(p.nick || p.summoner) : "", alt: p.nick, loading: "lazy", decoding: "async", style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: (app._roll && app._roll.locked[fk]) ? "none" : "brightness(1.15) saturate(1.2)" } })
          : h("div", { style: { position: "absolute", inset: 0 } }, monsterInline(app, p.nick || p.summoner)))) : null,
      (p && !rolling && !app.state.rollingChamps) ? h("button", { "data-x": 1, onClick: (e) => { e.stopPropagation(); removeFromSlot(app, side, role); }, title: "Usuń", style: { position: "absolute", top: 6, right: 6, zIndex: 4, width: 22, height: 22, borderRadius: 6, border: "1px solid rgba(255,255,255,.25)", background: "rgba(6,10,18,.6)", color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: 1, opacity: 0, transition: "opacity .18s", display: "flex", alignItems: "center", justifyContent: "center" } }, "✕") : null,
      (p && !rolling && !app.state.rollingChamps) ? h("button", { "data-slotgear": 1, onClick: (e) => { e.stopPropagation(); app.setState({ roleMenu: app.state.roleMenu === p.key ? null : p.key }); }, title: "Ustaw role", style: { position: "absolute", top: 6, left: 6, zIndex: 5, width: 22, height: 22, borderRadius: 6, border: "1px solid rgba(255,255,255,.25)", background: "rgba(6,10,18,.6)", color: roleBlockCount(app, p.key) ? t.accent : "#fff", cursor: "pointer", fontSize: 12, lineHeight: 1, opacity: app.state.roleMenu === p.key || roleBlockCount(app, p.key) ? 1 : 0, transition: "opacity .18s", display: "flex", alignItems: "center", justifyContent: "center" } }, "⚙") : null,
      (p && champ) ? h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", gap: 7, padding: "20px 7px 7px", background: "linear-gradient(to top,rgba(5,4,10,.94),transparent)" } },
        h("div", { style: { minWidth: 0, flex: 1 } },
          h("div", { style: { fontSize: 12.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, champ.champName),
          h("div", { style: { fontSize: 9, color: "rgba(255,255,255,.5)", fontFamily: t.mono } }, "reroll " + champ.rerolls + "/" + getDraftSettings(app).rerollLimit)),
        (!rolling && !app.state.rollingChamps && champ.rerolls < getDraftSettings(app).rerollLimit) ? h("button", { onClick: (e) => { e.stopPropagation(); rerollChamp(app, side, role); }, title: "Losuj postać ponownie", style: { flex: "0 0 auto", cursor: "pointer", width: 26, height: 26, borderRadius: 7, border: "1px solid rgba(90,200,255,.4)", background: "rgba(90,200,255,.14)", color: "#dff3ff", fontSize: 13 } }, "⟳") : null) : null),
    h("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "10px 9px", borderTop: "1px solid " + t.line, background: "rgba(0,0,0,.32)" } },
      draftRoleIcon(role, 20),
      h("span", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 16, color: p ? t.text : t.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, textAlign: "center" } }, p ? (p.nick || p.summoner) : "—")),
    (p && app.state.roleMenu === p.key) ? roleMenuOverlay(app, p) : null);
}

function draftTeamPanel(app, side) {
  const t = app.theme();
  const a = getDraftAssign(app);
  const col = side === "blue" ? t.blue : t.red;
  const label = side === "blue" ? "DRUŻYNA LEWA" : "DRUŻYNA PRAWA";
  const filled = DRAFT_ROLES.filter((r) => a[side][r]).length;
  return h("div", { style: { background: t.panel, border: "1px solid " + col + "55", borderRadius: 14, overflow: "hidden" } },
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: side === "blue" ? "rgba(76,134,255,.08)" : "rgba(255,93,108,.08)", borderBottom: "1px solid " + t.line } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 9 } }, h("span", { style: { color: col, fontSize: 12 } }, "◆"), h("span", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 15, letterSpacing: 1, color: t.text } }, label)),
      h("span", { style: { fontFamily: t.mono, fontSize: 13, color: t.mut } }, filled + "/5")),
    h("div", { style: { display: "flex" } }, DRAFT_ROLES.map((r) => draftSlot(app, side, r))));
}

function renderDraftView(app) {
  const t = app.theme();
  const draftSettings = getDraftSettings(app);
  const allPlayers = Object.values(getAllDraftPlayers(app));
  const q = (app.state.draftSearch || "").toLowerCase().trim();
  const sort = app.state.draftSort || "games";
  const lastGid = (p) => (p.matches || []).reduce((mx, m) => Math.max(mx, m.gid || 0), 0);
  const players = allPlayers.filter((p) => !q || ((p.nick || "") + " " + (p.summoner || "")).toLowerCase().includes(q))
    .sort((a, b) => sort === "alpha" ? (a.nick || a.summoner || "").localeCompare(b.nick || b.summoner || "") : sort === "recent" ? lastGid(b) - lastGid(a) : b.games - a.games);
  const used = getDraftUsed(app);
  const usedCount = Object.keys(used).length;
  const gid = app.state.matches.reduce((mx, m) => Math.max(mx, m.gid || 0), 0) + 1;

  return h("div", { style: { padding: "34px 40px 60px", maxWidth: 1240, margin: "0 auto", animation: "lolFade .35s ease" } },
    h("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 } },
      h("span", { style: { fontSize: 13, color: t.mut } }, usedCount + "/10 slotów zajętych"),
      h("button", { onClick: () => app.setState({ draftSettingsOpen: true }), title: "Ustawienia losowania", style: { flex: "0 0 auto", cursor: "pointer", width: 26, height: 26, borderRadius: 8, border: "1px solid " + t.line2, background: "transparent", color: t.faint, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" } }, "⚙")),
    h("div", { style: { display: "grid", gridTemplateColumns: "210px minmax(0,1fr)", gap: 22, alignItems: "stretch" } },
      h("div", { style: { position: "relative", minHeight: 0 } },
        h("div", { style: { position: "absolute", inset: 0, background: t.panel, border: "1px solid " + t.line, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" } },
          h("div", { style: { padding: "12px 16px 10px", borderBottom: "1px solid " + t.line } },
            h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 } },
              h("span", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 14 } }, "Gracze (" + players.length + ")"),
              h("div", { style: { display: "flex", gap: 6 } },
                usedCount ? h("button", { onClick: () => { if (!app.state.rolling) clearDraft(app); }, title: "Wyczyść drużyny", style: { display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", width: 26, height: 26, borderRadius: 8, border: "1px solid rgba(255,120,140,.4)", background: "rgba(255,90,120,.12)", color: "#ff9aae", fontSize: 15, fontWeight: 700, lineHeight: 1 } }, "✕") : null,
                h("button", { onClick: () => app.setState({ addPlayerOpen: true, newPlayer: "" }), title: "Dodaj gracza", style: { display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", width: 26, height: 26, borderRadius: 8, border: "1px solid rgba(90,200,255,.45)", background: "rgba(90,200,255,.14)", color: "#dff3ff", fontSize: 18, fontWeight: 700, lineHeight: 1, textShadow: "0 0 8px rgba(90,200,255,.4)" } }, "＋"))),
            h("div", { style: { position: "relative", marginBottom: 9 } },
              h("span", { style: { position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.faint, fontSize: 13, pointerEvents: "none" } }, "⌕"),
              h("input", { value: app.state.draftSearch || "", onChange: (e) => app.setState({ draftSearch: e.target.value }), placeholder: "Szukaj gracza…", style: { width: "100%", background: t.panel2, color: t.text, border: "1px solid " + t.line2, borderRadius: 9, padding: "8px 28px", fontSize: 13, fontFamily: t.disp, outline: "none" } }),
              (app.state.draftSearch) ? h("button", { onClick: () => app.setState({ draftSearch: "" }), style: { position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", cursor: "pointer", border: "none", background: "transparent", color: t.faint, fontSize: 13 } }, "✕") : null),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 5 } }, [["games", "Ilość gier"], ["alpha", "A–Z"], ["recent", "Ostatnia gra"]].map(([k, l]) => chip(t, l, (app.state.draftSort || "games") === k, () => app.setState({ draftSort: k }))))),
          h("div", { className: "lolscroll", style: { flex: 1, minHeight: 0, overflowY: "auto" } }, players.length ? players.map((p) => {
            const on = !!used[p.key];
            const lastRole = draftSettings.avoidPreviousRole ? draftLastRole(p) : null;
            return h("div", { key: p.key, draggable: true, onDragStart: (e) => { e.dataTransfer.setData("text/plain", p.key); e.dataTransfer.effectAllowed = "move"; }, onClick: () => addToNextSlot(app, p.key), title: on ? "Kliknij, aby usunąć ze slotu" : "Kliknij, aby dodać do drużyny", style: { position: "relative", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: "1px solid " + t.line, background: on ? "rgba(61,220,151,.08)" : "transparent", opacity: on ? .65 : 1 }, onMouseEnter: (e) => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,.03)"; }, onMouseLeave: (e) => { e.currentTarget.style.background = on ? "rgba(61,220,151,.08)" : "transparent"; } },
              profileImg(app, p, 30),
              h("div", { style: { minWidth: 0, flex: 1 } }, h("div", { style: { fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, p.nick || p.summoner)),
              lastRole ? h("div", { title: "Poprzedni mecz: " + DRAFT_ROLE_LABEL[lastRole], style: { flex: "0 0 auto", display: "flex", alignItems: "center", gap: 4, padding: "2px 6px", borderRadius: 6, background: "rgba(255,180,80,.12)", border: "1px solid rgba(255,180,80,.3)" } },
                draftRoleIcon(lastRole, 13),
                h("span", { style: { fontSize: 9.5, fontWeight: 700, color: "#ffcf8a", fontFamily: t.mono, letterSpacing: .3 } }, DRAFT_ROLE_LABEL[lastRole])) : null,
              on ? h("span", { style: { fontSize: 12, color: t.accent, fontWeight: 800 } }, "✓") : h("span", { style: { fontSize: 15, color: t.faint } }, "+"));
          }) : h("div", { style: { padding: "24px 16px", textAlign: "center", color: t.faint, fontSize: 12.5 } }, "Brak graczy")))),
      h("div", { style: { display: "flex", gap: 18, alignItems: "stretch" } },
        h("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0 } },
          draftTeamPanel(app, "blue"),
          h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "16px 0" } },
            h("span", { style: { fontFamily: t.disp, fontWeight: 700, fontSize: 22, color: t.text, letterSpacing: 2 } }, "VS"),
            h("span", { style: { fontFamily: t.mono, fontSize: 15, fontWeight: 700, color: "#dff3ff", background: "rgba(90,200,255,.14)", border: "1px solid rgba(90,200,255,.4)", borderRadius: 8, padding: "4px 12px", letterSpacing: 1, textShadow: "0 0 10px rgba(90,200,255,.5)" } }, "GID #" + gid)),
          draftTeamPanel(app, "red")),
        h("div", { style: { display: "flex", flexDirection: "column", alignSelf: "stretch" } }, casinoLever(app, app.state.rolling || app.state.rollingChamps)))),
    app.state.addPlayerOpen ? addPlayerModal(app) : null,
    app.state.draftSettingsOpen ? draftSettingsModal(app) : null);
}

window.BrowserViews.draft = renderDraftView;
