require('dotenv').config();
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,          // needed for slash commands
    GatewayIntentBits.GuildMessages,   // keep if you still want ! commands
    GatewayIntentBits.MessageContent,  // only needed for ! commands
  ],
});

// axios instance for Spoonacular
const SPOON = axios.create({
  baseURL: 'https://api.spoonacular.com',
  timeout: 15000,
  params: { apiKey: process.env.SPOONACULAR_KEY },
});

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

// Slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'ping') {
      await interaction.reply({ content: `Pong! ${client.ws.ping}ms`, ephemeral: true });
      return;
    }

    if (interaction.commandName === 'find') {
      const query = interaction.options.getString('query').trim();
      const cuisine = interaction.options.getString('cuisine').trim();
      const diet = interaction.options.getString('diet').trim();

      // Acknowledge quickly to avoid the 3s timeout
      await interaction.deferReply();

      const { data } = await SPOON.get('/recipes/complexSearch', {
        params: {
          query,
          cuisine,
          diet,
          addRecipeInformation: true,
          number: 5,
        },
      });

      if (!data.results || data.results.length === 0) {
        await interaction.editReply(`No recipes found for **${query}** (${cuisine}, ${diet}).`);
        return;
      }

      const embeds = data.results.slice(0, 5).map((r) => {
        const summary = stripHtml(r.summary || '').slice(0, 300);
        return new EmbedBuilder()
          .setTitle(r.title)
          .setURL(r.sourceUrl || r.spoonacularSourceUrl || null)
          .setThumbnail(r.image || null)
          .addFields(
            { name: 'Ready In', value: `${r.readyInMinutes ?? '—'} min`, inline: true },
            { name: 'Servings', value: String(r.servings ?? '—'), inline: true },
          )
          .setDescription(summary ? summary + '…' : 'No summary available.');
      });

      await interaction.editReply({ embeds });
      return;
    }
  } catch (err) {
    console.error(err?.response?.data || err.message);
    const msg =
      err?.response?.status === 402
        ? 'API quota exceeded on Spoonacular. Try later.'
        : 'Something went wrong. Check inputs and try again.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

// tiny helper to strip HTML tags from Spoonacular summaries
function stripHtml(html) {
  return String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
