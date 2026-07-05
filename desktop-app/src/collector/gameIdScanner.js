/**
 * Skanuje po kolei zakres [startId, endId] zapytaniami o
 * /lol-match-history/v1/games/{id}, żeby znaleźć mecze, w których brało
 * udział aktualnie zalogowane konto (po puuid w participantIdentities) - bez
 * względu na to, czy dany mecz mieści się jeszcze w lokalnej historii
 * klienta (ta ma twardy limit, patrz matchHistoryList.js).
 *
 * WAŻNE OGRANICZENIE: ten endpoint odmawia dostępu do meczów, w których
 * zalogowane konto NIE brało udziału (potwierdzone empirycznie) - skan
 * znajdzie więc wyłącznie WŁASNE mecze tego konta z danego zakresu ID, nigdy
 * mecze hostowane/nagrane przez kogoś innego, w których to konto nie grało.
 * Do tamtych nadal służy import .rofl / starych plików JSON.
 *
 * gameId jest globalnym, sekwencyjnym licznikiem dla całego shardu (nie jest
 * przypisany do konta ani daty w przewidywalny sposób) - stąd zakres ID
 * odpowiadający kilku dniom gry może obejmować miliony cudzych meczów, które
 * trzeba przelecieć po kolei. Dlatego skan:
 * - działa z ograniczoną prędkością (`requestsPerSecond`), żeby nie zasypać
 *   serwerów Riota nietypowym ruchem i nie ryzykować akcji antyabuse'owej,
 * - da się bezpiecznie zatrzymać w dowolnym momencie (`shouldStop`) i wznowić
 *   później od ostatniego sprawdzonego ID (`startFromId`),
 * - zgłasza postęp i nowo znalezione mecze na bieżąco (`onProgress`), a nie
 *   dopiero po zakończeniu całego zakresu.
 */
async function scanGameIdRange(client, puuid, { startId, endId, requestsPerSecond = 2, startFromId, onProgress, shouldStop }) {
  const delayMs = Math.max(50, Math.round(1000 / requestsPerSecond));
  const effectiveStart = startFromId != null ? startFromId : startId;
  const allFound = [];
  let newSinceReport = [];
  let checked = 0;
  let errors = 0;
  let lastId = effectiveStart - 1;
  let stopped = false;

  for (let id = effectiveStart; id <= endId; id++) {
    if (shouldStop && shouldStop()) {
      stopped = true;
      break;
    }

    try {
      const data = await client.get(`/lol-match-history/v1/games/${id}`);
      const participantPuuids = (data.participantIdentities || []).map((pi) => pi.player && pi.player.puuid);
      if (participantPuuids.includes(puuid)) {
        const summary = {
          gameId: String(id),
          gameCreationDate: data.gameCreation ? new Date(data.gameCreation).toISOString() : '',
          gameDurationSec: data.gameDuration || 0,
          gameMode: data.gameMode || '',
          gameType: data.gameType || '',
          queueId: data.queueId,
          mapId: data.mapId,
          isCustom: data.gameType === 'CUSTOM_GAME' || data.queueId === 0,
        };
        allFound.push(summary);
        newSinceReport.push(summary);
      }
    } catch (err) {
      errors++;
    }

    checked++;
    lastId = id;

    if (onProgress && (checked % 5 === 0 || newSinceReport.length)) {
      onProgress({ checked, errors, lastId, newlyFound: newSinceReport });
      newSinceReport = [];
    }

    if (id < endId) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  if (newSinceReport.length && onProgress) {
    onProgress({ checked, errors, lastId, newlyFound: newSinceReport });
  }

  return { found: allFound, checked, errors, lastId, stopped, completed: !stopped && lastId >= endId };
}

module.exports = { scanGameIdRange };
