const { Client, GatewayIntentBits, EmbedBuilder, Routes } = require("discord.js");
const { REST } = require("@discordjs/rest");
const fs = require("fs");

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

const AMENDES_CHANNEL_ID = "1498021850054266980";
const ENTREPRISES_CHANNEL_ID = "1498040049533456556";
const SERVICES_CHANNEL_ID = "1498047350818738176";

const STAFF_ROLE_NAME = "━━━━━━━━━━ ⚡️ STAFF ━━━━━━━━━━";
const SERVICE_ROLE_NAME = "━━━━━━━━━━ 🚜 ENTREPRISES AGRICOLES ━━━━━━━━━━";
const SERVER_NAME = "Dumax FS25";

const DATA_FILE = "./stats.json";
const ENTREPRISES_FILE = "./entreprises.json";
const AMENDES_FILE = "./amendes.json";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
let servicesMessage = null;

function isStaff(member) {
  if (!member || !member.roles) return false;
  return member.roles.cache.some(r => r.name === STAFF_ROLE_NAME);
}

function isServiceAllowed(member) {
  if (!member || !member.roles) return false;
  return member.roles.cache.some(r => r.name === SERVICE_ROLE_NAME);
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) stats = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  if (fs.existsSync(ENTREPRISES_FILE)) entreprises = JSON.parse(fs.readFileSync(ENTREPRISES_FILE, "utf8"));
  if (fs.existsSync(AMENDES_FILE)) amendes = JSON.parse(fs.readFileSync(AMENDES_FILE, "utf8"));
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(stats, null, 2));
  fs.writeFileSync(ENTREPRISES_FILE, JSON.stringify(entreprises, null, 2));
  fs.writeFileSync(AMENDES_FILE, JSON.stringify(amendes, null, 2));
}

function getColorByStatus() {
  if (stats.statut.includes("En ligne")) return 0x2ecc71;
  if (stats.statut.includes("développement")) return 0xf39c12;
  if (stats.statut.includes("Hors ligne")) return 0xe74c3c;
  return 0x3498db;
}

function getNextAmendeNumber() {
  const max = amendes.reduce((highest, a) => {
    const n = parseInt(a.numero, 10);
    return Number.isNaN(n) ? highest : Math.max(highest, n);
  }, 0);

  return String(max + 1).padStart(4, "0");
}

async function fetchPanelMessage(channel, titlePart) {
  const messages = await channel.messages.fetch({ limit: 30 });

  return messages.find(m =>
    m.author.id === client.user.id &&
    m.embeds[0]?.title?.includes(titlePart)
  );
}

async function updatePanel() {
  const embed = new EmbedBuilder()
    .setTitle("📊 ━━━━━━━━━━ PANEL SERVEUR ━━━━━━━━━━")
    .setDescription(
      `🏛️ **Serveur : ${SERVER_NAME}**\n` +
      `🌾 _Tableau de suivi officiel du serveur agricole_\n\n` +
      `━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      { name: "📡 STATUT DU SERVEUR", value: `\`\`\`${stats.statut}\`\`\``, inline: false },
      { name: "🏡 FERMES TOTALES", value: `\`\`\`${stats.fermesTotales}\`\`\``, inline: true },
      { name: "✅ FERMES REPRISES", value: `\`\`\`${stats.fermesReprises}\`\`\``, inline: true },
      { name: "🧩 MODS INSTALLÉS", value: `\`\`\`${stats.mods}\`\`\``, inline: true },
      { name: "━━━━━━━━━━━━━━━━━━━━", value: "📌 _Informations mises à jour par l’équipe staff._", inline: false }
    )
    .setColor(getColorByStatus())
    .setFooter({ text: "Dumax FS25 • Panel officiel" })
    .setTimestamp();

  const channel = await client.channels.fetch(CHANNEL_ID);

  if (!panelMessage) {
    panelMessage = await fetchPanelMessage(channel, "PANEL SERVEUR");

    if (!panelMessage) {
      panelMessage = await channel.send({ embeds: [embed] });
      return;
    }
  }

  await panelMessage.edit({ embeds: [embed] });
}

async function updateEntreprises() {
  const openCount = entreprises.filter(e => (e.recrutement || "").includes("Ouvert")).length;

  const embed = new EmbedBuilder()
    .setTitle("🏢 ━━━━━━━━━━ REGISTRE DES ENTREPRISES ━━━━━━━━━━")
    .setColor(0x3498db)
    .setFooter({ text: "Dumax FS25 • Registre officiel des entreprises" })
    .setTimestamp();

  if (entreprises.length === 0) {
    embed.setDescription(
      "📋 **Registre officiel des entreprises reprises**\n\n" +
      "```Aucune entreprise enregistrée.```"
    );
  } else {
    const description =
      `📋 **Registre officiel des entreprises reprises**\n\n` +
      `🏢 Entreprises enregistrées : **${entreprises.length}**\n` +
      `📥 Recrutements ouverts : **${openCount}**\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      entreprises.map(e =>
        `🏛️ **${e.nom}**\n\n` +
        `🌾 **Secteur :** ${e.secteur || "Non défini"}\n` +
        `👤 **Patron :** ${e.patron}\n` +
        `📥 **Recrutement :** ${e.recrutement || "🟢 Ouvert"}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━`
      ).join("\n\n");

    embed.setDescription(description);
  }

  const channel = await client.channels.fetch(ENTREPRISES_CHANNEL_ID);

  if (!entreprisesMessage) {
    entreprisesMessage = await fetchPanelMessage(channel, "REGISTRE DES ENTREPRISES");

    if (!entreprisesMessage) {
      entreprisesMessage = await channel.send({ embeds: [embed] });
      return;
    }
  }

  await entreprisesMessage.edit({ embeds: [embed] });
}

async function updateServices() {
  const enService = entreprises.filter(e => e.service === "🟢 En service");
  const horsService = entreprises.filter(e => e.service !== "🟢 En service");

  const description =
    `📋 **Tableau opérationnel des sociétés agricoles**\n\n` +
    `🟢 En service : **${enService.length}**\n` +
    `🔴 Hors service : **${horsService.length}**\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🟢 **EN SERVICE**\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    (enService.length
      ? enService.map(e => `🟢 ${e.nom}`).join("\n")
      : "_Aucune entreprise en service_"
    ) +
    `\n\n━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🔴 **HORS SERVICE**\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    (horsService.length
      ? horsService.map(e => `🔴 ${e.nom}`).join("\n")
      : "_Aucune entreprise hors service_"
    );

  const embed = new EmbedBuilder()
    .setTitle("🚜 ━━━━━━━━━━ SERVICES ENTREPRISES ━━━━━━━━━━")
    .setDescription(description)
    .setColor(enService.length > 0 ? 0x2ecc71 : 0xe74c3c)
    .setFooter({ text: "Dumax FS25 • Tableau des services" })
    .setTimestamp();

  const channel = await client.channels.fetch(SERVICES_CHANNEL_ID);

  if (!servicesMessage) {
    servicesMessage = await fetchPanelMessage(channel, "SERVICES ENTREPRISES");

    if (!servicesMessage) {
      servicesMessage = await channel.send({ embeds: [embed] });
      return;
    }
  }

  await servicesMessage.edit({ embeds: [embed] });
}

const commands = [
  {
    name: "statut",
    description: "Changer le statut du serveur",
    type: 1,
    options: [{
      name: "statut",
      description: "Choix du statut",
      type: 3,
      required: true,
      choices: [
        { name: "🟢 En ligne", value: "online" },
        { name: "🟠 En développement (staff only)", value: "dev" },
        { name: "🔴 Hors ligne", value: "offline" }
      ]
    }]
  },
  {
    name: "fermestotales",
    description: "Définir le nombre de fermes totales",
    type: 1,
    options: [{ name: "nombre", description: "Nombre total de fermes", type: 3, required: true }]
  },
  {
    name: "fermesreprises",
    description: "Définir le nombre de fermes reprises",
    type: 1,
    options: [{ name: "nombre", description: "Nombre de fermes reprises", type: 3, required: true }]
  },
  {
    name: "mods",
    description: "Définir le nombre de mods installés",
    type: 1,
    options: [{ name: "nombre", description: "Nombre de mods installés", type: 3, required: true }]
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
      { name: "nom", description: "Nom de l’entreprise", type: 3, required: true },
      { name: "secteur", description: "Secteur d’activité", type: 3, required: true },
      { name: "patron", description: "Patron de l’entreprise", type: 6, required: true },
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
    options: [{ name: "entreprise", description: "Entreprise à retirer", type: 3, required: true, autocomplete: true }]
  },
  {
    name: "recrutement",
    description: "Modifier le recrutement d’une entreprise",
    type: 1,
    options: [
      { name: "entreprise", description: "Entreprise concernée", type: 3, required: true, autocomplete: true },
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
  },
  {
    name: "service",
    description: "Prendre ou quitter le service d’une entreprise",
    type: 1,
    options: [
      { name: "entreprise", description: "Entreprise concernée", type: 3, required: true, autocomplete: true },
      {
        name: "statut",
        description: "Statut de service",
        type: 3,
        required: true,
        choices: [
          { name: "🟢 En service", value: "on" },
          { name: "🔴 Hors service", value: "off" }
        ]
      }
    ]
  },
  {
    name: "service-forcer",
    description: "Forcer le statut de service d’une entreprise",
    type: 1,
    options: [
      { name: "entreprise", description: "Entreprise concernée", type: 3, required: true, autocomplete: true },
      {
        name: "statut",
        description: "Statut de service",
        type: 3,
        required: true,
        choices: [
          { name: "🟢 En service", value: "on" },
          { name: "🔴 Hors service", value: "off" }
        ]
      }
    ]
  },
  {
    name: "amende",
    description: "Émettre une amende RP à une entreprise",
    type: 1,
    options: [
      { name: "entreprise", description: "Entreprise concernée", type: 3, required: true, autocomplete: true },
      { name: "montant", description: "Montant de l’amende", type: 3, required: true },
      { name: "motif", description: "Motif de l’amende", type: 3, required: true }
    ]
  },
  {
    name: "amende-annuler",
    description: "Annuler une amende RP",
    type: 1,
    options: [
      { name: "numero", description: "Numéro de l’amende à annuler", type: 3, required: true }
    ]
  },
  {
    name: "amendes-historique",
    description: "Afficher l’historique des amendes d’une entreprise",
    type: 1,
    options: [
      { name: "entreprise", description: "Entreprise concernée", type: 3, required: true, autocomplete: true }
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

  entreprises = entreprises.map(e => ({
    ...e,
    service: e.service || "🔴 Hors service"
  }));

  saveData();

  await registerCommands();
  await updatePanel();
  await updateEntreprises();
  await updateServices();
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

  const cmd = interaction.commandName;
  const staff = isStaff(interaction.member);
  const serviceAllowed = isServiceAllowed(interaction.member);

  if (cmd === "service") {
    if (!staff && !serviceAllowed) {
      return interaction.reply({
        content: "⛔ Tu n’as pas la permission d’utiliser cette commande.",
        ephemeral: true
      });
    }
  } else {
    if (!staff) {
      return interaction.reply({
        content: "⛔ Tu n’as pas la permission d’utiliser cette commande.",
        ephemeral: true
      });
    }
  }

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
    const secteur = interaction.options.getString("secteur");
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
      secteur,
      patron: `<@${patron.id}>`,
      recrutement: recrutement === "open" ? "🟢 Ouvert" : "🔴 Fermé",
      service: "🔴 Hors service"
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

  if (cmd === "service" || cmd === "service-forcer") {
    if (cmd === "service-forcer" && !staff) {
      return interaction.reply({
        content: "⛔ Seul le staff peut forcer un service.",
        ephemeral: true
      });
    }

    const nom = interaction.options.getString("entreprise");
    const statut = interaction.options.getString("statut");
    const entreprise = entreprises.find(e => e.nom.toLowerCase() === nom.toLowerCase());

    if (!entreprise) {
      return interaction.reply({
        content: "❌ Entreprise introuvable.",
        ephemeral: true
      });
    }

    entreprise.service = statut === "on" ? "🟢 En service" : "🔴 Hors service";

    saveData();
    await updateServices();
    await updateEntreprises();

    return interaction.reply({
      content: `✅ Service mis à jour pour **${entreprise.nom}** : ${entreprise.service}`,
      ephemeral: true
    });
  }

  if (cmd === "amende") {
    const nom = interaction.options.getString("entreprise");
    const montant = interaction.options.getString("montant");
    const motif = interaction.options.getString("motif");

    const entreprise = entreprises.find(e => e.nom.toLowerCase() === nom.toLowerCase());

    if (!entreprise) {
      return interaction.reply({
        content: "❌ Entreprise introuvable.",
        ephemeral: true
      });
    }

    const numero = getNextAmendeNumber();
    const date = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

    const amende = {
      numero,
      entreprise: entreprise.nom,
      patron: entreprise.patron,
      montant,
      motif,
      date,
      agent: interaction.user.tag,
      statut: "ACTIVE"
    };

    amendes.push(amende);
    saveData();

    const embed = new EmbedBuilder()
      .setTitle(`🏛️ ━━━━━━ NOTIFICATION D’AMENDE ${numero} ━━━━━━`)
      .setDescription(
        `🏢 **Entreprise concernée :** ${entreprise.nom}\n` +
        `👤 **Patron notifié :** ${entreprise.patron}\n` +
        `💰 **Montant :** ${montant} $\n` +
        `📄 **Motif :** ${motif}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ _Amende émise dans le cadre du règlement économique RP par la Banque de France._`
      )
      .setColor(0xe74c3c)
      .setFooter({ text: "Dumax FS25 • Autorité financière RP" })
      .setTimestamp();

    const amendesChannel = await client.channels.fetch(AMENDES_CHANNEL_ID);
    await amendesChannel.send({ content: `${entreprise.patron}`, embeds: [embed] });

    return interaction.reply({
      content: `✅ Amende ${numero} envoyée dans le salon dédié.`,
      ephemeral: true
    });
  }

  if (cmd === "amende-annuler") {
    const numero = interaction.options.getString("numero").padStart(4, "0");
    const amende = amendes.find(a => a.numero === numero);

    if (!amende) {
      return interaction.reply({
        content: "❌ Amende introuvable.",
        ephemeral: true
      });
    }

    if (amende.statut === "ANNULÉE") {
      return interaction.reply({
        content: "⚠️ Cette amende est déjà annulée.",
        ephemeral: true
      });
    }

    amende.statut = "ANNULÉE";
    amende.dateAnnulation = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
    amende.agentAnnulation = interaction.user.tag;

    saveData();

    const embed = new EmbedBuilder()
      .setTitle(`❌ ━━━━━━ ANNULATION D’AMENDE ${numero} ━━━━━━`)
      .setDescription(
        `🏢 **Entreprise concernée :** ${amende.entreprise}\n` +
        `👤 **Patron notifié :** ${amende.patron}\n` +
        `💰 **Montant initial :** ${amende.montant} $\n` +
        `📄 **Motif initial :** ${amende.motif}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ _Cette amende a été annulée par décision administrative de la Banque de France._`
      )
      .setColor(0x95a5a6)
      .setFooter({ text: "Dumax FS25 • Autorité financière RP" })
      .setTimestamp();

    const amendesChannel = await client.channels.fetch(AMENDES_CHANNEL_ID);
    await amendesChannel.send({ content: `${amende.patron}`, embeds: [embed] });

    return interaction.reply({
      content: `✅ Amende ${numero} annulée.`,
      ephemeral: true
    });
  }

  if (cmd === "amendes-historique") {
    const nom = interaction.options.getString("entreprise");

    const historique = amendes
      .filter(a => a.entreprise.toLowerCase() === nom.toLowerCase())
      .slice(-10)
      .reverse();

    if (historique.length === 0) {
      return interaction.reply({
        content: "📁 Aucune amende enregistrée pour cette entreprise.",
        ephemeral: true
      });
    }

    const description = historique.map(a => {
      const statut = a.statut === "ANNULÉE" ? "❌ ANNULÉE" : "✅ ACTIVE";

      return (
        `**${a.numero}** — ${statut}\n` +
        `📅 ${a.date}\n` +
        `💰 ${a.montant} $\n` +
        `📄 ${a.motif}` +
        (a.statut === "ANNULÉE"
          ? `\n🕒 Annulée le : ${a.dateAnnulation || "Date inconnue"}`
          : "")
      );
    }).join("\n\n━━━━━━━━━━━━━━━━━━━━\n\n");

    const embed = new EmbedBuilder()
      .setTitle(`📁 Historique des amendes — ${nom}`)
      .setDescription(description)
      .setColor(0xf1c40f)
      .setFooter({ text: "Dumax FS25 • Historique Banque de France" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (cmd === "maj") {
    await updatePanel();
    await updateEntreprises();
    await updateServices();

    return interaction.reply({
      content: "✅ Panels mis à jour.",
      ephemeral: true
    });
  }

  saveData();
  await updatePanel();
  await updateEntreprises();
  await updateServices();

  return interaction.reply({
    content: "✅ Mise à jour effectuée.",
    ephemeral: true
  });
});

client.login(TOKEN);
