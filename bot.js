const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const XML_URL = process.env.XML_URL;

const SERVER_IP = "51.68.65.34";
const SERVER_PORT = 10000;
const SERVER_NAME = "Dumax FS25";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let statusMessage = null;

function getValue(xml, names) {
  for (const name of names) {
    const attr = xml.match(new RegExp(`${name}="([^"]+)"`, "i"));
    if (attr) return attr[1];

    const tag = xml.match(new RegExp(`<${name}>(.*?)</${name}>`, "i"));
    if (tag) return tag[1];
  }
  return null;
}

function getFarmCount(xml) {
  const direct = getValue(xml, ["numFarms", "farmCount", "farmsCount"]);
  if (direct) return direct;

  const matches = xml.match(/<farm\b/gi);
  return matches ? matches.length.toString() : "Indisponible";
}

function getModsCount(xml) {
  const direct = getValue(xml, ["mods", "modCount", "modsCount"]);
  if (direct) return direct;

  const matches = xml.match(/<mod\b/gi);
  return matches ? matches.length.toString() : "Indisponible";
}

async function getServerStats() {
  try {
    if (!XML_URL) {
      console.error("XML_URL manquant dans les variables Railway");
      throw new Error("XML_URL manquant");
    }

    const response = await fetch(XML_URL);
    const xml = await response.text();

    const currentPlayers =
      getValue(xml, ["numPlayers", "players", "currentPlayers", "playerCount"]) || "?";

    const maxPlayers =
      getValue(xml, ["capacity", "maxPlayers", "slots", "maxPlayerCount"]) || "?";

    const weather =
      getValue(xml, ["weather", "currentWeather", "weatherState"]) || "Indisponible";

    const serverTime =
      getValue(xml, ["time", "dayTime", "currentTime", "gameTime"]) || "Indisponible";

    const season =
      getValue(xml, ["season", "currentSeason", "seasonName"]) || "Indisponible";

    const farms = getFarmCount(xml);
    const mods = getModsCount(xml);

    return {
      players: `${currentPlayers} / ${maxPlayers}`,
      weather,
      serverTime,
      season,
      farms,
      mods
    };

  } catch (error) {
    console.error("Erreur lecture XML :", error);

    return {
      players: "Indisponible",
      weather: "Indisponible",
      serverTime: "Indisponible",
      season: "Indisponible",
      farms: "Indisponible",
      mods: "Indisponible"
    };
  }
}

async function updatePanel() {
  const stats = await getServerStats();

  const embed = new EmbedBuilder()
    .setTitle("📊 Panel de serveur")
    .setDescription(`Serveur : **${SERVER_NAME}**`)
    .addFields(
      {
        name: "🌐 Adresse",
        value: `${SERVER_IP}:${SERVER_PORT}`,
        inline: true
      },
      {
        name: "👥 Joueurs connectés",
        value: stats.players,
        inline: true
      },
      {
        name: "🕒 Heure serveur",
        value: stats.serverTime,
        inline: true
      },
      {
        name: "🌤️ Météo",
        value: stats.weather,
        inline: true
      },
      {
        name: "🍂 Saison",
        value: stats.season,
        inline: true
      },
      {
        name: "🏡 Fermes créées",
        value: stats.farms,
        inline: true
      },
      {
        name: "🧩 Mods installés",
        value: stats.mods,
        inline: true
      }
    )
    .setColor(0x3498db)
    .setFooter({
      text: "Actualisation toutes les 30 secondes • Créé et géré par Dumax"
    })
    .setTimestamp();

  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!statusMessage) {
    const messages = await channel.messages.fetch({ limit: 10 });
    statusMessage = messages.find(m => m.author.id === client.user.id);

    if (!statusMessage) {
      statusMessage = await channel.send({ embeds: [embed] });
      console.log("📩 Message panel créé");
      return;
    }
  }

  await statusMessage.edit({ embeds: [embed] });
  console.log("🔄 Panel mis à jour");
}

client.once("ready", async () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);

  await updatePanel();

  setInterval(async () => {
    try {
      console.log("⏱️ Actualisation lancée");
      await updatePanel();
    } catch (error) {
      console.error("Erreur updatePanel :", error);
    }
  }, 30000);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith("!say ")) {
    const msg = message.content.slice(5);

    await message.delete().catch(() => {});
    await message.channel.send(msg);
  }
});

client.login(TOKEN);
