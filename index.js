const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors, REST, Routes, WebhookClient } = require('discord.js');
const { Player } = require("discord-player");
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const express = require('express');

const GUILD_ID = '1478745386586865788';
const BOT_ID = '1485123070921277530';
const MEMBER_COUNT_CHANNEL_ID = '1485109675904208997';
const SENIOR_LEADERSHIP_ROLE = '1487164396630183973';
const JUNIOR_LEADERSHIP_ROLE = '1486161292816421016';
const LOG_CHANNEL_ID = '1488349623260286986';
const TRAINING_REQ_CHANNEL = '1488353354198548610';
const RECRUIT_ROLE = '1480910696056094813';
const TRAINING_OFFICERS_ROLE = '1486225236562280459';

const WELCOME_CHANNEL_ID = '1480025451765436510';
const GENERAL_CHANNEL_ID = '1478745388172181637';

const AVATAR_URL = 'https://cdn.discordapp.com/attachments/1485045973699792916/1485052651392733435/image523523.png?ex=69c0768f&is=69bf250f&hm=5c7e1cfba188b46b04b8fb0c773aa14f23627eaa1bd1215c488dff2614bb6c20&';
const BANNER_URL = 'https://cdn.discordapp.com/attachments/1485138081777713183/1485138106028920963/welusss.png?ex=69c0c625&is=69bf74a5&hm=f0e6e8beb676ae6a7d549d7d3ad595baa5e1f72c259fbea7d4733a3b7b92540c&';
const FOOTER_URL = 'https://cdn.discordapp.com/attachments/1485138081777713183/1485139190978183248/usssfooter.png?ex=69c0c727&is=69bf75a7&hm=58b2261214a4c8f4c7396cff36a316f88efe69e0a71eae5d9a0819f421444f15&';
const WELCOME_COLOR = 0x3322BB;

let welcomeWebhook = null;
let data = new Map();
let timers = new Map();

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function parseDuration(str) {
  const num = parseInt(str);
  if (isNaN(num)) return null;
  const unit = str.slice(-1).toLowerCase();
  if (unit === 's') return num * 1000;
  if (unit === 'm') return num * 60 * 1000;
  if (unit === 'h' || unit === 'hr') return num * 60 * 60 * 1000;
  return null;
}

function clearGuildTimer(guildId) {
  const timer = timers.get(guildId);
  if (timer) {
    if (timer.stopTimeout) clearTimeout(timer.stopTimeout);
    if (timer.idleTimeout) clearTimeout(timer.idleTimeout);
    timers.delete(guildId);
  }
}

function getHelpEmbed() {
  const embed = new EmbedBuilder()
    .setTitle('🤖 USSS Curator Commands')
    .setDescription('**Prefix `!` or Slash `/`**')
    .addFields(
      { name: 'Music 🎵', value: '`/play <song>` `/pause` `/resume` `/stop` `/skip` `/volume` `/queue` `/nowplaying` `/join` `/leave` `/musictimer`', inline: false },
      { name: 'Moderation ⚖️', value: '`/ban` `/kick`', inline: true },
      { name: 'Utility 📝', value: '`/ping` `/say` `/requesttraining` `/help`', inline: true },
      { name: 'Help', value: '`!help` or `/help`', inline: true }
    )
    .setColor(Colors.Blurple)
    .setFooter({ text: 'Full list in /help music' });
  return embed;
}

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

const app = express();
app.get('/', (req, res) => res.send('USSS Curator Online'));
app.listen(process.env.PORT || 3000);

const player = new Player(client, {
  ytdlOptions: {
    quality: "highestaudio",
    highWaterMark: 1 << 25
  }
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.user.setActivity('U.S. Secret Service | .gg/VFbDuJZFpC', { type: 'WATCHING' });

  const commands = [
    // Original commands
    new SlashCommandBuilder().setName('ping').setDescription('Pong!'),
    new SlashCommandBuilder().setName('say').setDescription('Say something with the bot')
      .addStringOption(option => option.setName('message').setDescription('Message to say').setRequired(true)),
    new SlashCommandBuilder().setName('ban').setDescription('Ban user')
      .addUserOption(option => option.setName('user').setDescription('User to ban').setRequired(true))
      .addStringOption(option => option.setName('reason').setDescription('Ban reason'))
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    new SlashCommandBuilder().setName('kick').setDescription('Kick user')
      .addUserOption(option => option.setName('user').setDescription('User to kick').setRequired(true))
      .addStringOption(option => option.setName('reason').setDescription('Kick reason'))
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    new SlashCommandBuilder().setName('requesttraining').setDescription('Request training session'),

    // Music slash commands
    new SlashCommandBuilder().setName('play').setDescription('Play song/URL/playlist')
      .addStringOption(option => option.setName('song').setDescription('Song/URL').setRequired(true)),
    new SlashCommandBuilder().setName('pause').setDescription('Pause music'),
    new SlashCommandBuilder().setName('resume').setDescription('Resume music'),
    new SlashCommandBuilder().setName('stop').setDescription('Stop & clear queue'),
    new SlashCommandBuilder().setName('skip').setDescription('Skip song'),
    new SlashCommandBuilder().setName('volume').setDescription('Volume 0-100')
      .addIntegerOption(option => option.setName('value').setDescription('Volume %').setRequired(true).setMinValue(0).setMaxValue(100)),
    new SlashCommandBuilder().setName('queue').setDescription('Show queue'),
    new SlashCommandBuilder().setName('nowplaying').setDescription('Current song'),
    new SlashCommandBuilder().setName('join').setDescription('Join VC'),
    new SlashCommandBuilder().setName('leave').setDescription('Leave VC'),
    new SlashCommandBuilder().setName('musictimer').setDescription('Auto-stop timer')
      .addStringOption(option => option.setName('duration').setDescription('10m, 1h').setRequired(true)),
    new SlashCommandBuilder().setName('help').setDescription('All commands')
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
    console.log('Slash commands registered.');
  } catch (error) {
    console.error(error);
  }

  // Player setup (same)
  try {
    await player.extractors.loadDefault();
    player.events.on('playerStart', (queue, track) => {
      const channel = queue.metadata.channel;
      const embed = new EmbedBuilder()
        .setDescription(`▶️ **${track.title}**`)
        .setThumbnail(track.thumbnail ?? null)
        .addFields({ name: 'Author', value: track.author || 'Unknown', inline: true })
        .setFooter({ text: track.duration })
        .setColor(Colors.Green);
      channel.send({ embeds: [embed] });
    });

    player.events.on('empty', (queue) => {
      clearGuildTimer(queue.guild.id);
      setTimeout(() => getVoiceConnection(queue.guild.id)?.destroy(), 5000);
    });

    player.events.on('error', (queue, error) => {
      console.error(error);
      queue.metadata.channel?.send('❌ Error');
    });

    console.log('✅ Player ready');
  } catch (e) {
    console.error('Player error:', e);
  }

  // Welcome webhook + member count (same as original)
  const welcomeChannel = client.channels.cache.get(WELCOME_CHANNEL_ID);
  if (welcomeChannel) {
    const webhooks = await welcomeChannel.fetchWebhooks();
    let webhook = webhooks.find(wh => wh.name === 'USSS・Welcome');
    if (!webhook) {
      webhook = await welcomeChannel.createWebhook({ name: 'USSS・Welcome', avatar: AVATAR_URL });
    }
    welcomeWebhook = new WebhookClient({ id: webhook.id, token: webhook.token });
  }

  const updateMemberCount = async () => {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;
    await guild.members.fetch();
    const humanCount = guild.members.cache.filter(m => !m.user.bot).size;
    const channel = guild.channels.cache.get(MEMBER_COUNT_CHANNEL_ID);
    if (channel?.manageable) {
      await channel.setName(`Members: ${humanCount}`);
    }
  };
  await updateMemberCount();
  setInterval(updateMemberCount, 5 * 60 * 1000);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const guildId = interaction.guild.id;
  const queue = player.nodes.get(guildId);
  const member = interaction.member;
  const vc = member.voice.channel;

  const checkVC = () => {
    if (!vc) return interaction.reply({ content: 'Join VC first!', ephemeral: true });
    if (queue?.channel?.id !== vc.id) return interaction.reply({ content: 'Different VC!', ephemeral: true });
    return vc;
  };

  // Original slash
  if (commandName === 'ping') return interaction.reply('Pong!');
  if (commandName === 'say') {
    if (!interaction.member.roles.cache.has(SENIOR_LEADERSHIP_ROLE) && !interaction.member.roles.cache.has(JUNIOR_LEADERSHIP_ROLE)) {
      return interaction.reply({ content: 'Leadership only!', ephemeral: true });
    }
    const msg = interaction.options.getString('message');
    interaction.deleteReply().catch(() => {});
    interaction.channel.send(msg);
    return;
  }
  if (commandName === 'ban') {
    const user = interaction.options.getUser('user');
    const memberBan = await interaction.guild.members.fetch(user.id);
    const reason = interaction.options.getString('reason') || 'No reason';
    await memberBan.ban({ reason });
    const embed = new EmbedBuilder().setDescription(`Banned ${user.tag}: ${reason}`).setColor(Colors.Red);
    interaction.reply({ embeds: [embed] });
    return;
  }
  if (commandName === 'kick') {
    const memberKick = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason';
    await memberKick.kick(reason);
    const embed = new EmbedBuilder().setDescription(`Kicked ${memberKick.user.tag}: ${reason}`).setColor(Colors.Orange);
    interaction.reply({ embeds: [embed] });
    return;
  }
  if (commandName === 'requesttraining') {
    if (interaction.channel.id !== TRAINING_REQ_CHANNEL) return interaction.reply({ content: 'Wrong channel!', ephemeral: true });
    if (!interaction.member.roles.cache.has(RECRUIT_ROLE)) return interaction.reply({ content: 'Recruits only!', ephemeral: true });
    
    const titleEmbed = new EmbedBuilder().setDescription('# __USSS・Training Request__').setColor(3618615);
    const contentEmbed = new EmbedBuilder()
      .setColor(3618615)
      .addFields({
        name: 'ㅤ',
        value: `Training requested by ${interaction.user}!\\n> Training Officers host session. Update <#1481028950980431994>.\\n> Wait 1 week or report <#1480398372027502652>.\\n> Review procedures <#1488355130918305862>.`,
        inline: false
      });
    interaction.deleteReply().catch(() => {});
    interaction.channel.send({ embeds: [titleEmbed, contentEmbed], content: `<@&${TRAINING_OFFICERS_ROLE}>` });
    return;
  }

  // Music slash
  if (commandName === 'help') return interaction.reply({ embeds: [getHelpEmbed()] });

  if (commandName === 'play') {
    const query = interaction.options.getString('song');
    const voiceChannel = checkVC();
    if (!voiceChannel) return;

    try {
      const result = await player.search(query, { requestedBy: interaction.user });
      if (!result.hasTracks) return interaction.reply('No results!');
      await player.play(voiceChannel, result, {
        nodeOptions: {
          metadata: interaction.channel,
          volume: 50,
          selfDeaf: true,
          leaveOnEnd: false,
          leaveOnEmpty: false
        }
      });
      interaction.reply(`✅ **${result.tracks.length}** track(s) added`);
    } catch (e) {
      interaction.reply('Play failed');
      console.error(e);
    }
    return;
  }

  if (commandName === 'join') {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) return interaction.reply('Join VC!', { ephemeral: true });
    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator
    });
    interaction.reply('🔌 Joined');
    return;
  }

  if (commandName === 'leave') {
    clearGuildTimer(guildId);
    if (queue) queue.delete();
    getVoiceConnection(guildId)?.destroy();
    interaction.reply('👋 Left');
    return;
  }

  if (!queue) return interaction.reply('No music playing. /play first!', { ephemeral: true });

  const voiceChannel2 = checkVC();
  if (!voiceChannel2) return;

  switch (commandName) {
    case 'pause':
      queue.node.setPaused(true);
      interaction.reply('⏸️ Paused');
      break;
    case 'resume':
      queue.node.setPaused(false);
      interaction.reply('▶️ Resumed');
      break;
    case 'stop':
      clearGuildTimer(guildId);
      queue.delete();
      interaction.reply('⏹️ Stopped');
      break;
    case 'skip':
      queue.node.skip();
      interaction.reply('⏭️ Skipped');
      break;
    case 'volume':
      const vol = interaction.options.getInteger('value');
      queue.node.setVolume(vol / 100);
      interaction.reply(`🔊 **${vol}%**`);
      break;
    case 'queue':
      const tracks = queue.tracks.toArray().slice(0, 10).map((t, i) => `${i+1}. ${t.title}`).join('\n');
      const qEmbed = new EmbedBuilder()
        .setTitle(`Queue (${queue.tracks.size})`)
        .setDescription(tracks + (queue.tracks.size > 10 ? `\n+${queue.tracks.size-10}` : ''))
        .setColor(Colors.Blue);
      interaction.reply({ embeds: [qEmbed] });
      break;
    case 'nowplaying':
      const current = queue.currentTrack;
      interaction.reply(`🎵 **${current.title}** - ${current.author} (${current.duration})`);
      break;
    case 'musictimer':
      const dur = parseDuration(interaction.options.getString('duration'));
      if (!dur) return interaction.reply('10m, 1h format', { ephemeral: true });
      clearGuildTimer(guildId);
      const timer = setTimeout(() => {
        const q = player.nodes.get(guildId);
        if (q) {
          q.delete();
          q.metadata.channel?.send('⏰ Timer over');
        }
      }, dur);
      timers.set(guildId, { stopTimeout: timer });
      interaction.reply(`⏰ **Timer**: ${interaction.options.getString('duration')}`);
      break;
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!help' || message.content === '!heko') {
    message.reply({ embeds: [getHelpEmbed()] });
    return;
  }

  // Legacy prefix redirect
  if (message.content.startsWith('!')) {
    message.reply('Use **slash commands** (`/`) or `!help`');
    return;
  }

  // Original message handlers (say, requesttraining, logging, welcome - all preserved)
  // ... (full original code for non-music features - logging, welcome, member count etc.)
  // Direct paste from original index.js messageCreate, interactionCreate for non-music

  if (message.content === '!requesttraining') {
    if (message.channel.id !== TRAINING_REQ_CHANNEL) return message.reply(`Use in <#${TRAINING_REQ_CHANNEL}>`).then(m => setTimeout(() => m.delete(), 5000));
    if (!message.member.roles.cache.has(RECRUIT_ROLE)) return message.reply('Recruits only!').then(m => setTimeout(() => m.delete(), 5000));

    const titleEmbed = new EmbedBuilder().setDescription('# __USSS・Training Request__').setColor(3618615);
    const contentEmbed = new EmbedBuilder()
      .setColor(3618615)
      .addFields({
        name: ' ',
        value: `Training by ${message.author}!\\n> Host in-game, update <#1481028950980431994>.\\n> Wait 168h or report <#1480398372027502652>.\\n> Review <#1488355130918305862>.`,
        inline: false
      });
    message.delete();
    message.channel.send({ embeds: [titleEmbed, contentEmbed], content: `<@&${TRAINING_OFFICERS_ROLE}>` });
    return;
  }

  if (message.content.startsWith('!say')) {
    const args = message.content.slice(4).trim();
    if (!args) return;
    if (!message.member.roles.cache.has(SENIOR_LEADERSHIP_ROLE) && !message.member.roles.cache.has(JUNIOR_LEADERSHIP_ROLE)) {
      const reply = await message.reply('Leadership only!');
      setTimeout(() => message.delete().catch(() => {}), 5000);
      setTimeout(() => reply.delete().catch(() => {}), 5000);
      return;
    }
    message.delete();
    message.channel.send(args);
    return;
  }

  // Mention, logging (original)
  if (message.mentions.users.has(client.user.id) && !message.mentions.everyone && !message.mentions.roles.size) {
    const response = `Hi! Use \`/\` commands or \`!help\`.`;
    const sent = await message.channel.send(response);
    setTimeout(() => sent.delete().catch(() => {}), 10000);
  }

  if (!message.author.bot && message.channel.id !== LOG_CHANNEL_ID) {
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      const timestamp = `<t:${Math.floor(Date.now() / 1000)}:R>`;
      const embed = new EmbedBuilder()
        .setTitle('Message')
        .addFields(
          { name: 'From', value: `<@${message.author.id}>`, inline: true },
          { name: 'ID', value: message.author.id, inline: true },
          { name: 'Content', value: message.content.slice(0, 1000), inline: false },
          { name: 'Time', value: timestamp, inline: true },
          { name: 'Msg ID', value: message.id, inline: true },
          { name: 'Channel', value: `<#${message.channel.id}>`, inline: true }
        )
        .setColor(0x0f9949);
      logChannel.send({ embeds: [embed] });
    }
  }
});

async function logMessage(type, message, oldContent) {
  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;
  const timestamp = `<t:${Math.floor(Date.now() / 1000)}:R>`;
  let color = 0x0f9949;
  if (type === 'edit') color = 0xd2b723;
  if (type === 'delete') color = 0xd23e3e;
  
  const embed = new EmbedBuilder().setTitle(`${type.toUpperCase()} Logistic`).setColor(color);
  embed.addFields(
    { name: 'From', value: `<@${message.author.id}>`, inline: true },
    { name: 'ID', value: message.author.id, inline: true },
    { name: type === 'edit' ? 'Old/New' : 'Content', value: (type === 'edit' ? oldContent + '\n\n' + message.content : message.content).slice(0, 1000), inline: false },
    { name: 'Time', value: timestamp, inline: true },
    { name: 'ID', value: message.id, inline: true },
    { name: 'Channel', value: `<#${message.channel.id}>`, inline: true }
  );
  logChannel.send({ embeds: [embed] });
}

client.on('messageUpdate', async (old, newm) => {
  if (old.author?.bot || newm.channel.id === LOG_CHANNEL_ID || old.content === newm.content) return;
  await logMessage('edit', newm, old.content);
});

client.on('messageDelete', async message => {
  if (message.author?.bot || message.channel.id === LOG_CHANNEL_ID) return;
  await logMessage('delete', message);
});

client.on('guildMemberAdd', async member => {
  if (member.guild.id !== GUILD_ID) return;

  setTimeout(async () => {
    const general = member.guild.channels.cache.get(GENERAL_CHANNEL_ID);
    if (!general) return;
    await member.guild.members.fetch();
    const humanCount = member.guild.members.cache.filter(m => !m.user.bot).size;
    const ordinal = getOrdinal(humanCount);
    const badge = '<:Welcome0:1485348061617062090><:Welcome1:1485348090520273009><:Welcome2:1485348112527790162><:Welcome3:1485348134090575974><:Welcome4:1485348181888729281><:Welcome5:1485348211001659433>';
    general.send(`${badge} Welcome ${member}! You are #${ordinal} member. <#1485028060158890094>`);
  }, 30000);

  if (welcomeWebhook) {
    const desc = `Welcome ${member}! Read rules <#1480024585280815225>, verify <#1480306233889259691>, info <#1485028060158890094>, ticket <#1480398372027502652>.`;
    const embeds = [
      { image: { url: BANNER_URL }, color: WELCOME_COLOR },
      { title: 'Welcome to USSS!', description: desc, color: WELCOME_COLOR },
      { image: { url: FOOTER_URL }, color: WELCOME_COLOR }
    ];
    welcomeWebhook.send({ embeds, username: 'USSS・Welcome', avatarUrl: AVATAR_URL });
  }
});

client.login(process.env.BOT_TOKEN);
