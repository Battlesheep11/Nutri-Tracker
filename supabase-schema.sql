-- ============================================================
-- NutriTracker — Supabase Schema
-- Run this in the Supabase SQL Editor to create all required tables.
-- ============================================================

-- 1. User Profiles
-- Stores user info and personalized daily nutrition targets.
create table if not exists user_profiles (
  id          bigint generated always as identity primary key,
  user_id     text not null unique,
  age         integer,
  sex         text,
  weight_kg   numeric,
  height_cm   numeric,
  daily_targets jsonb default '{"calories":2000,"protein_g":100,"carbs_g":250,"fat_g":65}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. Daily Tracker
-- One row per user per day. Accumulates meals and nutrient totals.
create table if not exists daily_tracker (
  id      bigint generated always as identity primary key,
  user_id text not null,
  date    date not null default current_date,
  meals   jsonb default '[]',
  totals  jsonb default '{"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0}',

  unique (user_id, date)
);

-- 3. Meal History
-- Records every recipe shown or eaten for the variety / penalty system.
--   record_type = 'eaten'  → user clicked "Add to meals"
--   record_type = 'shown'  → agent suggested the recipe
create table if not exists meal_history (
  id           bigint generated always as identity primary key,
  user_id      text not null,
  recipe_id    text not null,
  recipe_name  text not null,
  nutrients    jsonb,
  record_type  text not null default 'eaten',
  eaten_at     timestamptz default now()
);

-- Index for fast lookups by user + recency (used by getPenaltyMap)
create index if not exists idx_meal_history_user_eaten
  on meal_history (user_id, eaten_at desc);
