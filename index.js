const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors, REST, Routes, WebhookClient } = require('discord.js');
const { Player } = require("discord-player");

const { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } = require('@discordjs/voice');
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


const data = new Map();
const timers = new Map(); // guildId -> {stopTimeout: timeoutId, idleTimeout: timeoutId, lastActivity: timestamp, commandChannel: channelId}

function getOrdinal(n) {\n  const s = ['th', 'st', 'nd', 'rd'];\n  const v = n % 100;\n  return n + (s[(v - 20) % 10] || s[v] || s[0]);\n}\n\nfunction parseDuration(str) {\n  const num = parseInt(str);\n  if (isNaN(num)) return null;\n  const unit = str.slice(-1).toLowerCase();\n  if (unit === 's') return num * 1000;\n  if (unit === 'm') return num * 60 * 1000;\n  if (unit === 'h' || unit === 'hr') return num * 60 * 60 * 1000;\n  return null;\n}\n\nfunction clearGuildTimer(guildId) {\n  const timer = timers.get(guildId);\n  if (timer) {\n    if (timer.stopTimeout) clearTimeout(timer.stopTimeout);\n    if (timer.idleTimeout) clearTimeout(timer.idleTimeout);\n    timers.delete(guildId);\n  }\n}\n\nfunction fillRecommended(queue) {\n  const lastTrack = queue.history.tracks.first();\n  if (!lastTrack) return;\n  const query = `recommended ${lastTrack.author} songs`;\n  player.search(query).then(result => {\n    if (result.hasTracks) {\n      queue.addTrack(result.tracks[0]);\n      queue.node.skip();\n    }\n  });\n}\n

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

player.events.on('empty', (queue) => {\n      const guildId = queue.guild.id;\n      const timerData = timers.get(guildId);\n      if (timerData) {\n        const channel = client.channels.cache.get(timerData.commandChannel);\n        channel?.send('Music session ended due to inactivity after 15 minutes.');\n      }\n      clearGuildTimer(guildId);\n      setTimeout(() => {\n        const conn = getVoiceConnection(guildId);\n        if (conn) conn.destroy();\n      }, 5000);\n    });

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

    const checkVC = () => {\n      const vc = message.member.voice.channel;\n      if (!vc) {\n        message.reply('Please join a voice channel first!');\n        return false;\n      }\n      if (queue && queue.channel && queue.channel.id !== vc.id) {\n        message.reply("I'm already playing in another voice channel! Switch or stop there first.");\n\n        return false;\n      }\n      return vc;\n    };

    // Update last activity for idle timer\n    const guildId = message.guild.id;\n    let timerData = timers.get(guildId);\n    if (!timerData) {\n      timerData = { lastActivity: Date.now() };\n      timers.set(guildId, timerData);\n    } else {\n      timerData.lastActivity = Date.now();\n    }

    if (['play', 'p'].includes(cmd)) {\n      const query = args.join(' ');\n      if (!query) return message.reply('Please provide a song name or URL!');\n      let vc = message.member.voice.channel;\n      if (!vc) return message.reply('Please join a voice channel first!');\n      if (queue && queue.channel && queue.channel.id !== vc.id) return message.reply("I'm already playing in another voice channel!");\n\n      try {\n        const result = await player.search(query, {\n          requestedBy: message.author\n        });\n        if (!result.hasTracks) return message.reply('No tracks found!');\n\n        await player.play(vc, result, {\n          nodeOptions: {\n            metadata: {\n              channel: message.channel\n            },\n            leaveOnEnd: false,\n            leaveOnEmpty: false,\n            leaveOnFinish: false,\n            volume: 50,\n            selfDeaf: true\n          }\n        });\n        message.reply(`✅ Added ${result.playlist ? result.tracks.length : 1} track(s)`);\n      } catch (e) {\n        message.reply('Failed to play.');\n        console.error(e);\n      }\n      return;\n    }\n\n    if (['join', 'j'].includes(cmd)) {\n      const vc = checkVC();\n      if (vc) {\n        joinVoiceChannel({\n          channelId: vc.id,\n          guildId: message.guild.id,\n          adapterCreator: message.guild.voiceAdapterCreator\n        });\n        message.reply('🔌 Joined VC');\n      }\n      return;\n    }\n\n    if (!queue) {\n      return message.reply('Nothing is playing! Use !play first.');\n    }

    if (!checkVC()) return;\n\n    switch (cmd) {\n      case 'musictimer':\n        const durStr = args.join(' ');\n        const duration = parseDuration(durStr);\n        if (!duration) {\n          return message.reply('Invalid format! Use 10m, 10hr, 10s');\n        }\n        clearGuildTimer(guildId);\n        const stopTimer = setTimeout(() => {\n          const q = player.nodes.get(guildId);\n          if (q) {\n            q.delete();\n            q.metadata.channel?.send('⏰ Music timer ended. Session stopped.');\n          }\n        }, duration);\n        timers.set(guildId, { stopTimeout: stopTimer, lastActivity: Date.now(), commandChannel: message.channel.id });\n        message.reply(`⏰ Music timer set for ${durStr}. Will stop after timer.`);\n        break;\n      case 'pause':
        queue.node.setPaused(true);
        message.reply('⏸️ Paused');
        break;
      case 'resume':
        queue.node.setPaused(false);
        message.reply('▶️ Resumed');
        break;
      case 'stop':
        queue.delete();
        message.reply('⏹️ Stopped music and cleared queue');
        break;
      case 'skip':
      case 's':
        queue.node.skip();
        message.reply('⏭️ Skipped');
        break;
      case 'volume':
      case 'v':
        const vol = parseInt(args[0]);
        if (isNaN(vol) || vol < 0 || vol > 100) return message.reply('Volume must be 0-100');
        queue.node.setVolume(vol / 100);
        message.reply(`🔊 Volume set to ${vol}%`);
        break;
      case 'queue':
      case 'q':
        if (queue.tracks.size === 0) return message.reply('Queue empty');
        const tracks = queue.tracks.toArray().slice(0, 10).map((track, i) => `**${i+1}.** ${track.title} - ${track.author}`).join('\\n');
        const embed = new EmbedBuilder()
          .setTitle(`📜 Queue (${queue.tracks.size} tracks)`)
          .setDescription(tracks + (queue.tracks.size > 10 ? `\\n...and ${queue.tracks.size - 10} more` : ''))
          .setColor(Colors.Blue);
        message.reply({ embeds: [embed] });
        break;
      case 'np':
      case 'nowplaying':
        if (!queue.currentTrack) return message.reply('Nothing playing');
        const curr = queue.currentTrack;
        message.reply(`🎵 **${curr.title}** by **${curr.author}** (${curr.duration})`);
        break;
      case 'leave':
      case 'dc':
      case 'disconnect':
        queue.delete();
        const connection = getVoiceConnection(message.guild.id);
        if (connection) connection.destroy();
        message.reply('👋 Left VC');
        break;
      case 'join':
      case 'j':
        const joinVc = checkVC();
        if (joinVc) {
          joinVoiceChannel({
            channelId: joinVc.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator
          });
          message.reply('🔌 Joined VC');
        }
        break;
      default:
        break;
    }
  }

  // Shut up response
  if (['shut up', 'shutup'].some(p => message.content.toLowerCase().includes(p))) {
    return message.reply('https://i.pinimg.com/474x/ef/7c/80/ef7c800df3e2e4043fae201843b62c9a.jpg');
  }

  // Direct bot mention response (only direct mention, not @everyone or roles)
  if (message.mentions.users.has(client.user.id) && 
      !message.mentions.everyone && 
      !message.mentions.roles.size &&
      message.channel.type === 0 &&
      !message.reference) {
    const response = `Greetings, I am <@${client.user.id}>. My prefix is \`!\` and slash commands. If you have any questions about the operations of this bot, please make a ticket. Have a good day!`;
    const sent = await message.channel.send(response);
    setTimeout(() => sent.delete().catch(() => {}), 10000);
  }

  // Message sent logging 
  if (!message.author.bot && message.channel.id !== LOG_CHANNEL_ID) {
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel && message.channel.id !== LOG_CHANNEL_ID) {
      const timestamp = `<t:${Math.floor(Date.now() / 1000)}:R>`;
      const embed = new EmbedBuilder()
        .setTitle('__Message Logistic__')
        .addFields(
          { name: '`From:`', value: `<@${message.author.id}>`, inline: true },
          { name: '`Their User-ID:`', value: message.author.id, inline: true },
          { name: '`Message Sent:`', value: message.content || '*No text content*', inline: false },
          { name: '`Message Timing:`', value: timestamp, inline: true },
          { name: '`Message ID:`', value: message.id, inline: true },
          { name: '`Channel Location:`', value: `<#${message.channel.id}>`, inline: true }
        )
        .setColor(0x0f9949);
      await logChannel.send({ embeds: [embed] });
    }
  }
});

// Message logging helper
async function logMessage(type, message, oldContent = null) {
  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  const timestamp = `<t:${Math.floor(Date.now() / 1000)}:R>`;
  let embed = new EmbedBuilder().setTitle('# __Message Logistic__');

  if (type === 'sent') {
    embed.addFields(
      { name: '`From:`', value: `<@${message.author.id}>`, inline: true },
      { name: '`Their User-ID:`', value: message.author.id, inline: true },
      { name: '`Message Sent:`', value: message.content || '*No text content*', inline: false },
      { name: '`Message Timing:`', value: timestamp, inline: true },
      { name: '`Message ID:`', value: message.id, inline: true },
      { name: '`Channel Location:`', value: `<#${message.channel.id}>`, inline: true }
    ).setColor(0x0f9949);
  } else if (type === 'edit') {
    embed.addFields(
      { name: '`From:`', value: `<@${message.author.id}>`, inline: true },
      { name: '`Their User-ID:`', value: message.author.id, inline: true },
      { name: '`Previous Message:`', value: oldContent || '*No previous content*', inline: false },
      { name: '`Edited Message:`', value: message.content || '*No new content*', inline: false },
      { name: '`Message Timing:`', value: timestamp, inline: true },
      { name: '`Message ID:`', value: message.id, inline: true },
      { name: '`Channel Location:`', value: `<#${message.channel.id}>`, inline: true }
    ).setColor(0xd2b723);
  } else if (type === 'delete') {
    embed.addFields(
      { name: '`From:`', value: `<@${message.author.id}>`, inline: true },
      { name: '`Their User-ID:`', value: message.author.id, inline: true },
      { name: '`Message Sent:`', value: message.content || '*No text content*', inline: false },
      { name: '`Message Timing:`', value: timestamp, inline: true },
      { name: '`Message ID:`', value: message.id, inline: true },
      { name: '`Channel Location:`', value: `<#${message.channel.id}>`, inline: true }
    ).setColor(0xd23e3e);
  }

  await logChannel.send({ embeds: [embed] });
}

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.author?.bot || newMessage.channel.id === LOG_CHANNEL_ID || oldMessage.content === newMessage.content) return;
  if (newMessage.channel.id === LOG_CHANNEL_ID) return;
  await logMessage('edit', newMessage, oldMessage.content);
});

client.on('messageDelete', async (message) => {
  if (message.author?.bot || message.channel.id === LOG_CHANNEL_ID) return;
  await logMessage('delete', message);
});

client.on('guildMemberAdd', async member => {
  if (member.guild.id !== GUILD_ID) return;

  // General channel welcome after 30 seconds
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

  // Welcome webhook
  if (!welcomeWebhook) return;
  const desc = `> Thank you for joining USSS, ${member.toString()},\n\nThe United States Secret Service is an elite federal agency tasked with the protection of national leaders and the preservation of financial security. Within Liberty County State Roleplay, USSS operates as a highly trained, professional unit focused on protective intelligence, threat mitigation, and high-risk security operations.\n\n> 1. You must read our server-rules listed in <#1480024585280815225>.\n> 2. You must verify with our automation services in ⁠<#1480306233889259691>.\n> 3. In order to learn more about our community, please evaluate our <#1485028060158890094>.\n> 4. If you are ever in need of staff to answer any of your questions, you can create a General Inquiry ticket in ⁠<#1480398372027502652>.\n\nOtherwise, have a fantastic day, and we hope to see you interact with our community events, channels, and features.`;

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
