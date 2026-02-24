import { supabaseAdmin } from '../supabase';

const HARD_EXCLUDE_DAYS = 2;
const SHOWN_EXCLUDE_DAYS = 2;

export async function getRecentMeals(userId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabaseAdmin
    .from('meal_history')
    .select('recipe_id, recipe_name, eaten_at, record_type')
    .eq('user_id', userId)
    .gte('eaten_at', since.toISOString())
    .order('eaten_at', { ascending: false });

  if (error) {
    console.warn('[MealMemory] Failed to fetch recent meals:', error.message);
    return [];
  }
  return data || [];
}

export async function recordMeal(userId, recipe) {
  if (!userId || !recipe?.name) return;

  const { error } = await supabaseAdmin
    .from('meal_history')
    .insert({
      user_id: userId,
      recipe_id: String(recipe.source?.id || recipe.name),
      recipe_name: recipe.name,
      nutrients: recipe.nutrients_per_serving || null,
      record_type: 'eaten',
    });

  if (error) {
    console.warn('[MealMemory] Failed to record meal:', error.message);
  }
}

export async function recordShownRecipes(userId, recipes) {
  if (!userId || !recipes?.length) return;

  const rows = recipes.map(recipe => ({
    user_id: userId,
    recipe_id: String(recipe.source?.id || recipe.name),
    recipe_name: recipe.name,
    nutrients: recipe.nutrients_per_serving || null,
    record_type: 'shown',
  }));

  const { error } = await supabaseAdmin.from('meal_history').insert(rows);
  if (error) {
    console.warn('[MealMemory] Failed to record shown recipes:', error.message);
  }
}

export async function getPenaltyMap(userId) {
  const lookbackDays = Math.max(HARD_EXCLUDE_DAYS, SHOWN_EXCLUDE_DAYS);
  const meals = await getRecentMeals(userId, lookbackDays);
  const now = Date.now();

  // hardExcluded: eaten within HARD_EXCLUDE_DAYS — code enforces, LLM cannot override
  // recentlyShown: shown-only (not eaten) within SHOWN_EXCLUDE_DAYS — LLM sees and decides
  const hardExcluded = {};  // recipe_id -> { name, ageDays }
  const recentlyShown = {}; // recipe_id -> { name, ageDays }

  for (const meal of meals) {
    const ageMs = now - new Date(meal.eaten_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const isEaten = (meal.record_type || 'eaten') === 'eaten';
    const id = meal.recipe_id;

    if (isEaten) {
      if (ageDays <= HARD_EXCLUDE_DAYS) {
        hardExcluded[id] = { name: meal.recipe_name, ageDays: Math.round(ageDays * 10) / 10 };
      }
    } else {
      if (ageDays <= SHOWN_EXCLUDE_DAYS) {
        recentlyShown[id] = { name: meal.recipe_name, ageDays: Math.round(ageDays * 10) / 10 };
      }
    }
  }

  return { hardExcluded, recentlyShown };
}
