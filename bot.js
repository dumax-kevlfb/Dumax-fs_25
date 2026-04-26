const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder,
  SlashCommandBuilder,
  Routes 
} = require("discord.js");
const { REST } = require("@discordjs/rest");
const fs = require("fs");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

const ROLE_NAME = "━━━━━━━━━━ ⚡️ STAFF ━━━━━━━━━━";

const SERVER_IP = "51.68.65.34";
const SERVER_PORT = 10000;
const SERVER_NAME = "Dumax FS25";

const DATA_FILE = "./stats.json";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let stats = {
  fermesTotales: "0",
  fermesReprises: "0",
  mods: "0"
};

let statusMessage = null;

// 📁 LOAD / SAVE
function loadStats() {
  if (fs.existsSync(DATA_FILE)) {
    stats = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  }
}

function saveStats() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(stats, null, 2));
}

// 🔒 CHECK ROLE
function hasAccess(member) {
  return member.roles.cache.some(r => r.name === ROLE_NAME);
}

// 📊 PANEL
async function updatePanel() {
  const embed = new EmbedBuilder()
    .setTitle("📊 Panel de serveur")
    .setDescription(`Serveur : **${SERVER_NAME}**`)
    .addFields(
      { name: "🌐 Adresse", value: `${SERVER_IP}:${SERVER_PORT}`, inline: true },
      { name: "🏡 Fermes totales", value: stats.fermesTotales, inline: true },
      { name: "✅ Fermes reprises", value: stats.fermesReprises, inline: true },
      { name: "🧩 Mods installés", value: stats.mods, inline: true }
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
      return;
    }
  }

  await statusMessage.edit({ embeds: [embed] });
}

// 🚀 COMMANDES SLASH
const commands = [
  new SlashCommandBuilder()
    .setName("fermestotales")
    .setDescription("Définir le nombre de fermes totales")
    .addStringOption(option =>
      option.setName("nombre")
        .setDescription("Nombre")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("fermesreprises")
    .setDescription("Définir le nombre de fermes reprises")
    .addStringOption(option =>
      option.setName("nombre")
        .setDescription("Nombre")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("mods")
    .setDescription("Définir le nombre de mods")
    .addStringOption(option =>
      option.setName("nombre")
        .setDescription("Nombre")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Mettre à jour le panel")
].map(command => command.toJSON());

// 📡 REGISTER COMMANDS
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Slash commands enregistrées");
  } catch (error) {
    console.error(error);
  }
})();

// 🔌 READY
client.once("ready", async () => {
  console.log(`✅ Connecté : ${client.user.tag}`);
  loadStats();
  await updatePanel();
});

// 🎮 INTERACTIONS
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (!hasAccess(interaction.member)) {
    return interaction.reply({
      content: "⛔ Tu n’as pas la permission d’utiliser cette commande.",
      ephemeral: true
    });
  }

  const { commandName } = interaction;

  if (commandName === "fermestotales") {
    stats.fermesTotales = interaction.options.getString("nombre");
  }

  if (commandName === "fermesreprises") {
    stats.fermesReprises = interaction.options.getString("nombre");
  }

  if (commandName === "mods") {
    stats.mods = interaction.options.getString("nombre");
  }

  if (commandName === "panel") {
    await updatePanel();
    return interaction.reply({ content: "✅ Panel mis à jour", ephemeral: true });
  }

  saveStats();
  await updatePanel();

  await interaction.reply({
    content: "✅ Mise à jour effectuée",
    ephemeral: true
  });
});

client.login(TOKEN);
