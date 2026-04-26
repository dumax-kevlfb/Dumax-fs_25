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

const SERVER_NAME = "Dumax FS25";

const DATA_FILE = "./stats.json";
const ENTREPRISES_FILE = "./entreprises.json";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let stats = {
  fermesTotales: "0",
  fermesReprises: "0",
  mods: "0"
};

let entreprises = [];

let panelMessage = null;
let entreprisesMessage = null;

// 🔒 CHECK ROLE
function hasAccess(member) {
  return member.roles.cache.some(r => r.name === ROLE_NAME);
}

// 📁 LOAD SAVE
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    stats = JSON.parse(fs.readFileSync(DATA_FILE));
  }
  if (fs.existsSync(ENTREPRISES_FILE)) {
    entreprises = JSON.parse(fs.readFileSync(ENTREPRISES_FILE));
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(stats, null, 2));
  fs.writeFileSync(ENTREPRISES_FILE, JSON.stringify(entreprises, null, 2));
}

// 📊 PANEL PRINCIPAL
async function updatePanel() {
  const embed = new EmbedBuilder()
    .setTitle("📊 Panel de serveur")
    .setDescription(`Serveur : **${SERVER_NAME}**`)
    .addFields(
      { name: "🏡 Fermes totales", value: stats.fermesTotales, inline: true },
      { name: "✅ Fermes reprises", value: stats.fermesReprises, inline: true },
      { name: "🧩 Mods", value: stats.mods, inline: true }
    )
    .setColor(0x2ecc71);

  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!panelMessage) {
    const messages = await channel.messages.fetch({ limit: 10 });
    panelMessage = messages.find(m => m.author.id === client.user.id);

    if (!panelMessage) {
      panelMessage = await channel.send({ embeds: [embed] });
      return;
    }
  }

  await panelMessage.edit({ embeds: [embed] });
}

// 🏢 PANEL ENTREPRISES
async function updateEntreprises() {
  const description = entreprises.length === 0
    ? "Aucune entreprise enregistrée"
    : entreprises.map(e => `• **${e.nom}** — ${e.patron}`).join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🏢 Entreprises du serveur")
    .setDescription(description)
    .setColor(0x3498db);

  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!entreprisesMessage) {
    const messages = await channel.messages.fetch({ limit: 10 });
    entreprisesMessage = messages.find(m => m.embeds[0]?.title === "🏢 Entreprises du serveur");

    if (!entreprisesMessage) {
      entreprisesMessage = await channel.send({ embeds: [embed] });
      return;
    }
  }

  await entreprisesMessage.edit({ embeds: [embed] });
}

// 🚀 COMMANDES
const commands = [
  new SlashCommandBuilder()
    .setName("fermestotales")
    .addStringOption(o => o.setName("nombre").setRequired(true)),

  new SlashCommandBuilder()
    .setName("fermesreprises")
    .addStringOption(o => o.setName("nombre").setRequired(true)),

  new SlashCommandBuilder()
    .setName("mods")
    .addStringOption(o => o.setName("nombre").setRequired(true)),

  new SlashCommandBuilder()
    .setName("maj"),

  new SlashCommandBuilder()
    .setName("entreprise-ajouter")
    .addStringOption(o => o.setName("nom").setRequired(true))
    .addUserOption(o => o.setName("patron").setRequired(true)),

  new SlashCommandBuilder()
    .setName("entreprise-retirer")
    .addStringOption(o => o.setName("nom").setRequired(true))

].map(cmd => cmd.toJSON());

// REGISTER
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

// READY
client.once("ready", async () => {
  loadData();
  await updatePanel();
  await updateEntreprises();
});

// INTERACTION
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (!hasAccess(interaction.member)) {
    return interaction.reply({ content: "⛔ Accès refusé", ephemeral: true });
  }

  const cmd = interaction.commandName;

  if (cmd === "fermestotales") {
    stats.fermesTotales = interaction.options.getString("nombre");
  }

  if (cmd === "fermesreprises") {
    stats.fermesReprises = interaction.options.getString("nombre");
  }

  if (cmd === "mods") {
    stats.mods = interaction.options.getString("nombre");
  }

  if (cmd === "entreprise-ajouter") {
    const nom = interaction.options.getString("nom");
    const patron = interaction.options.getUser("patron");

    entreprises.push({
      nom,
      patron: `<@${patron.id}>`
    });
  }

  if (cmd === "entreprise-retirer") {
    const nom = interaction.options.getString("nom");
    entreprises = entreprises.filter(e => e.nom !== nom);
  }

  if (cmd === "maj") {
    await updatePanel();
    await updateEntreprises();
    return interaction.reply({ content: "✅ Panels mis à jour", ephemeral: true });
  }

  saveData();
  await updatePanel();
  await updateEntreprises();

  interaction.reply({ content: "✅ Mise à jour effectuée", ephemeral: true });
});

client.login(TOKEN);
