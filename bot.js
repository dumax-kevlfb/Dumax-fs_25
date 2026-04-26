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
  mods: "0"
};

let entreprises = [];

let panelMessage = null;
let entreprisesMessage = null;

function hasAccess(member) {
  if (!member || !member.roles) return false;
  return member.roles.cache.some(role => role.name === ROLE_NAME);
}

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

async function updatePanel() {
  const embed = new EmbedBuilder()
    .setTitle("📊 Panel de serveur")
    .setDescription(`Serveur : **${SERVER_NAME}**`)
    .addFields(
      { name: "🏡 Fermes totales", value: stats.fermesTotales, inline: true },
      { name: "✅ Fermes reprises", value: stats.fermesReprises, inline: true },
      { name: "🧩 Mods installés", value: stats.mods, inline: true }
    )
    .setColor(0x2ecc71)
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

const commands = [
  {
    name: "fermestotales",
    description: "Définir le nombre de fermes totales",
    type: 1,
    options: [
      {
        name: "nombre",
        description: "Nombre total de fermes",
        type: 3,
        required: true
      }
    ]
  },
  {
    name: "fermesreprises",
    description: "Définir le nombre de fermes reprises",
    type: 1,
    options: [
      {
        name: "nombre",
        description: "Nombre de fermes reprises",
        type: 3,
        required: true
      }
    ]
  },
  {
    name: "mods",
    description: "Définir le nombre de mods installés",
    type: 1,
    options: [
      {
        name: "nombre",
        description: "Nombre de mods installés",
        type: 3,
        required: true
      }
    ]
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
      {
        name: "nom",
        description: "Nom de l'entreprise",
        type: 3,
        required: true
      },
      {
        name: "patron",
        description: "Patron de l'entreprise",
        type: 6,
        required: true
      }
    ]
  },
  {
    name: "entreprise-retirer",
    description: "Retirer une entreprise",
    type: 1,
    options: [
      {
        name: "nom",
        description: "Nom de l'entreprise à retirer",
        type: 3,
        required: true
      }
    ]
  }
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("✅ Slash commands enregistrées");
  } catch (error) {
    console.error("❌ Erreur enregistrement slash commands :", error);
  }
}

client.once("ready", async () => {
  console.log(`✅ Connecté : ${client.user.tag}`);

  loadData();
  await registerCommands();
  await updatePanel();
  await updateEntreprises();
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (!hasAccess(interaction.member)) {
    return interaction.reply({
      content: "⛔ Tu n’as pas la permission d’utiliser cette commande.",
      ephemeral: true
    });
  }

  const cmd = interaction.commandName;

  if (cmd === "fermestotales") {
    stats.fermesTotales = interaction.options.getString("nombre");
    saveData();
    await updatePanel();
    await updateEntreprises();

    return interaction.reply({
      content: "✅ Nombre de fermes totales mis à jour.",
      ephemeral: true
    });
  }

  if (cmd === "fermesreprises") {
    stats.fermesReprises = interaction.options.getString("nombre");
    saveData();
    await updatePanel();
    await updateEntreprises();

    return interaction.reply({
      content: "✅ Nombre de fermes reprises mis à jour.",
      ephemeral: true
    });
  }

  if (cmd === "mods") {
    stats.mods = interaction.options.getString("nombre");
    saveData();
    await updatePanel();
    await updateEntreprises();

    return interaction.reply({
      content: "✅ Nombre de mods mis à jour.",
      ephemeral: true
    });
  }

  if (cmd === "entreprise-ajouter") {
    const nom = interaction.options.getString("nom");
    const patron = interaction.options.getUser("patron");

    entreprises.push({
      nom,
      patron: `<@${patron.id}>`
    });

    saveData();
    await updatePanel();
    await updateEntreprises();

    return interaction.reply({
      content: "✅ Entreprise ajoutée.",
      ephemeral: true
    });
  }

  if (cmd === "entreprise-retirer") {
    const nom = interaction.options.getString("nom");

    entreprises = entreprises.filter(e => e.nom.toLowerCase() !== nom.toLowerCase());

    saveData();
    await updatePanel();
    await updateEntreprises();

    return interaction.reply({
      content: "✅ Entreprise retirée.",
      ephemeral: true
    });
  }

  if (cmd === "maj") {
    await updatePanel();
    await updateEntreprises();

    return interaction.reply({
      content: "✅ Panels mis à jour.",
      ephemeral: true
    });
  }
});

client.login(TOKEN);
