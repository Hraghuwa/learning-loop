create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid references auth.users primary key,
  name text,
  target_exam text default 'CAT',
  target_percentile integer default 99,
  plan text default 'free' check (plan in ('free','pro','institute')),
  streak_count integer default 0,
  xp integer default 0,
  last_active_date date,
  created_at timestamptz default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  subtopic text not null,
  difficulty text not null,
  question_text text not null,
  options jsonb not null,
  correct_index integer not null,
  hint text,
  explanation text,
  exam_type text default 'CAT',
  created_at timestamptz default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  question_id uuid references questions(id),
  selected_option integer,
  is_correct boolean,
  reasoning_text text,
  reasoning_input_method text check (reasoning_input_method in ('typed','voice')),
  error_type text,
  reasoning_score integer,
  ai_diagnosis text,
  ai_correction text,
  ai_pattern_alert text,
  ai_next_topic text,
  time_taken_seconds integer,
  created_at timestamptz default now()
);

create table if not exists cognitive_profiles (
  user_id uuid references profiles(id) primary key,
  quant_score numeric default 5,
  varc_score numeric default 5,
  dilr_score numeric default 5,
  reasoning_score numeric default 5,
  speed_score numeric default 5,
  accuracy_score numeric default 5,
  percentile_estimate numeric default 50,
  total_sessions integer default 0,
  top_error_pattern text,
  updated_at timestamptz default now()
);

create table if not exists institute_classes (
  id uuid primary key default gen_random_uuid(),
  institute_name text not null,
  batch_name text not null,
  teacher_id uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists class_enrollments (
  class_id uuid references institute_classes(id),
  student_id uuid references profiles(id),
  primary key (class_id, student_id)
);

create table if not exists analysis_cache (
  cache_key text primary key,
  response_json jsonb not null,
  created_at timestamptz default now()
);

create table if not exists improvement_tracking (
  id uuid primary key default gen_random_uuid(),
  error_type text not null,
  subtopic text not null,
  percentile_delta numeric not null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table sessions enable row level security;
alter table cognitive_profiles enable row level security;
alter table class_enrollments enable row level security;
alter table institute_classes enable row level security;
alter table questions enable row level security;
alter table analysis_cache enable row level security;
alter table improvement_tracking enable row level security;

create policy "profiles own row" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "sessions own rows" on sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cognitive own row" on cognitive_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "questions readable by authenticated" on questions for select using (auth.role() = 'authenticated');
create policy "improvement readable by authenticated" on improvement_tracking for select using (auth.role() = 'authenticated');
