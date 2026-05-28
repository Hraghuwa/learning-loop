-- Cross-session cognitive insight (Opus 4.7 weekly synthesis).
create table if not exists cognitive_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  sessions_analyzed integer not null default 0,
  unique (user_id, generated_at)
);

create index if not exists cognitive_insights_user_idx
  on cognitive_insights (user_id, generated_at desc);

-- Personalised study plan (Opus 4.7).
create table if not exists study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  payload jsonb not null,
  target_percentile integer not null,
  weekly_hours integer not null,
  generated_at timestamptz not null default now(),
  active boolean not null default true
);

create index if not exists study_plans_user_idx on study_plans (user_id, generated_at desc);

-- Multi-turn tutor threads, scoped per session attempt.
create table if not exists tutor_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  question_id uuid references questions(id),
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_id)
);

create index if not exists tutor_threads_user_idx on tutor_threads (user_id, updated_at desc);

alter table cognitive_insights enable row level security;
alter table study_plans enable row level security;
alter table tutor_threads enable row level security;

create policy "cognitive_insights self" on cognitive_insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "study_plans self" on study_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tutor_threads self" on tutor_threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
