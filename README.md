# NutriTracker — AI Meal Planning Agent

An AI-powered meal planning assistant built with Next.js that uses a **ReAct (Reasoning + Acting) agent loop** to search for recipes, evaluate their quality, and track daily nutrition. The agent runs a local LLM via Ollama and fetches real recipe data from the FatSecret API.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **UI** | React 19, Tailwind CSS 4, Lucide icons |
| **Database** | Supabase (PostgreSQL) |
| **LLM** | Ollama (local, default model: `qwen2.5:14b`) |
| **Recipe Data** | FatSecret Platform API |
| **Web Search** | Tavily API (for general nutrition questions) |

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Next.js Frontend                   │
│  ┌──────────┐  ┌────────────┐  ┌─────────────────┐  │
│  │  TopBar   │  │ ChatWindow │  │ NutrientTracker │  │
│  └──────────┘  └─────┬──────┘  └────────┬────────┘  │
│                      │                   │           │
│               ┌──────┴───────┐   ┌───────┴────────┐  │
│               │  RecipeCard  │   │  ProfileModal  │  │
│               └──────────────┘   └────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │  HTTP (fetch)
┌──────────────────────┴──────────────────────────────┐
│                  Next.js API Routes                  │
│  /api/agent/chat   /api/profile   /api/tracker       │
└──────────┬──────────────────────────────────────────┘
           │
┌──────────┴──────────────────────────────────────────┐
│                   ReAct Agent Loop                   │
│  ┌─────────────┐    ┌──────────────────────────┐     │
│  │ System      │    │  Iterative Loop (max 8)  │     │
│  │ Prompt      │───▶│  LLM → Action → Observe  │     │
│  │ Builder     │    │  → LLM → Action → ...    │     │
│  └─────────────┘    └────────────┬─────────────┘     │
│                                  │                   │
│          ┌───────────┬───────────┼───────────┐       │
│          ▼           ▼           ▼           ▼       │
│   nutrition_search  convert   remove    tavily       │
│   (FatSecret API)   _units   _recipe    _search      │
│                                                      │
│          ┌───────────┬───────────┐                   │
│          ▼           ▼           ▼                   │
│       ask_user    finish    meal_memory              │
│                              (Supabase)              │
└──────────────────────────────────────────────────────┘
```

## Core Concept: The ReAct Agent Loop

The heart of the application is a **ReAct agent** (`lib/agent/agentLoop.js`). Unlike a simple request→response pattern, the agent reasons step-by-step and calls tools iteratively:

1. The user sends a message (e.g., *"Plan dinner for me"*)
2. The LLM receives the system prompt (with user profile, daily intake, recent meals, tool schemas)
3. On each iteration, the LLM outputs a JSON object:
   ```json
   {
     "thought": "The user wants dinner. I'll search for chicken-based main dishes.",
     "action": "nutrition_search",
     "action_input": { "query": "chicken", "limit": 3, "meal_type": "Main Dishes" }
   }
   ```
4. The agent executes the tool, feeds the observation back, and the LLM decides what to do next
5. This continues for up to **8 iterations** until the agent calls `finish` or `ask_user`

This design lets the agent self-correct (e.g., remove a low-rated recipe and search for a replacement) without any hardcoded multi-step pipeline.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── agent/chat/route.js   # Main chat endpoint — runs the agent loop
│   │   ├── profile/route.js      # User profile CRUD (GET/POST)
│   │   └── tracker/route.js      # Daily nutrition tracker (GET/POST/DELETE)
│   ├── globals.css               # Tailwind theme + custom animations
│   ├── layout.js                 # Root layout with Geist fonts
│   └── page.js                   # Main page — orchestrates all components
│
├── components/
│   ├── ChatWindow.jsx            # Chat UI with message history + recipe cards
│   ├── RecipeCard.jsx            # Expandable recipe card (nutrients, ingredients, instructions)
│   ├── NutrientTracker.jsx       # Sidebar with daily progress bars
│   ├── ProfileModal.jsx          # Profile editor (age, sex, weight, targets)
│   ├── TopBar.jsx                # App header with mode toggle + nav
│   └── DebugLogViewer.jsx        # Modal to inspect agent chain-of-thought + tool trace
│
├── lib/
│   ├── agent/
│   │   ├── agentLoop.js          # ReAct loop: runAgentLoop(), executeTool(), generateResponse()
│   │   ├── systemPrompt.js       # Dynamic system prompt builder
│   │   ├── tools.js              # Tool definitions + schema summary for the LLM
│   │   └── debugLogger.js        # Structured logger for chain-of-thought + tool trace
│   │
│   ├── tools/
│   │   ├── llm.js                # Ollama client: chat(), chatWithHistory(), generateJSON()
│   │   ├── nutrition.js          # FatSecret API: search, fetch, parse recipe cards
│   │   ├── mealMemory.js         # Meal history: record eaten/shown, penalty map
│   │   └── unitConverter.js      # Ingredient unit conversion (local math + Tavily fallback)
│   │
│   ├── constants.js              # Default daily targets, retry config
│   └── supabase.js               # Supabase admin client
│
└── package.json
```

## Agent Tools

| Tool | Purpose |
|------|---------|
| `nutrition_search` | Searches FatSecret for recipes using **single-word queries only** (e.g., "chicken", "pasta", "salmon"). Multi-word queries are rejected. Supports `meal_type` filtering. The agent manually filters results using `remove_recipe` to match user requirements. Returns recipe cards with ratings, nutrients, and ingredients. |
| `convert_units` | Converts ingredient measurements (oz, cups, lbs, etc.) to metric (g, ml). Uses local conversion tables with a Tavily + LLM fallback for uncommon units. |
| `remove_recipe` | Removes a recipe from results by name. Used when the agent identifies low-quality, off-topic, or unsuitable recipes. |
| `tavily_search` | Web search for general nutrition questions (e.g., "how much protein is in chicken?"). Not used for recipe finding. |
| `ask_user` | Asks the user a clarifying question. Pauses the loop and returns the question to the frontend. |
| `finish` | Signals completion. The `reason` field becomes the user-facing chat message. |

## Meal Memory & Variety System

The agent avoids repetition through a penalty system (`lib/tools/mealMemory.js`):

- **Hard-excluded**: Recipes eaten within the last 2 days are automatically filtered out of search results. The LLM cannot override this.
- **Recently shown**: Recipes shown (but not eaten) within 2 days are flagged as advisory — the LLM sees them and uses its judgement.

All meals are recorded to Supabase with a `record_type` of either `eaten` (user clicked "Add to meals") or `shown` (agent returned them as suggestions).

## Self-Correction

The agent implements multiple layers of self-correction, all without hardcoded recovery pipelines:

1. **Invalid JSON recovery**: If the LLM returns malformed JSON, `jsonrepair` attempts to fix it. If that fails, the error is fed back as an observation and the LLM retries with explicit formatting instructions.
2. **Unknown action recovery**: If the LLM outputs an action not in the known tool set, the agent rejects it, appends a correction message listing valid actions, and the LLM retries.
3. **Tool failure recovery**: If any tool throws an error (e.g., FatSecret API is down), the error is captured as an observation string (`Tool "X" failed: ...`). The LLM sees this and can try an alternative approach (different query, different tool).
4. **Recipe quality self-correction**: The system prompt instructs the LLM to evaluate recipe ratings and relevance. When it identifies a low-quality recipe (low rating, wrong category, not a meal), it calls `remove_recipe` to explicitly drop it and then searches for a replacement — all within the same loop.
5. **Query validation**: The `nutrition_search` tool enforces single-word queries. If the agent attempts a multi-word search, the error is fed back as an observation and the agent self-corrects by using a single-word query instead.
6. **Deduplication & hard-exclusion**: Recipes recently eaten are automatically filtered at the code level, preventing the LLM from suggesting them even if the API returns them.

All self-correction happens within the iterative ReAct loop (up to 8 iterations), giving the agent multiple chances to recover from errors and improve its results.

## Conversation Modes

The app supports two modes, toggled via the top bar:

- **Recipe Mode** (default): The agent skips clarifying questions and immediately searches for recipes, making its best guess from context.
- **Conversation Mode**: The agent must call `ask_user` first to understand preferences (cuisine, spice level, time, etc.) before searching.

## LLM Integration

All LLM calls go through `lib/tools/llm.js`, which communicates with a local **Ollama** instance:

- **`chat()`** — Basic message → response.
- **`chatWithHistory()`** — Full conversation history, returns parsed JSON. Uses `jsonrepair` to handle minor LLM formatting issues.
- **`generateJSON()`** — Single-prompt → structured JSON (used for unit extraction, etc.).

The agent loop includes **automatic retry logic**: if the LLM returns invalid JSON or an unknown action, the error is fed back as an observation and the LLM gets another chance.

## Supabase Tables

| Table | Purpose |
|-------|---------|
| `user_profiles` | Stores user profile (age, sex, weight, height, daily nutrition targets) |
| `daily_tracker` | Daily meal log with cumulative nutrient totals |
| `meal_history` | Individual meal records with `record_type` (`eaten`/`shown`) for the penalty system |

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Ollama (local LLM)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b

# FatSecret API
FATSECRET_CLIENT_ID=your-client-id
FATSECRET_CLIENT_SECRET=your-client-secret

# Tavily (web search for nutrition questions)
TAVILY_API_KEY=your-tavily-key
```

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Ollama** running locally with the `qwen2.5:14b` model (or adjust `OLLAMA_MODEL`)
- A **Supabase** project with the required tables
- **FatSecret** API credentials (free tier available)
- **Tavily** API key (optional — needed for general nutrition Q&A)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm start
```
