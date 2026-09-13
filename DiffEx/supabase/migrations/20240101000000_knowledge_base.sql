-- DiffEx knowledge base tables
-- Run in Supabase SQL editor or via: supabase db push

create table if not exists public.features (
  id text primary key,
  canonical_label text not null,
  feature_type text not null check (feature_type in ('symptom','vital','history','lab','test','other')),
  value_type text not null check (value_type in ('boolean','numeric','categorical','text')),
  synonyms text[] not null default '{}',
  usage_count integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canonical_label)
);

create table if not exists public.conditions (
  id text primary key,
  label text not null,
  category text,
  acuteness float not null default 0.5,
  prior_base float not null default 1.0,
  created_at timestamptz not null default now(),
  unique (label)
);

create table if not exists public.condition_feature_edges (
  condition_id text not null references public.conditions(id) on delete cascade,
  feature_id text not null references public.features(id) on delete cascade,
  lr_present float not null,
  lr_absent float not null,
  primary key (condition_id, feature_id)
);

-- Indexes for efficient evidence-driven lookups at 70k-condition scale
create index if not exists idx_edges_feature_id on public.condition_feature_edges(feature_id);
create index if not exists idx_edges_condition_id on public.condition_feature_edges(condition_id);
create index if not exists idx_conditions_label on public.conditions(label);
create index if not exists idx_conditions_category on public.conditions(category);
create index if not exists idx_features_label on public.features(canonical_label);
create index if not exists idx_features_synonyms on public.features using gin(synonyms);

-- Row Level Security
alter table public.features enable row level security;
alter table public.conditions enable row level security;
alter table public.condition_feature_edges enable row level security;

-- Public read (knowledge base is not sensitive)
create policy "Public read features" on public.features for select using (true);
create policy "Public read conditions" on public.conditions for select using (true);
create policy "Public read edges" on public.condition_feature_edges for select using (true);

-- Allow inserts/updates for app-side seeding (lock down to service role in production)
create policy "Public insert features" on public.features for insert with check (true);
create policy "Public update features" on public.features for update using (true);
create policy "Public insert conditions" on public.conditions for insert with check (true);
create policy "Public update conditions" on public.conditions for update using (true);
create policy "Public insert edges" on public.condition_feature_edges for insert with check (true);
create policy "Public update edges" on public.condition_feature_edges for update using (true);
