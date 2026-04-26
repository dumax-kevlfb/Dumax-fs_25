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
  fermesTotales: "0",
  fermesReprises: "0",
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
      {
        name: "🌐 Adresse",
        value: `${SERVER_IP}:${SERVER_PORT}`,
        inline: true
      },
      {
        name: "🏡 Fermes totales",
        value: stats.fermesTotales,
        inline: true
      },
      {
        name: "✅ Fermes reprises",
        value: stats.fermesReprises,
        inline: true
      },
      {
        name: "🧩 Mods installés",
        value: stats.mods,
        inline: true
      }
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

  if (cmd === "!fermestotales") {
    const value = args[1];
    if (!value) return message.reply("Utilisation : `!fermestotales 12`");
    stats.fermesTotales = value;
    updated = true;
  }

  if (cmd === "!fermesreprises") {
    const value = args[1];
    if (!value) return message.reply("Utilisation : `!fermesreprises 5`");
    stats.fermesReprises = value;
    updated = true;
  }

  if (cmd === "!mods") {
    const value = args[1];
    if (!value) return message.reply("Utilisation : `!mods 42`");
    stats.mods = value;
    updated = true;
  }

  if (cmd === "!panel") {
    await updatePanel();
    await message.delete().catch(() => {});
    return;
  }

  if (cmd === "!commandes") {
    const reply = await message.reply(
      "**Commandes disponibles :**\n" +
      "`!fermestotales 12`\n" +
      "`!fermesreprises 5`\n" +
      "`!mods 42`\n" +
      "`!panel`"
    );

    setTimeout(() => reply.delete().catch(() => {}), 8000);
    await message.delete().catch(() => {});
    return;
  }

  if (updated) {
    saveStats();
    await updatePanel();

    const confirm = await message.channel.send("✅ Panel mis à jour");
    setTimeout(() => confirm.delete().catch(() => {}), 3000);

    await message.delete().catch(() => {});
  }
});

client.login(TOKEN);
