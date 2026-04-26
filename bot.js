const { Client, GatewayIntentBits, EmbedBuilder, Routes } = require("discord.js");
const { REST } = require("@discordjs/rest");
const fs = require("fs");

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

// 👉 ID SALON AMENDES EN DUR
const AMENDES_CHANNEL_ID = "METS_TON_ID_ICI";

const ROLE_NAME = "━━━━━━━━━━ ⚡️ STAFF ━━━━━━━━━━";
const SERVER_NAME = "Dumax FS25";

const DATA_FILE = "./stats.json";
const ENTREPRISES_FILE = "./entreprises.json";
const AMENDES_FILE = "./amendes.json";

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
let amendes = [];

let panelMessage = null;
let entreprisesMessage = null;

function hasAccess(member) {
  if (!member || !member.roles) return false;
  return member.roles.cache.some(r => r.name === ROLE_NAME);
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) stats = JSON.parse(fs.readFileSync(DATA_FILE));
  if (fs.existsSync(ENTREPRISES_FILE)) entreprises = JSON.parse(fs.readFileSync(ENTREPRISES_FILE));
  if (fs.existsSync(AMENDES_FILE)) amendes = JSON.parse(fs.readFileSync(AMENDES_FILE));
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(stats, null, 2));
  fs.writeFileSync(ENTREPRISES_FILE, JSON.stringify(entreprises, null, 2));
  fs.writeFileSync(AMENDES_FILE, JSON.stringify(amendes, null, 2));
}

function getNextAmendeNumber() {
  return String(amendes.length + 1).padStart(4, "0");
}

async function updatePanel() {
  const embed = new EmbedBuilder()
    .setTitle("📊 PANEL SERVEUR")
    .addFields(
      { name: "📡 Statut", value: stats.statut, inline: true },
      { name: "🏡 Fermes", value: stats.fermesTotales, inline: true },
      { name: "✅ Reprises", value: stats.fermesReprises, inline: true },
      { name: "🧩 Mods", value: stats.mods, inline: true }
    )
    .setColor(0x2ecc71);

  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!panelMessage) panelMessage = await channel.send({ embeds: [embed] });
  else await panelMessage.edit({ embeds: [embed] });
}

async function updateEntreprises() {
  const description = entreprises.length === 0
    ? "Aucune entreprise"
    : entreprises.map(e =>
      `🏢 ${e.nom}\n👤 ${e.patron}\n📥 ${e.recrutement}`
    ).join("\n\n");

  const embed = new EmbedBuilder()
    .setTitle("🏢 ENTREPRISES")
    .setDescription(description)
    .setColor(0x3498db);

  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!entreprisesMessage) entreprisesMessage = await channel.send({ embeds: [embed] });
  else await entreprisesMessage.edit({ embeds: [embed] });
}

const commands = [
  {
    name: "amende",
    description: "Créer une amende",
    type: 1,
    options: [
      { name: "entreprise", type: 3, required: true, autocomplete: true, description: "Entreprise" },
      { name: "montant", type: 3, required: true, description: "Montant" },
      { name: "motif", type: 3, required: true, description: "Motif" }
    ]
  },
  {
    name: "amende-annuler",
    description: "Annuler une amende",
    type: 1,
    options: [
      { name: "numero", type: 3, required: true, description: "Numéro de l’amende" }
    ]
  },
  {
    name: "amendes-historique",
    description: "Historique des amendes",
    type: 1,
    options: [
      { name: "entreprise", type: 3, required: true, autocomplete: true, description: "Entreprise" }
    ]
  }
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
  loadData();

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  await updatePanel();
  await updateEntreprises();

  console.log("Bot prêt");
});

client.on("interactionCreate", async interaction => {

  if (interaction.isAutocomplete()) {
    const focused = interaction.options.getFocused();
    const list = entreprises
      .filter(e => e.nom.toLowerCase().includes(focused.toLowerCase()))
      .map(e => ({ name: e.nom, value: e.nom }))
      .slice(0, 25);

    return interaction.respond(list);
  }

  if (!interaction.isChatInputCommand()) return;

  if (!hasAccess(interaction.member)) {
    return interaction.reply({ content: "⛔ Accès refusé", ephemeral: true });
  }

  const cmd = interaction.commandName;

  if (cmd === "amende") {
    const nom = interaction.options.getString("entreprise");
    const montant = interaction.options.getString("montant");
    const motif = interaction.options.getString("motif");

    const entreprise = entreprises.find(e => e.nom === nom);
    if (!entreprise) return interaction.reply({ content: "Entreprise introuvable", ephemeral: true });

    const numero = getNextAmendeNumber();

    const amende = {
      numero,
      entreprise: nom,
      patron: entreprise.patron,
      montant,
      motif,
      statut: "ACTIVE"
    };

    amendes.push(amende);
    saveData();

    const embed = new EmbedBuilder()
      .setTitle(`🏛️ AMENDE N°${numero}`)
      .setDescription(
        `🏢 ${nom}\n👤 ${entreprise.patron}\n💰 ${montant} $\n📄 ${motif}\n\n⚠️ Banque de France`
      )
      .setColor(0xe74c3c);

    const channel = await client.channels.fetch(AMENDES_CHANNEL_ID);
    await channel.send({ content: entreprise.patron, embeds: [embed] });

    return interaction.reply({ content: `Amende N°${numero} envoyée`, ephemeral: true });
  }

  if (cmd === "amende-annuler") {
    const numero = interaction.options.getString("numero");
    const amende = amendes.find(a => a.numero === numero);

    if (!amende) return interaction.reply({ content: "Introuvable", ephemeral: true });

    amende.statut = "ANNULÉE";
    saveData();

    return interaction.reply({ content: `Amende ${numero} annulée`, ephemeral: true });
  }

  if (cmd === "amendes-historique") {
    const nom = interaction.options.getString("entreprise");

    const list = amendes
      .filter(a => a.entreprise === nom)
      .map(a =>
        `N°${a.numero} — ${a.statut}\n💰 ${a.montant} $\n📄 ${a.motif}`
      ).join("\n\n");

    return interaction.reply({
      content: list || "Aucune amende",
      ephemeral: true
    });
  }
});

client.login(TOKEN);
