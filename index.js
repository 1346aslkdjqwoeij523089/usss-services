const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors, REST, Routes, WebhookClient } = require('discord.js');
const express = require('express');

const GUILD_ID = '1478745386586865788';
const BOT_ID = '1485123070921277530';
const MEMBER_COUNT_CHANNEL_ID = '1485109675904208997';
const SENIOR_LEADERSHIP_ROLE = '1487164396630183973';
const JUNIOR_LEADERSHIP_ROLE = '1486161292816421016';
const LOG_CHANNEL_ID = '1485347671425286275';

const WELCOME_CHANNEL_ID = '1480025451765436510';
const GENERAL_CHANNEL_ID = '1478745388172181637';

const AVATAR_URL = 'https://cdn.discordapp.com/attachments/1485045973699792916/1485052651392733435/image523523.png?ex=69c0768f&is=69bf250f&hm=5c7e1cfba188b46b04b8fb0c773aa14f23627eaa1bd1215c488dff2614bb6c20&';
const BANNER_URL = 'https://cdn.discordapp.com/attachments/1485138081777713183/1485138106028920963/welusss.png?ex=69c0c625&is=69bf74a5&hm=f0e6e8beb676ae6a7d549d7d3ad595baa5e1f72c259fbea7d4733a3b7b92540c&';
const FOOTER_URL = 'https://cdn.discordapp.com/attachments/1485138081777713183/1485139190978183248/usssfooter.png?ex=69c0c727&is=69bf75a7&hm=58b2261214a4c8f4c7396cff36a316f88efe69e0a71eae5d9a0819f421444f15&';
const WELCOME_COLOR = 0x3322BB;

let welcomeWebhook = null;
const data = new Map();

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
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
    console.log('Successfully registered slash commands.');
  } catch (error) {
    console.error(error);
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
});

client.on('messageCreate', async message => {
  if (message.author.bot || message.channel.type !== 0) return;

  // Handle prefix commands
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
    if (logChannel) {
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

