require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  // /find query cuisine diet
  new SlashCommandBuilder()
    .setName('find')
    .setDescription('Find recipes by query with cuisine and diet filters.')
    .addStringOption(o => o.setName('query').setDescription('Search phrase (e.g., pasta)').setRequired(true))
    .addStringOption(o => o.setName('cuisine').setDescription('e.g., italian, mexican').setRequired(true))
    .addStringOption(o => o.setName('diet').setDescription('e.g., vegetarian, keto, gluten free').setRequired(true)),

  // /byingredients ingredients number
  new SlashCommandBuilder()
    .setName('byingredients')
    .setDescription('Find recipes you can make from a list of ingredients.')
    .addStringOption(o => o.setName('ingredients').setDescription('Comma-separated (e.g., chicken,tomato,garlic)').setRequired(true))
    .addIntegerOption(o => o.setName('number').setDescription('How many results (1–10)').setRequired(true)),

  // /nutrition quantity unit ingredient
  new SlashCommandBuilder()
    .setName('nutrition')
    .setDescription('Estimate nutrition for an ingredient amount.')
    .addNumberOption(o => o.setName('quantity').setDescription('Amount (number)').setRequired(true))
    .addStringOption(o => o.setName('unit').setDescription('e.g., g, oz, cup, tbsp').setRequired(true))
    .addStringOption(o => o.setName('ingredient').setDescription('e.g., olive oil').setRequired(true)),

  // /convert amount sourceunit targetunit ingredient
  new SlashCommandBuilder()
    .setName('convert')
    .setDescription('Convert a measurement for a given ingredient.')
    .addNumberOption(o => o.setName('amount').setDescription('Source amount').setRequired(true))
    .addStringOption(o => o.setName('sourceunit').setDescription('e.g., tbsp').setRequired(true))
    .addStringOption(o => o.setName('targetunit').setDescription('e.g., grams').setRequired(true))
    .addStringOption(o => o.setName('ingredient').setDescription('e.g., sugar').setRequired(true)),

  // /random number tags
  new SlashCommandBuilder()
    .setName('random')
    .setDescription('Get random recipes (filtered by tags).')
    .addIntegerOption(o => o.setName('number').setDescription('How many (1–5)').setRequired(true))
    .addStringOption(o => o.setName('tags').setDescription('Comma-separated tags (e.g., vegetarian,dessert)').setRequired(true)),

  // /substitute ingredient
  new SlashCommandBuilder()
    .setName('substitute')
    .setDescription('Find common substitutes for an ingredient.')
    .addStringOption(o => o.setName('ingredient').setDescription('e.g., buttermilk').setRequired(true)),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    // global registration, tried to make this work in a friends discord idk it was a little more complicated
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log(`Registered ${data.length} GLOBAL command(s).`);
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
})();
