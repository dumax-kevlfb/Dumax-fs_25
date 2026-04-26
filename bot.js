const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const SERVER_IP = "51.68.65.34";
const SERVER_PORT = 10000;
const SERVER_NAME = "Dumax FS25";
const DATA_FILE = "./stats.json";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let stats = {
  joueurs: "0 / 6",
  meteo: "Inconnue",
  heure: "Inconnue",
  saison: "Inconnue",
  fermes: "0",
  mods: "0"
};

let statusMessage = null;

function loadStats() {
  if (fs.existsSync(DATA_FILE)) {
    stats = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  }
}

function saveStats() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(stats, null, 2));
}

async function updatePanel() {
  const embed = new EmbedBuilder()
    .setTitle("📊 Panel de serveur")
    .setDescription(`Serveur : **${SERVER_NAME}**`)
    .addFields(
      { name: "🌐 Adresse", value: `${SERVER_IP}:${SERVER_PORT}`, inline: true },
      { name: "👥 Joueurs connectés", value: stats.joueurs, inline: true },
      { name: "🕒 Heure serveur", value: stats.heure, inline: true },
      { name: "🌤️ Météo", value: stats.meteo, inline: true },
      { name: "🍂 Saison", value: stats.saison, inline: true },
      { name: "🏡 Fermes", value: stats.fermes, inline: true },
      { name: "🧩 Mods", value: stats.mods, inline: true }
    )
    .setColor(0x2ecc71)
    .setFooter({ text: "Panel communautaire • Dumax" })
    .setTimestamp();

  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!statusMessage) {
    const messages = await channel.messages.fetch({ limit: 10 });
    statusMessage = messages.find(m => m.author.id === client.user.id);

    if (!statusMessage) {
      statusMessage = await channel.send({ embeds: [embed] });
      console.log("📩 Panel créé");
      return;
    }
  }

  await statusMessage.edit({ embeds: [embed] });
  console.log("🔄 Panel mis à jour");
}

client.once("ready", async () => {
  console.log(`✅ Connecté : ${client.user.tag}`);
  loadStats();
  await updatePanel();
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const args = message.content.trim().split(" ");
  const cmd = args[0].toLowerCase();
  let updated = false;

  if (cmd === "!joueurs") {
    const nombre = args[1];
    if (!nombre) return message.reply("Utilisation : `!joueurs 3`");
    stats.joueurs = `${nombre} / 6`;
    updated = true;
  }

  if (cmd === "!meteo") {
    const meteo = args.slice(1).join(" ");
    if (!meteo) return message.reply("Utilisation : `!meteo Soleil`");
    stats.meteo = meteo;
    updated = true;
  }

  if (cmd === "!heure") {
    const heure = args.slice(1).join(" ");
    if (!heure) return message.reply("Utilisation : `!heure 14h30`");
    stats.heure = heure;
    updated = true;
  }

  if (cmd === "!saison") {
    const saison = args.slice(1).join(" ");
    if (!saison) return message.reply("Utilisation : `!saison Printemps`");
    stats.saison = saison;
    updated = true;
  }

  if (cmd === "!fermes") {
    const fermes = args[1];
    if (!fermes) return message.reply("Utilisation : `!fermes 5`");
    stats.fermes = fermes;
    updated = true;
  }

  if (cmd === "!mods") {
    const mods = args[1];
    if (!mods) return message.reply("Utilisation : `!mods 42`");
    stats.mods = mods;
    updated = true;
  }

  if (cmd === "!panel") {
    await updatePanel();
    return message.reply("✅ Panel mis à jour.");
  }

  if (cmd === "!commandes") {
    return message.reply(
      "**Commandes disponibles :**\n" +
      "`!joueurs 3`\n" +
      "`!meteo Soleil`\n" +
      "`!heure 14h30`\n" +
      "`!saison Printemps`\n" +
      "`!fermes 5`\n" +
      "`!mods 42`\n" +
      "`!panel`"
    );
  }

  if (updated) {
    saveStats();
    await updatePanel();
    await message.reply("✅ Information mise à jour.");
  }
});

client.login(TOKEN);
