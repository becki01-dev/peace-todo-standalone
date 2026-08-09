-- P3-2 类型收紧:workouts.type / tasks.priority / user_preferences 单位列
-- TEXT+CHECK → Postgres enum(2026-08-09 已在控制台手动执行)

-- 1. 建枚举
create type public.workout_type as enum ('running', 'swimming', 'strength', 'swimming_set');
create type public.task_priority as enum ('high', 'medium', 'low');
create type public.unit_distance as enum ('km', 'mi');
create type public.unit_weight as enum ('kg', 'lb');
create type public.unit_pool as enum ('m', 'yd');

-- 2. workouts.type 换枚举(无默认值,直接换)
alter table public.workouts drop constraint if exists workouts_type_check;
alter table public.workouts
  alter column type type public.workout_type
  using type::public.workout_type;

-- 3. tasks.priority 换枚举:先 drop 默认 → 换型 → 重设默认
alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks alter column priority drop default;
alter table public.tasks
  alter column priority type public.task_priority
  using priority::public.task_priority;
alter table public.tasks
  alter column priority set default 'medium'::public.task_priority;

-- 4. user_preferences 单位列换枚举(同样先摘默认再还回)
alter table public.user_preferences drop constraint if exists user_preferences_distance_unit_check;
alter table public.user_preferences alter column distance_unit drop default;
alter table public.user_preferences
  alter column distance_unit type public.unit_distance
  using distance_unit::public.unit_distance;
alter table public.user_preferences
  alter column distance_unit set default 'km'::public.unit_distance;

alter table public.user_preferences drop constraint if exists user_preferences_weight_unit_check;
alter table public.user_preferences alter column weight_unit drop default;
alter table public.user_preferences
  alter column weight_unit type public.unit_weight
  using weight_unit::public.unit_weight;
alter table public.user_preferences
  alter column weight_unit set default 'kg'::public.unit_weight;

alter table public.user_preferences drop constraint if exists user_preferences_pool_unit_check;
alter table public.user_preferences alter column pool_unit drop default;
alter table public.user_preferences
  alter column pool_unit type public.unit_pool
  using pool_unit::public.unit_pool;
alter table public.user_preferences
  alter column pool_unit set default 'm'::public.unit_pool;
