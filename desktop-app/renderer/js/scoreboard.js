async function load() {
  const statusEl = document.getElementById('status-message');
  const matchId = qs('matchId');
  const data = await window.api.store.getMatch(matchId);
  if (!data) {
    statusEl.textContent = 'Nie znaleziono meczu.';
    return;
  }
  const { match, players } = data;
  statusEl.textContent = `Mecz ${match.matchId}`;

  document.getElementById('header-date').textContent = formatDate(match.gameCreationDate);
  document.getElementById('header-duration').textContent = formatDuration(match.gameDurationSec);
  document.getElementById('header-map').textContent = match.mapId || '-';
  document.getElementById('header-patch').textContent = match.patch || '-';
  document.getElementById('header-gameid').textContent = match.matchId;
  document.getElementById('advanced-details-link').href = `match.html?matchId=${encodeURIComponent(match.matchId)}`;

  const allPlayers = await window.api.store.refreshPlayersFromSheets();
  const playersByPuuid = buildPlayersByPuuid(allPlayers);

  const teams = sortTeamValues([...new Set(players.map((p) => p.team).filter(Boolean))]);
  await renderBansBarsInto(document.getElementById('bans-section'), match, teams);
  await renderScoreboardBody(document.getElementById('teams-section'), match, players, playersByPuuid);
}

load();
