-- 存量归并:Face pull(此前字典未收录,新 alias face pull -> 面拉)
-- 只改 user_exercises 与 workouts 的动作名;保留历史训练数据,不删除记录。
-- 幂等:重复执行不会再有 'Face pull' 命中。

begin;

-- user_exercises:同用户已有中文行 -> 删除英文行;否则改名,并把 full_body 修正为 back
delete from public.user_exercises ue
using public.user_exercises cn
where ue.name = 'Face pull'
  and cn.user_id = ue.user_id
  and cn.name = '面拉';

update public.user_exercises
set name = '面拉',
    body_part = case when body_part = 'full_body' then 'back'::public.body_part else body_part end,
    updated_at = now()
where name = 'Face pull';

-- workouts.session: exercises[].name;用 ordinality + order by 保序
update public.workouts w
set data = jsonb_set(
      w.data,
      '{exercises}',
      (
        select coalesce(
          jsonb_agg(
            case
              when elem->>'name' = 'Face pull' then jsonb_set(elem, '{name}', to_jsonb('面拉'))
              else elem
            end
            order by ord
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(w.data->'exercises') with ordinality as t(elem, ord)
      )
    )
where w.data ? 'exercises'
  and exists (
    select 1
    from jsonb_array_elements(w.data->'exercises') elem
    where elem->>'name' = 'Face pull'
  );

-- workouts.legacy / session 的 exercise 汇总字段
update public.workouts
set data = jsonb_set(data, '{exercise}', to_jsonb('面拉'))
where data->>'exercise' = 'Face pull';

commit;