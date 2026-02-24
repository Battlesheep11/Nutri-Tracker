import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || 'default-user';

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data || null });
}

export async function POST(request) {
  const body = await request.json();
  const { userId = 'default-user', ...profile } = body;

  const { data: existing } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  let result;
  if (existing) {
    result = await supabaseAdmin
      .from('user_profiles')
      .update({ ...profile, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single();
  } else {
    result = await supabaseAdmin
      .from('user_profiles')
      .insert({ user_id: userId, ...profile, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .select()
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: result.data });
}
