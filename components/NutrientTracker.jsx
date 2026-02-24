'use client';

import { Flame, Beef, Wheat, Droplets } from 'lucide-react';

function ProgressBar({ label, current, target, color, icon: Icon }) {
  const rawPct = target > 0 ? (current / target) * 100 : 0;
  const pct = Math.min(rawPct, 100);
  const remaining = Math.max(target - current, 0);
  
  const barColor = rawPct > 100 ? 'bg-red-500' : color;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {Math.round(current)} / {target}
        </span>
      </div>
      <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out animate-progress ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">
        {remaining > 0 ? `${Math.round(remaining)} remaining` : 'Target reached!'}
      </p>
    </div>
  );
}

export default function NutrientTracker({ totals = {}, targets = {} }) {
  const cal = totals.calories || 0;
  const pro = totals.protein_g || 0;
  const carb = totals.carbs_g || 0;
  const fat = totals.fat_g || 0;

  const tCal = targets.calories || 2000;
  const tPro = targets.protein_g || 100;
  const tCarb = targets.carbs_g || 250;
  const tFat = targets.fat_g || 65;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground">Daily Tracker</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <ProgressBar label="Calories" current={cal} target={tCal} color="bg-orange-500" icon={Flame} />
        <ProgressBar label="Protein" current={pro} target={tPro} color="bg-red-500" icon={Beef} />
        <ProgressBar label="Carbs" current={carb} target={tCarb} color="bg-amber-500" icon={Wheat} />
        <ProgressBar label="Fat" current={fat} target={tFat} color="bg-blue-500" icon={Droplets} />

        {/* Summary card */}
        <div className="mt-4 p-3 bg-accent/50 rounded-lg">
          <p className="text-xs font-semibold text-accent-foreground mb-1">Summary</p>
          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
            <span>Calories: {Math.round(cal)} kcal</span>
            <span>Protein: {Math.round(pro)}g</span>
            <span>Carbs: {Math.round(carb)}g</span>
            <span>Fat: {Math.round(fat)}g</span>
          </div>
        </div>
      </div>
    </div>
  );
}
