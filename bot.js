const { Client, GatewayIntentBits, EmbedBuilder, Routes } = require("discord.js");
const { REST } = require("@discordjs/rest");
const fs = require("fs");

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

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
  mods: "0",
  statut: "🟠 En développement (staff only)"
};

let entreprises = [];

let panelMessage = null;
let entreprisesMessage = null;

// 🔒 Vérification rôle
function hasAccess(member) {
  if (!member || !member.roles) return false;
  return member.roles.cache.some(r => r.name === ROLE_NAME);
}

// 📁 LOAD / SAVE
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    stats = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  }
  if (fs.existsSync(ENTREPRISES_FILE)) {
    entreprises = JSON.parse(fs.readFileSync(ENTREPRISES_FILE, "utf8"));
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(stats, null, 2));
  fs.writeFileSync(ENTREPRISES_FILE, JSON.stringify(entreprises, null, 2));
}

// 🎨 Couleur dynamique selon statut
function getColorByStatus() {
  if (stats.statut.includes("En ligne")) return 0x2ecc71; // vert
  if (stats.statut.includes("développement")) return 0xf39c12; // orange
  if (stats.statut.includes("Hors ligne")) return 0xe74c3c; // rouge
  return 0x3498db; // fallback
}

// 📊 PANEL PRINCIPAL
async function updatePanel() {
  const embed = new EmbedBuilder()
    .setTitle("📊 Panel de serveur")
    .setDescription(`Serveur : **${SERVER_NAME}**`)
    .addFields(
      { name: "📡 Statut serveur", value: stats.statut, inline: true },
      { name: "🏡 Fermes totales", value: stats.fermesTotales, inline: true },
      { name: "✅ Fermes reprises", value: stats.fermesReprises, inline: true },
      { name: "🧩 Mods installés", value: stats.mods, inline: true }
    )
    .setColor(getColorByStatus())
    .setTimestamp();

  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!panelMessage) {
    const messages = await channel.messages.fetch({ limit: 20 });
    panelMessage = messages.find(m => m.embeds[0]?.title === "📊 Panel de serveur");

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
    ? "Aucune entreprise enregistrée."
    : entreprises.map(e => `• **${e.nom}** — Patron : ${e.patron}`).join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🏢 Entreprises du serveur")
    .setDescription(description)
    .setColor(0x3498db)
    .setTimestamp();

  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!entreprisesMessage) {
    const messages = await channel.messages.fetch({ limit: 20 });
    entreprisesMessage = messages.find(m => m.embeds[0]?.title === "🏢 Entreprises du serveur");

    if (!entreprisesMessage) {
      entreprisesMessage = await channel.send({ embeds: [embed] });
      return;
    }
  }

  await entreprisesMessage.edit({ embeds: [embed] });
}

// 🎮 COMMANDES
const commands = [
  {
    name: "statut",
    description: "Changer le statut du serveur",
    type: 1,
    options: [
      {
        name: "statut",
        description: "Choix du statut",
        type: 3,
        required: true,
        choices: [
          { name: "🟢 En ligne", value: "online" },
          { name: "🟠 En développement (staff only)", value: "dev" },
          { name: "🔴 Hors ligne", value: "offline" }
        ]
      }
    ]
  },
  {
    name: "fermestotales",
    description: "Définir le nombre de fermes totales",
    type: 1,
    options: [{ name: "nombre", description: "Nombre", type: 3, required: true }]
  },
  {
    name: "fermesreprises",
    description: "Définir le nombre de fermes reprises",
    type: 1,
    options: [{ name: "nombre", description: "Nombre", type: 3, required: true }]
  },
  {
    name: "mods",
    description: "Définir le nombre de mods",
    type: 1,
    options: [{ name: "nombre", description: "Nombre", type: 3, required: true }]
  },
  {
    name: "maj",
    description: "Mettre à jour les panels",
    type: 1
  },
  {
    name: "entreprise-ajouter",
    description: "Ajouter une entreprise",
    type: 1,
    options: [
      { name: "nom", description: "Nom", type: 3, required: true },
      { name: "patron", description: "Patron", type: 6, required: true }
    ]
  },
  {
    name: "entreprise-retirer",
    description: "Retirer une entreprise",
    type: 1,
    options: [{ name: "nom", description: "Nom", type: 3, required: true }]
  }
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

// 🚀 READY
client.once("ready", async () => {
  console.log("Bot prêt");
  loadData();

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  await updatePanel();
  await updateEntreprises();
});

// 🎮 INTERACTIONS
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (!hasAccess(interaction.member)) {
    return interaction.reply({ content: "⛔ Accès refusé", ephemeral: true });
  }

  const cmd = interaction.commandName;

  if (cmd === "statut") {
    const value = interaction.options.getString("statut");

    const map = {
      online: "🟢 En ligne",
      dev: "🟠 En développement (staff only)",
      offline: "🔴 Hors ligne"
    };

    stats.statut = map[value];
  }

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
    entreprises.push({ nom, patron: `<@${patron.id}>` });
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
