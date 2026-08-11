-- 力量训练精细化:动作字典 user_exercises + 部位枚举
-- 支撑部位统计(字典→preset 兜底→全身)、常用动作列表、动作默认设置(BW/次数)
-- 种子动作由前端 PRESET_DEFS 首次使用时批量登记(migration 无法预置用户数据)
-- (2026-08-11 需在控制台手动执行)

create type public.body_part as enum ('chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'neck', 'full_body');

create table public.user_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  body_part public.body_part not null default 'full_body',
  bodyweight_default boolean not null default false,
  default_reps int,
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.user_exercises enable row level security;

create policy "Users can view their own exercises"
  on public.user_exercises for select
  using (auth.uid() = user_id);

create policy "Users can create their own exercises"
  on public.user_exercises for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own exercises"
  on public.user_exercises for update
  using (auth.uid() = user_id);

create policy "Users can delete their own exercises"
  on public.user_exercises for delete
  using (auth.uid() = user_id);
