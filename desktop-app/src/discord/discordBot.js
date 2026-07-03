const https = require('https');

const API_HOST = 'discord.com';
const API_VERSION = 'v10';

function discordApiRequest(botToken, method, urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      path: `/api/${API_VERSION}${urlPath}`,
      method,
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch (err) {
          reject(new Error(`Nieprawidłowa odpowiedź Discord API: ${raw.slice(0, 200)}`));
          return;
        }
        if (res.statusCode >= 400) {
          const message = (parsed && parsed.message) || `HTTP ${res.statusCode}`;
          reject(new Error(`Discord API: ${message}`));
          return;
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Pobiera pełną listę członków serwera (z paginacją po 1000).
 * Wymaga: bot dodany do serwera oraz włączony "Server Members Intent"
 * w ustawieniach aplikacji na discord.com/developers/applications.
 */
async function fetchAllGuildMembers(botToken, guildId) {
  const members = [];
  let after = '0';
  for (;;) {
    const page = await discordApiRequest(botToken, 'GET', `/guilds/${guildId}/members?limit=1000&after=${after}`);
    if (!Array.isArray(page) || page.length === 0) break;
    members.push(...page);
    if (page.length < 1000) break;
    after = page[page.length - 1].user.id;
  }
  return members;
}

/** Avatar ustawiony specyficznie dla danego serwera (jeśli member go ma) - inny niż globalny avatar użytkownika. */
function buildGuildMemberAvatarUrl(guildId, member) {
  if (member.avatar) {
    return `https://cdn.discordapp.com/guilds/${guildId}/users/${member.user.id}/avatars/${member.avatar}.png?size=128`;
  }
  return null;
}

/**
 * Buduje mapę: znormalizowana nazwa (username / global_name / nick na serwerze, małymi literami)
 * -> dane avatara, do dopasowania po polu "discordNick" wpisanym ręcznie dla gracza.
 */
function buildDiscordMemberLookup(guildId, members, buildUserAvatarUrl) {
  const lookup = {};
  members.forEach((member) => {
    const user = member.user || {};
    const avatarUrl = buildGuildMemberAvatarUrl(guildId, member) || buildUserAvatarUrl(user);
    const entry = {
      discordUserId: user.id,
      discordAvatarHash: member.avatar || user.avatar || '',
      discordAvatarUrl: avatarUrl,
    };
    [user.username, user.global_name, member.nick].forEach((key) => {
      if (key) lookup[String(key).trim().toLowerCase()] = entry;
    });
  });
  return lookup;
}

module.exports = { fetchAllGuildMembers, buildDiscordMemberLookup };
