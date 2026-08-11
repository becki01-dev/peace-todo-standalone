-- bodyweight 体重历史:统计按训练日期取"当天或之前最近一次"体重(阶梯覆盖)
-- 修改体重只影响填写日及之后的训练;同日重复保存 = 更新(unique 约束)
-- (2026-08-11 需在控制台手动执行)

create table public.body_weight_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric not null check (weight_kg > 0),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.body_weight_history enable row level security;

create policy "Users can view their own body weight history"
  on public.body_weight_history for select
  using (auth.uid() = user_id);

create policy "Users can create their own body weight history"
  on public.body_weight_history for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own body weight history"
  on public.body_weight_history for update
  using (auth.uid() = user_id);

create policy "Users can delete their own body weight history"
  on public.body_weight_history for delete
  using (auth.uid() = user_id);
