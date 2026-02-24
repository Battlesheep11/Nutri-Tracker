import { MAX_RETRIES, RETRY_BASE_DELAY_MS } from '../constants';

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[FatSecret] Auth failed ${res.status}:`, errText);
    throw new Error(`FatSecret auth failed: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function apiCall(method, params, retryCount = 0) {
  try {
    const token = await getAccessToken();
    const url = new URL('https://platform.fatsecret.com/rest/server.api');
    url.searchParams.set('method', method);
    url.searchParams.set('format', 'json');
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    console.log(`[FatSecret] Calling ${method} with params:`, params);
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[FatSecret] ${method} failed ${res.status}:`, errText);
      throw new Error(`FatSecret API error: ${res.status} ${res.statusText} - ${errText}`);
    }

    const data = await res.json();
    console.log(`[FatSecret] ${method} OK`);
    return data;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
      console.warn(`[FatSecret] Retry ${retryCount + 1}/${MAX_RETRIES} for ${method} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
      return apiCall(method, params, retryCount + 1);
    }
    throw error;
  }
}

export async function searchRecipes(query, maxResults = 10, recipeType = null) {
  // Enforce single-word query constraint
  const trimmedQuery = query.trim();
  if (trimmedQuery.includes(' ')) {
    throw new Error(`nutrition_search requires a SINGLE WORD query. Received: "${query}". Use one word only (e.g., "chicken", "pasta", "salmon").`);
  }

  const params = {
    search_expression: trimmedQuery,
    max_results: String(maxResults),
    page_number: '0',
  };
  
  // Add recipe_type filter if specified (e.g., "Breakfast", "Main Dishes", "Dessert")
  if (recipeType) {
    params.recipe_type = recipeType;
  }

  const data = await apiCall('recipes.search.v3', params);

  const recipes = data?.recipes?.recipe || [];
  return Array.isArray(recipes) ? recipes : [recipes];
}

export async function getRecipe(recipeId) {
  const data = await apiCall('recipe.get.v2', {
    recipe_id: String(recipeId),
  });
  return data?.recipe || null;
}

export function parseRecipeToCard(recipe) {
  if (!recipe) return null;

  const ingredients = (recipe.ingredients?.ingredient || []).map(ing => {
    const raw = ing.ingredient_description || ing.food_name || '';
    // Try to parse "2 oz chicken breast", "1/2 cup flour", "1 1/2 lbs beef" into parts
    // Quantity: integer, decimal, fraction, or mixed number (e.g. "1 1/2")
    const match = raw.match(/^(\d+(?:\s+\d+\/\d+|\s*\/\s*\d+|\.\d+)?)\s+([a-zA-Z_]+)\s+(.+)$/);
    if (match) {
      const qty = match[1].trim();
      const unitRaw = match[2].trim();
      const name = match[3].trim();
      // Only split if the second token looks like a known unit
      const knownUnits = ['oz','ounce','ounces','lb','lbs','pound','pounds','g','gram','grams','kg','kilogram','kilograms','ml','milliliter','milliliters','millilitre','millilitres','l','liter','liters','litre','litres','cup','cups','tbsp','tablespoon','tablespoons','tsp','teaspoon','teaspoons','fl','pint','pints','quart','quarts','gallon','gallons'];
      if (knownUnits.includes(unitRaw.toLowerCase())) {
        return { name, quantity: qty, unit: unitRaw, original_description: raw };
      }
    }
    return { name: raw, quantity: '', unit: '' };
  });

  const directions = recipe.directions?.direction || [];
  const instructions = Array.isArray(directions)
    ? directions.map(d => d.direction_description).join('\n')
    : directions.direction_description || 'No instructions available.';

  const serving = recipe.serving_sizes?.serving || {};
  const servingData = Array.isArray(serving) ? serving[0] : serving;

  const nutrients = {
    calories: parseFloat(servingData?.calories) || 0,
    protein_g: parseFloat(servingData?.protein) || 0,
    carbs_g: parseFloat(servingData?.carbohydrate) || 0,
    fat_g: parseFloat(servingData?.fat) || 0,
    fiber_g: parseFloat(servingData?.fiber) || 0,
  };

  const prepMin = parseInt(recipe.preparation_time_min) || 0;
  const cookMin = parseInt(recipe.cooking_time_min) || 0;
  let length_minutes;
  let time_estimated = false;
  if (prepMin > 0 || cookMin > 0) {
    length_minutes = prepMin + cookMin;
  } else {
    const stepCount = Array.isArray(directions) ? directions.length : (directions ? 1 : 2);
    length_minutes = Math.min(120, Math.max(10, stepCount * 5));
    time_estimated = true;
  }

  const ratingRaw = parseFloat(recipe.rating) || null;
  const ratingCount = parseInt(recipe.rating_count) || 0;

  // Extract meal types from FatSecret API
  const recipeTypes = recipe.recipe_types?.recipe_type || [];
  const mealTypes = Array.isArray(recipeTypes) ? recipeTypes : [recipeTypes];

  return {
    name: recipe.recipe_name || 'Unknown Recipe',
    length_minutes,
    time_estimated,
    ingredients,
    instructions,
    nutrients_per_serving: nutrients,
    rating: ratingRaw,
    rating_count: ratingCount,
    meal_types: mealTypes.filter(Boolean),
    source: { provider: 'fatsecret', id: String(recipe.recipe_id), url: recipe.recipe_url || `https://www.fatsecret.com/recipes/generic/view?recipe_id=${recipe.recipe_id}` },
    servings: parseInt(recipe.number_of_servings) || 1,
    image: recipe.recipe_images?.recipe_image?.[0] || recipe.recipe_image || null,
  };
}

export async function searchAndParseRecipes(query, limit = 3, recipeType = null) {
  const results = await searchRecipes(query, limit + 2, recipeType);
  const cards = [];

  for (const r of results.slice(0, limit)) {
    try {
      const full = await getRecipe(r.recipe_id);
      const card = parseRecipeToCard(full);
      if (card) cards.push(card);
    } catch (e) {
      console.error(`Failed to fetch recipe ${r.recipe_id}:`, e.message);
    }
  }

  return cards;
}
