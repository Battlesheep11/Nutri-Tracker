'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';
import RecipeCard from './RecipeCard';

export default function ChatWindow({ onSendMessage, messages = [], isLoading = false, onAddMeal }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage?.(input.trim());
    setInput('');
  }

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">MealPlanner</h2>
            <p className="text-xs text-muted-foreground">Your personal nutrition assistant</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Welcome to MealPlanner!</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              I can help you plan meals, find recipes based on your preferences,
              and track your daily nutrition. Try asking me:
            </p>
            <div className="mt-4 space-y-2">
              {[
                'Plan dinner for me tonight',
                'I want a high-protein lunch under 500 calories',
                'What can I make with eggs, spinach, and cheese?',
                'Is quinoa a good source of protein?',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="block mx-auto px-4 py-2 text-sm bg-secondary hover:bg-accent rounded-lg transition-colors cursor-pointer"
                >
                  &ldquo;{suggestion}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div className={`max-w-[80%] ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5'
                : 'bg-secondary rounded-2xl rounded-bl-md px-4 py-2.5'
            }`}>
              {msg.role === 'assistant' && msg.recipes?.length > 0 ? (
                <div>
                  <div className="text-sm whitespace-pre-wrap mb-3">{msg.content}</div>
                  <div className="space-y-2">
                    {msg.recipes.map((recipe, ri) => (
                      <RecipeCard key={ri} recipe={recipe} onAddMeal={onAddMeal} />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Thinking and searching recipes...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-5 py-3 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about meals, recipes, or nutrition..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm bg-secondary rounded-xl outline-none focus:ring-2 focus:ring-primary/30 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
