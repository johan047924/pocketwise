-- Run this in the Supabase SQL Editor.
-- Row Level Security means every user's financial data is scoped to their own account.
create extension if not exists pgcrypto;

create table if not exists public.financial_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'CAD',
  starting_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income','expense','transfer')),
  amount numeric(12,2) not null check (amount > 0),
  description text not null default '',
  category text not null default 'Other',
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.income_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'Employment',
  amount numeric(12,2) not null check (amount > 0),
  received_date date not null,
  frequency text not null default 'biweekly',
  expected_end_date date,
  is_estimate boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount > 0),
  category text not null default 'Bills',
  frequency text not null check (frequency in ('weekly','biweekly','monthly','quarterly','yearly','custom')),
  interval_days integer,
  next_payment_date date not null,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  monthly_limit numeric(12,2) not null check (monthly_limit >= 0),
  priority integer not null default 3 check (priority between 1 and 5),
  rollover boolean not null default false,
  unique(user_id, category)
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  saved_amount numeric(12,2) not null default 0 check (saved_amount >= 0),
  target_date date,
  priority integer not null default 3 check (priority between 1 and 5),
  created_at timestamptz not null default now()
);

alter table public.financial_profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.income_cycles enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;

create policy "Own profile only" on public.financial_profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own transactions only" on public.transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own income cycles only" on public.income_cycles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own recurring expenses only" on public.recurring_expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own budgets only" on public.budgets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own goals only" on public.savings_goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists transactions_user_date_idx on public.transactions(user_id, transaction_date desc);
create index if not exists recurring_user_next_date_idx on public.recurring_expenses(user_id, next_payment_date);
