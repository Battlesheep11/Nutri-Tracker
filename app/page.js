'use client';

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/TopBar';
import NutrientTracker from '@/components/NutrientTracker';
import ChatWindow from '@/components/ChatWindow';
import ProfileModal from '@/components/ProfileModal';
import DebugLogViewer from '@/components/DebugLogViewer';
import { DEFAULT_DAILY_TARGETS } from '@/lib/constants';

const USER_ID = 'default-user';

export default function Home() {
  const [profile, setProfile] = useState(null);
  const [dailyTotals, setDailyTotals] = useState({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });
  const [dailyTargets, setDailyTargets] = useState(DEFAULT_DAILY_TARGETS);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLog, setDebugLog] = useState(null);
  const [recipeMode, setRecipeMode] = useState(true);

  // Load profile
  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/profile?userId=${USER_ID}`);
      const data = await res.json();
      if (data.profile) {
        setProfile(data.profile);
        if (data.profile.daily_targets) {
          setDailyTargets(data.profile.daily_targets);
        }
      }
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
  }, []);

  // Load daily tracker
  const loadTracker = useCallback(async () => {
    try {
      const res = await fetch(`/api/tracker?userId=${USER_ID}`);
      const data = await res.json();
      if (data.tracker?.totals) {
        setDailyTotals(data.tracker.totals);
      }
    } catch (e) {
      console.error('Failed to load tracker:', e);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadTracker();
  }, [loadProfile, loadTracker]);

  // Save profile
  async function handleSaveProfile(formData) {
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, ...formData }),
      });
      const data = await res.json();
      if (data.profile) {
        setProfile(data.profile);
        if (data.profile.daily_targets) {
          setDailyTargets(data.profile.daily_targets);
        }
      }
    } catch (e) {
      console.error('Failed to save profile:', e);
    }
  }

  // Add meal to tracker
  async function handleAddMeal(recipe) {
    try {
      const nutrients = recipe.nutrients_per_serving || {};
      const res = await fetch('/api/tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID,
          meal: {
            name: recipe.name,
            time: new Date().toISOString(),
            nutrients,
            source: recipe.source, // Include source with recipe_id
            nutrients_per_serving: nutrients, // Include for recordMeal
          },
          nutrients,
        }),
      });
      const data = await res.json();
      if (data.tracker?.totals) {
        setDailyTotals(data.tracker.totals);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Added **${recipe.name}** to today's meals! (${Math.round(nutrients.calories || 0)} cal, ${Math.round(nutrients.protein_g || 0)}g protein, ${Math.round(nutrients.carbs_g || 0)}g carbs, ${Math.round(nutrients.fat_g || 0)}g fat)`,
      }]);
    } catch (e) {
      console.error('Failed to add meal:', e);
    }
  }

  // Send message to agent
  async function handleSendMessage(message) {
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setIsLoading(true);

    try {
      // Build text-only conversation history for the agent (exclude loading state / empty entries)
      const conversationHistory = messages
        .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
        .map(m => ({ role: m.role, content: m.content || '' }));

      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationHistory,
          recipeMode,
          context: {
            profile,
            dailyTracker: dailyTotals,
          },
        }),
      });

      const data = await res.json();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response || "I couldn't process that request. Please try again.",
        recipes: data.recipes || [],
      }]);

      if (data.debugLog) {
        setDebugLog(data.debugLog);
      }
    } catch (e) {
      console.error('Agent error:', e);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I encountered an error connecting to the agent. Please make sure Ollama is running and try again.",
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar
        onOpenProfile={() => setShowProfile(true)}
        onOpenDebug={() => setShowDebug(true)}
        hasProfile={!!profile}
        recipeMode={recipeMode}
        onToggleRecipeMode={() => setRecipeMode(v => !v)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left column - Nutrient Tracker */}
        <aside className="w-72 border-r border-border bg-card flex-shrink-0 overflow-hidden">
          <NutrientTracker
            totals={dailyTotals}
            targets={dailyTargets}
          />
        </aside>

        {/* Center - Chat */}
        <main className="flex-1 overflow-hidden">
          <ChatWindow
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            onAddMeal={handleAddMeal}
          />
        </main>

      </div>

      {/* Modals */}
      <ProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        profile={profile}
        onSave={handleSaveProfile}
      />

      <DebugLogViewer
        isOpen={showDebug}
        onClose={() => setShowDebug(false)}
        debugLog={debugLog}
      />
    </div>
  );
}
