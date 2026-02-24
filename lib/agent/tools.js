export const TOOL_DEFINITIONS = [
  {
    name: 'nutrition_search',
    description: 'Search for recipes using the FatSecret API. Returns recipe cards with name, ingredients, instructions, cooking time, nutrition info, and meal_types. Each recipe includes a rating (out of 5) and rating_count. IMPORTANT: query MUST be a single word only (e.g. "chicken", "pasta", "salmon"). Multi-word queries will be rejected. You must manually filter results based on user requirements.',
    parameters: {
      query: 'string — SINGLE WORD ONLY search query (e.g. "pancakes", "chicken", "pasta"). Multi-word queries are not allowed.',
      limit: 'number (optional) — max recipes to return, default 3, max 5',
      meal_type: 'string (optional) — filter by meal type. Valid values: "Appetizers", "Soups", "Main Dishes", "Side Dishes", "Breads & Baked Products", "Salads and Salad Dressings", "Sauces and Condiments", "Desserts", "Snacks", "Beverages", "Other", "Breakfast", "Lunch". Use this when user specifies a meal type.',
    },
  },
  {
    name: 'convert_units',
    description: 'Convert ingredient measurements to standard units (g, ml, tbsp, tsp). Always call this after fetching recipes if the user will be cooking. Optionally target specific recipes by name.',
    parameters: {
      recipe_names: 'array of strings (optional) — names of specific recipes to convert. If omitted, converts all collected recipes.',
    },
  },
  {
    name: 'remove_recipe',
    description: 'Remove a specific recipe from the current results. Use this when a recipe has a low rating, is clearly a condiment/sauce/non-meal, or is otherwise unsuitable. After removing, you can call nutrition_search again to find a replacement.',
    parameters: {
      recipe_name: 'string — exact name of the recipe to remove',
      reason: 'string — why you are removing it (e.g. "low rating", "not a meal", "unsuitable for request")',
    },
  },
  {
    name: 'tavily_search',
    description: 'Search the web for food and nutrition information using Tavily. Use this to answer general nutrition questions (e.g. "how much protein is in chicken?", "is quinoa gluten-free?", "what are the benefits of omega-3?"). Do NOT use this for recipe searches — use nutrition_search for that. Only use this for factual food/nutrition questions.',
    parameters: {
      query: 'string — the question or search query, e.g. "how much protein is in 100g chicken breast" or "is quinoa a complete protein"',
    },
  },
  {
    name: 'ask_user',
    description: 'Ask the user a clarifying question before proceeding. Use this when the request is ambiguous, the available recipes are poor quality, or you need more information to give a good recommendation (e.g. dietary preferences, meal type, cuisine preference, time available). After calling this, the loop will stop and wait for the user\'s reply.',
    parameters: {
      question: 'string — the clarifying question to ask the user (1-2 sentences, conversational tone)',
    },
  },
  {
    name: 'finish',
    description: 'Signal that you are done and ready to respond to the user. IMPORTANT: the "reason" you provide here IS the final message shown to the user — write it as a friendly 1-2 sentence response acknowledging what you found and why it fits their request. Do not describe individual recipes (the user sees full recipe cards). Example: "Here are some great high-protein dinner options for you!"',
    parameters: {
      reason: 'string — the friendly user-facing response message (1-2 sentences, no recipe names or details)',
    },
  },
];

export function toolSchemaSummary() {
  return TOOL_DEFINITIONS.map(t => {
    const params = Object.entries(t.parameters)
      .map(([k, v]) => `    ${k}: ${v}`)
      .join('\n');
    return `- ${t.name}${params ? `\n${params}` : ''}`;
  }).join('\n\n');
}
