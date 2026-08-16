-- 合并自定义动作名:曲臂下弯(用户自创名,实为双杠臂屈伸)→ 双杠臂屈伸
-- 前端配套:src/fit/exerciseLib.ts 的 EXERCISE_ZH_ALIASES「曲臂下弯 → 双杠臂屈伸」(显示层兜底,再输入时显示正常英文)
-- 幂等:重复执行无副作用(二次运行时已无「曲臂下弯」可匹配)
-- 前置:20260815120000_normalize_exercise_names.sql、20260816120000_map_remaining_exercise_names.sql 已执行

-- 0) 改名映射:旧名(trim 后精确匹配)→ 规范名 → 预设部位(body_part 修正用)
create temp table zh_map (
  old text primary key,
  zh text not null,
  part text not null
);

insert into zh_map (old, zh, part) values
  ('曲臂下弯', '双杠臂屈伸', 'chest');

-- 1) workouts.data.exercises[]:会话格式每个动作名,精确匹配防误伤
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
    left join zh_map m on lower(btrim(elem->>'name')) = m.old
  )
)
where w.type = 'strength'
  and w.data ? 'exercises'
  and jsonb_typeof(w.data->'exercises') = 'array';

-- 2) workouts.data.exercise:legacy 单动作名(兼容字段一并处理,幂等无碍)
update workouts w
set data = jsonb_set(w.data, '{exercise}', to_jsonb(m.zh))
from zh_map m
where w.type = 'strength'
  and jsonb_typeof(w.data->'exercise') = 'string'
  and lower(btrim(w.data->>'exercise')) = m.old;

-- 3) user_exercises:先删「同用户已有规范行(双杠臂屈伸)」的旧名行。
--    顺序必须在改名之前:否则 UPDATE 撞 unique(user_id, name) 报 23505(唯一约束按行即时检查)
delete from public.user_exercises u
using zh_map m
where lower(btrim(u.name)) = m.old
  and exists (
    select 1 from public.user_exercises c
    where c.user_id = u.user_id and c.name = m.zh
  );

-- 4) user_exercises:改名,并修正部位。
--    仅当原部位为 full_body 时改预设部位,用户显式设置过的保留
update public.user_exercises u
set name = m.zh,
    body_part = case
      when u.body_part = 'full_body' then m.part::public.body_part
      else u.body_part
    end,
    updated_at = now()
from zh_map m
where lower(btrim(u.name)) = m.old;

-- 5) 控制台核对(可选):
-- select count(*) from public.workouts
--   where type = 'strength' and data::text like '%曲臂下弯%';
-- select count(*) from public.user_exercises where name = '曲臂下弯';
-- select name, body_part, count(*) from public.user_exercises group by 1, 2 order by 3 desc;
