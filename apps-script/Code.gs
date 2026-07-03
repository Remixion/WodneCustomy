/**
 * WodneCustomy - backend Google Apps Script dla arkusza z danymi
 * z customowych gier 5v5 League of Legends.
 *
 * Wdrożenie: Rozszerzenia -> Apps Script -> wklej ten plik oraz appsscript.json,
 * ustaw SHARED_SECRET w Właściwości skryptu (Project Settings -> Script Properties),
 * następnie Wdróż -> Nowe wdrożenie -> Aplikacja internetowa
 *   Wykonaj jako: Ja (właściciel arkusza)
 *   Dostęp mają: Każdy (Anyone)
 * Skopiuj URL /exec i wklej go w apce desktopowej oraz na stronie GitHub Pages.
 */

var SHEET_MATCHES = 'Matches';
var SHEET_MATCH_PLAYERS = 'MatchPlayers';
var SHEET_PLAYERS = 'Players';

var MATCHES_HEADERS = [
  'matchId', 'gameCreationDate', 'gameDurationSec', 'gameMode', 'gameType',
  'mapId', 'queueId', 'gameVersion', 'winningTeam',
  'blueBans', 'redBans',
  'blueBaronKills', 'blueDragonKills', 'blueHeraldKills', 'blueTowerKills', 'blueInhibKills',
  'redBaronKills', 'redDragonKills', 'redHeraldKills', 'redTowerKills', 'redInhibKills',
  'notes', 'rawDataJson', 'createdAt', 'updatedAt'
];

var MATCH_PLAYERS_HEADERS = [
  'matchId', 'team', 'puuid', 'summonerName', 'championName', 'championId', 'teamPosition',
  'spell1', 'spell2', 'primaryRuneStyle', 'subRuneStyle', 'keystone', 'champLevel',
  'kills', 'deaths', 'assists', 'kda', 'cs', 'csPerMin',
  'goldEarned', 'damageDealtToChampions', 'damageTaken', 'damageSelfMitigated', 'totalHeal',
  'visionScore', 'wardsPlaced', 'wardsKilled', 'controlWardsPlaced',
  'item0', 'item1', 'item2', 'item3', 'item4', 'item5', 'item6',
  'firstBloodKill', 'firstTowerKill', 'doubleKills', 'tripleKills', 'quadraKills', 'pentaKills',
  'win', 'notes', 'updatedAt'
];

var PLAYERS_HEADERS = [
  'puuid', 'nick', 'color', 'avatarSource', 'discordNick',
  'discordUserId', 'discordAvatarHash', 'discordAvatarUrl',
  'summonerName', 'summonerId', 'accountId', 'profileIconId', 'summonerLevel',
  'soloTier', 'soloRank', 'soloLP', 'soloWins', 'soloLosses', 'soloWinRatePct',
  'flexTier', 'flexRank', 'flexLP', 'flexWins', 'flexLosses', 'flexWinRatePct',
  'top1ChampionName', 'top1ChampionPoints', 'top2ChampionName', 'top2ChampionPoints',
  'top3ChampionName', 'top3ChampionPoints', 'totalMasteryScore',
  'customGamesPlayed', 'customGamesWon', 'customGamesLost',
  'notes', 'updatedAt'
];

/** Kolumny, których automatyczna synchronizacja NIGDY nie nadpisuje (ręcznie edytowane). */
var PROTECTED_ON_SYNC = ['notes', 'nick', 'color', 'avatarSource', 'discordNick'];

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet_(name, headers) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  var firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var needsHeaders = headers.some(function (h, i) { return firstRow[i] !== h; });
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function sheetToObjects_(sheet, headers) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values
    .filter(function (row) { return row.some(function (c) { return c !== '' && c !== null; }); })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    });
}

function findRowIndexByKey_(sheet, headers, keyFields, keyValues) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var keyIdx = keyFields.map(function (k) { return headers.indexOf(k); });
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (var r = 0; r < values.length; r++) {
    var match = keyIdx.every(function (idx, i) { return String(values[r][idx]) === String(keyValues[i]); });
    if (match) return r + 2; // 1-indexed + header row
  }
  return -1;
}

function upsertRow_(sheet, headers, keyFields, obj, protectedFields) {
  var keyValues = keyFields.map(function (k) { return obj[k]; });
  var rowIndex = findRowIndexByKey_(sheet, headers, keyFields, keyValues);
  var now = new Date().toISOString();
  if (rowIndex === -1) {
    var newRow = headers.map(function (h) {
      if (h === 'createdAt' || h === 'updatedAt') return now;
      return obj.hasOwnProperty(h) ? obj[h] : '';
    });
    sheet.appendRow(newRow);
  } else {
    var existing = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
    var updated = headers.map(function (h, i) {
      if (protectedFields && protectedFields.indexOf(h) !== -1) return existing[i];
      if (h === 'updatedAt') return now;
      if (h === 'createdAt') return existing[i] || now;
      return obj.hasOwnProperty(h) ? obj[h] : existing[i];
    });
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updated]);
  }
}

function updateField_(sheet, headers, keyFields, keyValues, field, value) {
  var rowIndex = findRowIndexByKey_(sheet, headers, keyFields, keyValues);
  if (rowIndex === -1) return false;
  var colIndex = headers.indexOf(field);
  if (colIndex === -1) return false;
  sheet.getRange(rowIndex, colIndex + 1).setValue(value);
  var updatedAtCol = headers.indexOf('updatedAt');
  if (updatedAtCol !== -1) {
    sheet.getRange(rowIndex, updatedAtCol + 1).setValue(new Date().toISOString());
  }
  return true;
}

function deleteRow_(sheet, headers, keyFields, keyValues) {
  var rowIndex = findRowIndexByKey_(sheet, headers, keyFields, keyValues);
  if (rowIndex === -1) return false;
  sheet.deleteRow(rowIndex);
  return true;
}

function deleteRowsByKey_(sheet, headers, keyField, keyValue) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var keyIdx = headers.indexOf(keyField);
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (var r = values.length - 1; r >= 0; r--) {
    if (String(values[r][keyIdx]) === String(keyValue)) {
      sheet.deleteRow(r + 2);
    }
  }
}

function checkToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
  if (!expected) return true; // brak ustawionego sekretu = brak ochrony (niezalecane)
  return token === expected;
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var matchesSheet = getOrCreateSheet_(SHEET_MATCHES, MATCHES_HEADERS);
    var matchPlayersSheet = getOrCreateSheet_(SHEET_MATCH_PLAYERS, MATCH_PLAYERS_HEADERS);
    var playersSheet = getOrCreateSheet_(SHEET_PLAYERS, PLAYERS_HEADERS);

    var data = {
      matches: sheetToObjects_(matchesSheet, MATCHES_HEADERS),
      matchPlayers: sheetToObjects_(matchPlayersSheet, MATCH_PLAYERS_HEADERS),
      players: sheetToObjects_(playersSheet, PLAYERS_HEADERS),
      generatedAt: new Date().toISOString()
    };
    return jsonOutput_({ ok: true, data: data });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) });
  }
}

/**
 * doPost oczekuje Content-Type: text/plain (celowo, aby uniknąć CORS preflight)
 * z ciałem JSON: { token, action, payload }
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var token = body.token;
    if (!checkToken_(token)) {
      return jsonOutput_({ ok: false, error: 'Nieprawidłowy token.' });
    }
    var action = body.action;
    var payload = body.payload || {};

    var matchesSheet = getOrCreateSheet_(SHEET_MATCHES, MATCHES_HEADERS);
    var matchPlayersSheet = getOrCreateSheet_(SHEET_MATCH_PLAYERS, MATCH_PLAYERS_HEADERS);
    var playersSheet = getOrCreateSheet_(SHEET_PLAYERS, PLAYERS_HEADERS);

    switch (action) {
      case 'syncMatch': {
        // payload: { match: {...}, players: [ {...matchPlayer}, ... ] }
        upsertRow_(matchesSheet, MATCHES_HEADERS, ['matchId'], payload.match, PROTECTED_ON_SYNC);
        (payload.players || []).forEach(function (p) {
          upsertRow_(matchPlayersSheet, MATCH_PLAYERS_HEADERS, ['matchId', 'puuid'], p, PROTECTED_ON_SYNC);
        });
        return jsonOutput_({ ok: true });
      }
      case 'syncPlayers': {
        // payload: { players: [ {...player}, ... ] }
        (payload.players || []).forEach(function (p) {
          upsertRow_(playersSheet, PLAYERS_HEADERS, ['puuid'], p, PROTECTED_ON_SYNC);
        });
        return jsonOutput_({ ok: true });
      }
      case 'updateMatchField': {
        // payload: { matchId, field, value }
        var ok1 = updateField_(matchesSheet, MATCHES_HEADERS, ['matchId'], [payload.matchId], payload.field, payload.value);
        return jsonOutput_({ ok: ok1 });
      }
      case 'updateMatchPlayerField': {
        // payload: { matchId, puuid, field, value }
        var ok2 = updateField_(matchPlayersSheet, MATCH_PLAYERS_HEADERS, ['matchId', 'puuid'], [payload.matchId, payload.puuid], payload.field, payload.value);
        return jsonOutput_({ ok: ok2 });
      }
      case 'updatePlayerField': {
        // payload: { puuid, field, value }
        var ok3 = updateField_(playersSheet, PLAYERS_HEADERS, ['puuid'], [payload.puuid], payload.field, payload.value);
        return jsonOutput_({ ok: ok3 });
      }
      case 'deleteMatch': {
        // payload: { matchId }
        var ok4 = deleteRow_(matchesSheet, MATCHES_HEADERS, ['matchId'], [payload.matchId]);
        deleteRowsByKey_(matchPlayersSheet, MATCH_PLAYERS_HEADERS, 'matchId', payload.matchId);
        return jsonOutput_({ ok: ok4 });
      }
      case 'deletePlayer': {
        // payload: { puuid }
        var ok5 = deleteRow_(playersSheet, PLAYERS_HEADERS, ['puuid'], [payload.puuid]);
        return jsonOutput_({ ok: ok5 });
      }
      default:
        return jsonOutput_({ ok: false, error: 'Nieznana akcja: ' + action });
    }
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) });
  }
}

/** Ręczne uruchomienie raz, aby przygotować arkusze z nagłówkami przed pierwszym wdrożeniem. */
function setupSheets() {
  getOrCreateSheet_(SHEET_MATCHES, MATCHES_HEADERS);
  getOrCreateSheet_(SHEET_MATCH_PLAYERS, MATCH_PLAYERS_HEADERS);
  getOrCreateSheet_(SHEET_PLAYERS, PLAYERS_HEADERS);
}
