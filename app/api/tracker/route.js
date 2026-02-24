import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { format } from 'date-fns';
import { recordMeal } from '@/lib/tools/mealMemory';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || 'default-user';
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');

  const { data, error } = await supabaseAdmin
    .from('daily_tracker')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tracker = data || {
    user_id: userId,
    date,
    meals: [],
    totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  };

  return NextResponse.json({ tracker });
}

export async function POST(request) {
  const body = await request.json();
  const { userId = 'default-user', date, meal, nutrients } = body;
  const today = date || format(new Date(), 'yyyy-MM-dd');

  const { data: existing } = await supabaseAdmin
    .from('daily_tracker')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (meal) {
    await recordMeal(userId, meal).catch(e => console.warn('[Tracker] recordMeal failed:', e.message));
  }

  if (existing) {
    const meals = [...(existing.meals || []), meal];
    const totals = {
      calories: (existing.totals?.calories || 0) + (nutrients?.calories || 0),
      protein_g: (existing.totals?.protein_g || 0) + (nutrients?.protein_g || 0),
      carbs_g: (existing.totals?.carbs_g || 0) + (nutrients?.carbs_g || 0),
      fat_g: (existing.totals?.fat_g || 0) + (nutrients?.fat_g || 0),
      fiber_g: (existing.totals?.fiber_g || 0) + (nutrients?.fiber_g || 0),
    };

    const { data, error } = await supabaseAdmin
      .from('daily_tracker')
      .update({ meals, totals })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tracker: data });
  }

  const { data, error } = await supabaseAdmin
    .from('daily_tracker')
    .insert({
      user_id: userId,
      date: today,
      meals: meal ? [meal] : [],
      totals: nutrients || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tracker: data });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || 'default-user';
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');

  const { error } = await supabaseAdmin
    .from('daily_tracker')
    .delete()
    .eq('user_id', userId)
    .eq('date', date);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
