'use client';

import { useState, useEffect } from 'react';
import { X, Save, User } from 'lucide-react';
import { DEFAULT_DAILY_TARGETS } from '@/lib/constants';

export default function ProfileModal({ isOpen, onClose, profile, onSave }) {
  const [form, setForm] = useState({
    age: '',
    sex: 'male',
    weight_kg: '',
    height_cm: '',
    daily_targets: { ...DEFAULT_DAILY_TARGETS },
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        age: profile.age || '',
        sex: profile.sex || 'male',
        weight_kg: profile.weight_kg || '',
        height_cm: profile.height_cm || '',
        daily_targets: profile.daily_targets || { ...DEFAULT_DAILY_TARGETS },
      });
    }
  }, [profile]);

  if (!isOpen) return null;

  async function handleSave() {
    setSaving(true);
    try {
      await onSave?.(form);
      onClose?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card rounded-t-2xl">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">My Profile</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded-lg transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Basic info */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Basic Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Age</label>
                <input
                  type="number"
                  value={form.age}
                  onChange={e => setForm(p => ({ ...p, age: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:border-primary"
                  placeholder="e.g. 30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sex</label>
                <select
                  value={form.sex}
                  onChange={e => setForm(p => ({ ...p, sex: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:border-primary cursor-pointer"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Weight (kg)</label>
                <input
                  type="number"
                  value={form.weight_kg}
                  onChange={e => setForm(p => ({ ...p, weight_kg: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:border-primary"
                  placeholder="e.g. 70"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Height (cm)</label>
                <input
                  type="number"
                  value={form.height_cm}
                  onChange={e => setForm(p => ({ ...p, height_cm: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:border-primary"
                  placeholder="e.g. 175"
                />
              </div>
            </div>
          </div>

          {/* Daily targets */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Daily Nutrition Targets</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Calories (kcal)</label>
                <input
                  type="number"
                  value={form.daily_targets.calories}
                  onChange={e => setForm(p => ({ ...p, daily_targets: { ...p.daily_targets, calories: Number(e.target.value) } }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Protein (g)</label>
                <input
                  type="number"
                  value={form.daily_targets.protein_g}
                  onChange={e => setForm(p => ({ ...p, daily_targets: { ...p.daily_targets, protein_g: Number(e.target.value) } }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Carbs (g)</label>
                <input
                  type="number"
                  value={form.daily_targets.carbs_g}
                  onChange={e => setForm(p => ({ ...p, daily_targets: { ...p.daily_targets, carbs_g: Number(e.target.value) } }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Fat (g)</label>
                <input
                  type="number"
                  value={form.daily_targets.fat_g}
                  onChange={e => setForm(p => ({ ...p, daily_targets: { ...p.daily_targets, fat_g: Number(e.target.value) } }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground italic">
            This tool provides general nutritional guidance only. Please consult a healthcare professional for medical dietary needs.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border sticky bottom-0 bg-card rounded-b-2xl">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
