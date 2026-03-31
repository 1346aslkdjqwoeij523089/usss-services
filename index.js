const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors, REST, Routes, WebhookClient } = require('discord.js');
const { Player } = require("discord-player");
const { useQueue } = require("discord-player");
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

let welcomeWebhook = null;
const data = new Map();

const player = new Player(client, {
  ytdlOptions: {
    quality: "highestaudio",
    highWaterMark: 1 << 25
  }
});

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
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
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });\n    console.log('Successfully registered slash commands.');\n  } catch (error) {\n    console.error(error);\n  }\n\n  // Music player setup\n  try {\n    await player.extractors.loadDefault();\n    player.events.on('playerStart', (queue, track) => {\n      const channel = queue.metadata.channel;\n      if (!channel) return;\n\n      const embed = new EmbedBuilder()\n        .setDescription(`▶️ Playing **${track.title}**`)\n        .setThumbnail(track.thumbnail ?? null)\n        .addFields({ name: 'Author', value: track.author || 'Unknown', inline: true })\n        .setFooter({ text: `Duration: ${track.duration}` })\n        .setColor(Colors.Green);\n      channel.send({ embeds: [embed] });\n    });\n\n    player.events.on('trackEnd', (queue) => {\n      // discord-player handles next\n    });\n\n    player.events.on('empty', (queue) => {\n      queue.metadata.channel?.send('Queue empty, leaving VC...');\n      setTimeout(() => queue.delete(), 5000);\n    });\n\n    player.events.on('error', (queue, error) => {\n      console.error('Player error:', error);\n      queue.metadata.channel?.send('❌ An error occurred!');\n    });\n\n    console.log('✅ Music player initialized!');\n  } catch (e) {\n    console.error('Player init error:', e);\n  }
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
  setInterval(updateMemberCount, 5 * 60 * 1000); // Every 5 minutes
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
        value: `A new training has been requested by ${interaction.user.toString()}!\n> - All Training Officers are requested to host a session in=game, and publicizing an update in <#1481028950980431994>. \n> - Trainees must wait for a training to be hosted. If no training has been hosted within 1 week or 168 hours, please report this in <#1480398372027502652>, and the Training Command will be disciplined accordingly. \n> - Please briefly review <#1488355130918305862> to enhance your knowledge for the procedures applicable to the Secret Service. `,
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
        value: `A new training has been requested by ${message.author.toString()}!\n> - All Training Officers are requested to host a session in=game, and publicizing an update in <#1481028950980431994>. \n> - Trainees must wait for a training to be hosted. If no training has been hosted within 1 week or 168 hours, please report this in <#1480398372027502652>, and the Training Command will be disciplined accordingly. \n> - Please briefly review <#1488355130918305862> to enhance your knowledge for the procedures applicable to the Secret Service. `,
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

    await message.delete();\n    await message.channel.send(args);\n    return;\n  }\n\n  // Music commands\n  const prefix = '!';\n  if (message.content.startsWith(prefix)) {\n    const args = message.content.slice(prefix.length).trim().split(/\\s+/);\n    const cmd = args.shift().toLowerCase();\n\n    const queue = useQueue(message.guild.id);\n\n    const checkVC = () => {\n      const vc = message.member.voice.channel;\n      if (!vc) {\n        message.reply('Please join a voice channel first!');\n        return false;\n      }\n      if (queue && queue.channel && queue.channel.id !== vc.id) {\n        message.reply('I\\'m already playing in another voice channel! Switch or stop there first.');\n        return false;\n      }\n      return vc;\n    };\n\n    if (['play', 'p'].includes(cmd)) {\n      const query = args.join(' ');\n      if (!query) return message.reply('Please provide a song name or URL!');\n      const vc = checkVC();\n      if (!vc) return;\n\n      try {\n        const result = await player.search(query, {\n          requestedBy: message.author\n        });\n        if (!result.hasTracks) return message.reply('No tracks found!');\n\n        const track = result.tracks[0];\n        await player.play(vc, track, {\n          nodeOptions: {\n            metadata: {\n              channel: message.channel\n            },\n            leaveOnEnd: true,\n            leaveOnEmpty: true,\n            leaveOnFinish: true,\n            volume: 50,\n            selfDeaf: true\n          }\n        });\n        message.reply(`✅ Playing **${track.title}** by **${track.author}**`);\n      } catch (e) {\n        message.reply('Failed to play the song. Check console.');\n        console.error(e);\n      }\n      return;\n    }\n\n    if (!queue) {\n      return message.reply('Nothing is playing! Use !play first.');\n    }\n\n    if (!checkVC()) return;\n\n    switch (cmd) {\n      case 'pause':\n        queue.node.setPaused(true);\n        message.reply('⏸️ Paused');\n        break;\n      case 'resume':\n        queue.node.setPaused(false);\n        message.reply('▶️ Resumed');\n        break;\n      case 'stop':\n        queue.delete();\n        message.reply('⏹️ Stopped music and cleared queue');\n        break;\n      case 'skip':\n      case 's':\n        queue.node.skip();\n        message.reply('⏭️ Skipped');\n        break;\n      case 'volume':\n      case 'v':\n        const vol = parseInt(args[0]);\n        if (isNaN(vol) || vol < 0 || vol > 100) return message.reply('Volume must be 0-100');\n        queue.node.setVolume(vol / 100);\n        message.reply(`🔊 Volume set to ${vol}%`);\n        break;\n      case 'queue':\n      case 'q':\n        if (queue.tracks.size === 0) return message.reply('Queue empty');\n        const tracks = queue.tracks.toArray().slice(0, 10).map((track, i) => `**${i+1}.** ${track.title} - ${track.author}`).join('\\n');\n        const embed = new EmbedBuilder()\n          .setTitle(`📜 Queue (${queue.tracks.size} tracks)`)\n          .setDescription(tracks + (queue.tracks.size > 10 ? `\\n...and ${queue.tracks.size - 10} more` : ''))\n          .setColor(Colors.Blue);\n        message.reply({ embeds: [embed] });\n        break;\n      case 'np':\n      case 'nowplaying':\n        if (!queue.currentTrack) return message.reply('Nothing playing');\n        const curr = queue.currentTrack;\n        message.reply(`🎵 **${curr.title}** by **${curr.author}** (${curr.duration})`);\n        break;\n      case 'leave':\n      case 'dc':\n      case 'disconnect':\n        queue.delete();\n        const connection = getVoiceConnection(message.guild.id);\n        if (connection) connection.destroy();\n        message.reply('👋 Left VC');\n        break;\n      case 'join':\n      case 'j':\n        const joinVc = checkVC();\n        if (joinVc) {\n          joinVoiceChannel({\n            channelId: joinVc.id,\n            guildId: message.guild.id,\n            adapterCreator: message.guild.voiceAdapterCreator\n          });\n          message.reply('🔌 Joined VC');\n        }\n        break;\n      default:\n        break;\n    }\n  }\n\n  // Direct bot mention response (only direct mention, not @everyone or roles)\n  if (message.mentions.users.has(client.user.id) && \n      !message.mentions.everyone && \n      !message.mentions.roles.size &&\n      message.channel.type === 0 &&\n      !message.reference) {
    const response = `Greetings, I am <@${client.user.id}>. My prefix is \`!\` and slash commands. If you have any questions about the operations of this bot, please make a ticket. Have a good day!`;
    const sent = await message.channel.send(response);
    setTimeout(() => sent.delete().catch(() => {}), 10000);
  }

  // Message sent logging\n  if (!message.author.bot && message.channel.id !== LOG_CHANNEL_ID) {\n    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);\n    if (logChannel && message.channel.id !== LOG_CHANNEL_ID) {\n      const timestamp = `<t:${Math.floor(Date.now() / 1000)}:R>`;\n      const embed = new EmbedBuilder()\n        .setTitle('__Message Logistic__')\n        .addFields(\n          { name: '`From:`', value: `<@${message.author.id}>`, inline: true },\n          { name: '`Their User-ID:`', value: message.author.id, inline: true },\n          { name: '`Message Sent:`', value: message.content || '*No text content*', inline: false },\n          { name: '`Message Timing:`', value: timestamp, inline: true },\n          { name: '`Message ID:`', value: message.id, inline: true },\n          { name: '`Channel Location:`', value: `<#${message.channel.id}>`, inline: true }\n        )\n        .setColor(0x0f9949);\n      await logChannel.send({ embeds: [embed] });\n    }\n  }\n});

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

client.on('messageUpdate', async (oldMessage, newMessage) => {\n  if (oldMessage.author?.bot || newMessage.channel.id === LOG_CHANNEL_ID || oldMessage.content === newMessage.content) return;\n  if (newMessage.channel.id === LOG_CHANNEL_ID) return;\n  await logMessage('edit', newMessage, oldMessage.content);\n});

client.on('messageDelete', async (message) => {\n  if (message.author?.bot || message.channel.id === LOG_CHANNEL_ID) return;\n  await logMessage('delete', message);\n});

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

