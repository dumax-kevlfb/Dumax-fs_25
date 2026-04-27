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
const PRIMES_CHANNEL_ID = "1498064143394148502";

const STAFF_ROLE_NAME = "━━━ ⚡️ STAFF ━━━";
const SERVICE_ROLE_NAME = "━━━ 🚜 ENTREPRISES AGRICOLES ━━━";
const SERVER_NAME = "Dumax FS25";
const CURRENCY = "€";

const DATA_FILE = "./stats.json";
const ENTREPRISES_FILE = "./entreprises.json";
const AMENDES_FILE = "./amendes.json";
const PRIMES_FILE = "./primes.json";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let stats = {
  fermesTotales: "0",
  fermesReprises: "0",
  mods: "0",
  statut: "🟠 En développement (staff only)"
};

let entreprises = [];
let amendes = [];
let primes = [];

let panelMessage = null;
let entreprisesMessage = null;
let servicesMessage = null;
let serviceAlertIntervalStarted = false;

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
  if (fs.existsSync(PRIMES_FILE)) primes = JSON.parse(fs.readFileSync(PRIMES_FILE, "utf8"));
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(stats, null, 2));
  fs.writeFileSync(ENTREPRISES_FILE, JSON.stringify(entreprises, null, 2));
  fs.writeFileSync(AMENDES_FILE, JSON.stringify(amendes, null, 2));
  fs.writeFileSync(PRIMES_FILE, JSON.stringify(primes, null, 2));
}

function parseAmount(value) {
  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const number = Number(cleaned);
  return Number.isNaN(number) ? 0 : number;
}

function formatMoney(value, prefix = "") {
  const amount = parseAmount(value);

  if (!amount) {
    return `${prefix}${value} ${CURRENCY}`;
  }

  return `${prefix}${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2
  }).format(amount)} ${CURRENCY}`;
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

function getNextPrimeNumber() {
  const max = primes.reduce((highest, p) => {
    const n = parseInt(p.numero, 10);
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
    .setTitle("🏢 REGISTRE DES ENTREPRISES")
    .setColor(0x3498db)
    .setDescription(
      `🏢 **Entreprises enregistrées :** \`${entreprises.length}\`\n` +
      `📥 **Recrutements ouverts :** \`${openCount}\`\n\n` +
      `_Les entreprises sont affichées ci-dessous._`
    )
    .setFooter({ text: "Dumax FS25 • Registre officiel des entreprises" })
    .setTimestamp();

  if (entreprises.length === 0) {
    embed.addFields({
      name: "📭 Aucune entreprise",
      value: "```Aucune entreprise enregistrée pour le moment.```",
      inline: false
    });
  } else {
    entreprises.forEach(e => {
      embed.addFields({
        name: `🏛️ ${e.nom}`,
        value:
          `🌾 **Secteur :** ${e.secteur || "Non défini"}\n` +
          `👤 **Patron :** ${e.patron || "Non défini"}\n` +
          `🏷️ **Rôle :** ${e.roleId ? `<@&${e.roleId}>` : "Non défini"}\n` +
          `📥 **Recrutement :** ${e.recrutement || "🟢 Ouvert"}\n` +
          `🚜 **Service :** ${e.service || "🔴 Hors service"}\n` +
          `━━━━━━━━━━━━━━`,
        inline: false
      });
    });
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

  const blocEnService = enService.length
    ? enService.map(e => `${e.nom}`).join("\n")
    : "_Aucune entreprise en service_";

  const blocHorsService = horsService.length
    ? horsService.map(e => `${e.nom}`).join("\n")
    : "_Aucune entreprise hors service_";

  const description =
    `🚜 **Tableau de service des entreprises**\n\n` +
    `🟢 **EN SERVICE**\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${blocEnService}\n\n` +
    `🔴 **HORS SERVICE**\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${blocHorsService}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📘 **UTILISATION**\n` +
    `• \`/service\` → Prendre ou quitter le service\n` +
    `• Les membres du staff peuvent retirer un service si nécessaire\n\n` +
    `📌 _Pensez à quitter le service en fin de session._`;

  const embed = new EmbedBuilder()
    .setTitle("🚜 ━━━━━━━━━━ SERVICES ENTREPRISES ━━━━━━━━━━")
    .setDescription(description)
    .setColor(enService.length > 0 ? 0x2ecc71 : 0xe74c3c)
    .setFooter({ text: "Dumax FS25 • Tableau opérationnel" })
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

async function getServiceRoleMention(guild) {
  await guild.roles.fetch();
  const role = guild.roles.cache.find(r => r.name === SERVICE_ROLE_NAME);
  return role ? `<@&${role.id}>` : "";
}

function startServiceAlertLoop() {
  if (serviceAlertIntervalStarted) return;
  serviceAlertIntervalStarted = true;

  setInterval(async () => {
    const now = Date.now();
    let updated = false;

    for (const e of entreprises) {
      if (
        e.service === "🟢 En service" &&
        e.serviceStart &&
        !e.alertSent &&
        now - e.serviceStart >= 60 * 60 * 1000
      ) {
        const channel = await client.channels.fetch(SERVICES_CHANNEL_ID);
        const mention = await getServiceRoleMention(channel.guild);

        const embed = new EmbedBuilder()
          .setTitle("⏱️ Vérification de service")
          .setDescription(
            `🚜 **${e.nom}** est en service depuis plus d’1 heure.\n\n` +
            `📌 Merci de vérifier que le service est toujours actif.\n` +
            `_Pensez à quitter le service si nécessaire._`
          )
          .setColor(0xf1c40f)
          .setFooter({ text: "Dumax FS25 • Vérification automatique" })
          .setTimestamp();

        await channel.send({ content: mention, embeds: [embed] });

        e.alertSent = true;
        updated = true;
      }
    }

    if (updated) saveData();
  }, 5 * 60 * 1000);
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
      { name: "role", description: "Rôle Discord lié à l’entreprise", type: 8, required: true },
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
    options: [{ name: "numero", description: "Numéro de l’amende à annuler", type: 3, required: true }]
  },
  {
    name: "amendes-historique",
    description: "Afficher l’historique des amendes d’une entreprise",
    type: 1,
    options: [{ name: "entreprise", description: "Entreprise concernée", type: 3, required: true, autocomplete: true }]
  },
  {
    name: "prime",
    description: "Attribuer une prime RP à une entreprise",
    type: 1,
    options: [
      { name: "entreprise", description: "Entreprise concernée", type: 3, required: true, autocomplete: true },
      { name: "montant", description: "Montant de la prime", type: 3, required: true },
      { name: "motif", description: "Motif de la prime", type: 3, required: true }
    ]
  },
  {
    name: "prime-annuler",
    description: "Annuler une prime RP",
    type: 1,
    options: [{ name: "numero", description: "Numéro de la prime à annuler", type: 3, required: true }]
  },
  {
    name: "primes-historique",
    description: "Afficher l’historique des primes d’une entreprise",
    type: 1,
    options: [{ name: "entreprise", description: "Entreprise concernée", type: 3, required: true, autocomplete: true }]
  },
  {
    name: "primes-classement",
    description: "Afficher le classement des entreprises primées",
    type: 1
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
    service: e.service || "🔴 Hors service",
    serviceStart: e.serviceStart || null,
    alertSent: e.alertSent || false,
    roleId: e.roleId || null
  }));

  amendes = amendes.map(a => ({
    ...a,
    statut: a.statut || "ACTIVE"
  }));

  primes = primes.map(p => ({
    ...p,
    statut: p.statut || "ACTIVE"
  }));

  saveData();

  await registerCommands();
  await updatePanel();
  await updateEntreprises();
  await updateServices();

  startServiceAlertLoop();
});

client.on("interactionCreate", async interaction => {
  if (interaction.isAutocomplete()) {
    const focusedValue = interaction.options.getFocused().toLowerCase();

    const choices = entreprises
      .filter(e => e.nom.toLowerCase().includes(focusedValue))
      .slice(0, 25)
      .map(e => ({ name: e.nom, value: e.nom }));

    return interaction.respond(choices);
  }

  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;
  const staff = isStaff(interaction.member);
  const serviceAllowed = isServiceAllowed(interaction.member);

  if (cmd === "service") {
    if (!staff && !serviceAllowed) {
      return interaction.reply({ content: "⛔ Permission refusée.", ephemeral: true });
    }
  } else if (!staff) {
    return interaction.reply({ content: "⛔ Permission refusée.", ephemeral: true });
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

  if (cmd === "fermestotales") stats.fermesTotales = interaction.options.getString("nombre");
  if (cmd === "fermesreprises") stats.fermesReprises = interaction.options.getString("nombre");
  if (cmd === "mods") stats.mods = interaction.options.getString("nombre");

  if (cmd === "entreprise-ajouter") {
    const nom = interaction.options.getString("nom");
    const secteur = interaction.options.getString("secteur");
    const patron = interaction.options.getUser("patron");
    const role = interaction.options.getRole("role");
    const recrutement = interaction.options.getString("recrutement");

    const existe = entreprises.some(e => e.nom.toLowerCase() === nom.toLowerCase());

    if (existe) {
      return interaction.reply({ content: "❌ Cette entreprise existe déjà.", ephemeral: true });
    }

    entreprises.push({
      nom,
      secteur,
      patron: `<@${patron.id}>`,
      roleId: role.id,
      recrutement: recrutement === "open" ? "🟢 Ouvert" : "🔴 Fermé",
      service: "🔴 Hors service",
      serviceStart: null,
      alertSent: false
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

    if (!entreprise) return interaction.reply({ content: "❌ Entreprise introuvable.", ephemeral: true });

    entreprise.recrutement = statut === "open" ? "🟢 Ouvert" : "🔴 Fermé";
  }

  if (cmd === "service" || cmd === "service-forcer") {
    if (cmd === "service-forcer" && !staff) {
      return interaction.reply({ content: "⛔ Seul le staff peut forcer un service.", ephemeral: true });
    }

    const nom = interaction.options.getString("entreprise");
    const statut = interaction.options.getString("statut");
    const entreprise = entreprises.find(e => e.nom.toLowerCase() === nom.toLowerCase());

    if (!entreprise) return interaction.reply({ content: "❌ Entreprise introuvable.", ephemeral: true });

    if (cmd === "service" && !staff) {
      if (!entreprise.roleId) {
        return interaction.reply({
          content: "⛔ Aucun rôle Discord n’est lié à cette entreprise. Contacte le staff.",
          ephemeral: true
        });
      }

      if (!interaction.member.roles.cache.has(entreprise.roleId)) {
        return interaction.reply({
          content: "⛔ Tu ne peux gérer que le service de ton entreprise.",
          ephemeral: true
        });
      }
    }

    if (statut === "on") {
      entreprise.service = "🟢 En service";
      entreprise.serviceStart = Date.now();
      entreprise.alertSent = false;
    } else {
      entreprise.service = "🔴 Hors service";
      entreprise.serviceStart = null;
      entreprise.alertSent = false;
    }

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
    if (!entreprise) return interaction.reply({ content: "❌ Entreprise introuvable.", ephemeral: true });

    const numero = getNextAmendeNumber();
    const date = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

    amendes.push({
      numero,
      entreprise: entreprise.nom,
      patron: entreprise.patron,
      montant,
      motif,
      date,
      agent: interaction.user.tag,
      statut: "ACTIVE"
    });

    saveData();

    const embed = new EmbedBuilder()
      .setTitle(`🏛️ ━━━━━━ NOTIFICATION D’AMENDE ${numero} ━━━━━━`)
      .setDescription(
        `🏢 **Entreprise concernée :** ${entreprise.nom}\n` +
        `👤 **Patron notifié :** ${entreprise.patron}\n` +
        `💰 **Montant :** ${formatMoney(montant)}\n` +
        `📄 **Motif :** ${motif}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ _Amende émise dans le cadre du règlement économique RP par la Banque de France._`
      )
      .setColor(0xe74c3c)
      .setFooter({ text: "Dumax FS25 • Autorité financière RP" })
      .setTimestamp();

    const ch = await client.channels.fetch(AMENDES_CHANNEL_ID);
    await ch.send({ content: entreprise.patron, embeds: [embed] });

    return interaction.reply({ content: `✅ Amende ${numero} envoyée.`, ephemeral: true });
  }

  if (cmd === "amende-annuler") {
    const numero = interaction.options.getString("numero").padStart(4, "0");
    const amende = amendes.find(a => a.numero === numero);

    if (!amende) return interaction.reply({ content: "❌ Amende introuvable.", ephemeral: true });
    if (amende.statut === "ANNULÉE") {
      return interaction.reply({ content: "⚠️ Cette amende est déjà annulée.", ephemeral: true });
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
        `💰 **Montant initial :** ${formatMoney(amende.montant)}\n` +
        `📄 **Motif initial :** ${amende.motif}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ _Cette amende a été annulée par décision administrative de la Banque de France._`
      )
      .setColor(0x95a5a6)
      .setFooter({ text: "Dumax FS25 • Autorité financière RP" })
      .setTimestamp();

    const ch = await client.channels.fetch(AMENDES_CHANNEL_ID);
    await ch.send({ content: amende.patron, embeds: [embed] });

    return interaction.reply({ content: `✅ Amende ${numero} annulée.`, ephemeral: true });
  }

  if (cmd === "amendes-historique") {
    const nom = interaction.options.getString("entreprise");

    const historique = amendes
      .filter(a => a.entreprise.toLowerCase() === nom.toLowerCase())
      .slice(-10)
      .reverse();

    if (!historique.length) {
      return interaction.reply({ content: "📁 Aucune amende enregistrée pour cette entreprise.", ephemeral: true });
    }

    const desc = historique.map(a => {
      const statut = a.statut === "ANNULÉE" ? "❌ ANNULÉE" : "✅ ACTIVE";
      return (
        `**${a.numero}** — ${statut}\n` +
        `📅 ${a.date}\n` +
        `💰 ${formatMoney(a.montant)}\n` +
        `📄 ${a.motif}` +
        (a.statut === "ANNULÉE" ? `\n🕒 Annulée le : ${a.dateAnnulation || "Date inconnue"}` : "")
      );
    }).join("\n\n━━━━━━━━━━━━━━━━━━━━\n\n");

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`📁 Historique des amendes — ${nom}`)
          .setDescription(desc)
          .setColor(0xf1c40f)
          .setFooter({ text: "Dumax FS25 • Historique Banque de France" })
          .setTimestamp()
      ],
      ephemeral: true
    });
  }

  if (cmd === "prime") {
    const nom = interaction.options.getString("entreprise");
    const montant = interaction.options.getString("montant");
    const motif = interaction.options.getString("motif");

    const entreprise = entreprises.find(e => e.nom.toLowerCase() === nom.toLowerCase());
    if (!entreprise) return interaction.reply({ content: "❌ Entreprise introuvable.", ephemeral: true });

    const numero = getNextPrimeNumber();
    const date = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

    primes.push({
      numero,
      entreprise: entreprise.nom,
      patron: entreprise.patron,
      montant,
      motif,
      date,
      agent: interaction.user.tag,
      statut: "ACTIVE"
    });

    saveData();

    const embed = new EmbedBuilder()
      .setTitle(`🏛️ ━━━━━━ ATTRIBUTION DE PRIME ${numero} ━━━━━━`)
      .setDescription(
        `🏢 **Entreprise concernée :** ${entreprise.nom}\n` +
        `👤 **Patron notifié :** ${entreprise.patron}\n` +
        `💰 **Montant :** ${formatMoney(montant, "+")}\n` +
        `📄 **Motif :** ${motif}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📈 _Prime accordée dans le cadre du soutien économique RP par la Banque de France._`
      )
      .setColor(0x2ecc71)
      .setFooter({ text: "Dumax FS25 • Autorité financière RP" })
      .setTimestamp();

    const ch = await client.channels.fetch(PRIMES_CHANNEL_ID);
    await ch.send({ content: entreprise.patron, embeds: [embed] });

    return interaction.reply({ content: `✅ Prime ${numero} envoyée.`, ephemeral: true });
  }

  if (cmd === "prime-annuler") {
    const numero = interaction.options.getString("numero").padStart(4, "0");
    const prime = primes.find(p => p.numero === numero);

    if (!prime) return interaction.reply({ content: "❌ Prime introuvable.", ephemeral: true });
    if (prime.statut === "ANNULÉE") {
      return interaction.reply({ content: "⚠️ Cette prime est déjà annulée.", ephemeral: true });
    }

    prime.statut = "ANNULÉE";
    prime.dateAnnulation = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
    prime.agentAnnulation = interaction.user.tag;

    saveData();

    const embed = new EmbedBuilder()
      .setTitle(`❌ ━━━━━━ ANNULATION DE PRIME ${numero} ━━━━━━`)
      .setDescription(
        `🏢 **Entreprise concernée :** ${prime.entreprise}\n` +
        `👤 **Patron notifié :** ${prime.patron}\n` +
        `💰 **Montant initial :** ${formatMoney(prime.montant, "+")}\n` +
        `📄 **Motif initial :** ${prime.motif}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ _Cette prime a été annulée par décision administrative de la Banque de France._`
      )
      .setColor(0x95a5a6)
      .setFooter({ text: "Dumax FS25 • Autorité financière RP" })
      .setTimestamp();

    const ch = await client.channels.fetch(PRIMES_CHANNEL_ID);
    await ch.send({ content: prime.patron, embeds: [embed] });

    return interaction.reply({ content: `✅ Prime ${numero} annulée.`, ephemeral: true });
  }

  if (cmd === "primes-historique") {
    const nom = interaction.options.getString("entreprise");

    const historique = primes
      .filter(p => p.entreprise.toLowerCase() === nom.toLowerCase())
      .slice(-10)
      .reverse();

    if (!historique.length) {
      return interaction.reply({ content: "📁 Aucune prime enregistrée pour cette entreprise.", ephemeral: true });
    }

    const desc = historique.map(p => {
      const statut = p.statut === "ANNULÉE" ? "❌ ANNULÉE" : "✅ ACTIVE";
      return (
        `**${p.numero}** — ${statut}\n` +
        `📅 ${p.date}\n` +
        `💰 ${formatMoney(p.montant, "+")}\n` +
        `📄 ${p.motif}` +
        (p.statut === "ANNULÉE" ? `\n🕒 Annulée le : ${p.dateAnnulation || "Date inconnue"}` : "")
      );
    }).join("\n\n━━━━━━━━━━━━━━━━━━━━\n\n");

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`📁 Historique des primes — ${nom}`)
          .setDescription(desc)
          .setColor(0x2ecc71)
          .setFooter({ text: "Dumax FS25 • Historique Banque de France" })
          .setTimestamp()
      ],
      ephemeral: true
    });
  }

  if (cmd === "primes-classement") {
    const activePrimes = primes.filter(p => p.statut !== "ANNULÉE");

    if (!activePrimes.length) {
      return interaction.reply({ content: "📁 Aucune prime active enregistrée.", ephemeral: true });
    }

    const classement = {};

    for (const p of activePrimes) {
      const val = parseAmount(p.montant);

      if (!classement[p.entreprise]) {
        classement[p.entreprise] = { total: 0, nombre: 0 };
      }

      classement[p.entreprise].total += val;
      classement[p.entreprise].nombre += 1;
    }

    const desc = Object.entries(classement)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([entreprise, data], index) =>
        `**#${index + 1} — ${entreprise}**\n` +
        `💰 Total : ${formatMoney(data.total)}\n` +
        `📄 Primes actives : ${data.nombre}`
      )
      .join("\n\n━━━━━━━━━━━━━━━━━━━━\n\n");

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏆 ━━━━━━ CLASSEMENT DES PRIMES ━━━━━━")
          .setDescription(desc)
          .setColor(0xf1c40f)
          .setFooter({ text: "Dumax FS25 • Classement Banque de France" })
          .setTimestamp()
      ],
      ephemeral: true
    });
  }

  if (cmd === "maj") {
    await updatePanel();
    await updateEntreprises();
    await updateServices();

    return interaction.reply({ content: "✅ Panels mis à jour.", ephemeral: true });
  }

  saveData();
  await updatePanel();
  await updateEntreprises();
  await updateServices();

  return interaction.reply({ content: "✅ Mise à jour effectuée.", ephemeral: true });
});

client.login(TOKEN);
