const { Client, GatewayIntentBits, EmbedBuilder, Routes } = require("discord.js");
const { REST } = require("@discordjs/rest");
const fs = require("fs");

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

const AMENDES_CHANNEL_ID = "METS_TON_ID_SALON_AMENDES_ICI";

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
  const max = amendes.reduce((m, a) => Math.max(m, parseInt(a.numero) || 0), 0);
  return String(max + 1).padStart(4, "0");
}

function getColor() {
  if (stats.statut.includes("En ligne")) return 0x2ecc71;
  if (stats.statut.includes("développement")) return 0xf39c12;
  if (stats.statut.includes("Hors ligne")) return 0xe74c3c;
  return 0x3498db;
}

async function updatePanel() {
  const embed = new EmbedBuilder()
    .setTitle("📊 ━━━━━━━━━━ PANEL SERVEUR ━━━━━━━━━━")
    .setDescription(`🏛️ **${SERVER_NAME}**\n━━━━━━━━━━━━━━━━━━━━`)
    .addFields(
      { name: "📡 STATUT", value: `\`\`\`${stats.statut}\`\`\`` },
      { name: "🏡 FERMES", value: `\`\`\`${stats.fermesTotales}\`\`\``, inline: true },
      { name: "✅ REPRISES", value: `\`\`\`${stats.fermesReprises}\`\`\``, inline: true },
      { name: "🧩 MODS", value: `\`\`\`${stats.mods}\`\`\``, inline: true }
    )
    .setColor(getColor())
    .setTimestamp();

  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!panelMessage) {
    const msgs = await channel.messages.fetch({ limit: 20 });
    panelMessage = msgs.find(m => m.embeds[0]?.title?.includes("PANEL SERVEUR"));

    if (!panelMessage) return channel.send({ embeds: [embed] });
  }

  await panelMessage.edit({ embeds: [embed] });
}

async function updateEntreprises() {
  const desc = entreprises.length === 0
    ? "```Aucune entreprise```"
    : entreprises.map(e =>
      `🏢 **${e.nom}**\n👤 ${e.patron}\n📥 ${e.recrutement}`
    ).join("\n\n━━━━━━━━━━━━━━━━━━━━\n\n");

  const embed = new EmbedBuilder()
    .setTitle("🏢 ━━━━━━━━━━ ENTREPRISES ━━━━━━━━━━")
    .setDescription(desc)
    .setColor(0x3498db)
    .setTimestamp();

  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!entreprisesMessage) {
    const msgs = await channel.messages.fetch({ limit: 20 });
    entreprisesMessage = msgs.find(m => m.embeds[0]?.title?.includes("ENTREPRISES"));

    if (!entreprisesMessage) return channel.send({ embeds: [embed] });
  }

  await entreprisesMessage.edit({ embeds: [embed] });
}

const commands = [
  {
    name: "amende",
    description: "Créer une amende",
    options: [
      { name: "entreprise", type: 3, required: true, autocomplete: true, description: "Entreprise" },
      { name: "montant", type: 3, required: true, description: "Montant" },
      { name: "motif", type: 3, required: true, description: "Motif" }
    ]
  },
  {
    name: "amende-annuler",
    description: "Annuler une amende",
    options: [
      { name: "numero", type: 3, required: true, description: "Numéro" }
    ]
  },
  {
    name: "amendes-historique",
    description: "Historique",
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
    const value = interaction.options.getFocused();
    const list = entreprises
      .filter(e => e.nom.toLowerCase().includes(value.toLowerCase()))
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

    const ent = entreprises.find(e => e.nom === nom);
    if (!ent) return interaction.reply({ content: "Entreprise introuvable", ephemeral: true });

    const numero = getNextAmendeNumber();

    const amende = {
      numero,
      entreprise: nom,
      patron: ent.patron,
      montant,
      motif,
      date: new Date().toLocaleString("fr-FR"),
      statut: "ACTIVE"
    };

    amendes.push(amende);
    saveData();

    const embed = new EmbedBuilder()
      .setTitle(`🏛️ ━━━━━━ AMENDE ${numero} ━━━━━━`)
      .setDescription(
        `🏢 ${nom}\n👤 ${ent.patron}\n💰 ${montant} $\n📄 ${motif}\n\n⚠️ Banque de France`
      )
      .setColor(0xe74c3c);

    const ch = await client.channels.fetch(AMENDES_CHANNEL_ID);
    await ch.send({ content: ent.patron, embeds: [embed] });

    return interaction.reply({ content: `Amende ${numero} envoyée`, ephemeral: true });
  }

  if (cmd === "amende-annuler") {
    const numero = interaction.options.getString("numero");

    const amende = amendes.find(a => a.numero === numero);
    if (!amende) return interaction.reply({ content: "Introuvable", ephemeral: true });

    amende.statut = "ANNULÉE";
    saveData();

    const embed = new EmbedBuilder()
      .setTitle(`❌ ANNULATION AMENDE ${numero}`)
      .setDescription(`🏢 ${amende.entreprise}\n💰 ${amende.montant} $\n📄 ${amende.motif}`)
      .setColor(0x95a5a6);

    const ch = await client.channels.fetch(AMENDES_CHANNEL_ID);
    await ch.send({ embeds: [embed] });

    return interaction.reply({ content: `Amende ${numero} annulée`, ephemeral: true });
  }

  if (cmd === "amendes-historique") {
    const nom = interaction.options.getString("entreprise");

    const list = amendes
      .filter(a => a.entreprise === nom)
      .map(a =>
        `**${a.numero}** — ${a.statut}\n💰 ${a.montant} $\n📄 ${a.motif}`
      ).join("\n\n");

    return interaction.reply({
      content: list || "Aucune amende",
      ephemeral: true
    });
  }
});

client.login(TOKEN);
