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

/**
 * UWAGA: kolumny per rola (championi/gracze per TOP/JNG/MID/BOT/SUP - dawniej
 * blueTopChampion/blueTopPlayer/... wypełniane stąd) zostały świadomie USUNIĘTE
 * z tej listy. Użytkownik przerobił je w Arkuszu (kolumny W:AP) na własne
 * formuły (INDEKS/PODAJ.POZYCJĘ do MatchPlayers) pod nowymi nazwami
 * (blueChTOP, blueTOP, ...) - każda operacja zapisu w tym pliku (upsertRow_,
 * getOrCreateSheet_) działa na zakresie o szerokości MATCHES_HEADERS.length,
 * więc dopóki te kolumny nie są w tej liście, żaden sync nigdy ich nie
 * dotknie ani nie nadpisze formuły. Wciąż są jednak czytane (tylko do
 * odczytu) przez doGet - patrz sheetToObjectsWithExtraColumns_ niżej - żeby
 * apka/strona mogły pokazać wyliczone wartości.
 */
var MATCHES_HEADERS = [
  'gid', 'matchId', 'dataSource', 'gameCreationDate', 'gameDurationSec',
  'mapId', 'patch', 'winningTeam',
  'blueBans', 'redBans',
  'blueBaronKills', 'blueDragonKills', 'blueHeraldKills', 'blueTowerKills', 'blueInhibKills',
  'redBaronKills', 'redDragonKills', 'redHeraldKills', 'redTowerKills', 'redInhibKills',
  'notes', 'rawDataJson'
];

/** Limit długości komórki w Google Sheets to ok. 50000 znaków - powyżej zapis się nie udaje. */
var RAW_DATA_JSON_MAX_LENGTH = 49000;

/**
 * Ujednolica wartość przed zapisem do konkretnej kolumny:
 * - gameCreationDate jako prawdziwy obiekt Date (natywne formatowanie/sortowanie
 *   w Sheets), zamiast surowego stringa ISO - JSON.stringify w doGet i tak
 *   zserializuje go z powrotem do ISO 8601, więc odczyt się nie zmienia;
 * - rawDataJson zbyt długi na komórkę Sheets (limit ok. 50000 znaków) zostaje
 *   zastąpiony małym markerem zamiast ucinać i zostawiać nieprawidłowy JSON -
 *   pełne dane są wciąż dostępne w lokalnym pliku meczu.
 */
function coerceCellValue_(field, value) {
  if (field === 'gameCreationDate' && value) {
    var d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  if (field === 'rawDataJson' && typeof value === 'string' && value.length > RAW_DATA_JSON_MAX_LENGTH) {
    return JSON.stringify({ tooLargeForSheets: true, length: value.length });
  }
  return value;
}

var MATCH_PLAYERS_HEADERS = [
  'gid', 'matchId', 'team', 'puuid', 'summonerName', 'championName', 'championId', 'teamPosition',
  'spell1', 'spell2', 'primaryRuneStyle', 'subRuneStyle', 'keystone', 'champLevel',
  'kills', 'deaths', 'assists', 'kda', 'cs', 'csPerMin',
  'goldEarned', 'damageDealtToChampions', 'damageTaken', 'damageSelfMitigated', 'totalHeal',
  'visionScore', 'wardsPlaced', 'wardsKilled', 'controlWardsPlaced',
  'item0', 'item1', 'item2', 'item3', 'item4', 'item5', 'item6',
  'firstBloodKill', 'firstTowerKill', 'doubleKills', 'tripleKills', 'quadraKills', 'pentaKills',
  'win', 'notes', 'updatedAt'
];

/**
 * songUrl/monsterConfig dodane NA KOŃCU (2026-08) - piosenka profilowa (link YouTube albo
 * bezpośredni plik audio) i konfiguracja stworka (JSON z Przeglądarki meczy) z localStorage
 * przenoszą się tutaj, żeby były widoczne wszędzie (w tym na GitHub Pages, gdzie localStorage
 * jest osobny dla każdego odwiedzającego) bez ręcznego eksportu/importu pliku. Dopisanie na
 * KOŃCU listy jest bezpieczne (patrz komentarz przy MATCHES_HEADERS wyżej o migracjach) - nie
 * przesuwa indeksu klucza (puuid, wciąż pierwszy), więc nie wymaga przepisywania istniejących
 * wierszy.
 */
var PLAYERS_HEADERS = [
  'puuid', 'nick', 'color', 'avatarSource', 'discordNick',
  'discordUserId', 'discordAvatarHash', 'discordAvatarUrl',
  'summonerName', 'summonerId', 'accountId', 'profileIconId', 'summonerLevel',
  'soloTier', 'soloRank', 'soloLP', 'soloWins', 'soloLosses',
  'songUrl', 'monsterConfig'
];

/**
 * Kolumny, których automatyczna synchronizacja NIGDY nie nadpisuje (ręcznie
 * edytowane) - dotyczy tylko AKTUALIZACJI istniejącego wiersza (upsertRow_
 * wciąż zapisuje te pola normalnie przy pierwszym wstawieniu nowego wiersza).
 * teamPosition: wykrywanie roli z importu bywa błędne (patrz duplikaty
 * TOP/brak SUPP) - jeśli ktoś poprawi rolę ręcznie w MatchPlayers, kolejny
 * re-sync tego samego meczu (np. ponowny import/resync) nie ma jej znów
 * nadpisywać wykrytą (błędną) wartością z apki.
 */
var PROTECTED_ON_SYNC = ['notes', 'nick', 'color', 'avatarSource', 'discordNick', 'teamPosition'];

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

/**
 * Jak sheetToObjects_, ale DODATKOWO odczytuje (tylko do odczytu) wszystkie
 * kolumny za MATCHES_HEADERS, jeśli w Arkuszu fizycznie istnieją - używając
 * nazw z AKTUALNEGO wiersza nagłówków jako kluczy. Dzięki temu użytkownik
 * może dopisać własne kolumny/formuły (patrz komentarz przy MATCHES_HEADERS)
 * bez zmiany tego pliku - pojawią się automatycznie pod swoją nazwą w danych
 * zwracanych przez doGet, ale żadna operacja zapisu nigdy ich nie dotknie
 * (te operacje zawsze ograniczają się do headers.length kolumn).
 */
function sheetToObjectsWithExtraColumns_(sheet, headers) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = sheet.getLastColumn();
  var extraHeaders = lastCol > headers.length
    ? sheet.getRange(1, headers.length + 1, 1, lastCol - headers.length).getValues()[0]
    : [];
  var totalCols = headers.length + extraHeaders.length;
  var values = sheet.getRange(2, 1, lastRow - 1, totalCols).getValues();
  return values
    .filter(function (row) { return row.some(function (c) { return c !== '' && c !== null; }); })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      // Kolumna dodatkowa o nazwie duplikującej jedną z MATCHES_HEADERS (np. stary/zepsuty
      // artefakt z wcześniejszego układu arkusza) NIE MOŻE nadpisać już poprawnie odczytanej
      // wartości z jej właściwej, stałej pozycji - inaczej zduplikowana nazwa w wierszu 1 cicho
      // psuje dane (dokładnie to działo się z kolumnami W:Z, nazwanymi tak samo jak S:V).
      extraHeaders.forEach(function (h, i) { if (h && headers.indexOf(h) === -1) obj[h] = row[headers.length + i]; });
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
      return obj.hasOwnProperty(h) ? coerceCellValue_(h, obj[h]) : '';
    });
    sheet.appendRow(newRow);
  } else {
    var existing = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
    var updated = headers.map(function (h, i) {
      if (protectedFields && protectedFields.indexOf(h) !== -1) return existing[i];
      if (h === 'updatedAt') return now;
      if (h === 'createdAt') return existing[i] || now;
      return obj.hasOwnProperty(h) ? coerceCellValue_(h, obj[h]) : existing[i];
    });
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updated]);
  }
}

function updateField_(sheet, headers, keyFields, keyValues, field, value) {
  var rowIndex = findRowIndexByKey_(sheet, headers, keyFields, keyValues);
  if (rowIndex === -1) return false;
  var colIndex = headers.indexOf(field);
  if (colIndex === -1) return false;
  sheet.getRange(rowIndex, colIndex + 1).setValue(coerceCellValue_(field, value));
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

/** Ustawia tę samą wartość pola we WSZYSTKICH wierszach MatchPlayers danego meczu (np. gid po globalnym przeliczeniu). */
function cascadeFieldToMatchPlayers_(sheet, matchId, field, value) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var matchIdCol = MATCH_PLAYERS_HEADERS.indexOf('matchId');
  var fieldCol = MATCH_PLAYERS_HEADERS.indexOf(field);
  if (matchIdCol === -1 || fieldCol === -1) return;
  var values = sheet.getRange(2, 1, lastRow - 1, MATCH_PLAYERS_HEADERS.length).getValues();
  for (var r = 0; r < values.length; r++) {
    if (String(values[r][matchIdCol]) === String(matchId)) {
      sheet.getRange(r + 2, fieldCol + 1).setValue(value);
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
      matches: sheetToObjectsWithExtraColumns_(matchesSheet, MATCHES_HEADERS),
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
        var byPuuidForNick_ = {};
        sheetToObjects_(playersSheet, PLAYERS_HEADERS).forEach(function (p) {
          if (p.puuid) byPuuidForNick_[p.puuid] = p;
        });
        (payload.players || []).forEach(function (p) {
          p.gid = payload.match ? payload.match.gid : p.gid;
          var known = p.puuid && byPuuidForNick_[p.puuid];
          p.summonerName = (known && known.nick) || p.summonerName;
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
        // gid bywa przeliczany globalnie po dodaniu starszego meczu (patrz
        // recomputeAllGids w apce desktopowej) - żeby MatchPlayers.gid nie
        // zostało w tyle, przy każdej takiej zmianie kaskadujemy ją też na
        // wszystkie wiersze graczy tego meczu.
        if (payload.field === 'gid') {
          cascadeFieldToMatchPlayers_(matchPlayersSheet, payload.matchId, 'gid', payload.value);
        }
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

/**
 * DIAGNOSTYKA (tylko do odczytu, nic nie zapisuje) - uruchom ręcznie z edytora Apps Script
 * (wybierz tę funkcję z rozwijanej listy obok "Uruchom", potem Wyświetl -> Dziennik wykonania /
 * Ctrl+Enter) i wklej wynik. Zestawia MATCHES_HEADERS (to, czego oczekuje ten kod na stałych
 * pozycjach A, B, C...) z tym, co FIZYCZNIE jest w wierszu 1 arkusza Matches oraz przykładowym
 * wierszem danych - po to, żeby namierzyć dokładnie od której kolumny się rozjeżdżają, zamiast
 * zgadywać i ryzykować zepsucie danych zmianą MATCHES_HEADERS na ślepo.
 */
function diagnoseMatchesHeaders() {
  var sheet = getSpreadsheet_().getSheetByName(SHEET_MATCHES);
  if (!sheet) { Logger.log('Brak arkusza "Matches".'); return; }
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  var colLetter = function (i) { // i = 0-indexed
    var s = '';
    i += 1;
    while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  };
  var actualHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var sampleRow = lastRow >= 2 ? sheet.getRange(2, 1, 1, lastCol).getValues()[0] : [];
  var sampleRowLast = lastRow >= 2 ? sheet.getRange(lastRow, 1, 1, lastCol).getValues()[0] : [];

  Logger.log('lastRow=%s lastCol=%s (MATCHES_HEADERS.length=%s)', lastRow, lastCol, MATCHES_HEADERS.length);
  Logger.log('--- Kolumna | oczekiwane (MATCHES_HEADERS) | faktyczny nagłówek (wiersz 1) | przykład wiersz 2 | przykład ostatni wiersz ---');
  for (var i = 0; i < lastCol; i++) {
    var expected = i < MATCHES_HEADERS.length ? MATCHES_HEADERS[i] : '(poza MATCHES_HEADERS - kolumna dodatkowa)';
    var mismatch = i < MATCHES_HEADERS.length && String(actualHeaders[i]) !== MATCHES_HEADERS[i] ? '  <== NIEZGODNE' : '';
    Logger.log(
      colLetter(i) + ' | ' + expected + ' | ' + actualHeaders[i] + ' | ' +
      JSON.stringify(sampleRow[i]) + ' | ' + JSON.stringify(sampleRowLast[i]) + mismatch
    );
  }
}
