-- Spaced-repetition review queue. Wrong / weak answers reappear on a SM-2-lite schedule.
create table if not exists review_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  due_at timestamptz not null default now(),
  interval_days integer not null default 1,
  ease numeric not null default 2.5,
  attempts integer not null default 0,
  last_outcome text check (last_outcome in ('correct','wrong','skipped')),
  created_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create index if not exists review_queue_due_idx on review_queue (user_id, due_at);

-- Per-subtopic mastery snapshot. EMA-driven, surfaced in dashboards.
create table if not exists subtopic_mastery (
  user_id uuid references profiles(id) on delete cascade,
  topic text not null,
  subtopic text not null,
  mastery numeric not null default 5,
  attempts integer not null default 0,
  correct integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic, subtopic)
);

create index if not exists subtopic_mastery_user_idx on subtopic_mastery (user_id);

-- Daily usage gate (free tier limit etc.).
create table if not exists daily_usage (
  user_id uuid references profiles(id) on delete cascade,
  usage_date date not null default current_date,
  analyses_count integer not null default 0,
  hints_count integer not null default 0,
  primary key (user_id, usage_date)
);

-- Mock-test sessions (timed exam mode).
create table if not exists mock_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress','completed','abandoned')),
  question_ids uuid[] not null,
  answers jsonb not null default '[]'::jsonb,
  duration_seconds integer not null default 1800,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score integer,
  created_at timestamptz not null default now()
);

create index if not exists mock_tests_user_idx on mock_tests (user_id, started_at desc);

alter table review_queue enable row level security;
alter table subtopic_mastery enable row level security;
alter table daily_usage enable row level security;
alter table mock_tests enable row level security;

create policy "review_queue self" on review_queue for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "subtopic_mastery self" on subtopic_mastery for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_usage self" on daily_usage for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mock_tests self" on mock_tests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Convenience function: increments today's analyses_count and returns the new count.
create or replace function increment_daily_analyses(uid uuid)
returns integer
language plpgsql
security definer
as $$
declare
  new_count integer;
begin
  insert into daily_usage (user_id, usage_date, analyses_count)
  values (uid, current_date, 1)
  on conflict (user_id, usage_date)
  do update set analyses_count = daily_usage.analyses_count + 1
  returning analyses_count into new_count;
  return new_count;
end;
$$;

grant execute on function increment_daily_analyses(uuid) to authenticated, service_role;
