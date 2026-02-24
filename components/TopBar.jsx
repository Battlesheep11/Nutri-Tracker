'use client';

import { User, Bug, Utensils, ChefHat, MessageCircleQuestion } from 'lucide-react';

export default function TopBar({ onOpenProfile, onOpenDebug, hasProfile, recipeMode = true, onToggleRecipeMode }) {
  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-5">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Utensils className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight">NutriTracker</h1>
          <p className="text-[10px] text-muted-foreground leading-tight">Meal Planning Agent</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Recipe mode toggle */}
        <button
          onClick={onToggleRecipeMode}
          title={recipeMode ? 'Recipe mode: always returns recipes. Click to switch to conversation mode.' : 'Conversation mode: agent may ask clarifying questions. Click to switch to recipe mode.'}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer border ${
            recipeMode
              ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
              : 'bg-secondary text-muted-foreground border-border hover:bg-secondary/80'
          }`}
        >
          {recipeMode ? <ChefHat className="w-3.5 h-3.5" /> : <MessageCircleQuestion className="w-3.5 h-3.5" />}
          {recipeMode ? 'Recipe Mode' : 'Conversation Mode'}
        </button>

        <button
          onClick={onOpenDebug}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 rounded-lg transition-colors cursor-pointer"
        >
          <Bug className="w-3.5 h-3.5" />
          Debug Log
        </button>
        <button
          onClick={onOpenProfile}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
            hasProfile
              ? 'bg-secondary hover:bg-secondary/80'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 animate-pulse-subtle'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          {hasProfile ? 'Profile' : 'Set Up Profile'}
        </button>
      </div>
    </header>
  );
}
