const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

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

async function updatePanel() {
  const embed = new EmbedBuilder()
    .setTitle("📊 Panel de serveur")
    .setDescription(`Serveur : **${SERVER_NAME}**`)
    .addFields(
      {
        name: "🌐 Adresse",
        value: `${SERVER_IP}:${SERVER_PORT}`,
        inline: true
      }
    )
    .setColor(0x3498db) // couleur neutre (bleu)
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
