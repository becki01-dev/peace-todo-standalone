-- 历史动作名覆盖审计收尾:英文拼写变体 + 中文变体并入规范名
-- 数据源:2026-08-17 只读审计(audit-exercise-names workflow)发现的 EN_NO_ZH / ZH_NO_EN 条目
-- 前端配套:src/fit/exerciseLib.ts 的 EXERCISE_ALIASES / EXERCISE_ZH_ALIASES(两端映射集合必须一致)
-- 幂等:重复执行无副作用(二次运行时已无旧名可匹配)

-- 0) 映射表:英文小写 → 中文规范名 → 预设部位(body_part 修正用);中文变体 → 中文规范名
create temp table alias_map (
  en text primary key,
  zh text not null,
  part text not null
);

insert into alias_map (en, zh, part) values
  ('hip abduction', '髋外展', 'legs'),
  ('hip adduction', '髋内收', 'legs'),
  ('chess press', '器械推胸', 'chest'),
  ('dead lift', '硬拉', 'back'),
  ('fly delt', '反向飞鸟', 'shoulders'),
  ('arm curl', '二头弯举', 'arms'),
  ('abdominal', '卷腹', 'core'),
  ('abdominal crunch', '卷腹', 'core'),
  ('back extension', '背伸展', 'back'),
  ('back and side lift', '背伸展', 'back'),
  ('arm extension', '臂屈伸', 'arms'),
  ('triceps press', '臂屈伸', 'arms');

create temp table zh_map (zh text primary key, norm text not null);

insert into zh_map (zh, norm) values
  ('提腿卷腹', '前臂支撑举腿'),
  ('弯臂曲伸', '双杠臂屈伸'),
  ('箭步蹲', '弓步');

-- 1) workouts.data.exercises[]:英文别名 + 中文变体 → 规范名
--    精确匹配 lower(btrim(name)),防止 "squat machine" 等被误伤
update workouts w
set data = jsonb_set(
  w.data,
  '{exercises}',
  (
    select jsonb_agg(
      case
        when m.zh is not null then jsonb_set(elem, '{name}', to_jsonb(m.zh))
        when z.norm is not null then jsonb_set(elem, '{name}', to_jsonb(z.norm))
        else elem
      end
    )
    from jsonb_array_elements(w.data->'exercises') as elem
    left join alias_map m on lower(btrim(elem->>'name')) = m.en
    left join zh_map z on btrim(elem->>'name') = z.zh
  )
)
where w.type = 'strength'
  and w.data ? 'exercises'
  and jsonb_typeof(w.data->'exercises') = 'array';

-- 2a) workouts.data.exercise:legacy 英文别名改名
update workouts w
set data = jsonb_set(w.data, '{exercise}', to_jsonb(m.zh))
from alias_map m
where w.type = 'strength'
  and jsonb_typeof(w.data->'exercise') = 'string'
  and lower(btrim(w.data->>'exercise')) = m.en;

-- 2b) workouts.data.exercise:legacy 中文变体改名
update workouts w
set data = jsonb_set(w.data, '{exercise}', to_jsonb(z.norm))
from zh_map z
where w.type = 'strength'
  and jsonb_typeof(w.data->'exercise') = 'string'
  and btrim(w.data->>'exercise') = z.zh;

-- 3) user_exercises:先删「同用户已有中文规范行」的英文行/变体行
--    顺序必须在改名之前:否则 UPDATE 撞 unique(user_id, name) 报 23505
delete from public.user_exercises u
using alias_map m
where lower(btrim(u.name)) = m.en
  and exists (
    select 1 from public.user_exercises c
    where c.user_id = u.user_id and c.name = m.zh
  );

delete from public.user_exercises u
using zh_map z
where btrim(u.name) = z.zh
  and exists (
    select 1 from public.user_exercises c
    where c.user_id = u.user_id and c.name = z.norm
  );

-- 4) user_exercises:改名(英文别名),部位仅 full_body 时按预设修正,用户显式设置过的保留
update public.user_exercises u
set name = m.zh,
    body_part = case
      when u.body_part = 'full_body' then m.part::public.body_part
      else u.body_part
    end,
    updated_at = now()
from alias_map m
where lower(btrim(u.name)) = m.en;

-- 5) user_exercises:改名(中文变体)
update public.user_exercises u
set name = z.norm, updated_at = now()
from zh_map z
where btrim(u.name) = z.zh;

-- 6) 验证(可选):
-- select name, body_part, count(*) from public.user_exercises group by 1, 2 order by 3 desc;
-- select count(*) from public.user_exercises where name ~ '^[A-Za-z ]+$';
