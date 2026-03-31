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

  // Register slash commands
  const commands = [
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
    new SlashCommandBuilder().setName('requesttraining').setDescription('Request training session')
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
        channel?.send('Music session ended due to inactivity after 15 minutes.');
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

  // Update member count channel every 5 minutes
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

  if (commandName === 'ping') {
    await interaction.reply('Pong!');
    return;
  }

  if (commandName === 'say') {
    const seniorRole = interaction.guild.roles.cache.get(SENIOR_LEADERSHIP_ROLE);
    const juniorRole = interaction.guild.roles.cache.get(JUNIOR_LEADERSHIP_ROLE);
    const hasPermission = interaction.member.roles.cache.has(SENIOR_LEADERSHIP_ROLE) || 
                         interaction.member.roles.cache.has(JUNIOR_LEADERSHIP_ROLE);

    if (!hasPermission) {
      return interaction.reply('You must be Junior Leadership or Senior Leadership at United States Secret Service in order to use this command!');
    }

    const message = interaction.options.getString('message');
    await interaction.deleteReply().catch(() => {});
    await interaction.channel.send(message);
    return;
  }

  if (commandName === 'ban') {
    const user = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id);
    const reason = interaction.options.getString('reason') || 'No reason provided.';
    await member.ban({ reason });
    const embed = new EmbedBuilder()
      .setDescription(`Banned ${member.user.tag} for: ${reason}`)
      .setColor(Colors.Red);
    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (commandName === 'kick') {
    const member = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided.';
    await member.kick(reason);
    const embed = new EmbedBuilder()
      .setDescription(`Kicked ${member.user.tag} for: ${reason}`)
      .setColor(Colors.Orange);
    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (commandName === 'requesttraining') {
    if (interaction.channel.id !== TRAINING_REQ_CHANNEL) {
      return interaction.reply({ content: 'This command can only be used in <#' + TRAINING_REQ_CHANNEL + '>', ephemeral: true });
    }
    if (!interaction.member.roles.cache.has(RECRUIT_ROLE)) {
      return interaction.reply({ content: 'You need the Recruit role to use this command!', ephemeral: true });
    }

    const titleEmbed = new EmbedBuilder()
      .setDescription('# <:USSS:1483911088696459284> __USSS・Training Request__')
      .setColor(3618615);

    const contentEmbed = new EmbedBuilder()
      .setColor(3618615)
      .addFields({
        name: 'ㅤ',
        value: `A new training has been requested by ${interaction.user.toString()}!\n> - All Training Officers are requested to host a session in-game, and publicizing an update in <#1481028950980431994>. \n> - Trainees must wait for a training to be hosted. If no training has been hosted within 1 week or 168 hours, please report this in <#1480398372027502652>, and the Training Command will be disciplined accordingly. \n> - Please briefly review <#1488355130918305862> to enhance your knowledge for the procedures applicable to the Secret Service. `,
        inline: false
      });

    await interaction.deleteReply().catch(() => {});
    await interaction.channel.send({ 
      embeds: [titleEmbed, contentEmbed], 
      content: `<@&${TRAINING_OFFICERS_ROLE}>`,
      username: 'USSS・Training Request',
      avatarURL: 'https://cdn.discordapp.com/attachments/1485045973699792916/1488242126239039498/usss_2.png?ex=69cc10fd&is=69cabf7d&hm=f7da0161fc85a427ddf20d055f4a5f71f86cee469d8402560f5e2d3ce876e346&'
    });
    return;
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot || message.channel.type !== 0) return;

  // Handle prefix commands
  if (message.content === '!requesttraining') {
    if (message.channel.id !== TRAINING_REQ_CHANNEL) {
      return message.reply('This command can only be used in <#' + TRAINING_REQ_CHANNEL + '>').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
    if (!message.member.roles.cache.has(RECRUIT_ROLE)) {
      return message.reply('You need the Recruit role to use this command!').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

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
    const args = message.content.slice(4).trim();
    if (!args) return message.reply('Please provide a message to say.');

    const seniorRole = message.guild.roles.cache.get(SENIOR_LEADERSHIP_ROLE);
    const juniorRole = message.guild.roles.cache.get(JUNIOR_LEADERSHIP_ROLE);
    const hasPermission = message.member.roles.cache.has(SENIOR_LEADERSHIP_ROLE) ||
                         message.member.roles.cache.has(JUNIOR_LEADERSHIP_ROLE);

    if (!hasPermission) {
      const reply = await message.reply("You must be Junior Leadership at United States Secret Service in order to use this command!");
      setTimeout(() => {
        message.delete().catch(() => {});
        reply.delete().catch(() => {});
      }, 5000);
      return;
    }

    await message.delete();
    await message.channel.send(args);
    return;
  }

  // Music commands
  const prefix = '!';
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/\\s+/);
    const cmd = args.shift().toLowerCase();

    const queue = player.nodes.get(message.guild.id);

    const checkVC = () => {
      const vc = message.member.voice.channel;
      if (!vc) {
        message.reply('Please join a voice channel first!');
        return false;
      }
      return vc;
    };

    // Update last activity
    const guildId = message.guild.id;
    let timerData = timers.get(guildId);
    if (!timerData) {
      timerData = { lastActivity: Date.now() };
      timers.set(guildId, timerData);
    } else {
      timerData.lastActivity = Date.now();
    }

    if (['play', 'p'].includes(cmd)) {
      const query = args.join(' ');
      if (!query) return message.reply('Please provide a song name or URL!');
      let vc = message.member.voice.channel;
      if (!vc) return message.reply('Please join a voice channel first!');
      if (queue && queue.channel && queue.channel.id !== vc.id) return message.reply("I'm already playing in another voice channel!");

      try {
        const result = await player.search(query, {
          requestedBy: message.author
        });
        if (!result.hasTracks) return message.reply('No tracks found!');

        await player.play(vc, result, {
          nodeOptions: {
            metadata: {
              channel: message.channel
            },
            leaveOnEnd: false,
            leaveOnEmpty: false,
            volume: 50,
            selfDeaf: true
          }
        });
        message.reply(`✅ Added ${result.playlist ? result.tracks.length : 1} track(s)`);
      } catch (e) {
        message.reply('Failed to play.');
        console.error(e);
      }
      return;
    }

    if (['join', 'j'].includes(cmd)) {
      const vc = checkVC();
      if (vc) {
        joinVoiceChannel({
          channelId: vc.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator
        });
        message.reply('🔌 Joined VC');
      }
      return;
    }

    if (!queue) {
      return message.reply('Nothing is playing! Use !play first.');
    }

    if (!checkVC()) return;

    switch (cmd) {
      case 'pause':
        queue.node.setPaused(true);
        message.reply('⏸️ Paused');
        break;
      case 'resume':
        queue.node.setPaused(false);
        message.reply('▶️ Resumed');
        break;
      case 'stop':
        clearGuildTimer(guildId);
        queue.delete();
        message.reply('⏹️ Stopped & cleared');
        break;
      case 'skip':
      case 's':
        queue.node.skip();
        message.reply('⏭️ Skipped');
        break;
      case 'volume':
      case 'v':
        const vol = parseInt(args[0]);
        if (isNaN(vol) || vol < 0 || vol > 100) return message.reply('Volume 0-100');
        queue.node.setVolume(vol / 100);
        message.reply(`🔊 ${vol}%`);
        break;
      case 'queue':
      case 'q':
        if (queue.tracks.size === 0) return message.reply('Queue empty');
        const tracks = queue.tracks.toArray().slice(0, 10).map((track, i) => `${i+1}. ${track.title} - ${track.author}`).join('\n');
        const embed = new EmbedBuilder()
          .setTitle(`📜 Queue (${queue.tracks.size})`)
          .setDescription(tracks + (queue.tracks.size > 10 ? `\n... +${queue.tracks.size - 10}` : ''))
          .setColor(Colors.Blue);
        message.reply({ embeds: [embed] });
        break;
      case 'np':
      case 'nowplaying':
        if (!queue.currentTrack) return message.reply('Nothing playing');
        const curr = queue.currentTrack;
        message.reply(`🎵 **${curr.title}** by **${curr.author}** (${curr.duration})`);
        break;
      case 'musictimer':
        const durStr = args.join(' ');
        const duration = parseDuration(durStr);
        if (!duration) return message.reply('Format: 10m, 10hr, 10s');
        clearGuildTimer(guildId);
        const stopTimer = setTimeout(() => {
          const q = player.nodes.get(guildId);
          if (q) {
            q.delete();
            q.metadata.channel?.send('⏰ Timer ended. Stopped.');
          }
        }, duration);
        timers.set(guildId, { stopTimeout: stopTimer, lastActivity: Date.now(), commandChannel: message.channel.id });
        message.reply(`⏰ Timer: ${durStr}`);
        break;
      case 'leave':
      case 'dc':
        clearGuildTimer(guildId);
        queue.delete();
        const connection = getVoiceConnection(message.guild.id);
        if (connection) connection.destroy();
        message.reply('👋 Left');
        break;
      default:
        break;
    }
  }

  // Direct mention response
  if (message.mentions.users.has(client.user.id) && !message.mentions.everyone && !message.mentions.roles.size && message.channel.type === 0 && !message.reference) {
    const response = `Hi <@${client.user.id}>. Prefix \`!\`, slash cmds. Questions? Ticket.`;
    const sent = await message.channel.send(response);
    setTimeout(() => sent.delete().catch(() => {}), 10000);
  }

  // Logging
  if (!message.author.bot && message.channel.id !== LOG_CHANNEL_ID) {
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      const timestamp = `<t:${Math.floor(Date.now() / 1000)}:R>`;
      const embed = new EmbedBuilder()
        .setTitle('Message Logistic')
        .addFields(
          { name: 'From', value: `<@${message.author.id}>`, inline: true },
          { name: 'ID', value: message.author.id, inline: true },
          { name: 'Content', value: message.content || '*No content*', inline: false },
          { name: 'Time', value: timestamp, inline: true },
          { name: 'ID', value: message.id, inline: true },
          { name: 'Channel', value: `<#${message.channel.id}>`, inline: true }
        )
        .setColor(0x0f9949);
      logChannel.send({ embeds: [embed] });
    }
  }
});

// Log functions
async function logMessage(type, message, oldContent = null) {
  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;
  const timestamp = `<t:${Math.floor(Date.now() / 1000)}:R>`;
  let embed = new EmbedBuilder().setTitle('Message Logistic');

  if (type === 'sent') {
    embed.addFields(
      { name: 'From', value: `<@${message.author.id}>`, inline: true },
      { name: 'ID', value: message.author.id, inline: true },
      { name: 'Content', value: message.content || '*No content*', inline: false },
      { name: 'Time', value: timestamp, inline: true },
      { name: 'ID', value: message.id, inline: true },
      { name: 'Channel', value: `<#${message.channel.id}>`, inline: true }
    ).setColor(0x0f9949);
  } else if (type === 'edit') {
    embed.addFields(
      { name: 'From', value: `<@${message.author.id}>`, inline: true },
      { name: 'ID', value: message.author.id, inline: true },
      { name: 'Old', value: oldContent || '*None*', inline: false },
      { name: 'New', value: message.content || '*None*', inline: false },
      { name: 'Time', value: timestamp, inline: true },
      { name: 'ID', value: message.id, inline: true },
      { name: 'Channel', value: `<#${message.channel.id}>`, inline: true }
    ).setColor(0xd2b723);
  } else if (type === 'delete') {
    embed.addFields(
      { name: 'From', value: `<@${message.author.id}>`, inline: true },
      { name: 'ID', value: message.author.id, inline: true },
      { name: 'Content', value: message.content || '*No content*', inline: false },
      { name: 'Time', value: timestamp, inline: true },
      { name: 'ID', value: message.id, inline: true },
      { name: 'Channel', value: `<#${message.channel.id}>`, inline: true }
    ).setColor(0xd23e3e);
  }

  logChannel.send({ embeds: [embed] });
}

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.author?.bot || newMessage.channel.id === LOG_CHANNEL_ID || oldMessage.content === newMessage.content) return;
  await logMessage('edit', newMessage, oldMessage.content);
});

client.on('messageDelete', async (message) => {
  if (message.author?.bot || message.channel.id === LOG_CHANNEL_ID) return;
  await logMessage('delete', message);
});

client.on('guildMemberAdd', async member => {
  if (member.guild.id !== GUILD_ID) return;

  setTimeout(async () => {
    const generalChannel = member.guild.channels.cache.get(GENERAL_CHANNEL_ID);
    if (!generalChannel) return;

    await member.guild.members.fetch();
    const humanCount = member.guild.members.cache.filter(m => !m.user.bot).size;
    const ordinal = getOrdinal(humanCount);
    const badge = '<:Welcome0:1485348061617062090><:Welcome1:1485348090520273009><:Welcome2:1485348112527790162><:Welcome3:1485348134090575974><:Welcome4:1485348181888729281><:Welcome5:1485348211001659433>';

    const textMsg = `${badge} Welcome to United States Secret Service, ${member.toString()}!\n > You are our \`${ordinal}\` member. Thanks for joining, and check out <#1485028060158890094> for more information.`;

    await generalChannel.send(textMsg);
  }, 30000);

  if (!welcomeWebhook) return;
  const desc = `> Thank you for joining USSS, ${member.toString()},\\n\\nThe United States Secret Service is an elite federal agency tasked with the protection of national leaders and the preservation of financial security. Within Liberty County State Roleplay, USSS operates as a highly trained, professional unit focused on protective intelligence, threat mitigation, and high-risk security operations.\\n\\n> 1. You must read our server-rules listed in <#1480024585280815225>.\\n> 2. You must verify with our automation services in ⁠<#1480306233889259691>.\\n> 3. In order to learn more about our community, please evaluate our <#1485028060158890094>.\\n> 4. If you are ever in need of staff to answer any of your questions, you can create a General Inquiry ticket in ⁠<#1480398372027502652>.\\n\\nOtherwise, have a fantastic day, and we hope to see you interact with our community events, channels, and features.`;

  const embeds = [
    {
      image: { url: BANNER_URL },
      color: WELCOME_COLOR
    },
    {
      title: 'Welcome to United States Secret Service!',
      description: desc,
      color: WELCOME_COLOR
    },
    {
      image: { url: FOOTER_URL },
      color: WELCOME_COLOR
    }
  ];

  await welcomeWebhook.send({
    embeds,
    username: 'USSS・Welcome',
    avatarUrl: AVATAR_URL
  });
});

client.login(process.env.BOT_TOKEN);
