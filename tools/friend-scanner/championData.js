let cache = null;

/** Pobiera mapę championId -> nazwa championa z zasobów statycznych LCU (raz, z pamięci podręcznej). */
async function getChampionMap(client) {
  if (cache) return cache;
  try {
    const list = await client.get('/lol-game-data/assets/v1/champion-summary.json');
    cache = {};
    (list || []).forEach((c) => {
      if (c && typeof c.id === 'number') cache[c.id] = c.name;
    });
  } catch (err) {
    cache = {};
  }
  return cache;
}

module.exports = { getChampionMap };
