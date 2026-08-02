/* ============================================================================
   browserData.js — warstwa danych dla nowej "Przeglądarki meczy" (port
   lol-data.js z designu "System przeglądania meczy"). Eksponuje window.LOLData
   z tym samym kontraktem co oryginał (ROLES/ROLE_LABEL/aggregate/loadStatic/
   IMG/norm), ale ZAMIAST csvToMatches/parseCSV/SAMPLE_MATCHES/PUUID_NICK ma
   buildMatchesFromStore(storedMatches, playersByPuuid, statics) - buduje
   dokładnie ten sam kształt Match/Player wprost z naszych realnych danych
   (window.api.store.listMatches()), bez przechodzenia przez CSV.
   ========================================================================== */
(function () {
  const ROLES = ["TOP", "JNG", "MID", "BOT", "SUP"];
  const ROLE_LABEL = { TOP: "Top", JNG: "Jungle", MID: "Mid", BOT: "Bot", SUP: "Support" };
  const ROLE_FULL = { TOP: "Top", JNG: "Jungla", MID: "Mid", BOT: "ADC", SUP: "Support" };

  const SPELL_MAP = {
    1: ["SummonerBoost", "Cleanse"], 3: ["SummonerExhaust", "Exhaust"],
    4: ["SummonerFlash", "Flash"], 6: ["SummonerHaste", "Ghost"],
    7: ["SummonerHeal", "Heal"], 11: ["SummonerSmite", "Smite"],
    12: ["SummonerTeleport", "Teleport"], 13: ["SummonerMana", "Clarity"],
    14: ["SummonerDot", "Ignite"], 21: ["SummonerBarrier", "Barrier"],
    32: ["SummonerSnowball", "Snowball"]
  };

  // Awaryjna mapa championId -> [key, name] gdy Data Dragon nie odpowie (offline).
  const CHAMP_STATIC = {
    11: ["MasterYi", "Master Yi"], 16: ["Soraka", "Soraka"], 17: ["Teemo", "Teemo"],
    21: ["MissFortune", "Miss Fortune"], 22: ["Ashe", "Ashe"], 34: ["Anivia", "Anivia"],
    35: ["Shaco", "Shaco"], 36: ["DrMundo", "Dr. Mundo"], 48: ["Trundle", "Trundle"],
    50: ["Swain", "Swain"], 51: ["Caitlyn", "Caitlyn"], 63: ["Brand", "Brand"],
    78: ["Poppy", "Poppy"], 113: ["Sejuani", "Sejuani"], 134: ["Syndra", "Syndra"],
    154: ["Zac", "Zac"], 157: ["Yasuo", "Yasuo"], 201: ["Braum", "Braum"],
    901: ["Smolder", "Smolder"]
  };

  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  function P(o) {
    return Object.assign({
      spell1: 4, spell2: 4, keystone: 0, primaryStyle: 0, subStyle: 0,
      doubles: 0, triples: 0, quadras: 0, pentas: 0,
      largestSpree: 0, largestMulti: 0, firstBlood: false, firstTower: false,
      dmgObjectives: 0, selfMitigated: 0, healed: 0, controlWards: 0
    }, o);
  }

  // -------------------------------------------------------------------------
  //  Data Dragon / Community Dragon static loader (cached w localStorage) -
  //  identyczne jak w oryginale, niezależne od źródła meczów.
  // -------------------------------------------------------------------------
  const DD = "https://ddragon.leagueoflegends.com/cdn/";
  const CACHE_KEY = "lolStaticCache_v1";
  let _staticPromise = null;

  async function loadStatic() {
    if (_staticPromise) return _staticPromise;
    _staticPromise = (async () => {
      try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        if (c && c.version && c.champById) return hydrate(c);
      } catch (e) {}
      let version = "15.24.1";
      try {
        const vs = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then((r) => r.json());
        if (Array.isArray(vs) && vs[0]) version = vs[0];
      } catch (e) {}
      const base = DD + version + "/data/en_US/";
      const champById = {}, itemName = {}, spellById = {}, runeById = {};
      try {
        const champ = await fetch(base + "champion.json").then((r) => r.json());
        Object.values(champ.data).forEach((c) => { champById[+c.key] = [c.id, c.name]; });
      } catch (e) { Object.assign(champById, CHAMP_STATIC); }
      try {
        const items = await fetch(base + "item.json").then((r) => r.json());
        Object.entries(items.data).forEach(([id, it]) => { itemName[id] = it.name; });
      } catch (e) {}
      try {
        const sp = await fetch(base + "summoner.json").then((r) => r.json());
        Object.values(sp.data).forEach((s) => { spellById[+s.key] = [s.id, s.name]; });
      } catch (e) {}
      try {
        const runes = await fetch(base + "runesReforged.json").then((r) => r.json());
        runes.forEach((style) => {
          runeById[style.id] = { icon: style.icon, name: style.name };
          (style.slots || []).forEach((slot) => (slot.runes || []).forEach((rn) => {
            runeById[rn.id] = { icon: rn.icon, name: rn.name };
          }));
        });
      } catch (e) {}
      const data = { version, champById, itemName, spellById, runeById };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) {}
      return hydrate(data);
    })();
    return _staticPromise;
  }

  function hydrate(data) {
    const champById = Object.assign({}, CHAMP_STATIC, data.champById || {});
    const champByName = {};
    Object.entries(champById).forEach(([id, arr]) => { champByName[norm(arr[1])] = +id; champByName[norm(arr[0])] = +id; });
    const spellById = Object.assign({}, data.spellById || {});
    Object.entries(SPELL_MAP).forEach(([id, arr]) => { if (!spellById[id]) spellById[id] = arr; });
    return { version: data.version || "15.24.1", champById, champByName, itemName: data.itemName || {}, spellById, runeById: data.runeById || {} };
  }

  const IMG = {
    champ: (ver, key) => key ? DD + ver + "/img/champion/" + key + ".png" : "",
    champLoading: (key) => key ? "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/" + key + "_0.jpg" : "",
    champSplash: (key) => key ? "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/" + key + "_0.jpg" : "",
    item: (ver, id) => id && id > 0 ? DD + ver + "/img/item/" + id + ".png" : "",
    spell: (ver, key) => key ? DD + ver + "/img/spell/" + key + ".png" : "",
    rune: (icon) => icon ? "https://ddragon.leagueoflegends.com/cdn/img/" + icon : "",
    profile: (ver, id) => DD + ver + "/img/profileicon/" + (id || 0) + ".png",
    cdragProfile: (id) => "https://raw.communitydragon.org/latest/game/assets/loadouts/summoneremblems/" + id + ".png"
  };

  // -------------------------------------------------------------------------
  //  Adapter: nasze realne dane (window.api.store.listMatches()) -> dokładnie
  //  ten sam kształt Match/Player, jakiego oczekuje aggregate() niżej.
  // -------------------------------------------------------------------------
  const POS_ROLE = { TOP: "TOP", JUNGLE: "JNG", MIDDLE: "MID", MID: "MID", BOTTOM: "BOT", BOT: "BOT", UTILITY: "SUP", SUPPORT: "SUP" };
  const ROLE_ORDER = { TOP: 0, JNG: 1, MID: 2, BOT: 3, SUP: 4 };

  function truthy(v) {
    return v === true || v === "true" || v === "TRUE" || v === 1 || v === "1";
  }

  function isBlueLike(team) { return team === "BLUE" || team === "LEFT"; }
  function isRedLike(team) { return team === "RED" || team === "RIGHT"; }

  function parseBanNamesToIds(bansField, nameToId) {
    return String(bansField || "")
      .split(",")
      .map((s) => s.trim())
      .map((name) => (!name || /^none$/i.test(name) ? -1 : (nameToId[norm(name)] || -1)));
  }

  /**
   * Buduje jednego gracza w kształcie Player (patrz szczyt pliku) z naszego
   * realnego wiersza MatchPlayers. `extraStats` to opcjonalna mapa
   * puuid -> surowy blok statystyk (patrz ddragon.js extractRawStatsMap) -
   * dogrywa pola, których nie trzymamy w znormalizowanym MatchPlayers
   * (largestKillingSpree/largestMultiKill/damageDealtToObjectives) tam, gdzie
   * są dostępne (mecze z LCU) - w innych meczach (arkusz ligi/stary JSON)
   * zostają na 0, tak jak zawsze w tej apce przy brakujących surowych danych.
   */
  function buildPlayer(mp, playersByPuuid, statics, extraStats) {
    const known = mp.puuid && playersByPuuid[mp.puuid];
    const nick = (known && known.nick) || String(mp.summonerName || "").split("#")[0] || mp.puuid || "?";
    const [summoner, tag] = String(mp.summonerName || "").split("#");
    const champId = Number(mp.championId) || statics.champByName[norm(mp.championName)] || 0;
    const cinfo = statics.champById[champId] || CHAMP_STATIC[champId] || [mp.championName || String(champId), mp.championName || String(champId)];
    const extra = (extraStats && mp.puuid && extraStats[mp.puuid]) || {};
    return P({
      role: POS_ROLE[String(mp.teamPosition || "").toUpperCase()] || "",
      champId, champKey: cinfo[0], champName: mp.championName || cinfo[1],
      nick, summoner: summoner || nick, tag: tag || "", puuid: mp.puuid || "", icon: (known && Number(known.profileIconId)) || 0,
      songUrl: (known && known.songUrl) || "", monsterConfig: (known && known.monsterConfig) || "",
      spell1: Number(mp.spell1) || 0, spell2: Number(mp.spell2) || 0,
      keystone: Number(mp.keystone) || 0, primaryStyle: Number(mp.primaryRuneStyle) || 0, subStyle: Number(mp.subRuneStyle) || 0,
      level: Number(mp.champLevel) || 0,
      k: Number(mp.kills) || 0, d: Number(mp.deaths) || 0, a: Number(mp.assists) || 0,
      gold: Number(mp.goldEarned) || 0, cs: Number(mp.cs) || 0,
      dmgChamp: Number(mp.damageDealtToChampions) || 0, dmgTaken: Number(mp.damageTaken) || 0,
      selfMitigated: Number(mp.damageSelfMitigated) || 0, healed: Number(mp.totalHeal) || 0,
      dmgObjectives: Number(extra.damageDealtToObjectives) || 0,
      vision: Number(mp.visionScore) || 0, wardsPlaced: Number(mp.wardsPlaced) || 0,
      wardsKilled: Number(mp.wardsKilled) || 0, controlWards: Number(mp.controlWardsPlaced) || 0,
      doubles: Number(mp.doubleKills) || 0, triples: Number(mp.tripleKills) || 0,
      quadras: Number(mp.quadraKills) || 0, pentas: Number(mp.pentaKills) || 0,
      largestSpree: Number(extra.largestKillingSpree) || 0, largestMulti: Number(extra.largestMultiKill) || 0,
      firstBlood: truthy(mp.firstBloodKill), firstTower: truthy(mp.firstTowerKill),
      items: [mp.item0, mp.item1, mp.item2, mp.item3, mp.item4, mp.item5, mp.item6].map((x) => Number(x) || 0),
      win: truthy(mp.win)
    });
  }

  /**
   * storedMatches: [{ match, players }] - dokładnie to, co zwraca
   * window.api.store.listMatches(). playersByPuuid: z buildPlayersByPuuid()
   * (common.js) - Players sheet jako źródło prawdy dla nicków, tak samo jak
   * w reszcie apki. getExtraStats: opcjonalna funkcja (match) -> mapa
   * puuid->surowe staty (patrz extractRawStatsMap w ddragon.js).
   */
  function buildMatchesFromStore(storedMatches, playersByPuuid, statics, getExtraStats) {
    return (storedMatches || []).map(({ match, players }) => {
      const extraStats = getExtraStats ? getExtraStats(match) : null;
      const blue = (players || []).filter((p) => isBlueLike(p.team)).map((p) => buildPlayer(p, playersByPuuid, statics, extraStats));
      const red = (players || []).filter((p) => isRedLike(p.team)).map((p) => buildPlayer(p, playersByPuuid, statics, extraStats));
      const byRole = (arr) => arr.slice().sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));
      const winner = match.winningTeam === "RIGHT" ? "RED" : match.winningTeam === "LEFT" ? "BLUE" : String(match.winningTeam || "").toUpperCase();
      const objOf = (prefix) => ({
        baron: Number(match[prefix + "BaronKills"]) || 0,
        dragon: Number(match[prefix + "DragonKills"]) || 0,
        herald: Number(match[prefix + "HeraldKills"]) || 0,
        tower: Number(match[prefix + "TowerKills"]) || 0,
        inhib: Number(match[prefix + "InhibKills"]) || 0,
        grubs: 0
      });
      return {
        id: String(match.matchId), gid: Number(match.gid) || 0,
        date: match.gameCreationDate, durationSec: Number(match.gameDurationSec) || 0,
        patch: match.patch || "", winner,
        notesImg: /^https?:\/\//i.test(match.notes || "") ? match.notes : "",
        notes: match.notes || "",
        bans: {
          blue: parseBanNamesToIds(match.blueBans, statics.champByName),
          red: parseBanNamesToIds(match.redBans, statics.champByName)
        },
        teams: {
          blue: { win: winner === "BLUE", obj: objOf("blue"), players: byRole(blue) },
          red: { win: winner === "RED", obj: objOf("red"), players: byRole(red) }
        }
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  // -------------------------------------------------------------------------
  //  Agregacja: per gracz, per rola (średnie), per champion, duosy - 1:1 port
  //  z oryginalnego lol-data.js, niezależne od źródła danych.
  // -------------------------------------------------------------------------
  function eachPlayer(matches, fn) {
    matches.forEach((m) => {
      ["blue", "red"].forEach((side) => {
        m.teams[side].players.forEach((p) => fn(p, side, m));
      });
    });
  }

  function aggregate(matches) {
    const players = {};
    const roleSum = {};
    const champs = {};
    const F = ["k", "d", "a", "gold", "cs", "dmgChamp", "dmgTaken", "vision", "wardsPlaced", "wardsKilled", "controlWards", "selfMitigated", "healed", "dmgObjectives", "level"];

    eachPlayer(matches, (p, side, m) => {
      const mins = (m.durationSec || 1) / 60;
      const win = (m.teams[side] && m.teams[side].win) || p.win || false;
      const key = norm(p.nick) || p.puuid || norm(p.summoner);
      const pl = players[key] || (players[key] = {
        key, nick: p.nick, summoner: p.summoner, tag: p.tag, puuid: p.puuid, icon: p.icon,
        songUrl: p.songUrl || "", monsterConfig: p.monsterConfig || "",
        games: 0, wins: 0, sums: {}, roles: {}, champs: {}, matches: []
      });
      pl.games++; if (win) pl.wins++;
      pl.nick = p.nick || pl.nick; pl.summoner = p.summoner || pl.summoner; pl.icon = p.icon || pl.icon;
      pl.songUrl = p.songUrl || pl.songUrl; pl.monsterConfig = p.monsterConfig || pl.monsterConfig;
      pl.roles[p.role] = (pl.roles[p.role] || 0) + 1;
      pl.champs[p.champId] = pl.champs[p.champId] || { champId: p.champId, champKey: p.champKey, champName: p.champName, games: 0, wins: 0, k: 0, d: 0, a: 0 };
      const pc = pl.champs[p.champId]; pc.games++; if (win) pc.wins++; pc.k += p.k; pc.d += p.d; pc.a += p.a;
      F.forEach((f) => { pl.sums[f] = (pl.sums[f] || 0) + (p[f] || 0); });
      pl.sums.csPerMin = (pl.sums.csPerMin || 0) + (p.cs || 0) / mins;
      pl.sums.goldPerMin = (pl.sums.goldPerMin || 0) + (p.gold || 0) / mins;
      pl.matches.push({ matchId: m.id, gid: m.gid || 0, side, role: p.role, champId: p.champId, champKey: p.champKey, champName: p.champName, k: p.k, d: p.d, a: p.a, cs: p.cs, gold: p.gold, dmgChamp: p.dmgChamp, dmgTaken: p.dmgTaken, vision: p.vision, win: win, date: m.date, durationSec: m.durationSec });

      const rs = roleSum[p.role] || (roleSum[p.role] = { n: 0, sums: {} });
      rs.n++;
      F.forEach((f) => { rs.sums[f] = (rs.sums[f] || 0) + (p[f] || 0); });
      rs.sums.csPerMin = (rs.sums.csPerMin || 0) + (p.cs || 0) / mins;
      rs.sums.goldPerMin = (rs.sums.goldPerMin || 0) + (p.gold || 0) / mins;
      rs.sums.kda = (rs.sums.kda || 0) + (p.k + p.a) / Math.max(1, p.d);

      const ch = champs[p.champId] || (champs[p.champId] = { champId: p.champId, champKey: p.champKey, champName: p.champName, games: 0, wins: 0, k: 0, d: 0, a: 0, dmgChamp: 0, gold: 0, cs: 0, bans: 0, sums: {} });
      ch.games++; if (win) ch.wins++; ch.k += p.k; ch.d += p.d; ch.a += p.a; ch.dmgChamp += p.dmgChamp; ch.gold += p.gold; ch.cs += p.cs;
      F.forEach((f) => { ch.sums[f] = (ch.sums[f] || 0) + (p[f] || 0); });
      ch.sums.csPerMin = (ch.sums.csPerMin || 0) + (p.cs || 0) / mins;
      ch.sums.goldPerMin = (ch.sums.goldPerMin || 0) + (p.gold || 0) / mins;
    });

    matches.forEach((m) => {
      [].concat(m.bans.blue, m.bans.red).forEach((id) => {
        if (id > 0) { const ch = champs[id] || (champs[id] = { champId: id, games: 0, wins: 0, k: 0, d: 0, a: 0, dmgChamp: 0, gold: 0, cs: 0, bans: 0 }); ch.bans++; }
      });
    });

    const roleAverages = {};
    Object.entries(roleSum).forEach(([role, rs]) => {
      const avg = { n: rs.n };
      Object.entries(rs.sums).forEach(([f, v]) => { avg[f] = v / rs.n; });
      roleAverages[role] = avg;
    });

    Object.values(players).forEach((pl) => {
      pl.avg = {};
      Object.entries(pl.sums).forEach(([f, v]) => { pl.avg[f] = v / pl.games; });
      pl.kda = (pl.sums.k + pl.sums.a) / Math.max(1, pl.sums.d);
      pl.winrate = pl.games ? pl.wins / pl.games : 0;
      pl.mainRole = Object.entries(pl.roles).sort((a, b) => b[1] - a[1])[0][0];
      pl.topChamps = Object.values(pl.champs).sort((a, b) => b.games - a.games || (b.k + b.a) - (a.k + a.a));
      pl.streaks = streaks(pl.matches);
    });

    const duosMap = {};
    matches.forEach((m) => {
      ["blue", "red"].forEach((side) => {
        const ps = m.teams[side].players; const won = m.teams[side].win;
        for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
          const ka = norm(ps[i].nick) || ps[i].puuid, kb = norm(ps[j].nick) || ps[j].puuid;
          const pk = [ka, kb].sort().join("__");
          const d = duosMap[pk] || (duosMap[pk] = { a: ka, b: kb, games: 0, wins: 0 });
          d.games++; if (won) d.wins++;
        }
      });
    });
    const duos = Object.values(duosMap).map((d) => {
      const pa = players[d.a] || {}, pb = players[d.b] || {};
      return { a: pa, b: pb, games: d.games, wins: d.wins, winrate: d.games ? d.wins / d.games : 0 };
    }).filter((d) => d.a.nick && d.b.nick).sort((a, b) => b.games - a.games || b.winrate - a.winrate);

    Object.values(champs).forEach((ch) => {
      ch.winrate = ch.games ? ch.wins / ch.games : 0;
      ch.kda = (ch.k + ch.a) / Math.max(1, ch.d);
      ch.avg = {};
      if (ch.sums) { Object.entries(ch.sums).forEach(([f, v]) => { ch.avg[f] = v / Math.max(1, ch.games); }); }
      ch.avg.kda = ch.kda;
    });

    return { players, roleAverages, champions: champs, duos };
  }

  function streaks(ms) {
    const s = ms.slice().sort((a, b) => (a.gid || 0) - (b.gid || 0) || new Date(a.date) - new Date(b.date));
    let lw = 0, ll = 0, cw = 0, cl = 0;
    s.forEach((m) => {
      if (m.win) { cw++; cl = 0; if (cw > lw) lw = cw; }
      else { cl++; cw = 0; if (cl > ll) ll = cl; }
    });
    let cur = 0;
    for (let i = s.length - 1; i >= 0; i--) {
      const sgn = s[i].win ? 1 : -1;
      if (cur === 0) cur = sgn;
      else if (Math.sign(cur) === sgn) cur += sgn;
      else break;
    }
    return { longestWin: lw, longestLoss: ll, current: cur, form: s.slice(-14).map((x) => x.win) };
  }

  window.LOLData = {
    ROLES, ROLE_LABEL, ROLE_FULL, SPELL_MAP, CHAMP_STATIC,
    loadStatic, aggregate, buildMatchesFromStore,
    IMG, norm
  };
})();
