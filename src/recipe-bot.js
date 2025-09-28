require('dotenv').config();
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

const SPOON = axios.create({
  baseURL: 'https://api.spoonacular.com',
  timeout: 15000,
  params: { apiKey: process.env.SPOONACULAR_KEY },
});

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
      case 'find': {
        const query = interaction.options.getString('query').trim();
        const cuisine = interaction.options.getString('cuisine').trim();
        const diet = interaction.options.getString('diet').trim();
        await interaction.deferReply();

        const { data } = await SPOON.get('/recipes/complexSearch', {
          params: { query, cuisine, diet, addRecipeInformation: true, number: 5 },
        });

        if (!data.results?.length) {
          await interaction.editReply(`No recipes found for **${query}** (${cuisine}, ${diet}).`);
          return;
        }

        const embeds = data.results.slice(0, 5).map(r => {
          const summary = stripHtml(r.summary || '').slice(0, 300);
          return new EmbedBuilder()
            .setTitle(r.title)
            .setURL(r.sourceUrl || r.spoonacularSourceUrl || null)
            .setThumbnail(r.image || null)
            .addFields(
              { name: 'Ready In', value: `${r.readyInMinutes ?? '-'} min`, inline: true },
              { name: 'Servings', value: String(r.servings ?? '-'), inline: true },
            )
            .setDescription(summary ? summary + '…' : 'No summary available.');
        });

        await interaction.editReply({ embeds });
        break;
      }

      case 'byingredients': {
        const ingredients = interaction.options.getString('ingredients').trim();
        const requested = interaction.options.getInteger('number');
        const number = Math.max(1, Math.min(10, requested || 3));
        await interaction.deferReply();

        const { data } = await SPOON.get('/recipes/findByIngredients', {
          params: { ingredients, number, ranking: 1, ignorePantry: true },
        });

        if (!data?.length) {
          await interaction.editReply(`No recipes found using: **${ingredients}**.`);
          return;
        }

        const embeds = data.slice(0, number).map(item => {
          const used = (item.usedIngredients || []).map(i => i.name).join(', ') || '-';
          const missed = (item.missedIngredients || []).map(i => i.name).join(', ') || '-';
          return new EmbedBuilder()
            .setTitle(item.title)
            .setURL(spoonacularRecipeUrl(item.title, item.id))
            .setThumbnail(item.image || null)
            .addFields(
              { name: 'Uses', value: truncate(used, 1024) || '-' },
              { name: 'Missing', value: truncate(missed, 1024) || '-' },
            )
            .setFooter({ text: `Used: ${item.usedIngredientCount} • Missing: ${item.missedIngredientCount}` });
        });

        await interaction.editReply({ embeds });
        break;
      }

      case 'nutrition': {
        const qty = interaction.options.getNumber('quantity');
        const unit = interaction.options.getString('unit').trim();
        const ingredient = interaction.options.getString('ingredient').trim();
        await interaction.deferReply();

        // parseIngredients supports ingredientList like "2 tbsp olive oil"
        const { data } = await SPOON.get('/recipes/parseIngredients', {
          params: {
            ingredientList: `${qty} ${unit} ${ingredient}`,
            servings: 1,
            includeNutrition: true,
            // disableDefaultComments: true // optional
          },
        });

        if (!Array.isArray(data) || !data.length) {
          await interaction.editReply(`Could not parse nutrition for **${qty} ${unit} ${ingredient}**.`);
          return;
        }

        const item = data[0];
        const n = name => item.nutrition?.nutrients?.find(x => x.name === name);
        const calories = n('Calories');
        const carbs = n('Carbohydrates');
        const fat = n('Fat');
        const protein = n('Protein');

        const embed = new EmbedBuilder()
          .setTitle(`Nutrition — ${qty} ${unit} ${ingredient}`)
          .setThumbnail(item.image || null)
          .addFields(
            { name: 'Calories', value: fmtNutrient(calories), inline: true },
            { name: 'Carbs', value: fmtNutrient(carbs), inline: true },
            { name: 'Fat', value: fmtNutrient(fat), inline: true },
            { name: 'Protein', value: fmtNutrient(protein), inline: true },
          )
          .setFooter({ text: `Original text: "${item.original}"` });

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'convert': {
        const amount = interaction.options.getNumber('amount');
        const sourceUnit = interaction.options.getString('sourceunit').trim();
        const targetUnit = interaction.options.getString('targetunit').trim();
        const ingredient = interaction.options.getString('ingredient').trim();
        await interaction.deferReply();

        const { data } = await SPOON.get('/recipes/convert', {
          params: {
            ingredientName: ingredient,
            sourceAmount: amount,
            sourceUnit: sourceUnit,
            targetUnit: targetUnit,
          },
        });

        // API returns { answer: "...", targetAmount: number, ... }
        const answer = data?.answer || `${amount} ${sourceUnit} ${ingredient} ≈ ${data?.targetAmount ?? '?'} ${targetUnit}`;
        const embed = new EmbedBuilder()
          .setTitle('Conversion')
          .setDescription(answer);

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'random': {
        const requested = interaction.options.getInteger('number');
        const number = Math.max(1, Math.min(5, requested || 1));
        const tags = interaction.options.getString('tags').trim();
        await interaction.deferReply();

        const { data } = await SPOON.get('/recipes/random', {
          params: { number, tags },
        });

        const list = data?.recipes || [];
        if (!list.length) {
          await interaction.editReply(`No random recipes found for tags: **${tags}**.`);
          return;
        }

        const embeds = list.slice(0, number).map(r => {
          const summary = stripHtml(r.summary || '').slice(0, 300);
          return new EmbedBuilder()
            .setTitle(r.title)
            .setURL(r.sourceUrl || null)
            .setThumbnail(r.image || null)
            .addFields(
              { name: 'Ready In', value: `${r.readyInMinutes ?? '-'} min`, inline: true },
              { name: 'Servings', value: String(r.servings ?? '-'), inline: true },
            )
            .setDescription(summary ? summary + '…' : 'No summary available.');
        });

        await interaction.editReply({ embeds });
        break;
      }

      case 'substitute': {
        const ingredient = interaction.options.getString('ingredient').trim();
        await interaction.deferReply();

        const { data } = await SPOON.get('/food/ingredients/substitutes', {
          params: { ingredientName: ingredient },
        });

        if (data?.status !== 'success' || !data?.substitutes?.length) {
          await interaction.editReply(`No common substitutes found for **${ingredient}**.`);
          return;
        }

        const subs = data.substitutes.slice(0, 8).map((s, i) => `${i + 1}. ${s}`).join('\n');
        const embed = new EmbedBuilder()
          .setTitle(`Substitutes — ${ingredient}`)
          .setDescription(subs);

        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
  } catch (err) {
    console.error(err?.response?.data || err);
    const msg = err?.response?.status === 402
      ? 'API usage exceeded on Spoonacular.'
      : 'Something went wrong. Check your inputs and try again.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

// helpers
function stripHtml(html) {
  return String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
function truncate(s, max) {
  s = s || '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
function spoonacularRecipeUrl(title, id) {
  const slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  return `https://spoonacular.com/recipes/${slug}-${id}`;
}
function fmtNutrient(n) {
  if (!n) return '—';
  const val = (typeof n.amount === 'number') ? round1(n.amount) : n.amount;
  return `${val} ${n.unit || ''}`.trim();
}
function round1(x) {
  return Math.round(x * 10) / 10;
}
