import { NextResponse } from 'next/server';
import { runAgentLoop, generateResponse } from '@/lib/agent/agentLoop';
import { DebugLogger } from '@/lib/agent/debugLogger';
import { getRecentMeals, recordShownRecipes } from '@/lib/tools/mealMemory';
export async function POST(request) {
  try {
    const body = await request.json();
    const { message, context = {}, conversationHistory = [], recipeMode = true } = body;
    context.conversationHistory = conversationHistory;
    context.recipeMode = recipeMode;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    context.userMessage = message;

    const userId = context.userId || 'default-user';
    try {
      context.recentMeals = await getRecentMeals(userId, 30);
    } catch (e) {
      console.warn('[Chat API] Could not load meal history:', e.message);
      context.recentMeals = [];
    }

    console.log('[Chat API] Received message:', message);

    const logger = new DebugLogger();

    // Run the ReAct agent loop — it plans, calls tools, and iterates autonomously
    const results = await runAgentLoop(message, context, logger);

    // If the agent asked a clarifying question, return it immediately — no recipes, no recording
    if (results.clarificationQuestion) {
      return NextResponse.json({
        response: results.clarificationQuestion,
        recipes: [],
        clarification: true,
        trackerUpdate: null,
        debugLog: logger.getFullLog(),
      });
    }

    // Record shown recipes for future penalty scoring
    if (results.recipes?.length) {
      recordShownRecipes(userId, results.recipes).catch(e =>
        console.warn('[Chat API] recordShownRecipes failed:', e.message)
      );
    }

    // Generate the final user-facing response
    const responseData = await generateResponse(message, results, context, logger);

    return NextResponse.json({
      response: responseData.response || "I'm here to help with meal planning! What would you like?",
      recipes: results.recipes || [],
      debugLog: logger.getFullLog(),
    });
  } catch (error) {
    console.error('Agent error:', error);
    return NextResponse.json({
      response: "I'm sorry, I encountered an error. Please try again.",
      recipes: [],
      debugLog: {
        entries: [{
          timestamp: new Date().toISOString(),
          plan_step: 'error',
          action: 'agent_crash',
          tool: 'none',
          input_summary: {},
          output_summary: { error: error.message },
          status: 'error',
          rationale: 'Unhandled agent error',
        }],
        chain_of_thought: [{ timestamp: new Date().toISOString(), step: 'error', thought: error.message }],
      },
    }, { status: 500 });
  }
}
