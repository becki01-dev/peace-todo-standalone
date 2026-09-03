-- 补充用户自定义英文动作名的字典映射 + 存量数据归并
-- 背景:用户 2026-08-26 / 09-02 两次力量训练录入的新动作(英文名)未被 exercise_dictionary 覆盖,
--      名字原样入库:Bulgarian Split Squat / Dumbbell Arm Row / Dumbbell Lunge Jump / Deadbug /
--      Dumbbell Step-Ups / Step up / Wrist Curls。本次把这些英文别名与中文显示英文补进字典,
--      并把存量 workouts / user_exercises 归并到用户确认的中文规范名。
-- 规范名与部位归属经用户确认(与 src/fit/exerciseLib.ts 无代码联动,运行时字典来自 DB)。
-- 幂等:重复执行无副作用(二次运行时已无旧名可匹配、字典 ON CONFLICT DO NOTHING)。

-- 0) 改名映射:旧英文名(lower+btrim 精确匹配)→ 中文规范名 → 部位(仅 full_body 修正用)
create temp table alias_map (
  en text primary key,
  zh text not null,
  part text not null
);

insert into alias_map (en, zh, part) values
  ('bulgarian split squat', '保加利亚分腿蹲', 'legs'),
  ('bulgarian split squats', '保加利亚分腿蹲', 'legs'),
  ('dumbbell arm row', '哑铃划船', 'back'),
  ('dumbbell arm rows', '哑铃划船', 'back'),
  ('dumbbell lunge jump', '哑铃弓步跳', 'legs'),
  ('deadbug', '死虫', 'core'),
  ('dead bug', '死虫', 'core'),
  ('dumbbell step-ups', '哑铃上台阶', 'legs'),
  ('dumbbell step-up', '哑铃上台阶', 'legs'),
  ('step up', '上台阶', 'legs'),
  ('step ups', '上台阶', 'legs'),
  ('wrist curls', '腕弯举', 'arms'),
  ('wrist curl', '腕弯举', 'arms');

-- 1) 字典持久化:alias(英文→中文)+ en(中文→显示英文);zh_alias 无新增
insert into public.exercise_dictionary (kind, key, value) values
  ('alias', 'bulgarian split squat', '保加利亚分腿蹲'),
  ('alias', 'bulgarian split squats', '保加利亚分腿蹲'),
  ('alias', 'dumbbell arm row', '哑铃划船'),
  ('alias', 'dumbbell arm rows', '哑铃划船'),
  ('alias', 'dumbbell lunge jump', '哑铃弓步跳'),
  ('alias', 'deadbug', '死虫'),
  ('alias', 'dead bug', '死虫'),
  ('alias', 'dumbbell step-ups', '哑铃上台阶'),
  ('alias', 'dumbbell step-up', '哑铃上台阶'),
  ('alias', 'step up', '上台阶'),
  ('alias', 'step ups', '上台阶'),
  ('alias', 'wrist curls', '腕弯举'),
  ('alias', 'wrist curl', '腕弯举'),
  ('en', '保加利亚分腿蹲', 'Bulgarian Split Squat'),
  ('en', '哑铃划船', 'Dumbbell Row'),
  ('en', '哑铃弓步跳', 'Dumbbell Lunge Jump'),
  ('en', '死虫', 'Dead Bug'),
  ('en', '哑铃上台阶', 'Dumbbell Step-Up'),
  ('en', '上台阶', 'Step-Up'),
  ('en', '腕弯举', 'Wrist Curl')
on conflict (kind, key) do nothing;

-- 2) workouts.data.exercises[]:会话格式的英文动作名 → 中文规范名
--    精确匹配 lower(btrim(name)),防止 "squat machine" 等被误伤
update workouts w
set data = jsonb_set(
  w.data,
  '{exercises}',
  (
    select jsonb_agg(
      case
        when m.zh is not null then jsonb_set(elem, '{name}', to_jsonb(m.zh))
        else elem
      end
    )
    from jsonb_array_elements(w.data->'exercises') as elem
    left join alias_map m on lower(btrim(elem->>'name')) = m.en
  )
)
where w.type = 'strength'
  and w.data ? 'exercises'
  and jsonb_typeof(w.data->'exercises') = 'array';

-- 3) workouts.data.exercise:legacy 单动作英文名(兼容字段一并处理,幂等无碍)
update workouts w
set data = jsonb_set(w.data, '{exercise}', to_jsonb(m.zh))
from alias_map m
where w.type = 'strength'
  and jsonb_typeof(w.data->'exercise') = 'string'
  and lower(btrim(w.data->>'exercise')) = m.en;

-- 4) user_exercises:先删「同用户已有中文规范行」的英文行。
--    顺序必须在改名之前:否则 UPDATE 撞 unique(user_id, name) 报 23505(唯一约束按行即时检查)
delete from public.user_exercises u
using alias_map m
where lower(btrim(u.name)) = m.en
  and exists (
    select 1 from public.user_exercises c
    where c.user_id = u.user_id and c.name = m.zh
  );

-- 5) user_exercises:改名;部位仅 full_body 时按规范修正,用户显式设置过的保留
update public.user_exercises u
set name = m.zh,
    body_part = case
      when u.body_part = 'full_body' then m.part::public.body_part
      else u.body_part
    end,
    updated_at = now()
from alias_map m
where lower(btrim(u.name)) = m.en;

-- 6) 验证(可选):
-- select kind, count(*) from public.exercise_dictionary group by 1 order by 1;  -- alias 186 / en 35 / zh_alias 6
-- select name, body_part, count(*) from public.user_exercises group by 1, 2 order by 3 desc;
-- select count(*) from public.user_exercises where name ~ '^[A-Za-z ]+$';  -- 期望 0
