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

function hasAccess(member) {
  if (!member || !member.roles) return false;
  return member.roles.cache.some(r => r.name === ROLE_NAME);
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

function getColorByStatus() {
  if (stats.statut.includes("En ligne")) return 0x2ecc71;
  if (stats.statut.includes("développement")) return 0xf39c12;
  if (stats.statut.includes("Hors ligne")) return 0xe74c3c;
  return 0x3498db;
}

async function updatePanel() {
  const embed = new EmbedBuilder()
    .setTitle("📊 ━━━━━━━━━━ PANEL SERVEUR ━━━━━━━━━━")
    .setDescription(
      `🏛️ **Serveur : ${SERVER_NAME}**\n` +
      `🌾 _Tableau de suivi officiel du serveur agricole_`
    )
    .addFields(
      {
        name: "📡 STATUT",
        value: `\`\`\`${stats.statut}\`\`\``,
        inline: false
      },
      {
        name: "🏡 FERMES TOTALES",
        value: `\`\`\`${stats.fermesTotales}\`\`\``,
        inline: true
      },
      {
        name: "✅ FERMES REPRISES",
        value: `\`\`\`${stats.fermesReprises}\`\`\``,
        inline: true
      },
      {
        name: "🧩 MODS INSTALLÉS",
        value: `\`\`\`${stats.mods}\`\`\``,
        inline: true
      },
      {
        name: "━━━━━━━━━━━━━━━━━━━━",
        value: "📌 _Informations mises à jour par l’équipe staff._",
        inline: false
      }
    )
    .setColor(getColorByStatus())
    .setFooter({
      text: "Dumax FS25 • Panel officiel"
    })
    .setTimestamp();

  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!panelMessage) {
    const messages = await channel.messages.fetch({ limit: 20 });
    panelMessage = messages.find(m => m.embeds[0]?.title?.includes("PANEL SERVEUR"));

    if (!panelMessage) {
      panelMessage = await channel.send({ embeds: [embed] });
      return;
    }
  }

  await panelMessage.edit({ embeds: [embed] });
}

async function updateEntreprises() {
  const description = entreprises.length === 0
    ? "```Aucune entreprise enregistrée.```"
    : entreprises.map(e =>
      `🏢 **${e.nom}**\n` +
      `👤 Patron : ${e.patron}\n` +
      `📥 Recrutement : ${e.recrutement || "🟢 Ouvert"}`
    ).join("\n\n");

  const embed = new EmbedBuilder()
    .setTitle("🏢 ━━━━━━━━━━ ENTREPRISES ━━━━━━━━━━")
    .setDescription(
      `📋 **Liste officielle des entreprises reprises**\n\n${description}`
    )
    .setColor(0x3498db)
    .setFooter({
      text: "Dumax FS25 • Registre des entreprises"
    })
    .setTimestamp();

  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!entreprisesMessage) {
    const messages = await channel.messages.fetch({ limit: 20 });
    entreprisesMessage = messages.find(m => m.embeds[0]?.title?.includes("ENTREPRISES"));

    if (!entreprisesMessage) {
      entreprisesMessage = await channel.send({ embeds: [embed] });
      return;
    }
  }

  await entreprisesMessage.edit({ embeds: [embed] });
}

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
        description: "Nom de l’entreprise",
        type: 3,
        required: true
      },
      {
        name: "patron",
        description: "Patron de l’entreprise",
        type: 6,
        required: true
      },
      {
        name: "recrutement",
        description: "Statut du recrutement",
        type: 3,
        required: true,
        choices: [
          { name: "🟢 Ouvert", value: "open" },
          { name: "🔴 Fermé", value: "closed" }
        ]
      }
    ]
  },
  {
    name: "entreprise-retirer",
    description: "Retirer une entreprise",
    type: 1,
    options: [
      {
        name: "entreprise",
        description: "Entreprise à retirer",
        type: 3,
        required: true,
        autocomplete: true
      }
    ]
  },
  {
    name: "recrutement",
    description: "Modifier le recrutement d’une entreprise",
    type: 1,
    options: [
      {
        name: "entreprise",
        description: "Entreprise concernée",
        type: 3,
        required: true,
        autocomplete: true
      },
      {
        name: "statut",
        description: "Statut du recrutement",
        type: 3,
        required: true,
        choices: [
          { name: "🟢 Ouvert", value: "open" },
          { name: "🔴 Fermé", value: "closed" }
        ]
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
  if (interaction.isAutocomplete()) {
    const focusedValue = interaction.options.getFocused().toLowerCase();

    const choices = entreprises
      .filter(e => e.nom.toLowerCase().includes(focusedValue))
      .slice(0, 25)
      .map(e => ({
        name: e.nom,
        value: e.nom
      }));

    return interaction.respond(choices);
  }

  if (!interaction.isChatInputCommand()) return;

  if (!hasAccess(interaction.member)) {
    return interaction.reply({
      content: "⛔ Tu n’as pas la permission d’utiliser cette commande.",
      ephemeral: true
    });
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
    const recrutement = interaction.options.getString("recrutement");

    const existe = entreprises.some(e => e.nom.toLowerCase() === nom.toLowerCase());

    if (existe) {
      return interaction.reply({
        content: "❌ Cette entreprise existe déjà.",
        ephemeral: true
      });
    }

    entreprises.push({
      nom,
      patron: `<@${patron.id}>`,
      recrutement: recrutement === "open" ? "🟢 Ouvert" : "🔴 Fermé"
    });
  }

  if (cmd === "entreprise-retirer") {
    const nom = interaction.options.getString("entreprise");
    entreprises = entreprises.filter(e => e.nom.toLowerCase() !== nom.toLowerCase());
  }

  if (cmd === "recrutement") {
    const nom = interaction.options.getString("entreprise");
    const statut = interaction.options.getString("statut");

    const entreprise = entreprises.find(e => e.nom.toLowerCase() === nom.toLowerCase());

    if (!entreprise) {
      return interaction.reply({
        content: "❌ Entreprise introuvable.",
        ephemeral: true
      });
    }

    entreprise.recrutement = statut === "open" ? "🟢 Ouvert" : "🔴 Fermé";
  }

  if (cmd === "maj") {
    await updatePanel();
    await updateEntreprises();

    return interaction.reply({
      content: "✅ Panels mis à jour.",
      ephemeral: true
    });
  }

  saveData();
  await updatePanel();
  await updateEntreprises();

  return interaction.reply({
    content: "✅ Mise à jour effectuée.",
    ephemeral: true
  });
});

client.login(TOKEN);
