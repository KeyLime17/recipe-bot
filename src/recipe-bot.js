require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');

const PREFIX = '!';
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,          // needed for slash commands
    GatewayIntentBits.GuildMessages,   // needed for message-based
    GatewayIntentBits.MessageContent,  // toggle in Portal → Bot → Message Content Intent
  ],
});

client.once(Events.ClientReady, c => {
  console.log(`Logged in as ${c.user.tag}`);
});

// ---- message-based (!ping / !echo) ----
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const [cmd, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);

  if (cmd === 'ping') return void message.reply(`Pong! ${client.ws.ping}ms`);
  if (cmd === 'echo') return void message.reply(args.length ? args.join(' ') : 'Usage: !echo <text>');
  return void message.reply('Unknown command. Try !ping or !echo');
});

// ---- slash-based (/ping) ----
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'ping') {
    // must reply within 3s or defer
    await interaction.reply({ content: `Pong! ${client.ws.ping}ms`, ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
