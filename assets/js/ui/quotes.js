const CATEGORY_WEIGHTS = [
  { name: 'networking', weight: 30 },
  { name: 'security',      weight: 20 },
  { name: 'basic-tech',       weight: 20 },
  { name: 'fun-tech',      weight: 20},
  { name: 'hardware',      weight: 10}
];

function pickCategory() {
  const total = CATEGORY_WEIGHTS.reduce((sum, c) => sum + c.weight, 0);
  const rand  = Math.random() * total;

  let cumulative = 0;
  for (const category of CATEGORY_WEIGHTS) {
    cumulative += category.weight;
    if (rand <= cumulative) {
      return category.name;
    }
  }

  return CATEGORY_WEIGHTS[0].name;
}

export async function getRandomQuote() {
  const category = pickCategory();

  try {
    const module = await import(`../../data/quotes/${category}.js`);
    const quotes = module.default;

    if (!Array.isArray(quotes) || quotes.length === 0) {
      return { text: '', attr: '' };
    }

    const idx = Math.floor(Math.random() * quotes.length);
    const quote = quotes[idx];
    return {
      ...quote,
      text: `\u201C${quote.text}\u201D`,
    };

  } catch (err) {
    console.error('Quote load failed:', err);
    return { text: '', attr: '' };
  }
}