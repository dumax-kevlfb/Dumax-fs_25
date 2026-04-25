const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const xml2js = require("xml2js");

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = "1497600831405555926";
const STATS_XML_URL = "http://si-12625.dg.vg:8080/feed/dedicated-server-stats.xml?code=6bqwp6ka35e99sng7izc3gly1r2h";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let statusMessage = null;

async function getServerData() {
  try {
    const response = await fetch(STATS_XML_URL);
    if (!response.ok) throw new Error("XML inaccessible");

    const xml = await response.text();

    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xml);

    const server = result.Server;
    const info = server.$ || {};
    const slots = server.Slots?.[0]?.$ || {};
    const mods = server.Mods?.[0]?.Mod || [];

    let hour = "--";
    if (info.dayTime) {
      const time = parseInt(info.dayTime);
      hour = Math.floor((time / 3600000) % 24);
      hour = hour.toString().padStart(2, "0") + "h";
    }

    return {
      online: true,
      name: info.name || "Dumax FS25",
      players: slots.numUsed || "0",
      maxPlayers: slots.capacity || "6",
      map: info.mapName || "Inconnue",
      hour: hour,
      mods: mods.length
    };
  } catch (err) {
    console.log("❌ Erreur XML :", err.message);

    return {
      online: false,
      name: "Dumax FS25",
      players: "0",
      maxPlayers: "6",
      map: "Inconnue",
      hour: "--",
      mods: 0
    };
  }
}

async function updatePanel() {
  try {
    const data = await getServerData();

    const embed = new EmbedBuilder()
      .setTitle("📊 Panel serveur FS25")
      .setDescription(`Serveur : **${data.name}**`)
      .addFields(
        {
          name: "🚜 Statut",
          value: data.online ? "🟢 En ligne" : "🔴 Hors ligne",
          inline: true
        },
        {
          name: "👥 Joueurs",
          value: `${data.players} / ${data.maxPlayers}`,
          inline: true
        },
        {
          name: "🗺️ Carte",
          value: data.map,
          inline: true
        },
        {
          name: "⏰ Heure IG",
          value: data.hour,
          inline: true
        },
        {
          name: "📦 Mods",
          value: `${data.mods}`,
          inline: true
        }
      )
      .setColor(data.online ? 0x00ff00 : 0xff0000)
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

  } catch (err) {
    console.log("❌ Erreur update :", err.message);
  }
}

client.once("ready", async () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);

  await updatePanel();

  setInterval(async () => {
    console.log("⏱️ Actualisation lancée");
    await updatePanel();
  }, 30000);
});

// 💬 Commande !say avec suppression
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith("!say ")) {
    const msg = message.content.slice(5);

    await message.delete().catch(() => {});
    await message.channel.send(msg);
  }
});

client.login(TOKEN);