const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors, REST, Routes, WebhookClient } = require('discord.js');
const { Player } = require("discord-player");
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const express = require('express');

const GUILD_ID = '1478745386586865788';

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
    .setTitle('🎵 Music Commands')
    .setDescription('**Prefix `!` or Slash `/`**')
    .addFields(
      { name: '▶️ Play', value: '`!play <song/URL>` or `/play <song>` - Play/queue songs, playlists', inline: false },
      { name: '⏸️ Pause/Resume', value: '`!pause` `/pause` | `!resume` `/resume`', inline: true },
      { name: '⏹️ Stop', value: '`!stop` `/stop` - Clear queue', inline: true },
      { name: '⏭️ Skip', value: '`!skip` `/skip`', inline: true },
      { name: '🔊 Volume', value: '`!volume <0-100>` `/volume <num>`', inline: true },
      { name: '📜 Queue', value: '`!queue` `/queue` - List tracks', inline: true },
      { name: '🎶 Now Playing', value: '`!np` `/nowplaying`', inline: true },
      { name: '🔌 Join/Leave', value: '`!join` `/join` | `!leave` `/leave`', inline: true },
      { name: '⏰ Timer', value: '`!musictimer <10m>` - Auto-stop', inline: true },
      { name: 'ℹ️ Help', value: 'This message!', inline: true }
    )
    .setColor(Colors.Blurple)
    .setFooter({ text: 'USSS Music Bot' });
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

  // Register ALL slash commands (music + existing)
  const commands = [
    // Existing
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

    // Music slash
    new SlashCommandBuilder().setName('play').setDescription('Play song/URL/playlist')
      .addStringOption(option => option.setName('song').setDescription('Song name or URL').setRequired(true)),
    new SlashCommandBuilder().setName('pause').setDescription('Pause music'),
    new SlashCommandBuilder().setName('resume').setDescription('Resume music'),
    new SlashCommandBuilder().setName('stop').setDescription('Stop & clear queue'),
    new SlashCommandBuilder().setName('skip').setDescription('Skip current song'),
    new SlashCommandBuilder().setName('volume').setDescription('Set volume')
      .addIntegerOption(option => option.setName('volume').setDescription('0-100').setRequired(true)),
    new SlashCommandBuilder().setName('queue').setDescription('Show queue'),
    new SlashCommandBuilder().setName('nowplaying').setDescription('Current song'),
    new SlashCommandBuilder().setName('join').setDescription('Join your VC'),
    new SlashCommandBuilder().setName('leave').setDescription('Leave VC'),
    new SlashCommandBuilder().setName('musictimer').setDescription('Auto-stop timer')
      .addStringOption(option => option.setName('duration').setDescription('10m, 1h, 30s').setRequired(true)),
    new SlashCommandBuilder().setName('help').setDescription('Music help')
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
    console.log('Successfully registered slash commands.');
  } catch (error) {
    console.error(error);
  }

  // Music player setup
  try {
    await player.extractors.loadDefault();
    player.events.on('playerStart', (queue, track) => {
      const channel = queue.metadata.channel;
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setDescription(`▶️ Playing **${track.title}**`)
        .setThumbnail(track.thumbnail ?? null)
        .addFields({ name: 'Author', value: track.author || 'Unknown', inline: true })
        .setFooter({ text: `Duration: ${track.duration}` })
        .setColor(Colors.Green);
      channel.send({ embeds: [embed] });
    });

    player.events.on('trackEnd', (queue) => {
      // discord-player handles next
    });

    player.events.on('empty', (queue) => {
      const guildId = queue.guild.id;
      const timerData = timers.get(guildId);
      if (timerData) {
        const channel = client.channels.cache.get(timerData.commandChannel);
        channel?.send('Music session ended due to inactivity.');
      }
      clearGuildTimer(guildId);
      setTimeout(() => {
        const conn = getVoiceConnection(guildId);
        if (conn) conn.destroy();
      }, 5000);
    });

    player.events.on('error', (queue, error) => {
      console.error('Player error:', error);
      queue.metadata.channel?.send('❌ An error occurred!');
    });

    console.log('✅ Music player initialized!');
  } catch (e) {
    console.error('Player init error:', e);
  }

  // Setup welcome webhook
  const welcomeChannel = client.channels.cache.get(WELCOME_CHANNEL_ID);
  if (welcomeChannel) {
    const webhooks = await welcomeChannel.fetchWebhooks();
    let webhook = webhooks.find(wh => wh.name === 'USSS・Welcome');
    if (!webhook) {
      webhook = await welcomeChannel.createWebhook({ name: 'USSS・Welcome', avatar: AVATAR_URL });
      console.log('Created welcome webhook:', webhook.id);
    }
    welcomeWebhook = new WebhookClient({ id: webhook.id, token: webhook.token });
  }

  // Update member count
  const updateMemberCount = async () => {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;

    await guild.members.fetch();
    const humanCount = guild.members.cache.filter(member => !member.user.bot).size;
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
    if (!vc) {
      interaction.reply({ content: 'Join a voice channel first!', ephemeral: true });
      return false;
    }
    if (queue && queue.channel && queue.channel.id !== vc.id) {
      interaction.reply({ content: "Music playing in different VC!", ephemeral: true });
      return false;
    }
    return vc;
  };

  if (['play'].includes(commandName)) {
    const query = interaction.options.getString('song');
    let voiceChannel = checkVC();
    if (!voiceChannel) return;

    try {
      const result = await player.search(query, { requestedBy: interaction.user });
      if (!result.hasTracks) {
        return interaction.reply('No tracks found!');
      }

      await player.play(voiceChannel, result, {
        nodeOptions: {
          metadata: { channel: interaction.channel },
          leaveOnEnd: false,
          leaveOnEmpty: false,
          volume: 50,
          selfDeaf: true
        }
      });
      interaction.reply(`✅ Added ${result.playlist ? result.tracks.length : 1} track(s)`);
    } catch (e) {
      console.error(e);
      interaction.reply('Failed to play.');
    }
    return;
  }

  if (commandName === 'join') {
    const voiceChannel = checkVC();
    if (voiceChannel) {
      joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator
      });
      interaction.reply('🔌 Joined VC');
    }
    return;
  }

  if (commandName === 'leave') {
    clearGuildTimer(guildId);
    if (queue) queue.delete();
    const connection = getVoiceConnection(guildId);
    if (connection) connection.destroy();
    interaction.reply('👋 Left VC');
    return;
  }

  if (!queue) {
    interaction.reply({ content: 'Nothing playing. Use /play first.', ephemeral: true });
    return;
  }

  if (!checkVC()) return;

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
      interaction.reply('⏹️ Stopped & cleared');
      break;
    case 'skip':
      queue.node.skip();
      interaction.reply('⏭️ Skipped');
      break;
    case 'volume':
      const vol = interaction.options.getInteger('volume');
      if (vol < 0 || vol > 100) {
        interaction.reply('Volume 0-100', { ephemeral: true });
      } else {
        queue.node.setVolume(vol / 100);
        interaction.reply(`🔊 Volume: ${vol}%`);
      }
      break;
    case 'queue':
      if (queue.tracks.size === 0) {
        interaction.reply('Queue empty');
      } else {
        const tracks = queue.tracks.toArray().slice(0, 10).map((track, i) => `${i+1}. ${track.title} - ${track.author}`).join('\n');
        const embed = new EmbedBuilder()
          .setTitle(`📜 Queue (${queue.tracks.size})`)
          .setDescription(tracks + (queue.tracks.size > 10 ? `\n... +${queue.tracks.size - 10}` : ''))
          .setColor(Colors.Blue);
        interaction.reply({ embeds: [embed] });
      }
      break;
    case 'nowplaying':
      if (!queue.currentTrack) {
        interaction.reply('Nothing playing');
      } else {
        const curr = queue.currentTrack;
        interaction.reply(`🎵 **${curr.title}** by **${curr.author}** (${curr.duration})`);
      }
      break;
    case 'musictimer':
      const durStr = interaction.options.getString('duration');
      const duration = parseDuration(durStr);
      if (!duration) {
        interaction.reply('Format: 10m, 1h, 30s', { ephemeral: true });
      } else {
        clearGuildTimer(guildId);
        const stopTimer = setTimeout(() => {
          const q = player.nodes.get(guildId);
          if (q) {
            q.delete();
            q.metadata.channel?.send('⏰ Timer ended.');
          }
        }, duration);
        timers.set(guildId, { stopTimeout: stopTimer, commandChannel: interaction.channel.id });
        interaction.reply(`⏰ Timer set: ${durStr}`);
      }
      break;
    case 'help':
      interaction.reply({ embeds: [getHelpEmbed()] });
      break;
    default:
      interaction.reply({ content: 'Unknown command', ephemeral: true });
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot || message.channel.type !== 0) return;

  if (message.content === '!help' || message.content === '!heko') {
    message.reply({ embeds: [getHelpEmbed()] });
    return;
  }

  // Prefix music (legacy)
  const prefix = '!';
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/\\s+/);
    const cmd = args.shift().toLowerCase();

    // Redirect to slash logic or handle legacy
    message.reply('Use /commands for music! Type `/help`');
    return;
  }

  // Existing non-music
  if (message.content === '!requesttraining') {
    // ... existing code
    const titleEmbed = new EmbedBuilder()
      .setDescription('# <:USSS:1483911088696459284> __USSS・Training Request__')
      .setColor(3618615);

    const contentEmbed = new EmbedBuilder()
      .setColor(3618615)
      .addFields({
        name: 'ㅤ',
        value: `A new training has been requested by ${message.author.toString()}!\n> - All Training Officers are requested to host a session in-game, and publicizing an update in <#1481028950980431994>. \n> - Trainees must wait for a training to be hosted. If no training has been hosted within 1 week or 168 hours, please report this in <#1480398372027502652>, and the Training Command will be disciplined accordingly. \n> - Please briefly review <#1488355130918305862> to enhance your knowledge for the procedures applicable to the Secret Service. `,
        inline: false
      });

    await message.delete();
    await message.channel.send({ 
      embeds: [titleEmbed, contentEmbed], 
      content: `<@&${TRAINING_OFFICERS_ROLE}>`,
      username: 'USSS・Training Request',
      avatarURL: 'https://cdn.discordapp.com/attachments/1485045973699792916/1488242126239039498/usss_2.png?ex=69cc10fd&is=69cabf7d&hm=f7da0161fc85a427ddf20d055f4a5f71f86cee469d8402560f5e2d3ce876e346&'
    });
    return;
  }

  if (message.content.startsWith('!say')) {
    // ... existing say code
  }

  // Mention response + logging (existing)
});

client.login(process.env.BOT_TOKEN);
