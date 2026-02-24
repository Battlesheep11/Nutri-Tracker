'use client';

import { Clock, Plus, ChefHat, ExternalLink } from 'lucide-react';

export default function RecipeCard({ recipe, onAddMeal }) {
  if (!recipe) return null;

  const n = recipe.nutrients_per_serving || {};

  return (
    <div className="border rounded-xl p-4 mb-3 transition-all hover:shadow-md border-border bg-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{recipe.name}</h3>
            {recipe.source?.url && (
              <a
                href={recipe.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                title="View on FatSecret"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{recipe.length_minutes} minutes</span>
            </div>
            {recipe.rating != null && (
              <StarRating rating={recipe.rating} count={recipe.rating_count} />
            )}
          </div>
        </div>
        <button
          onClick={() => onAddMeal?.(recipe)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          Add to meals
        </button>
      </div>

      {/* Nutrients */}
      <div className="flex gap-3 mb-3 flex-wrap">
        <NutrientBadge label="Cal" value={Math.round(n.calories || 0)} unit="kcal" color="bg-orange-100 text-orange-700" />
        <NutrientBadge label="Protein" value={Math.round(n.protein_g || 0)} unit="g" color="bg-red-100 text-red-700" />
        <NutrientBadge label="Carbs" value={Math.round(n.carbs_g || 0)} unit="g" color="bg-amber-100 text-amber-700" />
        <NutrientBadge label="Fat" value={Math.round(n.fat_g || 0)} unit="g" color="bg-blue-100 text-blue-700" />
        {n.fiber_g > 0 && (
          <NutrientBadge label="Fiber" value={Math.round(n.fiber_g)} unit="g" color="bg-green-100 text-green-700" />
        )}
      </div>

      {/* Ingredients */}
      <details className="mb-2 group">
        <summary className="text-sm font-medium cursor-pointer hover:text-primary transition-colors flex items-center gap-1">
          <ChefHat className="w-3.5 h-3.5" />
          Ingredients ({recipe.ingredients?.length || 0})
        </summary>
        <ul className="mt-2 ml-5 text-sm text-muted-foreground list-disc space-y-0.5">
          {(recipe.ingredients || []).map((ing, i) => (
            <li key={i}>
              {ing.quantity || ing.unit
                ? `${ing.quantity ? ing.quantity + ' ' : ''}${ing.unit ? ing.unit + ' ' : ''}${ing.name}`
                : (ing.original_description || ing.name)}
            </li>
          ))}
        </ul>
      </details>

      {/* Instructions */}
      <details className="group">
        <summary className="text-sm font-medium cursor-pointer hover:text-primary transition-colors">
          Instructions
        </summary>
        <div className="mt-2 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
          {recipe.instructions || 'No instructions available.'}
        </div>
      </details>

    </div>
  );
}

function NutrientBadge({ label, value, unit, color }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${color}`}>
      {label}: {value}{unit}
    </span>
  );
}

function StarRating({ rating, count }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const fill = Math.min(1, Math.max(0, rating - (i - 1)));
    if (fill >= 0.75) {
      stars.push(<FullStar key={i} />);
    } else if (fill >= 0.25) {
      stars.push(<HalfStar key={i} />);
    } else {
      stars.push(<EmptyStar key={i} />);
    }
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="flex items-center gap-px">{stars}</span>
      {count != null && (
        <span className="text-xs text-muted-foreground ml-1">
          {rating.toFixed(1)}{count > 0 ? ` (${count})` : ''}
        </span>
      )}
    </span>
  );
}

function FullStar() {
  return (
    <svg className="w-3 h-3 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function HalfStar() {
  return (
    <svg className="w-3 h-3 text-amber-400" viewBox="0 0 20 20">
      <defs>
        <linearGradient id="half">
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path fill="url(#half)" stroke="#fbbf24" strokeWidth="0.5" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function EmptyStar() {
  return (
    <svg className="w-3 h-3 text-amber-200 fill-amber-100" viewBox="0 0 20 20">
      <path stroke="#fbbf24" strokeWidth="0.5" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}
