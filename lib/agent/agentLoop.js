import { chatWithHistory, generateJSON } from '../tools/llm';
import { searchAndParseRecipes } from '../tools/nutrition';
import { convertIngredientUnits } from '../tools/unitConverter';
import { getPenaltyMap } from '../tools/mealMemory';
import { buildAgentSystemPrompt } from './systemPrompt';

const MAX_ITERATIONS = 8;
const KNOWN_ACTIONS = new Set(['nutrition_search', 'convert_units', 'remove_recipe', 'tavily_search', 'ask_user', 'finish']);

// ---------------------------------------------------------------------------
// Tool executors
// ---------------------------------------------------------------------------
async function executeTool(action, actionInput, state, context, logger) {
  switch (action) {
    case 'nutrition_search': {
      const query = actionInput.query || context.userMessage || 'healthy meal recipe';
      const mealType = actionInput.meal_type || null;
      const MAX_RECIPES = 5;
      const remainingSlots = MAX_RECIPES - state.recipes.length;
      if (remainingSlots <= 0) {
        return `Already have ${state.recipes.length} recipes (max ${MAX_RECIPES}). Call finish or remove a recipe before searching again.`;
      }
      const limit = Math.min(actionInput.limit || 3, remainingSlots);
      const limitCapped = limit < (actionInput.limit || 3);

      logger.log({
        plan_step: 'nutrition_search',
        action: 'nutrition_search',
        tool: 'nutrition_api',
        input_summary: { query, limit, meal_type: mealType },
        output_summary: {},
        status: 'ok',
        rationale: `Searching: "${query}"${mealType ? ` (meal_type: ${mealType})` : ''}`,
      });

      const cards = await searchAndParseRecipes(query, limit, mealType);

      // Deduplicate against already-collected recipes
      const newCards = cards.filter(card => {
        const key = card.name.toLowerCase().trim();
        const rid = String(card.source?.id || '');
        if (state.seenNames.has(key) || (rid && state.seenIds.has(rid))) return false;
        state.seenNames.add(key);
        if (rid) state.seenIds.add(rid);
        return true;
      });

      // Hard-exclude only eaten-recently recipes; shown-only are advisory (LLM decides)
      const penalised = [];
      const passed = [];
      for (const card of newCards) {
        const rid = String(card.source?.id || card.name);
        if (state.penaltyData.hardExcluded[rid]) {
          penalised.push(card.name);
          logger.log({
            plan_step: 'reject_recipe',
            action: 'reject_recipe',
            tool: 'none',
            input_summary: { name: card.name, recipe_id: rid },
            output_summary: { reason: 'eaten_recently' },
            status: 'info',
            rationale: 'Hard-excluded: eaten within 2 days',
          });
        } else {
          passed.push(card);
        }
      }

      // Enforce global 5-recipe cap
      const slotsLeft = MAX_RECIPES - state.recipes.length;
      const toAdd = passed.slice(0, slotsLeft);
      state.recipes.push(...toAdd);

      logger.entries[logger.entries.length - 1].output_summary = {
        found: cards.length,
        new: newCards.length,
        penalised: penalised.length,
        accepted: passed.length,
        names: passed.map(c => c.name),
      };

      const capNote = limitCapped ? ` (Note: limit capped at 5 — requested ${actionInput.limit}.)` : '';
      const excludeNote = penalised.length > 0 ? ` Excluded ${penalised.length} (eaten recently): ${penalised.join(', ')}.` : '';
      const recipeDetails = passed.map(c => {
        const ratingStr = c.rating != null
          ? `rating ${c.rating}/5 (${c.rating_count} reviews)`
          : 'no rating';
        const cal = c.nutrients_per_serving?.calories != null
          ? `, ${Math.round(c.nutrients_per_serving.calories)} kcal/serving`
          : '';
        return `"${c.name}" [${ratingStr}${cal}]`;
      }).join(', ');
      const obs = passed.length > 0
        ? `Found ${passed.length} recipe(s): ${recipeDetails}.${excludeNote}${capNote}`
        : `No new recipes found for query "${query}".${excludeNote}${capNote} Consider trying a different query.`;

      return obs;
    }

    case 'convert_units': {
      const targetNames = actionInput.recipe_names?.length
        ? new Set(actionInput.recipe_names.map(n => n.toLowerCase().trim()))
        : null;
      const toConvert = targetNames
        ? state.recipes.filter(r => targetNames.has(r.name.toLowerCase().trim()))
        : state.recipes;

      let convertedCount = 0;
      for (const recipe of toConvert) {
        if (recipe.ingredients?.length) {
          try {
            recipe.ingredients = await convertIngredientUnits(recipe.ingredients);
            convertedCount++;
          } catch (e) {
            console.warn('[AgentLoop] Unit conversion failed for', recipe.name, e.message);
          }
        }
      }
      logger.log({
        plan_step: 'convert_units',
        action: 'convert_units',
        tool: 'unit_converter',
        input_summary: { recipe_count: toConvert.length, targeted: !!targetNames },
        output_summary: { converted: convertedCount },
        status: 'ok',
        rationale: targetNames
          ? `Converted units for targeted recipes: ${[...targetNames].join(', ')}`
          : 'Converted ingredient units for all recipes',
      });
      return `Converted units for ${convertedCount} recipe(s).`;
    }

    case 'remove_recipe': {
      const nameToRemove = actionInput.recipe_name || '';
      const reason = actionInput.reason || 'unspecified';
      const before = state.recipes.length;
      state.recipes = state.recipes.filter(
        r => r.name.toLowerCase().trim() !== nameToRemove.toLowerCase().trim()
      );
      const removed = before - state.recipes.length;
      logger.log({
        plan_step: 'remove_recipe',
        action: 'remove_recipe',
        tool: 'none',
        input_summary: { name: nameToRemove, reason },
        output_summary: { removed },
        status: 'ok',
        rationale: `Removed "${nameToRemove}": ${reason}`,
      });
      return removed > 0
        ? `Removed "${nameToRemove}" from results (reason: ${reason}). You can search for a replacement.`
        : `Recipe "${nameToRemove}" was not found in current results.`;
    }

    case 'tavily_search': {
      const query = actionInput.query || '';
      if (!query) {
        return 'tavily_search requires a query parameter.';
      }

      const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
      if (!TAVILY_API_KEY) {
        return 'Tavily API key not configured. Cannot search the web.';
      }

      logger.log({
        plan_step: 'tavily_search',
        action: 'tavily_search',
        tool: 'tavily',
        input_summary: { query },
        output_summary: {},
        status: 'ok',
        rationale: `Searching web for: "${query}"`,
      });

      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            query,
            search_depth: 'basic',
            max_results: 3,
            include_answer: true,
          }),
        });

        if (!res.ok) {
          logger.log({
            plan_step: 'tavily_search',
            action: 'tavily_error',
            tool: 'tavily',
            input_summary: { query },
            output_summary: { error: `HTTP ${res.status}` },
            status: 'error',
            rationale: 'Tavily API request failed',
          });
          return `Web search failed (HTTP ${res.status}). Try rephrasing the question or use a different approach.`;
        }

        const data = await res.json();
        const answer = data.answer || '';
        const results = (data.results || []).slice(0, 2);
        const snippets = results.map(r => r.content || '').filter(Boolean).join(' | ');

        // Combine answer + snippets for context
        const context = [answer, snippets].filter(Boolean).join('\n\n');

        if (!context) {
          return `No relevant information found for "${query}". The question may be too vague or unrelated to food/nutrition.`;
        }

        // Use LLM to extract a concise, food-focused answer
        const extracted = await generateJSON(
          `User question: "${query}"

Search results:
${context.slice(0, 1500)}

Extract a concise, accurate answer to the user's question. If the question is NOT about food or nutrition, respond with { "food_related": false, "answer": "polite message explaining this is a meal planning assistant" }. Otherwise, respond with { "food_related": true, "answer": "concise answer to the question" }.`,
          'You are a nutrition information assistant. Extract clear, factual answers from search results. Return only valid JSON.'
        );

        const isFoodRelated = extracted?.food_related !== false;
        const finalAnswer = extracted?.answer || context.slice(0, 300);

        logger.entries[logger.entries.length - 1].output_summary = {
          food_related: isFoodRelated,
          answer_length: finalAnswer.length,
        };

        if (!isFoodRelated) {
          return `This question doesn't appear to be food or nutrition related. ${finalAnswer}`;
        }

        return `Answer: ${finalAnswer}`;
      } catch (e) {
        logger.log({
          plan_step: 'tavily_search',
          action: 'tavily_error',
          tool: 'tavily',
          input_summary: { query },
          output_summary: { error: e.message },
          status: 'error',
          rationale: e.message,
        });
        return `Web search failed: ${e.message}. Try rephrasing the question.`;
      }
    }

    default:
      return `Unknown tool: ${action}. Available tools: ${[...KNOWN_ACTIONS].join(', ')}.`;
  }
}

// ---------------------------------------------------------------------------
// Main agent loop
// ---------------------------------------------------------------------------
export async function runAgentLoop(userMessage, context, logger) {
  const systemPrompt = buildAgentSystemPrompt(context);

  // Load penalty map once
  const userId = context.userId || 'default-user';
  let penaltyData = { hardExcluded: {}, recentlyShown: {} };
  try {
    penaltyData = await getPenaltyMap(userId);
    const hCount = Object.keys(penaltyData.hardExcluded).length;
    const sCount = Object.keys(penaltyData.recentlyShown).length;
    if (hCount + sCount > 0) {
      logger.addThought('init', `Penalty map: ${hCount} hard-excluded (eaten), ${sCount} recently shown (advisory)`);
    }
  } catch (e) {
    console.warn('[AgentLoop] Could not load penalty map:', e.message);
  }

  // Shared state across iterations
  const state = {
    recipes: [],
    seenNames: new Set(),
    seenIds: new Set(),
    penaltyData,
    errors: [],
  };

  // Build penalty notes for the initial user message
  const hardExcludedNames = Object.values(penaltyData.hardExcluded).map(e => e.name);
  const recentlyShownEntries = Object.values(penaltyData.recentlyShown);

  const hardNote = hardExcludedNames.length > 0
    ? `\n\n[System note: The following recipes were eaten recently and are HARD-EXCLUDED — they will not appear in search results and must not be suggested: ${hardExcludedNames.join(', ')}.]`
    : '';
  const shownNote = recentlyShownEntries.length > 0
    ? `\n\n[System note: The following recipes were recently shown to the user but NOT chosen. Use your judgement — you MAY include them again if they are a strong fit, but prefer variety: ${recentlyShownEntries.map(e => `${e.name} (shown ${e.ageDays}d ago)`).join(', ')}.]`
    : '';

  // Prepend prior conversation turns so the LLM has full context of what was already discussed
  const priorTurns = (context.conversationHistory || []).map(m => ({
    role: m.role,
    content: m.content || '',
  }));

  // Conversation history for the agent (proper role structure)
  // Prior turns come first, then the current user message (with penalty notes appended)
  const messages = [
    ...priorTurns,
    { role: 'user', content: userMessage + hardNote + shownNote },
  ];

  logger.addThought('init', `Starting agent loop for: "${userMessage}" (${priorTurns.length} prior turns in context)`);
  if (hardExcludedNames.length > 0) {
    logger.addThought('init', `Hard-excluded (eaten): ${hardExcludedNames.join(', ')}`);
  }
  if (recentlyShownEntries.length > 0) {
    logger.addThought('init', `Advisory shown-only: ${recentlyShownEntries.map(e => e.name).join(', ')}`);
  }

  let iteration = 0;
  let finished = false;
  let agentFinishReason = '';
  let clarificationQuestion = null;

  while (iteration < MAX_ITERATIONS && !finished) {
    iteration++;
    logger.addThought('agent_loop', `Iteration ${iteration}/${MAX_ITERATIONS}`);

    let agentDecision;
    try {
      agentDecision = await chatWithHistory(messages, systemPrompt);
    } catch (e) {
      logger.log({
        plan_step: 'llm_decision',
        action: 'llm_decision',
        tool: 'ollama',
        input_summary: { iteration },
        output_summary: { error: e.message },
        status: 'error',
        rationale: 'LLM failed to return valid JSON',
      });
      state.errors.push({ iteration, error: e.message });
      // Feed back the error as an observation so the LLM can retry
      messages.push({
        role: 'user',
        content: `Your previous response was not valid JSON. You MUST respond with a JSON object containing "thought", "action" (one of: ${[...KNOWN_ACTIONS].join(', ')}), and "action_input". Try again.`,
      });
      continue;
    }

    const thought = agentDecision.thought || agentDecision.thinking || '';
    const action = agentDecision.action;
    const actionInput = agentDecision.action_input || {};

    // Validate the action is a known tool — if not, correct and retry
    if (!action || !KNOWN_ACTIONS.has(action)) {
      logger.log({
        plan_step: 'validation',
        action: 'invalid_action',
        tool: 'none',
        input_summary: { received_action: action || null, keys: Object.keys(agentDecision) },
        output_summary: {},
        status: 'warn',
        rationale: `LLM returned unknown action "${action || '(none)'}" — asking it to retry`,
      });
      messages.push({
        role: 'assistant',
        content: JSON.stringify(agentDecision),
      });
      messages.push({
        role: 'user',
        content: `Invalid action "${action || '(none)'}". You MUST respond with a JSON object: { "thought": "...", "action": "<tool_name>", "action_input": { ... } }. Valid actions: ${[...KNOWN_ACTIONS].join(', ')}. Try again.`,
      });
      continue;
    }

    logger.addThought('agent_loop', `Thought: ${thought}`);
    logger.log({
      plan_step: action,
      action: 'llm_decision',
      tool: 'ollama',
      input_summary: { iteration, action, action_input: actionInput },
      output_summary: { thought: thought.slice(0, 150) },
      status: 'ok',
      rationale: thought,
    });

    if (action === 'ask_user') {
      const question = actionInput.question || thought || '';
      // Safety net: if recipes already collected, finish with a friendly message — don't ask more questions
      if (state.recipes.length > 0) {
        finished = true;
          agentFinishReason = `Here are some recipes I found for you!`;
        logger.addThought('agent_loop', `ask_user called after recipes found — redirecting to friendly finish.`);
        break;
      }
      finished = true;
      clarificationQuestion = question;
      logger.addThought('agent_loop', `Agent asking user: ${clarificationQuestion}`);
      logger.log({
        plan_step: 'ask_user',
        action: 'ask_user',
        tool: 'none',
        input_summary: { question: clarificationQuestion },
        output_summary: {},
        status: 'ok',
        rationale: 'Agent needs clarification before proceeding',
      });
      break;
    }

    if (action === 'finish') {
      finished = true;
      agentFinishReason = actionInput.reason || thought || '';
      logger.addThought('agent_loop', `Agent decided to finish. Reason: ${agentFinishReason}`);
      break;
    }

    // Execute the chosen tool
    let observation;
    try {
      observation = await executeTool(action, actionInput, state, context, logger);
    } catch (e) {
      observation = `Tool "${action}" failed: ${e.message}. Try a different approach.`;
      state.errors.push({ iteration, action, error: e.message });
      logger.log({
        plan_step: action,
        action: 'tool_error',
        tool: action,
        input_summary: actionInput,
        output_summary: { error: e.message },
        status: 'error',
        rationale: e.message,
      });
    }

    logger.addThought('agent_loop', `Observation: ${observation}`);

    // Build current recipe state summary so LLM always knows exactly what's in scope
    const currentRecipeList = state.recipes.length > 0
      ? `\n\nCurrent recipes in results (${state.recipes.length}): ${state.recipes.map(r => {
          const ratingStr = r.rating != null ? ` [${r.rating}/5, ${r.rating_count} reviews]` : ' [no rating]';
          const cal = r.nutrients_per_serving?.calories != null ? ` [${Math.round(r.nutrients_per_serving.calories)} kcal/serving]` : '';
          return `"${r.name}"${ratingStr}${cal}`;
        }).join(', ')}. To remove any of these, call remove_recipe — reasoning about removal in thought does nothing.`
      : '\n\nCurrent recipes in results: none yet.';

    // Add agent's action + observation to conversation history
    messages.push({
      role: 'assistant',
      content: JSON.stringify({ thought, action, action_input: actionInput }),
    });
    messages.push({
      role: 'user',
      content: `Observation: ${observation}${currentRecipeList}\n\nContinue. If you have enough good recipes, call finish. Otherwise call the next tool.`,
    });
  }

  if (!finished && iteration >= MAX_ITERATIONS) {
    logger.addThought('agent_loop', `Reached max iterations (${MAX_ITERATIONS}). Proceeding with collected data.`);
  }

  return {
    recipes: state.recipes,
    finishReason: agentFinishReason,
    clarificationQuestion,
    errors: state.errors,
  };
}

// ---------------------------------------------------------------------------
// Response generator (post-loop)
// The agent's own finish.reason IS the response — no extra LLM call needed.
// ---------------------------------------------------------------------------
export async function generateResponse(userMessage, results, context, logger) {
  if (results.finishReason) {
    logger.log({
      plan_step: 'generate_response',
      action: 'use_finish_reason',
      tool: 'none',
      input_summary: { recipes: results.recipes.length },
      output_summary: { response_length: results.finishReason.length },
      status: 'ok',
      rationale: 'Using agent finish reason as user-facing response',
    });
    return {
      thinking: '',
      response: results.finishReason,
    };
  }

  // Fallback if the agent finished without a reason (e.g. hit max iterations)
  let response;
  if (results.recipes.length > 0) {
    response = `Here are ${results.recipes.length} recipe suggestion${results.recipes.length > 1 ? 's' : ''} for you!`;
  } else {
    response = "I'm here to help you plan your meals! Ask me to suggest recipes or plan a meal.";
  }
  return { thinking: 'Fallback response', response };
}
