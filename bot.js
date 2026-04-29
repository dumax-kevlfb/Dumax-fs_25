const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const { REST } = require("@discordjs/rest");
const fs = require("fs");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const xml2js = require("xml2js");

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

const AMENDES_CHANNEL_ID = "1498021850054266980";
const ENTREPRISES_CHANNEL_ID = "1498040049533456556";
const SERVICES_CHANNEL_ID = "1498067350818738176";
const PRIMES_CHANNEL_ID = "1498064143394148502";
const ABSENCES_CHANNEL_ID = "1498597445758746664";
const ABSENT_ROLE_ID = "1498607458187350017";

const XML_CHANNEL_ID = "1498925367443066930";
const VERYGAMES_XML_URL = "http://si-12625.dg.vg:8080/feed/dedicated-server-stats.xml?code=6bqwp6ka35e99sng7izc3gly1r2h";
const XML_REFRESH_INTERVAL = 60 * 1000;

const STAFF_ROLE_NAME = "━━━ ⚡️ STAFF ━━━";
const SERVICE_ROLE_NAME = "━━━ 🚜 ENTREPRISES AGRICOLES ━━━";
const SERVER_NAME = "Dumax FS25";
const CURRENCY = "€";

const DATA_FILE = "./stats.json";
const ENTREPRISES_FILE = "./entreprises.json";
const AMENDES_FILE = "./amendes.json";
const PRIMES_FILE = "./primes.json";
const SANCTIONS_FILE = "./sanctions.json";
const ABSENCES_FILE = "./absences.json";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

let stats = {
  fermesTotales: "0",
  fermesReprises: "0",
  mods: "0",
  statut: "🟠 En développement (staff only)",
  nomServeur: "Non renseigné",
  mdpServeur: "Non renseigné"
};

let entreprises = [];
let amendes = [];
let primes = [];
let sanctions = [];
let absences = [];

let panelMessage = null;
let entreprisesMessage = null;
let servicesMessage = null;
let absencesPanelMessage = null;
let xmlPanelMessage = null;
let lastXmlPlayers = [];
let serviceAlertIntervalStarted = false;
let veryGamesXmlIntervalStarted = false;

function isStaff(member) {
  if (!member || !member.roles) return false;
  return member.roles.cache.some(r => r.name === STAFF_ROLE_NAME);
}

function isServiceAllowed(member) {
  if (!member || !member.roles) return false;
  return member.roles.cache.some(r => r.name === SERVICE_ROLE_NAME);
}

async function fetchChannelSafe(channelId, label) {
  try {
    if (!channelId || channelId.includes("METTRE_ID")) {
      console.error(`❌ Salon non configuré : ${label}`);
      return null;
    }

    return await client.channels.fetch(channelId);
  } catch (error) {
    console.error(`❌ Salon introuvable ou inaccessible (${label}) : ${channelId}`);
    console.error(error.message);
    return null;
  }
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) stats = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  if (fs.existsSync(ENTREPRISES_FILE)) entreprises = JSON.parse(fs.readFileSync(ENTREPRISES_FILE, "utf8"));
  if (fs.existsSync(AMENDES_FILE)) amendes = JSON.parse(fs.readFileSync(AMENDES_FILE, "utf8"));
  if (fs.existsSync(PRIMES_FILE)) primes = JSON.parse(fs.readFileSync(PRIMES_FILE, "utf8"));
  if (fs.existsSync(SANCTIONS_FILE)) sanctions = JSON.parse(fs.readFileSync(SANCTIONS_FILE, "utf8"));
  if (fs.existsSync(ABSENCES_FILE)) absences = JSON.parse(fs.readFileSync(ABSENCES_FILE, "utf8"));

  stats = {
    fermesTotales: stats.fermesTotales || "0",
    fermesReprises: stats.fermesReprises || "0",
    mods: stats.mods || "0",
    statut: stats.statut || "🟠 En développement (staff only)",
    nomServeur: stats.nomServeur || "Non renseigné",
    mdpServeur: stats.mdpServeur || "Non renseigné"
  };

  if (!Array.isArray(absences)) absences = [];
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(stats, null, 2));
  fs.writeFileSync(ENTREPRISES_FILE, JSON.stringify(entreprises, null, 2));
  fs.writeFileSync(AMENDES_FILE, JSON.stringify(amendes, null, 2));
  fs.writeFileSync(PRIMES_FILE, JSON.stringify(primes, null, 2));
  fs.writeFileSync(SANCTIONS_FILE, JSON.stringify(sanctions, null, 2));
  fs.writeFileSync(ABSENCES_FILE, JSON.stringify(absences, null, 2));
}
function getNextSanctionNumber() {
  const max = sanctions.reduce((highest, s) => {
    const n = parseInt(s.id, 10);
    return Number.isNaN(n) ? highest : Math.max(highest, n);
  }, 0);

  return String(max + 1).padStart(4, "0");
}

function addSanctionHistory({ type, member, userTag, motif, duree, staff }) {
  sanctions.push({
    id: getNextSanctionNumber(),
    userId: member.id,
    userTag: userTag || member.user.tag,
    type,
    motif: motif || "Aucun motif renseigné",
    duree: duree || null,
    staffId: staff.id,
    staffTag: staff.tag,
    date: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
  });

  saveData();
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

  if (!amount) return `${prefix}${value} ${CURRENCY}`;

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

function getMemberEntreprises(member) {
  const staff = isStaff(member);

  if (staff) return entreprises;

  return entreprises.filter(e => {
    if (!e.roleId) return false;
    return member.roles.cache.has(e.roleId);
  });
}

// ===== ABSENCE : GESTION ROLE + PSEUDO =====

async function applyAbsenceStatus(member) {
  if (!member) return;

  try {
    const role = member.guild.roles.cache.get(ABSENT_ROLE_ID);
    if (role && !member.roles.cache.has(role.id)) {
      await member.roles.add(role);
    }
  } catch (error) {
    console.error("Erreur ajout rôle absent :", error.message);
  }

  try {
    const currentName = member.nickname || member.user.username;

    if (!currentName.startsWith("[ABS]")) {
      await member.setNickname(`[ABS] ${currentName}`);
    }
  } catch (error) {
    console.error("Erreur ajout [ABS] pseudo :", error.message);
  }
}

async function removeAbsenceStatus(member) {
  if (!member) return;

  try {
    const role = member.guild.roles.cache.get(ABSENT_ROLE_ID);
    if (role && member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
    }
  } catch (error) {
    console.error("Erreur retrait rôle absent :", error.message);
  }

  try {
    const currentName = member.nickname || member.user.username;

    if (currentName.startsWith("[ABS] ")) {
      await member.setNickname(currentName.replace("[ABS] ", ""));
    } else if (currentName.startsWith("[ABS]")) {
      await member.setNickname(currentName.replace("[ABS]", "").trim());
    }
  } catch (error) {
    console.error("Erreur retrait [ABS] pseudo :", error.message);
  }
}
function createServiceButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("service_button_on")
        .setLabel("Prendre le service")
        .setEmoji("🟢")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("service_button_off")
        .setLabel("Quitter le service")
        .setEmoji("🔴")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("service_button_view")
        .setLabel("Voir les services")
        .setEmoji("📋")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function createServiceSelect(customId, list, placeholder) {
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder)
        .addOptions(
          list.slice(0, 25).map(e => ({
            label: e.nom.slice(0, 100),
            description: e.service === "🟢 En service" ? "Actuellement en service" : "Actuellement hors service",
            value: e.nom.slice(0, 100),
            emoji: e.service === "🟢 En service" ? "🟢" : "🔴"
          }))
        )
    )
  ];
}

function createAbsenceButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("absence_button_declare")
        .setLabel("Déclarer")
        .setEmoji("🟢")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("absence_button_view")
        .setLabel("Voir")
        .setEmoji("🔎")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("absence_button_end")
        .setLabel("Terminer")
        .setEmoji("🔴")
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

function createAbsencePanelEmbed() {
  return new EmbedBuilder()
    .setTitle("📅 Absences")
    .setDescription("Déclarez, consultez ou terminez votre absence avec les boutons ci-dessous.")
    .addFields(
      { name: "🟢 Déclarer", value: "Créer une absence RP.", inline: true },
      { name: "🔎 Voir", value: "Consulter votre absence.", inline: true },
      { name: "🔴 Terminer", value: "Clôturer votre absence.", inline: true }
    )
    .setColor(0x3498db)
    .setFooter({ text: "Dumax FS25 • Gestion des absences" });
}

async function sendAbsencePanelAtBottom(channel) {
  if (absencesPanelMessage) {
    try {
      await absencesPanelMessage.delete();
    } catch (error) {
      console.error("Impossible de supprimer l’ancien panel absence :", error.message);
    }
  }

  absencesPanelMessage = await channel.send({
    embeds: [createAbsencePanelEmbed()],
    components: createAbsenceButtons()
  });

  return absencesPanelMessage;
}

async function updateAbsencePanel() {
  const channel = await fetchChannelSafe(ABSENCES_CHANNEL_ID, "absences");
  if (!channel) return;

  if (!absencesPanelMessage) {
    absencesPanelMessage = await fetchPanelMessage(channel, "Absences");

    if (!absencesPanelMessage) {
      absencesPanelMessage = await channel.send({
        embeds: [createAbsencePanelEmbed()],
        components: createAbsenceButtons()
      });
      return;
    }
  }

  await absencesPanelMessage.edit({
    embeds: [createAbsencePanelEmbed()],
    components: createAbsenceButtons()
  });
}

/* ================================
   PANEL VERYGAMES XML
================================ */

function createXmlEmbed(players, maxPlayers) {
  return new EmbedBuilder()
    .setTitle("🖥️ État du serveur Farming")
    .setDescription(
      `👥 Joueurs en ligne : **${players.length}/${maxPlayers}**\n\n` +
      (players.length
        ? players.map(p => `• ${p}`).join("\n")
        : "_Aucun joueur connecté_")
    )
    .setColor(players.length > 0 ? 0x2ecc71 : 0xe74c3c)
    .setFooter({ text: "Dumax FS25 • Monitoring serveur" })
    .setTimestamp();
}

function createXmlWaitingEmbed() {
  return new EmbedBuilder()
    .setTitle("🖥️ État du serveur Farming")
    .setDescription(
      "⏳ Connexion au serveur VeryGames en cours...\n\n" +
      "_Aucune donnée XML récupérée pour le moment._"
    )
    .setColor(0xf1c40f)
    .setFooter({ text: "Dumax FS25 • Monitoring serveur" })
    .setTimestamp();
}

async function updateXmlPanel(players, maxPlayers) {
  const channel = await fetchChannelSafe(XML_CHANNEL_ID, "xml");
  if (!channel) return;

  if (!xmlPanelMessage) {
    xmlPanelMessage = await fetchPanelMessage(channel, "État du serveur Farming");

    if (!xmlPanelMessage) {
      xmlPanelMessage = await channel.send({
        embeds: [createXmlEmbed(players, maxPlayers)]
      });
      return;
    }
  }

  await xmlPanelMessage.edit({
    embeds: [createXmlEmbed(players, maxPlayers)]
  });
}
function extractXmlData(result) {
  const json = JSON.stringify(result);

  const players = [];

  function scan(obj) {
    if (!obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      for (const item of obj) scan(item);
      return;
    }

    if (obj.$) {
      const possibleName =
        obj.$.name ||
        obj.$.playerName ||
        obj.$.nickname ||
        obj.$.username;

      if (possibleName && !players.includes(possibleName)) {
        players.push(possibleName);
      }
    }

    for (const key of Object.keys(obj)) {
      scan(obj[key]);
    }
  }

  scan(result);

  let maxPlayers = "?";

  const maxMatch =
    json.match(/"maxPlayers":\["?(\d+)"?\]/i) ||
    json.match(/"slots":\["?(\d+)"?\]/i) ||
    json.match(/"capacity":\["?(\d+)"?\]/i);

  if (maxMatch) maxPlayers = maxMatch[1];

  return {
    players,
    maxPlayers
  };
}

async function fetchVeryGamesXmlData() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(VERYGAMES_XML_URL, {
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP XML : ${response.status}`);
    }

    const xml = await response.text();
    const result = await xml2js.parseStringPromise(xml);

    return extractXmlData(result);
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshVeryGamesXml(sendLogs = false) {
  if (
    XML_CHANNEL_ID === "METTRE_ID_DU_SALON_XML_ICI" ||
    VERYGAMES_XML_URL === "METTRE_LIEN_XML_VERYGAMES_ICI"
  ) {
    console.log("⚠️ Monitoring XML non configuré : XML_CHANNEL_ID ou VERYGAMES_XML_URL manquant.");
    return;
  }

  try {
    const { players, maxPlayers } = await fetchVeryGamesXmlData();
    const channel = await fetchChannelSafe(XML_CHANNEL_ID, "xml");
    if (!channel) return;

    await updateXmlPanel(players, maxPlayers);

    if (sendLogs) {
      const joined = players.filter(p => !lastXmlPlayers.includes(p));
      const left = lastXmlPlayers.filter(p => !players.includes(p));

      for (const player of joined) {
        await channel.send(`🟢 **${player}** vient de se connecter au serveur.`);
      }

      for (const player of left) {
        await channel.send(`🔴 **${player}** vient de quitter le serveur.`);
      }
    }

    lastXmlPlayers = players;
  } catch (error) {
    console.error("Erreur monitoring XML VeryGames :", error.message);
  }
}

function startVeryGamesXmlLoop() {
  if (veryGamesXmlIntervalStarted) return;
  veryGamesXmlIntervalStarted = true;

  (async () => {
    const channel = await fetchChannelSafe(XML_CHANNEL_ID, "xml");

    if (channel && !xmlPanelMessage) {
      xmlPanelMessage = await fetchPanelMessage(channel, "État du serveur Farming");

      if (!xmlPanelMessage) {
        xmlPanelMessage = await channel.send({
          embeds: [createXmlWaitingEmbed()]
        });
      }
    }

    await refreshVeryGamesXml(false);
  })();

  setInterval(async () => {
    await refreshVeryGamesXml(true);
  }, XML_REFRESH_INTERVAL);
}
async function updatePanel() {
  const embed = new EmbedBuilder()
    .setTitle("🏛️ ━━ PRÉFECTURE AGRICOLE ━━")
    .setDescription(
      `🏛️ **Serveur : ${SERVER_NAME}**\n` +
      `🌾 _Tableau de suivi officiel du serveur agricole_\n\n` +
      `━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      { name: "📡 STATUT DU SERVEUR", value: `\`\`\`${stats.statut}\`\`\``, inline: false },
      { name: "🖥️ NOM DU SERVEUR", value: `\`\`\`${stats.nomServeur || "Non renseigné"}\`\`\``, inline: false },
      { name: "🔐 MOT DE PASSE", value: `\`\`\`${stats.mdpServeur || "Non renseigné"}\`\`\``, inline: false },
      { name: "🏡 FERMES TOTALES", value: `\`\`\`${stats.fermesTotales}\`\`\``, inline: true },
      { name: "✅ FERMES REPRISES", value: `\`\`\`${stats.fermesReprises}\`\`\``, inline: true },
      { name: "🧩 MODS INSTALLÉS", value: `\`\`\`${stats.mods}\`\`\``, inline: true },
      { name: "━━━━━━━━━━━━━━━━━━━━", value: "📌 _Informations mises à jour par l’équipe staff._", inline: false }
    )
    .setColor(getColorByStatus())
    .setFooter({ text: "Dumax FS25 • Panel officiel" })
    .setTimestamp();

  const channel = await fetchChannelSafe(CHANNEL_ID, "panel principal");
  if (!channel) return;

  if (!panelMessage) {
    panelMessage = await fetchPanelMessage(channel, "PRÉFECTURE AGRICOLE");

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

  const channel = await fetchChannelSafe(ENTREPRISES_CHANNEL_ID, "entreprises");
  if (!channel) return;

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
    ? enService.map(e => `**${e.nom}**`).join("\n")
    : "_Aucune entreprise en service_";

  const blocHorsService = horsService.length
    ? horsService.map(e => `**${e.nom}**`).join("\n")
    : "_Aucune entreprise hors service_";

  const description =
    `🚜 **Tableau de service des entreprises**\n\n` +
    `🟢 **EN SERVICE (${enService.length})**\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${blocEnService}\n\n` +
    `🔴 **HORS SERVICE (${horsService.length})**\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${blocHorsService}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📘 **UTILISATION**\n` +
    `• Utilisez les boutons ci-dessous pour prendre ou quitter le service\n` +
    `• Le staff peut intervenir si nécessaire\n\n` +
    `📌 _Pensez à quitter le service en fin de session._`;

  const embed = new EmbedBuilder()
    .setTitle("📟 ━━━ ENTREPRISES EN SERVICES ━━━")
    .setDescription(description)
    .setColor(enService.length > 0 ? 0x2ecc71 : 0xe74c3c)
    .setFooter({ text: "Dumax FS25 • Tableau opérationnel" })
    .setTimestamp();

  const channel = await fetchChannelSafe(SERVICES_CHANNEL_ID, "services");
  if (!channel) return;

  if (!servicesMessage) {
    servicesMessage = await fetchPanelMessage(channel, "ENTREPRISES EN SERVICES");

    if (!servicesMessage) {
      servicesMessage = await channel.send({
        embeds: [embed],
        components: createServiceButtons()
      });
      return;
    }
  }

  await servicesMessage.edit({
    embeds: [embed],
    components: createServiceButtons()
  });
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
        const channel = await fetchChannelSafe(SERVICES_CHANNEL_ID, "services");
        if (!channel) return;

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
    name: "sanction",
    description: "Appliquer une sanction à un membre",
    type: 1,
    options: [
      {
        name: "type",
        description: "Type de sanction",
        type: 3,
        required: true,
        choices: [
          { name: "Mute", value: "mute" },
          { name: "Unmute", value: "unmute" },
          { name: "Ban", value: "ban" },
          { name: "Kick", value: "kick" },
          { name: "Warn", value: "warn" }
        ]
      },
      { name: "joueur", description: "Joueur concerné", type: 6, required: true },
      { name: "motif", description: "Motif de la sanction", type: 3, required: false },
      { name: "duree", description: "Durée du mute en minutes", type: 4, required: false }
    ]
  },
  {
    name: "sanction-annuler",
    description: "Annuler une sanction du registre",
    type: 1,
    options: [
      { name: "numero", description: "Numéro de la sanction à annuler", type: 3, required: true },
      { name: "motif", description: "Motif de l’annulation", type: 3, required: true }
    ]
  },
  {
    name: "sanctions-historique",
    description: "Afficher l’historique des sanctions d’un joueur",
    type: 1,
    options: [
      { name: "joueur", description: "Joueur concerné", type: 6, required: true }
    ]
  },
  {
    name: "say",
    description: "Faire parler le bot dans le salon actuel",
    type: 1,
    options: [
      {
        name: "message",
        description: "Message à envoyer avec le bot. Utilise \\n pour faire un retour à la ligne.",
        type: 3,
        required: true
      }
    ]
  },
  {
    name: "nomserveur",
    description: "Définir le nom du serveur FS25",
    type: 1,
    options: [
      { name: "nom", description: "Nom du serveur", type: 3, required: true }
    ]
  },
  {
    name: "mdp",
    description: "Définir le mot de passe du serveur FS25",
    type: 1,
    options: [
      { name: "motdepasse", description: "Mot de passe du serveur", type: 3, required: true }
    ]
  },
  {
    name: "absencepanel",
    description: "Installer ou remettre le panneau de gestion des absences",
    type: 1
  },
  {
    name: "serveur-xml-maj",
    description: "Forcer la mise à jour du panel serveur XML",
    type: 1
  },
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

  absences = absences.map(a => ({
    ...a,
    statut: a.statut || "ACTIVE"
  }));

  saveData();

  await registerCommands();
  await updatePanel();
  await updateEntreprises();
  await updateServices();

  if (ABSENCES_CHANNEL_ID !== "ID_DU_SALON_ABSENCE") {
    await updateAbsencePanel();
  }

  startServiceAlertLoop();
  startVeryGamesXmlLoop();
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

  if (interaction.isButton()) {
    const staff = isStaff(interaction.member);
    const serviceAllowed = isServiceAllowed(interaction.member);

    if (
      interaction.customId === "service_button_on" ||
      interaction.customId === "service_button_off"
    ) {
      if (!staff && !serviceAllowed) {
        return interaction.reply({
          content: "⛔ Permission refusée.",
          ephemeral: true
        });
      }

      const userEntreprises = getMemberEntreprises(interaction.member);

      if (!userEntreprises.length) {
        return interaction.reply({
          content: "❌ Aucune entreprise liée à ton rôle.",
          ephemeral: true
        });
      }

      const customId = interaction.customId === "service_button_on"
        ? "service_select_on"
        : "service_select_off";

      const placeholder = interaction.customId === "service_button_on"
        ? "Choisis l’entreprise à mettre en service"
        : "Choisis l’entreprise à mettre hors service";

      return interaction.reply({
        content: "🚜 Sélectionne l’entreprise concernée :",
        components: createServiceSelect(customId, userEntreprises, placeholder),
        ephemeral: true
      });
    }

    if (interaction.customId === "service_button_view") {
      const enService = entreprises.filter(e => e.service === "🟢 En service");
      const horsService = entreprises.filter(e => e.service !== "🟢 En service");

      const blocEnService = enService.length
        ? enService.map(e => `**${e.nom}**`).join("\n")
        : "_Aucune entreprise en service_";

      const blocHorsService = horsService.length
        ? horsService.map(e => `**${e.nom}**`).join("\n")
        : "_Aucune entreprise hors service_";

      const embed = new EmbedBuilder()
        .setTitle("📋 État actuel des services")
        .setDescription(
          `🟢 **EN SERVICE (${enService.length})**\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `${blocEnService}\n\n` +
          `🔴 **HORS SERVICE (${horsService.length})**\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `${blocHorsService}`
        )
        .setColor(enService.length > 0 ? 0x2ecc71 : 0xe74c3c)
        .setFooter({ text: "Dumax FS25 • Consultation service" })
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }
        if (interaction.customId === "absence_button_declare") {
      const activeAbsence = absences.find(a =>
        a.userId === interaction.user.id &&
        a.statut === "ACTIVE"
      );

      if (activeAbsence) {
        return interaction.reply({
          content: "⚠️ Tu as déjà une absence active. Termine ton absence actuelle avant d’en déclarer une nouvelle.",
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId("absence_modal_declare")
        .setTitle("Déclarer une absence");

      const pseudoInput = new TextInputBuilder()
        .setCustomId("pseudo")
        .setLabel("Pseudo")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Exemple : Jean Dupont")
        .setRequired(true)
        .setMaxLength(100);

      const entrepriseInput = new TextInputBuilder()
        .setCustomId("entreprise")
        .setLabel("Entreprise de rattachement")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Exemple : ETA de Pallegney")
        .setRequired(true)
        .setMaxLength(100);

      const dureeInput = new TextInputBuilder()
        .setCustomId("duree")
        .setLabel("Durée de l’absence")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Exemple : 3 jours / 1 semaine / jusqu’au 15 mai")
        .setRequired(true)
        .setMaxLength(100);

      const raisonInput = new TextInputBuilder()
        .setCustomId("raison")
        .setLabel("Raison")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Explique brièvement la raison de ton absence")
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(pseudoInput),
        new ActionRowBuilder().addComponents(entrepriseInput),
        new ActionRowBuilder().addComponents(dureeInput),
        new ActionRowBuilder().addComponents(raisonInput)
      );

      return interaction.showModal(modal);
    }

    if (interaction.customId === "absence_button_view") {
      const activeAbsence = absences.find(a =>
        a.userId === interaction.user.id &&
        a.statut === "ACTIVE"
      );

      if (!activeAbsence) {
        return interaction.reply({
          content: "📭 Tu n’as aucune absence active.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("🔎 Ton absence active")
        .setDescription(
          `👤 **Pseudo :** ${activeAbsence.pseudo}\n` +
          `🏢 **Entreprise :** ${activeAbsence.entreprise}\n` +
          `⏱️ **Durée :** ${activeAbsence.duree}\n` +
          `📝 **Raison :** ${activeAbsence.raison}\n` +
          `📅 **Déclarée le :** ${activeAbsence.date}`
        )
        .setColor(0x3498db)
        .setFooter({ text: "Dumax FS25 • Consultation absence" })
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    if (interaction.customId === "absence_button_end") {
      const activeAbsence = absences.find(a =>
        a.userId === interaction.user.id &&
        a.statut === "ACTIVE"
      );

      if (!activeAbsence) {
        return interaction.reply({
          content: "📭 Tu n’as aucune absence active à terminer.",
          ephemeral: true
        });
      }

      activeAbsence.statut = "TERMINÉE";
      activeAbsence.dateFin = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

      await removeAbsenceStatus(interaction.member);

      saveData();

      const channel = await fetchChannelSafe(ABSENCES_CHANNEL_ID, "absences");
      if (!channel) {
        return interaction.reply({
          content: "✅ Ton absence a bien été terminée, mais le salon absences est introuvable.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("✅ Absence terminée")
        .setDescription(
          `👤 **Pseudo :** ${activeAbsence.pseudo}\n` +
          `🏢 **Entreprise :** ${activeAbsence.entreprise}\n` +
          `📅 **Déclarée le :** ${activeAbsence.date}\n` +
          `✅ **Terminée le :** ${activeAbsence.dateFin}`
        )
        .setColor(0x2ecc71)
        .setFooter({ text: "Dumax FS25 • Fin d’absence" })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      await sendAbsencePanelAtBottom(channel);

      return interaction.reply({
        content: "✅ Ton absence a bien été terminée. Le rôle absent et le préfixe `[ABS]` ont été retirés.",
        ephemeral: true
      });
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (
      interaction.customId === "service_select_on" ||
      interaction.customId === "service_select_off"
    ) {
      const staff = isStaff(interaction.member);
      const serviceAllowed = isServiceAllowed(interaction.member);

      if (!staff && !serviceAllowed) {
        return interaction.reply({
          content: "⛔ Permission refusée.",
          ephemeral: true
        });
      }

      const nom = interaction.values[0];
      const entreprise = entreprises.find(e => e.nom.toLowerCase() === nom.toLowerCase());

      if (!entreprise) {
        return interaction.reply({
          content: "❌ Entreprise introuvable.",
          ephemeral: true
        });
      }

      if (!staff) {
        if (!entreprise.roleId || !interaction.member.roles.cache.has(entreprise.roleId)) {
          return interaction.reply({
            content: "⛔ Tu ne peux gérer que le service de ton entreprise.",
            ephemeral: true
          });
        }
      }

      if (interaction.customId === "service_select_on") {
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

      return interaction.update({
        content: `✅ Service mis à jour pour **${entreprise.nom}** : ${entreprise.service}`,
        components: []
      });
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === "absence_modal_declare") {
      const pseudo = interaction.fields.getTextInputValue("pseudo");
      const entreprise = interaction.fields.getTextInputValue("entreprise");
      const duree = interaction.fields.getTextInputValue("duree");
      const raison = interaction.fields.getTextInputValue("raison");

      const date = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

      absences.push({
        userId: interaction.user.id,
        pseudo,
        entreprise,
        duree,
        raison,
        date,
        statut: "ACTIVE"
      });

      await applyAbsenceStatus(interaction.member);

      saveData();

      const channel = await fetchChannelSafe(ABSENCES_CHANNEL_ID, "absences");

      if (!channel) {
        return interaction.reply({
          content: "✅ Ton absence a été déclarée, mais le salon absences est introuvable.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("📋 Nouvelle absence déclarée")
        .setDescription(
          `👤 **Pseudo :** ${pseudo}\n` +
          `🏢 **Entreprise :** ${entreprise}\n` +
          `⏱️ **Durée :** ${duree}\n` +
          `📝 **Raison :** ${raison}\n` +
          `📅 **Déclarée le :** ${date}`
        )
        .setColor(0xe67e22)
        .setFooter({ text: "Dumax FS25 • Déclaration d’absence" })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      await sendAbsencePanelAtBottom(channel);

      return interaction.reply({
        content: "✅ Ton absence a été déclarée. Le rôle absent et le préfixe `[ABS]` ont été appliqués.",
        ephemeral: true
      });
    }
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

  if (cmd === "say") {
    const raw = interaction.options.getString("message");
    const message = raw.replace(/\\n/g, "\n");

    await interaction.channel.send({ content: message });

    return interaction.reply({
      content: "✅ Message envoyé.",
      ephemeral: true
    });
  }

  if (cmd === "serveur-xml-maj") {
    await interaction.deferReply({ ephemeral: true });

    await refreshVeryGamesXml(true);

    return interaction.editReply({
      content: "✅ Tentative de mise à jour du panel serveur XML effectuée."
    });
  }

  if (cmd === "nomserveur") {
    stats.nomServeur = interaction.options.getString("nom");
  }

  if (cmd === "mdp") {
    stats.mdpServeur = interaction.options.getString("motdepasse");
  }

  if (cmd === "absencepanel") {
    const channel = await fetchChannelSafe(ABSENCES_CHANNEL_ID, "absences");

    if (!channel) {
      return interaction.reply({
        content: "❌ Salon absences introuvable ou inaccessible.",
        ephemeral: true
      });
    }

    await sendAbsencePanelAtBottom(channel);

    return interaction.reply({
      content: "✅ Panel des absences installé.",
      ephemeral: true
    });
  }
    if (cmd === "sanction") {
    const type = interaction.options.getString("type");
    const member = interaction.options.getMember("joueur");
    const motif = interaction.options.getString("motif");
    const duree = interaction.options.getInteger("duree");

    if (!member) return interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });
    if (member.id === interaction.user.id) return interaction.reply({ content: "❌ Tu ne peux pas te sanctionner toi-même.", ephemeral: true });
    if (member.id === client.user.id) return interaction.reply({ content: "❌ Je ne peux pas me sanctionner moi-même.", ephemeral: true });

    if (["mute", "ban", "kick", "warn"].includes(type) && !motif) {
      return interaction.reply({ content: "❌ Tu dois indiquer un motif pour cette sanction.", ephemeral: true });
    }

    try {
      if (type === "mute") {
        if (!duree || duree <= 0) {
          return interaction.reply({ content: "❌ Tu dois indiquer une durée valide en minutes.", ephemeral: true });
        }

        const dureeMs = duree * 60 * 1000;

        if (dureeMs > 28 * 24 * 60 * 60 * 1000) {
          return interaction.reply({ content: "❌ La durée maximale d’un mute Discord est de 28 jours.", ephemeral: true });
        }

        if (!member.moderatable) {
          return interaction.reply({ content: "❌ Impossible de mute ce membre. Vérifie la hiérarchie des rôles.", ephemeral: true });
        }

        await member.timeout(dureeMs, motif);

        addSanctionHistory({
          type: "Mute",
          member,
          motif,
          duree: `${duree} minute(s)`,
          staff: interaction.user
        });

        return interaction.reply({
          content:
            `🔇 **Sanction appliquée**\n\n` +
            `👤 Joueur : ${member}\n` +
            `📌 Type : **Mute**\n` +
            `⏱️ Durée : **${duree} minute(s)**\n` +
            `📄 Motif : **${motif}**\n` +
            `🛡️ Staff : ${interaction.user}`,
          ephemeral: true
        });
      }

      if (type === "unmute") {
        if (!member.moderatable) {
          return interaction.reply({ content: "❌ Impossible d’unmute ce membre. Vérifie la hiérarchie des rôles.", ephemeral: true });
        }

        await member.timeout(null);

        addSanctionHistory({
          type: "Unmute",
          member,
          motif: "Mute levé",
          staff: interaction.user
        });

        return interaction.reply({
          content:
            `🔊 **Sanction levée**\n\n` +
            `👤 Joueur : ${member}\n` +
            `📌 Type : **Unmute**\n` +
            `🛡️ Staff : ${interaction.user}`,
          ephemeral: true
        });
      }

      if (type === "ban") {
        if (!member.bannable) {
          return interaction.reply({ content: "❌ Impossible de bannir ce membre. Vérifie la hiérarchie des rôles.", ephemeral: true });
        }

        const userTag = member.user.tag;
        await member.ban({ reason: motif });

        addSanctionHistory({
          type: "Ban",
          member,
          userTag,
          motif,
          staff: interaction.user
        });

        return interaction.reply({
          content:
            `⛔ **Sanction appliquée**\n\n` +
            `👤 Joueur : **${userTag}**\n` +
            `📌 Type : **Ban**\n` +
            `📄 Motif : **${motif}**\n` +
            `🛡️ Staff : ${interaction.user}`,
          ephemeral: true
        });
      }

      if (type === "kick") {
        if (!member.kickable) {
          return interaction.reply({ content: "❌ Impossible d’expulser ce membre. Vérifie la hiérarchie des rôles.", ephemeral: true });
        }

        const userTag = member.user.tag;
        await member.kick(motif);

        addSanctionHistory({
          type: "Kick",
          member,
          userTag,
          motif,
          staff: interaction.user
        });

        return interaction.reply({
          content:
            `👢 **Sanction appliquée**\n\n` +
            `👤 Joueur : **${userTag}**\n` +
            `📌 Type : **Kick**\n` +
            `📄 Motif : **${motif}**\n` +
            `🛡️ Staff : ${interaction.user}`,
          ephemeral: true
        });
      }

      if (type === "warn") {
        addSanctionHistory({
          type: "Warn",
          member,
          motif,
          staff: interaction.user
        });

        return interaction.reply({
          content:
            `⚠️ **Avertissement appliqué**\n\n` +
            `👤 Joueur : ${member}\n` +
            `📌 Type : **Warn**\n` +
            `📄 Motif : **${motif}**\n` +
            `🛡️ Staff : ${interaction.user}`,
          ephemeral: true
        });
      }
    } catch (error) {
      console.error(error);
      return interaction.reply({ content: "❌ Une erreur est survenue pendant l’application de la sanction.", ephemeral: true });
    }
  }

  if (cmd === "sanction-annuler") {
    const numero = interaction.options.getString("numero").padStart(4, "0");
    const motifAnnulation = interaction.options.getString("motif");

    const index = sanctions.findIndex(s => s.id === numero);

    if (index === -1) {
      return interaction.reply({
        content: "❌ Sanction introuvable.",
        ephemeral: true
      });
    }

    const ancienneSanction = sanctions.splice(index, 1)[0];

    sanctions.push({
      id: getNextSanctionNumber(),
      userId: ancienneSanction.userId,
      userTag: ancienneSanction.userTag,
      type: `Annulation ${ancienneSanction.type}`,
      motif: motifAnnulation,
      duree: null,
      staffId: interaction.user.id,
      staffTag: interaction.user.tag,
      date: new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
      sanctionAnnulee: ancienneSanction.id
    });

    saveData();

    return interaction.reply({
      content:
        `🟢 **Sanction annulée**\n\n` +
        `👤 Joueur : **${ancienneSanction.userTag}**\n` +
        `📌 Sanction annulée : **#${ancienneSanction.id} — ${ancienneSanction.type}**\n` +
        `📄 Motif de l’annulation : **${motifAnnulation}**\n` +
        `🛡️ Staff : ${interaction.user}`,
      ephemeral: true
    });
  }

  if (cmd === "sanctions-historique") {
    const member = interaction.options.getMember("joueur");

    if (!member) return interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });

    const historique = sanctions
      .filter(s => s.userId === member.id)
      .slice(-10)
      .reverse();

    if (!historique.length) {
      return interaction.reply({
        content: `📁 Aucun historique de sanction pour ${member}.`,
        ephemeral: true
      });
    }

    const desc = historique.map(s => (
      `**#${s.id} — ${s.type}**\n` +
      `📅 Date : ${s.date}\n` +
      `👤 Joueur : ${s.userTag}\n` +
      `📄 Motif : ${s.motif}\n` +
      (s.duree ? `⏱️ Durée : ${s.duree}\n` : "") +
      (s.sanctionAnnulee ? `↩️ Sanction initiale annulée : #${s.sanctionAnnulee}\n` : "") +
      `🛡️ Staff : ${s.staffTag}`
    )).join("\n\n━━━━━━━━━━━━━━━━━━━━\n\n");

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`📁 Historique des sanctions — ${member.user.tag}`)
          .setDescription(desc)
          .setColor(0xe67e22)
          .setFooter({ text: "Dumax FS25 • Registre disciplinaire" })
          .setTimestamp()
      ],
      ephemeral: true
    });
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
    if (existe) return interaction.reply({ content: "❌ Cette entreprise existe déjà.", ephemeral: true });

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
        return interaction.reply({ content: "⛔ Aucun rôle Discord n’est lié à cette entreprise.", ephemeral: true });
      }

      if (!interaction.member.roles.cache.has(entreprise.roleId)) {
        return interaction.reply({ content: "⛔ Tu ne peux gérer que le service de ton entreprise.", ephemeral: true });
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

    const ch = await fetchChannelSafe(AMENDES_CHANNEL_ID, "amendes");
    if (ch) await ch.send({ content: entreprise.patron, embeds: [embed] });

    return interaction.reply({ content: `✅ Amende ${numero} envoyée.`, ephemeral: true });
  }

  if (cmd === "amende-annuler") {
    const numero = interaction.options.getString("numero").padStart(4, "0");
    const amende = amendes.find(a => a.numero === numero);

    if (!amende) return interaction.reply({ content: "❌ Amende introuvable.", ephemeral: true });
    if (amende.statut === "ANNULÉE") return interaction.reply({ content: "⚠️ Cette amende est déjà annulée.", ephemeral: true });

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

    const ch = await fetchChannelSafe(AMENDES_CHANNEL_ID, "amendes");
    if (ch) await ch.send({ content: amende.patron, embeds: [embed] });

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

    const ch = await fetchChannelSafe(PRIMES_CHANNEL_ID, "primes");
    if (ch) await ch.send({ content: entreprise.patron, embeds: [embed] });

    return interaction.reply({ content: `✅ Prime ${numero} envoyée.`, ephemeral: true });
  }

  if (cmd === "prime-annuler") {
    const numero = interaction.options.getString("numero").padStart(4, "0");
    const prime = primes.find(p => p.numero === numero);

    if (!prime) return interaction.reply({ content: "❌ Prime introuvable.", ephemeral: true });
    if (prime.statut === "ANNULÉE") return interaction.reply({ content: "⚠️ Cette prime est déjà annulée.", ephemeral: true });

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

    const ch = await fetchChannelSafe(PRIMES_CHANNEL_ID, "primes");
    if (ch) await ch.send({ content: prime.patron, embeds: [embed] });

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

      if (!classement[p.entreprise]) classement[p.entreprise] = { total: 0, nombre: 0 };

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

    if (ABSENCES_CHANNEL_ID !== "ID_DU_SALON_ABSENCE") {
      await updateAbsencePanel();
    }

    await refreshVeryGamesXml(false);

    return interaction.reply({ content: "✅ Panels mis à jour.", ephemeral: true });
  }

  saveData();
  await updatePanel();
  await updateEntreprises();
  await updateServices();

  if (ABSENCES_CHANNEL_ID !== "ID_DU_SALON_ABSENCE") {
    await updateAbsencePanel();
  }

  return interaction.reply({ content: "✅ Mise à jour effectuée.", ephemeral: true });
});

client.login(TOKEN);
