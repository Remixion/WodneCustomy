/**
 * Skaner Game ID do wysłania znajomemu: skanuje podany zakres ID i eksportuje
 * PEŁNE dane (te same, co import w głównej apce WodneCustomy) każdego
 * znalezionego meczu customowego, w którym brało udział zalogowane na tym
 * komputerze konto League of Legends - do osobnych plików .json w folderze
 * output/. Te pliki wystarczy wrzucić do folderu z meczami głównej apki
 * (Ustawienia -> "Folder z danymi") - pojawią się na liście automatycznie,
 * bez żadnego dodatkowego importu.
 *
 * Uruchomienie: node scan.js [startId] [endId] [zapytań/s]
 * Bez argumentów - zapyta o nie interaktywnie.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { findLeagueClient } = require('./lockfile');
const { LcuClient } = require('./client');
const { getCurrentSummonerPuuid } = require('./currentSummoner');
const { scanGameIdRange } = require('./gameIdScanner');
const { buildMatchFromGameId } = require('./matchBuilder');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

async function main() {
  console.log('=== Skaner meczów WodneCustomy ===');
  console.log('Wymaga uruchomionego i zalogowanego klienta League of Legends.\n');

  const [, , argStart, argEnd, argRate] = process.argv;
  const startId = Number(argStart || (await ask('Od jakiego Game ID zaczac skan? ')));
  const endId = Number(argEnd || (await ask('Do jakiego Game ID skanowac? ')));
  const requestsPerSecond = Number(argRate) || 2;

  if (!Number.isFinite(startId) || !Number.isFinite(endId) || startId > endId || startId < 1) {
    console.error('Nieprawidlowy zakres ID.');
    process.exitCode = 1;
    return;
  }

  const info = findLeagueClient();
  if (!info) {
    console.error('Nie znaleziono uruchomionego klienta League of Legends. Uruchom go i zaloguj sie, potem sprobuj ponownie.');
    process.exitCode = 1;
    return;
  }
  const client = new LcuClient(info);

  const puuid = await getCurrentSummonerPuuid(client);
  if (!puuid) {
    console.error('Nie udalo sie odczytac danych zalogowanego konta.');
    process.exitCode = 1;
    return;
  }

  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\nSkanowanie ID od ${startId} do ${endId} (${requestsPerSecond} zapytan/s).`);
  console.log('To moze potrwac dlugo - kazdy znaleziony mecz jest od razu zapisywany do pliku,');
  console.log('wiec przerwanie (Ctrl+C) w polowie nie traci juz znalezionych meczow.\n');

  let exported = 0;
  let skipped = 0;

  const result = await scanGameIdRange(client, puuid, {
    startId,
    endId,
    requestsPerSecond,
    onProgress: async (p) => {
      const total = endId - startId + 1;
      const done = p.lastId - startId + 1;
      const pct = total > 0 ? ((done / total) * 100).toFixed(2) : '0';
      process.stdout.write(
        `\rSprawdzono ${p.checked} (do ID ${p.lastId}, ${pct}%), bledow: ${p.errors}, wyeksportowano: ${exported}   `
      );
      for (const g of p.newlyFound || []) {
        try {
          const { match, players } = await buildMatchFromGameId(client, g.gameId, {
            includeEogStatsBlock: false,
            dataSource: 'lcu-history',
          });
          fs.writeFileSync(path.join(outDir, `${match.matchId}.json`), JSON.stringify({ match, players }, null, 2), 'utf8');
          exported++;
          console.log(`\n[OK] Wyeksportowano mecz ${g.gameId} (${g.gameCreationDate || '?'})`);
        } catch (err) {
          skipped++;
          console.log(`\n[POMINIETO] Mecz ${g.gameId}: ${err.message}`);
        }
      }
    },
  });

  console.log(`\n\nZakonczono. Sprawdzono ${result.checked} ID, bledow zapytan: ${result.errors}.`);
  console.log(`Wyeksportowano ${exported} mecz(ow) do folderu:\n  ${outDir}`);
  if (skipped) console.log(`Pominieto ${skipped} znalezionych (niecustomowe/blad importu) - patrz logi wyzej.`);
  console.log('\nWyslij zawartosc folderu "output" (najlepiej spakowana w .zip) do znajomego.');
}

main().catch((err) => {
  console.error('\nBlad:', err.message);
  process.exitCode = 1;
});
